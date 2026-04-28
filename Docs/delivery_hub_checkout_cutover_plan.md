# Delivery Hub checkout cutover readiness plan and approval gate

> Status: formal readiness/approval gate for a future checkout cutover.
>
> Current decision: **NO-GO for real checkout source-of-truth cutover** until this document's approval gates are explicitly passed in a later scoped task.
>
> Scope of this document: readiness gate plus a runtime-visible, read-only/preflight storefront status surface for the reserved flag. It does not implement runtime checkout cutover, does not call `setShippingMethod()` for Delivery Hub, does not remove ApiShip/legacy compatibility, and does not perform shipment create/cancel/status/retry.

---

## 1. Current state

The Delivery Hub contour has already reached these confirmed milestones:

- Backend direct Yandex quote path is live for the currently supported first-tranche quote modes:
  - `warehouse_to_pickup_point`: successful quote smoke, `4` neutral quotes;
  - `dropoff_point_to_pickup_point`: successful quote smoke, `13` neutral quotes.
- Store-neutral quote plus selection is confirmed live without checkout cutover:
  - dropoff: quote `13`, neutral selection saved, checkout source-of-truth unchanged;
  - warehouse: quote `4`, neutral selection saved, checkout source-of-truth unchanged.
- Storefront Delivery Hub Preview/Shadow UI exists and is covered by source-level tests plus a mock browser smoke.
- The preview/shadow UI is intentionally labeled as metadata-only: quote and selection can be exercised, but the committed checkout shipping method remains the existing Medusa/ApiShip/legacy-compatible contour.

### Explicit non-goal for the current checkpoint

This checkpoint is **not** a checkout cutover. It must not:

- wire a Delivery Hub path into `setShippingMethod()`;
- make Delivery Hub the checkout source of truth;
- remove or functionally change ApiShip/legacy compatibility;
- change production runtime code paths;
- patch official Medusa Admin internals;
- create, cancel, refresh, retry, confirm, or otherwise execute shipments;
- expose merchant credentials, auth headers, ciphertext, tokens, publishable key values, or raw provider payloads.

---

## 2. Cutover definition

A future Delivery Hub checkout cutover means all of the following become true in one explicitly approved implementation tranche:

1. The shopper selects a Delivery Hub quote through the neutral storefront contract.
2. The neutral selection is persisted on cart metadata through the Store API.
3. The storefront determines a validated Delivery Hub Medusa shipping option that exactly matches the persisted neutral selection and backend readiness state.
4. Only after all preconditions pass, the storefront may call the existing Medusa cart shipping method mutation through `setShippingMethod()`.
5. The committed Medusa cart/order/fulfillment metadata carries enough neutral Delivery Hub references for later fulfillment handoff without exposing provider raw payloads.
6. Existing Medusa/ApiShip/legacy shipping remains a fallback and rollback path.

Until those conditions are approved and implemented, Delivery Hub remains quote/selection/preview metadata only for checkout.

---

## 3. Readiness checklist

### 3.1 Backend Store API readiness

Required before approval:

- `POST /store/delivery/quotes` accepts only neutral Delivery Hub fields and rejects raw/provider-specific inputs.
- `POST /store/delivery/selection`, `GET /store/delivery/selection`, and `DELETE /store/delivery/selection` persist/read/clear only the neutral selection contract.
- Store responses expose only shopper-safe data: quote count, quote summary, opaque quote reference, neutral pickup point/window summary, safe correlation id, and `checkout_source_of_truth` diagnostics.
- Response boundary rejects `raw_reference`, `quote_key`, provider DTOs, raw Yandex fragments, credentials, auth headers, ciphertext, token-like values, backend execution references, and arbitrary provider metadata.
- Cart metadata writes are idempotent enough for repeated save/clear in checkout.
- Cart selection reads distinguish valid, missing, stale, and malformed persisted selections.
- Store API failures are controlled and do not silently commit a shipping method.

### 3.2 Admin API readiness

Required before approval:

- Admin can create and validate a Delivery Hub/Yandex connection without revealing the write-only token after save.
- Admin can look up sanitized pickup points and warehouses/source mappings needed for quote validation.
- Admin quote smoke for both first-tranche modes remains available and sanitized.
- Admin manual smoke evidence clearly separates quote success from checkout approval.
- Any shipping-option preview/sync surface is explicit, operator-approved, audited, and does not auto-roll out checkout changes.
- Admin surfaces show safe diagnostics only: provider status/category/message when sanitized, correlation id, counts, and readiness flags.
- Admin surfaces never display raw provider bodies, auth headers, token values, ciphertext, or merchant credentials.

### 3.3 Yandex adapter readiness

Required before approval:

- Direct Yandex quote adapter remains validated for both supported first-tranche modes.
- Quote response normalization returns neutral quote summaries and opaque backend-issued quote references.
- Provider-origin execution context, if needed later, remains backend-only and is never returned to storefront.
- Provider errors are normalized into safe categories and messages.
- Adapter logs and evidence never contain raw request/response bodies, auth headers, tokens, ciphertext, or raw provider identifiers beyond approved masked/presence summaries.
- Any future create-shipment path remains separately gated and must not be implied by checkout cutover approval.

### 3.4 Neutral selection readiness

Required before approval:

- The persisted cart selection is canonical and stable across save/read/clear.
- Selection carries only neutral fields required to later match a Delivery Hub shipping option.
- Selection is tied to the current cart and quote context.
- Backend readiness can prove the saved selection still matches the active connection, supported quote type, destination PVZ, optional origin, and quote reference posture.
- Stale/missing/mismatched selection blocks checkout commit rather than falling back to an unsafe partial commit.

### 3.5 Storefront preview readiness

Required before approval:

- Preview/shadow UI remains feature-flagged and disabled by default.
- Preview UI has already demonstrated neutral quote and save/clear behavior without checkout commit.
- Browser mock smoke verifies disabled/enabled flag behavior, quote rendering, selection save/clear, no-secret UI text, and unchanged checkout source of truth.
- Manual preview validation is recorded only as readiness evidence, not as cutover approval.
- No Delivery Hub preview path calls `setShippingMethod()` before the go/no-go gate passes.

### 3.6 Fulfillment bridge readiness

Required before approval:

- Cart/order/fulfillment metadata can be assembled into a neutral handoff snapshot without raw provider payloads.
- Fulfillment bridge validates provider/mode compatibility, committed shipping option metadata, saved neutral selection, pickup point/window summaries, cart/order/fulfillment references, and safe correlation ids.
- Unsupported, stale, drifted, or incomplete handoffs remain blocked with safe diagnostics.
- Shipment execution remains behind its own backend execution gate and is not automatically implied by checkout source-of-truth cutover.

### 3.7 Observability readiness

Required before approval:

- Store API, Admin API, storefront, and backend logs expose safe correlation ids for quote/selection/commit troubleshooting.
- Logs confirm checkout source-of-truth transitions without printing raw provider bodies or credentials.
- Observability can answer: quote requested, selection saved, commit attempted, commit succeeded/failed, fallback used, rollback used.
- Safe event/audit records distinguish preview metadata operations from real Medusa shipping method commits.
- Metrics/alerts exist or are explicitly accepted as manual for the first cutover tranche.

### 3.8 Rollback readiness

Required before approval:

- A default-off cutover flag exists and can be disabled without code changes.
- Disabling the cutover flag returns checkout to existing Medusa/ApiShip/legacy-compatible shipping source-of-truth.
- Existing carts with saved Delivery Hub metadata do not break checkout when cutover is disabled.
- Existing committed non-Delivery-Hub shipping methods remain valid and are not mutated by the rollback.
- Operators have a documented fallback path and smoke checklist.

---

## 4. Canonical neutral quote and selection contract required before commit

A future checkout commit must be based on a persisted backend-validated neutral selection, not on storefront-only local state.

### Required neutral quote fields

High-level quote contract:

- `quote_type`: supported Delivery Hub mode, for example `warehouse_to_pickup_point` or `dropoff_point_to_pickup_point`.
- `quote_reference`: opaque backend-issued reference suitable for later backend validation; storefront must treat it as opaque.
- `price`: amount and currency code.
- `eta`: neutral delivery estimate if available.
- `pickup_point`: neutral id/code/name/address summary for the destination PVZ.
- `pickup_window`: neutral optional time window summary when the mode/provider requires it.
- `correlation_id`: safe diagnostic id.

The quote contract must not include raw provider response bodies, raw Yandex offer payloads, auth headers, credentials, ciphertext, provider tokens, raw execution tokens, or arbitrary provider metadata.

### Required neutral selection fields

High-level persisted selection contract:

- `provider_code`: backend-authoritative provider identity, not user supplied as trust authority.
- `connection_id`: selected Delivery Hub connection id.
- `quote_type`: supported neutral mode.
- `quote_reference`: opaque backend-issued quote reference.
- `quote_summary`: neutral price, currency, ETA and label data.
- `pickup_point`: neutral destination PVZ summary.
- `pickup_window`: optional neutral window summary when relevant.
- `correlation_id`: safe diagnostic id.
- `selection_version`: versioned neutral contract marker.
- `saved_at`: server-side save timestamp.

A future commit must re-read this persisted selection before calling the Medusa shipping method mutation. It must not trust only the last quote response or component state.

---

## 5. Required metadata shape at a high level

This section intentionally describes only high-level neutral metadata. It must not contain raw provider payload examples.

### Cart metadata

Expected high-level cart metadata namespace:

- `metadata.delivery_hub.selection`: saved neutral selection contract.
- `metadata.delivery_hub.readiness`: optional backend-computed readiness summary or last-read posture.
- `metadata.delivery_hub.commit`: optional future commit summary containing matched shipping option id, neutral mode, safe correlation id, committed-at timestamp, and no raw provider fields.

### Order metadata

Expected high-level order metadata namespace after future cutover:

- `metadata.delivery_hub.selection_snapshot`: immutable neutral selection snapshot copied from cart.
- `metadata.delivery_hub.commit_snapshot`: matched Delivery Hub shipping option id, mode, connection reference, safe quote reference summary, and commit timestamp.
- `metadata.delivery_hub.handoff_status`: high-level fulfillment handoff readiness state such as `pending`, `ready`, `blocked`, or `manual_review_required`.

### Fulfillment metadata

Expected high-level fulfillment metadata namespace after future cutover:

- `metadata.delivery_hub.fulfillment_payload`: neutral provider-facing handoff summary accepted by the Delivery Hub fulfillment bridge.
- `metadata.delivery_hub.execution_reference`: backend-generated safe execution reference or presence marker, if and only if the execution ledger contour owns it.
- `metadata.delivery_hub.provider`: safe provider code/mode summary.
- `metadata.delivery_hub.pickup_point`: neutral destination PVZ summary.
- `metadata.delivery_hub.audit`: safe correlation and timestamp summary.

No cart/order/fulfillment metadata may store storefront-visible raw provider request/response bodies, auth headers, credentials, token values, ciphertext, publishable key values, raw Yandex DTOs, or arbitrary provider metadata.

---

## 6. Approval gates and go/no-go criteria

### Gate A — documentation and scope gate

Go only if:

- this plan is reviewed and accepted;
- manual preview validation is explicitly classified as readiness evidence, not approval;
- the implementation scope for a later cutover tranche is written before coding;
- rollback/fallback behavior is part of that implementation scope.

Current status: **prepared by this checkpoint; review pending**.

### Gate B — backend contract gate

Go only if:

- Store API quote/selection contracts pass focused no-network tests;
- response-boundary tests prove provider/internal/secret-like fragments are rejected;
- backend live local smoke confirms quote plus selection for supported modes;
- Admin quote evidence remains current and sanitized.

Current status: **partially satisfied as readiness evidence; must be re-run before cutover**.

### Gate C — storefront precondition gate

Go only if:

- preview/shadow UI source-level tests pass;
- browser mock smoke passes;
- cutover flag is default disabled;
- no `setShippingMethod()` call is possible unless the future cutover flag is enabled and backend readiness returns exact match.

Current status: **preview evidence exists; real commit path remains not approved in this checkpoint**.

### Gate D — shipping-option match gate

Go only if:

- a Delivery Hub Medusa shipping option exists for the selected neutral mode;
- option metadata is canonical, versioned, and provider-neutral enough for backend validation;
- the matched option id is deterministic or backend-authoritative;
- stale/missing/mismatched option blocks commit.

Current status: **requires future explicit cutover implementation review**.

### Gate E — observability and rollback gate

Go only if:

- safe commit/fallback logging exists;
- rollback smoke is documented and passes;
- disabling the flag preserves existing checkout behavior;
- operators can identify whether a cart is using preview-only metadata, committed Delivery Hub shipping, or fallback shipping.

Current status: **not yet approved for cutover**.

### Gate F — final go/no-go meeting/checkpoint

Go only if a reviewer/operator explicitly records:

- test matrix results;
- no-secret scan result;
- cutover flag default state;
- rollback decision owner;
- final `GO` or `NO-GO` decision.

Default without explicit approval: **NO-GO**.

---

## 7. Feature flag strategy

A future checkout cutover must be guarded by a dedicated public storefront flag:

```text
NEXT_PUBLIC_DELIVERY_HUB_CHECKOUT_CUTOVER_ENABLED=false
```

Required semantics:

- default is `false` in all examples/templates;
- `false` means Delivery Hub remains preview/neutral-selection-only and existing checkout shipping source-of-truth remains active;
- `true` may only enable the future commit UI/path after all approval gates pass;
- the flag must not contain secrets and must not encode provider credentials or ids;
- the current storefront implementation parses the flag with explicit-true semantics only and exposes a read-only/preflight status in the preview/shadow UI;
- even when the flag is `true`, current runtime status remains `canCommitShippingMethod=false` and real commit remains blocked pending separate implementation/approval;
- backend execution/shipment gates remain separate and are not implied by this storefront checkout flag.

This flag is intentionally separate from `NEXT_PUBLIC_DELIVERY_HUB_PREVIEW_ENABLED`. Preview validates quote/selection behavior; cutover controls future shipping-method commit behavior.

---

## 8. Rollback/fallback design

Rollback must preserve the existing Medusa/ApiShip/legacy-compatible shipping contour.

Required fallback rules:

1. If cutover flag is disabled, Delivery Hub commit UI/path is unavailable.
2. Existing Medusa shipping selection remains the checkout source of truth.
3. Saved Delivery Hub neutral metadata may remain visible as preview/readiness information, but it must not block fallback shipping.
4. If Delivery Hub readiness is stale, missing, mismatched, or fails validation, commit is blocked and shopper can continue with existing fallback shipping options.
5. If a cart already committed a Delivery Hub shipping method and rollback is needed, operator guidance must decide whether to keep the committed method, require shopper reselection, or clear only Delivery Hub-specific metadata through an approved path.
6. Rollback must not delete order/fulfillment audit history.
7. Rollback must not remove ApiShip/legacy compatibility or mutate unrelated shipping options.

---

## 9. Future `setShippingMethod()` path and required preconditions

The existing storefront helper `setShippingMethod()` in `medusa-agency-boilerplate-storefront/src/lib/data/cart.ts` remains the only acceptable Medusa shipping-method mutation seam for checkout.

A future Delivery Hub path may call `setShippingMethod()` only after all of these preconditions pass in the same user action/request cycle:

1. `NEXT_PUBLIC_DELIVERY_HUB_CHECKOUT_CUTOVER_ENABLED=true`.
2. The shopper has a current cart id.
3. The storefront re-reads the persisted Delivery Hub selection from the Store API.
4. Backend readiness says the selection is `ready` for checkout commit.
5. The selection's connection, quote type, quote reference posture, pickup point/window summary, and cart context still match the latest backend readiness summary.
6. The current cart exposes an exact Delivery Hub-compatible Medusa shipping option for the selected mode.
7. The shipping option metadata indicates the Delivery Hub provider contour and supported contract version.
8. No raw provider payload, raw offer id, `quote_key`, auth header, token, ciphertext, or arbitrary provider metadata is passed to the storefront mutation.
9. Fallback shipping remains available when any precondition fails.
10. The commit result is observed with safe logs/diagnostics and can be rolled back by disabling the flag for new attempts.

This document does not add that call and does not approve adding it without a separate implementation/review tranche.

---

## 10. Required test matrix before any cutover

### Unit tests

- Store API quote and selection schema validation.
- Selection persistence/read/clear shape.
- Readiness matching for valid, stale, missing, malformed, mismatched connection, mismatched quote type, mismatched pickup point/window, and missing shipping option.
- Storefront helper/model tests for disabled flag, blocked state, ready state, and no-secret rendering.
- Fulfillment bridge metadata shape tests.
- Rollback/fallback helper tests.

### No-network API tests

- Exported Store API route handlers for quote/selection/readiness.
- Admin route handlers for quote diagnostics and pickup point/warehouse readiness.
- Response-boundary rejection of raw provider/internal/secret-like fragments.
- No Delivery Hub `setShippingMethod()` call when cutover flag is false.

### Browser mock smoke

- Preview flag disabled: Delivery Hub block hidden or preview-only, fallback shipping visible.
- Preview flag enabled but cutover flag disabled: quote/save/clear works, no shipping-method commit.
- Current cutover-prep flag enabled with mocked ready backend: the UI recognizes the flag but still shows preflight/blocked-only and `canCommitShippingMethod=false`; no commit CTA/path exists in this step.
- Future approved cutover implementation only: commit CTA may appear only when exact preconditions pass.
- Blocked states: stale selection, missing option, mismatched option, failed readiness.
- UI text scan confirms no token/auth/ciphertext/raw provider/publishable key value.

### Live local backend smoke

- Direct Yandex quote for `warehouse_to_pickup_point`: quote count above zero.
- Direct Yandex quote for `dropoff_point_to_pickup_point`: quote count above zero.
- Store-neutral quote plus selection save for both modes.
- Checkout source-of-truth remains unchanged before cutover approval.
- If future cutover is being tested, use a local explicit flag and record the exact cart/order outcome without secrets.

### Admin manual smoke

- Connection save/test.
- Pickup point lookup.
- Warehouse/source mapping.
- Test quote for both supported modes.
- Safe logs and event summaries.
- No raw provider body, auth header, token, ciphertext, or provider raw identifiers in screenshots/evidence.

### Rollback smoke

- Start with cutover flag disabled: fallback checkout path works.
- Enable cutover in a controlled local/staging environment: ready path can commit only if approved preconditions pass.
- Disable cutover again: fallback checkout path remains available.
- Existing saved Delivery Hub metadata does not break fallback checkout.
- Existing ApiShip/Medusa fallback shipping remains visible and functional.

---

## 11. Production safety and security constraints

These constraints are mandatory for any future cutover implementation and evidence package:

- No merchant credentials in storefront code, env examples, UI, screenshots, docs, logs, or browser output.
- No raw provider request or response body in storefront, docs, logs, cart metadata, order metadata, fulfillment metadata, or Admin UI.
- No auth headers in docs/logs/UI.
- No ciphertext values in docs/logs/UI.
- No token values in docs/logs/UI.
- No publishable key value in docs/logs/UI evidence; use presence markers or placeholders only.
- No backend execution reference exposed to shopper-facing APIs unless explicitly designed as a safe opaque public reference.
- No raw Yandex DTOs stored in public metadata.
- No automatic shipment create/cancel/status/retry as a side effect of checkout cutover.
- No official Medusa Admin internals patching.
- No destructive Git or data operations as part of the cutover gate.

---

## 12. Required final approval record format

Before any future implementation changes checkout source-of-truth, record a final approval section in the implementation PR/commit notes with this shape:

```text
Delivery Hub checkout cutover gate: GO | NO-GO
Decision owner: <role/name>
Environment: local | staging | production
Commit under review: <hash>
Cutover flag default: false
Cutover flag test override: true | false | not used
Backend Store API tests: PASS | FAIL
Admin manual smoke: PASS | FAIL
Storefront source tests: PASS | FAIL
Browser mock smoke: PASS | FAIL
Live local backend smoke: PASS | FAIL
Rollback smoke: PASS | FAIL
No-secret/raw-provider scan: PASS | FAIL
Fallback preserved: YES | NO
ApiShip/legacy contour changed: NO | YES with explanation
Shipment create/cancel/status/retry performed: NO | YES with explanation
Final decision notes: <safe summary only>
```

If any required field is missing, the default decision is **NO-GO**.

---

## 13. Current checkpoint outcome

This checkpoint now has a runtime-visible default-off gate/preflight status in the storefront preview/shadow UI, but still does not implement checkout cutover.

Current outcome:

- readiness plan: prepared;
- reserved flag parsing: explicit `true` only, default false;
- runtime visibility: `delivery-hub-cutover-gate-status` shows disabled/default-off or true/preflight status;
- commit invariant: `canCommitShippingMethod=false` in both flag modes;
- checkout cutover: **not performed**;
- Delivery Hub call to `setShippingMethod()`: **not added**;
- ApiShip/legacy compatibility: **preserved**;
- shipment create/cancel/status/retry: **not performed**;
- next required step before real cutover implementation: review and approval of this plan, then a separately scoped cutover implementation task if and only if the gate result is `GO`.
