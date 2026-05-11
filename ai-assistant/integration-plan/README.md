# Real Monorepo Integration Plan

This plan prepares real integration without modifying `medusa-agency-boilerplate/` or `medusa-agency-boilerplate-storefront/` in this subtask.

## Phase A — Standalone assistant readiness

1. Start the assistant backend locally or in Docker.
2. Configure a strong `AI_ASSISTANT_API_TOKEN`.
3. Run Markdown ingestion.
4. Run Medusa product ingestion against a dev Medusa backend.
5. Verify `/api/v1/health/deep`.
6. Run the smoke scripts in `scripts/`.

## Phase B — Copy Medusa adapter templates

Copy from:

```text
ai-assistant/medusa-adapter/src/
```

Into the real Medusa backend `src/` tree:

```text
src/api/store/assistant/chat/route.ts
src/api/admin/assistant/reindex/route.ts
src/api/admin/assistant/stats/route.ts
src/api/admin/assistant/jobs/[id]/route.ts
src/lib/assistant-client.ts
src/lib/config.ts
src/lib/route-utils.ts
src/subscribers/_assistant-product-event.ts
src/subscribers/assistant-product-created.ts
src/subscribers/assistant-product-updated.ts
src/subscribers/assistant-product-deleted.ts
src/subscribers/assistant-product-variant-updated.ts
src/subscribers/assistant-product-category-updated.ts
src/subscribers/assistant-product-collection-updated.ts
src/workflows/assistant-reindex-product.ts
src/workflows/assistant-reindex-all-products.ts
src/modules/assistant-runtime.ts
```

Merge `medusa-adapter/src/api/middlewares.ts` into the real backend's existing `src/api/middlewares.ts`; do not overwrite unrelated middleware.

Required backend env:

```env
AI_ASSISTANT_ENABLED=true
AI_ASSISTANT_BASE_URL=http://ai-assistant:8000/api/v1
AI_ASSISTANT_SERVER_TOKEN=<same-as-AI_ASSISTANT_API_TOKEN>
AI_ASSISTANT_TIMEOUT_MS=60000
```

Security requirements:

- `AI_ASSISTANT_SERVER_TOKEN` stays server-side only.
- Store chat proxy must not forward untrusted browser `cart_id` until a trusted resolver is implemented.
- Admin routes use Medusa admin auth middleware.
- Product subscribers enqueue lightweight intents only.

## Phase C — Storefront widget connection

Preferred browser path:

```text
POST /api/assistant/chat/stream
```

or Medusa store proxy:

```text
POST {MEDUSA_BACKEND_URL}/store/assistant/chat
```

Widget integration steps:

1. Create `src/modules/assistant/` in the storefront.
2. Add a client hook that sends `message`, `session_id`, `store_id`, `locale`, `region_id`, `currency_code`, and safe `page_context`.
3. Store anonymous `assistant_session_id` in localStorage or a first-party cookie.
4. Render Markdown safely in assistant messages.
5. Render product cards from `products[]`.
6. Treat `add_to_cart_proposal` actions as UI proposals only; call existing storefront/Medusa cart flow after user confirmation.
7. Add feedback controls that call `/api/v1/feedback` through a safe same-origin proxy if needed.

## Phase D — E2E acceptance checklist

- Chat opens in storefront.
- Assistant returns Markdown answer.
- Product recommendation returns product card.
- Live price/stock check is visible in `tool_calls` and `safety.live_data_checked=true` before price/stock display.
- Add-to-cart proposal appears without unsafe assistant mutation.
- Admin reindex works from Medusa admin route.
- Product update subscriber creates a reindex intent.
- Vector retrieval failure falls back to Markdown in `auto` mode.
- Cross-tenant/store/locale data is not mixed.
- Privileged endpoints cannot be called directly from browser origins.

## Phase E — Post-copy smoke commands

From `ai-assistant/`:

```bash
AI_ASSISTANT_BASE_URL=http://localhost:8000/api/v1 \
AI_ASSISTANT_API_TOKEN=<token> \
python3 scripts/smoke_assistant.py
```

From Medusa adapter templates:

```bash
cd ai-assistant
node --test medusa-adapter/tests/*.test.mjs
```

After copying into the real backend, run that backend's normal typecheck/test/build commands before commit.
