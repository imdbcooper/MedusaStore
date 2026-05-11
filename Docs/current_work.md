# Current Work

> Status updated: `2026-05-11`.
>
> Purpose: this is the short operational source of truth for agents entering the repository with no context. It answers what is current, what is already closed, and what must not be reopened without new evidence.

---

## Current Focus

The active delivery baseline is ApiShip/Gorgo via `@gorgo/medusa-fulfillment-apiship`. The accepted migration decision is [apiship_direct_migration_plan.md](./apiship_direct_migration_plan.md), and final baseline evidence is [apiship_baseline_smoke_evidence.md](./apiship_baseline_smoke_evidence.md).

Direct plugin-specific `/store/apiship/*` endpoints are the canonical Store API contract for normal checkout. `/store/delivery/*` is not a current canonical facade.

The active storefront visual baseline is the StudioPro/Stitch integration recorded in [stitch_frontend_gap_log.md](./stitch_frontend_gap_log.md). Header, catalog, product/offer, contacts, checkout shell, home and editorial surfaces have been aligned to Stitch references while keeping Medusa cart/catalog/product/checkout/account logic intact. Product detail pages are dynamic runtime pages and require a runtime product smoke for known handles.

Production packaging/deploy now exists: [`docker-compose.prod.yml`](../docker-compose.prod.yml) defines backend, storefront, Payload, Caddy, PostgreSQL and Redis; Caddy is the only public reverse proxy; manual GitHub Actions deploy is documented in [production_runbook.md](./production_runbook.md). A separate concrete staging host is not currently provisioned; [staging_runbook.md](./staging_runbook.md) documents that boundary.

Delivery Hub/direct Yandex is previous-baseline historical/quarantined context only; use [delivery_hub_physical_cleanup_manifest.md](./delivery_hub_physical_cleanup_manifest.md) and [delivery_hub_documentation_index.md](./delivery_hub_documentation_index.md) for retained history/evidence roles.

The uncommitted `ai-assistant/` integration patch now includes trusted anonymous-to-authenticated session binding and a durable assistant reindex intent queue/processor. The widget remains disabled by default, real LLM/provider secrets are still operator-supplied later, and the next step before commit is review of the full dirty integration tree plus validation evidence.

---

## Repository Baseline

The repository remains a Russian-market Medusa template:

- canonical local path: `cp .env.example .env` -> `npm run bootstrap` -> `npm run preflight` -> `npm run dev`;
- production path: manual GitHub Actions deploy to `som@slavx.mooo.com:/home/som/MedusaStore` using [`docker-compose.prod.yml`](../docker-compose.prod.yml) and Caddy-only ingress;
- stable local storefront production-preview path for browser/smoke verification: `npm run storefront:build` -> `npm run storefront:start` or `bash scripts/manage.sh start:storefront`;
- baseline region/currency: `ru` / `rub`;
- notification baseline: local provider by default, UniSender and VK messaging are opt-in integration paths;
- payment baseline: YooKassa-first for the current Russian-market scope;
- Payload CMS content layer is materialized as a separate app in [payload-cms](../payload-cms); use [payload_cms_runbook.md](./payload_cms_runbook.md) for lifecycle commands, build guard, seed pages, and admin troubleshooting;
- storefront customization baseline: StudioPro/Stitch visual system over the preset-driven storefront stack is current; gaps/backlog are tracked in [stitch_frontend_gap_log.md](./stitch_frontend_gap_log.md) and should not be reopened without regression evidence or a scoped backlog item;
- delivery baseline target: ApiShip/Gorgo via `@gorgo/medusa-fulfillment-apiship`; Delivery Hub is no longer the target baseline for fresh templates.

Historical legacy delivery rows/provider ids may still exist in old local/staging databases. Treat them as database residue that needs separate operator-approved cleanup, not as active template behavior.

---

## ApiShip/Gorgo Direct Migration Status

The Delivery Hub -> ApiShip/Gorgo migration is completed and confirmed for the committed baseline.

The accepted direct baseline plan is [apiship_direct_migration_plan.md](./apiship_direct_migration_plan.md). Post-Phase 10 baseline smoke evidence is [apiship_baseline_smoke_evidence.md](./apiship_baseline_smoke_evidence.md). It uses a deterministic backend unit smoke for the current ApiShip baseline and does not require live ApiShip credentials, external ApiShip calls, running browser services, or live shipment execution.

Key fixed decisions:

- Delivery Hub is no longer the baseline delivery contour; the current baseline is `@gorgo/medusa-fulfillment-apiship`.
- This was a pre-production migration, so there is no requirement to preserve backward compatibility for old Delivery Hub carts/orders.
- Direct `/store/apiship/*` is canonical: storefront uses ApiShip endpoints directly, commits the standard Medusa cart shipping method with `apishipData`, and does not preserve `/store/delivery/*` as a first-version facade.
- Initial customer-facing price is the ApiShip tariff unless a separate pricing-policy requirement is added.
- Initial baseline is PVZ/pickup-point; courier can be added later.
- Delivery Hub has been deactivated from the baseline and physical cleanup/quarantine is recorded in [delivery_hub_physical_cleanup_manifest.md](./delivery_hub_physical_cleanup_manifest.md).
- `APISHIP_SHIPMENT_EXECUTION_ENABLED=false` is the default. Live shipment execution requires exact `APISHIP_SHIPMENT_EXECUTION_ENABLED=true` opt-in and runtime readiness/idempotency guards.

Acceptance now recorded for the completed migration:

- The direct migration plan and final smoke evidence are linked from this current-work map.
- Delivery Hub is previous-baseline/quarantined, not the fresh-template target baseline.
- `@gorgo/medusa-fulfillment-apiship` is the current target/baseline provider package.
- The migration was pre-production and does not require backward compatibility for old Delivery Hub carts/orders.
- Current checkout API shape is direct `/store/apiship/*`, no first-version `/store/delivery/*` facade, and standard Medusa shipping-method commit with `apishipData`.

---

## Delivery Hub Status

Delivery Hub rework is now previous-baseline historical context. The previous accepted plan is [delivery_hub_rework_plan.md](./delivery_hub_rework_plan.md), the historical/evidence map is [delivery_hub_documentation_index.md](./delivery_hub_documentation_index.md), and committed runtime cleanup/quarantine is recorded in [delivery_hub_physical_cleanup_manifest.md](./delivery_hub_physical_cleanup_manifest.md).

Do not use old Delivery Hub operational blocks as current checkout guidance. They remain audit/evidence context for why the ApiShip/Gorgo baseline exists and how legacy `/store/delivery/*`/Delivery Hub residue was quarantined.

Important retained facts:

- Delivery Hub/direct Yandex is not the fresh-template delivery baseline.
- Legacy `/store/delivery/*` paths are not canonical Store API surfaces for normal checkout.
- Old local/staging databases may still contain Delivery Hub rows/provider ids; cleanup is separate operator-approved residue work.
- Historical Delivery Hub docs/evidence may still mention `DELIVERY_HUB_*`, `NEXT_PUBLIC_DELIVERY_HUB_*`, `deliveryhub_deliveryhub`, and `/store/delivery/*`; treat those as previous-baseline references unless a current ApiShip doc explicitly says otherwise.

---

## Canonical Documentation Map

Use these documents in this order:

1. [current_work.md](./current_work.md) - operational status and next action.
2. [architecture.md](./architecture.md) - current production/local topology, service names, routes, internal URLs, runtime responsibilities.
3. [production_runbook.md](./production_runbook.md) - concrete production server/deploy/smoke/log operations for `slavx.mooo.com`.
4. [local_development.md](./local_development.md) - local compose vs host app runtimes.
5. [staging_runbook.md](./staging_runbook.md) - current staging reality and how to provision a real stage host.
6. [troubleshooting.md](./troubleshooting.md) - concrete operational failure modes and commands.
7. [stitch_frontend_gap_log.md](./stitch_frontend_gap_log.md) - current StudioPro/Stitch frontend alignment, code-vs-interface gaps, UI-vs-backend gaps, validation status, and backlog.
8. [payload_cms_runbook.md](./payload_cms_runbook.md) - Payload CMS architecture, lifecycle commands, build guard, seed URLs, env basics, and admin troubleshooting.
9. [apiship_direct_migration_plan.md](./apiship_direct_migration_plan.md) - accepted ApiShip/Gorgo direct migration plan and Phase 0 baseline freeze.
10. [apiship_baseline_smoke_evidence.md](./apiship_baseline_smoke_evidence.md) - deterministic ApiShip baseline smoke/evidence runbook without live credentials or external ApiShip calls.
11. [delivery_hub_physical_cleanup_manifest.md](./delivery_hub_physical_cleanup_manifest.md) - committed Delivery Hub runtime cleanup/quarantine manifest.
12. [delivery_hub_documentation_index.md](./delivery_hub_documentation_index.md) - Delivery Hub historical/evidence classification.
13. [delivery_hub_rework_plan.md](./delivery_hub_rework_plan.md) - previous-baseline Delivery Hub phase plan; historical unless explicitly referenced for audit.
14. [delivery_hub_spec.md](./delivery_hub_spec.md) - detailed previous-baseline architecture/reference material; treat as historical unless the cleaned docs say otherwise.
15. [env_contract.md](./env_contract.md) - environment/startup contract.
16. [master_repo_plan_v2.md](./master_repo_plan_v2.md) - overall repository roadmap.
17. [plan_analysis.md](./plan_analysis.md) - factual audit and historical reality check.

Old phase prompt files are not source-of-truth. Completed prompt artifacts should not be used to infer current status.

---

## Working Rules

- Code and verified runtime behavior win over narrative docs.
- Do not mark a phase closed unless its Definition of Done and validation evidence are satisfied.
- Do not copy stale statuses from older docs into new prompts or reports.
- Keep ApiShip/Gorgo as the current delivery baseline and direct `/store/apiship/*` as canonical Store API.
- Keep Delivery Hub/direct Yandex references classified as previous-baseline historical/quarantined context.
- Keep live shipment execution gated and default-off through `APISHIP_SHIPMENT_EXECUTION_ENABLED=false` unless exact `true` opt-in is explicitly scoped.
- Keep secrets and raw provider material out of docs, logs, storefront, and admin responses.
