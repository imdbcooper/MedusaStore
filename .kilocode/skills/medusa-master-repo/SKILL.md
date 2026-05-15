---
name: medusa-master-repo
description: Use when working in this MedusaStore repository on planning, implementation, architecture, integrations, storefront strategy, staging Docker/Caddy runtime, GitHub Actions deployment, local/staging distinctions, ApiShip/Gorgo delivery baseline, Delivery Hub historical context, or documentation governance. This project-level Kilo Code skill defines current source-of-truth documents, verified operational reality, and mandatory doc-update rules.
---

# Medusa Master Repo

Use this Kilo Code project-level skill for substantial work in this repository.

This skill is the fast onboarding context for agents working inside the workspace. It must reflect implementation and current operational docs, not stale planning snapshots.

## First Read

Read documents and implementation sources in this order:

1. `README.md`
   - Current operational entrypoint and concise source-of-truth summary.
2. `Docs/architecture.md`
   - Current staging topology, service ownership, internal URLs, public routes, and local/staging split.
3. `Docs/production_runbook.md`
   - Concrete staging host facts, GitHub Actions deploy flow, smoke checks, and incident commands. This runbook currently applies to the single staging environment; it will be split into staging/production once real production is provisioned.
4. `Docs/local_development.md`
   - Canonical local developer flow and how local compose differs from staging.
5. `Docs/staging_runbook.md`
   - Current staging deployment target: `studio.slavx.ru` via GitHub Actions `Deploy Staging` workflow.
6. `Docs/troubleshooting.md`
   - Operational failure modes for Docker/Caddy staging, Payload, dynamic product pages, backend URL precedence, and deploy smoke.
7. `Docs/payload_cms_runbook.md`
   - Payload CMS operations, migrations, seed behavior, preview/revalidate semantics, and content pages.
8. `Docs/env_contract.md`
   - Read when working on startup, ports, env files, orchestration, secrets policy, delivery/payment/notification env behavior, or runtime contracts.
9. Implementation/config files for the touched area:
   - `docker-compose.prod.yml` (filename retained as Medusa convention; hosts the staging runtime)
   - `docker/caddy/Caddyfile`
   - `.github/workflows/deploy-staging.yml`
   - `scripts/github-deploy-staging.sh`
   - `scripts/staging-container-smoke.sh`
   - `.env.staging.example`
   - relevant source code, tests, package scripts, and Dockerfiles.
10. Current delivery baseline docs:
    - `Docs/current_work.md`
    - `Docs/apiship_direct_migration_plan.md`
    - `Docs/apiship_baseline_smoke_evidence.md`
11. Delivery Hub historical/quarantine docs:
    - `Docs/delivery_hub_physical_cleanup_manifest.md`
    - `Docs/delivery_hub_documentation_index.md`
12. Roadmap/audit/background only:
    - `Docs/master_repo_plan_v2.md`
    - `Docs/plan_analysis.md`
    - `Docs/master_repo_guide.md`
    - `Docs/medusa_project_summary.md`
    - `Docs/Medusa.md`

Implementation and verified runtime behavior win over narrative docs. Current operational docs win over historical plans.

## Current Known Reality

Before making claims, keep these verified facts in mind:

- The repository is a Russian-market Medusa template/runtime repository named MedusaStore.
- Baseline region/currency are `ru` / `rub`.
- Single staging environment: `studio.slavx.ru` (SSH alias `slavx-store`, IP `171.22.180.206`, deploy path `/home/som/MedusaStore`).
- Staging admin user: `admin@slavx.ru` (created via `npx medusa user`). Password managed through GitHub Secrets, not committed.
- Temporary upload user `upload-bot@slavx.ru` exists on staging (created for image upload automation); can be removed via Admin UI.
- Real production environment is **not provisioned yet**. It will be set up after development is complete. Treat any "production" wording in historical docs as either a technical Node.js build term (`NODE_ENV=production`) or a TBD future environment.
- Mail VPS is a separate server (`smtpserv` / `77.83.92.194`) with hostname `smtp.slavx.ru`, docker-mailserver with Let's Encrypt TLS, and DKIM/SPF/DMARC for `notify.slavx.ru`.
- Transactional email sender: `noreply@notify.slavx.ru`.
- Staging runtime is Docker Compose through `docker-compose.prod.yml` (filename retained as Medusa convention).
- Public ingress is Caddy only:
  - no Nginx layer is part of the current topology;
  - `docker/caddy/Caddyfile` terminates HTTPS and routes public traffic.
- Staging server facts:
  - domain: `studio.slavx.ru`;
  - SSH/user: `som` (alias `slavx-store`);
  - remote path: `/home/som/MedusaStore`;
  - GitHub repo: `imdbcooper/MedusaStore`;
  - default branch: `main`.
- Deployment is **only** through the GitHub Actions workflow dispatch:
  - workflow: `.github/workflows/deploy-staging.yml` (name: `Deploy Staging`);
  - remote deploy script: `scripts/github-deploy-staging.sh`;
  - smoke script: `scripts/staging-container-smoke.sh`.
- Direct SSH + docker build deploys are not the canonical path. If used in an emergency, document the reason in troubleshooting.
- Documentation-only or env-example-only changes do not require a staging deploy unless an operator explicitly wants the remote checkout updated.
- Local and staging are distinct:
  - local development uses `docker-compose.yml` for PostgreSQL/Redis/Medusa backend and usually host processes for storefront/Payload;
  - staging uses `docker-compose.prod.yml` with backend, Payload, storefront, DB, Redis, and Caddy containers;
  - `studio.slavx.ru` is staging, not production.
- Canonical local startup remains:
  - `cp .env.example .env`
  - `npm run bootstrap`
  - `npm run preflight`
  - `npm run dev`
- Root `package.json` and `scripts/` are the canonical local entrypoint for bootstrap, preflight, dev, build, smoke, and permission repair.
- `scripts/preflight.sh` only allows runtime reuse where it explicitly supports compose-owned services.
- Dirty local ports `9000` or `8000` from unrelated processes are expected local failure modes outside the canonical clean-start path.
- Backend generated directories may inherit bad ownership from old container runs; `npm run permissions:fix` repairs them.
- Notification baseline is local-provider safe. UniSender and VK messaging are opt-in integration paths.
- The authenticated notification smoke path uses a fresh secret admin API key and Basic auth. Do not claim old secret reuse is canonical.
- Payment baseline is YooKassa-first for this repository's default market.
- The hosted YooKassa checkout return path was validated through review, order placement, and confirmed order page.
- Current delivery baseline is ApiShip/Gorgo via `@gorgo/medusa-fulfillment-apiship`.
- Direct `/store/apiship/*` is the canonical Store API contract for normal checkout.
- Delivery Hub/direct Yandex is previous-baseline/historical/quarantined context, not the fresh-template baseline.
- Old local/staging databases may contain historical delivery rows/provider ids. Treat them as operator-approved cleanup work, not active template behavior.
- The preset-driven storefront customization stack is closed. Do not reopen it without new regression evidence.

## Staging Runtime Reality

Staging is governed by:

- `README.md`
- `Docs/architecture.md`
- `Docs/production_runbook.md` (currently applies to staging; will be split once real production is provisioned)
- `Docs/staging_runbook.md`
- `docker-compose.prod.yml` (filename retained; hosts the staging runtime)
- `docker/caddy/Caddyfile`
- `.github/workflows/deploy-staging.yml`
- `scripts/github-deploy-staging.sh`
- `scripts/staging-container-smoke.sh`
- `.env.staging.example`

Current staging services and container names:

| Compose service | Container | Responsibility |
| --- | --- | --- |
| `medusa-db` | `medusastore-db` | PostgreSQL for Medusa and Payload databases. |
| `medusa-redis` | `medusastore-redis` | Redis runtime dependency. |
| `medusa-backend` | `medusastore-backend` | Medusa Admin/API, catalog, carts, checkout, orders, fulfillment, payments, notifications. |
| `payload-cms` | `medusastore-payload` | Payload CMS admin/API/content runtime. |
| `storefront` | `medusastore-storefront` | Next.js storefront, product pages, content pages, preview/revalidate endpoints. |
| `caddy` | `medusastore-caddy` | Public HTTP/HTTPS ingress and ACME certificates. |

Current public route ownership:

- `/healthz` returns `ok` from Caddy.
- `/payload/*` goes to Payload CMS through `handle_path` and path stripping.
- `/admin/*`, `/store/*`, and `/auth/*` go to Medusa backend.
- `/api/content/*` goes to storefront content preview/revalidate endpoints.
- all other paths go to the storefront.

## Deploy Governance

- **Only** deploy method: GitHub Actions workflow `Deploy Staging` (`.github/workflows/deploy-staging.yml`).
- **Never** deploy via direct SSH + docker build. If used in emergency, document reason in troubleshooting.
- Pre-deploy: compose config validation, tests.
- Post-deploy: automated smoke via `scripts/staging-container-smoke.sh`.
- Real production deploy flow is TBD and will be added when real production is provisioned.

## Secrets Governance

- **Only** source of real secrets: GitHub Secrets (passwords, tokens, API keys) + GitHub Variables (non-secret config).
- Never commit real secret values to git.
- Remote `.env` on staging is built from GitHub Secrets/Variables during deploy.
- `.env.template`, `.env.example`, `.env.staging.example` contain only placeholder values for documentation.

## Runtime URL Precedence

Storefront server-side Medusa URL resolution explicitly prefers `MEDUSA_BACKEND_URL` before `NEXT_PUBLIC_MEDUSA_BACKEND_URL`.

Staging expectation:

- server-side/container URL: `MEDUSA_BACKEND_URL=http://medusa-backend:9000` or `DOCKER_MEDUSA_BACKEND_URL=http://medusa-backend:9000`;
- browser/public URL: `NEXT_PUBLIC_MEDUSA_BACKEND_URL=https://studio.slavx.ru` or an equivalent public Caddy origin;
- do not force SSR/product rendering to call the public HTTPS origin from inside Docker when the internal backend URL is available.

Keep this distinction when editing env examples, Docker compose, deploy scripts, docs, storefront env code, or troubleshooting guidance.

## Payload CMS Staging Behavior

Payload CMS is a staging service in `docker-compose.prod.yml`:

- staging container: `medusastore-payload`;
- internal service URL: `http://payload-cms:3100`;
- public admin/API path: `/payload/*` through Caddy;
- staging database is the dedicated `payload_cms` database in the same PostgreSQL server;
- `PAYLOAD_DATABASE_URL` should use the Docker-network PostgreSQL host on staging, normally via `DOCKER_PAYLOAD_DATABASE_URL`;
- migrations are controlled by `RUN_PAYLOAD_MIGRATIONS` and are run as a one-off job by `scripts/github-deploy-staging.sh` only when explicitly true;
- content seed is controlled by `RUN_PAYLOAD_SEED` and must not be left true accidentally after a one-time seed unless idempotent reseeding is explicitly desired;
- Payload owns editorial/content data, not commerce truth, provider secrets, payment credentials, or catalog/order source of truth.

Payload-rendered storefront pages include content routes such as `/ru/about`, `/ru/promotions`, `/ru/delivery-and-payment`, and `/ru/loyalty` when `PAYLOAD_ENABLED=true` and published documents exist. `/ru/contacts` is currently a static storefront route, not Payload-rendered.

## Product Page Rendering Reality

Product detail pages are dynamic at runtime:

- route: `medusa-agency-boilerplate-storefront/src/app/[countryCode]/(main)/products/[handle]/page.tsx`;
- route behavior: `dynamic = "force-dynamic"`;
- runtime fetches the product by handle and country/region from Medusa;
- static params may be empty during build if Store API is unavailable, which does not by itself prove runtime product pages are broken;
- staging changes touching product rendering, backend URL precedence, Caddy routing, publishable key, or catalog data require a manual product page smoke with a real product handle.

Expected product smoke shape:

```bash
curl -I https://studio.slavx.ru/ru/products/<real-product-handle>
```

Expected result for an existing handle is `200`, not `500`. A `404` means the handle/region/data is absent and should be checked against Medusa data before treating it as infrastructure failure.

## Delivery Baseline Reality

Current ApiShip/Gorgo baseline is governed by:

- `Docs/current_work.md`
- `Docs/apiship_direct_migration_plan.md`
- `Docs/apiship_baseline_smoke_evidence.md`
- `Docs/env_contract.md`

Current delivery status:

- Delivery Hub -> ApiShip/Gorgo migration is completed and confirmed for the committed baseline.
- ApiShip/Gorgo via `@gorgo/medusa-fulfillment-apiship` is the fresh-template delivery baseline.
- Direct `/store/apiship/*` endpoints are the canonical Store API contract for normal checkout.
- Do not reintroduce `/store/delivery/*` as the first-version facade.
- `APISHIP_SHIPMENT_EXECUTION_ENABLED=false` is the safe default.
- Live external shipment execution requires the exact opt-in value `APISHIP_SHIPMENT_EXECUTION_ENABLED=true` plus the existing readiness/idempotency guardrails.
- Final baseline evidence is `Docs/apiship_baseline_smoke_evidence.md`.

Delivery Hub previous-baseline status:

- Delivery Hub/direct Yandex is historical/quarantined context, not current fresh-template guidance.
- Runtime residue cleanup is recorded in `Docs/delivery_hub_physical_cleanup_manifest.md`.
- Historical doc roles are indexed in `Docs/delivery_hub_documentation_index.md`.
- Older Delivery Hub plans/specs/evidence may remain useful for audit history, but must not be copied as current operational instructions.

## Working Rules

- Code and verified runtime behavior win over docs.
- Current operational docs win over historical planning docs.
- Before uploading images to the site (S3/media), always optimize them first: resize to max 800×800, convert to WebP (quality 80), unless the task explicitly requires full-resolution or lossless images. Use Pillow (PIL) for optimization.
- Do not mark work complete unless its Definition of Done and validation evidence are satisfied.
- Do not copy stale statuses from historical docs into current reports.
- Do not describe closed workstreams as open without new evidence.
- Do not expose or write real credentials, tokens, auth headers, ciphertext, raw provider request/response bodies, raw Yandex DTOs, raw quote keys, raw offer ids, publishable key values, secret admin keys, private keys, or database passwords into docs, logs, tests, admin responses, or storefront responses.
- Do not silently flip local/dev provider traffic to live.
- Do not enable `APISHIP_SHIPMENT_EXECUTION_ENABLED=true` by default; the only live-shipment opt-in is the exact value `true`.
- Do not reintroduce Delivery Hub/direct Yandex or `/store/delivery/*` as an active checkout path.
- Do not patch or fork official Medusa Admin unless explicitly scoped.
- Do not call `studio.slavx.ru` production. It is staging. Real production is not provisioned yet.
- Do not infer staging topology from local compose alone.
- Do not deploy documentation-only changes to staging unless there is an operational reason to update the remote checkout.
- Do not deploy by any method other than the `Deploy Staging` GitHub Actions workflow. Direct SSH + docker builds are not the canonical path.
- Do not commit real secret values. Real secrets live only in GitHub Secrets; non-secret config lives only in GitHub Variables.
- For unstable integration claims, verify against code, tests, official docs, or current runtime evidence.
- Keep the distinction clear between:
  - confirmed repository state;
  - project decisions;
  - historical evidence;
  - hypotheses still requiring validation.

## Documentation Roles

Current operational docs:

- `README.md`
  - First operational entrypoint and summary of current runtime/deploy facts.
- `Docs/architecture.md`
  - Current topology, service/container names, public routes, internal URLs, runtime responsibilities.
- `Docs/production_runbook.md`
  - Concrete staging deploy/ops on `studio.slavx.ru`. Will be split into staging/production runbooks once real production is provisioned.
- `Docs/local_development.md`
  - Local compose/host runtime flow and local-only caveats.
- `Docs/staging_runbook.md`
  - Current staging reality: single staging environment `studio.slavx.ru`; production TBD.
- `Docs/troubleshooting.md`
  - Current failure-mode playbook.
- `Docs/payload_cms_runbook.md`
  - Payload CMS operations.
- `Docs/env_contract.md`
  - Env/startup/runtime contract.
- `Docs/client_init_contract.md`
  - Client initialization contract.

Delivery/current work docs:

- `Docs/current_work.md`
  - Short operational source of truth for active workstreams when present/current.
- `Docs/apiship_direct_migration_plan.md`
  - Accepted ApiShip/Gorgo baseline migration plan and direct Store API decision.
- `Docs/apiship_baseline_smoke_evidence.md`
  - Final deterministic baseline smoke/evidence for ApiShip/Gorgo.
- `Docs/delivery_hub_physical_cleanup_manifest.md`
  - Cleanup/quarantine manifest for removed Delivery Hub runtime residue.
- `Docs/delivery_hub_documentation_index.md`
  - Delivery Hub historical/evidence doc map.
- `Docs/delivery_hub_rework_plan.md`
  - Previous-baseline Delivery Hub accepted phase plan; historical unless explicitly referenced for audit.
- `Docs/delivery_hub_spec.md`
  - Detailed previous-baseline Delivery Hub architecture/reference. Treat as historical unless a current doc says otherwise.

Roadmap/audit/background docs:

- `Docs/master_repo_plan_v2.md`
  - Main repository roadmap.
- `Docs/plan_analysis.md`
  - Audit and historical reality check.
- `Docs/template_readiness_regression.md`
  - Canonical regression pack for template readiness.
- `.kilocode/skills/medusa-master-repo/SKILL.md`
  - This Kilo Code project-level skill and fast onboarding context.

## Mandatory Updates After Meaningful Changes

Update `README.md`, `Docs/architecture.md`, `Docs/production_runbook.md`, `Docs/local_development.md`, `Docs/staging_runbook.md`, and/or `Docs/troubleshooting.md` together with code when changes touch:

- Docker or compose topology;
- staging service/container names;
- Caddy/proxy/public route behavior;
- CI/CD and GitHub Actions deployment;
- deploy scripts or smoke scripts;
- staging server facts;
- env variable names, precedence, defaults, or required values;
- runtime URL ownership, especially `MEDUSA_BACKEND_URL` / `NEXT_PUBLIC_MEDUSA_BACKEND_URL` behavior;
- Payload staging behavior, migrations, seed, database, public route, or content-page semantics;
- product page rendering/runtime behavior;
- local/staging environment boundaries (real production is TBD).

Update `Docs/current_work.md` when:

- the active phase changes;
- the current concrete workstream changes;
- a blocker is added or removed;
- validation status materially changes;
- the answer to "what should the next agent do first?" changes.

Update `Docs/delivery_hub_documentation_index.md` when:

- Delivery Hub historical/evidence document roles change;
- a Delivery Hub document is archived, removed, quarantined, or reclassified;
- historical/evidence-only classification changes.

Update `Docs/apiship_direct_migration_plan.md` / `Docs/apiship_baseline_smoke_evidence.md` when:

- ApiShip/Gorgo baseline decisions, Store API shape, evidence, or validation policy changes.

Update Delivery Hub historical docs only when previous-baseline evidence/classification changes; do not make them current runtime guidance.

Update `Docs/master_repo_plan_v2.md` when:

- the repository roadmap changes;
- a major phase starts, is re-scoped, or is completed;
- a new architectural decision is made.

Update `Docs/plan_analysis.md` when:

- a previous audit statement becomes false;
- a major blocker is resolved;
- a reassessment of current reality is needed.

Update `Docs/env_contract.md` when:

- env variables, startup behavior, ports, secrets policy, or orchestration behavior changes.

Update this skill when:

- the source-of-truth document set changes;
- document roles change;
- repo structure changes in a way that affects navigation;
- current known reality becomes outdated;
- canonical regression commands or smoke paths change;
- staging runtime/deploy/proxy facts change;
- real production is provisioned and begins to exist as a second environment;
- a new mandatory rule for Kilo Code agents is introduced.

## Default Answering Behavior

When the user asks what is done, what is next, where to look, or asks for a prompt:

1. Start from `README.md` for current runtime/deploy facts.
2. Use `Docs/architecture.md`, `Docs/production_runbook.md`, `Docs/local_development.md`, `Docs/staging_runbook.md`, and `Docs/troubleshooting.md` for current operational behavior.
3. Use `Docs/current_work.md` for current active workstream status when it is present and newer than historical plans.
4. Use `Docs/apiship_direct_migration_plan.md` and `Docs/apiship_baseline_smoke_evidence.md` for current delivery baseline direction/evidence.
5. Use `Docs/delivery_hub_physical_cleanup_manifest.md` and `Docs/delivery_hub_documentation_index.md` for Delivery Hub quarantine/history.
6. Use `Docs/master_repo_plan_v2.md` for broader roadmap direction.
7. Use `Docs/plan_analysis.md` only for audit/history.
8. Verify code/tests/config before making fresh technical claims.

Current default staging answer: the single staging environment runs through `docker-compose.prod.yml` on `som@studio.slavx.ru:/home/som/MedusaStore`, Caddy is the only public reverse proxy, deploy is the `Deploy Staging` GitHub Actions workflow for repo `imdbcooper/MedusaStore` branch `main`, secrets flow only through GitHub Secrets/Variables, Payload CMS is a staging container, product pages are dynamic runtime-rendered, and storefront SSR must prefer internal `MEDUSA_BACKEND_URL` over public browser URLs. Real production is not provisioned yet.

Current default delivery answer: ApiShip/Gorgo is the baseline, direct `/store/apiship/*` is canonical, Delivery Hub is previous-baseline/quarantined, and live ApiShip shipment execution stays default-off unless `APISHIP_SHIPMENT_EXECUTION_ENABLED=true` is explicitly set.
