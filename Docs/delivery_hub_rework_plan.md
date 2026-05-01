# Delivery Hub rework plan

> Status: accepted execution plan; phases 0/1 through 7 are implemented and reviewed. Phase 8 is the next implementation tranche after the documentation cleanup recorded in [current_work.md](./current_work.md).
>
> Last status update: 2026-05-01.
>
> Purpose: define the practical step-by-step rework needed to turn the current Delivery Hub contour into a clean merchant/admin/shopper/order/shipment flow for a Russian-market Medusa template.
>
> Inputs:
>
> - [`delivery_hub_spec.md`](./delivery_hub_spec.md)
> - [`delivery_hub_checkout_cutover_plan.md`](./delivery_hub_checkout_cutover_plan.md)
> - [`delivery_hub_manual_testing_plan.md`](./delivery_hub_manual_testing_plan.md)
> - [`yandex_delivery_test_api_summary.md`](./yandex_delivery_test_api_summary.md)
>
> This document is the phase plan, not the live operational journal. Use [current_work.md](./current_work.md) for current status and [delivery_hub_documentation_index.md](./delivery_hub_documentation_index.md) for document roles.

---

## 1. Problem statement

The current Delivery Hub implementation has useful foundations, but the product flow is not yet clean enough for a real storefront/admin experience.

The main issue is that these concerns are still mixed:

- Yandex provider quote;
- final shopper-facing shipping price;
- checkout selection;
- shipping-option commit;
- admin diagnostics;
- order fulfillment/shipment operations;
- execution/cutover evidence tooling.

The Yandex research confirms the most important business rule:

> Yandex `pickup-points/list` returns pickup points and coordinates, but not price. `check-price` returns a dynamic provider-side operational quote and must not automatically become the final checkout tariff.

Therefore the Delivery Hub must separate:

- provider operational cost;
- merchant pricing policy;
- customer-facing delivery price;
- shipment execution after order/fulfillment readiness.

---

## 2. Target product model

### 2.1 Shopper checkout model

The shopper should see only a clean delivery choice:

- delivery method label;
- final customer-facing delivery price;
- delivery ETA;
- pickup point list/map;
- pickup point address, network label, schedule if available;
- clear blocked/unavailable messages.

The shopper must not see:

- `connection_id`;
- `quote_key`;
- `quote_reference` internals;
- `warehouse_id`;
- `provider_warehouse_id`;
- `platform_station_id`;
- `check-price`;
- `offers/create`;
- `dropoff`;
- cutover/preflight/diagnostic wording;
- execution references.

### 2.2 Merchant settings model

`Settings -> Delivery` should configure the delivery system:

- Yandex connection and credentials;
- test/live mode;
- sender warehouse/store address;
- warehouse coordinates;
- optional provider warehouse/station mapping;
- enabled delivery modes;
- customer pricing policy;
- pickup point filters;
- shipping option sync to Medusa service zones/profiles;
- advanced diagnostics and logs.

### 2.3 Order admin model

The order page should own shipment operations:

- delivery selection snapshot;
- customer and recipient contact;
- pickup point summary;
- warehouse/source summary;
- parcel/items/package data;
- readiness to create shipment;
- create shipment action;
- provider shipment/tracking status;
- labels/documents when available;
- refresh, cancel, retry actions when allowed.

`Settings -> Delivery` can keep global diagnostics, but it should not be the primary place where an operator processes a real order shipment.

---

## 3. Key architectural decisions to review

### Decision 1: default checkout mode

Use `warehouse_to_pickup_point` as the default shopper checkout mode.

Reason:

- it matches a normal merchant flow: seller warehouse/store -> selected customer PVZ;
- it is consistent with the Yandex research summary;
- `dropoff_point_to_pickup_point` is a separate operational model and should remain admin/diagnostic-only until live route behavior is fully confirmed for the current account/environment.

### Decision 2: customer price is not provider price

Introduce a first-class pricing policy layer.

Provider quote fields should represent operational cost/evidence. Shopper-facing pricing should be represented separately as a calculated merchant price:

- `provider_quote.amount`
- `customer_price.amount`
- `customer_price.source`
- `customer_price.policy_id`
- `customer_price.explanation_code`

The initial pricing policies can be simple:

- fixed price;
- free over threshold;
- pass-through provider quote;
- pass-through plus markup;
- rounded provider quote;
- manual disabled/unavailable.

### Decision 3: checkout must not depend on public warehouse env

Remove storefront dependency on public preview defaults for real checkout behavior.

The backend should resolve:

- default connection;
- default warehouse;
- warehouse coordinates;
- sender contact;
- provider warehouse/station reference;
- provider-origin dispatch context.

The storefront should send only:

- cart id/context;
- address context;
- selected pickup point;
- selected quote/customer price reference.

### Decision 4: order shipment UI belongs to order admin

Real shipment creation/status/cancel/retry must be exposed from an order/fulfillment admin surface, not only from `Settings -> Delivery` by manually pasting `execution_reference`.

### Decision 5: diagnostics stay advanced

The existing cutover, execution ledger, manual sync, and provider diagnostics are valuable, but they should be hidden behind advanced/admin-only sections and not leak into the shopper experience.

---

## 4. Proposed target contracts

### 4.1 Public store quote response

Public store quote should expose a shopper-safe delivery offer:

```ts
type DeliveryHubStoreOffer = {
  offer_reference: {
    id: string
    version: number
  }
  mode_code: "warehouse_to_pickup_point"
  carrier: {
    code: string
    label: string
  }
  customer_price: {
    amount: number
    currency_code: string
    source: "fixed" | "free_threshold" | "provider_quote" | "provider_quote_markup" | "manual"
    policy_id: string | null
  }
  eta: {
    min_days: number | null
    max_days: number | null
  }
  pickup_point_required: boolean
  pickup_window_required: boolean
}
```

Must not expose:

- raw provider body;
- raw Yandex offer id;
- raw `quote_key`;
- auth headers;
- credentials;
- provider execution token;
- backend-only origin dispatch context.

### 4.2 Internal quote record

Internal quote/cache may store:

```ts
type DeliveryHubInternalQuote = {
  quote_reference: {
    id: string
    version: number
  }
  provider_code: "yandex"
  connection_id: string
  mode_code: string
  provider_quote: {
    amount: number | null
    currency_code: string | null
    endpoint_family: "check_price" | "offers_create" | "pricing_calculator"
    raw_reference_redacted: Record<string, unknown>
  }
  customer_price: {
    amount: number
    currency_code: string
    policy_id: string | null
    source: string
  }
  origin_context_backend_only: Record<string, unknown>
  destination_pickup_point: Record<string, unknown>
  expires_at: string | null
}
```

### 4.3 Cart selection

Cart metadata should store the neutral customer-facing selection plus opaque backend reference:

```ts
type DeliveryHubCartSelection = {
  version: number
  connection_id: string
  mode_code: "warehouse_to_pickup_point"
  offer_reference: {
    id: string
    version: number
  }
  customer_price: {
    amount: number
    currency_code: string
    source: string
    policy_id: string | null
  }
  pickup_point: {
    provider_point_id: string
    name: string
    address: string
    city: string | null
    region: string | null
    postal_code: string | null
    lat: number | null
    lng: number | null
    network_label: string | null
  }
  updated_at: string
}
```

Backend-only metadata can additionally keep:

- provider execution reference;
- origin dispatch context;
- provider quote reference;
- quote cache reference;
- idempotency data.

### 4.4 Fulfillment/order handoff

When the order is placed, the handoff should carry:

- immutable delivery selection snapshot;
- committed shipping option id;
- customer-facing delivery price;
- provider quote/cost summary;
- pickup point;
- selected warehouse/source;
- package/items snapshot;
- execution readiness status;
- safe correlation id.

---

## 5. Implementation phases

## Phase 0. Source-of-truth reconciliation

Goal: remove contradictions before coding.

Tasks:

1. Mark `delivery_hub_checkout_cutover_plan.md` as older cutover-readiness context, not the current product rework plan.
2. Reconcile `delivery_hub_spec.md` with the actual state where storefront already has buyer-facing Delivery Hub blocks and save/clear behavior.
3. Add this rework plan to the Delivery Hub document index once approved.
4. Update `current_work.md` only after the user approves this plan as active work.

Definition of Done:

- docs clearly separate current implemented state, proposed target state, and approved active work;
- no document claims that shopper checkout is both preview-only and already productized.

Recommended validation:

```bash
git diff --check
```

---

## Phase 1. Pricing policy layer

Goal: separate Yandex provider cost from customer-facing shipping price.

Backend changes:

- Add delivery pricing policy domain:
  - fixed price;
  - free threshold;
  - provider quote pass-through;
  - provider quote plus markup;
  - rounding;
  - disabled/unavailable.
- Store policy per connection/mode or global Delivery Hub settings.
- Keep provider quote amount as operational cost.
- Compute `customer_price` before returning store offers.
- Persist policy identity/source into cart selection.

Likely files:

- `medusa-agency-boilerplate/src/modules/delivery-hub/domain/quote.ts`
- `medusa-agency-boilerplate/src/modules/delivery-hub/service.ts`
- `medusa-agency-boilerplate/src/modules/delivery-hub/cart-selection.ts`
- `medusa-agency-boilerplate/src/modules/delivery-hub/provider-surface.ts`
- `medusa-agency-boilerplate/src/admin/routes/settings/delivery/page.tsx`
- `medusa-agency-boilerplate/src/admin/routes/settings/delivery/page-state.ts`

Storefront changes:

- show `customer_price`, not raw `quote.amount`;
- show neutral explanation labels like `Бесплатно`, `Фиксированная цена`, `Расчёт по адресу`.

Definition of Done:

- store/public response exposes `customer_price`;
- provider quote remains internal or explicitly marked operational;
- calculated Medusa shipping amount uses `customer_price.amount`;
- tests prove fixed/free/pass-through policies.

Validation:

```bash
cd medusa-agency-boilerplate && npx tsc --noEmit
cd medusa-agency-boilerplate-storefront && npx tsc --noEmit
```

---

## Phase 2. Backend quote orchestration for checkout

Goal: move real checkout quote assembly into backend service boundaries.

Backend changes:

1. Add a checkout-oriented quote endpoint or reshape existing `/store/delivery/quotes`.
2. Resolve default connection and default warehouse server-side.
3. Resolve warehouse origin address/coordinates server-side.
4. Accept selected pickup point id and cart/address context.
5. Build route quote using Yandex `check-price` for `warehouse_to_pickup_point`.
6. Use actual cart line items for weight/value input where available.
7. Return shopper-safe offer with `customer_price`.
8. Store/cache provider quote evidence for later validation.

Storefront changes:

- stop passing public `NEXT_PUBLIC_DELIVERY_HUB_PREVIEW_DEFAULT_WAREHOUSE_ID` in real buyer flow;
- request offers using cart/address/PVZ only;
- keep dev defaults only inside explicit diagnostics block.

Definition of Done:

- buyer quote flow does not need warehouse id in public env;
- warehouse validation errors are admin/operator messages, not shopper internals;
- quote requests use real cart item data or a clearly documented fallback;
- Yandex coordinates requirement is handled before provider call.

Validation:

- unit tests for quote input assembly;
- no-network tests for missing warehouse coordinates;
- mocked store quote route tests.

---

## Phase 3. Pickup point shopper UX

Goal: make PVZ selection a real buyer flow, not a diagnostic selector.

Backend changes:

- Add normalized pickup point response with:
  - id;
  - name;
  - address;
  - network label;
  - city/region/postal code;
  - coordinates;
  - schedule if available;
  - destination pickup allowed flag.
- Add optional local distance sorting support when buyer coordinates are available.
- Keep `available_for_dropoff` internal/advanced unless a mode needs it.

Storefront changes:

- replace diagnostic wording with buyer copy;
- show categories only if they are product-relevant:
  - `Яндекс Маркет`;
  - `Партнерские пункты`;
  - optionally `5 Post`.
- show point list with address and customer price after point selection;
- optionally add map later, but list-first is acceptable for v1.

Definition of Done:

- buyer can select a PVZ without seeing provider internals;
- selecting another PVZ refreshes price/ETA;
- changing address invalidates stale selection;
- no `dropoff` wording appears in shopper UI.

Validation:

- frontend unit/model tests for selector state;
- browser smoke for address -> PVZ -> quote -> save.

---

## Phase 4. Cart selection and shipping method commit

Goal: make Delivery Hub the real checkout source of truth under explicit readiness rules.

Backend changes:

- Validate persisted selection against:
  - active connection;
  - active mode;
  - selected pickup point;
  - quote/customer price reference;
  - cart state;
  - shipping option availability.
- Add explicit expiration/staleness policy for quotes.
- Ensure selection carries enough backend-only provider-origin dispatch data for later shipment creation.

Storefront changes:

- remove product UI around "preview", "cutover", "guard", "commit";
- use a simple CTA:
  - `Сохранить способ доставки`;
  - then proceed to payment when Medusa shipping method is committed.
- keep advanced diagnostics behind feature flag only.

Definition of Done:

- after selected PVZ and saved delivery, Medusa cart has a Delivery Hub shipping method;
- payment step is blocked if Delivery Hub selection/commit is not ready;
- no automatic legacy delivery fallback;
- failure is clear and actionable.

Validation:

```bash
npm run smoke:delivery-hub-cutover:browser
npm run smoke:delivery-hub-rollback:browser
```

Then add a product-flow smoke that does not rely on diagnostic UI labels.

---

## Phase 5. Admin settings cleanup

Goal: make `Settings -> Delivery` merchant-friendly.

Keep in the primary path:

- connection create/edit;
- token write-only state;
- test connection;
- warehouse/store address;
- coordinates;
- pricing policy;
- enabled modes;
- shipping option sync;
- high-level status.

Move to advanced/details:

- raw JSON diagnostics;
- execution-plan preview;
- fulfillment-bridge preview;
- shipment operations by execution reference;
- manual evidence/cutover artifacts;
- provider request summaries.

Add missing admin settings:

- pricing policy editor;
- default checkout mode;
- PVZ filter settings;
- quote TTL;
- free shipping threshold;
- max/min customer price;
- supported package constraints.

Definition of Done:

- a merchant can configure Yandex delivery without understanding `check-price`, `offers/create`, `platform_station_id`, or execution ledger internals;
- advanced diagnostics remain available for developers/operators;
- no secrets or raw provider payloads are shown.

Validation:

- admin page-state unit tests;
- manual smoke through `Settings -> Delivery`.

---

## Phase 6. Order admin shipment widget

Goal: process real delivery from the order page.

Backend/API changes:

- Add order/fulfillment delivery read model:
  - order id;
  - fulfillment id;
  - delivery selection snapshot;
  - shipping option;
  - warehouse/source;
  - pickup point;
  - customer contact;
  - package/items summary;
  - shipment readiness.
- Add admin routes scoped by order/fulfillment:
  - `GET /admin/orders/:id/delivery-hub`
  - `POST /admin/orders/:id/delivery-hub/shipments`
  - `POST /admin/orders/:id/delivery-hub/shipments/:shipment_id/refresh`
  - `POST /admin/orders/:id/delivery-hub/shipments/:shipment_id/cancel`
  - optional retry route with strict idempotency checks.

Admin UI changes:

- Add an order widget/panel.
- Show:
  - delivery method;
  - PVZ;
  - customer contact;
  - package readiness;
  - provider/status;
  - labels/tracking when available;
  - safe logs.
- Provide actions:
  - create shipment;
  - refresh status;
  - cancel shipment;
  - retry only when backend says allowed.

Definition of Done:

- admin does not need to paste `execution_reference` for normal order processing;
- shipment creation is possible only from a ready order/fulfillment;
- duplicate shipment creation is blocked by ledger/idempotency;
- status/cancel/retry actions are state-aware.

Validation:

- no-network order widget tests;
- backend route tests;
- controlled mocked provider dispatch tests;
- manual staging run only after explicit approval.

---

## Phase 7. Shipment execution hardening

Goal: make direct Yandex dispatch production-safe.

Tasks:

1. Keep `DELIVERY_HUB_SHIPMENT_EXECUTION_ENABLED=false` as default.
2. Require explicit operator/staging approval to enable.
3. Persist execution ledger reservation before provider dispatch.
4. Persist dispatch result and shipment record after accepted provider response.
5. Store only redacted provider summaries and safe references.
6. Add status polling/refresh behavior for accepted shipments.
7. Add cancellation policy and state checks.
8. Keep retry narrow and idempotent.

Definition of Done:

- one ready order can create at most one canonical shipment per execution identity;
- accepted provider result is persisted;
- failed provider result is safely classified;
- duplicate/replay/drift cases are blocked;
- labels/tracking are stored only after safe normalization.

Validation:

- existing provider-validation tests extended;
- execution ledger tests;
- accepted/failure/replay/drift tests;
- manual staging evidence bundle.

---

## Phase 8. Remove or quarantine obsolete legacy/cutover surfaces

Goal: reduce confusion after Delivery Hub is the actual checkout path.

Tasks:

- Remove shopper-visible preview/cutover language.
- Keep diagnostics only behind a dev/admin feature flag.
- Archive old evidence-only docs or mark them as historical.
- Remove old provider-specific checkout paths if any remain.
- Keep old order compatibility only where historical orders require it.

Definition of Done:

- storefront has one delivery flow;
- docs do not describe Delivery Hub as preview-only if it is active;
- old cutover docs are clearly historical or approval evidence;
- template fresh start does not require legacy delivery env or runtime routes.

---

## 6. Recommended execution order

Do not start with shipment execution. The safer order is:

1. Reconcile docs.
2. Add pricing policy.
3. Move checkout quote orchestration server-side.
4. Productize PVZ selection UX.
5. Commit Delivery Hub shipping method cleanly.
6. Add order admin shipment widget.
7. Harden and enable shipment execution only under gate.
8. Clean up old preview/cutover/legacy confusion.

This order avoids making live shipment calls before the buyer selection, customer price, cart metadata, and order handoff are correct.

---

## 7. Open questions

These should be resolved before coding beyond Phase 1:

1. Should v1 customer price default be fixed/free-threshold, or pass-through provider quote?
2. Should `dropoff_point_to_pickup_point` be hidden completely from shopper checkout until live confirmation?
3. What package data is mandatory for the template baseline: weight only, or dimensions too?
4. Do we need geocoding for buyer address in v1, or is city-filtered PVZ list enough?
5. Should pickup point map be v1 or post-v1?
6. Which Medusa order/fulfillment extension point should host the order shipment widget?
7. What is the approved staging gate for enabling `DELIVERY_HUB_SHIPMENT_EXECUTION_ENABLED=true`?

Recommended default answers:

- v1 customer price: fixed/free-threshold first, with optional provider quote pass-through;
- shopper mode: `warehouse_to_pickup_point` only;
- package data: weight + simple dimensions fallback, then product-level dimensions later;
- geocoding: post-v1 unless a map UX is required immediately;
- order widget: use Medusa Admin extension/widget surface, not official admin fork;
- shipment execution: staging-only until one full order-to-shipment run is recorded with redacted evidence.

---

## 8. Acceptance criteria for the full rework

The rework is complete when:

- buyer can choose a PVZ and see a final delivery price without provider internals;
- cart stores a neutral Delivery Hub selection;
- Medusa shipping method commit uses Delivery Hub and customer price;
- order page shows the delivery selection and shipment readiness;
- admin can create and operate shipment from the order page;
- settings page is for configuration and diagnostics, not day-to-day order shipment processing;
- provider quote and customer price are separate everywhere;
- `dropoff_point_to_pickup_point` is not the default buyer path until confirmed;
- no secrets/raw provider payloads leak to storefront, logs, docs, or admin UI;
- baseline startup remains safe without mandatory delivery secrets.
