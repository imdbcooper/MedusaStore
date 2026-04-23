# Delivery Hub v1 Specification

> Статус документа: проектная спецификация на первую реализацию собственного слоя доставки.
>
> Дата первой редакции: `2026-04-21`.
>
> Дата remediation v1.1: `2026-04-21`. В §16 зафиксированы truthful правки, закрывающие все пробелы и несоответствия кодовой базе, выявленные review.
>
> Дата reconciliation v1.2: `2026-04-22`. §16.14 restructured для явного coverage materialized storefront shadow preview layers (19 builders). §16.17 Этап D compressed. §16.20 добавлен (pre-cutover next steps). Дата в §16.19 обновлена.
>
> Дата reconciliation v1.3: `2026-04-22`. Документ truthfully синхронизирован с materialized tranche-1 state после admin/store response-boundary hardening, no-network route coverage и focused admin page seam coverage через `page-state.ts`.
>
> При противоречии между §§1–15 и §16 источником истины считается §16.

## 1. Зачем меняем направление

Исторический shipping slice `ApiShip provider_aware_v1` в репозитории уже materialized и подтвержден как рабочий для своего узкого scope. Это остается фактом и не должно быть переписано как будто этого slice не было.

Но дальнейшая shipping-архитектура меняется по причинам:

- прямые тесты `Yandex Delivery` показали, что `self_pickup` и `warehouse -> PVZ` реально работают через API Яндекса;
- `ApiShip` не дает достаточно прозрачной и предсказуемой модели для `PVZ`, `dropoff`, `warehouse`, `pickup windows` и диагностики;
- магазин-шаблон для РФ в долгую выигрывает от собственного расширяемого delivery-layer, а не от жесткой завязки на одного агрегатора;
- merchant-facing настройка доставки должна жить в админке магазина и не требовать внешнего кабинета как основного control-plane.

## 2. Цель

Создать собственный расширяемый слой доставки `delivery-hub`, который:

- живет внутри backend как отдельный внутренний модуль;
- имеет свои `admin` и `store` API;
- не требует коренного форка Medusa Admin;
- позволяет владельцу магазина подключать службы доставки из админки;
- хранит merchant-specific credentials и настройки в backend;
- поддерживает несколько служб доставки через единый внутренний контракт;
- в первой итерации реализует адаптер `Yandex Delivery`;
- позволяет полностью выпилить `ApiShip` после migration cutover.

## 3. Нецели первой итерации

В первую реализацию не входят:

- одновременная поддержка всех служб доставки РФ;
- полноценная реализация `CDEK`, `Boxberry`, `5Post` и других адаптеров;
- переписывание стандартных страниц Medusa Admin;
- сложный multi-tenant SaaS control-plane;
- оптимизация под международный рынок;
- сложный tariff-editor уровня агрегатора;
- автоматическое создание всех shipment labels / manifests для всех провайдеров сразу.

## 4. Принципы архитектуры

### 4.1. Границы

`Storefront` и checkout не должны знать про термины конкретных служб доставки.

Они должны работать только с нейтральными сущностями:

- `carrier_code`
- `mode_code`
- `quote`
- `pickup_point`
- `pickup_window`
- `shipment`

### 4.2. Расширяемость

Каждая служба доставки подключается через adapter contract:

- `testConnection`
- `listWarehouses`
- `listPickupPoints`
- `quote`
- `createShipment`
- `cancelShipment`
- `getShipment`
- `listPickupWindows`
- `handleWebhook`

### 4.3. Обновляемость Medusa

Запрещено:

- форкать исходный Medusa Admin;
- патчить official admin package;
- зашивать delivery logic в core storefront/business flows так, чтобы обновления Medusa превращались в merge-ад.

Разрешено и рекомендуется:

- `src/admin/routes/*`
- `src/admin/widgets/*`
- `src/api/admin/*`
- `src/api/store/*`
- `src/modules/*`
- отдельные таблицы и сервисы внутри проекта.

### 4.4. Безопасность

- merchant credentials хранятся в БД в зашифрованном виде;
- секреты не живут в storefront;
- в логах запрещено светить raw tokens;
- все запросы в провайдеров логируются через sanitized summaries;
- для каждой ошибки должен оставаться correlation/tracing context.

## 5. Целевая структура решения

### 5.1. Backend

Новый work surface:

- `medusa-agency-boilerplate/src/modules/delivery-hub/*`
- `medusa-agency-boilerplate/src/api/admin/delivery/*`
- `medusa-agency-boilerplate/src/api/store/delivery/*`
- `medusa-agency-boilerplate/src/admin/routes/settings/delivery/*`
- `medusa-agency-boilerplate/src/admin/widgets/*` при необходимости

### 5.2. Storefront

Новая storefront surface:

- `medusa-agency-boilerplate-storefront/src/lib/data/delivery-hub.ts`
- `medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub.ts`
- tranche-safe checkout wiring: сначала read-only readiness preview, затем read-only summary, затем read-only persisted selection preview, затем shadow catalog, затем read-only store settings surface + shadow settings preview, затем shadow pickup-point / shadow quote / shadow pickup-window previews, затем shadow selection actionability / shipping-option parity / selection parity / orchestration verdict / recommendation / cutover-readiness / cutover-blockers / cutover-next-steps / cutover-summary / cutover-evidence / cutover-rollout / cutover-gate / cutover-decision / cutover-checklist previews, и только потом полноценная адаптация shipping UI к нейтральным quote/point contracts

### 5.3. Fulfillment registration

Вместо `apiship` должен остаться один внутренний provider:

- `deliveryhub`

Он будет единственной точкой интеграции Medusa fulfillment layer с внутренним delivery orchestration.

## 6. Доменная модель

### 6.1. Основные сущности

- `delivery_provider`
- `delivery_connection`
- `delivery_warehouse`
- `delivery_mode`
- `delivery_quote_cache`
- `delivery_shipment`
- `delivery_event_log`
- `delivery_secret`

### 6.2. Нейтральные режимы доставки

Shopper-facing:

- `to_door`
- `to_pickup_point`

Operational:

- `warehouse_to_door`
- `warehouse_to_pickup_point`
- `dropoff_point_to_pickup_point`
- `courier_pickup_to_pickup_point`
- позже `same_day_to_door`

### 6.3. Нейтральная shopper/store quote модель

Каждый public shopper-facing quote обязан содержать:

- `carrier_code`
- `carrier_label`
- `mode_code`
- `quote_reference { id, version }`
- `amount`
- `currency_code`
- `delivery_eta_min`
- `delivery_eta_max`
- `pickup_point_required`
- `pickup_point_ids[]`
- `pickup_window_required`

Backend/provider-facing internal quote payload при этом может дополнительно содержать `quote_key`, embedded pickup/pickup-window fragments и `raw_reference`, но эти поля не должны выходить в `store` public contract.

### 6.4. Нейтральная модель точки

- `provider_point_id`
- `provider_point_code`
- `name`
- `address`
- `city`
- `region`
- `postal_code`
- `lat`
- `lng`
- `is_origin_dropoff_allowed`
- `is_destination_pickup_allowed`
- `payment_methods[]`

### 6.5. Truthful tranche-safe cart delivery selection contract

Дополнительно к read-only shopper/store surface в текущем состоянии materialized минимальный backend-only neutral contract выбранной доставки на cart.

Что уже есть truthfully:

- store endpoints [`GET /store/delivery/selection`](../medusa-agency-boilerplate/src/api/store/delivery/selection/route.ts), [`POST /store/delivery/selection`](../medusa-agency-boilerplate/src/api/store/delivery/selection/route.ts), [`DELETE /store/delivery/selection`](../medusa-agency-boilerplate/src/api/store/delivery/selection/route.ts);
- readiness endpoint [`GET /store/delivery/readiness`](../medusa-agency-boilerplate/src/api/store/delivery/readiness/route.ts), который читает cart + persisted selection и возвращает минимальный neutral validation result для storefront;
- хранение selection в `cart.metadata.delivery_hub.selection` через [`updateCartWorkflow()`](../medusa-agency-boilerplate/src/modules/delivery-hub/cart-selection.ts:295), без fork/core patch и без новых env;
- публичный response остается neutral и не раскрывает provider-specific raw payload.

Текущая публичная модель selection содержит:

- `version`
- `connection_id`
- `quote_type`
- `quote_reference { id, version }`
- `quote { carrier_code, carrier_label, amount, currency_code, delivery_eta_min, delivery_eta_max, pickup_point_required, pickup_window_required }`
- `pickup_point`
- `pickup_window | null`
- `updated_at`

Truthful backend-only nuance текущего шага:

- backend сохраняет `quote_key` только внутри metadata namespaced backend segment, чтобы follow-up backend logic могла безопасно переиспользовать reference без раскрытия этого поля в store/public ответе;
- `quote_reference.id` сейчас является безопасным deterministic hash от `connection_id + quote_type + quote_key + version`, а не raw provider payload;
- readiness logic materialized как минимальный bridge между persisted selection и текущим cart context: [`buildDeliveryHubStoreSelectionReadiness()`](../medusa-agency-boilerplate/src/modules/delivery-hub/selection-readiness.ts:102) возвращает `status`, `issues[]`, `selection` и `quote_context`, где `quote_context.connection` intentionally ограничен нейтральным summary `connection_id + state + ready` без provider-facing или internal connection fragments;
- readiness status сейчас intentionally ограничен neutral состояниями `missing_selection | invalid_selection | not_ready | ready`, а issues покрывают только tranche-safe инварианты: presence/shape of persisted selection, connection shopper-readiness, required pickup point / pickup window presence; cart existence валидируется самим store route boundary до вызова readiness helper и не является отдельной semantic guarantee helper-level контракта;
- readiness step **не** делает live re-quote, не подтверждает shipping-method compatibility, не проверяет актуальность offer у провайдера, не интерпретирует pickup-point issues шире факта отсутствия обязательного persisted point/window и не materializes shipment/order lifecycle; эти проверки остаются следующими tranche'ами.

## 7. Merchant UX в админке

### 7.1. Общая идея

Владелец магазина должен подключать доставку без редактирования `.env` и без необходимости жить в внешнем кабинете как в основном UI.

Основной сценарий:

1. Открыть `Settings -> Delivery`
2. Выбрать службу
3. Ввести договорные данные
4. Проверить подключение
5. Настроить склады
6. Сопоставить склады/точки провайдера
7. Включить режимы доставки
8. Прогнать тестовый расчет
9. Включить на storefront

### 7.2. Что должно быть в админке v1

Truthful status на текущую tranche-1 реализацию `Settings -> Delivery`:

- реализованы разделы `Providers`, `Connections`, `Yandex connection`, `Warehouses`, `Connection diagnostics`, `Test Quote`, read-only `Event logs`, read-only `Shipping option preview` и новый operator-facing `Shipping option manual sync`;
- `Warehouses` materialized как минимальный admin-managed local warehouse surface с list/create/update, optional provider mapping и использованием в `default warehouse` binding; отдельный экран `Delivery Modes` в UI этой tranche все еще не реализован;
- страница работает поверх backend endpoints `GET /admin/delivery/providers`, `GET /admin/delivery/connections`, `POST /admin/delivery/connections`, `PUT /admin/delivery/connections/:id`, `POST /admin/delivery/connections/:id/test`, `GET /admin/delivery/warehouses`, `POST /admin/delivery/warehouses`, `PUT /admin/delivery/warehouses/:id`, `POST /admin/delivery/test-quote`, `GET /admin/delivery/logs`, `GET /admin/delivery/shipping-options/preview`, `POST /admin/delivery/shipping-options/sync`; manual sync UI default-но отправляет safe `dry_run`, truthfully показывает returned `execution.mode`, summaries и structured details, а execute-path deliberately требует exact guard string + явные `service_zone_id`/`shipping_profile_id` и не выполняется одним обычным кликом.

Страница подключения `Yandex` в текущем состоянии содержит:

- `Connection name`;
- `Mode`: `test | live`;
- write-only `OAuth token / API token` без показа сохраненного секрета;
- `Country`;
- `Enabled`;
- `Auto confirm`;
- `Label generation type`;
- `Default warehouse` как выбор materialized warehouse entity.

`Auto confirm` и `Label generation type` остаются thin config fields, а `Default warehouse` теперь привязан к materialized warehouse entity. Это все еще не означает, что label pipeline, shipment lifecycle или более широкий warehouse orchestration уже реализованы.

Merchant UX в текущем состоянии поддерживает действия:

- `Create connection` / `Save changes`;
- `Test connection`;
- `Connection diagnostics` с optional pickup-points listing;
- `Test quote` для поддержанных `Yandex` mode-кодов;
- просмотр truthful статусов `credentials_state`, `status`, `credentials_last_error_code` и controlled `encryption disabled` state.

Успешный `Test quote` response в текущем контракте возвращает `correlation_id` top-level, а не внутри `diagnostics`; для `Test connection` correlation context приходит внутри `diagnostics`.

`Shipping option preview` в текущем truthful scope остаётся строго read-only: он показывает desired projections, deferred planner issues, per-connection planner status и reconciliation buckets `create_candidates | update_candidates | unchanged | orphaned_managed_options | ignored_foreign_options` по текущим Medusa shipping-option snapshots, но не делает create/update/delete/sync и не раскрывает provider secrets.

Отдельно от preview теперь materialized backend + admin-UI manual sync contour `POST /admin/delivery/shipping-options/sync`: по умолчанию он работает как safe `dry_run`, возвращает truthful `desired_plan`, `reconciliation`, `operation_plan` и `execution.report|null`, а execute-path включается только при явном `mode="execute"` + guard `confirm_execute="deliveryhub:execute_shipping_option_sync"` + explicit `mutation_context`. На [`Settings -> Delivery`](../medusa-agency-boilerplate/src/admin/routes/settings/delivery/page.tsx) для этого теперь есть отдельный operator-facing блок: primary button запускает dry-run, secondary execute button остаётся disabled до exact guard match и заполнения Medusa ids, а UI показывает structured summaries и raw details без background polling и без смешения с `store/public` concerns. Поверх existing [`delivery_event_logs`](../medusa-agency-boilerplate/src/modules/delivery-hub/storage/event-log-repository.ts) теперь materialized и manual sync audit trail: `dry_run`/`execute` попытки, включая truthful failure outcomes, пишут summary-only событие `shipping_option_manual_sync`, которое уже видно через [`GET /admin/delivery/logs`](../medusa-agency-boilerplate/src/api/admin/delivery/logs/route.ts) без отдельного UI rollout. Route intentionally не опубликован в `store/public` surface и не привязан к automatic rollout.

Для operator-facing admin contour теперь materialized минимально вынесенный pure/view-model seam [`page-state.ts`](../medusa-agency-boilerplate/src/admin/routes/settings/delivery/page-state.ts), через который [`page-state.unit.spec.ts`](../medusa-agency-boilerplate/src/admin/routes/settings/delivery/__tests__/page-state.unit.spec.ts) без сети фиксирует derived/render-state для [`page.tsx`](../medusa-agency-boilerplate/src/admin/routes/settings/delivery/page.tsx), включая Yandex-only filtering, write-only token semantics, guard/empty/error states и отсутствие leakage secret-like fragments. Это test seam, а не новый runtime route или отдельная админ-страница.

`Fetch provider metadata`, `Delivery Modes` surface, provider-driven warehouse sync и более развитая log console остаются следующими шагами и не должны считаться уже реализованными сверх текущего минимального warehouse CRUD, встроенного read-only logs блока и нового read-only shipping-option preview.

### 7.3. Складской экран

Поля:

- локальный склад магазина
- адрес
- телефон и контакт
- привязанный yandex warehouse / station
- enabled modes для этого склада

### 7.4. Экран тестового расчета

Merchant должен уметь указать:

- склад
- origin mode: `warehouse | dropoff point`
- destination mode: `door | pickup point`
- город/адрес/точку
- вес, габариты, оценочную стоимость

И увидеть:

- quotes
- доступные pickup windows
- доступные origin dropoff points
- доступные destination pickup points
- raw debug summary

## 8. Yandex adapter v1

### 8.1. Почему именно первым

`Yandex Delivery` уже исследован глубже остальных и имеет подтвержденные прямые тесты:

- `pickup-points/list` возвращает тестовые ПВЗ;
- `pricing-calculator` считает `warehouse -> PVZ`;
- `offers/create` возвращает офферы для `dropoff point -> PVZ`;
- `pickups/pickup-options` показывает pickup windows для склада.

### 8.2. Что уже подтверждено по модели Яндекса

Прямыми тестами подтверждено:

- `warehouse` — отдельная сущность от `pickup_point`;
- `pickup_point` может иметь `available_for_dropoff=true`;
- `pickups/pickup-options` работают для `warehouse`, но не для обычного `pickup_point`;
- `offers/create` работает для `pickup_point -> pickup_point`;
- `offers/create` работает для `warehouse -> pickup_point`, если `source.interval_utc` попадает в реально доступный pickup window;
- `interval_utc` нужно передавать в UTC, а не в локальном времени Москвы.

### 8.3. Как маппим модель Яндекса во внутренний слой

Внутренние сущности:

- local warehouse -> `delivery_warehouse`
- yandex warehouse station -> mapping field на warehouse
- yandex pickup point -> `delivery point snapshot`

Mapping:

- `warehouse_to_pickup_point`
  - source = yandex warehouse station
  - destination = yandex pickup point
- `dropoff_point_to_pickup_point`
  - source = yandex pickup point с `available_for_dropoff=true`
  - destination = yandex pickup point
- `courier_pickup_to_pickup_point`
  - source = yandex warehouse station
  - quote должен включать pickup interval

### 8.4. Yandex API methods для v1

Обязательные методы:

- `pickup-points/list`
- `pricing-calculator`
- `offers/info`
- `offers/create`
- `claims/create` или актуальный order/claim path
- `claims/info` / status path
- `pickups/pickup-options`
- webhook or polling path по статусам

### 8.5. Что должно уметь приложение с Yandex adapter v1

Quote flows:

- `warehouse -> door`
- `warehouse -> pickup point`
- `dropoff point -> pickup point`

Point flows:

- выбор destination PVZ
- выбор origin dropoff point
- фильтр `available_for_dropoff`

Pickup flows:

- получение pickup windows для склада
- выбор pickup window merchant-side или автоматический default policy

Shipment flows:

- создать shipment/order
- сохранить provider shipment id
- читать статус
- отменять, если разрешено provider state

### 8.6. Что не надо пытаться делать в v1 Yandex adapter

- сразу покрывать все edge cases возвратов;
- сразу делать label-printing для всех режимов;
- сразу решать multi-package advanced flows;
- сразу переносить в storefront весь order operations UI.

## 9. Внутренний API контур

### 9.1. Admin API

Нужны маршруты:

- `GET /admin/delivery/providers`
- `GET /admin/delivery/connections`
- `POST /admin/delivery/connections`
- `POST /admin/delivery/connections/:id/test`
- `POST /admin/delivery/connections/:id/disable`
- `GET /admin/delivery/warehouses`
- `POST /admin/delivery/warehouses`
- `PUT /admin/delivery/warehouses/:id`
- `POST /admin/delivery/test-quote`
- `GET /admin/delivery/logs`
- `POST /admin/delivery/shipping-options/sync` (manual-only, dry-run by default, execute via explicit guard)

### 9.2. Store API

Materialized в текущем tranche-safe backend/store contract-first scope:

- `GET /store/delivery/catalog`
- `GET /store/delivery/quotes`
- `GET /store/delivery/pickup-points`
- `GET /store/delivery/pickup-windows`
- `GET /store/delivery/readiness`

Дополнительно truthfully materialized на storefront side поверх этого route:
 
- read-only checkout readiness preview в [`shipping/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/checkout/components/shipping/index.tsx), который читает readiness через [`retrieveDeliveryHubReadiness()`](../medusa-agency-boilerplate-storefront/src/lib/data/delivery-hub.ts:187), собирает UI-safe summary через [`buildDeliveryHubReadinessPreviewModel()`](../medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub.ts:1324) и intentionally не делает `save/selection` side-effects.
- read-only checkout summary preview в [`shipping-summary/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/checkout/components/shipping-summary/index.tsx), который также читает [`retrieveDeliveryHubReadiness()`](../medusa-agency-boilerplate-storefront/src/lib/data/delivery-hub.ts:187), сводит persisted neutral selection/readiness к узкому summary model через [`buildDeliveryHubSummaryPreviewModel()`](../medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub.ts:1356) и показывает только shopper-safe поля `status / modality / readiness issues / updated_at` без automatic save/select/commit side-effects и без Yandex-specific/internal contract leaks.
- следующим tranche-safe шагом поверх readiness/summary contour теперь тоже materialized read-only persisted selection preview в [`shipping/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/checkout/components/shipping/index.tsx) через [`retrieveDeliveryHubSelection()`](../medusa-agency-boilerplate-storefront/src/lib/data/delivery-hub.ts:135), который sampled-но читает persisted neutral selection boundary и сводит его к shopper-safe informational model через [`buildDeliveryHubPersistedSelectionPreviewModel()`](../medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub.ts:1370), показывая только `status / modality / quote snapshot / pickup hints / readiness relationship / updated_at` без leaked provider/internal ids, без `save selection`, без `clear selection`, без [`setShippingMethod()`](../medusa-agency-boilerplate-storefront/src/lib/data/cart.ts:226), без commit side-effects и без dual-flow shopper UX.
- следующим tranche-safe шагом поверх readiness/summary/persisted-selection contour теперь тоже materialized: read-only shadow catalog preview в [`shipping/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/checkout/components/shipping/index.tsx) через [`listDeliveryHubCatalog()`](../medusa-agency-boilerplate-storefront/src/lib/data/delivery-hub.ts:63), который sampled-но запрашивает neutral catalog summary для текущего checkout context, собирает shopper-safe informational model через [`buildDeliveryHubShadowCatalogPreviewModel()`](../medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub.ts:1418) и показывает только connection availability / default hint / modality coverage / capability hints без leaked provider/internal ids, без `save selection`, без `clear selection`, без [`setShippingMethod()`](../medusa-agency-boilerplate-storefront/src/lib/data/cart.ts:226), без commit side-effects и без dual-flow shopper UX.
- следующим tranche-safe шагом поверх readiness/summary/persisted-selection/shadow-catalog contour теперь тоже materialized: read-only shadow pickup-point preview в [`shipping/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/checkout/components/shipping/index.tsx) через [`listDeliveryHubPickupPoints()`](../medusa-agency-boilerplate-storefront/src/lib/data/delivery-hub.ts:103), который sampled-но запрашивает neutral pickup points для текущего checkout city/country/cart context, собирает shopper-safe informational model через [`buildDeliveryHubShadowPickupPointPreviewModel()`](../medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub.ts:1737) и показывает только pickup-point count / destination-pickup hints / errors без `save selection`, `set shipping method`, commit side-effects или dual-flow shopper UX.
- следующим tranche-safe шагом поверх sampled pickup-point context теперь тоже materialized read-only shadow quote preview в [`shipping/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/checkout/components/shipping/index.tsx) через [`listDeliveryHubQuotes()`](../medusa-agency-boilerplate-storefront/src/lib/data/delivery-hub.ts:89), который sampled-но запрашивает neutral quotes для текущего checkout city/country/cart context, собирает shopper-safe informational model через [`buildDeliveryHubShadowQuotePreviewModel()`](../medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub.ts:1659) и показывает только availability/count/modality/hints/errors без `save selection`, `set shipping method`, commit side-effects или dual-flow shopper UX.
- следующим tranche-safe шагом поверх readiness/summary/persisted-selection/shadow-catalog contour теперь materialized read-only store settings surface [`GET /store/delivery/settings`](../medusa-agency-boilerplate/src/api/store/delivery/settings/route.ts) и adjacent shadow settings preview в [`shipping/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/checkout/components/shipping/index.tsx): backend route вызывает [`getStoreSettings()`](../medusa-agency-boilerplate/src/modules/delivery-hub/service.ts:724) и возвращает только shopper-safe neutral settings read model `enabled | status | summary | preview_visibility | hints` без provider/internal ids, без secrets и без mutation path; storefront sampled-но читает этот контракт через [`retrieveDeliveryHubSettings()`](../medusa-agency-boilerplate-storefront/src/lib/data/delivery-hub.ts:76), строит informational visibility summary через [`buildDeliveryHubShadowSettingsPreviewModel()`](../medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub.ts:1534) и показывает только feature/config/debug/operator visibility без `save selection`, без `clear selection`, без [`setShippingMethod()`](../medusa-agency-boilerplate-storefront/src/lib/data/cart.ts:226), без commit side-effects и без dual-flow shopper UX.
- поверх sampled shadow quote context теперь materialized ещё и read-only shadow pickup-window preview в [`shipping/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/checkout/components/shipping/index.tsx): компонент only-if-needed вызывает [`listDeliveryHubPickupWindows()`](../medusa-agency-boilerplate-storefront/src/lib/data/delivery-hub.ts:119), а helper [`buildDeliveryHubShadowPickupWindowPreviewModel()`](../medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub.ts:1821) сводит ответ к shopper-safe availability / required-quote-count / hints / errors summary без leaked identifiers, без provider-specific copy, без `save selection`, `set shipping method`, commit side-effects и без dual-flow shopper UX.
- approved шагом поверх этих read-only blocks materialized narrow storefront-only shadow shipping-option parity preview в [`shipping/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/checkout/components/shipping/index.tsx), который через [`buildDeliveryHubShadowShippingOptionParityPreviewModel()`](../medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub.ts:1957) сравнивает committed legacy shipping method/cart state только с уже загруженными neutral shadow settings / quote / pickup-point summaries и сводит результат к shopper-safe parity vocabulary `aligned | divergent | insufficient_context | not_applicable`, не вызывая [`saveDeliveryHubSelection()`](../medusa-agency-boilerplate-storefront/src/lib/data/delivery-hub.ts:151), [`clearDeliveryHubSelection()`](../medusa-agency-boilerplate-storefront/src/lib/data/delivery-hub.ts:169), [`setShippingMethod()`](../medusa-agency-boilerplate-storefront/src/lib/data/cart.ts:226), shopper mutations, CTA wiring или checkout cutover.
- следующим tranche-safe шагом поверх approved shadow shipping-option parity preview теперь тоже materialized read-only shadow selection parity preview в [`shipping/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/checkout/components/shipping/index.tsx): компонент сравнивает только уже committed legacy shipping method/cart state с уже загруженным neutral persisted selection boundary через [`buildDeliveryHubShadowSelectionParityPreviewModel()`](../medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub.ts:2159), сводя результат к narrow shopper-safe vocabulary `aligned | missing_legacy_method | missing_neutral_selection | modality_mismatch | reference_mismatch | insufficient_data`; preview показывает лишь informational modality/reference/readiness alignment hints, не вызывает [`saveDeliveryHubSelection()`](../medusa-agency-boilerplate-storefront/src/lib/data/delivery-hub.ts:151), [`clearDeliveryHubSelection()`](../medusa-agency-boilerplate-storefront/src/lib/data/delivery-hub.ts:169), [`setShippingMethod()`](../medusa-agency-boilerplate-storefront/src/lib/data/cart.ts:226), не раскрывает provider/internal identifiers и не подменяет active ApiShip shopper flow.
- текущим tranche-safe storefront шагом поверх уже существующих read-only shadow/readiness summaries materialized read-only shadow orchestration verdict preview в [`shipping/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/checkout/components/shipping/index.tsx), который сводит readiness / persisted selection / settings / catalog / quote / pickup-point / pickup-window / actionability / shipping-option parity / selection parity только через [`buildDeliveryHubShadowOrchestrationVerdictPreviewModel()`](../medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub.ts:2788) к compact neutral verdict vocabulary `aligned | degraded | blocked | insufficient_data`; preview остаётся rollout-observability only, показывает лишь compact severity/count/hints summary, не вызывает [`saveDeliveryHubSelection()`](../medusa-agency-boilerplate-storefront/src/lib/data/delivery-hub.ts:151), [`clearDeliveryHubSelection()`](../medusa-agency-boilerplate-storefront/src/lib/data/delivery-hub.ts:169), [`setShippingMethod()`](../medusa-agency-boilerplate-storefront/src/lib/data/cart.ts:226), не добавляет shopper-interactive CTA wiring и не подменяет active ApiShip shopper flow.
- следующим approved storefront-only шагом поверх orchestration verdict materialized read-only shadow recommendation preview в [`shipping/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/checkout/components/shipping/index.tsx): pure builder [`buildDeliveryHubShadowOrchestrationRecommendationPreviewModel()`](../medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub.ts:2837) агрегирует только уже существующие readiness / persisted selection / actionability / shipping-option parity / selection parity / orchestration verdict summaries и truthfully возвращает shopper-safe neutral result `recommended | unavailable | insufficient_data`; block явно остаётся informational/shadow-only, показывает лишь shopper-safe modality / pickup-point / pickup-window / quote snapshot при aligned shadow constellation, а при неполном или degraded контексте не выдумывает уверенную рекомендацию, не раскрывает provider/internal identifiers, не вызывает [`saveDeliveryHubSelection()`](../medusa-agency-boilerplate-storefront/src/lib/data/delivery-hub.ts:151), [`clearDeliveryHubSelection()`](../medusa-agency-boilerplate-storefront/src/lib/data/delivery-hub.ts:169), [`setShippingMethod()`](../medusa-agency-boilerplate-storefront/src/lib/data/cart.ts:226) и не меняет active legacy ApiShip commit path.

Пока planned и не materialized в коде:
 
- checkout cutover на neutral settings/quote contract;
- mutation semantics для shopper-facing settings surface.
### 9.3. Checkout contract

Долгосрочно shipping method data в cart должна хранить не `apiship`-формат, а нейтральный selection:
 
 - `carrier_code`
 - `connection_id`
 - `mode_code`
 - `quote_key`
 - `provider_quote_ref`
 - `pickup_point_id`
 - `pickup_point_label`
 - `pickup_point_address`
 - `pickup_window_from`
 - `pickup_window_to`

Truthful текущий промежуточный статус:
 
- active shopper checkout flow всё ещё использует legacy ApiShip shipping-method persistence в storefront [`setShippingMethod()`](../medusa-agency-boilerplate-storefront/src/lib/data/cart.ts:226) и checkout UI [`Shipping`](../medusa-agency-boilerplate-storefront/src/modules/checkout/components/shipping/index.tsx:299);
- delivery-hub selection уже существует как отдельный neutral cart metadata contract через [`GET/POST/DELETE /store/delivery/selection`](../medusa-agency-boilerplate/src/api/store/delivery/selection/route.ts), но shopper-facing cutover в эту tranche не выполняется;
- storefront сейчас materializes только read-only readiness visibility, read-only summary visibility, read-only persisted-selection visibility, sampled read-only shadow catalog visibility, sampled read-only shadow pickup-point visibility, sampled read-only shadow quote visibility и dependent read-only shadow pickup-window visibility через helper-level preview models без вмешательства в active shipping selection flow.

## 10. Стратегия выпиливания ApiShip

### 10.1. Общий принцип

`ApiShip` убирается полностью, но не в первый день.

Нужен controlled migration:

1. реализовать `deliveryhub + yandex`;
2. добавить safe read-only storefront readiness visibility без изменения active shopper flow;
3. переключить storefront quotes/selection на `deliveryhub`;
4. переключить admin operations на `deliveryhub`;
5. оставить legacy handling только для уже созданных старых заказов;
6. удалить ApiShip код;
7. удалить ApiShip env и docs.

### 10.2. Порядок удаления

После ready-state удалить:

- `medusa-agency-boilerplate/src/modules/apiship.ts`
- `medusa-agency-boilerplate/src/modules/apiship-*`
- `medusa-agency-boilerplate/src/api/store/apiship/*`
- `medusa-agency-boilerplate/src/api/admin/apiship/*`
- storefront `src/lib/data/apiship.ts`
- storefront `apiship` utilities и selection logic
- `APISHIP_*` env contract
- seed/update logic под `apiship`

### 10.3. Что нужно сохранить на время миграции

- исторические shipping methods и historical order data;
- migration adapters для старых orders, если они уже созданы через ApiShip;
- storefront backward safety до cutover.

## 11. Этапы реализации

### Этап A. Foundation

Сделать:

- `delivery-hub` module scaffold
- таблицы
- encryption helper
- provider registry
- adapter interface

Definition of Done:

- модуль поднимается без включенного провайдера;
- startup не требует новых обязательных секретов;
- есть unit tests на registry и config storage.

### Этап B. Admin foundation

Сделать:

- `Settings -> Delivery`
- CRUD connections
- `Test connection`
- warehouses page

Definition of Done:

- merchant может сохранить Yandex connection без правки env;
- можно проверить соединение из админки;
- UI реализован через `src/admin/routes/*`, без форка official admin.

### Этап C. Yandex quote engine

Сделать:

- `pickup-points/list`
- `offers/info`
- `offers/create`
- `pickups/pickup-options`
- normalization в `DeliveryQuote`

Definition of Done:

- из admin test screen работают:
  - `warehouse -> PVZ`
  - `dropoff point -> PVZ`
- есть логируемый debug summary;
- есть integration tests на test token flow.

### Этап D. Storefront cut-in

Частично materialized заранее безопасным backend-first tranche:

- store routes `catalog/quotes/pickup-points/pickup-windows`
- neutral selection data

Остаётся сделать:

- checkout integration

Definition of Done:

- storefront получает catalog и quotes без зависимости от `apiship`;
- выбор ПВЗ сохраняется в cart через новый delivery contract;
- regression tests по checkout не падают.

### Этап E. Shipment operations

Сделать:

- create shipment
- status sync
- cancel path
- admin order widget

Definition of Done:

- админ может из заказа создать и обновить отгрузку;
- shipment id и статусы хранятся внутри `delivery-hub`.

### Этап F. ApiShip removal

Сделать:

- cutover
- cleanup
- env removal
- docs update

Definition of Done:

- код и UI больше не зависят от ApiShip;
- проект проходит bootstrap/build/dev без `APISHIP_*`;
- docs и current status truthfully отражают новый слой.

## 12. Тестовая стратегия

Целевой coverage для полного v1:

- unit tests на adapter interface и normalization;
- integration tests на Yandex test mode;
- admin API tests на connection setup и test quote;
- storefront regression tests для выбора ПВЗ;
- migration tests для старых cart/order states;
- логирование и error-shape tests.

Truthful status для текущей tranche-1 реализации уже уже narrower:

- materialized базовые unit tests на encryption / registry / provider listing;
- materialized admin contract tests на connections list/create, `Test connection`, `Test quote` success shape и stable error serialization;
- Yandex integration tests, storefront regressions, migration coverage и отдельный log-level test suite остаются deferred.

## 13. Главные риски

- Yandex API может требовать более сложный order/claim lifecycle, чем quote stage;
- хранение merchant credentials потребует аккуратного encryption policy;
- merchant UX легко превратить в сложную форму на 40 полей;
- migration с ApiShip может задеть checkout data shape;
- direct integrations потребуют своей поддержки и monitoring discipline.

## 14. Решение по roadmap

Новый shipping direction для долгосрочной архитектуры:

- не `ApiShip-first`
- а `own delivery layer first`
- первый adapter = `Yandex Delivery`

Исторический ApiShip slice при этом остается truthful source-of-truth как уже реализованный и подтвержденный промежуточный этап проекта.

## 15. Первый implementation slice

Самый первый tranche разработки:

1. scaffold `delivery-hub` module;
2. adapter interface;
3. Yandex connection storage;
4. admin page `Settings -> Delivery`;
5. admin action `Test connection`;
6. admin action `Test quote`;
7. direct Yandex `warehouse -> PVZ` и `dropoff point -> PVZ` quote flows.




## 16. Remediation v1.1 — закрытие пробелов и расхождений с кодовой базой

> Этот раздел был добавлен после code-vs-spec ревью и переопределяет §§1–15 везде, где они расходятся с фактической реализацией в [`src/modules/delivery-hub/`](../medusa-agency-boilerplate/src/modules/delivery-hub/index.ts) и [`src/api/admin/delivery/`](../medusa-agency-boilerplate/src/api/admin/delivery/connections/route.ts).
>
> §§1–15 остаются как описание целевого направления и долгосрочной модели; §16 — как truthful slice того, что реально живёт в коде на дату второй редакции, и какие из перечисленных в §§1–15 пунктов считаются `materialized`, `deferred`, `reserved`.

### 16.1. Adapter contract v1 (фактический)

Adapter contract v1 ограничен следующим набором методов и описан в [`adapters/types.ts`](../medusa-agency-boilerplate/src/modules/delivery-hub/adapters/types.ts):

- `definition: { code, label, capabilities[], supported_mode_codes[] }`
- `testConnection(context)`
- `listPickupPoints(context, { city?, country_code? })`
- `listPickupWindows(context, { warehouse_id })`
- `quoteWarehouseToPickupPoint(context, { warehouse_id, destination_point_id, interval_utc?, currency_code?, items? })`
- `quoteDropoffPointToPickupPoint(context, { origin_point_id, destination_point_id, currency_code?, items? })`

Методы из §4.2, отсутствующие в v1, классифицируются как **reserved для adapter contract v2**:

- `listWarehouses` — reserved именно как provider-side adapter method; локальный warehouse domain и admin CRUD уже materialized в v1, но provider sync/import и provider-side warehouse listing в adapter contract пока не входят (см. §16.4–§16.5).
- `quote` (объединённый) — reserved; в v1 quote разнесён по двум методам, чтобы явно различать pricing-calculator и offers/create flows у Yandex (см. §16.6).
- `createShipment`, `cancelShipment`, `getShipment` — reserved для этапа E (`Shipment operations`).
- `handleWebhook` — reserved для post-v1; конкретный путь (webhook vs polling) фиксируется в §16.6.

Любой новый adapter обязан реализовать adapter contract v1 целиком. Расширение до v2 идёт отдельным versioned changelog в этом документе.

### 16.2. Capabilities дескриптор

`capabilities[]` — нормализованный список ключей, которые adapter поддерживает. В v1 разрешены значения:

- `test_connection`
- `list_pickup_points`
- `list_pickup_windows`
- `quote_warehouse_to_pickup_point`
- `quote_dropoff_point_to_pickup_point`

`supported_mode_codes[]` — подмножество `DELIVERY_HUB_MODE_CODE` (см. §16.3).

Реальный пример — [`adapters/yandex/capabilities.ts`](../medusa-agency-boilerplate/src/modules/delivery-hub/adapters/yandex/capabilities.ts).

Storefront и admin UI обязаны фильтровать доступные действия по `capabilities[]`, а не по hard-coded списку провайдеров.

### 16.3. Режимы доставки в v1 (фактические)

`DELIVERY_HUB_MODE_CODE`, материализованный в [`constants.ts`](../medusa-agency-boilerplate/src/modules/delivery-hub/constants.ts), содержит ровно два кода:

- `warehouse_to_pickup_point`
- `dropoff_point_to_pickup_point`

Все остальные режимы из §6.2 (`to_door`, `to_pickup_point`, `warehouse_to_door`, `courier_pickup_to_pickup_point`, `same_day_to_door`) считаются:

- shopper-facing коды (`to_door`, `to_pickup_point`) — **reserved** до этапа D (storefront cut-in); добавляются в `DELIVERY_HUB_SHOPPER_MODE_CODE` отдельной константой, когда появится storefront-route.
- operational коды (`warehouse_to_door`, `courier_pickup_to_pickup_point`, `same_day_to_door`) — **deferred**; не входят в v1, не присутствуют в schemas, не входят в `supported_mode_codes` ни одного adapter.

Spec §6.2 остаётся целевой моделью; §16.3 — реальный scope v1.

### 16.4. Доменные сущности — что реально материализовано

| Сущность из §6.1 | Статус v1 | Где живёт |
| --- | --- | --- |
| `delivery_provider` | logical only | в registry [`registry.ts`](../medusa-agency-boilerplate/src/modules/delivery-hub/registry.ts), без отдельной таблицы |
| `delivery_connection` | materialized | таблица `delivery_connections`, см. [`connections-repository.ts`](../medusa-agency-boilerplate/src/modules/delivery-hub/storage/connections-repository.ts) |
| `delivery_warehouse` | materialized, но узко | таблица `delivery_warehouses`, доменная модель в [`warehouse.ts`](../medusa-agency-boilerplate/src/modules/delivery-hub/domain/warehouse.ts), persistence в [`warehouses-repository.ts`](../medusa-agency-boilerplate/src/modules/delivery-hub/storage/warehouses-repository.ts) |
| `delivery_mode` | logical only | константы в `DELIVERY_HUB_MODE_CODE`, без таблицы |
| `delivery_quote_cache` | deferred | этап C+, см. §16.7 (idempotency) |
| `delivery_shipment` | deferred | этап E |
| `delivery_event_log` | materialized | таблица `delivery_event_logs`, см. [`event-log-repository.ts`](../medusa-agency-boilerplate/src/modules/delivery-hub/storage/event-log-repository.ts) |
| `delivery_secret` | inlined into `delivery_connection` | поля `credentials_envelope`, `credentials_state`, `credentials_fingerprint` |

`delivery_warehouse` в текущем v1 — это **минимальная локальная persistent сущность**, а не broad orchestration layer: merchant может list/create/update warehouse, задать `provider_code` и optional `provider_warehouse_id`, а `default_warehouse_id` в connection config ссылается на локальный warehouse record. Provider sync/import, mode matrix, shipment lifecycle и provider-owned warehouse management остаются deferred.

`delivery_secret` как отдельная таблица в v1 не вводится. Если в v2 потребуется multi-credential per connection (например, OAuth refresh token + API token), таблица может быть выделена через отдельную миграцию.

### 16.5. Admin/Store API surface — фактический и planned

Admin API v1 (materialized):

- `GET /admin/delivery/providers` — см. [`providers/route.ts`](../medusa-agency-boilerplate/src/api/admin/delivery/providers/route.ts).
- `GET /admin/delivery/connections` — см. [`connections/route.ts`](../medusa-agency-boilerplate/src/api/admin/delivery/connections/route.ts).
- `POST /admin/delivery/connections` — там же.
- `PUT /admin/delivery/connections/:id` — см. [`connections/[id]/route.ts`](../medusa-agency-boilerplate/src/api/admin/delivery/connections/[id]/route.ts).
- `POST /admin/delivery/connections/:id/test` — см. [`connections/[id]/test/route.ts`](../medusa-agency-boilerplate/src/api/admin/delivery/connections/[id]/test/route.ts).
- `GET /admin/delivery/warehouses` — см. [`warehouses/route.ts`](../medusa-agency-boilerplate/src/api/admin/delivery/warehouses/route.ts).
- `POST /admin/delivery/warehouses` — там же.
- `PUT /admin/delivery/warehouses/:id` — см. [`warehouses/[id]/route.ts`](../medusa-agency-boilerplate/src/api/admin/delivery/warehouses/[id]/route.ts).
- `POST /admin/delivery/test-quote` — см. [`test-quote/route.ts`](../medusa-agency-boilerplate/src/api/admin/delivery/test-quote/route.ts).
- `GET /admin/delivery/logs` — см. [`logs/route.ts`](../medusa-agency-boilerplate/src/api/admin/delivery/logs/route.ts); current surface intentionally остаётся read-only и узким.
- Все materialized admin route boundaries теперь explicit-но санитизируют и валидируют response payload через [`shared.ts`](../medusa-agency-boilerplate/src/api/admin/delivery/shared.ts): polluted provider/internal/secret-like fragments либо блокируются shape-validation error, либо редактируются до safe summary-only/admin-safe structured payload. Это зафиксировано no-network route coverage и не означает live provider verification.

Admin API v1.x (planned, остаются в §9.1 как целевая поверхность, но в коде ещё нет):

- `POST /admin/delivery/connections/:id/disable` — может быть реализован как частный случай `PUT /admin/delivery/connections/:id` с `enabled=false` и `status=disabled`. Пока merchant disable выполняется через общий PUT.

Store API (частично materialized в коде):

- `GET /store/delivery/catalog` — см. [`catalog/route.ts`](../medusa-agency-boilerplate/src/api/store/delivery/catalog/route.ts).
- `GET /store/delivery/quotes` — см. [`quotes/route.ts`](../medusa-agency-boilerplate/src/api/store/delivery/quotes/route.ts).
- `GET /store/delivery/pickup-points` — см. [`pickup-points/route.ts`](../medusa-agency-boilerplate/src/api/store/delivery/pickup-points/route.ts).
- `GET /store/delivery/pickup-windows` — см. [`pickup-windows/route.ts`](../medusa-agency-boilerplate/src/api/store/delivery/pickup-windows/route.ts).

Store API всё ещё intentionally узкий:
 
- [`GET /store/delivery/settings`](../medusa-agency-boilerplate/src/api/store/delivery/settings/route.ts) теперь materialized как read-only neutral settings surface и возвращает только shopper-safe fields `enabled | status | summary | preview_visibility | hints` без provider/internal ids, без secrets и без mutation semantics;
- storefront checkout пока не переключён на этот surface и продолжает использовать legacy `apiship` path;
- при этом storefront-side neutral data layer уже materialized как двухслойный scaffold: server data helpers в [`delivery-hub.ts`](../medusa-agency-boilerplate-storefront/src/lib/data/delivery-hub.ts) оборачивают [`GET /store/delivery/catalog`](../medusa-agency-boilerplate/src/api/store/delivery/catalog/route.ts), [`GET /store/delivery/settings`](../medusa-agency-boilerplate/src/api/store/delivery/settings/route.ts), [`GET /store/delivery/quotes`](../medusa-agency-boilerplate/src/api/store/delivery/quotes/route.ts), [`GET /store/delivery/pickup-points`](../medusa-agency-boilerplate/src/api/store/delivery/pickup-points/route.ts), [`GET /store/delivery/pickup-windows`](../medusa-agency-boilerplate/src/api/store/delivery/pickup-windows/route.ts), [`GET/POST/DELETE /store/delivery/selection`](../medusa-agency-boilerplate/src/api/store/delivery/selection/route.ts) и [`GET /store/delivery/readiness`](../medusa-agency-boilerplate/src/api/store/delivery/readiness/route.ts), а shared neutral contract/guardrail layer в [`delivery-hub.ts`](../medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub.ts) централизует explicit query/body shaping, runtime normalization shopper-safe types, preview builders для readiness / summary / shadow settings / shadow catalog / shadow quote / shadow pickup-window visibility, read-only shadow selection actionability / shipping-option parity / selection parity / orchestration verdict / recommendation / cutover-readiness / cutover-blockers previews, плюс отсечение leaked internal/provider-specific fragments; quote path читает backend-issued `quote_reference`, а не выводит reference локально из internal `quote_key`;
- current public contract опирается на materialized `Yandex Delivery` connection и minimal warehouse mapping;
- `GET /store/delivery/catalog` возвращает только shopper-safe neutral contract: `default_connection_id | null` и `connections[]`, где каждая запись ограничена полями `connection_id`, `label`, neutral readiness summary `state + ready` и neutral capabilities `quote_types`, `supports_pickup_points`, `supports_pickup_windows`, `supports_dropoff`;
- catalog intentionally не раскрывает `provider_code`, `credentials_state`, raw `enabled/status` fragments, `quote_key`, `raw_reference`, provider diagnostics или иные provider-facing internals;
- catalog сейчас truthfully перечисляет только `enabled` connections, а `default_connection_id` materializes only-one-ready-connection hint: значение выставляется только когда ровно одно connection находится в состоянии shopper-ready, иначе возвращается `null`; это не является claim о полноценно завершённой multi-connection orchestration;
- если в системе ровно одно `enabled + active + sealed` public-ready connection, оно выбирается автоматически для quote-like routes; иначе caller обязан передать `connection_id`;
- `pickup-windows` поддержан только для warehouse-origin flow через materialized warehouse/default-warehouse mapping;
- `GET /store/delivery/quotes` теперь возвращает shopper-safe `quote_reference` server-side и не раскрывает internal `quote_key`, `raw_reference`, embedded provider payload или reversible wrappers вокруг internal identifier;
- public responses не возвращают provider diagnostics, credentials, correlation metadata или внутренние connection-state fragments beyond neutral readiness summary (`connection_id`, neutral `state`, `ready`);
- все materialized store route boundaries теперь также explicit-но валидируют shopper-facing payload через [`shared.ts`](../medusa-agency-boilerplate/src/api/store/delivery/shared.ts): `catalog/settings/quotes/pickup-points/pickup-windows/selection/readiness` не пропускают leaked provider/internal fragments, а invalid boundary payloads деградируют до controlled validation error вместо пассивного проброса.

Все admin роуты делают `AuthenticatedMedusaRequest` (Medusa default admin auth). Никакого отдельного RBAC поверх Medusa в v1 не вводится; merchant считается одним actor.

### 16.6. Yandex pathway decision table

Прямая интеграция с Yandex Delivery в v1 идёт против base URL `https://b2b.taxi.yandex.net/b2b/cargo/integration/v2`, см. [`adapters/yandex/client.ts`](../medusa-agency-boilerplate/src/modules/delivery-hub/adapters/yandex/client.ts). Base URL фиксирован в коде и не вынесен в env, потому что является частью архитектурного решения «direct b2b cargo integration v2», а не client-specific input.

Routing решений по endpoint:

| Сценарий | Origin | Destination | Endpoint | Доп. требование |
| --- | --- | --- | --- | --- |
| `warehouse_to_pickup_point` | yandex warehouse station | yandex pickup point | `POST /pricing-calculator` с `last_mile_policy=self_pickup` | требуется `interval_utc`; если merchant не задал, adapter подставляет первый доступный pickup window из `POST /pickups/pickup-options` |
| `dropoff_point_to_pickup_point` | yandex pickup point с `available_for_dropoff=true` | yandex pickup point | `POST /offers/create` с `last_mile_policy=self_pickup` | TTL offer фиксируется provider-side; quote_key хранит `offer_id` |
| `list_pickup_points` | — | — | `POST /pickup-points/list` | фильтр `country` берётся из `connection.country_code` |
| `list_pickup_windows` | yandex warehouse station | — | `POST /pickups/pickup-options` | используется только для warehouse origin |
| `test_connection` | — | — | `POST /pickup-points/list` с `limit=1` | success ⇒ ставим `connection.status=active`, `credentials_last_validated_at` |

Принципиальное различие, ранее не зафиксированное в §8: для warehouse origin Yandex использует `pricing-calculator`, для pickup point origin — `offers/create`. Эти два потока живут в разных методах adapter и не объединяются.

`interval_utc` всегда передаётся в UTC, не в Europe/Moscow. Конвертацию обязан делать caller (admin UI / адаптер), не Yandex.

Webhook vs polling: в v1 выбрано `polling`-only поведение для статусов отгрузок (когда дойдёт до этапа E). Webhook reserved для post-v1 и появится одновременно с тем, как будет добавлен `handleWebhook` в adapter contract v2.

### 16.7. Idempotency и quote cache

- `quote_key` нейтрального quote содержит provider-specific reference (`offer_id` для `dropoff_point_to_pickup_point`, generated key для `warehouse_to_pickup_point`).
- Provider-side TTL не контролируется delivery-hub. В v1 нет персистентного `delivery_quote_cache`; quote считается valid в пределах одной checkout-сессии и должен пере-quote'иться перед `place_order` на этапе E.
- `create_shipment` (этап E) обязан быть idempotent относительно `quote_key` + `cart_id` пары; конкретный механизм (idempotency-key header или dedup в БД) фиксируется отдельным release notes в §16, когда метод появится в коде.
- На этапе D storefront не должен полагаться на «вечный» quote: при смене корзины quote перезапрашивается.

### 16.8. Security contract (encryption / fingerprint / state machine)

Канонический encryption выполняется в [`security/encryption.ts`](../medusa-agency-boilerplate/src/modules/delivery-hub/security/encryption.ts).

- Алгоритм: `AES-256-GCM`, IV — 12 байт, auth tag — 16 байт.
- Envelope: `{ version: "dh.v1", mode: "sealed", iv, tag, ciphertext }`.
- Ключ — `process.env.DELIVERY_HUB_ENCRYPTION_KEY`.
  - Принимается base64 длиной 32 байта; иначе берётся `sha256(rawKey)`.
  - Ключ — **optional** на старте. Если ключ не задан, encryption state = `disabled`; merchant не может сохранить credentials, и любая попытка `encryptDeliveryHubCredentials` бросает `DELIVERY_HUB_ENCRYPTION_DISABLED`.
- Fingerprint: `sha256(JSON.stringify({ token }))`. Используется только для UI-индикации «credentials changed since last validation», не для авторизации.
- `credentials_state` machine:
  - `empty` — connection создан без credentials.
  - `sealed` — credentials валидно зашифрованы текущим ключом.
  - `disabled` — encryption выключен в env; credentials не могут быть прочитаны.
  - `invalid` — decrypt/read path materialized `DELIVERY_HUB_CREDENTIALS_INVALID`; service обязан persist-нуть `credentials_state=invalid` и `credentials_last_error_code=DELIVERY_HUB_CREDENTIALS_INVALID`, чтобы UI и повторные admin flows видели truthful state после key rotation / envelope corruption / auth failure.
- Key rotation policy v1: при смене `DELIVERY_HUB_ENCRYPTION_KEY` existing connections переходят в `invalid` при первой попытке decrypt/read. Merchant обязан повторно сохранить credentials. Auto-rotation не поддерживается. Это явное архитектурное решение — мы не храним shadow-копии старого ключа.
- Credentials per mode: v1 хранит **один** `credentials_envelope` на connection, не разделяя по `mode: test|live`. Если merchant меняет `mode`, токен остаётся прежним. Для разделения test/live нужно создать отдельный `delivery_connection`.

Contract redaction (см. [`security/redaction.ts`](../medusa-agency-boilerplate/src/modules/delivery-hub/security/redaction.ts) и [`adapters/yandex/redaction.ts`](../medusa-agency-boilerplate/src/modules/delivery-hub/adapters/yandex/redaction.ts)):

- никогда не сохранять raw `Authorization` header в `delivery_event_logs`;
- никогда не сохранять `credentials.token` в `request_summary` или `response_summary`;
- адаптер обязан экспортировать собственный `redactProviderHeaders` / `redactProviderPayload` и применять их в `client.post`-эквиваленте.


### 16.9. Error taxonomy (v1)

Все ошибки delivery-hub должны быть экземплярами `DeliveryHubError` (см. [`errors.ts`](../medusa-agency-boilerplate/src/modules/delivery-hub/errors.ts)).

Канонические коды v1:

| Code | HTTP status | Когда бросается |
| --- | --- | --- |
| `DELIVERY_HUB_VALIDATION_ERROR` | 400 | Входные данные не прошли Zod schema валидацию. |
| `DELIVERY_HUB_NOT_FOUND` | 404 | Connection по `id` не найден. |
| `DELIVERY_HUB_PROVIDER_NOT_SUPPORTED` | 404 | `provider_code` не зарегистрирован в registry. |
| `DELIVERY_HUB_ENCRYPTION_DISABLED` | 409 | `DELIVERY_HUB_ENCRYPTION_KEY` не задан, а credentials нужно зашифровать/расшифровать. |
| `DELIVERY_HUB_CREDENTIALS_REQUIRED` | 409 | Connection существует, но `credentials_envelope` пуст. |
| `DELIVERY_HUB_CREDENTIALS_INVALID` | 409 | Decrypt упал (повреждены данные или сменился ключ). |
| `DELIVERY_HUB_PROVIDER_ERROR` | 502 | Upstream ответил не-2xx. `details.provider_status`, `details.request`, `details.response` обязательны и уже прошли redaction. |

Любой новый код добавляется в [`errors.ts`](../medusa-agency-boilerplate/src/modules/delivery-hub/errors.ts) и в эту таблицу одновременно. Admin/Store роуты не выбрасывают сырые `Error`; они обязаны конвертировать их через `handleDeliveryHubError`.

HTTP-ответ error имеет форму:

```json
{
  "ok": false,
  "error": {
    "code": "DELIVERY_HUB_...",
    "message": "human readable",
    "details": { "...": "..." }
  }
}
```

### 16.10. Correlation / tracing contract

- Все calls к провайдеру делаются с `correlation_id = crypto.randomUUID()`.
- `correlation_id` обязан:
  - пробрасываться как provider-side request id (для Yandex — `X-Request-ID`);
  - сохраняться в `delivery_event_logs.correlation_id`;
  - возвращаться в merchant-facing response contract:
    - `testConnection` → `diagnostics.correlation_id`;
    - `testQuote` → top-level `correlation_id`.
- В error response correlation context может приходить в `error.details.correlation_id`, если он уже присутствует в normalized error details.
- Adapter обязан принимать `context.correlation_id` и не генерировать свой.

### 16.11. Event log contract

Таблица `delivery_event_logs` (см. [`event-log-repository.ts`](../medusa-agency-boilerplate/src/modules/delivery-hub/storage/event-log-repository.ts)) служит единственным durable audit trail. Kinds v1:

- `connection_test`
- `pickup_points`
- `pickup_windows`
- `quote`
- `credentials`
- `shipping_option_manual_sync`

Каждая запись хранит: `connection_id`, `kind`, `correlation_id`, `success`, `error_code?`, `request_summary` (sanitized), `response_summary` (sanitized), `created_at`.

Event log:

- не содержит raw tokens;
- не содержит raw upstream body, только sanitized summaries;
- для `shipping_option_manual_sync` хранит только operator-relevant summary: requested mode, execution mode, aborted/success outcome, current-option count, desired/reconciliation/operation/execution summaries, normalized/redacted error fragments и explicit Medusa ids из `mutation_context` только когда они нужны для audit;
- для `shipping_option_manual_sync` intentionally не хранит merchant credentials, raw secrets, full mutation payloads, raw confirmation strings и иные sensitive/internal blobs;
- `GET /admin/delivery/logs` уже materialized и поэтому не требует отдельного UI/refactor для базовой visibility manual sync audit trail.
- может агрессивно truncation'ить `response_summary` для больших payload'ов (лимит фиксируется в реализации, не в spec, но не выше 16 KiB per record).

`GET /admin/delivery/logs` уже materialized и читает эту таблицу. Текущий контракт intentionally narrow:

- read-only list endpoint без mutation paths;
- optional filters: `connection_id`, `provider_code`, `limit`;
- `limit` ограничен диапазоном `1..100`;
- список возвращается flat-массивом, отсортированным по `created_at desc`;
- текущий admin UI materializes это как встроенный read-only блок `Event logs` в `Settings -> Delivery`, без отдельной страницы.

Явные ограничения текущего logs surface:

- нет pagination;
- нет отдельного record detail view;
- нет export;
- нет replay/re-run;
- нет delete/cleanup action из admin UI или admin API.

### 16.12. Environment contract для delivery-hub

| Env key | Обязательность | Semantics |
| --- | --- | --- |
| `DELIVERY_HUB_ENCRYPTION_KEY` | Optional on boot, required перед сохранением credentials | Base64(32B) или любой raw string (тогда берётся sha256). Без этого ключа merchant не может использовать delivery-hub, но backend всё равно стартует. |
| `DELIVERY_HUB_ENABLED` | Reserved | В v1 не читается; зарезервирован на случай появления feature flag для раздельного rollout. |

Ни одно из значений не требуется для `npm run dev` / `npm run bootstrap` / `npm run preflight`. Это согласовано с [`client_init_contract.md`](./client_init_contract.md) §3.1: все delivery-env остаются в классе **Optional**.

Merchant-facing provider tokens (Yandex API token и т.п.) **не** живут в env. Они хранятся в `delivery_connection.credentials_envelope`. Это отдельное архитектурное требование и обязательно для любого нового adapter.

### 16.13. Fulfillment provider wiring (Medusa integration)

Текущий truthful статус связывания с Medusa fulfillment module:

- Канонический fulfillment provider code уже materialized как `deliveryhub`, а provider id — как `deliveryhub_deliveryhub` в [`shipping-option-contract.ts`](../medusa-agency-boilerplate/src/modules/delivery-hub/shipping-option-contract.ts) и реэкспортируется через [`provider-surface.ts`](../medusa-agency-boilerplate/src/modules/delivery-hub/provider-surface.ts).
- В [`medusa-config.ts`](../medusa-agency-boilerplate/medusa-config.ts) теперь truthfully регистрируется новый fulfillment provider [`deliveryhub.ts`](../medusa-agency-boilerplate/src/modules/deliveryhub.ts) **без новых обязательных env** и без удаления параллельного legacy provider `apiship`.
- Добавлен отдельный canonical backend contract для `deliveryhub` shipping-option metadata: versioned `shipping_option.data` shape = `version + provider_code + provider_id + id + mode_code`, где `id` — canonical mode-level option identity формата `deliveryhub:<mode_code>`, а `provider_code/provider_id` — явная provider identity.
- Helper surface в [`shipping-option-contract.ts`](../medusa-agency-boilerplate/src/modules/delivery-hub/shipping-option-contract.ts) materializes build/normalize/validate path для двух уже существующих mode-контуров: `warehouse_to_pickup_point` и `dropoff_point_to_pickup_point`, включая additive-safe legacy alias handling (`mode_code`, `quote_type`, plain mode id) и guardrails против provider/mode mismatch.
- Следующий tranche-safe шаг теперь truthfully materialized как planner/read-model в [`shipping-option-planner.ts`](../medusa-agency-boilerplate/src/modules/delivery-hub/shipping-option-planner.ts:71): helper [`planDeliveryHubDesiredShippingOptions()`](../medusa-agency-boilerplate/src/modules/delivery-hub/shipping-option-planner.ts:71) вычисляет desired canonical `deliveryhub` shipping-option set по текущим `delivery_connection` / `delivery_warehouse`, агрегирует `desired_options`, `deferred_options` и per-connection statuses, использует canonical metadata helpers из [`shipping-option-contract.ts`](../medusa-agency-boilerplate/src/modules/delivery-hub/shipping-option-contract.ts) и явно не делает DB write / Medusa sync side-effects.
- Поверх planner теперь materialized отдельный read-only reconciliation layer в [`shipping-option-reconciliation.ts`](../medusa-agency-boilerplate/src/modules/delivery-hub/shipping-option-reconciliation.ts): helper [`reconcileDeliveryHubShippingOptions()`](../medusa-agency-boilerplate/src/modules/delivery-hub/shipping-option-reconciliation.ts:69) принимает desired `deliveryhub` projections и current Medusa shipping-option snapshots, распознаёт managed `deliveryhub` options через canonical metadata contract (`normalizeDeliveryHubShippingOptionData()`), а затем строит typed diff buckets `create_candidates`, `update_candidates`, `unchanged`, `orphaned_managed_options`, `ignored_foreign_options` без каких-либо create/update/delete side-effects.
- Поверх reconciliation теперь materialized pure mutation-intent scaffold в [`shipping-option-sync-operation-plan.ts`](../medusa-agency-boilerplate/src/modules/delivery-hub/shipping-option-sync-operation-plan.ts): helper [`buildDeliveryHubShippingOptionSyncOperationPlan()`](../medusa-agency-boilerplate/src/modules/delivery-hub/shipping-option-sync-operation-plan.ts:76) принимает уже готовый reconciliation output и преобразует его в typed buckets `create_operations`, `update_operations`, `archive_operations`, `noops`, сохраняя canonical `provider_code`, `provider_id`, `mode_code`, `target_data`, `supporting_connection_ids` и причины `update/archive`, но по-прежнему не делает никаких DB writes, Medusa service mutations или route-side effects.
- Следующий tranche-safe write-preparation шаг теперь materialized как internal manual executor scaffold в [`shipping-option-sync-executor.ts`](../medusa-agency-boilerplate/src/modules/delivery-hub/shipping-option-sync-executor.ts): helper [`executeDeliveryHubShippingOptionSyncOperationPlan()`](../medusa-agency-boilerplate/src/modules/delivery-hub/shipping-option-sync-executor.ts:96) принимает output [`buildDeliveryHubShippingOptionSyncOperationPlan()`](../medusa-agency-boilerplate/src/modules/delivery-hub/shipping-option-sync-operation-plan.ts:82), исполняет только mutation buckets `create -> update -> archive` через abstract port [`DeliveryHubShippingOptionMutationPort`](../medusa-agency-boilerplate/src/modules/delivery-hub/shipping-option-sync-executor.ts:11), не трогает `noops`/`ignored_foreign_options`, возвращает typed execution report и остаётся detached от Medusa container/runtime.
- Поверх executor теперь materialized отдельный internal Medusa mutation-port bridge в [`shipping-option-medusa-mutation-port.ts`](../medusa-agency-boilerplate/src/modules/delivery-hub/shipping-option-medusa-mutation-port.ts): helper [`createDeliveryHubShippingOptionMedusaMutationPort()`](../medusa-agency-boilerplate/src/modules/delivery-hub/shipping-option-medusa-mutation-port.ts:118) принимает явно injected mutation service contract + mode-scoped create/update context, pure helpers [`mapCreateOperationToMedusaInput()`](../medusa-agency-boilerplate/src/modules/delivery-hub/shipping-option-medusa-mutation-port.ts:145), [`mapUpdateOperationToMedusaInput()`](../medusa-agency-boilerplate/src/modules/delivery-hub/shipping-option-medusa-mutation-port.ts:165) и [`mapArchiveOperationToMedusaInput()`](../medusa-agency-boilerplate/src/modules/delivery-hub/shipping-option-medusa-mutation-port.ts:184) materialize Medusa-like payloads для `createShippingOptions` / `updateShippingOptions` / `deleteShippingOptions`, а helper [`buildDeliveryHubShippingOptionManualSyncOrchestrator()`](../medusa-agency-boilerplate/src/modules/delivery-hub/shipping-option-medusa-mutation-port.ts:193) связывает plan + mutation port + executor только через explicit injected dependencies.
- Следующим tranche-safe шагом поверх этого теперь materialized explicit admin/manual sync layer в [`shipping-option-manual-sync.ts`](../medusa-agency-boilerplate/src/modules/delivery-hub/shipping-option-manual-sync.ts): helper [`runDeliveryHubShippingOptionManualSync()`](../medusa-agency-boilerplate/src/modules/delivery-hub/shipping-option-manual-sync.ts:134) собирает preview → reconciliation → operation plan и по умолчанию остаётся safe `dry_run`; helper [`createDeliveryHubShippingOptionManualSyncMedusaMutationService()`](../medusa-agency-boilerplate/src/modules/delivery-hub/shipping-option-manual-sync.ts:275) explicit-но заворачивает Medusa workflows `createShippingOptionsWorkflow` / `updateShippingOptionsWorkflow` / `deleteShippingOptionsWorkflow`, но используется только на manual execute-path.
- Следующий safe operational step поверх manual sync contour теперь тоже materialized: internal helper [`createDeliveryHubShippingOptionManualSyncAuditLogger()`](../medusa-agency-boilerplate/src/modules/delivery-hub/shipping-option-manual-sync-audit.ts:211) пишет summary-only audit events в existing `delivery_event_logs`, а [`runDeliveryHubShippingOptionManualSync()`](../medusa-agency-boilerplate/src/modules/delivery-hub/shipping-option-manual-sync.ts:134) вызывает его только в manual sync flow после `dry_run` / `execute` попыток и в fail-fast catch-path без side-effects для read-only preview.
- Admin-only route [`POST /admin/delivery/shipping-options/sync`](../medusa-agency-boilerplate/src/api/admin/delivery/shipping-options/sync/route.ts) теперь materializes sanctioned manual trigger: он читает current Medusa shipping-option snapshots, вызывает existing planner/reconciliation/operation-plan/executor primitives, по умолчанию возвращает `dry_run`-ответ без mutation side-effects, а execute-path доступен только при `mode="execute"` + `confirm_execute="deliveryhub:execute_shipping_option_sync"` + explicit `mutation_context`. Response truthfully включает `desired_plan`, `desired_plan_summary`, `reconciliation`, `reconciliation_summary`, `operation_plan`, `execution.mode` и `execution.report`.
- Этот новый bridge, audit helper и manual route intentionally не привязываются к startup sync, scheduler/job, storefront/public path, preview/read helpers или admin page auto-actions; они materialize только explicit operator-driven sync scaffold без automatic rollout.
- Reconciliation intentionally рассматривает managed options только когда snapshot проходит canonical normalization; malformed или foreign snapshots не переводятся в operation-plan mutation buckets и остаются в `ignored_foreign_options`, а managed archive/update intents строятся только из canonical reconciliation records.
- Planner intentionally фильтрует только provider'ы, реально поддержанные registry surface, а rollout readiness для mode'ов отражает deferred причины честно: unsupported provider, inactive/disabled connection, credentials not ready, missing/default warehouse problems и отсутствие provider warehouse mapping для `Yandex` `warehouse_to_pickup_point`.
- Внутренний executor scaffold, новый Medusa bridge, audit helper и manual sync route intentionally manual-only: они не привязаны к startup sync, scheduler/job, storefront/public path или read-side helpers и не встраиваются в [`service.ts`](../medusa-agency-boilerplate/src/modules/delivery-hub/service.ts) как implicit side-effect path.
- В [`service.ts`](../medusa-agency-boilerplate/src/modules/delivery-hub/service.ts) теперь materialized внутренние read-only helpers [`planDesiredShippingOptions()`](../medusa-agency-boilerplate/src/modules/delivery-hub/service.ts:128), [`buildShippingOptionPreview()`](../medusa-agency-boilerplate/src/modules/delivery-hub/service.ts:140), [`reconcileShippingOptions()`](../medusa-agency-boilerplate/src/modules/delivery-hub/service.ts:173) и [`buildShippingOptionSyncOperationPlan()`](../medusa-agency-boilerplate/src/modules/delivery-hub/service.ts:180), которые читают connections/warehouses, принимают current Medusa shipping-option snapshots и возвращают planner/reconciliation/operation-plan projections без write side-effects.
- Admin-only preview route [`GET /admin/delivery/shipping-options/preview`](../medusa-agency-boilerplate/src/api/admin/delivery/shipping-options/preview/route.ts) остаётся deliberately read-only consumer поверх planner + reconciliation.
- Отдельный admin-only manual sync route [`POST /admin/delivery/shipping-options/sync`](../medusa-agency-boilerplate/src/api/admin/delivery/shipping-options/sync/route.ts) intentionally не смешивается с preview/read path: default path = `dry_run`, explicit execute guarded, middleware protection = `adminAuth`, store/public coupling отсутствует, а operator audit visibility достигается через already-existing [`GET /admin/delivery/logs`](../medusa-agency-boilerplate/src/api/admin/delivery/logs/route.ts) вместо нового mutation/read surface.
- [`Settings -> Delivery`](../medusa-agency-boilerplate/src/admin/routes/settings/delivery/page.tsx) теперь materializes не только rollout-readiness block с desired options, deferred issues, per-connection planner state и reconciliation bucket summary, но и отдельный operator-facing manual sync control: default action остаётся safe `dry_run`, execute-path требует exact guard match и explicit Medusa ids, а сам UI intentionally остаётся manual scaffold без automatic rollout.
- Новый provider scaffold intentionally минимален: [`deliveryhub.ts`](../medusa-agency-boilerplate/src/modules/deliveryhub.ts) по-прежнему materializes только `getFulfillmentOptions()`, `validateOption()`, `validateFulfillmentData()`, `calculatePrice()` и нормализацию canonical `deliveryhub` selection payload; он не делает live quote orchestration, не создаёт shipment и не выполняет checkout cutover.
- `calculatePrice()` в текущем scaffold не зовёт внешние provider API: он принимает уже materialized neutral selection payload, валидирует mode/selection shape и возвращает `calculated_amount` + sanitized backend-facing `data` envelope, пригодный для следующих tranche'ей shipping option sync / fulfillment integration.
- ApiShip fulfillment provider (`apiship`) остаётся параллельным до окончания cutover (§10). В `medusa-config.ts` сейчас одновременно живут `manual`, optional `apiship` и новый `deliveryhub`.
- Shopper-facing `shipping_option.provider_id` со значением `deliveryhub` **ещё не materialized** как production checkout path: полный shipping option wiring, реальные sync job / create-update-delete mutations, storefront cutover и вытеснение `apiship` остаются deferred.

### 16.14. Storefront / checkout migration mapping

#### 16.14.1. Active checkout boundary

> **Текущее состояние на `2026-04-22`:** active checkout commit path остаётся целиком на legacy ApiShip. Ни один из materialized storefront shadow layers не вызывает [`saveDeliveryHubSelection()`](../medusa-agency-boilerplate-storefront/src/lib/data/delivery-hub.ts:151), [`clearDeliveryHubSelection()`](../medusa-agency-boilerplate-storefront/src/lib/data/delivery-hub.ts:169), [`setShippingMethod()`](../medusa-agency-boilerplate-storefront/src/lib/data/cart.ts:226) или любые другие commit side-effects. Legacy ApiShip checkout flow не меняется и не подменяется.

#### 16.14.2. Materialized storefront shadow preview layers

Все shadow layers живут в [`delivery-hub.ts`](../medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub.ts) и визуально surface'ятся в [`shipping/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/checkout/components/shipping/index.tsx). Каждый builder — pure function, read-only, без backend write calls и без checkout side-effects.

| # | Builder | Строка | Scope |
| --- | --- | --- | --- |
| 1 | [`buildDeliveryHubShadowCatalogPreviewModel()`](../medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub.ts:1868) | 1868 | Neutral connection availability / default hint / modality |
| 2 | [`buildDeliveryHubShadowSettingsPreviewModel()`](../medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub.ts:1984) | 1984 | Neutral settings status / preview visibility |
| 3 | [`buildDeliveryHubShadowQuotePreviewModel()`](../medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub.ts:2109) | 2109 | Sampled quote availability / count / modality |
| 4 | [`buildDeliveryHubShadowPickupPointPreviewModel()`](../medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub.ts:2187) | 2187 | Pickup-point count / destination availability |
| 5 | [`buildDeliveryHubShadowPickupWindowPreviewModel()`](../medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub.ts:2271) | 2271 | Pickup-window availability / required-quote dependency |
| 6 | [`buildDeliveryHubShadowShippingOptionParityPreviewModel()`](../medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub.ts:2407) | 2407 | Legacy vs neutral shipping-option parity |
| 7 | [`buildDeliveryHubShadowSelectionParityPreviewModel()`](../medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub.ts:2609) | 2609 | Legacy vs neutral selection parity |
| 8 | [`buildDeliveryHubShadowSelectionActionabilityPreviewModel()`](../medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub.ts:2861) | 2861 | Actionability vocabulary |
| 9 | [`buildDeliveryHubShadowOrchestrationVerdictPreviewModel()`](../medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub.ts:3094) | 3094 | Orchestration verdict |
| 10 | [`buildDeliveryHubShadowOrchestrationRecommendationPreviewModel()`](../medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub.ts:3202) | 3202 | Recommendation snapshot |
| 11 | [`buildDeliveryHubShadowCutoverBlockersPreviewModel()`](../medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub.ts:3318) | 3318 | Known blockers list |
| 12 | [`buildDeliveryHubShadowCutoverReadinessPreviewModel()`](../medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub.ts:3502) | 3502 | Cutover readiness status |
| 13 | [`buildDeliveryHubShadowCutoverNextStepsPreviewModel()`](../medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub.ts:3672) | 3672 | Next-step hints |
| 14 | [`buildDeliveryHubShadowCutoverSummaryPreviewModel()`](../medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub.ts:3765) | 3765 | Summary status |
| 15 | [`buildDeliveryHubShadowCutoverEvidencePreviewModel()`](../medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub.ts:3886) | 3886 | Supporting evidence signals |
| 16 | [`buildDeliveryHubShadowCutoverRolloutPreviewModel()`](../medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub.ts:4025) | 4025 | Rollout-oriented status: `observe_only / not_advised / insufficient_data` |
| 17 | [`buildDeliveryHubShadowCutoverGatePreviewModel()`](../medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub.ts:4174) | 4174 | Gate-by-gate breakdown: `aligned / blocked / insufficient_data` per gate |
| 18 | [`buildDeliveryHubShadowCutoverDecisionPreviewModel()`](../medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub.ts:4526) | 4526 | Pre-cutover verdict: `hold / observe_only / insufficient_data` |
| 19 | [`buildDeliveryHubShadowCutoverChecklistPreviewModel()`](../medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub.ts:4668) | 4668 | Checklist items: `ready / pending / blocked / insufficient_data` |

#### 16.14.3. Read-only boundary guarantees

Все 19 shadow preview builders:

- не invent'ят новый backend contract и не зовут новые backend APIs сверх уже materialized store routes (§16.5);
- не делают factual claims сверх уже вычисленных shadow previews;
- не раскрывают `provider_code`, internal ids, credentials или provider-specific fragments;
- при нехватке контекста честно деградируют к `insufficient_data` вместо имитации ready signal;
- каждый UI block explicitly маркирован как `read-only shadow preview only` и повторяет, что active checkout commit path остаётся на legacy ApiShip;
- checklist preview (#19) агрегирует только уже materialized previews и присваивает item statuses `ready | pending | blocked | insufficient_data`, где `pending` — neutral follow-up vocabulary без утверждения что cutover запущен, а `blocked` — только когда shadow picture truthfully показывает blockers / hold / not-advised rollout;
- decision preview (#18) truthfully возвращает только verdict `hold | observe_only | insufficient_data` и никогда `proceed` или `ready_to_cutover`;
- gate preview (#17) раскладывает будущее cutover decision на shopper-safe gates, но не делает claim что gates «пройдены» для production;
- rollout preview (#16) не утверждает что rollout рекомендован — vocabulary ограничен `observe_only | not_advised | insufficient_data`.

Targeted storefront coverage в [`delivery-hub.spec.ts`](../medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub.spec.ts) фиксирует status paths для всех materialized preview builders, включая `ready / pending / blocked / insufficient_data` paths для checklist preview.

#### 16.14.4. Migration mapping table

Storefront остаётся на legacy ApiShip surface до этапа D. На cutover требуется map старых полей shipping method data в нейтральные поля из §9.3:

| Legacy (ApiShip selection) | Delivery Hub (neutral selection) | Заметка |
| --- | --- | --- |
| `providerKey` (`"yataxi"`, ...) | `carrier_code` | Mapping table храним на backend (fixed). |
| `tariffId` | `mode_code` + `quote_key` | `tariffId` → `mode_code` через provider-specific mapper; оригинал сохраняется в `provider_quote_ref`. |
| `pointOutId` / `pointCode` | `pickup_point_id` | Строка, provider-native id. |
| `pointOutName` / address | `pickup_point_label`, `pickup_point_address` | Только label/display. |
| `pickupWindow` (если был) | `pickup_window_from`, `pickup_window_to` | ISO UTC. |
| ApiShip `connectionId` | `connection_id` | id нового `delivery_connection`. |

Поля в cart, которые раньше жили под `shipping_method.data.apiship.*`, переезжают в `shipping_method.data.delivery_hub.*`. Старые orders (уже оформленные через ApiShip) остаются на старой форме и читаются legacy mapper'ом до §16.15 sunset cleanup.

### 16.15. ApiShip sunset — gate criteria

`ApiShip` выпиливается только после того, как выполнены все следующие условия:

- `deliveryhub` fulfillment provider зарегистрирован и обслуживает production-rate quotes;
- storefront checkout получает не менее `N` заказов подряд (конкретный порог фиксируется в release notes) без обращения к legacy `/store/apiship/*` роутам;
- admin operations (create/cancel shipment, label generation там, где нужно) полностью переведены на `/admin/delivery/*`;
- нет активных shipping method в каталоге магазина с `provider_id="apiship"`;
- `delivery_event_logs` содержит success traces по обоим Yandex flows v1 (§16.6) на live mode;
- в [`Docs/current_work.md`](./current_work.md) зафиксирован `APISHIP_SUNSET_READY` checkpoint.

Только после прохождения всех gate criteria выполняется удаление по списку §10.2.

### 16.16. Test fixtures для direct Yandex v1

Существующий [`apiship_yandex_test_data.md`](./apiship_yandex_test_data.md) содержит тестовые warehouse / PVZ / payload через панель ApiShip. Эти же адреса и PVZ-идентификаторы **можно использовать как человеко-читаемые fixtures** для direct Yandex integration v1, но с поправками:

- `providerKey="yataxi"` и `pointInId` / `pointOutId` — это ApiShip-side абстракции, а не Yandex-native id. Direct Yandex adapter обязан получить свои pickup points через `POST /pickup-points/list` и использовать native `point_id`.
- ApiShip `pointCode` (UUID) обычно совпадает с Yandex-native `point_id` для `yataxi` и может использоваться как ожидаемое значение в integration tests, но это должно быть верифицировано перед каждым tranche.
- Тестовый груз из §8 (`weight=20`, габариты `10x10x10`, `assessedCost=1000`) остаётся валидным payload.
- Direct Yandex fixtures будут перенесены в отдельный документ `Docs/delivery_hub_yandex_test_data.md`, когда появится этап C; до этого эта §16.16 служит bridge между ApiShip-era fixtures и direct-Yandex integration tests.

### 16.17. Этапы (уточнённый scope)

Уточнение к §11:

- **Этап A (Foundation)** — materialized. Реализованы: module scaffold, `delivery_connection`/`delivery_event_log` storage, encryption, registry, adapter interface.
- **Этап B (Admin foundation)** — частично. Реализовано: materialized `Settings -> Delivery`, `Providers` list, `Connections` CRUD, `Yandex connection` form, minimal local `Warehouses` CRUD, `Test connection`, `Connection diagnostics`, admin-only read preview [`GET /admin/delivery/shipping-options/preview`](../medusa-agency-boilerplate/src/api/admin/delivery/shipping-options/preview/route.ts), admin-only manual sync scaffold [`POST /admin/delivery/shipping-options/sync`](../medusa-agency-boilerplate/src/api/admin/delivery/shipping-options/sync/route.ts), summary-only audit trail для manual shipping-option sync через existing logs contour, встроенный `Shipping option preview` block на странице и operator-facing `Shipping option manual sync` UI block с safe-by-default `dry_run` и guarded execute path. Не реализовано: `/connections/:id/disable` как отдельный роут, отдельный `Delivery Modes` surface, provider-driven warehouse sync/import, полноценный logs console beyond текущего read-only блока.
- **Этап C (Yandex quote engine)** — частично. Реализовано: `warehouse_to_pickup_point`, `dropoff_point_to_pickup_point`, listPickupPoints, listPickupWindows, admin `Test Quote` route/form, resolve локального `default warehouse` в `provider_warehouse_id` для Yandex quote path, canonical fulfillment metadata scaffold, desired shipping-option planner, read-only reconciliation diff against current Medusa shipping-option snapshots, pure sync-operation plan scaffold как база для будущего write workflow, manual executor scaffold, internal Medusa mutation-port adapter scaffold, admin-only manual sync API scaffold с safe dry-run default и guarded execute path, summary-only audit trail для manual sync attempts, а также preview surface для rollout readiness и operator-facing manual sync UI scaffold. Не реализовано: debug summary-экран beyond текущего preview, integration tests на Yandex test mode, automatic shipping-option rollout/cutover и mature operational workflow around shipping-option sync.
- **Этап D (Storefront cut-in)** — tranche-safe scaffold partially materialized, но полноценный cut-in не начат. Реализовано: neutral storefront data layer wrappers [`delivery-hub.ts`](../medusa-agency-boilerplate-storefront/src/lib/data/delivery-hub.ts), shared request/response shaping + runtime guardrails [`delivery-hub.ts`](../medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub.ts), read-only checkout readiness preview, read-only persisted selection preview, sampled read-only shadow catalog / settings / pickup-point / quote / pickup-window previews, read-only shadow shipping-option parity / selection parity / selection actionability / orchestration verdict / recommendation previews, read-only shadow cutover readiness / blockers / next-steps / summary / evidence previews, и серия cutover-planning shadow previews: rollout (#16), gate (#17), decision (#18), checklist (#19) — полный structured registry всех 19 materialized shadow preview builders приведён в §16.14.2. Store settings surface [`GET /store/delivery/settings`](../medusa-agency-boilerplate/src/api/store/delivery/settings/route.ts) materialized. Targeted storefront coverage [`delivery-hub.spec.ts`](../medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub.spec.ts) покрывает status paths для всех preview builders. Не реализовано: checkout UI switch, shipping method wiring, legacy ApiShip replacement, full storefront rollout. Store routes и storefront migration — см. §16.14. Active checkout commit path остаётся на legacy ApiShip — см. §16.14.1.
- **Этап E (Shipment operations)** — не начат. Включает `createShipment` / `getShipment` / `cancelShipment` и admin order widget.
- **Этап F (ApiShip removal)** — не начат. Стартует только после прохождения §16.15.

Текущий automated coverage для tranche-1 остаётся deliberately no-network и intentionally scoped к materialized seams, но больше не ограничивается только базовыми unit tests: service/backend invariants и security/adapter contour закрыты [`delivery-hub-tranche1-coverage.unit.spec.ts`](../medusa-agency-boilerplate/src/workflows/__tests__/delivery-hub-tranche1-coverage.unit.spec.ts), planner/manual-sync internals — [`delivery-hub.unit.spec.ts`](../medusa-agency-boilerplate/src/workflows/__tests__/delivery-hub.unit.spec.ts) и [`delivery-hub-manual-sync-audit.unit.spec.ts`](../medusa-agency-boilerplate/src/workflows/__tests__/delivery-hub-manual-sync-audit.unit.spec.ts), admin/store route boundaries — [`delivery-hub-admin.unit.spec.ts`](../medusa-agency-boilerplate/src/workflows/__tests__/delivery-hub-admin.unit.spec.ts) и [`delivery-hub-store.unit.spec.ts`](../medusa-agency-boilerplate/src/workflows/__tests__/delivery-hub-store.unit.spec.ts), а operator-facing admin page derived state — [`page-state.unit.spec.ts`](../medusa-agency-boilerplate/src/admin/routes/settings/delivery/__tests__/page-state.unit.spec.ts) через pure seam [`page-state.ts`](../medusa-agency-boilerplate/src/admin/routes/settings/delivery/page-state.ts). Это не эквивалент live network verification, storefront write-path wiring или checkout cutover.

### 16.18. Scope-lock для admin UI

Чтобы admin UI не расползался в 40-полевую форму, v1 фиксирует следующий scope:

- Текущий tranche-1 admin UI = `Providers` (read-only), `Connections` (list + create/edit + test), `Yandex connection`, `Warehouses` (list + create/edit), `Connection diagnostics`, `Test Quote` (ad-hoc форма), встроенный read-only `Logs` block, встроенный read-only `Shipping option preview` block и operator-facing `Shipping option manual sync` block. Всё.
- Backend admin surface теперь дополнительно содержит manual-only route [`POST /admin/delivery/shipping-options/sync`](../medusa-agency-boilerplate/src/api/admin/delivery/shipping-options/sync/route.ts) и summary-only audit visibility через existing [`GET /admin/delivery/logs`](../medusa-agency-boilerplate/src/api/admin/delivery/logs/route.ts); это не означает automatic rollout или новую public/store поверхность.
- Focused no-network UI coverage идёт через minimal pure/view-model seam [`page-state.ts`](../medusa-agency-boilerplate/src/admin/routes/settings/delivery/page-state.ts), который обслуживает derived/render-state для [`page.tsx`](../medusa-agency-boilerplate/src/admin/routes/settings/delivery/page.tsx) и не создаёт новую runtime surface.
- `Delivery Modes`, provider-driven warehouse sync/import, richer logs console beyond текущего embedded read-only list и shipment-oriented admin surfaces — этапы C/E.
- Карточка подключения Yandex в текущем v1 содержит: `Connection name`, `Mode` (test/live), `OAuth/API token`, `Country`, `Enabled`, `Auto confirm`, `Label generation type`, `Default warehouse id`.
- `Auto confirm` и `Label generation type` в tranche-1 работают как config passthrough fields и не должны читаться как доказательство materialized shipment maturity.
- `Default warehouse id` в tranche-1 уже привязан к materialized local warehouse entity, но это не означает provider sync/import или broad warehouse orchestration.

`default_warehouse_id` в `DeliveryHubConnectionConfigSchema` в v1 означает **локальный** `delivery_warehouse.id`, который backend service затем резолвит в `provider_warehouse_id` для Yandex test quote path. Поле остаётся опциональным и не подменяет собой shipment/domain maturity.

### 16.19. Изменения после этой редакции

Любое изменение §§1–15 требует синхронного обновления §16. При расхождении §§1–15 vs §16 tooling/реализация должны следовать §16. §§1–15 служат долгосрочным roadmap-нарративом; §16 — truthful текущий контракт, синхронизированный с кодом на дату `2026-04-22 (v1.3)`.

Изменения `v1.3` vs `v1.2`:

- §7.2, store/admin API status и §16.18 синхронизированы с materialized admin/store response-boundary hardening через [`shared.ts`](../medusa-agency-boilerplate/src/api/admin/delivery/shared.ts) и [`shared.ts`](../medusa-agency-boilerplate/src/api/store/delivery/shared.ts);
- §7.2, §16.17 и §16.18 теперь явно фиксируют focused no-network admin page seam [`page-state.ts`](../medusa-agency-boilerplate/src/admin/routes/settings/delivery/page-state.ts) + coverage [`page-state.unit.spec.ts`](../medusa-agency-boilerplate/src/admin/routes/settings/delivery/__tests__/page-state.unit.spec.ts) как часть current tranche-1 state, без overclaim про новый runtime surface;
- tests/status narrative переписан так, чтобы explicitly удерживать factual boundaries текущего tranche-1: checkout cutover не выполнен, storefront остаётся shadow/read-only, legacy ApiShip commit flow остаётся активным.

### 16.20. Pre-cutover next steps (scoped)

Следующие шаги между текущим состоянием (19 materialized read-only shadow preview layers) и началом реального checkout cutover. Этот список **не является обещанием немедленного cutover** и **не создаёт новых backend commitments**.

Возможные pre-cutover storefront/spec шаги:

1. **Shadow telemetry aggregation** — optional storefront-only builder, который агрегирует runtime success/failure statistics по всем 19 shadow preview fetch attempts для operator visibility; не требует нового backend API.
2. **Shadow preview confidence scoring** — optional storefront-only builder, который по existing shadow data вычисляет neutral confidence indicator для decision-making; не делает checkout cutover.
3. **Spec reconciliation checkpoint** — periodic doc-only pass для sync между materialized code state и §16; не создаёт code changes.

Ни один из этих шагов не:

- переключает active checkout commit path с legacy ApiShip;
- создаёт новые backend store/admin routes;
- вызывает `save selection`, `clear selection`, `setShippingMethod()` или другие commit side-effects;
- обещает timeline для production cutover.

Первый шаг, который потребует реального checkout cutover, будет explicitly маркирован как **Этап D cutover gate** и потребует прохождения всех gate criteria из §16.14.3 и §16.15.

