from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies import get_ingestion_service
from app.schemas.ingestion import MarkdownSyncRequest, MarkdownSyncResponse
from app.services.ingestion import MarkdownIngestionService

router = APIRouter(prefix="/ingest", tags=["ingestion"])


@router.post("/markdown/sync", response_model=MarkdownSyncResponse)
async def sync_markdown(
    request: MarkdownSyncRequest,
    service: MarkdownIngestionService = Depends(get_ingestion_service),
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
