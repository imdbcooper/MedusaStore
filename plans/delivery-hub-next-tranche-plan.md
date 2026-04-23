# Delivery Hub next accelerated planning tranche

## Planning tranche

### Precise goal

Собрать один reviewable ускоренный пакет, который подготавливает нейтральный backend/storefront contract contour для `delivery-hub`, вводит явную boundary-обвязку вокруг legacy helper path и делает review в dirty tree предсказуемым, **не** снимая hard block в [`createFulfillment()`](../src/modules/deliveryhub.ts:119), **не** меняя contour [`DeliveryHubExecutionLedgerRepositoryAssemblyPersistenceReadinessContour`](../src/modules/delivery-hub/storage/execution-ledger-repository-assembly-scaffold.ts:161) и **не** удаляя the removed legacy fulfillment provider.

### Один следующий batched tranche

1. Выделить и зафиксировать storefront-facing neutral contract helper layer для `delivery-hub`, чтобы новый path читался как sanctioned shadow boundary, а не как ad-hoc preview helpers.
2. Ввести legacy-helper boundary seam вокруг the removed storefront legacy provider helper без удаления legacy flow: только isolation, explicit ownership и neutral handoff notes.
3. Добавить review-friendly contract fixtures and focused seam coverage для backend/storefront neutral payload shapes, чтобы diff можно было проверять отдельно от грязного дерева.
4. Sync-нуть docs/status surfaces, чтобы следующий review видел честный scope: shadow/storefront prep done, checkout cutover still deferred, `createFulfillment` block preserved.

## Подшаги

### 1. Materialize shared neutral storefront contract boundary

Сделать storefront-only sanctioned contract module для чтения и нормализации `delivery-hub` store responses, который опирается на уже существующие backend public routes и не делает checkout cutover claims.

- Вынести canonical neutral types, guards и normalizers в storefront `delivery-hub` data/util surface.
- Явно отделить `catalog`, `quotes`, `pickup-points`, `pickup-windows`, `selection`, `readiness` как neutral-only contracts.
- Запретить provider/internal fragments на boundary уровне так же явно, как это уже декларировано в [`Docs/delivery_hub_spec.md`](../Docs/delivery_hub_spec.md).

### 2. Keep storefront delivery boundary neutral and Delivery Hub first

Поддержать current storefront boundary без восстановления удалённых provider-specific helpers/routes: Delivery Hub/direct Yandex остаётся selected/default delivery contour, а standard shipping method commit остаётся generic/provider-neutral.

- Убедиться, что storefront call-sites используют neutral Delivery Hub save/clear/summary helpers и не зависят от удалённых provider-specific routes/helpers.
- Держать neutral handoff mapping рядом с `delivery-hub` helper path; commit должен принимать только existing Medusa shipping option ids без provider-specific payloads.
- Добавить explicit comments or contract docs у storefront call-sites: Delivery Hub/direct Yandex = selected/default contour, neutral save/clear/summary present, live shipment dispatch gated/not enabled.

### 3. Add reviewable contract fixtures and focused tests

Сделать минимальный набор isolated fixtures/tests, который доказывает neutral contract path и boundary behavior без запуска live cutover.

- Добавить fixture-level examples для safe `catalog`, `quotes`, `selection`, `readiness` payloads.
- Добавить focused tests на leaked provider/internal fragment rejection в storefront helper layer.
- Добавить parity-style tests, что generic shipping method commit semantics остаются provider-neutral и не overclaim'ят live Delivery Hub shipment dispatch.

### 4. Sync review surfaces for dirty tree

Сделать пакет reviewable даже при грязном дереве через явное разделение diff surface.

- Обновить status/docs так, чтобы в review было понятно: это boundary tranche, не code cutover.
- Зафиксировать exact include/exclude scope для reviewer.
- Подготовить one-pass review checklist around neutral contracts, legacy boundary and preserved non-goals.

## Exact in-scope files

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

## Exact out-of-scope files

### Backend execution and fulfillment block surfaces

- [`src/modules/deliveryhub.ts`](../src/modules/deliveryhub.ts)
- [`src/modules/delivery-hub/fulfillment-provider-bridge.ts`](../src/modules/delivery-hub/fulfillment-provider-bridge.ts)
- [`src/modules/delivery-hub/shipment-execution-contract.ts`](../src/modules/delivery-hub/shipment-execution-contract.ts)
- [`src/modules/delivery-hub/storage/execution-ledger-repository-assembly-scaffold.ts`](../src/modules/delivery-hub/storage/execution-ledger-repository-assembly-scaffold.ts)
- [`src/modules/delivery-hub/storage/execution-ledger-repository.ts`](../src/modules/delivery-hub/storage/execution-ledger-repository.ts)
- [`src/modules/delivery-hub/storage/execution-ledger-pg-repository.ts`](../src/modules/delivery-hub/storage/execution-ledger-pg-repository.ts)

### Legacy backend legacy provider removal surfaces

- removed backend legacy fulfillment-provider module
- [`src/api/store/delivery/rates/route.ts`](../src/api/store/delivery/rates/route.ts)
- [`src/api/store/delivery/points/route.ts`](../src/api/store/delivery/points/route.ts)

### Cutover-sensitive shopper behavior

- guardrail forbids restoring removed provider-specific helpers/routes and preserves provider-neutral standard shipping method commit semantics; Delivery Hub neutral save/clear/summary remains metadata-only; live dispatch gated/not enabled
- любые admin/store routes, которые расширяют public contract за пределы already materialized neutral response surface
- любые runtime paths, снимающие current shipment execution block или меняющие execution-ledger readiness contour

## Review strategy for dirty tree

1. Review пакет только как boundary tranche: neutral helper path, legacy seam, tests, docs.
2. Проверять diff по четырём logical buckets:
   - storefront neutral contract files
   - legacy provider boundary files
   - focused tests
   - docs/status sync
3. Явно исключать из review любые изменения в [`createFulfillment()`](../src/modules/deliveryhub.ts:119), [`DeliveryHubExecutionLedgerRepositoryAssemblyPersistenceReadinessContour`](../src/modules/delivery-hub/storage/execution-ledger-repository-assembly-scaffold.ts:161) и backend legacy removal surfaces.
4. Если дерево остаётся dirty, reviewer должен сравнивать tranche against scoped file list above, а unrelated diffs around the removed legacy fulfillment provider считать external noise, не частью этого пакета.
5. В PR or handoff summary зафиксировать three preserved guardrails:
   - removed provider-specific helpers/routes must not be restored; standard shipping method commit remains generic/provider-neutral
   - `delivery-hub` storefront path is limited to neutral selection metadata save/clear/summary; no live dispatch or provider-specific commit payloads
   - shipment execution and persistence activation remain blocked

## Expected proof of completion

Пакет считается завершённым, когда одновременно выполнены следующие признаки:

- storefront имеет явный neutral `delivery-hub` helper boundary в sanctioned files [`delivery-hub.ts`](../medusa-agency-boilerplate-storefront/src/lib/data/delivery-hub.ts) и [`delivery-hub.ts`](../medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub.ts)
- вокруг removed storefront legacy delivery helper есть explicit legacy-only boundary, но active flow продолжает работать как раньше
- focused tests доказывают rejection leaked internal/provider fragments и не заявляют storefront cutover
- docs truthfully фиксируют, что tranche продвигает neutral contract path и reviewability, но не снимает hard block в [`createFulfillment()`](../src/modules/deliveryhub.ts:119), не меняет contour [`DeliveryHubExecutionLedgerRepositoryAssemblyPersistenceReadinessContour`](../src/modules/delivery-hub/storage/execution-ledger-repository-assembly-scaffold.ts:161) и не удаляет the removed legacy fulfillment provider
- reviewer может проверить пакет по isolated in-scope file list без необходимости одобрять unrelated dirty-tree diffs

## Что нужно от пользователя

Ничего дополнительно не нужно: уже данного разрешения на accelerated planning tranche и допуск к sibling storefront repo достаточно.

## Простыми словами

- Сначала оформляем `delivery-hub` как отдельный нейтральный helper path в storefront.
- Потом обводим legacy removed storefront legacy delivery helper явной границей, но не вырезаем его.
- Дальше добавляем точечные тесты на нейтральные контракты и запрет утечек internal полей.
- После этого синхронизируем docs, чтобы review не ожидал cutover раньше времени.
- В этом пакете не трогаем shipment execution block.
- В этом пакете не трогаем execution-ledger readiness contour.
- В этом пакете не объявляем, что storefront уже перешёл на `delivery-hub`.
