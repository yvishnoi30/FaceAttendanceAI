
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class SubjectCreate(BaseModel):
    code: str = Field(min_length=1, max_length=30)
    name: str = Field(min_length=1, max_length=150)
    department: str = Field(min_length=1, max_length=100)
    semester: int = Field(ge=1, le=12)


class SubjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    code: str
    name: str
    department: str
    semester: int
    is_active: bool
    created_at: datetime
