# Medusa Integration Plan

## 1. Integration approach

Keep the assistant as a separate service. Add a thin Medusa adapter for commerce-safe access and indexing events.

```text
Medusa backend
  -> store assistant proxy route
  -> admin assistant routes
  -> subscribers for product changes
  -> workflows for reindexing
  -> service/client for AI backend
```

## 2. Proposed Medusa backend files

Target location after implementation:

```text
medusa-agency-boilerplate/src/
├── api/
│   ├── store/assistant/route.ts
│   └── admin/assistant/
│       ├── reindex/route.ts
│       ├── stats/route.ts
│       └── jobs/[id]/route.ts
├── subscribers/
│   ├── assistant-product-created.ts
│   ├── assistant-product-updated.ts
│   ├── assistant-product-deleted.ts
│   └── assistant-product-variant-updated.ts
├── workflows/
│   ├── assistant-reindex-product.ts
│   └── assistant-reindex-all-products.ts
└── modules/
    └── assistant-runtime.ts
```

## 3. Store route

### `POST /store/assistant/chat`

Responsibilities:

- accept storefront chat requests;
- attach trusted Medusa context:
  - customer id if authenticated;
  - cart id;
  - region id;
  - sales channel;
  - locale;
- call AI Assistant backend;
- stream response back to frontend if using SSE;
- never expose internal assistant token to browser.

## 4. Admin routes

### `POST /admin/assistant/reindex`

Triggers indexing jobs.

Scopes:

- all products;
- selected product ids;
- selected categories;
- Payload content;
- Markdown knowledge.

### `GET /admin/assistant/stats`

Returns assistant operational stats from AI backend.

## 5. Subscribers

Use subscribers to keep index fresh.

Events to consider:

- product created;
- product updated;
- product deleted;
- variant updated;
- price list updated;
- inventory item updated;
- collection/category updated.

Important: price and inventory events should generally mark documents stale or refresh payload hints, but live answers still need tool calls.

## 6. Workflows

Use Medusa workflows for durable reindex jobs.

Recommended workflow behavior:

1. Receive product ids/scope.
2. Fetch product data through Medusa Query/Services.
3. Normalize to assistant product document.
4. Send to assistant ingestion endpoint.
5. Record job id/status.
6. Retry on transient AI backend failure.

## 7. Medusa tools exposed to assistant

The assistant backend should call Medusa through a controlled server-side client.

Tools:

- `medusa_search_products`
- `medusa_get_product`
- `medusa_get_variants`
- `medusa_get_price_for_region`
- `medusa_check_inventory`
- `medusa_get_cart`
- `medusa_add_to_cart`
- `medusa_get_order_status`

Mutating tools:

- require explicit user confirmation;
- validate cart/customer ownership;
- go through Medusa APIs/workflows;
- emit audit events.

## 8. Required environment variables

In Medusa backend:

```env
AI_ASSISTANT_BASE_URL=http://ai-assistant:8000/api/v1
AI_ASSISTANT_SERVER_TOKEN=replace-me
AI_ASSISTANT_TIMEOUT_MS=60000
AI_ASSISTANT_ENABLED=true
```

## 9. Safety rules

- Do not let assistant bypass Medusa authorization.
- Do not trust customer-provided `customer_id`, `cart_id`, or `region_id` without validation.
- Do not allow direct browser calls to privileged assistant endpoints.
- Do not mutate cart/order state without explicit user action.

## 10. Implementation reference

Use existing patterns in this repo:

- `src/api/store/.../route.ts` for Store API route shape.
- `src/api/admin/.../route.ts` for Admin API route shape.
- `src/subscribers/*` for event subscribers.
- `src/workflows/*` for workflow style and tests.
