from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies import get_ingestion_service, get_medusa_product_ingestion_service
from app.core.auth import require_api_token
from app.medusa import MedusaClientError
from app.schemas.ingestion import (
    MarkdownSyncRequest,
    MarkdownSyncResponse,
    MedusaProductsSyncRequest,
    MedusaProductsSyncResponse,
)
from app.services.ingestion import MarkdownIngestionService, MedusaProductIngestionService

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
