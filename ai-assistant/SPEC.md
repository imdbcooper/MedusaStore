# Specification: Medusa AI Shopping Assistant

## 1. Purpose

Create a reusable intelligent shopping assistant module for Medusa-based e-commerce projects. The assistant must understand the product catalog, store policies, wiki/guides, and live commerce state so it can help customers decide what to buy and guide them toward checkout.

The module must work in two tiers:

1. **Small store mode** — Markdown/wiki files plus lightweight retrieval.
2. **Large store mode** — vector/hybrid RAG using Qdrant and optionally Neo4j/LightRAG.

The existing `/home/somdev/Projects/RAG` project is the strongest local foundation and should be reused conceptually and, where practical, by code extraction/adaptation.

## 2. Non-goals

- Do not make the LLM/RAG layer the source of truth for prices, inventory, discounts, delivery, payments, or order status.
- Do not build a one-off assistant hardcoded to a single store.
- Do not replace Medusa search, cart, checkout, or order flows.
- Do not let the assistant create orders/payments directly without Medusa workflow validation.

## 3. Core product principles

### 3.1 Medusa is source of truth

Live commerce data must be fetched from Medusa at answer time:

- product availability;
- variant availability;
- regional pricing;
- discounts/promotions;
- cart state;
- shipping options;
- payment state;
- order status.

RAG can provide explanatory knowledge, comparison context, feature descriptions, policy text, and recommendation reasoning.

### 3.2 Retrieval first, tools second, generation last

Answer pipeline:

```text
user query
  -> classify intent
  -> retrieve knowledge
  -> call commerce tools when live data is needed
  -> rerank/filter candidates
  -> generate grounded answer
  -> return structured product/action cards
```

### 3.3 Never hallucinate sellable facts

The assistant must avoid unsupported claims about:

- exact price;
- stock;
- delivery date;
- return eligibility;
- warranty;
- product compatibility;
- medical/legal/safety suitability.

For these it must either call a tool, cite knowledge, or say that the store should confirm.

## 4. Target users

### 4.1 Shopper

- Wants help choosing between products.
- Asks broad or vague questions.
- Needs comparisons, recommendations, policy answers, and checkout guidance.

### 4.2 Store operator/admin

- Wants to upload/update knowledge.
- Wants product indexing to stay fresh.
- Wants visibility into conversations, unresolved questions, and indexing status.

### 4.3 Agency/developer

- Wants to reuse the assistant across multiple Medusa projects.
- Wants clear adapters, env config, and deployment profiles.

## 5. Feature scope

### 5.1 MVP features

- Customer-facing chat widget in Next.js storefront.
- Streaming answers via SSE.
- Persistent `session_id` per visitor/session.
- Backend chat endpoint.
- Basic Markdown ingestion.
- Product ingestion from Medusa Store/Admin API into normalized text documents.
- Product recommendation answers with product cards.
- Tool for live product lookup from Medusa before showing price/stock.
- PostgreSQL chat history.
- Basic admin reindex endpoint.
- Health endpoint.

### 5.2 Advanced features

- Qdrant payload filtering by store, locale, category, brand, availability hints.
- LightRAG hybrid mode using Qdrant + Neo4j.
- Payload CMS ingestion for pages/posts/FAQ.
- Product update subscribers in Medusa.
- Cart tools: add item, remove item, inspect cart.
- User preference memory.
- Conversation feedback and quality evaluation.
- Human handoff.
- Multi-tenant store isolation.
- Admin dashboard widget.

## 6. Knowledge sources

### 6.1 Medusa product catalog

Required extracted fields:

- product id;
- handle;
- title;
- subtitle;
- description;
- collection;
- categories;
- tags;
- options;
- variants;
- SKU;
- material/attributes/metadata;
- images;
- sales channel/store scope;
- region/language scope where available.

### 6.2 Markdown/wiki

Recommended layout:

```text
knowledge/
├── faq/
├── guides/
├── product-guides/
├── policies/
└── compatibility/
```

Each Markdown file should support frontmatter:

```yaml
---
title: How to choose a coffee machine
source_type: guide
locale: ru
store_id: default
category_handles: [coffee-machines]
product_handles: []
tags: [selection, beginner]
updated_at: 2026-05-11
---
```

### 6.3 Payload CMS

Payload content should be ingested as:

- pages;
- posts/news;
- FAQ blocks;
- policy pages;
- landing page content;
- buying guides.

### 6.4 Uploaded docs

From existing RAG project, support:

- TXT;
- MD;
- PDF;
- DOCX;
- JSON.

## 7. GitHub-derived design inputs

The module should not clone any discovered GitHub repository wholesale, but it should intentionally absorb proven ideas from the best matching prototypes.

### 7.1 From `Hoanganhvu123/ShoppingGPT`

Adopt:

- semantic routing before retrieval/generation;
- explicit separation of shopping/product/policy/smalltalk flows;
- policy knowledge base as a separate retrieval source;
- product-search flow that can return structured candidates, not only text.

Do not adopt:

- Flask app structure;
- SQLite as the product source of truth;
- FAISS-only local retrieval as the primary production design;
- demo-specific hardcoded prompts and setup.

Target implementation:

```text
user query -> intent router -> route-specific retrieval/tools -> grounded response
```

### 7.2 From `Pukar77/Ecommerce-Agent`

Adopt:

- RAG + commerce tools as separate layers;
- stock/live-data check as a tool, not as embedded knowledge;
- agent-style decision flow where the assistant can decide when live commerce data is required;
- Qdrant as a production-friendly vector database option.

Do not adopt:

- Streamlit as storefront UI;
- Supabase inventory model;
- simulated purchase by directly decrementing stock;
- any checkout flow outside Medusa.

Target implementation:

```text
retrieved recommendation candidates -> Medusa live-data tools -> final recommendation
```

### 7.3 From `Vibhanshu-Rana-01/shopify-RAG-chatbot`

Adopt:

- embeddable storefront chat widget concept;
- product sync loop pattern;
- simple FastAPI backend shape;
- startup/manual sync operations;
- product + FAQ assistant positioning.

Do not adopt:

- Shopify-specific connector;
- ChromaDB local persistence as the main scalable design;
- direct browser access to privileged backend tokens.

Target implementation:

```text
Medusa product sync -> normalized product documents -> assistant index
```

### 7.4 From `VariableVic/medusa-ai-assistant`

Adopt:

- Medusa AI integration style;
- Medusa route/widget separation;
- tool/function-calling mindset;
- admin extension idea for future assistant operations.

Do not adopt:

- admin-only assistant scope;
- order-return-specific domain logic;
- non-RAG flow as the main customer assistant architecture.

Target implementation:

```text
Medusa adapter routes + optional admin widget -> AI backend service
```

### 7.5 From local `/home/somdev/Projects/RAG`

Adopt as the primary backend foundation:

- FastAPI service structure;
- `/chat`, `/chat/stream`, WebSocket concepts;
- PostgreSQL chat history;
- ingestion jobs;
- Qdrant vector storage;
- optional Neo4j/LightRAG hybrid retrieval;
- health checks;
- auth/rate-limit patterns;
- multi-provider LLM configuration.

Adjust for commerce:

- add Medusa product ingestion;
- add product metadata payload filters;
- add live commerce tools;
- return structured product/action cards;
- enforce no-hallucination rules for sellable facts.

## 8. Runtime architecture

```text
Next.js Storefront
  -> /api/assistant proxy or direct AI API
  -> AI Assistant Backend
      -> session store / chat history
      -> intent router
      -> retriever
      -> commerce tools
      -> LLM
      -> structured response
  -> Medusa backend for live commerce data
  -> Qdrant/Neo4j/PostgreSQL for knowledge and history
```

## 9. Intent classes

The intent router should classify into at least:

- `smalltalk` — greetings and generic chat.
- `product_discovery` — broad shopping help.
- `product_search` — user asks for products matching constraints.
- `product_compare` — compare known products.
- `product_detail` — explain one product.
- `compatibility` — whether product fits another product/use case.
- `policy` — delivery, payment, return, warranty.
- `cart_help` — questions about current cart.
- `order_help` — order status, only if authenticated.
- `handoff` — needs human support.
- `unsafe_or_restricted` — requires refusal or careful answer.

Best practice from GitHub research: borrow semantic routing idea from ShoppingGPT, but avoid hardcoded regex-only routing for production.

## 9. Commerce tools

Required tools:

### `search_products`

Search products by structured filters and semantic intent.

Inputs:

- query;
- category;
- budget;
- region_id;
- currency_code;
- locale;
- constraints;
- limit.

Outputs:

- product candidates with product ids and handles;
- reason snippets;
- confidence.

### `get_product_live_data`

Fetch current product/variant state from Medusa.

Outputs:

- price;
- currency;
- inventory/availability;
- options;
- variants;
- thumbnail;
- product URL.

### `compare_products`

Compare selected products using RAG knowledge plus live Medusa data.

### `get_policy_answer`

Retrieve policy answer from Markdown/Payload/RAG.

### `get_cart_state`

Read current cart via Medusa.

### `add_to_cart`

Add selected variant to cart. Must require explicit user confirmation before mutation.

### `handoff_to_human`

Create support event or return handoff instructions.

## 10. Response format

The backend should return both natural-language text and structured UI payloads.

```json
{
  "session_id": "uuid",
  "message_id": "uuid",
  "answer": "Text answer for the shopper.",
  "intent": "product_discovery",
  "citations": [
    {
      "source_type": "product",
      "source_id": "prod_123",
      "title": "Product title",
      "url": "/products/example"
    }
  ],
  "products": [
    {
      "id": "prod_123",
      "handle": "example",
      "title": "Example",
      "thumbnail": "https://...",
      "price": "4990 RUB",
      "availability": "in_stock",
      "reason": "Fits your stated budget and use case."
    }
  ],
  "actions": [
    {
      "type": "add_to_cart",
      "label": "Add to cart",
      "payload": { "variant_id": "variant_123", "quantity": 1 }
    }
  ],
  "safety": {
    "grounded": true,
    "live_data_checked": true
  }
}
```

## 11. Streaming protocol

Use SSE as the default storefront protocol.

Events:

```text
event: session
data: {"session_id":"...","message_id":"..."}

event: token
data: {"chunk":"..."}

event: products
data: {"products":[...]}

event: citations
data: {"citations":[...]}

event: done
data: {"done":true}

event: error
data: {"message":"...","code":"..."}
```

The existing RAG project already supports SSE-like streaming and should be used as the implementation reference.

## 12. Security requirements

- Storefront must not expose AI service internal token.
- Use a Medusa/Next proxy or public scoped token for chat.
- Admin ingestion endpoints require admin authentication.
- Rate limit chat by IP/session/customer.
- Validate all tool inputs.
- Mutating tools require explicit user confirmation.
- Do not log secrets or full payment data.
- Support tenant/store isolation in every query.
- CORS must be restricted in production.

## 13. Observability

Minimum:

- request id;
- session id;
- intent;
- retriever mode;
- token usage;
- latency;
- tool calls;
- product ids recommended;
- grounding/citation count;
- user feedback.

Optional:

- LangSmith/OpenTelemetry tracing;
- prompt/version tracking;
- offline evaluation dataset.

## 14. Evaluation criteria

The module is acceptable when:

- It can answer product-selection questions using indexed knowledge.
- It checks live Medusa data before showing price/stock.
- It returns structured product cards.
- It streams text in the storefront.
- It stores chat history in PostgreSQL.
- It can reindex at least Markdown and Medusa products.
- It does not hallucinate unavailable products in basic tests.
- It passes backend tests and storefront type/lint checks.

## 15. Recommended first implementation

Start by copying/adapting the existing RAG backend architecture into `ai-assistant/backend`, then add Medusa-specific ingestion/tools.

Do not start by cloning one GitHub project wholesale. The GitHub projects are useful references, but the local RAG service is more mature for this use case.
