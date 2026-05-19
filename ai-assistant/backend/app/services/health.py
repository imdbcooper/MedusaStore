from __future__ import annotations

from typing import Any

import httpx

from app.core.config import Settings


class DeepHealthService:
    def __init__(
        self,
        *,
        settings: Settings,
        repository,
        database=None,
        qdrant_adapter=None,
        embedding_provider=None,
        medusa_client=None,
        lightrag_adapter=None,
        settings_provider=None,
    ) -> None:
        self.settings = settings
        self.repository = repository
        self.database = database
        self.qdrant_adapter = qdrant_adapter
        self.embedding_provider = embedding_provider
        self.medusa_client = medusa_client
        self.lightrag_adapter = lightrag_adapter
        self.settings_provider = settings_provider

    async def check(self) -> dict[str, Any]:
        postgres = await self._check_postgres()
        qdrant = await self._check_qdrant()
        medusa = await self._check_medusa()
        llm = await self._check_llm()
        lightrag = await self._check_lightrag()
        settings_provider = await self._check_settings_provider()
        stats = await self.repository.stats()
        components = {
            "postgres": postgres,
            "qdrant": qdrant,
            "medusa": medusa,
            "llm_provider": llm,
            "lightrag": lightrag,
            "settings_provider": settings_provider,
        }
        status = "ok"
        if any(value.get("status") == "error" for value in components.values()):
            status = "degraded"
        return {
            "status": status,
            "retrieval_mode": self.settings.retrieval_mode,
            **components,
            "stats": stats,
        }

    async def _check_postgres(self) -> dict[str, Any]:
        if self.database and getattr(self.database, "pool", None):
            try:
                ok = await self.database.health()
                return {"status": "ok" if ok else "error"}
            except Exception as exc:
                return {"status": "error", "error": str(exc)}
        repository_name = self.repository.__class__.__name__
        if repository_name.startswith("Postgres"):
            return {"status": "error", "error": "PostgreSQL repository has no active pool"}
        return {"status": "memory", "detail": "In-memory repository is active"}

    async def _check_qdrant(self) -> dict[str, Any]:
        if not self.qdrant_adapter:
            return {"status": "disabled", "detail": "Qdrant adapter is not configured"}
        return await self.qdrant_adapter.health()

    async def _check_medusa(self) -> dict[str, Any]:
        if not self.settings.medusa_backend_url:
            return {"status": "disabled", "detail": "MEDUSA_BACKEND_URL is not configured"}
        if self.medusa_client and hasattr(self.medusa_client, "health"):
            try:
                return await self.medusa_client.health()
            except Exception as exc:
                return {"status": "error", "error": str(exc)}
        try:
            url = f"{self.settings.medusa_backend_url.rstrip('/')}/health"
            async with httpx.AsyncClient(timeout=self.settings.medusa_request_timeout_seconds) as client:
                response = await client.get(url)
            return {"status": "ok" if response.status_code < 500 else "error", "status_code": response.status_code}
        except Exception as exc:
            return {"status": "error", "error": str(exc)}

    async def _check_llm(self) -> dict[str, Any]:
        provider_config = self.settings.llm_provider_config
        if self.embedding_provider and hasattr(self.embedding_provider, "health"):
            try:
                status = await self.embedding_provider.health()
            except Exception as exc:
                return {"status": "error", "error": str(exc), **provider_config}
            return {**status, **provider_config}
        return {"status": "disabled", **provider_config}

    async def _check_lightrag(self) -> dict[str, Any]:
        if not self.settings.lightrag_enabled:
            return {"status": "disabled", "detail": "LIGHTRAG_ENABLED=false"}
        if not self.lightrag_adapter:
            return {"status": "disabled", "detail": "LightRAG adapter is not configured"}
        try:
            return await self.lightrag_adapter.health()
        except Exception as exc:
            return {"status": "error", "error": str(exc)}

    async def _check_settings_provider(self) -> dict[str, Any]:
        provider = self.settings_provider
        if provider is None:
            return {"status": "disabled", "detail": "AI_ASSISTANT_SERVER_TOKEN is not configured"}
        try:
            snapshot = await provider.get()
        except Exception as exc:
            return {"status": "degraded", "error": str(exc)}
        return {
            "status": "ok",
            "version": snapshot.version,
            "active_provider_id": snapshot.active.id if snapshot.active else None,
            "fallback_count": len(snapshot.fallback),
        }
