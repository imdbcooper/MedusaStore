# Delivery Hub Physical Cleanup Manifest

> Status: completed after ApiShip admin/operator diagnostics follow-up.
>
> Scope: source-tree cleanup only. No browser/runtime smoke, database cleanup, staging cleanup, or destructive local residue cleanup was performed.

## Strategy

Delivery Hub was already quarantined by `medusa-agency-boilerplate/src/modules/delivery-hub-runtime-quarantine.ts`, with legacy Store/Admin Delivery Hub routes returning HTTP `410` through middleware. This cleanup removes the inactive committed runtime/provider residue while retaining the quarantine module, middleware behavior, and historical documentation/evidence.

Because the working tree contained unrelated modified and untracked Delivery Hub files, this cleanup was prepared from committed `HEAD` in an isolated index. Modified/untracked local files were left untouched in the working tree and are not part of the cleanup commit unless explicitly listed here as committed baseline removals.

## Removed from the committed baseline

- Delivery Hub Medusa fulfillment provider registration source: `medusa-agency-boilerplate/src/modules/deliveryhub.ts`.
- Delivery Hub backend module implementation tree: `medusa-agency-boilerplate/src/modules/delivery-hub/**`.
- Active Delivery Hub Store API route files under `medusa-agency-boilerplate/src/api/store/delivery/**`.
- Active Delivery Hub Admin API route files under `medusa-agency-boilerplate/src/api/admin/delivery/**`.
- Legacy order Delivery Hub Admin route files under `medusa-agency-boilerplate/src/api/admin/orders/[id]/delivery-hub/**`.
- Delivery Hub Admin UI page/widget files under `medusa-agency-boilerplate/src/admin/routes/settings/delivery/**` and `medusa-agency-boilerplate/src/admin/widgets/order-delivery-hub*`.
- Delivery Hub storefront helper/test files under `medusa-agency-boilerplate-storefront/src/lib/data/delivery-hub.ts` and `medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub*`.
- Delivery Hub operator/local scripts under `medusa-agency-boilerplate/src/scripts/delivery-hub-*` and `medusa-agency-boilerplate/src/scripts/validate-delivery-hub-execution-ledger-snapshot.ts`.
- Root Delivery Hub browser/evidence scripts under `scripts/delivery-hub-*.mjs`.
- Delivery Hub smoke/evidence package scripts and backend `delivery:store-smoke` package script.
- Obsolete Delivery Hub backend unit tests, except the runtime-quarantine test.

## Retained intentionally

- `medusa-agency-boilerplate/src/modules/delivery-hub-runtime-quarantine.ts`: required to return HTTP `410` for legacy paths.
- Middleware wiring for legacy `/store/delivery/*` and `/admin/orders/:id/delivery-hub*` quarantine paths.
- `medusa-agency-boilerplate/src/workflows/__tests__/delivery-hub-runtime-quarantine.unit.spec.ts`: targeted quarantine unit coverage.
- Historical Delivery Hub docs/evidence and ApiShip migration inventory docs: retained as previous-baseline evidence.
- Untracked/unstaged local Delivery Hub files and unrelated working tree changes: left untouched.

## Current active delivery baseline

The active committed delivery baseline is ApiShip/Gorgo. Delivery Hub is retained only as previous-baseline historical context plus runtime quarantine behavior for legacy paths.
