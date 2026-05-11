from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class MarkdownSyncRequest(BaseModel):
    store_id: str = "default"
    tenant_id: str | None = None
    locale: str = "ru"
    path: str | None = None


class MedusaProductsSyncRequest(BaseModel):
    store_id: str = "default"
    tenant_id: str | None = None
    locale: str = "ru"
    full: bool = False
    product_ids: list[str] = Field(default_factory=list)
    region_id: str | None = None
    currency_code: str | None = None


class VectorIndexRequest(BaseModel):
    store_id: str = "default"
    tenant_id: str | None = None
    locale: str = "ru"
    source_type: str | None = None


class VectorDeleteRequest(BaseModel):
    store_id: str = "default"
    tenant_id: str | None = None
    locale: str = "ru"
    source_type: str
    source_id: str


class MarkdownChunk(BaseModel):
    id: UUID
    source_id: str
    source_type: str = "markdown"
    title: str
    path: str | None = None
    content: str
    content_hash: str
    chunk_index: int
    metadata: dict[str, Any] = Field(default_factory=dict)


class ProductChunk(MarkdownChunk):
    source_type: str = "medusa_product"


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


class MedusaProductsSyncResponse(BaseModel):
    job: IngestionJobResponse
    products_indexed: int
    chunks: list[ProductChunk]
