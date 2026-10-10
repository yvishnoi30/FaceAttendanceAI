import numpy as np

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.database.models import FaceEmbedding, Student


def recognize_face_embedding(
    db: Session,
    embedding: list[float],
    threshold: float | None = None,
) -> dict:
    """
    Match a face embedding against enrolled student embeddings.

    Uses PostgreSQL pgvector cosine distance.
    Returns a recognized student only when the similarity
    meets the configured threshold.
    """

    if threshold is None:
        threshold = settings.FACE_MATCH_THRESHOLD

    if not 0.0 <= threshold <= 1.0:
        raise ValueError("Threshold must be between 0 and 1.")

    query_embedding = np.asarray(
        embedding,
        dtype=np.float32,
    )

    if query_embedding.shape != (512,):
        raise ValueError(
            "Face embedding must contain exactly 512 values."
        )

    if not np.all(np.isfinite(query_embedding)):
        raise ValueError(
            "Face embedding contains invalid numeric values."
        )

    norm = float(np.linalg.norm(query_embedding))

    if norm == 0.0:
        raise ValueError(
            "Face embedding cannot be a zero vector."
        )

    # Normalize to match the normalized embeddings produced
    # by the existing FaceEncoder.
    query_embedding = query_embedding / norm
    embedding_values = query_embedding.tolist()

    distance_expression = FaceEmbedding.embedding.cosine_distance(
        embedding_values
    )

    statement = (
        select(
            Student,
            FaceEmbedding,
            distance_expression.label("cosine_distance"),
        )
        .join(
            FaceEmbedding,
            FaceEmbedding.student_id == Student.id,
        )
        .where(Student.is_active.is_(True))
        .order_by(distance_expression.asc())
        .limit(1)
    )

    result = db.execute(statement).first()

    if result is None:
        return {
            "recognized": False,
            "student_id": None,
            "enrollment_number": None,
            "student_name": None,
            "similarity": None,
            "message": "No enrolled face embeddings were found.",
        }

    student, face_embedding, distance = result

    # Cosine similarity = 1 - cosine distance.
    similarity = max(
        -1.0,
        min(1.0, 1.0 - float(distance)),
    )

    if similarity < threshold:
        return {
            "recognized": False,
            "student_id": None,
            "enrollment_number": None,
            "student_name": None,
            "similarity": round(similarity, 4),
            "threshold": threshold,
            "message": "No sufficiently similar enrolled face was found.",
        }

    student_name = " ".join(
        part
        for part in [student.first_name, student.last_name]
        if part
    )

    return {
        "recognized": True,
        "student_id": str(student.id),
        "enrollment_number": student.enrollment_number,
        "student_name": student_name,
        "face_embedding_id": str(face_embedding.id),
        "similarity": round(similarity, 4),
        "threshold": threshold,
        "message": "Face matched successfully.",
    }
