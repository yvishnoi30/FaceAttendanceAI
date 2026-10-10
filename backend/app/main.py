from pathlib import Path
from uuid import UUID

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.database.session import engine, get_db
from backend.app.database.models import FaceEmbedding, Student

from backend.app.api.students import router as students_router
from backend.app.api.subjects import router as subjects_router
from backend.app.api.class_sessions import router as class_sessions_router
from backend.app.api.face_enrollment import router as face_enrollment_router
from backend.app.api.attendance import router as attendance_router
from backend.app.api.attendance_statistics import router as attendance_statistics_router
from backend.app.api.live_attendance import router as live_attendance_router

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    debug=settings.DEBUG,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(students_router, prefix=settings.API_PREFIX)
app.include_router(subjects_router, prefix=settings.API_PREFIX)
app.include_router(class_sessions_router, prefix=settings.API_PREFIX)
app.include_router(face_enrollment_router, prefix=settings.API_PREFIX)
app.include_router(attendance_router, prefix=settings.API_PREFIX)
app.include_router(attendance_statistics_router, prefix=settings.API_PREFIX)
app.include_router(live_attendance_router, prefix=settings.API_PREFIX)


@app.get(f"{settings.API_PREFIX}/students/{'{'}student_id{'}'}/face-photo", tags=["Students"])
def get_student_face_photo(student_id: UUID, db: Session = Depends(get_db)):
    """Serve a student's primary enrollment photo without exposing its filesystem path."""
    student = db.get(Student, student_id)
    if student is None:
        raise HTTPException(status_code=404, detail="Student not found.")

    embedding = db.scalar(
        select(FaceEmbedding)
        .where(FaceEmbedding.student_id == student_id)
        .order_by(FaceEmbedding.is_primary.desc(), FaceEmbedding.created_at.desc())
        .limit(1)
    )
    if embedding is None or not embedding.image_path:
        raise HTTPException(status_code=404, detail="No enrollment photo is available.")

    faces_dir = Path(settings.FACES_DIR).resolve()
    image_path = Path(embedding.image_path).resolve()
    if not image_path.is_relative_to(faces_dir) or not image_path.is_file():
        raise HTTPException(status_code=404, detail="Enrollment photo is unavailable.")

    suffix = image_path.suffix.lower()
    media_type = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png"}.get(suffix)
    if media_type is None:
        raise HTTPException(status_code=415, detail="Unsupported enrollment photo format.")

    return FileResponse(
        path=image_path,
        media_type=media_type,
        headers={"Cache-Control": "private, max-age=300"},
    )


@app.get("/health", tags=["Health"])
def health_check():
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
    }


@app.get("/health/database", tags=["Health"])
def database_health_check():
    try:
        with engine.connect() as connection:
            database = connection.execute(text("SELECT current_database()")).scalar_one()
            connection.execute(text("SELECT 1"))
        return {
            "status": "healthy",
            "database": database,
            "connection": "successful",
        }
    except Exception:
        raise HTTPException(
            status_code=503,
            detail={"status": "unhealthy", "database": "unavailable"},
        )
