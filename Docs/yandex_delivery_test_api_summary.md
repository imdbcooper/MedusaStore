# Yandex Delivery API research summary

Updated: 2026-04-29

---

## Executive summary

1. `pickup-points/list` is the confirmed endpoint for getting Yandex pickup points (PVZ).
2. PVZ responses include coordinates in `position.latitude` / `position.longitude`.
3. `pickup-points/list` does **not** return delivery price.
4. For map/list UX, PVZ coordinates are sufficient; buyer proximity should be sorted locally, not trusted from API response order.
5. `check-price` was practically confirmed as a working quote endpoint for direct route pricing.
6. In practical tests, `check-price` worked reliably only when coordinates were sent.
7. `check-price` behaves like a dynamic provider-side courier quote, not necessarily the final customer checkout tariff.
8. The same route can return different prices at different times, so the result should be treated as a live operational estimate.
9. For a standard merchant checkout, the most practical model is `warehouse/store -> selected customer PVZ`.
10. `warehouse/store -> PVZ` and `dropoff point -> PVZ` are different Yandex logistics flows.
11. `dropoff_point_to_pickup_point` is modeled in project research, but we did **not** live-confirm its quote route on the current sandbox host.
12. We successfully found dropoff-capable origin points using `available_for_dropoff=true`.
13. We did **not** find a public partner tariff table for PVZ→PVZ by city in accessible Yandex docs.
14. Publicly available evidence suggests partner pricing is quote/offer-driven rather than based on a public static tariff matrix.
15. Customer-facing delivery price and merchant/provider operational price should be treated as separate concepts.

---

## 1. Purpose of this document

This document summarizes what was actually confirmed during practical research of Yandex Delivery test APIs for these questions:

1. how to get pickup points (PVZ);
2. how to calculate delivery price;
3. whether PVZ list returns price;
4. whether coordinates are required;
5. how warehouse/store → PVZ differs from PVZ → PVZ;
6. whether public partner tariff tables exist;
7. what is confirmed, what is inferred, and what is still unconfirmed.

This version intentionally removes or corrects earlier assumptions that turned out to be incomplete or misleading.

---

## 2. High-level conclusions

### Confirmed
- Yandex test API returns pickup points through `pickup-points/list`.
- Pickup point responses include coordinates.
- `pickup-points/list` does **not** return price.
- Price for direct address-based courier movement was successfully returned by `check-price`.
- In practical tests, `check-price` required coordinates to work reliably.
- `check-price` behaves like a **provider-side courier quote**, not a guaranteed final customer-facing checkout tariff.
- For Yandex integration logic, `warehouse -> pickup_point` and `dropoff_point -> pickup_point` are two different provider flows.
- Public docs available to us do **not** expose a public partner tariff table for PVZ→PVZ by city.

### Strongly indicated by project docs/spec
- `warehouse_to_pickup_point` should use a warehouse-origin quote flow.
- `dropoff_point_to_pickup_point` should use a pickup-point-origin offer flow.
- `courier_pickup_to_pickup_point` exists conceptually but is deferred in the current project slice.

### Not fully confirmed in our live/sandbox tests
- A working sandbox route for `dropoff_point_to_pickup_point` pricing via `offers/create`.
- A public fixed tariff table for partner PVZ→PVZ prices by city.
- A sandbox-confirmed direct customer-facing quote for PVZ→PVZ in another city.

---

## 3. Pickup points (PVZ): how to get them

### Working endpoint

```http
POST https://b2b.taxi.tst.yandex.net/api/b2b/platform/pickup-points/list
```

### Headers used

```http
Authorization: Bearer <test-token>
Content-Type: application/json
Accept: application/json
Accept-Language: ru
```

### Confirmed request variants

#### Minimal country filter
```json
{
  "country": "RU",
  "limit": 10
}
```

#### Country + city
```json
{
  "country": "RU",
  "city": "Москва",
  "limit": 10
}
```

#### Country + address
```json
{
  "country": "RU",
  "address": {
    "fullname": "125009, Москва, Тверская 1"
  },
  "limit": 10
}
```

#### Country + city + address
```json
{
  "country": "RU",
  "city": "Москва",
  "address": {
    "fullname": "125009, Москва, Тверская 1"
  },
  "limit": 5
}
```

#### City/region filtering via `geo_id`
```json
{
  "geo_id": 213,
  "limit": 8
}
```

```json
{
  "geo_id": 2,
  "limit": 8
}
```

#### Dropoff-capable origin points
```json
{
  "geo_id": 213,
  "available_for_dropoff": true,
  "limit": 10
}
```

### What the response contains

Confirmed response fields include:
- `id`
- `operator_station_id`
- `operator_id`
- `name`
- `type`
- `position.latitude`
- `position.longitude`
- `address.*`
- `payment_methods`
- `schedule`
- `available_for_dropoff`
- `pickup_services`

### Important conclusion

`pickup-points/list` is a **catalog/listing endpoint**, not a pricing endpoint.

---

## 4. Does `pickup-points/list` return price?

No.

In practical responses we did **not** get pricing fields such as:
- `price`
- `cost`
- `amount`
- `currency`

### Conclusion

`pickup-points/list` gives:
- pickup point IDs,
- metadata,
- location,
- dropoff capability,
- display information.

It does **not** give delivery price.

---

## 5. Coordinates: are they available and how should they be used?

### For pickup points
Yes. Pickup point coordinates come directly from Yandex in:
- `position.latitude`
- `position.longitude`

So PVZ can be:
- shown on a map,
- sorted locally by distance,
- used as destination coordinates for pricing logic.

### For normal seller/customer addresses
No automatic coordinate resolution was confirmed inside the Yandex Delivery quote request itself.

In our successful direct `check-price` tests, we supplied coordinates manually as already-known values.

### Practical conclusion
- For PVZ: coordinates can be taken from `pickup-points/list`.
- For warehouse/store/customer address: coordinates should be obtained separately or stored internally.

---

## 6. Does Yandex sort pickup points by proximity to the customer address?

Not reliably, based on our tests.

We compared responses for:
- Moscow address (`Тверская 1`),
- Saint Petersburg address (`Невский проспект, 1`),
- and `geo_id` based filters.

### What we observed
- `city/address` in the request did not produce a clearly trustworthy nearest-first ordering.
- `geo_id` helped constrain the region/city.
- Response ordering should **not** be treated as a guaranteed nearest-PVZ ranking.

### Recommended approach
If proximity matters:
1. get buyer coordinates,
2. get PVZ list,
3. use `position.latitude/longitude`,
4. calculate distance locally,
5. sort locally.

---

## 7. Direct price calculation via `check-price`

### Working endpoint confirmed in practice

```http
POST https://b2b.taxi.tst.yandex.net/b2b/cargo/integration/v2/check-price
```

### Headers used

```http
Authorization: Bearer <test-token>
Content-Type: application/json
Accept: application/json
Accept-Language: ru
```

### What this endpoint behaves like
In practice, `check-price` behaves like a **provider-side courier quote** for a route.

The response contains fields such as:
- `price`
- `distance_meters`
- `eta`
- `zone_id`
- `requirements.taxi_class = courier`

This strongly suggests:
- it is a route-level operational delivery estimate,
- not necessarily the final checkout tariff that a merchant should expose 1:1 to a customer.

---

## 8. Working `check-price` example: store address → customer address

### Route
- source: `Москва, Льва Толстого, 16`
- destination: `125009, Москва, Тверская 1`

### Request body

```json
{
  "route_points": [
    {
      "id": 1,
      "coordinates": [37.588144, 55.733842],
      "fullname": "Москва, Льва Толстого, 16",
      "type": "source",
      "contact": {
        "name": "Продавец",
        "phone": "+79990000000"
      }
    },
    {
      "id": 2,
      "coordinates": [37.612435, 55.756787],
      "fullname": "125009, Москва, Тверская 1",
      "type": "destination",
      "contact": {
        "name": "Вячеслав Смирнов",
        "phone": "+79990000001"
      }
    }
  ],
  "items": [
    {
      "title": "Тестовый товар",
      "quantity": 1,
      "cost_currency": "RUB",
      "cost_value": "1000",
      "weight": 1,
      "size": {
        "length": 0.1,
        "width": 0.1,
        "height": 0.1
      }
    }
  ],
  "places": [
    {
      "physical_dims": {
        "dx": 0.1,
        "dy": 0.1,
        "dz": 0.1,
        "weight_gross": 1
      }
    }
  ],
  "billing_info": {
    "payment_method": "already_paid"
  }
}
```

### Response observed

```json
{
  "price": "274.000000",
  "currency_rules": {
    "code": "RUB",
    "text": "RUB",
    "template": "RUB",
    "sign": "RUB"
  },
  "requirements": {
    "taxi_class": "courier"
  },
  "distance_meters": 4389.210938,
  "eta": 12.783333333333333,
  "zone_id": "moscow"
}
```

---

## 9. Second working `check-price` example: store address → another Moscow address

### Route
- source: `Москва, Льва Толстого, 16`
- destination: `Москва, улица Крупской, 11к1с1`

### Request body

```json
{
  "route_points": [
    {
      "id": 1,
      "coordinates": [37.588144, 55.733842],
      "fullname": "Москва, Льва Толстого, 16",
      "type": "source",
      "contact": {
        "name": "Продавец",
        "phone": "+79990000000"
      }
    },
    {
      "id": 2,
      "coordinates": [37.547171, 55.687499],
      "fullname": "Москва, улица Крупской, 11к1с1",
      "type": "destination",
      "contact": {
        "name": "Получатель",
        "phone": "+79990000001"
      }
    }
  ],
  "items": [
    {
      "title": "Тестовый товар",
      "quantity": 1,
      "cost_currency": "RUB",
      "cost_value": "1000",
      "weight": 1,
      "size": {
        "length": 0.1,
        "width": 0.1,
        "height": 0.1
      }
    }
  ],
  "places": [
    {
      "physical_dims": {
        "dx": 0.1,
        "dy": 0.1,
        "dz": 0.1,
        "weight_gross": 1
      }
    }
  ],
  "billing_info": {
    "payment_method": "already_paid"
  }
}
```

### Response observed on one successful repeat

```json
{
  "price": "360.000000",
  "currency_rules": {
    "code": "RUB",
    "text": "RUB",
    "template": "RUB",
    "sign": "RUB"
  },
  "requirements": {
    "taxi_class": "courier"
  },
  "distance_meters": 7861.557617,
  "eta": 17.366666666666667,
  "zone_id": "moscow"
}
```

### Important note
Earlier one request returned a higher value (`641 RUB`) for the same route, while later repeated calls stabilized at `360 RUB`.

### Practical interpretation
`check-price` appears to be a **dynamic provider estimate**, not a static tariff table.

---

## 10. Are coordinates required for `check-price`?

### Practical test
We retried the same `check-price` route **without coordinates**, leaving only `fullname` addresses.

### Response

```json
{
  "code": "estimating.claim.no_zone_id",
  "message": "estimating.claim.no_zone_id"
}
```

### Conclusion
Formally the payload can contain addresses, but in practical testing the quote did **not** work without coordinates.

### Operational recommendation
For reliable `check-price` usage, provide:
- `fullname`
- `coordinates`

for both source and destination whenever possible.

---

## 11. What does `check-price` price actually mean?

This is one of the most important findings.

### What it likely is
`check-price` appears to return the **Yandex courier/provider quote for the route**.

### What it likely is not
It should **not automatically be treated as the final customer checkout tariff**.

### Why
Because a merchant may:
- subsidize delivery,
- add margin,
- round or normalize shipping price,
- expose a fixed customer-facing tariff,
- offer “free shipping” while still paying the provider.

### Therefore
Use `check-price` as:
- provider operational pricing input,
- backend quote signal,
- logistics estimate.

Do not assume it is automatically the shopper price.

---

## 12. Warehouse/store → PVZ vs PVZ → PVZ

This distinction is critical.

### Scenario A: warehouse/store → pickup point
This is the simpler merchant-origin scenario.

Meaning:
- merchant ships from store/warehouse,
- customer receives at a selected PVZ.

This is the most practical model for a normal checkout integration.

### Scenario B: dropoff point → pickup point
This is a different logistics model.

Meaning:
- merchant physically hands over the parcel at a dropoff-capable Yandex point,
- destination is another pickup point for the customer.

This is not the same as warehouse-origin pricing.

---

## 13. Confirmed model from project spec for Yandex modes

Project-side researched Yandex mode mapping indicates:

### `warehouse_to_pickup_point`
- origin: Yandex warehouse station / merchant warehouse mapping
- destination: Yandex pickup point
- project-documented quote path: warehouse-origin quote flow

### `dropoff_point_to_pickup_point`
- origin: Yandex pickup point with `available_for_dropoff=true`
- destination: Yandex pickup point
- project-documented quote path: `POST /offers/create` with `last_mile_policy=self_pickup`
- quote key should carry provider `offer_id`

### `courier_pickup_to_pickup_point`
- concept exists in project architecture,
- but is still deferred in current project slice.

---

## 14. Practical test result for PVZ → PVZ pricing

### What we successfully confirmed
We could retrieve:
- dropoff-capable origin points in Moscow using `available_for_dropoff=true`,
- normal destination pickup points in Moscow and Saint Petersburg.

Example origin query:

```json
{
  "geo_id": 213,
  "available_for_dropoff": true,
  "limit": 5
}
```

Example destination query:

```json
{
  "geo_id": 2,
  "limit": 5
}
```

### What we tried
We attempted direct PVZ→PVZ quote requests on sandbox using:

```http
POST /offers/create
```

and

```http
POST /b2b/cargo/integration/v2/offers/create
```

with a payload shaped according to the local Yandex adapter/spec.

### Result on current sandbox host
Both returned:

```json
{"code":"404","message":"No route for URL"}
```

### What this means
This does **not** prove PVZ→PVZ is unsupported.
It only proves that on the currently used sandbox host/path we did **not** confirm a working live route.

### Therefore
- logical/provider model for PVZ→PVZ exists,
- practical sandbox route for us is still unresolved.

---

## 15. Can price be requested cross-city for PVZ → PVZ?

### Practical test attempted
We selected:
- a Moscow dropoff-capable origin point,
- a Saint Petersburg destination pickup point.

### Result
The same blocker occurred:
- `offers/create` route not available on current tested sandbox path.

### Conclusion
At this stage we cannot say:
- “cross-city PVZ→PVZ is unsupported”,
- nor “cross-city PVZ→PVZ definitely works”.

We can only say:
- sandbox quote route for this mode was not live-confirmed by us.

---

## 16. Public tariffs: are partner PVZ→PVZ city tariffs publicly published?

### What public docs suggest
The Yandex widget documentation indicates that the widget uses **public tariffs**.

### What we did not find
We did **not** find:
- a public city-by-city partner tariff table,
- a public PVZ→PVZ tariff matrix by city,
- a public downloadable partner price list for this mode.

### Commercial docs
Commercial docs we checked discuss:
- licensing,
- free vs paid use conditions,
- legal usage terms,

but not partner delivery tariff tables.

### Practical conclusion
For partner logistics pricing, the model looks much closer to:
- provider-side quote calculation,
- offer/quote flow,
- route-specific provider pricing,

than to a public static tariff table.

---

## 17. Operational interpretation for a merchant

### Customer-facing price
What the customer sees in checkout may be:
- fixed,
- rounded,
- subsidized,
- derived from provider quote,
- or fully merchant-controlled.

### Provider operational price
What Yandex returns may be:
- route quote,
- logistics cost signal,
- offer-based provider amount,
- shipment-side operational cost.

These two should not be assumed to be identical.

---

## 18. Multiple orders / courier pickup operational model

Based on docs fragments and project architecture:
- Yandex Delivery conceptually supports shipment creation and tracking,
- multi-order or several-at-once integration is at least partially implied,
- `courier_pickup_to_pickup_point` exists as a modeled operational mode,
- but is deferred in current project implementation slice.

### Reasonable practical interpretation
A merchant may operationally:
- bring parcels to a dropoff-capable point,
- or eventually use courier pickup,
- while the system still tracks shipments individually.

### Not fully proven by live sandbox research
We did not fully confirm the exact public API contract for:
- one courier pickup collecting multiple orders in one operation,
- how that batching is represented provider-side in live contract terms,
- whether it becomes one physical pickup event with multiple shipment records.

---

## 19. What is currently the safest practical integration strategy?

### For checkout now
Treat the most practical route as:

```text
merchant warehouse/store -> selected customer pickup point
```

And treat Yandex price signals as:
- backend operational quotes,
- not blindly as shopper price.

### For pickup-point listing
Use:

```http
POST /api/b2b/platform/pickup-points/list
```

### For direct route pricing experiments already confirmed in practice
Use:

```http
POST /b2b/cargo/integration/v2/check-price
```

with coordinates.

### For PVZ→PVZ
Treat this as a separate provider flow that likely uses an offer-based route and still requires live route validation in the correct environment.

---

## 20. What is confirmed vs unconfirmed

### Confirmed
- `pickup-points/list` works on the tested Yandex endpoint.
- PVZ coordinates are returned.
- PVZ list does not return price.
- `check-price` works for address-based courier quotes when coordinates are provided.
- `check-price` is dynamic and can change between requests.
- `check-price` should be treated as provider quote, not guaranteed shopper tariff.
- dropoff-capable points can be discovered with `available_for_dropoff=true`.
- public docs do not expose a partner PVZ→PVZ tariff table by city.

### Unconfirmed / still needs live validation
- correct working live/sandbox route for direct PVZ→PVZ quote on our account/environment,
- whether all intercity PVZ→PVZ routes are supported,
- exact public batching contract for one courier pickup collecting multiple orders,
- exact final partner-facing tariff semantics for every Yandex operational mode.

---

## 21. Final summary in one paragraph

Yandex Delivery test research confirmed that pickup points can be listed and mapped with coordinates via `pickup-points/list`, but pricing is not returned there. Direct route pricing was practically confirmed through `check-price`, which behaves like a dynamic provider-side courier quote and worked reliably only when coordinates were supplied. The merchant checkout concept should therefore separate shopper-facing shipping price from provider operational quote. For Yandex logistics, `warehouse/store -> pickup point` and `dropoff point -> pickup point` are distinct flows; the latter is modeled in project research but still lacks a confirmed working sandbox quote route in our current environment. No public partner tariff table for PVZ→PVZ by city was found in the accessible Yandex documentation, so pricing appears to be quote-driven rather than publicly table-driven.
