import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import Settings, get_settings
from app.core.security import InMemoryRateLimiter, ObservabilityMiddleware, structured_log
from app.database.postgres import PostgresDatabase
from app.medusa import MedusaProductClient
from app.repositories.memory import InMemoryAssistantRepository
from app.repositories.postgres import PostgresAssistantRepository
from app.services.chat import ChatService
from app.services.health import DeepHealthService
from app.services.ingestion import MarkdownIngestionService, MedusaProductIngestionService, VectorIndexingService
from app.services.llm import LlmRouter
from app.services.reindex_queue import ReindexQueueProcessor
from app.services.retrieval import ModeAwareRetriever, QdrantVectorRetriever, SimpleMarkdownRetriever
from app.services.settings_provider import SettingsProvider
from app.services.telegram_handoff import TelegramHandoffService
from app.services.vector import HashingEmbeddingProvider, QdrantAdapter
from app.tools.commerce import LiveCommerceTools


def create_app(settings: Settings | None = None, *, repository=None) -> FastAPI:
    settings = settings or get_settings()
    database = PostgresDatabase(settings)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        if repository is None and settings.postgres_uri:
            await database.connect()
            await database.init_schema()
            app.state.repository = PostgresAssistantRepository(database)
        else:
            app.state.repository = repository or InMemoryAssistantRepository()

        app.state.embedding_provider = HashingEmbeddingProvider(dimension=settings.embedding_dimension)
        app.state.qdrant_adapter = QdrantAdapter(settings=settings)
        app.state.medusa_product_client = MedusaProductClient(settings=settings)
        app.state.live_commerce_tools = LiveCommerceTools(
            product_client=app.state.medusa_product_client,
        )
        app.state.markdown_retriever = SimpleMarkdownRetriever(repository=app.state.repository)
        app.state.vector_retriever = QdrantVectorRetriever(
            qdrant_adapter=app.state.qdrant_adapter,
            embedding_provider=app.state.embedding_provider,
        )
        app.state.retriever = ModeAwareRetriever(
            markdown_retriever=app.state.markdown_retriever,
            vector_retriever=app.state.vector_retriever,
            settings=settings,
        )
        app.state.settings_provider = _build_settings_provider(settings)
        app.state.llm_router = (
            LlmRouter(app.state.settings_provider) if app.state.settings_provider else None
        )
        app.state.telegram_handoff_service = TelegramHandoffService()
        app.state.chat_service = ChatService(
            repository=app.state.repository,
            retriever=app.state.retriever,
            commerce_tools=app.state.live_commerce_tools,
            settings=settings,
            settings_provider=app.state.settings_provider,
            llm_router=app.state.llm_router,
        )
        app.state.ingestion_service = MarkdownIngestionService(
            repository=app.state.repository,
            settings=settings,
            qdrant_adapter=app.state.qdrant_adapter,
            embedding_provider=app.state.embedding_provider,
        )
        app.state.medusa_product_ingestion_service = MedusaProductIngestionService(
            repository=app.state.repository,
            product_client=app.state.medusa_product_client,
            settings=settings,
            qdrant_adapter=app.state.qdrant_adapter,
            embedding_provider=app.state.embedding_provider,
        )
        app.state.vector_indexing_service = VectorIndexingService(
            repository=app.state.repository,
            qdrant_adapter=app.state.qdrant_adapter,
            embedding_provider=app.state.embedding_provider,
            settings=settings,
        )
        app.state.reindex_queue_processor = ReindexQueueProcessor(
            repository=app.state.repository,
            product_service=app.state.medusa_product_ingestion_service,
            vector_service=app.state.vector_indexing_service,
        )
        app.state.health_service = DeepHealthService(
            settings=settings,
            repository=app.state.repository,
            database=database,
            qdrant_adapter=app.state.qdrant_adapter,
            embedding_provider=app.state.embedding_provider,
            medusa_client=getattr(app.state, "fake_medusa_product_client", app.state.medusa_product_client),
            lightrag_adapter=None,
            settings_provider=app.state.settings_provider,
        )
        yield
        await app.state.qdrant_adapter.close()
        if app.state.llm_router is not None:
            await app.state.llm_router.aclose()
        await app.state.telegram_handoff_service.aclose()
        if app.state.settings_provider is not None:
            await app.state.settings_provider.aclose()
        await database.close()

    app = FastAPI(
        title=settings.project_name,
        openapi_url=f"{settings.api_v1_prefix}/openapi.json",
        lifespan=lifespan,
    )
    app.state.settings = settings
    app.state.rate_limiter = InMemoryRateLimiter()
    app.add_middleware(ObservabilityMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.effective_cors_origins,
        allow_credentials=settings.cors_allow_credentials,
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-API-Key", "X-Request-ID"],
        expose_headers=["X-Request-ID", "X-Assistant-Latency-Ms"],
    )
    app.include_router(api_router, prefix=settings.api_v1_prefix)

    @app.get("/")
    async def root():
        return {"message": "Medusa AI Assistant backend is running"}

    return app


def _build_settings_provider(settings: Settings) -> SettingsProvider | None:
    """Wire up :class:`SettingsProvider` from the loaded :class:`Settings`.

    Returns ``None`` when either the internal endpoint or the server-to-server
    token is missing — the assistant must keep working in that case using the
    deterministic fallback path in :class:`ChatService`.
    """

    logger = logging.getLogger("assistant.settings")
    endpoint = settings.assistant_settings_endpoint
    token = settings.ai_assistant_server_token
    if not endpoint or not token:
        structured_log(
            logger,
            logging.WARNING,
            "assistant.settings.disabled",
            reason="missing_endpoint_or_token",
            endpoint_configured=bool(endpoint),
            token_configured=bool(token),
        )
        return None
    return SettingsProvider(
        endpoint=endpoint,
        server_token=token,
        ttl_seconds=settings.assistant_settings_ttl_seconds,
        stale_after_seconds=settings.assistant_settings_stale_after_seconds,
        timeout_seconds=settings.assistant_settings_timeout_seconds,
        retries=settings.assistant_settings_retries,
        retry_backoff_seconds=settings.assistant_settings_retry_backoff_seconds,
        logger=logger,
    )


app = create_app()
