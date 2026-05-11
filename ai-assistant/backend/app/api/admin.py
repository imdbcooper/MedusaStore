from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, Request as FastAPIRequest, status

from app.api.dependencies import (
    get_health_service,
    get_ingestion_service,
    get_medusa_product_ingestion_service,
    get_vector_indexing_service,
)
from app.core.auth import require_api_token
from app.core.security import enforce_rate_limit, rate_limit_identity
from app.schemas.ingestion import IngestionJobResponse
from app.services.health import DeepHealthService
from app.services.ingestion import MarkdownIngestionService, MedusaProductIngestionService, VectorIndexingService
from app.services.vector import VectorBackendUnavailable

router = APIRouter(prefix="/admin", tags=["admin"])


class AdminReindexRequest(BaseModel):
    scope: str = Field(default="products", pattern="^(all|products|markdown|payload|documents|vector)$")
    store_id: str = Field(default="default", min_length=1, max_length=128)
    tenant_id: str | None = Field(default=None, min_length=1, max_length=128)
    locale: str = Field(default="ru", min_length=2, max_length=16)
    force: bool = False
    product_ids: list[str] = Field(default_factory=list)
    region_id: str | None = None
    currency_code: str | None = None


@router.get("/stats")
async def admin_stats(
    http_request: FastAPIRequest,
    service: DeepHealthService = Depends(get_health_service),
    _: None = Depends(require_api_token),
) -> dict:
    enforce_rate_limit(http_request, scope="admin", identity=rate_limit_identity(http_request, scope="admin"))
    health = await service.check()
    return {
        "status": health.get("status"),
        "retrieval_mode": health.get("retrieval_mode"),
        "stats": health.get("stats") or {},
        "components": {
            "postgres": health.get("postgres"),
            "qdrant": health.get("qdrant"),
            "medusa": health.get("medusa"),
            "llm_provider": health.get("llm_provider"),
            "lightrag": health.get("lightrag"),
        },
    }


@router.post("/reindex")
async def admin_reindex(
    request: AdminReindexRequest,
    http_request: FastAPIRequest,
    product_service: MedusaProductIngestionService = Depends(get_medusa_product_ingestion_service),
    markdown_service: MarkdownIngestionService = Depends(get_ingestion_service),
    vector_service: VectorIndexingService = Depends(get_vector_indexing_service),
    _: None = Depends(require_api_token),
) -> dict:
    enforce_rate_limit(
        http_request,
        scope="admin",
        identity=rate_limit_identity(http_request, scope="admin", store_id=request.store_id),
    )
    if request.scope == "payload":
        return {"status": "unsupported", "scope": request.scope, "message": "Payload reindex is not implemented in this backend yet."}
    if request.scope == "documents":
        return {"status": "unsupported", "scope": request.scope, "message": "Generic document reindex is prepared but not implemented yet."}
    try:
        jobs: list[IngestionJobResponse] = []
        if request.scope in {"all", "products"}:
            products_response = await product_service.sync_products(
                store_id=request.store_id,
                tenant_id=request.tenant_id,
                locale=request.locale,
                full=request.force or request.scope == "all" or not request.product_ids,
                product_ids=request.product_ids,
                region_id=request.region_id,
                currency_code=request.currency_code,
            )
            jobs.append(products_response.job)
        if request.scope in {"all", "markdown"}:
            markdown_response = await markdown_service.sync_directory(
                store_id=request.store_id,
                tenant_id=request.tenant_id,
                locale=request.locale,
            )
            jobs.append(markdown_response.job)
        if request.scope in {"all", "vector"}:
            jobs.append(
                await vector_service.reindex_repository(
                    store_id=request.store_id,
                    tenant_id=request.tenant_id,
                    locale=request.locale,
                    source_type=None,
                )
            )
        return {"status": "accepted", "scope": request.scope, "jobs": [job.model_dump(mode="json") for job in jobs]}
    except VectorBackendUnavailable as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"error": {"code": "VECTOR_UNAVAILABLE", "message": str(exc), "retryable": True}},
        ) from exc
