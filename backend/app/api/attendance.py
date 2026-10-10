from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.database.models import (
    AttendanceRecord,
    AttendanceStatus,
    ClassSession,
    Student,
)
from backend.app.database.session import get_db

router = APIRouter(prefix="/attendance", tags=["Attendance"])


class ManualAttendanceRequest(BaseModel):
    student_id: UUID
    class_session_id: UUID
    status: AttendanceStatus


class AttendanceStatusUpdate(BaseModel):
    status: AttendanceStatus


def _status_value(status: Any) -> str:
    return status.value if hasattr(status, "value") else str(status)


def _record_to_dict(record: AttendanceRecord, student: Student, session: ClassSession) -> dict:
    return {
        "attendance_id": str(record.id),
        "student_id": str(student.id),
        "enrollment_number": student.enrollment_number,
        "student_name": " ".join(
            part for part in [student.first_name, student.last_name] if part
        ),
        "class_session_id": str(session.id),
        "subject_id": str(session.subject_id),
        "session_date": session.session_date.isoformat()
        if session.session_date is not None else None,
        "subject_name": getattr(getattr(session, "subject", None), "name", None),
        "status": _status_value(record.status),
        "check_in_time": record.check_in_time.isoformat()
        if record.check_in_time is not None else None,
        "check_out_time": record.check_out_time.isoformat()
        if record.check_out_time is not None else None,
        "recognition_similarity": record.recognition_similarity,
        "notes": record.notes,
        "created_at": record.created_at.isoformat()
        if record.created_at is not None else None,
    }


def _query_records(
    db: Session,
    class_session_id: UUID | None = None,
    student_id: UUID | None = None,
    status: AttendanceStatus | None = None,
    session_date: date | None = None,
) -> list[dict]:
    statement = (
        select(AttendanceRecord, Student, ClassSession)
        .join(Student, AttendanceRecord.student_id == Student.id)
        .join(ClassSession, AttendanceRecord.class_session_id == ClassSession.id)
    )
    if class_session_id is not None:
        statement = statement.where(AttendanceRecord.class_session_id == class_session_id)
    if student_id is not None:
        statement = statement.where(AttendanceRecord.student_id == student_id)
    if status is not None:
        statement = statement.where(AttendanceRecord.status == status)
    if session_date is not None:
        statement = statement.where(ClassSession.session_date == session_date)
    statement = statement.order_by(
        ClassSession.session_date.desc(), AttendanceRecord.check_in_time.desc()
    )
    rows = db.execute(statement).all()
    return [_record_to_dict(record, student, session) for record, student, session in rows]


@router.get("")
def list_attendance(
    class_session_id: UUID | None = Query(default=None),
    student_id: UUID | None = Query(default=None),
    status: AttendanceStatus | None = Query(default=None),
    session_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
) -> dict:
    """List attendance records with optional session, student, status, and date filters."""
    records = _query_records(db, class_session_id, student_id, status, session_date)
    return {"count": len(records), "records": records}


@router.post("/manual")
def set_manual_attendance(
    payload: ManualAttendanceRequest,
    db: Session = Depends(get_db),
) -> dict:
    """Create or update a student's attendance status as selected by the administrator."""
    student = db.get(Student, payload.student_id)
    if student is None:
        raise HTTPException(status_code=404, detail="Student not found.")
    if not student.is_active:
        raise HTTPException(status_code=400, detail="Cannot mark attendance for an inactive student.")

    session = db.get(ClassSession, payload.class_session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Class session not found.")

    record = db.scalar(select(AttendanceRecord).where(
        AttendanceRecord.student_id == payload.student_id,
        AttendanceRecord.class_session_id == payload.class_session_id,
    ))
    now = datetime.now(timezone.utc)
    if record is None:
        record = AttendanceRecord(
            student_id=payload.student_id,
            class_session_id=payload.class_session_id,
            status=payload.status,
            check_in_time=now if payload.status in (AttendanceStatus.PRESENT, AttendanceStatus.LATE) else None,
            notes="Status set manually by administrator.",
        )
        db.add(record)
    else:
        record.status = payload.status
        if payload.status in (AttendanceStatus.PRESENT, AttendanceStatus.LATE) and record.check_in_time is None:
            record.check_in_time = now
        previous_notes = (record.notes or "").strip()
        audit_note = "Status updated manually by administrator."
        record.notes = f"{previous_notes} {audit_note}".strip() if audit_note not in previous_notes else previous_notes

    try:
        db.commit()
        db.refresh(record)
    except Exception:
        db.rollback()
        raise

    return {
        "success": True,
        "attendance_id": str(record.id),
        "student_id": str(student.id),
        "class_session_id": str(session.id),
        "status": _status_value(record.status),
        "message": "Attendance status saved successfully.",
    }


@router.patch("/{attendance_id}/status")
def update_attendance_status(
    attendance_id: UUID,
    payload: AttendanceStatusUpdate,
    db: Session = Depends(get_db),
) -> dict:
    """Change the status of an existing attendance record."""
    record = db.get(AttendanceRecord, attendance_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Attendance record not found.")
    record.status = payload.status
    if payload.status in (AttendanceStatus.PRESENT, AttendanceStatus.LATE) and record.check_in_time is None:
        record.check_in_time = datetime.now(timezone.utc)
    try:
        db.commit()
        db.refresh(record)
    except Exception:
        db.rollback()
        raise
    return {
        "success": True,
        "attendance_id": str(record.id),
        "status": _status_value(record.status),
        "message": "Attendance status updated successfully.",
    }


@router.get("/class-sessions/{class_session_id}")
def get_session_attendance(class_session_id: UUID, db: Session = Depends(get_db)) -> dict:
    """Get all recorded attendance for one class session."""
    session = db.get(ClassSession, class_session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Class session not found.")
    records = _query_records(db=db, class_session_id=class_session_id)
    return {
        "class_session_id": str(class_session_id),
        "session_date": session.session_date.isoformat() if session.session_date is not None else None,
        "count": len(records),
        "records": records,
    }


@router.get("/students/{student_id}")
def get_student_attendance(student_id: UUID, db: Session = Depends(get_db)) -> dict:
    """Get the attendance history for one student."""
    student = db.get(Student, student_id)
    if student is None:
        raise HTTPException(status_code=404, detail="Student not found.")
    records = _query_records(db=db, student_id=student_id)
    return {
        "student_id": str(student_id),
        "enrollment_number": student.enrollment_number,
        "student_name": " ".join(part for part in [student.first_name, student.last_name] if part),
        "count": len(records),
        "records": records,
    }
