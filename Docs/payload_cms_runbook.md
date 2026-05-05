# Payload CMS runbook

> Status updated: `2026-05-05`.
>
> Purpose: short operational runbook for the completed Payload CMS integration, local lifecycle commands, known admin fixes, and safe build/troubleshooting flow.

---

## 1. Architecture baseline

Payload CMS is integrated as a separate content application in [`payload-cms/`](../payload-cms), next to the existing Medusa backend and storefront applications.

Current responsibility split:

- [`payload-cms/`](../payload-cms) is the headless content service for marketing/informational pages, globals, navigation/footer/site settings, preview/drafts, publish/revalidate hooks, and editorial workflows.
- [`medusa-agency-boilerplate/`](../medusa-agency-boilerplate) remains the Medusa backend and source of truth for catalog, prices, carts, checkout, orders, fulfillment, payments, and operational commerce flows.
- [`medusa-agency-boilerplate-storefront/`](../medusa-agency-boilerplate-storefront) remains the shopper-facing Next storefront. It reads commerce data from Medusa and content pages from Payload when Payload is enabled.
- Payload must not duplicate product/commerce truth. Content may reference storefront/Medusa entities by stable handles, slugs, or IDs, but commerce truth remains in Medusa.
- The storefront keeps a commerce-only fallback path: Payload is opt-in for content, not a hard requirement for the basic template startup.

---

## 2. Local lifecycle commands

Root orchestration commands are exposed from [`package.json`](../package.json) and delegated to [`scripts/payload-run.sh`](../scripts/payload-run.sh).

| Command | Purpose |
| --- | --- |
| `npm run payload:dev` | Start Payload/Next development server in foreground, usually at `http://localhost:3100`. |
| `npm run payload:status` | Print env/runtime status, active Payload/Next processes, port state, admin healthcheck, and known `.next` corruption warnings. |
| `npm run payload:clean` | Stop active Payload/Next dev processes and remove [`payload-cms/.next`](../payload-cms/.next). |
| `npm run payload:restart` | Stop active Payload/Next dev, remove [`payload-cms/.next`](../payload-cms/.next), then start `payload:dev` in foreground. This is the safest recovery command for local admin chunk/style issues. |
| `npm run payload:build` | Run production build for Payload. Guarded: it refuses to build while a Payload/Next dev process is active. |
| `npm run payload:start` | Start the production server after a successful production build. |
| `npm run payload:types` | Generate Payload types. |
| `npm run payload:importmap` | Generate Payload import map. |
| `npm run payload:seed` | Seed/update test marketing pages and globals used by local storefront verification. |

Interactive lifecycle is also available through [`scripts/manage.sh`](../scripts/manage.sh) and `npm run manage`:

- menu item `21` — Payload status/health;
- menu item `22` — Payload dev server;
- menu item `23` — Payload production build;
- menu item `24` — Payload production start;
- menu item `25` — Payload types + importmap;
- menu item `26` — Payload seed test content;
- menu item `27` — Payload clean;
- menu item `28` — Payload restart.

The same commands are available as direct manager arguments where useful, for example `bash scripts/manage.sh payload:status` or `bash scripts/manage.sh payload:restart`.

---

## 3. Build guard: never build over active dev

Do not run `npm run payload:build` while Payload dev is already running.

Why this matters:

- Payload uses Next output under [`payload-cms/.next`](../payload-cms/.next).
- Concurrent `next dev` and `next build` can write incompatible server chunks into the same [`payload-cms/.next`](../payload-cms/.next) directory.
- This previously corrupted the local admin runtime and produced the error `Cannot find module './vendor-chunks/date-fns.js'` because server app chunks referenced `vendor-chunks/date-fns` while the matching vendor chunk file was missing.

Correct local build flow:

1. Check state: `npm run payload:status`.
2. Stop/clean dev output: `npm run payload:clean`.
3. Run production build: `npm run payload:build`.
4. Optional production start after build: `npm run payload:start`.
5. To return to development mode later: `npm run payload:restart`.

The guard is implemented in [`scripts/payload-run.sh`](../scripts/payload-run.sh). If it finds active Payload/Next dev processes before build, it exits with an explanation instead of risking another [`payload-cms/.next`](../payload-cms/.next) corruption.

---

## 4. Test content and storefront URLs

Payload seed content covers the current informational storefront pages:

| Storefront URL | Content role |
| --- | --- |
| `/ru/about` | About/company information page. |
| `/ru/promotions` | Promotions/marketing offers page. |
| `/ru/delivery-and-payment` | Delivery and payment information page. |
| `/ru/contacts` | Contacts page. |
| `/ru/loyalty` | Loyalty program page. |

Recommended local verification sequence after changing content integration or reseeding:

1. Start or restart Payload: `npm run payload:restart`.
2. Seed test pages/globals if needed: `npm run payload:seed`.
3. Start the storefront with its normal local command.
4. Open the URLs above under the Russian locale and confirm pages render through the storefront, not directly through the Payload admin.

---

## 5. Environment basics

Do not commit real secrets. Keep committed env examples as placeholders or safe local defaults only.

Minimum local content-layer switches and URLs:

| Variable | Scope | Notes |
| --- | --- | --- |
| `PAYLOAD_ENABLED=true` | Storefront/root env | Enables storefront content reads from Payload. If disabled/empty, storefront should keep commerce-only fallback behavior. |
| `PAYLOAD_CMS_URL=http://localhost:3100` | Root/storefront/Payload coordination | Local Payload URL used by storefront and scripts. |
| `PAYLOAD_DATABASE_URL` | Payload runtime | Database URL for Payload CMS. May be mapped to `DATABASE_URL` by [`scripts/payload-run.sh`](../scripts/payload-run.sh) for local runtime. |
| `PAYLOAD_SECRET` | Payload runtime | Required Payload secret. Use a local/generated value; never document or commit a real production secret. |
| `PAYLOAD_CONTENT_PREVIEW_TOKEN` | Storefront/Payload preview | Optional preview access token. Keep empty unless preview is explicitly enabled. |
| `PAYLOAD_PREVIEW_SECRET` | Storefront/Payload preview | Optional preview secret. Keep empty unless preview is explicitly enabled. |
| `PAYLOAD_REVALIDATE_SECRET` | Payload publish/revalidate | Optional revalidation secret for content publish lifecycle. |
| `REVALIDATE_SECRET` | Storefront revalidate endpoint | Optional storefront-side revalidate secret; should match the intended revalidate flow when enabled. |

Operational notes:

- Payload env is local to [`payload-cms/.env`](../payload-cms/.env), but root orchestration may create/sync defaults from examples.
- Keep preview/revalidate secrets absent or placeholder-only until a deployment explicitly enables these paths.
- Never copy provider/payment/delivery credentials into Payload content or docs. Payload is a content layer, not a secrets vault.

---

## 6. Troubleshooting

### 6.1. `Cannot find module './vendor-chunks/date-fns.js'`

Likely cause: local [`payload-cms/.next`](../payload-cms/.next) was corrupted by overlapping dev/build writes or stale Next output.

Recovery:

1. Run `npm run payload:restart`.
2. If the problem persists, run `npm run payload:clean`, then `npm run payload:dev`.
3. Re-check with `npm run payload:status`.
4. Do not run `npm run payload:build` again until Payload dev is stopped.

### 6.2. Payload admin renders as bare HTML or without styles

Likely cause: Payload admin CSS is not imported by the top-level Payload app layout.

Expected fix state:

- [`payload-cms/src/app/layout.tsx`](../payload-cms/src/app/layout.tsx) must import `@payloadcms/next/css`.
- If styles disappear after a cache/chunk issue, restart with `npm run payload:restart` before investigating code again.

### 6.3. Nested `html`/`body` admin error

Likely cause: Payload `RootLayout` was mounted from more than one layout boundary.

Expected fix state:

- Payload `RootLayout` belongs only in the top-level app layout in [`payload-cms/src/app/layout.tsx`](../payload-cms/src/app/layout.tsx).
- Route-group layouts under Payload admin/content route groups must be transparent wrappers and must not render a second `<html>` or `<body>`.

### 6.4. Admin still unhealthy after restart

Quick checks:

1. `npm run payload:status` for port/process/env/admin health.
2. Confirm `PAYLOAD_DATABASE_URL` and `PAYLOAD_SECRET` are configured locally.
3. Confirm no old Payload/Next process is still listening on port `3100`.
4. Use `npm run payload:clean` before another `npm run payload:dev` if the status command reports a missing vendor chunk.

---

## 7. Commit/readiness notes

Before committing Payload CMS documentation or follow-up fixes:

- keep code and docs changes separated when the task scope says documentation-only;
- do not include real env values, database URLs with credentials, admin passwords, tokens, or preview/revalidate secrets;
- run a quick Markdown/basic sanity check after editing this runbook;
- if a final verification includes build, follow the guarded flow in section 3 and do not build over active dev.
