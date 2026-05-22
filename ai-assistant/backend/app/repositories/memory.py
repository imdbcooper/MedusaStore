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
