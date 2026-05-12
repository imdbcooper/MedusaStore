# Payload CMS Runbook

> Status updated: `2026-05-11`.
>
> Current production truth: Payload CMS is a separate app and a production Docker service `payload-cms` / container `medusastore-payload` in [`docker-compose.prod.yml`](../docker-compose.prod.yml). Public access is through Caddy at `/payload/*`; server-side storefront access uses the internal Docker URL `http://payload-cms:3100` when Payload is enabled.

## 1. Architecture baseline

Payload CMS lives in [`payload-cms/`](../payload-cms) next to the Medusa backend and storefront.

Responsibility split:

- [`payload-cms/`](../payload-cms) is the headless content service for marketing/informational pages, posts/news, globals, navigation/footer/site settings, preview/drafts, publish/revalidate hooks, and editorial workflows.
- [`medusa-agency-boilerplate/`](../medusa-agency-boilerplate) remains the Medusa backend and source of truth for catalog, prices, carts, checkout, orders, fulfillment, payments, notifications, and operational commerce flows.
- [`medusa-agency-boilerplate-storefront/`](../medusa-agency-boilerplate-storefront) remains the shopper-facing Next storefront. It reads commerce data from Medusa and content data from Payload only when Payload is enabled.
- Payload must not duplicate commerce truth or store provider/payment/delivery secrets.
- The storefront keeps a commerce-only fallback path: Payload is opt-in for content routes and globals, not a hard requirement for basic commerce runtime.

Production topology is documented in [`architecture.md`](./architecture.md). Production operations are documented in [`production_runbook.md`](./production_runbook.md).

## 2. Production container/proxy behavior

Production compose includes Payload:

| Service | Container | Internal URL | Public route |
| --- | --- | --- | --- |
| `payload-cms` | `medusastore-payload` | `http://payload-cms:3100` | `https://studio.slavx.ru/payload/*` |

Caddy uses `handle_path /payload/*` in [`docker/caddy/Caddyfile`](../docker/caddy/Caddyfile), so requests under `/payload/*` are proxied to Payload with the prefix stripped.

Expected production env split:

- `PAYLOAD_CMS_URL=http://payload-cms:3100` / `DOCKER_PAYLOAD_CMS_URL=http://payload-cms:3100` for server-side container communication.
- `PAYLOAD_PUBLIC_SERVER_URL=https://studio.slavx.ru/payload` for public/admin URL semantics.
- `PAYLOAD_DATABASE_URL` or `DOCKER_PAYLOAD_DATABASE_URL` points to the dedicated `payload_cms` database on `medusa-db`.
- `PAYLOAD_ENABLED=true` in storefront enables content fetching. `false` means storefront content routes should not render Payload pages.

## 3. Local lifecycle commands

Root orchestration commands are exposed from [`package.json`](../package.json) and delegated to [`scripts/payload-run.sh`](../scripts/payload-run.sh).

| Command | Purpose |
| --- | --- |
| `npm run payload:dev` | Start Payload/Next development server in foreground, usually at `http://localhost:3100`. |
| `npm run payload:status` | Print env/runtime status, active Payload/Next processes, port state, admin healthcheck, and known `.next` corruption warnings. |
| `npm run payload:stop` | Stop active Payload/Next dev/start processes only. Does not remove [`payload-cms/.next`](../payload-cms/.next). |
| `npm run payload:clean` | Stop active Payload/Next dev/start processes and remove [`payload-cms/.next`](../payload-cms/.next). |
| `npm run payload:restart` | Clean and start `payload:dev` in foreground. Safest local recovery path for admin chunk/style issues. |
| `npm run payload:build` | Run production build for Payload. Guarded: refuses to build while a Payload/Next dev/start process is active. |
| `npm run payload:start` | Start the production server after a successful production build. |
| `npm run payload:types` | Generate Payload types. |
| `npm run payload:importmap` | Generate Payload import map. |
| `npm run payload:seed` | Seed/update marketing pages and globals used by local/staging/production smoke when explicitly requested. |

Interactive lifecycle is also available through [`scripts/manage.sh`](../scripts/manage.sh) and `npm run manage`.

## 4. Build guard: never build over active dev

Do not run `npm run payload:build` while Payload dev is already running.

Why this matters:

- Payload uses Next output under [`payload-cms/.next`](../payload-cms/.next).
- Concurrent `next dev` and `next build` can write incompatible chunks into the same directory.
- This previously produced missing vendor chunk errors and broken admin styling.

Correct local build flow:

1. `npm run payload:status`.
2. `npm run payload:stop` or `bash scripts/manage.sh payload:stop`.
3. If cache/build output must be reset, run `npm run payload:clean`.
4. `npm run payload:build`.
5. Optional: `npm run payload:start`.
6. To return to dev mode later: `npm run payload:restart`.

## 5. Migrations and seed toggles

Production deploy script [`scripts/github-deploy-staging.sh`](../scripts/github-deploy-staging.sh) controls Payload migrations and seed via environment:

| Variable | Default | Production semantics |
| --- | --- | --- |
| `RUN_PAYLOAD_MIGRATIONS` | `false` | When `true`, deploy runs a one-off Payload migration job before app containers start. Keep `false` for normal deploys after migrations are applied. |
| `RUN_PAYLOAD_SEED` | `false` | When `true`, deploy runs the marketing content seed as a one-off job. Use intentionally for initial provisioning or approved reseed. |

Seed script [`seed-marketing-content.mjs`](../payload-cms/scripts/seed-marketing-content.mjs) upserts demo/marketing content as published documents and globals. It is designed for baseline content, not for secret/config storage.

## 6. Current content routes and fallback semantics

Seeded Payload pages include:

| Storefront URL | Current behavior |
| --- | --- |
| `/ru/about` | Payload-rendered content page when `PAYLOAD_ENABLED=true` and page exists/published. |
| `/ru/promotions` | Payload-rendered content page when enabled and published. |
| `/ru/delivery-and-payment` | Payload-rendered content page when enabled and published. |
| `/ru/loyalty` | Payload-rendered content page when enabled and published. |
| `/ru/contacts` | Static storefront route, not Payload-rendered, because [`contacts/page.tsx`](../medusa-agency-boilerplate-storefront/src/app/[countryCode]/(main)/contacts/page.tsx) is a concrete route. |

`PAYLOAD_ENABLED=false` semantics:

- Content pages/news routes guarded by storefront code return `notFound()`/404 instead of fetching Payload.
- Commerce routes, product pages, cart/checkout/account shell, static contacts route, and other Medusa-backed routes should continue to work if their own dependencies are healthy.
- Header/footer may use fallback/static config when Payload globals are unavailable.

Payload fetch fallback semantics:

- If Payload is disabled or URL is empty, content client returns `null`.
- If Payload API returns non-OK or network error, content fetch returns `null` and the page route decides whether to 404.
- Draft/preview requires preview secrets/tokens; normal published rendering does not use preview mode.

## 7. Environment basics

Do not commit real secrets. Keep committed env examples as placeholders or safe defaults only.

| Variable | Scope | Notes |
| --- | --- | --- |
| `PAYLOAD_ENABLED` | Storefront/root env | Enables storefront content reads. `false` means content routes are disabled/fallback. |
| `PAYLOAD_CMS_URL` | Storefront server runtime | Internal production value should be `http://payload-cms:3100`; local value is usually `http://localhost:3100`. |
| `PAYLOAD_PUBLIC_SERVER_URL` | Payload runtime | Public/admin URL, e.g. `https://studio.slavx.ru/payload` in production. |
| `PAYLOAD_DATABASE_URL` | Payload runtime | Dedicated Payload database. Production should use `payload_cms`, not Medusa commerce DB. |
| `PAYLOAD_SECRET` | Payload runtime | Required Payload secret. Never commit real production value. |
| `PAYLOAD_CONTENT_PREVIEW_TOKEN` | Preview | Optional preview token. |
| `PAYLOAD_PREVIEW_SECRET` | Preview | Optional preview signing secret; fallback can use `PAYLOAD_SECRET`. |
| `PAYLOAD_REVALIDATE_SECRET` | Publish/revalidate | Secret used by storefront revalidate endpoint. |
| `STOREFRONT_REVALIDATE_URL` | Payload runtime | Production internal URL can be `http://storefront:8000/api/content/revalidate`. |

## 8. Troubleshooting

### 8.1. Payload admin renders as bare HTML or missing chunks

Likely cause: stale/corrupted [`payload-cms/.next`](../payload-cms/.next) from overlapping dev/build.

Recovery:

```bash
npm run payload:restart
```

If needed:

```bash
npm run payload:clean
npm run payload:dev
```

### 8.2. Production `/payload/api/pages?limit=1` is empty

Check database and seed state:

```bash
docker exec medusastore-payload printenv PAYLOAD_DATABASE_URL
curl -sS https://studio.slavx.ru/payload/api/pages?limit=10 | head
```

If DB is correct but empty, run an intentional seed by setting `RUN_PAYLOAD_SEED=true` for one deploy or by running an approved one-off seed job.

### 8.3. Storefront content pages 404

Check:

```bash
docker exec medusastore-storefront printenv PAYLOAD_ENABLED
docker exec medusastore-storefront printenv PAYLOAD_CMS_URL
curl -sS https://studio.slavx.ru/payload/api/pages?where[slug][equals]=about | head
```

Remember `/ru/contacts` is static and should be diagnosed separately from Payload-rendered pages.

### 8.4. Wrong Payload DB

Expected production URL points to `medusa-db:5432/payload_cms`. If it points to the commerce DB or localhost from inside a container, update remote `.env` and redeploy/restart.

### 8.5. Revalidation does not work

Check:

- Payload has `STOREFRONT_REVALIDATE_URL`.
- Payload has `PAYLOAD_REVALIDATE_SECRET`.
- Storefront has matching `PAYLOAD_REVALIDATE_SECRET`.
- Caddy routes `/api/content/*` to storefront.

See [`troubleshooting.md`](./troubleshooting.md) for production incident commands.

## 9. Readiness notes

Before committing Payload docs or config changes:

- keep code and docs changes separated when task scope is documentation-only;
- do not include real env values, database URLs with real passwords, admin passwords, tokens, or preview/revalidate secrets;
- validate docs against [`docker-compose.prod.yml`](../docker-compose.prod.yml), [`docker/caddy/Caddyfile`](../docker/caddy/Caddyfile), Payload config, and storefront content client;
- use [`production_runbook.md`](./production_runbook.md) for production deploy/smoke rather than local-only commands.
