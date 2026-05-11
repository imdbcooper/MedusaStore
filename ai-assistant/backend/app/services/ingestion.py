from pathlib import Path

from app.core.config import Settings
from app.ingestion.markdown import discover_markdown_files, parse_markdown_file, sha256_text
from app.ingestion.products import normalize_medusa_product
from app.schemas.ingestion import IngestionJobResponse, MarkdownSyncResponse, MedusaProductsSyncResponse
from app.services.vector import VectorBackendUnavailable


JOB_PENDING = "pending"
JOB_INDEXING = "indexing"
JOB_COMPLETED = "completed"
JOB_ERROR = "error"


class MarkdownIngestionService:
    def __init__(self, *, repository, settings: Settings, qdrant_adapter=None, embedding_provider=None):
        self.repository = repository
        self.settings = settings
        self.qdrant_adapter = qdrant_adapter
        self.embedding_provider = embedding_provider

    async def sync_directory(
        self,
        *,
        store_id: str,
        locale: str,
        path: str | None = None,
        tenant_id: str | None = None,
    ) -> MarkdownSyncResponse:
        root = Path(path) if path else self.settings.knowledge_dir
        if not root.is_absolute():
            root = Path.cwd() / root
        if not root.exists():
            raise FileNotFoundError(f"Markdown knowledge path does not exist: {root}")
        files = discover_markdown_files(root)
        job = await self.repository.create_ingestion_job(
            store_id=store_id,
            job_type="markdown_sync",
            source_type="markdown",
            source_id=str(root),
            input_payload={"path": str(root), "locale": locale},
        )

        all_chunks = []
        vector_indexed_count = 0
        try:
            for file_path in files:
                chunks = parse_markdown_file(
                    file_path,
                    root=root if root.is_dir() else root.parent,
                    store_id=store_id,
                    locale=locale,
                    target_chars=self.settings.chunk_target_chars,
                    overlap_chars=self.settings.chunk_overlap_chars,
                )
                if not chunks:
                    continue
                first = chunks[0]
                source_hash = sha256_text("\n".join(chunk.content_hash for chunk in chunks))
                chunk_payloads = [chunk.model_dump(mode="json") for chunk in chunks]
                source = await self.repository.upsert_source_with_chunks(
                    store_id=store_id,
                    locale=locale,
                    source_type=first.source_type,
                    source_id=first.source_id,
                    title=first.title,
                    uri=first.path,
                    content_hash=source_hash,
                    metadata={**first.metadata, "tenant_id": tenant_id or first.metadata.get("tenant_id")},
                    chunks=chunk_payloads,
                )
                vector_indexed_count += await self._index_vector_chunks(chunks=chunk_payloads, source=source)
                all_chunks.extend(chunks)
            job = await self.repository.complete_ingestion_job(
                job_id=job["id"],
                result={
                    "source_count": len(files),
                    "file_count": len(files),
                    "chunk_count": len(all_chunks),
                    "vector_indexed_count": vector_indexed_count,
                    "vector_status": "indexed" if vector_indexed_count else "skipped",
                },
            )
        except Exception as exc:
            job = await self.repository.complete_ingestion_job(
                job_id=job["id"],
                result={
                    "source_count": len(files),
                    "file_count": len(files),
                    "chunk_count": len(all_chunks),
                    "vector_indexed_count": vector_indexed_count,
                    "vector_status": "indexed" if vector_indexed_count else "skipped",
                },
                error=str(exc),
            )
            raise

        return MarkdownSyncResponse(
            job=IngestionJobResponse(
                job_id=job["id"],
                status=job["status"],
                source_type=job.get("source_type"),
                source_id=job.get("source_id"),
                result=job.get("result") or {},
                error=job.get("error"),
                created_at=job.get("created_at"),
            ),
            chunks=all_chunks,
        )


    async def _index_vector_chunks(self, *, chunks: list[dict], source: dict) -> int:
        if not vector_indexing_enabled(self.settings, self.qdrant_adapter, self.embedding_provider):
            return 0
        return await index_vector_chunks_in_batches(
            chunks=chunks,
            source=source,
            qdrant_adapter=self.qdrant_adapter,
            embedding_provider=self.embedding_provider,
            settings=self.settings,
        )


class MedusaProductIngestionService:
    def __init__(self, *, repository, product_client, settings: Settings, qdrant_adapter=None, embedding_provider=None):
        self.repository = repository
        self.product_client = product_client
        self.settings = settings
        self.qdrant_adapter = qdrant_adapter
        self.embedding_provider = embedding_provider

    async def sync_products(
        self,
        *,
        store_id: str,
        locale: str,
        full: bool = False,
        product_ids: list[str] | None = None,
        region_id: str | None = None,
        currency_code: str | None = None,
        tenant_id: str | None = None,
    ) -> MedusaProductsSyncResponse:
        requested_product_ids = product_ids or []
        job = await self.repository.create_ingestion_job(
            store_id=store_id,
            job_type="medusa_products_sync",
            source_type="medusa_product",
            source_id="*" if full or not requested_product_ids else ",".join(requested_product_ids),
            input_payload={
                "store_id": store_id,
                "locale": locale,
                "full": full,
                "product_ids": requested_product_ids,
                "region_id": region_id,
                "currency_code": currency_code,
                "tenant_id": tenant_id,
            },
        )

        all_chunks = []
        products = []
        vector_indexed_count = 0
        try:
            products = await self.product_client.list_products(
                product_ids=None if full else requested_product_ids,
                region_id=region_id,
                currency_code=currency_code,
            )
            for product in products:
                chunks = normalize_medusa_product(
                    product,
                    store_id=store_id,
                    locale=locale,
                    tenant_id=tenant_id,
                    chunk_target_chars=self.settings.chunk_target_chars,
                    chunk_overlap_chars=self.settings.chunk_overlap_chars,
                )
                if not chunks:
                    continue
                first = chunks[0]
                source_hash = sha256_text("\n".join(chunk.content_hash for chunk in chunks))
                chunk_payloads = [chunk.model_dump(mode="json") for chunk in chunks]
                source = await self.repository.upsert_source_with_chunks(
                    store_id=store_id,
                    locale=locale,
                    source_type=first.source_type,
                    source_id=first.source_id,
                    title=first.title,
                    uri=first.path,
                    content_hash=source_hash,
                    metadata={**first.metadata, "tenant_id": tenant_id or first.metadata.get("tenant_id")},
                    chunks=chunk_payloads,
                )
                vector_indexed_count += await self._index_vector_chunks(chunks=chunk_payloads, source=source)
                all_chunks.extend(chunks)
            job = await self.repository.complete_ingestion_job(
                job_id=job["id"],
                result={
                    "source_count": len(products),
                    "product_count": len(products),
                    "chunk_count": len(all_chunks),
                    "vector_indexed_count": vector_indexed_count,
                    "vector_status": "indexed" if vector_indexed_count else "skipped",
                },
            )
        except Exception as exc:
            job = await self.repository.complete_ingestion_job(
                job_id=job["id"],
                result={
                    "source_count": len(products),
                    "product_count": len(products),
                    "chunk_count": len(all_chunks),
                    "vector_indexed_count": vector_indexed_count,
                    "vector_status": "indexed" if vector_indexed_count else "skipped",
                },
                error=str(exc),
            )
            raise

        return MedusaProductsSyncResponse(
            job=IngestionJobResponse(
                job_id=job["id"],
                status=job["status"],
                source_type=job.get("source_type"),
                source_id=job.get("source_id"),
                result=job.get("result") or {},
                error=job.get("error"),
                created_at=job.get("created_at"),
            ),
            products_indexed=len(products),
            chunks=all_chunks,
        )

    async def _index_vector_chunks(self, *, chunks: list[dict], source: dict) -> int:
        if not vector_indexing_enabled(self.settings, self.qdrant_adapter, self.embedding_provider):
            return 0
        return await index_vector_chunks_in_batches(
            chunks=chunks,
            source=source,
            qdrant_adapter=self.qdrant_adapter,
            embedding_provider=self.embedding_provider,
            settings=self.settings,
        )


class VectorIndexingService:
    def __init__(self, *, repository, qdrant_adapter, embedding_provider, settings: Settings):
        self.repository = repository
        self.qdrant_adapter = qdrant_adapter
        self.embedding_provider = embedding_provider
        self.settings = settings

    async def reindex_repository(
        self,
        *,
        store_id: str,
        locale: str,
        source_type: str | None = None,
        tenant_id: str | None = None,
    ) -> IngestionJobResponse:
        if not vector_components_present(self.qdrant_adapter, self.embedding_provider):
            raise VectorBackendUnavailable("Vector backend is not configured")
        if not qdrant_backend_enabled(self.qdrant_adapter):
            raise VectorBackendUnavailable("Qdrant URL is not configured")
        if not hasattr(self.repository, "list_chunks_for_source"):
            raise VectorBackendUnavailable("Repository does not support source-scoped chunk listing")
        job = await self.repository.create_ingestion_job(
            store_id=store_id,
            job_type="vector_index",
            source_type=source_type,
            source_id="*",
            input_payload={"store_id": store_id, "tenant_id": tenant_id, "locale": locale, "source_type": source_type},
        )
        source_count = 0
        chunk_count = 0
        result = {
            "status": JOB_PENDING,
            "source_count": source_count,
            "chunk_count": chunk_count,
            "error": None,
        }
        try:
            result["status"] = JOB_INDEXING
            sources = await self.repository.list_sources(
                store_id=store_id,
                locale=locale,
                source_type=source_type,
                tenant_id=tenant_id,
            )
            batch_size = max(1, self.settings.qdrant_upsert_batch_size)
            for source in sources:
                offset = 0
                source_had_chunks = False
                while True:
                    chunks = await self.repository.list_chunks_for_source(
                        store_id=store_id,
                        locale=locale,
                        source_type=source["source_type"],
                        source_id=source["source_id"],
                        offset=offset,
                        limit=batch_size,
                    )
                    if not chunks:
                        break
                    indexed = await index_vector_chunks_in_batches(
                        chunks=chunks,
                        source=source,
                        qdrant_adapter=self.qdrant_adapter,
                        embedding_provider=self.embedding_provider,
                        settings=self.settings,
                    )
                    chunk_count += indexed
                    offset += len(chunks)
                    source_had_chunks = True
                if source_had_chunks:
                    source_count += 1
            result = {
                "status": JOB_COMPLETED,
                "source_count": source_count,
                "chunk_count": chunk_count,
                "error": None,
            }
            job = await self.repository.complete_ingestion_job(job_id=job["id"], result=result)
        except Exception as exc:
            result = {
                "status": JOB_ERROR,
                "source_count": source_count,
                "chunk_count": chunk_count,
                "error": str(exc),
            }
            job = await self.repository.complete_ingestion_job(
                job_id=job["id"],
                result=result,
                error=str(exc),
            )
            raise
        return job_response(job)

    async def delete_source(
        self,
        *,
        store_id: str,
        locale: str,
        source_type: str,
        source_id: str,
        tenant_id: str | None = None,
    ) -> dict[str, bool]:
        deleted_repository = False
        if hasattr(self.repository, "delete_source"):
            deleted_repository = await self.repository.delete_source(
                store_id=store_id,
                locale=locale,
                source_type=source_type,
                source_id=source_id,
            )
        deleted_vector = False
        if self.qdrant_adapter:
            await self.qdrant_adapter.delete_source(
                store_id=store_id,
                locale=locale,
                source_type=source_type,
                source_id=source_id,
                tenant_id=tenant_id,
            )
            deleted_vector = True
        return {"repository": deleted_repository, "vector": deleted_vector}

    async def get_job(self, job_id):
        if not hasattr(self.repository, "get_ingestion_job"):
            return None
        job = await self.repository.get_ingestion_job(job_id)
        return job_response(job) if job else None


def vector_indexing_enabled(settings: Settings, qdrant_adapter, embedding_provider) -> bool:
    retrieval_mode = (settings.retrieval_mode or "markdown").lower()
    return (
        retrieval_mode in {"vector", "auto"}
        and vector_components_present(qdrant_adapter, embedding_provider)
        and qdrant_backend_enabled(qdrant_adapter)
    )


def vector_components_present(qdrant_adapter, embedding_provider) -> bool:
    return bool(qdrant_adapter and embedding_provider)


def qdrant_backend_enabled(qdrant_adapter) -> bool:
    return bool(getattr(qdrant_adapter, "enabled", False))


async def index_vector_chunks_in_batches(
    *,
    chunks: list[dict],
    source: dict,
    qdrant_adapter,
    embedding_provider,
    settings: Settings,
) -> int:
    if not chunks:
        return 0
    batch_size = max(1, settings.qdrant_upsert_batch_size)
    indexed = 0
    for offset in range(0, len(chunks), batch_size):
        batch = chunks[offset : offset + batch_size]
        texts = [chunk.get("content", "") for chunk in batch]
        vectors = await embedding_provider.embed_texts(texts)
        indexed += await qdrant_adapter.upsert_chunks(chunks=batch, source=source, vectors=vectors)
    return indexed


def job_response(job: dict) -> IngestionJobResponse:
    return IngestionJobResponse(
        job_id=job["id"],
        status=job["status"],
        source_type=job.get("source_type"),
        source_id=job.get("source_id"),
        result=job.get("result") or {},
        error=job.get("error"),
        created_at=job.get("created_at"),
    )
