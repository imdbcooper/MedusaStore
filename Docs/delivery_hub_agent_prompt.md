# Delivery Hub Agent Prompt

Используй этот prompt как стартовый контекст для ИИ-агента, который начинает реализацию нового слоя доставки.

```text
Ты работаешь в репозитории `/home/somdev/Projects/medusa-agency-boilerplate`.

Твоя задача: начать реализацию собственного слоя доставки `delivery-hub` с первым адаптером `Yandex Delivery`, не ломая обновляемость Medusa backend и не форкая official admin.

Контекст проекта:
- это master repo для РФ-магазинов;
- текущий исторический shipping slice на legacy provider уже реализован, но долгосрочная архитектура меняется;
- новый source-of-truth документ: `Docs/delivery_hub_spec.md`;
- текущий operational status: `Docs/current_work.md`;
- roadmap: `Docs/master_repo_plan_v2.md`.

Главные ограничения:
- не патчить исходники official Medusa Admin;
- использовать только `src/admin/routes/*`, `src/admin/widgets/*`, `src/api/admin/*`, `src/api/store/*`, `src/modules/*`;
- не хранить merchant credentials в storefront;
- не выводить реальные секреты в docs и логи;
- не удалять legacy provider на первом шаге;
- не переписывать checkout целиком до готовности backend delivery contract.

Что нужно сделать в первую очередь:
1. Создать каркас `delivery-hub` модуля в `medusa-agency-boilerplate/src/modules/delivery-hub/`.
2. Описать adapter interface для провайдеров доставки.
3. Создать storage для `delivery_connection` и зашифрованного хранения credentials.
4. Реализовать первый provider adapter `yandex`.
5. Добавить admin page `Settings -> Delivery`.
6. Добавить admin API для:
   - списка подключений,
   - создания подключения,
   - `test connection`,
   - `test quote`.
7. Реализовать в Yandex adapter минимум:
   - `testConnection`
   - `listPickupPoints`
   - `listPickupWindows`
   - `quoteWarehouseToPickupPoint`
   - `quoteDropoffPointToPickupPoint`
8. Использовать прямую интеграцию с Yandex Delivery, а не legacy provider.

Что уже подтверждено по Yandex и должно быть учтено:
- `pickup-points/list` возвращает точки и флаг `available_for_dropoff`;
- `pickups/pickup-options` работают для warehouse, а не для обычного pickup point;
- `offers/create` работает для `dropoff point -> PVZ`;
- `warehouse -> PVZ` требует корректный `interval_utc`, совпадающий с pickup windows;
- `last_mile_policy=self_pickup` уже проверен прямыми тестами.

Архитектурные требования:
- storefront должен говорить с нейтральным delivery contract, а не с Yandex-спецификой;
- Medusa fulfillment provider в итоге должен быть один: `deliveryhub`;
- merchant должен настраивать подключение из админки магазина, без обязательной правки `.env`;
- код должен быть пригоден для добавления `cdek`, `boxberry` и других адаптеров позже.

Definition of Done для первого tranche:
- backend стартует без обязательных новых env;
- в админке есть раздел Delivery;
- merchant может сохранить Yandex connection;
- merchant может нажать `Test connection`;
- merchant может нажать `Test quote`;
- `warehouse -> PVZ` и `dropoff point -> PVZ` проходят через прямой Yandex adapter;
- код покрыт базовыми unit/integration tests;
- docs обновлены truthfully.

Перед началом реализации прочитай:
- `Docs/delivery_hub_spec.md`
- `Docs/current_work.md`
- `medusa-agency-boilerplate/medusa-config.ts`
- существующие `src/admin/routes/settings/legacy provider/page.tsx`
- существующие shipping-related модули, но не копируй legacy provider-архитектуру как source of truth.

После каждого meaningful change обновляй docs truthfully.
```
