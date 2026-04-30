# Delivery Hub rework Phase 4 agent prompt

> Status: copy-paste prompt for the next developer/agent.
>
> Date: 2026-04-30.
>
> Scope: Phase 4 only from [`delivery_hub_rework_plan.md`](./delivery_hub_rework_plan.md).

Use this prompt after Phase 3 is complete or explicitly accepted by the operator.

```text
Ты работаешь в репозитории:
/home/somdev/Projects/medusa-agency-boilerplate

Используй skill `medusa-master-repo`.

Перед кодингом прочитай:
1. Docs/current_work.md
2. Docs/delivery_hub_rework_plan.md
3. Docs/delivery_hub_rework_phase3_agent_prompt.md
4. Docs/delivery_hub_checkout_cutover_plan.md
5. Docs/delivery_hub_spec.md
6. Docs/yandex_delivery_test_api_summary.md

Контекст:
Phase 0/1 отделили provider operational quote от customer-facing `customer_price`.
Phase 2 перенесла checkout quote orchestration в backend: buyer flow не должен зависеть от public warehouse id.
Phase 3 должна была сделать shopper-safe PVZ UX: нормализованный список/поиск/категории, выбор PVZ, refresh price/ETA по selected PVZ, invalidation stale selection при смене address, без provider/internal/dropoff wording в buyer UI.

Перед изменениями проверь кодом, что Phase 3 действительно закрыта:
- pickup-point Store response shopper-safe и не отдаёт raw provider/Yandex/internal fields;
- `/store/delivery/pickup-points`, `/store/delivery/selection` и `/store/delivery/readiness` не отдают buyer payload с `provider_operator_id`, `station_type`, `is_origin_dropoff_allowed`, `payment_methods`, `metadata`, raw provider fragments или secret-like fields;
- storefront buyer UI позволяет выбрать PVZ без diagnostic/cutover wording;
- selected PVZ вызывает backend quote refresh и показывает `customer_price`/ETA;
- смена address не оставляет stale PVZ/quote silently selected.

Если Phase 3 не закрыта фактически, сначала зафиксируй blocker в отчете и не начинай Phase 4 поверх сломанного buyer flow.

Твоя задача: реализовать Phase 4 из Docs/delivery_hub_rework_plan.md.

Цель Phase 4:
Сделать Delivery Hub реальным checkout source of truth для способа доставки под явными readiness rules: после выбора PVZ и сохранения доставки Medusa cart должен получить Delivery Hub shipping method, а payment/review path должен быть заблокирован, если Delivery Hub selection/commit не готов или устарел.

Жесткие границы:
- Не начинать Phase 5 admin settings cleanup.
- Не начинать Phase 6 order admin shipment widget.
- Не расширять live shipment execution и не включать `DELIVERY_HUB_SHIPMENT_EXECUTION_ENABLED`.
- Не вызывать Yandex `create_shipment`, cancel/status/retry или любые shipment lifecycle calls.
- Не включать `dropoff_point_to_pickup_point` в buyer checkout.
- Не добавлять automatic legacy delivery fallback и не выбирать другой shipping method при blocked Delivery Hub readiness.
- Не показывать покупателю слова/поля `preview`, `cutover`, `guard`, `commit`, `precondition`, `candidate`, `execution`, `dropoff`, `check-price`, `quote`, `connection_id`, `warehouse_id`, `provider_warehouse_id`, raw provider id/key/body.
- Не возвращать в Store response и persisted selection response shopper-visible поля `provider_operator_id`, `station_type`, `is_origin_dropoff_allowed`, `payment_methods`, `metadata`, `raw_reference`, `quote_key`, backend execution reference или provider offer ids.
- Не печатать `.env`, токены, publishable key value, auth headers, ciphertext, raw provider payloads.
- Не откатывать чужие изменения в рабочем дереве.

Файлы для обязательного изучения перед правками:
- medusa-agency-boilerplate/src/api/store/delivery/selection/route.ts
- medusa-agency-boilerplate/src/api/store/delivery/readiness/route.ts
- medusa-agency-boilerplate/src/api/store/delivery/cutover-candidate/route.ts
- medusa-agency-boilerplate/src/api/store/delivery/cutover-preconditions/route.ts
- medusa-agency-boilerplate/src/api/store/delivery/shared.ts
- medusa-agency-boilerplate/src/modules/delivery-hub/cart-selection.ts
- medusa-agency-boilerplate/src/modules/delivery-hub/cutover-candidate.ts
- medusa-agency-boilerplate/src/modules/delivery-hub/cutover-preconditions.ts
- medusa-agency-boilerplate/src/modules/delivery-hub/domain/quote.ts
- medusa-agency-boilerplate/src/modules/delivery-hub/provider-surface.ts
- medusa-agency-boilerplate/src/modules/delivery-hub/service.ts
- medusa-agency-boilerplate/src/modules/delivery-hub/shipping-option-contract.ts
- medusa-agency-boilerplate/src/modules/deliveryhub.ts
- medusa-agency-boilerplate-storefront/src/lib/data/cart.ts
- medusa-agency-boilerplate-storefront/src/lib/data/delivery-hub.ts
- medusa-agency-boilerplate-storefront/src/lib/env.ts
- medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub.ts
- medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub.spec.ts
- medusa-agency-boilerplate-storefront/src/modules/checkout/components/shipping/index.tsx
- medusa-agency-boilerplate-storefront/src/modules/checkout/components/shipping-summary/index.tsx
- medusa-agency-boilerplate-storefront/src/modules/checkout/components/payment-button/index.tsx

Implementation checklist:
1. Verify the existing selection/readiness/cutover-candidate surfaces and decide what remains internal evidence versus product checkout behavior.
2. Tighten persisted selection validation against:
   - active/default Delivery Hub connection;
   - supported mode `warehouse_to_pickup_point`;
   - selected pickup point summary;
   - opaque offer/quote reference;
   - `customer_price`;
   - current cart id/state/address fingerprint where available;
   - available Delivery Hub Medusa shipping option.
3. Add or enforce explicit quote/selection expiration and staleness rules:
   - stale quote blocks shipping-method commit;
   - address/cart/PVZ drift blocks shipping-method commit;
   - missing customer price blocks shipping-method commit;
   - blocked state returns safe shopper copy and operator-safe diagnostics only.
4. Ensure selection persists enough backend-only handoff data for later shipment creation without exposing it to Store responses or storefront state.
5. Build a single buyer-facing save/commit flow:
   - buyer selects PVZ;
   - buyer gets `customer_price` and ETA;
   - buyer clicks `Сохранить способ доставки`;
   - frontend persists/refreshes backend-validated Delivery Hub selection;
   - frontend calls existing `setShippingMethod()` only with the validated Delivery Hub shipping option id;
   - success updates cart state and checkout can proceed to payment.
6. Replace buyer-visible diagnostic wording:
   - no `preview/cutover/guard/commit/candidate` labels in normal UI;
   - use Russian buyer copy such as `Сохранить способ доставки`, `Выберите пункт выдачи`, `Способ доставки сохранён`, `Нужно обновить доставку`;
   - keep advanced diagnostics behind explicit dev/admin feature flag only.
7. Block payment/review progression when Delivery Hub is selected but not ready/committed:
   - no silent fallback to another shipping method;
   - no payment attempt before Medusa cart has the Delivery Hub shipping method;
   - clear recoverable message when buyer must reselect PVZ or save delivery again.
8. Keep rollback behavior explicit:
   - disabling any checkout cutover flag must prevent new Delivery Hub shipping-method commits;
   - already saved neutral metadata must not crash checkout;
   - do not auto-clear existing metadata unless an explicit clear action exists.
9. Update tests around selection/readiness/commit eligibility and buyer copy.
10. Update docs if Store contract, env flag semantics, or active workstream status changes.

Expected buyer behavior after Phase 4:
- Buyer enters delivery address and selects a PVZ.
- Buyer sees final store delivery price and ETA.
- Buyer clicks `Сохранить способ доставки`.
- Cart receives the Delivery Hub Medusa shipping method.
- Checkout proceeds to payment only after the Delivery Hub shipping method is committed.
- If address/cart/PVZ/quote becomes stale, checkout asks the buyer to update delivery and does not keep a stale price silently.
- Buyer never sees provider internals, diagnostic/cutover wording, raw ids, secrets, or shipment execution details.

Tests/checks to add or update:
- backend tests for persisted selection validation and response boundary no-leak behavior;
- backend tests proving pickup-point, selection, and readiness Store responses strip provider/dropoff/internal fields before reaching the shopper payload;
- backend tests for quote/selection expiration and address/cart/PVZ drift blocking commit readiness;
- backend/store tests for Delivery Hub shipping option candidate matching and missing/mismatched option failures;
- storefront util tests for commit eligibility states: missing, blocked, stale, ready, committed;
- storefront test that the CTA uses `setShippingMethod()` only with the matched Delivery Hub option id;
- storefront test that buyer-visible labels contain product copy, not diagnostic/cutover wording;
- payment/review gating test when Delivery Hub is selected but not committed;
- rollback/flag-off test proving new commits are blocked and no automatic fallback is selected.

Validation before final report:
- git diff --check
- focused backend Delivery Hub tests touched by Phase 4
- focused storefront Delivery Hub tests touched by Phase 4
- `npm run smoke:delivery-hub-cutover:browser` if the local app can run and the explicit flag/readiness setup is available
- `npm run smoke:delivery-hub-rollback:browser` if the local app can run
- product-flow browser smoke for address -> PVZ -> price/ETA -> `Сохранить способ доставки` -> Delivery Hub shipping method committed -> payment step available; if not runnable, report exact blocker and keep unit/no-network evidence explicit

Final report format:
1. Changed files.
2. Phase 4 behavior implemented.
3. Buyer-visible checkout behavior.
4. Backend Store/selection/readiness contract changes, if any.
5. Shipping-method commit and payment-gating behavior.
6. Tests/checks run with exact results.
7. Remaining blockers / explicit NO-GO items.
```
