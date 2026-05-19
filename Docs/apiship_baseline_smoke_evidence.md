# ApiShip/Gorgo Baseline Smoke Evidence

> Status: active deterministic smoke/evidence artifact for the current ApiShip baseline.
>
> Scope: no live ApiShip credentials, no external ApiShip requests, no live shipment execution.
>
> Source plan: [apiship_direct_migration_plan.md](./apiship_direct_migration_plan.md).

---

## Purpose

This artifact records the safe smoke posture for the current ApiShip/Gorgo baseline after Phase 0-10 closure.

The goal is to prove that the repository baseline remains wired to ApiShip/Gorgo without requiring running services, real merchant credentials, browser automation against live checkout, or external ApiShip calls.

---

## Deterministic local smoke

Run from the repository root:

```bash
npm --prefix ./medusa-agency-boilerplate run test:unit -- --runTestsByPath src/workflows/__tests__/apiship-baseline-smoke.unit.spec.ts
```

This unit-level smoke verifies:

- Medusa fulfillment provider registration includes `@gorgo/medusa-fulfillment-apiship/providers/fulfillment-apiship` with id `apiship`.
- The canonical fulfillment contour is `apiship_gorgo`.
- The canonical provider id is `apiship_apiship`.
- The fresh bootstrap seed contract exports the ApiShip pickup-point shipping option data id `apiship_doortopoint` with `deliveryType: 2`, `pickupType: 1`, and calculated pricing.
- The checkout readiness predicate accepts a saved ApiShip tariff plus PVZ point and rejects a manual/non-ApiShip shipping method.
- ApiShip shipment execution remains default-off unless `APISHIP_SHIPMENT_EXECUTION_ENABLED=true` is set exactly.

The smoke is intentionally non-destructive. It imports config/contracts and pure guard logic only; it does not run Medusa bootstrap, does not connect to the database, does not call ApiShip, and does not create shipments.

---

## Fresh bootstrap assumptions

Fresh bootstrap evidence is covered by the deterministic seed contract assertion above instead of a live bootstrap run in this task.

The checked contract is the same contract used by the seed path for the baseline shipping option:

- provider id: `apiship_apiship`;
- shipping option data id: `apiship_doortopoint`;
- delivery type: `2`;
- pickup type: `1`;
- baseline marker: `apiship_pickup_point_first`;
- price type: `calculated`.

A full fresh-bootstrap runtime smoke can be added later only if the task explicitly provides an isolated database/runtime scope. It should still avoid live ApiShip shipment execution by default.

---

## Browser/runtime smoke posture

Status: **preflight-only executed; full browser checkout not claimed**.

A full browser checkout smoke is not executed in this workspace because stable execution would require running backend/storefront services, a seeded cart/runtime, database state, and realistic ApiShip Store API responses. Live ApiShip credentials and external ApiShip calls are explicitly out of scope for this evidence block.

Instead, the integration completion smoke adds an executable local preflight that validates the runtime wiring and browser-facing checkout projection without running services or calling ApiShip:

```bash
node scripts/apiship-runtime-preflight-smoke.mjs
```

The preflight validates:

1. Medusa config still registers `@gorgo/medusa-fulfillment-apiship` as the ApiShip/Gorgo fulfillment provider;
2. checkout readiness guards remain wired on Store payment-session creation and cart completion;
3. shipment execution guards remain wired for Admin fulfillment create/cancel routes and still require exact `APISHIP_SHIPMENT_EXECUTION_ENABLED=true` opt-in;
4. `GET /admin/apiship/diagnostics` remains Admin-authenticated and backed by the redacted diagnostics module, with explicit limitations for no external ApiShip health call, no live shipment execution, no online auth validation, and no sensitive values returned;
5. storefront checkout helper code calls direct `/store/apiship/*` providers, points, and calculate endpoints, then commits the selected method through the standard Medusa shipping-method flow with `data.apishipData`;
6. storefront checkout/payment/review wiring uses the internal delivery readiness projection for ApiShip.

A future full browser smoke may be added only with a local mock Store API or isolated seeded runtime and must verify only the buyer-facing ApiShip pickup-point flow:

1. checkout delivery step loads ApiShip pickup points/tariffs through `/store/apiship/*` semantics;
2. shopper selects a PVZ and tariff;
3. cart shipping method is saved through the standard Medusa cart shipping-method flow with `data.apishipData`;
4. payment progression is blocked until the saved selection passes the ApiShip readiness predicate;
5. no Admin fulfillment create/cancel path is exercised unless live shipment execution is separately opted in and reviewed.

---

## Final integration confirmation

Status: **ApiShip/Gorgo baseline integration complete for the scoped pre-production template baseline**.

Commit map for accepted integration/follow-up blocks:

- `e74d20e2ab8fd5cffc4dc1e3a6df064590f9871b` — deterministic baseline smoke/evidence;
- `854aa849a22bc152e2c2ddf5a1165801ae49d87b`, `f11ce0ba4e90e2aa25e61c9a4c8eee5334b54888`, `fc50adbc8d7dd17e8ff2079b88a4afad16ae4fc2` — optional courier contract/scaffold and accepted fixes;
- `ea369e4fb906242693ff2aa4c587e8a05fe58f14` — richer customer-facing pricing policy metadata;
- `997240c5f526755adb82ecd6f52d44fd22f67003` — ApiShip admin/operator diagnostics;
- this browser/runtime follow-up — executable preflight-only runtime wiring smoke and final integration evidence.

Completion boundaries:

- ApiShip/Gorgo is the current delivery baseline for fresh templates.
- Direct `/store/apiship/*` remains canonical for Store API reads/calculation.
- Checkout readiness guard and shipment execution default-off guard are active.
- Operator diagnostics route/module exists and is secret-safe/offline by design.

Remaining limitations:

- This artifact does not claim a full browser checkout pass against running backend/storefront services.
- This artifact does not claim online ApiShip auth validation, provider health, pickup-point availability, label/document generation, shipment creation/cancel/tracking, or production fulfillment parity.
- Live ApiShip shipment execution remains default-off and must not be enabled without a separately reviewed opt-in phase.

---

## Guardrails

This smoke/evidence block does not perform and must not be used as evidence for:

- live browser checkout against an external ApiShip runtime;
- online ApiShip credential/auth validation;
- live ApiShip shipment creation, cancellation, tracking, labels, or documents;
- package dependency changes or service orchestration;
- database cleanup or physical cleanup beyond already accepted scoped artifacts;
- live shipment execution parity.

Those remain separately scoped follow-up blocks.
