from functools import lru_cache
from pathlib import Path
from typing import Annotated

import json

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


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
    cors_origins: Annotated[list[str], NoDecode] = Field(
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
    openai_api_key: str | None = Field(default=None, alias="OPENAI_API_KEY")
    openai_base_url: str | None = Field(default=None, alias="OPENAI_BASE_URL")
    openai_model: str = Field(default="gpt-4o-mini", alias="OPENAI_MODEL")
    knowledge_dir: Path = Field(default=Path("knowledge"), alias="KNOWLEDGE_DIR")
    knowledge_uploads_dir: Path = Field(
        default=Path("knowledge-uploaded"),
        alias="KNOWLEDGE_UPLOADS_DIR",
    )
    markdown_frontmatter_required: bool = Field(default=False, alias="MARKDOWN_FRONTMATTER_REQUIRED")
    chat_history_limit: int = Field(default=10, alias="CHAT_HISTORY_LIMIT")
    chat_max_input_chars: int = Field(default=4000, alias="CHAT_MAX_INPUT_CHARS")
    abuse_block_seconds: int = Field(default=7200, alias="ASSISTANT_ABUSE_BLOCK_SECONDS")
    abuse_window_seconds: int = Field(default=1800, alias="ASSISTANT_ABUSE_WINDOW_SECONDS")
    abuse_off_topic_threshold: int = Field(default=5, alias="ASSISTANT_ABUSE_OFF_TOPIC_THRESHOLD")
    abuse_prompt_injection_threshold: int = Field(
        default=3,
        alias="ASSISTANT_ABUSE_PROMPT_INJECTION_THRESHOLD",
    )
    chunk_target_chars: int = Field(default=1200, alias="MARKDOWN_CHUNK_TARGET_CHARS")
    chunk_overlap_chars: int = Field(default=150, alias="MARKDOWN_CHUNK_OVERLAP_CHARS")

    medusa_backend_url: str | None = Field(default=None, alias="MEDUSA_BACKEND_URL")
    medusa_internal_url: str | None = Field(default=None, alias="MEDUSA_INTERNAL_URL")
    medusa_admin_api_token: str | None = Field(default=None, alias="MEDUSA_ADMIN_API_TOKEN")
    ai_assistant_server_token: str | None = Field(
        default=None,
        alias="AI_ASSISTANT_SERVER_TOKEN",
    )
    assistant_settings_ttl_seconds: float = Field(
        default=30.0,
        alias="ASSISTANT_SETTINGS_TTL_SECONDS",
    )
    assistant_settings_stale_after_seconds: float = Field(
        default=600.0,
        alias="ASSISTANT_SETTINGS_STALE_AFTER_SECONDS",
    )
    assistant_settings_timeout_seconds: float = Field(
        default=5.0,
        alias="ASSISTANT_SETTINGS_TIMEOUT_SECONDS",
    )
    assistant_settings_retries: int = Field(
        default=3,
        alias="ASSISTANT_SETTINGS_RETRIES",
    )
    assistant_settings_retry_backoff_seconds: float = Field(
        default=0.25,
        alias="ASSISTANT_SETTINGS_RETRY_BACKOFF_SECONDS",
    )
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
            normalized = value.strip()
            if normalized.startswith("["):
                try:
                    parsed = json.loads(normalized)
                except json.JSONDecodeError:
                    parsed = None
                if isinstance(parsed, list):
                    return [str(origin).strip() for origin in parsed if str(origin).strip()]
            return [origin.strip() for origin in normalized.split(",") if origin.strip()]
        return value

    @property
    def is_production_like(self) -> bool:
        return self.environment.lower() in {"production", "prod", "staging"}

    @property
    def effective_cors_origins(self) -> list[str]:
        if self.is_production_like:
            return [origin for origin in self.cors_origins if origin != "*"]
        return self.cors_origins

    @property
    def assistant_settings_endpoint(self) -> str | None:
        """Internal Medusa endpoint for the assistant settings snapshot.

        Falls back to the public Store API base URL when no dedicated internal
        URL is configured — the route itself is the same path on the same
        Medusa instance, the variable just allows splitting the hostname when
        the internal traffic is routed through a private network.
        """

        base = self.medusa_internal_url or self.medusa_backend_url
        if not base:
            return None
        return base.rstrip("/") + "/internal/assistant/settings/effective"

    @property
    def llm_provider_config(self) -> dict[str, str | bool | None]:
        provider = self.llm_provider.strip().lower()
        config: dict[str, str | bool | None] = {"provider": provider}
        if provider == "openai":
            config.update(
                {
                    "api_key_configured": bool(self.openai_api_key),
                    "base_url": self.openai_base_url,
                    "model": self.openai_model,
                    "openai_compatible": bool(self.openai_base_url),
                }
            )
        return config


@lru_cache
def get_settings() -> Settings:
    return Settings()
