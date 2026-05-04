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

Decision: choose Variant A, fast cutover to ApiShip API.

Variant A means:

- The storefront directly uses plugin-specific `/store/apiship/*` endpoints.
- The storefront does not preserve `/store/delivery/*` as a facade in the first version.
- Checkout commits delivery through the standard Medusa add-shipping-method-to-cart flow.
- The selected ApiShip payload is passed as `apishipData` when adding the shipping method to the cart.
- Any Delivery Hub-specific readiness wrapper is not part of the first cutover.
- A backend readiness wrapper can be reintroduced later as a separate boilerplate-grade hardening stage if the template needs a stable provider-neutral API again.

Non-selected alternative:

- Variant B, keeping `/store/delivery/*` as a provider-neutral facade, is intentionally not selected for the first version.
- Variant B may be reconsidered later only if multiple delivery providers or a stable boilerplate abstraction become explicit requirements.

Exit criteria:

- The normal checkout path no longer depends on `/store/delivery/*`.
- The selected shipping method is added to the cart with `apishipData`.
- The Phase 5 implementation does not contain a new Delivery Hub compatibility facade.

### Phase 6 — Deactivate Delivery Hub from fresh baseline

Goal: make ApiShip/Gorgo the active baseline without prematurely deleting historical code/data.

Actions:

- Disable Delivery Hub baseline wiring in fresh bootstrap/seed/config paths.
- Stop presenting Delivery Hub as the current default in operational docs.
- Keep existing Delivery Hub docs as historical/evidence until cleanup is safe.
- Avoid destructive cleanup before ApiShip smoke passes.

Exit criteria:

- Fresh bootstrap uses ApiShip/Gorgo as the delivery baseline.
- Delivery Hub is inactive for new templates.

### Phase 7 — Frontend readiness gate

Goal: prevent shoppers from moving forward before ApiShip pickup-point selection is complete.

Actions:

- Gate payment progression in the storefront until an ApiShip pickup point is selected and saved.
- Treat this as an acceptable first-stage frontend gate for the pre-production cutover.
- Do not block the first release on a backend readiness wrapper.

Exit criteria:

- Shopper cannot proceed to payment without saved ApiShip delivery selection.
- The first-stage guard is simple and visible in the checkout UX.

### Phase 8 — Smoke and regression verification

Goal: prove the ApiShip baseline works before deleting Delivery Hub residue.

Actions:

- Add or update browser smoke coverage for cart -> checkout delivery -> ApiShip pickup point -> add shipping method -> payment readiness.
- Verify fresh bootstrap path.
- Verify typecheck/lint/test commands required by the repository at the time of implementation.
- Capture evidence that normal checkout uses `/store/apiship/*`, not `/store/delivery/*`.

Exit criteria:

- ApiShip checkout smoke passes.
- Fresh bootstrap smoke passes.
- No normal checkout request depends on Delivery Hub Store API routes.

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
