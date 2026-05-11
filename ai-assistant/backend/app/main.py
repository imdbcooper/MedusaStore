from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import Settings, get_settings
from app.database.postgres import PostgresDatabase
from app.repositories.memory import InMemoryAssistantRepository
from app.repositories.postgres import PostgresAssistantRepository
from app.services.chat import ChatService
from app.services.ingestion import MarkdownIngestionService
from app.services.retrieval import SimpleMarkdownRetriever


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

        app.state.retriever = SimpleMarkdownRetriever(repository=app.state.repository)
        app.state.chat_service = ChatService(
            repository=app.state.repository,
            retriever=app.state.retriever,
            settings=settings,
        )
        app.state.ingestion_service = MarkdownIngestionService(
            repository=app.state.repository,
            settings=settings,
        )
        yield
        await database.close()

    app = FastAPI(
        title=settings.project_name,
        openapi_url=f"{settings.api_v1_prefix}/openapi.json",
        lifespan=lifespan,
    )
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
