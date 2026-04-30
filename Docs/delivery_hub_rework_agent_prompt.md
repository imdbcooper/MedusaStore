# Delivery Hub rework agent prompt

> Status: copy-paste prompt for the next developer/agent.
>
> Date: 2026-04-30.
>
> Primary plan: [`delivery_hub_rework_plan.md`](./delivery_hub_rework_plan.md).

Use this prompt when assigning the accepted Delivery Hub rework to a developer or coding agent.

```text
Ты работаешь в репозитории:
/home/somdev/Projects/medusa-agency-boilerplate

Используй skill `medusa-master-repo`. Перед кодингом прочитай:
1. Docs/current_work.md
2. Docs/master_repo_plan_v2.md
3. Docs/plan_analysis.md
4. Docs/delivery_hub_rework_plan.md
5. Docs/yandex_delivery_test_api_summary.md
6. Docs/delivery_hub_spec.md
7. Docs/delivery_hub_checkout_cutover_plan.md

Главный источник задачи: Docs/delivery_hub_rework_plan.md.
Статус плана: accepted execution plan от 2026-04-30.

Цель:
Перестроить Delivery Hub так, чтобы checkout, настройки доставки, заказ и оформление отправления были разделены правильно:
- покупатель видит только понятный способ доставки, ПВЗ, итоговую цену и ETA;
- админ в Settings -> Delivery настраивает интеграцию, склад, режимы, pricing policy, синхронизацию и диагностику;
- админ в заказе оформляет отправление, видит готовность, выбранный ПВЗ, посылки, статус, трекинг и действия;
- backend отделяет provider operational quote от customer-facing shipping price.

Стартуй не со shipment execution. Первый implementation tranche:
1. Phase 0 из Docs/delivery_hub_rework_plan.md: source-of-truth reconciliation.
2. Phase 1: pricing policy layer.
3. Только затем подготовь минимальный Phase 2 backend quote orchestration план/скелет, если Phase 1 закрыта чисто.

Обязательные архитектурные правила:
- Default shopper flow: `warehouse_to_pickup_point`.
- `dropoff_point_to_pickup_point` остается admin/diagnostic, пока live-путь не подтвержден отдельно.
- Yandex `check-price` = provider operational quote, а не автоматическая цена для покупателя.
- Customer-facing price должен приходить из pricing policy поверх provider quote.
- Checkout не должен зависеть от `NEXT_PUBLIC_DELIVERY_HUB_PREVIEW_DEFAULT_WAREHOUSE_ID` как от реального источника склада.
- Warehouse/default origin должен резолвиться на backend из Delivery Hub/admin settings.
- Store API не должен отдавать секреты, raw provider DTO, raw quote keys, execution references, internal warehouse/provider ids.
- `Settings -> Delivery` не должен быть основным экраном оформления отправления по заказу.
- Реальный shipment workflow должен жить на order admin surface и оставаться gated до явного readiness/approval.
- Не удаляй legacy/history docs, если они нужны как audit trail; помечай устаревшее как historical/diagnostic.

Файлы, которые нужно изучить перед изменениями:
- medusa-agency-boilerplate/src/api/store/delivery/quotes/route.ts
- medusa-agency-boilerplate/src/api/store/delivery/pickup-points/route.ts
- medusa-agency-boilerplate/src/api/store/delivery/selection/route.ts
- medusa-agency-boilerplate/src/modules/delivery-hub/domain/quote.ts
- medusa-agency-boilerplate/src/modules/delivery-hub/provider-surface.ts
- medusa-agency-boilerplate/src/modules/delivery-hub/service.ts
- medusa-agency-boilerplate/src/modules/delivery-hub/adapters/yandex/price-preview.ts
- medusa-agency-boilerplate/src/modules/deliveryhub.ts
- medusa-agency-boilerplate/src/admin/routes/settings/delivery/page.tsx
- medusa-agency-boilerplate-storefront/src/lib/data/delivery-hub.ts
- medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub.ts
- medusa-agency-boilerplate-storefront/src/modules/checkout/components/shipping/index.tsx

Phase 0 deliverables:
- Reconcile current docs/code against Docs/delivery_hub_rework_plan.md.
- Identify obsolete preview/cutover assumptions that must become historical/diagnostic.
- Produce a concise implementation note in Docs/current_work.md if active workstream status changes.
- Do not claim production/staging GO.

Phase 1 deliverables:
- Add a Delivery Hub pricing policy abstraction/model that computes `customer_price` separately from provider quote.
- Preserve provider quote internally as operational evidence/cost, not as direct checkout amount.
- Add tests for fixed price, provider pass-through, margin/markup if implemented, unavailable/error state, and no raw provider leakage.
- Keep baseline startup safe without mandatory delivery secrets.
- Update docs when the contract changes.

Validation before reporting done:
- git diff --check
- Run focused backend tests for changed Delivery Hub modules/routes.
- Run focused storefront util/component tests if checkout/util files changed.
- Run typecheck/build only when the touched scope justifies it or when tests reveal type drift.
- Do not print `.env`, Yandex token, publishable key value, auth headers, ciphertext, raw provider bodies, raw quote keys, raw offer ids, raw quote-reference ids, or admin credentials.

Report format:
1. Changed files.
2. What phase/tranche was completed.
3. What behavior changed for buyer/admin/backend.
4. Tests/checks run with exact result.
5. Remaining blockers and explicit NO-GO items.
```

