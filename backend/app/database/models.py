from datetime import date, datetime, time
from enum import Enum
from uuid import UUID, uuid4

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum as SQLEnum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    Time,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.database.base import Base


class AttendanceStatus(str, Enum):
    PRESENT = "present"
    LATE = "late"
    ABSENT = "absent"
    EXCUSED = "excused"


class RecognitionStatus(str, Enum):
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    UNKNOWN = "unknown"


class Student(Base):
    __tablename__ = "students"

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    enrollment_number: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
    )

    first_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    last_name: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    email: Mapped[str | None] = mapped_column(
        String(255),
        unique=True,
        nullable=True,
    )

    roll_number: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        index=True,
    )

    department: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )

    semester: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    section: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    face_embeddings: Mapped[list["FaceEmbedding"]] = relationship(
        back_populates="student",
        cascade="all, delete-orphan",
    )

    attendance_records: Mapped[list["AttendanceRecord"]] = relationship(
        back_populates="student",
        cascade="all, delete-orphan",
    )

    recognition_events: Mapped[list["RecognitionEvent"]] = relationship(
        back_populates="student",
    )


class Subject(Base):
    __tablename__ = "subjects"

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    code: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
    )

    name: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )

    department: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )

    semester: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    class_sessions: Mapped[list["ClassSession"]] = relationship(
        back_populates="subject",
        cascade="all, delete-orphan",
    )


class ClassSession(Base):
    __tablename__ = "class_sessions"

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    subject_id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey("subjects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    session_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
    )

    start_time: Mapped[time] = mapped_column(
        Time,
        nullable=False,
    )

    end_time: Mapped[time] = mapped_column(
        Time,
        nullable=False,
    )

    room: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    faculty_name: Mapped[str | None] = mapped_column(
        String(200),
        nullable=True,
    )

    is_completed: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    subject: Mapped["Subject"] = relationship(
        back_populates="class_sessions",
    )

    attendance_records: Mapped[list["AttendanceRecord"]] = relationship(
        back_populates="class_session",
        cascade="all, delete-orphan",
    )

    recognition_events: Mapped[list["RecognitionEvent"]] = relationship(
        back_populates="class_session",
        cascade="all, delete-orphan",
    )


class FaceEmbedding(Base):
    __tablename__ = "face_embeddings"

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    student_id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey("students.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    embedding: Mapped[list[float]] = mapped_column(
        Vector(512),
        nullable=False,
    )

    image_path: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    quality_score: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    is_primary: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    student: Mapped["Student"] = relationship(
        back_populates="face_embeddings",
    )

    __table_args__ = (
        Index(
            "ix_face_embeddings_student_primary",
            "student_id",
            "is_primary",
        ),
    )


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    student_id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey("students.id", ondelete="CASCADE"),
        nullable=False,
    )

    class_session_id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey("class_sessions.id", ondelete="CASCADE"),
        nullable=False,
    )

    status: Mapped[AttendanceStatus] = mapped_column(
        SQLEnum(AttendanceStatus),
        nullable=False,
        default=AttendanceStatus.PRESENT,
    )

    check_in_time: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    check_out_time: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    recognition_similarity: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    confidence: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    student: Mapped["Student"] = relationship(
        back_populates="attendance_records",
    )

    class_session: Mapped["ClassSession"] = relationship(
        back_populates="attendance_records",
    )

    __table_args__ = (
        UniqueConstraint(
            "student_id",
            "class_session_id",
            name="uq_attendance_student_session",
        ),
        Index(
            "ix_attendance_student_status",
            "student_id",
            "status",
        ),
        Index(
            "ix_attendance_session_status",
            "class_session_id",
            "status",
        ),
    )


class RecognitionEvent(Base):
    __tablename__ = "recognition_events"

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    class_session_id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey("class_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    student_id: Mapped[UUID | None] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey("students.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    event_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    similarity: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    detection_confidence: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    quality_score: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    tracking_id: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        index=True,
    )

    status: Mapped[RecognitionStatus] = mapped_column(
        SQLEnum(RecognitionStatus),
        nullable=False,
    )

    processing_time_ms: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    rejection_reason: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    class_session: Mapped["ClassSession"] = relationship(
        back_populates="recognition_events",
    )

    student: Mapped["Student | None"] = relationship(
        back_populates="recognition_events",
    )

    __table_args__ = (
        Index(
            "ix_recognition_session_event_time",
            "class_session_id",
            "event_time",
        ),
    )