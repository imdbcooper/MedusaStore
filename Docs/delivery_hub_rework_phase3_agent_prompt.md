# Delivery Hub rework Phase 3 agent prompt

> Status: copy-paste prompt for the next developer/agent.
>
> Date: 2026-04-30.
>
> Scope: Phase 3 only from [`delivery_hub_rework_plan.md`](./delivery_hub_rework_plan.md).

Use this prompt after Phase 2 is complete or explicitly accepted by the operator.

```text
Ты работаешь в репозитории:
/home/somdev/Projects/medusa-agency-boilerplate

Используй skill `medusa-master-repo`.

Перед кодингом прочитай:
1. Docs/current_work.md
2. Docs/delivery_hub_rework_plan.md
3. Docs/delivery_hub_rework_phase2_agent_prompt.md
4. Docs/yandex_delivery_test_api_summary.md
5. Docs/delivery_hub_spec.md
6. Docs/delivery_hub_checkout_cutover_plan.md

Контекст:
Phase 0/1 уже отделили provider operational quote от customer-facing `customer_price`.
Phase 2 должна была перенести checkout quote orchestration на backend: storefront отправляет cart/address/selected PVZ context, backend сам резолвит connection/warehouse/origin/cart package, вызывает Yandex `check-price`, применяет pricing policy и возвращает shopper-safe offer.

Перед изменениями проверь кодом, что Phase 2 contract действительно не требует от buyer flow публичный warehouse id. Если Phase 2 не закрыта фактически, сначала зафиксируй blocker в отчете и не делай косметический UX поверх неправильного контракта.

Твоя задача: реализовать Phase 3 из Docs/delivery_hub_rework_plan.md.

Цель Phase 3:
Сделать выбор ПВЗ настоящим покупательским flow, а не диагностическим селектором. Покупатель должен искать и выбирать пункт выдачи, видеть понятные категории/адрес/режим работы, после выбора получать итоговую цену магазина и ETA, а при смене адреса не оставаться со stale selection.

Жесткие границы:
- Не начинать Phase 4 cart shipping-method commit.
- Не начинать order admin shipment widget.
- Не расширять live shipment execution.
- Не включать `dropoff_point_to_pickup_point` в buyer checkout.
- Не показывать покупателю слова/поля `dropoff`, `check-price`, `quote`, `cutover`, `guard`, `execution`, `connection_id`, `warehouse_id`, `provider_warehouse_id`, raw provider id/key/body.
- Не печатать `.env`, токены, publishable key value, auth headers, ciphertext, raw provider payloads.
- Не откатывать чужие изменения в рабочем дереве.
- Map optional: список-first считается достаточным для v1, карту не добавлять, если это расширяет scope или ломает сроки.

Файлы для обязательного изучения перед правками:
- medusa-agency-boilerplate/src/api/store/delivery/pickup-points/route.ts
- medusa-agency-boilerplate/src/api/store/delivery/quotes/route.ts
- medusa-agency-boilerplate/src/api/store/delivery/shared.ts
- medusa-agency-boilerplate/src/modules/delivery-hub/service.ts
- medusa-agency-boilerplate/src/modules/delivery-hub/domain/pickup-point.ts
- medusa-agency-boilerplate/src/modules/delivery-hub/adapters/yandex/mapper.ts
- medusa-agency-boilerplate/src/modules/delivery-hub/provider-surface.ts
- medusa-agency-boilerplate-storefront/src/lib/data/delivery-hub.ts
- medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub.ts
- medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub.spec.ts
- medusa-agency-boilerplate-storefront/src/modules/checkout/components/shipping/index.tsx
- medusa-agency-boilerplate-storefront/src/modules/checkout/components/shipping-summary/index.tsx

Implementation checklist:
1. Verify current pickup-point Store response shape and make it shopper-safe/normalized:
   - public pickup point reference/id safe for selection;
   - name;
   - address line;
   - city/region/postal code if available;
   - safe network label, for example `Яндекс Маркет`, `5 Post`, partner label;
   - coordinates if available;
   - schedule/opening hours if available;
   - destination pickup allowed flag;
   - no raw provider DTO/body or backend-only dispatch fields.
2. Keep `available_for_dropoff` internal/advanced unless a future buyer mode explicitly needs it.
3. Add or tighten buyer category model:
   - `Яндекс Маркет`;
   - `Партнерские пункты`;
   - optional `5 Post` only if it improves filtering and comes from safe network labels;
   - do not show provider/operator ids as category names.
4. Add or tighten search/list model:
   - search by pickup point name;
   - search by address;
   - search by safe network label/category;
   - stable empty state per category;
   - stable loading/unavailable state.
5. Add optional local sorting:
   - if buyer coordinates are available, sort by distance;
   - otherwise keep provider/default order or safe deterministic order;
   - do not block Phase 3 on map/geocoding.
6. Ensure selecting a PVZ triggers backend quote refresh through the Phase 2 quote contract:
   - no public warehouse id;
   - selected PVZ context only;
   - response displays `customer_price` and ETA.
7. Ensure changing checkout address invalidates stale PVZ selection and stale quote:
   - address fingerprint changes should clear or mark old selection stale;
   - buyer sees clear copy asking to select a new pickup point;
   - do not silently keep price from another address.
8. Replace diagnostic/dev wording in buyer-visible surface:
   - use Russian buyer copy;
   - no internal readiness/cutover/preflight labels in normal UI;
   - dev diagnostics remain collapsed and feature-flagged only.
9. Keep the existing safe save-selection path ready for Phase 4, but do not implement Phase 4 commit.
10. Update docs if Store pickup-point contract or active workstream status changes.

Expected buyer behavior after Phase 3:
- Buyer enters/has delivery address.
- Checkout loads shopper-safe PVZ list.
- Buyer can filter/search and select a PVZ.
- Buyer sees address/network/schedule where available.
- Buyer sees final store delivery price and ETA after selecting the PVZ.
- Buyer can change PVZ and price/ETA refreshes.
- Buyer changes address and old PVZ/price no longer stays silently selected.
- Buyer never sees provider internals or diagnostic language.

Tests/checks to add or update:
- frontend model/unit tests for pickup-point selector states;
- frontend tests for categories, search and empty states;
- frontend test that address change invalidates stale PVZ/quote;
- frontend test that selected PVZ quote refresh displays `customer_price`;
- backend/store boundary test for normalized pickup-point response and no raw provider leakage;
- no-network test for pickup points without coordinates/schedule;
- browser smoke for address -> PVZ list -> select PVZ -> quote/ETA -> safe save-selection button state.

Validation before final report:
- git diff --check
- focused storefront Delivery Hub tests touched by Phase 3
- focused backend Delivery Hub tests if Store pickup-point response or mapper changed
- browser smoke on local checkout if app can run cleanly; if not, report exact blocker and keep unit/no-network evidence explicit

Final report format:
1. Changed files.
2. Phase 3 behavior implemented.
3. Buyer-visible behavior.
4. Backend Store contract changes, if any.
5. Tests/checks run with exact results.
6. Remaining blockers / explicit NO-GO items.
```
