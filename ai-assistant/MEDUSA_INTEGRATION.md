# Medusa Integration Plan

## 1. Integration approach

Keep the assistant as a separate service. Add a thin Medusa adapter for commerce-safe access and indexing events.

```text
Medusa backend
  -> store assistant proxy route
  -> admin assistant routes
  -> subscribers for product changes
  -> workflows for reindexing
  -> service/client for AI backend
```

Phase 5 implements this as copy-ready templates in [`medusa-adapter/`](./medusa-adapter/) and docs in [`docs/MEDUSA_ADAPTER_PHASE5.md`](./docs/MEDUSA_ADAPTER_PHASE5.md). The templates are not installed into the real Medusa backend until explicitly approved.

## 2. Proposed Medusa backend files

Target location after implementation/copy into a real Medusa backend:

```text
medusa-agency-boilerplate/src/
├── api/
│   ├── store/assistant/chat/route.ts
│   ├── admin/assistant/
│   │   ├── reindex/route.ts
│   │   ├── stats/route.ts
│   │   └── jobs/[id]/route.ts
│   └── middlewares.ts          # merge assistant admin route auth into existing file
├── lib/
│   ├── assistant-client.ts
│   ├── config.ts
│   └── route-utils.ts
├── subscribers/
│   ├── _assistant-product-event.ts
│   ├── assistant-product-created.ts
│   ├── assistant-product-updated.ts
│   ├── assistant-product-deleted.ts
│   ├── assistant-product-variant-updated.ts
│   ├── assistant-product-category-updated.ts
│   └── assistant-product-collection-updated.ts
├── workflows/
│   ├── assistant-reindex-product.ts
│   └── assistant-reindex-all-products.ts
└── modules/
    └── assistant-runtime.ts
```

## 3. Store route

### `POST /store/assistant/chat`

Responsibilities:

- accept storefront chat requests;
- attach trusted Medusa context where available:
  - customer id if authenticated;
  - region id;
  - locale;
  - page context;
- omit browser-supplied `cart_id` by default because request body cart context is untrusted;
- if `session_id` is present and Medusa authenticated customer context is available, call AI Assistant backend `POST /api/v1/admin/sessions/bind` before chat;
- call AI Assistant backend `POST /api/v1/chat` without trusting or forwarding browser-supplied `customer_id`;
- stream response back to frontend when the request accepts `text/event-stream` by proxying `POST /api/v1/chat/stream`;
- never expose internal assistant token to browser.

The route uses `AI_ASSISTANT_SERVER_TOKEN` only inside the server-side typed client. `customer_id` is derived from Medusa `auth_context` and sent only to the privileged bind endpoint, never accepted from the browser payload. If cart-aware answers are needed in a real copy, add a trusted cart resolver that derives/validates cart ownership from Medusa/storefront server context before forwarding cart context. Until then, forward `cart_id: null` or omit it.

## 4. Admin routes

### `POST /admin/assistant/reindex`

Queues indexing intent for the worker/processor.

Supported template scopes:

- `scope="products"` with non-empty `product_ids` -> selected products;
- `scope="all"` or `force=true` -> full product reindex.

Requests with `scope="products"`, `force=false`, and an empty `product_ids` array return `400` with `AI_ASSISTANT_PRODUCT_IDS_REQUIRED`.

### `POST /admin/assistant/reindex/process`

Drains the durable assistant reindex queue for smoke tests, cron, or a dedicated worker process. The route calls assistant backend `POST /api/v1/admin/reindex/process` and returns processed counts/status.

### `GET /admin/assistant/reindex/intents`

Returns assistant queue status/stats through assistant backend `GET /api/v1/admin/reindex/intents`.

### `GET /admin/assistant/stats`

Returns assistant operational stats from AI backend `GET /api/v1/admin/stats`.

### `GET /admin/assistant/jobs/:id`

Returns assistant ingestion job status from `GET /api/v1/ingest/jobs/{job_id}`.

Admin routes should be protected by Medusa admin auth middleware. The template includes a `src/api/middlewares.ts` merge example using `authenticate("user", ["session", "bearer", "api-key"])`.

## 5. Subscribers

Use subscribers to keep index fresh. Phase 5 templates include:

- `product.created` -> selected product reindex;
- `product.updated` -> selected product reindex;
- `product.deleted` -> delete selected product source from vector index;
- `product-variant.updated` -> owning product reindex;
- `product-category.updated` -> broad all-products stale-marker/reindex intent because category membership/text can affect many products;
- `product-collection.updated` -> broad all-products stale-marker/reindex intent because collection membership/text can affect many products.

Important: subscribers enqueue lightweight intent only. They do not run workflows, do not call direct product ingestion, do not do heavy product fetching/indexing inline, and do not create an event loop back into Medusa product writes. The copied implementation schedules a fire-and-forget enqueue call to the assistant backend durable intent endpoint and logs failures without blocking the Medusa event hot path.

Category/collection subscribers use reason/event id metadata and a stable coalescing key for broad catalog events. The assistant backend persists these intents in `assistant_reindex_intents` and coalesces repeated pending broad events before a separate worker/admin drain runs full catalog reindex.

Price and inventory events should generally mark documents stale or refresh payload hints in a future hardening pass, but live answers still need Phase 3 live Medusa tool calls.

## 6. Workflows

The durable worker path is assistant-side. Medusa adapter subscribers/admin routes enqueue intents; `POST /admin/assistant/reindex/process` drains them by calling assistant backend `POST /api/v1/admin/reindex/process`. This keeps Medusa event subscribers lightweight while still providing a practical admin smoke path.

Processor behavior:

1. Claims pending intents with bounded `limit`.
2. Runs selected product reindex, all-products reindex, or delete-source action.
3. Persists `completed` or retry/error status.
4. Retries failures up to `max_attempts` using `retry_backoff_seconds`.
5. Exposes queue stats through `/admin/assistant/reindex/intents` and assistant stats.

Workflow templates remain as optional Medusa-native examples for teams that want to wire Medusa workflows into their own scheduler, but subscribers and the default admin queue route do not call `.run()` directly.

## 7. Typed AI Assistant backend client

The adapter includes `src/lib/assistant-client.ts` with typed methods:

- `bindSession(payload)` -> `POST /api/v1/admin/sessions/bind`;
- `chat(payload)` -> `POST /api/v1/chat`;
- `streamChat(payload)` -> `POST /api/v1/chat/stream` with SSE passthrough response;
- `enqueueReindexIntent(payload)` -> `POST /api/v1/admin/reindex/intents`;
- `listReindexIntents(params)` -> `GET /api/v1/admin/reindex/intents`;
- `processReindexQueue(payload)` -> `POST /api/v1/admin/reindex/process`;
- `reindex(payload)` -> `POST /api/v1/ingest/medusa/products/sync`;
- `deleteProductFromIndex(input)` -> `DELETE /api/v1/ingest/vector/source`;
- `stats()` -> `GET /api/v1/admin/stats`;
- `jobStatus(jobId)` -> `GET /api/v1/ingest/jobs/{job_id}`.

Client behavior:

- sends `Authorization: Bearer ${AI_ASSISTANT_SERVER_TOKEN}` server-to-server;
- uses `AI_ASSISTANT_TIMEOUT_MS` and aborts slow requests;
- converts failed responses/network timeouts into typed retryable/non-retryable errors;
- forwards only safe request metadata headers such as request id/user agent/forwarded-for.

## 8. Required environment variables

In Medusa backend:

```env
AI_ASSISTANT_BASE_URL=http://ai-assistant:8000/api/v1
AI_ASSISTANT_SERVER_TOKEN=replace-me
AI_ASSISTANT_TIMEOUT_MS=60000
AI_ASSISTANT_ENABLED=true
```

`AI_ASSISTANT_ENABLED` is an exact opt-in: only the literal value `true` enables the adapter. `AI_ASSISTANT_SERVER_TOKEN` must match standalone assistant backend `AI_ASSISTANT_API_TOKEN`.

## 9. Safety rules

- Do not let assistant bypass Medusa authorization.
- Do not trust customer-provided `customer_id`; derive it from Medusa auth context when available and bind via the privileged assistant endpoint.
- Do not forward browser-provided `cart_id`; validate cart ownership in a trusted resolver before any future cart context forwarding or cart mutation flow.
- Do not allow direct browser calls to privileged assistant endpoints.
- Do not mutate cart/order state from chat generation alone.
- Do not expose `AI_ASSISTANT_SERVER_TOKEN` in responses, logs, docs examples, or storefront code.

## 10. Testing after copy

Use the smoke commands in [`docs/MEDUSA_ADAPTER_PHASE5.md`](./docs/MEDUSA_ADAPTER_PHASE5.md):

1. Start assistant backend with `AI_ASSISTANT_API_TOKEN`.
2. Start Medusa with the adapter env contract.
3. Call `POST /admin/assistant/reindex` for full and selected product sync.
4. Call `GET /admin/assistant/jobs/:id` for returned assistant job id.
5. Call `POST /store/assistant/chat` for JSON chat.
6. Call `POST /store/assistant/chat` with `Accept: text/event-stream` for SSE passthrough.

## 11. Implementation reference

Use existing patterns in this repo:

- `src/api/store/.../route.ts` for Store API route shape.
- `src/api/admin/.../route.ts` for Admin API route shape.
- `src/api/middlewares.ts` for admin auth and validation middleware.
- `src/subscribers/*` for event subscribers.
- `src/workflows/*` for workflow style and tests.
