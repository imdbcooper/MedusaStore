from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class MarkdownSyncRequest(BaseModel):
    store_id: str = "default"
    tenant_id: str | None = None
    locale: str = "ru"
    path: str | None = None


class KnowledgeDocumentCreateRequest(BaseModel):
    store_id: str = Field(default="default", min_length=1, max_length=128)
    tenant_id: str | None = Field(default=None, min_length=1, max_length=128)
    locale: str = Field(default="ru", min_length=2, max_length=16)
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1, max_length=4000)
    content: str = Field(min_length=1, max_length=500_000)
    file_name: str | None = Field(default=None, max_length=255)


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


class KnowledgeDocumentResponse(BaseModel):
    source_id: str
    path: str
    title: str
    description: str
    file_name: str
    store_id: str
    tenant_id: str | None = None
    locale: str
    source_type: str = "markdown"


class KnowledgeDocumentCreateResponse(BaseModel):
    document: KnowledgeDocumentResponse
    job: IngestionJobResponse
    chunks: list[MarkdownChunk]


class MedusaProductsSyncResponse(BaseModel):
    job: IngestionJobResponse
    products_indexed: int
    chunks: list[ProductChunk]
