# GitHub Research Summary

Research performed with GitHub repository search on 2026-05-11.

## 1. Findings

No repository was found that is a near-perfect fit for:

```text
Medusa v2 + Next.js storefront + customer-facing RAG shopping assistant + product sync + live price/inventory tools + cart actions + production deployment
```

The discovered projects are useful as references, but not as a direct base.

## 2. Relevant repositories

### `Hoanganhvu123/ShoppingGPT`

URL: `https://github.com/Hoanganhvu123/ShoppingGPT`

Useful ideas:

- semantic routing;
- separation of chitchat vs shopping/product/policy flows;
- SQLite product search tool;
- FAISS policy RAG;
- simple chat UI.

Limitations:

- no Medusa integration;
- no live price/inventory;
- no cart/checkout;
- demo/prototype architecture.

Apply to this module:

- Use semantic router pattern, but implement it as configurable intent routing rather than hardcoded demo logic.

### `VariableVic/medusa-ai-assistant`

URL: `https://github.com/VariableVic/medusa-ai-assistant`

Useful ideas:

- Medusa AI integration pattern;
- admin widget concept;
- backend route plus OpenAI/Vercel AI SDK integration;
- GPT function style.

Limitations:

- admin-facing return assistant, not storefront;
- no RAG/vector database;
- not a product discovery assistant.

Apply to this module:

- Use as reference for Medusa admin extension and route patterns only.

### `Annkkitaaa/Ecommerce-RAG-Chatbot`

URL: `https://github.com/Annkkitaaa/Ecommerce-RAG-Chatbot`

Useful ideas:

- FastAPI API around e-commerce RAG;
- semantic product search;
- order query examples;
- preprocessing pipeline.

Limitations:

- static CSV data;
- local pickle embeddings;
- no Medusa/live commerce;
- not production-ready.

Apply to this module:

- Reference simple API/CLI experimentation patterns only.

### `Pukar77/Ecommerce-Agent`

URL: `https://github.com/Pukar77/Ecommerce-Agent`

Useful ideas:

- RAG + tool-calling split;
- Qdrant usage;
- stock-check tool;
- purchase-like flow.

Limitations:

- Streamlit UI;
- Supabase stock instead of Medusa;
- purchase simulated by decrementing stock;
- no real checkout/order/payment safety.

Apply to this module:

- Reuse concept: RAG for knowledge + tools for live commerce facts.

### `Vibhanshu-Rana-01/shopify-RAG-chatbot`

URL: `https://github.com/Vibhanshu-Rana-01/shopify-RAG-chatbot`

Useful ideas:

- embeddable storefront widget;
- product sync loop;
- FastAPI backend;
- product + FAQ assistant shape.

Limitations:

- Shopify-specific;
- ChromaDB local persistence;
- not Medusa;
- limited production hardening.

Apply to this module:

- Use widget/product sync ideas, replace Shopify connector with Medusa adapter.

## 3. Best-practice synthesis

Use:

- semantic routing from ShoppingGPT;
- Medusa route/admin patterns from medusa-ai-assistant;
- tool-calling structure from Ecommerce-Agent;
- widget/sync idea from shopify-RAG-chatbot;
- robust backend base from local `/home/somdev/Projects/RAG`.

Do not:

- clone any discovered repo wholesale;
- store product truth in CSV/PDF only;
- simulate purchases outside Medusa;
- show price/stock from embeddings;
- rely on regex-only intent routing.

## 4. Final recommendation

The existing local RAG project is a better backend foundation than the GitHub prototypes. Build a new reusable `ai-assistant` module using the discovered repositories only as references for individual patterns.
