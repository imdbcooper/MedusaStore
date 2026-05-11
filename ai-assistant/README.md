# AI Assistant for Medusa Agency Boilerplate

Reusable intelligent shopping assistant module for Medusa-based e-commerce projects.

This directory contains a standalone FastAPI assistant service, Medusa adapter templates, integration documentation, deployment artifacts, and tests. It is intentionally separated from the real Medusa backend/storefront code so it can be reviewed and reused before being installed into a project.

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

Implemented without modifying the real Medusa backend/storefront:

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

Implemented as copy-ready templates under [medusa-adapter/](./medusa-adapter/) without modifying the real Medusa backend:

- Store proxy route template for `POST /store/assistant/chat`, including SSE passthrough.
- Admin route templates for reindex, stats, and ingestion job status.
- Product freshness subscriber templates for create/update/delete, variant update, category update, and collection update events.
- Reindex workflow templates for selected-product and all-product sync with bounded retry behavior.
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

Prepared without modifying real Medusa/backend/storefront directories:

- [integration-plan/README.md](./integration-plan/README.md) gives copy steps for adapter templates and storefront widget connection.
- [e2e-checklist.md](./e2e-checklist.md) covers storefront chat, Markdown answers, product recommendation, live price/stock, safe add-to-cart proposal, admin reindex, product update triggers, vector fallback, and security checks.
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

Do not install templates into the real backend without review/approval. When approved, copy [medusa-adapter/src/](./medusa-adapter/src/) files according to [integration-plan/README.md](./integration-plan/README.md), merge middleware carefully, and configure:

```env
AI_ASSISTANT_ENABLED=true
AI_ASSISTANT_BASE_URL=http://ai-assistant:8000/api/v1
AI_ASSISTANT_SERVER_TOKEN=<same-as-AI_ASSISTANT_API_TOKEN>
AI_ASSISTANT_TIMEOUT_MS=60000
```

## Storefront integration

Preferred browser route is same-origin or Medusa proxy:

```text
POST /api/assistant/chat/stream
POST {MEDUSA_BACKEND_URL}/store/assistant/chat
```

The browser must never receive `AI_ASSISTANT_API_TOKEN` or `AI_ASSISTANT_SERVER_TOKEN`. Treat `add_to_cart_proposal` as UI-only; use the existing trusted storefront/Medusa cart flow after explicit user confirmation.

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

- Review/fix Phase 6/7 changes and commit in a separate orchestration step.
- Copy adapter templates into real Medusa backend only after explicit approval.
- Implement/copy the real storefront widget.
- Replace in-memory rate limiting with Redis or gateway-level distributed limits for multi-replica production.
- Add managed migrations before production schema changes.
- Run full E2E against real Medusa, storefront, PostgreSQL, Qdrant, and optional Neo4j.
