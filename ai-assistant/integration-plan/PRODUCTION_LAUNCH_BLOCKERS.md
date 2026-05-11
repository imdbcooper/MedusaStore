# Production Launch Blockers

This file lists the real inputs and approvals needed before turning the prepared `ai-assistant/` module into a production launch. It is intentionally limited to planning and readiness; it does not authorize destructive actions or changes outside `ai-assistant/`.

## Current readiness snapshot

Prepared and validated in `ai-assistant/`:

- Standalone FastAPI assistant implementation exists.
- Medusa adapter templates are copy-ready under `ai-assistant/medusa-adapter/`.
- Production deployment docs and operational runbooks exist under `ai-assistant/docs/`.
- Exact integration copy maps now exist under `ai-assistant/integration-plan/`.
- The preferred first browser path is `POST /store/assistant/chat` through the Medusa adapter; this avoids exposing server tokens to the browser and matches the existing production Caddy `/store/*` route.

Current integration patch status after explicit approval:

- Assistant service has a root production Compose profile artifact, but remains disabled unless `AI_ASSISTANT_ENABLED=true` and the `ai-assistant` profile are used.
- Adapter files are copied into the real Medusa backend and middleware is merged for admin auth/validation.
- A minimal storefront widget is implemented and gated by `NEXT_PUBLIC_AI_ASSISTANT_WIDGET_ENABLED=false` by default.
- Trusted anonymous-to-authenticated assistant session binding is implemented through a privileged server-to-server assistant endpoint and Medusa proxy bind call.
- Durable assistant reindex intents and a callable queue processor/admin drain are implemented for product freshness.
- Production data stores, external provider credentials, backup ownership, distributed rate limiting, and worker scheduling topology are still launch decisions.

## Blocker 1 — real secret values and env ownership

Required from the operator/infrastructure owner before launch:

| Secret/env | Owner decision needed | Notes |
| --- | --- | --- |
| `AI_ASSISTANT_API_TOKEN` | Generate strong production token. | Used by assistant privileged endpoints and Medusa server-side adapter. Do not commit. |
| `AI_ASSISTANT_SERVER_TOKEN` | Set to the same secret as `AI_ASSISTANT_API_TOKEN` or a deliberately equivalent server token. | Backend-only. Must never be `NEXT_PUBLIC_*`. |
| `ASSISTANT_POSTGRES_URI` | Choose production database host/user/password/db name. | Prefer separate `assistant` database/user or managed PostgreSQL. |
| `QDRANT_URL` | Choose Qdrant host/container/managed endpoint. | Required for vector mode; optional for markdown-only launch. |
| `QDRANT_API_KEY` | Decide whether Qdrant auth is enabled. | Required if managed/secured Qdrant uses API keys. |
| LLM provider key | Choose provider and provide key, for example `OPENAI_API_KEY`, `GOOGLE_API_KEY`, `ANTHROPIC_API_KEY`, or `POLZA_API_KEY`. | `LLM_PROVIDER=none` is possible for deterministic fallback, but production answer quality will be limited. |
| Embedding provider settings | Decide production embedding adapter/model/dimensions. | `hashing` is deterministic for dev/tests; production should use a real embedding path if vector mode is launched. |
| `AI_ASSISTANT_CORS_ORIGINS` | Explicit public/admin origins. | Production-like wildcard origins are ignored by the assistant. |
| `MEDUSA_STORE_PUBLISHABLE_KEY` | Provide if Store API requires it for live product reads. | Public key semantics, but still should be managed intentionally. |
| `MEDUSA_ADMIN_API_TOKEN` | Decide if assistant needs admin APIs. | Not required for Store API product/cart reads unless future admin ingestion path needs it. |

Do not write real values into committed docs, env examples, logs, tests, screenshots, or assistant feedback payloads.

## Blocker 2 — service availability and topology

Production launch requires a concrete runtime topology for:

- AI Assistant FastAPI service on the production Docker network or managed runtime.
- PostgreSQL for assistant sessions/messages/sources/chunks/jobs/feedback.
- Qdrant for vector retrieval if `AI_ASSISTANT_RETRIEVAL_MODE=vector` or `auto` with vector enabled.
- Medusa backend reachability from assistant via Docker-network URL, expected `http://medusa-backend:9000` in current production Compose.
- LLM provider and embedding provider outbound network access from the assistant container/runtime.
- Optional Neo4j/LightRAG only if explicitly enabled; current safe default is disabled.

Current root production topology has these services only:

- `medusastore-db`;
- `medusastore-redis`;
- `medusastore-backend`;
- `medusastore-payload`;
- `medusastore-storefront`;
- `medusastore-caddy`.

A separate approved patch is required to add `ai-assistant`, Qdrant, assistant PostgreSQL ownership, volumes, healthchecks, and backup hooks to production infrastructure.

## Blocker 3 — Redis/gateway rate limit decision for multi-replica production

Current assistant hardening includes in-memory rate limiting for:

- public chat;
- tools;
- ingestion/admin;
- feedback.

This is acceptable for a single assistant process/container baseline. The selected first production step for this repository is one assistant replica plus Caddy/API-gateway limits. This is not enough for multi-replica production. Before horizontal scaling, choose one:

1. Add Redis-backed distributed rate limiting inside the assistant service.
2. Enforce rate limits at a gateway/reverse proxy/load balancer layer.
3. Keep one assistant replica and document that in production ops until distributed limits are implemented.

If Redis is used, decide whether to reuse production `medusastore-redis` or provision a separate assistant Redis namespace/instance. Reuse must avoid key collisions and noisy-neighbor risk.

## Blocker 4 — backend adapter review after copy

Explicit approval was granted and adapter templates have been copied into `medusa-agency-boilerplate/` for review. Before commit/launch, review the copied code and validate the backend.

The backend patch used `ai-assistant/integration-plan/MEDUSA_BACKEND_COPY_MAP.md` and must still include review of:

- copy/create adapter route/client/subscriber/workflow files;
- merge `src/api/middlewares.ts`, not overwrite it;
- add backend-only env names to the proper env contracts;
- verify typecheck/build;
- smoke `/admin/assistant/reindex`, `/admin/assistant/jobs/:id`, `/admin/assistant/stats`, `/store/assistant/chat`, and SSE passthrough;
- keep `cart_id` untrusted until a trusted ownership resolver is implemented;
- avoid reintroducing Delivery Hub/direct Yandex active checkout routes.

## Blocker 5 — storefront widget review after copy

Explicit approval was granted and a minimal widget has been created under `medusa-agency-boilerplate-storefront/`. It is disabled by default and must be reviewed/smoked before launch.

The storefront patch used `ai-assistant/integration-plan/STOREFRONT_WIDGET_COPY_MAP.md` and must still include review of:

- client widget module under `src/modules/assistant/`;
- one mount point in `src/app/[countryCode]/(main)/layout.tsx` unless another shell is approved;
- browser-safe endpoint handling for `/store/assistant/chat`;
- no public/server token exposure;
- safe Markdown rendering without raw HTML;
- product cards that respect live grounding;
- add-to-cart proposal flow that delegates to existing trusted cart functions after explicit user confirmation;
- browser smoke with DevTools verification that tokens are absent.

## Blocker 6 — migration and backup ownership

Before production launch, assign an owner and runbook for:

### Assistant PostgreSQL

- Whether startup auto-schema initialization is acceptable for first production launch.
- Whether `SCHEMA_SQL` from `backend/app/database/postgres.py` must be extracted into managed migrations first.
- Backup schedule and restore procedure.
- Retention period for sessions/messages/feedback.
- PII/security review for chat logs and feedback comments.

### Qdrant

- Snapshot schedule and retention.
- Restore procedure and tested reindex fallback.
- Collection naming policy for single-collection vs per-store collections.
- Tenant/store/locale filter validation before enabling vector mode in production.

### Optional Neo4j/LightRAG

- Keep disabled unless there is a specific launch requirement.
- If enabled, align Neo4j backups with Qdrant and PostgreSQL indexing windows.

## Blocker 7 — product freshness worker scheduling decision

Adapter subscribers now create lightweight reindex intents and avoid direct product fetching/indexing in Medusa event hot paths. The assistant backend persists those intents in `assistant_reindex_intents`, coalesces broad catalog events by `coalescing_key`, and exposes a processor through `POST /api/v1/admin/reindex/process` plus Medusa admin proxy `POST /admin/assistant/reindex/process`.

Production launch still needs an operator decision for how that processor runs continuously:

- dedicated worker process calling `process_pending()`;
- cron/scheduler calling the Medusa or assistant process endpoint;
- manual/admin drain only for a limited smoke launch.

Do not claim fully automatic real-time product freshness in production until the chosen worker/scheduler path is deployed and smoked.

## Blocker 8 — acceptance data and smoke fixtures

Before launch, provide or confirm:

- real product handle for production product-page assistant smoke;
- store id, tenant id if used, locale `ru`, region id, and currency `rub` expectations;
- at least one policy/FAQ prompt that should be answered from Markdown knowledge;
- at least one product discovery prompt expected to return a known product card;
- admin auth method for reindex smoke without exposing credentials;
- decision whether public feedback is enabled at launch.

## Resolved production-critical hardening in current uncommitted patch

- Anonymous storefront chat remains browser-safe and session-based.
- Authenticated customer binding is server-to-server only: browser sends `session_id`, Medusa derives customer identity from authenticated context, and assistant rejects browser-origin bind calls.
- Rebinding the same customer is idempotent; binding a different customer is rejected without an explicit future admin override.
- Product reindex/delete intents are durable assistant records with bounded retry/backoff and coalescing for broad category/collection changes.
- Subscribers do not run `.run()` workflows or inline product ingestion.

## Safe next actions

The next safe non-destructive step is review of this integration patch without commit:

- copied backend adapter files under `medusa-agency-boilerplate/src/api/*/assistant`, `src/lib`, `src/modules/assistant-runtime.ts`, `src/subscribers`, and `src/workflows`;
- widget files under `medusa-agency-boilerplate-storefront/src/modules/assistant` and the gated mount in the main layout;
- root Compose/deploy/env docs for the disabled-by-default `ai-assistant` profile;
- managed migration artifact `ai-assistant/migrations/001_initial_schema.sql`.

Do not run destructive database migrations or deploy until review approves the patch and real production env ownership is confirmed.
