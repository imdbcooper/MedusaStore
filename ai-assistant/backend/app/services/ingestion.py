from pathlib import Path

from app.core.config import Settings
from app.ingestion.markdown import discover_markdown_files, parse_markdown_file, sha256_text
from app.schemas.ingestion import IngestionJobResponse, MarkdownSyncResponse


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
