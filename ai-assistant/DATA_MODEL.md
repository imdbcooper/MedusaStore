# Data Model

## 1. PostgreSQL

PostgreSQL stores operational metadata, chat history, indexing status, feedback, and audit data. It should not store vector embeddings unless using pgvector as an optional lightweight mode.

### `assistant_sessions`

```sql
CREATE TABLE assistant_sessions (
  id UUID PRIMARY KEY,
  store_id TEXT NOT NULL DEFAULT 'default',
  customer_id TEXT NULL,
  cart_id TEXT NULL,
  locale TEXT NOT NULL DEFAULT 'ru',
  region_id TEXT NULL,
  channel TEXT NOT NULL DEFAULT 'storefront',
  tenant_id TEXT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `assistant_messages`

```sql
CREATE TABLE assistant_messages (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES assistant_sessions(id),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool', 'system')),
  content TEXT NOT NULL,
  intent TEXT NULL,
  citations JSONB NOT NULL DEFAULT '[]',
  products JSONB NOT NULL DEFAULT '[]',
  actions JSONB NOT NULL DEFAULT '[]',
  tool_calls JSONB NOT NULL DEFAULT '[]',
  token_usage JSONB NOT NULL DEFAULT '{}',
  latency_ms INTEGER NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `assistant_sources`

```sql
CREATE TABLE assistant_sources (
  id UUID PRIMARY KEY,
  store_id TEXT NOT NULL DEFAULT 'default',
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  title TEXT NOT NULL,
  uri TEXT NULL,
  content_hash TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'ru',
  metadata JSONB NOT NULL DEFAULT '{}',
  indexed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id, source_type, source_id, locale)
);
```

`source_type` values:

- `medusa_product`
- `medusa_variant`
- `payload_page`
- `payload_post`
- `markdown`
- `file`
- `policy`
- `faq`

### `assistant_ingestion_jobs`

```sql
CREATE TABLE assistant_ingestion_jobs (
  id UUID PRIMARY KEY,
  store_id TEXT NOT NULL DEFAULT 'default',
  job_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'indexing', 'completed', 'error', 'cancelled')),
  source_type TEXT NULL,
  source_id TEXT NULL,
  input JSONB NOT NULL DEFAULT '{}',
  result JSONB NOT NULL DEFAULT '{}',
  error TEXT NULL,
  started_at TIMESTAMPTZ NULL,
  finished_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `assistant_feedback`

```sql
CREATE TABLE assistant_feedback (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES assistant_sessions(id),
  message_id UUID NULL REFERENCES assistant_messages(id),
  store_id TEXT NOT NULL DEFAULT 'default',
  tenant_id TEXT NULL,
  locale TEXT NOT NULL DEFAULT 'ru',
  rating INTEGER NULL CHECK (rating BETWEEN 1 AND 5),
  label TEXT NULL,
  comment TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `assistant_user_preferences`

Optional durable user preference memory.

```sql
CREATE TABLE assistant_user_preferences (
  id UUID PRIMARY KEY,
  store_id TEXT NOT NULL DEFAULT 'default',
  customer_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  confidence NUMERIC NOT NULL DEFAULT 1,
  source_message_id UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id, customer_id, key)
);
```

## 2. Qdrant collections

Recommended separate collections:

- `assistant_products`
- `assistant_guides`
- `assistant_policies`
- `assistant_faq`
- `assistant_cms`

Alternatively use one collection `assistant_knowledge` with `source_type` payload.

### Payload schema

```json
{
  "store_id": "default",
  "tenant_id": "optional",
  "locale": "ru",
  "source_type": "medusa_product",
  "source_id": "prod_...",
  "chunk_id": "uuid",
  "title": "Product title",
  "url": "/products/handle",
  "product_id": "prod_...",
  "variant_ids": ["variant_..."],
  "handle": "product-handle",
  "category_ids": ["pcat_..."],
  "category_handles": ["coffee-machines"],
  "collection_id": "pcol_...",
  "tags": ["espresso", "home"],
  "brand": "optional",
  "price_hint_min": 10000,
  "price_hint_max": 50000,
  "currency_code": "rub",
  "availability_hint": "unknown|in_stock|out_of_stock",
  "updated_at": "2026-05-11T00:00:00Z"
}
```

Important: price and availability payloads are only hints. Live values must be checked via Medusa. Retrieval/vector queries must always filter by `store_id` and `locale`; `tenant_id` must also be present when the deployment is multi-tenant.

## 3. Neo4j / LightRAG graph

Optional advanced mode.

Candidate node types:

- `Product`
- `Variant`
- `Category`
- `Brand`
- `UseCase`
- `Feature`
- `CompatibilityTarget`
- `Policy`
- `Guide`

Candidate relations:

- `BELONGS_TO_CATEGORY`
- `HAS_FEATURE`
- `SUITABLE_FOR`
- `COMPATIBLE_WITH`
- `ALTERNATIVE_TO`
- `ACCESSORY_FOR`
- `MENTIONED_IN`
- `CONSTRAINED_BY_POLICY`

## 4. Normalized product document

Each Medusa product should become a stable text document before indexing:

```markdown
# Product: {title}

Product ID: {id}
Handle: {handle}
Categories: ...
Collection: ...
Tags: ...

## Description
{description}

## Variants
- Variant: {title}; SKU: {sku}; Options: ...

## Attributes
- Material: ...
- Dimensions: ...

## Use cases
Derived from metadata, tags, category and guides.

## Commerce note
Price, stock, delivery and promotions must be checked live from Medusa before answering.
```
