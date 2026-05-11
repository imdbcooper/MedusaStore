# AI Assistant Production Deployment

This document is scoped to `ai-assistant/` only. It does not modify the root production compose or the real Medusa backend/storefront.

## Deployment shape

Recommended production topology:

```text
Storefront browser
  -> same-origin Next.js or Medusa store proxy
  -> AI Assistant FastAPI service
  -> PostgreSQL for sessions/messages/jobs/feedback
  -> Qdrant for vectors
  -> optional Neo4j/LightRAG
  -> Medusa backend for live commerce reads
```

Public browser traffic should use storefront/Medusa proxy routes for chat. Privileged endpoints require `AI_ASSISTANT_API_TOKEN` and reject browser-origin requests.

## Build

```bash
cd ai-assistant
docker build -t medusa-ai-assistant:local .
```

## Local compose profile

```bash
cd ai-assistant
AI_ASSISTANT_API_TOKEN=dev-secret docker compose -f docker-compose.ai.yml --profile ai-assistant up --build
```

This starts:

- `ai-assistant` on `localhost:8000`;
- PostgreSQL for operational state;
- Qdrant for vector retrieval.

Neo4j is optional:

```bash
docker compose -f docker-compose.ai.yml --profile ai-assistant-lightrag up assistant-neo4j
```

## Environment and secrets

Required production variables:

```env
AI_ASSISTANT_ENV=production
AI_ASSISTANT_API_TOKEN=<strong-server-token>
AI_ASSISTANT_CORS_ORIGINS=https://store.example.com,https://admin.example.com
ASSISTANT_POSTGRES_URI=postgresql://assistant:<password>@postgres:5432/assistant
MEDUSA_BACKEND_URL=http://medusa-backend:9000
MEDUSA_STORE_PUBLISHABLE_KEY=<publishable-key-if-required>
QDRANT_URL=http://qdrant:6333
QDRANT_API_KEY=<qdrant-api-key-if-enabled>
```

Never expose `AI_ASSISTANT_API_TOKEN` to the browser. Storefront chat should call a same-origin route or Medusa store proxy.

## Migration instructions

The service currently initializes PostgreSQL tables on startup from the schema in `backend/app/database/postgres.py`. For stricter production change control:

1. Extract `SCHEMA_SQL` into a managed migration before first production launch.
2. Apply migrations before starting the application container.
3. Keep additive changes backward compatible.
4. Back up the database before schema changes.

Tables covered:

- `assistant_sessions`;
- `assistant_messages`;
- `assistant_sources`;
- `assistant_source_chunks`;
- `assistant_ingestion_jobs`;
- `assistant_feedback`.

## Backup and restore

### PostgreSQL

Backup:

```bash
pg_dump "$ASSISTANT_POSTGRES_URI" > assistant-postgres-$(date +%F).sql
```

Restore into a prepared empty database:

```bash
psql "$ASSISTANT_POSTGRES_URI" < assistant-postgres-YYYY-MM-DD.sql
```

### Qdrant

Use Qdrant snapshots per collection. Default collection is `assistant_knowledge` unless `QDRANT_SINGLE_COLLECTION=false`.

```bash
curl -X POST "$QDRANT_URL/collections/assistant_knowledge/snapshots"
curl "$QDRANT_URL/collections/assistant_knowledge/snapshots"
```

Restore according to the Qdrant version's snapshot restore procedure. Reindex from Medusa/Markdown if snapshot restore is not available.

### Neo4j/LightRAG

LightRAG is disabled by default. If enabled, back up Neo4j using `neo4j-admin database dump` or your managed provider's backup mechanism. Keep Qdrant and Neo4j snapshots from the same indexing window.

## Production hardening checklist

- `AI_ASSISTANT_ENV=production`.
- Explicit `AI_ASSISTANT_CORS_ORIGINS`; no wildcard.
- Strong `AI_ASSISTANT_API_TOKEN` shared only with server-side Medusa/worker clients.
- Privileged endpoints reachable only from trusted network paths.
- Rate limits configured for chat, tools, ingestion, admin, feedback.
- PostgreSQL backups scheduled.
- Qdrant snapshots scheduled or reindex runbook accepted.
- Deep health endpoint monitored.
- Logs shipped with secret/PII redaction preserved.
- Medusa live checks validated before showing price/stock.

## Health and smoke

```bash
curl -fsS http://localhost:8000/api/v1/health
curl -fsS http://localhost:8000/api/v1/health/deep
```

Protected ingestion example:

```bash
curl -fsS -X POST http://localhost:8000/api/v1/ingest/markdown/sync \
  -H "Authorization: Bearer $AI_ASSISTANT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"store_id":"default","locale":"ru"}'
```
