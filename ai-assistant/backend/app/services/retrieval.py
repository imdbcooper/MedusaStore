from __future__ import annotations

from typing import Any

from app.schemas.chat import Citation
from app.services.vector import VectorBackendUnavailable


class SimpleMarkdownRetriever:
    """Keyword retriever for Markdown mode."""

    def __init__(self, *, repository):
        self.repository = repository

    async def search(
        self,
        *,
        query: str,
        store_id: str,
        locale: str,
        limit: int = 5,
        tenant_id: str | None = None,
        filters: dict[str, Any] | None = None,
    ) -> tuple[list[dict], list[Citation]]:
        chunks = await self.repository.search_chunks(
            store_id=store_id,
            locale=locale,
            query=query,
            limit=limit,
        )
        filters = {**(filters or {}), "tenant_id": tenant_id}
        chunks = apply_payload_filters(chunks, filters)
        return chunks, citations_from_chunks(chunks)

    async def product_cards(
        self,
        *,
        store_id: str,
        locale: str,
        chunks: list[dict],
        limit: int = 3,
        tenant_id: str | None = None,
    ) -> list[dict]:
        seen: set[str] = set()
        cards: list[dict] = []
        for chunk in chunks:
            source = chunk.get("source", {})
            if source.get("source_type") != "medusa_product":
                continue
            metadata = source.get("metadata") or chunk.get("metadata") or {}
            if tenant_id and metadata.get("tenant_id") != tenant_id and source.get("tenant_id") != tenant_id:
                continue
            product_id = source.get("source_id") or metadata.get("product_id")
            if not product_id or product_id in seen:
                continue
            seen.add(product_id)
            cards.append(product_card_from_metadata(metadata, source, chunk))
            if len(cards) >= limit:
                return cards

        if len(cards) < limit and hasattr(self.repository, "list_sources"):
            sources = await self.repository.list_sources(
                store_id=store_id,
                locale=locale,
                source_type="medusa_product",
                tenant_id=tenant_id,
            )
            for source in sources:
                metadata = source.get("metadata") or {}
                if tenant_id and metadata.get("tenant_id") != tenant_id and source.get("tenant_id") != tenant_id:
                    continue
                product_id = source.get("source_id") or metadata.get("product_id")
                if not product_id or product_id in seen:
                    continue
                seen.add(product_id)
                cards.append(product_card_from_metadata(metadata, source, None))
                if len(cards) >= limit:
                    break
        return cards


class QdrantVectorRetriever:
    def __init__(self, *, qdrant_adapter, embedding_provider):
        self.qdrant_adapter = qdrant_adapter
        self.embedding_provider = embedding_provider

    async def search(
        self,
        *,
        query: str,
        store_id: str,
        locale: str,
        limit: int = 5,
        tenant_id: str | None = None,
        filters: dict[str, Any] | None = None,
    ) -> tuple[list[dict], list[Citation]]:
        if not self.qdrant_adapter or not self.embedding_provider:
            raise VectorBackendUnavailable("Vector retriever is not configured")
        filters = filters or {}
        query_vector = (await self.embedding_provider.embed_texts([query]))[0]
        chunks = await self.qdrant_adapter.search(
            query_vector=query_vector,
            store_id=store_id,
            locale=locale,
            limit=limit,
            tenant_id=tenant_id,
            source_type=filters.get("source_type"),
            product_id=filters.get("product_id"),
            category=filters.get("category"),
            brand=filters.get("brand"),
        )
        return chunks, citations_from_chunks(chunks)

    async def product_cards(
        self,
        *,
        store_id: str,
        locale: str,
        chunks: list[dict],
        limit: int = 3,
        tenant_id: str | None = None,
    ) -> list[dict]:
        cards: list[dict] = []
        seen: set[str] = set()
        for chunk in chunks:
            source = chunk.get("source", {})
            metadata = source.get("metadata") or chunk.get("metadata") or {}
            if (source.get("source_type") or metadata.get("source_type")) != "medusa_product":
                continue
            if tenant_id and metadata.get("tenant_id") != tenant_id and source.get("tenant_id") != tenant_id:
                continue
            product_id = metadata.get("product_id") or source.get("source_id")
            if not product_id or product_id in seen:
                continue
            seen.add(product_id)
            cards.append(product_card_from_metadata(metadata, source, chunk))
            if len(cards) >= limit:
                break
        return cards


class ModeAwareRetriever:
    """Routes retrieval between Markdown, Qdrant vector and safe fallbacks."""

    def __init__(self, *, markdown_retriever, vector_retriever=None, settings=None):
        self.markdown_retriever = markdown_retriever
        self.vector_retriever = vector_retriever
        self.settings = settings
        self.last_mode = "markdown"
        self.last_fallback_reason: str | None = None

    async def search(
        self,
        *,
        query: str,
        store_id: str,
        locale: str,
        limit: int = 5,
        mode: str | None = None,
        tenant_id: str | None = None,
        filters: dict[str, Any] | None = None,
    ) -> tuple[list[dict], list[Citation]]:
        requested = normalize_retrieval_mode(mode or getattr(self.settings, "retrieval_mode", "markdown"))
        self.last_fallback_reason = None
        if requested == "lightrag":
            self.last_mode = "markdown"
            self.last_fallback_reason = "LightRAG mode is disabled/not configured; using markdown retrieval."
            return await self.markdown_retriever.search(
                query=query, store_id=store_id, locale=locale, limit=limit, tenant_id=tenant_id, filters=filters
            )
        if requested in {"vector", "auto"}:
            try:
                if not self.vector_retriever:
                    raise VectorBackendUnavailable("Vector retriever is not configured")
                result = await self.vector_retriever.search(
                    query=query,
                    store_id=store_id,
                    locale=locale,
                    limit=limit,
                    tenant_id=tenant_id,
                    filters=filters,
                )
                self.last_mode = "vector"
                return result
            except Exception as exc:
                if requested == "vector":
                    self.last_mode = "vector"
                    self.last_fallback_reason = str(exc)
                    raise VectorBackendUnavailable(str(exc)) from exc
                self.last_mode = "markdown"
                self.last_fallback_reason = f"Vector retrieval unavailable; fallback to markdown: {exc}"
                return await self.markdown_retriever.search(
                    query=query, store_id=store_id, locale=locale, limit=limit, tenant_id=tenant_id, filters=filters
                )
        self.last_mode = "markdown"
        return await self.markdown_retriever.search(
            query=query, store_id=store_id, locale=locale, limit=limit, tenant_id=tenant_id, filters=filters
        )

    async def product_cards(
        self,
        *,
        store_id: str,
        locale: str,
        chunks: list[dict],
        limit: int = 3,
        tenant_id: str | None = None,
    ) -> list[dict]:
        if self.last_mode == "vector" and self.vector_retriever:
            cards = await self.vector_retriever.product_cards(
                store_id=store_id,
                locale=locale,
                chunks=chunks,
                limit=limit,
                tenant_id=tenant_id,
            )
            if cards:
                return cards
        return await self.markdown_retriever.product_cards(
            store_id=store_id,
            locale=locale,
            chunks=chunks,
            limit=limit,
            tenant_id=tenant_id,
        )


def normalize_retrieval_mode(mode: str | None) -> str:
    value = (mode or "auto").lower().strip()
    if value not in {"markdown", "vector", "auto", "lightrag"}:
        return "auto"
    return value


def citations_from_chunks(chunks: list[dict]) -> list[Citation]:
    citations: list[Citation] = []
    for chunk in chunks:
        source = chunk.get("source", {})
        citations.append(
            Citation(
                source_type=source.get("source_type") or chunk.get("source_type") or "markdown",
                source_id=source.get("source_id") or chunk.get("source_id") or "unknown",
                title=source.get("title") or chunk.get("title") or "Knowledge source",
                url=source.get("uri") or chunk.get("path"),
                chunk_id=str(chunk.get("id")),
            )
        )
    return citations


def apply_payload_filters(chunks: list[dict], filters: dict[str, Any]) -> list[dict]:
    if not filters:
        return chunks
    return [chunk for chunk in chunks if chunk_matches_filters(chunk, filters)]


def chunk_matches_filters(chunk: dict[str, Any], filters: dict[str, Any]) -> bool:
    source = chunk.get("source") or {}
    metadata = source.get("metadata") or chunk.get("metadata") or {}
    merged = {**metadata, **source}
    for key in ("source_type", "product_id", "brand"):
        if filters.get(key) and merged.get(key) != filters[key]:
            return False
    if filters.get("tenant_id") and merged.get("tenant_id") != filters["tenant_id"]:
        return False
    category = filters.get("category")
    if category:
        categories = set(ensure_list(merged.get("category_handles"))) | set(ensure_list(merged.get("category_ids")))
        categories.add(str(merged.get("category")))
        if category not in categories:
            return False
    return True


def ensure_list(value: Any) -> list[Any]:
    if isinstance(value, list):
        return value
    if value in (None, ""):
        return []
    return [value]


def product_card_from_metadata(metadata: dict, source: dict, chunk: dict | None) -> dict:
    reason = None
    if chunk:
        title = source.get("title") or metadata.get("title") or "товар"
        reason = f"Подходит по найденному описанию из карточки «{title}»."
    return {
        "id": str(metadata.get("product_id") or source.get("source_id")),
        "handle": metadata.get("handle"),
        "title": metadata.get("title") or source.get("title") or "Product",
        "thumbnail": metadata.get("thumbnail"),
        "price": None,
        "availability": "unknown",
        "reason": reason or "Индексированный товар из каталога Medusa; цена и наличие требуют live-проверки.",
    }
