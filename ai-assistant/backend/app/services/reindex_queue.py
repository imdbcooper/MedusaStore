from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from app.services.ingestion import MedusaProductIngestionService, VectorIndexingService


@dataclass(slots=True)
class ReindexQueueProcessor:
    repository: Any
    product_service: MedusaProductIngestionService
    vector_service: VectorIndexingService
    default_backoff_seconds: int = 60

    async def process_pending(self, *, limit: int = 10, retry_backoff_seconds: int | None = None) -> dict[str, Any]:
        claimed = await self.repository.claim_reindex_intents(limit=limit)
        processed: list[dict[str, Any]] = []
        for intent in claimed:
            processed.append(
                await self._process_intent(
                    intent,
                    retry_backoff_seconds=retry_backoff_seconds or self.default_backoff_seconds,
                )
            )
        stats = await self.repository.reindex_intent_stats()
        return {"claimed": len(claimed), "processed": processed, "stats": stats}

    async def _process_intent(self, intent: dict[str, Any], *, retry_backoff_seconds: int) -> dict[str, Any]:
        intent_id = intent["id"]
        try:
            result = await self._run_intent(intent)
        except Exception as exc:  # worker boundary: persist retry/error, do not crash the whole drain
            record = await self.repository.complete_reindex_intent(
                intent_id=intent_id,
                status="error",
                error=str(exc),
                retry_backoff_seconds=retry_backoff_seconds,
            )
            return {"id": str(intent_id), "status": record.get("status"), "error": str(exc), "attempts": record.get("attempts")}

        assistant_job_id = extract_job_id(result)
        record = await self.repository.complete_reindex_intent(
            intent_id=intent_id,
            status="completed",
            result=result,
            assistant_job_id=assistant_job_id,
        )
        return {
            "id": str(intent_id),
            "status": record.get("status"),
            "assistant_job_id": str(assistant_job_id) if assistant_job_id else None,
            "action": intent.get("action"),
            "scope": intent.get("scope"),
        }

    async def _run_intent(self, intent: dict[str, Any]) -> dict[str, Any]:
        store_id = intent.get("store_id") or "default"
        locale = intent.get("locale") or "ru"
        tenant_id = intent.get("tenant_id")
        action = intent.get("action") or "reindex"
        scope = intent.get("scope") or "products"
        product_ids = [str(item) for item in (intent.get("product_ids") or []) if str(item).strip()]
        metadata = intent.get("metadata") or {}
        region_id = metadata.get("region_id")
        currency_code = metadata.get("currency_code")

        if action == "delete":
            deletions = []
            for product_id in product_ids:
                deletions.append(
                    await self.vector_service.delete_source(
                        store_id=store_id,
                        locale=locale,
                        source_type="medusa_product",
                        source_id=product_id,
                        tenant_id=tenant_id,
                    )
                )
            return {"action": "delete", "deleted": deletions, "product_ids": product_ids}

        response = await self.product_service.sync_products(
            store_id=store_id,
            tenant_id=tenant_id,
            locale=locale,
            full=scope == "all_products" or not product_ids,
            product_ids=[] if scope == "all_products" else product_ids,
            region_id=region_id,
            currency_code=currency_code,
        )
        return response.model_dump(mode="json")


async def sleep_backoff(seconds: int) -> None:
    await asyncio.sleep(seconds)


def extract_job_id(result: Any) -> UUID | None:
    if not isinstance(result, dict):
        return None
    job = result.get("job")
    if not isinstance(job, dict):
        return None
    raw = job.get("job_id")
    if not raw:
        return None
    try:
        return UUID(str(raw))
    except ValueError:
        return None
