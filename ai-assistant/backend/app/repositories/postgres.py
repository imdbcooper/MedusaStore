import json
from typing import Any
from uuid import UUID, uuid4

from app.database.postgres import PostgresDatabase


class PostgresAssistantRepository:
    """PostgreSQL implementation of assistant session/message/source storage."""

    def __init__(self, database: PostgresDatabase):
        self.database = database

    @property
    def pool(self):
        if not self.database.pool:
            raise RuntimeError("PostgreSQL pool is not initialized")
        return self.database.pool

    async def ensure_session(
        self,
        *,
        session_id: UUID | None,
        store_id: str,
        locale: str,
        customer_id: str | None = None,
        cart_id: str | None = None,
        region_id: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        actual_id = session_id or uuid4()
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO assistant_sessions
                  (id, store_id, customer_id, cart_id, locale, region_id, metadata)
                VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
                ON CONFLICT (id) DO UPDATE SET
                  updated_at = now(),
                  customer_id = COALESCE(assistant_sessions.customer_id, EXCLUDED.customer_id),
                  cart_id = COALESCE(assistant_sessions.cart_id, EXCLUDED.cart_id),
                  region_id = COALESCE(assistant_sessions.region_id, EXCLUDED.region_id)
                RETURNING *
                """,
                actual_id,
                store_id,
                customer_id,
                cart_id,
                locale,
                region_id,
                json.dumps(metadata or {}),
            )
        return dict(row)

    async def add_message(
        self,
        *,
        session_id: UUID,
        role: str,
        content: str,
        intent: str | None = None,
        citations: list[dict[str, Any]] | None = None,
        products: list[dict[str, Any]] | None = None,
        actions: list[dict[str, Any]] | None = None,
        tool_calls: list[dict[str, Any]] | None = None,
        token_usage: dict[str, Any] | None = None,
        latency_ms: int | None = None,
    ) -> dict[str, Any]:
        message_id = uuid4()
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO assistant_messages
                  (id, session_id, role, content, intent, citations, products,
                   actions, tool_calls, token_usage, latency_ms)
                VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb,
                        $9::jsonb, $10::jsonb, $11)
                RETURNING *
                """,
                message_id,
                session_id,
                role,
                content,
                intent,
                json.dumps(citations or []),
                json.dumps(products or []),
                json.dumps(actions or []),
                json.dumps(tool_calls or []),
                json.dumps(token_usage or {}),
                latency_ms,
            )
        return dict(row)

    async def list_messages(self, session_id: UUID, *, limit: int | None = None) -> list[dict[str, Any]]:
        limit_clause = "LIMIT $2" if limit is not None else ""
        args: tuple[Any, ...] = (session_id, limit) if limit is not None else (session_id,)
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                f"""
                SELECT * FROM (
                  SELECT * FROM assistant_messages
                  WHERE session_id = $1
                  ORDER BY created_at DESC
                  {limit_clause}
                ) recent
                ORDER BY created_at ASC
                """,
                *args,
            )
        return [dict(row) for row in rows]

    async def create_ingestion_job(
        self,
        *,
        store_id: str,
        job_type: str,
        source_type: str | None,
        source_id: str | None,
        input_payload: dict[str, Any],
    ) -> dict[str, Any]:
        job_id = uuid4()
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO assistant_ingestion_jobs
                  (id, store_id, job_type, status, source_type, source_id, input)
                VALUES ($1, $2, $3, 'indexing', $4, $5, $6::jsonb)
                RETURNING *
                """,
                job_id,
                store_id,
                job_type,
                source_type,
                source_id,
                json.dumps(input_payload),
            )
        return dict(row)

    async def complete_ingestion_job(
        self,
        *,
        job_id: UUID,
        result: dict[str, Any],
        error: str | None = None,
    ) -> dict[str, Any]:
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                UPDATE assistant_ingestion_jobs
                SET status = $2,
                    result = $3::jsonb,
                    error = $4,
                    finished_at = now()
                WHERE id = $1
                RETURNING *
                """,
                job_id,
                "error" if error else "completed",
                json.dumps(result),
                error,
            )
        return dict(row)

    async def get_ingestion_job(self, job_id: UUID) -> dict[str, Any] | None:
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM assistant_ingestion_jobs WHERE id = $1",
                job_id,
            )
        return dict(row) if row else None

    async def delete_source(
        self,
        *,
        store_id: str,
        locale: str,
        source_type: str,
        source_id: str,
    ) -> bool:
        async with self.pool.acquire() as conn:
            result = await conn.execute(
                """
                DELETE FROM assistant_sources
                WHERE store_id = $1 AND locale = $2 AND source_type = $3 AND source_id = $4
                """,
                store_id,
                locale,
                source_type,
                source_id,
            )
        return not result.endswith(" 0")

    async def upsert_source_with_chunks(
        self,
        *,
        store_id: str,
        locale: str,
        source_type: str,
        source_id: str,
        title: str,
        uri: str | None,
        content_hash: str,
        metadata: dict[str, Any],
        chunks: list[dict[str, Any]],
    ) -> dict[str, Any]:
        source_uuid = uuid4()
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                row = await conn.fetchrow(
                    """
                    INSERT INTO assistant_sources
                      (id, store_id, source_type, source_id, title, uri,
                       content_hash, locale, metadata, indexed_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, now())
                    ON CONFLICT (store_id, source_type, source_id, locale) DO UPDATE SET
                      title = EXCLUDED.title,
                      uri = EXCLUDED.uri,
                      content_hash = EXCLUDED.content_hash,
                      metadata = EXCLUDED.metadata,
                      indexed_at = now(),
                      updated_at = now()
                    RETURNING *
                    """,
                    source_uuid,
                    store_id,
                    source_type,
                    source_id,
                    title,
                    uri,
                    content_hash,
                    locale,
                    json.dumps(metadata),
                )
                await conn.execute("DELETE FROM assistant_source_chunks WHERE source_id = $1", row["id"])
                for chunk in chunks:
                    await conn.execute(
                        """
                        INSERT INTO assistant_source_chunks
                          (id, source_id, chunk_index, content, content_hash, metadata)
                        VALUES ($1, $2, $3, $4, $5, $6::jsonb)
                        """,
                        chunk["id"],
                        row["id"],
                        chunk["chunk_index"],
                        chunk["content"],
                        chunk["content_hash"],
                        json.dumps(chunk.get("metadata", {})),
                    )
        return dict(row)

    async def search_chunks(
        self,
        *,
        store_id: str,
        locale: str,
        query: str,
        limit: int = 5,
    ) -> list[dict[str, Any]]:
        terms = [term for term in query.split() if len(term) > 2]
        if not terms:
            terms = [query]
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT c.*, row_to_json(s.*) AS source,
                       GREATEST(
                         $3::int,
                         (SELECT COUNT(*) FROM unnest($4::text[]) term WHERE c.content ILIKE '%' || term || '%')
                       ) AS score
                FROM assistant_source_chunks c
                JOIN assistant_sources s ON s.id = c.source_id
                WHERE s.store_id = $1
                  AND s.locale = $2
                  AND EXISTS (
                    SELECT 1 FROM unnest($4::text[]) term WHERE c.content ILIKE '%' || term || '%'
                  )
                ORDER BY score DESC, c.created_at DESC
                LIMIT $5
                """,
                store_id,
                locale,
                0,
                terms,
                limit,
            )
        return [dict(row) for row in rows]

    async def list_sources(
        self,
        *,
        store_id: str,
        locale: str,
        source_type: str | None = None,
    ) -> list[dict[str, Any]]:
        source_filter = "AND source_type = $3" if source_type else ""
        args: tuple[Any, ...] = (store_id, locale, source_type) if source_type else (store_id, locale)
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                f"""
                SELECT * FROM assistant_sources
                WHERE store_id = $1 AND locale = $2
                {source_filter}
                ORDER BY indexed_at DESC NULLS LAST, created_at DESC
                """,
                *args,
            )
        return [dict(row) for row in rows]

    async def list_chunks_for_source(
        self,
        *,
        store_id: str,
        locale: str,
        source_type: str,
        source_id: str,
        offset: int = 0,
        limit: int | None = None,
    ) -> list[dict[str, Any]]:
        limit_clause = "LIMIT $6" if limit is not None else ""
        args: tuple[Any, ...]
        if limit is not None:
            args = (store_id, locale, source_type, source_id, offset, limit)
        else:
            args = (store_id, locale, source_type, source_id, offset)
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                f"""
                SELECT c.*, row_to_json(s.*) AS source
                FROM assistant_source_chunks c
                JOIN assistant_sources s ON s.id = c.source_id
                WHERE s.store_id = $1
                  AND s.locale = $2
                  AND s.source_type = $3
                  AND s.source_id = $4
                ORDER BY c.chunk_index ASC, c.created_at ASC
                OFFSET $5
                {limit_clause}
                """,
                *args,
            )
        return [dict(row) for row in rows]

    async def stats(self) -> dict[str, int]:
        async with self.pool.acquire() as conn:
            return {
                "document_count": await conn.fetchval("SELECT COUNT(*) FROM assistant_sources"),
                "chunk_count": await conn.fetchval("SELECT COUNT(*) FROM assistant_source_chunks"),
                "indexed_product_count": await conn.fetchval(
                    "SELECT COUNT(*) FROM assistant_sources WHERE source_type = 'medusa_product'"
                ),
                "session_count": await conn.fetchval("SELECT COUNT(*) FROM assistant_sessions"),
                "message_count": await conn.fetchval("SELECT COUNT(*) FROM assistant_messages"),
                "failed_jobs": await conn.fetchval(
                    "SELECT COUNT(*) FROM assistant_ingestion_jobs WHERE status = 'error'"
                ),
            }
