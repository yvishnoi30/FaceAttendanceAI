from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.app.database.session import get_db
from backend.app.schemas.student import (
    StudentCreate,
    StudentResponse,
    StudentUpdate,
)
from backend.app.services.student_service import (
    create_student,
    get_student_by_enrollment,
    get_student_by_id,
    get_students,
    update_student,
)

router = APIRouter(prefix="/students", tags=["Students"])


@router.post(
    "",
    response_model=StudentResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_student(
    student_data: StudentCreate,
    db: Session = Depends(get_db),
):
    if get_student_by_enrollment(db, student_data.enrollment_number):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Enrollment number already exists",
        )

    try:
        return create_student(db, student_data)
    except IntegrityError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A student with this enrollment number or email already exists",
        )


@router.get("", response_model=list[StudentResponse])
def list_students(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    return get_students(db, skip=skip, limit=limit)


@router.get("/{student_id}", response_model=StudentResponse)
def retrieve_student(
    student_id: UUID,
    db: Session = Depends(get_db),
):
    student = get_student_by_id(db, student_id)

    if student is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found",
        )

    return student


@router.patch("/{student_id}", response_model=StudentResponse)
def edit_student(
    student_id: UUID,
    student_data: StudentUpdate,
    db: Session = Depends(get_db),
):
    student = get_student_by_id(db, student_id)

    if student is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found",
        )

    updates = student_data.model_dump(exclude_unset=True)

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide at least one field to update",
        )

    if "enrollment_number" in updates and updates["enrollment_number"] is not None:
        existing = get_student_by_enrollment(db, updates["enrollment_number"])
        if existing is not None and existing.id != student_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Enrollment number already exists",
            )

    try:
        return update_student(db, student, student_data)
    except IntegrityError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A student with this enrollment number or email already exists",
        )


@router.delete("/{student_id}", response_model=StudentResponse)
def deactivate_student(
    student_id: UUID,
    db: Session = Depends(get_db),
):
    """Soft-delete a student by deactivating the profile; preserve history."""
    student = get_student_by_id(db, student_id)

    if student is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found",
        )

    if not student.is_active:
        return student

    student.is_active = False
    try:
        db.commit()
        db.refresh(student)
        return student
    except Exception:
        db.rollback()
        raise


@router.delete("/{student_id}/permanent", status_code=status.HTTP_204_NO_CONTENT)
def permanently_delete_student(
    student_id: UUID,
    db: Session = Depends(get_db),
):
    """Permanently delete a student and ORM-cascaded related records."""
    student = get_student_by_id(db, student_id)

    if student is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found",
        )

    try:
        db.delete(student)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "This student cannot be permanently deleted because related records "
                "still reference the student. Deactivate the student instead, or "
                "resolve those references before trying again."
            ),
        )
    except Exception:
        db.rollback()
        raise
