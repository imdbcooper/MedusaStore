from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration for the assistant backend.

    The names mirror ai-assistant/ENV.example and keep the Phase 1 service
    independent from the Medusa backend/storefront modules.
    """

    project_name: str = Field(default="Medusa AI Assistant", alias="AI_ASSISTANT_PROJECT_NAME")
    api_v1_prefix: str = Field(default="/api/v1", alias="AI_ASSISTANT_API_V1_PREFIX")
    environment: str = Field(default="development", alias="AI_ASSISTANT_ENV")
    host: str = Field(default="0.0.0.0", alias="AI_ASSISTANT_HOST")
    port: int = Field(default=8000, alias="AI_ASSISTANT_PORT")
    api_token: str | None = Field(default=None, alias="AI_ASSISTANT_API_TOKEN")
    public_chat_enabled: bool = Field(default=True, alias="AI_ASSISTANT_PUBLIC_CHAT_ENABLED")
    default_store_id: str = Field(default="default", alias="AI_ASSISTANT_DEFAULT_STORE_ID")
    default_tenant_id: str | None = Field(default=None, alias="AI_ASSISTANT_DEFAULT_TENANT_ID")
    default_locale: str = Field(default="ru", alias="AI_ASSISTANT_DEFAULT_LOCALE")
    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:8000", "http://localhost:3000"],
        alias="AI_ASSISTANT_CORS_ORIGINS",
    )
    cors_allow_credentials: bool = Field(default=True, alias="AI_ASSISTANT_CORS_ALLOW_CREDENTIALS")
    chat_rate_limit: str = Field(default="60/minute", alias="CHAT_RATE_LIMIT")
    admin_rate_limit: str = Field(default="30/minute", alias="ADMIN_RATE_LIMIT")
    ingestion_rate_limit: str = Field(default="10/minute", alias="INGESTION_RATE_LIMIT")
    tools_rate_limit: str = Field(default="30/minute", alias="TOOLS_RATE_LIMIT")
    feedback_rate_limit: str = Field(default="30/minute", alias="FEEDBACK_RATE_LIMIT")
    enable_feedback: bool = Field(default=True, alias="ENABLE_FEEDBACK")
    enable_tool_audit: bool = Field(default=True, alias="ENABLE_TOOL_AUDIT")
    enable_tracing: bool = Field(default=False, alias="ENABLE_TRACING")
    langsmith_api_key: str | None = Field(default=None, alias="LANGSMITH_API_KEY")
    langsmith_project: str | None = Field(default=None, alias="LANGSMITH_PROJECT")

    retrieval_mode: str = Field(default="markdown", alias="AI_ASSISTANT_RETRIEVAL_MODE")
    postgres_uri: str | None = Field(default=None, alias="ASSISTANT_POSTGRES_URI")
    qdrant_url: str | None = Field(default=None, alias="QDRANT_URL")
    qdrant_api_key: str | None = Field(default=None, alias="QDRANT_API_KEY")
    qdrant_collection_prefix: str = Field(default="assistant", alias="QDRANT_COLLECTION_PREFIX")
    qdrant_single_collection: bool = Field(default=True, alias="QDRANT_SINGLE_COLLECTION")
    qdrant_upsert_batch_size: int = Field(default=64, alias="QDRANT_UPSERT_BATCH_SIZE")
    embedding_provider: str = Field(default="hashing", alias="EMBEDDING_PROVIDER")
    embedding_dimension: int = Field(default=384, alias="EMBEDDING_DIMENSION")
    lightrag_enabled: bool = Field(default=False, alias="LIGHTRAG_ENABLED")
    lightrag_work_dir: Path = Field(default=Path("./lightrag_workdir"), alias="LIGHTRAG_WORK_DIR")
    neo4j_uri: str | None = Field(default=None, alias="NEO4J_URI")
    neo4j_username: str | None = Field(default=None, alias="NEO4J_USERNAME")
    neo4j_password: str | None = Field(default=None, alias="NEO4J_PASSWORD")
    neo4j_database: str = Field(default="neo4j", alias="NEO4J_DATABASE")
    llm_provider: str = Field(default="none", alias="LLM_PROVIDER")
    knowledge_dir: Path = Field(default=Path("knowledge"), alias="KNOWLEDGE_DIR")
    markdown_frontmatter_required: bool = Field(default=False, alias="MARKDOWN_FRONTMATTER_REQUIRED")
    chat_history_limit: int = Field(default=10, alias="CHAT_HISTORY_LIMIT")
    chat_max_input_chars: int = Field(default=4000, alias="CHAT_MAX_INPUT_CHARS")
    chunk_target_chars: int = Field(default=1200, alias="MARKDOWN_CHUNK_TARGET_CHARS")
    chunk_overlap_chars: int = Field(default=150, alias="MARKDOWN_CHUNK_OVERLAP_CHARS")

    medusa_backend_url: str | None = Field(default=None, alias="MEDUSA_BACKEND_URL")
    medusa_admin_api_token: str | None = Field(default=None, alias="MEDUSA_ADMIN_API_TOKEN")
    medusa_store_publishable_key: str | None = Field(
        default=None,
        alias="MEDUSA_STORE_PUBLISHABLE_KEY",
    )
    medusa_default_region_id: str | None = Field(default=None, alias="MEDUSA_DEFAULT_REGION_ID")
    medusa_default_sales_channel_id: str | None = Field(
        default=None,
        alias="MEDUSA_DEFAULT_SALES_CHANNEL_ID",
    )
    medusa_products_page_limit: int = Field(default=100, alias="MEDUSA_PRODUCTS_PAGE_LIMIT")
    medusa_request_timeout_seconds: float = Field(default=15.0, alias="MEDUSA_REQUEST_TIMEOUT_SECONDS")
    medusa_products_fields: str = Field(
        default=(
            "id,handle,title,subtitle,description,thumbnail,+metadata,+tags,"
            "collection.id,collection.title,categories.id,categories.name,categories.handle,"
            "options.id,options.title,options.values.value,variants.id,variants.title,variants.sku,"
            "variants.options.value,*variants.calculated_price,+variants.inventory_quantity,"
            "images.url,updated_at"
        ),
        alias="MEDUSA_PRODUCTS_FIELDS",
    )

    model_config = SettingsConfigDict(
        env_file=(".env", "ENV.example"),
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @property
    def is_production_like(self) -> bool:
        return self.environment.lower() in {"production", "prod", "staging"}

    @property
    def effective_cors_origins(self) -> list[str]:
        if self.is_production_like:
            return [origin for origin in self.cors_origins if origin != "*"]
        return self.cors_origins


@lru_cache
def get_settings() -> Settings:
    return Settings()
