# Architecture

## 1. High-level topology

```text
Customer browser
  |
  v
Next.js Storefront
  |-- ChatWidget / ProductAssistant UI
  |-- optional /api/assistant proxy
  |
  v
AI Assistant Backend
  |-- Chat service
  |-- Intent router
  |-- Retrieval service
  |-- Commerce tools
  |-- Ingestion service
  |-- Session/history service
  |
  |-- PostgreSQL: sessions, messages, ingestion jobs, feedback
  |-- Qdrant: vector collections and payload filters
  |-- Neo4j: optional graph knowledge via LightRAG
  |-- Medusa backend: live commerce data
  |-- Payload CMS: content source
```

## 2. Module boundaries

### 2.1 `backend/`

Python/FastAPI service based on the existing `/home/somdev/Projects/RAG` architecture.

Responsibilities:

- chat REST/SSE/WebSocket APIs;
- retrieval orchestration;
- Medusa tool calls;
- ingestion jobs;
- chat history;
- safety/guardrails;
- health/stats.

Suggested structure:

```text
backend/
├── main.py
├── api/
│   ├── chat.py
│   ├── ingest.py
│   ├── admin.py
│   ├── health.py
│   └── schemas.py
├── core/
│   ├── config.py
│   ├── auth.py
│   ├── logging.py
│   ├── llm.py
│   ├── guardrails.py
│   └── prompts.py
├── retrieval/
│   ├── base.py
│   ├── markdown.py
│   ├── qdrant.py
│   ├── lightrag.py
│   └── rerank.py
├── ingestion/
│   ├── medusa_products.py
│   ├── payload_content.py
│   ├── markdown.py
│   ├── files.py
│   └── jobs.py
├── commerce/
│   ├── medusa_client.py
│   ├── product_tools.py
│   ├── cart_tools.py
│   ├── order_tools.py
│   └── policy_tools.py
├── chat/
│   ├── service.py
│   ├── router.py
│   ├── memory.py
│   └── response_builder.py
├── database/
│   ├── postgres.py
│   ├── migrations/
│   └── repositories.py
└── tests/
```

### 2.2 `medusa-adapter/`

TypeScript adapter code intended to be copied or packaged into Medusa backend.

Responsibilities:

- Store route for assistant proxy;
- Admin routes for reindex/stats;
- subscribers for product/content changes;
- workflows for durable reindex operations;
- optional module config.

### 2.3 `storefront-widget/`

Next.js/React UI components.

Responsibilities:

- floating chat widget;
- product page assistant;
- category guided selling assistant;
- cart helper;
- product cards/actions;
- SSE client hook.

### 2.4 `knowledge/`

Example Markdown knowledge base and documentation for store operators.

## 3. Runtime modes

### 3.1 Markdown mode

Use for small stores and quick setup.

```text
Markdown files -> chunking -> embeddings -> local/Qdrant vector collection -> chat
```

Can run without Neo4j.

### 3.2 Vector mode

Use Qdrant with payload filters.

```text
Medusa products + CMS + docs -> normalized docs -> Qdrant -> filtered semantic retrieval
```

### 3.3 Hybrid LightRAG mode

Use for larger catalogs and complex knowledge.

```text
docs/products -> LightRAG -> Qdrant vectors + Neo4j graph -> hybrid retrieval
```

This mirrors the existing RAG project.

## 4. Data freshness

Sources of reindex:

- manual admin reindex;
- scheduled sync;
- Medusa product subscribers;
- Payload content webhooks;
- file watcher/manual upload for Markdown.

Each source update should produce an `ingestion_job` and `source_version` record.

## 5. Recommended first build slice

```text
backend chat endpoint
  + Markdown ingestion
  + Medusa product export ingestion
  + live product tool
  + storefront widget
```

Avoid starting with all modes at once.
