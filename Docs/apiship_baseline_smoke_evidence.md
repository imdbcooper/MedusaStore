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

## Browser smoke posture

A full browser checkout smoke is not added here because stable execution would require running backend/storefront services and realistic ApiShip Store API responses. Live credentials and external ApiShip calls are explicitly out of scope for this evidence block.

If a future browser smoke is approved, it should use a local mock Store API or isolated seeded runtime and verify only the buyer-facing ApiShip pickup-point flow:

1. checkout delivery step loads ApiShip pickup points/tariffs through `/store/apiship/*` semantics;
2. shopper selects a PVZ and tariff;
3. cart shipping method is saved through the standard Medusa cart shipping-method flow with `data.apishipData`;
4. payment progression is blocked until the saved selection passes the ApiShip readiness predicate;
5. no `/store/delivery/*` facade is required for the normal ApiShip checkout path;
6. no Admin fulfillment create/cancel path is exercised unless live shipment execution is separately opted in and reviewed.

---

## Guardrails

This smoke/evidence block does not perform and must not be used as evidence for:

- provider-neutral delivery abstraction work;
- courier delivery enablement;
- richer pricing-policy work;
- ApiShip admin/operator diagnostics;
- physical Delivery Hub cleanup;
- live ApiShip shipment execution parity.

Those remain separately scoped follow-up blocks.
