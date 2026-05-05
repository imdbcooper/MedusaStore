# ApiShip/Gorgo Direct Migration Plan

> Status: planned baseline pivot, pre-production documentation decision.
>
> Decision date: 2026-05-04.
>
> Scope: documentation-only plan for replacing the Delivery Hub baseline delivery contour with ApiShip/Gorgo.

---

## Purpose

This document fixes the direct cutover plan for migrating the delivery baseline from Delivery Hub to ApiShip/Gorgo.

The project is not in production, so the migration can be treated as a baseline pivot for a fresh template rather than as a backward-compatible production migration. There is no requirement in this plan to preserve old customer carts, old orders, old Delivery Hub checkout payloads, or legacy delivery Store API compatibility for already-created sessions.

The target result is a new baseline delivery contour built around `@gorgo/medusa-fulfillment-apiship`.

---

## Explicit decision

Decision: Delivery Hub is no longer the baseline delivery contour. The new baseline is `@gorgo/medusa-fulfillment-apiship`.

Phase 0 freeze: this decision is locked before runtime work starts. Until a later phase explicitly changes implementation scope, Delivery Hub must not be treated as the target baseline for fresh templates, and ApiShip/Gorgo is the only delivery baseline target for this migration.

Implications:

- Delivery Hub is treated as the previous baseline and should be deactivated from the fresh-template baseline first.
- ApiShip/Gorgo becomes the delivery path that new boilerplate users see by default.
- The first implementation should optimize for a fast, simple cutover instead of preserving the previous `/store/delivery/*` Store API shape.
- Because this is pre-production, backward compatibility for old Delivery Hub carts/orders is not a launch requirement.
- Any historical Delivery Hub data that remains in a local/staging database is residue and should not be treated as active baseline behavior.

---

## Key decisions before implementation

| Topic | Decision |
| --- | --- |
| Storefront Store API | Use plugin-specific `/store/apiship/*` endpoints directly. |
| Phase 5 API shape | Choose Variant A: direct ApiShip Store API cutover. Do not keep `/store/delivery/*` as a facade in the first version. |
| Shipping method commit | Use the standard Medusa cart shipping-method flow and pass `apishipData` with the selected ApiShip delivery payload. |
| Customer-facing price | Start with the ApiShip tariff as the customer-facing shipping price unless a separate pricing-policy requirement is introduced. |
| Initial delivery mode | Baseline pickup-point/PVZ first. Courier delivery is optional and can be added later. |
| Delivery Hub removal | Deactivate Delivery Hub from the baseline first; perform physical cleanup only after successful smoke verification. |
| Readiness protection | A frontend gate is acceptable for the first cutover. Backend guard/readiness wrapper is boilerplate-grade hardening and can be added later. |
| Compatibility | No requirement to maintain old Delivery Hub carts/orders or `/store/delivery/*` compatibility in the first pre-production cutover. |

---

## Migration phases

### Phase 0 — Freeze decision and scope

Goal: lock the migration as a direct baseline pivot before any runtime work.

Actions:

- Record that Delivery Hub is no longer the target baseline.
- Record that `@gorgo/medusa-fulfillment-apiship` is the new target baseline.
- Treat the work as pre-production migration with no backward-compatibility requirement for historical carts/orders.
- Avoid changing runtime code, package manifests, or environment files during the documentation phase.

Exit criteria / Phase 0 acceptance:

- This document exists and is linked from the operational documentation map in `Docs/current_work.md`.
- Delivery Hub is explicitly frozen as the previous baseline and is not the target baseline for fresh templates.
- `@gorgo/medusa-fulfillment-apiship` is explicitly frozen as the new target baseline.
- The migration is explicitly scoped as pre-production, with no backward-compatibility requirement for old Delivery Hub carts/orders.
- Phase 5 Variant A is explicitly selected for the future checkout API shape.
- Phase 0 changes are documentation/status only: no runtime source, package manifests, or environment files are changed by this phase.
- These criteria are sufficient for Phase 1 to start inventory work without reopening the baseline decision.

### Phase 1 — Inventory current Delivery Hub integration

Goal: identify Delivery Hub surfaces that need to be deactivated, replaced, or cleaned later.

Actions:

- Inventory storefront calls to Delivery Hub Store API routes.
- Inventory backend Delivery Hub modules, routes, settings surfaces, scripts, smokes, and seed/bootstrap behavior.
- Separate buyer-facing checkout behavior from admin diagnostics and historical evidence docs.
- Mark Delivery Hub documents as historical where needed after the ApiShip baseline is implemented.

Exit criteria:

- A migration checklist exists for runtime work.
- No cleanup starts before replacement paths are known.

### Phase 2 — Prepare ApiShip/Gorgo backend baseline

Goal: install and configure ApiShip/Gorgo as the new fulfillment baseline in a future implementation PR.

Actions:

- Add `@gorgo/medusa-fulfillment-apiship` in the runtime implementation task, not in this documentation task.
- Configure the Medusa module/provider according to the plugin contract.
- Define the minimum environment contract for ApiShip sandbox/live credentials.
- Ensure bootstrap/seed can create the baseline stock-location/provider relationship for ApiShip.

Exit criteria:

- Backend boots with ApiShip/Gorgo as the intended delivery provider.
- Delivery Hub is not required for fresh bootstrap delivery readiness.

### Phase 3 — Model baseline delivery method

Status: complete for canonical contour contract in commit scope; shipping-option creation/sync remains Phase 4+ runtime work.

Goal: define the buyer-facing delivery method for the first ApiShip baseline.

Actions:

- Make PVZ/pickup-point the initial baseline mode.
- Keep courier delivery out of the first baseline unless separately requested.
- Create or sync the Medusa shipping option needed for the ApiShip pickup-point flow.
- Keep provider internals out of buyer-facing responses.

Exit criteria:

- Canonical default fulfillment contour is now ApiShip/Gorgo with provider id `apiship_apiship`, provider code `apiship`, primary adapter `gorgo_apiship`, `live_execution_enabled: false`, buyer-facing mode `pickup_point_first`, and courier delivery marked `optional_later`.
- Fresh template has one clear buyer-facing ApiShip pickup-point path.
- Courier can be added later without blocking the baseline cutover.
- Medusa shipping option creation/sync, stock-location/provider linking, storefront `/store/apiship/*` checkout flow, and `apishipData` shipping-method commit are explicitly deferred to Phase 4+ implementation tasks.

### Phase 4 — Seed/bootstrap ApiShip shipping option baseline

Status: complete in runtime scope for fresh bootstrap seed; checkout UX remains Phase 5/6.

Goal: make fresh bootstrap create the Medusa shipping option needed for the first ApiShip/Gorgo pickup-point baseline.

Actions:

- Link the baseline stock location to ApiShip provider id `apiship_apiship`.
- Keep the baseline stock location / fulfillment set / service zone relationship intact.
- Create the calculated ApiShip pickup-point/PVZ-first shipping option with plugin option data `id: "apiship_doortopoint"`, `deliveryType: 2`, and `pickupType: 1`.
- Do not create a courier baseline until checkout/API requirements for courier are explicitly added.

Exit criteria:

- Fresh bootstrap produces an ApiShip/Gorgo pickup-point shipping option for provider `apiship_apiship`.
- Fresh bootstrap no longer relies on Delivery Hub/manual shipping-option seeding for the delivery contour.
- Storefront checkout flow, direct `/store/apiship/*` reads, and `apishipData` shipping-method commit remain deferred to Phase 5/6.

### Phase 5 — Checkout commit API shape: Variant A selected

Status: complete for Store API contract and storefront helper stubs; UI migration remains Phase 6+.

Decision: choose Variant A, fast cutover to ApiShip API.

Variant A means:

- The storefront directly uses plugin-specific `/store/apiship/*` endpoints.
- The storefront does not preserve `/store/delivery/*` as a facade in the first version.
- Checkout commits delivery through the standard Medusa add-shipping-method-to-cart flow.
- The selected ApiShip payload is passed as `apishipData` when adding the shipping method to the cart.
- Any Delivery Hub-specific readiness wrapper is not part of the first cutover.
- A backend readiness wrapper can be reintroduced later as a separate boilerplate-grade hardening stage if the template needs a stable provider-neutral API again.

Confirmed ApiShip/Gorgo Store API contract from installed `@gorgo/medusa-fulfillment-apiship@0.5.1`:

| Purpose | Endpoint | Request | Response | Notes |
| --- | --- | --- | --- | --- |
| Delivery providers | `GET /store/apiship/providers` | No body/query required. | `{ providers: StoreApishipProvider[] }`, where provider fields include `key`, `name`, and `description`. | Route exists in the plugin Store API and is the source for provider metadata. |
| Pickup points / PVZ | `GET /store/apiship/points` | Optional query: `key`, `filter`, `fields`, `limit`, `offset`. | `{ points: StoreApishipPoint[] }`, where points follow ApiShip `PointObject`. | Plugin middleware validates the query with default `limit: 50`, `offset: 0`; `key` enables plugin cache lookup. |
| Shipping calculation | `POST /store/apiship/:shipping_option_id/calculate` | JSON body `{ cart_id: string }`. | `{ calculation: StoreApishipCalculation }`, following ApiShip calculator response. | The route calls Medusa `calculateShippingOptionsPricesWorkflow` for the provided ApiShip shipping option and returns the provider calculation data. |
| Shipping method commit | Standard Medusa Store API add-shipping-method-to-cart flow, e.g. `POST /store/carts/:cart_id/shipping-methods`. | Body contains `option_id: <shipping_option_id>` and `data: { apishipData: { tariff, point? } }`. | Standard Medusa cart/shipping-method response. | ApiShip provider reads `data.apishipData.tariff` for customer-facing price and fulfillment, plus optional `data.apishipData.point.id` for PVZ delivery. |
| Shipping method removal | `DELETE /store/shipping-methods/:sm_id` | Path parameter `sm_id`. | `{ id, object: "shipping_method", deleted: true }`. | Plugin route exists for storefront cleanup when replacing/removing a selected shipping method. |

Backend routing note:

- The installed plugin ships its own Store API middleware for `GET /store/apiship/points` and `POST /store/apiship/:shipping_option_id/calculate`; `GET /store/apiship/providers` is exposed as a plugin Store route without additional auth middleware.
- No project-level `middlewares.ts` change is required for Phase 5 because these routes are under the normal Store API namespace and use the same `storeCors` project configuration as other Store endpoints.
- Existing `/store/delivery/*` routes may remain in the repository temporarily as inactive Delivery Hub residue and deferred cleanup, but they are not the canonical first-version storefront API and must not be used by the normal ApiShip checkout path.

Phase 5 storefront contract helpers:

- New helper stubs may call `GET /store/apiship/providers`, `GET /store/apiship/points`, `POST /store/apiship/:shipping_option_id/calculate`, and standard Medusa cart shipping-method commit with `data.apishipData`.
- Phase 6 must wire checkout UI directly to these helpers/endpoints, not to `/store/delivery/*`.

Non-selected alternative:

- Variant B, keeping `/store/delivery/*` as a provider-neutral facade, is intentionally not selected for the first version.
- Variant B may be reconsidered later only if multiple delivery providers or a stable boilerplate abstraction become explicit requirements.

Exit criteria:

- The canonical Store API contract is `/store/apiship/*` first for providers, pickup points, and calculation.
- The normal checkout path no longer depends on `/store/delivery/*` after Phase 6 UI wiring.
- The selected shipping method is added to the cart with `apishipData` through the standard Medusa Store API cart shipping-method flow.
- The Phase 5 implementation does not contain a new Delivery Hub compatibility facade.

### Phase 6 — Storefront checkout migration to direct ApiShip

Status: complete for storefront checkout UI cutover in Phase 6 scope; backend payment/readiness guard remains deferred to Phase 7+ hardening.

Goal: make the buyer-facing checkout delivery step ApiShip/Gorgo-first without deleting historical Delivery Hub code/data.

Actions:

- Wire normal checkout delivery UI directly to the Phase 5 `/store/apiship/*` Store API helpers for providers, pickup points, and cart shipping-option calculation.
- Detect the ApiShip pickup-point shipping option by provider id `apiship_apiship` and/or option data id `apiship_doortopoint` when these fields are present on the storefront option.
- Implement the initial PVZ/pickup-point-first fallback UI as a list/search selector plus tariff selector; map UI is optional later hardening because it requires separate map integration and key management.
- Save the selected ApiShip tariff/PVZ through the standard Medusa add-shipping-method flow with `data.apishipData`.
- Gate payment progression in the storefront delivery step until a valid ApiShip tariff and PVZ are selected and the shipping method is saved.
- Phase 6 fix hardens the frontend gate with a shared ApiShip checkout readiness predicate and normalizes persisted tariffs to the provider contract shape (`tariffId`, `providerKey`, `deliveryCost`); backend readiness/payment guard remains deferred to Phase 7+ hardening.
- Keep legacy Delivery Hub Store API routes/modules in the repository as inactive historical residue; do not use `/store/delivery/*` in the normal checkout path.

Exit criteria:

- Normal checkout delivery UI calls direct ApiShip helpers instead of Delivery Hub data helpers/facades.
- Shopper can choose an ApiShip PVZ and tariff and save the shipping method with contract-shaped `apishipData`.
- Frontend-only payment progression gate is active in the shipping step, payment step, and place-order buttons.
- Backend readiness/payment guard is not added in this phase and remains deferred to Phase 7+.

### Phase 7 — Backend payment/readiness guard

Status: complete for backend checkout hardening; Phase 7 review fix removed an invalid Query Graph field from the readiness cart retrieval; live fulfillment/shipment execution remains Phase 8+.

Goal: prevent shoppers from initializing payment or placing an order unless the cart has a valid saved ApiShip pickup-point delivery selection.

Actions:

- Add an ApiShip-first server-side checkout readiness predicate in `medusa-agency-boilerplate/src/modules/apiship-checkout-readiness.ts`.
- Enforce the guard from `medusa-agency-boilerplate/src/api/middlewares.ts` on `POST /store/payment-collections/:id/payment-sessions` before payment session creation and on `POST /store/carts/:id/complete` before order placement.
- Validate that the selected shipping method belongs to ApiShip (`apiship_apiship`, provider code `apiship`, or option data id `apiship_doortopoint`), contains `data.apishipData`, has `tariff.tariffId`, `tariff.providerKey`, numeric `tariff.deliveryCost`, and a PVZ `point.id`.
- When `apishipData.contextKey` is persisted by the Phase 6 frontend gate, compare it against the current cart/address/shipping-option context and fail closed on explicit mismatch.
- Keep the normal checkout path ApiShip-first; do not reintroduce `/store/delivery/*` as the canonical readiness facade.
- Do not execute live shipment creation, fulfillment execution, tracking, cancellation, labels/documents, or cleanup of Delivery Hub residue in this phase.

Exit criteria:

- Frontend gate from Phase 6 is complemented by backend enforcement on payment-session initialization and order placement.
- Server-side guard rejects missing shipping method, non-ApiShip/manual shipping method, missing `apishipData`, missing tariff/point contract fields, and explicit context mismatch.
- Phase 7 remains checkout readiness hardening only; live shipment execution and smoke/regression expansion stay Phase 8+.

### Phase 8 — ApiShip shipment execution safety guard

Status: complete for default-off fulfillment/shipment execution hardening; Phase 8 review fix removed the unsafe order fulfillment fallback to the first shipping method when `shipping_option_id` is omitted; browser smoke and fresh bootstrap regression remain deferred to Phase 9+.

Goal: prevent accidental live ApiShip shipment execution while keeping checkout shipping-method commit, payment readiness, and order placement operational.

Actions:

- Confirmed installed `@gorgo/medusa-fulfillment-apiship@0.5.1` calls external ApiShip APIs from fulfillment provider execution methods: `ordersApi.addOrder` in `createFulfillment`, `ordersApi.cancelOrder` in `cancelFulfillment`, `ordersApi.getOrderInfo` and `orderDocsApi.getLabels` for tracking/labels, and `orderDocsApi.getWaybills` for documents.
- Confirmed the plugin chooses sandbox vs live by persisted ApiShip `is_test`: `true` maps to `http://api.dev.apiship.ru/v1`, `false` maps to `https://api.apiship.ru/v1`.
- Added project-level route-boundary guard in `medusa-agency-boilerplate/src/modules/apiship-shipment-execution-guard.ts` and wired it through `medusa-agency-boilerplate/src/api/middlewares.ts` before known Medusa Admin fulfillment creation/cancellation boundaries.
- Added explicit opt-in env `APISHIP_SHIPMENT_EXECUTION_ENABLED`; only the exact value `true` allows ApiShip fulfillment execution. Missing, `false`, or truthy-looking values such as `1`, `yes`, or `TRUE` fail closed.
- Kept checkout shipping-method commit separate from shipment execution: `/store/apiship/*` calculation, cart shipping-method commit with `apishipData`, payment readiness, and order placement are not disabled by this guard.
- Added targeted unit coverage in `medusa-agency-boilerplate/src/workflows/__tests__/apiship-shipment-execution-guard.unit.spec.ts` for missing/false env blocking, explicit `true` allowing, manual/non-ApiShip execution not blocked, invalid truthy values failing closed, and order-scoped fulfillment creation with no explicit `shipping_option_id` failing closed when any order shipping method belongs to ApiShip while still allowing non-ApiShip-only orders.

Exit criteria:

- ApiShip fulfillment/shipment creation through the known Admin fulfillment routes is blocked by default unless `APISHIP_SHIPMENT_EXECUTION_ENABLED=true` is explicitly set.
- ApiShip cancellation, and therefore external cancel API usage, is blocked by the same default-off guard on known fulfillment cancellation routes.
- Tracking, labels, and documents remain effectively disabled/deferred because plugin fulfillment creation is blocked before `addOrder` can trigger follow-up tracking/label retrieval; later explicit opt-in and smoke are required before live shipment execution parity is considered enabled.
- Manual/non-ApiShip fulfillment is not blocked by the ApiShip guard.
- Order-scoped fulfillment creation without explicit `shipping_option_id` no longer falls back to the first order shipping method: if any order shipping method resolves to ApiShip, the context is treated as ApiShip-risk and remains blocked unless `APISHIP_SHIPMENT_EXECUTION_ENABLED=true`; non-ApiShip-only orders continue through.
- Browser smoke, fresh bootstrap smoke, and Delivery Hub residue cleanup are not part of this Phase 8 commit and remain Phase 9+ work.

Post-Phase 10 follow-up smoke/evidence:

- Baseline smoke evidence now lives in [apiship_baseline_smoke_evidence.md](./apiship_baseline_smoke_evidence.md) and `medusa-agency-boilerplate/src/workflows/__tests__/apiship-baseline-smoke.unit.spec.ts`.
- The smoke is deterministic and non-destructive: it checks ApiShip provider registration, contour `apiship_gorgo`, provider id `apiship_apiship`, seed shipping option data id `apiship_doortopoint`, checkout readiness guard behavior, and default-off shipment execution guard without live credentials or external ApiShip calls.
- A full browser checkout smoke remains deferred until a scoped runtime/mock API task is approved; live shipment execution stays disabled by default.

### Phase 9 — Physical Delivery Hub cleanup after smoke

Goal: remove Delivery Hub runtime residue only after ApiShip is proven.

Actions:

- Remove or quarantine Delivery Hub runtime code, scripts, routes, tests, and seed/bootstrap wiring that are no longer needed.
- Preserve historical documentation/evidence where useful, clearly marked as previous baseline.
- Clean local/staging data residue only with explicit operator approval.

Exit criteria:

- Active runtime no longer includes Delivery Hub as baseline behavior.
- Historical docs no longer conflict with the current ApiShip baseline.

### Phase 10 — Optional boilerplate-grade hardening

Status: complete as decision/evidence scope in [apiship_phase10_optional_hardening_decision.md](./apiship_phase10_optional_hardening_decision.md); no optional hardening item is promoted into the baseline by Phase 10.

Goal: decide whether to add provider-neutral hardening after the direct cutover is stable.

Possible later work:

- Add a backend readiness wrapper if the template needs stronger server-side payment gating.
- Reintroduce a provider-neutral Store API facade only if the boilerplate needs multi-provider abstraction.
- Add richer pricing policy separate from ApiShip tariff.
- Add courier delivery mode.
- Add admin/operator diagnostics for ApiShip health and setup readiness.

Exit criteria:

- Any hardening is scoped as a separate post-cutover task.
- The first baseline remains simple: ApiShip/Gorgo pickup-point checkout through `/store/apiship/*`.

---

## Acceptance criteria

Documentation acceptance for this task:

- A dedicated plan document exists in `Docs/apiship_direct_migration_plan.md`.
- Phase 0 has explicit acceptance criteria that can be reused by later phases without reopening the baseline decision.
- The document explicitly says Delivery Hub is no longer the baseline and `@gorgo/medusa-fulfillment-apiship` is the new baseline.
- The document explicitly says this is pre-production migration with no requirement to preserve backward compatibility for old carts/orders.
- Phase 0 through Phase 10 are recorded.
- Phase 5 explicitly selects Variant A.
- Phase 5 states that storefront uses `/store/apiship/*` directly.
- Phase 5 states that `/store/delivery/*` is not preserved as a facade in the first version.
- Phase 5 states that shipping method commit uses standard Medusa cart shipping-method flow with `apishipData`.
- The plan records the initial customer-facing price policy: ApiShip tariff first unless a separate pricing policy is requested.
- The plan records PVZ/pickup-point as the first baseline and courier as optional later.
- The plan records Delivery Hub deactivation before physical cleanup.
- The plan records frontend gate first and backend guard/readiness wrapper as later hardening.
- No runtime code, package manifests, or environment files are changed by this documentation task.

Implementation acceptance for the future cutover:

- Fresh bootstrap produces an ApiShip/Gorgo delivery baseline.
- Normal storefront checkout calls `/store/apiship/*` for ApiShip quote/pickup-point data.
- Normal storefront checkout does not call `/store/delivery/*` in the first ApiShip baseline.
- Shopper can select a pickup point, add the ApiShip shipping method to the cart with `apishipData`, and proceed to payment.
- Delivery price shown to the shopper equals the ApiShip tariff unless a later pricing-policy requirement changes it.
- Delivery Hub is inactive for fresh templates before physical cleanup is attempted.
- Smoke evidence exists before Delivery Hub runtime cleanup.

---

## Recommended PR / implementation breakdown

1. Documentation baseline PR
   - Add this plan.
   - Update the short operational status in `Docs/current_work.md`.
   - Do not change runtime code, package manifests, or environment files.

2. ApiShip/Gorgo backend baseline PR
   - Add and configure `@gorgo/medusa-fulfillment-apiship`.
   - Add the minimum environment contract.
   - Wire fresh bootstrap/seed to ApiShip/Gorgo.

3. Storefront direct ApiShip checkout PR
   - Replace normal checkout Delivery Hub reads with `/store/apiship/*`.
   - Implement pickup-point selection and customer-facing tariff display.
   - Commit shipping method with `apishipData`.
   - Keep `/store/delivery/*` facade out of the first version.

4. Smoke and readiness PR
   - Add/update browser smoke for ApiShip pickup-point checkout.
   - Add frontend gate for saved ApiShip delivery selection before payment.
   - Verify fresh bootstrap.

5. Delivery Hub deactivation PR
   - Remove Delivery Hub from fresh-template baseline wiring.
   - Mark old Delivery Hub documents and tests as historical/quarantined where needed.
   - Keep destructive cleanup out until smoke is stable.

6. Post-smoke cleanup PR
   - Remove obsolete Delivery Hub runtime residue.
   - Clean local/staging residue only with explicit operator approval.

7. Optional hardening PR
   - Add backend readiness wrapper if needed.
   - Add provider-neutral facade only if the boilerplate explicitly needs it again.
   - Add courier and advanced pricing policy only if they become requirements.

---

## Non-goals for this documentation task

- Do not implement ApiShip/Gorgo runtime integration.
- Do not change package manifests.
- Do not change environment files.
- Do not edit seed/bootstrap code.
- Do not delete Delivery Hub runtime code.
- Do not perform database cleanup.
- Do not introduce a `/store/delivery/*` compatibility facade.
