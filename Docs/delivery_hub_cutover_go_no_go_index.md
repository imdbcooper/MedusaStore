# Delivery Hub checkout cutover go/no-go review index

> Operator-facing index for the final Delivery Hub checkout cutover review chain.
>
> Current verdict: **NO-GO for production checkout source-of-truth cutover** until the new default-off implementation receives separate review plus explicit operator/technical approvals.
>
> Scope: navigation, evidence ordering, blocker inventory, rollback/fallback and redaction reminders only. This document does not run or enable runtime cutover.

---

## 1. Current status

| Area | Status |
|---|---|
| Preview/shadow UI | `Preview/shadow ready` |
| Cutover implementation | `Default-off storefront commit path implemented; production not enabled` |
| Production checkout source-of-truth | `NO-GO for production checkout source-of-truth` |
| Existing checkout source-of-truth | Delivery Hub-only checkout remains fail-closed unless the explicit guard passes |
| Commit invariant | Backend evidence remains `can_commit_shipping_method=false`; storefront commit eligibility is true only under explicit flag + ready mapped candidate |
| Approval posture | Evidence and decision artifact are non-executable |

This is the review index for the evidence chain plus the first default-off implementation tranche. It intentionally stops before any production checkout source-of-truth switch.

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
- Cutover flag-on staging smoke: `npm run smoke:delivery-hub-cutover:browser`
- Rollback/fallback browser smoke: `npm run smoke:delivery-hub-rollback:browser`
- Evidence bundle check: `npm run evidence:delivery-hub-cutover:check`
- Evidence bundle generation: `npm run evidence:delivery-hub-cutover`

These commands remain evidence/review actions. They do not approve production checkout cutover; the cutover smoke exercises the local mock commit only under the explicit flag and ready candidate.

### Store API evidence endpoints

- Preconditions verifier: `GET /store/delivery/cutover-preconditions` in [`route.ts`](../medusa-agency-boilerplate/src/api/store/delivery/cutover-preconditions/route.ts)
- Candidate planner: `GET /store/delivery/cutover-candidate?cart_id=<cart_id>` in [`route.ts`](../medusa-agency-boilerplate/src/api/store/delivery/cutover-candidate/route.ts)
- Approval/decision artifact template: `GET /store/delivery/cutover-approval-template?cart_id=<cart_id>` in [`route.ts`](../medusa-agency-boilerplate/src/api/store/delivery/cutover-approval-template/route.ts)

Endpoint outputs are evidence-only. They must keep commit controls disabled and must not be treated as runtime approval.

---

## 3. Ordered review flow

1. Run preview browser smoke:
   - `npm run smoke:delivery-hub-preview:browser`
   - Expected posture: preview/shadow UI visible only when enabled; flag-off makes no Delivery Hub shipping-method commit; flag-on with a ready mock candidate commits only the mapped mock Medusa shipping option.
2. Run cutover flag-on staging smoke:
   - `npm run smoke:delivery-hub-cutover:browser`
   - Expected posture: explicit flag-on local mock path commits only the mapped Delivery Hub Medusa shipping option and uses no live provider/network calls.
3. Run rollback browser smoke:
   - `npm run smoke:delivery-hub-rollback:browser`
   - Expected posture: flags-off no-fallback keeps Delivery Hub artifacts hidden and does not select legacy delivery automatically.
4. Run evidence bundle check/export:
   - `npm run evidence:delivery-hub-cutover:check`
   - `npm run evidence:delivery-hub-cutover`
   - Generated environment-specific bundle stays uncommitted and attached only as sanitized review evidence.
5. Inspect preconditions/candidate/decision artifact outputs:
   - `GET /store/delivery/cutover-preconditions`
   - `GET /store/delivery/cutover-candidate?cart_id=<cart_id>`
   - `GET /store/delivery/cutover-approval-template?cart_id=<cart_id>`
   - Required invariant: backend `can_commit_shipping_method=false` and `approval_is_executable=false` remain non-executable evidence; storefront `canCommitShippingMethod` may become true only from explicit flag + ready mapped candidate.
6. Complete the human decision record:
   - Use [`delivery_hub_cutover_decision_record_template.md`](./delivery_hub_cutover_decision_record_template.md).
   - Allowed outcome for production remains `NO-GO` or evidence accepted with production commit disabled until explicit rollout approval is recorded.
7. Delegate separate implementation review and then plan rollout only if approved:
   - The default-off code tranche must be reviewed separately before production enablement.
   - Any production source-of-truth rollout must explicitly preserve rollback/fallback and must not reuse this index as executable approval.

---

## 4. Remaining hard blockers before production cutover

Production checkout source-of-truth cutover remains blocked by all of the following:

- Delivery Hub-specific `setShippingMethod()` path is implemented only as a default-off guarded storefront handoff through [`cart.ts`](../medusa-agency-boilerplate-storefront/src/lib/data/cart.ts); it is not production-enabled by default.
- Backend `can_commit_shipping_method=false` evidence invariants remain required; storefront [`delivery-hub.ts`](../medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub.ts) allows local `canCommitShippingMethod=true` only when the explicit cutover flag, ready candidate, safe guardrails and mapped option all pass.
- Executable approval state is disabled; decision artifacts are templates/evidence only and do not themselves trigger commit.
- Shipment lifecycle hardening is not enabled/live-validated for checkout source-of-truth cutover.
- Production rollout/rollback rehearsal is not completed.
- Explicit operator and technical-owner approval is not recorded as an executable release gate.

If any evidence claims production commit is enabled by default, approval is executable, raw provider data is needed by storefront, or Delivery Hub is already production checkout source-of-truth, treat the review as **NO-GO** and return the package for correction.

---

## 5. Rollback/fallback statement

Delivery Hub checkout remains default-off/fail-closed until a later, separately approved rollout enables the guarded commit path.

For this review state:

- disabling Delivery Hub preview/cutover flags must remove Delivery Hub artifacts and keep delivery checkout fail-closed;
- saved Delivery Hub neutral metadata must not re-enable a legacy delivery fallback;
- no legacy delivery fallback path is reintroduced;
- staging enablement evidence should follow the concise checklist in [`delivery_hub_manual_testing_plan.md`](./delivery_hub_manual_testing_plan.md): keep committed defaults false, set the cutover flag only in staging deployment config, run cutover smoke, optionally place one sanitized controlled staging cart/order, set the flag false to roll back, and run rollback smoke;
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

**NO-GO for production checkout source-of-truth cutover.**

The current chain now includes a default-off implementation tranche that still requires separate code review. Real production checkout source-of-truth cutover requires explicit flag enablement, operator/technical approval, production rollback rehearsal, and separate review.
