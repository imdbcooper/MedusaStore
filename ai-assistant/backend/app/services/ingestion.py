from pathlib import Path

from app.core.config import Settings
from app.ingestion.markdown import discover_markdown_files, parse_markdown_file, sha256_text
from app.ingestion.products import normalize_medusa_product
from app.schemas.ingestion import IngestionJobResponse, MarkdownSyncResponse, MedusaProductsSyncResponse


class MarkdownIngestionService:
    def __init__(self, *, repository, settings: Settings):
        self.repository = repository
        self.settings = settings

    async def sync_directory(
        self,
        *,
        store_id: str,
        locale: str,
        path: str | None = None,
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
                await self.repository.upsert_source_with_chunks(
                    store_id=store_id,
                    locale=locale,
                    source_type=first.source_type,
                    source_id=first.source_id,
                    title=first.title,
                    uri=first.path,
                    content_hash=source_hash,
                    metadata=first.metadata,
                    chunks=[chunk.model_dump(mode="json") for chunk in chunks],
                )
                all_chunks.extend(chunks)
            job = await self.repository.complete_ingestion_job(
                job_id=job["id"],
                result={"file_count": len(files), "chunk_count": len(all_chunks)},
            )
        except Exception as exc:
            job = await self.repository.complete_ingestion_job(
                job_id=job["id"],
                result={"file_count": len(files), "chunk_count": len(all_chunks)},
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


class MedusaProductIngestionService:
    def __init__(self, *, repository, product_client, settings: Settings):
        self.repository = repository
        self.product_client = product_client
        self.settings = settings

    async def sync_products(
        self,
        *,
        store_id: str,
        locale: str,
        full: bool = False,
        product_ids: list[str] | None = None,
        region_id: str | None = None,
        currency_code: str | None = None,
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
            },
        )

        all_chunks = []
        products = []
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
                    chunk_target_chars=self.settings.chunk_target_chars,
                    chunk_overlap_chars=self.settings.chunk_overlap_chars,
                )
                if not chunks:
                    continue
                first = chunks[0]
                source_hash = sha256_text("\n".join(chunk.content_hash for chunk in chunks))
                await self.repository.upsert_source_with_chunks(
                    store_id=store_id,
                    locale=locale,
                    source_type=first.source_type,
                    source_id=first.source_id,
                    title=first.title,
                    uri=first.path,
                    content_hash=source_hash,
                    metadata=first.metadata,
                    chunks=[chunk.model_dump(mode="json") for chunk in chunks],
                )
                all_chunks.extend(chunks)
            job = await self.repository.complete_ingestion_job(
                job_id=job["id"],
                result={"product_count": len(products), "chunk_count": len(all_chunks)},
            )
        except Exception as exc:
            job = await self.repository.complete_ingestion_job(
                job_id=job["id"],
                result={"product_count": len(products), "chunk_count": len(all_chunks)},
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
