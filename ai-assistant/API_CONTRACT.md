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
    "needs_human": false,
    "medusa_available": true,
    "status": "ok",
    "notes": []
  }
}
```

Product cards may include `price` and concrete `availability` only after `tool_calls` contains successful live Medusa checks such as `medusa_get_product_live_data`, `medusa_get_price_and_variants`, and `medusa_check_inventory`. If Medusa is unavailable, product suggestions may remain, but `price` must be `null`, `availability` must be `unknown`, and `safety.live_data_checked` must be `false` with a status note.

Add-to-cart chat actions are proposals only. A chat response may return `actions[].type = "add_to_cart_proposal"` with `payload.requires_confirmation = true`; the assistant must not mutate the cart from chat generation alone.

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

Fetch live Medusa data for the requested product ids. This is protected by `AI_ASSISTANT_API_TOKEN` and should be treated as internal/server-side.

Request:

```json
{
  "product_ids": ["prod_..."],
  "region_id": "reg_...",
  "currency_code": "rub"
}
```

Response:

```json
{
  "products": [],
  "live_data_checked": true
}
```

### `POST /api/v1/tools/cart/add-item`

Proposal-only add-to-cart endpoint for Phase 3. Direct cart mutation through the assistant API is blocked until trusted Medusa cart ownership/session validation is implemented.

Request:

```json
{
  "cart_id": "cart_...",
  "variant_id": "variant_...",
  "quantity": 1,
  "confirmed": false
}
```

When `confirmed` is `false`, the endpoint returns `confirmation_required` and `mutated=false`. When `confirmed` is `true`, Phase 3 still returns `unsupported_until_ownership_validation` and `mutated=false`; callers should treat chat `add_to_cart_proposal` actions as UI proposals only, not as permission to mutate arbitrary cart ids.

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
