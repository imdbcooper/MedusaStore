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
