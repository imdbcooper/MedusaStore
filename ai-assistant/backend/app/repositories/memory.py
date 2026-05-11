from collections import defaultdict
from copy import deepcopy
from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4


class InMemoryAssistantRepository:
    """Test/dev repository with the same semantics as the PostgreSQL repository."""

    def __init__(self) -> None:
        self.sessions: dict[UUID, dict[str, Any]] = {}
        self.messages: dict[UUID, dict[str, Any]] = {}
        self.session_messages: dict[UUID, list[UUID]] = defaultdict(list)
        self.sources: dict[tuple[str, str, str, str], dict[str, Any]] = {}
        self.source_chunks: dict[UUID, list[dict[str, Any]]] = defaultdict(list)
        self.jobs: dict[UUID, dict[str, Any]] = {}
        self.feedback: dict[UUID, dict[str, Any]] = {}

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
                "created_at": now,
                "updated_at": now,
            }
        else:
            self.sessions[actual_id]["updated_at"] = now
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
    ) -> list[dict[str, Any]]:
        query_terms = {term.lower() for term in query.split() if len(term) > 2}
        matches: list[tuple[int, dict[str, Any]]] = []
        for source in self.sources.values():
            if source["store_id"] != store_id or source["locale"] != locale:
                continue
            for chunk in self.source_chunks[source["id"]]:
                content = chunk["content"].lower()
                score = sum(1 for term in query_terms if term in content)
                if score > 0 or not query_terms:
                    enriched = deepcopy(chunk)
                    enriched["source"] = deepcopy(source)
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

    async def stats(self) -> dict[str, int]:
        return {
            "document_count": len(self.sources),
            "chunk_count": sum(len(chunks) for chunks in self.source_chunks.values()),
            "indexed_product_count": sum(
                1 for source in self.sources.values() if source["source_type"] == "medusa_product"
            ),
            "session_count": len(self.sessions),
            "message_count": len(self.messages),
            "feedback_count": len(self.feedback),
            "failed_jobs": sum(1 for job in self.jobs.values() if job["status"] == "error"),
        }
