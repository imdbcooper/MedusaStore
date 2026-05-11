# Production Runbook

> Current concrete production target: `slavx.mooo.com`, user `som`, path `/home/som/MedusaStore`, GitHub repo `imdbcooper/MedusaStore`, branch `main`.
>
> Scope: production operations for the existing Docker/Caddy deployment. Do not use this runbook for a separate staging host.

## 1. Production facts

| Item | Value |
| --- | --- |
| Domain | `slavx.mooo.com` |
| SSH user | `som` |
| Remote path | `/home/som/MedusaStore` |
| Repository | `imdbcooper/MedusaStore` |
| Default branch | `main` |
| Compose file | [`docker-compose.prod.yml`](../docker-compose.prod.yml) |
| Reverse proxy | Caddy only, configured by [`docker/caddy/Caddyfile`](../docker/caddy/Caddyfile) |
| Deploy mechanism | Manual GitHub Actions workflow [`.github/workflows/deploy-production.yml`](../.github/workflows/deploy-production.yml) |
| Remote deploy script | [`scripts/github-deploy-prod.sh`](../scripts/github-deploy-prod.sh) |
| Production smoke script | [`scripts/prod-container-smoke.sh`](../scripts/prod-container-smoke.sh) |

## 2. Required GitHub Secrets

Configure these in the GitHub repository secrets. Do not commit their values.

| Secret | Meaning | Expected production shape |
| --- | --- | --- |
| `DEPLOY_HOST` | SSH host | `slavx.mooo.com` or server IP/DNS that resolves to the production host. |
| `DEPLOY_USER` | SSH user | `som`. |
| `DEPLOY_PATH` | Remote repo checkout path | `/home/som/MedusaStore`. |
| `DEPLOY_SSH_PRIVATE_KEY` | Private key used by workflow SSH agent | Private key authorized for `som` on the production host. |
| `AI_ASSISTANT_API_TOKEN` | Optional assistant service privileged API token | Strong generated secret; also put into the real remote `.env` if the assistant is enabled. |
| `AI_ASSISTANT_SERVER_TOKEN` | Optional Medusa-to-assistant adapter token | Strong generated backend-only secret; must never be exposed as `NEXT_PUBLIC_*`. |

The workflow also has a manual `branch` input, defaulting to `main`.

## 3. Remote `.env` contract

Production deploy requires `/home/som/MedusaStore/.env` to exist. The remote script exits if it is missing.

Use [`.env.prod.example`](../.env.prod.example) as a non-secret contract reference, then create/manage the real remote `.env` outside Git. Required values include at minimum:

- PostgreSQL identity/password and database names.
- JWT/cookie secrets.
- CORS/auth origins for `https://slavx.mooo.com`.
- Medusa publishable key for storefront build/runtime.
- `DEPLOY_DOMAIN=slavx.mooo.com` and ACME email.
- Docker internal URLs for server-side runtime: `DOCKER_MEDUSA_BACKEND_URL=http://medusa-backend:9000`, `DOCKER_PAYLOAD_CMS_URL=http://payload-cms:3100`.
- Payload secrets and `DOCKER_PAYLOAD_DATABASE_URL=postgresql://...@medusa-db:5432/payload_cms?sslmode=disable`.
- Migration/seed toggles: `RUN_MEDUSA_MIGRATIONS`, `RUN_PAYLOAD_MIGRATIONS`, `RUN_PAYLOAD_SEED`.
- Optional smoke overrides only when default public HTTPS checks are not appropriate.
- Optional AI Assistant values when `AI_ASSISTANT_ENABLED=true`: `AI_ASSISTANT_BASE_URL=http://ai-assistant:8000/api/v1`, strong `AI_ASSISTANT_API_TOKEN`, strong backend-only `AI_ASSISTANT_SERVER_TOKEN`, explicit `AI_ASSISTANT_CORS_ORIGINS`, `ASSISTANT_POSTGRES_URI`, and browser-safe `NEXT_PUBLIC_AI_ASSISTANT_WIDGET_ENABLED` / `NEXT_PUBLIC_AI_ASSISTANT_CHAT_ENDPOINT`.

Do not put GitHub-only deploy secrets into the app `.env`; keep `DEPLOY_SSH_PRIVATE_KEY` only in GitHub Secrets.

## 4. Manual deploy flow

1. Merge/push the desired commit to `main` in `imdbcooper/MedusaStore`.
2. In GitHub Actions, open `Deploy Production`.
3. Click `Run workflow`.
4. Keep branch as `main` unless intentionally deploying another branch.
5. The workflow:
   - checks out the repository;
   - validates production compose syntax with `docker compose -f docker-compose.prod.yml --env-file .env.example config -q`;
   - loads SSH key from `DEPLOY_SSH_PRIVATE_KEY`;
   - adds `DEPLOY_HOST` to `known_hosts`;
   - runs `scripts/github-deploy-prod.sh` on the remote server.
6. The remote script:
   - `git fetch origin <branch>`;
   - `git checkout <branch>`;
   - `git reset --hard origin/<branch>`;
   - verifies remote `.env` exists;
   - builds images;
   - starts `medusa-db` and `medusa-redis`;
   - optionally runs Payload migrations and seed one-off jobs;
   - starts `medusa-backend`, `payload-cms`, `storefront`, `caddy`;
   - prunes dangling images;
   - runs production smoke checks.

Documentation-only or env-example-only changes do not require production deploy unless an operator explicitly wants the remote checkout updated.

## 5. Container names

| Service | Container |
| --- | --- |
| PostgreSQL | `medusastore-db` |
| Redis | `medusastore-redis` |
| Medusa backend | `medusastore-backend` |
| Payload CMS | `medusastore-payload` |
| Storefront | `medusastore-storefront` |
| Caddy | `medusastore-caddy` |
| AI Assistant, optional profile | `medusastore-ai-assistant` |

Use the compose project name `medusastore` unless intentionally overridden.

## 6. Smoke checks

The production smoke script checks these defaults:

| Check | URL | Expected status |
| --- | --- | --- |
| `health` | `${SMOKE_BASE_URL}/healthz` | `200` |
| `storefront_home` | `${SMOKE_BASE_URL}/` | `200`, `307`, or `308` |
| `about` | `${SMOKE_BASE_URL}/ru/about` | `200` |
| `promotions` | `${SMOKE_BASE_URL}/ru/promotions` | `200` |
| `delivery` | `${SMOKE_BASE_URL}/ru/delivery-and-payment` | `200` |
| `backend_admin` | `${SMOKE_BACKEND_URL}` | `200`, `301`, `302`, or `401` |
| `payload_pages` | `${SMOKE_PAYLOAD_URL}` | `200` |

Default remote values are derived as:

- `SMOKE_BASE_URL=https://slavx.mooo.com`;
- `SMOKE_BACKEND_URL=https://slavx.mooo.com/admin/`;
- `SMOKE_PAYLOAD_URL=https://slavx.mooo.com/payload/api/pages?limit=1`.

Manual product page smoke is required after changes touching product rendering, backend URL precedence, Caddy routing, publishable key, or catalog data:

```bash
curl -I https://slavx.mooo.com/ru/products/<real-product-handle>
```

Expected result: `200` for an existing handle, not a `500`. `404` means the handle/region/data is absent and should be checked against Medusa data before treating it as infrastructure failure.

## 7. Useful production commands

Run these on the production host as `som` in `/home/som/MedusaStore`.

```bash
docker compose -p medusastore -f docker-compose.prod.yml --env-file .env ps
```

```bash
docker compose -p medusastore -f docker-compose.prod.yml --env-file .env logs --tail=200 caddy
```

```bash
docker compose -p medusastore -f docker-compose.prod.yml --env-file .env logs --tail=200 storefront
```

```bash
docker compose -p medusastore -f docker-compose.prod.yml --env-file .env logs --tail=200 medusa-backend
```

```bash
docker compose -p medusastore -f docker-compose.prod.yml --env-file .env logs --tail=200 payload-cms
```

```bash
bash ./scripts/prod-container-smoke.sh
```

For direct internal checks:

```bash
docker exec medusastore-storefront wget -qO- http://127.0.0.1:8000/ru/about | head
```

```bash
docker exec medusastore-backend wget -qO- http://127.0.0.1:9000/health || true
```

```bash
docker exec medusastore-payload wget -qO- http://127.0.0.1:3100/api/pages?limit=1 | head
```

## 8. AI Assistant optional launch notes

The first safe production step is intentionally conservative:

1. Run one `ai-assistant` replica/container with `AI_ASSISTANT_ENABLED=true` and the Compose `ai-assistant` profile.
2. Keep browser traffic on the existing public path `/store/assistant/chat`; Caddy routes `/store/*` to Medusa, and Medusa forwards to the assistant with `AI_ASSISTANT_SERVER_TOKEN` server-side.
3. Use the assistant's in-memory limits only for that single-replica baseline, optionally combined with Caddy/API-gateway request limits.
4. Before scaling the assistant horizontally, add Redis-backed distributed limiting or gateway/load-balancer limits. Without that, each replica counts its own requests and the global rate limit is multiplied by the replica count.
5. Apply managed schema review using [`001_initial_schema.sql`](../ai-assistant/migrations/001_initial_schema.sql) before using a production assistant database if startup auto-schema initialization is not acceptable.

## 9. Payload migrations and seed

Payload is part of production compose, but migrations and seed are controlled:

- `RUN_PAYLOAD_MIGRATIONS=false` by default in compose.
- If remote `.env` or workflow environment sets `RUN_PAYLOAD_MIGRATIONS=true`, deploy runs a one-off Payload migration job before starting app containers.
- `RUN_PAYLOAD_SEED=true` runs the marketing-content seed as a one-off job.

Use these toggles intentionally. Do not leave `RUN_PAYLOAD_SEED=true` by accident after a one-time seed operation unless idempotent reseeding is explicitly desired.

## 10. Rollback/redeploy basics

There is no separate automated rollback workflow. Basic safe options:

### Redeploy the last good commit/branch

1. Ensure the desired commit exists on a branch.
2. Run the manual workflow with that branch.
3. Confirm smoke checks pass.

### Remote hard reset to a known good commit

Only use during operator-approved incident handling:

```bash
cd /home/som/MedusaStore
git fetch origin main
git reset --hard <known-good-commit>
docker compose -p medusastore -f docker-compose.prod.yml --env-file .env build
docker compose -p medusastore -f docker-compose.prod.yml --env-file .env up -d --remove-orphans medusa-backend payload-cms storefront caddy
bash ./scripts/prod-container-smoke.sh
```

### Re-run current production deploy script

If the commit is correct but a build/start/smoke step failed transiently:

```bash
cd /home/som/MedusaStore
DEPLOY_BRANCH=main DEPLOY_PATH=/home/som/MedusaStore bash ./scripts/github-deploy-prod.sh
```

## 11. Incident pointers

Use [`troubleshooting.md`](./troubleshooting.md) for concrete symptoms:

- product page `500`;
- Payload pages missing;
- wrong Payload database;
- storefront using public/backend URL incorrectly;
- publishable key missing;
- Caddy/HTTPS issues;
- GitHub deploy hangs/fails;
- HTTP/HTTPS smoke mismatch;
- Payload migrations hanging.
