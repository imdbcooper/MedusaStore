from collections import defaultdict
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID, uuid4

SEARCH_NORMALIZATION_REPLACEMENTS = {
    "доставку": "доставка",
    "доставки": "доставка",
    "доставке": "доставка",
    "оплате": "оплата",
    "оплаты": "оплата",
}

_UNSET = object()


class InMemoryAssistantRepository:
    """Test/dev repository with the same semantics as the PostgreSQL repository."""

    def __init__(self) -> None:
        self.sessions: dict[UUID, dict[str, Any]] = {}
        self.messages: dict[UUID, dict[str, Any]] = {}
        self.session_messages: dict[UUID, list[UUID]] = defaultdict(list)
        self.sources: dict[tuple[str, str, str, str], dict[str, Any]] = {}
        self.source_chunks: dict[UUID, list[dict[str, Any]]] = defaultdict(list)
        self.jobs: dict[UUID, dict[str, Any]] = {}
        self.reindex_intents: dict[UUID, dict[str, Any]] = {}
        self.feedback: dict[UUID, dict[str, Any]] = {}
        self.handoffs: dict[UUID, dict[str, Any]] = {}
        self.handoff_tickets: dict[tuple[UUID, str], dict[str, Any]] = {}
        self.handoff_messages: dict[UUID, dict[str, Any]] = {}
        self.handoff_messages_by_update: dict[int, UUID] = {}
        self.handoff_messages_by_message: dict[tuple[str, int | None, int, str], UUID] = {}
        self.handoff_messages_by_external_event: dict[tuple[str, str], UUID] = {}
        self.handoff_messages_by_external_message: dict[
            tuple[str, str, str | None, str, str],
            UUID,
        ] = {}
        self.external_webhook_receipts: dict[UUID, dict[str, Any]] = {}
        self.external_webhook_receipts_by_event: dict[tuple[str, str], UUID] = {}
        self.external_webhook_receipts_by_message: dict[
            tuple[str, str, str | None, str, str],
            UUID,
        ] = {}
        self.principal_states: dict[str, dict[str, Any]] = {}

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
        now = datetime.now(timezone.utc)
        actual_id = session_id or uuid4()
        if actual_id not in self.sessions:
            self.sessions[actual_id] = {
                "id": actual_id,
                "store_id": store_id,
                "customer_id": customer_id,
                "cart_id": cart_id,
                "locale": locale,
                "region_id": region_id,
                "tenant_id": (metadata or {}).get("tenant_id"),
                "channel": "storefront",
                "status": "active",
                "metadata": metadata or {},
                "customer_context": {},
                "bound_at": None,
                "created_at": now,
                "updated_at": now,
            }
        else:
            existing = self.sessions[actual_id]
            if existing.get("store_id") != store_id or existing.get("locale") != locale or existing.get("tenant_id") != (metadata or {}).get("tenant_id"):
                raise ValueError("SESSION_SCOPE_MISMATCH")
            existing["updated_at"] = now
        return deepcopy(self.sessions[actual_id])

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
        record = {
            "id": message_id,
            "session_id": session_id,
            "role": role,
            "content": content,
            "intent": intent,
            "citations": citations or [],
            "products": products or [],
            "actions": actions or [],
            "tool_calls": tool_calls or [],
            "token_usage": token_usage or {},
            "metadata": metadata or {},
            "latency_ms": latency_ms,
            "created_at": datetime.now(timezone.utc),
        }
        self.messages[message_id] = record
        self.session_messages[session_id].append(message_id)
        return deepcopy(record)

    async def list_messages(self, session_id: UUID, *, limit: int | None = None) -> list[dict[str, Any]]:
        ids = self.session_messages.get(session_id, [])
        if limit is not None:
            ids = ids[-limit:]
        return [deepcopy(self.messages[message_id]) for message_id in ids]

    async def get_session(self, session_id: UUID) -> dict[str, Any] | None:
        session = self.sessions.get(session_id)
        return deepcopy(session) if session else None

    async def update_session_customer_context(
        self,
        *,
        session_id: UUID,
        customer_context: dict[str, Any],
    ) -> dict[str, Any]:
        session = self.sessions.get(session_id)
        if not session:
            raise ValueError("SESSION_NOT_FOUND")
        session["customer_context"] = deepcopy(customer_context or {})
        session["updated_at"] = datetime.now(timezone.utc)
        return deepcopy(session)

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
        session = self.sessions.get(session_id)
        if not session:
            raise ValueError("SESSION_NOT_FOUND")
        if session.get("store_id") != store_id or session.get("locale") != locale or session.get("tenant_id") != tenant_id:
            raise ValueError("SESSION_SCOPE_MISMATCH")
        existing_customer_id = session.get("customer_id")
        if existing_customer_id and existing_customer_id != customer_id:
            raise ValueError("SESSION_ALREADY_BOUND_TO_DIFFERENT_CUSTOMER")
        now = datetime.now(timezone.utc)
        session["customer_id"] = customer_id
        session["customer_context"] = customer_context or {}
        session["bound_at"] = session.get("bound_at") or now
        session["updated_at"] = now
        return deepcopy(session)

    async def get_message(self, message_id: UUID) -> dict[str, Any] | None:
        message = self.messages.get(message_id)
        return deepcopy(message) if message else None

    async def message_belongs_to_session(self, *, message_id: UUID, session_id: UUID) -> bool:
        message = self.messages.get(message_id)
        return bool(message and message.get("session_id") == session_id)

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
        record = {
            "id": job_id,
            "store_id": store_id,
            "job_type": job_type,
            "status": "indexing",
            "source_type": source_type,
            "source_id": source_id,
            "input": input_payload,
            "result": {},
            "error": None,
            "started_at": datetime.now(timezone.utc),
            "finished_at": None,
            "created_at": datetime.now(timezone.utc),
        }
        self.jobs[job_id] = record
        return deepcopy(record)

    async def complete_ingestion_job(
        self,
        *,
        job_id: UUID,
        result: dict[str, Any],
        error: str | None = None,
    ) -> dict[str, Any]:
        record = self.jobs[job_id]
        record["status"] = "error" if error else "completed"
        record["result"] = result
        record["error"] = error
        record["finished_at"] = datetime.now(timezone.utc)
        return deepcopy(record)

    async def get_ingestion_job(self, job_id: UUID) -> dict[str, Any] | None:
        record = self.jobs.get(job_id)
        return deepcopy(record) if record else None

    async def delete_source(
        self,
        *,
        store_id: str,
        locale: str,
        source_type: str,
        source_id: str,
    ) -> bool:
        key = (store_id, source_type, source_id, locale)
        source = self.sources.pop(key, None)
        if not source:
            return False
        self.source_chunks.pop(source["id"], None)
        return True

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
        key = (store_id, source_type, source_id, locale)
        source_uuid = self.sources.get(key, {}).get("id", uuid4())
        source = {
            "id": source_uuid,
            "store_id": store_id,
            "locale": locale,
            "source_type": source_type,
            "source_id": source_id,
            "title": title,
            "uri": uri,
            "content_hash": content_hash,
            "metadata": metadata,
            "indexed_at": datetime.now(timezone.utc),
        }
        self.sources[key] = source
        self.source_chunks[source_uuid] = [deepcopy(chunk) for chunk in chunks]
        return deepcopy(source)

    async def search_chunks(
        self,
        *,
        store_id: str,
        locale: str,
        query: str,
        limit: int = 5,
        source_type: str | None = None,
    ) -> list[dict[str, Any]]:
        normalized_query = normalize_search_text(query)
        query_terms = set(normalize_search_terms(normalized_query))
        query_stems = {stem for term in query_terms if len(stem := term[:5]) >= 4}
        matches: list[tuple[int, dict[str, Any]]] = []
        for source in self.sources.values():
            if source["store_id"] != store_id or source["locale"] != locale:
                continue
            if source_type and source["source_type"] != source_type:
                continue
            for chunk in self.source_chunks[source["id"]]:
                content = normalize_search_text(chunk["content"])
                content_terms = set(normalize_search_terms(content))
                content_stems = {stem for term in content_terms if len(stem := term[:5]) >= 4}
                score = sum(1 for term in query_terms if term in content)
                score += sum(1 for stem in query_stems if stem in content_stems)
                if score > 0 or not query_terms:
                    enriched = deepcopy(chunk)
                    enriched["source"] = deepcopy(source)
                    enriched["score"] = score
                    matches.append((score, enriched))
        matches.sort(key=lambda item: item[0], reverse=True)
        return [match for _, match in matches[:limit]]

    async def list_sources(
        self,
        *,
        store_id: str,
        locale: str,
        source_type: str | None = None,
        tenant_id: str | None = None,
    ) -> list[dict[str, Any]]:
        sources = []
        for source in self.sources.values():
            if source["store_id"] != store_id or source["locale"] != locale:
                continue
            if source_type and source["source_type"] != source_type:
                continue
            metadata = source.get("metadata") or {}
            if tenant_id and metadata.get("tenant_id") != tenant_id and source.get("tenant_id") != tenant_id:
                continue
            sources.append(deepcopy(source))
        sources.sort(key=lambda item: item.get("indexed_at") or item.get("created_at"), reverse=True)
        return sources

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
        source = self.sources.get((store_id, source_type, source_id, locale))
        if not source:
            return []
        chunks = self.source_chunks.get(source["id"], [])
        selected = chunks[offset:] if limit is None else chunks[offset : offset + limit]
        enriched = []
        for chunk in selected:
            item = deepcopy(chunk)
            item["source"] = deepcopy(source)
            enriched.append(item)
        return enriched

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
        record = {
            "id": feedback_id,
            "session_id": session_id,
            "message_id": message_id,
            "store_id": store_id,
            "tenant_id": tenant_id,
            "locale": locale,
            "rating": rating,
            "label": label,
            "comment": comment,
            "metadata": metadata or {},
            "created_at": datetime.now(timezone.utc),
        }
        self.feedback[feedback_id] = record
        return deepcopy(record)

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
        session = self.sessions.get(session_id) or {}
        record = {
            "id": handoff_id,
            "session_id": session_id,
            "message_id": message_id,
            "customer_id": session.get("customer_id"),
            "store_id": store_id,
            "tenant_id": tenant_id,
            "locale": locale,
            "status": "submitted",
            "source": source,
            "name": name,
            "email": email,
            "phone": phone,
            "summary": summary,
            "reason": reason,
            "note": note,
            "metadata": metadata or {},
            "created_at": datetime.now(timezone.utc),
        }
        self.handoffs[handoff_id] = record
        return deepcopy(record)

    async def get_handoff(self, handoff_id: UUID) -> dict[str, Any] | None:
        record = self.handoffs.get(handoff_id)
        return deepcopy(record) if record else None

    async def get_handoff_ticket(
        self,
        *,
        handoff_id: UUID,
        channel: str = "telegram",
    ) -> dict[str, Any] | None:
        record = self.handoff_tickets.get((handoff_id, channel))
        return _normalize_handoff_ticket_record(record) if record else None

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
        now = datetime.now(timezone.utc)
        key = (handoff_id, channel)
        existing = self.handoff_tickets.get(key)
        existing_status = (existing or {}).get("ticket_status")
        existing_has_open_link = bool(
            (
                (existing or {}).get("telegram_topic_id") is not None
                and (existing or {}).get("telegram_root_message_id") is not None
            )
            or (
                (existing or {}).get("external_thread_id") is not None
                and (existing or {}).get("external_root_message_id") is not None
            )
        )
        effective_status = ticket_status
        if existing_status == "open" and existing_has_open_link and ticket_status != "open":
            effective_status = "open"
        elif existing_status == "failed" and ticket_status == "submitted":
            effective_status = "failed"
        resolved_external_chat_id = (
            external_chat_id
            if external_chat_id is not None
            else str(telegram_chat_id)
            if telegram_chat_id is not None
            else (existing or {}).get("external_chat_id")
        )
        resolved_external_thread_id = (
            external_thread_id
            if external_thread_id is not None
            else str(telegram_topic_id)
            if telegram_topic_id is not None
            else (existing or {}).get("external_thread_id")
        )
        resolved_external_thread_title = (
            external_thread_title
            if external_thread_title is not None
            else telegram_topic_title
            if telegram_topic_title is not None
            else (existing or {}).get("external_thread_title")
        )
        resolved_external_root_message_id = (
            external_root_message_id
            if external_root_message_id is not None
            else str(telegram_root_message_id)
            if telegram_root_message_id is not None
            else (existing or {}).get("external_root_message_id")
        )
        resolved_last_external_event_id = (
            last_external_event_id
            if last_external_event_id is not None
            else str(last_telegram_update_id)
            if last_telegram_update_id is not None
            else (existing or {}).get("last_external_event_id")
        )
        record = {
            "handoff_id": handoff_id,
            "channel": channel,
            "ticket_status": effective_status,
            "telegram_chat_id": telegram_chat_id
            if telegram_chat_id is not None
            else (existing or {}).get("telegram_chat_id"),
            "telegram_topic_id": telegram_topic_id
            if telegram_topic_id is not None
            else (existing or {}).get("telegram_topic_id"),
            "telegram_topic_title": telegram_topic_title
            if telegram_topic_title is not None
            else (existing or {}).get("telegram_topic_title"),
            "telegram_root_message_id": telegram_root_message_id
            if telegram_root_message_id is not None
            else (existing or {}).get("telegram_root_message_id"),
            "external_chat_id": resolved_external_chat_id,
            "external_thread_id": resolved_external_thread_id,
            "external_thread_title": resolved_external_thread_title,
            "external_root_message_id": resolved_external_root_message_id,
            "assigned_operator_id": assigned_operator_id
            if assigned_operator_id is not None
            else (existing or {}).get("assigned_operator_id"),
            "assigned_operator_username": assigned_operator_username
            if assigned_operator_username is not None
            else (existing or {}).get("assigned_operator_username"),
            "assigned_at": assigned_at
            if assigned_at is not None
            else (existing or {}).get("assigned_at"),
            "closed_at": closed_at
            if closed_at is not None
            else (existing or {}).get("closed_at"),
            "last_operator_message_at": last_operator_message_at
            if last_operator_message_at is not None
            else (existing or {}).get("last_operator_message_at"),
            "last_customer_message_at": last_customer_message_at
            if last_customer_message_at is not None
            else (existing or {}).get("last_customer_message_at"),
            "last_telegram_update_id": last_telegram_update_id
            if last_telegram_update_id is not None
            else (existing or {}).get("last_telegram_update_id"),
            "last_external_event_id": resolved_last_external_event_id,
            "failure_reason": (
                None
                if effective_status == "open"
                else failure_reason
                if failure_reason is not None
                else (existing or {}).get("failure_reason")
            ),
            "created_at": created_at or (existing or {}).get("created_at") or now,
            "opened_at": (existing or {}).get("opened_at") or opened_at,
            "last_sync_at": last_sync_at
            if last_sync_at is not None
            else (existing or {}).get("last_sync_at")
            or now,
            "updated_at": now,
        }
        self.handoff_tickets[key] = record
        return _normalize_handoff_ticket_record(record)

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
        key = (handoff_id, channel)
        record = self.handoff_tickets.get(key)
        if not record:
            raise ValueError("HANDOFF_TICKET_NOT_FOUND")
        updated = dict(record)
        if ticket_status is not _UNSET:
            updated["ticket_status"] = ticket_status
        if external_chat_id is not _UNSET:
            updated["external_chat_id"] = external_chat_id
        if external_thread_id is not _UNSET:
            updated["external_thread_id"] = external_thread_id
        if external_thread_title is not _UNSET:
            updated["external_thread_title"] = external_thread_title
        if external_root_message_id is not _UNSET:
            updated["external_root_message_id"] = external_root_message_id
        if assigned_operator_id is not _UNSET:
            updated["assigned_operator_id"] = assigned_operator_id
        if assigned_operator_username is not _UNSET:
            updated["assigned_operator_username"] = assigned_operator_username
        if assigned_at is not _UNSET:
            updated["assigned_at"] = assigned_at
        if closed_at is not _UNSET:
            updated["closed_at"] = closed_at
        if last_operator_message_at is not _UNSET:
            updated["last_operator_message_at"] = last_operator_message_at
        if last_customer_message_at is not _UNSET:
            updated["last_customer_message_at"] = last_customer_message_at
        if last_telegram_update_id is not _UNSET:
            updated["last_telegram_update_id"] = last_telegram_update_id
            updated["last_external_event_id"] = (
                str(last_telegram_update_id)
                if last_telegram_update_id is not None
                else None
            )
        if last_external_event_id is not _UNSET:
            updated["last_external_event_id"] = last_external_event_id
        if failure_reason is not _UNSET:
            updated["failure_reason"] = failure_reason
        if last_sync_at is not _UNSET:
            updated["last_sync_at"] = last_sync_at
        updated["updated_at"] = datetime.now(timezone.utc)
        self.handoff_tickets[key] = updated
        return _normalize_handoff_ticket_record(updated)

    async def find_handoff_ticket_by_telegram_thread(
        self,
        *,
        telegram_chat_id: str,
        telegram_topic_id: int,
        channel: str = "telegram",
    ) -> dict[str, Any] | None:
        matches: list[dict[str, Any]] = []
        for (ticket_handoff_id, ticket_channel), ticket in self.handoff_tickets.items():
            if ticket_channel != channel:
                continue
            if ticket.get("telegram_chat_id") != telegram_chat_id:
                continue
            if ticket.get("telegram_topic_id") != telegram_topic_id:
                continue
            matches.append(
                {
                    **ticket,
                    "session_id": (self.handoffs.get(ticket_handoff_id) or {}).get("session_id"),
                }
            )
        if not matches:
            return None
        matches.sort(
            key=lambda item: item.get("updated_at")
            or item.get("last_sync_at")
            or item.get("created_at"),
            reverse=True,
        )
        return _normalize_handoff_ticket_record(matches[0])

    async def find_handoff_ticket_by_external_thread(
        self,
        *,
        external_chat_id: str,
        external_thread_id: str,
        channel: str,
    ) -> dict[str, Any] | None:
        matches: list[dict[str, Any]] = []
        for (ticket_handoff_id, ticket_channel), ticket in self.handoff_tickets.items():
            if ticket_channel != channel:
                continue
            normalized = _normalize_handoff_ticket_record(ticket)
            if normalized.get("external_chat_id") != external_chat_id:
                continue
            if normalized.get("external_thread_id") != external_thread_id:
                continue
            matches.append(
                {
                    **normalized,
                    "session_id": (self.handoffs.get(ticket_handoff_id) or {}).get("session_id"),
                }
            )
        if not matches:
            return None
        matches.sort(
            key=lambda item: item.get("updated_at")
            or item.get("last_sync_at")
            or item.get("created_at"),
            reverse=True,
        )
        return _normalize_handoff_ticket_record(matches[0])

    async def get_latest_handoff_ticket_for_session(
        self,
        *,
        session_id: UUID,
        channel: str = "telegram",
    ) -> dict[str, Any] | None:
        matches: list[dict[str, Any]] = []
        for (ticket_handoff_id, ticket_channel), ticket in self.handoff_tickets.items():
            if ticket_channel != channel:
                continue
            handoff = self.handoffs.get(ticket_handoff_id)
            if not handoff or handoff.get("session_id") != session_id:
                continue
            matches.append({**ticket, "session_id": session_id})
        if not matches:
            return None
        matches.sort(
            key=lambda item: item.get("last_sync_at")
            or item.get("updated_at")
            or item.get("created_at"),
            reverse=True,
        )
        return _normalize_handoff_ticket_record(matches[0])

    async def get_handoff_message_by_update_id(
        self,
        *,
        telegram_update_id: int,
    ) -> dict[str, Any] | None:
        record_id = self.handoff_messages_by_update.get(telegram_update_id)
        if not record_id:
            return None
        return _normalize_handoff_message_record(self.handoff_messages.get(record_id))

    async def get_handoff_message_by_message(
        self,
        *,
        telegram_chat_id: str,
        telegram_topic_id: int,
        telegram_message_id: int,
        direction: str,
    ) -> dict[str, Any] | None:
        key = (telegram_chat_id, telegram_topic_id, telegram_message_id, direction)
        record_id = self.handoff_messages_by_message.get(key)
        if not record_id:
            return None
        return _normalize_handoff_message_record(self.handoff_messages.get(record_id))

    async def get_handoff_message_by_external_event_id(
        self,
        *,
        channel: str,
        external_event_id: str,
    ) -> dict[str, Any] | None:
        record_id = self.handoff_messages_by_external_event.get((channel, external_event_id))
        if not record_id:
            return None
        return _normalize_handoff_message_record(self.handoff_messages.get(record_id))

    async def get_handoff_message_by_external_message(
        self,
        *,
        channel: str,
        external_chat_id: str,
        external_thread_id: str | None,
        external_message_id: str,
        direction: str,
    ) -> dict[str, Any] | None:
        key = (
            channel,
            external_chat_id,
            external_thread_id,
            external_message_id,
            direction,
        )
        record_id = self.handoff_messages_by_external_message.get(key)
        if not record_id:
            return None
        return _normalize_handoff_message_record(self.handoff_messages.get(record_id))

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
        if external_event_id is not None:
            record_id = self.external_webhook_receipts_by_event.get(
                (channel, external_event_id)
            )
            if record_id:
                existing = self.external_webhook_receipts.get(record_id)
                if existing is None:
                    raise ValueError("EXTERNAL_WEBHOOK_RECEIPT_NOT_FOUND")
                if existing.get("delivery_status") != "failed":
                    return _normalize_external_webhook_receipt_record(existing), False
                existing.update(
                    {
                        "channel": channel,
                        "external_chat_id": external_chat_id,
                        "external_thread_id": external_thread_id,
                        "external_message_id": external_message_id,
                        "external_event_id": external_event_id,
                        "direction": direction,
                        "delivery_status": "processing",
                        "message_kind": message_kind,
                        "metadata": deepcopy(metadata or {}),
                        "updated_at": datetime.now(timezone.utc),
                    }
                )
                if external_message_id is not None:
                    key = (
                        channel,
                        external_chat_id,
                        external_thread_id,
                        external_message_id,
                        direction,
                    )
                    self.external_webhook_receipts_by_message[key] = record_id
                return _normalize_external_webhook_receipt_record(existing), True

        if external_message_id is not None:
            key = (
                channel,
                external_chat_id,
                external_thread_id,
                external_message_id,
                direction,
            )
            record_id = self.external_webhook_receipts_by_message.get(key)
            if record_id:
                existing = self.external_webhook_receipts.get(record_id)
                if existing is None:
                    raise ValueError("EXTERNAL_WEBHOOK_RECEIPT_NOT_FOUND")
                if existing.get("delivery_status") != "failed":
                    return _normalize_external_webhook_receipt_record(existing), False
                existing.update(
                    {
                        "channel": channel,
                        "external_chat_id": external_chat_id,
                        "external_thread_id": external_thread_id,
                        "external_message_id": external_message_id,
                        "external_event_id": external_event_id,
                        "direction": direction,
                        "delivery_status": "processing",
                        "message_kind": message_kind,
                        "metadata": deepcopy(metadata or {}),
                        "updated_at": datetime.now(timezone.utc),
                    }
                )
                if external_event_id is not None:
                    self.external_webhook_receipts_by_event[(channel, external_event_id)] = (
                        record_id
                    )
                return _normalize_external_webhook_receipt_record(existing), True

        now = datetime.now(timezone.utc)
        record_id = uuid4()
        record = {
            "id": record_id,
            "channel": channel,
            "external_chat_id": external_chat_id,
            "external_thread_id": external_thread_id,
            "external_message_id": external_message_id,
            "external_event_id": external_event_id,
            "direction": direction,
            "delivery_status": "processing",
            "message_kind": message_kind,
            "metadata": deepcopy(metadata or {}),
            "created_at": now,
            "updated_at": now,
        }
        self.external_webhook_receipts[record_id] = record
        if external_event_id is not None:
            self.external_webhook_receipts_by_event[(channel, external_event_id)] = record_id
        if external_message_id is not None:
            key = (
                channel,
                external_chat_id,
                external_thread_id,
                external_message_id,
                direction,
            )
            self.external_webhook_receipts_by_message[key] = record_id
        return _normalize_external_webhook_receipt_record(record), True

    async def update_external_webhook_receipt(
        self,
        *,
        external_webhook_receipt_id: UUID,
        delivery_status: str | object = _UNSET,
        message_kind: str | object = _UNSET,
        metadata: dict[str, Any] | None | object = _UNSET,
    ) -> dict[str, Any]:
        record = self.external_webhook_receipts.get(external_webhook_receipt_id)
        if record is None:
            raise ValueError("EXTERNAL_WEBHOOK_RECEIPT_NOT_FOUND")
        if delivery_status is not _UNSET:
            record["delivery_status"] = delivery_status
        if message_kind is not _UNSET:
            record["message_kind"] = message_kind
        if metadata is not _UNSET:
            record["metadata"] = deepcopy(metadata or {})
        record["updated_at"] = datetime.now(timezone.utc)
        return _normalize_external_webhook_receipt_record(record)

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
        if telegram_update_id is not None:
            record_id = self.handoff_messages_by_update.get(telegram_update_id)
            if record_id:
                existing = self.handoff_messages.get(record_id)
                if existing is None:
                    raise ValueError("HANDOFF_MESSAGE_NOT_FOUND")
                if existing.get("delivery_status") != "failed":
                    return _normalize_handoff_message_record(existing), False
                existing.update(
                    {
                        "handoff_id": handoff_id,
                        "session_id": session_id,
                        "channel": "telegram",
                        "telegram_chat_id": telegram_chat_id,
                        "telegram_topic_id": telegram_topic_id,
                        "telegram_message_id": telegram_message_id,
                        "direction": direction,
                        "delivery_status": "processing",
                        "message_kind": message_kind,
                        "operator_telegram_user_id": operator_telegram_user_id,
                        "operator_external_user_id": operator_telegram_user_id,
                        "operator_username": operator_username,
                        "content": content
                        if content is not None
                        else existing.get("content"),
                        "external_chat_id": telegram_chat_id,
                        "external_thread_id": (
                            str(telegram_topic_id)
                            if telegram_topic_id is not None
                            else None
                        ),
                        "external_message_id": (
                            str(telegram_message_id)
                            if telegram_message_id is not None
                            else None
                        ),
                        "external_event_id": (
                            str(telegram_update_id)
                            if telegram_update_id is not None
                            else None
                        ),
                        "metadata": deepcopy(metadata or {}),
                    }
                )
                if telegram_message_id is not None:
                    key = (
                        telegram_chat_id,
                        telegram_topic_id,
                        telegram_message_id,
                        direction,
                    )
                    self.handoff_messages_by_message[key] = record_id
                if telegram_update_id is not None:
                    self.handoff_messages_by_external_event[("telegram", str(telegram_update_id))] = record_id
                if telegram_message_id is not None:
                    external_key = (
                        "telegram",
                        telegram_chat_id,
                        str(telegram_topic_id) if telegram_topic_id is not None else None,
                        str(telegram_message_id),
                        direction,
                    )
                    self.handoff_messages_by_external_message[external_key] = record_id
                return _normalize_handoff_message_record(existing), True

        created = await self.create_handoff_message(
            handoff_id=handoff_id,
            session_id=session_id,
            telegram_chat_id=telegram_chat_id,
            telegram_topic_id=telegram_topic_id,
            telegram_message_id=telegram_message_id,
            telegram_update_id=telegram_update_id,
            direction=direction,
            delivery_status="processing",
            message_kind=message_kind,
            assistant_message_id=None,
            operator_telegram_user_id=operator_telegram_user_id,
            operator_username=operator_username,
            content=content,
            metadata=metadata,
        )
        return created, True

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
        if external_event_id is not None:
            record_id = self.handoff_messages_by_external_event.get(
                (channel, external_event_id)
            )
            if record_id:
                existing = self.handoff_messages.get(record_id)
                if existing is None:
                    raise ValueError("HANDOFF_MESSAGE_NOT_FOUND")
                if existing.get("delivery_status") != "failed":
                    return _normalize_handoff_message_record(existing), False
                existing.update(
                    {
                        "handoff_id": handoff_id,
                        "session_id": session_id,
                        "channel": channel,
                        "direction": direction,
                        "delivery_status": "processing",
                        "message_kind": message_kind,
                        "operator_external_user_id": operator_external_user_id,
                        "operator_username": operator_username,
                        "content": content
                        if content is not None
                        else existing.get("content"),
                        "external_chat_id": external_chat_id,
                        "external_thread_id": external_thread_id,
                        "external_message_id": external_message_id,
                        "external_event_id": external_event_id,
                        "metadata": deepcopy(metadata or {}),
                    }
                )
                if external_message_id is not None:
                    key = (
                        channel,
                        external_chat_id,
                        external_thread_id,
                        external_message_id,
                        direction,
                    )
                    self.handoff_messages_by_external_message[key] = record_id
                return _normalize_handoff_message_record(existing), True

        if external_message_id is not None:
            existing_by_message = await self.get_handoff_message_by_external_message(
                channel=channel,
                external_chat_id=external_chat_id,
                external_thread_id=external_thread_id,
                external_message_id=external_message_id,
                direction=direction,
            )
            if existing_by_message is not None:
                if existing_by_message.get("delivery_status") != "failed":
                    return existing_by_message, False
                record_id = existing_by_message["id"]
                existing = self.handoff_messages.get(record_id)
                if existing is None:
                    raise ValueError("HANDOFF_MESSAGE_NOT_FOUND")
                existing.update(
                    {
                        "handoff_id": handoff_id,
                        "session_id": session_id,
                        "channel": channel,
                        "direction": direction,
                        "delivery_status": "processing",
                        "message_kind": message_kind,
                        "operator_external_user_id": operator_external_user_id,
                        "operator_username": operator_username,
                        "content": content
                        if content is not None
                        else existing.get("content"),
                        "external_chat_id": external_chat_id,
                        "external_thread_id": external_thread_id,
                        "external_message_id": external_message_id,
                        "external_event_id": external_event_id,
                        "metadata": deepcopy(metadata or {}),
                    }
                )
                if external_event_id is not None:
                    self.handoff_messages_by_external_event[(channel, external_event_id)] = record_id
                return _normalize_handoff_message_record(existing), True

        created = await self.create_external_handoff_message(
            handoff_id=handoff_id,
            session_id=session_id,
            channel=channel,
            external_chat_id=external_chat_id,
            external_thread_id=external_thread_id,
            external_message_id=external_message_id,
            external_event_id=external_event_id,
            direction=direction,
            delivery_status="processing",
            message_kind=message_kind,
            assistant_message_id=None,
            operator_external_user_id=operator_external_user_id,
            operator_username=operator_username,
            content=content,
            metadata=metadata,
        )
        return created, True

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
        record_id = uuid4()
        record = {
            "id": record_id,
            "handoff_id": handoff_id,
            "session_id": session_id,
            "channel": "telegram",
            "telegram_chat_id": telegram_chat_id,
            "telegram_topic_id": telegram_topic_id,
            "telegram_message_id": telegram_message_id,
            "telegram_update_id": telegram_update_id,
            "external_chat_id": telegram_chat_id,
            "external_thread_id": (
                str(telegram_topic_id) if telegram_topic_id is not None else None
            ),
            "external_message_id": (
                str(telegram_message_id) if telegram_message_id is not None else None
            ),
            "external_event_id": (
                str(telegram_update_id) if telegram_update_id is not None else None
            ),
            "direction": direction,
            "delivery_status": delivery_status,
            "message_kind": message_kind,
            "assistant_message_id": assistant_message_id,
            "operator_telegram_user_id": operator_telegram_user_id,
            "operator_external_user_id": operator_telegram_user_id,
            "operator_username": operator_username,
            "content": content,
            "metadata": metadata or {},
            "created_at": datetime.now(timezone.utc),
        }
        self.handoff_messages[record_id] = record
        if telegram_update_id is not None:
            self.handoff_messages_by_update[telegram_update_id] = record_id
            self.handoff_messages_by_external_event[("telegram", str(telegram_update_id))] = record_id
        if telegram_message_id is not None:
            key = (telegram_chat_id, telegram_topic_id, telegram_message_id, direction)
            self.handoff_messages_by_message[key] = record_id
            external_key = (
                "telegram",
                telegram_chat_id,
                str(telegram_topic_id) if telegram_topic_id is not None else None,
                str(telegram_message_id),
                direction,
            )
            self.handoff_messages_by_external_message[external_key] = record_id
        return _normalize_handoff_message_record(record)

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
        record_id = uuid4()
        record = {
            "id": record_id,
            "handoff_id": handoff_id,
            "session_id": session_id,
            "channel": channel,
            "telegram_chat_id": None,
            "telegram_topic_id": None,
            "telegram_message_id": None,
            "telegram_update_id": None,
            "external_chat_id": external_chat_id,
            "external_thread_id": external_thread_id,
            "external_message_id": external_message_id,
            "external_event_id": external_event_id,
            "direction": direction,
            "delivery_status": delivery_status,
            "message_kind": message_kind,
            "assistant_message_id": assistant_message_id,
            "operator_telegram_user_id": None,
            "operator_external_user_id": operator_external_user_id,
            "operator_username": operator_username,
            "content": content,
            "metadata": metadata or {},
            "created_at": datetime.now(timezone.utc),
        }
        self.handoff_messages[record_id] = record
        if external_event_id is not None:
            self.handoff_messages_by_external_event[(channel, external_event_id)] = record_id
        if external_message_id is not None:
            key = (
                channel,
                external_chat_id,
                external_thread_id,
                external_message_id,
                direction,
            )
            self.handoff_messages_by_external_message[key] = record_id
        return _normalize_handoff_message_record(record)

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
        record = self.handoff_messages.get(handoff_message_id)
        if record is None:
            raise ValueError("HANDOFF_MESSAGE_NOT_FOUND")
        if delivery_status is not _UNSET:
            record["delivery_status"] = delivery_status
        if message_kind is not _UNSET:
            record["message_kind"] = message_kind
        if assistant_message_id is not _UNSET:
            record["assistant_message_id"] = assistant_message_id
        if content is not _UNSET:
            record["content"] = content
        if metadata is not _UNSET:
            record["metadata"] = deepcopy(metadata or {})
        return _normalize_handoff_message_record(record)

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
        product_ids = list(dict.fromkeys([item for item in (product_ids or []) if item]))
        key = coalescing_key or ("assistant:catalog:all-products" if scope == "all_products" else f"assistant:product:{','.join(product_ids)}")
        now = datetime.now(timezone.utc)
        for record in self.reindex_intents.values():
            if record.get("status") == "pending" and record.get("coalescing_key") == key:
                merged_product_ids = list(dict.fromkeys([*(record.get("product_ids") or []), *product_ids]))
                record.update(
                    {
                        "product_ids": merged_product_ids,
                        "event_name": event_name,
                        "event_id": event_id or record.get("event_id"),
                        "action": action,
                        "scope": scope,
                        "reason": reason or record.get("reason"),
                        "metadata": {**(record.get("metadata") or {}), **(metadata or {})},
                        "updated_at": now,
                    }
                )
                return deepcopy(record)
        intent_id = uuid4()
        record = {
            "id": intent_id,
            "store_id": store_id,
            "tenant_id": tenant_id,
            "locale": locale,
            "event_name": event_name,
            "event_id": event_id,
            "action": action,
            "scope": scope,
            "product_ids": product_ids,
            "reason": reason,
            "coalescing_key": key,
            "status": "pending",
            "attempts": 0,
            "max_attempts": max_attempts,
            "next_attempt_at": now,
            "last_error": None,
            "assistant_job_id": None,
            "metadata": metadata or {},
            "created_at": now,
            "updated_at": now,
            "started_at": None,
            "finished_at": None,
        }
        self.reindex_intents[intent_id] = record
        return deepcopy(record)

    async def list_reindex_intents(self, *, status: str | None = None, limit: int = 50) -> list[dict[str, Any]]:
        records = list(self.reindex_intents.values())
        if status:
            records = [record for record in records if record.get("status") == status]
        records.sort(key=lambda item: item.get("created_at"), reverse=True)
        return [deepcopy(record) for record in records[:limit]]

    async def claim_reindex_intents(self, *, limit: int = 10) -> list[dict[str, Any]]:
        now = datetime.now(timezone.utc)
        eligible = [
            record
            for record in self.reindex_intents.values()
            if record.get("status") == "pending" and (record.get("next_attempt_at") or now) <= now
        ]
        eligible.sort(key=lambda item: item.get("created_at"))
        claimed = []
        for record in eligible[:limit]:
            record["status"] = "processing"
            record["attempts"] = int(record.get("attempts") or 0) + 1
            record["started_at"] = now
            record["updated_at"] = now
            claimed.append(deepcopy(record))
        return claimed

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
        record = self.reindex_intents[intent_id]
        now = datetime.now(timezone.utc)
        if status == "error" and int(record.get("attempts") or 0) < int(record.get("max_attempts") or 3):
            record["status"] = "pending"
            record["next_attempt_at"] = now + timedelta(seconds=retry_backoff_seconds)
            record["finished_at"] = None
        else:
            record["status"] = status
            record["finished_at"] = now
        record["last_error"] = error
        record["assistant_job_id"] = assistant_job_id or record.get("assistant_job_id")
        record["metadata"] = {**(record.get("metadata") or {}), **({"result": result} if result is not None else {})}
        record["updated_at"] = now
        return deepcopy(record)

    async def reindex_intent_stats(self) -> dict[str, int]:
        return {
            "pending": sum(1 for item in self.reindex_intents.values() if item.get("status") == "pending"),
            "processing": sum(1 for item in self.reindex_intents.values() if item.get("status") == "processing"),
            "completed": sum(1 for item in self.reindex_intents.values() if item.get("status") == "completed"),
            "error": sum(1 for item in self.reindex_intents.values() if item.get("status") == "error"),
            "total": len(self.reindex_intents),
        }

    async def get_principal_state(self, principal_id: str) -> dict[str, Any] | None:
        record = self.principal_states.get(principal_id)
        return deepcopy(record) if record else None

    async def upsert_principal_state(self, state: dict[str, Any]) -> dict[str, Any]:
        record = deepcopy(state)
        self.principal_states[record["principal_id"]] = record
        return deepcopy(record)

    async def stats(self) -> dict[str, int]:
        reindex_stats = await self.reindex_intent_stats()
        return {
            "document_count": len(self.sources),
            "chunk_count": sum(len(chunks) for chunks in self.source_chunks.values()),
            "indexed_product_count": sum(
                1 for source in self.sources.values() if source["source_type"] == "medusa_product"
            ),
            "session_count": len(self.sessions),
            "message_count": len(self.messages),
            "feedback_count": len(self.feedback),
            "handoff_count": len(self.handoffs),
            "failed_jobs": sum(1 for job in self.jobs.values() if job["status"] == "error"),
            "reindex_intents_pending": reindex_stats["pending"],
            "reindex_intents_error": reindex_stats["error"],
        }


def normalize_search_text(value: str) -> str:
    normalized = value.lower()
    for source, target in SEARCH_NORMALIZATION_REPLACEMENTS.items():
        normalized = normalized.replace(source, target)
    return normalized


def normalize_search_terms(value: str) -> list[str]:
    terms = []
    for term in __import__("re").findall(r"[\wа-яА-ЯёЁ-]+", value):
        if len(term) <= 2:
            continue
        terms.append(term.lower())
        if term.endswith("а") and len(term) > 4:
            terms.append(term[:-1])
    return terms


def _normalize_handoff_ticket_record(record: dict[str, Any] | None) -> dict[str, Any] | None:
    if record is None:
        return None
    normalized = deepcopy(record)
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


def _normalize_handoff_message_record(record: dict[str, Any] | None) -> dict[str, Any] | None:
    if record is None:
        return None
    normalized = deepcopy(record)
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
    normalized["metadata"] = deepcopy(normalized.get("metadata") or {})
    return normalized


def _normalize_external_webhook_receipt_record(
    record: dict[str, Any] | None,
) -> dict[str, Any] | None:
    if record is None:
        return None
    normalized = deepcopy(record)
    normalized["channel"] = str(normalized.get("channel") or "telegram")
    normalized["metadata"] = deepcopy(normalized.get("metadata") or {})
    return normalized
