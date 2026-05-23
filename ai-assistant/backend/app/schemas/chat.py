from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.handoff import HandoffTicketResponse


class PageContext(BaseModel):
    type: str | None = None
    product_id: str | None = None
    category_handle: str | None = None
    url: str | None = None


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    session_id: UUID | None = None
    customer_id: str | None = None
    cart_id: str | None = None
    store_id: str = Field(default="default", min_length=1, max_length=128)
    tenant_id: str | None = Field(default=None, min_length=1, max_length=128)
    region_id: str | None = None
    currency_code: str = "rub"
    locale: str = Field(default="ru", min_length=2, max_length=16)
    mode: str = "auto"
    page_context: PageContext | None = None


class Citation(BaseModel):
    source_type: str
    source_id: str
    title: str
    url: str | None = None
    chunk_id: str | None = None


class ProductCard(BaseModel):
    id: str
    handle: str | None = None
    title: str
    thumbnail: str | None = None
    price: str | None = None
    availability: str = "unknown"
    reason: str | None = None


class Action(BaseModel):
    type: str
    label: str
    payload: dict[str, Any] = Field(default_factory=dict)


class Safety(BaseModel):
    grounded: bool = True
    live_data_checked: bool = False
    needs_human: bool = False
    medusa_available: bool = True
    status: str = "ok"
    notes: list[str] = Field(default_factory=list)


class ToolCall(BaseModel):
    name: str
    arguments: dict[str, Any] = Field(default_factory=dict)
    result: dict[str, Any] = Field(default_factory=dict)


class ChatResponse(BaseModel):
    session_id: UUID
    message_id: UUID
    answer: str
    intent: str
    products: list[ProductCard] = Field(default_factory=list)
    citations: list[Citation] = Field(default_factory=list)
    actions: list[Action] = Field(default_factory=list)
    tool_calls: list[ToolCall] = Field(default_factory=list)
    safety: Safety = Field(default_factory=Safety)
    observability: dict[str, Any] = Field(default_factory=dict)


class ChatHistoryMessage(BaseModel):
    id: UUID
    session_id: UUID
    role: Literal["user", "assistant", "tool", "system"]
    content: str
    intent: str | None = None
    citations: list[dict[str, Any]] = Field(default_factory=list)
    products: list[dict[str, Any]] = Field(default_factory=list)
    actions: list[dict[str, Any]] = Field(default_factory=list)
    tool_calls: list[dict[str, Any]] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class ChatHistoryResponse(BaseModel):
    session_id: UUID
    messages: list[ChatHistoryMessage] = Field(default_factory=list)
    store_id: str
    locale: str
    customer_bound: bool = False
    handoff_ticket: HandoffTicketResponse | None = None
