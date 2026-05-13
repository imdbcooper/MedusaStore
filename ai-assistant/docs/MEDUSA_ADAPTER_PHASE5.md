# Phase 5 Medusa Adapter Automation

Phase 5 adds a copy-ready Medusa backend adapter under `ai-assistant/medusa-adapter/`. The adapter remains a reusable template reference, and in the current repository it has also been installed into the real `medusa-agency-boilerplate/` backend for review/validation. Runtime remains disabled unless `AI_ASSISTANT_ENABLED=true` exactly.

## What the adapter provides

- Store proxy routes:
  - `POST /store/assistant/chat` -> `POST /api/v1/chat`;
  - `Accept: text/event-stream` -> SSE passthrough to `POST /api/v1/chat/stream`;
  - `GET /store/assistant/history` -> scoped assistant history proxy.
- Admin routes:
  - `POST /admin/assistant/reindex` queues durable intents;
  - `POST /admin/assistant/reindex/process` drains/processes queued intents;
  - `GET /admin/assistant/reindex/intents` returns queue status/stats;
  - `GET /admin/assistant/stats`;
  - `GET /admin/assistant/jobs/:id`.
- Product freshness subscribers:
  - product created;
  - product updated;
  - product deleted;
  - variant updated;
  - product category updated;
  - product collection updated.
- Durable assistant-side reindex intent queue plus callable processor:
  - reindex selected products;
  - reindex all products;
  - delete product source from vector index;
  - bounded retry on retryable assistant backend failures.
- Trusted anonymous-to-authenticated session bind through `POST /api/v1/admin/sessions/bind` when Medusa derives an authenticated customer.
- Typed server-side assistant client with timeout/error handling.

## Environment variables in Medusa

```env
AI_ASSISTANT_BASE_URL=http://ai-assistant:8000/api/v1
AI_ASSISTANT_SERVER_TOKEN=replace-with-server-token
AI_ASSISTANT_TIMEOUT_MS=60000
AI_ASSISTANT_ENABLED=true
```

`AI_ASSISTANT_ENABLED` is an exact opt-in. Only the literal value `true` enables the adapter; convenience boolean values like `1`, `yes`, or `on` are intentionally disabled.

`AI_ASSISTANT_SERVER_TOKEN` must match the assistant backend `AI_ASSISTANT_API_TOKEN`. It is used only server-to-server by the Medusa adapter and must never be returned to storefront clients.

## Copy instructions

For a new target project, copy files from `ai-assistant/medusa-adapter/src/` into the target Medusa backend `src/` with the same relative paths. In this repository, this copy has already been performed and should be treated as installed current state pending review/validation.

If the target backend already has `src/api/middlewares.ts`, merge the assistant middleware entries instead of overwriting the existing file:

- import `AdminAssistantReindexSchema` from `./admin/assistant/reindex/route`;
- import `AdminAssistantReindexProcessSchema` from `./admin/assistant/reindex/process/route`;
- add admin auth for `/admin/assistant/reindex`, `/admin/assistant/reindex/process`, `/admin/assistant/reindex/intents`, `/admin/assistant/stats`, and `/admin/assistant/jobs/:id`;
- add `validateAndTransformBody(AdminAssistantReindexSchema)` for `POST /admin/assistant/reindex`;
- add `validateAndTransformBody(AdminAssistantReindexProcessSchema)` for `POST /admin/assistant/reindex/process`.

## Store identity and cart context safety

The Store chat template treats browser-provided `cart_id` and `customer_id` as untrusted. It removes request body `cart_id`, does not forward browser `customer_id`, and calls `bindSession()` only when Medusa authenticated context yields a trusted customer id and the browser supplies an existing anonymous assistant `session_id`.

If a real integration needs cart-aware answers, add a trusted resolver in the Medusa backend or trusted storefront server boundary before forwarding cart context. That resolver must validate ownership against Medusa/session state, for example authenticated customer ownership, a signed storefront cart cookie, or another server-trusted Medusa context. Do not forward raw browser request body `cart_id`.

## Subscriber and workflow safety model

Subscriber templates are enqueue-intent only. They return quickly from the Medusa event hot path and must not run indexing workflows directly.

Current template behavior:

- product/variant subscribers create selected product reindex/delete intents with product id, action, reason, event id, and a product coalescing key;
- category/collection subscribers create broad catalog stale-marker/full-reindex intents with reason/event id and a stable `assistant:catalog:all-products` coalescing key;
- broad intents are intentionally separated from execution because a category/collection update can affect many products.

The current implementation calls the assistant durable intent endpoint in a fire-and-forget enqueue helper and stores pending work in `assistant_reindex_intents`. Repeated pending broad catalog events are coalesced by `assistant:catalog:all-products` before `POST /admin/assistant/reindex/process` or a dedicated worker drains the queue. This keeps full catalog sync out of category/collection subscriber execution.

## Admin reindex validation

`POST /admin/assistant/reindex` supports:

- `scope="products"` with non-empty `product_ids` -> selected products;
- `scope="all"` or `force=true` -> full product reindex.

Requests with `scope="products"`, `force=false`, and an empty product list return `400` with `AI_ASSISTANT_PRODUCT_IDS_REQUIRED`.

## Testing the adapter after copy

1. Start the assistant backend with `AI_ASSISTANT_API_TOKEN` configured.
2. Start Medusa with the adapter env contract above.
3. Reindex all products:

```bash
curl -X POST http://localhost:9000/admin/assistant/reindex \
  -H 'Authorization: Bearer <admin-or-api-key>' \
  -H 'Content-Type: application/json' \
  -d '{"scope":"all","store_id":"default","locale":"ru","force":true}'
```

4. Reindex selected products:

```bash
curl -X POST http://localhost:9000/admin/assistant/reindex \
  -H 'Authorization: Bearer <admin-or-api-key>' \
  -H 'Content-Type: application/json' \
  -d '{"scope":"products","product_ids":["prod_..."],"store_id":"default","locale":"ru"}'
```

5. Drain/process queued work for smoke:

```bash
curl -X POST http://localhost:9000/admin/assistant/reindex/process \
  -H 'Authorization: Bearer <admin-or-api-key>' \
  -H 'Content-Type: application/json' \
  -d '{"limit":10,"retry_backoff_seconds":60}'
```

6. Check queue status:

```bash
curl http://localhost:9000/admin/assistant/reindex/intents \
  -H 'Authorization: Bearer <admin-or-api-key>'
```

7. Check job status:

```bash
curl http://localhost:9000/admin/assistant/jobs/<assistant_job_id> \
  -H 'Authorization: Bearer <admin-or-api-key>'
```

8. Test scoped history proxy:

```bash
curl 'http://localhost:9000/store/assistant/history?session_id=assistant_session_id' \
  -H 'Content-Type: application/json'
```

9. Test JSON chat proxy:

```bash
curl -X POST http://localhost:9000/store/assistant/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"Помоги выбрать товар","store_id":"default","locale":"ru","mode":"auto"}'
```

10. Test SSE passthrough:

```bash
curl -N -X POST http://localhost:9000/store/assistant/chat \
  -H 'Accept: text/event-stream' \
  -H 'Content-Type: application/json' \
  -d '{"message":"Подбери кофемашину","store_id":"default","locale":"ru","mode":"auto"}'
```

## Safety notes

- Store routes do not expose `AI_ASSISTANT_SERVER_TOKEN` to the browser.
- Store chat route does not forward untrusted browser-supplied `cart_id` or `customer_id`.
- Store history route must remain scoped to the active assistant session and must not expose privileged assistant history/admin endpoints.
- Admin routes should live behind the Medusa admin auth middleware.
- Subscribers only enqueue lightweight intents and do not run workflows from the event hot path.
- Product deletion maps to a selected product source deletion intent; selected/all reindex network execution belongs to the worker/job workflow step.
- Category/collection updates should be coalesced/debounced as broad catalog stale-marker intents before full reindex execution.
- Live price/stock remains a Phase 3 assistant/Medusa tool concern; indexed product payload values remain hints only.

## Static checks

The adapter includes `node --test` static contract checks in `ai-assistant/medusa-adapter/tests/static-contract.test.mjs`. These checks validate expected file structure, route endpoint strings, env contract strings, subscriber/workflow separation, cart context safety, and selected-product validation without requiring a real Medusa backend.
