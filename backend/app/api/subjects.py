from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.app.database.models import ClassSession, Subject
from backend.app.database.session import get_db

router = APIRouter(prefix="/subjects", tags=["Subjects"])


class SubjectCreate(BaseModel):
    code: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=200)
    department: str | None = Field(default=None, max_length=150)
    semester: int | None = Field(default=None, ge=1, le=20)


class SubjectUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=1, max_length=50)
    name: str | None = Field(default=None, min_length=1, max_length=200)
    department: str | None = Field(default=None, max_length=150)
    semester: int | None = Field(default=None, ge=1, le=20)
    is_active: bool | None = None


def _serialize(subject: Subject) -> dict:
    return {
        "id": str(subject.id), "code": subject.code, "name": subject.name,
        "subject_name": subject.name, "department": subject.department,
        "semester": subject.semester, "is_active": subject.is_active,
        "created_at": subject.created_at.isoformat() if subject.created_at else None,
        "class_session_count": len(subject.class_sessions or []),
    }


@router.get("")
def list_subjects(db: Session = Depends(get_db)) -> dict:
    subjects = db.scalars(select(Subject).order_by(Subject.name.asc())).all()
    return {"count": len(subjects), "items": [_serialize(item) for item in subjects], "subjects": [_serialize(item) for item in subjects]}


@router.post("", status_code=status.HTTP_201_CREATED)
def create_subject(payload: SubjectCreate, db: Session = Depends(get_db)) -> dict:
    code = payload.code.strip()
    name = payload.name.strip()
    if not code or not name:
        raise HTTPException(status_code=422, detail="Subject code and name are required.")
    if db.scalar(select(Subject.id).where(Subject.code.ilike(code))) is not None:
        raise HTTPException(status_code=409, detail="A subject with this code already exists.")
    subject = Subject(code=code, name=name, department=payload.department.strip() if payload.department else None, semester=payload.semester)
    db.add(subject)
    try:
        db.commit(); db.refresh(subject)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Subject code must be unique.")
    return _serialize(subject)


@router.patch("/{subject_id}")
def update_subject(subject_id: UUID, payload: SubjectUpdate, db: Session = Depends(get_db)) -> dict:
    subject = db.get(Subject, subject_id)
    if subject is None:
        raise HTTPException(status_code=404, detail="Subject not found.")
    values = payload.model_dump(exclude_unset=True)
    if "code" in values and values["code"] is not None:
        values["code"] = values["code"].strip()
        duplicate = db.scalar(select(Subject.id).where(Subject.code.ilike(values["code"]), Subject.id != subject_id))
        if duplicate is not None:
            raise HTTPException(status_code=409, detail="A subject with this code already exists.")
    if "name" in values and values["name"] is not None:
        values["name"] = values["name"].strip()
    if "department" in values and values["department"] is not None:
        values["department"] = values["department"].strip() or None
    for key, value in values.items():
        setattr(subject, key, value)
    try:
        db.commit(); db.refresh(subject)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Could not update subject; check that its code is unique.")
    return _serialize(subject)


@router.delete("/{subject_id}")
def delete_subject(subject_id: UUID, db: Session = Depends(get_db)) -> dict:
    subject = db.get(Subject, subject_id)
    if subject is None:
        raise HTTPException(status_code=404, detail="Subject not found.")
    count = len(subject.class_sessions or [])
    if count:
        raise HTTPException(status_code=409, detail=f"Cannot delete this subject because it has {count} class session(s). Delete those sessions first; attendance history is linked to each session.")
    db.delete(subject)
    db.commit()
    return {"success": True, "message": "Subject deleted successfully."}
