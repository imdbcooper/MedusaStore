# MedusaStore

Operational entrypoint for the MedusaStore runtime repository. This file is the first place to check before using older phase documents in [`Docs/`](Docs).

> Current source of truth: the single staging environment is containerized with [`docker-compose.prod.yml`](docker-compose.prod.yml) (filename retained as Medusa convention), Caddy is the only public reverse proxy, deployment is the `Deploy Staging` GitHub Actions workflow, secrets flow only through GitHub Secrets and GitHub Variables, Payload CMS runs as its own container, product detail pages render dynamically at runtime, and server-side storefront calls prefer `MEDUSA_BACKEND_URL` over public browser URLs. Real production is **not provisioned yet** and will be added once development is complete.

## Architecture map

| Layer | Current implementation | Source of truth |
| --- | --- | --- |
| Reverse proxy | Caddy container `medusastore-caddy`; terminates HTTPS for `studio.slavx.ru`; routes `/admin/*`, `/store/*`, `/auth/*`, `/payload/*`, `/api/content/*`, and storefront fallback. | [`docker/caddy/Caddyfile`](docker/caddy/Caddyfile) |
| Storefront | Next.js container `medusastore-storefront` in production; host process in local dev; dynamic product route under `/{countryCode}/products/{handle}`. | [`docker-compose.prod.yml`](docker-compose.prod.yml), [`page.tsx`](medusa-agency-boilerplate-storefront/src/app/[countryCode]/(main)/products/[handle]/page.tsx) |
| Medusa backend | Container `medusastore-backend`; source of truth for catalog, cart, checkout, payments, orders, fulfillment, notifications. | [`medusa-config.ts`](medusa-agency-boilerplate/medusa-config.ts) |
| Payload CMS | Container `medusastore-payload`; headless content service for marketing pages, globals, preview/revalidate hooks. | [`payload.config.ts`](payload-cms/src/payload.config.ts), [`Docs/payload_cms_runbook.md`](Docs/payload_cms_runbook.md) |
| Data | PostgreSQL container `medusastore-db`; Redis container `medusastore-redis`; production Payload uses dedicated `payload_cms` DB in the same PostgreSQL server. | [`docker-compose.prod.yml`](docker-compose.prod.yml) |
| AI Assistant | Optional FastAPI container `medusastore-ai-assistant` behind the installed Medusa assistant adapter; storefront uses `/store/assistant/chat` and `/store/assistant/history`; disabled until `AI_ASSISTANT_ENABLED=true` and the storefront widget flag is enabled. | [`ai-assistant/README.md`](ai-assistant/README.md), [`docker-compose.prod.yml`](docker-compose.prod.yml) |
| Deployment | Manual GitHub Actions workflow over SSH, branch input defaults to `main`, remote script rebuilds/starts compose and runs smoke checks. | [`.github/workflows/deploy-staging.yml`](.github/workflows/deploy-staging.yml), [`scripts/github-deploy-staging.sh`](scripts/github-deploy-staging.sh) |

Full topology and responsibility split are documented in [`Docs/architecture.md`](Docs/architecture.md).

## Environment separation

| Environment | How it runs | Important notes | Runbook |
| --- | --- | --- | --- |
| Local development | [`docker-compose.yml`](docker-compose.yml) runs PostgreSQL, Redis, and Medusa backend; storefront and Payload are usually host processes for dev/HMR. | Local compose is not the remote topology. It intentionally omits Caddy and the storefront/Payload containers. | [`Docs/local_development.md`](Docs/local_development.md), [`scripts/MANAGE.md`](scripts/MANAGE.md) |
| Staging | Remote server `som@studio.slavx.ru` (SSH alias `slavx-store`, IP `171.22.180.206`), repo path `/home/som/MedusaStore`, repo `imdbcooper/MedusaStore`, branch `main`, compose file [`docker-compose.prod.yml`](docker-compose.prod.yml) (filename retained as Medusa convention). | Caddy-only public ingress; no deployment needed for docs/env-example-only changes. Only deploy method is the `Deploy Staging` GitHub Actions workflow. | [`Docs/staging_runbook.md`](Docs/staging_runbook.md), [`Docs/production_runbook.md`](Docs/production_runbook.md) |
| Production | **Not provisioned yet.** Real production will be set up after development is complete. Until then, every reference to "production" in historical docs should be read as either a Node.js technical term (`NODE_ENV=production`) or as a TBD future environment. | TBD when real production is provisioned. | TBD |

## Staging deploy summary

Staging deploy is GitHub Actions only:

1. Push changes to `main` in `imdbcooper/MedusaStore`.
2. Open GitHub Actions workflow `Deploy Staging`.
3. Run `workflow_dispatch`, usually with branch `main`.
4. Workflow validates staging compose syntax, SSHes to the server, and runs [`scripts/github-deploy-staging.sh`](scripts/github-deploy-staging.sh).
5. Remote script fetches/reset branch, builds images, starts DB/Redis, optionally runs Payload migration/seed one-off jobs, starts app containers, prunes dangling images, and runs [`scripts/staging-container-smoke.sh`](scripts/staging-container-smoke.sh).

Secrets flow: **only** through GitHub Secrets (`DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_PATH`, `DEPLOY_SSH_PRIVATE_KEY`, plus app secrets like `POSTGRES_PASSWORD`, `JWT_SECRET`, etc.) and GitHub Variables for non-secret config. Real secrets are never committed and are never passed over any channel other than GitHub Actions. Expected values for the concrete staging host are documented in [`Docs/production_runbook.md`](Docs/production_runbook.md); do not commit secret values.

## Service table

| Service | Container | Port/scope | Production role |
| --- | --- | --- | --- |
| `medusa-db` | `medusastore-db` | internal `5432` | PostgreSQL for Medusa and Payload databases. |
| `medusa-redis` | `medusastore-redis` | internal `6379` | Redis for Medusa runtime/cache/event needs. |
| `medusa-backend` | `medusastore-backend` | internal `9000` | Medusa Admin/API runtime. |
| `payload-cms` | `medusastore-payload` | internal `3100` | Payload CMS admin/API/runtime. |
| `storefront` | `medusastore-storefront` | internal `8000` | Next.js shopper storefront and content API endpoints. |
| `caddy` | `medusastore-caddy` | public `80/443` | HTTPS reverse proxy and ACME certificates. |
| `ai-assistant` | `medusastore-ai-assistant` | internal `8000`, profile `ai-assistant` | Optional FastAPI shopping assistant. Safe first step is one assistant replica plus Caddy/API-gateway limits; multi-replica requires Redis or gateway-level distributed rate limiting. |

## Public route table

| Public path | Upstream | Notes |
| --- | --- | --- |
| `/healthz` | Caddy response | Public proxy health endpoint returns `ok`. |
| `/payload/*` | `payload-cms:3100` | Payload admin/API behind Caddy path stripping via `handle_path`. |
| `/admin/*` | `medusa-backend:9000` | Medusa Admin/API surface. |
| `/store/*` | `medusa-backend:9000` | Medusa Store API surface, including optional `/store/assistant/chat` and `/store/assistant/history` proxies when the AI Assistant adapter is enabled. |
| `/auth/*` | `medusa-backend:9000` | Medusa auth routes. |
| `/api/content/*` | `storefront:8000` | Storefront content preview/revalidate endpoints. |
| `/{countryCode}/products/{handle}` | `storefront:8000` | Dynamic runtime product page; validate with at least one real handle. |
| `/ru/about`, `/ru/promotions`, `/ru/delivery-and-payment`, `/ru/loyalty` | `storefront:8000` + Payload when enabled | Payload-rendered content pages when `PAYLOAD_ENABLED=true`; fallback/not-found semantics apply when disabled or missing. |
| `/ru/contacts` | `storefront:8000` static route | Current contact page is a static storefront route, not Payload-rendered. |
| `/admin/assistant/*` | `medusa-backend:9000` | Optional AI Assistant admin adapter routes for reindex queue, processing, stats, and job status; protected by Medusa admin auth. |

## Runtime URL precedence

Server-side storefront runtime uses [`MEDUSA_BACKEND_URL`](medusa-agency-boilerplate-storefront/src/lib/env.ts) first, then `NEXT_PUBLIC_MEDUSA_BACKEND_URL`, then local port fallback. In staging containers this means server-side calls should use the Docker-network URL `http://medusa-backend:9000`, while browser-facing/proxy URLs may stay public through Caddy. Keep this distinction when editing env examples, docs, or deploy scripts.

## Runbooks and reference docs

Start with these current docs:

1. [`Docs/architecture.md`](Docs/architecture.md) — topology, service/container names, routes, internal URLs.
2. [`Docs/production_runbook.md`](Docs/production_runbook.md) — current staging deploy/ops on `studio.slavx.ru` (will be split into staging/production runbooks once real production is provisioned).
3. [`Docs/local_development.md`](Docs/local_development.md) — local compose and host app runtimes.
4. [`Docs/staging_runbook.md`](Docs/staging_runbook.md) — staging-specific guidance on the single `studio.slavx.ru` environment.
5. [`Docs/troubleshooting.md`](Docs/troubleshooting.md) — known failure modes and commands.
6. [`Docs/payload_cms_runbook.md`](Docs/payload_cms_runbook.md) — Payload CMS operations.
7. [`Docs/env_contract.md`](Docs/env_contract.md) and [`Docs/client_init_contract.md`](Docs/client_init_contract.md) — env/init contracts.

## Docs governance rule

When code/infrastructure and older docs conflict, trust implementation first, then current operational docs (`README.md`, [`Docs/architecture.md`](Docs/architecture.md), [`Docs/production_runbook.md`](Docs/production_runbook.md), [`Docs/local_development.md`](Docs/local_development.md), [`Docs/staging_runbook.md`](Docs/staging_runbook.md), [`Docs/troubleshooting.md`](Docs/troubleshooting.md)). Historical planning snapshots must carry a banner and must not be used as operational source of truth.

Use relative links in repository docs. Do not add real secrets, tokens, private keys, raw provider credentials, or database passwords to committed files. Real secrets live only in GitHub Secrets; non-secret config lives only in GitHub Variables.

## Secret templates

Committed env files are contracts/placeholders only:

- [`.env.example`](.env.example) — local/root baseline.
- [`.env.staging.example`](.env.staging.example) — staging contract placeholders and operator notes.
- [`medusa-agency-boilerplate/.env.template`](medusa-agency-boilerplate/.env.template) — backend mirror template.
- [`medusa-agency-boilerplate-storefront/.env.local.example`](medusa-agency-boilerplate-storefront/.env.local.example) — storefront local template.
- [`payload-cms/.env.example`](payload-cms/.env.example) — Payload local template.
- [`ai-assistant/ENV.example`](ai-assistant/ENV.example) — standalone assistant template; real local secrets belong in ignored `ai-assistant/.env.local`.

Never commit real `.env` files or production secret values. Transactional SMTP is opt-in through backend-only `SMTP_*` variables and must stay `NOTIFICATION_EMAIL_PROVIDER=local` until credentials, PTR/TLS/DNS checks, and smoke approval are complete.

## License

MIT. Upstream components and templates keep their own copyright notices and licenses.
