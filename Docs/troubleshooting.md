# Troubleshooting

> Current operational troubleshooting for Docker/Caddy production and local/runtime parity. Do not paste secrets into tickets, docs, logs, or commits.

## 1. Product page returns `500`

Symptoms:

- `https://studio.slavx.ru/ru/products/<handle>` returns `500`.
- Storefront logs show Medusa fetch failures, missing publishable key, backend URL errors, or region/product lookup errors.

Implementation facts:

- Product detail route is dynamic: [`page.tsx`](../medusa-agency-boilerplate-storefront/src/app/[countryCode]/(main)/products/[handle]/page.tsx) exports `dynamic = "force-dynamic"`.
- Build-time static params may be empty if Store API is unavailable. That is not enough to prove runtime is broken.
- Runtime fetches product by `handle` and country/region.

Checks:

```bash
curl -I https://studio.slavx.ru/ru/products/<real-product-handle>
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
curl -sS https://cms.slavx.ru/api/pages | head
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
- Production smoke for `https://cms.slavx.ru/api/pages` returns empty results unexpectedly.

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
- `NEXT_PUBLIC_MEDUSA_BACKEND_URL`: public/proxy origin, usually `https://studio.slavx.ru`, for browser-visible usage.

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
curl -I http://studio.slavx.ru/healthz
curl -I https://studio.slavx.ru/healthz
```

```bash
docker compose -p medusastore -f docker-compose.prod.yml --env-file .env logs --tail=300 caddy
```

```bash
docker exec medusastore-caddy caddy validate --config /etc/caddy/Caddyfile
```

Expected route ownership is in [`docker/caddy/Caddyfile`](../docker/caddy/Caddyfile). There is no Nginx layer to check. The Caddy Docker healthcheck intentionally uses the local `http://127.0.0.1/healthz` site; public HTTPS and redirects for `${DEPLOY_DOMAIN}` stay enabled separately.

Common causes:

- DNS for `studio.slavx.ru` does not point to the server.
- Ports `80`/`443` are blocked or already used.
- `DEPLOY_DOMAIN` or `ACME_EMAIL` wrong in remote `.env`.
- Caddy data/config volume has stale ACME state after domain change.

## 7. SMTP notification provider falls back to local or cannot send

Symptoms:

- Admin notification smoke reports `provider.requested=smtp` but `provider.resolved=local`.
- Backend logs include an SMTP fallback warning.
- SMTP smoke/send fails after explicitly enabling the provider.

Checks:

```bash
docker exec medusastore-backend printenv NOTIFICATION_EMAIL_PROVIDER
```

```bash
docker exec medusastore-backend printenv SMTP_HOST
```

```bash
docker exec medusastore-backend printenv SMTP_PORT
```

Do not print `SMTP_PASSWORD` in terminals, tickets, docs, or logs.

Expected production activation shape after approval:

```text
NOTIFICATION_EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.slavx.ru
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@notify.slavx.ru
SMTP_FROM=noreply@notify.slavx.ru
SMTP_TLS_REJECT_UNAUTHORIZED=true
```

Common causes:

- `SMTP_PASSWORD` is missing from the real backend `.env`.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, or `SMTP_FROM` is empty or mistyped.
- PTR for `77.83.92.194 -> smtp.slavx.ru` is not set yet, which affects deliverability.
- SMTP TLS certificate is still self-signed/untrusted. `SMTP_TLS_REJECT_UNAUTHORIZED=false` is only a temporary bootstrap diagnostic, not final production configuration.
- DMARC was recently changed and should be rechecked before production rollout.
- Smoke recipient points to a real user instead of an operator/test mailbox.

Current external mailserver follow-ups:

- mail VPS `smtpserv` (`77.83.92.194`) runs docker-mailserver from `/opt/mailserver` for `smtp.slavx.ru`;
- provider-side PTR/rDNS `77.83.92.194 -> smtp.slavx.ru` is still pending;
- trusted TLS certificate for `smtp.slavx.ru` is still pending;
- current relaxed TLS setting `SMTP_TLS_REJECT_UNAUTHORIZED=false` is temporary for staging/bootstrap only;
- after installing the trusted certificate, set `SMTP_TLS_REJECT_UNAUTHORIZED=true`, restart the backend, and verify SMTP smoke again.

Certificate handling direction:

- issue and keep the Let's Encrypt certificate directly on `smtpserv`, because the private key should live next to the TLS-terminating SMTP service (`docker-mailserver`);
- use HTTP-01 if port `80` can be opened on the mail VPS without service conflicts; otherwise use DNS-01 through the DNS provider API/manual flow;
- do not copy the private key through the main staging/production server;
- mount/connect the issued cert paths into `/opt/mailserver/config/ssl` and docker-mailserver SSL config, then reload/recreate the mailserver container.

## 7a. Transactional email link opens "Страница не найдена" on storefront

Symptoms:

- email verification or password reset email arrives, but clicking the link shows Next.js 404 page;
- notification row on backend DB contains link like `https://host/account/verify-email?token=...` without a country segment between host and path;
- storefront route `[countryCode]/(main)/account/verify-email` exists and returns `200` for URLs that include `/ru/`.

Checks:

```bash
ssh <staging-or-prod-host> \
  "docker exec medusastore-db psql -U <dbuser> -d medusa -t -A -F '|' \
   -c \"select to_char(created_at,'YYYY-MM-DD HH24:MI:SS'), template, \\\"to\\\", \
       left(coalesce(data->>'link', data->'data'->>'link', ''), 200) \
       from notification where created_at > now() - interval '2 hours' \
       order by created_at desc limit 5;\""
```

```bash
curl -sI "https://<host>/ru/account/verify-email?token=test"
curl -sI "https://<host>/account/verify-email?token=test"
```

Expected after fix:

- DB link column contains `https://host/ru/account/verify-email?token=...` with country segment;
- curl against the `/ru/...` path returns `200`, curl against the `/...` path (without country) returns `404` which is correct Next.js behavior.

Common cause:

- Legacy regression: `resolveCountryCode()` in [`sendEmailVerificationWorkflow`](../medusa-agency-boilerplate/src/workflows/send-email-verification.ts:1), [`sendPasswordResetWorkflow`](../medusa-agency-boilerplate/src/workflows/send-password-reset.ts:1), or [`sendMarketingConfirmationWorkflow`](../medusa-agency-boilerplate/src/workflows/send-marketing-confirmation.ts:1) returned `null` when the caller did not pass `countryCode`. [`customerCreatedEmailVerificationHandler`](../medusa-agency-boilerplate/src/subscribers/customer-created-email-verification.ts:1) does not pass `countryCode`, so links were built without the country segment.
- Fix: the workflows now apply a three-tier precedence — explicit `input.countryCode` → env `NOTIFICATION_DEFAULT_COUNTRY_CODE` → hardcoded `"ru"`.
- If a deployment still produces country-less links after the fix, verify the backend container restarted after deploy so that the updated compiled code is live, and confirm `STOREFRONT_URL` points to the correct public host.

## 8. GitHub deploy hangs or fails

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
- smoke uses HTTPS before Caddy certificate is ready;
- interrupted Docker Compose recreate leaving replace-labeled containers, typically visible as `Error response from daemon: Conflict. The container name "/<id>_medusastore-..." is already in use`; the canonical deploy script uses `--force-recreate --remove-orphans`, and the operator-approved manual recovery is to rerun the workflow or, in an incident, run the same compose `up -d --force-recreate --remove-orphans` for app services and then `scripts/staging-container-smoke.sh`.

## 8. Smoke HTTP/HTTPS mismatch

Symptoms:

- Direct container checks pass.
- Public smoke fails.
- HTTP works but HTTPS fails, or redirects differ.

Default deploy smoke uses `https://${DEPLOY_DOMAIN}` unless `SMOKE_BASE_URL` is set.

Checks:

```bash
curl -I http://studio.slavx.ru/healthz
curl -I https://studio.slavx.ru/healthz
curl -I https://studio.slavx.ru/ru/about
```

If first ACME issuance is still pending, Caddy logs are authoritative:

```bash
docker compose -p medusastore -f docker-compose.prod.yml --env-file .env logs -f caddy
```

Temporary operator-only workaround for known first-boot cases:

```bash
SMOKE_BASE_URL=http://studio.slavx.ru bash ./scripts/staging-container-smoke.sh
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

## 10. AI Assistant failures

Symptoms:

- Storefront widget is missing, disabled, or cannot open chat.
- `POST /store/assistant/chat` or `GET /store/assistant/history` fails from the browser.
- Admin reindex, queue drain, queue stats, assistant stats, or job-status routes fail.
- Product changes enqueue intents but assistant search results do not refresh.

Implementation facts:

- The backend adapter is installed in [`medusa-agency-boilerplate`](../medusa-agency-boilerplate) and is exact opt-in only when `AI_ASSISTANT_ENABLED=true`.
- The storefront widget is installed under [`assistant`](../medusa-agency-boilerplate-storefront/src/modules/assistant) and is hidden by default with `NEXT_PUBLIC_AI_ASSISTANT_WIDGET_ENABLED=false`.
- Browser traffic must use backend Store API proxy routes: `/store/assistant/chat` and `/store/assistant/history`.
- Backend server-to-server calls use `AI_ASSISTANT_SERVER_TOKEN`; the standalone assistant service expects `AI_ASSISTANT_API_TOKEN`.
- Subscribers only enqueue durable reindex intents. Actual drain/processing is explicit through `/admin/assistant/reindex/process`, a worker, or cron.

Checks:

```bash
docker compose -p medusastore -f docker-compose.prod.yml --env-file .env --profile ai-assistant ps
```

```bash
docker compose -p medusastore -f docker-compose.prod.yml --env-file .env logs --tail=200 medusa-backend
```

```bash
docker compose -p medusastore -f docker-compose.prod.yml --env-file .env --profile ai-assistant logs --tail=200 ai-assistant
```

```bash
docker exec medusastore-backend printenv AI_ASSISTANT_ENABLED
docker exec medusastore-backend printenv AI_ASSISTANT_BASE_URL
docker exec medusastore-storefront printenv NEXT_PUBLIC_AI_ASSISTANT_WIDGET_ENABLED
```

```bash
curl -fsS https://studio.slavx.ru/store/assistant/history || true
```

Common causes:

- The root Compose `ai-assistant` profile was not started, or the assistant container is unhealthy.
- `AI_ASSISTANT_ENABLED` is missing or not exactly `true`, so the backend adapter returns a controlled disabled response.
- `AI_ASSISTANT_BASE_URL` is not reachable from `medusastore-backend` on the Docker network.
- `AI_ASSISTANT_SERVER_TOKEN` does not match the assistant service `AI_ASSISTANT_API_TOKEN`.
- `NEXT_PUBLIC_AI_ASSISTANT_WIDGET_ENABLED=false` intentionally hides the widget in the storefront.
- Browser code is calling the assistant service directly instead of `/store/assistant/chat` or `/store/assistant/history`.
- Reindex intents were enqueued but never drained through admin, worker, or cron processing.

Fix direction:

- Keep the widget default-off unless launch/review explicitly enables it.
- Enable the backend adapter only with exact `AI_ASSISTANT_ENABLED=true` and matching backend/service tokens.
- Verify `/store/assistant/history` remains a scoped proxy and does not expose server tokens.
- Drain queued work explicitly with `POST /admin/assistant/reindex/process` or deploy a reviewed worker/cron path.
- Do not paste assistant API tokens, server tokens, LLM keys, raw chat PII, or provider payloads into logs/tickets/docs.

## 11. Quick log map

| Symptom | First logs to inspect |
| --- | --- |
| Caddy route/HTTPS issue | `docker compose ... logs caddy` |
| Product page `500` | `storefront`, then `medusa-backend` |
| Store API route fails | `medusa-backend` |
| AI Assistant chat/history/reindex fails | `medusa-backend`, then `medusastore-ai-assistant` |
| Payload page missing | `payload-cms`, then storefront content logs |
| Deploy stuck after build | GitHub workflow step logs and remote Docker logs |
| Smoke fails only publicly | `caddy` plus public `curl -I` |

## 12. VK ID duplicate customers (Phase 5.3 concurrent-race emergency response)

`createVkIdCustomer` runs `lookupCustomerByEmail` and
`createAuthIdentities` in two separate steps. Two VK callbacks that race for
the same `vk_user_id` or the same email can, in rare cases, both observe the
"not found" branch and both try to create a customer. The unique constraint
on `provider_identities.entity_id` prevents a duplicate auth identity from
being created (the second request fails), but the race window is documented
as a Phase 5.4 advisory-lock item.

### Detect duplicates

Against the staging database, run:

```sql
select lower(email) as email, count(*) as customers
from customer
where has_account = true
  and deleted_at is null
group by lower(email)
having count(*) > 1
order by customers desc;
```

Expected healthy result is an empty set. A non-empty result means at least
one email has two or more `has_account=true` customer rows.

For each affected email, list the suspects:

```sql
select id, email, created_at, metadata->'vk_link'->>'vk_user_id' as vk_user_id,
       metadata->'vk_link'->>'link_status' as vk_link_status
from customer
where lower(email) = lower('<affected-email>')
  and has_account = true
  and deleted_at is null
order by created_at asc;
```

### Resolve

1. Pick the earliest `created_at` row as the canonical customer.
2. Verify which row actually has the VK link
   (`metadata.vk_link.link_status = 'linked'`). That row wins the VK link; if
   none does, the canonical row is chosen.
3. Soft-delete the duplicates with `update customer set deleted_at = now()
   where id = '<duplicate-id>';`. Do NOT `delete`; the historical audit
   chain (orders, carts, addresses) must survive.
4. If the customer already has orders or carts linked to the duplicate
   row, escalate to engineering before deleting — those have to be
   reassigned to the canonical customer first.

### Prevent recurrence

- Keep `VK_ID_REGISTER_ENABLED=false` on environments where the race is
  actively problematic until Phase 5.4 ships the advisory lock.
- Monitor `[vk-id] register creation failed` log lines with
  `code=customer_account_creation_failed` — they are the symptom of the
  second caller losing the race.
- Never run the detection query on production credentials when copy-pasting;
  scope it to the staging DB as described in `Docs/staging_runbook.md`.

Do not commit emails, vk_user_ids, or other customer PII into logs, tickets,
or commit messages while diagnosing. Reference them by row id only.

## 12.b. VK ID callback returns `not_allowed` / "Publishable API key required"

### Symptoms

- After a successful VK consent screen the browser lands on
  `https://<host>/store/vk-id/callback?code=...&state=...` and Medusa
  responds with HTTP 400 and a JSON body of the shape
  `{"type":"not_allowed","message":"Publishable API key required in the
  request header: x-publishable-api-key. ..."}`.
- Backend logs show the request never reaches
  `medusa-agency-boilerplate/src/api/store/vk-id/callback/route.ts`; the
  framework rejects it earlier.

### Cause

Medusa's framework router applies `ensurePublishableApiKeyMiddleware`
(`medusa-agency-boilerplate/node_modules/@medusajs/framework/dist/http/middlewares/ensure-publishable-api-key.js`)
to the entire `/store/*` namespace unconditionally — see
`router.js#applyStorePublishableKeyMiddleware`. The middleware has no
per-route exemption hook. VK can only redirect to a static URL the
operator configured in the VK ID admin panel, and a browser direct
redirect from VK cannot inject the `x-publishable-api-key` header.

### Resolve

VK must redirect the user to the storefront proxy
[`route.ts`](../medusa-agency-boilerplate-storefront/src/app/api/auth/vk-id/callback/route.ts),
not the bare Medusa Store API path. The proxy attaches the publishable
key on the server side and forwards to the backend internally. To
restore service:

1. Confirm `VK_ID_REDIRECT_URI` points at
   `https://<storefront-origin>/api/auth/vk-id/callback` in both the
   GitHub Actions secret/variable used by `Deploy Staging` and the
   remote `.env` on `som@studio.slavx.ru:/home/som/MedusaStore/.env`.
2. Update the redirect URL in the VK ID developer admin panel to match.
3. Redeploy via the `Deploy Staging` workflow so the backend reads the
   new value (the redirect URI is part of the OAuth `code` exchange and
   must agree with what VK saw on the authorize step).
4. Smoke: VK button → consent → return → expect a `_medusa_jwt` cookie
   on the storefront origin and a redirect to `/ru/account` (login) or
   `/ru/account/profile` (link).

### Prevent recurrence

- Never set `VK_ID_REDIRECT_URI` to a `/store/*` URL on
  studio.slavx.ru. The historical pre-proxy value
  `https://studio.slavx.ru/store/vk-id/callback` will always 400 from
  the browser.
- Keep the storefront proxy and backend callback in sync: any change to
  the backend `StoreVkIdCallbackSchema` accepted query params must be
  mirrored in
  [`vk-id-callback-proxy.ts#ALLOWED_VK_PROXY_PARAMS`](../medusa-agency-boilerplate-storefront/src/lib/util/vk-id-callback-proxy.ts).

## 13. Hydration mismatch on storefront (`NEXT_PUBLIC_*` build-time inlining)

### Symptoms

- A storefront UI element (for example the VK login button on `/ru/account`)
  briefly appears in SSR HTML and then disappears in the browser.
- Browser console shows `Uncaught Error: Minified React error #418`
  ("Hydration failed because the initial UI does not match what was rendered
  on the server").
- `curl -s https://studio.slavx.ru/ru/account` shows the element in HTML, but
  it is removed from the DOM after first client render.

### Root cause

`NEXT_PUBLIC_*` flags read in
[`src/lib/env.ts`](../medusa-agency-boilerplate-storefront/src/lib/env.ts)
(`VK_ID_ENABLED`, `YOOKASSA_ENABLED`, `STOREFRONT_PRESET`, `STRIPE_COMPAT_ENABLED`)
must be present at `next build` time so Next.js can inline the literal value
into the **client** bundle. If they are only injected at container runtime,
the **server** side reads `true` from `process.env` while the **client**
bundle keeps the unresolved `process.env.NEXT_PUBLIC_*` reference (which is
`undefined` in the browser). Server renders one tree, client renders another,
React reports #418, and the conditional UI flickers.

### Diagnosis

Confirm the inlining state inside the running storefront container:

```bash
ssh slavx-store 'docker exec medusastore-storefront sh -c \
  "grep -oE \".{40}NEXT_PUBLIC_VK_ID_ENABLED.{40}\" \
   .next/static/chunks/app/\\[countryCode\\]/\\(main\\)/account/*.js | head -1"'
```

- Healthy build inlines a literal: `let h="true"==="true";` (or `=false`).
- Broken build keeps the reference: `let h="true"===d.env.NEXT_PUBLIC_VK_ID_ENABLED;`
  (where `d.env` is `process.env`, empty in the browser).

Cross-check container runtime env to make sure SSR sees a different value:

```bash
ssh slavx-store 'docker exec medusastore-storefront env | grep NEXT_PUBLIC_'
```

### Fix

`NEXT_PUBLIC_*` flags consumed in client components must be passed to the
storefront image as build args, not only as runtime container env:

- [`docker/storefront/Dockerfile`](../docker/storefront/Dockerfile) declares an
  `ARG` plus a matching `ENV` for each public flag in the `builder` stage.
- [`docker-compose.prod.yml`](../docker-compose.prod.yml) `storefront.build.args`
  forwards those flags from the staging `.env` so `next build` inlines the
  value into the client bundle.

Currently wired through this contract:
`NEXT_PUBLIC_VK_ID_ENABLED`, `NEXT_PUBLIC_YOOKASSA_ENABLED`,
`NEXT_PUBLIC_STOREFRONT_PRESET`, `NEXT_PUBLIC_STRIPE_KEY`,
`NEXT_PUBLIC_AI_ASSISTANT_WIDGET_ENABLED`,
`NEXT_PUBLIC_AI_ASSISTANT_CHAT_ENDPOINT`,
`NEXT_PUBLIC_MEDUSA_BACKEND_URL`, `NEXT_PUBLIC_BASE_URL`,
`NEXT_PUBLIC_DEFAULT_REGION`, `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`.

When adding a new `NEXT_PUBLIC_*` flag that gates UI in a server-rendered
client component, extend both the `Dockerfile` and `docker-compose.prod.yml`
build args to keep SSR and the client bundle in sync.

### Validate after redeploy

```bash
curl -s https://studio.slavx.ru/ru/account | grep -o 'data-testid="vk-login-button"' | head -1
```

In a private browser window the element must remain visible after first
render and the console must be free of React error #418.

## 14. VK ID onboarding flow (Phase 5.5)

> Полный контракт — [`Docs/vk-onboarding-spec.md`](./vk-onboarding-spec.md).
> Этот раздел перечисляет только operational failure modes.

### 14.1. `invalid_or_expired_state` после VK consent

Symptoms:

- После VK consent storefront редиректит на `/account` с
  `?vk_login_error=invalid_or_expired_state` или `?vk_id_reason=invalid_or_expired_state`.
- Backend log показывает `verifySignedState() returned null`.
- Воспроизводится в части браузеров/мобильных VK app, не у всех пользователей.

Root cause:

- VK ID `/authorize` bridge переписывает `state` в `redirect_state` и удаляет
  пунктуацию (`.`, `~`, `:`, `*`) перед финальной auth-страницей. Старый
  формат `{base64url-payload}.{signature}` ломался: точка пропадала и подпись
  становилась невалидной.
- Phase 5.5 переключила signed state на VK-safe compact формат без
  разделителя: `{payload}{43-char-signature}` (см.
  [`vk-id.ts#buildSignedState`](../medusa-agency-boilerplate/src/modules/vk-id.ts:489)).
- [`verifySignedState`](../medusa-agency-boilerplate/src/modules/vk-id.ts:501) умеет читать оба формата:
  legacy `payload.signature` и новый compact. Если оба не валидируются — это
  настоящая подделка/протухание, отдаём `invalid_or_expired_state`.

Diagnosis:

```bash
# Проверить версию backend на staging
ssh slavx-store 'cd /home/som/MedusaStore && git log --oneline -5 -- medusa-agency-boilerplate/src/modules/vk-id.ts'
```

Ожидаемые коммиты в истории файла: `562a45c`, `0577dcb` (compact state +
legacy reader). Если их нет — backend старее Phase 5.5.

```bash
# Подтянуть лог callback-а
ssh slavx-store 'docker logs --tail=100 medusastore-backend 2>&1 | grep "vk-id"'
```

Resolve:

1. Подтвердить, что `Deploy Staging` отработал последний релиз с Phase 5.5
   (после commit `0577dcb`).
2. Проверить, что `VK_ID_SESSION_SECRET` не менялся между mint state и
   callback (миграция секрета инвалидирует уже выпущенные state-токены —
   ожидаемо до 10 минут протухания).
3. Если симптом сохранился после деплоя — собрать конкретный пример state
   из VK redirect (без секретов в тикете) и проверить локально, не содержит ли
   он недопустимый символ помимо удаляемой VK пунктуации.

Prevent recurrence:

- Не передавать VK ID state через cookies/headers, которые могут быть обрезаны
  прокси.
- Не менять `VK_ID_SESSION_SECRET` без одновременной перевыпуска всех уже
  открытых VK-сессий (ожидаемая инвалидация).

### 14.2. `missing_vk_peer_id` от callback

Symptoms:

- Storefront получает `?vk_login_error=missing_vk_peer_id` или
  `?vk_id_reason=missing_vk_peer_id` после consent.
- В backend log видно
  `redirectWithLoginError(res, returnUrl, "missing_vk_peer_id")`.

Root cause:

- VK userInfo не вернул `user.user_id` ИЛИ derived `vkPeerId` пустой. Без
  `vkPeerId` нельзя адресовать VK Community Messaging, поэтому регистрация и
  link отказываются принимать identity ([`route.ts:295-297`](../medusa-agency-boilerplate/src/api/store/vk-id/callback/route.ts:295)).

Resolve:

- Проверить scope: `VK_ID_SCOPES` обязан содержать `vkid.personal_info`.
  Без него VK не отдаёт `user_id`.
- Проверить, что VK ID приложение настроено корректно: домен совпадает,
  redirect URI указывает на storefront proxy, а не на bare `/store/vk-id/callback`.
- Если ошибка случилась один раз и больше не воспроизводится — VK мог
  временно вернуть пустое тело userInfo; это transient.

### 14.3. Onboarding endpoint: `email_required` / `email_already_set` / `email_already_exists` / `onboarding_already_complete`

Endpoint: `POST /store/customers/me/onboarding`. Контракт описан в
[`Docs/vk-onboarding-spec.md` §6.3](./vk-onboarding-spec.md).

| HTTP | Code | Когда | Что делать |
| --- | --- | --- | --- |
| `400` | `email_required` | Текущий `customer.email` — placeholder, в body не передан `email`. | Storefront форма обязана требовать email если `placeholder_email=true`. Если ошибка пришла на корректную форму — проверить, что `submitOnboarding({email})` действительно сериализует поле. |
| `400` | `email_already_set` | Текущий email уже реальный, но в body передан новый. | Эндпоинт намеренно не позволяет менять email через onboarding (для смены email есть отдельный flow в профиле). |
| `409` | `email_already_exists` | Email занят другим customer. | Storefront показывает локализованное сообщение. Пользователь может ввести другой email или объединить аккаунт через VK link conflict flow (см. §12.b и Phase 5.3 контракт). |
| `400` | `onboarding_already_complete` | `metadata.onboarding.status === "complete"` или метаданных нет. | Не показывать форму, перевести пользователя на `/account`. Это не баг — повторный POST. |
| `401` | `customer_auth_required` | Сессия не аутентифицирована. | Перелогин. |
| `404` | `customer_not_found` | Сессия валидна, но customer удалён. | Очистить сессию, заставить перелогин. |
| `500` | `update_failed` / `internal_error` | DB / workflow-ошибка. | Лог содержит `customer_id` и `error_length`; проверить backend log. |

Phone в endpoint всегда optional. Pole `phone: ""` валиден (схема trim+strip).
Логика «phone уже заполнен — пропустить» отражена в логах
`[onboarding] phone already set for customer_id=… skipping` и не является ошибкой.

Diagnosis:

```bash
# Backend log по конкретному customer (не выводить email в тикет)
ssh slavx-store 'docker logs --tail=200 medusastore-backend 2>&1 | grep "\[onboarding\]"'
```

Resolve specifically for `email_already_exists`:

1. Подтвердить дубль через SQL (см. §12 — там описан запрос для дублей по
   `lower(email)`).
2. Если у второго аккаунта реально нет VK link — пользователь должен
   зайти через email/пароль и привязать VK, а не пытаться создать второй
   аккаунт через VK onboarding.
3. Если требуется merge — это manual operator job, не автоматизировано.

### 14.4. Checkout gate: `onboarding_required`

Symptoms:

- `POST /store/carts/:id/complete` → `400` с телом
  `{"type":"invalid_data","code":"onboarding_required","details":{"reason":"placeholder_email","action":"complete_onboarding"}}`.
- Storefront показывает CTA «Заполнить профиль».

Root cause:

- Customer аутентифицирован, но `customer.email` соответствует
  `@placeholder.internal`. Middleware
  [`enforceOnboardingEmailForCheckout`](../medusa-agency-boilerplate/src/modules/onboarding-checkout-gate.ts:19)
  блокирует cart completion до завершения onboarding.

Resolve:

1. Передать пользователя на `/{countryCode}/account/onboarding`.
2. После успешного email update — повторить попытку checkout. Сессия
   остаётся валидной, отдельного логина не требуется.

Edge case — guest checkout:

- Если `auth_context.actor_id` пуст, middleware **пропускает** (cart
  использует email из самого cart). Это поведение by design: гостям
  onboarding не нужен.

Edge case — DB unreachable:

- Middleware fail-open: при ошибке lookup-а лог пишет
  `[onboarding-gate] failed to check customer email customer_id=…` и
  пропускает запрос. Это сознательный выбор: лучше пропустить заказ, чем
  заблокировать его при инфраструктурной ошибке. Если `cart.complete`
  доходит до Medusa core с placeholder email — заказ всё равно создастся,
  но email в order.email будет placeholder. Operator должен понимать этот
  fallback при разборе инцидентов.

### 14.5. Регистрация прошла, но `customer.phone` пуст

Это **не ошибка** в большинстве случаев. VK отдаёт `phone` только когда
пользователь явно дал согласие в VK (scope `phone`) и в его профиле телефон
вообще есть. У части пользователей телефон не отдаётся даже с правильным scope.

Что увидит storefront:

- `customer.metadata.onboarding.status === "pending"` если email тоже
  placeholder; иначе `"complete"` (phone не блокирует завершение).
- `metadata.vk_link.phone === null`, `metadata.vk_link.phone_verified === false`.
- Onboarding-форма покажет поле phone с подсказкой «VK не передал ваш
  телефон. Можете указать его сейчас или позже в профиле.»

Resolve:

- Если operator ожидает гарантированный phone — это проблема постановки
  задачи, а не runtime ошибка.
- Если пользователь хочет указать phone — он может сделать это через
  onboarding-форму или раздел профиля «Контакты».

### 14.6. Storefront `/account/profile` редиректит anonymous на `/account` (а не 404)

Phase 5.5 includes a storefront fix (commit `15d6304`): unauthenticated
visitor on `/account/profile` теперь редиректится на `/{countryCode}/account`
вместо `notFound()`. Это нормальное поведение, **не баг**.

Если в логах появился ранее `404` от `/account/profile` для anonymous — это
старая сборка storefront. Достаточно redeploy через `Deploy Staging`.
