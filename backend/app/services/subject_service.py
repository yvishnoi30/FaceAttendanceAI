
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.database.models import Subject
from backend.app.schemas.subject import SubjectCreate


def create_subject(db: Session, subject_data: SubjectCreate) -> Subject:
    subject = Subject(**subject_data.model_dump())

    try:
        db.add(subject)
        db.commit()
        db.refresh(subject)
        return subject
    except Exception:
        db.rollback()
        raise


def get_subjects(
    db: Session,
    skip: int = 0,
    limit: int = 100,
) -> list[Subject]:
    statement = (
        select(Subject)
        .order_by(Subject.created_at.desc())
        .offset(skip)
        .limit(limit)
    )

    return list(db.scalars(statement).all())
