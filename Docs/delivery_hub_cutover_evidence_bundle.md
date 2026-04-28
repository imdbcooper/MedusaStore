# Delivery Hub checkout cutover evidence bundle exporter

> Status: operator/reviewer evidence bundle convention for Delivery Hub checkout cutover go/no-go review.
>
> Operator go/no-go review index: [`delivery_hub_cutover_go_no_go_index.md`](./delivery_hub_cutover_go_no_go_index.md).
>
> Scope: read-only, no-network, safe-summary bundle generation. This document and exporter do not implement checkout cutover, do not approve runtime execution, do not change checkout source-of-truth, and do not create executable approval state.

---

## 1. Purpose

The evidence bundle exporter gives operators one sanitized artifact to attach to the Delivery Hub checkout cutover go/no-go review. It packages the current readiness/precondition/candidate/decision/rollback-smoke references and operator status placeholders without calling backend, storefront, Yandex, Medusa runtime, or any live provider.

Canonical artifact type:

```text
delivery_hub_checkout_cutover_evidence_bundle
```

The bundle is evidence-only. It is not approval, not commit enablement, not shipment lifecycle enablement, and not a replacement for the formal cutover readiness plan in [`delivery_hub_checkout_cutover_plan.md`](./delivery_hub_checkout_cutover_plan.md).

---

## 2. Exporter command

From the repository root:

```bash
npm run evidence:delivery-hub-cutover
```

Default behavior writes markdown to an ignored local artifact path:

```text
.delivery-hub-cutover-evidence/delivery-hub-cutover-evidence-bundle.md
```

The ignored output is environment-specific and should be attached to the operator review when appropriate, but it must not be committed.

A separate staging dry-run evidence convention exists for controlled staging enablement/rollback input after the local cutover and rollback smokes plus optional controlled staging cart/order run:

```bash
npm run evidence:delivery-hub-staging-dry-run:check
npm run evidence:delivery-hub-staging-dry-run
```

That command writes to `.delivery-hub-cutover-evidence/staging-dry-run/`, records operator assertions for `smoke:delivery-hub-cutover:browser`, `smoke:delivery-hub-rollback:browser`, staging flag state, sanitized manual staging note, sanitized rollback verification note, and hard guardrails. It rejects quoted JSON-style secret/key/token/ciphertext/auth fields in notes and check self-test samples. It is local-only, does not read `.env` files, does not capture raw provider/Yandex request or response bodies, and does not enable production.

Check-only mode:

```bash
npm run evidence:delivery-hub-cutover:check
```

Check mode validates that required scripts/docs/routes exist and scans generated markdown/json bundle content for known unsafe sentinel fields. It performs no network calls and writes no artifact.

Useful direct variants:

```bash
node scripts/delivery-hub-cutover-evidence-bundle.mjs --stdout
node scripts/delivery-hub-cutover-evidence-bundle.mjs --format json --stdout
node scripts/delivery-hub-cutover-evidence-bundle.mjs --output-dir .delivery-hub-cutover-evidence
```

---

## 3. Evidence sections

The generated bundle includes:

- `artifact_type="delivery_hub_checkout_cutover_evidence_bundle"`;
- generated timestamp;
- safe git commit/branch/status summary;
- links/references to the cutover plan, manual testing plan, human decision record template, preconditions verifier, candidate planner, and decision artifact endpoint;
- checklist entries for backend Yandex direct quote baseline, store-neutral quote/selection smoke baseline, storefront preview smoke, default-off/preflight-only cutover gate, preconditions verifier, candidate planner, non-executable decision artifact, rollback/fallback browser smoke, redaction guardrails, and remaining blockers;
- command/status placeholders for `npm run smoke:delivery-hub-preview:browser` and `npm run smoke:delivery-hub-rollback:browser`;
- preserved invariants proving the exporter did not perform checkout cutover or provider execution.

The staging dry-run bundle additionally includes the current git commit/dirty-clean status without diff dumps, expected cutover and rollback smoke commands, operator statuses (`PASS|FAIL|NOT_RUN`), staging cutover flag state assertion (`true|false|unknown`), sanitized manual staging cart/order note, sanitized rollback verification note, and explicit guardrails that production defaults remain unchanged and ApiShip/Medusa fallback is preserved.

The exporter records smoke command status placeholders only. Browser smokes remain separate operator actions.

---

## 4. Redaction and safety boundary

The exporter is intentionally safe-summary only. It must not include:

- provider credential values;
- raw auth headers;
- ciphertext values;
- token values;
- publishable key values;
- raw provider request/response bodies;
- raw provider offer ids;
- raw quote keys;
- backend execution tokens;
- executable approval records.

The check mode scans generated markdown/json for known unsafe sentinel field/value patterns before reporting success. This scan is a guardrail, not a substitute for manual review of any externally attached screenshots, console output, or operator notes.

---

## 5. Review workflow

Recommended operator flow:

1. Run `npm run evidence:delivery-hub-cutover:check`.
2. If required inputs and guardrails pass, run `npm run evidence:delivery-hub-cutover`.
3. Separately run `npm run smoke:delivery-hub-preview:browser` if preview smoke evidence needs a fresh status.
4. Separately run `npm run smoke:delivery-hub-rollback:browser` if rollback/fallback evidence needs a fresh status.
5. Attach sanitized smoke summaries and the non-executable decision record to the go/no-go review.
6. Keep the generated `.delivery-hub-cutover-evidence/` output uncommitted.

The final review remains pending until an explicit separate go/no-go review task is completed. Even a completed evidence bundle must preserve `can_commit_shipping_method=false` and `approval_is_executable=false` until a later approved implementation task changes the runtime contour.

---

## 6. Explicit non-goals

The exporter does not:

- wire Delivery Hub into checkout `setShippingMethod()`;
- make Delivery Hub the checkout source-of-truth;
- call `/store/delivery/cutover-preconditions`, `/store/delivery/cutover-candidate`, or `/store/delivery/cutover-approval-template` at runtime;
- call Yandex or any provider;
- call Medusa runtime or storefront runtime;
- create/cancel/status/retry shipments;
- mutate cart/order/fulfillment/shipping-option state;
- remove or functionally change ApiShip/legacy fallback;
- patch official Medusa Admin internals;
- commit generated environment-specific output.
