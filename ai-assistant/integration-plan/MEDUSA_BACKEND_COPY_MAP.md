# Medusa Backend Copy Map

Safe production-launch preparation artifact for copying the AI Assistant Medusa adapter into the real backend after explicit approval.

## Scope and current repository reality

- Source templates live under `ai-assistant/medusa-adapter/src/`.
- Target backend is `medusa-agency-boilerplate/src/`.
- The target backend already has a large `src/api/middlewares.ts` with ApiShip/Gorgo guards, Delivery Hub quarantine guards, marketing routes, notification smoke routes, VK ID routes, and YooKassa query validators.
- The target backend package exposes `npm run typecheck`, `npm run build`, `npm run test:unit`, `npm run test:integration:http`, and `npm run test:integration:modules`.
- Production backend container is `medusastore-backend`, built from `docker/medusa-backend/Dockerfile` and attached to the `medusastore` Docker network.

No real backend files are changed by this document.

## Exact copy map

Copy these files from `ai-assistant/medusa-adapter/src/` to matching target paths under `medusa-agency-boilerplate/src/`:

| Source | Target | Action |
| --- | --- | --- |
| `api/store/assistant/chat/route.ts` | `medusa-agency-boilerplate/src/api/store/assistant/chat/route.ts` | Create new route directory/file. |
| `api/admin/assistant/reindex/route.ts` | `medusa-agency-boilerplate/src/api/admin/assistant/reindex/route.ts` | Create new route directory/file. |
| `api/admin/assistant/stats/route.ts` | `medusa-agency-boilerplate/src/api/admin/assistant/stats/route.ts` | Create new route directory/file. |
| `api/admin/assistant/jobs/[id]/route.ts` | `medusa-agency-boilerplate/src/api/admin/assistant/jobs/[id]/route.ts` | Create new route directory/file. |
| `lib/assistant-client.ts` | `medusa-agency-boilerplate/src/lib/assistant-client.ts` | Create new helper file. |
| `lib/config.ts` | `medusa-agency-boilerplate/src/lib/config.ts` | Copy only after checking for existing generic `config.ts`; current target tree has no `src/lib/`. If a later branch adds one, rename to `assistant-config.ts` or merge exports intentionally. |
| `lib/route-utils.ts` | `medusa-agency-boilerplate/src/lib/route-utils.ts` | Create new helper file. |
| `modules/assistant-runtime.ts` | `medusa-agency-boilerplate/src/modules/assistant-runtime.ts` | Create new module helper. |
| `subscribers/_assistant-product-event.ts` | `medusa-agency-boilerplate/src/subscribers/_assistant-product-event.ts` | Create new subscriber helper. |
| `subscribers/assistant-product-created.ts` | `medusa-agency-boilerplate/src/subscribers/assistant-product-created.ts` | Create new subscriber. |
| `subscribers/assistant-product-updated.ts` | `medusa-agency-boilerplate/src/subscribers/assistant-product-updated.ts` | Create new subscriber. |
| `subscribers/assistant-product-deleted.ts` | `medusa-agency-boilerplate/src/subscribers/assistant-product-deleted.ts` | Create new subscriber. |
| `subscribers/assistant-product-variant-updated.ts` | `medusa-agency-boilerplate/src/subscribers/assistant-product-variant-updated.ts` | Create new subscriber. |
| `subscribers/assistant-product-category-updated.ts` | `medusa-agency-boilerplate/src/subscribers/assistant-product-category-updated.ts` | Create new subscriber. |
| `subscribers/assistant-product-collection-updated.ts` | `medusa-agency-boilerplate/src/subscribers/assistant-product-collection-updated.ts` | Create new subscriber. |
| `workflows/assistant-reindex-product.ts` | `medusa-agency-boilerplate/src/workflows/assistant-reindex-product.ts` | Create new workflow. |
| `workflows/assistant-reindex-all-products.ts` | `medusa-agency-boilerplate/src/workflows/assistant-reindex-all-products.ts` | Create new workflow. |

## Middleware merge map

Do not overwrite `medusa-agency-boilerplate/src/api/middlewares.ts`.

Merge these imports from the adapter template:

```ts
import { AdminAssistantReindexSchema } from "./admin/assistant/reindex/route"
```

The target file already imports `authenticate`, `defineMiddlewares`, `validateAndTransformBody`, and `validateAndTransformQuery` from `@medusajs/framework/http`, and already defines:

```ts
const adminAuth = authenticate("user", ["session", "bearer", "api-key"])
```

Add only these route entries to the existing `routes` array, preferably near other `/admin/*` route guards:

```ts
{
  matcher: "/admin/assistant/reindex",
  methods: ["POST"],
  middlewares: [adminAuth, validateAndTransformBody(AdminAssistantReindexSchema)],
},
{
  matcher: "/admin/assistant/stats",
  methods: ["GET"],
  middlewares: [adminAuth],
},
{
  matcher: "/admin/assistant/jobs/:id",
  methods: ["GET"],
  middlewares: [adminAuth],
},
```

No middleware is needed for `/store/assistant/chat`; it is intentionally a public Store API proxy and must keep server-side token handling inside the route/client.

## Imports and path risks to verify during patch

- Adapter route imports currently assume Medusa v2 file-route relative paths from the copied location. After copy, run backend typecheck to confirm all `../../../` paths still resolve.
- `src/lib/config.ts` is a generic filename. The current target tree has no `src/lib/`, but if another branch introduces `src/lib/config.ts`, avoid overwriting unrelated config and rename assistant config imports consistently.
- Subscriber event names are template assumptions for Medusa v2 product/catalog events. Confirm against the exact Medusa `2.13.6` runtime and any project-specific product modules before relying on freshness automation.
- Subscribers are log/enqueue-intent-only templates. Production copy still needs an explicit durable queue/job/stale-marker implementation before broad catalog updates are considered reliable.
- Store chat route intentionally does not forward browser-supplied `cart_id`. Keep this behavior until a trusted server-side cart ownership resolver exists.
- Do not introduce `/store/delivery/*` assistant paths; current delivery baseline is ApiShip/Gorgo direct `/store/apiship/*`, and Delivery Hub routes are quarantined historical context.

## Backend env additions

Add these to backend runtime env surfaces only after approval:

```env
AI_ASSISTANT_ENABLED=true
AI_ASSISTANT_BASE_URL=http://ai-assistant:8000/api/v1
AI_ASSISTANT_SERVER_TOKEN=<same-secret-value-as-AI_ASSISTANT_API_TOKEN>
AI_ASSISTANT_TIMEOUT_MS=60000
```

Production placement notes:

- `AI_ASSISTANT_SERVER_TOKEN` is backend-only and must never appear in storefront public env or browser network responses.
- `AI_ASSISTANT_BASE_URL` must resolve from `medusastore-backend` to the assistant service on the production Docker network. If the assistant is added as a Compose service, attach it to `medusastore` and use `http://ai-assistant:8000/api/v1` or the final service name.
- Root `.env.prod.example`, backend `.env.template`, and deploy docs should be updated in the real integration patch if env names are added to production contracts.

## Post-copy local validation commands

From repository root:

```bash
npm --prefix medusa-agency-boilerplate run typecheck
npm --prefix medusa-agency-boilerplate run build
```

If unit test dependencies are available:

```bash
npm --prefix medusa-agency-boilerplate run test:unit -- --runTestsByPath src/workflows/__tests__/<new-or-targeted-test>.spec.ts
```

Adapter template contract check remains:

```bash
cd ai-assistant
node --test medusa-adapter/tests/*.test.mjs
```

## Post-copy smoke commands

With assistant backend running and Medusa backend reachable locally:

```bash
curl -fsS http://localhost:8000/api/v1/health
curl -fsS http://localhost:8000/api/v1/health/deep
```

Admin reindex through Medusa backend, using a real admin session/bearer/API key:

```bash
curl -fsS -X POST http://localhost:9000/admin/assistant/reindex \
  -H "Authorization: Bearer <admin-or-secret-api-key>" \
  -H "Content-Type: application/json" \
  -d '{"scope":"all","store_id":"default","locale":"ru","force":true}'
```

Store chat proxy:

```bash
curl -fsS -X POST http://localhost:9000/store/assistant/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Помоги выбрать товар","store_id":"default","locale":"ru","mode":"auto"}'
```

SSE passthrough:

```bash
curl -N -X POST http://localhost:9000/store/assistant/chat \
  -H "Accept: text/event-stream" \
  -H "Content-Type: application/json" \
  -d '{"message":"Подбери товар","store_id":"default","locale":"ru","mode":"auto"}'
```

Production container smoke after an approved Compose/deploy patch:

```bash
docker exec medusastore-backend printenv AI_ASSISTANT_BASE_URL
docker exec medusastore-backend wget -qO- http://ai-assistant:8000/api/v1/health
bash ./scripts/prod-container-smoke.sh
```

## Risks and assumptions

- The assistant service is not yet part of root production Compose/Caddy topology; adding it requires a separate explicit infrastructure patch.
- PostgreSQL/Qdrant ownership for assistant data is still a launch decision: reuse production PostgreSQL with a separate `assistant` database/user, or provision managed services.
- In-memory assistant rate limiting is not distributed; multi-replica production needs Redis/gateway rate limiting before scale-out.
- Automatic PostgreSQL schema initialization exists in the assistant; stricter production launch should extract managed migrations first.
- Product freshness automation is incomplete until enqueue intents are persisted and a worker consumes them outside Medusa subscriber hot paths.
- All smoke commands require real secrets/admin credentials supplied by the operator outside Git.
