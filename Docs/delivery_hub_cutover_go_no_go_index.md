# Delivery Hub checkout cutover go/no-go review index

> Operator-facing index for the final Delivery Hub checkout cutover review chain.
>
> Current verdict: **NO-GO for real checkout cutover** until a separate implementation tranche and explicit operator/technical approvals exist.
>
> Scope: navigation, evidence ordering, blocker inventory, rollback/fallback and redaction reminders only. This document does not run or enable runtime cutover.

---

## 1. Current status

| Area | Status |
|---|---|
| Preview/shadow UI | `Preview/shadow ready` |
| Cutover implementation | `Cutover implementation not enabled` |
| Production checkout source-of-truth | `NO-GO for production checkout source-of-truth` |
| Existing checkout source-of-truth | Existing ApiShip/Medusa checkout remains active |
| Commit invariant | `can_commit_shipping_method=false` / `canCommitShippingMethod=false` |
| Approval posture | Evidence and decision artifact are non-executable |

This is the final review index for the current evidence chain. It intentionally stops before any real checkout source-of-truth switch.

---

## 2. Canonical evidence and command links

### Documents

- Cutover readiness plan and approval gate: [`delivery_hub_checkout_cutover_plan.md`](./delivery_hub_checkout_cutover_plan.md)
- Evidence bundle exporter convention: [`delivery_hub_cutover_evidence_bundle.md`](./delivery_hub_cutover_evidence_bundle.md)
- Human decision record template: [`delivery_hub_cutover_decision_record_template.md`](./delivery_hub_cutover_decision_record_template.md)
- Manual/admin/storefront testing plan: [`delivery_hub_manual_testing_plan.md`](./delivery_hub_manual_testing_plan.md)
- Current work/status ledger: [`current_work.md`](./current_work.md)

### Root npm commands

Defined in [`package.json`](../package.json):

- Preview browser smoke: `npm run smoke:delivery-hub-preview:browser`
- Rollback/fallback browser smoke: `npm run smoke:delivery-hub-rollback:browser`
- Evidence bundle check: `npm run evidence:delivery-hub-cutover:check`
- Evidence bundle generation: `npm run evidence:delivery-hub-cutover`

These commands remain evidence/review actions. They do not approve or perform checkout cutover.

### Store API evidence endpoints

- Preconditions verifier: `GET /store/delivery/cutover-preconditions` in [`route.ts`](../medusa-agency-boilerplate/src/api/store/delivery/cutover-preconditions/route.ts)
- Candidate planner: `GET /store/delivery/cutover-candidate?cart_id=<cart_id>` in [`route.ts`](../medusa-agency-boilerplate/src/api/store/delivery/cutover-candidate/route.ts)
- Approval/decision artifact template: `GET /store/delivery/cutover-approval-template?cart_id=<cart_id>` in [`route.ts`](../medusa-agency-boilerplate/src/api/store/delivery/cutover-approval-template/route.ts)

Endpoint outputs are evidence-only. They must keep commit controls disabled and must not be treated as runtime approval.

---

## 3. Ordered review flow

1. Run preview browser smoke:
   - `npm run smoke:delivery-hub-preview:browser`
   - Expected posture: preview/shadow UI visible only when enabled, source-of-truth unchanged, no Delivery Hub shipping-method commit.
2. Run rollback browser smoke:
   - `npm run smoke:delivery-hub-rollback:browser`
   - Expected posture: flags-off fallback keeps existing ApiShip/Medusa checkout visible and active.
3. Run evidence bundle check/export:
   - `npm run evidence:delivery-hub-cutover:check`
   - `npm run evidence:delivery-hub-cutover`
   - Generated environment-specific bundle stays uncommitted and attached only as sanitized review evidence.
4. Inspect preconditions/candidate/decision artifact outputs:
   - `GET /store/delivery/cutover-preconditions`
   - `GET /store/delivery/cutover-candidate?cart_id=<cart_id>`
   - `GET /store/delivery/cutover-approval-template?cart_id=<cart_id>`
   - Required invariant: `can_commit_shipping_method=false`, `canCommitShippingMethod=false`, `approval_is_executable=false`.
5. Complete the human decision record:
   - Use [`delivery_hub_cutover_decision_record_template.md`](./delivery_hub_cutover_decision_record_template.md).
   - Allowed outcome for the current runtime state remains `NO-GO` or evidence accepted with commit disabled.
6. Only then plan a separate implementation tranche:
   - Any real checkout source-of-truth cutover must be a new scoped implementation/review task.
   - It must explicitly preserve rollback/fallback and must not reuse this index as executable approval.

---

## 4. Remaining hard blockers before real cutover

Real production checkout cutover remains blocked by all of the following:

- Delivery Hub-specific `setShippingMethod()` path is not implemented by design; the current mutation seam is [`cart.ts`](../medusa-agency-boilerplate-storefront/src/lib/data/cart.ts).
- `canCommitShippingMethod=false` / `can_commit_shipping_method=false` invariants remain required; storefront normalization rejects commit-enabled candidate evidence in [`delivery-hub.ts`](../medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub.ts).
- Executable approval state is disabled; decision artifacts are templates/evidence only.
- Shipment lifecycle hardening is not enabled/live-validated for checkout source-of-truth cutover.
- Production rollout/rollback rehearsal is not completed.
- Explicit operator and technical-owner approval is not recorded as an executable release gate.

If any evidence claims commit is enabled, approval is executable, or Delivery Hub is already checkout source-of-truth, treat the review as **NO-GO** and return the package for correction.

---

## 5. Rollback/fallback statement

Existing ApiShip/Medusa checkout remains the source-of-truth until a later, separately approved implementation changes it.

For this review state:

- disabling Delivery Hub preview/cutover flags must leave fallback checkout available;
- saved Delivery Hub neutral metadata must not block existing fallback shipping;
- no ApiShip/Medusa fallback path is removed or functionally changed;
- rollback evidence is mock/no-network unless separately documented by an operator.

---

## 6. Security and redaction statement

All cutover evidence must be sanitized. Do not include or output:

- merchant credentials;
- auth headers;
- token values;
- ciphertext values;
- publishable key values;
- raw provider request/response bodies;
- raw Yandex/provider DTOs;
- raw provider offer ids;
- raw quote keys;
- backend execution tokens;
- arbitrary provider metadata.

Use presence markers, counts, safe correlation ids, redacted summaries, and screenshots/log excerpts only after manual no-secret review.

---

## 7. Final verdict for this index

**NO-GO for real checkout cutover.**

The current chain is ready for operator review as preview/shadow and evidence only. Real production checkout source-of-truth cutover requires a separate implementation tranche, separate approval gate, separate rollback rehearsal, and separate review.
