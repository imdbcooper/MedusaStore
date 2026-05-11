# API Contract

Base path recommendation: `/api/v1` for the assistant backend.

When exposed through Medusa/Next proxy, recommended storefront path: `/api/assistant/*`.

## 1. Chat

### `POST /api/v1/chat`

Synchronous JSON response.

Request:

```json
{
  "message": "Help me choose a coffee machine under 50000 RUB",
  "session_id": "optional-uuid",
  "customer_id": "optional-medusa-customer-id",
  "cart_id": "optional-medusa-cart-id",
  "store_id": "default",
  "region_id": "reg_...",
  "currency_code": "rub",
  "locale": "ru",
  "mode": "auto",
  "page_context": {
    "type": "product",
    "product_id": "prod_...",
    "category_handle": "coffee-machines",
    "url": "/ru/products/example"
  }
}
```

Response:

```json
{
  "session_id": "uuid",
  "message_id": "uuid",
  "answer": "...",
  "intent": "product_discovery",
  "products": [],
  "citations": [],
  "actions": [],
  "tool_calls": [],
  "safety": {
    "grounded": true,
    "live_data_checked": true,
    "needs_human": false
  }
}
```

### `POST /api/v1/chat/stream`

SSE streaming response.

Request: same as `/chat`.

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

event: actions
data: {"actions":[...]}

event: done
data: {"done":true}
```

### `GET /api/v1/chat/history?session_id=...`

Returns session messages.

## 2. Ingestion

### `POST /api/v1/ingest/files`

Multipart upload for `.md`, `.txt`, `.pdf`, `.docx`, `.json`.

### `POST /api/v1/ingest/markdown/sync`

Sync mounted Markdown directory.

Request:

```json
{
  "store_id": "default",
  "locale": "ru",
  "path": "knowledge/"
}
```

### `POST /api/v1/ingest/medusa/products/sync`

Pull products from Medusa and index them.

Request:

```json
{
  "store_id": "default",
  "locale": "ru",
  "full": false,
  "product_ids": ["prod_..."]
}
```

### `POST /api/v1/ingest/payload/sync`

Pull CMS pages/posts/FAQ from Payload.

### `GET /api/v1/ingest/jobs/{job_id}`

Returns job status.

## 3. Admin

### `GET /api/v1/admin/stats`

Returns assistant stats:

- document count;
- indexed product count;
- active sessions;
- message count;
- failed jobs;
- vector collection status.

### `POST /api/v1/admin/reindex`

Triggers reindex.

Request:

```json
{
  "scope": "all|products|markdown|payload|documents",
  "store_id": "default",
  "locale": "ru",
  "force": false
}
```

## 4. Commerce tool endpoints

These may be internal-only.

### `POST /api/v1/tools/search-products`

Structured product search.

### `POST /api/v1/tools/product-live-data`

Fetch live Medusa data.

### `POST /api/v1/tools/cart/add-item`

Mutating endpoint. Must require explicit confirmation.

## 5. Health

### `GET /api/v1/health`

Basic health.

### `GET /api/v1/health/deep`

Checks PostgreSQL, Qdrant, Neo4j when enabled, LLM provider, and Medusa connectivity.

## 6. Errors

Standard shape:

```json
{
  "error": {
    "code": "MEDUSA_UNAVAILABLE",
    "message": "Could not fetch live product data.",
    "request_id": "...",
    "retryable": true
  }
}
```

Recommended codes:

- `VALIDATION_ERROR`
- `AUTH_REQUIRED`
- `RATE_LIMITED`
- `LLM_UNAVAILABLE`
- `RETRIEVAL_UNAVAILABLE`
- `MEDUSA_UNAVAILABLE`
- `INGESTION_FAILED`
- `UNSAFE_REQUEST`
