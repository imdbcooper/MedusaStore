from __future__ import annotations

import hashlib
import math
import re
from collections import Counter
from typing import Any, Protocol
from uuid import uuid5, NAMESPACE_URL

from app.core.config import Settings


class VectorBackendUnavailable(RuntimeError):
    """Raised when vector retrieval is requested but Qdrant/embedding backend is unavailable."""


class EmbeddingProvider(Protocol):
    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        ...

    async def health(self) -> dict[str, Any]:
        ...


class HashingEmbeddingProvider:
    """Deterministic local embedding fallback for tests/dev.

    It avoids real LLM calls while preserving vector semantics. Production can
    replace it with an OpenAI/Polza/Google provider without changing Qdrant code.
    """

    def __init__(self, *, dimension: int) -> None:
        self.dimension = dimension

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        return [hashing_embedding(text, dimension=self.dimension) for text in texts]

    async def health(self) -> dict[str, Any]:
        return {"status": "ok", "provider": "hashing", "dimension": self.dimension}


def hashing_embedding(text: str, *, dimension: int) -> list[float]:
    vector = [0.0] * dimension
    tokens = re.findall(r"[\wа-яА-ЯёЁ-]+", text.lower())
    if not tokens:
        return vector
    counts = Counter(tokens)
    for token, count in counts.items():
        digest = hashlib.sha256(token.encode("utf-8")).digest()
        index = int.from_bytes(digest[:4], "big") % dimension
        sign = -1.0 if digest[4] % 2 else 1.0
        vector[index] += sign * float(count)
    norm = math.sqrt(sum(value * value for value in vector))
    if norm <= 0:
        return vector
    return [value / norm for value in vector]


def vector_collection_name(settings: Settings, source_type: str | None = None) -> str:
    prefix = settings.qdrant_collection_prefix.strip() or "assistant"
    if settings.qdrant_single_collection:
        return f"{prefix}_knowledge"
    suffix = {
        "medusa_product": "products",
        "markdown": "guides",
        "policy": "policies",
        "faq": "faq",
        "payload_page": "cms",
        "payload_post": "cms",
    }.get(source_type or "", "knowledge")
    return f"{prefix}_{suffix}"


def build_qdrant_filter(
    *,
    store_id: str | None = None,
    locale: str | None = None,
    source_type: str | None = None,
    source_id: str | None = None,
    product_id: str | None = None,
    category: str | None = None,
    brand: str | None = None,
) -> Any | None:
    must: list[Any] = []
    for key, value in (
        ("store_id", store_id),
        ("locale", locale),
        ("source_type", source_type),
        ("source_id", source_id),
        ("product_id", product_id),
        ("brand", brand),
    ):
        if value:
            must.append(_qdrant_field_condition(key, value))
    if category:
        must.append(
            _qdrant_filter(
                should=[
                    _qdrant_field_condition("category", category),
                    _qdrant_field_condition("category_handles", category),
                    _qdrant_field_condition("category_ids", category),
                ]
            )
        )
    return _qdrant_filter(must=must) if must else None


def _qdrant_field_condition(key: str, value: Any) -> Any:
    try:
        from qdrant_client.http import models

        return models.FieldCondition(key=key, match=models.MatchValue(value=value))
    except Exception:  # pragma: no cover - optional package absent in tests
        return {"key": key, "match": {"value": value}}


def _qdrant_filter(*, must: list[Any] | None = None, should: list[Any] | None = None) -> Any:
    try:
        from qdrant_client.http import models

        return models.Filter(must=must or None, should=should or None)
    except Exception:  # pragma: no cover - optional package absent in tests
        payload: dict[str, Any] = {}
        if must:
            payload["must"] = must
        if should:
            payload["should"] = should
        return payload


def _dict_to_qdrant_condition(condition: dict[str, Any]) -> Any:
    try:
        from qdrant_client.http import models
    except Exception as exc:  # pragma: no cover - caller imports models first
        raise VectorBackendUnavailable("qdrant-client package is not installed") from exc

    if "should" in condition:
        return models.Filter(should=[_dict_to_qdrant_condition(item) for item in condition.get("should", [])])
    match = condition.get("match") or {}
    return models.FieldCondition(key=condition["key"], match=models.MatchValue(value=match.get("value")))


def _dict_to_qdrant_filter(filter_payload: dict[str, Any]) -> Any:
    try:
        from qdrant_client.http import models
    except Exception as exc:  # pragma: no cover - caller imports models first
        raise VectorBackendUnavailable("qdrant-client package is not installed") from exc

    return models.Filter(
        must=[_dict_to_qdrant_condition(item) for item in filter_payload.get("must", [])] or None,
        should=[_dict_to_qdrant_condition(item) for item in filter_payload.get("should", [])] or None,
    )


def normalize_vector_payload(chunk: dict[str, Any], source: dict[str, Any]) -> dict[str, Any]:
    metadata = dict(source.get("metadata") or chunk.get("metadata") or {})
    category_handles = metadata.get("category_handles") or []
    category_ids = metadata.get("category_ids") or []
    payload = {
        **metadata,
        "store_id": source.get("store_id") or metadata.get("store_id"),
        "locale": source.get("locale") or metadata.get("locale"),
        "source_type": source.get("source_type") or chunk.get("source_type"),
        "source_id": source.get("source_id") or chunk.get("source_id"),
        "chunk_id": str(chunk.get("id")),
        "title": source.get("title") or chunk.get("title") or metadata.get("title"),
        "url": source.get("uri") or chunk.get("path") or metadata.get("url"),
        "content": chunk.get("content", ""),
        "chunk_index": chunk.get("chunk_index", 0),
    }
    if "product_id" not in payload and payload.get("source_type") == "medusa_product":
        payload["product_id"] = payload.get("source_id")
    if category_handles:
        payload["category"] = category_handles[0]
    elif category_ids:
        payload["category"] = category_ids[0]
    return {key: value for key, value in payload.items() if value is not None}


def qdrant_point_id(*, store_id: str, locale: str, source_type: str, source_id: str, chunk_id: str) -> str:
    return str(uuid5(NAMESPACE_URL, f"{store_id}:{locale}:{source_type}:{source_id}:{chunk_id}"))


class QdrantAdapter:
    """Optional Qdrant adapter with lazy imports and mock-friendly client shape."""

    def __init__(self, *, settings: Settings, client: Any | None = None) -> None:
        self.settings = settings
        self.client = client

    @property
    def enabled(self) -> bool:
        return bool(self.settings.qdrant_url)

    async def connect(self) -> None:
        if self.client is not None or not self.enabled:
            return
        try:
            from qdrant_client import AsyncQdrantClient
        except Exception as exc:  # pragma: no cover - depends on optional package
            raise VectorBackendUnavailable("qdrant-client package is not installed") from exc
        kwargs: dict[str, Any] = {"url": self.settings.qdrant_url}
        if self.settings.qdrant_api_key:
            kwargs["api_key"] = self.settings.qdrant_api_key
        self.client = AsyncQdrantClient(**kwargs)

    async def close(self) -> None:
        if self.client and hasattr(self.client, "close"):
            await self.client.close()

    async def ensure_collection(self, *, collection_name: str | None = None) -> None:
        await self.connect()
        if not self.client:
            raise VectorBackendUnavailable("Qdrant URL is not configured")
        collection_name = collection_name or vector_collection_name(self.settings)
        names = await self._collection_names()
        if collection_name in names:
            return
        vectors_config = self._vector_params()
        await self.client.create_collection(collection_name=collection_name, vectors_config=vectors_config)

    async def upsert_chunks(self, *, chunks: list[dict[str, Any]], source: dict[str, Any], vectors: list[list[float]]) -> int:
        if len(chunks) != len(vectors):
            raise ValueError("chunks and vectors length mismatch")
        await self.connect()
        if not self.client:
            raise VectorBackendUnavailable("Qdrant URL is not configured")
        collection_name = vector_collection_name(self.settings, source.get("source_type"))
        await self.ensure_collection(collection_name=collection_name)
        points = []
        for chunk, vector in zip(chunks, vectors, strict=True):
            payload = normalize_vector_payload(chunk, source)
            points.append(
                self._point_struct(
                    id=qdrant_point_id(
                        store_id=str(payload.get("store_id") or "default"),
                        locale=str(payload.get("locale") or "ru"),
                        source_type=str(payload.get("source_type") or "unknown"),
                        source_id=str(payload.get("source_id") or "unknown"),
                        chunk_id=str(payload.get("chunk_id") or chunk.get("id")),
                    ),
                    vector=vector,
                    payload=payload,
                )
            )
        if points:
            await self.client.upsert(collection_name=collection_name, points=points)
        return len(points)

    async def delete_source(
        self,
        *,
        store_id: str,
        locale: str,
        source_type: str,
        source_id: str,
    ) -> None:
        await self.connect()
        if not self.client:
            raise VectorBackendUnavailable("Qdrant URL is not configured")
        collection_name = vector_collection_name(self.settings, source_type)
        selector_filter = build_qdrant_filter(
            store_id=store_id,
            locale=locale,
            source_type=source_type,
            source_id=source_id,
            product_id=source_id if source_type == "medusa_product" else None,
        )
        if selector_filter is None:
            raise ValueError("Refusing to delete Qdrant points without a source-scoped filter")
        selector = self._filter_selector(selector_filter)
        await self.client.delete(collection_name=collection_name, points_selector=selector)

    async def search(
        self,
        *,
        query_vector: list[float],
        store_id: str,
        locale: str,
        limit: int,
        source_type: str | None = None,
        product_id: str | None = None,
        category: str | None = None,
        brand: str | None = None,
    ) -> list[dict[str, Any]]:
        await self.connect()
        if not self.client:
            raise VectorBackendUnavailable("Qdrant URL is not configured")
        collection_name = vector_collection_name(self.settings, source_type)
        qdrant_filter = build_qdrant_filter(
            store_id=store_id,
            locale=locale,
            source_type=source_type,
            product_id=product_id,
            category=category,
            brand=brand,
        )
        results = await self._search_points(
            collection_name=collection_name,
            query_vector=query_vector,
            query_filter=qdrant_filter,
            limit=limit,
        )
        return [self._result_to_chunk(item) for item in results]

    async def health(self) -> dict[str, Any]:
        if not self.enabled:
            return {"status": "disabled", "detail": "QDRANT_URL is not configured"}
        try:
            await self.connect()
            if not self.client:
                raise VectorBackendUnavailable("Qdrant client is not initialized")
            if hasattr(self.client, "get_collections"):
                collections = await self.client.get_collections()
                names = [item.name for item in getattr(collections, "collections", [])]
                return {"status": "ok", "collections": names}
            return {"status": "ok"}
        except Exception as exc:
            return {"status": "error", "error": str(exc)}

    async def _collection_names(self) -> set[str]:
        collections = await self.client.get_collections()
        return {item.name for item in getattr(collections, "collections", [])}

    async def _search_points(
        self,
        *,
        collection_name: str,
        query_vector: list[float],
        query_filter: dict[str, Any] | None,
        limit: int,
    ) -> list[Any]:
        if hasattr(self.client, "query_points"):
            response = await self.client.query_points(
                collection_name=collection_name,
                query=query_vector,
                query_filter=query_filter,
                limit=limit,
                with_payload=True,
            )
            return list(getattr(response, "points", response))
        return await self.client.search(
            collection_name=collection_name,
            query_vector=query_vector,
            query_filter=query_filter,
            limit=limit,
            with_payload=True,
        )

    def _vector_params(self) -> Any:
        try:
            from qdrant_client.http import models

            return models.VectorParams(size=self.settings.embedding_dimension, distance=models.Distance.COSINE)
        except Exception:  # pragma: no cover - optional package absent in tests
            return {"size": self.settings.embedding_dimension, "distance": "Cosine"}

    def _point_struct(self, *, id: str, vector: list[float], payload: dict[str, Any]) -> Any:
        try:
            from qdrant_client.http import models

            return models.PointStruct(id=id, vector=vector, payload=payload)
        except Exception:  # pragma: no cover - optional package absent in tests
            return {"id": id, "vector": vector, "payload": payload}

    def _filter_selector(self, filter_payload: Any) -> Any:
        try:
            from qdrant_client.http import models

            if isinstance(filter_payload, models.Filter):
                return models.FilterSelector(filter=filter_payload)
            return models.FilterSelector(filter=_dict_to_qdrant_filter(filter_payload))
        except Exception:  # pragma: no cover - optional package absent in tests
            return {"filter": filter_payload}

    def _result_to_chunk(self, item: Any) -> dict[str, Any]:
        payload = getattr(item, "payload", None) or item.get("payload", {})
        score = getattr(item, "score", None) if not isinstance(item, dict) else item.get("score")
        source = {
            "source_type": payload.get("source_type", "markdown"),
            "source_id": payload.get("source_id", "unknown"),
            "title": payload.get("title", "Vector knowledge"),
            "uri": payload.get("url"),
            "store_id": payload.get("store_id"),
            "locale": payload.get("locale"),
            "metadata": payload,
        }
        return {
            "id": payload.get("chunk_id") or getattr(item, "id", None) or item.get("id"),
            "source_id": payload.get("source_id"),
            "source_type": payload.get("source_type"),
            "title": payload.get("title"),
            "path": payload.get("url"),
            "content": payload.get("content", ""),
            "chunk_index": payload.get("chunk_index", 0),
            "metadata": payload,
            "source": source,
            "score": score,
        }
