from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, Request as FastAPIRequest, status

from app.api.dependencies import (
    get_health_service,
    get_ingestion_service,
    get_medusa_product_ingestion_service,
    get_reindex_queue_processor,
    get_repository,
    get_settings_provider,
    get_telegram_handoff_service,
    get_vector_indexing_service,
)
from app.core.auth import require_server_token_or_api_token
from app.core.security import enforce_rate_limit, rate_limit_identity
from app.schemas.ingestion import IngestionJobResponse
from app.schemas.ingestion import KnowledgeDocumentCreateRequest, KnowledgeDocumentCreateResponse
from app.services.health import DeepHealthService
from app.services.ingestion import MarkdownIngestionService, MedusaProductIngestionService, VectorIndexingService
from app.services.reindex_queue import ReindexQueueProcessor
from app.services.settings_provider import SettingsFetchError, SettingsProvider
from app.services.telegram_handoff import (
    TelegramHandoffConnectionTestResult,
    TelegramHandoffService,
)
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


class SessionBindRequest(BaseModel):
    session_id: UUID
    customer_id: str = Field(min_length=1, max_length=256)
    store_id: str = Field(default="default", min_length=1, max_length=128)
    tenant_id: str | None = Field(default=None, min_length=1, max_length=128)
    locale: str = Field(default="ru", min_length=2, max_length=16)
    customer_context: dict[str, Any] = Field(default_factory=dict)


class ReindexIntentRequest(BaseModel):
    store_id: str = Field(default="default", min_length=1, max_length=128)
    tenant_id: str | None = Field(default=None, min_length=1, max_length=128)
    locale: str = Field(default="ru", min_length=2, max_length=16)
    event_name: str = Field(min_length=1, max_length=256)
    event_id: str | None = Field(default=None, max_length=256)
    action: str = Field(default="reindex", pattern="^(reindex|delete)$")
    scope: str = Field(default="products", pattern="^(products|all_products)$")
    product_ids: list[str] = Field(default_factory=list)
    reason: str | None = Field(default=None, max_length=512)
    coalescing_key: str | None = Field(default=None, max_length=512)
    max_attempts: int = Field(default=3, ge=1, le=10)
    metadata: dict[str, Any] = Field(default_factory=dict)


class ReindexProcessRequest(BaseModel):
    limit: int = Field(default=10, ge=1, le=100)
    retry_backoff_seconds: int = Field(default=60, ge=1, le=3600)


@router.post("/sessions/bind")
async def bind_session(
    request: SessionBindRequest,
    http_request: FastAPIRequest,
    repository=Depends(get_repository),
    _: None = Depends(require_server_token_or_api_token),
) -> dict:
    enforce_rate_limit(
        http_request,
        scope="admin",
        identity=rate_limit_identity(http_request, scope="admin", store_id=request.store_id),
    )
    try:
        session = await repository.bind_session_customer(
            session_id=request.session_id,
            store_id=request.store_id,
            locale=request.locale,
            tenant_id=request.tenant_id,
            customer_id=request.customer_id,
            customer_context=request.customer_context,
        )
    except ValueError as exc:
        code = str(exc)
        status_code = status.HTTP_404_NOT_FOUND if code == "SESSION_NOT_FOUND" else status.HTTP_409_CONFLICT
        raise HTTPException(
            status_code=status_code,
            detail={"error": {"code": code, "message": session_bind_error_message(code), "retryable": False}},
        ) from exc
    return {
        "status": "bound",
        "session_id": session["id"],
        "customer_id": session.get("customer_id"),
        "store_id": session.get("store_id"),
        "tenant_id": session.get("tenant_id"),
        "locale": session.get("locale"),
        "bound_at": session.get("bound_at"),
    }


@router.post("/reindex/intents")
async def enqueue_reindex_intent(
    request: ReindexIntentRequest,
    http_request: FastAPIRequest,
    repository=Depends(get_repository),
    _: None = Depends(require_server_token_or_api_token),
) -> dict:
    enforce_rate_limit(http_request, scope="admin", identity=rate_limit_identity(http_request, scope="admin", store_id=request.store_id))
    intent = await repository.enqueue_reindex_intent(**request.model_dump())
    return {"status": "queued", "intent": serialize_record(intent)}


@router.get("/reindex/intents")
async def list_reindex_intents(
    http_request: FastAPIRequest,
    status_filter: str | None = None,
    limit: int = 50,
    repository=Depends(get_repository),
    _: None = Depends(require_server_token_or_api_token),
) -> dict:
    enforce_rate_limit(http_request, scope="admin", identity=rate_limit_identity(http_request, scope="admin"))
    intents = await repository.list_reindex_intents(status=status_filter, limit=min(max(limit, 1), 100))
    stats = await repository.reindex_intent_stats()
    return {"intents": [serialize_record(intent) for intent in intents], "stats": stats}


@router.post("/reindex/process")
async def process_reindex_queue(
    request: ReindexProcessRequest,
    http_request: FastAPIRequest,
    processor: ReindexQueueProcessor = Depends(get_reindex_queue_processor),
    _: None = Depends(require_server_token_or_api_token),
) -> dict:
    enforce_rate_limit(http_request, scope="admin", identity=rate_limit_identity(http_request, scope="admin"))
    return await processor.process_pending(limit=request.limit, retry_backoff_seconds=request.retry_backoff_seconds)


@router.get("/stats")
async def admin_stats(
    http_request: FastAPIRequest,
    service: DeepHealthService = Depends(get_health_service),
    _: None = Depends(require_server_token_or_api_token),
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


@router.post(
    "/telegram/handoff/test-connection",
    response_model=TelegramHandoffConnectionTestResult,
)
async def test_telegram_handoff_connection(
    http_request: FastAPIRequest,
    settings_provider: SettingsProvider | None = Depends(get_settings_provider),
    service: TelegramHandoffService = Depends(get_telegram_handoff_service),
    _: None = Depends(require_server_token_or_api_token),
) -> TelegramHandoffConnectionTestResult:
    enforce_rate_limit(
        http_request,
        scope="admin",
        identity=rate_limit_identity(http_request, scope="admin"),
    )
    if settings_provider is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "error": {
                    "code": "SETTINGS_PROVIDER_UNAVAILABLE",
                    "message": "Assistant settings provider is not configured.",
                    "retryable": True,
                }
            },
        )
    try:
        await settings_provider.invalidate()
        snapshot = await settings_provider.get()
    except (SettingsFetchError, RuntimeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "error": {
                    "code": "SETTINGS_PROVIDER_UNAVAILABLE",
                    "message": str(exc),
                    "retryable": True,
                }
            },
        ) from exc
    return await service.test_connection(snapshot.telegram_handoff)


@router.post("/knowledge/documents", response_model=KnowledgeDocumentCreateResponse)
async def create_knowledge_document(
    request: KnowledgeDocumentCreateRequest,
    http_request: FastAPIRequest,
    service: MarkdownIngestionService = Depends(get_ingestion_service),
    _: None = Depends(require_server_token_or_api_token),
) -> KnowledgeDocumentCreateResponse:
    enforce_rate_limit(
        http_request,
        scope="admin",
        identity=rate_limit_identity(http_request, scope="admin", store_id=request.store_id),
    )
    try:
        return await service.save_admin_document(
            store_id=request.store_id,
            tenant_id=request.tenant_id,
            locale=request.locale,
            title=request.title,
            description=request.description,
            content=request.content,
            file_name=request.file_name,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": "KNOWLEDGE_DOCUMENT_INVALID", "message": str(exc), "retryable": False}},
        ) from exc
    except OSError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": {"code": "KNOWLEDGE_DOCUMENT_WRITE_FAILED", "message": str(exc), "retryable": False}},
        ) from exc


@router.post("/reindex")
async def admin_reindex(
    request: AdminReindexRequest,
    http_request: FastAPIRequest,
    product_service: MedusaProductIngestionService = Depends(get_medusa_product_ingestion_service),
    markdown_service: MarkdownIngestionService = Depends(get_ingestion_service),
    vector_service: VectorIndexingService = Depends(get_vector_indexing_service),
    _: None = Depends(require_server_token_or_api_token),
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


def serialize_record(record: dict[str, Any]) -> dict[str, Any]:
    return {key: str(value) if isinstance(value, UUID) else value for key, value in record.items()}


def session_bind_error_message(code: str) -> str:
    return {
        "SESSION_NOT_FOUND": "Assistant session was not found.",
        "SESSION_SCOPE_MISMATCH": "Assistant session store, tenant, or locale does not match the trusted bind request.",
        "SESSION_ALREADY_BOUND_TO_DIFFERENT_CUSTOMER": "Assistant session is already bound to a different customer.",
    }.get(code, "Assistant session bind failed.")
