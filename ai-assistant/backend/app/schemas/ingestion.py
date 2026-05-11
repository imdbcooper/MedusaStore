from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class MarkdownSyncRequest(BaseModel):
    store_id: str = "default"
    locale: str = "ru"
    path: str | None = None


class MarkdownChunk(BaseModel):
    id: UUID
    source_id: str
    source_type: str = "markdown"
    title: str
    path: str
    content: str
    content_hash: str
    chunk_index: int
    metadata: dict[str, Any] = Field(default_factory=dict)


class IngestionJobResponse(BaseModel):
    job_id: UUID
    status: str
    source_type: str | None = None
    source_id: str | None = None
    result: dict[str, Any] = Field(default_factory=dict)
    error: str | None = None
    created_at: datetime | None = None


class MarkdownSyncResponse(BaseModel):
    job: IngestionJobResponse
    chunks: list[MarkdownChunk]
