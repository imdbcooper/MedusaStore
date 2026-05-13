# AI Assistant for Medusa Agency Boilerplate

Reusable intelligent shopping assistant module for Medusa-based e-commerce projects.

This directory contains the standalone FastAPI assistant service, reusable Medusa adapter reference templates, integration documentation, deployment artifacts, and tests. In this repository the integration is no longer only a template: the Medusa backend adapter is installed in [`medusa-agency-boilerplate`](../medusa-agency-boilerplate), the storefront widget is installed in [`assistant`](../medusa-agency-boilerplate-storefront/src/modules/assistant), and root production Compose includes an optional disabled-by-default `ai-assistant` profile.

## Documents

- [SPEC.md](./SPEC.md) — full development specification.
- [ARCHITECTURE.md](./ARCHITECTURE.md) — target architecture and module boundaries.
- [API_CONTRACT.md](./API_CONTRACT.md) — backend/API contracts.
- [DATA_MODEL.md](./DATA_MODEL.md) — PostgreSQL/Qdrant/Neo4j data contracts.
- [MEDUSA_INTEGRATION.md](./MEDUSA_INTEGRATION.md) — Medusa backend adapter plan.
- [STOREFRONT_WIDGET.md](./STOREFRONT_WIDGET.md) — Next.js widget plan.
- [ROADMAP.md](./ROADMAP.md) — implementation phases and acceptance criteria.
- [GITHUB_RESEARCH.md](./GITHUB_RESEARCH.md) — GitHub references and extracted best practices.
- [ENV.example](./ENV.example) — environment variables.
- [docs/PRODUCTION_DEPLOYMENT.md](./docs/PRODUCTION_DEPLOYMENT.md) — Docker, env, migration, backup/restore guidance.
- [docs/OPERATIONAL_RUNBOOKS.md](./docs/OPERATIONAL_RUNBOOKS.md) — incident runbooks.
- [integration-plan/README.md](./integration-plan/README.md) — real monorepo integration steps.
- [e2e-checklist.md](./e2e-checklist.md) — post-integration acceptance checklist.

## Current implementation status

### Phase 1 — MVP chat over Markdown knowledge

Implemented in [backend/](./backend/) with FastAPI health, chat, streaming chat, Markdown ingestion, in-memory test storage, and optional PostgreSQL storage.

### Phase 2 — Medusa product ingestion

Implemented in the standalone assistant service and now connected through the installed repository adapter/widget when explicitly enabled:

- `POST /api/v1/ingest/medusa/products/sync` reads products from Medusa Store API.
- Products are normalized into `medusa_product` documents/chunks with metadata matching [DATA_MODEL.md](./DATA_MODEL.md).
- Ingestion jobs and source indexing status are stored through the repository abstraction.
- Chat responses can include structured product cards for product discovery/search questions.

### Phase 3 — Live commerce tools

Implemented inside the standalone assistant service:

- Product cards are enriched through Medusa live tools before showing price or availability.
- Responses include `tool_calls` for product live data, price/variant checks, inventory checks, and cart state checks when a trusted `cart_id` is provided.
- If Medusa is unavailable, `price=null`, `availability=unknown`, and `safety.live_data_checked=false` prevent hallucinated sellable facts.
- Add-to-cart from chat is only `add_to_cart_proposal` with `requires_confirmation=true`; the tool endpoint remains proposal-only until trusted cart ownership/session validation exists.

### Phase 4 — Qdrant advanced retrieval

Implemented as optional/guarded functionality:

- `AI_ASSISTANT_RETRIEVAL_MODE` supports `markdown`, `vector`, `auto`, and documented-disabled `lightrag`.
- Vector mode uses Qdrant semantic retrieval with mandatory `store_id` + `locale` filters and optional `tenant_id`, `source_type`, `product_id`, `category`, and `brand` filters.
- `auto` safely falls back to Markdown/simple retrieval when Qdrant or embeddings are unavailable.
- Price and availability still come only from live Medusa tools.
- `/api/v1/health/deep` reports PostgreSQL, Qdrant, Medusa, embedding/LLM provider, and LightRAG/Neo4j status.

### Phase 5 — Medusa adapter automation

Implemented as reusable templates under [medusa-adapter/](./medusa-adapter/) and installed into the current repository's real Medusa backend:

- Store proxy routes for `POST /store/assistant/chat` and `/store/assistant/history`, including SSE passthrough for chat.
- Admin routes for reindex, reindex processing, reindex intents, stats, and ingestion job status.
- Product freshness subscribers for create/update/delete, variant update, category update, and collection update events.
- Durable reindex intent flow for selected-product, all-product, and delete-source actions; subscribers enqueue intents only, while drain/processing is explicit via admin route, worker, or cron.
- Typed server-side client using `AI_ASSISTANT_BASE_URL`, `AI_ASSISTANT_SERVER_TOKEN`, `AI_ASSISTANT_TIMEOUT_MS`, and exact opt-in `AI_ASSISTANT_ENABLED=true`.

### Phase 6 — Production hardening

Implemented/prepared inside `ai-assistant/`:

- In-memory rate limiting for public chat, tools, ingestion/admin, and feedback endpoints; env-driven and ready to replace with Redis/gateway limits for distributed production.
- Auth/token strategy: public storefront chat remains tokenless; privileged endpoints, including chat history, require `AI_ASSISTANT_API_TOKEN` and reject direct browser-origin calls until signed session binding is implemented.
- Multi-tenant isolation: `tenant_id` support in chat/ingestion/vector payloads; retrieval and product-card fallback paths require `store_id` and `locale` filters, and tenant-scoped requests only see matching `tenant_id` metadata.
- Security hardening: CORS is env-driven, production-like wildcard origins are ignored, prompt-injection guardrail is deterministic, PII/log redaction covers common secrets/emails/phones/cards, tools are safe/proposal-only, and no-hallucination guards hide price/stock without live Medusa grounding.
- Observability: structured request/chat logs, request ids, latency headers, response observability payload, tool-call counts, retrieval stats, and optional tracing/LangSmith env hooks.
- Feedback: `POST /api/v1/feedback`, in-memory/PostgreSQL persistence, session/message ownership validation, PII-redacted comments, and feedback count in deep health stats.
- Evaluation: [evaluation/dataset.jsonl](./evaluation/dataset.jsonl) covers recommendation, policy answer, price/stock grounding, and tenant isolation.
- Deployment: [Dockerfile](./Dockerfile), [docker-compose.ai.yml](./docker-compose.ai.yml), production deployment docs, backup/restore notes, and operational runbooks.

### Phase 7 — Real monorepo integration readiness

Installed in the current repository and pending final review/validation before production launch:

- [integration-plan/README.md](./integration-plan/README.md) remains the copy/integration reference for future projects and audits.
- The current repository has the backend adapter copied into [`medusa-agency-boilerplate`](../medusa-agency-boilerplate) and the widget implemented under [`assistant`](../medusa-agency-boilerplate-storefront/src/modules/assistant).
- The widget is disabled by default through `NEXT_PUBLIC_AI_ASSISTANT_WIDGET_ENABLED=false`; backend adapter calls are disabled unless `AI_ASSISTANT_ENABLED=true` exactly.
- [e2e-checklist.md](./e2e-checklist.md) covers storefront chat/history, Markdown answers, product recommendation, live price/stock, safe add-to-cart proposal, admin reindex/process/intents/stats, product update intent triggers, vector fallback, and security checks.
- [scripts/smoke_assistant.py](./scripts/smoke_assistant.py) provides a safe non-destructive smoke example.

## Local development

From `ai-assistant/`:

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -e .[dev]
cp ENV.example .env
uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 8000 --reload
```

Useful local checks:

```bash
python3 -m pytest
python3 -m compileall backend/app backend/tests
node --test medusa-adapter/tests/*.test.mjs
python3 -m py_compile scripts/smoke_assistant.py
```

If `compileall` creates generated caches, remove them before commit:

```bash
find backend/app backend/tests scripts -type d -name __pycache__ -prune -exec rm -rf {} +
```

## Production deploy

See [docs/PRODUCTION_DEPLOYMENT.md](./docs/PRODUCTION_DEPLOYMENT.md).

Minimal Docker flow:

```bash
docker build -t medusa-ai-assistant:local .
AI_ASSISTANT_API_TOKEN=change-me docker compose -f docker-compose.ai.yml --profile ai-assistant up --build
```

Required production configuration includes:

- `AI_ASSISTANT_ENV=production`;
- explicit `AI_ASSISTANT_CORS_ORIGINS`;
- strong `AI_ASSISTANT_API_TOKEN` shared only with server-side adapter/worker clients;
- `ASSISTANT_POSTGRES_URI`;
- `MEDUSA_BACKEND_URL`;
- `QDRANT_URL` for vector mode.

Optional LLM configuration uses `LLM_PROVIDER`, provider API key variables such as `OPENAI_API_KEY`, and provider model variables such as `OPENAI_MODEL`. Set `OPENAI_BASE_URL` only when using an OpenAI-compatible `/v1` endpoint instead of the default OpenAI API host.

## Medusa integration

The current repository already has the adapter installed for review/validation. For future projects, copy [medusa-adapter/src/](./medusa-adapter/src/) files according to [integration-plan/README.md](./integration-plan/README.md), merge middleware carefully, and configure:

```env
AI_ASSISTANT_ENABLED=true
AI_ASSISTANT_BASE_URL=http://ai-assistant:8000/api/v1
AI_ASSISTANT_SERVER_TOKEN=<same-as-AI_ASSISTANT_API_TOKEN>
AI_ASSISTANT_TIMEOUT_MS=60000
```

## Storefront integration

Preferred browser routes are Medusa Store API proxies:

```text
POST {MEDUSA_BACKEND_URL}/store/assistant/chat
GET {MEDUSA_BACKEND_URL}/store/assistant/history
```

The browser must never receive `AI_ASSISTANT_API_TOKEN` or `AI_ASSISTANT_SERVER_TOKEN`. Treat `add_to_cart_proposal` as UI-only; use the existing trusted storefront/Medusa cart flow after explicit user confirmation. Browser-supplied `cart_id` is untrusted and discarded by the current backend adapter until a trusted server-side cart resolver is added.

## Testing commands

```bash
cd ai-assistant
python3 -m pytest || python3 -m compileall backend/app backend/tests
node --test medusa-adapter/tests/*.test.mjs
python3 -m py_compile scripts/smoke_assistant.py
python3 - <<'PY'
import json
from pathlib import Path
for line in Path('evaluation/dataset.jsonl').read_text().splitlines():
    json.loads(line)
print('evaluation dataset ok')
PY
git diff --check -- ai-assistant
```

## Remaining production launch gaps

- Review and validate the installed backend adapter, storefront widget, and optional root Compose profile before production enablement.
- Decide production ownership for assistant PostgreSQL, Qdrant, backups, LLM/embedding provider credentials, rate limiting, and worker/cron scheduling.
- Replace in-memory rate limiting with Redis or gateway-level distributed limits before multi-replica production.
- Add/approve managed migrations before production schema changes; include `assistant_reindex_intents` in assistant database migration review.
- Run full E2E against real Medusa, storefront, PostgreSQL, Qdrant, and optional Neo4j.
