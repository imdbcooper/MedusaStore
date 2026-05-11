# Implementation Checklist

## Backend

- [ ] Create FastAPI app structure.
- [ ] Port config/auth/logging patterns from `/home/somdev/Projects/RAG`.
- [ ] Add PostgreSQL schema/migrations.
- [ ] Add chat REST endpoint.
- [ ] Add chat SSE endpoint.
- [ ] Add session/message persistence.
- [ ] Add Markdown ingestion.
- [ ] Add Qdrant retriever.
- [ ] Add optional LightRAG retriever.
- [ ] Add Medusa client.
- [ ] Add product live-data tool.
- [ ] Add product recommendation response builder.
- [ ] Add health/deep-health endpoints.
- [ ] Add tests.

## Medusa adapter

- [x] Add store assistant proxy route.
- [x] Keep store proxy from forwarding untrusted browser-provided `cart_id` until a trusted resolver is added.
- [x] Add admin reindex route.
- [x] Reject selected-product reindex requests with empty `product_ids`.
- [x] Add admin stats route.
- [x] Add product subscribers as enqueue-only intent templates.
- [x] Add broad category/collection stale-marker guidance with debounce/coalescing requirements.
- [x] Add reindex workflows for admin/worker execution outside subscriber hot paths.
- [x] Make `AI_ASSISTANT_ENABLED` an exact `true` opt-in.
- [x] Add unit/integration tests/examples for adapter templates.

## Storefront

- [ ] Add assistant module directory.
- [ ] Add SSE client hook.
- [ ] Add floating launcher.
- [ ] Add chat panel.
- [ ] Add product suggestion cards.
- [ ] Add citations UI.
- [ ] Add product page quick prompts.
- [ ] Add cart context.
- [ ] Add error and feedback states.

## Knowledge/content

- [ ] Add example `knowledge/faq`.
- [ ] Add example `knowledge/guides`.
- [ ] Add product document normalizer.
- [ ] Add Payload content loader.

## Production

- [ ] Add Dockerfile.
- [ ] Add docker compose AI profile.
- [ ] Add rate limiting.
- [ ] Restrict CORS.
- [ ] Add tracing/metrics.
- [ ] Add evaluation test set.
- [ ] Add deployment documentation.
