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

- [ ] Add store assistant proxy route.
- [ ] Add admin reindex route.
- [ ] Add admin stats route.
- [ ] Add product subscribers.
- [ ] Add reindex workflows.
- [ ] Add unit/integration tests.

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
