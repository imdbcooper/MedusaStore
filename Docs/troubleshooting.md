# Troubleshooting

> Current operational troubleshooting for Docker/Caddy production and local/runtime parity. Do not paste secrets into tickets, docs, logs, or commits.

## 1. Product page returns `500`

Symptoms:

- `https://slavx.mooo.com/ru/products/<handle>` returns `500`.
- Storefront logs show Medusa fetch failures, missing publishable key, backend URL errors, or region/product lookup errors.

Implementation facts:

- Product detail route is dynamic: [`page.tsx`](../medusa-agency-boilerplate-storefront/src/app/[countryCode]/(main)/products/[handle]/page.tsx) exports `dynamic = "force-dynamic"`.
- Build-time static params may be empty if Store API is unavailable. That is not enough to prove runtime is broken.
- Runtime fetches product by `handle` and country/region.

Checks:

```bash
curl -I https://slavx.mooo.com/ru/products/<real-product-handle>
```

```bash
docker compose -p medusastore -f docker-compose.prod.yml --env-file .env logs --tail=200 storefront
```

```bash
docker compose -p medusastore -f docker-compose.prod.yml --env-file .env logs --tail=200 medusa-backend
```

Inside production host, confirm server-side backend URL path:

```bash
docker exec medusastore-storefront printenv MEDUSA_BACKEND_URL
```

Expected production value is the Docker-network backend URL, usually `http://medusa-backend:9000`.

Common causes:

- handle does not exist in the `ru` region/catalog;
- no `ru` region/country or publishable key cannot access products;
- `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` missing/placeholder;
- storefront server-side `MEDUSA_BACKEND_URL` points to an unreachable public URL instead of internal Docker URL;
- Caddy routes `/store/*` incorrectly changed;
- backend unhealthy or DB not migrated/seeded.

## 2. Payload pages missing or returning `404`

Symptoms:

- `/ru/about`, `/ru/promotions`, `/ru/delivery-and-payment`, or `/ru/loyalty` not found.
- Storefront content pages disappear after deploy.

Implementation facts:

- Storefront reads Payload only when `PAYLOAD_ENABLED=true` and `PAYLOAD_CMS_URL` is non-empty.
- The catch-all content route does not render reserved commerce/static routes.
- `/ru/contacts` is a static storefront page and should not be diagnosed as Payload-rendered.

Checks:

```bash
docker exec medusastore-storefront printenv PAYLOAD_ENABLED
```

```bash
docker exec medusastore-storefront printenv PAYLOAD_CMS_URL
```

```bash
curl -sS https://slavx.mooo.com/payload/api/pages?limit=10 | head
```

```bash
docker compose -p medusastore -f docker-compose.prod.yml --env-file .env logs --tail=200 payload-cms
```

Common causes:

- `PAYLOAD_ENABLED=false` means content routes intentionally fall back/not-found.
- Payload is connected to an empty/wrong DB.
- Seed was not run after provisioning.
- Payload migrations did not run after schema change.
- Page exists but not published (`_status` not `published`) and request is not draft/preview.

## 3. Wrong Payload database

Symptoms:

- Payload admin works, but expected pages/globals are missing.
- Production smoke `/payload/api/pages?limit=1` returns empty results unexpectedly.

Checks:

```bash
docker exec medusastore-payload printenv PAYLOAD_DATABASE_URL
```

Expected production shape:

```text
postgresql://<user>:<password>@medusa-db:5432/payload_cms?sslmode=disable
```

Also check compose env mapping in [`docker-compose.prod.yml`](../docker-compose.prod.yml): `DOCKER_PAYLOAD_DATABASE_URL` overrides the fallback.

Fix direction:

- Update remote `.env` to point Payload to the intended `payload_cms` database.
- Run migrations intentionally with `RUN_PAYLOAD_MIGRATIONS=true` if schema is not initialized.
- Run seed intentionally with `RUN_PAYLOAD_SEED=true` if baseline marketing pages are needed.

## 4. Storefront uses wrong backend URL

Symptoms:

- Server-side pages fail inside the production container.
- Browser `/store/*` calls work, but SSR/product/page requests fail.
- Logs show fetches to `localhost`, public HTTPS, or an unreachable URL from inside Docker.

Implementation fact:

- [`env.ts`](../medusa-agency-boilerplate-storefront/src/lib/env.ts) resolves `MEDUSA_BACKEND_URL` before `NEXT_PUBLIC_MEDUSA_BACKEND_URL`.

Production expectation:

- `MEDUSA_BACKEND_URL` / `DOCKER_MEDUSA_BACKEND_URL`: `http://medusa-backend:9000`.
- `NEXT_PUBLIC_MEDUSA_BACKEND_URL`: public/proxy origin, usually `https://slavx.mooo.com`, for browser-visible usage.

Checks:

```bash
docker exec medusastore-storefront printenv MEDUSA_BACKEND_URL
```

```bash
docker exec medusastore-storefront printenv NEXT_PUBLIC_MEDUSA_BACKEND_URL
```

```bash
docker exec medusastore-storefront wget -qO- http://medusa-backend:9000/health || true
```

Fix direction:

- Set `DOCKER_MEDUSA_BACKEND_URL=http://medusa-backend:9000` in remote `.env`.
- Rebuild/restart storefront because build args also receive backend/public URL values.

## 5. Publishable key missing or placeholder

Symptoms:

- Middleware errors: `Storefront middleware requires NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY to resolve regions.`
- Storefront redirects fail or region resolution fails.
- Product/store pages return `500`.

Checks:

```bash
docker exec medusastore-storefront printenv NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
```

The value must not be empty and must not be a placeholder such as `REPLACE_WITH_ROOT_BOOTSTRAP` or `pk_build_placeholder` in real production runtime.

Fix direction:

- Create/confirm a valid Medusa publishable key for the active sales channel/region.
- Put it into remote `.env` as `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`.
- Rebuild and restart storefront.

## 6. Caddy/HTTPS issues

Symptoms:

- HTTPS unavailable.
- `/healthz` fails publicly.
- Routes go to the wrong upstream.
- ACME/certificate errors.

Checks:

```bash
curl -I http://slavx.mooo.com/healthz
curl -I https://slavx.mooo.com/healthz
```

```bash
docker compose -p medusastore -f docker-compose.prod.yml --env-file .env logs --tail=300 caddy
```

```bash
docker exec medusastore-caddy caddy validate --config /etc/caddy/Caddyfile
```

Expected route ownership is in [`docker/caddy/Caddyfile`](../docker/caddy/Caddyfile). There is no Nginx layer to check.

Common causes:

- DNS for `slavx.mooo.com` does not point to the server.
- Ports `80`/`443` are blocked or already used.
- `DEPLOY_DOMAIN` or `ACME_EMAIL` wrong in remote `.env`.
- Caddy data/config volume has stale ACME state after domain change.

## 7. GitHub deploy hangs or fails

Symptoms:

- Workflow stuck during SSH, build, migrations, health wait, or smoke.
- Workflow fails before remote script.

Checks in GitHub Actions:

- `DEPLOY_HOST` resolves and is reachable on SSH.
- `DEPLOY_USER` is correct.
- `DEPLOY_PATH` points to `/home/som/MedusaStore`.
- `DEPLOY_SSH_PRIVATE_KEY` matches an authorized key for the user.
- Workflow concurrency group `production-deploy` may queue another run if one is active.

Checks on server:

```bash
cd /home/som/MedusaStore
git status --short
docker compose -p medusastore -f docker-compose.prod.yml --env-file .env ps
```

Common causes:

- missing remote `.env`;
- SSH key not accepted;
- remote path wrong;
- Docker build out of disk/memory;
- Payload migrations hanging;
- healthcheck never becomes healthy;
- smoke uses HTTPS before Caddy certificate is ready.

## 8. Smoke HTTP/HTTPS mismatch

Symptoms:

- Direct container checks pass.
- Public smoke fails.
- HTTP works but HTTPS fails, or redirects differ.

Default deploy smoke uses `https://${DEPLOY_DOMAIN}` unless `SMOKE_BASE_URL` is set.

Checks:

```bash
curl -I http://slavx.mooo.com/healthz
curl -I https://slavx.mooo.com/healthz
curl -I https://slavx.mooo.com/ru/about
```

If first ACME issuance is still pending, Caddy logs are authoritative:

```bash
docker compose -p medusastore -f docker-compose.prod.yml --env-file .env logs -f caddy
```

Temporary operator-only workaround for known first-boot cases:

```bash
SMOKE_BASE_URL=http://slavx.mooo.com bash ./scripts/prod-container-smoke.sh
```

Do not leave HTTP-only smoke as the permanent production contract if HTTPS is intended.

## 9. Payload migrations hanging

Symptoms:

- Deploy stuck at “Running Payload migrations as one-off job”.
- Payload container repeatedly restarts after migration attempt.

Checks:

```bash
docker compose -p medusastore -f docker-compose.prod.yml --env-file .env ps
```

```bash
docker compose -p medusastore -f docker-compose.prod.yml --env-file .env logs --tail=300 payload-cms
```

```bash
docker exec medusastore-db pg_isready -U "$POSTGRES_USER" -d payload_cms || true
```

Common causes:

- `PAYLOAD_DATABASE_URL` points to wrong host/db.
- `payload_cms` database missing.
- DB credentials wrong.
- Migration lock or long-running migration.
- Running migrations on every deploy by leaving `RUN_PAYLOAD_MIGRATIONS=true` unintentionally.

Fix direction:

- Set `RUN_PAYLOAD_MIGRATIONS=false` for normal deploys after migrations are applied.
- Run migration job explicitly during a maintenance window.
- Inspect DB locks before killing long-running migrations.

## 10. Quick log map

| Symptom | First logs to inspect |
| --- | --- |
| Caddy route/HTTPS issue | `docker compose ... logs caddy` |
| Product page `500` | `storefront`, then `medusa-backend` |
| Store API route fails | `medusa-backend` |
| Payload page missing | `payload-cms`, then storefront content logs |
| Deploy stuck after build | GitHub workflow step logs and remote Docker logs |
| Smoke fails only publicly | `caddy` plus public `curl -I` |
