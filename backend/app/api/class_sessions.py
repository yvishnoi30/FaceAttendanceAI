from __future__ import annotations

from datetime import date, time
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from backend.app.database.models import AttendanceRecord, ClassSession, Subject
from backend.app.database.session import get_db

router = APIRouter(prefix="/class-sessions", tags=["Class Sessions"])


class ClassSessionCreate(BaseModel):
    subject_id: UUID
    session_date: date
    start_time: time
    end_time: time
    room: str | None = Field(default=None, max_length=100)
    faculty_name: str | None = Field(default=None, max_length=200)


def _serialize(session: ClassSession) -> dict:
    subject = session.subject
    return {
        "id": str(session.id), "class_session_id": str(session.id), "session_id": str(session.id),
        "subject_id": str(session.subject_id),
        "subject_name": subject.name if subject else None,
        "subject_code": subject.code if subject else None,
        "subject": {"id": str(subject.id), "name": subject.name, "code": subject.code} if subject else None,
        "session_name": f"{subject.name if subject else 'Class'} · {session.session_date.isoformat()} · {session.start_time.strftime('%H:%M')}",
        "session_date": session.session_date.isoformat() if session.session_date else None,
        "start_time": session.start_time.strftime("%H:%M") if session.start_time else None,
        "end_time": session.end_time.strftime("%H:%M") if session.end_time else None,
        "room": session.room, "faculty_name": session.faculty_name,
        "is_completed": session.is_completed,
        "created_at": session.created_at.isoformat() if session.created_at else None,
    }


@router.get("")
def list_class_sessions(db: Session = Depends(get_db)) -> dict:
    rows = db.scalars(select(ClassSession).options(joinedload(ClassSession.subject)).order_by(ClassSession.session_date.desc(), ClassSession.start_time.desc())).unique().all()
    items = [_serialize(item) for item in rows]
    return {"count": len(items), "items": items, "sessions": items}


@router.post("", status_code=status.HTTP_201_CREATED)
def create_class_session(payload: ClassSessionCreate, db: Session = Depends(get_db)) -> dict:
    if payload.end_time <= payload.start_time:
        raise HTTPException(status_code=422, detail="End time must be later than start time.")
    subject = db.get(Subject, payload.subject_id)
    if subject is None:
        raise HTTPException(status_code=404, detail="Subject not found. Create or select a valid subject first.")
    session = ClassSession(subject_id=payload.subject_id, session_date=payload.session_date, start_time=payload.start_time, end_time=payload.end_time, room=payload.room.strip() if payload.room else None, faculty_name=payload.faculty_name.strip() if payload.faculty_name else None)
    db.add(session); db.commit(); db.refresh(session)
    session = db.scalar(select(ClassSession).options(joinedload(ClassSession.subject)).where(ClassSession.id == session.id))
    return _serialize(session)


@router.delete("/{class_session_id}")
def delete_class_session(class_session_id: UUID, delete_attendance: bool = Query(default=False), db: Session = Depends(get_db)) -> dict:
    session = db.get(ClassSession, class_session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Class session not found.")
    record_count = db.scalar(select(func.count(AttendanceRecord.id)).where(AttendanceRecord.class_session_id == class_session_id)) or 0
    if record_count and not delete_attendance:
        raise HTTPException(status_code=409, detail=f"This session has {record_count} attendance record(s). Confirm deletion with delete_attendance=true to delete the session and those records.")
    if record_count:
        db.query(AttendanceRecord).filter(AttendanceRecord.class_session_id == class_session_id).delete(synchronize_session=False)
    db.delete(session); db.commit()
    return {"success": True, "deleted_session_id": str(class_session_id), "deleted_attendance_records": int(record_count), "message": "Class session and related attendance records deleted." if record_count else "Class session deleted."}
