# Delivery Hub Yandex Other-day API diagnostics — 2026-04-27

## Public documentation findings

Source page: https://yandex.ru/support/delivery-profile/ru/api/other-day/faq

The public FAQ says that Other-day Delivery API test requests must use:

- Test host: `https://b2b.taxi.tst.yandex.net/`
- Authorization header scheme: `Authorization: Bearer <token>`
- Test `platform_station_id`: `fbed3aa1-2cc6-4370-ab4d-59c5cc9bb924`

Method pages linked from the FAQ document these concrete paths:

- Pickup points list: `POST https://b2b.taxi.tst.yandex.net/api/b2b/platform/pickup-points/list`
- Pickup points production: `POST https://b2b-authproxy.taxi.yandex.net/api/b2b/platform/pickup-points/list`
- Pricing calculator: `POST https://b2b.taxi.tst.yandex.net/api/b2b/platform/pricing-calculator`
- Offers info: `POST https://b2b.taxi.tst.yandex.net/api/b2b/platform/offers/info`
- Request create: `POST https://b2b.taxi.tst.yandex.net/api/b2b/platform/request/create`

No raw token is stored in this file.

## Direct endpoint check

A minimal direct `POST` to the documented pickup-points test endpoint was executed with the public docs test token redacted from all output.

Result:

- Documented endpoint `b2b.taxi.tst.yandex.net/api/b2b/platform/pickup-points/list` returned `401` JSON with code `unauthorized` and message `Not authorized request`.
- Previous adapter endpoint `b2b.taxi.tst.yandex.net/b2b/cargo/integration/v2/pickup-points/list` returned `404` JSON with message `No route for URL` when not blocked by the Yandex HTML access page.

## Local event-log comparison

The latest Delivery Hub connection-test event used:

- Base URL: `https://b2b.taxi.tst.yandex.net/b2b/cargo/integration/v2`
- Path: `/pickup-points/list`
- Payload: `{ "limit": 1 }`

That differs from the documented Other-day API, where the base path is `/api/b2b/platform` and the pickup-points method accepts an empty body.

## Diagnosis

The strongest root cause for the adapter-side failure is an API-family/path mismatch: the adapter used the older cargo integration base path while the current public Other-day docs use `/api/b2b/platform`.

The direct documented endpoint still returning `401` means the public docs token currently is not sufficient from this environment, or the public docs/test access has drifted or become restricted. Therefore, even after the adapter path fix, successful live connection-test still requires a valid sandbox credential or restored Yandex test access.

## Implemented changes

- Centralized documented Yandex Other-day base URLs and paths in `src/modules/delivery-hub/adapters/yandex/endpoints.ts`.
- Updated connection base URL resolution to documented hosts.
- Updated connection config schema allow-list to documented hosts.
- Updated connection test to call documented `pickup-points/list` with an empty body.
- Updated read/quote/shipment path constants away from the old `/b2b/cargo/integration/v2` family.
- Added no-network unit coverage for documented host/path behavior.

## Pickup windows follow-up — same day

Safe latest event-log inspection for manual **Pickup windows lookup** showed:

- endpoint family: `https://b2b.taxi.tst.yandex.net/api/b2b/platform`;
- path: `POST /offers/info`;
- sanitized body shape: `source.platform_station_id`, `destination.platform_station_id`, non-empty `places[].physical_dims`;
- provider status: `400`;
- safe provider error: `code=no_delivery_options`, `message=No delivery options for interval`.

No token, raw auth header, raw provider body beyond the safe error code/message, or ciphertext is documented here.

Comparison with the public Other-day docs for `POST /api/b2b/platform/offers/info` found two local contract mismatches:

- for PVZ delivery windows, docs require/query `last_mile_policy=self_pickup`; without it the default is `time_interval` door delivery;
- documented successful response is `offers[].from/to`, while adapter expected legacy/internal `options[].interval_utc`.

The adapter now calls `/offers/info?last_mile_policy=self_pickup`, keeps the documented body shape with non-empty `places`, extracts `offers`, and normalizes documented `from/to` intervals into the neutral pickup-window contract. Targeted no-network tests were updated for the exact URL/body/response mapping. `Test quote` remains intentionally blocked until the operator chooses a future interval returned by this lookup.

## Pickup windows post-fix runtime check — same day

Safe runtime inspection after the user retried **Load pickup windows** confirmed the backend was still running from before the latest source-file update, so the container was explicitly restarted at `2026-04-27T12:42Z` and came back healthy on port `9000`.

The latest pre-restart event log already showed the intended post-fix request shape:

- endpoint family: `https://b2b.taxi.tst.yandex.net/api/b2b/platform`;
- path/query: `POST /offers/info?last_mile_policy=self_pickup`;
- sanitized body shape: `source.platform_station_id`, `destination.platform_station_id`, one non-empty `places[].physical_dims` package summary, no `interval_utc` in the lookup body;
- provider status: `400`;
- safe provider error: `code=no_delivery_options`, `message=No delivery options for interval`.

This narrows the current failure away from stale old path/query, empty `places`, missing `destination`, missing `last_mile_policy`, auth, ciphertext, or raw response handling. The strongest remaining diagnosis is provider-side unavailability of delivery windows for the selected warehouse/PVZ pair in sandbox/test data. Operator next step is to retry the manually triggered lookup after the backend restart and, if the same safe error remains, choose a different destination PVZ from **Pickup point lookup** with `city=Moscow` or another PVZ near the mapped warehouse.

No raw token, raw auth header, raw provider response, ciphertext, automatic Test quote, shipment create/cancel/status, or retry operation was executed or documented.

## 2026-04-27 follow-up: admin lookup/window retest and 5Post source

Safe local retest used only the saved sealed Yandex test connections and admin diagnostic routes; no raw token, auth headers, ciphertext, or raw provider response body were printed, and no shipment create/cancel/status/retry call was executed.

Runtime check confirmed that backend diagnostic logs were already using the Yandex Other-day test endpoint family `https://b2b.taxi.tst.yandex.net/api/b2b/platform` and pickup-window path `/offers/info?last_mile_policy=self_pickup`. Safe request summaries showed non-empty `places`, `source.platform_station_id` for the mapped test warehouse, and `destination.platform_station_id` when a PVZ was selected.

Pickup point lookup through `GET /admin/delivery/pickup-points` for `city=Moscow`, `country_code=RU`, `limit=50` returned `total_available=1079`, `returned_count=50`, `truncated=true`. The first sampled Moscow/near-Moscow points all had safe display name `5 Post (Пятерочка)`, `code=null`, `available_for_dropoff=false`, and city values like `г.Москва`, `г.Люберцы`, `г.Реутов`, `г.Видное`. This proves `5Post` is the pickup point/network name returned by Yandex Delivery pickup-points data and displayed from the sanitized `name` field; it is not a switch from provider `yandex`, not warehouse mapping, and not legacy provider/5Post contamination in our UI.

Pickup windows were tested against several sampled PVZ ids from that Yandex list, including short ids `0195749be6e...`, `0195749be91...`, `0195749be9b...`, `0195749bedc...`, `0195749bf06...`. One saved connection later hit provider `403`/access-block state and was normalized safely to `DELIVERY_HUB_CREDENTIALS_INVALID`; this blocks further meaningful diagnostics on that connection until provider access/credentials are restored. The second saved connection reproduced the original failure for sampled PVZ `0195749be9b...`: admin response `DELIVERY_HUB_PROVIDER_ERROR`, provider status `400`, safe provider code/message `no_delivery_options / No delivery options for interval`.

Additional safe evidence: omitting `destination_point_id` reaches Yandex with an invalid request shape for this operation and the provider reports a missing `destination` field. The admin pickup windows UI/schema now require destination PVZ id before calling the provider, so operators are guided to use Pickup point lookup first.

Current diagnosis: the remaining `400 no_delivery_options` is not caused by stale backend code, wrong endpoint family, missing `last_mile_policy`, empty `places`, missing destination in the selected call, token echoing, ciphertext handling, or a UI provider-label bug. It is provider-side unavailability for the selected sandbox warehouse/PVZ pair, with an additional provider access-block state observed on one saved connection after repeated diagnostics. No valid pickup window was found in the sampled 5Post PVZ set, so no Test quote was run for that branch because quote requires a future provider interval and shipment creation is out of scope.

## 2026-04-27 follow-up: documented `/offers/create` warehouse source diagnostic

Documentation re-check found a more precise distinction:

- `POST /api/b2b/platform/offers/create` is documented as **Создание заявки / получение вариантов доставки (офферов)** and returns `offers[].offer_id`; it is followed by a separate confirmation method and is not `request/create` shipment creation.
- The FAQ says `platform_station_id` is the identifier for warehouses, PVZ and self-dropoff points. For the documented test call, the test warehouse/source point A is `fbed3aa1-2cc6-4370-ab4d-59c5cc9bb924`.
- `POST /api/b2b/platform/request/create` is the separate **Создание заказа** endpoint and was not called.
- `POST /api/b2b/platform/offers/info` remains an interval lookup endpoint; it is not required as the only path before a sandbox quote attempt.

A minimal controlled sandbox diagnostic used only the saved sealed connection. No raw token, auth header, ciphertext or raw provider body was printed. No `request/create`, offer confirmation, shipment create/cancel/status/retry call was executed.

Safe result summary:

- Current simplified local adapter shape against `/offers/create` got provider `403` HTML access-block on one attempt.
- Documented offer body shape with `source.platform_station.platform_id=<test warehouse>`, destination PVZ id from lookup, `last_mile_policy=self_pickup`, package `places`, `items`, `billing_info` and recipient summary reached JSON validation and returned provider `400` with safe message: `items[0].place_barcode` missing.
- Adding a matching `items[0].place_barcode` / `places[0].barcode` then hit provider `403` HTML access-block, so no successful offer was obtained before sandbox access blocking resumed.

Interpretation: the user's hypothesis is directionally correct. For Other-day sandbox Test quote, `platform_station_id` should be tested as the source warehouse/station through `/offers/create`, while destination should be a PVZ `platform_station_id` from pickup-point lookup. The previous warehouse quote implementation was too tied to `/pricing-calculator` plus mandatory pickup-window lookup; `/offers/create` is the documented offer/quote endpoint and gives more meaningful validation than `/offers/info no_delivery_options` for the sampled PVZ set.

## 2026-04-27 follow-up: local code review after `/offers/create` implementation

Local code review and targeted no-network tests rechecked the implemented Yandex quote flow against the documented Other-day `/offers/create` contract. No raw token, auth header, ciphertext, raw provider body, shipment create/cancel/status/retry, confirmation, or `/request/create` call was executed.

Verified implementation points:

- `warehouse_to_pickup_point` resolves the saved local warehouse mapping through backend service and passes its `provider_warehouse_id` to the adapter as the source Yandex `platform_station_id`.
- `/offers/create` payload maps source as `source.platform_station.platform_id` and destination PVZ as `destination.platform_station.platform_id`; dropoff origin uses the same `platform_station.platform_id` source shape and still requires an origin point that is valid for dropoff.
- `last_mile_policy` is set to `self_pickup`.
- Payload includes package `places`, `items`, `billing_info`, `recipient_info`, and matching barcode linkage between `items[].place_barcode` and `places[].barcode`.
- `source.interval_utc` is omitted by default and is added only when both `from` and `to` are supplied; pickup windows are optional diagnostics, not a mandatory prerequisite for `/offers/create` Test quote.
- Quote response mapping reads documented `offer_details.pricing_total` and falls back to `offer_details.pricing` in addition to legacy/direct price shapes.
- Admin test quote route/schema keep `interval_utc` optional and sanitize `quotes`, `input_echo`, and `diagnostics_summary`; service/admin quote sanitization redacts `raw_reference` and does not return raw credentials/provider body.

One local drift was found and fixed: the Yandex quote mapper still marked warehouse quotes as `pickup_window_required=true`, which made Admin/UI semantics look as if windows were mandatory before `/offers/create`. It now returns `pickup_window_required=false` for this diagnostic quote flow; pickup-window lookup remains available only as optional advanced diagnostics.

Admin UX was also reconciled with this diagnosis: the main `Settings -> Delivery` path is now Russian/user-friendly (**1. Подключение Яндекс Доставки**, **2. Проверить подключение**, **3. Найти ПВЗ**, **4. Проверить стоимость доставки**), advanced fields are under details, and labels/helpers explicitly distinguish required vs optional fields, `platform_station_id`, warehouse/source, destination PVZ id, origin dropoff point, and expected `5 Post` names in the Yandex pickup-point catalog.

## 2026-04-27 follow-up: current 502/400 root cause after Admin quote UI retry

Runtime was checked again after the latest Admin/Yandex quote-flow edits. The backend container was already fresh enough for the `/offers/create` changes: `medusa-backend` had been restarted at `2026-04-27T12:42Z`, while the relevant adapter source update was earlier at `2026-04-27T13:37+03:00`; `/health` returned `200 OK`. No backend restart was needed for this check.

Safe event-log rows for the failing Admin actions showed:

- `test_quote` / quote path: `POST /offers/create` on the Yandex Other-day sandbox API family.
- Quote source/destination shape: source warehouse mapped through saved local warehouse `provider_warehouse_id` into `source.platform_station.platform_id`; destination PVZ id mapped into `destination.platform_station.platform_id`.
- Quote body shape included `items`, `places`, matching `items[].place_barcode` / `places[].barcode`, `billing_info`, `recipient_info`, `last_mile_policy=self_pickup`, dimensions and declared item price. `source.interval_utc` was omitted because the UI interval fields were empty.
- Provider status: `400`.
- Safe provider code/message: `no_delivery_options / No delivery options for interval`.
- `pickup_windows` optional diagnostic path: `POST /offers/info?last_mile_policy=self_pickup`, non-empty `places`, source/destination station ids present.
- `pickup_windows` provider status/code/message: `400`, `no_delivery_options / No delivery options for interval`.

Diagnosis: the current `502` responses are backend normalization of Yandex provider `400`, not stale runtime, not the old `/pricing-calculator`, not `/offers/info` for the main quote, and not a missing local `/offers/create` request-field issue found in code. The actionable provider validation reason is that this sandbox warehouse/PVZ/interval combination has no delivery options. Because the interval section was empty, the quote is asking Yandex to find any applicable interval for the selected pair; Yandex still returns `no_delivery_options`.

Local fix in this follow-up is UI/operator diagnostics only: Admin now renders safe provider status/category/code/message/path/operator hint/correlation for Test quote and pickup-window errors, so operators see `no_delivery_options / No delivery options for interval` instead of only the generic `Yandex Delivery request failed with status 400`. No token, raw auth header, ciphertext, raw provider body, shipment create/cancel/status/retry, confirmation, or `/request/create` call was executed or documented.

## 2026-04-27 final follow-up: documented Yandex Market test PVZ and partner-network filtering

A deeper documentation pass found the pickup-point filtering details that explain the earlier confusion:

- Yandex documents `platform_station_id` / station `id` as the identifier used for warehouses, PVZ and dropoff stations.
- For PVZ/self-pickup delivery, `/offers/create` should use the warehouse/source station in `source.platform_station` and the PVZ/destination station in `destination.platform_station` with `last_mile_policy=self_pickup`.
- `/pickup-points/list` supports documented filters such as `pickup_point_ids`, `geo_id`, `type`, `available_for_dropoff`, `is_yandex_branded`, `is_not_branded_partner_station`, `operator_ids`, `payment_methods` and `pickup_services`.
- The docs state that without `operator_ids` the catalog contains Yandex Market, partner pickup points and `5Post`. Known operator ids are `market_l4g` for Yandex Market / partner points and `5post` for 5Post.
- The docs/example surface contains a concrete destination PVZ id `e1139f6d-e34f-47a9-a55f-31f032a861a6`; in sandbox it resolves to a Moscow Yandex Market pickup point.

Safe sandbox catalog diagnostics using the saved sealed connection and capped output found:

- `pickup_point_ids=[e1139f6d-e34f-47a9-a55f-31f032a861a6]` returned one point: `Пункт выдачи заказов Яндекс Маркета`, `operator_id=market_l4g`, `type=pickup_point`, city `Москва`, address `Москва Ленинградский проспект 27`, `is_yandex_branded=true`, `is_market_partner=true`, `available_for_dropoff=true`.
- `geo_id=213`, `operator_ids=[market_l4g]` returned Yandex Market / partner candidates, not only 5Post.
- `geo_id=213`, `operator_ids=[5post]` returned the 5Post partner-network catalog.
- `geo_id=213`, `is_yandex_branded=true` returned Yandex-branded candidates.

Capped `/offers/create` diagnostics then tested 8 candidate destinations. Safe summary:

| Candidate type | Safe id/name summary | Result |
|---|---|---|
| documented Yandex Market PVZ | `e1139f6d-e34...61a6`, `Пункт выдачи заказов Яндекс Маркета`, `market_l4g` | success, `offers_count=4` |
| Yandex Market PVZ | `fb147365-18a...ba20`, `market_l4g` | success, `offers_count=4` |
| Yandex Market PVZ | `019bebbda7a5...d2fa`, `market_l4g` | success, `offers_count=4` |
| Yandex Market PVZ | `f865a2b5-61b...1c97`, `market_l4g` | success, `offers_count=4` |
| Yandex-branded candidate | `ГиперПВЗ-2` | provider `400`, `no_delivery_options / No delivery options for interval` |
| partner point under `market_l4g` | partner pickup point | success, `offers_count=2` |
| 5Post candidate | `5 Post` network | provider `400`, `no_delivery_options / No delivery options for interval` |
| 5Post candidate | `5 Post` network | provider `400`, `no_delivery_options / No delivery options for interval` |

Conclusion: Yandex points are present and working in the sandbox. The previous failures came from selecting random/default 5Post-heavy catalog entries, not from the `/offers/create` payload shape. `5 Post (Пятерочка)` is a partner pickup network returned by Yandex Delivery's own pickup catalog, not a separate Delivery Hub provider and not legacy legacy delivery contamination.

Implemented local alignment:

- Pickup-point lookup now supports the documented filters (`geo_id`, exact `pickup_point_id`, `operator_id`, station type and brand/dropoff flags) instead of relying on undocumented `city/country` filtering.
- Admin defaults now target the deterministic Moscow Yandex Market flow: `geo_id=213`, `operator_id=market_l4g`, `type=pickup_point`, `is_yandex_branded=true`.
- Admin result labels now separate `Провайдер: Yandex` from `Сеть ПВЗ: 5 Post / Яндекс Маркет / партнёр` so partner networks are not mistaken for providers.
- Neutral pickup-point DTOs now carry safe operator/network/brand/type fields across adapter, admin and store boundaries.
- No raw token, auth header, ciphertext, raw provider body, shipment create/cancel/status/retry, confirmation, `/request/create`, or commit was executed/documented.

## 2026-04-27 follow-up: `pickups_not_configured` with PVZ `019c3374bf187276bedb048cb8058c14`

Safe latest event logs for **Test quote** showed a different provider rejection than the earlier sampled `no_delivery_options` cases:

- Admin status/code: `502 / DELIVERY_HUB_PROVIDER_ERROR`;
- provider status/category: `400 / provider_rejected`;
- provider path: `/offers/create`;
- provider code/message: `pickups_not_configured / Pickups matching the pickup intervals are not configured for the warehouse`;
- source warehouse mapping was present and pointed to the documented test warehouse `fbed3aa1-2cc6-4370-ab4d-59c5cc9bb924`;
- the failing UI attempts supplied a manual `source.interval_utc` (`2026-04-30T07:00:00Z → 2026-04-30T09:00:00Z`).

Controlled quote-only sandbox diagnostics were then run through the saved sealed connection with capped destinations and no shipment/create/cancel/status/retry calls:

| Destination | Safe metadata | `/offers/create` without manual interval |
|---|---|---|
| `019c3374bf187276bedb048cb8058c14` | Yandex Market PVZ, `market_l4g`, `pickup_point`, `is_yandex_branded=true`, address `Москва Поварская улица 26`, `available_for_dropoff=false` | success, `offers_count=4` |
| `e1139f6d-e34f-47a9-a55f-31f032a861a6` | documented/verified sandbox PVZ, Yandex Market, address `Москва Ленинградский проспект 27`, `available_for_dropoff=true` | success, `offers_count=4` |

Conclusion: the selected PVZ `019c...` is not generally incompatible with the test warehouse. The current `pickups_not_configured` was caused by the manually supplied pickup interval not matching configured pickups for the warehouse. This differs from the earlier `no_delivery_options`, which indicated no delivery option for the selected pair/default interval. For this PVZ, remove the manual interval or choose an interval returned by provider-supported pickup diagnostics; for deterministic sandbox checks use the documented PVZ `e1139...`.

Implemented UX alignment:

- Admin pickup lookup/Test quote now exposes **Использовать тестовый PVZ Яндекса**, which sets the exact verified sandbox PVZ `e1139f6d-e34f-47a9-a55f-31f032a861a6` and label `Пункт выдачи заказов Яндекс Маркета, Ленинградский проспект 27`.
- Exact verified PVZ labels include `verified sandbox`.
- Provider-code hints now distinguish `pickups_not_configured` from `no_delivery_options`: for `pickups_not_configured`, the UI points to warehouse pickup-interval configuration or the documented sandbox PVZ rather than blaming the PVZ itself.
- No raw token, auth header, ciphertext, raw provider body, shipment create/cancel/status/retry, confirmation, `/request/create`, or commit was executed/documented.

## 2026-04-27 manual Admin quote success baselines

A later manual **Admin → Settings → Delivery → Test quote** validation, provided by operator screenshot/evidence rather than by this docs update running new checks, confirms both first-tranche direct Yandex quote flows through `POST /offers/create`:

| Flow | Result | Safe baseline |
|---|---|---|
| `warehouse_to_pickup_point` | success | `quotes count=4`; currency `RUB`; first/UI price `181.9 rub`; pickup window required `no`; interval empty; direct Yandex `/offers/create` |
| `dropoff_point_to_pickup_point` | success | connection `yandexTestname · test · active`; destination PVZ/platform station id `e1139f6d-e34f-47a9-a55f-31f032a861a6`; origin dropoff point id `019d2a9da5877011a771b75e903f3039`; currency `RUB`; quantity `1`; weight `500` grams; declared price `2000`; correlation id `a4adab14-ff1c-40da-a2cd-bfa0726e3be7`; `quotes count=13`; first offer price `181.9 rub`; visible ETA examples `3–4`, `4–5`, `5–6`, `6–7`; pickup window required `no`; provider reference redacted; direct Yandex `/offers/create` |

This checkpoint is quote/offer-only evidence. It does not validate checkout cutover, legacy delivery fulfillment, shipment create, confirmation, status polling, cancel or retry execution. The next safe engineering move is storefront-neutral quote/selection smoke over the existing Delivery Hub neutral contracts, still without checkout cutover or live fulfillment execution enablement.
