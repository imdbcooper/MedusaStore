# Delivery Hub rework Phase 5 agent prompt

> Status: copy-paste prompt for the next developer/agent.
>
> Date: 2026-04-30.
>
> Scope: Phase 5 only from [`delivery_hub_rework_plan.md`](./delivery_hub_rework_plan.md).

Use this prompt after Phase 4 is complete or explicitly accepted by the operator.

```text
Ты работаешь в репозитории:
/home/somdev/Projects/medusa-agency-boilerplate

Используй skill `medusa-master-repo`.

Перед кодингом прочитай:
1. Docs/current_work.md
2. Docs/delivery_hub_rework_plan.md
3. Docs/delivery_hub_rework_phase4_agent_prompt.md
4. Docs/delivery_hub_spec.md
5. Docs/delivery_hub_checkout_cutover_plan.md
6. Docs/yandex_delivery_test_api_summary.md

Контекст:
Phase 4 закоммичена как `abad11e37c1e9e4e7646ea66906089970b60d30f` (`feat(delivery-hub): commit ready pickup selection at checkout`).
Проверки после commit:
- `npm run typecheck` PASS;
- focused backend Delivery Hub tests PASS: `delivery-hub-store.unit.spec.ts`, `delivery-hub-readiness.unit.spec.ts`, `delivery-hub-cart-selection.unit.spec.ts`, `delivery-hub-cutover-approval-artifact.unit.spec.ts`;
- storefront util test `node --test src/lib/util/delivery-hub.spec.ts` PASS;
- browser smokes `npm run smoke:delivery-hub-cutover:browser` и `npm run smoke:delivery-hub-rollback:browser` сейчас не являются зелёным доказательством: оба прогона завершились таймаутом ожидания `cutover preconditions verifier`.

Если ты видишь, что browser-smoke gap уже исправлен после этого prompt, проверь и обнови отчет. Если gap остаётся, не расширяй checkout source-of-truth в Phase 5 и явно зафиксируй этот verification gap как отдельный follow-up, не смешивая его с admin settings cleanup.

Твоя задача: реализовать Phase 5 из Docs/delivery_hub_rework_plan.md.

Цель Phase 5:
Сделать `Settings -> Delivery` понятной merchant-facing страницей настройки Яндекс Доставки: основной путь должен вести оператора через подключение, write-only token, склад/адрес отправителя, координаты, pricing policy, режимы доставки, синхронизацию shipping options и high-level status. Технические diagnostics должны остаться доступны, но уйти в advanced/details и не быть основным рабочим сценарием.

Жесткие границы:
- Не начинать Phase 6 order admin shipment widget.
- Не расширять live shipment execution и не включать `DELIVERY_HUB_SHIPMENT_EXECUTION_ENABLED`.
- Не вызывать Yandex `create_shipment`, cancel/status/retry или любые shipment lifecycle calls.
- Не менять shopper checkout flow, shipping-method commit semantics или payment gating, кроме точечных fixes, если Phase 5 UI случайно ломает existing contracts.
- Не возвращать legacy provider как supported setup path.
- Не форкать official Medusa Admin.
- Не показывать token, auth headers, ciphertext, raw provider request/response bodies, raw Yandex DTO, raw offer ids, raw quote keys, publishable key value или backend execution token.
- Не превращать `dropoff_point_to_pickup_point` в buyer default. Если он остаётся в admin, маркируй как advanced/diagnostic.
- Не откатывать чужие изменения в рабочем дереве.

Файлы для обязательного изучения перед правками:
- medusa-agency-boilerplate/src/admin/routes/settings/delivery/page.tsx
- medusa-agency-boilerplate/src/admin/routes/settings/delivery/page-state.ts
- medusa-agency-boilerplate/src/admin/routes/settings/delivery/manual-sync.ts
- medusa-agency-boilerplate/src/admin/routes/settings/delivery/__tests__/page-state.unit.spec.ts
- medusa-agency-boilerplate/src/api/admin/delivery/connections/route.ts
- medusa-agency-boilerplate/src/api/admin/delivery/connections/[id]/route.ts
- medusa-agency-boilerplate/src/api/admin/delivery/connections/[id]/test/route.ts
- medusa-agency-boilerplate/src/api/admin/delivery/warehouses/route.ts
- medusa-agency-boilerplate/src/api/admin/delivery/warehouses/[id]/route.ts
- medusa-agency-boilerplate/src/api/admin/delivery/test-quote/route.ts
- medusa-agency-boilerplate/src/api/admin/delivery/pickup-points/route.ts
- medusa-agency-boilerplate/src/api/admin/delivery/shipping-options/preview/route.ts
- medusa-agency-boilerplate/src/api/admin/delivery/shipping-options/sync/route.ts
- medusa-agency-boilerplate/src/api/admin/delivery/shared.ts
- medusa-agency-boilerplate/src/modules/delivery-hub/domain/pricing-policy.ts
- medusa-agency-boilerplate/src/modules/delivery-hub/storage/schemas.ts
- medusa-agency-boilerplate/src/modules/delivery-hub/service.ts
- medusa-agency-boilerplate/src/modules/delivery-hub/shipping-option-manual-sync.ts
- medusa-agency-boilerplate/src/modules/delivery-hub/shipping-option-manual-sync-audit.ts

Implementation checklist:
1. Audit the current `Settings -> Delivery` page and classify every block as:
   - primary merchant setup;
   - secondary merchant status/action;
   - advanced/developer diagnostic;
   - out-of-scope order/shipment operation for Phase 6.
2. Restructure the primary merchant path into a concise flow:
   - connection create/edit;
   - write-only token state and test/live mode;
   - default warehouse/source address;
   - warehouse coordinates;
   - enabled checkout mode, with `warehouse_to_pickup_point` as default;
   - customer pricing policy;
   - shipping option preview/sync;
   - high-level readiness/status.
3. Add or tighten missing merchant settings if not already present:
   - pricing policy editor;
   - free shipping threshold / fixed price / pass-through plus markup where supported by existing domain code;
   - min/max customer price guardrails if supported safely;
   - quote TTL/staleness setting if a backend contract exists or can be added without checkout churn;
   - PVZ filter settings if they can be represented safely without raw provider ids;
   - supported package constraints as merchant-facing guidance.
4. Keep token and credential handling write-only:
   - blank token input on edit;
   - show only credentials state/fingerprint/last validation status;
   - never render token/ciphertext/auth header.
5. Move technical surfaces into advanced/details:
   - raw JSON diagnostics;
   - provider capabilities;
   - pickup windows lookup;
   - dropoff diagnostic controls;
   - fulfillment bridge preview;
   - execution-plan preview;
   - shipment operations by execution reference;
   - manual evidence/cutover artifacts;
   - provider request summaries and event logs.
6. Keep advanced diagnostics available but clearly separated:
   - collapsed by default where possible;
   - labelled as diagnostics/developer/operator details;
   - no implication that Settings is the normal order shipment console.
7. Improve copy and field guidance:
   - Russian merchant copy for primary path;
   - explain required vs optional fields;
   - explain coordinates and warehouse/source meaning;
   - explain customer price policy separately from provider operational quote;
   - avoid making merchants understand `check-price`, `offers/create`, `platform_station_id`, execution ledger, or provider DTOs in the primary flow.
8. Preserve admin API boundaries:
   - no raw provider payloads or secrets in admin JSON responses;
   - structured safe errors with operator hints;
   - response boundaries still reject or redact unsafe fragments.
9. Update page-state unit coverage for primary/advanced classification, pricing policy display/editor state, credential write-only state, manual sync status, and no-secret/no-raw leakage.
10. Update docs/current status if the admin setup contract or active workstream changes.

Expected merchant behavior after Phase 5:
- Merchant opens `Settings -> Delivery`.
- Merchant can understand the primary path without reading diagnostic JSON.
- Merchant can configure Yandex connection and write-only token.
- Merchant can configure default warehouse/source address and coordinates.
- Merchant can set customer-facing delivery price policy.
- Merchant can preview/sync Delivery Hub shipping options with safe dry-run/guarded execution semantics.
- Merchant can see whether checkout delivery is ready at a high level.
- Developer/operator diagnostics remain available but are not the main page flow.

Tests/checks to add or update:
- `page-state.unit.spec.ts` for primary merchant setup state and advanced diagnostics grouping;
- page-state tests for pricing policy editor/display and field requirement copy;
- page-state tests for write-only token and no-secret rendering;
- admin route tests if connection/warehouse/pricing policy schemas change;
- manual sync tests if sync UI/request shape changes;
- no-leak tests for admin render state and admin API response boundaries;
- optional browser/admin smoke only if local Admin can run cleanly.

Validation before final report:
- git diff --check
- `npm run typecheck`
- focused backend admin/Delivery Hub tests touched by Phase 5
- focused page-state tests
- if you touch checkout-adjacent code, rerun the relevant Phase 4 tests and explicitly report whether `npm run smoke:delivery-hub-cutover:browser` / `npm run smoke:delivery-hub-rollback:browser` pass or still timeout on the verifier
- manual smoke through `Settings -> Delivery` if local runtime is available; if not, report exact blocker and keep no-network evidence explicit

Final report format:
1. Changed files.
2. Phase 5 merchant-facing admin behavior implemented.
3. Advanced diagnostics moved/preserved.
4. Admin API/schema changes, if any.
5. Tests/checks run with exact results.
6. Phase 4 browser-smoke status if rechecked.
7. Remaining blockers / explicit NO-GO items.
```
