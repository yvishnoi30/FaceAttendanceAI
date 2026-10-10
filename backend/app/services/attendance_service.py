
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.app.database.models import (
    AttendanceRecord,
    AttendanceStatus,
    ClassSession,
    Student,
)


def mark_student_present(
    db: Session,
    student_id: UUID,
    class_session_id: UUID,
    similarity: float,
    recognition_confidence: float | None = None,
) -> dict:
    """
    Record attendance for a recognized student in a class session.

    Notes:
    - This function is retained for compatibility with the existing
      live-attendance endpoint.
    - It does not automatically classify a student as LATE.
    - The current AttendanceRecord model does not define a
      recognition_confidence field, so that argument is not passed
      to the SQLAlchemy model.
    - A unique student/session constraint prevents duplicate records.
    """

    if not 0.0 <= similarity <= 1.0:
        raise ValueError("Similarity must be between 0 and 1.")

    student = db.get(Student, student_id)

    if student is None or not student.is_active:
        raise ValueError("Student does not exist or is inactive.")

    class_session = db.get(ClassSession, class_session_id)

    if class_session is None:
        raise ValueError("Class session not found.")

    if class_session.is_completed:
        raise ValueError(
            "Cannot mark attendance for a completed class session."
        )

    existing_statement = select(AttendanceRecord).where(
        AttendanceRecord.student_id == student_id,
        AttendanceRecord.class_session_id == class_session_id,
    )

    existing_record = db.scalars(existing_statement).first()

    if existing_record is not None:
        existing_status = existing_record.status
        if hasattr(existing_status, "value"):
            existing_status = existing_status.value

        return {
            "marked": False,
            "duplicate": True,
            "attendance_id": str(existing_record.id),
            "student_id": str(student_id),
            "class_session_id": str(class_session_id),
            "status": str(existing_status),
            "message": (
                "Attendance has already been recorded for this session."
            ),
        }

    # Store the current UTC time. The database column is timezone-aware
    # in the current model; avoid silently converting UTC to local time.
    now = datetime.now(timezone.utc)

    record_values = {
        "student_id": student_id,
        "class_session_id": class_session_id,
        "status": AttendanceStatus.PRESENT,
        "check_in_time": now,
        "recognition_similarity": float(similarity),
        "notes": (
            "Recorded after live-camera face recognition. "
            "Status may be reviewed by the administrator."
        ),
    }

    # Only map the supplied confidence to the model if the model really
    # exposes a mapped confidence column.
    if (
        recognition_confidence is not None
        and hasattr(AttendanceRecord, "confidence")
    ):
        record_values["confidence"] = float(recognition_confidence)

    record = AttendanceRecord(**record_values)

    try:
        db.add(record)
        db.commit()
        db.refresh(record)

        saved_status = record.status
        if hasattr(saved_status, "value"):
            saved_status = saved_status.value

        return {
            "marked": True,
            "duplicate": False,
            "attendance_id": str(record.id),
            "student_id": str(student_id),
            "class_session_id": str(class_session_id),
            "status": str(saved_status),
            "similarity": round(float(similarity), 4),
            "message": (
                "Attendance recorded successfully with PRESENT status."
            ),
        }

    except IntegrityError:
        db.rollback()

        # Another request may have inserted the same student/session
        # record between the duplicate check and commit.
        existing_record = db.scalars(existing_statement).first()

        if existing_record is not None:
            existing_status = existing_record.status
            if hasattr(existing_status, "value"):
                existing_status = existing_status.value

            return {
                "marked": False,
                "duplicate": True,
                "attendance_id": str(existing_record.id),
                "student_id": str(student_id),
                "class_session_id": str(class_session_id),
                "status": str(existing_status),
                "message": (
                    "Attendance was already recorded for this session."
                ),
            }

        raise

    except Exception:
        db.rollback()
        raise
