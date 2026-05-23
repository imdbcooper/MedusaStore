import logging
from typing import Any

import asyncpg

from app.core.config import Settings

logger = logging.getLogger(__name__)


class PostgresDatabase:
    """Thin asyncpg wrapper for Phase 1 PostgreSQL storage.

    Tests can inject repositories without creating a pool; production/dev can use
    ASSISTANT_POSTGRES_URI and initialize the contract tables from DATA_MODEL.md.
    """

    def __init__(self, settings: Settings):
        self.settings = settings
        self.pool: asyncpg.Pool | None = None

    async def connect(self) -> None:
        if not self.settings.postgres_uri:
            logger.warning("ASSISTANT_POSTGRES_URI is not set; PostgreSQL storage is disabled")
            return
        self.pool = await asyncpg.create_pool(self.settings.postgres_uri)

    async def close(self) -> None:
        if self.pool:
            await self.pool.close()
            self.pool = None

    async def health(self) -> bool:
        if not self.pool:
            return False
        async with self.pool.acquire() as conn:
            value = await conn.fetchval("SELECT 1")
        return value == 1

    async def init_schema(self) -> None:
        if not self.pool:
            return
        async with self.pool.acquire() as conn:
            await conn.execute(SCHEMA_SQL)


SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS assistant_sessions (
  id UUID PRIMARY KEY,
  store_id TEXT NOT NULL DEFAULT 'default',
  customer_id TEXT NULL,
  cart_id TEXT NULL,
  locale TEXT NOT NULL DEFAULT 'ru',
  region_id TEXT NULL,
  channel TEXT NOT NULL DEFAULT 'storefront',
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE assistant_sessions ADD COLUMN IF NOT EXISTS tenant_id TEXT NULL;
ALTER TABLE assistant_sessions ADD COLUMN IF NOT EXISTS customer_context JSONB NOT NULL DEFAULT '{}';
ALTER TABLE assistant_sessions ADD COLUMN IF NOT EXISTS bound_at TIMESTAMPTZ NULL;

CREATE TABLE IF NOT EXISTS assistant_messages (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES assistant_sessions(id),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool', 'system')),
  content TEXT NOT NULL,
  intent TEXT NULL,
  citations JSONB NOT NULL DEFAULT '[]',
  products JSONB NOT NULL DEFAULT '[]',
  actions JSONB NOT NULL DEFAULT '[]',
  tool_calls JSONB NOT NULL DEFAULT '[]',
  token_usage JSONB NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}',
  latency_ms INTEGER NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE assistant_messages ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS assistant_sources (
  id UUID PRIMARY KEY,
  store_id TEXT NOT NULL DEFAULT 'default',
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  title TEXT NOT NULL,
  uri TEXT NULL,
  content_hash TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'ru',
  metadata JSONB NOT NULL DEFAULT '{}',
  indexed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id, source_type, source_id, locale)
);

CREATE TABLE IF NOT EXISTS assistant_source_chunks (
  id UUID PRIMARY KEY,
  source_id UUID NOT NULL REFERENCES assistant_sources(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(source_id, chunk_index)
);

CREATE TABLE IF NOT EXISTS assistant_ingestion_jobs (
  id UUID PRIMARY KEY,
  store_id TEXT NOT NULL DEFAULT 'default',
  job_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'indexing', 'completed', 'error', 'cancelled')),
  source_type TEXT NULL,
  source_id TEXT NULL,
  input JSONB NOT NULL DEFAULT '{}',
  result JSONB NOT NULL DEFAULT '{}',
  error TEXT NULL,
  started_at TIMESTAMPTZ NULL,
  finished_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assistant_feedback (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES assistant_sessions(id),
  message_id UUID NULL REFERENCES assistant_messages(id),
  store_id TEXT NOT NULL DEFAULT 'default',
  tenant_id TEXT NULL,
  locale TEXT NOT NULL DEFAULT 'ru',
  rating INTEGER NULL CHECK (rating BETWEEN 1 AND 5),
  label TEXT NULL,
  comment TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assistant_handoffs (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES assistant_sessions(id),
  message_id UUID NULL REFERENCES assistant_messages(id),
  customer_id TEXT NULL,
  store_id TEXT NOT NULL DEFAULT 'default',
  tenant_id TEXT NULL,
  locale TEXT NOT NULL DEFAULT 'ru',
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'processing', 'completed', 'rejected')),
  source TEXT NOT NULL DEFAULT 'assistant_widget',
  name TEXT NULL,
  email TEXT NULL,
  phone TEXT NULL,
  summary TEXT NULL,
  reason TEXT NULL,
  note TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assistant_handoff_tickets (
  handoff_id UUID NOT NULL REFERENCES assistant_handoffs(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'telegram' CHECK (channel IN ('telegram')),
  ticket_status TEXT NOT NULL DEFAULT 'submitted' CHECK (
    ticket_status IN (
      'submitted',
      'open',
      'assigned',
      'waiting_customer',
      'waiting_operator',
      'closed',
      'failed'
    )
  ),
  telegram_chat_id TEXT NULL,
  telegram_topic_id BIGINT NULL,
  telegram_topic_title TEXT NULL,
  telegram_root_message_id BIGINT NULL,
  assigned_operator_id TEXT NULL,
  assigned_operator_username TEXT NULL,
  assigned_at TIMESTAMPTZ NULL,
  closed_at TIMESTAMPTZ NULL,
  last_operator_message_at TIMESTAMPTZ NULL,
  last_customer_message_at TIMESTAMPTZ NULL,
  last_telegram_update_id BIGINT NULL,
  failure_reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  opened_at TIMESTAMPTZ NULL,
  last_sync_at TIMESTAMPTZ NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (handoff_id, channel)
);

ALTER TABLE assistant_handoff_tickets DROP CONSTRAINT IF EXISTS assistant_handoff_tickets_ticket_status_check;
ALTER TABLE assistant_handoff_tickets
  ADD CONSTRAINT assistant_handoff_tickets_ticket_status_check
  CHECK (
    ticket_status IN (
      'submitted',
      'open',
      'assigned',
      'waiting_customer',
      'waiting_operator',
      'closed',
      'failed'
    )
  );
ALTER TABLE assistant_handoff_tickets ADD COLUMN IF NOT EXISTS assigned_operator_id TEXT NULL;
ALTER TABLE assistant_handoff_tickets ADD COLUMN IF NOT EXISTS assigned_operator_username TEXT NULL;
ALTER TABLE assistant_handoff_tickets ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ NULL;
ALTER TABLE assistant_handoff_tickets ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ NULL;
ALTER TABLE assistant_handoff_tickets ADD COLUMN IF NOT EXISTS last_operator_message_at TIMESTAMPTZ NULL;
ALTER TABLE assistant_handoff_tickets ADD COLUMN IF NOT EXISTS last_customer_message_at TIMESTAMPTZ NULL;
ALTER TABLE assistant_handoff_tickets ADD COLUMN IF NOT EXISTS last_telegram_update_id BIGINT NULL;

CREATE TABLE IF NOT EXISTS assistant_handoff_messages (
  id UUID PRIMARY KEY,
  handoff_id UUID NOT NULL REFERENCES assistant_handoffs(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES assistant_sessions(id) ON DELETE CASCADE,
  telegram_chat_id TEXT NOT NULL,
  telegram_topic_id BIGINT NULL,
  telegram_message_id BIGINT NULL,
  telegram_update_id BIGINT NULL,
  direction TEXT NOT NULL,
  delivery_status TEXT NOT NULL,
  message_kind TEXT NOT NULL DEFAULT 'telegram_update',
  assistant_message_id UUID NULL REFERENCES assistant_messages(id),
  operator_telegram_user_id TEXT NULL,
  operator_username TEXT NULL,
  content TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (telegram_update_id)
);

CREATE TABLE IF NOT EXISTS assistant_principal_state (
  principal_id TEXT PRIMARY KEY,
  principal_kind TEXT NOT NULL DEFAULT 'anonymous' CHECK (principal_kind IN ('anonymous', 'customer')),
  store_id TEXT NOT NULL DEFAULT 'default',
  tenant_id TEXT NULL,
  customer_id TEXT NULL,
  off_topic_count INTEGER NOT NULL DEFAULT 0,
  prompt_injection_count INTEGER NOT NULL DEFAULT 0,
  blocked_until TIMESTAMPTZ NULL,
  block_reason TEXT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assistant_reindex_intents (
  id UUID PRIMARY KEY,
  store_id TEXT NOT NULL DEFAULT 'default',
  tenant_id TEXT NULL,
  locale TEXT NOT NULL DEFAULT 'ru',
  event_name TEXT NOT NULL,
  event_id TEXT NULL,
  action TEXT NOT NULL DEFAULT 'reindex' CHECK (action IN ('reindex', 'delete')),
  scope TEXT NOT NULL DEFAULT 'products' CHECK (scope IN ('products', 'all_products')),
  product_ids JSONB NOT NULL DEFAULT '[]',
  reason TEXT NULL,
  coalescing_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'error')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error TEXT NULL,
  assistant_job_id UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ NULL,
  finished_at TIMESTAMPTZ NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_assistant_reindex_intents_pending_coalescing
  ON assistant_reindex_intents (coalescing_key)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_assistant_reindex_intents_status
  ON assistant_reindex_intents (status, next_attempt_at);

CREATE INDEX IF NOT EXISTS idx_assistant_messages_session_created
  ON assistant_messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_assistant_sources_store_locale
  ON assistant_sources(store_id, locale, source_type);
CREATE INDEX IF NOT EXISTS idx_assistant_feedback_session_created
  ON assistant_feedback(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_assistant_handoffs_session_created
  ON assistant_handoffs(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_assistant_handoff_tickets_status_updated
  ON assistant_handoff_tickets(channel, ticket_status, updated_at);
CREATE INDEX IF NOT EXISTS idx_assistant_handoff_tickets_thread
  ON assistant_handoff_tickets(channel, telegram_chat_id, telegram_topic_id);
CREATE INDEX IF NOT EXISTS idx_assistant_handoff_messages_handoff_created
  ON assistant_handoff_messages(handoff_id, created_at);
CREATE INDEX IF NOT EXISTS idx_assistant_handoff_messages_session_created
  ON assistant_handoff_messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_assistant_handoff_messages_update
  ON assistant_handoff_messages(telegram_update_id)
  WHERE telegram_update_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assistant_principal_state_blocked
  ON assistant_principal_state(blocked_until)
  WHERE blocked_until IS NOT NULL;
"""


def json_or_empty(value: Any, empty: Any) -> Any:
    return empty if value is None else value
