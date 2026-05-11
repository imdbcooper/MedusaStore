from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class FeedbackRequest(BaseModel):
    session_id: UUID
    message_id: UUID | None = None
    store_id: str = Field(default="default", min_length=1, max_length=128)
    tenant_id: str | None = Field(default=None, min_length=1, max_length=128)
    locale: str = Field(default="ru", min_length=2, max_length=16)
    rating: int | None = Field(default=None, ge=1, le=5)
    label: str | None = Field(default=None, max_length=64)
    comment: str | None = Field(default=None, max_length=2000)
    metadata: dict[str, Any] = Field(default_factory=dict)


class FeedbackResponse(BaseModel):
    feedback_id: UUID
    session_id: UUID
    message_id: UUID | None = None
    store_id: str
    tenant_id: str | None = None
    locale: str
    rating: int | None = None
    label: str | None = None
    comment: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime | None = None
