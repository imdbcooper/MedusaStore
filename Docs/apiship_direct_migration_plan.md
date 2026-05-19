# ApiShip/Gorgo Direct Baseline Plan

> Status: current delivery baseline decision.
>
> Decision date: 2026-05-04.
>
> Scope: ApiShip/Gorgo is the active delivery contour for fresh templates.

---

## Purpose

This document records the decision to use ApiShip/Gorgo as the delivery baseline.

The target delivery contour is built around `@gorgo/medusa-fulfillment-apiship` and direct plugin-specific Store API endpoints.

---

## Explicit decision

Decision: the baseline delivery contour is `@gorgo/medusa-fulfillment-apiship`.

Until a later phase explicitly changes implementation scope, ApiShip/Gorgo is the only delivery baseline target for fresh templates.

Implications:

- ApiShip/Gorgo is the delivery path that new boilerplate users see by default.
- The implementation uses a direct ApiShip Store API shape.

---

## Key decisions

| Topic | Decision |
| --- | --- |
| Storefront Store API | Use plugin-specific `/store/apiship/*` endpoints directly. |
| API shape | Direct ApiShip Store API. |
| Shipping method commit | Use the standard Medusa cart shipping-method flow and pass `apishipData` with the selected ApiShip delivery payload. |
| Customer-facing price | Start with the ApiShip tariff as the customer-facing shipping price unless a separate pricing-policy requirement is introduced. |
| Initial delivery mode | Baseline pickup-point/PVZ first. Courier delivery is optional and can be added later. |
| Readiness protection | Frontend readiness gate is accepted for the first baseline; backend guard/readiness wrapper is optional later hardening. |
| Compatibility | No requirement to maintain old carts/orders in the first pre-production baseline. |

---

## Current implementation checkpoints

- Backend boots with ApiShip/Gorgo as the intended delivery provider.
- Fresh bootstrap produces an ApiShip/Gorgo pickup-point shipping option for provider `apiship_apiship`.
- Storefront checkout directly uses plugin-specific `/store/apiship/*` endpoints.
- Checkout commits delivery through the standard Medusa add-shipping-method-to-cart flow.
- The selected ApiShip payload is passed as `apishipData` when adding the shipping method to the cart.
- The normal checkout path is ApiShip-first.

---

## Live shipment execution guard

`APISHIP_SHIPMENT_EXECUTION_ENABLED=false` is the safe default.

Live external shipment execution requires:

1. exact opt-in value `APISHIP_SHIPMENT_EXECUTION_ENABLED=true`;
2. runtime readiness/idempotency guardrails;
3. operator approval for live provider calls.

No baseline path should silently create/cancel/track external shipments without that explicit opt-in.

---

## Evidence

Baseline smoke evidence lives in [apiship_baseline_smoke_evidence.md](./apiship_baseline_smoke_evidence.md) and `medusa-agency-boilerplate/src/workflows/__tests__/apiship-baseline-smoke.unit.spec.ts`.

The smoke is deterministic and non-destructive: it checks ApiShip provider registration, contour `apiship_gorgo`, provider id `apiship_apiship`, seed shipping option data id `apiship_doortopoint`, checkout readiness guard behavior, and default-off shipment execution guard without live credentials or external ApiShip calls.

A full browser checkout smoke remains deferred until a scoped runtime/mock API task is approved; live shipment execution stays disabled by default.

---

## Acceptance summary

- ApiShip/Gorgo is the current delivery baseline for fresh templates.
- Direct `/store/apiship/*` is the canonical Store API contract for providers, pickup points, and calculation.
- The selected shipping method is added to the cart with `apishipData` through the standard Medusa Store API cart shipping-method flow.
- Shopper can select a pickup point, add the ApiShip shipping method to the cart with `apishipData`, and proceed to payment.
- Delivery price shown to the shopper equals the ApiShip tariff unless a later pricing-policy requirement changes it.
- Smoke evidence exists for the deterministic baseline.

---

## Rules

- Do not edit seed/bootstrap code without a scoped delivery baseline task.
- Do not perform database cleanup automatically.
- Do not enable live shipment execution by default.
- Do not introduce a new provider-neutral delivery facade unless a future multi-provider requirement explicitly reopens that architecture.
