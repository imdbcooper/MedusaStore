# Roadmap

## Phase 0 — Specification checkpoint

Status: implemented.

Deliverables:

- module spec;
- architecture;
- API contract;
- data model;
- Medusa integration plan;
- storefront widget plan;
- GitHub research summary.

Acceptance:

- developer can start implementation without rethinking the whole architecture.

## Phase 1 — MVP chat over Markdown knowledge

Status: implemented.

Goal: prove assistant UX in storefront.

Tasks:

1. Create `ai-assistant/backend` from existing RAG architecture subset.
2. Implement FastAPI health, chat, chat/stream.
3. Implement Markdown ingestion.
4. Store sessions/messages in PostgreSQL.
5. Add simple retriever mode.
6. Add storefront widget with SSE.
7. Add example `knowledge/` files.

Acceptance:

- user can open storefront chat;
- ask FAQ/guide questions;
- receive streaming answer;
- session history persists.

## Phase 2 — Medusa product ingestion

Status: implemented.

Goal: assistant understands catalog.

Tasks:

1. Implement Medusa product client.
2. Normalize products to documents.
3. Index product docs.
4. Add admin reindex endpoint.
5. Return product suggestions from chat.
6. Add product page context.

Acceptance:

- user can ask for product recommendations;
- assistant recommends indexed Medusa products with cards.

## Phase 3 — Live commerce tools

Status: implemented.

Goal: stop hallucinating price/stock.

Tasks:

1. Implement live product data tool.
2. Implement price/availability check.
3. Require tool call before displaying price/stock.
4. Add cart state tool.
5. Add add-to-cart proposal flow.

Acceptance:

- assistant checks Medusa before showing price/availability;
- add-to-cart is user-confirmed and safe.

## Phase 4 — Qdrant/LightRAG advanced mode

Status: implemented in standalone assistant backend; LightRAG remains disabled/not configured by default.

Goal: large catalog and hybrid retrieval.

Tasks:

1. Port/adapt Qdrant integration from `/home/somdev/Projects/RAG`.
2. Add payload filters.
3. Add optional LightRAG + Neo4j mode.
4. Add ingestion job status.
5. Add deep health checks.

Acceptance:

- large indexed catalog retrieval works with filters;
- LightRAG mode is optional and documented.

Implementation notes:

- Qdrant adapter is optional and guarded; Markdown mode can start without Qdrant.
- Vector indexing writes/deletes Qdrant points with payload filters for `store_id`, `locale`, `source_type`, `product_id`, `category`, and `brand`.
- Chat supports `markdown`, `vector`, `auto`, and disabled/documented `lightrag`; `auto` falls back to Markdown when vector backend/embeddings are unavailable.
- Live price/availability still come only from Phase 3 Medusa tools, never from vector payload hints.
- Deep health checks cover PostgreSQL, Qdrant, Medusa, embedding/LLM provider, and LightRAG/Neo4j disabled status.

## Phase 5 — Medusa adapter automation

Status: implemented as copy-ready adapter templates in `ai-assistant/medusa-adapter/` and installed into the current repository's real Medusa backend; pending review/validation before production enablement.

Goal: automatic freshness.

Tasks:

1. Add Medusa store proxy route.
2. Add admin routes.
3. Add product subscribers.
4. Add reindex workflows.
5. Add tests for route/workflow behavior.

Acceptance:

- product update can trigger reindex;
- admin can reindex from Medusa.

Implementation notes:

- Store chat proxy keeps `AI_ASSISTANT_SERVER_TOKEN` server-side and supports JSON/SSE passthrough; scoped history is exposed through `/store/assistant/history`.
- Admin templates/current routes cover reindex, reindex processing, reindex intents, stats, and job status routes behind Medusa admin auth middleware.
- Product subscribers enqueue lightweight intents for product create/update/delete and variant update instead of doing heavy indexing inline or running assistant network workflows from the event hot path.
- Category/collection subscribers enqueue broad catalog stale-marker/reindex intents with reason/event id and a stable coalescing key; a separate worker/job should debounce/coalesce these before full reindex execution.
- Reindex workflows support selected products, all products, vector source deletion for deleted products, and bounded retry on retryable assistant backend failures when run from admin routes or worker/job processors.
- Store proxy omits untrusted browser-supplied `cart_id` until a trusted Medusa/storefront cart ownership resolver is added.
- Admin selected-product reindex rejects empty `product_ids`, and `AI_ASSISTANT_ENABLED` is an exact `true` opt-in.
- Adapter docs/tests live under `medusa-adapter/` and `docs/MEDUSA_ADAPTER_PHASE5.md`.

## Phase 6 — Production hardening

Status: implemented/prepared inside standalone `ai-assistant/` module.

Goal: agency-ready reusable module.

Implemented:

1. In-memory rate limiting for chat, tools, ingestion/admin, and feedback endpoints with env-driven limits.
2. Token strategy: public storefront chat remains tokenless; privileged ingestion/tool/admin/history endpoints require server token and reject browser-origin access.
3. Multi-tenant isolation: `tenant_id` request/payload support, mandatory `store_id` + `locale` Qdrant filters, and tenant filtering for product fallback recommendations.
4. Security hardening: env-driven CORS, deterministic prompt-injection guardrail, PII/log redaction, safe add-to-cart proposal-only tooling, and no-hallucination enforcement for price/stock when live Medusa grounding is unavailable.
5. Observability: structured request/chat logs, request ids, latency headers/payload, tool-call counts, retrieval stats, and optional tracing/LangSmith env hooks.
6. Feedback endpoint/model and PostgreSQL/in-memory repository support.
7. Evaluation dataset for product recommendation, policy answer, price/stock grounding, and tenant isolation.
8. Dockerfile, compose profile/example, deployment docs, backup/restore notes, and operational runbooks.

Acceptance:

- module can be reused across projects with config only.

## Phase 7 — Real monorepo integration readiness

Status: installed integration in the current repository, pending review/validation before production enablement.

Prepared/installed:

1. `integration-plan/README.md` with step-by-step copy plan for Medusa adapter templates and audit reference for this repository.
2. Storefront widget module installed under `medusa-agency-boilerplate-storefront/src/modules/assistant` with safe browser/server token boundary and default-off public flag.
3. Backend adapter installed under `medusa-agency-boilerplate` with exact `AI_ASSISTANT_ENABLED=true` opt-in.
4. `e2e-checklist.md` covering chat/history, Markdown answer, recommendation, live price/stock, safe add-to-cart proposal, admin reindex/process/intents/stats, product update reindex intent, vector fallback, and security checks.
5. Safe smoke script example in `scripts/smoke_assistant.py`.
6. Root staging production-mode Compose has an optional `ai-assistant` profile; real production launch still requires review, secrets, DB/Qdrant decisions, backups, rate limiting, and worker scheduling.

## Remaining gaps before real production launch

- Review/validate the installed backend adapter, storefront widget, and optional root Compose profile before production enablement.
- Decide production database/Qdrant ownership, backups, LLM/embedding provider credentials, rate limiting, and worker/cron scheduling.
- Replace in-memory rate limiting with Redis or gateway-level distributed limits for multi-replica production.
- Add managed migrations instead of relying only on startup schema initialization.
- Configure a production embedding/LLM provider if deterministic local responses are insufficient.
- Run full E2E against a real Medusa catalog, storefront, PostgreSQL, Qdrant, and optional Neo4j stack.

## Recommended immediate next task

Proceed to review/fixes for the installed Phase 5/7 integration, then validate the optional enabled smoke path before any production enablement. Keep the widget/backend adapter disabled by default until launch decisions and secrets are approved.
