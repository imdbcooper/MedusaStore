# Delivery Hub Yandex provider-contract validation evidence (`2026-04-24`)

> Источник runbook: [`Docs/delivery_hub_yandex_provider_contract_validation_runbook.md`](./delivery_hub_yandex_provider_contract_validation_runbook.md)
>
> Harness entrypoint: [`medusa-agency-boilerplate/src/scripts/delivery-hub-yandex-provider-contract-validation.ts`](../medusa-agency-boilerplate/src/scripts/delivery-hub-yandex-provider-contract-validation.ts)
>
> Redaction helper: [`buildDeliveryHubProviderContractEvidenceSummary()`](../medusa-agency-boilerplate/src/modules/delivery-hub/provider-contract-validation-evidence.ts:77)
>
> Safety posture: fail-closed, manual-only, redacted evidence only.

---

## 1) Session classification

- Tranche: **B — Controlled live run + evidence bundle**.
- Execution date (UTC): `2026-04-24`.
- Evidence type: **controlled preflight + blocked live attempt evidence**.
- Live provider calls actually executed: **no**.
- Harness-reported `live_call_performed`: **false** in all captured runs.

---

## 2) Safety controls observed

During this session, all runs used the existing harness constraints from [`delivery-hub-yandex-provider-contract-validation.ts`](../medusa-agency-boilerplate/src/scripts/delivery-hub-yandex-provider-contract-validation.ts):

- default plan/dry-run gating via [`resolveGate()`](../medusa-agency-boilerplate/src/scripts/delivery-hub-yandex-provider-contract-validation.ts:372);
- explicit live opt-in env gate `DELIVERY_HUB_YANDEX_PROVIDER_CONTRACT_VALIDATION_LIVE_ENABLED`;
- explicit live confirm gate `--live-confirm=I_UNDERSTAND_LIVE_PROVIDER_CALLS`;
- live encryption prerequisite gate `DELIVERY_HUB_ENCRYPTION_KEY`;
- connection readiness gate (`active + enabled + sealed`, provider=`yandex`);
- redacted evidence serialization through [`buildDeliveryHubProviderContractEvidenceSummary()`](../medusa-agency-boilerplate/src/modules/delivery-hub/provider-contract-validation-evidence.ts:77).

No raw credentials, auth headers, quote keys, raw request/response payload bodies, raw provider shipment identifiers, or `.env` content were captured in this document.

---

## 3) Captured command contour (redacted)

To preserve argument passing with current CLI parsing behavior, execution used a temporary wrapper (outside repo files) that forwards env-sourced args into the committed harness function.

Canonical run shape remained `medusa exec` against harness logic, e.g.:

- plan/dry-run: equivalent to calling [`delivery-hub-yandex-provider-contract-validation.ts`](../medusa-agency-boilerplate/src/scripts/delivery-hub-yandex-provider-contract-validation.ts) with `--operation=<operation>`;
- live preflight: equivalent to `--mode=live --dry-run=false --live-confirm=I_UNDERSTAND_LIVE_PROVIDER_CALLS` plus/without required env gates.

This did not alter production code paths and did not bypass harness gates.

---

## 4) Plan/dry-run matrix evidence (all required operations)

Observed for operations:

- `create_shipment`
- `refresh_status`
- `cancel_shipment`
- `repeated_cancel`
- `missing_provider_shipment_reference`
- `invalid_provider_shipment_reference`
- `sanitized_provider_failure`
- `duplicate_prevention_posture`

Common observed invocation/gate summary:

- `invocation.mode = "plan"`
- `invocation.dry_run = true`
- `invocation.live_call_attempted = false`
- `invocation.live_call_performed = false`
- `gate.status = "blocked_default_dry_run"`
- `gate.reason_code = "dry_run_default"`
- `connection.resolved = false`
- `evidence.primary.status = "blocked"`
- `evidence.additional.length = 0`

Anti-leak confirmations remained explicit false-only flags from [`anti_leak_confirmations`](../medusa-agency-boilerplate/src/modules/delivery-hub/provider-contract-validation-evidence.ts:64).

---

## 5) Live-gate preflight evidence (presence-only)

### 5.1 Live attempt without opt-in env

Observed with live args and confirm present, but without live opt-in env:

- `gate.status = "blocked_live_opt_in_required"`
- `gate.reason_code = "live_opt_in_env_required"`
- `live_call_attempted = true`
- `live_call_performed = false`

### 5.2 Live attempt with opt-in env, but missing encryption prerequisite

Observed with live opt-in env enabled:

- `gate.status = "blocked_encryption_key_required"`
- `gate.reason_code = "encryption_key_required"`
- `live_call_attempted = true`
- `live_call_performed = false`

### 5.3 Live attempt with opt-in env + placeholder encryption, but no ready connection

Observed with live opt-in env enabled and non-secret placeholder encryption key only for gate progression:

- `gate.status = "blocked_connection_not_found"`
- `gate.reason_code = "connection_not_found"`
- `connection.resolved = false`
- `live_call_performed = false`

### 5.4 Live confirm gate behavior

Observed with live opt-in env and missing/wrong confirm value:

- `gate.status = "blocked_live_confirm_required"`
- `gate.reason_code = "live_confirm_required"`
- `live_call_performed = false`

---

## 6) Truthful proven / unproven semantics from this tranche

### Proven in this session

1. Harness fail-closed behavior is active and consistent with runbook for:
   - default dry-run blocking;
   - missing live opt-in env;
   - missing/invalid live confirm;
   - missing encryption key;
   - missing ready Yandex connection.
2. Redaction/anti-leak evidence surface remains active (`anti_leak_confirmations` false-only).
3. No live provider call was executed (`live_call_performed=false` across captured outputs).

### Not proven (still unknown/unproven)

1. Authoritative live Yandex create-shipment semantics.
2. Authoritative live status refresh semantics (`/shipments/info`) for real provider references.
3. Authoritative live cancel semantics (including repeated/already-cancelled behavior).
4. Missing/invalid provider shipment reference behavior against real provider.
5. Sanitized provider-failure posture under real provider network responses.
6. Duplicate/idempotency runtime behavior under real live redispatch attempts.
7. Live retry redispatch remains **not materialized / not proven**.

---

## 7) Blockers that prevented live evidence collection

Presence-only blockers observed in this environment:

1. `DELIVERY_HUB_ENCRYPTION_KEY` prerequisite absent for genuine live path (`blocked_encryption_key_required` when live opt-in enabled).
2. No eligible ready Yandex connection resolvable by harness (`blocked_connection_not_found`; requires `active + enabled + sealed` connection, provider `yandex`).

Because gates failed, live provider calls were **not** performed by design.

---

## 8) Recommendation for next step (Tranche C input)

Proceed to Tranche C only after controlled prerequisites exist in runtime environment:

- valid live opt-in and confirm process retained;
- encryption prerequisite available;
- exactly resolvable ready Yandex connection (`active + enabled + sealed`);
- operator-approved masked test references for safe scenario execution.

Then rerun the same harness/runbook matrix and append a new dated evidence bundle with real live outcomes, preserving current redaction boundaries.
