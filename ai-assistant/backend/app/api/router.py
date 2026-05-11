from fastapi import APIRouter

from app.api.admin import router as admin_router
from app.api.chat import router as chat_router
from app.api.feedback import router as feedback_router
from app.api.health import router as health_router
from app.api.ingest import router as ingest_router
from app.api.tools import router as tools_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(chat_router)
api_router.include_router(ingest_router)
api_router.include_router(tools_router)
api_router.include_router(feedback_router)
api_router.include_router(admin_router)
