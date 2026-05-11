# Architecture

> Current operational architecture. If this file conflicts with historical planning docs, trust this file and the implementation in [`docker-compose.prod.yml`](../docker-compose.prod.yml), [`docker/caddy/Caddyfile`](../docker/caddy/Caddyfile), and deploy scripts.

## 1. Topology overview

Production runtime is a single Docker Compose application with one public ingress:

```text
Internet
  |
  | HTTPS/HTTP
  v
Caddy container: medusastore-caddy
  |-- /admin/*  ----------> medusastore-backend:9000
  |-- /store/*  ----------> medusastore-backend:9000
  |-- /auth/*   ----------> medusastore-backend:9000
  |-- /payload/* ---------> medusastore-payload:3100
  |-- /api/content/* -----> medusastore-storefront:8000
  `-- all other paths ----> medusastore-storefront:8000

medusastore-backend  ---> medusastore-db:5432
medusastore-backend  ---> medusastore-redis:6379
medusastore-payload  ---> medusastore-db:5432 / database payload_cms
medusastore-storefront ---> medusastore-backend:9000 server-side
medusastore-storefront ---> medusastore-payload:3100 server-side when Payload is enabled
medusastore-backend  ---> medusastore-ai-assistant:8000 when AI_ASSISTANT_ENABLED=true
```

There is no Nginx layer in the current production topology. Caddy is the only reverse proxy. The AI Assistant is optional and is not exposed directly by Caddy; browser chat uses `/store/assistant/chat` through the Medusa backend adapter so server tokens stay server-side.

## 2. Production services and containers

| Compose service | Container name | Image/build | Responsibility | Health/readiness |
| --- | --- | --- | --- | --- |
| `medusa-db` | `medusastore-db` | `postgres:15-alpine` | PostgreSQL data store for Medusa and Payload databases. | `pg_isready` against `${POSTGRES_DB:-medusa}`. |
| `medusa-redis` | `medusastore-redis` | `redis:7-alpine` | Redis runtime dependency. | `redis-cli ping`. |
| `medusa-backend` | `medusastore-backend` | built from [`docker/medusa-backend/Dockerfile`](../docker/medusa-backend/Dockerfile) | Medusa Admin/API, commerce truth, catalog/cart/checkout/orders/fulfillment/payments/notifications. | Compose healthcheck from image/runtime plus Caddy/admin smoke. |
| `payload-cms` | `medusastore-payload` | built from [`docker/payload/Dockerfile`](../docker/payload/Dockerfile) | Payload CMS API/admin/content runtime. | Compose healthcheck and `/payload/api/pages?limit=1` smoke. |
| `storefront` | `medusastore-storefront` | built from [`docker/storefront/Dockerfile`](../docker/storefront/Dockerfile) | Next.js storefront, product pages, content page rendering, content preview/revalidate endpoints. | `GET /ru/about` inside container. |
| `caddy` | `medusastore-caddy` | `caddy:2-alpine` | Public HTTP/HTTPS ingress, ACME certificates, route dispatch. | `GET /healthz` returns `ok`. |
| `ai-assistant` | `medusastore-ai-assistant` | built from [`ai-assistant/Dockerfile`](../ai-assistant/Dockerfile) when profile `ai-assistant` is enabled | Optional FastAPI shopping assistant for Markdown/vector answers, Medusa live checks, feedback, and ingestion/admin endpoints. | `GET /api/v1/health` inside the container. |

All services are attached to the `medusastore` Docker bridge network in [`docker-compose.prod.yml`](../docker-compose.prod.yml).

## 3. Public routes

| Public route | Upstream | Runtime owner | Notes |
| --- | --- | --- | --- |
| `/healthz` | Caddy local response | Caddy | Public smoke endpoint. |
| `/payload/*` | `payload-cms:3100` | Payload CMS | `handle_path` strips `/payload` before proxying. |
| `/admin/*` | `medusa-backend:9000` | Medusa | Admin/API routes. |
| `/store/*` | `medusa-backend:9000` | Medusa | Store API routes used by storefront/browser, including optional `/store/assistant/chat` proxy when the assistant adapter is configured. |
| `/auth/*` | `medusa-backend:9000` | Medusa | Auth routes. |
| `/api/content/*` | `storefront:8000` | Storefront | Preview/revalidate endpoints implemented in Next.js. |
| `/ru/products/{handle}` | `storefront:8000` | Storefront + Medusa | Product detail route is `force-dynamic`; runtime fetches Medusa product by handle. |
| `/ru/about`, `/ru/promotions`, `/ru/delivery-and-payment`, `/ru/loyalty` | `storefront:8000` | Storefront + Payload | Payload content pages when `PAYLOAD_ENABLED=true` and documents exist. |
| `/ru/contacts` | `storefront:8000` | Storefront static page | Current contacts page is not Payload-rendered because a concrete static route exists. |

## 4. Internal URLs and precedence

Production containers use internal Docker-network URLs for server-side calls:

| Purpose | Production internal value | Public/browser value |
| --- | --- | --- |
| Medusa backend server-side storefront calls | `MEDUSA_BACKEND_URL=http://medusa-backend:9000` or `DOCKER_MEDUSA_BACKEND_URL=http://medusa-backend:9000` | `NEXT_PUBLIC_MEDUSA_BACKEND_URL=https://slavx.mooo.com` or proxy-relative public origin when used by browser code. |
| Payload server-side storefront calls | `PAYLOAD_CMS_URL=http://payload-cms:3100` or `DOCKER_PAYLOAD_CMS_URL=http://payload-cms:3100` | `/payload/*` through Caddy for admin/API access. |
| Storefront base URL | `NEXT_PUBLIC_BASE_URL=https://slavx.mooo.com` in public semantics; compose build args may use the deploy domain. | `https://slavx.mooo.com`. |
| Database | `postgresql://...@medusa-db:5432/medusa` | Not public. |
| Payload database | `postgresql://...@medusa-db:5432/payload_cms` | Not public. |
| Redis | `redis://medusa-redis:6379` | Not public. |
| AI Assistant | `AI_ASSISTANT_BASE_URL=http://ai-assistant:8000/api/v1` from Medusa backend | Browser uses `/store/assistant/chat`; `AI_ASSISTANT_SERVER_TOKEN` must never be public. |

Storefront server runtime explicitly prefers `MEDUSA_BACKEND_URL` before `NEXT_PUBLIC_MEDUSA_BACKEND_URL` in [`env.ts`](../medusa-agency-boilerplate-storefront/src/lib/env.ts). This is important in production: server-side rendering should call `http://medusa-backend:9000`, not the public HTTPS URL, while browser requests can go through Caddy.

## 5. Runtime responsibilities

### Medusa backend

- Source of truth for products, variants, pricing, regions, carts, checkout, orders, fulfillment, payments, notification workflows, marketing preferences/campaigns, and admin APIs.
- Registers optional providers such as YooKassa, UniSender, VK, SMS, and ApiShip/Gorgo according to env/runtime readiness.
- Uses PostgreSQL and Redis.
- Does not own editorial marketing pages.

### Storefront

- Shopper-facing Next.js application.
- Uses Medusa Store API for regions, catalog, product pages, cart, checkout, account, and commerce interactions.
- Uses Payload content APIs only when `PAYLOAD_ENABLED=true` and `PAYLOAD_CMS_URL` is configured.
- Product detail route at [`page.tsx`](../medusa-agency-boilerplate-storefront/src/app/[countryCode]/(main)/products/[handle]/page.tsx) is dynamic at runtime. Static params generation may return an empty list if Store API is unavailable during build; runtime page smoke is still required.
- Owns `/api/content/preview`, `/api/content/preview/exit`, and `/api/content/revalidate` endpoints.

### Payload CMS

- Headless content/admin application for pages, posts, navigation, footer, site settings, drafts/preview, and revalidate hooks.
- Uses dedicated `payload_cms` database in production via `PAYLOAD_DATABASE_URL`.
- Seeding demo/marketing content is controlled by `RUN_PAYLOAD_SEED`; migrations by `RUN_PAYLOAD_MIGRATIONS`.
- Must not store provider secrets, payment credentials, or commerce truth.

### Caddy

- Only public reverse proxy.
- Owns ACME/HTTPS certificates and security headers.
- Does not run application logic.
- Can enforce coarse public request limits at the gateway layer if the assistant widget is enabled.

### AI Assistant

- Optional FastAPI service enabled with the Compose `ai-assistant` profile and `AI_ASSISTANT_ENABLED=true`.
- Medusa owns the public `/store/assistant/chat` proxy and injects the server token for assistant calls.
- Safe first production topology is one assistant replica plus Caddy/API-gateway limits.
- The assistant's current in-memory rate limiter is process-local: it is acceptable for one replica, but multi-replica scale-out requires Redis-backed distributed limiting or gateway/load-balancer limits because otherwise each replica counts limits independently.

## 6. Local vs production topology

Local [`docker-compose.yml`](../docker-compose.yml) is intentionally smaller: PostgreSQL, Redis, and Medusa backend only. Local storefront and Payload are usually host runtimes via scripts for faster development. Production [`docker-compose.prod.yml`](../docker-compose.prod.yml) includes storefront, Payload, and Caddy.

Do not infer production topology from local compose alone.

## 7. Deployment topology

Manual production deploy is defined by [`.github/workflows/deploy-production.yml`](../.github/workflows/deploy-production.yml). It connects to the production server and runs [`scripts/github-deploy-prod.sh`](../scripts/github-deploy-prod.sh) inside `/home/som/MedusaStore`.

The deploy script:

1. fetches and hard-resets the selected branch;
2. requires remote `.env` to exist;
3. builds production images;
4. starts PostgreSQL and Redis;
5. optionally runs Payload migrations and seed jobs;
6. starts backend, Payload, storefront, and Caddy;
7. runs production smoke checks.

## 8. Operational source-of-truth rule

When investigating architecture, prefer this order:

1. implementation files: [`docker-compose.prod.yml`](../docker-compose.prod.yml), [`docker/caddy/Caddyfile`](../docker/caddy/Caddyfile), deploy scripts, runtime code;
2. current operational docs: [`README.md`](../README.md), this file, [`production_runbook.md`](./production_runbook.md), [`local_development.md`](./local_development.md), [`staging_runbook.md`](./staging_runbook.md), [`troubleshooting.md`](./troubleshooting.md);
3. historical planning docs only when they carry a banner and are explicitly used for context/evidence.
