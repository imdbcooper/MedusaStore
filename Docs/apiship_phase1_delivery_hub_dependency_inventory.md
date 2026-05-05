# ApiShip/Gorgo Migration Phase 1 — Delivery Hub Dependency Inventory

> Status: superseded historical discovery snapshot after ApiShip/Gorgo migration and Delivery Hub cleanup/quarantine.
>
> Date: 2026-05-04.
>
> Scope: historical Phase 1 view of Delivery Hub dependency surfaces before runtime cutover/cleanup. Do not use this document as current baseline guidance; current status lives in [current_work.md](./current_work.md), [apiship_baseline_smoke_evidence.md](./apiship_baseline_smoke_evidence.md), and [delivery_hub_physical_cleanup_manifest.md](./delivery_hub_physical_cleanup_manifest.md).
>
> Source plan: [apiship_direct_migration_plan.md](./apiship_direct_migration_plan.md).

---

## Executive summary

Phase 1 found Delivery Hub dependencies across backend fulfillment/provider configuration, backend Store API routes, admin diagnostics/order shipment surfaces, storefront checkout/data utilities, environment contracts, bootstrap/seed wiring, scripts/smokes/tests, and historical documentation. This inventory is now a superseded historical snapshot retained for audit traceability.

At the time of Phase 1, the active fresh-template delivery baseline was still materially wired to Delivery Hub in runtime source. Those blockers have since been superseded by the completed ApiShip/Gorgo migration and Delivery Hub cleanup/quarantine. Historical blockers captured at that time were:

- backend fulfillment provider registration still resolves `./src/modules/deliveryhub` with provider code `deliveryhub` in [medusa-config.ts](../medusa-agency-boilerplate/medusa-config.ts);
- the default fulfillment contour still declares `contour: "delivery_hub"`, provider code `deliveryhub`, and Yandex adapter posture in [fulfillment-contour-contract.ts](../medusa-agency-boilerplate/src/modules/fulfillment-contour-contract.ts);
- seed/bootstrap still imports and links `DELIVERY_HUB_FULFILLMENT_PROVIDER_ID` / `deliveryhub_deliveryhub` in [seed.ts](../medusa-agency-boilerplate/src/scripts/seed.ts);
- checkout storefront still imports Delivery Hub server actions and calls `/store/delivery/*` through [delivery-hub.ts](../medusa-agency-boilerplate-storefront/src/lib/data/delivery-hub.ts) and [index.tsx](../medusa-agency-boilerplate-storefront/src/modules/checkout/components/shipping/index.tsx);
- public and backend env contracts still expose `DELIVERY_HUB_*` and `NEXT_PUBLIC_DELIVERY_HUB_*` variables in [.env.example](../.env.example), [.env.template](../medusa-agency-boilerplate/.env.template), and [.env.local.example](../medusa-agency-boilerplate-storefront/.env.local.example);
- smoke/test coverage is heavily Delivery Hub-specific and must be replaced or archived only after ApiShip/Gorgo replacement paths and smoke evidence exist.

No runtime source, package manifests, or env files were changed in Phase 1. Because [current_work.md](./current_work.md) already has unrelated unstaged edits, this phase intentionally does not modify it to avoid mixing unrelated work into the Phase 1 commit.

---

## Discovery method

Searches were run with `grep` because `rg` is not installed in the current environment. The discovery covered the requested dependency needles:

- `delivery_hub`
- `deliveryhub`
- `Delivery Hub`
- `/store/delivery`
- `NEXT_PUBLIC_DELIVERY_HUB`
- `DELIVERY_HUB`
- `deliveryhub_deliveryhub`

The focused search excluded dependency/build/generated directories and binary-heavy artifacts where possible: `.git`, `node_modules`, `.medusa`, `dist`, `build`, `.next`, `generated-images`, `*.map`, and `*.sql`.

Representative commands used:

```sh
grep -RIlE --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=.medusa --exclude-dir=dist --exclude-dir=build --exclude-dir=.next --exclude-dir=generated-images --exclude='*.map' --exclude='*.sql' 'delivery_hub|deliveryhub|Delivery Hub|/store/delivery|NEXT_PUBLIC_DELIVERY_HUB|DELIVERY_HUB|deliveryhub_deliveryhub' .
```

```sh
grep -RInE --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=.medusa --exclude-dir=dist --exclude-dir=build --exclude-dir=.next --exclude='*.map' --exclude='*.sql' 'delivery_hub|deliveryhub|Delivery Hub|/store/delivery|NEXT_PUBLIC_DELIVERY_HUB|DELIVERY_HUB|deliveryhub_deliveryhub' Docs .env.example medusa-agency-boilerplate/.env.template medusa-agency-boilerplate/medusa-config.ts medusa-agency-boilerplate/src medusa-agency-boilerplate-storefront/src medusa-agency-boilerplate-storefront/.env.local.example medusa-agency-boilerplate-storefront/README.md scripts package.json docker-compose.yml
```

```sh
grep -RIn --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=.medusa --exclude-dir=dist --exclude-dir=build --exclude-dir=.next --exclude='*.map' --exclude='*.sql' 'deliveryhub_deliveryhub' .env.example medusa-agency-boilerplate medusa-agency-boilerplate-storefront scripts Docs docker-compose.yml package.json
```

---

## Dependency inventory

### 1. Backend config/modules

| Surface | Current Delivery Hub dependency | Phase 2+ disposition |
| --- | --- | --- |
| [medusa-config.ts](../medusa-agency-boilerplate/medusa-config.ts) | Imports `DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE`, registers fulfillment provider `resolve: "./src/modules/deliveryhub"`, `id: DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE`, and passes the default Delivery Hub contour into provider options. | Replace with ApiShip/Gorgo fulfillment provider registration; ensure Delivery Hub provider is not required for backend boot in fresh baseline. |
| [deliveryhub.ts](../medusa-agency-boilerplate/src/modules/deliveryhub.ts) | Medusa fulfillment provider implementation for Delivery Hub; handles option validation, price calculation, fulfillment data normalization, create-fulfillment seam, and shipment execution guardrails. | Keep inactive until ApiShip smoke passes, then remove/quarantine in physical cleanup. Do not use as ApiShip adapter. |
| [delivery-hub](../medusa-agency-boilerplate/src/modules/delivery-hub) module tree | Large Delivery Hub domain/service/storage/adapter surface: Yandex adapter, quote mapping, connections/warehouses repositories, cart selection, readiness, cutover candidate, fulfillment bridge, shipping-option sync, shipment lifecycle, execution ledger scaffolds, admin order read model. | Phase 2+ should not extend this surface for ApiShip. Deactivate baseline references first; only delete after ApiShip smoke/regression passes. |
| [shipping-option-contract.ts](../medusa-agency-boilerplate/src/modules/delivery-hub/shipping-option-contract.ts) | Canonical provider constants: `DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE = "deliveryhub"`, generated provider id `deliveryhub_deliveryhub`, option ids `deliveryhub:warehouse_to_pickup_point` and `deliveryhub:dropoff_point_to_pickup_point`. | Replace baseline shipping-option/provider assumptions with ApiShip/Gorgo equivalents. Existing constants can remain only for inactive historical cleanup scripts/tests until deletion. |
| [provider-surface.ts](../medusa-agency-boilerplate/src/modules/delivery-hub/provider-surface.ts) | Re-exports Delivery Hub provider id/code and validates fulfillment data against Delivery Hub selection shape. | Do not reuse for ApiShip. ApiShip payload should follow plugin contract and `apishipData`. |
| [constants.ts](../medusa-agency-boilerplate/src/modules/delivery-hub/constants.ts) | Defines module key `deliveryHub`, Delivery Hub tables, Yandex provider code, modes, quote reference pattern, statuses. | Leave only as inactive legacy/historical support until cleanup. |
| [fulfillment-contour-contract.ts](../medusa-agency-boilerplate/src/modules/fulfillment-contour-contract.ts) | Imports Delivery Hub constants and declares default contour as `delivery_hub`, provider `deliveryhub`, adapter `yandex`, posture `default_for_new_templates`. | Must switch to ApiShip/Gorgo in runtime migration before claiming fresh-template baseline is ApiShip. |
| Backend admin delivery UI | [page.tsx](../medusa-agency-boilerplate/src/admin/routes/settings/delivery/page.tsx), [page-state.ts](../medusa-agency-boilerplate/src/admin/routes/settings/delivery/page-state.ts), [manual-sync.ts](../medusa-agency-boilerplate/src/admin/routes/settings/delivery/manual-sync.ts), and page-state tests are Delivery Hub/Yandex settings and sync surfaces. | Can remain as inactive admin diagnostics during early cutover only if hidden/removed from baseline navigation later; should not be presented as current ApiShip setup. |
| Order admin Delivery Hub UI | [order-delivery-hub.tsx](../medusa-agency-boilerplate/src/admin/widgets/order-delivery-hub.tsx), [order-delivery-hub-state.ts](../medusa-agency-boilerplate/src/admin/widgets/order-delivery-hub-state.ts), and `/admin/orders/:id/delivery-hub` API routes. | Historical/inactive after ApiShip baseline unless ApiShip shipment operations replace it. |

Primary backend directories/files to revisit in Phase 2+:

- [medusa-config.ts](../medusa-agency-boilerplate/medusa-config.ts)
- [deliveryhub.ts](../medusa-agency-boilerplate/src/modules/deliveryhub.ts)
- [delivery-hub](../medusa-agency-boilerplate/src/modules/delivery-hub)
- [fulfillment-contour-contract.ts](../medusa-agency-boilerplate/src/modules/fulfillment-contour-contract.ts)
- [seed.ts](../medusa-agency-boilerplate/src/scripts/seed.ts)
- [middlewares.ts](../medusa-agency-boilerplate/src/api/middlewares.ts)

### 2. Store API

Historical Phase 1 snapshot: Delivery Hub owned the public delivery Store API namespace at that time. The completed migration now uses direct ApiShip `/store/apiship/*` endpoints and does not preserve `/store/delivery/*` as a first-version facade.

Current `/store/delivery/*` route files:

- [catalog/route.ts](../medusa-agency-boilerplate/src/api/store/delivery/catalog/route.ts)
- [settings/route.ts](../medusa-agency-boilerplate/src/api/store/delivery/settings/route.ts)
- [quotes/route.ts](../medusa-agency-boilerplate/src/api/store/delivery/quotes/route.ts)
- [pickup-points/route.ts](../medusa-agency-boilerplate/src/api/store/delivery/pickup-points/route.ts)
- [pickup-windows/route.ts](../medusa-agency-boilerplate/src/api/store/delivery/pickup-windows/route.ts)
- [selection/route.ts](../medusa-agency-boilerplate/src/api/store/delivery/selection/route.ts)
- [selection/commit/route.ts](../medusa-agency-boilerplate/src/api/store/delivery/selection/commit/route.ts)
- [readiness/route.ts](../medusa-agency-boilerplate/src/api/store/delivery/readiness/route.ts)
- [cutover-preconditions/route.ts](../medusa-agency-boilerplate/src/api/store/delivery/cutover-preconditions/route.ts)
- [cutover-candidate/route.ts](../medusa-agency-boilerplate/src/api/store/delivery/cutover-candidate/route.ts)
- [cutover-approval-template/route.ts](../medusa-agency-boilerplate/src/api/store/delivery/cutover-approval-template/route.ts)
- [shared.ts](../medusa-agency-boilerplate/src/api/store/delivery/shared.ts)

Middleware registration in [middlewares.ts](../medusa-agency-boilerplate/src/api/middlewares.ts) validates all of the Store API routes above, including `GET/POST /store/delivery/quotes`, `GET/POST/DELETE /store/delivery/selection`, `POST /store/delivery/selection/commit`, and the cutover/readiness diagnostics.

Phase 2+ actions:

- add/configure ApiShip/Gorgo routes according to plugin contract;
- move checkout to `/store/apiship/*` in Phase 4/5;
- remove normal checkout reliance on `/store/delivery/*` before deleting Delivery Hub Store API routes;
- avoid creating a new `/store/delivery/*` compatibility facade in the first ApiShip baseline.

### 3. Storefront checkout/data

| Surface | Current Delivery Hub dependency | Phase 2+ disposition |
| --- | --- | --- |
| [delivery-hub.ts](../medusa-agency-boilerplate-storefront/src/lib/data/delivery-hub.ts) | Server actions call `/store/delivery/catalog`, `/settings`, `/quotes`, `/pickup-points`, `/pickup-windows`, `/selection`, `/selection/commit`, `/readiness`, and cutover diagnostics. | Replace with ApiShip/Gorgo data actions that call plugin-specific `/store/apiship/*`; remove normal checkout imports from Delivery Hub actions. |
| [delivery-hub.ts](../medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub.ts) | Large type/model/normalization layer for Delivery Hub quote, pickup point, selection, readiness, cutover, buyer card, and commit eligibility. Contains `delivery_hub_storefront_preview` and provider id checks for `deliveryhub_deliveryhub`. | Do not reuse for ApiShip unless extracting provider-neutral helpers separately. Keep only until checkout no longer imports it, then archive/delete. |
| [delivery-hub-preview.ts](../medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub-preview.ts) | Preview diagnostics constants for Delivery Hub. | Can stay inactive only behind dev diagnostics until removed. |
| [index.tsx](../medusa-agency-boilerplate-storefront/src/modules/checkout/components/shipping/index.tsx) | Active checkout imports Delivery Hub data actions and env flags, loads pickup points/quotes, saves/clears selection, checks readiness, commits through Delivery Hub commit route, and checks `deliveryhub_deliveryhub` provider ids. | Main Phase 4/5 replacement target. Implement ApiShip quote/PVZ selection and standard Medusa add-shipping-method flow with `apishipData`; remove Delivery Hub product flow and diagnostics from normal checkout. |
| [env.ts](../medusa-agency-boilerplate-storefront/src/lib/env.ts) and [config.ts](../medusa-agency-boilerplate-storefront/src/lib/config.ts) | Parse/export `NEXT_PUBLIC_DELIVERY_HUB_PREVIEW_*` and `NEXT_PUBLIC_DELIVERY_HUB_CHECKOUT_CUTOVER_ENABLED`. | Replace with ApiShip-specific public config only if needed; remove Delivery Hub flags from baseline env contract after runtime cutover. |
| [README.md](../medusa-agency-boilerplate-storefront/README.md) | Describes Delivery Hub as active checkout flow and documents `/store/delivery/selection` plus Delivery Hub env flags. | Update to ApiShip/Gorgo direct flow after runtime migration. |

### 4. Env contract

Current Delivery Hub env variables discovered:

| File | Variables / contract | Phase 2+ disposition |
| --- | --- | --- |
| [.env.example](../.env.example) | Historical Phase 1 snapshot: at that time it listed `DELIVERY_HUB_ENCRYPTION_KEY`, `DELIVERY_HUB_SHIPMENT_EXECUTION_ENABLED`, and comments that treated Delivery Hub/direct Yandex as default fulfillment contour. | Superseded: current templates use ApiShip/Gorgo env contract with `APISHIP_SHIPMENT_EXECUTION_ENABLED=false`; do not use Delivery Hub as fresh-template default. |
| [.env.template](../medusa-agency-boilerplate/.env.template) | Same backend Delivery Hub variables and default-contour comments. | Same as root env template. |
| [.env.local.example](../medusa-agency-boilerplate-storefront/.env.local.example) | `NEXT_PUBLIC_DELIVERY_HUB_PREVIEW_ENABLED`, `NEXT_PUBLIC_DELIVERY_HUB_PREVIEW_DEV_DEFAULTS_ENABLED`, `NEXT_PUBLIC_DELIVERY_HUB_PREVIEW_DEFAULT_CONNECTION_ID`, `NEXT_PUBLIC_DELIVERY_HUB_PREVIEW_DEFAULT_DESTINATION_POINT_ID`, `NEXT_PUBLIC_DELIVERY_HUB_PREVIEW_DEFAULT_ORIGIN_POINT_ID`, `NEXT_PUBLIC_DELIVERY_HUB_PREVIEW_DEFAULT_WAREHOUSE_ID`, `NEXT_PUBLIC_DELIVERY_HUB_CHECKOUT_CUTOVER_ENABLED`. | Remove from fresh storefront baseline after ApiShip checkout is in place; introduce ApiShip public variables only if plugin/UI requires them. |
| [docker-compose.yml](../docker-compose.yml) | Passes `DELIVERY_HUB_ENCRYPTION_KEY` and `DELIVERY_HUB_SHIPMENT_EXECUTION_ENABLED` to backend container. | Replace with ApiShip backend env if needed. |
| [env-sync.sh](../scripts/env-sync.sh) | Syncs Delivery Hub backend variables to backend env and storefront public Delivery Hub aliases. | Update sync logic after ApiShip env contract is defined. |
| [env_contract.md](./env_contract.md) | Documents Delivery Hub env and current baseline assumptions. | Mark Delivery Hub sections historical or replace with ApiShip env source of truth after runtime migration. |

Phase 1 did not modify env files.

### 5. Seed/bootstrap

Primary current bootstrap dependency:

- [seed.ts](../medusa-agency-boilerplate/src/scripts/seed.ts) imports `DELIVERY_HUB_FULFILLMENT_PROVIDER_ID` and currently treats Delivery Hub as the stock-location fulfillment provider baseline. Search hits show it links the baseline stock location to `deliveryhub_deliveryhub` and no longer creates the legacy manual contour.

Related baseline contract:

- [fulfillment-contour-contract.ts](../medusa-agency-boilerplate/src/modules/fulfillment-contour-contract.ts) defines the fresh-template default fulfillment contour as Delivery Hub/Yandex.

Phase 2+ actions:

- define the ApiShip/Gorgo provider id and bootstrap contract;
- update seed/bootstrap so fresh clones link the baseline stock location/service zone/shipping option to ApiShip, not `deliveryhub_deliveryhub`;
- treat existing local/staging Delivery Hub rows as residue until an explicit cleanup phase after ApiShip smoke passes.

### 6. Scripts, smoke, and tests

Delivery Hub scripts are extensive and split between local repair/cleanup, safe diagnostics, credential application, evidence packaging, and browser smoke.

Backend scripts under [src/scripts](../medusa-agency-boilerplate/src/scripts):

- [delivery-hub-cleanup-legacy-shipping-options.ts](../medusa-agency-boilerplate/src/scripts/delivery-hub-cleanup-legacy-shipping-options.ts)
- [delivery-hub-local-connection-status-repair.ts](../medusa-agency-boilerplate/src/scripts/delivery-hub-local-connection-status-repair.ts)
- [delivery-hub-purge-legacy-admin-residue.ts](../medusa-agency-boilerplate/src/scripts/delivery-hub-purge-legacy-admin-residue.ts)
- [delivery-hub-repair-location-provider-link.ts](../medusa-agency-boilerplate/src/scripts/delivery-hub-repair-location-provider-link.ts)
- [delivery-hub-safe-connection-readiness-check.ts](../medusa-agency-boilerplate/src/scripts/delivery-hub-safe-connection-readiness-check.ts)
- [delivery-hub-storefront-neutral-smoke.ts](../medusa-agency-boilerplate/src/scripts/delivery-hub-storefront-neutral-smoke.ts)
- [delivery-hub-store-quote-safe-diagnostics.ts](../medusa-agency-boilerplate/src/scripts/delivery-hub-store-quote-safe-diagnostics.ts)
- [delivery-hub-sync-storefront-shipping-options.ts](../medusa-agency-boilerplate/src/scripts/delivery-hub-sync-storefront-shipping-options.ts)
- [delivery-hub-yandex-credentials-apply.ts](../medusa-agency-boilerplate/src/scripts/delivery-hub-yandex-credentials-apply.ts)
- [delivery-hub-yandex-credentials-apply-readme.md](../medusa-agency-boilerplate/src/scripts/delivery-hub-yandex-credentials-apply-readme.md)
- [delivery-hub-yandex-pickup-point-safe-diagnostics.ts](../medusa-agency-boilerplate/src/scripts/delivery-hub-yandex-pickup-point-safe-diagnostics.ts)
- [delivery-hub-yandex-provider-contract-validation.ts](../medusa-agency-boilerplate/src/scripts/delivery-hub-yandex-provider-contract-validation.ts)
- [validate-delivery-hub-execution-ledger-snapshot.ts](../medusa-agency-boilerplate/src/scripts/validate-delivery-hub-execution-ledger-snapshot.ts)

Root scripts under [scripts](../scripts):

- [delivery-hub-preview-browser-smoke.mjs](../scripts/delivery-hub-preview-browser-smoke.mjs): mocks `/store/delivery/*`, `deliveryhub_deliveryhub`, Delivery Hub checkout save/commit/readiness, and `NEXT_PUBLIC_DELIVERY_HUB_*` env flags.
- [delivery-hub-cutover-evidence-bundle.mjs](../scripts/delivery-hub-cutover-evidence-bundle.mjs)
- [delivery-hub-staging-dry-run-evidence.mjs](../scripts/delivery-hub-staging-dry-run-evidence.mjs)
- [env-sync.sh](../scripts/env-sync.sh) includes Delivery Hub env sync.

Delivery Hub tests are numerous and should be replaced/archived only after ApiShip coverage exists. Main discovered groups:

- [delivery-hub-provider-validation.unit.spec.ts](../medusa-agency-boilerplate/src/workflows/__tests__/delivery-hub-provider-validation.unit.spec.ts)
- [delivery-hub-admin.unit.spec.ts](../medusa-agency-boilerplate/src/workflows/__tests__/delivery-hub-admin.unit.spec.ts)
- [delivery-hub-store.unit.spec.ts](../medusa-agency-boilerplate/src/workflows/__tests__/delivery-hub-store.unit.spec.ts)
- [delivery-hub-readiness.unit.spec.ts](../medusa-agency-boilerplate/src/workflows/__tests__/delivery-hub-readiness.unit.spec.ts)
- [delivery-hub-cart-selection.unit.spec.ts](../medusa-agency-boilerplate/src/workflows/__tests__/delivery-hub-cart-selection.unit.spec.ts)
- [delivery-hub-fulfillment-provider-bridge.unit.spec.ts](../medusa-agency-boilerplate/src/workflows/__tests__/delivery-hub-fulfillment-provider-bridge.unit.spec.ts)
- [delivery-hub-controlled-execution-contract.unit.spec.ts](../medusa-agency-boilerplate/src/workflows/__tests__/delivery-hub-controlled-execution-contract.unit.spec.ts)
- [delivery-hub-admin-shipment-operations.unit.spec.ts](../medusa-agency-boilerplate/src/workflows/__tests__/delivery-hub-admin-shipment-operations.unit.spec.ts)
- [delivery-hub-storefront-neutral-smoke-harness.unit.spec.ts](../medusa-agency-boilerplate/src/workflows/__tests__/delivery-hub-storefront-neutral-smoke-harness.unit.spec.ts)
- Yandex adapter tests such as [delivery-hub-yandex-api-contract.unit.spec.ts](../medusa-agency-boilerplate/src/workflows/__tests__/delivery-hub-yandex-api-contract.unit.spec.ts), [delivery-hub-yandex-create-shipment-dispatch-port.unit.spec.ts](../medusa-agency-boilerplate/src/workflows/__tests__/delivery-hub-yandex-create-shipment-dispatch-port.unit.spec.ts), and [delivery-hub-yandex-create-shipment-materializer.unit.spec.ts](../medusa-agency-boilerplate/src/workflows/__tests__/delivery-hub-yandex-create-shipment-materializer.unit.spec.ts).
- Storefront test [delivery-hub.spec.ts](../medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub.spec.ts) validates checkout source, Delivery Hub models, `NEXT_PUBLIC_DELIVERY_HUB_*`, `/store/delivery/*`, and `deliveryhub_deliveryhub` assumptions.
- Admin page-state tests under [page-state.unit.spec.ts](../medusa-agency-boilerplate/src/admin/routes/settings/delivery/__tests__/page-state.unit.spec.ts).

Phase 2+ should add ApiShip-specific smoke/regression before removing Delivery Hub tests, then retire Delivery Hub smokes from required baseline commands.

### 7. Docs/source-of-truth

Current source-of-truth and historical docs with Delivery Hub references:

- [apiship_direct_migration_plan.md](./apiship_direct_migration_plan.md): active migration plan; already freezes Delivery Hub as previous baseline and ApiShip/Gorgo as target.
- [current_work.md](./current_work.md): operational map; currently has unrelated unstaged edits, so Phase 1 did not modify it.
- [delivery_hub_spec.md](./delivery_hub_spec.md), [delivery_hub_rework_plan.md](./delivery_hub_rework_plan.md), [delivery_hub_checkout_cutover_plan.md](./delivery_hub_checkout_cutover_plan.md), [delivery_hub_manual_testing_plan.md](./delivery_hub_manual_testing_plan.md), [delivery_hub_documentation_index.md](./delivery_hub_documentation_index.md): Delivery Hub historical/current docs that should be marked historical once ApiShip baseline is implemented.
- Execution-ledger and evidence docs: [delivery_hub_execution_ledger_release_handoff_index.md](./delivery_hub_execution_ledger_release_handoff_index.md), [delivery_hub_execution_ledger_operator_reviewer_quickstart.md](./delivery_hub_execution_ledger_operator_reviewer_quickstart.md), [delivery_hub_execution_ledger_manual_runbook.md](./delivery_hub_execution_ledger_manual_runbook.md), [delivery_hub_execution_ledger_manual_evidence_template.md](./delivery_hub_execution_ledger_manual_evidence_template.md), [delivery_hub_execution_ledger_evidence_submission_checklist.md](./delivery_hub_execution_ledger_evidence_submission_checklist.md), [delivery_hub_execution_ledger_evidence_bundle_packaging_convention.md](./delivery_hub_execution_ledger_evidence_bundle_packaging_convention.md), [delivery_hub_execution_ledger_snapshot_fixture_contract.md](./delivery_hub_execution_ledger_snapshot_fixture_contract.md).
- Evidence/runbook docs: [delivery_hub_cutover_evidence_bundle.md](./delivery_hub_cutover_evidence_bundle.md), [delivery_hub_cutover_decision_record_template.md](./delivery_hub_cutover_decision_record_template.md), [delivery_hub_cutover_go_no_go_index.md](./delivery_hub_cutover_go_no_go_index.md), [delivery_hub_staging_unblock_handoff_runbook.md](./delivery_hub_staging_unblock_handoff_runbook.md), [delivery_hub_yandex_provider_contract_validation_runbook.md](./delivery_hub_yandex_provider_contract_validation_runbook.md), [delivery_hub_yandex_provider_contract_validation_evidence_20260424.md](./delivery_hub_yandex_provider_contract_validation_evidence_20260424.md), [delivery_hub_yandex_other_day_api_diagnostics_20260427.md](./delivery_hub_yandex_other_day_api_diagnostics_20260427.md).
- Broader docs with Delivery Hub baseline mentions: [env_contract.md](./env_contract.md), [master_repo_plan_v2.md](./master_repo_plan_v2.md), [plan_analysis.md](./plan_analysis.md), [template_readiness_regression.md](./template_readiness_regression.md), [master_repo_guide.md](./master_repo_guide.md), [template_release_handoff.md](./template_release_handoff.md).

Post-cutover documentation rule: Delivery Hub docs are historical/evidence context. Active docs must state ApiShip/Gorgo as the fresh-template baseline and direct `/store/apiship/*` as canonical.

---

## Files/points likely to change in following phases

### Phase 2 — ApiShip/Gorgo backend baseline

- [package.json](../package.json) and backend package manifests if plugin dependency must be installed.
- [medusa-config.ts](../medusa-agency-boilerplate/medusa-config.ts) for ApiShip/Gorgo provider registration.
- [fulfillment-contour-contract.ts](../medusa-agency-boilerplate/src/modules/fulfillment-contour-contract.ts) for baseline contour change.
- [seed.ts](../medusa-agency-boilerplate/src/scripts/seed.ts) for stock-location/provider bootstrap.
- backend env templates once ApiShip minimum env contract is defined.

### Phase 3 — baseline delivery method

- shipping option bootstrap/sync code replacing Delivery Hub managed options.
- any ApiShip-specific data shape needed for pickup/PVZ shipping option.

### Phase 4/5 — storefront ApiShip checkout and commit API shape

- [delivery-hub.ts](../medusa-agency-boilerplate-storefront/src/lib/data/delivery-hub.ts) replacement/removal.
- [delivery-hub.ts](../medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub.ts) replacement/removal from normal checkout path.
- [index.tsx](../medusa-agency-boilerplate-storefront/src/modules/checkout/components/shipping/index.tsx) migration to ApiShip quote/PVZ and standard Medusa shipping-method commit with `apishipData`.
- [env.ts](../medusa-agency-boilerplate-storefront/src/lib/env.ts), [config.ts](../medusa-agency-boilerplate-storefront/src/lib/config.ts), and [.env.local.example](../medusa-agency-boilerplate-storefront/.env.local.example) to remove Delivery Hub public flags from fresh baseline.

### Phase 6 — deactivate Delivery Hub baseline

- [middlewares.ts](../medusa-agency-boilerplate/src/api/middlewares.ts) if `/store/delivery/*` and Delivery Hub admin routes become inactive.
- [README.md](../medusa-agency-boilerplate-storefront/README.md) and active docs to stop presenting Delivery Hub as current default.
- Delivery Hub admin menu/widgets if they should be hidden from fresh baseline.

### Phase 8/9 — smoke, regression, cleanup

- [delivery-hub-preview-browser-smoke.mjs](../scripts/delivery-hub-preview-browser-smoke.mjs) replaced by ApiShip smoke.
- Delivery Hub tests under backend and storefront replaced/archived after ApiShip coverage is stable.
- Delivery Hub module/routes/scripts deleted/quarantined only after smoke passes and with explicit cleanup scope.

---

## Delivery Hub pieces that can temporarily remain inactive

These pieces can stay in the repository temporarily while ApiShip replacement paths are built, provided they are not wired as the fresh-template baseline and not required by normal checkout:

- historical docs and evidence bundles under [Docs](./);
- Delivery Hub module implementation under [delivery-hub](../medusa-agency-boilerplate/src/modules/delivery-hub) and provider file [deliveryhub.ts](../medusa-agency-boilerplate/src/modules/deliveryhub.ts), after provider registration/seed baseline no longer requires them;
- admin diagnostics/settings pages and order widgets, if hidden or clearly treated as historical/inactive;
- cleanup/repair scripts for existing local/staging residue, especially scripts that remove `deliveryhub_deliveryhub` data after ApiShip smoke evidence exists;
- Delivery Hub tests as non-baseline historical coverage until removed in cleanup, as long as required CI/smoke commands no longer use them as proof of current delivery baseline.

Do not delete these before ApiShip backend boot, checkout smoke, and fresh bootstrap verification exist.

---

## Risks and notes for Phase 2+

1. **Provider id and bootstrap coupling.** `deliveryhub_deliveryhub` appears in seed/bootstrap, tests, storefront matching, admin diagnostics, and cleanup scripts. ApiShip migration must define the new provider id/source of truth before changing seed logic.
2. **Store API shape is intentionally not compatible.** The plan chooses direct `/store/apiship/*`. Any accidental `/store/delivery/*` facade would conflict with the Phase 5 decision.
3. **Checkout has both product and diagnostics Delivery Hub code.** Product-flow dependencies and collapsed diagnostics share utilities. Remove normal checkout imports first; archive diagnostics later if needed.
4. **Env contract must not be changed before runtime support exists.** Delivery Hub env variables remain present until ApiShip provider/config is implemented. Phase 1 intentionally did not edit env files.
5. **Historical docs are extensive.** Active docs must be updated carefully after runtime cutover so old Delivery Hub docs are marked historical without deleting useful evidence/runbooks prematurely.
6. **Unrelated working-tree changes are present.** Future commits must stage only phase-specific files; do not include existing Delivery Hub runtime edits unless they are explicitly part of a later phase.
7. **Generated/build artifacts can produce huge grep output.** Keep future discovery commands excluding `.medusa`, `.next`, `dist`, `build`, maps, SQL dumps, and dependency directories.

---

## Historical readiness for Phase 2

Phase 1 was ready for Phase 2 planning/implementation because the primary Delivery Hub dependency surfaces were identified and categorized. This section is retained as historical planning context only; the ApiShip/Gorgo baseline and cleanup have since completed.

Historical Phase 2 guardrails were:

- do not delete Delivery Hub runtime residue until ApiShip smoke/regression passes;
- stage only Phase 2 files in the Phase 2 commit;
- define ApiShip provider/env/bootstrap source of truth before changing storefront checkout;
- preserve the direct-cutover decision: normal checkout should move to `/store/apiship/*`, not a new `/store/delivery/*` compatibility facade.
