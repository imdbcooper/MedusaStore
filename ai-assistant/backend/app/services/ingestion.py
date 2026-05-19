from pathlib import Path

from app.core.config import Settings
from app.ingestion.markdown import (
    build_admin_markdown_document,
    discover_markdown_files,
    normalize_markdown,
    parse_markdown_file,
    sanitize_path_segment,
    sha256_text,
    strip_frontmatter,
)
from app.ingestion.products import normalize_medusa_product
from app.schemas.ingestion import (
    IngestionJobResponse,
    KnowledgeDocumentCreateResponse,
    KnowledgeDocumentResponse,
    MarkdownSyncResponse,
    MedusaProductsSyncResponse,
)
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
        if path:
            target = self._resolve_path(path)
            if not target.exists():
                raise FileNotFoundError(f"Markdown knowledge path does not exist: {target}")
            entries = [
                (
                    target if target.is_dir() else target.parent,
                    file_path,
                )
                for file_path in discover_markdown_files(target)
            ]
            return await self._sync_entries(
                store_id=store_id,
                locale=locale,
                tenant_id=tenant_id,
                entries=entries,
                source_id=str(target),
                input_payload={"path": str(target), "locale": locale},
            )

        entries: list[tuple[Path, Path]] = []
        packaged_root = self._resolve_path(self.settings.knowledge_dir)
        if packaged_root.exists():
            entries.extend(
                (packaged_root if packaged_root.is_dir() else packaged_root.parent, file_path)
                for file_path in discover_markdown_files(packaged_root)
            )

        uploads_base = self.uploads_base_dir
        scoped_upload_root = self.upload_scope_dir(
            store_id=store_id,
            locale=locale,
            tenant_id=tenant_id,
        )
        if scoped_upload_root.exists():
            entries.extend(
                (uploads_base, file_path)
                for file_path in discover_markdown_files(scoped_upload_root)
            )

        if not entries:
            raise FileNotFoundError(
                f"Markdown knowledge paths do not exist: {packaged_root}, {scoped_upload_root}"
            )

        return await self._sync_entries(
            store_id=store_id,
            locale=locale,
            tenant_id=tenant_id,
            entries=entries,
            source_id=",".join(
                str(root)
                for root in [packaged_root, scoped_upload_root]
                if root.exists()
            ),
            input_payload={
                "paths": [str(root) for root in [packaged_root, scoped_upload_root] if root.exists()],
                "locale": locale,
                "tenant_id": tenant_id,
            },
        )

    async def save_admin_document(
        self,
        *,
        store_id: str,
        locale: str,
        title: str,
        description: str,
        content: str,
        tenant_id: str | None = None,
        file_name: str | None = None,
    ) -> KnowledgeDocumentCreateResponse:
        cleaned_content = content.strip()
        if not cleaned_content:
            raise ValueError("Knowledge document content is empty.")
        if not normalize_markdown(strip_frontmatter(cleaned_content)):
            raise ValueError("Knowledge document content is empty after stripping frontmatter.")

        uploads_base = self.uploads_base_dir
        scoped_root = self.upload_scope_dir(
            store_id=store_id,
            locale=locale,
            tenant_id=tenant_id,
        )
        scoped_root.mkdir(parents=True, exist_ok=True)

        source_file_name = Path(file_name).name if file_name else ""
        slug_source = Path(source_file_name).stem if source_file_name else title
        slug = sanitize_path_segment(slug_source, default="knowledge-document")
        full_path = scoped_root / f"{slug}.md"
        relative_path = str(full_path.relative_to(uploads_base))
        markdown = build_admin_markdown_document(
            title=title,
            description=description,
            content=cleaned_content,
            source_id=relative_path,
            store_id=store_id,
            locale=locale,
            tenant_id=tenant_id,
            uploaded_file_name=source_file_name or None,
        )
        full_path.write_text(markdown, encoding="utf-8")

        sync = await self._sync_entries(
            store_id=store_id,
            locale=locale,
            tenant_id=tenant_id,
            entries=[(uploads_base, full_path)],
            source_id=relative_path,
            input_payload={
                "path": relative_path,
                "store_id": store_id,
                "tenant_id": tenant_id,
                "locale": locale,
                "source_origin": "admin",
            },
        )
        return KnowledgeDocumentCreateResponse(
            document=KnowledgeDocumentResponse(
                source_id=relative_path,
                path=relative_path,
                title=title.strip(),
                description=description.strip(),
                file_name=full_path.name,
                store_id=store_id,
                tenant_id=tenant_id,
                locale=locale,
            ),
            job=sync.job,
            chunks=sync.chunks,
        )

    @property
    def uploads_base_dir(self) -> Path:
        return self._resolve_path(self.settings.knowledge_uploads_dir)

    def upload_scope_dir(
        self,
        *,
        store_id: str,
        locale: str,
        tenant_id: str | None = None,
    ) -> Path:
        tenant_segment = sanitize_path_segment(tenant_id or "global", default="global")
        return (
            self.uploads_base_dir
            / sanitize_path_segment(store_id, default="default")
            / tenant_segment
            / sanitize_path_segment(locale, default="ru")
        )

    def _resolve_path(self, value: str | Path) -> Path:
        path = Path(value)
        if not path.is_absolute():
            path = Path.cwd() / path
        return path

    async def _sync_entries(
        self,
        *,
        store_id: str,
        locale: str,
        tenant_id: str | None,
        entries: list[tuple[Path, Path]],
        source_id: str,
        input_payload: dict,
    ) -> MarkdownSyncResponse:
        job = await self.repository.create_ingestion_job(
            store_id=store_id,
            job_type="markdown_sync",
            source_type="markdown",
            source_id=source_id,
            input_payload=input_payload,
        )

        all_chunks = []
        vector_indexed_count = 0
        file_count = len(entries)
        try:
            for root, file_path in entries:
                chunks = parse_markdown_file(
                    file_path,
                    root=root,
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
                    "source_count": file_count,
                    "file_count": file_count,
                    "chunk_count": len(all_chunks),
                    "vector_indexed_count": vector_indexed_count,
                    "vector_status": "indexed" if vector_indexed_count else "skipped",
                },
            )
        except Exception as exc:
            job = await self.repository.complete_ingestion_job(
                job_id=job["id"],
                result={
                    "source_count": file_count,
                    "file_count": file_count,
                    "chunk_count": len(all_chunks),
                    "vector_indexed_count": vector_indexed_count,
                    "vector_status": "indexed" if vector_indexed_count else "skipped",
                },
                error=str(exc),
            )
            raise

        return MarkdownSyncResponse(
            job=job_response(job),
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
