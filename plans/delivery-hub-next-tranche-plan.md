# Superseded Delivery Hub accelerated planning artifact

> **Historical / superseded:** this document is a previous-baseline planning artifact from before the ApiShip/Gorgo migration. It described a Delivery Hub/direct Yandex boundary tranche that was relevant to the old baseline only. Do **not** use it as current forward guidance; current delivery guidance lives in ApiShip/Gorgo docs and Delivery Hub quarantine/cleanup materials.

## Historical planning tranche

### Original precise goal, superseded

At the time of this previous baseline, the planned package was intended to prepare a neutral backend/storefront contract contour for `delivery-hub`, introduce explicit boundary wrapping around the legacy helper path, and make review in a dirty tree predictable, while preserving the hard block in [`createFulfillment()`](../src/modules/deliveryhub.ts:119), leaving [`DeliveryHubExecutionLedgerRepositoryAssemblyPersistenceReadinessContour`](../src/modules/delivery-hub/storage/execution-ledger-repository-assembly-scaffold.ts:161) unchanged, and not deleting the removed legacy fulfillment provider.

### Historical batched package outline

1. The historical plan proposed a storefront-facing neutral contract helper layer for `delivery-hub`, so the old shadow boundary would be reviewable rather than ad-hoc preview helpers.
2. The historical plan proposed a legacy-helper boundary seam around the removed storefront legacy provider helper without deleting the then-existing legacy flow: isolation, explicit ownership, and neutral handoff notes only.
3. The historical plan proposed review-friendly contract fixtures and focused seam coverage for backend/storefront neutral payload shapes, so the diff could be checked separately from the dirty tree.
4. The historical plan proposed docs/status sync so that the old review would see honest scope: shadow/storefront preparation done, checkout cutover deferred, and `createFulfillment` block preserved.

## Historical substeps

### 1. Historical shared neutral storefront contract boundary

The previous-baseline plan expected a storefront-only sanctioned contract module for reading and normalizing `delivery-hub` store responses. It was meant to rely on then-existing backend public routes and explicitly avoid checkout cutover claims.

- Canonical neutral types, guards, and normalizers were to be isolated in storefront `delivery-hub` data/util surfaces.
- `catalog`, `quotes`, `pickup-points`, `pickup-windows`, `selection`, and `readiness` were to be separated as neutral-only contracts.
- Provider/internal fragments were to be forbidden at the boundary level as declared in [`Docs/delivery_hub_spec.md`](../Docs/delivery_hub_spec.md).

### 2. Historical storefront delivery boundary stayed neutral under the previous Delivery Hub baseline

The previous-baseline plan kept the storefront boundary neutral without restoring removed provider-specific helpers/routes. Delivery Hub/direct Yandex is now historical context after the ApiShip/Gorgo migration, and the standard shipping method commit remains generic/provider-neutral.

- Storefront call-sites were expected to use neutral Delivery Hub save/clear/summary helpers and avoid removed provider-specific routes/helpers.
- Neutral handoff mapping was expected to stay near the `delivery-hub` helper path; the commit was limited to existing Medusa shipping option ids without provider-specific payloads.
- Comments or contract docs at storefront call-sites were expected to state: Delivery Hub/direct Yandex was the previous-baseline historical contour; the current baseline is ApiShip/Gorgo; neutral save/clear/summary existed in the old contour; live shipment dispatch stayed gated/not enabled.

### 3. Historical reviewable contract fixtures and focused tests

The previous-baseline plan expected an isolated fixture/test set proving neutral contract path and boundary behavior without a live cutover.

- Fixture-level examples were planned for safe `catalog`, `quotes`, `selection`, and `readiness` payloads.
- Focused tests were planned for leaked provider/internal fragment rejection in the storefront helper layer.
- Parity-style tests were planned to show that generic shipping method commit semantics remained provider-neutral and did not claim live Delivery Hub shipment dispatch.

### 4. Historical review surfaces for a dirty tree

The previous-baseline package was meant to stay reviewable in a dirty tree by explicitly separating its diff surface.

- Status/docs were to clarify that the package was a boundary tranche, not a code cutover.
- Exact include/exclude scope was to be fixed for the reviewer.
- A one-pass review checklist was to cover neutral contracts, legacy boundary, and preserved non-goals.

## Historical in-scope files from the superseded plan

### Backend docs and status

- [`Docs/delivery_hub_spec.md`](../Docs/delivery_hub_spec.md)
- [`Docs/current_work.md`](../Docs/current_work.md)
- [`plans/delivery-hub-next-tranche-plan.md`](./delivery-hub-next-tranche-plan.md)

### Storefront neutral contract path

- [`medusa-agency-boilerplate-storefront/src/lib/data/delivery-hub.ts`](../medusa-agency-boilerplate-storefront/src/lib/data/delivery-hub.ts)
- [`medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub.ts`](../medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub.ts)
- [`medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub-preview.ts`](../medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub-preview.ts)

### Storefront legacy boundary and call-sites

- removed storefront legacy delivery helper
- [`medusa-agency-boilerplate-storefront/src/lib/data/cart.ts`](../medusa-agency-boilerplate-storefront/src/lib/data/cart.ts)
- [`medusa-agency-boilerplate-storefront/src/modules/checkout/components/shipping/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/checkout/components/shipping/index.tsx)
- [`medusa-agency-boilerplate-storefront/src/modules/checkout/components/shipping-summary/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/checkout/components/shipping-summary/index.tsx)

### Focused tests

- [`medusa-agency-boilerplate-storefront/src/lib/data/__tests__/delivery-hub*.test.*`](../medusa-agency-boilerplate-storefront/src/lib/data/__tests__/delivery-hub*.test.*)
- [`medusa-agency-boilerplate-storefront/src/lib/util/__tests__/delivery-hub*.test.*`](../medusa-agency-boilerplate-storefront/src/lib/util/__tests__/delivery-hub*.test.*)
- medusa-agency-boilerplate-storefront/src/lib/data/__tests__/legacy provider*.test.*

## Historical out-of-scope files from the superseded plan

### Backend execution and fulfillment block surfaces

- [`src/modules/deliveryhub.ts`](../src/modules/deliveryhub.ts)
- [`src/modules/delivery-hub/fulfillment-provider-bridge.ts`](../src/modules/delivery-hub/fulfillment-provider-bridge.ts)
- [`src/modules/delivery-hub/shipment-execution-contract.ts`](../src/modules/delivery-hub/shipment-execution-contract.ts)
- [`src/modules/delivery-hub/storage/execution-ledger-repository-assembly-scaffold.ts`](../src/modules/delivery-hub/storage/execution-ledger-repository-assembly-scaffold.ts)
- [`src/modules/delivery-hub/storage/execution-ledger-repository.ts`](../src/modules/delivery-hub/storage/execution-ledger-repository.ts)
- [`src/modules/delivery-hub/storage/execution-ledger-pg-repository.ts`](../src/modules/delivery-hub/storage/execution-ledger-pg-repository.ts)

### Legacy backend provider-removal surfaces

- removed backend legacy fulfillment-provider module
- [`src/api/store/delivery/rates/route.ts`](../src/api/store/delivery/rates/route.ts)
- [`src/api/store/delivery/points/route.ts`](../src/api/store/delivery/points/route.ts)

### Cutover-sensitive shopper behavior

- The old guardrail forbade restoring removed provider-specific helpers/routes and preserved provider-neutral standard shipping method commit semantics; Delivery Hub neutral save/clear/summary remained metadata-only; live dispatch stayed gated/not enabled.
- Any admin/store routes that would have expanded the public contract beyond the already materialized neutral response surface were outside the old scope.
- Any runtime paths that would have removed the shipment execution block or changed execution-ledger readiness contour were outside the old scope.

## Historical review strategy for a dirty tree

1. The old package was to be reviewed only as a boundary tranche: neutral helper path, legacy seam, tests, and docs.
2. The old review separated four logical buckets:
   - storefront neutral contract files
   - legacy provider boundary files
   - focused tests
   - docs/status sync
3. The old review explicitly excluded changes in [`createFulfillment()`](../src/modules/deliveryhub.ts:119), [`DeliveryHubExecutionLedgerRepositoryAssemblyPersistenceReadinessContour`](../src/modules/delivery-hub/storage/execution-ledger-repository-assembly-scaffold.ts:161), and backend legacy removal surfaces.
4. If the tree stayed dirty, the old reviewer was expected to compare the package against the scoped file list above and treat unrelated diffs around the removed legacy fulfillment provider as external noise.
5. The old PR or handoff summary was expected to preserve three guardrails:
   - removed provider-specific helpers/routes must not be restored; standard shipping method commit remains generic/provider-neutral
   - `delivery-hub` storefront path was limited to neutral selection metadata save/clear/summary; no live dispatch or provider-specific commit payloads
   - shipment execution and persistence activation remained blocked

## Historical proof signals from the superseded plan

The superseded package would have been considered complete when these previous-baseline signals were all true:

- storefront had an explicit neutral `delivery-hub` helper boundary in sanctioned files [`delivery-hub.ts`](../medusa-agency-boilerplate-storefront/src/lib/data/delivery-hub.ts) and [`delivery-hub.ts`](../medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub.ts)
- the removed storefront legacy delivery helper had an explicit legacy-only boundary, while the then-active flow continued unchanged
- focused tests proved rejection of leaked internal/provider fragments and did not claim storefront cutover
- docs stated that the package advanced neutral contract path and reviewability without removing the hard block in [`createFulfillment()`](../src/modules/deliveryhub.ts:119), changing [`DeliveryHubExecutionLedgerRepositoryAssemblyPersistenceReadinessContour`](../src/modules/delivery-hub/storage/execution-ledger-repository-assembly-scaffold.ts:161), or deleting the removed legacy fulfillment provider
- reviewer could check the package by isolated in-scope file list without approving unrelated dirty-tree diffs

## Historical note about user input

The old plan required no additional user input because it assumed prior approval for the accelerated planning tranche and access to the sibling storefront repository.

## Plain-language historical summary

- The old plan first framed `delivery-hub` as a separate neutral helper path in storefront.
- It then wrapped the removed storefront legacy delivery helper with an explicit boundary without cutting it out.
- It added targeted tests for neutral contracts and internal-field leak prevention.
- It synchronized docs so review would not expect cutover early.
- It did not touch the shipment execution block.
- It did not touch execution-ledger readiness contour.
- It did not declare that storefront had moved to `delivery-hub`.
