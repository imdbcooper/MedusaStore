# Current Work

> Status updated: `2026-05-01`.
>
> Purpose: this is the short operational source of truth for agents entering the repository with no context. It answers what is current, what is already closed, and what must not be reopened without new evidence.

---

## Current Focus

The active work before starting Delivery Hub Phase 8 is documentation cleanup:

- remove completed one-off phase prompts and duplicated status text;
- keep canonical Delivery Hub docs professional and navigable;
- mark old cutover/evidence material as historical or evidence-only where it is not the current shopper/admin flow;
- update `.codex/skills/medusa-master-repo/SKILL.md` so future agents start from the cleaned source-of-truth set.

Do not start Phase 8 implementation until this documentation cleanup is committed or explicitly skipped by the operator.

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

Latest Delivery Hub commits:

- `fbf7a6d feat(delivery-hub): harden gated shipment execution`
- `aedaa6f test(delivery-hub): restore browser smoke coverage`

Current verification status:

- `npm run smoke:delivery-hub-cutover:browser` PASS
- `npm run smoke:delivery-hub-rollback:browser` PASS
- `npm run typecheck` PASS
- `git diff --check` PASS

The browser-smoke gap around hidden diagnostics and `innerText` is closed. The smoke harness now uses the current shopper-default `warehouse_to_pickup_point` mock contract, observes hidden diagnostic markers via `textContent`, and verifies the buyer-facing save path plus one-key Medusa shipping-method commit payload.

---

## Next Delivery Hub Step

After this documentation cleanup, the next implementation tranche is Phase 8:

**Remove or quarantine obsolete legacy/cutover surfaces.**

Phase 8 should:

- remove shopper-visible preview/cutover language;
- keep diagnostics only behind dev/admin flags or clearly advanced/admin-only surfaces;
- mark old cutover/evidence docs as historical where they no longer describe the active product flow;
- remove old provider-specific checkout paths if any active paths remain;
- preserve old-order compatibility only where historical orders require it.

Phase 8 must not:

- enable production/staging GO automatically;
- enable `DELIVERY_HUB_SHIPMENT_EXECUTION_ENABLED=true` by default;
- add live provider/Yandex calls;
- expose raw provider payloads, tokens, auth headers, ciphertext, quote keys, offer ids, execution references, or secrets;
- reintroduce a legacy delivery fallback as an active checkout path.

---

## Canonical Documentation Map

Use these documents in this order:

1. [current_work.md](./current_work.md) - operational status and next action.
2. [delivery_hub_documentation_index.md](./delivery_hub_documentation_index.md) - Delivery Hub documentation roles and historical/evidence classification.
3. [delivery_hub_rework_plan.md](./delivery_hub_rework_plan.md) - accepted Delivery Hub phase plan.
4. [delivery_hub_spec.md](./delivery_hub_spec.md) - detailed architecture/reference material; older preview/cutover sections should be treated as historical unless the cleaned docs say otherwise.
5. [master_repo_plan_v2.md](./master_repo_plan_v2.md) - overall repository roadmap.
6. [plan_analysis.md](./plan_analysis.md) - factual audit and historical reality check.
7. [env_contract.md](./env_contract.md) - environment/startup contract.

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
