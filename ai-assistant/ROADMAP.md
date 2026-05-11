# Roadmap

## Phase 0 — Specification checkpoint

Status: current directory.

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

## Phase 6 — Production hardening

Goal: agency-ready reusable module.

Tasks:

1. Rate limiting.
2. Auth/token strategy.
3. Multi-tenant filters.
4. Observability/tracing.
5. Feedback collection.
6. Evaluation dataset.
7. Docker compose profile.
8. Deployment docs.

Acceptance:

- module can be reused across projects with config only.

## Recommended immediate next task

Proceed to review/fixes for Phase 4, then commit in a separate subtask. Phase 5 should add Medusa adapter automation/subscribers only after Phase 4 review passes.
