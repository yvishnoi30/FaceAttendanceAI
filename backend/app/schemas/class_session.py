
from datetime import date, datetime, time
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ClassSessionCreate(BaseModel):
    subject_id: UUID
    session_date: date
    start_time: time
    end_time: time
    room: str | None = Field(default=None, max_length=100)
    faculty_name: str | None = Field(default=None, max_length=150)

    @model_validator(mode="after")
    def validate_time_range(self):
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be later than start_time")
        return self


class ClassSessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    subject_id: UUID
    session_date: date
    start_time: time
    end_time: time
    room: str | None
    faculty_name: str | None
    is_completed: bool
