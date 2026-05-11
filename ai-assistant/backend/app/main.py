from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import Settings, get_settings
from app.database.postgres import PostgresDatabase
from app.medusa import MedusaProductClient
from app.repositories.memory import InMemoryAssistantRepository
from app.repositories.postgres import PostgresAssistantRepository
from app.services.chat import ChatService
from app.services.ingestion import MarkdownIngestionService, MedusaProductIngestionService
from app.services.retrieval import SimpleMarkdownRetriever
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

        app.state.medusa_product_client = MedusaProductClient(settings=settings)
        app.state.live_commerce_tools = LiveCommerceTools(
            product_client=app.state.medusa_product_client,
        )
        app.state.retriever = SimpleMarkdownRetriever(repository=app.state.repository)
        app.state.chat_service = ChatService(
            repository=app.state.repository,
            retriever=app.state.retriever,
            commerce_tools=app.state.live_commerce_tools,
            settings=settings,
        )
        app.state.ingestion_service = MarkdownIngestionService(
            repository=app.state.repository,
            settings=settings,
        )
        app.state.medusa_product_ingestion_service = MedusaProductIngestionService(
            repository=app.state.repository,
            product_client=app.state.medusa_product_client,
            settings=settings,
        )
        yield
        await database.close()

    app = FastAPI(
        title=settings.project_name,
        openapi_url=f"{settings.api_v1_prefix}/openapi.json",
        lifespan=lifespan,
    )
    app.state.settings = settings
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(api_router, prefix=settings.api_v1_prefix)

    @app.get("/")
    async def root():
        return {"message": "Medusa AI Assistant backend is running"}

    return app


app = create_app()
