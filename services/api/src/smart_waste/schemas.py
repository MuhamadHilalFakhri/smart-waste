import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

Category = Literal["organic", "plastic", "paper"]
Status = Literal["pending", "in_progress", "completed", "rejected"]
Role = Literal["admin", "user"]


class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)

    @field_validator("name")
    @classmethod
    def clean_name(cls, value):
        if len(value.strip()) < 2:
            raise ValueError("Nama minimal 2 karakter")
        return value.strip()


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    email: str
    role: Role
    active: bool
    created_at: datetime


class AuthOut(BaseModel):
    user: UserOut
    access_token: str | None = None
    refresh_token: str | None = None
    token_type: str = "bearer"


class RefreshIn(BaseModel):
    refresh_token: str | None = None


class UserCreate(RegisterIn):
    role: Role = "user"


class UserUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    role: Role
    active: bool

    @field_validator("name")
    @classmethod
    def clean_name(cls, value):
        if len(value.strip()) < 2:
            raise ValueError("Nama minimal 2 karakter")
        return value.strip()


class ReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    owner_id: uuid.UUID
    description: str
    category: Category
    latitude: float
    longitude: float
    accuracy: float | None
    status: Status
    created_at: datetime
    updated_at: datetime


class StatusIn(BaseModel):
    status: Status
    note: str = Field(default="", max_length=2000)


class HistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    actor_id: uuid.UUID
    previous_status: str | None
    next_status: str
    note: str
    created_at: datetime


class PredictionOut(BaseModel):
    category: Category | None
    confidence: float | None
    model_version: str | None
    probabilities: dict[str, float]
    outcome: Literal["predicted", "unavailable", "failed"]


class PredictionAuditOut(PredictionOut):
    id: uuid.UUID
    created_at: datetime


class ReportDetail(ReportOut):
    history: list[HistoryOut]
    predictions: list[PredictionAuditOut]


class ReportPage(BaseModel):
    items: list[ReportOut]
    total: int
    page: int
    page_size: int


class UserPage(BaseModel):
    items: list[UserOut]
    total: int
    page: int
    page_size: int


class DashboardOut(BaseModel):
    total: int
    by_status: dict[str, int]
    by_category: dict[str, int]
    by_day: list[dict[str, str | int]]
