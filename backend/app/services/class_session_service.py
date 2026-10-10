

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.database.models import ClassSession, Subject
from backend.app.schemas.class_session import ClassSessionCreate


def create_class_session(
    db: Session,
    session_data: ClassSessionCreate,
) -> ClassSession:
    subject = db.get(Subject, session_data.subject_id)

    if subject is None:
        raise ValueError("Subject not found")

    if not subject.is_active:
        raise ValueError("Cannot create a session for an inactive subject")

    class_session = ClassSession(**session_data.model_dump())

    try:
        db.add(class_session)
        db.commit()
        db.refresh(class_session)
        return class_session
    except Exception:
        db.rollback()
        raise


def get_class_sessions(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    subject_id: UUID | None = None,
) -> list[ClassSession]:
    statement = select(ClassSession)

    if subject_id is not None:
        statement = statement.where(
            ClassSession.subject_id == subject_id
        )

    statement = (
        statement
        .order_by(
            ClassSession.session_date.desc(),
            ClassSession.start_time.desc(),
        )
        .offset(skip)
        .limit(limit)
    )

    return list(db.scalars(statement).all())


def get_class_session_by_id(
    db: Session,
    session_id: UUID,
) -> ClassSession | None:
    return db.get(ClassSession, session_id)
