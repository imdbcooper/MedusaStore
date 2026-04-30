# Delivery Hub rework Phase 2 agent prompt

> Status: copy-paste prompt for the next developer/agent.
>
> Date: 2026-04-30.
>
> Scope: Phase 2 only from [`delivery_hub_rework_plan.md`](./delivery_hub_rework_plan.md).

Use this prompt after Phase 0 and Phase 1 are complete.

```text
Ты работаешь в репозитории:
/home/somdev/Projects/medusa-agency-boilerplate

Используй skill `medusa-master-repo`.

Перед кодингом прочитай:
1. Docs/current_work.md
2. Docs/delivery_hub_rework_plan.md
3. Docs/delivery_hub_rework_agent_prompt.md
4. Docs/yandex_delivery_test_api_summary.md
5. Docs/delivery_hub_spec.md
6. Docs/delivery_hub_checkout_cutover_plan.md

Контекст:
Phase 0 и Phase 1 считаются выполненными. В коде уже должна существовать separation-модель:
- provider operational quote отдельно;
- customer-facing `customer_price` отдельно;
- calculated fulfillment amount должен опираться на `customer_price`;
- real checkout flow не должен зависеть от public warehouse env.

Твоя задача: реализовать Phase 2 из Docs/delivery_hub_rework_plan.md.

Цель Phase 2:
Перенести реальную сборку quote для checkout в backend service boundary, чтобы storefront отправлял только cart/address/selected pickup point context, а backend сам резолвил connection, warehouse, origin coordinates, cart items/package inputs, вызывал Yandex `check-price` для `warehouse_to_pickup_point`, применял pricing policy и возвращал shopper-safe offer с `customer_price`.

Жесткие границы:
- Не начинать Phase 3 UI rewrite, кроме минимальной адаптации под новый Phase 2 contract.
- Не начинать order admin shipment widget.
- Не расширять live shipment execution.
- Не включать `dropoff_point_to_pickup_point` в buyer checkout.
- Не возвращать на storefront `warehouse_id`, `provider_warehouse_id`, `connection_id`, raw `quote_key`, raw provider DTO/body, Yandex offer ids, auth fragments, execution references.
- Не печатать `.env`, токены, publishable key value, auth headers, ciphertext, raw provider payloads.
- Не откатывать чужие изменения в рабочем дереве.

Файлы для обязательного изучения перед правками:
- medusa-agency-boilerplate/src/api/store/delivery/quotes/route.ts
- medusa-agency-boilerplate/src/api/store/delivery/shared.ts
- medusa-agency-boilerplate/src/modules/delivery-hub/service.ts
- medusa-agency-boilerplate/src/modules/delivery-hub/domain/quote.ts
- medusa-agency-boilerplate/src/modules/delivery-hub/domain/pricing-policy.ts
- medusa-agency-boilerplate/src/modules/delivery-hub/provider-surface.ts
- medusa-agency-boilerplate/src/modules/delivery-hub/adapters/yandex/price-preview.ts
- medusa-agency-boilerplate/src/modules/delivery-hub/adapters/yandex/mapper.ts
- medusa-agency-boilerplate/src/modules/delivery-hub/cart-selection.ts
- medusa-agency-boilerplate/src/modules/deliveryhub.ts
- medusa-agency-boilerplate-storefront/src/lib/data/delivery-hub.ts
- medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub.ts
- medusa-agency-boilerplate-storefront/src/modules/checkout/components/shipping/index.tsx

Implementation checklist:
1. Verify the Phase 1 pricing policy implementation and current store quote response shape.
2. Design/adjust a checkout-oriented backend quote input contract:
   - cart id/context;
   - shipping address context;
   - selected pickup point id/reference;
   - optional selected pickup point safe coordinates if already returned by Store API;
   - no public warehouse id for real buyer flow.
3. In backend service, resolve:
   - active/default Delivery Hub connection;
   - default warehouse/source from admin settings;
   - warehouse origin address and coordinates;
   - sender/origin context needed by Yandex `check-price`.
4. Build Yandex `check-price` input for `warehouse_to_pickup_point`:
   - origin = resolved warehouse/store;
   - destination = selected customer PVZ;
   - destination coordinates must be present or fail before provider call;
   - origin coordinates must be present or fail before provider call;
   - package/items should use real cart lines where available.
5. Replace fake quote item fallback (`quantity: 1`, `weight_grams: 500`, `price: cart.subtotal`) with a documented package/input builder:
   - use real cart lines if dimensions/weight exist;
   - otherwise use explicit safe fallback with clear internal diagnostic reason;
   - do not expose fallback internals to shopper copy.
6. Apply existing pricing policy to provider quote and return `customer_price`.
7. Ensure public Store response is shopper-safe:
   - final delivery price;
   - currency;
   - ETA;
   - offer/quote reference safe for save-selection;
   - selected pickup point summary if needed;
   - no provider/warehouse internals.
8. Store/cache provider quote evidence internally for later validation/order handoff, without leaking raw provider data.
9. Adapt storefront request code so real buyer flow sends only cart/address/PVZ context.
10. Keep dev/diagnostic defaults only inside explicit diagnostics surfaces.
11. Update docs if the Store contract or active workstream status changes.

Expected behavior after Phase 2:
- Buyer quote flow works without `NEXT_PUBLIC_DELIVERY_HUB_PREVIEW_DEFAULT_WAREHOUSE_ID`.
- Missing warehouse config/coordinates is reported as safe unavailable/operator issue, not as raw internal data.
- Missing PVZ coordinates blocks before Yandex provider call.
- Store quote response uses `customer_price`, not direct provider amount.
- Existing save-selection path can persist the selected safe offer/customer price.

Tests/checks to add or update:
- backend unit tests for checkout quote input assembly;
- no-network test for missing warehouse coordinates;
- no-network test for missing selected PVZ coordinates;
- test that provider quote amount and `customer_price` stay separate;
- route/store boundary test proving no internal ids/raw provider fields leak;
- storefront util/request test proving real buyer quote does not send public warehouse id;
- cart/package builder test for real line input and fallback diagnostics.

Validation before final report:
- git diff --check
- focused backend Delivery Hub tests touched by Phase 2
- focused storefront Delivery Hub tests if storefront files changed
- typecheck only if touched types/contracts make it necessary or focused tests are insufficient

Final report format:
1. Changed files.
2. Phase 2 behavior implemented.
3. Buyer-visible behavior.
4. Admin/operator-visible behavior.
5. Tests/checks run with exact results.
6. Remaining blockers / explicit NO-GO items.
```

