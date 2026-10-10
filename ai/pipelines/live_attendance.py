from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from threading import RLock
from typing import Any
from uuid import UUID

import cv2
import numpy as np
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from ai.enrollment.face_encoder import FaceEncoder
from backend.app.core.config import settings
from backend.app.database.models import AttendanceRecord, ClassSession
from backend.app.database.session import SessionLocal, get_db
from backend.app.services.attendance_service import mark_student_present
from backend.app.services.face_recognition_service import recognize_face_embedding

router = APIRouter(prefix="/live-attendance", tags=["Live Attendance"])

# The browser supplies frames; the backend owns the encoder and database writes.
_state_lock = RLock()
_encoder: FaceEncoder | None = None
_active_sessions: dict[str, "SessionState"] = {}


class SessionRequest(BaseModel):
    class_session_id: UUID


@dataclass
class FaceTrack:
    track_id: int
    bbox: tuple[int, int, int, int]
    history: deque = field(default_factory=lambda: deque(maxlen=5))
    missed_frames: int = 0


@dataclass
class SessionState:
    class_session_id: UUID
    tracks: dict[int, FaceTrack] = field(default_factory=dict)
    next_track_id: int = 1
    recorded_ids: set[str] = field(default_factory=set)
    rejected_ids: set[str] = field(default_factory=set)
    saved_count: int = 0


def _get_encoder() -> FaceEncoder:
    global _encoder
    with _state_lock:
        if _encoder is None:
            _encoder = FaceEncoder(device=settings.AI_DEVICE)
        return _encoder


def _iou(a: tuple[int, int, int, int], b: tuple[int, int, int, int]) -> float:
    x1, y1 = max(a[0], b[0]), max(a[1], b[1])
    x2, y2 = min(a[2], b[2]), min(a[3], b[3])
    intersection = max(0, x2 - x1) * max(0, y2 - y1)
    area_a = max(0, a[2] - a[0]) * max(0, a[3] - a[1])
    area_b = max(0, b[2] - b[0]) * max(0, b[3] - b[1])
    union = area_a + area_b - intersection
    return intersection / union if union else 0.0


def _associate(state: SessionState, detections: list[dict[str, Any]]) -> None:
    for track in state.tracks.values():
        track.missed_frames += 1
    available = set(state.tracks)
    for detection in detections:
        best_id = None
        best_overlap = 0.25
        for track_id in available:
            overlap = _iou(detection["bbox"], state.tracks[track_id].bbox)
            if overlap > best_overlap:
                best_id, best_overlap = track_id, overlap
        if best_id is None:
            best_id = state.next_track_id
            state.next_track_id += 1
            state.tracks[best_id] = FaceTrack(best_id, detection["bbox"])
        else:
            available.remove(best_id)
        track = state.tracks[best_id]
        track.bbox = detection["bbox"]
        track.missed_frames = 0
        track.history.append(detection["match"].get("student_id") if detection["match"].get("recognized") else None)
        detection["track_id"] = best_id
    for track_id in [key for key, track in state.tracks.items() if track.missed_frames > 10]:
        del state.tracks[track_id]


def _stable_id(track: FaceTrack, required_matches: int = 5) -> str | None:
    if len(track.history) < required_matches:
        return None
    recent = list(track.history)[-required_matches:]
    if recent[0] is not None and all(value == recent[0] for value in recent):
        return recent[0]
    return None


@router.post("/start")
def start_live_attendance(payload: SessionRequest, db: Session = Depends(get_db)) -> dict:
    class_session = db.get(ClassSession, payload.class_session_id)
    if class_session is None:
        raise HTTPException(status_code=404, detail="Class session not found.")
    if getattr(class_session, "is_completed", False):
        raise HTTPException(status_code=409, detail="This class session is already completed.")
    try:
        _get_encoder()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Could not initialize the face recognition model: {exc}") from exc

    session_key = str(payload.class_session_id)
    with _state_lock:
        if session_key in _active_sessions:
            raise HTTPException(status_code=409, detail="Live attendance is already active for this class session.")
        existing_ids = db.scalars(
            select(AttendanceRecord.student_id).where(
                AttendanceRecord.class_session_id == payload.class_session_id
            )
        ).all()
        _active_sessions[session_key] = SessionState(
            class_session_id=payload.class_session_id,
            recorded_ids={str(student_id) for student_id in existing_ids},
            saved_count=len(existing_ids),
        )
    return {
        "status": "started",
        "class_session_id": session_key,
        "saved_count": len(existing_ids),
        "message": "Live attendance started. The backend will mark a student after five consistent face matches.",
    }


@router.post("/process-frame")
def process_live_frame(
    class_session_id: UUID = Form(...),
    image: UploadFile = File(...),
) -> dict:
    session_key = str(class_session_id)
    with _state_lock:
        state = _active_sessions.get(session_key)
    if state is None:
        raise HTTPException(status_code=409, detail="Start live attendance for this class session first.")

    raw = image.file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="The uploaded camera frame is empty.")
    if len(raw) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Camera frame is too large. Send a JPEG under 5 MB.")
    frame = cv2.imdecode(np.frombuffer(raw, dtype=np.uint8), cv2.IMREAD_COLOR)
    if frame is None:
        raise HTTPException(status_code=400, detail="Could not decode the camera frame. Send a JPEG or PNG image.")

    return _process_frame_with_db(frame, state, class_session_id)


def _process_frame_with_db(frame: np.ndarray, state: SessionState, class_session_id: UUID) -> dict:
    encoder = _get_encoder()
    db = SessionLocal()
    try:
        detections: list[dict[str, Any]] = []
        for face in encoder.app.get(frame):
            confidence = float(face.det_score)
            if confidence < settings.FACE_DETECTION_THRESHOLD:
                continue
            bbox = tuple(int(value) for value in face.bbox.tolist())
            match = recognize_face_embedding(db, face.normed_embedding.tolist())
            detections.append({"bbox": bbox, "match": match, "confidence": confidence})

        with _state_lock:
            # Re-check state because Stop may have been called while processing.
            current_state = _active_sessions.get(str(class_session_id))
            if current_state is None:
                raise HTTPException(status_code=409, detail="Live attendance has been stopped.")
            state = current_state
            _associate(state, detections)
            output: list[dict[str, Any]] = []
            for detection in detections:
                match = detection["match"]
                track = state.tracks[detection["track_id"]]
                stable_id = _stable_id(track)
                saved = False
                message = match.get("message", "")
                if stable_id and match.get("recognized") and match.get("student_id") == stable_id and stable_id not in state.recorded_ids and stable_id not in state.rejected_ids:
                    try:
                        result = mark_student_present(
                            db=db,
                            student_id=UUID(stable_id),
                            class_session_id=class_session_id,
                            similarity=float(match["similarity"]),
                            recognition_confidence=float(detection["confidence"]),
                        )
                        state.recorded_ids.add(stable_id)
                        saved = bool(result.get("marked") or result.get("duplicate"))
                        if result.get("marked"):
                            state.saved_count += 1
                        message = result.get("message", message)
                    except ValueError as exc:
                        state.rejected_ids.add(stable_id)
                        message = str(exc)
                student_id_value = match.get("student_id")
                is_recorded = bool(
                    match.get("recognized")
                    and student_id_value
                    and str(student_id_value) in state.recorded_ids
                )
                # Once a recognized student has a record for this session, keep
                # the result in the recorded state immediately; do not put them
                # back into a frontend verification state on subsequent frames.
                current_record = None
                if is_recorded:
                    current_record = db.scalar(
                        select(AttendanceRecord).where(
                            AttendanceRecord.class_session_id == class_session_id,
                            AttendanceRecord.student_id == UUID(str(student_id_value)),
                        )
                    )
                output.append({
                    "track_id": detection["track_id"],
                    "bbox": list(detection["bbox"]),
                    "recognized": bool(match.get("recognized")),
                    "stable": bool(stable_id is not None or is_recorded),
                    "saved": bool(is_recorded),
                    "status": getattr(getattr(current_record, "status", None), "value", getattr(current_record, "status", None)),
                    "student_id": student_id_value,
                    "student_name": match.get("student_name"),
                    "enrollment_number": match.get("enrollment_number"),
                    "similarity": match.get("similarity"),
                    "message": message,
                })
            return {
                "class_session_id": str(class_session_id),
                "detection_count": len(output),
                "saved_count": state.saved_count,
                "detections": output,
                "message": "Processing camera frames." if output else "No face detected. Keep a face clearly visible to the camera.",
            }
    finally:
        db.close()


@router.post("/stop")
def stop_live_attendance(payload: SessionRequest) -> dict:
    session_key = str(payload.class_session_id)
    with _state_lock:
        state = _active_sessions.pop(session_key, None)
    if state is None:
        return {"status": "stopped", "class_session_id": session_key, "saved_count": 0, "message": "No active attendance session was found."}
    return {
        "status": "stopped",
        "class_session_id": session_key,
        "saved_count": state.saved_count,
        "message": "Live attendance stopped. Attendance records already confirmed by the backend remain saved.",
    }
