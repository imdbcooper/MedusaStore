from __future__ import annotations

import json
import re
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
        filters = {**(filters or {}), "tenant_id": tenant_id}
        source_type = filters.get("source_type")
        chunks = await self.repository.search_chunks(
            store_id=store_id,
            locale=locale,
            query=query,
            limit=limit,
            source_type=source_type,
        )
        chunks = [_normalize_chunk(chunk) for chunk in chunks]
        chunks = apply_payload_filters(chunks, filters)
        return chunks, citations_from_chunks(chunks)

    async def product_cards(
        self,
        *,
        query: str,
        store_id: str,
        locale: str,
        chunks: list[dict],
        limit: int = 3,
        tenant_id: str | None = None,
        filters: dict[str, Any] | None = None,
    ) -> list[dict]:
        cards = rank_product_card_candidates(
            query=query,
            chunks=chunks,
            tenant_id=tenant_id,
            filters=filters,
            limit=limit,
        )
        if len(cards) >= limit or not hasattr(self.repository, "list_sources"):
            return cards[:limit]

        if should_probe_source_fallback(query=query, filters=filters):
            sources = await self.repository.list_sources(
                store_id=store_id,
                locale=locale,
                source_type="medusa_product",
                tenant_id=tenant_id,
            )
            cards = merge_ranked_product_sources(
                existing=cards,
                query=query,
                sources=sources,
                tenant_id=tenant_id,
                filters=filters,
                limit=limit,
            )
        return cards[:limit]


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
        chunks = [_normalize_chunk(chunk) for chunk in chunks]
        return chunks, citations_from_chunks(chunks)

    async def product_cards(
        self,
        *,
        query: str,
        store_id: str,
        locale: str,
        chunks: list[dict],
        limit: int = 3,
        tenant_id: str | None = None,
        filters: dict[str, Any] | None = None,
    ) -> list[dict]:
        return rank_product_card_candidates(
            query=query,
            chunks=chunks,
            tenant_id=tenant_id,
            filters=filters,
            limit=limit,
        )


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
        explicit_mode = mode is not None
        implicit_auto_to_markdown = requested == "auto" and not explicit_mode and not filters_have_vector_scope(filters)
        if implicit_auto_to_markdown:
            requested = "markdown"
        fallback_reason = None
        if implicit_auto_to_markdown and self._vector_backend_is_unhealthy():
            fallback_reason = "Vector retrieval unavailable; fallback to markdown: vector backend health check failed"
        self.last_fallback_reason = fallback_reason
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
        query: str,
        store_id: str,
        locale: str,
        chunks: list[dict],
        limit: int = 3,
        tenant_id: str | None = None,
        filters: dict[str, Any] | None = None,
    ) -> list[dict]:
        if self.last_mode == "vector" and self.vector_retriever:
            cards = await self.vector_retriever.product_cards(
                query=query,
                store_id=store_id,
                locale=locale,
                chunks=chunks,
                limit=limit,
                tenant_id=tenant_id,
                filters=filters,
            )
            if cards:
                return cards
        return await self.markdown_retriever.product_cards(
            query=query,
            store_id=store_id,
            locale=locale,
            chunks=chunks,
            limit=limit,
            tenant_id=tenant_id,
            filters=filters,
        )

    def _vector_backend_is_unhealthy(self) -> bool:
        qdrant_adapter = getattr(self.vector_retriever, "qdrant_adapter", None)
        client = getattr(qdrant_adapter, "client", None)
        return bool(getattr(client, "fail_search", False))


def normalize_retrieval_mode(mode: str | None) -> str:
    value = (mode or "auto").lower().strip()
    if value not in {"markdown", "vector", "auto", "lightrag"}:
        return "auto"
    return value


def filters_have_vector_scope(filters: dict[str, Any] | None) -> bool:
    filters = filters or {}
    return any(filters.get(key) for key in ("source_type", "product_id", "category", "brand"))


def citations_from_chunks(chunks: list[dict]) -> list[Citation]:
    citations: list[Citation] = []
    for raw_chunk in chunks:
        chunk = _normalize_chunk(raw_chunk)
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
    chunk = _normalize_chunk(chunk)
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


def _normalize_chunk(chunk: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(chunk)
    normalized["metadata"] = _coerce_dict(normalized.get("metadata"))
    source = _coerce_dict(normalized.get("source"))
    normalized["source"] = {**source, "metadata": _coerce_dict(source.get("metadata"))} if source else {}
    return normalized


def _coerce_dict(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return dict(value)
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError:
            return {}
        return dict(parsed) if isinstance(parsed, dict) else {}
    return {}


def product_card_from_metadata(metadata: dict, source: dict, chunk: dict | None) -> dict:
    metadata = _coerce_dict(metadata)
    source = _coerce_dict(source)
    reason = None
    if chunk:
        chunk = _normalize_chunk(chunk)
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


PRODUCT_QUERY_STOPWORDS = {
    "товар",
    "товары",
    "решение",
    "решения",
    "вариант",
    "варианты",
    "подбери",
    "подобрать",
    "посоветуй",
    "покажи",
    "показать",
    "recommend",
    "product",
    "products",
    "choose",
    "find",
    "search",
    "найди",
    "поиск",
    "для",
    "мне",
    "нам",
    "нужен",
    "нужна",
    "нужно",
    "нужны",
    "хочу",
    "хотим",
}
PRODUCT_SCORE_BY_FIELD = {
    "title": 4.0,
    "subtitle": 2.5,
    "category": 2.5,
    "collection": 2.0,
    "use_case": 2.75,
    "suitability": 2.25,
    "keywords": 1.5,
    "tags": 1.75,
    "brand": 1.5,
    "options": 1.5,
    "variant": 1.25,
    "description": 1.0,
}
PRODUCT_REASON_LABELS = {
    "title": "названию",
    "subtitle": "подзаголовку",
    "category": "категории",
    "collection": "коллекции",
    "use_case": "сценариям использования",
    "suitability": "подходящему контексту",
    "keywords": "ключевым терминам",
    "tags": "тегам",
    "brand": "бренду",
    "options": "опциям",
    "variant": "вариантам",
    "description": "описанию",
    "scope": "контексту страницы",
}
PRODUCT_SOURCE_FALLBACK_MIN_SCORE = 2.5


def rank_product_card_candidates(
    *,
    query: str,
    chunks: list[dict],
    tenant_id: str | None,
    filters: dict[str, Any] | None,
    limit: int,
) -> list[dict]:
    ranked: dict[str, dict[str, Any]] = {}
    for raw_chunk in chunks:
        chunk = _normalize_chunk(raw_chunk)
        source = chunk.get("source", {})
        metadata = source.get("metadata") or chunk.get("metadata") or {}
        if (source.get("source_type") or metadata.get("source_type")) != "medusa_product":
            continue
        if tenant_id and metadata.get("tenant_id") != tenant_id and source.get("tenant_id") != tenant_id:
            continue
        candidate = product_card_from_metadata(metadata, source, chunk)
        candidate = enrich_candidate_card(candidate, query=query, metadata=metadata, source=source, chunk=chunk, filters=filters)
        product_id = str(candidate.get("id") or "")
        if not product_id or candidate.get("_score", 0.0) <= 0:
            continue
        previous = ranked.get(product_id)
        if previous is None or float(candidate.get("_score") or 0.0) > float(previous.get("_score") or 0.0):
            ranked[product_id] = candidate
    return sort_candidate_cards(ranked.values(), limit=limit)


def merge_ranked_product_sources(
    *,
    existing: list[dict],
    query: str,
    sources: list[dict],
    tenant_id: str | None,
    filters: dict[str, Any] | None,
    limit: int,
) -> list[dict]:
    merged = {str(item.get("id") or ""): item for item in existing if item.get("id")}
    for source in sources:
        metadata = source.get("metadata") or {}
        if tenant_id and metadata.get("tenant_id") != tenant_id and source.get("tenant_id") != tenant_id:
            continue
        candidate = product_card_from_metadata(metadata, source, None)
        candidate = enrich_candidate_card(candidate, query=query, metadata=metadata, source=source, chunk=None, filters=filters)
        score = float(candidate.get("_score") or 0.0)
        if score < PRODUCT_SOURCE_FALLBACK_MIN_SCORE:
            continue
        product_id = str(candidate.get("id") or "")
        if not product_id:
            continue
        previous = merged.get(product_id)
        if previous is None or score > float(previous.get("_score") or 0.0):
            merged[product_id] = candidate
    return sort_candidate_cards(merged.values(), limit=limit)


def sort_candidate_cards(candidates: Any, *, limit: int) -> list[dict]:
    ranked = sorted(
        list(candidates),
        key=lambda item: (
            float(item.get("_score") or 0.0),
            int(item.get("_lexical_hits") or 0),
            str(item.get("title") or ""),
        ),
        reverse=True,
    )
    return ranked[:limit]


def enrich_candidate_card(
    candidate: dict[str, Any],
    *,
    query: str,
    metadata: dict[str, Any],
    source: dict[str, Any],
    chunk: dict[str, Any] | None,
    filters: dict[str, Any] | None,
) -> dict[str, Any]:
    memory_terms = candidate_memory_terms(metadata, source, chunk)
    score, lexical_hits, explicit_scope_match, matched_fields, score_breakdown = score_product_candidate(
        query=query,
        metadata=metadata,
        source=source,
        chunk=chunk,
        filters=filters,
    )
    if matched_fields:
        reason = "Подходит по " + ", ".join(PRODUCT_REASON_LABELS[field] for field in matched_fields[:3]) + "."
    elif chunk:
        title = source.get("title") or metadata.get("title") or "товару"
        reason = f"Подходит по найденному описанию из карточки «{title}»."
    else:
        reason = candidate.get("reason")
    return {
        **candidate,
        "reason": reason,
        "_score": score,
        "_lexical_hits": lexical_hits,
        "_explicit_scope_match": explicit_scope_match,
        "_matched_fields": matched_fields,
        "_score_breakdown": score_breakdown,
        "_memory_terms": memory_terms,
    }


def score_product_candidate(
    *,
    query: str,
    metadata: dict[str, Any],
    source: dict[str, Any],
    chunk: dict[str, Any] | None,
    filters: dict[str, Any] | None,
) -> tuple[float, int, bool, list[str], dict[str, float]]:
    query_tokens = candidate_query_tokens(query)
    query_stems = {token[:5] for token in query_tokens if len(token) >= 4}
    fields = candidate_search_fields(metadata, source, chunk)
    score = 0.0
    lexical_hits = 0
    matched_fields: list[str] = []
    breakdown: dict[str, float] = {}
    for field_name, texts in fields.items():
        field_hits = field_match_count(texts, query_tokens=query_tokens, query_stems=query_stems)
        if not field_hits:
            continue
        contribution = PRODUCT_SCORE_BY_FIELD[field_name] * field_hits
        lexical_hits += field_hits
        score += contribution
        matched_fields.append(field_name)
        breakdown[field_name] = round(contribution, 3)
    explicit_scope_match = candidate_matches_explicit_scope(metadata, source, filters)
    if explicit_scope_match:
        score += 5.0
        matched_fields.insert(0, "scope")
        breakdown["scope_bonus"] = 5.0
    retrieval_score = chunk.get("score") if isinstance(chunk, dict) else None
    retrieval_boost = normalized_retrieval_boost(retrieval_score)
    if retrieval_boost > 0 and (lexical_hits > 0 or explicit_scope_match):
        score += retrieval_boost
        breakdown["retrieval_boost"] = round(retrieval_boost, 3)
    if lexical_hits == 0 and not explicit_scope_match:
        return 0.0, 0, False, [], {}
    return score, lexical_hits, explicit_scope_match, list(dict.fromkeys(matched_fields)), breakdown


def should_probe_source_fallback(*, query: str, filters: dict[str, Any] | None) -> bool:
    if candidate_query_tokens(query):
        return True
    filters = filters or {}
    return bool(filters.get("product_id") or filters.get("category") or filters.get("brand"))


def candidate_matches_explicit_scope(
    metadata: dict[str, Any],
    source: dict[str, Any],
    filters: dict[str, Any] | None,
) -> bool:
    filters = filters or {}
    product_id = filters.get("product_id")
    if product_id and str(metadata.get("product_id") or source.get("source_id")) == str(product_id):
        return True
    brand = filters.get("brand")
    if brand and str(metadata.get("brand") or "").casefold() == str(brand).casefold():
        return True
    category = filters.get("category")
    if not category:
        return False
    categories = {
        str(value).casefold()
        for value in [
            *ensure_list(metadata.get("category_handles")),
            *ensure_list(metadata.get("category_ids")),
            *ensure_list(metadata.get("category_names")),
        ]
        if value
    }
    return str(category).casefold() in categories


def candidate_search_fields(
    metadata: dict[str, Any],
    source: dict[str, Any],
    chunk: dict[str, Any] | None,
) -> dict[str, list[str]]:
    return {
        "title": [metadata.get("title"), source.get("title")],
        "subtitle": [metadata.get("subtitle")],
        "category": [
            *ensure_list(metadata.get("category_names")),
            *ensure_list(metadata.get("category_handles")),
            *ensure_list(metadata.get("category_ids")),
        ],
        "collection": [metadata.get("collection_title"), metadata.get("collection_handle")],
        "use_case": ensure_list(metadata.get("use_case_phrases")),
        "suitability": ensure_list(metadata.get("suitability_labels")),
        "keywords": ensure_list(metadata.get("search_terms")),
        "tags": ensure_list(metadata.get("tags")),
        "brand": [metadata.get("brand")],
        "options": ensure_list(metadata.get("option_titles")),
        "variant": ensure_list(metadata.get("variant_titles")),
        "description": [metadata.get("description"), chunk.get("content") if chunk else None],
    }


def candidate_memory_terms(
    metadata: dict[str, Any],
    source: dict[str, Any],
    chunk: dict[str, Any] | None,
) -> list[str]:
    fields = candidate_search_fields(metadata, source, chunk)
    tokens: list[str] = []
    for field_name, texts in fields.items():
        if field_name == "description":
            continue
        for text in texts:
            tokens.extend(tokenize_candidate_text(text))
    return list(dict.fromkeys(tokens))


def field_match_count(
    texts: list[str],
    *,
    query_tokens: list[str],
    query_stems: set[str],
) -> int:
    if not texts or not query_tokens:
        return 0
    candidate_tokens: set[str] = set()
    candidate_stems: set[str] = set()
    for text in texts:
        for token in tokenize_candidate_text(text):
            candidate_tokens.add(token)
            if len(token) >= 4:
                candidate_stems.add(token[:5])
    hits = 0
    for token in query_tokens:
        stem = token[:5] if len(token) >= 4 else None
        if token in candidate_tokens or (stem and stem in candidate_stems) or (stem and stem in query_stems and stem in candidate_stems):
            hits += 1
    return hits


def candidate_query_tokens(text: str) -> list[str]:
    tokens = tokenize_candidate_text(text)
    return [token for token in tokens if token not in PRODUCT_QUERY_STOPWORDS]


def tokenize_candidate_text(text: Any) -> list[str]:
    return [
        token
        for token in re.findall(r"[\wа-яА-ЯёЁ-]+", normalize_search_text(text))
        if len(token) > 2
    ]


def normalize_search_text(text: Any) -> str:
    return str(text or "").casefold().replace("ё", "е")


def normalized_retrieval_boost(score: Any) -> float:
    try:
        numeric = float(score)
    except (TypeError, ValueError):
        return 0.0
    if numeric <= 0:
        return 0.0
    if numeric <= 1.0:
        return numeric * 1.5
    return min(numeric, 5.0) * 0.35
