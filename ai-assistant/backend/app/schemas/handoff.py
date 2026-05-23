from datetime import datetime
from typing import Any, Literal
from uuid import UUID

HandoffChannel = Literal["telegram", "vk"]


from pydantic import BaseModel, Field, model_validator


class HandoffRequest(BaseModel):
    session_id: UUID
    message_id: UUID | None = None
    store_id: str = Field(default="default", min_length=1, max_length=128)
    tenant_id: str | None = Field(default=None, min_length=1, max_length=128)
    locale: str = Field(default="ru", min_length=2, max_length=16)
    source: str = Field(default="assistant_widget", min_length=1, max_length=64)
    name: str | None = Field(default=None, max_length=160)
    email: str | None = Field(default=None, max_length=320)
    phone: str | None = Field(default=None, max_length=64)
    summary: str | None = Field(default=None, max_length=2000)
    reason: str | None = Field(default=None, max_length=128)
    note: str | None = Field(default=None, max_length=2000)
    metadata: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def ensure_contact_channel(self):
        if not (self.email or self.phone):
            raise ValueError("Either email or phone must be provided.")
        return self


class HandoffTicketResponse(BaseModel):
    channel: HandoffChannel = "telegram"
    status: str
    message: str | None = None
    updated_at: datetime | None = None


class HandoffResponse(BaseModel):
    handoff_id: UUID
    session_id: UUID
    message_id: UUID | None = None
    store_id: str
    tenant_id: str | None = None
    locale: str
    status: str = "submitted"
    source: str
    created_at: datetime | None = None
    ticket: HandoffTicketResponse | None = None
