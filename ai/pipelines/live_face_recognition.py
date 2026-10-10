from __future__ import annotations

import time
from typing import Any

import cv2

from ai.enrollment.face_encoder import FaceEncoder
from backend.app.core.config import settings
from backend.app.database.session import SessionLocal
from backend.app.services.face_recognition_service import (
    recognize_face_embedding,
)


def draw_label(
    frame,
    text: str,
    x: int,
    y: int,
    color: tuple[int, int, int],
) -> None:
    """Draw a readable label above a detected face."""
    font = cv2.FONT_HERSHEY_SIMPLEX
    scale = 0.6
    thickness = 2

    (text_width, text_height), baseline = cv2.getTextSize(
        text, font, scale, thickness
    )

    top = max(0, y - text_height - baseline - 10)
    right = x + text_width + 12
    bottom = top + text_height + baseline + 10

    cv2.rectangle(
        frame,
        (max(0, x), top),
        (right, bottom),
        color,
        thickness=cv2.FILLED,
    )
    cv2.putText(
        frame,
        text,
        (max(0, x) + 6, bottom - baseline - 5),
        font,
        scale,
        (255, 255, 255),
        thickness,
        cv2.LINE_AA,
    )


def recognize_frame(
    frame,
    encoder: FaceEncoder,
    db,
) -> list[dict[str, Any]]:
    """
    Detect and recognize faces in one camera frame.

    This function only recognizes faces; it does not mark attendance.
    """
    faces = encoder.app.get(frame)
    results: list[dict[str, Any]] = []

    for face in faces:
        x1, y1, x2, y2 = [
            int(value) for value in face.bbox.tolist()
        ]

        embedding = face.normed_embedding.tolist()
        match = recognize_face_embedding(db, embedding)

        results.append(
            {
                "bbox": (x1, y1, x2, y2),
                "detection_confidence": float(face.det_score),
                "match": match,
            }
        )

    return results


def run_live_recognition(
    camera_index: int = 0,
    process_every_n_frames: int = 2,
) -> None:
    """
    Start live camera face recognition.

    Press Q or Escape to exit. Attendance is not written by this pipeline.
    """
    if process_every_n_frames < 1:
        raise ValueError("process_every_n_frames must be at least 1.")

    print("Initializing face recognition model...")
    encoder = FaceEncoder(device=settings.AI_DEVICE)

    camera = cv2.VideoCapture(camera_index, cv2.CAP_DSHOW)

    if not camera.isOpened():
        camera.release()
        camera = cv2.VideoCapture(camera_index)

    if not camera.isOpened():
        raise RuntimeError(
            f"Could not open camera index {camera_index}. "
            "Check that the camera is connected and not in use."
        )

    camera.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
    camera.set(cv2.CAP_PROP_BUFFERSIZE, 1)

    frame_number = 0
    last_results: list[dict[str, Any]] = []
    last_process_time = 0.0
    display_fps = 0.0
    previous_time = time.perf_counter()

    print("Live recognition started. Press Q or Escape to stop.")

    try:
        while True:
            success, frame = camera.read()

            if not success:
                print("Unable to read a frame from the camera.")
                break

            frame_number += 1

            if frame_number % process_every_n_frames == 0:
                db = SessionLocal()

                try:
                    last_results = recognize_frame(
                        frame=frame,
                        encoder=encoder,
                        db=db,
                    )
                    last_process_time = time.perf_counter()
                except Exception as exc:
                    print(f"Recognition error: {exc}")
                    last_results = []
                finally:
                    db.close()

            for result in last_results:
                x1, y1, x2, y2 = result["bbox"]
                match = result["match"]

                if match["recognized"]:
                    color = (0, 180, 0)
                    label = (
                        f'{match["student_name"]} '
                        f'{match["similarity"]:.2f}'
                    )
                else:
                    color = (0, 0, 220)
                    label = "Unknown"

                cv2.rectangle(
                    frame,
                    (max(0, x1), max(0, y1)),
                    (max(0, x2), max(0, y2)),
                    color,
                    2,
                )

                draw_label(
                    frame,
                    label,
                    max(0, x1),
                    max(0, y1),
                    color,
                )

            current_time = time.perf_counter()
            elapsed = current_time - previous_time

            if elapsed > 0:
                instantaneous_fps = 1.0 / elapsed
                display_fps = (
                    instantaneous_fps
                    if display_fps == 0
                    else 0.9 * display_fps + 0.1 * instantaneous_fps
                )

            previous_time = current_time

            cv2.putText(
                frame,
                f"Display FPS: {display_fps:.1f}",
                (20, 35),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                (255, 255, 255),
                2,
                cv2.LINE_AA,
            )

            cv2.putText(
                frame,
                "Recognition only - attendance is not being recorded",
                (20, frame.shape[0] - 20),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.55,
                (255, 255, 255),
                2,
                cv2.LINE_AA,
            )

            cv2.imshow("FaceAttendanceAI - Live Recognition", frame)

            key = cv2.waitKey(1) & 0xFF

            if key == ord("q") or key == 27:
                break

    finally:
        camera.release()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    run_live_recognition()
