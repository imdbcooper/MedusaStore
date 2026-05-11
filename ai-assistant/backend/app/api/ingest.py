from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies import (
    get_ingestion_service,
    get_medusa_product_ingestion_service,
    get_vector_indexing_service,
)
from app.core.auth import require_api_token
from app.medusa import MedusaClientError
from app.schemas.ingestion import (
    IngestionJobResponse,
    MarkdownSyncRequest,
    MarkdownSyncResponse,
    MedusaProductsSyncRequest,
    MedusaProductsSyncResponse,
    VectorDeleteRequest,
    VectorIndexRequest,
)
from app.services.ingestion import MarkdownIngestionService, MedusaProductIngestionService, VectorIndexingService
from app.services.vector import VectorBackendUnavailable

router = APIRouter(prefix="/ingest", tags=["ingestion"])


@router.post("/markdown/sync", response_model=MarkdownSyncResponse)
async def sync_markdown(
    request: MarkdownSyncRequest,
    service: MarkdownIngestionService = Depends(get_ingestion_service),
    _: None = Depends(require_api_token),
) -> MarkdownSyncResponse:
    try:
        return await service.sync_directory(
            store_id=request.store_id,
            locale=request.locale,
            path=request.path,
        )
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "INGESTION_FAILED", "message": str(exc), "retryable": False}},
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"error": {"code": "INGESTION_FAILED", "message": str(exc), "retryable": True}},
        ) from exc


@router.post("/medusa/products/sync", response_model=MedusaProductsSyncResponse)
async def sync_medusa_products(
    request: MedusaProductsSyncRequest,
    service: MedusaProductIngestionService = Depends(get_medusa_product_ingestion_service),
    _: None = Depends(require_api_token),
) -> MedusaProductsSyncResponse:
    try:
        return await service.sync_products(
            store_id=request.store_id,
            locale=request.locale,
            full=request.full,
            product_ids=request.product_ids,
            region_id=request.region_id,
            currency_code=request.currency_code,
        )
    except MedusaClientError as exc:
        raise HTTPException(
            status_code=502,
            detail={"error": {"code": "MEDUSA_UNAVAILABLE", "message": str(exc), "retryable": True}},
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"error": {"code": "INGESTION_FAILED", "message": str(exc), "retryable": True}},
        ) from exc


@router.post("/vector/index", response_model=IngestionJobResponse)
async def index_vectors(
    request: VectorIndexRequest,
    service: VectorIndexingService = Depends(get_vector_indexing_service),
    _: None = Depends(require_api_token),
) -> IngestionJobResponse:
    try:
        return await service.reindex_repository(
            store_id=request.store_id,
            locale=request.locale,
            source_type=request.source_type,
        )
    except VectorBackendUnavailable as exc:
        raise HTTPException(
            status_code=503,
            detail={"error": {"code": "RETRIEVAL_UNAVAILABLE", "message": str(exc), "retryable": True}},
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"error": {"code": "INGESTION_FAILED", "message": str(exc), "retryable": True}},
        ) from exc


@router.delete("/vector/source")
async def delete_vector_source(
    request: VectorDeleteRequest,
    service: VectorIndexingService = Depends(get_vector_indexing_service),
    _: None = Depends(require_api_token),
) -> dict:
    try:
        return await service.delete_source(
            store_id=request.store_id,
            locale=request.locale,
            source_type=request.source_type,
            source_id=request.source_id,
        )
    except VectorBackendUnavailable as exc:
        raise HTTPException(
            status_code=503,
            detail={"error": {"code": "RETRIEVAL_UNAVAILABLE", "message": str(exc), "retryable": True}},
        ) from exc


@router.get("/jobs/{job_id}", response_model=IngestionJobResponse)
async def get_ingestion_job(
    job_id: UUID,
    service: VectorIndexingService = Depends(get_vector_indexing_service),
    _: None = Depends(require_api_token),
) -> IngestionJobResponse:
    job = await service.get_job(job_id)
    if not job:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "INGESTION_JOB_NOT_FOUND", "message": "Job not found", "retryable": False}},
        )
    return job
