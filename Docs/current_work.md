# Current Work

> Status updated: `2026-05-01`.
>
> Purpose: this is the short operational source of truth for agents entering the repository with no context. It answers what is current, what is already closed, and what must not be reopened without new evidence.

---

## Current Focus

Delivery Hub Phase 8 is accepted; the non-blocking diagnostic-fetch isolation follow-up is implemented and verified in the current workspace.

Phase 8 scope: remove or quarantine obsolete legacy/preview/cutover surfaces so the shopper checkout reads as one normal Delivery Hub delivery flow, while keeping diagnostics available only behind dev/admin/advanced boundaries.

Do not reopen closed phases or old one-off prompt artifacts unless new runtime evidence proves a regression.

---

## Repository Baseline

The repository remains a Russian-market Medusa template:

- canonical local path: `cp .env.example .env` -> `npm run bootstrap` -> `npm run preflight` -> `npm run dev`;
- baseline region/currency: `ru` / `rub`;
- notification baseline: local provider by default, UniSender and VK messaging are opt-in integration paths;
- payment baseline: YooKassa-first for the current Russian-market scope;
- storefront customization baseline: preset-driven storefront stack is closed and should not be reopened without regression evidence;
- delivery baseline: Delivery Hub/direct Yandex is the selected delivery contour for fresh templates.

Historical legacy delivery rows/provider ids may still exist in old local/staging databases. Treat them as database residue that needs separate operator-approved cleanup, not as active template behavior.

---

## Delivery Hub Status

Delivery Hub rework is the current delivery roadmap. The accepted plan is [delivery_hub_rework_plan.md](./delivery_hub_rework_plan.md).

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
2. [delivery_hub_documentation_index.md](./delivery_hub_documentation_index.md) - Delivery Hub documentation roles and historical/evidence classification.
3. [delivery_hub_rework_plan.md](./delivery_hub_rework_plan.md) - accepted Delivery Hub phase plan.
4. [delivery_hub_spec.md](./delivery_hub_spec.md) - detailed architecture/reference material; older preview/cutover sections should be treated as historical unless the cleaned docs say otherwise.
5. [delivery_hub_manual_testing_plan.md](./delivery_hub_manual_testing_plan.md) - operator validation, including product-flow smokes and advanced diagnostics.
6. [env_contract.md](./env_contract.md) - environment/startup contract.
7. [master_repo_plan_v2.md](./master_repo_plan_v2.md) - overall repository roadmap.
8. [plan_analysis.md](./plan_analysis.md) - factual audit and historical reality check.

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
