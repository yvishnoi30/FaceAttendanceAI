
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.database.models import Student
from backend.app.schemas.student import StudentCreate, StudentUpdate


def create_student(db: Session, student_data: StudentCreate) -> Student:
    student = Student(**student_data.model_dump())

    try:
        db.add(student)
        db.commit()
        db.refresh(student)
        return student
    except Exception:
        db.rollback()
        raise


def get_students(
    db: Session,
    skip: int = 0,
    limit: int = 100,
) -> list[Student]:
    statement = (
        select(Student)
        .order_by(Student.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return list(db.scalars(statement).all())


def get_student_by_enrollment(
    db: Session,
    enrollment_number: str,
) -> Student | None:
    statement = select(Student).where(
        Student.enrollment_number == enrollment_number
    )
    return db.scalars(statement).first()


def get_student_by_id(
    db: Session,
    student_id: UUID,
) -> Student | None:
    statement = select(Student).where(Student.id == student_id)
    return db.scalars(statement).first()


def update_student(
    db: Session,
    student: Student,
    student_data: StudentUpdate,
) -> Student:
    updates = student_data.model_dump(exclude_unset=True)

    for field, value in updates.items():
        setattr(student, field, value)

    try:
        db.commit()
        db.refresh(student)
        return student
    except Exception:
        db.rollback()
        raise
