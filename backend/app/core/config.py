from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


# Project root:
# C:\Users\yvish\Documents\FaceAttendanceAI
PROJECT_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "FaceAttendanceAI"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    # API
    API_PREFIX: str = "/api/v1"

        # Database
    DATABASE_URL: str = (
        "postgresql+psycopg://postgres:postgres@localhost:5432/face_attendance"
    )

    # AI
    FACE_DETECTION_MODEL: str = "scrfd"
    FACE_RECOGNITION_MODEL: str = "buffalo_l"
    AI_DEVICE: str = "cuda"

    # Recognition
    FACE_MATCH_THRESHOLD: float = 0.45
    FACE_DETECTION_THRESHOLD: float = 0.50

    # Attendance
    ATTENDANCE_COOLDOWN_SECONDS: int = 300
    MIN_CONSENSUS_FRAMES: int = 5

    # Paths
    DATA_DIR: Path = PROJECT_ROOT / "data"
    FACES_DIR: Path = PROJECT_ROOT / "data" / "faces"
    EMBEDDINGS_DIR: Path = PROJECT_ROOT / "data" / "embeddings"
    EXPORTS_DIR: Path = PROJECT_ROOT / "data" / "exports"
    MODELS_DIR: Path = PROJECT_ROOT / "models"

    # Environment file
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()