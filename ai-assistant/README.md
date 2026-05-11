# AI Assistant for Medusa Agency Boilerplate

Reusable intelligent shopping assistant module for Medusa-based e-commerce projects.

This directory currently contains the development specification and implementation contracts for a future module. It is intentionally separated from the existing Medusa backend/storefront code so the assistant can become a reusable package/service rather than a one-off customization.

## Goals

- Help shoppers choose products using catalog, guides, FAQ, policies, and live commerce data.
- Support two knowledge modes:
  - **Markdown/wiki mode** for small stores and fast launches.
  - **RAG/vector mode** for larger catalogs and knowledge bases.
- Reuse the existing `/home/somdev/Projects/RAG` LightRAG service patterns: FastAPI, Qdrant, Neo4j, PostgreSQL, streaming chat, ingestion, and chat history.
- Integrate cleanly with this monorepo:
  - Medusa backend as commerce source of truth.
  - Next.js storefront as customer-facing UI.
  - Payload CMS as content source.

## Documents

- [SPEC.md](./SPEC.md) — full development specification.
- [ARCHITECTURE.md](./ARCHITECTURE.md) — target architecture and module boundaries.
- [API_CONTRACT.md](./API_CONTRACT.md) — backend/API contracts.
- [DATA_MODEL.md](./DATA_MODEL.md) — PostgreSQL/Qdrant/Neo4j data contracts.
- [MEDUSA_INTEGRATION.md](./MEDUSA_INTEGRATION.md) — Medusa backend adapter plan.
- [STOREFRONT_WIDGET.md](./STOREFRONT_WIDGET.md) — Next.js widget plan.
- [ROADMAP.md](./ROADMAP.md) — implementation phases and acceptance criteria.
- [GITHUB_RESEARCH.md](./GITHUB_RESEARCH.md) — GitHub references and extracted best practices.
- [ENV.example](./ENV.example) — planned environment variables.

## Current implementation status

Phase 1 backend skeleton is implemented in [`backend/`](./backend/) with FastAPI health, chat, streaming chat, Markdown ingestion, in-memory test storage and optional PostgreSQL storage.

Phase 2 product ingestion is implemented inside this module without modifying the Medusa backend/storefront:

- [`POST /api/v1/ingest/medusa/products/sync`](./API_CONTRACT.md) reads products from Medusa Store API;
- products are normalized into `medusa_product` documents/chunks with product metadata payloads matching [`DATA_MODEL.md`](./DATA_MODEL.md);
- ingestion jobs and source indexing status are stored through the existing repository abstraction;
- chat responses can include structured product cards for product discovery/search questions.

Ingestion sync endpoints are protected by `AI_ASSISTANT_API_TOKEN`; call them with `Authorization: Bearer <token>` or `X-API-Key`. Required Medusa configuration is env-driven in [`ENV.example`](./ENV.example). The Store API request uses `MEDUSA_BACKEND_URL` and, when required by the Medusa instance, `MEDUSA_STORE_PUBLISHABLE_KEY`; `MEDUSA_ADMIN_API_TOKEN` is not sent to `/store/products`. Price and availability fields indexed from product payloads are hints only, so product cards do not expose them as factual `price`/`availability` while `live_data_checked=false`; live values must be checked through Medusa in a later phase before being presented as authoritative commerce facts.

## Recommended implementation direction

Build this as an independent assistant service plus adapters:

```text
ai-assistant/
├── backend/              # FastAPI assistant service, adapted from existing RAG project
├── medusa-adapter/       # Medusa API routes, subscribers, workflows
├── storefront-widget/    # Next.js/React customer chat widget
├── knowledge/            # Markdown/wiki example knowledge base
├── docs/                 # Operator/developer docs
└── contracts/            # API/schema contracts
```

The current files define the target module. Implementation should start after confirming the MVP scope in `ROADMAP.md`.
