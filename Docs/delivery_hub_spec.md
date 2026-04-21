# Delivery Hub v1 Specification

> Статус документа: проектная спецификация на первую реализацию собственного слоя доставки.
>
> Дата первой редакции: `2026-04-21`.
>
> Дата remediation v1.1: `2026-04-21`. В §16 зафиксированы truthful правки, закрывающие все пробелы и несоответствия кодовой базе, выявленные review.
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

- `medusa-agency-boilerplate-storefront/src/lib/data/delivery.ts`
- `medusa-agency-boilerplate-storefront/src/lib/util/delivery.ts`
- адаптация checkout shipping UI к нейтральным quote/point contracts

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

### 6.3. Нейтральная модель quote

Каждый quote обязан содержать:

- `carrier_code`
- `carrier_label`
- `mode_code`
- `quote_key`
- `amount`
- `currency_code`
- `delivery_eta_min`
- `delivery_eta_max`
- `pickup_point_required`
- `pickup_point_ids[]` или `pickup_points_embedded[]`
- `pickup_window_required`
- `pickup_window_options[]`
- `raw_reference`

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

- реализованы разделы `Providers`, `Connections`, `Yandex connection`, `Warehouses`, `Connection diagnostics`, `Test Quote`, read-only `Event logs`;
- `Warehouses` materialized как минимальный admin-managed local warehouse surface с list/create/update, optional provider mapping и использованием в `default warehouse` binding; отдельный экран `Delivery Modes` в UI этой tranche все еще не реализован;
- страница работает поверх backend endpoints `GET /admin/delivery/providers`, `GET /admin/delivery/connections`, `POST /admin/delivery/connections`, `PUT /admin/delivery/connections/:id`, `POST /admin/delivery/connections/:id/test`, `GET /admin/delivery/warehouses`, `POST /admin/delivery/warehouses`, `PUT /admin/delivery/warehouses/:id`, `POST /admin/delivery/test-quote`, `GET /admin/delivery/logs`.

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

`Fetch provider metadata`, `Delivery Modes` surface, provider-driven warehouse sync и более развитая log console остаются следующими шагами и не должны считаться уже реализованными сверх текущего минимального warehouse CRUD и встроенного read-only logs блока.

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

### 9.2. Store API

Materialized в текущем tranche-safe backend/store contract-first scope:

- `GET /store/delivery/quotes`
- `GET /store/delivery/pickup-points`
- `GET /store/delivery/pickup-windows`

Пока planned и не materialized в коде:

- `GET /store/delivery/settings`

### 9.3. Checkout contract

Shipping method data в cart должна хранить не `apiship`-формат, а нейтральный selection:

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

## 10. Стратегия выпиливания ApiShip

### 10.1. Общий принцип

`ApiShip` убирается полностью, но не в первый день.

Нужен controlled migration:

1. реализовать `deliveryhub + yandex`;
2. переключить storefront quotes на `deliveryhub`;
3. переключить admin operations на `deliveryhub`;
4. оставить legacy handling только для уже созданных старых заказов;
5. удалить ApiShip код;
6. удалить ApiShip env и docs.

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

- store routes `quotes/pickup-points/pickup-windows`

Остаётся сделать:

- checkout integration
- neutral selection data

Definition of Done:

- storefront получает quotes без зависимости от `apiship`;
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

Admin API v1.x (planned, остаются в §9.1 как целевая поверхность, но в коде ещё нет):

- `POST /admin/delivery/connections/:id/disable` — может быть реализован как частный случай `PUT /admin/delivery/connections/:id` с `enabled=false` и `status=disabled`. Пока merchant disable выполняется через общий PUT.

Store API (частично materialized в коде):

- `GET /store/delivery/quotes` — см. [`quotes/route.ts`](../medusa-agency-boilerplate/src/api/store/delivery/quotes/route.ts).
- `GET /store/delivery/pickup-points` — см. [`pickup-points/route.ts`](../medusa-agency-boilerplate/src/api/store/delivery/pickup-points/route.ts).
- `GET /store/delivery/pickup-windows` — см. [`pickup-windows/route.ts`](../medusa-agency-boilerplate/src/api/store/delivery/pickup-windows/route.ts).

Store API всё ещё intentionally узкий:

- `GET /store/delivery/settings` не реализован;
- storefront checkout пока не переключён на этот surface и продолжает использовать legacy `apiship` path;
- current public contract опирается на materialized `Yandex Delivery` connection и minimal warehouse mapping;
- если в системе ровно одно `enabled + active + sealed` public-ready connection, оно выбирается автоматически; иначе caller обязан передать `connection_id`;
- `pickup-windows` поддержан только для warehouse-origin flow через materialized warehouse/default-warehouse mapping;
- public responses не возвращают provider diagnostics, credentials или correlation metadata.

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

Каждая запись хранит: `connection_id`, `kind`, `correlation_id`, `success`, `error_code?`, `request_summary` (sanitized), `response_summary` (sanitized), `created_at`.

Event log:

- не содержит raw tokens;
- не содержит raw upstream body, только sanitized summaries;
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

Планируемое связывание с Medusa fulfillment module:

- Один fulfillment provider id: `deliveryhub`.
- Регистрируется через `medusa-config.ts` после того, как появится модуль fulfillment provider, использующий `DeliveryHubService` как backing service. В v1 этот шаг **deferred**: admin и test-quote flows не требуют fulfillment provider registration и работают напрямую через `src/api/admin/delivery/*`.
- ApiShip fulfillment provider (`apiship`) остаётся параллельным до окончания cutover (§10). Во время миграции в `medusa-config.ts` может быть одновременно два fulfillment provider'а.
- Shopper-facing `shipping_option.provider_id` со значением `deliveryhub` станет единственным после cutover и вытеснит `apiship`.

### 16.14. Storefront / checkout migration mapping

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
- **Этап B (Admin foundation)** — частично. Реализовано: materialized `Settings -> Delivery`, `Providers` list, `Connections` CRUD, `Yandex connection` form, minimal local `Warehouses` CRUD, `Test connection`, `Connection diagnostics`. Не реализовано: `/connections/:id/disable` как отдельный роут, отдельный `Delivery Modes` surface, provider-driven warehouse sync/import, полноценный logs console beyond текущего read-only блока.
- **Этап C (Yandex quote engine)** — частично. Реализовано: `warehouse_to_pickup_point`, `dropoff_point_to_pickup_point`, listPickupPoints, listPickupWindows, admin `Test Quote` route/form, resolve локального `default warehouse` в `provider_warehouse_id` для Yandex quote path. Не реализовано: debug summary-экран, integration tests на Yandex test mode.
- **Этап D (Storefront cut-in)** — не начат. Store routes и storefront migration — см. §16.14.
- **Этап E (Shipment operations)** — не начат. Включает `createShipment` / `getShipment` / `cancelShipment` и admin order widget.
- **Этап F (ApiShip removal)** — не начат. Стартует только после прохождения §16.15.

Текущий tests pass для tranche-1 остаётся deliberately narrow: есть базовые unit tests на encryption / registry / admin contract, но это ещё не эквивалент full v1 integration coverage.

### 16.18. Scope-lock для admin UI

Чтобы admin UI не расползался в 40-полевую форму, v1 фиксирует следующий scope:

- Текущий tranche-1 admin UI = `Providers` (read-only), `Connections` (list + create/edit + test), `Yandex connection`, `Warehouses` (list + create/edit), `Connection diagnostics`, `Test Quote` (ad-hoc форма), встроенный read-only `Logs` block. Всё.
- `Delivery Modes`, provider-driven warehouse sync/import, richer logs console и shipment-oriented admin surfaces — этапы C/E.
- Карточка подключения Yandex в текущем v1 содержит: `Connection name`, `Mode` (test/live), `OAuth/API token`, `Country`, `Enabled`, `Auto confirm`, `Label generation type`, `Default warehouse id`.
- `Auto confirm` и `Label generation type` в tranche-1 работают как config passthrough fields и не должны читаться как доказательство materialized shipment maturity.
- `Default warehouse id` в tranche-1 уже привязан к materialized local warehouse entity, но это не означает provider sync/import или broad warehouse orchestration.

`default_warehouse_id` в `DeliveryHubConnectionConfigSchema` в v1 означает **локальный** `delivery_warehouse.id`, который backend service затем резолвит в `provider_warehouse_id` для Yandex test quote path. Поле остаётся опциональным и не подменяет собой shipment/domain maturity.

### 16.19. Изменения после этой редакции

Любое изменение §§1–15 требует синхронного обновления §16. При расхождении §§1–15 vs §16 tooling/реализация должны следовать §16. §§1–15 служат долгосрочным roadmap-нарративом; §16 — truthful текущий контракт, синхронизированный с кодом на дату `2026-04-21 (v1.1)`.

