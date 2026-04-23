# Delivery Hub review-surface quarantine manifest

> Cleanup status: legacy provider/runtime routes have been removed from the master template. Delivery Hub/direct Yandex is the selected delivery contour; live dispatch remains gated/not enabled; backend startup must not require new delivery env secrets. Existing old databases may still contain obsolete delivery rows/provider ids and require separate operator-approved cleanup if relevant.

Generated: 2026-04-23T01:03:47Z
Workspace: [`medusa-agency-boilerplate`](../)
Scope: process artifact only; no feature changes, no cleanup/removal, no destructive git operations.

## Inventory source

Read-only inventory was collected from:

- `git status --short`
- `git diff --cached --name-status` — no staged changes were present.
- `git diff --name-status`
- `git ls-files --others --exclude-standard`
- `git diff --stat`
- sibling check: `../medusa-agency-boilerplate-storefront/.git` was absent, so no sibling storefront repository status was available. Storefront-looking paths below are dirty paths inside this workspace checkout and are treated as cross-repo surface.

## Bucket definitions

| Bucket | Meaning | Default review action |
|---|---|---|
| A | Intended [`delivery-hub`](../Docs/delivery_hub_spec.md) work / next tranche surface | include or future-tranche |
| B | Protected invariant surfaces | reference-only / invariant-only |
| C | Legacy provider noise / non-current work | exclude or future-tranche |
| D | Sibling storefront / cross-repo surface | reference-only / exclude |
| E | Docs/status/planning artifacts | reference-only / include only for planning review |

## Scoped review protocol

- Review should evaluate only paths marked `include` in this manifest, plus paths marked `reference-only` when they are needed to verify stated invariants.
- Dirty-tree paths marked `exclude` must not automatically break a verdict while they are not imported by, called by, or otherwise influencing included paths.
- Dirty-tree paths marked `future-tranche` are acknowledged as real inventory but are not part of the current scoped review unless a later tranche explicitly includes them.
- Protected guardrails are checked as invariant-only: the review confirms that blocked surfaces remain blocked and that no runtime cutover is claimed.
- This manifest does not approve cleanup, removal, rollback, formatting, activation, migrations, transaction-runner work, API expansion, or storefront edits.

## Guardrail checks

| Guardrail | Required state | Review action |
|---|---|---|
| [`createFulfillment()`](../medusa-agency-boilerplate/src/modules/deliveryhub.ts:119) | Must remain hard-blocked. | invariant-only |
| [`DeliveryHubExecutionLedgerRepositoryAssemblyPersistenceReadinessContour`](../medusa-agency-boilerplate/src/modules/delivery-hub/storage/execution-ledger-repository-assembly-scaffold.ts:161) | Must remain `artifact_defined -> manual_application_external -> snapshot_verification_available -> activation_blocked`. | invariant-only |
| Legacy provider | Must not be removed. | invariant-only |
| Storefront cutover | No storefront cutover claim is made by this manifest. | invariant-only |

## Bucket A — intended delivery-hub work / next tranche surface

These paths are candidate backend [`delivery-hub`](../Docs/delivery_hub_spec.md) review surface. Current manifest action does not mean the implementation is approved; it only scopes future review.

| Status | Path | Action | Reason |
|---|---|---|---|
| M | [`medusa-agency-boilerplate/src/admin/routes/settings/delivery/page.tsx`](../medusa-agency-boilerplate/src/admin/routes/settings/delivery/page.tsx) | future-tranche | Admin delivery UI surface; large dirty diff should be reviewed only in a scoped delivery-hub tranche. |
| M | [`medusa-agency-boilerplate/src/api/admin/delivery/connections/[id]/route.ts`](../medusa-agency-boilerplate/src/api/admin/delivery/connections/[id]/route.ts) | future-tranche | Admin delivery connection endpoint surface; include only when API tranche is opened. |
| M | [`medusa-agency-boilerplate/src/api/admin/delivery/connections/[id]/test/route.ts`](../medusa-agency-boilerplate/src/api/admin/delivery/connections/[id]/test/route.ts) | future-tranche | Admin connection test endpoint; delivery-hub related but not current process-artifact scope. |
| M | [`medusa-agency-boilerplate/src/api/admin/delivery/connections/route.ts`](../medusa-agency-boilerplate/src/api/admin/delivery/connections/route.ts) | future-tranche | Admin connection list/create endpoint; delivery-hub API surface. |
| M | [`medusa-agency-boilerplate/src/api/admin/delivery/logs/route.ts`](../medusa-agency-boilerplate/src/api/admin/delivery/logs/route.ts) | future-tranche | Admin delivery logs endpoint; next-tranche review candidate. |
| M | [`medusa-agency-boilerplate/src/api/admin/delivery/providers/route.ts`](../medusa-agency-boilerplate/src/api/admin/delivery/providers/route.ts) | future-tranche | Admin providers endpoint; delivery-hub API surface. |
| M | [`medusa-agency-boilerplate/src/api/admin/delivery/shared.ts`](../medusa-agency-boilerplate/src/api/admin/delivery/shared.ts) | future-tranche | Shared admin delivery support; large diff needs isolated review. |
| M | [`medusa-agency-boilerplate/src/api/admin/delivery/test-quote/route.ts`](../medusa-agency-boilerplate/src/api/admin/delivery/test-quote/route.ts) | future-tranche | Admin test quote endpoint; delivery-hub API surface. |
| M | [`medusa-agency-boilerplate/src/api/admin/delivery/warehouses/[id]/route.ts`](../medusa-agency-boilerplate/src/api/admin/delivery/warehouses/[id]/route.ts) | future-tranche | Admin warehouse endpoint; delivery-hub API surface. |
| M | [`medusa-agency-boilerplate/src/api/admin/delivery/warehouses/route.ts`](../medusa-agency-boilerplate/src/api/admin/delivery/warehouses/route.ts) | future-tranche | Admin warehouse collection endpoint; delivery-hub API surface. |
| M | [`medusa-agency-boilerplate/src/api/store/delivery/pickup-points/route.ts`](../medusa-agency-boilerplate/src/api/store/delivery/pickup-points/route.ts) | future-tranche | Store delivery pickup points endpoint; backend delivery-hub surface. |
| M | [`medusa-agency-boilerplate/src/api/store/delivery/pickup-windows/route.ts`](../medusa-agency-boilerplate/src/api/store/delivery/pickup-windows/route.ts) | future-tranche | Store delivery pickup windows endpoint; backend delivery-hub surface. |
| M | [`medusa-agency-boilerplate/src/api/store/delivery/quotes/route.ts`](../medusa-agency-boilerplate/src/api/store/delivery/quotes/route.ts) | future-tranche | Store quotes endpoint; backend delivery-hub surface. |
| M | [`medusa-agency-boilerplate/src/api/store/delivery/readiness/route.ts`](../medusa-agency-boilerplate/src/api/store/delivery/readiness/route.ts) | future-tranche | Store readiness endpoint; review only in readiness/API tranche. |
| M | [`medusa-agency-boilerplate/src/api/store/delivery/selection/route.ts`](../medusa-agency-boilerplate/src/api/store/delivery/selection/route.ts) | future-tranche | Store selection endpoint; backend delivery-hub surface. |
| M | [`medusa-agency-boilerplate/src/api/store/delivery/shared.ts`](../medusa-agency-boilerplate/src/api/store/delivery/shared.ts) | future-tranche | Shared store delivery support; next-tranche candidate. |
| M | [`medusa-agency-boilerplate/src/modules/delivery-hub/cart-selection.ts`](../medusa-agency-boilerplate/src/modules/delivery-hub/cart-selection.ts) | future-tranche | Cart selection domain logic; intended delivery-hub surface. |
| M | [`medusa-agency-boilerplate/src/modules/delivery-hub/constants.ts`](../medusa-agency-boilerplate/src/modules/delivery-hub/constants.ts) | future-tranche | Delivery-hub constants; review with dependent tranche. |
| M | [`medusa-agency-boilerplate/src/modules/delivery-hub/index.ts`](../medusa-agency-boilerplate/src/modules/delivery-hub/index.ts) | future-tranche | Module entry point; review with module surface. |
| M | [`medusa-agency-boilerplate/src/modules/delivery-hub/service.ts`](../medusa-agency-boilerplate/src/modules/delivery-hub/service.ts) | future-tranche | Delivery-hub service implementation; large dirty diff should be isolated. |
| M | [`medusa-agency-boilerplate/src/modules/delivery-hub/storage/connections-repository.ts`](../medusa-agency-boilerplate/src/modules/delivery-hub/storage/connections-repository.ts) | future-tranche | Storage repository surface; review with persistence tranche. |
| M | [`medusa-agency-boilerplate/src/modules/delivery-hub/storage/pg.ts`](../medusa-agency-boilerplate/src/modules/delivery-hub/storage/pg.ts) | future-tranche | Postgres storage utility; persistence surface. |
| M | [`medusa-agency-boilerplate/src/modules/delivery-hub/storage/schemas.ts`](../medusa-agency-boilerplate/src/modules/delivery-hub/storage/schemas.ts) | future-tranche | Storage schemas; persistence surface. |
| M | [`medusa-agency-boilerplate/src/modules/delivery-hub/storage/warehouses-repository.ts`](../medusa-agency-boilerplate/src/modules/delivery-hub/storage/warehouses-repository.ts) | future-tranche | Storage repository surface; review with persistence tranche. |
| M | [`medusa-agency-boilerplate/src/workflows/__tests__/delivery-hub-admin.unit.spec.ts`](../medusa-agency-boilerplate/src/workflows/__tests__/delivery-hub-admin.unit.spec.ts) | future-tranche | Backend delivery-hub admin tests; review with matching implementation tranche. |
| M | [`medusa-agency-boilerplate/src/workflows/__tests__/delivery-hub-cart-selection.unit.spec.ts`](../medusa-agency-boilerplate/src/workflows/__tests__/delivery-hub-cart-selection.unit.spec.ts) | future-tranche | Cart selection tests; review with matching domain changes. |
| M | [`medusa-agency-boilerplate/src/workflows/__tests__/delivery-hub-readiness.unit.spec.ts`](../medusa-agency-boilerplate/src/workflows/__tests__/delivery-hub-readiness.unit.spec.ts) | future-tranche | Readiness tests; review with readiness tranche. |
| M | [`medusa-agency-boilerplate/src/workflows/__tests__/delivery-hub-store.unit.spec.ts`](../medusa-agency-boilerplate/src/workflows/__tests__/delivery-hub-store.unit.spec.ts) | future-tranche | Store API tests; review with store API tranche. |
| M | [`medusa-agency-boilerplate/src/workflows/__tests__/delivery-hub.unit.spec.ts`](../medusa-agency-boilerplate/src/workflows/__tests__/delivery-hub.unit.spec.ts) | future-tranche | Core delivery-hub tests; review with module tranche. |
| ?? | [`medusa-agency-boilerplate/src/admin/routes/settings/delivery/__tests__/page-state.unit.spec.ts`](../medusa-agency-boilerplate/src/admin/routes/settings/delivery/__tests__/page-state.unit.spec.ts) | future-tranche | New admin page-state test; delivery-hub UI tranche candidate. |
| ?? | [`medusa-agency-boilerplate/src/admin/routes/settings/delivery/manual-sync.ts`](../medusa-agency-boilerplate/src/admin/routes/settings/delivery/manual-sync.ts) | future-tranche | New admin manual sync helper; delivery-hub UI/admin surface. |
| ?? | [`medusa-agency-boilerplate/src/admin/routes/settings/delivery/page-state.ts`](../medusa-agency-boilerplate/src/admin/routes/settings/delivery/page-state.ts) | future-tranche | New admin page state helper; delivery-hub UI/admin surface. |
| ?? | [`medusa-agency-boilerplate/src/api/admin/delivery/execution-plan/preview/route.ts`](../medusa-agency-boilerplate/src/api/admin/delivery/execution-plan/preview/route.ts) | future-tranche | New execution-plan preview endpoint; delivery-hub controlled execution surface. |
| ?? | [`medusa-agency-boilerplate/src/api/admin/delivery/fulfillment-bridge/preview/route.ts`](../medusa-agency-boilerplate/src/api/admin/delivery/fulfillment-bridge/preview/route.ts) | future-tranche | New fulfillment bridge preview endpoint; must remain non-activating until reviewed. |
| ?? | [`medusa-agency-boilerplate/src/api/admin/delivery/shipping-options/preview/route.ts`](../medusa-agency-boilerplate/src/api/admin/delivery/shipping-options/preview/route.ts) | future-tranche | New shipping option preview endpoint; review with admin API tranche. |
| ?? | [`medusa-agency-boilerplate/src/api/admin/delivery/shipping-options/sync/route.ts`](../medusa-agency-boilerplate/src/api/admin/delivery/shipping-options/sync/route.ts) | future-tranche | New shipping option sync endpoint; higher-risk activation-adjacent surface. |
| ?? | [`medusa-agency-boilerplate/src/api/store/delivery/catalog/route.ts`](../medusa-agency-boilerplate/src/api/store/delivery/catalog/route.ts) | future-tranche | New store delivery catalog endpoint; backend store API surface. |
| ?? | [`medusa-agency-boilerplate/src/api/store/delivery/settings/route.ts`](../medusa-agency-boilerplate/src/api/store/delivery/settings/route.ts) | future-tranche | New store delivery settings endpoint; backend store API surface. |
| ?? | [`medusa-agency-boilerplate/src/modules/delivery-hub/fulfillment-provider-bridge.ts`](../medusa-agency-boilerplate/src/modules/delivery-hub/fulfillment-provider-bridge.ts) | future-tranche | New fulfillment provider bridge; activation-adjacent, review separately. |
| ?? | [`medusa-agency-boilerplate/src/modules/delivery-hub/provider-surface.ts`](../medusa-agency-boilerplate/src/modules/delivery-hub/provider-surface.ts) | future-tranche | New provider surface; delivery-hub module tranche candidate. |
| ?? | [`medusa-agency-boilerplate/src/modules/delivery-hub/shipment-execution-contract.ts`](../medusa-agency-boilerplate/src/modules/delivery-hub/shipment-execution-contract.ts) | future-tranche | New shipment execution contract; controlled execution tranche candidate. |
| ?? | [`medusa-agency-boilerplate/src/modules/delivery-hub/shipping-option-contract.ts`](../medusa-agency-boilerplate/src/modules/delivery-hub/shipping-option-contract.ts) | future-tranche | New shipping option contract; review with shipping option tranche. |
| ?? | [`medusa-agency-boilerplate/src/modules/delivery-hub/shipping-option-manual-sync-audit.ts`](../medusa-agency-boilerplate/src/modules/delivery-hub/shipping-option-manual-sync-audit.ts) | future-tranche | New manual sync audit support; review with shipping option tranche. |
| ?? | [`medusa-agency-boilerplate/src/modules/delivery-hub/shipping-option-manual-sync.ts`](../medusa-agency-boilerplate/src/modules/delivery-hub/shipping-option-manual-sync.ts) | future-tranche | New manual sync support; activation-adjacent and not current scope. |
| ?? | [`medusa-agency-boilerplate/src/modules/delivery-hub/shipping-option-medusa-mutation-port.ts`](../medusa-agency-boilerplate/src/modules/delivery-hub/shipping-option-medusa-mutation-port.ts) | future-tranche | New mutation port; must be isolated before any activation review. |
| ?? | [`medusa-agency-boilerplate/src/modules/delivery-hub/shipping-option-planner.ts`](../medusa-agency-boilerplate/src/modules/delivery-hub/shipping-option-planner.ts) | future-tranche | New shipping option planner; review with planning tranche. |
| ?? | [`medusa-agency-boilerplate/src/modules/delivery-hub/shipping-option-reconciliation.ts`](../medusa-agency-boilerplate/src/modules/delivery-hub/shipping-option-reconciliation.ts) | future-tranche | New reconciliation support; review with shipping option tranche. |
| ?? | [`medusa-agency-boilerplate/src/modules/delivery-hub/shipping-option-sync-executor.ts`](../medusa-agency-boilerplate/src/modules/delivery-hub/shipping-option-sync-executor.ts) | future-tranche | New sync executor; activation-adjacent and not current scope. |
| ?? | [`medusa-agency-boilerplate/src/modules/delivery-hub/shipping-option-sync-operation-plan.ts`](../medusa-agency-boilerplate/src/modules/delivery-hub/shipping-option-sync-operation-plan.ts) | future-tranche | New operation plan model; review with shipping option tranche. |
| ?? | [`medusa-agency-boilerplate/src/modules/delivery-hub/storage/execution-ledger-local-offline-validator-scaffold.ts`](../medusa-agency-boilerplate/src/modules/delivery-hub/storage/execution-ledger-local-offline-validator-scaffold.ts) | future-tranche | New ledger validator scaffold; persistence/readiness surface. |
| ?? | [`medusa-agency-boilerplate/src/modules/delivery-hub/storage/execution-ledger-pg-migration-artifact.ts`](../medusa-agency-boilerplate/src/modules/delivery-hub/storage/execution-ledger-pg-migration-artifact.ts) | future-tranche | New migration artifact descriptor; must remain non-applied until reviewed. |
| ?? | [`medusa-agency-boilerplate/src/modules/delivery-hub/storage/execution-ledger-pg-repository.ts`](../medusa-agency-boilerplate/src/modules/delivery-hub/storage/execution-ledger-pg-repository.ts) | future-tranche | New ledger repository; persistence tranche candidate. |
| ?? | [`medusa-agency-boilerplate/src/modules/delivery-hub/storage/execution-ledger-query-plan-scaffold.ts`](../medusa-agency-boilerplate/src/modules/delivery-hub/storage/execution-ledger-query-plan-scaffold.ts) | future-tranche | New query-plan scaffold; persistence/readiness surface. |
| ?? | [`medusa-agency-boilerplate/src/modules/delivery-hub/storage/execution-ledger-repository.ts`](../medusa-agency-boilerplate/src/modules/delivery-hub/storage/execution-ledger-repository.ts) | future-tranche | New ledger repository contract; persistence tranche candidate. |
| ?? | [`medusa-agency-boilerplate/src/modules/delivery-hub/storage/execution-ledger-schema-check-plan-scaffold.ts`](../medusa-agency-boilerplate/src/modules/delivery-hub/storage/execution-ledger-schema-check-plan-scaffold.ts) | future-tranche | New schema check plan scaffold; persistence/readiness surface. |
| ?? | [`medusa-agency-boilerplate/src/modules/delivery-hub/storage/execution-ledger-schema-verification-scaffold.ts`](../medusa-agency-boilerplate/src/modules/delivery-hub/storage/execution-ledger-schema-verification-scaffold.ts) | future-tranche | New schema verification scaffold; persistence/readiness surface. |
| ?? | [`medusa-agency-boilerplate/src/modules/delivery-hub/storage/execution-ledger-storage-adapter-scaffold.ts`](../medusa-agency-boilerplate/src/modules/delivery-hub/storage/execution-ledger-storage-adapter-scaffold.ts) | future-tranche | New storage adapter scaffold; persistence/readiness surface. |
| ?? | [`medusa-agency-boilerplate/src/modules/delivery-hub/storage/execution-ledger-storage-descriptor-scaffold.ts`](../medusa-agency-boilerplate/src/modules/delivery-hub/storage/execution-ledger-storage-descriptor-scaffold.ts) | future-tranche | New storage descriptor scaffold; persistence/readiness surface. |
| ?? | [`medusa-agency-boilerplate/src/modules/delivery-hub/storage/execution-ledger-transaction-plan-scaffold.ts`](../medusa-agency-boilerplate/src/modules/delivery-hub/storage/execution-ledger-transaction-plan-scaffold.ts) | future-tranche | New transaction plan scaffold; explicitly not activation/runtime scope. |
| ?? | [`medusa-agency-boilerplate/src/scripts/validate-delivery-hub-execution-ledger-snapshot.ts`](../medusa-agency-boilerplate/src/scripts/validate-delivery-hub-execution-ledger-snapshot.ts) | future-tranche | New validation script; evidence/snapshot tranche candidate. |
| ?? | [`medusa-agency-boilerplate/src/workflows/__tests__/delivery-hub-admin-page.unit.spec.ts`](../medusa-agency-boilerplate/src/workflows/__tests__/delivery-hub-admin-page.unit.spec.ts) | future-tranche | New admin page test; review with admin UI tranche. |
| ?? | [`medusa-agency-boilerplate/src/workflows/__tests__/delivery-hub-controlled-execution-contract.unit.spec.ts`](../medusa-agency-boilerplate/src/workflows/__tests__/delivery-hub-controlled-execution-contract.unit.spec.ts) | future-tranche | New controlled execution contract test; review with contract tranche. |
| ?? | [`medusa-agency-boilerplate/src/workflows/__tests__/delivery-hub-execution-ledger-local-offline-validator.unit.spec.ts`](../medusa-agency-boilerplate/src/workflows/__tests__/delivery-hub-execution-ledger-local-offline-validator.unit.spec.ts) | future-tranche | New ledger validator test; persistence/readiness review candidate. |
| ?? | [`medusa-agency-boilerplate/src/workflows/__tests__/delivery-hub-execution-ledger-repository.unit.spec.ts`](../medusa-agency-boilerplate/src/workflows/__tests__/delivery-hub-execution-ledger-repository.unit.spec.ts) | future-tranche | New ledger repository test; persistence review candidate. |
| ?? | [`medusa-agency-boilerplate/src/workflows/__tests__/delivery-hub-execution-ledger-schema-check-plan.unit.spec.ts`](../medusa-agency-boilerplate/src/workflows/__tests__/delivery-hub-execution-ledger-schema-check-plan.unit.spec.ts) | future-tranche | New schema check test; persistence/readiness candidate. |
| ?? | [`medusa-agency-boilerplate/src/workflows/__tests__/delivery-hub-execution-ledger-schema-verification.unit.spec.ts`](../medusa-agency-boilerplate/src/workflows/__tests__/delivery-hub-execution-ledger-schema-verification.unit.spec.ts) | future-tranche | New schema verification test; persistence/readiness candidate. |
| ?? | [`medusa-agency-boilerplate/src/workflows/__tests__/delivery-hub-fulfillment-provider-bridge.unit.spec.ts`](../medusa-agency-boilerplate/src/workflows/__tests__/delivery-hub-fulfillment-provider-bridge.unit.spec.ts) | future-tranche | New fulfillment bridge test; activation-adjacent review candidate. |
| ?? | [`medusa-agency-boilerplate/src/workflows/__tests__/delivery-hub-manual-sync-audit.unit.spec.ts`](../medusa-agency-boilerplate/src/workflows/__tests__/delivery-hub-manual-sync-audit.unit.spec.ts) | future-tranche | New manual sync audit test; review with shipping option tranche. |
| ?? | [`medusa-agency-boilerplate/src/workflows/__tests__/delivery-hub-provider-validation.unit.spec.ts`](../medusa-agency-boilerplate/src/workflows/__tests__/delivery-hub-provider-validation.unit.spec.ts) | future-tranche | New provider validation test; provider surface candidate. |
| ?? | [`medusa-agency-boilerplate/src/workflows/__tests__/delivery-hub-tranche1-coverage.unit.spec.ts`](../medusa-agency-boilerplate/src/workflows/__tests__/delivery-hub-tranche1-coverage.unit.spec.ts) | future-tranche | New tranche coverage test; review only when tranche scope is opened. |

## Bucket B — protected invariant surfaces

These paths are not the current feature-review target. They are present to verify guardrails or repository-level invariants only.

| Status | Path | Action | Reason |
|---|---|---|---|
| M | [`.env.example`](../.env.example) | reference-only | Environment contract surface; avoid approving runtime/config activation from this manifest. |
| M | [`.gitignore`](../.gitignore) | reference-only | Git hygiene surface; manifest does not approve ignore-rule changes or cleanup. |
| M | [`package.json`](../package.json) | reference-only | Root package/tooling surface; not part of process-artifact review. |
| M | [`medusa-agency-boilerplate/medusa-config.ts`](../medusa-agency-boilerplate/medusa-config.ts) | reference-only | Backend runtime configuration; protected against accidental activation claims. |
| M | [`medusa-agency-boilerplate/package.json`](../medusa-agency-boilerplate/package.json) | reference-only | Backend package/tooling surface; not current review target. |
| M | [`medusa-agency-boilerplate/src/api/middlewares.ts`](../medusa-agency-boilerplate/src/api/middlewares.ts) | reference-only | Request pipeline/middleware surface; protected invariant unless explicitly scoped. |
| M | [`medusa-agency-boilerplate/src/scripts/README.md`](../medusa-agency-boilerplate/src/scripts/README.md) | reference-only | Script documentation; operational guardrail surface. |
| M | [`medusa-agency-boilerplate/src/scripts/create-secret-admin-api-key.ts`](../medusa-agency-boilerplate/src/scripts/create-secret-admin-api-key.ts) | reference-only | Admin key script; security/ops surface, not current scope. |
| M | [`medusa-agency-boilerplate/src/scripts/seed.ts`](../medusa-agency-boilerplate/src/scripts/seed.ts) | reference-only | Seeding/runtime data surface; protected from accidental review approval. |
| M | [`scripts/lib/common.sh`](../scripts/lib/common.sh) | reference-only | Shared shell helper; operational surface outside delivery-hub source review. |
| M | [`scripts/notification-smoke.sh`](../scripts/notification-smoke.sh) | reference-only | Smoke script; not current review target. |
| M | [`scripts/smoke-storefront.sh`](../scripts/smoke-storefront.sh) | reference-only | Storefront smoke script; cross-surface operational helper. |
| ?? | [`.github/workflows/integrity-baseline.yml`](../.github/workflows/integrity-baseline.yml) | reference-only | CI/integrity workflow; protected repository guardrail surface. |
| ?? | [`medusa-agency-boilerplate/src/modules/deliveryhub.ts`](../medusa-agency-boilerplate/src/modules/deliveryhub.ts) | reference-only | Contains [`createFulfillment()`](../medusa-agency-boilerplate/src/modules/deliveryhub.ts:119) hard-block guardrail; invariant-only. |
| ?? | [`medusa-agency-boilerplate/src/modules/delivery-hub/storage/execution-ledger-repository-assembly-scaffold.ts`](../medusa-agency-boilerplate/src/modules/delivery-hub/storage/execution-ledger-repository-assembly-scaffold.ts) | reference-only | Contains readiness contour guardrail; invariant-only. |
| ?? | [`openapi_auth.yaml`](../openapi_auth.yaml) | reference-only | API/auth contract surface; not current delivery-hub review target. |
| ?? | [`scripts/browser-smoke.sh`](../scripts/browser-smoke.sh) | reference-only | Browser smoke helper; operational surface. |
| ?? | [`scripts/staging-verification.sh`](../scripts/staging-verification.sh) | reference-only | Staging verification helper; operational surface, no staging cutover claim. |

## Bucket C — legacy provider noise / non-current work

These paths are acknowledged dirty-tree inventory but excluded from the current delivery-hub review surface unless imported by included paths.

| Status | Path | Action | Reason |
|---|---|---|---|
| M | [`medusa-agency-boilerplate/src/api/store/delivery/rates/route.ts`](../medusa-agency-boilerplate/src/api/store/delivery/rates/route.ts) | exclude | Legacy store rates endpoint; non-current work/noise for delivery-hub review. |
| M | medusa-agency-boilerplate/the removed backend legacy provider module | reference-only | Legacy provider must remain present; not removed or cleaned here. |
| ?? | medusa-agency-boilerplate/src/admin/routes/settings/legacy provider/page.tsx | exclude | Legacy provider admin UI; non-current work/noise. |
| ?? | [`medusa-agency-boilerplate/src/api/admin/delivery/settings/route.ts`](../medusa-agency-boilerplate/src/api/admin/delivery/settings/route.ts) | exclude | Legacy provider admin settings endpoint; non-current work/noise. |
| ?? | [`medusa-agency-boilerplate/src/api/store/delivery/points/route.ts`](../medusa-agency-boilerplate/src/api/store/delivery/points/route.ts) | exclude | Legacy store points endpoint; non-current work/noise. |
| ?? | [`medusa-agency-boilerplate/src/api/store/delivery/settings/route.ts`](../medusa-agency-boilerplate/src/api/store/delivery/settings/route.ts) | exclude | Legacy store settings endpoint; non-current work/noise. |
| ?? | removed backend legacy rates module | exclude | Legacy rates module; not current delivery-hub surface. |
| ?? | removed backend legacy settings module | exclude | Legacy settings module; not current delivery-hub surface. |
| ?? | removed backend legacy shipping-options module | exclude | Legacy shipping options module; not current delivery-hub surface. |
| ?? | removed backend legacy store module | exclude | Legacy store module; not current delivery-hub surface. |
| ?? | medusa-agency-boilerplate/src/workflows/__tests__/legacy provider-settings.unit.spec.ts | exclude | Legacy settings test; non-current work/noise. |

## Bucket D — sibling storefront / cross-repo surface

Sibling repo check found no `../medusa-agency-boilerplate-storefront/.git`. The following storefront-looking paths are dirty inside this workspace and should not be reviewed as backend delivery-hub work.

| Status | Path | Action | Reason |
|---|---|---|---|
| M | [`medusa-agency-boilerplate-storefront/next.config.js`](../medusa-agency-boilerplate-storefront/next.config.js) | reference-only | Storefront config surface; cross-repo/cutover-sensitive. |
| M | [`medusa-agency-boilerplate-storefront/package.json`](../medusa-agency-boilerplate-storefront/package.json) | reference-only | Storefront package surface; not backend delivery-hub review. |
| M | removed storefront legacy delivery helper | exclude | Storefront legacy provider data surface; cross-repo and non-current. |
| M | [`medusa-agency-boilerplate-storefront/src/lib/util/compare-addresses.ts`](../medusa-agency-boilerplate-storefront/src/lib/util/compare-addresses.ts) | exclude | Storefront utility change; cross-repo surface. |
| M | [`medusa-agency-boilerplate-storefront/src/modules/checkout/components/address-select/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/checkout/components/address-select/index.tsx) | exclude | Storefront checkout UI; no cutover claim. |
| M | [`medusa-agency-boilerplate-storefront/src/modules/checkout/components/payment-button/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/checkout/components/payment-button/index.tsx) | exclude | Storefront checkout payment UI; cross-repo surface. |
| M | [`medusa-agency-boilerplate-storefront/src/modules/checkout/components/shipping-address/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/checkout/components/shipping-address/index.tsx) | exclude | Storefront checkout shipping UI; no cutover claim. |
| M | [`medusa-agency-boilerplate-storefront/tsconfig.json`](../medusa-agency-boilerplate-storefront/tsconfig.json) | reference-only | Storefront TypeScript config; cross-repo/tooling surface. |
| ?? | [`medusa-agency-boilerplate-storefront/src/lib/data/delivery-hub.ts`](../medusa-agency-boilerplate-storefront/src/lib/data/delivery-hub.ts) | exclude | New storefront delivery-hub data client; no storefront cutover review in this tranche. |
| ?? | [`medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub-preview.ts`](../medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub-preview.ts) | exclude | New storefront preview utility; cross-repo surface. |
| ?? | [`medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub.spec.ts`](../medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub.spec.ts) | exclude | New storefront utility test; cross-repo surface. |
| ?? | [`medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub.ts`](../medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub.ts) | exclude | New storefront delivery-hub utility; no cutover claim. |

## Bucket E — docs/status/planning artifacts

These paths are documentation, evidence, planning, or captured review artifacts. They can be used as reference for planning review, but they do not expand source-code review scope.

| Status | Path | Action | Reason |
|---|---|---|---|
| M | [`Docs/current_work.md`](../Docs/current_work.md) | reference-only | Status artifact; explicitly not edited in this step. |
| M | [`Docs/delivery_hub_spec.md`](../Docs/delivery_hub_spec.md) | reference-only | Delivery-hub spec; context for scoping only. |
| M | [`Docs/env_contract.md`](../Docs/env_contract.md) | reference-only | Environment contract documentation; not current edit scope. |
| M | [`Docs/master_repo_plan_v2.md`](../Docs/master_repo_plan_v2.md) | reference-only | Planning document; use as context only. |
| M | [`Docs/plan_analysis.md`](../Docs/plan_analysis.md) | reference-only | Planning analysis; use as context only. |
| M | [`Docs/template_readiness_regression.md`](../Docs/template_readiness_regression.md) | reference-only | Template/readiness documentation; not current edit scope. |
| M | [`Docs/template_release_handoff.md`](../Docs/template_release_handoff.md) | reference-only | Release handoff template; not current edit scope. |
| ?? | obsolete historical delivery test-data document | reference-only | Legacy provider documentation/evidence; not current delivery-hub review. |
| ?? | [`Docs/delivery_hub_agent_prompt.md`](../Docs/delivery_hub_agent_prompt.md) | reference-only | Delivery-hub prompt/planning artifact. |
| ?? | [`Docs/delivery_hub_execution_ledger_evidence_bundle_packaging_convention.md`](../Docs/delivery_hub_execution_ledger_evidence_bundle_packaging_convention.md) | reference-only | Evidence packaging convention; planning/evidence context. |
| ?? | [`Docs/delivery_hub_execution_ledger_evidence_submission_checklist.md`](../Docs/delivery_hub_execution_ledger_evidence_submission_checklist.md) | reference-only | Evidence submission checklist; planning/evidence context. |
| ?? | [`Docs/delivery_hub_execution_ledger_manual_evidence_template.md`](../Docs/delivery_hub_execution_ledger_manual_evidence_template.md) | reference-only | Manual evidence template; planning/evidence context. |
| ?? | [`Docs/delivery_hub_execution_ledger_manual_runbook.md`](../Docs/delivery_hub_execution_ledger_manual_runbook.md) | reference-only | Manual runbook; planning/evidence context. |
| ?? | [`Docs/delivery_hub_execution_ledger_operator_reviewer_quickstart.md`](../Docs/delivery_hub_execution_ledger_operator_reviewer_quickstart.md) | reference-only | Operator/reviewer quickstart; planning/evidence context. |
| ?? | [`Docs/delivery_hub_execution_ledger_release_handoff_index.md`](../Docs/delivery_hub_execution_ledger_release_handoff_index.md) | reference-only | Release handoff index; planning/evidence context. |
| ?? | [`Docs/delivery_hub_execution_ledger_snapshot_fixture_contract.md`](../Docs/delivery_hub_execution_ledger_snapshot_fixture_contract.md) | reference-only | Snapshot fixture contract; evidence context. |
| ?? | [`Docs/staging_backup_restore_runbook.md`](../Docs/staging_backup_restore_runbook.md) | reference-only | Staging runbook; no staging cutover claim. |
| ?? | [`Docs/staging_checklist.md`](../Docs/staging_checklist.md) | reference-only | Staging checklist; no staging cutover claim. |
| ?? | [`Docs/staging_deploy_path.md`](../Docs/staging_deploy_path.md) | reference-only | Staging deploy path; no deployment claim. |
| ?? | [`Docs/staging_monitoring_baseline.md`](../Docs/staging_monitoring_baseline.md) | reference-only | Staging monitoring baseline; no staging activation claim. |
| ?? | [`Docs/staging_rollback_runbook.md`](../Docs/staging_rollback_runbook.md) | reference-only | Staging rollback runbook; no destructive operation claim. |
| ?? | [`Docs/staging_verification_contour.md`](../Docs/staging_verification_contour.md) | reference-only | Staging verification contour; no staging cutover claim. |
| ?? | [`plans/delivery-hub-next-tranche-plan.md`](delivery-hub-next-tranche-plan.md) | reference-only | Existing next-tranche plan; context only. |
| ?? | [`plans/delivery_hub_execution_ledger_evidence_bundle_packaging_convention_tranche.md`](delivery_hub_execution_ledger_evidence_bundle_packaging_convention_tranche.md) | reference-only | Existing tranche plan artifact; context only. |
| ?? | [`plans/delivery-hub-review-surface-manifest.md`](delivery-hub-review-surface-manifest.md) | include | This manifest; the only in-scope edit for this cleanup/isolation inventory tranche. |
| ?? | [`playwright-admin-login-snapshot.md`](../playwright-admin-login-snapshot.md) | reference-only | Captured browser snapshot; evidence/noise outside source review. |
| ?? | [`playwright-admin-orders-snapshot.md`](../playwright-admin-orders-snapshot.md) | reference-only | Captured browser snapshot; evidence/noise outside source review. |
| ?? | obsolete historical browser snapshot | reference-only | Captured legacy provider browser snapshot; evidence/noise. |
| ?? | obsolete historical browser snapshot | reference-only | Captured legacy provider browser snapshot; evidence/noise. |
| ?? | obsolete historical browser snapshot | reference-only | Captured legacy provider browser snapshot; evidence/noise. |
| ?? | [`playwright-cart-snapshot.md`](../playwright-cart-snapshot.md) | reference-only | Captured storefront/browser snapshot; evidence/noise. |
| ?? | [`playwright-checkout-address-snapshot.md`](../playwright-checkout-address-snapshot.md) | reference-only | Captured checkout snapshot; evidence/noise. |
| ?? | [`playwright-checkout-after-door-commit.md`](../playwright-checkout-after-door-commit.md) | reference-only | Captured checkout snapshot; evidence/noise. |
| ?? | [`playwright-checkout-delivery-after-debug.md`](../playwright-checkout-delivery-after-debug.md) | reference-only | Captured checkout delivery snapshot; evidence/noise. |
| ?? | [`playwright-checkout-delivery-snapshot.md`](../playwright-checkout-delivery-snapshot.md) | reference-only | Captured checkout delivery snapshot; evidence/noise. |
| ?? | [`playwright-checkout-door-expanded.md`](../playwright-checkout-door-expanded.md) | reference-only | Captured checkout snapshot; evidence/noise. |
| ?? | [`playwright-home-snapshot.md`](../playwright-home-snapshot.md) | reference-only | Captured storefront/browser snapshot; evidence/noise. |
| ?? | [`playwright-network-checkout.txt`](../playwright-network-checkout.txt) | reference-only | Captured network evidence; no source review scope. |
| ?? | [`playwright-product-deep-snapshot.md`](../playwright-product-deep-snapshot.md) | reference-only | Captured storefront/browser snapshot; evidence/noise. |
| ?? | [`playwright-product-snapshot.md`](../playwright-product-snapshot.md) | reference-only | Captured storefront/browser snapshot; evidence/noise. |
| ?? | [`playwright-store-snapshot.md`](../playwright-store-snapshot.md) | reference-only | Captured storefront/browser snapshot; evidence/noise. |

## Current included review surface

For this cleanup/isolation tranche, the only included path is:

- [`plans/delivery-hub-review-surface-manifest.md`](delivery-hub-review-surface-manifest.md)

All backend delivery-hub implementation paths are marked `future-tranche`, not `include`, because this step is inventory/quarantine only and must not evaluate or alter feature behavior.
