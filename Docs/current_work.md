# Current Work

> Status updated: `2026-05-04`.
>
> Purpose: this is the short operational source of truth for agents entering the repository with no context. It answers what is current, what is already closed, and what must not be reopened without new evidence.

---

## Current Focus

The active delivery planning focus is the documented pre-production baseline pivot from Delivery Hub to ApiShip/Gorgo. The accepted migration decision is [apiship_direct_migration_plan.md](./apiship_direct_migration_plan.md).

Phase 5 is fixed as Variant A: the storefront should cut over directly to plugin-specific `/store/apiship/*` endpoints and should not keep `/store/delivery/*` as a facade in the first ApiShip baseline.

Do not implement runtime migration work from this note alone; use the dedicated plan as the source of truth for the future implementation breakdown.

---

## Repository Baseline

The repository remains a Russian-market Medusa template:

- canonical local path: `cp .env.example .env` -> `npm run bootstrap` -> `npm run preflight` -> `npm run dev`;
- baseline region/currency: `ru` / `rub`;
- notification baseline: local provider by default, UniSender and VK messaging are opt-in integration paths;
- payment baseline: YooKassa-first for the current Russian-market scope;
- storefront customization baseline: preset-driven storefront stack is closed and should not be reopened without regression evidence;
- delivery baseline target: ApiShip/Gorgo via `@gorgo/medusa-fulfillment-apiship`; Delivery Hub is no longer the target baseline for fresh templates.

Historical legacy delivery rows/provider ids may still exist in old local/staging databases. Treat them as database residue that needs separate operator-approved cleanup, not as active template behavior.

---

## ApiShip/Gorgo Direct Migration Status

The accepted pre-production baseline pivot is [apiship_direct_migration_plan.md](./apiship_direct_migration_plan.md).

Post-Phase 10 baseline smoke evidence is [apiship_baseline_smoke_evidence.md](./apiship_baseline_smoke_evidence.md). It uses a deterministic backend unit smoke for the current ApiShip baseline and does not require live ApiShip credentials, external ApiShip calls, running browser services, or live shipment execution.

Phase 0 freeze is recorded: this repository has not started ApiShip runtime migration work in this phase, and the baseline decision should not be reopened during Phase 1 inventory.

Key fixed decisions:

- Delivery Hub is no longer the baseline delivery contour; the new target baseline is `@gorgo/medusa-fulfillment-apiship`.
- This is a pre-production migration, so there is no requirement to preserve backward compatibility for old Delivery Hub carts/orders.
- Phase 5 selects Variant A: storefront uses `/store/apiship/*` directly, commits the standard Medusa cart shipping method with `apishipData`, and does not preserve `/store/delivery/*` as a first-version facade.
- Initial customer-facing price is the ApiShip tariff unless a separate pricing-policy requirement is added.
- Initial baseline is PVZ/pickup-point; courier can be added later.
- Delivery Hub should be deactivated from the baseline before physical cleanup, and cleanup should wait for successful ApiShip smoke evidence.
- Frontend checkout gating is acceptable for the first cutover; backend guard/readiness wrapper is later boilerplate-grade hardening.

Phase 0 acceptance for later phases:

- The direct migration plan is linked from this current-work map.
- Delivery Hub is frozen as the previous baseline, not the fresh-template target baseline.
- `@gorgo/medusa-fulfillment-apiship` is frozen as the new target baseline.
- The migration is pre-production and does not require backward compatibility for old Delivery Hub carts/orders.
- Future checkout API shape is Phase 5 Variant A: direct `/store/apiship/*`, no first-version `/store/delivery/*` facade, and standard Medusa shipping-method commit with `apishipData`.
- Phase 0 is documentation/status only; runtime source, package manifests, and environment files are out of scope for this phase.

---

## Delivery Hub Status

Delivery Hub rework is now historical baseline context. The previous accepted plan is [delivery_hub_rework_plan.md](./delivery_hub_rework_plan.md).

Closed implementation phases:

| Phase | Status | Result |
| --- | --- | --- |
| 0/1 | Closed | Docs reconciled; customer-facing delivery price separated from provider operational quote; backend/admin settings own checkout origin resolution. |
| 2 | Closed | Checkout quote orchestration moved to backend; shopper response uses neutral/customer-price contract. |
| 3 | Closed | Shopper PVZ UX productized; buyer-facing payload boundaries hardened against provider/internal leakage. |
| 4 | Closed | Delivery Hub selection can commit the matching Medusa shipping method under explicit readiness rules; payment is blocked when delivery is not ready. |
| 5 | Closed | `Settings -> Delivery` is merchant-facing; diagnostics are secondary/advanced. |
| 6 | Closed | Order admin Delivery Hub widget/read model exists; operators no longer paste `execution_reference` for normal order processing. |
| 7 | Closed | Direct Yandex shipment execution is hardened behind `DELIVERY_HUB_SHIPMENT_EXECUTION_ENABLED=false` by default, with durable reservation/idempotency and safe admin actions. |
| 8 | Accepted, follow-up tracked | Shopper checkout no longer depends on preview/shadow/cutover diagnostic vocabulary; diagnostics are collapsed behind dev/admin flags; browser smoke now follows product-flow hooks. |

Latest Delivery Hub commits before Phase 8:

- `fbf7a6d feat(delivery-hub): harden gated shipment execution`
- `aedaa6f test(delivery-hub): restore browser smoke coverage`
- `15a8a89 docs(delivery-hub): consolidate pre phase eight status`

Phase 8 verification:

- `npm run smoke:delivery-hub-cutover:browser` PASS
- `npm run smoke:delivery-hub-rollback:browser` PASS
- `npm run typecheck` PASS
- `git diff --check` PASS
- `node --test src/lib/util/delivery-hub.spec.ts` PASS (`146/146`)

Phase 8 diagnostic-fetch isolation follow-up verification:

- `git diff --check` PASS
- `npm run typecheck` PASS
- `node --test src/lib/util/delivery-hub.spec.ts` PASS (`147/147`)
- `npm run smoke:delivery-hub-cutover:browser` PASS
- `npm run smoke:delivery-hub-rollback:browser` PASS

---

## Active Delivery Hub Product Flow

Shopper checkout should be treated as one Delivery Hub delivery flow:

1. quote/PVZ selection;
2. save Delivery Hub delivery method;
3. commit the matched Medusa Delivery Hub shipping option only when readiness allows it;
4. open payment only after delivery is ready.

Shopper-visible checkout must stay free of provider/internal/cutover vocabulary and must not expose raw provider payloads, tokens, auth headers, ciphertext, quote keys, offer ids, execution references, or secrets.

Diagnostics remain available only in collapsed dev/admin/advanced surfaces. Product-flow smoke tests should use buyer-facing hooks, not diagnostic text or DOM labels.

Phase 8 follow-up status:

- Implemented in workspace: advanced diagnostic Store API reads for cutover preconditions, candidate, and approval artifact are removed from the ordinary checkout product-flow effect.
- Diagnostics now load only when `NEXT_PUBLIC_DELIVERY_HUB_PREVIEW_ENABLED=true` and diagnostics state is explicitly requested, such as opening the collapsed diagnostics panel or using diagnostics actions.
- Product-flow browser smoke coverage now asserts the ordinary checkout quote/PVZ/save path does not fetch diagnostic routes while the diagnostics panel remains collapsed, then verifies those routes load after explicit diagnostics open.
- Verification completed in this workspace: `git diff --check`, `npm run typecheck`, `node --test src/lib/util/delivery-hub.spec.ts`, `npm run smoke:delivery-hub-cutover:browser`, and `npm run smoke:delivery-hub-rollback:browser` all pass.

---

## Canonical Documentation Map

Use these documents in this order:

1. [current_work.md](./current_work.md) - operational status and next action.
2. [apiship_direct_migration_plan.md](./apiship_direct_migration_plan.md) - accepted ApiShip/Gorgo direct migration plan and Phase 0 baseline freeze.
3. [apiship_baseline_smoke_evidence.md](./apiship_baseline_smoke_evidence.md) - deterministic ApiShip baseline smoke/evidence runbook without live credentials or external ApiShip calls.
4. [delivery_hub_documentation_index.md](./delivery_hub_documentation_index.md) - Delivery Hub documentation roles and historical/evidence classification.
5. [delivery_hub_rework_plan.md](./delivery_hub_rework_plan.md) - accepted Delivery Hub phase plan.
5. [delivery_hub_spec.md](./delivery_hub_spec.md) - detailed architecture/reference material; older preview/cutover sections should be treated as historical unless the cleaned docs say otherwise.
6. [delivery_hub_manual_testing_plan.md](./delivery_hub_manual_testing_plan.md) - operator validation, including product-flow smokes and advanced diagnostics.
7. [env_contract.md](./env_contract.md) - environment/startup contract.
8. [master_repo_plan_v2.md](./master_repo_plan_v2.md) - overall repository roadmap.
9. [plan_analysis.md](./plan_analysis.md) - factual audit and historical reality check.

Old phase prompt files are not source-of-truth. Completed prompt artifacts should not be used to infer current status.

---

## Working Rules

- Code and verified runtime behavior win over narrative docs.
- Do not mark a phase closed unless its Definition of Done and validation evidence are satisfied.
- Do not copy stale statuses from older docs into new prompts or reports.
- Keep Delivery Hub shopper UI free of provider/internal/cutover vocabulary.
- Keep admin diagnostics available but secondary to merchant/order workflows.
- Keep live shipment execution gated and default-off.
- Keep secrets and raw provider material out of docs, logs, storefront, and admin responses.
