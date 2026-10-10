
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.database.session import get_db
from backend.app.services.face_enrollment_service import enroll_student_face


router = APIRouter(
    prefix="/face-enrollment",
    tags=["Face Enrollment"],
)

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png"}
MAX_FILE_SIZE = 10 * 1024 * 1024


@router.post("/{student_id}", status_code=status.HTTP_201_CREATED)
def enroll_face(
    student_id: UUID,
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    filename = Path(image.filename or "").name
    extension = Path(filename).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Upload a JPG, JPEG, or PNG image.",
        )

    faces_dir = Path(settings.FACES_DIR).resolve()
    faces_dir.mkdir(parents=True, exist_ok=True)

    image_path = None

    try:
        content = image.file.read(MAX_FILE_SIZE + 1)

        if not content:
            raise HTTPException(
                status_code=400,
                detail="The uploaded image is empty.",
            )

        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413,
                detail="Image must not exceed 10 MB.",
            )

        # Verify that the uploaded content is a decodable image.
        import cv2
        import numpy as np

        decoded = cv2.imdecode(
            np.frombuffer(content, dtype=np.uint8),
            cv2.IMREAD_COLOR,
        )

        if decoded is None:
            raise HTTPException(
                status_code=400,
                detail="The uploaded file is not a valid image.",
            )

        # Generate a server-controlled filename.
        import uuid

        image_path = faces_dir / f"{student_id}_{uuid.uuid4().hex}{extension}"
        image_path.write_bytes(content)

        result = enroll_student_face(
            db=db,
            student_id=student_id,
            image_path=str(image_path),
        )

        return result

    except HTTPException:
        raise

    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    except SQLAlchemyError:
        raise HTTPException(
            status_code=500,
            detail="Database error while enrolling the face.",
        )

    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Face enrollment failed. Check the server logs.",
        )

    finally:
        image.file.close()

        # Remove the uploaded image if enrollment did not succeed.
        if image_path is not None and not "result" in locals():
            image_path.unlink(missing_ok=True)
