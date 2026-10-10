from __future__ import annotations

from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.app.database.models import (
    AttendanceRecord,
    AttendanceStatus,
    ClassSession,
    Student,
)
from backend.app.database.session import get_db

router = APIRouter(prefix="/attendance/statistics", tags=["Attendance Statistics"])


@router.get("/class-sessions/{class_session_id}")
def get_class_session_statistics(
    class_session_id: UUID,
    db: Session = Depends(get_db),
) -> dict:
    """Return attendance counts and percentage for one class session."""
    class_session = db.get(ClassSession, class_session_id)
    if class_session is None:
        raise HTTPException(status_code=404, detail="Class session not found.")

    # Count students recorded for this session by attendance status.
    status_rows = db.execute(
        select(AttendanceRecord.status, func.count(AttendanceRecord.id))
        .where(AttendanceRecord.class_session_id == class_session_id)
        .group_by(AttendanceRecord.status)
    ).all()

    counts = {
        "present": 0,
        "late": 0,
        "absent": 0,
        "excused": 0,
    }
    for status_value, count in status_rows:
        value = status_value.value if hasattr(status_value, "value") else str(status_value)
        key = value.lower()
        if key in counts:
            counts[key] = int(count)

    # The project model has semester/department fields on Student and Subject.
    # Count active students in the same department and semester as this session's
    # subject, where those fields are available. If unavailable, report null rather
    # than silently treating recorded students as the entire class roster.
    subject = getattr(class_session, "subject", None)
    total_enrolled: int | None = None
    if subject is not None and hasattr(subject, "department") and hasattr(subject, "semester"):
        total_enrolled = int(
            db.scalar(
                select(func.count(Student.id)).where(
                    Student.is_active.is_(True),
                    Student.department == subject.department,
                    Student.semester == subject.semester,
                )
            ) or 0
        )

    attendance_record_count = sum(counts.values())
    denominator = total_enrolled if total_enrolled is not None else attendance_record_count
    attended_count = counts["present"] + counts["late"]
    attendance_percentage = (
        round((attended_count / denominator) * 100, 2)
        if denominator > 0
        else 0.0
    )

    return {
        "class_session_id": str(class_session.id),
        "subject_id": str(class_session.subject_id),
        "session_date": class_session.session_date.isoformat()
        if class_session.session_date is not None else None,
        "total_active_students_in_subject_cohort": total_enrolled,
        "attendance_record_count": attendance_record_count,
        "present_count": counts["present"],
        "late_count": counts["late"],
        "absent_count": counts["absent"],
        "excused_count": counts["excused"],
        "attended_count": attended_count,
        "attendance_percentage": attendance_percentage,
        "percentage_denominator": denominator,
        "percentage_note": (
            "Percentage uses active students matching the subject department "
            "and semester."
            if total_enrolled is not None
            else "Percentage uses recorded attendance rows because the session's "
                 "subject relationship or cohort fields were unavailable; this "
                 "may not represent the full class roster."
        ),
    }


@router.get("/summary")
def get_attendance_summary(
    session_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
) -> dict:
    """Return aggregate attendance counts across all sessions, optionally by date."""
    statement = (
        select(AttendanceRecord.status, func.count(AttendanceRecord.id))
        .join(ClassSession, AttendanceRecord.class_session_id == ClassSession.id)
    )
    if session_date is not None:
        statement = statement.where(ClassSession.session_date == session_date)
    statement = statement.group_by(AttendanceRecord.status)

    counts = {"present": 0, "late": 0, "absent": 0, "excused": 0}
    for status_value, count in db.execute(statement).all():
        value = status_value.value if hasattr(status_value, "value") else str(status_value)
        key = value.lower()
        if key in counts:
            counts[key] = int(count)

    total = sum(counts.values())
    return {
        "session_date": session_date.isoformat() if session_date else None,
        "total_attendance_records": total,
        "present_count": counts["present"],
        "late_count": counts["late"],
        "absent_count": counts["absent"],
        "excused_count": counts["excused"],
    }
