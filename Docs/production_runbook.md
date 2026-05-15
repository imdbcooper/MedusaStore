# Production Runbook

> Filename retained for historical stability. **Scope today: operations for the single staging environment** at `studio.slavx.ru`. Real production is **not provisioned yet** and will be added after development is complete. This runbook will be split into a dedicated staging runbook and a dedicated production runbook once real production exists.
>
> Current concrete staging target: `studio.slavx.ru`, user `som` (SSH alias `slavx-store`), path `/home/som/MedusaStore`, GitHub repo `imdbcooper/MedusaStore`, branch `main`.
>
> Only deploy method: the `Deploy Staging` GitHub Actions workflow. Only secrets source: GitHub Secrets/Variables.

## 1. Staging facts

| Item | Value |
| --- | --- |
| Domain | `studio.slavx.ru` |
| SSH alias | `slavx-store` |
| IP | `171.22.180.206` |
| SSH user | `som` |
| Remote path | `/home/som/MedusaStore` |
| Repository | `imdbcooper/MedusaStore` |
| Default branch | `main` |
| Compose file | [`docker-compose.prod.yml`](../docker-compose.prod.yml) (filename retained as Medusa convention) |
| Reverse proxy | Caddy only, configured by [`docker/caddy/Caddyfile`](../docker/caddy/Caddyfile) |
| Deploy mechanism | GitHub Actions workflow [`.github/workflows/deploy-staging.yml`](../.github/workflows/deploy-staging.yml) (`Deploy Staging`) |
| Remote deploy script | [`scripts/github-deploy-staging.sh`](../scripts/github-deploy-staging.sh) |
| Staging smoke script | [`scripts/staging-container-smoke.sh`](../scripts/staging-container-smoke.sh) |

## 2. Required GitHub Secrets and Variables

Configure these in the GitHub repository. Real secret values go into GitHub Secrets; non-secret config values go into GitHub Variables. Do not commit either to git.

| Secret | Meaning | Expected staging shape |
| --- | --- | --- |
| `DEPLOY_HOST` | SSH host | `studio.slavx.ru` or server IP/DNS that resolves to the staging host. |
| `DEPLOY_USER` | SSH user | `som`. |
| `DEPLOY_PATH` | Remote repo checkout path | `/home/som/MedusaStore`. |
| `DEPLOY_SSH_PRIVATE_KEY` | Private key used by workflow SSH agent | Private key authorized for `som` on the staging host. |
| `AI_ASSISTANT_API_TOKEN` | Optional assistant service privileged API token | Strong generated secret; also put into the real remote `.env` if the assistant is enabled. |
| `AI_ASSISTANT_SERVER_TOKEN` | Optional Medusa-to-assistant adapter token | Strong generated backend-only secret; must never be exposed as `NEXT_PUBLIC_*`. |
| `S3_ACCESS_KEY_ID` | S3-compatible storage access key | Access key for itecocloud S3 bucket. |
| `S3_SECRET_ACCESS_KEY` | S3-compatible storage secret key | Secret key for itecocloud S3 bucket. |
| `S3_ENDPOINT` | S3-compatible endpoint URL | `https://s3.itecocloud.online`. |
| `S3_BUCKET` | S3 bucket name | `slavx-media-ddfd0e31`. |
| `S3_REGION` | S3 region | `us-east-1` (default for S3-compatible). |
| `S3_FILE_URL` | Public URL for serving uploaded files | `https://media.slavx.ru`. |

The workflow also has a manual `branch` input, defaulting to `main`.

### Staging env render

The deploy workflow renders the complete staging `.env` from GitHub Secrets/Variables with `scripts/env-contract.mjs render-staging`, validates it with Docker Compose, uploads it to the staging host, and then runs the remote deploy script. This replaces partial/manual remote `.env` management: manual edits on the server are overwritten by the next deploy, and missing mandatory values fail before containers are rebuilt.

## 2.1. External mailserver follow-ups

Transactional SMTP is being prepared on a separate mail VPS, not inside the main compose stack:

| Item | Value |
| --- | --- |
| Mail VPS | `smtpserv` |
| Mail IP | `77.83.92.194` |
| docker-mailserver path | `/opt/mailserver` |
| Mail host name | `smtp.slavx.ru` |
| Transactional sender | `noreply@notify.slavx.ru` |

Current status:

- SMTP smoke to the operator-provided Yandex mailbox was accepted with `status=sent`.
- PTR/rDNS is still pending with the provider: `77.83.92.194 -> smtp.slavx.ru`.
- Trusted TLS certificate for `smtp.slavx.ru` is still pending.
- Any current staging/backend setting with `SMTP_TLS_REJECT_UNAUTHORIZED=false` is temporary for relaxed TLS/self-signed bootstrap only.

Certificate recommendation:

1. Prefer issuing a Let's Encrypt certificate directly on `smtpserv`, because the private key should live on the host/service that terminates TLS for SMTP (`docker-mailserver`).
2. Prefer HTTP-01 if port `80` can be opened temporarily or permanently on the mail VPS and does not conflict with other services.
3. Use DNS-01 through the DNS provider API/manual flow if HTTP-01 is not practical.
4. Do not copy the private key through the main staging server.
5. After issuance, mount/connect the certificate paths into `/opt/mailserver/config/ssl` and docker-mailserver SSL config, then reload/recreate the mailserver container.
6. After the trusted certificate is installed, set `SMTP_TLS_REJECT_UNAUTHORIZED=true`, restart the backend, and run SMTP smoke again.

## 3. Remote `.env` contract

Staging deploy requires `/home/som/MedusaStore/.env` to exist. The remote script exits if it is missing.

Canonical source of the real remote `.env`: GitHub Secrets/Variables injected during deploy. Use [`.env.staging.example`](../.env.staging.example) as a non-secret contract reference. Required values include at minimum:

- PostgreSQL identity/password and database names.
- JWT/cookie secrets.
- CORS/auth origins for `https://studio.slavx.ru`.
- Medusa publishable key for storefront build/runtime.
- `DEPLOY_DOMAIN=studio.slavx.ru` and ACME email.
- Docker internal URLs for server-side runtime: `DOCKER_MEDUSA_BACKEND_URL=http://medusa-backend:9000`, `DOCKER_PAYLOAD_CMS_URL=http://payload-cms:3100`.
- Payload secrets and `DOCKER_PAYLOAD_DATABASE_URL=postgresql://...@medusa-db:5432/payload_cms?sslmode=disable`.
- Migration/seed toggles: `RUN_MEDUSA_MIGRATIONS`, `RUN_PAYLOAD_MIGRATIONS`, `RUN_PAYLOAD_SEED`.
- Optional smoke overrides only when default public HTTPS checks are not appropriate.
- Optional AI Assistant values when `AI_ASSISTANT_ENABLED=true`: `AI_ASSISTANT_BASE_URL=http://ai-assistant:8000/api/v1`, strong `AI_ASSISTANT_API_TOKEN`, strong backend-only `AI_ASSISTANT_SERVER_TOKEN`, explicit `AI_ASSISTANT_CORS_ORIGINS`, `ASSISTANT_POSTGRES_URI`, and browser-safe `NEXT_PUBLIC_AI_ASSISTANT_WIDGET_ENABLED` / `NEXT_PUBLIC_AI_ASSISTANT_CHAT_ENDPOINT`. Keep the widget default-off unless launch is explicitly approved.
- Optional own SMTP transactional email values only after explicit activation: `NOTIFICATION_EMAIL_PROVIDER=smtp`, `SMTP_HOST=smtp.slavx.ru`, `SMTP_PORT=587`, `SMTP_SECURE=false`, `SMTP_USER=noreply@notify.slavx.ru`, secret `SMTP_PASSWORD`, `SMTP_FROM=noreply@notify.slavx.ru`, optional `SMTP_FROM_NAME` / `SMTP_REPLY_TO`. Keep staging baseline as `local` until PTR, trusted TLS cert, DMARC recheck, secret handling, and notification smoke are approved.

Do not put GitHub-only deploy secrets into the app `.env`; keep `DEPLOY_SSH_PRIVATE_KEY` only in GitHub Secrets. Real secrets and non-secret config reach the staging host exclusively through GitHub Secrets/Variables.

## 4. Staging deploy flow

1. Merge/push the desired commit to `main` in `imdbcooper/MedusaStore`.
2. In GitHub Actions, open `Deploy Staging`.
3. Click `Run workflow`.
4. Keep branch as `main` unless intentionally deploying another branch.
5. The workflow:
   - checks out the repository;
   - validates staging compose syntax with `docker compose -f docker-compose.prod.yml --env-file .env.staging.example config -q`;
   - renders and validates the complete staging `.env` from GitHub Secrets/Variables;
   - loads SSH key from `DEPLOY_SSH_PRIVATE_KEY`;
   - adds `DEPLOY_HOST` to `known_hosts`;
   - uploads the rendered `.env` to the remote checkout;
   - runs `scripts/github-deploy-staging.sh` on the remote server.
6. The remote script:
   - `git fetch origin <branch>`;
   - `git checkout <branch>`;
   - `git reset --hard origin/<branch>`;
   - verifies remote `.env` exists;
   - builds images;
   - starts `medusa-db` and `medusa-redis`;
   - optionally runs Payload migrations and seed one-off jobs;
   - starts/recreates `medusa-backend`, `payload-cms`, `storefront`, `caddy`, and enabled profile services with `--force-recreate --remove-orphans` so interrupted compose recreates do not poison the next run;
   - prunes dangling images;
   - runs staging smoke checks.

Documentation-only or env-example-only changes do not require a staging deploy unless an operator explicitly wants the remote checkout updated.

Deploying by any other method (direct SSH + docker build) is **not** the canonical path. If used in an emergency, document the reason in [`troubleshooting.md`](./troubleshooting.md).

### 4.1. SSH heartbeat during long Docker builds

`scripts/github-deploy-staging.sh` wraps the long `docker compose ... build`
step with [`run_with_heartbeat`](../scripts/github-deploy-staging.sh:11) — a
small helper that prints `"Docker image build still running at <ISO>..."`
once a minute while the build runs and then cleans the heartbeat process up
on completion.

Why it exists:

- `Deploy Staging` runs over an SSH connection from the GitHub runner. Long
  silent builds (multi-stage Next.js + Medusa + Payload images) can let the
  SSH connection idle long enough for the network path to drop the session
  with `Write failed: Broken pipe`, killing the deploy mid-build even though
  the docker daemon is still working remotely.
- The heartbeat keeps continuous output on stdout, which keeps the SSH
  channel and the GitHub Actions step active.

Operational notes:

- The heartbeat is implemented entirely with `bash` background process plus
  `trap`-free cleanup; no extra dependencies.
- The helper preserves the wrapped command's exit status, so build failures
  still propagate normally.
- This protection landed alongside the VK ID Phase 5.5 deploy series
  (commit `0577dcb`). Older copies of the script without it are vulnerable
  to mid-build SSH drop on slow runners.
- If you re-implement the deploy script in another language or split it,
  keep an equivalent heartbeat for any step longer than ~5 minutes that
  does not produce continuous output.

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

The staging smoke script checks these defaults:

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

- `SMOKE_BASE_URL=https://studio.slavx.ru`;
- `SMOKE_BACKEND_URL=https://studio.slavx.ru/admin/`;
- `SMOKE_PAYLOAD_URL=https://studio.slavx.ru/payload/api/pages?limit=1`.

Manual product page smoke is required after changes touching product rendering, backend URL precedence, Caddy routing, publishable key, or catalog data:

```bash
curl -I https://studio.slavx.ru/ru/products/<real-product-handle>
```

Expected result: `200` for an existing handle, not a `500`. `404` means the handle/region/data is absent and should be checked against Medusa data before treating it as infrastructure failure.

## 7. Useful staging commands

Run these on the staging host as `som` in `/home/som/MedusaStore`.

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
bash ./scripts/staging-container-smoke.sh
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

The first safe step on staging is intentionally conservative:

1. Run one `ai-assistant` replica/container with `AI_ASSISTANT_ENABLED=true` and the Compose `ai-assistant` profile.
2. Keep browser traffic on the existing public paths `/store/assistant/chat` and `/store/assistant/history`; Caddy routes `/store/*` to Medusa, and Medusa forwards to the assistant with `AI_ASSISTANT_SERVER_TOKEN` server-side.
3. Keep the storefront widget gated by `NEXT_PUBLIC_AI_ASSISTANT_WIDGET_ENABLED`; enabling the backend adapter alone should not expose the widget.
4. Drain product freshness work intentionally through `/admin/assistant/reindex/process`, a cron/worker, or a manually approved smoke step; subscribers only enqueue durable intents.
5. Use the assistant's in-memory limits only for that single-replica baseline, optionally combined with Caddy/API-gateway request limits.
6. Before scaling the assistant horizontally, add Redis-backed distributed limiting or gateway/load-balancer limits. Without that, each replica counts its own requests and the global rate limit is multiplied by the replica count.
7. Apply managed schema review using [`001_initial_schema.sql`](../ai-assistant/migrations/001_initial_schema.sql) before using a real assistant database if startup auto-schema initialization is not acceptable.

## 9. Payload migrations and seed

Payload is part of staging compose, but migrations and seed are controlled:

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
docker compose -p medusastore -f docker-compose.prod.yml --env-file .env up -d --force-recreate --remove-orphans medusa-backend payload-cms storefront caddy
bash ./scripts/staging-container-smoke.sh
```

### Re-run the current staging deploy script

If the commit is correct but a build/start/smoke step failed transiently:

```bash
cd /home/som/MedusaStore
DEPLOY_BRANCH=main DEPLOY_PATH=/home/som/MedusaStore bash ./scripts/github-deploy-staging.sh
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
