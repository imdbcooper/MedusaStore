import json
from typing import Any
from uuid import UUID, uuid4

from app.database.postgres import PostgresDatabase

_UNSET = object()


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
                  (id, store_id, customer_id, cart_id, locale, region_id, metadata, tenant_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
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
                (metadata or {}).get("tenant_id"),
            )
        return _normalize_session_row(dict(row))

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
        metadata: dict[str, Any] | None = None,
        latency_ms: int | None = None,
    ) -> dict[str, Any]:
        message_id = uuid4()
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO assistant_messages
                  (id, session_id, role, content, intent, citations, products,
                   actions, tool_calls, token_usage, metadata, latency_ms)
                VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb,
                        $9::jsonb, $10::jsonb, $11::jsonb, $12)
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
                json.dumps(metadata or {}),
                latency_ms,
            )
        return _normalize_message_row(dict(row))

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
        return [_normalize_message_row(dict(row)) for row in rows]

    async def get_session(self, session_id: UUID) -> dict[str, Any] | None:
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow("SELECT * FROM assistant_sessions WHERE id = $1", session_id)
        return _normalize_session_row(dict(row)) if row else None

    async def update_session_customer_context(
        self,
        *,
        session_id: UUID,
        customer_context: dict[str, Any],
    ) -> dict[str, Any]:
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                UPDATE assistant_sessions
                SET customer_context = $2::jsonb,
                    updated_at = now()
                WHERE id = $1
                RETURNING *
                """,
                session_id,
                json.dumps(customer_context or {}),
            )
        if not row:
            raise ValueError("SESSION_NOT_FOUND")
        return _normalize_session_row(dict(row))

    async def bind_session_customer(
        self,
        *,
        session_id: UUID,
        store_id: str,
        locale: str,
        customer_id: str,
        tenant_id: str | None = None,
        customer_context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                row = await conn.fetchrow(
                    """
                    SELECT * FROM assistant_sessions
                    WHERE id = $1
                    FOR UPDATE
                    """,
                    session_id,
                )
                if not row:
                    raise ValueError("SESSION_NOT_FOUND")
                session = dict(row)
                if session.get("store_id") != store_id or session.get("locale") != locale or session.get("tenant_id") != tenant_id:
                    raise ValueError("SESSION_SCOPE_MISMATCH")
                existing_customer_id = session.get("customer_id")
                if existing_customer_id and existing_customer_id != customer_id:
                    raise ValueError("SESSION_ALREADY_BOUND_TO_DIFFERENT_CUSTOMER")
                updated = await conn.fetchrow(
                    """
                    UPDATE assistant_sessions
                    SET customer_id = $2,
                        customer_context = $3::jsonb,
                        bound_at = COALESCE(bound_at, now()),
                        updated_at = now()
                    WHERE id = $1
                    RETURNING *
                    """,
                    session_id,
                    customer_id,
                    json.dumps(customer_context or {}),
                )
        return _normalize_session_row(dict(updated))

    async def get_message(self, message_id: UUID) -> dict[str, Any] | None:
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow("SELECT * FROM assistant_messages WHERE id = $1", message_id)
        return _normalize_message_row(dict(row)) if row else None

    async def message_belongs_to_session(self, *, message_id: UUID, session_id: UUID) -> bool:
        async with self.pool.acquire() as conn:
            return bool(
                await conn.fetchval(
                    "SELECT EXISTS(SELECT 1 FROM assistant_messages WHERE id = $1 AND session_id = $2)",
                    message_id,
                    session_id,
                )
            )

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
        return _normalize_ingestion_job_row(dict(row))

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
        return _normalize_ingestion_job_row(dict(row))

    async def get_ingestion_job(self, job_id: UUID) -> dict[str, Any] | None:
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM assistant_ingestion_jobs WHERE id = $1",
                job_id,
            )
        return _normalize_ingestion_job_row(dict(row)) if row else None

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
        source_type: str | None = None,
    ) -> list[dict[str, Any]]:
        terms = [term for term in query.split() if len(term) > 2]
        if not terms:
            terms = [query]
        filters = ["s.store_id = $1", "s.locale = $2"]
        args: list[Any] = [store_id, locale, 0, terms]
        if source_type:
            args.append(source_type)
            filters.append(f"s.source_type = ${len(args)}")
        args.append(limit)
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                f"""
                SELECT c.*, row_to_json(s.*) AS source,
                       GREATEST(
                         $3::int,
                         (SELECT COUNT(*) FROM unnest($4::text[]) term WHERE c.content ILIKE '%' || term || '%')
                       ) AS score
                FROM assistant_source_chunks c
                JOIN assistant_sources s ON s.id = c.source_id
                WHERE {' AND '.join(filters)}
                  AND EXISTS (
                    SELECT 1 FROM unnest($4::text[]) term WHERE c.content ILIKE '%' || term || '%'
                  )
                ORDER BY score DESC, c.created_at DESC
                LIMIT ${len(args)}
                """,
                *args,
            )
        return [_normalize_chunk_row(dict(row)) for row in rows]

    async def list_sources(
        self,
        *,
        store_id: str,
        locale: str,
        source_type: str | None = None,
        tenant_id: str | None = None,
    ) -> list[dict[str, Any]]:
        filters = ["store_id = $1", "locale = $2"]
        args: list[Any] = [store_id, locale]
        if source_type:
            args.append(source_type)
            filters.append(f"source_type = ${len(args)}")
        if tenant_id:
            args.append(tenant_id)
            filters.append(f"metadata->>'tenant_id' = ${len(args)}")
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                f"""
                SELECT * FROM assistant_sources
                WHERE {' AND '.join(filters)}
                ORDER BY indexed_at DESC NULLS LAST, created_at DESC
                """,
                *args,
            )
        return [_normalize_source_row(dict(row)) for row in rows]

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
        return [_normalize_chunk_row(dict(row)) for row in rows]

    async def create_feedback(
        self,
        *,
        session_id: UUID,
        message_id: UUID | None = None,
        store_id: str = "default",
        tenant_id: str | None = None,
        locale: str = "ru",
        rating: int | None = None,
        label: str | None = None,
        comment: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        feedback_id = uuid4()
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO assistant_feedback
                  (id, session_id, message_id, store_id, tenant_id, locale, rating, label, comment, metadata)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
                RETURNING *
                """,
                feedback_id,
                session_id,
                message_id,
                store_id,
                tenant_id,
                locale,
                rating,
                label,
                comment,
                json.dumps(metadata or {}),
            )
        return dict(row)

    async def create_handoff(
        self,
        *,
        session_id: UUID,
        message_id: UUID | None = None,
        store_id: str = "default",
        tenant_id: str | None = None,
        locale: str = "ru",
        source: str = "assistant_widget",
        name: str | None = None,
        email: str | None = None,
        phone: str | None = None,
        summary: str | None = None,
        reason: str | None = None,
        note: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        handoff_id = uuid4()
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO assistant_handoffs
                  (id, session_id, message_id, customer_id, store_id, tenant_id, locale, status, source,
                   name, email, phone, summary, reason, note, metadata)
                VALUES (
                  $1, $2, $3,
                  (SELECT customer_id FROM assistant_sessions WHERE id = $2),
                  $4, $5, $6, 'submitted', $7,
                  $8, $9, $10, $11, $12, $13, $14::jsonb
                )
                RETURNING *
                """,
                handoff_id,
                session_id,
                message_id,
                store_id,
                tenant_id,
                locale,
                source,
                name,
                email,
                phone,
                summary,
                reason,
                note,
                json.dumps(metadata or {}),
            )
        return _normalize_handoff_row(dict(row))

    async def get_handoff(self, handoff_id: UUID) -> dict[str, Any] | None:
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT *
                FROM assistant_handoffs
                WHERE id = $1
                """,
                handoff_id,
            )
        return _normalize_handoff_row(dict(row)) if row else None

    async def get_handoff_ticket(
        self,
        *,
        handoff_id: UUID,
        channel: str = "telegram",
    ) -> dict[str, Any] | None:
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT *
                FROM assistant_handoff_tickets
                WHERE handoff_id = $1 AND channel = $2
                """,
                handoff_id,
                channel,
            )
        return _normalize_handoff_ticket_row(dict(row)) if row else None

    async def upsert_handoff_ticket(
        self,
        *,
        handoff_id: UUID,
        channel: str = "telegram",
        ticket_status: str,
        telegram_chat_id: str | None = None,
        telegram_topic_id: int | None = None,
        telegram_topic_title: str | None = None,
        telegram_root_message_id: int | None = None,
        external_chat_id: str | None = None,
        external_thread_id: str | None = None,
        external_thread_title: str | None = None,
        external_root_message_id: str | None = None,
        assigned_operator_id: str | None = None,
        assigned_operator_username: str | None = None,
        assigned_at=None,
        closed_at=None,
        last_operator_message_at=None,
        last_customer_message_at=None,
        last_telegram_update_id: int | None = None,
        last_external_event_id: str | None = None,
        failure_reason: str | None = None,
        created_at=None,
        opened_at=None,
        last_sync_at=None,
    ) -> dict[str, Any]:
        resolved_external_chat_id = (
            external_chat_id
            if external_chat_id is not None
            else str(telegram_chat_id)
            if telegram_chat_id is not None
            else None
        )
        resolved_external_thread_id = (
            external_thread_id
            if external_thread_id is not None
            else str(telegram_topic_id)
            if telegram_topic_id is not None
            else None
        )
        resolved_external_thread_title = (
            external_thread_title
            if external_thread_title is not None
            else telegram_topic_title
        )
        resolved_external_root_message_id = (
            external_root_message_id
            if external_root_message_id is not None
            else str(telegram_root_message_id)
            if telegram_root_message_id is not None
            else None
        )
        resolved_last_external_event_id = (
            last_external_event_id
            if last_external_event_id is not None
            else str(last_telegram_update_id)
            if last_telegram_update_id is not None
            else None
        )
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO assistant_handoff_tickets
                  (
                    handoff_id,
                    channel,
                    ticket_status,
                    telegram_chat_id,
                    telegram_topic_id,
                    telegram_topic_title,
                    telegram_root_message_id,
                    external_chat_id,
                    external_thread_id,
                    external_thread_title,
                    external_root_message_id,
                    assigned_operator_id,
                    assigned_operator_username,
                    assigned_at,
                    closed_at,
                    last_operator_message_at,
                    last_customer_message_at,
                    last_telegram_update_id,
                    last_external_event_id,
                    failure_reason,
                    created_at,
                    opened_at,
                    last_sync_at,
                    updated_at
                  )
                VALUES (
                  $1, $2, $3, $4, $5, $6, $7,
                  $8, $9, $10, $11,
                  $12, $13, $14, $15, $16, $17,
                  $18, $19,
                  COALESCE($20, now()),
                  $21,
                  COALESCE($22, now()),
                  now()
                )
                ON CONFLICT (handoff_id, channel) DO UPDATE SET
                  ticket_status = CASE
                    WHEN assistant_handoff_tickets.ticket_status = 'open'
                      AND (
                        (
                          assistant_handoff_tickets.telegram_topic_id IS NOT NULL
                          AND assistant_handoff_tickets.telegram_root_message_id IS NOT NULL
                        )
                        OR (
                          assistant_handoff_tickets.external_thread_id IS NOT NULL
                          AND assistant_handoff_tickets.external_root_message_id IS NOT NULL
                        )
                      )
                      AND EXCLUDED.ticket_status <> 'open'
                    THEN assistant_handoff_tickets.ticket_status
                    WHEN assistant_handoff_tickets.ticket_status = 'failed'
                      AND EXCLUDED.ticket_status = 'submitted'
                    THEN assistant_handoff_tickets.ticket_status
                    ELSE EXCLUDED.ticket_status
                  END,
                  telegram_chat_id = COALESCE(
                    EXCLUDED.telegram_chat_id,
                    assistant_handoff_tickets.telegram_chat_id
                  ),
                  telegram_topic_id = COALESCE(
                    EXCLUDED.telegram_topic_id,
                    assistant_handoff_tickets.telegram_topic_id
                  ),
                  telegram_topic_title = COALESCE(
                    EXCLUDED.telegram_topic_title,
                    assistant_handoff_tickets.telegram_topic_title
                  ),
                  telegram_root_message_id = COALESCE(
                    EXCLUDED.telegram_root_message_id,
                    assistant_handoff_tickets.telegram_root_message_id
                  ),
                  external_chat_id = COALESCE(
                    EXCLUDED.external_chat_id,
                    assistant_handoff_tickets.external_chat_id
                  ),
                  external_thread_id = COALESCE(
                    EXCLUDED.external_thread_id,
                    assistant_handoff_tickets.external_thread_id
                  ),
                  external_thread_title = COALESCE(
                    EXCLUDED.external_thread_title,
                    assistant_handoff_tickets.external_thread_title
                  ),
                  external_root_message_id = COALESCE(
                    EXCLUDED.external_root_message_id,
                    assistant_handoff_tickets.external_root_message_id
                  ),
                  assigned_operator_id = COALESCE(
                    EXCLUDED.assigned_operator_id,
                    assistant_handoff_tickets.assigned_operator_id
                  ),
                  assigned_operator_username = COALESCE(
                    EXCLUDED.assigned_operator_username,
                    assistant_handoff_tickets.assigned_operator_username
                  ),
                  assigned_at = COALESCE(
                    assistant_handoff_tickets.assigned_at,
                    EXCLUDED.assigned_at
                  ),
                  closed_at = COALESCE(
                    EXCLUDED.closed_at,
                    assistant_handoff_tickets.closed_at
                  ),
                  last_operator_message_at = COALESCE(
                    EXCLUDED.last_operator_message_at,
                    assistant_handoff_tickets.last_operator_message_at
                  ),
                  last_customer_message_at = COALESCE(
                    EXCLUDED.last_customer_message_at,
                    assistant_handoff_tickets.last_customer_message_at
                  ),
                  last_telegram_update_id = COALESCE(
                    EXCLUDED.last_telegram_update_id,
                    assistant_handoff_tickets.last_telegram_update_id
                  ),
                  last_external_event_id = COALESCE(
                    EXCLUDED.last_external_event_id,
                    assistant_handoff_tickets.last_external_event_id
                  ),
                  failure_reason = CASE
                    WHEN EXCLUDED.ticket_status = 'open' THEN NULL
                    WHEN EXCLUDED.failure_reason IS NOT NULL THEN EXCLUDED.failure_reason
                    ELSE assistant_handoff_tickets.failure_reason
                  END,
                  opened_at = COALESCE(
                    assistant_handoff_tickets.opened_at,
                    EXCLUDED.opened_at
                  ),
                  last_sync_at = COALESCE(
                    EXCLUDED.last_sync_at,
                    assistant_handoff_tickets.last_sync_at,
                    now()
                  ),
                  updated_at = now()
                RETURNING *
                """,
                handoff_id,
                channel,
                ticket_status,
                telegram_chat_id,
                telegram_topic_id,
                telegram_topic_title,
                telegram_root_message_id,
                resolved_external_chat_id,
                resolved_external_thread_id,
                resolved_external_thread_title,
                resolved_external_root_message_id,
                assigned_operator_id,
                assigned_operator_username,
                assigned_at,
                closed_at,
                last_operator_message_at,
                last_customer_message_at,
                last_telegram_update_id,
                resolved_last_external_event_id,
                failure_reason,
                created_at,
                opened_at,
                last_sync_at,
            )
        return _normalize_handoff_ticket_row(dict(row))

    async def update_handoff_ticket(
        self,
        *,
        handoff_id: UUID,
        channel: str = "telegram",
        ticket_status: str | object = _UNSET,
        external_chat_id: str | None | object = _UNSET,
        external_thread_id: str | None | object = _UNSET,
        external_thread_title: str | None | object = _UNSET,
        external_root_message_id: str | None | object = _UNSET,
        assigned_operator_id: str | None | object = _UNSET,
        assigned_operator_username: str | None | object = _UNSET,
        assigned_at: Any | object = _UNSET,
        closed_at: Any | object = _UNSET,
        last_operator_message_at: Any | object = _UNSET,
        last_customer_message_at: Any | object = _UNSET,
        last_telegram_update_id: int | None | object = _UNSET,
        last_external_event_id: str | None | object = _UNSET,
        failure_reason: str | None | object = _UNSET,
        last_sync_at: Any | object = _UNSET,
    ) -> dict[str, Any]:
        current = await self.get_handoff_ticket(handoff_id=handoff_id, channel=channel)
        if current is None:
            raise ValueError("HANDOFF_TICKET_NOT_FOUND")

        merged = dict(current)
        if ticket_status is not _UNSET:
            merged["ticket_status"] = ticket_status
        if external_chat_id is not _UNSET:
            merged["external_chat_id"] = external_chat_id
        if external_thread_id is not _UNSET:
            merged["external_thread_id"] = external_thread_id
        if external_thread_title is not _UNSET:
            merged["external_thread_title"] = external_thread_title
        if external_root_message_id is not _UNSET:
            merged["external_root_message_id"] = external_root_message_id
        if assigned_operator_id is not _UNSET:
            merged["assigned_operator_id"] = assigned_operator_id
        if assigned_operator_username is not _UNSET:
            merged["assigned_operator_username"] = assigned_operator_username
        if assigned_at is not _UNSET:
            merged["assigned_at"] = assigned_at
        if closed_at is not _UNSET:
            merged["closed_at"] = closed_at
        if last_operator_message_at is not _UNSET:
            merged["last_operator_message_at"] = last_operator_message_at
        if last_customer_message_at is not _UNSET:
            merged["last_customer_message_at"] = last_customer_message_at
        if last_telegram_update_id is not _UNSET:
            merged["last_telegram_update_id"] = last_telegram_update_id
            merged["last_external_event_id"] = (
                str(last_telegram_update_id)
                if last_telegram_update_id is not None
                else None
            )
        if last_external_event_id is not _UNSET:
            merged["last_external_event_id"] = last_external_event_id
        if failure_reason is not _UNSET:
            merged["failure_reason"] = failure_reason
        if last_sync_at is not _UNSET:
            merged["last_sync_at"] = last_sync_at

        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                UPDATE assistant_handoff_tickets
                SET ticket_status = $3,
                    telegram_chat_id = $4,
                    telegram_topic_id = $5,
                    telegram_topic_title = $6,
                    telegram_root_message_id = $7,
                    external_chat_id = $8,
                    external_thread_id = $9,
                    external_thread_title = $10,
                    external_root_message_id = $11,
                    assigned_operator_id = $12,
                    assigned_operator_username = $13,
                    assigned_at = $14,
                    closed_at = $15,
                    last_operator_message_at = $16,
                    last_customer_message_at = $17,
                    last_telegram_update_id = $18,
                    last_external_event_id = $19,
                    failure_reason = $20,
                    last_sync_at = $21,
                    updated_at = now()
                WHERE handoff_id = $1 AND channel = $2
                RETURNING *
                """,
                handoff_id,
                channel,
                merged.get("ticket_status"),
                merged.get("telegram_chat_id"),
                merged.get("telegram_topic_id"),
                merged.get("telegram_topic_title"),
                merged.get("telegram_root_message_id"),
                merged.get("external_chat_id"),
                merged.get("external_thread_id"),
                merged.get("external_thread_title"),
                merged.get("external_root_message_id"),
                merged.get("assigned_operator_id"),
                merged.get("assigned_operator_username"),
                merged.get("assigned_at"),
                merged.get("closed_at"),
                merged.get("last_operator_message_at"),
                merged.get("last_customer_message_at"),
                merged.get("last_telegram_update_id"),
                merged.get("last_external_event_id"),
                merged.get("failure_reason"),
                merged.get("last_sync_at"),
            )
        return _normalize_handoff_ticket_row(dict(row))

    async def find_handoff_ticket_by_telegram_thread(
        self,
        *,
        telegram_chat_id: str,
        telegram_topic_id: int,
        channel: str = "telegram",
    ) -> dict[str, Any] | None:
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT t.*, h.session_id
                FROM assistant_handoff_tickets t
                JOIN assistant_handoffs h ON h.id = t.handoff_id
                WHERE t.channel = $1
                  AND t.telegram_chat_id = $2
                  AND t.telegram_topic_id = $3
                ORDER BY t.updated_at DESC
                LIMIT 1
                """,
                channel,
                telegram_chat_id,
                telegram_topic_id,
            )
        return _normalize_handoff_ticket_row(dict(row)) if row else None

    async def find_handoff_ticket_by_external_thread(
        self,
        *,
        external_chat_id: str,
        external_thread_id: str,
        channel: str,
    ) -> dict[str, Any] | None:
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT t.*, h.session_id
                FROM assistant_handoff_tickets t
                JOIN assistant_handoffs h ON h.id = t.handoff_id
                WHERE t.channel = $1
                  AND t.external_chat_id = $2
                  AND t.external_thread_id = $3
                ORDER BY t.updated_at DESC
                LIMIT 1
                """,
                channel,
                external_chat_id,
                external_thread_id,
            )
        return _normalize_handoff_ticket_row(dict(row)) if row else None

    async def get_latest_handoff_ticket_for_session(
        self,
        *,
        session_id: UUID,
        channel: str = "telegram",
    ) -> dict[str, Any] | None:
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT t.*, h.session_id
                FROM assistant_handoff_tickets t
                JOIN assistant_handoffs h ON h.id = t.handoff_id
                WHERE t.channel = $1
                  AND h.session_id = $2
                ORDER BY COALESCE(t.last_sync_at, t.updated_at, h.created_at) DESC
                LIMIT 1
                """,
                channel,
                session_id,
            )
        return _normalize_handoff_ticket_row(dict(row)) if row else None

    async def get_handoff_message_by_update_id(
        self,
        *,
        telegram_update_id: int,
    ) -> dict[str, Any] | None:
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT *
                FROM assistant_handoff_messages
                WHERE telegram_update_id = $1
                """,
                telegram_update_id,
            )
        return _normalize_handoff_message_row(dict(row)) if row else None

    async def get_handoff_message_by_message(
        self,
        *,
        telegram_chat_id: str,
        telegram_topic_id: int,
        telegram_message_id: int,
        direction: str,
    ) -> dict[str, Any] | None:
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT *
                FROM assistant_handoff_messages
                WHERE telegram_chat_id = $1
                  AND telegram_topic_id = $2
                  AND telegram_message_id = $3
                  AND direction = $4
                ORDER BY created_at DESC
                LIMIT 1
                """,
                telegram_chat_id,
                telegram_topic_id,
                telegram_message_id,
                direction,
            )
        return _normalize_handoff_message_row(dict(row)) if row else None

    async def get_handoff_message_by_external_event_id(
        self,
        *,
        channel: str,
        external_event_id: str,
    ) -> dict[str, Any] | None:
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT *
                FROM assistant_handoff_messages
                WHERE channel = $1
                  AND external_event_id = $2
                """,
                channel,
                external_event_id,
            )
        return _normalize_handoff_message_row(dict(row)) if row else None

    async def get_handoff_message_by_external_message(
        self,
        *,
        channel: str,
        external_chat_id: str,
        external_thread_id: str | None,
        external_message_id: str,
        direction: str,
    ) -> dict[str, Any] | None:
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT *
                FROM assistant_handoff_messages
                WHERE channel = $1
                  AND external_chat_id = $2
                  AND external_thread_id IS NOT DISTINCT FROM $3
                  AND external_message_id = $4
                  AND direction = $5
                ORDER BY created_at DESC
                LIMIT 1
                """,
                channel,
                external_chat_id,
                external_thread_id,
                external_message_id,
                direction,
            )
        return _normalize_handoff_message_row(dict(row)) if row else None

    async def reserve_external_webhook_receipt(
        self,
        *,
        channel: str,
        external_chat_id: str,
        external_thread_id: str | None,
        external_message_id: str | None,
        external_event_id: str | None,
        direction: str,
        message_kind: str = "external_update",
        metadata: dict[str, Any] | None = None,
    ) -> tuple[dict[str, Any], bool]:
        receipt_id = uuid4()
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                if external_event_id is None:
                    existing = await conn.fetchrow(
                        """
                        SELECT *
                        FROM assistant_external_webhook_receipts
                        WHERE channel = $1
                          AND external_chat_id = $2
                          AND external_thread_id IS NOT DISTINCT FROM $3
                          AND external_message_id = $4
                          AND direction = $5
                        FOR UPDATE
                        """,
                        channel,
                        external_chat_id,
                        external_thread_id,
                        external_message_id,
                        direction,
                    )
                    if existing:
                        existing_record = _normalize_external_webhook_receipt_row(
                            dict(existing)
                        )
                        if existing_record.get("delivery_status") != "failed":
                            return existing_record, False
                        updated = await conn.fetchrow(
                            """
                            UPDATE assistant_external_webhook_receipts
                            SET channel = $2,
                                external_chat_id = $3,
                                external_thread_id = $4,
                                external_message_id = $5,
                                external_event_id = NULL,
                                direction = $6,
                                delivery_status = 'processing',
                                message_kind = $7,
                                metadata = $8::jsonb,
                                updated_at = now()
                            WHERE id = $1
                            RETURNING *
                            """,
                            existing_record["id"],
                            channel,
                            external_chat_id,
                            external_thread_id,
                            external_message_id,
                            direction,
                            message_kind,
                            json.dumps(metadata or {}),
                        )
                        return _normalize_external_webhook_receipt_row(dict(updated)), True

                    inserted = await conn.fetchrow(
                        """
                        INSERT INTO assistant_external_webhook_receipts
                          (
                            id,
                            channel,
                            external_chat_id,
                            external_thread_id,
                            external_message_id,
                            external_event_id,
                            direction,
                            delivery_status,
                            message_kind,
                            metadata
                          )
                        VALUES (
                          $1, $2, $3, $4, $5, NULL, $6, 'processing', $7, $8::jsonb
                        )
                        RETURNING *
                        """,
                        receipt_id,
                        channel,
                        external_chat_id,
                        external_thread_id,
                        external_message_id,
                        direction,
                        message_kind,
                        json.dumps(metadata or {}),
                    )
                    return _normalize_external_webhook_receipt_row(dict(inserted)), True

                inserted = await conn.fetchrow(
                    """
                    INSERT INTO assistant_external_webhook_receipts
                      (
                        id,
                        channel,
                        external_chat_id,
                        external_thread_id,
                        external_message_id,
                        external_event_id,
                        direction,
                        delivery_status,
                        message_kind,
                        metadata
                      )
                    VALUES (
                      $1, $2, $3, $4, $5, $6, $7, 'processing', $8, $9::jsonb
                    )
                    ON CONFLICT (channel, external_event_id) DO NOTHING
                    RETURNING *
                    """,
                    receipt_id,
                    channel,
                    external_chat_id,
                    external_thread_id,
                    external_message_id,
                    external_event_id,
                    direction,
                    message_kind,
                    json.dumps(metadata or {}),
                )
                if inserted:
                    return _normalize_external_webhook_receipt_row(dict(inserted)), True

                existing = await conn.fetchrow(
                    """
                    SELECT *
                    FROM assistant_external_webhook_receipts
                    WHERE channel = $1
                      AND external_event_id = $2
                    FOR UPDATE
                    """,
                    channel,
                    external_event_id,
                )
                if not existing:
                    raise ValueError("EXTERNAL_WEBHOOK_RECEIPT_NOT_FOUND")
                existing_record = _normalize_external_webhook_receipt_row(dict(existing))
                if existing_record.get("delivery_status") != "failed":
                    return existing_record, False

                updated = await conn.fetchrow(
                    """
                    UPDATE assistant_external_webhook_receipts
                    SET channel = $2,
                        external_chat_id = $3,
                        external_thread_id = $4,
                        external_message_id = $5,
                        external_event_id = $6,
                        direction = $7,
                        delivery_status = 'processing',
                        message_kind = $8,
                        metadata = $9::jsonb,
                        updated_at = now()
                    WHERE id = $1
                    RETURNING *
                    """,
                    existing_record["id"],
                    channel,
                    external_chat_id,
                    external_thread_id,
                    external_message_id,
                    external_event_id,
                    direction,
                    message_kind,
                    json.dumps(metadata or {}),
                )
        return _normalize_external_webhook_receipt_row(dict(updated)), True

    async def update_external_webhook_receipt(
        self,
        *,
        external_webhook_receipt_id: UUID,
        delivery_status: str | object = _UNSET,
        message_kind: str | object = _UNSET,
        metadata: dict[str, Any] | None | object = _UNSET,
    ) -> dict[str, Any]:
        async with self.pool.acquire() as conn:
            existing = await conn.fetchrow(
                """
                SELECT *
                FROM assistant_external_webhook_receipts
                WHERE id = $1
                """,
                external_webhook_receipt_id,
            )
            if not existing:
                raise ValueError("EXTERNAL_WEBHOOK_RECEIPT_NOT_FOUND")
            merged = _normalize_external_webhook_receipt_row(dict(existing))
            if delivery_status is not _UNSET:
                merged["delivery_status"] = delivery_status
            if message_kind is not _UNSET:
                merged["message_kind"] = message_kind
            if metadata is not _UNSET:
                merged["metadata"] = metadata or {}
            updated = await conn.fetchrow(
                """
                UPDATE assistant_external_webhook_receipts
                SET delivery_status = $2,
                    message_kind = $3,
                    metadata = $4::jsonb,
                    updated_at = now()
                WHERE id = $1
                RETURNING *
                """,
                external_webhook_receipt_id,
                merged.get("delivery_status"),
                merged.get("message_kind"),
                json.dumps(merged.get("metadata") or {}),
            )
        return _normalize_external_webhook_receipt_row(dict(updated))

    async def reserve_external_handoff_message(
        self,
        *,
        handoff_id: UUID,
        session_id: UUID,
        channel: str,
        external_chat_id: str,
        external_thread_id: str | None,
        external_message_id: str | None,
        external_event_id: str | None,
        direction: str,
        message_kind: str = "external_update",
        operator_external_user_id: str | None = None,
        operator_username: str | None = None,
        content: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> tuple[dict[str, Any], bool]:
        message_id = uuid4()
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                if external_event_id is None:
                    existing = await conn.fetchrow(
                        """
                        SELECT *
                        FROM assistant_handoff_messages
                        WHERE channel = $1
                          AND external_chat_id = $2
                          AND external_thread_id IS NOT DISTINCT FROM $3
                          AND external_message_id = $4
                          AND direction = $5
                        FOR UPDATE
                        """,
                        channel,
                        external_chat_id,
                        external_thread_id,
                        external_message_id,
                        direction,
                    )
                    if existing:
                        existing_record = _normalize_handoff_message_row(dict(existing))
                        if existing_record.get("delivery_status") != "failed":
                            return existing_record, False
                        updated = await conn.fetchrow(
                            """
                            UPDATE assistant_handoff_messages
                            SET handoff_id = $2,
                                session_id = $3,
                                channel = $4,
                                external_chat_id = $5,
                                external_thread_id = $6,
                                external_message_id = $7,
                                direction = $8,
                                delivery_status = 'processing',
                                message_kind = $9,
                                operator_external_user_id = $10,
                                operator_username = $11,
                                content = COALESCE($12, assistant_handoff_messages.content),
                                metadata = $13::jsonb
                            WHERE id = $1
                            RETURNING *
                            """,
                            existing_record["id"],
                            handoff_id,
                            session_id,
                            channel,
                            external_chat_id,
                            external_thread_id,
                            external_message_id,
                            direction,
                            message_kind,
                            operator_external_user_id,
                            operator_username,
                            content,
                            json.dumps(metadata or {}),
                        )
                        return _normalize_handoff_message_row(dict(updated)), True

                    inserted = await conn.fetchrow(
                        """
                        INSERT INTO assistant_handoff_messages
                          (
                            id,
                            handoff_id,
                            session_id,
                            channel,
                            external_chat_id,
                            external_thread_id,
                            external_message_id,
                            external_event_id,
                            direction,
                            delivery_status,
                            message_kind,
                            operator_external_user_id,
                            operator_username,
                            content,
                            metadata
                          )
                        VALUES (
                          $1, $2, $3, $4, $5, $6, $7, NULL, $8, 'processing',
                          $9, $10, $11, $12, $13::jsonb
                        )
                        RETURNING *
                        """,
                        message_id,
                        handoff_id,
                        session_id,
                        channel,
                        external_chat_id,
                        external_thread_id,
                        external_message_id,
                        direction,
                        message_kind,
                        operator_external_user_id,
                        operator_username,
                        content,
                        json.dumps(metadata or {}),
                    )
                    return _normalize_handoff_message_row(dict(inserted)), True

                inserted = await conn.fetchrow(
                    """
                    INSERT INTO assistant_handoff_messages
                      (
                        id,
                        handoff_id,
                        session_id,
                        channel,
                        external_chat_id,
                        external_thread_id,
                        external_message_id,
                        external_event_id,
                        direction,
                        delivery_status,
                        message_kind,
                        operator_external_user_id,
                        operator_username,
                        content,
                        metadata
                      )
                    VALUES (
                      $1, $2, $3, $4, $5, $6, $7, $8, $9, 'processing',
                      $10, $11, $12, $13, $14::jsonb
                    )
                    ON CONFLICT (channel, external_event_id) DO NOTHING
                    RETURNING *
                    """,
                    message_id,
                    handoff_id,
                    session_id,
                    channel,
                    external_chat_id,
                    external_thread_id,
                    external_message_id,
                    external_event_id,
                    direction,
                    message_kind,
                    operator_external_user_id,
                    operator_username,
                    content,
                    json.dumps(metadata or {}),
                )
                if inserted:
                    return _normalize_handoff_message_row(dict(inserted)), True

                existing = await conn.fetchrow(
                    """
                    SELECT *
                    FROM assistant_handoff_messages
                    WHERE channel = $1
                      AND external_event_id = $2
                    FOR UPDATE
                    """,
                    channel,
                    external_event_id,
                )
                if not existing:
                    raise ValueError("HANDOFF_MESSAGE_NOT_FOUND")
                existing_record = _normalize_handoff_message_row(dict(existing))
                if existing_record.get("delivery_status") != "failed":
                    return existing_record, False

                updated = await conn.fetchrow(
                    """
                    UPDATE assistant_handoff_messages
                    SET handoff_id = $2,
                        session_id = $3,
                        channel = $4,
                        external_chat_id = $5,
                        external_thread_id = $6,
                        external_message_id = $7,
                        direction = $8,
                        delivery_status = 'processing',
                        message_kind = $9,
                        operator_external_user_id = $10,
                        operator_username = $11,
                        content = COALESCE($12, assistant_handoff_messages.content),
                        metadata = $13::jsonb
                    WHERE id = $1
                    RETURNING *
                    """,
                    existing_record["id"],
                    handoff_id,
                    session_id,
                    channel,
                    external_chat_id,
                    external_thread_id,
                    external_message_id,
                    direction,
                    message_kind,
                    operator_external_user_id,
                    operator_username,
                    content,
                    json.dumps(metadata or {}),
                )
        return _normalize_handoff_message_row(dict(updated)), True

    async def create_external_handoff_message(
        self,
        *,
        handoff_id: UUID,
        session_id: UUID,
        channel: str,
        external_chat_id: str,
        external_thread_id: str | None,
        external_message_id: str | None,
        external_event_id: str | None,
        direction: str,
        delivery_status: str,
        message_kind: str = "external_update",
        assistant_message_id: UUID | None = None,
        operator_external_user_id: str | None = None,
        operator_username: str | None = None,
        content: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        message_id = uuid4()
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO assistant_handoff_messages
                  (
                    id,
                    handoff_id,
                    session_id,
                    channel,
                    external_chat_id,
                    external_thread_id,
                    external_message_id,
                    external_event_id,
                    direction,
                    delivery_status,
                    message_kind,
                    assistant_message_id,
                    operator_external_user_id,
                    operator_username,
                    content,
                    metadata
                  )
                VALUES (
                  $1, $2, $3, $4, $5, $6, $7, $8, $9,
                  $10, $11, $12, $13, $14, $15, $16::jsonb
                )
                RETURNING *
                """,
                message_id,
                handoff_id,
                session_id,
                channel,
                external_chat_id,
                external_thread_id,
                external_message_id,
                external_event_id,
                direction,
                delivery_status,
                message_kind,
                assistant_message_id,
                operator_external_user_id,
                operator_username,
                content,
                json.dumps(metadata or {}),
            )
        return _normalize_handoff_message_row(dict(row))

    async def reserve_handoff_message(
        self,
        *,
        handoff_id: UUID,
        session_id: UUID,
        telegram_chat_id: str,
        telegram_topic_id: int | None,
        telegram_message_id: int | None,
        telegram_update_id: int | None,
        direction: str,
        message_kind: str = "telegram_update",
        operator_telegram_user_id: str | None = None,
        operator_username: str | None = None,
        content: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> tuple[dict[str, Any], bool]:
        message_id = uuid4()
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                if telegram_update_id is None:
                    row = await conn.fetchrow(
                        """
                        INSERT INTO assistant_handoff_messages
                          (
                            id,
                            handoff_id,
                            session_id,
                            telegram_chat_id,
                            telegram_topic_id,
                            telegram_message_id,
                            telegram_update_id,
                            direction,
                            delivery_status,
                            message_kind,
                            operator_telegram_user_id,
                            operator_username,
                            content,
                            metadata
                          )
                        VALUES (
                          $1, $2, $3, $4, $5, $6, $7, $8, 'processing',
                          $9, $10, $11, $12, $13::jsonb
                        )
                        RETURNING *
                        """,
                        message_id,
                        handoff_id,
                        session_id,
                        telegram_chat_id,
                        telegram_topic_id,
                        telegram_message_id,
                        telegram_update_id,
                        direction,
                        message_kind,
                        operator_telegram_user_id,
                        operator_username,
                        content,
                        json.dumps(metadata or {}),
                    )
                    return _normalize_handoff_message_row(dict(row)), True

                inserted = await conn.fetchrow(
                    """
                    INSERT INTO assistant_handoff_messages
                      (
                        id,
                        handoff_id,
                        session_id,
                        telegram_chat_id,
                        telegram_topic_id,
                        telegram_message_id,
                        telegram_update_id,
                        direction,
                        delivery_status,
                        message_kind,
                        operator_telegram_user_id,
                        operator_username,
                        content,
                        metadata
                      )
                    VALUES (
                      $1, $2, $3, $4, $5, $6, $7, $8, 'processing',
                      $9, $10, $11, $12, $13::jsonb
                    )
                    ON CONFLICT (telegram_update_id) DO NOTHING
                    RETURNING *
                    """,
                    message_id,
                    handoff_id,
                    session_id,
                    telegram_chat_id,
                    telegram_topic_id,
                    telegram_message_id,
                    telegram_update_id,
                    direction,
                    message_kind,
                    operator_telegram_user_id,
                    operator_username,
                    content,
                    json.dumps(metadata or {}),
                )
                if inserted:
                    return _normalize_handoff_message_row(dict(inserted)), True

                existing = await conn.fetchrow(
                    """
                    SELECT *
                    FROM assistant_handoff_messages
                    WHERE telegram_update_id = $1
                    FOR UPDATE
                    """,
                    telegram_update_id,
                )
                if not existing:
                    raise ValueError("HANDOFF_MESSAGE_NOT_FOUND")
                existing_record = _normalize_handoff_message_row(dict(existing))
                if existing_record.get("delivery_status") != "failed":
                    return existing_record, False

                updated = await conn.fetchrow(
                    """
                    UPDATE assistant_handoff_messages
                    SET handoff_id = $2,
                        session_id = $3,
                        telegram_chat_id = $4,
                        telegram_topic_id = $5,
                        telegram_message_id = $6,
                        direction = $7,
                        delivery_status = 'processing',
                        message_kind = $8,
                        operator_telegram_user_id = $9,
                        operator_username = $10,
                        content = COALESCE($11, assistant_handoff_messages.content),
                        metadata = $12::jsonb
                    WHERE id = $1
                    RETURNING *
                    """,
                    existing_record["id"],
                    handoff_id,
                    session_id,
                    telegram_chat_id,
                    telegram_topic_id,
                    telegram_message_id,
                    direction,
                    message_kind,
                    operator_telegram_user_id,
                    operator_username,
                    content,
                    json.dumps(metadata or {}),
                )
        return _normalize_handoff_message_row(dict(updated)), True

    async def create_handoff_message(
        self,
        *,
        handoff_id: UUID,
        session_id: UUID,
        telegram_chat_id: str,
        telegram_topic_id: int | None,
        telegram_message_id: int | None,
        telegram_update_id: int | None,
        direction: str,
        delivery_status: str,
        message_kind: str = "telegram_update",
        assistant_message_id: UUID | None = None,
        operator_telegram_user_id: str | None = None,
        operator_username: str | None = None,
        content: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        message_id = uuid4()
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO assistant_handoff_messages
                  (
                    id,
                    handoff_id,
                    session_id,
                    telegram_chat_id,
                    telegram_topic_id,
                    telegram_message_id,
                    telegram_update_id,
                    direction,
                    delivery_status,
                    message_kind,
                    assistant_message_id,
                    operator_telegram_user_id,
                    operator_username,
                    content,
                    metadata
                  )
                VALUES (
                  $1, $2, $3, $4, $5, $6, $7, $8, $9,
                  $10, $11, $12, $13, $14, $15::jsonb
                )
                RETURNING *
                """,
                message_id,
                handoff_id,
                session_id,
                telegram_chat_id,
                telegram_topic_id,
                telegram_message_id,
                telegram_update_id,
                direction,
                delivery_status,
                message_kind,
                assistant_message_id,
                operator_telegram_user_id,
                operator_username,
                content,
                json.dumps(metadata or {}),
            )
        return _normalize_handoff_message_row(dict(row))

    async def update_handoff_message(
        self,
        *,
        handoff_message_id: UUID,
        delivery_status: str | object = _UNSET,
        message_kind: str | object = _UNSET,
        assistant_message_id: UUID | None | object = _UNSET,
        content: str | None | object = _UNSET,
        metadata: dict[str, Any] | None | object = _UNSET,
    ) -> dict[str, Any]:
        sets: list[str] = []
        args: list[Any] = [handoff_message_id]
        arg_index = 2

        if delivery_status is not _UNSET:
            sets.append(f"delivery_status = ${arg_index}")
            args.append(delivery_status)
            arg_index += 1
        if message_kind is not _UNSET:
            sets.append(f"message_kind = ${arg_index}")
            args.append(message_kind)
            arg_index += 1
        if assistant_message_id is not _UNSET:
            sets.append(f"assistant_message_id = ${arg_index}")
            args.append(assistant_message_id)
            arg_index += 1
        if content is not _UNSET:
            sets.append(f"content = ${arg_index}")
            args.append(content)
            arg_index += 1
        if metadata is not _UNSET:
            sets.append(f"metadata = ${arg_index}::jsonb")
            args.append(json.dumps(metadata or {}))
            arg_index += 1

        async with self.pool.acquire() as conn:
            if not sets:
                row = await conn.fetchrow(
                    """
                    SELECT *
                    FROM assistant_handoff_messages
                    WHERE id = $1
                    """,
                    handoff_message_id,
                )
            else:
                row = await conn.fetchrow(
                    f"""
                    UPDATE assistant_handoff_messages
                    SET {", ".join(sets)}
                    WHERE id = $1
                    RETURNING *
                    """,
                    *args,
                )
        if not row:
            raise ValueError("HANDOFF_MESSAGE_NOT_FOUND")
        return _normalize_handoff_message_row(dict(row))

    async def get_principal_state(self, principal_id: str) -> dict[str, Any] | None:
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM assistant_principal_state WHERE principal_id = $1",
                principal_id,
            )
        return _normalize_principal_state_row(dict(row)) if row else None

    async def upsert_principal_state(self, state: dict[str, Any]) -> dict[str, Any]:
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO assistant_principal_state
                  (principal_id, principal_kind, store_id, tenant_id, customer_id,
                   off_topic_count, prompt_injection_count, blocked_until, block_reason,
                   last_seen_at, metadata, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13)
                ON CONFLICT (principal_id) DO UPDATE SET
                  principal_kind = EXCLUDED.principal_kind,
                  store_id = EXCLUDED.store_id,
                  tenant_id = EXCLUDED.tenant_id,
                  customer_id = EXCLUDED.customer_id,
                  off_topic_count = EXCLUDED.off_topic_count,
                  prompt_injection_count = EXCLUDED.prompt_injection_count,
                  blocked_until = EXCLUDED.blocked_until,
                  block_reason = EXCLUDED.block_reason,
                  last_seen_at = EXCLUDED.last_seen_at,
                  metadata = EXCLUDED.metadata,
                  updated_at = EXCLUDED.updated_at
                RETURNING *
                """,
                state.get("principal_id"),
                state.get("principal_kind"),
                state.get("store_id"),
                state.get("tenant_id"),
                state.get("customer_id"),
                int(state.get("off_topic_count") or 0),
                int(state.get("prompt_injection_count") or 0),
                state.get("blocked_until"),
                state.get("block_reason"),
                state.get("last_seen_at"),
                json.dumps(state.get("metadata") or {}),
                state.get("created_at"),
                state.get("updated_at"),
            )
        return _normalize_principal_state_row(dict(row))

    async def enqueue_reindex_intent(
        self,
        *,
        store_id: str,
        locale: str,
        event_name: str,
        action: str = "reindex",
        scope: str = "products",
        product_ids: list[str] | None = None,
        reason: str | None = None,
        coalescing_key: str | None = None,
        tenant_id: str | None = None,
        event_id: str | None = None,
        max_attempts: int = 3,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        intent_id = uuid4()
        product_ids = list(dict.fromkeys([item for item in (product_ids or []) if item]))
        key = coalescing_key or ("assistant:catalog:all-products" if scope == "all_products" else f"assistant:product:{','.join(product_ids)}")
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO assistant_reindex_intents
                  (id, store_id, tenant_id, locale, event_name, event_id, action, scope,
                   product_ids, reason, coalescing_key, max_attempts, metadata)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13::jsonb)
                ON CONFLICT (coalescing_key) WHERE status = 'pending' DO UPDATE SET
                  event_name = EXCLUDED.event_name,
                  event_id = COALESCE(EXCLUDED.event_id, assistant_reindex_intents.event_id),
                  action = EXCLUDED.action,
                  scope = EXCLUDED.scope,
                  product_ids = COALESCE(
                    (
                      SELECT jsonb_agg(DISTINCT value)
                      FROM jsonb_array_elements_text(
                        assistant_reindex_intents.product_ids || EXCLUDED.product_ids
                      ) AS value
                    ),
                    '[]'::jsonb
                  ),
                  reason = COALESCE(EXCLUDED.reason, assistant_reindex_intents.reason),
                  metadata = assistant_reindex_intents.metadata || EXCLUDED.metadata,
                  updated_at = now()
                RETURNING *
                """,
                intent_id,
                store_id,
                tenant_id,
                locale,
                event_name,
                event_id,
                action,
                scope,
                json.dumps(product_ids),
                reason,
                key,
                max_attempts,
                json.dumps(metadata or {}),
            )
        return _normalize_reindex_intent_row(dict(row))

    async def list_reindex_intents(self, *, status: str | None = None, limit: int = 50) -> list[dict[str, Any]]:
        filters = []
        args: list[Any] = []
        if status:
            args.append(status)
            filters.append(f"status = ${len(args)}")
        args.append(limit)
        where = f"WHERE {' AND '.join(filters)}" if filters else ""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                f"""
                SELECT * FROM assistant_reindex_intents
                {where}
                ORDER BY created_at DESC
                LIMIT ${len(args)}
                """,
                *args,
            )
        return [_normalize_reindex_intent_row(dict(row)) for row in rows]

    async def claim_reindex_intents(self, *, limit: int = 10) -> list[dict[str, Any]]:
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                """
                UPDATE assistant_reindex_intents
                SET status = 'processing',
                    attempts = attempts + 1,
                    started_at = now(),
                    updated_at = now()
                WHERE id IN (
                  SELECT id FROM assistant_reindex_intents
                  WHERE status = 'pending' AND next_attempt_at <= now()
                  ORDER BY created_at ASC
                  LIMIT $1
                  FOR UPDATE SKIP LOCKED
                )
                RETURNING *
                """,
                limit,
            )
        return [_normalize_reindex_intent_row(dict(row)) for row in rows]

    async def complete_reindex_intent(
        self,
        *,
        intent_id: UUID,
        status: str,
        result: dict[str, Any] | None = None,
        error: str | None = None,
        assistant_job_id: UUID | None = None,
        retry_backoff_seconds: int = 60,
    ) -> dict[str, Any]:
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                UPDATE assistant_reindex_intents
                SET status = CASE
                      WHEN $2 = 'error' AND attempts < max_attempts THEN 'pending'
                      ELSE $2
                    END,
                    next_attempt_at = CASE
                      WHEN $2 = 'error' AND attempts < max_attempts THEN now() + ($6 * INTERVAL '1 second')
                      ELSE next_attempt_at
                    END,
                    finished_at = CASE
                      WHEN $2 = 'error' AND attempts < max_attempts THEN NULL
                      ELSE now()
                    END,
                    last_error = $4,
                    assistant_job_id = COALESCE($5, assistant_job_id),
                    metadata = metadata || $3::jsonb,
                    updated_at = now()
                WHERE id = $1
                RETURNING *
                """,
                intent_id,
                status,
                json.dumps({"result": result} if result is not None else {}),
                error,
                assistant_job_id,
                retry_backoff_seconds,
            )
        return _normalize_reindex_intent_row(dict(row))

    async def reindex_intent_stats(self) -> dict[str, int]:
        async with self.pool.acquire() as conn:
            rows = await conn.fetch("SELECT status, COUNT(*) AS count FROM assistant_reindex_intents GROUP BY status")
        counts = {row["status"]: int(row["count"]) for row in rows}
        return {
            "pending": counts.get("pending", 0),
            "processing": counts.get("processing", 0),
            "completed": counts.get("completed", 0),
            "error": counts.get("error", 0),
            "total": sum(counts.values()),
        }

    async def stats(self) -> dict[str, int]:
        reindex_stats = await self.reindex_intent_stats()
        async with self.pool.acquire() as conn:
            return {
                "document_count": await conn.fetchval("SELECT COUNT(*) FROM assistant_sources"),
                "chunk_count": await conn.fetchval("SELECT COUNT(*) FROM assistant_source_chunks"),
                "indexed_product_count": await conn.fetchval(
                    "SELECT COUNT(*) FROM assistant_sources WHERE source_type = 'medusa_product'"
                ),
                "session_count": await conn.fetchval("SELECT COUNT(*) FROM assistant_sessions"),
                "message_count": await conn.fetchval("SELECT COUNT(*) FROM assistant_messages"),
                "feedback_count": await conn.fetchval("SELECT COUNT(*) FROM assistant_feedback"),
                "handoff_count": await conn.fetchval("SELECT COUNT(*) FROM assistant_handoffs"),
                "failed_jobs": await conn.fetchval(
                    "SELECT COUNT(*) FROM assistant_ingestion_jobs WHERE status = 'error'"
                ),
                "reindex_intents_pending": reindex_stats["pending"],
                "reindex_intents_error": reindex_stats["error"],
            }


def _normalize_message_row(row: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(row)
    for field in ("citations", "products", "actions", "tool_calls"):
        normalized[field] = _json_field_or_default(normalized.get(field), [])
    normalized["token_usage"] = _json_field_or_default(normalized.get("token_usage"), {})
    normalized["metadata"] = _json_field_or_default(normalized.get("metadata"), {})
    return normalized


def _normalize_source_row(row: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(row)
    normalized["metadata"] = _json_field_or_default(normalized.get("metadata"), {})
    return normalized


def _normalize_handoff_row(row: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(row)
    normalized["metadata"] = _json_field_or_default(normalized.get("metadata"), {})
    return normalized


def _normalize_handoff_ticket_row(row: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(row)
    if normalized.get("external_chat_id") is None and normalized.get("telegram_chat_id") is not None:
        normalized["external_chat_id"] = str(normalized["telegram_chat_id"])
    if normalized.get("external_thread_id") is None and normalized.get("telegram_topic_id") is not None:
        normalized["external_thread_id"] = str(normalized["telegram_topic_id"])
    if (
        normalized.get("external_thread_title") is None
        and normalized.get("telegram_topic_title") is not None
    ):
        normalized["external_thread_title"] = normalized["telegram_topic_title"]
    if (
        normalized.get("external_root_message_id") is None
        and normalized.get("telegram_root_message_id") is not None
    ):
        normalized["external_root_message_id"] = str(normalized["telegram_root_message_id"])
    if (
        normalized.get("last_external_event_id") is None
        and normalized.get("last_telegram_update_id") is not None
    ):
        normalized["last_external_event_id"] = str(normalized["last_telegram_update_id"])
    return normalized


def _normalize_handoff_message_row(row: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(row)
    normalized["metadata"] = _json_field_or_default(normalized.get("metadata"), {})
    normalized["channel"] = str(normalized.get("channel") or "telegram")
    if normalized.get("external_chat_id") is None and normalized.get("telegram_chat_id") is not None:
        normalized["external_chat_id"] = str(normalized["telegram_chat_id"])
    if normalized.get("external_thread_id") is None and normalized.get("telegram_topic_id") is not None:
        normalized["external_thread_id"] = str(normalized["telegram_topic_id"])
    if normalized.get("external_message_id") is None and normalized.get("telegram_message_id") is not None:
        normalized["external_message_id"] = str(normalized["telegram_message_id"])
    if normalized.get("external_event_id") is None and normalized.get("telegram_update_id") is not None:
        normalized["external_event_id"] = str(normalized["telegram_update_id"])
    if (
        normalized.get("operator_external_user_id") is None
        and normalized.get("operator_telegram_user_id") is not None
    ):
        normalized["operator_external_user_id"] = normalized["operator_telegram_user_id"]
    return normalized


def _normalize_external_webhook_receipt_row(row: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(row)
    normalized["metadata"] = _json_field_or_default(normalized.get("metadata"), {})
    normalized["channel"] = str(normalized.get("channel") or "telegram")
    return normalized


def _normalize_session_row(row: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(row)
    normalized["metadata"] = _json_field_or_default(normalized.get("metadata"), {})
    normalized["customer_context"] = _json_field_or_default(normalized.get("customer_context"), {})
    return normalized


def _normalize_chunk_row(row: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(row)
    normalized["metadata"] = _json_field_or_default(normalized.get("metadata"), {})
    source = _json_field_or_default(normalized.get("source"), {})
    normalized["source"] = _normalize_source_row(source) if source else {}
    return normalized


def _normalize_ingestion_job_row(row: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(row)
    normalized["input"] = _json_field_or_default(normalized.get("input"), {})
    normalized["result"] = _json_field_or_default(normalized.get("result"), {})
    return normalized


def _normalize_reindex_intent_row(row: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(row)
    normalized["product_ids"] = _json_field_or_default(normalized.get("product_ids"), [])
    normalized["metadata"] = _json_field_or_default(normalized.get("metadata"), {})
    return normalized


def _normalize_principal_state_row(row: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(row)
    normalized["metadata"] = _json_field_or_default(normalized.get("metadata"), {})
    return normalized


def _json_field_or_default(value: Any, default: list[Any] | dict[str, Any]) -> Any:
    fallback = [] if isinstance(default, list) else {}

    if value is None:
        return fallback

    if isinstance(value, type(fallback)):
        return value

    if isinstance(value, str):
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError:
            return fallback
        return parsed if isinstance(parsed, type(fallback)) else fallback

    return fallback
