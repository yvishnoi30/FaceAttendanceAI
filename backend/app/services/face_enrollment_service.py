
from pathlib import Path
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.database.models import FaceEmbedding, Student
from ai.enrollment.face_encoder import FaceEncoder


_encoder = None


def get_face_encoder() -> FaceEncoder:
    global _encoder

    if _encoder is None:
        _encoder = FaceEncoder(device=settings.AI_DEVICE)

    return _encoder


def enroll_student_face(
    db: Session,
    student_id: UUID,
    image_path: str,
) -> dict:
    student = db.get(Student, student_id)

    if student is None:
        raise ValueError("Student not found.")

    if not student.is_active:
        raise ValueError("Cannot enroll an inactive student.")

    image_file = Path(image_path).resolve()

    faces_dir = Path(settings.FACES_DIR).resolve()

    if not image_file.is_file():
        raise FileNotFoundError("Face image was not found.")

    # Only accept images stored within the configured faces directory.
    if not image_file.is_relative_to(faces_dir):
        raise ValueError(
            "The image must be stored inside the configured faces directory."
        )

    encoder = get_face_encoder()
    detected_faces = encoder.encode_image(str(image_file))

    if len(detected_faces) == 0:
        raise ValueError("No face was detected in the image.")

    if len(detected_faces) > 1:
        raise ValueError(
            "Multiple faces detected. Use an image containing one person."
        )

    face = detected_faces[0]

    if face["det_score"] < settings.FACE_DETECTION_THRESHOLD:
        raise ValueError("Face detection confidence is too low.")

    embedding = face["embedding"]

    try:
        existing_embeddings = db.scalars(
            select(FaceEmbedding).where(
                FaceEmbedding.student_id == student_id
            )
        ).all()

        is_primary = len(existing_embeddings) == 0

        record = FaceEmbedding(
            student_id=student_id,
            embedding=embedding,
            image_path=str(image_file),
            quality_score=face["quality_score"],
            is_primary=is_primary,
        )

        db.add(record)
        db.commit()
        db.refresh(record)

        return {
            "embedding_id": str(record.id),
            "student_id": str(student.id),
            "enrollment_number": student.enrollment_number,
            "embedding_dimensions": len(embedding),
            "is_primary": record.is_primary,
            "message": "Face enrolled successfully.",
        }

    except Exception:
        db.rollback()
        raise
