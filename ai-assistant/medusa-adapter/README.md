# Medusa AI Assistant Adapter Template

This directory contains copy-ready Medusa backend templates for Phase 5. It does not modify the real Medusa backend. Copy files from `src/` into a Medusa v2 backend only after review.

## Environment contract

Add these variables to the Medusa backend runtime:

```env
AI_ASSISTANT_BASE_URL=http://ai-assistant:8000/api/v1
AI_ASSISTANT_SERVER_TOKEN=replace-with-server-token
AI_ASSISTANT_TIMEOUT_MS=60000
AI_ASSISTANT_ENABLED=true
```

`AI_ASSISTANT_ENABLED` is an exact opt-in: only the literal value `true` enables the adapter. `1`, `yes`, and `on` remain disabled.

`AI_ASSISTANT_SERVER_TOKEN` must match the standalone assistant backend `AI_ASSISTANT_API_TOKEN`. Never expose it to the browser. The Store route sends it server-to-server only.

## Copy map

Copy the adapter files into the real Medusa backend with the same relative paths:

```text
src/api/store/assistant/chat/route.ts
src/api/admin/assistant/reindex/route.ts
src/api/admin/assistant/reindex/process/route.ts
src/api/admin/assistant/reindex/intents/route.ts
src/api/admin/assistant/stats/route.ts
src/api/admin/assistant/jobs/[id]/route.ts
src/api/middlewares.ts                  # merge with an existing file instead of overwriting
src/lib/assistant-client.ts
src/lib/assistant-reindex-queue.ts
src/lib/config.ts
src/lib/route-utils.ts
src/modules/assistant-runtime.ts
src/subscribers/assistant-product-created.ts
src/subscribers/assistant-product-updated.ts
src/subscribers/assistant-product-deleted.ts
src/subscribers/assistant-product-variant-updated.ts
src/subscribers/assistant-product-category-updated.ts
src/subscribers/assistant-product-collection-updated.ts
src/subscribers/_assistant-product-event.ts
src/workflows/assistant-reindex-product.ts
src/workflows/assistant-reindex-all-products.ts
```

If the target backend already has `src/api/middlewares.ts`, merge only the assistant route entries and imports. Do not overwrite unrelated project middleware.

## Routes

- `POST /store/assistant/chat` binds an existing anonymous assistant session to the trusted Medusa customer when authenticated, then proxies storefront chat to `POST /api/v1/chat`.
- If the request `Accept` header contains `text/event-stream`, the Store route proxies `POST /api/v1/chat/stream` as SSE passthrough.
- `POST /admin/assistant/reindex` queues selected-product or full-product durable assistant intents.
- `POST /admin/assistant/reindex/process` drains/processes queued assistant intents for smoke, cron, or worker use.
- `GET /admin/assistant/reindex/intents` proxies queue status/stats.
- `GET /admin/assistant/stats` proxies assistant backend stats.
- `GET /admin/assistant/jobs/:id` proxies ingestion job status.

## Store identity and cart context safety

The store chat route intentionally does not forward browser-supplied `cart_id` or `customer_id`. The template destructures request `cart_id` as untrusted input, omits customer identity from chat payload, and uses `bindSession()` only with a customer id derived from Medusa authenticated context.

When copying into a real storefront/Medusa integration, add a trusted cart resolver before forwarding cart context. The resolver must derive or validate cart ownership from server-side Medusa/storefront context, such as an authenticated customer session, signed cart cookie, or Medusa-managed request context. Until that resolver exists, omit cart context or keep it `null`; do not trust a raw chat request body value.

## Subscribers and worker/job execution

Subscribers never do heavy indexing inline and never run workflows from the event hot path. They create lightweight enqueue intents only:

- `product.created` -> selected product reindex intent;
- `product.updated` -> selected product reindex intent;
- `product.deleted` -> selected product source deletion intent;
- `product-variant.updated` -> owning product reindex intent;
- `product-category.updated` -> broad all-products stale-marker/reindex intent;
- `product-collection.updated` -> broad all-products stale-marker/reindex intent.

Broad catalog events can affect many products, so category/collection subscribers use a stable coalescing key (`assistant:catalog:all-products`) and include reason/event id metadata. The assistant backend persists these intents in `assistant_reindex_intents`, coalesces repeated pending events, and processes them through `POST /api/v1/admin/reindex/process`.

Workflow templates remain available as optional Medusa-native examples, but the default adapter route queues assistant intents and the processor handles selected/all/delete actions with bounded attempts/backoff.

## Admin reindex validation

`POST /admin/assistant/reindex` rejects `scope="products"` requests with an empty `product_ids` array and returns `400` with `AI_ASSISTANT_PRODUCT_IDS_REQUIRED`. Use `scope="all"` or `force=true` for full catalog reindex.

## Testing after copy

1. Start the assistant backend with `AI_ASSISTANT_API_TOKEN` configured.
2. Start Medusa with the four adapter env variables above.
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

5. Drain queued work:

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

7. Check job status with the returned `assistant_job_id`:

```bash
curl http://localhost:9000/admin/assistant/jobs/<assistant_job_id> \
  -H 'Authorization: Bearer <admin-or-api-key>'
```

8. Test chat proxy from server-side/storefront code:

```bash
curl -X POST http://localhost:9000/store/assistant/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"Помоги выбрать товар","store_id":"default","locale":"ru","mode":"auto"}'
```

9. Test SSE passthrough:

```bash
curl -N -X POST http://localhost:9000/store/assistant/chat \
  -H 'Accept: text/event-stream' \
  -H 'Content-Type: application/json' \
  -d '{"message":"Подбери кофемашину","store_id":"default","locale":"ru","mode":"auto"}'
```

## Template limitations

- Event names match common Medusa v2 product events but should be verified against the exact Medusa version and custom modules in the target backend.
- Subscriber templates enqueue durable assistant intents but production still needs an operator-approved scheduler/worker/cron if automatic draining is required.
- The Store chat route trusts only server-derived customer context when present; cart ownership validation should remain in Medusa/storefront flows before any cart context forwarding or mutating cart action.
- Admin auth is represented through the middleware template and must be merged into the target backend middleware file.
