-- AI Assistant initial PostgreSQL schema.
-- Extracted from backend/app/database/postgres.py SCHEMA_SQL for managed production migration review.

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
  latency_ms INTEGER NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
