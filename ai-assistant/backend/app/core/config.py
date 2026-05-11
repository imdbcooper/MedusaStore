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
    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:8000", "http://localhost:3000"],
        alias="AI_ASSISTANT_CORS_ORIGINS",
    )

    retrieval_mode: str = Field(default="markdown", alias="AI_ASSISTANT_RETRIEVAL_MODE")
    postgres_uri: str | None = Field(default=None, alias="ASSISTANT_POSTGRES_URI")
    knowledge_dir: Path = Field(default=Path("knowledge"), alias="KNOWLEDGE_DIR")
    markdown_frontmatter_required: bool = Field(default=False, alias="MARKDOWN_FRONTMATTER_REQUIRED")
    chat_history_limit: int = Field(default=10, alias="CHAT_HISTORY_LIMIT")
    chat_max_input_chars: int = Field(default=4000, alias="CHAT_MAX_INPUT_CHARS")
    chunk_target_chars: int = Field(default=1200, alias="MARKDOWN_CHUNK_TARGET_CHARS")
    chunk_overlap_chars: int = Field(default=150, alias="MARKDOWN_CHUNK_OVERLAP_CHARS")

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


@lru_cache
def get_settings() -> Settings:
    return Settings()
