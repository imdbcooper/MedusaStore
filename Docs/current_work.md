# Current Work

> Status updated: `2026-05-14`.
>
> Purpose: this is the short operational source of truth for agents entering the repository with no context. It answers what is current, what is already closed, and what must not be reopened without new evidence.

---

## Current Focus

The active delivery baseline is ApiShip/Gorgo via `@gorgo/medusa-fulfillment-apiship`. The accepted migration decision is [apiship_direct_migration_plan.md](./apiship_direct_migration_plan.md), and final baseline evidence is [apiship_baseline_smoke_evidence.md](./apiship_baseline_smoke_evidence.md).

Direct plugin-specific `/store/apiship/*` endpoints are the canonical Store API contract for normal checkout.

The active storefront visual baseline is the StudioPro/Stitch integration recorded in [stitch_frontend_gap_log.md](./stitch_frontend_gap_log.md). Header, catalog, product/offer, contacts, checkout shell, home and editorial surfaces have been aligned to Stitch references while keeping Medusa cart/catalog/product/checkout/account logic intact. Product detail pages are dynamic runtime pages and require a runtime product smoke for known handles.

VK ID auth surface now covers no-email registration through the **Phase 5.5** onboarding flow. Full contract — [vk-onboarding-spec.md](./vk-onboarding-spec.md). Highlights:

- `DEFAULT_VK_ID_SCOPES = "vkid.personal_info phone"`; new operator-facing flag `VK_ID_ALLOW_NO_EMAIL_REGISTER=true` in `.env.example` / `.env.staging.example`.
- Backend creates customers with placeholder email `vk_{vk_user_id}@placeholder.internal` when VK does not return an email; `customer.metadata.onboarding` tracks `status` (`"pending"` / `"complete"`), `missing_fields`, `placeholder_email`, `vk_phone_verified`, `created_at`.
- New endpoint `POST /store/customers/me/onboarding` in [`route.ts`](../medusa-agency-boilerplate/src/api/store/customers/me/onboarding/route.ts); phone is optional and never blocks completion.
- Checkout gate middleware [`enforceOnboardingEmailForCheckout`](../medusa-agency-boilerplate/src/modules/onboarding-checkout-gate.ts) rejects `POST /store/carts/:id/complete` for authenticated customers with placeholder email.
- VK ID OAuth state switched to VK-safe compact format `{payload}{signature}` (no separator); legacy dot-form is still readable for local smokes.
- Storefront ships `/account/onboarding`, profile banner, checkout-gate UX, and `submitOnboarding` server action; anonymous `/account/profile` now redirects instead of `notFound()`.
- Deploy hardening: `scripts/github-deploy-staging.sh` wraps the docker build with a heartbeat printer to keep the GitHub Actions SSH session alive during long builds (commit `0577dcb`).
- Deployed to staging via the `Deploy Staging` workflow across commits `15d6304`, `562a45c`, `0577dcb`, `8243dc1`, `48f510d`. All deploys succeeded.

Staging packaging/deploy now exists: [`docker-compose.prod.yml`](../docker-compose.prod.yml) defines the production-mode Docker stack for the single staging environment (`studio.slavx.ru`) with backend, storefront, Payload, Caddy, PostgreSQL and Redis; Caddy is the only public reverse proxy; manual GitHub Actions staging deploy is documented in [production_runbook.md](./production_runbook.md) (filename retained for historical stability). Real production is not provisioned yet.

The uncommitted `ai-assistant/` integration patch now includes trusted anonymous-to-authenticated session binding and a durable assistant reindex intent queue/processor. The widget remains disabled by default, real LLM/provider secrets are still operator-supplied later, and the next step before commit is review of the full dirty integration tree plus validation evidence.

Transactional SMTP mailserver is reachable on the separate VPS `smtpserv` (`77.83.92.194`) with docker-mailserver in `/opt/mailserver`; host name is `smtp.slavx.ru`, transactional sender is `noreply@notify.slavx.ru`, and the latest SMTP smoke to the operator-provided Yandex mailbox was accepted with `status=sent`. Remaining follow-ups before treating this as final strict TLS baseline:

- provider must set PTR/rDNS `77.83.92.194 -> smtp.slavx.ru`;
- trusted TLS certificate for `smtp.slavx.ru` is still pending;
- current staging/backend SMTP verification uses temporary relaxed TLS/self-signed mode through `SMTP_TLS_REJECT_UNAUTHORIZED=false` and must not become final production configuration;
- after the trusted certificate is installed, set `SMTP_TLS_REJECT_UNAUTHORIZED=true`, restart the backend, and run the SMTP smoke again;
- certificate recommendation: issue and keep the Let's Encrypt certificate directly on `smtpserv`, because the private key should live next to the SMTP TLS terminator (`docker-mailserver`), not be copied through the main MedusaStore staging server.

---

## Repository Baseline

The repository remains a Russian-market Medusa template:

- canonical local path: `cp .env.example .env` -> `npm run bootstrap` -> `npm run preflight` -> `npm run dev`;
- staging path: the `Deploy Staging` GitHub Actions workflow deploys to `som@studio.slavx.ru:/home/som/MedusaStore` using [`docker-compose.prod.yml`](../docker-compose.prod.yml) and Caddy-only ingress; real production is not provisioned yet;
- stable local storefront production-preview path for browser/smoke verification: `npm run storefront:build` -> `npm run storefront:start` or `bash scripts/manage.sh start:storefront`;
- baseline region/currency: `ru` / `rub`;
- notification baseline: local provider by default, UniSender and VK messaging are opt-in integration paths;
- payment baseline: YooKassa-first for the current Russian-market scope;
- Payload CMS content layer is materialized as a separate app in [payload-cms](../payload-cms); use [payload_cms_runbook.md](./payload_cms_runbook.md) for lifecycle commands, build guard, seed pages, and admin troubleshooting;
- storefront customization baseline: StudioPro/Stitch visual system over the preset-driven storefront stack is current; gaps/backlog are tracked in [stitch_frontend_gap_log.md](./stitch_frontend_gap_log.md) and should not be reopened without regression evidence or a scoped backlog item;
- delivery baseline target: ApiShip/Gorgo via `@gorgo/medusa-fulfillment-apiship`.

---

## ApiShip/Gorgo Delivery Status

The current delivery baseline is ApiShip/Gorgo via `@gorgo/medusa-fulfillment-apiship`.

The accepted direct baseline plan is [apiship_direct_migration_plan.md](./apiship_direct_migration_plan.md). Baseline smoke evidence is [apiship_baseline_smoke_evidence.md](./apiship_baseline_smoke_evidence.md). It uses a deterministic backend unit smoke for the current ApiShip baseline and does not require live ApiShip credentials, external ApiShip calls, running browser services, or live shipment execution.

Key fixed decisions:

- Direct `/store/apiship/*` is canonical: storefront uses ApiShip endpoints directly and commits the standard Medusa cart shipping method with `apishipData`.
- Initial customer-facing price is the ApiShip tariff unless a separate pricing-policy requirement is added.
- Initial baseline is PVZ/pickup-point; courier can be added later.
- `APISHIP_SHIPMENT_EXECUTION_ENABLED=false` is the default. Live shipment execution requires exact `APISHIP_SHIPMENT_EXECUTION_ENABLED=true` opt-in and runtime readiness/idempotency guards.

Acceptance now recorded for the current baseline:

- The direct baseline plan and final smoke evidence are linked from this current-work map.
- `@gorgo/medusa-fulfillment-apiship` is the current target/baseline provider package.
- Current checkout API shape is direct `/store/apiship/*` and standard Medusa shipping-method commit with `apishipData`.

---

## Canonical Documentation Map

Use these documents in this order:

1. [current_work.md](./current_work.md) - operational status and next action.
2. [architecture.md](./architecture.md) - current staging/local topology, service names, routes, internal URLs, runtime responsibilities.
3. [production_runbook.md](./production_runbook.md) - concrete staging server/deploy/smoke/log operations for `studio.slavx.ru`; filename retained for historical stability until real production is provisioned.
4. [local_development.md](./local_development.md) - local compose vs host app runtimes.
5. [staging_runbook.md](./staging_runbook.md) - current staging reality and how to provision a real stage host.
6. [troubleshooting.md](./troubleshooting.md) - concrete operational failure modes and commands.
7. [stitch_frontend_gap_log.md](./stitch_frontend_gap_log.md) - current StudioPro/Stitch frontend alignment, code-vs-interface gaps, UI-vs-backend gaps, validation status, and backlog.
8. [payload_cms_runbook.md](./payload_cms_runbook.md) - Payload CMS architecture, lifecycle commands, build guard, seed URLs, env basics, and admin troubleshooting.
9. [apiship_direct_migration_plan.md](./apiship_direct_migration_plan.md) - accepted ApiShip/Gorgo direct migration plan and Phase 0 baseline freeze.
10. [apiship_baseline_smoke_evidence.md](./apiship_baseline_smoke_evidence.md) - deterministic ApiShip baseline smoke/evidence runbook without live credentials or external ApiShip calls.
11. [env_contract.md](./env_contract.md) - environment/startup contract.
12. [master_repo_plan_v2.md](./master_repo_plan_v2.md) - overall repository roadmap.
13. [plan_analysis.md](./plan_analysis.md) - factual audit and historical reality check.

Old phase prompt files are not source-of-truth. Completed prompt artifacts should not be used to infer current status.

---

## Working Rules

- Code and verified runtime behavior win over narrative docs.
- Do not mark a phase closed unless its Definition of Done and validation evidence are satisfied.
- Do not copy stale statuses from older docs into new prompts or reports.
- Keep ApiShip/Gorgo as the current delivery baseline and direct `/store/apiship/*` as canonical Store API.
- Keep live shipment execution gated and default-off through `APISHIP_SHIPMENT_EXECUTION_ENABLED=false` unless exact `true` opt-in is explicitly scoped.
- Keep secrets and raw provider material out of docs, logs, storefront, and admin responses.
