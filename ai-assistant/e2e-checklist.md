# AI Assistant E2E Checklist

Use this checklist after copying the adapter/widget into a real Medusa + Next.js environment.

## Storefront chat

- [ ] Chat launcher is visible and keyboard-accessible.
- [ ] Chat opens without exposing `AI_ASSISTANT_API_TOKEN` or `AI_ASSISTANT_SERVER_TOKEN` in browser bundle/network responses.
- [ ] Anonymous `assistant_session_id` persists between page reloads.
- [ ] A policy question returns a Markdown-formatted answer.
- [ ] Citations render for FAQ/policy answers.

## Product recommendation

- [ ] Product-discovery prompt returns `products[]` with id, title, handle, URL/thumbnail where available.
- [ ] Recommendations are filtered by `store_id`, `locale`, and `tenant_id` if configured.
- [ ] No product from another tenant/store/locale appears.

## Live commerce grounding

- [ ] Price/stock is shown only when `safety.live_data_checked=true`.
- [ ] `tool_calls[]` contains `medusa_get_product_live_data` and inventory/price tool calls before price/stock appears.
- [ ] If Medusa is down, cards show `price=null` and `availability=unknown`.
- [ ] Payment/order/delivery-date claims are absent unless grounded in retrieved policy or live tools.

## Cart proposal safety

- [ ] Add-to-cart prompt returns `add_to_cart_proposal` only.
- [ ] Proposal payload has `requires_confirmation=true`.
- [ ] Assistant backend does not mutate cart.
- [ ] Storefront uses its existing trusted cart flow after user confirmation.

## Admin and ingestion

- [ ] `POST /admin/assistant/reindex` requires Medusa admin auth.
- [ ] Full reindex creates a successful assistant ingestion job.
- [ ] Selected product reindex rejects empty `product_ids`.
- [ ] `GET /admin/assistant/jobs/:id` returns job status.

## Product update freshness

- [ ] Product create/update/delete subscriber enqueues a lightweight reindex intent.
- [ ] Variant update maps to owning product reindex.
- [ ] Category/collection update creates a broad stale-marker/full-reindex intent for a debounced worker.

## Vector fallback

- [ ] With Qdrant available, `mode=vector` uses Qdrant filters.
- [ ] With Qdrant unavailable and `mode=auto`, answer falls back to Markdown and includes a safety note.
- [ ] With Qdrant unavailable and `mode=vector`, caller receives a retrieval-unavailable status/error.

## Security/observability

- [ ] Browser direct call to `/api/v1/ingest/*` with `Origin` is rejected.
- [ ] Rate limiting returns `429` and `Retry-After` for excessive chat requests.
- [ ] Responses include `X-Request-ID`.
- [ ] Logs redact emails, phones, cards, auth tokens, and API keys.
- [ ] Feedback endpoint stores ratings/comments with PII redaction.
