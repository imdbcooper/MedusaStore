# AI Assistant Operational Runbooks

These runbooks are safe for the standalone `ai-assistant/` module and do not require changing the real Medusa backend/storefront.

## 1. LLM provider outage

Symptoms:

- `/api/v1/health/deep` reports `llm_provider.status=error`.
- Chat latency spikes or answers fall back to deterministic retrieval wording.

Immediate actions:

1. Keep storefront chat open if deterministic Markdown/vector retrieval still works.
2. Switch `LLM_PROVIDER=none` or a configured fallback provider if generation is failing hard.
3. Keep `EMBEDDING_PROVIDER=hashing` only for dev/tests; for production embeddings, pause new vector ingestion until provider is stable.
4. Re-run a small evaluation set after provider recovery.

Validation:

```bash
curl -fsS http://localhost:8000/api/v1/health/deep | jq '.llm_provider'
```

## 2. Medusa unavailable

Symptoms:

- Product cards are returned with `price=null` and `availability=unknown`.
- `safety.live_data_checked=false`.
- Tool call `medusa_get_product_live_data` has `MEDUSA_UNAVAILABLE`.

Immediate actions:

1. Do not disable the no-hallucination guard.
2. Verify `MEDUSA_BACKEND_URL` from the assistant container/network.
3. Verify Medusa Store API health and publishable key requirements.
4. Keep chat available for policy/general knowledge answers.
5. Hide or de-emphasize add-to-cart proposals in the storefront if live checks fail.

Validation:

```bash
curl -fsS http://localhost:8000/api/v1/health/deep | jq '.medusa'
```

## 3. Qdrant unavailable

Symptoms:

- Vector mode returns `RETRIEVAL_UNAVAILABLE` or auto mode adds fallback notes.
- `/api/v1/health/deep` reports `qdrant.status=error`.

Immediate actions:

1. Set `AI_ASSISTANT_RETRIEVAL_MODE=auto` or `markdown` to keep service available.
2. Verify Qdrant URL/API key/network.
3. Restore Qdrant snapshot if data is lost.
4. If snapshots are unavailable, re-run Markdown and Medusa product ingestion.

Validation:

```bash
curl -fsS http://localhost:8000/api/v1/health/deep | jq '.qdrant'
```

## 4. Failed reindex

Symptoms:

- Admin reindex returns a job with `status=error`.
- `stats.failed_jobs` increases.

Immediate actions:

1. Fetch the job by id.
2. Check if failure is Medusa, Qdrant, embedding provider, or invalid product ids.
3. Retry selected-product reindex before full reindex.
4. For category/collection broad updates, debounce/coalesce repeated events before full reindex.
5. Never run heavy reindex work inside Medusa subscriber hot paths.

Validation:

```bash
curl -fsS -H "Authorization: Bearer $AI_ASSISTANT_API_TOKEN" \
  http://localhost:8000/api/v1/ingest/jobs/<job_id>
```

## 5. Bad recommendation incident

Examples:

- Wrong tenant/store products appear.
- Assistant recommends out-of-stock item as available.
- Answer contains unsupported price/payment/order claims.

Immediate actions:

1. Capture `X-Request-ID`, `session_id`, `message_id`, `store_id`, `tenant_id`, `locale`.
2. Submit feedback with label `bad_recommendation` or `ungrounded_fact`.
3. Verify retrieval filters include `store_id`, `locale`, and `tenant_id` where applicable.
4. Verify Medusa live-data tool calls succeeded before price/stock appeared.
5. If cross-tenant leak is confirmed, disable vector mode and reindex with corrected payload filters.
6. Add the incident prompt to `evaluation/dataset.jsonl` before closing.

Safe feedback capture:

```bash
curl -fsS -X POST http://localhost:8000/api/v1/feedback \
  -H "Content-Type: application/json" \
  -d '{"session_id":"<session>","message_id":"<message>","rating":1,"label":"bad_recommendation","comment":"No raw PII or secrets here"}'
```
