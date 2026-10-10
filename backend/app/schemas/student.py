from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class StudentCreate(BaseModel):
    enrollment_number: str = Field(min_length=1, max_length=50)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    email: EmailStr | None = None
    roll_number: str | None = Field(default=None, max_length=50)
    department: str = Field(min_length=1, max_length=100)
    semester: int = Field(ge=1, le=12)
    section: str | None = Field(default=None, max_length=20)


class StudentUpdate(BaseModel):
    enrollment_number: str | None = Field(
        default=None, min_length=1, max_length=50
    )
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    email: EmailStr | None = None
    roll_number: str | None = Field(default=None, max_length=50)
    department: str | None = Field(default=None, min_length=1, max_length=100)
    semester: int | None = Field(default=None, ge=1, le=12)
    section: str | None = Field(default=None, max_length=20)
    is_active: bool | None = None


class StudentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    enrollment_number: str
    first_name: str
    last_name: str
    email: EmailStr | None
    roll_number: str | None
    department: str
    semester: int
    section: str | None
    is_active: bool
    created_at: datetime
