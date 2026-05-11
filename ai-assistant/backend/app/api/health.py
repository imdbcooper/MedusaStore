from fastapi import APIRouter, Depends

from app.api.dependencies import get_health_service
from app.services.health import DeepHealthService

router = APIRouter(prefix="/health", tags=["health"])


@router.get("")
async def health():
    return {"status": "ok", "service": "medusa-ai-assistant"}


@router.get("/deep")
async def deep_health(service: DeepHealthService = Depends(get_health_service)):
    return await service.check()
