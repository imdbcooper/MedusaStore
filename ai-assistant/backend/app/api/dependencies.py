from fastapi import Request

from app.medusa import MedusaProductClient
from app.services.chat import ChatService
from app.services.health import DeepHealthService
from app.services.ingestion import MarkdownIngestionService, MedusaProductIngestionService, VectorIndexingService
from app.services.llm import LlmRouter
from app.services.reindex_queue import ReindexQueueProcessor
from app.services.settings_provider import SettingsProvider


def get_repository(request: Request):
    return request.app.state.repository


def get_chat_service(request: Request) -> ChatService:
    return request.app.state.chat_service


def get_ingestion_service(request: Request) -> MarkdownIngestionService:
    return request.app.state.ingestion_service


def get_medusa_product_ingestion_service(request: Request) -> MedusaProductIngestionService:
    return request.app.state.medusa_product_ingestion_service


def get_vector_indexing_service(request: Request) -> VectorIndexingService:
    return request.app.state.vector_indexing_service


def get_health_service(request: Request) -> DeepHealthService:
    return request.app.state.health_service


def get_reindex_queue_processor(request: Request) -> ReindexQueueProcessor:
    return request.app.state.reindex_queue_processor


def get_medusa_product_client(request: Request) -> MedusaProductClient:
    return request.app.state.medusa_product_client


def get_settings_provider(request: Request) -> SettingsProvider | None:
    return getattr(request.app.state, "settings_provider", None)


def get_llm_router(request: Request) -> LlmRouter | None:
    return getattr(request.app.state, "llm_router", None)


