from fastapi import APIRouter, Depends

from app.api.dependencies import get_repository

router = APIRouter(prefix="/health", tags=["health"])


@router.get("")
async def health():
    return {"status": "ok", "service": "medusa-ai-assistant"}


@router.get("/deep")
async def deep_health(repository=Depends(get_repository)):
    stats = await repository.stats()
    return {
        "status": "ok",
        "postgres": "configured" if repository.__class__.__name__.startswith("Postgres") else "memory",
        "retrieval_mode": "markdown",
        "stats": stats,
    }
