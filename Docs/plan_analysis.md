# Анализ плана репозитория-шаблона

> Delivery baseline status: this is an audit/history document. Current fresh-template delivery baseline is ApiShip/Gorgo via `@gorgo/medusa-fulfillment-apiship`; direct `/store/apiship/*` is canonical. Delivery Hub/direct Yandex references below are historical unless explicitly marked current by newer source-of-truth docs.

> Где смотреть текущий операционный статус:
> [current_work.md](./current_work.md), [architecture.md](./architecture.md), [production_runbook.md](./production_runbook.md)
>
> Production sync `2026-05-11`: older statements below about missing production packaging/proxy/deploy automation are historical. Current implementation has [`docker-compose.prod.yml`](../docker-compose.prod.yml), Caddy-only reverse proxy, Payload production container, manual GitHub Actions production deploy, and dynamic product runtime smoke requirements.
>
> Назначение этого файла:
> это аудит и разбор реального состояния проекта, а не ежедневный журнал `что делаем прямо сейчас`.

## Краткий вывод

Канонический план по направлению остается правильным.

После подтвержденных проверок проект уже закрыл два критических ранних этапа:
- воспроизводимый clean local onboarding;
- template-ready backend baseline вместо demo-oriented bootstrap.

Простыми словами:
репозиторий уже не находится в статусе `поднимается только как демо-заготовка`, notification slice как первый integration slice Фазы 3 уже подтвержден, notification hardening v1 тоже закрыт и проверен, payment path v1 по YooKassa ранее подтвержден end-to-end для текущего scope, shipping track v1 подтвержден в рамках текущего slice: legacy provider `provider_aware_v1` прошёл runtime validation `2026-04-20`, provider активирован, route path подтверждён, grouped rates из the historical Yandex-backed rate path возвращаются, storefront сохраняет provider/tariff selection в cart shipping method data, а live multi-provider switching на одном тестовом адресе пока не подтверждено. **Checkout end-to-end validation v1** закрыт, **bootstrap idempotency hardening v1** подтвержден runtime validation, `storefront core baseline v1`, `VK ID v1`, `MTS Exolve`, `marketing layer v1`, `Payload CMS v1`, [`preset-driven-global-shell-contract-v1.md`](../plans/preset-driven-global-shell-contract-v1.md) и [`preset-driven-catalog-shell-contract-v1.md`](../plans/preset-driven-catalog-shell-contract-v1.md) уже закрыты как materialized workstreams. Template-readiness regression-pack уже формализован и больше не является следующим шагом. Финальный cross-preset regression pass по storefront browse matrix теперь тоже завершён verdict **PASS**, так что roadmap reality больше не читается как `Phase 6 started, broader customization still pending`: truthfully зафиксировано, что sanctioned **Фаза 6 storefront customization** закрыла весь preset-driven stack от [`NEXT_PUBLIC_STOREFRONT_PRESET`](../medusa-agency-boilerplate-storefront/src/lib/env.ts:21) до typed [`landingSurfaces`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:317), adjacent [`productSurfaces.supportHighlights`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:323), [`listingSurfaces.productCard`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:324), typed global shell contract [`StorefrontShellConfig`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:74) и typed catalog shell contract [`StorefrontCatalogShellConfig`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:298), а readiness verdict для этой фазы уже = готово к следующему roadmap stage. Дополнительно closure-check `2026-04-20` truthfully закрыл и **Фазу 7**: tranche 3 больше не находится в docs-remediation состоянии, потому что repeat RC smoke pass прошёл после targeted fix в [`scripts/notification-smoke.sh`](../scripts/notification-smoke.sh), а активная реальность roadmap теперь уже = стартовавшая **Фаза 8** с materialized baseline integrity contour.

Historical audit update `2026-04-21`:

- это не отменяло подтвержденный исторический legacy provider slice;
- direct Yandex investigation тогда сместил direction к собственному `delivery-hub` с первым adapter `Yandex Delivery`;
- после завершённой миграции Delivery Hub -> ApiShip/Gorgo этот блок является historical context, not current baseline guidance;
- current source of truth for delivery baseline is [current_work.md](./current_work.md), [apiship_direct_migration_plan.md](./apiship_direct_migration_plan.md), and [apiship_baseline_smoke_evidence.md](./apiship_baseline_smoke_evidence.md).


## Обновление статуса после подтверждения Фазы 2

После последних проверок подтверждено:
- добавлен root-level orchestration через [package.json](../package.json) и [scripts/](../scripts);
- добавлен [env_contract.md](./env_contract.md) как явная спецификация env-слоев;
- root orchestration содержит отдельный `npm run bootstrap` для fresh DB;
- bootstrap опирается на Medusa migrations и application-level seed, а не на SQL dump;
- `npm run permissions:fix` чинит права на `.medusa` и `node_modules/.vite`;
- канонический clean-state путь `cp .env.example .env` → `npm run bootstrap` → `npm run preflight` → `npm run dev` подтвержден;
- `npm run dev` подтвержден именно как root orchestration path:
  - сначала проходит [scripts/preflight.sh](../scripts/preflight.sh);
  - backend поднимается через `docker compose`;
  - storefront стартует локально после готовности backend;
- reuse уже запущенных runtime допускается не в общем виде, а только там, где [scripts/preflight.sh](../scripts/preflight.sh) явно считает сервис compose-owned;
- после bootstrap подтверждены:
  - `ru` region;
  - `rub` как baseline currency;
  - publishable API key;
  - sales channel;
  - минимальный shipping skeleton;
  - отсутствие обязательного demo-catalog baseline;
- в [medusa-agency-boilerplate-storefront/src/middleware.ts](../medusa-agency-boilerplate-storefront/src/middleware.ts) был найден и исправлен redirect edge-case;
- повторная проверка подтвердила, что redirect-loop больше не воспроизводится, а нормальная семантика middleware сохранена.

Вывод по статусу:
- **Gate A подтвержден и закрыт для clean local onboarding**;
- **Фаза 1 подтверждена как baseline локального старта**;
- **Фаза 2 подтверждена полностью, без оговорок**;
- **первый шаг Фазы 3 подтвержден**: notification slice v1 реализован и проверен как первый integration slice;
- **notification hardening v1 подтвержден как завершенный delivery result**;
- **payment track v1 подтвержден для текущего scope**: YooKassa-first path ранее прошел end-to-end verification;
- **shipping track v1 подтвержден для текущего scope**: в репо реализован и runtime-проверкой подтверждён backend-first **historical provider-aware rate-selection slice `provider_aware_v1`**; provider активирован, route path подтверждён, grouped rates из the historical Yandex-backed rate path возвращаются, storefront сохраняет выбранный provider/tariff в cart shipping method data, а прежний blocker закрыт targeted code fixes.

Отдельные notes после notification, payment и первого shipping slice:
- повторный `npm run bootstrap` поверх уже заполненной БД подтвержден runtime validation как idempotent и больше не является неидемпотентным сценарием;
- этот результат не отменяет подтверждение clean onboarding path и не возвращает Фазы 1-2 в статус open;
- auth-barrier для локального notification smoke закрыт через opt-in helper для on-demand secret admin API key, без расширения baseline и без перевода этого helper в обязательную часть clean onboarding;
- notification hardening v1 дополнительно подтвердил:
  - baseline-safe режим без внешних notification secrets;
  - `NOTIFICATION_EMAIL_PROVIDER=local` как baseline-default;
  - корректный fallback `unisender` → `local` при отсутствии `UNISENDER_API_KEY` без поломки startup, build и runtime;
  - рабочий authenticated smoke path через fresh secret admin API key и Basic auth;
  - стабильную форму ответа `POST /admin/notifications/smoke` с блоками `ok`, `request`, `auth`, `provider`, `notification`;
  - согласованный contract между workflow и runtime helper по `requested provider` и `resolved provider`;
  - helper [`createSecretAdminApiKey()`](../medusa-agency-boilerplate/src/scripts/create-secret-admin-api-key.ts:22), который создает свежий `sk_*` key и не полагается на reuse старого считанного token;
- verification pass после первого legacy provider slice подтвердил, что baseline and no-secret startup path не сломан, notification runtime не показал подтвержденной регрессии, а env-contract остался opt-in и baseline-safe;
- storefront `500` на checkout отделен от shipping slice и снят как ложный blocker: проблема оказалась runtime and data-state случаем отсутствующего или невалидного cart, а при валидном cart checkout route отвечает `200`;
- targeted code fixes в [`route.ts`](../medusa-agency-boilerplate/src/api/store/delivery/rates/route.ts) и [`seed.ts`](../medusa-agency-boilerplate/src/scripts/seed.ts) закрыли реальный blocker по legacy provider;
- production token был предоставлен, provider активирован через [`medusa-config.ts`](../medusa-agency-boilerplate/medusa-config.ts), подтверждён runtime path [`GET /store/delivery/rates`](../medusa-agency-boilerplate/src/api/store/delivery/rates/route.ts), а rates из the historical Yandex-backed rate path начали возвращаться;
- blocker больше не считается pending или deferred для текущего шага;

---

## Главный вердикт

Сейчас репозиторий уже выглядит как осмысленная стартовая база будущего master template, а не как просто слегка подправленный Medusa demo bootstrap.

Простыми словами:
фундамент и template-ready backend baseline уже подтверждены, notification path v1 подтвержден и дополнительно доведен до закрытого notification hardening v1, payment path v1 уже подтвержден для текущего YooKassa-first scope, shipping path v1 уже подтвержден как работающий historical provider-aware rate-selection slice `provider_aware_v1`, а checkout path теперь тоже подтвержден сквозным runtime/E2E pass до confirmed order page. Bootstrap idempotency hardening v1 подтвержден runtime validation и больше не является открытым concern. Sequencing после закрытых storefront slices тоже стал уже not theoretical: `Фаза 6` была доведена от sanctioned selector [`NEXT_PUBLIC_STOREFRONT_PRESET`](../medusa-agency-boilerplate-storefront/src/lib/env.ts:21) к typed landing, adjacent product, listing/card, global-shell и catalog-shell surfaces, а финальный cross-preset regression pass зафиксировал весь этот stack как **PASS** и готовый к следующему roadmap stage.

---

## Оценка по этапам плана

### Этап 0: Фундамент

**Вердикт:** выполнен частично, но уже достаточно для следующего этапа.

Что есть:
- серверная часть Medusa создана;
- структура проекта есть;
- базовые конфиги присутствуют;
- корневой orchestration-слой уже оформлен.

Чего все еще не хватает:
- собственного устойчивого набора шаблонных модулей и интеграционных слоев;
- признаков того, что это уже финальный `golden template`, а не подтвержденная базовая основа.

Простыми словами:
фундамент собран и держит нагрузку, но дом еще не оснащен теми системами, которые делают его готовым к серийному использованию.

---

### Этап 1: Инфраструктура в Docker

**Вердикт:** для локального цикла подтвержден; production-ready Docker/Caddy/deploy контур теперь materialized отдельно от старого локального вывода.

Что есть:
- есть [docker-compose.yml](../docker-compose.yml);
- поднимаются PostgreSQL, Redis и backend;
- root orchestration, preflight и clean onboarding подтверждены;
- локальный короткий путь старта воспроизводим.

Что еще важно различать:
- локальный [`docker-compose.yml`](../docker-compose.yml) по-прежнему не включает storefront/Payload/Caddy и остается dev-контуром;
- production упаковка существует в [`docker-compose.prod.yml`](../docker-compose.prod.yml), где storefront, Payload и Caddy включены;
- concrete separate staging host пока не materialized, см. [`staging_runbook.md`](./staging_runbook.md).

Простыми словами:
локальная инженерная сборка работает предсказуемо, а production packaging/deploy больше не является отсутствующим blocker. Оставшийся infrastructure gap относится к отдельному staging/prod-hardening contour, monitoring/rollback drills и operator-specific provisioning, а не к факту наличия production Docker runtime.

---

### Этап 2: Базовая локализация и template-ready baseline

**Вердикт:** подтвержден.

Что подтверждено:
- clean bootstrap больше не держится на demo-oriented baseline;
- в baseline подтверждены `ru` region и `rub` как опорная валюта;
- publishable key и sales channel создаются без ручной раскладки через админку;
- минимальный shipping skeleton присутствует;
- обязательный demo-catalog baseline больше не считается частью чистого шаблона;
- storefront redirect-loop, всплывший на этом этапе, исправлен без поломки общей middleware-семантики.

Простыми словами:
после bootstrap проект поднимается как нейтральный RU-ready skeleton, а не как витрина демо-магазина Medusa.

---

### Этап 3: Подключение РФ-пакета

**Вердикт:** ключевые integration slices подтверждены для текущего scope; notifications закрыты как первый slice и доведены до notification hardening v1, payments подтверждены для текущего YooKassa-first scope, shipping подтвержден как работающий historical provider-aware slice `provider_aware_v1`, checkout end-to-end validation v1 закрыт, `UniSender email migration v1` реализован и подтвержден, `post-UniSender cleanup-step` закрыт, `VK Community Messaging v1 foundation` уже реализован, `storefront core baseline v1` уже закрыт, `VK ID v1` уже реализован, повторно reviewed и закоммичен, а `MTS Exolve` уже реализован, повторно провалидирован и закоммичен. Следующий шаг по sequencing — не storefront core, не новый VK linking pass и не повторный SMS rollout, а отдельный `marketing layer`.

Что уже подтверждено:
- notifications были выбраны первым vertical slice Фазы 3;
- notification runtime теперь уже реализован в актуальном backend-only контуре:
  - Notification Module;
  - local provider для dev и baseline-default;
  - `UniSender` path для production как текущий opt-in email transport;
  - provider-agnostic workflow;
  - admin smoke route;
  - opt-in helper для локальной генерации secret admin API key;
- на уровне roadmap уже принято следующее архитектурное решение:
  - целевой RF-oriented email provider = `UniSender`;
  - целевой VK transport = `VK Community Messaging`, а `VK ID` используется как optional auth/identity layer;
  - целевой SMS provider = `MTS Exolve`;
  - отдельный internal marketing layer остается обязательным и не заменяется внешним suite вроде `Sendsay`;
- notification hardening v1 дополнительно подтвержден:
  - baseline-safe режим без внешних notification secrets;
  - `NOTIFICATION_EMAIL_PROVIDER=local` как baseline-default;
  - fallback `unisender` → `local` при отсутствии `UNISENDER_API_KEY` без поломки startup, build и runtime;
  - authenticated smoke path через secret admin API key и Basic auth;
  - helper [`createSecretAdminApiKey()`](../medusa-agency-boilerplate/src/scripts/create-secret-admin-api-key.ts:22), который создает свежий `sk_*` key для канонического smoke path и не полагается на reuse старого token;
  - route [`POST()`](../medusa-agency-boilerplate/src/api/admin/notifications/smoke/route.ts:26) со стабильной формой ответа `ok`, `request`, `auth`, `provider`, `notification`;
  - согласование workflow [`sendNotificationSmokeWorkflow`](../medusa-agency-boilerplate/src/workflows/send-notification-smoke.ts:60) и runtime helper [`getNotificationEmailRuntime()`](../medusa-agency-boilerplate/src/modules/notification-email.ts:119) по `requested provider` и `resolved provider`;
- order lifecycle notifications hardening v1.1 дополнительно подтвержден поверх первого post-order slice:
  - dedupe authority = existing notification storage, а не отдельный ledger;
  - strategy = query-before-create dedupe;
  - canonical match set = `trigger_type + resource_type + resource_id + channel + template + normalized recipient`;
  - duplicate path = controlled skip с diagnostics без второго notification;
  - trace fields усилены для duplicate suppression и skip-path visibility;
  - race window признан и зафиксирован как accepted limitation;
- payment track v1 подтвержден как YooKassa-first path для текущего payment scope:
  - provider registration;
  - session initiation;
  - hosted redirect and return path;
  - webhook and status handling;
  - minimal storefront provider-aware adaptation;
- shipping track v1 реализован как backend-first legacy provider rate-selection slice:
  - opt-in provider registration в [medusa-config.ts](../medusa-agency-boilerplate/medusa-config.ts);
  - fulfillment provider в the removed backend fulfillment-provider module;
  - store route для rate lookup в [src/api/store/delivery/rates/route.ts](../medusa-agency-boilerplate/src/api/store/delivery/rates/route.ts);
  - seed-path для shipping option в [src/scripts/seed.ts](../medusa-agency-boilerplate/src/scripts/seed.ts);
  - storefront data layer в the removed storefront legacy delivery helper и [src/lib/data/cart.ts](../medusa-agency-boilerplate-storefront/src/lib/data/cart.ts);
  - checkout shipping selection в [src/modules/checkout/components/shipping/index.tsx](../medusa-agency-boilerplate-storefront/src/modules/checkout/components/shipping/index.tsx);
  - safe-by-default semantics for the legacy provider while it existed: пустое или невалидное значение теперь оставляет provider в test-mode, а silent live-default убран;
  - root orchestration тоже выровнен под этот contract: [scripts/env-sync.sh](../scripts/env-sync.sh) больше не пишет explicit live-mode opt-in по отсутствующей root-переменной, а синхронизирует безопасный default `true`;
  - локальный backend runtime env на этой машине приведен к той же политике, чтобы не оставалось residual live-default state;
  - route quotes сохраняют legacy ETA mapping и добавляют fallback на `workDays*` / `calendarDays*`;
  - request error handling в the removed backend fulfillment-provider module теперь извлекает structured error body и держит diagnosability по status/code/message/description без утечки секрета;
  - текущая checkout-семантика честно зафиксирована как `cheapest_only_v1`, а не как полноценный multi-quote UX.
- env-contract для integration path расширен opt-in переменными:
  - `YOOKASSA_SHOP_ID`;
  - `YOOKASSA_SECRET_KEY`;
  - `YOOKASSA_RETURN_URL`;
  - `YOOKASSA_STOREFRONT_RETURN_ORIGINS`;
  - `YOOKASSA_WEBHOOK_URL`;
  - `YOOKASSA_WEBHOOK_SECRET`;
  - `YOOKASSA_ALLOW_UNSIGNED_WEBHOOKS`;
  - `NEXT_PUBLIC_YOOKASSA_ENABLED`;
  - historical DB residue from removed delivery provider (operator note only; no env activation keys or mode flags);
  - `NOTIFICATION_EMAIL_PROVIDER`;
  - `NOTIFICATION_EMAIL_FROM`;
  - `UNISENDER_API_KEY`;
  - `UNISENDER_BASE_URL`.
- verification pass после первого legacy provider slice подтвердил:
  - `npm run bootstrap`, `npm run preflight` и `npm run dev` продолжают работать без обязательных payment secrets, без обязательных credentials удалённого legacy provider и без обязательных notification secrets;
  - canonical root orchestration больше не теряет YooKassa hardening keys: `scripts/env-sync.sh` синхронизирует `YOOKASSA_STOREFRONT_RETURN_ORIGINS`, optional `YOOKASSA_WEBHOOK_URL` и safe default `YOOKASSA_ALLOW_UNSIGNED_WEBHOOKS=false` в backend env;
  - `NOTIFICATION_EMAIL_PROVIDER=local` остается безопасным baseline-default;
  - `unisender` без `UNISENDER_API_KEY` корректно не поднимается как обязательный provider и падает обратно на `local`;
  - removed delivery provider больше не имеет env activation surface;
  - historical delivery rows/provider ids в старых базах считаются external/operator-approved cleanup scope;
  - storefront `500` на checkout не является подтвержденной code regression и при валидном cart route отвечает `200`;
  - payload mapping, endpoint usage и live and test режим по текущей реализации выглядят корректно;
  - env-contract для clean onboarding остался opt-in и baseline-safe.

Что при этом пока не реализовано, хотя уже выбрано на уровне плана:
- client customization layer поверх общего storefront core и уже materialized Payload content layer;
- template release and automation phases как productionized distribution contour.

Что требуется дальше по факту:
- не переписывать код без нового evidence о code bug;
- удерживать как source of truth, что notification hardening v1 уже закрыт, `order lifecycle notifications hardening v1.1` уже реализован, bootstrap idempotency hardening v1 **подтвержден runtime validation**, legacy provider `cheapest_only_v1` подтверждён runtime-проверкой, checkout end-to-end validation v1 закрыт, `order lifecycle notifications v1` уже реализован, shipped slice уже реализован и его targeted validation уже закрыта harness-ом [send-order-shipped-notification.unit.spec.ts](../medusa-agency-boilerplate/src/workflows/__tests__/send-order-shipped-notification.unit.spec.ts), `UniSender email migration v1` уже закрыт code-level runtime и unit harness-ом [notification-email-runtime.unit.spec.ts](../medusa-agency-boilerplate/src/workflows/__tests__/notification-email-runtime.unit.spec.ts), `post-UniSender cleanup-step` закрыт, `VK Community Messaging v1 foundation` закрыт targeted validation, review verdict `approve` и коммитом `0058a6d`, `storefront core baseline v1` закрыт коммитом `6f9a5499e2c9fcf08e2e6d1fffa75f350e82f5bb`, `VK ID v1` закрыт после blocker-fix cycle коммитом `f48a02658d116a04afd794c1134ac72e0ab00bc8`, `MTS Exolve` закрыт после blocker-fix cycle коммитом `b13f6fa93473bb8bc0320566a75d264d60739784` `feat(notification): add MTS Exolve SMS workstream`, `marketing layer v1` закрыт коммитом `a4711906b16523dcf03da9601ccf1a914702ca7d` `feat(marketing-layer): add marketing preferences and campaign workflows`, `Payload CMS v1` закрыт коммитом [`22486388f4c89d884b4c3cbe668ebec4ab695dee`](../package.json:1) `feat(content): add Payload CMS marketing content layer`, а [`Preset-driven landing-surface contract v1`](../plans/preset-driven-landing-surface-contract-v1.md) закрыт коммитом `7e3266c1478ab81f4f6748d6ee6fa5612cf3eecd` `feat(storefront): add preset-driven landing surface contract`;
- считать communication blueprint для **`VK Community Messaging`** уже materialized, а не planning-only;
- удерживать provider decisions по `UniSender`, `VK`, `VK ID` и `MTS Exolve` как уже принятые архитектурные решения, а не как открытую развилку;
- удерживать как source of truth, что `marketing layer` больше не является design-only: metadata-first contract живет в [`MarketingPreferences`](../medusa-agency-boilerplate/src/modules/marketing-preferences.ts:37), campaign and journal surface — в [`ensureMarketingLayerTables()`](../medusa-agency-boilerplate/src/modules/marketing-layer.ts:305), launch semantics — в [`sendMarketingCampaignWorkflow`](../medusa-agency-boilerplate/src/workflows/send-marketing-campaign.ts:508), а storefront profile preferences materialized в [`ProfileMarketingPreferences`](../medusa-agency-boilerplate-storefront/src/modules/account/components/profile-marketing-preferences/index.tsx:92);
- удерживать как source of truth, что `Payload CMS v1` больше не является plan-only: отдельный app [`payload-cms`](../payload-cms), storefront content integration, preview/revalidate, globals, fallback behaviour и root orchestration updates materialized в закрытом workstream;
- sequencing читать как `UniSender migration → cleanup → VK Community Messaging → storefront core baseline → VK ID → MTS Exolve → marketing layer → Payload CMS v1 → client customization`, где первые восемь шагов уже materialized;
- `VK Community Messaging v1` должен оставаться existing Notification Module pattern, а не переописываться как ad-hoc direct API calls из subscribers в обход notification storage;
- delivery/result VK scope считать уже закрытым в составе foundation + service notification slices `order.placed`, `shipment.created`, `order.canceled` плюс optional `VK ID v1` linking layer;
- recipient-binding для VK после `VK ID v1` удерживать как legacy-compatible contract: existing delivery truth `customer.metadata.vk_peer_id` остаётся совместимой canonical surface, а structured `customer.metadata.vk_link` фиксирует provider-aware linking state, timestamps и unlink status;
- validation expectation для уже закрытых VK шагов фиксировать как подтвержденные targeted harness patterns: `21/21` для `VK Community Messaging v1 foundation` и `8/8` + backend typecheck PASS для `VK ID v1`;
- validation expectation для закрытого `marketing layer v1` фиксировать как backend typecheck PASS, storefront typecheck PASS и `1` suite / `6` tests PASS в [`marketing-layer.unit.spec.ts`](../medusa-agency-boilerplate/src/workflows/__tests__/marketing-layer.unit.spec.ts:27), при review verdict `approve` и только non-blocker notes по admin `PUT` query ergonomics и manual URL parsing в dynamic route;
- validation expectation для закрытого `Payload CMS v1` фиксировать как PASS по [`payload:types`](../package.json:25), [`payload:importmap`](../package.json:26), [`payload:build`](../package.json:23), review verdict `approveable`, а post-review hardening дополнительно закрывает preview-access residuals для globals и preview-exit;
- validation expectation для закрытого [`Preset-driven landing-surface contract v1`](../plans/preset-driven-landing-surface-contract-v1.md) фиксировать как storefront typecheck PASS, storefront build PASS, diff hygiene PASS, review verdict `approveable` и только controlled static params или Store API fallback warnings как accepted non-blocking outcome;
- storefront `next build` больше не должен трактоваться как известный blocker перед `Фазой 6`: [`generateStaticParams()`](../medusa-agency-boilerplate-storefront/src/app/[countryCode]/(main)/categories/[...category]/page.tsx:19), [`generateStaticParams()`](../medusa-agency-boilerplate-storefront/src/app/[countryCode]/(main)/collections/[handle]/page.tsx:21) и [`generateStaticParams()`](../medusa-agency-boilerplate-storefront/src/app/[countryCode]/(main)/products/[handle]/page.tsx:15) теперь build-safe и при недоступном Store API возвращают пустой SSG surface вместо `ECONNREFUSED` hard-fail;
- `Фаза 6` больше не является чисто следующим шагом на бумаге: customization layer уже materialized в [`storefront-client-config.ts`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts), [`HomeSectionRenderer`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/home-section-renderer/index.tsx), shell variants [`nav/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/layout/templates/nav/index.tsx) / [`footer/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/layout/templates/footer/index.tsx), display-only product surface [`ProductSupportHighlights`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/product-support-highlights/index.tsx), а закрытый [`Preset-driven landing-surface contract v1`](../plans/preset-driven-landing-surface-contract-v1.md) уже нормализовал `home`, `collectionLanding`, `contentPage` и `postPage` вокруг typed landing registry и [`landing-surface-resolver.ts`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/landing-surface-resolver.ts); дальше текущий repo state уже materialized section-based page composition через [`collection-landing-surface/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/collection-landing-surface/index.tsx), [`content-page-surface/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/content-page-surface/index.tsx) и [`post-page-surface/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/post-page-surface/index.tsx) при том же sanctioned preset catalog `atelier|market`, env-switch `NEXT_PUBLIC_STOREFRONT_PRESET` и anti-fork guardrails поверх одного storefront core;
- не подменять cheapest-only semantics заявлением, будто в checkout уже есть полноценный multi-quote UX;
- не подменять поэтапную интеграцию заявлением, будто вся Фаза 3 или весь order lifecycle уже закрыты;
- не подменять отдельный internal marketing layer внешним marketing hub, потому что это решение уже отвергнуто на уровне roadmap.

Что пока не подтверждено:
- production-ready commerce контур как полностью завершенный end-to-end + post-order lifecycle;
- полноценный client customization layer beyond the first sanctioned preset pair and current override surfaces;
- полноценный multi-quote checkout UX для shipping;
- `providerConnectId` / `extraParams` support без отдельного бизнес-решения;
- полный общий template release и automation contour.

Что теперь подтверждено дополнительно:
- идемпотентный повторный `npm run bootstrap` поверх уже заполненной БД как закрытый hardening result (runtime validation `2026-04-17`);
- `payment failed notification v1` и `order canceled notification v1` уже зафиксированы как закрытые notification flows;
- Medusa-side trigger boundary для `payment failed notification v1` уже выбрана и провалидирована в текущем confirmed scope;
- template-readiness regression-pack теперь должен быть централизован в [template_readiness_regression.md](./template_readiness_regression.md), а не размазан по устным договоренностям;
- для канонического authenticated notification smoke допустим один lightweight helper path через root command `npm run smoke:notification`.
- storefront build validation дополнительно подтверждена без живого backend: `next build` проходит, а SSG routes для categories/collections/products логируют controlled fallback вместо сетевого hard-fail.
- старт `Фазы 6` дополнительно подтверждён кодом и build-level validation: phase reality теперь читать как `Phase 6 started, foundation delivered, broader customization still pending`, а не как `not started`.

Простыми словами:
вопрос `какой notification path берем` уже закрыт для первой версии и доведен до hardening v1, вопрос `какой payment path берем` уже получил и подтвердил практический ответ в виде YooKassa-first path, вопрос `какой shipping path берем` тоже получил практический ответ в виде historical provider-aware rate-selection slice, checkout path уже подтвержден до confirmed order page, storefront core уже закрыт, `VK ID v1` уже материализовал optional account linking поверх existing VK transport без слома baseline env/runtime, а `MTS Exolve` уже материализовал optional SMS channel поверх existing Notification Module architecture. Текущая operational reality уже ушла дальше прежнего sequencing marker `marketing layer`: после закрытых `marketing layer v1`, `Payload CMS v1`, landing, adjacent product, listing/card и global-shell slices активный narrative должен читать Phase 6 как продолжающийся docs-synced customization track, а не как возврат к уже закрытым шагам.

### Важный policy-risk, который уже проявился

Проблема:
если не зафиксировать market scope достаточно жестко, агент может предложить `Stripe` или другой удобный official-first провайдер просто потому, что он лучше описан в Medusa docs.

Что это значит технически:
- `official pattern` и `target provider for this repository` — не одно и то же;
- для этого master repo пригодность к типовому магазину в РФ должна быть первичным фильтром;
- YooKassa уже является подтвержденным payment v1 direction, а shipping direction уже начат и должен читаться как historical provider-aware, если пользователь явно не сменил рынок.

Простыми словами:
если в документах плохо прописан рынок, агент будет тянуться к самому удобному примеру из интернета, а не к нужному решению для России.

---

### Этап 4: Русификация фронтенда

**Вердикт:** как продуктовый и брендовый трек еще не начат.

Что важно не перепутать:
- исправление redirect-loop в middleware — это закрытие регрессии совместимости, а не завершение русификации storefront;
- product copy, брендинг и управляемый клиентский UX все еще остаются отдельным будущим этапом.

Простыми словами:
витрина стала совместимой с подтвержденным baseline, но это еще не означает, что она уже доведена до клиентского русскоязычного storefront-ядра.

---

### Этап 5: Финализация и шаблон

**Вердикт:** не начат.

Чего пока нет:
- нормального процесса шаблонизации под нового клиента;
- автоматических smoke-проверок на уровне полноценного template release;
- staging and prod-ready контура;
- понятной упаковки `готовый master repo для тиражирования`.

Простыми словами:
пока нельзя честно сказать `копируем репозиторий и сразу получаем серийный шаблон для клиентов`.

---

## Что теперь важно не искажать в статусах

### 1. Нельзя описывать Фазу 2 как открытую

Проблема:
bootstrap baseline уже проверен и подтвержден, поэтому старые формулировки про `текущий незавершенный шаг Фаза 2` стали ложными.

Простыми словами:
этот трек уже закрыт, и агент не должен снова заходить в него по умолчанию.

### 2. Нельзя переоткрывать Gate A из-за dirty-DB сценариев

Проблема:
bootstrap idempotency hardening v1 теперь подтвержден runtime validation, поэтому dirty-DB не является аргументом для пересмотра clean onboarding path.

Простыми словами:
как на чистой, так и на заполненной базе bootstrap работает предсказуемо, и это не надо смешивать со сценариями, которые ещё не проверены.

### 3. Нельзя путать storefront bugfix с полной storefront-фазой

Проблема:
middleware fix был важной частью закрытия Фазы 2, но он не заменяет отдельные storefront productization и branding workstreams.

Простыми словами:
мы закрыли регрессию совместимости, а не всю фронтовую адаптацию.

### 4. Нельзя держать закрытый legacy provider blocker в статусе pending

Проблема:
legacy provider blocker больше не является внешним account-state ожиданием для текущего slice. Production token был предоставлен, targeted fixes в route/data path внесены, route подтверждён runtime-проверкой, а rates начали возвращаться. Если продолжать описывать его как pending blocker, документация снова начнет искажать реальный sequencing.

Простыми словами:
к legacy provider не нужно возвращаться как к незакрытому blocker'у для `cheapest_only_v1`; этот шаг уже отработан и больше не должен отвлекать от post-checkout sequencing.

### 5. Нельзя оставлять notification hardening в статусе open

Проблема:
notification hardening v1 уже реализован и подтвержден. Если продолжать писать о нем как о следующем или текущем шаге, агент будет планировать работу по уже закрытому треку и искажать sequencing.

Простыми словами:
notification track уже доведен до рабочего hardening-результата, поэтому следующая внутренняя работа должна сместиться дальше.

### 6. Нельзя называть репозиторий полностью готовым шаблоном раньше времени

Проблема:
после подтверждения Фазы 2 и notification hardening состояние стало заметно лучше, но до template release по-прежнему не хватает интеграционного слоя, упаковки и эксплуатационных контуров.

Простыми словами:
bootstrap теперь честный, notifications тоже доведены до устойчивого baseline-safe состояния, но фабрика серийного выпуска еще не собрана.

---

## Практические разрывы, которые остаются открытыми

### 1. Checkout path подтверждён, а первый post-order notification slice уже собран

Что это значит технически:
по notifications путь v1 уже подтвержден и доведен до hardening v1, по payments YooKassa-first path подтвержден для текущего scope, по shipping выбранный и реализованный historical provider-aware rate-selection slice подтверждён runtime-проверкой, а checkout chain уже подтверждена до confirmed order page. Поверх этого order creation уже реализован первый production-like customer-facing path: subscriber [`orderPlacedNotificationHandler()`](../medusa-agency-boilerplate/src/subscribers/order-placed-notification.ts:5) слушает `order.placed`, workflow [`sendOrderPlacedNotificationWorkflow`](../medusa-agency-boilerplate/src/workflows/send-order-placed-notification.ts:147) делает query по минимальной форме `{ id, display_id, email }`, а Notification Module отправляет notification с template `order-placed-v1` и trigger type `order.placed.customer.notification_requested`.

Простыми словами:
клиент уже может не только дойти до подтвержденного заказа, но и попасть в первый post-order notification slice, который теперь реализован в production-like виде.

### 2. Shipped slice реализован и validation уже закрыта

Что это значит технически:
для `shipment.created` path контракт уже определен: event payload baseline = `{ id, no_notification }`, canonical recipient = `order.email`, path = `subscriber → workflow → Notification Module`, controlled skip используется для `no_notification=true`, отсутствующего `order.email` и duplicate match, fallback chain в `v1` не применяется, а anti-duplicate contract hardening v1.1 переиспользуется поверх existing notification storage с canonical identity по `trigger_type + resource_type + resource_id + channel + template + normalized recipient`, где resource boundary = `fulfillment.id`. Duplicate suppression трактуется как controlled skip с diagnostics, а race window в query-before-create path остается accepted limitation. Shipped contract уже отдельно провалидирован и закреплен targeted harness-ом без смешения с authenticated smoke baseline.

Простыми словами:
маршрут покупки уже доведен не только до оформления заказа, но и до следующего shipped slice, и этот verification result уже отдельно зафиксирован.

### 3. Bootstrap path доведен до идемпотентного hardening

Что это значит технически:
clean-clone path подтвержден, и повторный `npm run bootstrap` поверх уже заполненной БД теперь тоже **подтвержден runtime validation** `2026-04-17` — все baseline entities корректно reuse, publishable key стабилен, а конфликтное состояние базы блокируется с exit code 1.

Простыми словами:
как первый запуск, так и сценарий повторной настройки существующей инсталляции теперь доведены до устойчивого шаблонного поведения.

### 4. Нет полного общего интеграционного слоя

Что это значит технически:
notification slice уже собран и hardened, payment slice подтвержден, shipping slice подтвержден, checkout path подтвержден, но для полного commerce-контура еще предстоит собрать и стабилизировать post-order workflows, adapters, env-contracts, webhook-handling и failure-paths, а затем свести это в общий контур.

Простыми словами:
основной путь покупки уже работает, но весь привод реальных продаж вместе с post-order реакциями все еще не собран целиком.

### 5. Нет полного release-grade контура шаблона

Что это значит технически:
storefront customization уже truthfully закрыт как `Фаза 6`, marketing layer уже materialized и закрыт, а `Фаза 7` теперь тоже закрыта после RC closure-check. Открытым остаётся не storefront или marketing architecture, а именно release-grade contour `Фазы 8`: staging, deploy path, rollback, backup/restore, monitoring и broader production-readiness automation.

Простыми словами:
ядро, клиентская упаковка и handoff path уже собраны заметно лучше, но полноценный конвейер релизной эксплуатации ещё не достроен.

### 6. Phase 8 уже стартовала, но пока только узким tranche 1

Что это значит технически:
baseline integrity contour уже materialized: root aggregate gates, browser smoke и minimal CI workflow существуют, static pass и runtime smoke pass подтверждены `2026-04-20`. Но это пока не staging/prod contour и не полный release automation surface.

Простыми словами:
автоматические проверки уже начались по-настоящему, но до production-grade шаблона ещё не хватает второй половины `Фазы 8`.

---

## Как теперь читать канонический план

Текущая честная последовательность такая:
1. Фаза 1 — подтверждена;
2. Фаза 2 — подтверждена;
3. Фаза 3 — integration slices подтверждены: notification hardening v1 закрыт, payment v1 подтвержден как YooKassa-first path, shipping v1 подтвержден как historical provider-aware rate-selection slice `cheapest_only_v1`, checkout end-to-end validation v1 закрыт;
4. bootstrap idempotency hardening v1 — **подтвержден runtime validation** `2026-04-17` и закрыт как template-readiness track;
5. template-readiness regression formalization v1 — зафиксирован и больше не является pending следующим шагом;
6. order lifecycle notifications v1 и `order shipped notification v1` — уже реализованы как первые customer-facing post-order slices поверх подтверждённого checkout path, а shipped validation закрыта;
7. **implementation `VK Community Messaging v1 foundation` теперь тоже реализован** как opt-in Notification Module expansion, а не остаётся design-only шагом;
8. `VK Community Messaging v1` материализован как новый channel track поверх existing Notification Module architecture, sibling smoke path и post-order service slices `order.placed`, `shipment.created`, `order.canceled`;
9. communication stack на roadmap уже зафиксирован так: `UniSender` для email, `VK Community Messaging` + optional `VK ID` для VK и `MTS Exolve` для SMS, а marketing orchestration должен идти отдельным слоем без `Sendsay`;
10. Фазы 5, 5.5 и 6 уже truthfully закрыты как materialized workstreams;
11. Фаза 7 тоже truthfully закрыта после repeat RC smoke/closure-check `2026-04-20`;
12. активный следующий шаг roadmap теперь = `Фаза 8`, где tranche 1 baseline integrity contour уже materialized и validated, а remaining scope лежит в staging/deploy/rollback/backup/restore/monitoring.

Простыми словами:
план больше не нужно корректировать так, будто стабилизация и baseline еще не сделаны, будто Фаза 3 еще только начинается, будто notification hardening все еще открыт, будто payment track существует только как решение на бумаге, будто shipping остается на чистом decision stage, будто legacy provider blocker еще pending, будто checkout E2E ещё не закрыт, будто `order.placed` slice ещё только планируется, или будто bootstrap idempotency остается незакрытым hardening concern. Теперь нужно использовать уже реализованный order placement path как опору для validation первого post-order notification slice и только потом двигаться дальше по более широким storefront и release-направлениям.

---

## Что со skills для агента

### Что видно сейчас

В проекте уже есть локальный Kilo Code project-level skill: [.kilocode/skills/medusa-master-repo/SKILL.md](../.kilocode/skills/medusa-master-repo/SKILL.md).

Его роль:
- быстро вести агента к [current_work.md](./current_work.md), [master_repo_plan_v2.md](./master_repo_plan_v2.md) и [plan_analysis.md](./plan_analysis.md);
- фиксировать verified reality;
- не давать агенту стартовать из устаревшего статуса.

### Что от него требуется сейчас

Skill должен явно отражать:
- clean onboarding подтвержден;
- Фаза 2 закрыта и не является текущим рабочим треком;
- redirect-loop закрыт как ложный blocker для текущего shipping workstream;
- notification slice v1 подтвержден как первый шаг Фазы 3;
- notification hardening v1 закрыт и authenticated smoke path подтвержден как канонический;
- payment track v1 подтвержден как YooKassa-first path для текущего scope;
- shipping track v1 provider-aware opt-in / baseline-safe rate-selection wording является historical/removed context only, не current supported provider activation surface;
- checkout end-to-end validation v1 закрыт, включая hosted YooKassa return и confirmed order page;
- targeted fixes в [`payment-button/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/checkout/components/payment-button/index.tsx) и [`cookies.ts`](../medusa-agency-boilerplate-storefront/src/lib/data/cookies.ts) являются частью честного source of truth по закрытию checkout path;
- storefront `500` по checkout отделен как cart and data-state issue и не должен возвращаться как подтвержденная shipping code bug;
- order lifecycle notifications v1 и `order shipped notification v1` уже реализованы на path `subscriber → workflow → Notification Module` с canonical recipient = `order.email`, а shipped path использует `shipment.created` и resource boundary = `fulfillment.id`;
- shipped validation уже закрыта через [send-order-shipped-notification.unit.spec.ts](../medusa-agency-boilerplate/src/workflows/__tests__/send-order-shipped-notification.unit.spec.ts);
- `UniSender email migration v1`, `post-UniSender cleanup-step`, `VK Community Messaging v1 foundation`, `storefront core baseline v1`, `VK ID v1`, `MTS Exolve`, `marketing layer v1`, `Payload CMS v1`, [`Preset-driven landing-surface contract v1`](../plans/preset-driven-landing-surface-contract-v1.md), [`adjacent-preset-rollout-product-support-highlights.md`](../plans/adjacent-preset-rollout-product-support-highlights.md), [`preset-driven-listing-surface-contract-v1.md`](../plans/preset-driven-listing-surface-contract-v1.md), [`preset-driven-global-shell-contract-v1.md`](../plans/preset-driven-global-shell-contract-v1.md) и [`preset-driven-catalog-shell-contract-v1.md`](../plans/preset-driven-catalog-shell-contract-v1.md) уже закрыты как completed базовые workstreams;
- при этом truthful Phase 6 narrative нельзя больше писать как будто catalog-shell closure автоматически закрыл весь remaining storefront scope: source of truth теперь обязан явно удерживать sequence `initial closure claim → valid reopen → remediation → truthful re-close`;
- Phase 6 storefront customization больше нельзя описывать как landing-only, product-detail-only, listing-only или global-shell-only progress: source of truth уже продвинут от typed [`landingSurfaces`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:317) к adjacent typed [`productSurfaces.supportHighlights`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:323), дальше к typed listing/card contract [`listingSurfaces.productCard`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:324), потом к typed global shell surfaces в [`StorefrontShellConfig`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:74) и typed browse-framing contract [`StorefrontCatalogShellConfig`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:298), materialized через [`listing-surface-resolver.ts`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/listing-surface-resolver.ts), [`shell-surface-resolver.ts`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/shell-surface-resolver.ts), [`catalog-shell-resolver.ts`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/catalog-shell-resolver.ts), sanctioned consumers [`ProductCardSurface`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/product-card-surface.tsx:55), [`StoreCatalogIntroSurface`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/catalog-shell-surface.tsx:51), [`CatalogResultsShellSurface`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/catalog-shell-surface.tsx:104), [`FeaturedRailCatalogShellSurface`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/catalog-shell-surface.tsx:130), [`nav/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/layout/templates/nav/index.tsx:17), [`footer/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/layout/templates/footer/index.tsx:12), [`side-menu/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/layout/components/side-menu/index.tsx:50) и thin shared boundaries [`ProductPreview`](../medusa-agency-boilerplate-storefront/src/modules/products/components/product-preview/index.tsx:9), [`store/templates/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/store/templates/index.tsx), [`collections/templates/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/collections/templates/index.tsx), [`product-rail/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/home/components/featured-products/product-rail/index.tsx), [`RootLayout`](../medusa-agency-boilerplate-storefront/src/app/layout.tsx:14);
- closure catalog-shell slice зафиксирован как [`npx tsc --noEmit`](../medusa-agency-boilerplate-storefront/package.json) PASS, [`npm run build`](../medusa-agency-boilerplate-storefront/package.json:12) PASS, [`git diff --check`](../.gitignore) PASS, review verdict = APPROVE, commit = [`c7d101ea506a6602e085be2aaaab5e1b20afac28`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:325), а sanctioned runtime selector по-прежнему только [`NEXT_PUBLIC_STOREFRONT_PRESET`](../medusa-agency-boilerplate-storefront/src/lib/env.ts:21) при central config authority в [`storefront-client-config.ts`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts);
- reopen был признан валидным по трём gap'ам и их нужно удерживать как закрытую, но исторически важную часть truthful closure:
  - category browse route вне sanctioned [`catalogShell`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:325) contour до remediation-коммита `adb8df25ed64d9540e36588ee91dc5ff24951009` `fix(storefront): route category browse through catalogShell contour`;
  - related products rail вне sanctioned listing surface contract до remediation-коммита `275dc4d823b8203bd1d49364ba4d02211bf42799` `fix(storefront): move related products to sanctioned listing surface contract`;
  - loading/skeleton state вне card/listing contract до remediation-коммита `97a4837c483b054d25511f216ee487bf150306b4` `fix(storefront): align skeleton loading states with card surface contract`;
- guardrails для truthful re-closed catalog/listing surface нужно удерживать явно: bounded presentation-only typed browse contract без raw Tailwind/class-string config, narrow resolver boundary [`resolveStoreCatalogIntroSurface()`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/catalog-shell-resolver.ts:15), [`resolveStoreCatalogResultsSurface()`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/catalog-shell-resolver.ts:18), [`resolveCollectionCatalogResultsSurface()`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/catalog-shell-resolver.ts:21), [`resolveFeaturedRailCatalogShellSurface()`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/catalog-shell-resolver.ts:24), thin shared browse seams в [`store/templates/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/store/templates/index.tsx), [`collections/templates/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/collections/templates/index.tsx), [`product-rail/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/home/components/featured-products/product-rail/index.tsx) и отсутствие preset-name branching в shared browse templates;
- закрытый storefront-core scope нужно удерживать узко и без дрейфа: shared storefront shell, runtime/config layer, RU-neutral copy baseline, provider-aware checkout/shipping presentation и cleanup starter/demo/onboarding surfaces без изменения backend contracts;
- provider decisions по `UniSender`, `VK Community Messaging`, optional `VK ID` и `MTS Exolve` уже зафиксированы в плане как approved и materialized stack на transport-уровне;
- marketing layer теперь materialized как отдельный internal слой: consent/preferences truth живет в [`customer.metadata.marketing`](../medusa-agency-boilerplate/src/modules/marketing-preferences.ts:37), campaign execution and journal — в [`marketing-layer.ts`](../medusa-agency-boilerplate/src/modules/marketing-layer.ts:305), а `Payload` и `admin` сохраняют роли content и operations соответственно;
- `Payload CMS v1` уже не просто запланирован в дорожной карте как Фаза 5.5, а закрыт commit-level и validation-level evidence: отдельный app [`payload-cms`](../payload-cms), storefront content integration, preview/revalidate, globals, fallback behaviour, root payload scripts/env sync и blocker-fix в [`scripts/payload-run.sh`](../scripts/payload-run.sh:28) materialized в репозитории;
- bootstrap idempotency hardening v1 подтвержден runtime validation и больше не является открытым hardening concern;
- решения для не-РФ рынка не должны предлагаться как default path только потому, что они official или first-party;
- residual review aftermath по `Payload CMS v1` честно удерживается как non-blocking observations, а не как основание переоткрывать закрытый commit;
- текущий storefront repo state всё ещё содержит явный starter drift, который и должен закрываться в baseline:
  - shopper-visible `Medusa` CTA и starter attribution;
  - customer-facing demo/onboarding CTA и admin links;
  - storefront README со Stripe-first starter narrative;
  - частично неунифицированный region fallback между middleware и data layer.

Простыми словами:
skill должен вести агента к реальному следующему шагу, а не возвращать его в уже закрытую фазу.

---

## Итог

План хороший как реальная дорожная карта и теперь лучше совпадает с фактически подтвержденным состоянием репозитория.

Самая честная формулировка на сегодня такая:

> У нас уже есть подтвержденный clean onboarding, подтвержденный template-ready backend baseline без demo-oriented bootstrap, закрытый notification hardening v1 с baseline-safe fallback и authenticated smoke, подтвержденный payment v1 как YooKassa-first path для текущего scope, подтвержденный historical provider-aware shipping slice `cheapest_only_v1`, подтвержденный checkout runtime/E2E path, закрытые post-order slices `order.placed`, `shipment.created`, `payment failed`, `order canceled`, а также закрытые базовые workstreams `VK Community Messaging v1 foundation`, `storefront core baseline v1`, `VK ID v1`, `MTS Exolve`, `marketing layer v1`, `Payload CMS v1`, [`Preset-driven landing-surface contract v1`](../plans/preset-driven-landing-surface-contract-v1.md), [`adjacent-preset-rollout-product-support-highlights.md`](../plans/adjacent-preset-rollout-product-support-highlights.md), [`preset-driven-listing-surface-contract-v1.md`](../plans/preset-driven-listing-surface-contract-v1.md), [`preset-driven-global-shell-contract-v1.md`](../plans/preset-driven-global-shell-contract-v1.md) и [`preset-driven-catalog-shell-contract-v1.md`](../plans/preset-driven-catalog-shell-contract-v1.md). Но truthful closure `Фазы 6` нужно описывать честно: первоначальный closure verdict был overstated, valid reopen был признан по gap'ам `category browse outside catalogShell`, `related products outside listing surface contract` и `loading/skeleton outside card/listing contract`, затем remediation была закрыта коммитами `adb8df25ed64d9540e36588ee91dc5ff24951009`, `275dc4d823b8203bd1d49364ba4d02211bf42799` и `97a4837c483b054d25511f216ee487bf150306b4`, и только после этого post-remediation cross-preset regression/readiness checkpoint по preset matrix `atelier|market` завершился **PASS**. Поэтому `Phase 6 storefront customization` теперь truthfully зафиксирована как закрытая, remaining Store API warnings during static params generation считаются non-blocking baseline, а readiness verdict читается как `готово к следующему roadmap stage`; после неё уже truthfully закрыт и `Phase 7 / tranche 1` `client-init contract and placeholder-safe template baseline` коммитом `a96aa81adfd655ddda9b6fea03dacf61c3174737` `feat(template): add client-init contract baseline`, а blocking inconsistency по `MEDUSA_BACKEND_URL`, `NEXT_PUBLIC_BASE_URL` и `NEXT_PUBLIC_DEFAULT_REGION` закрыта truthful remediation к optional runtime semantics с повторным review verdict **APPROVE**. Следующий logical step roadmap теперь читается уже как materialized `Phase 7 / tranche 2` packaging slice в [`Docs/template_release_handoff.md`](./template_release_handoff.md), где canonical checklist/onboarding/clean package contour описаны без overclaim'а про release automation; только после этого roadmap идёт дальше к **Фазе 8** release-grade checks, CI, staging и production readiness.

Простыми словами:
мы уже вышли из стадии `сначала просто уберем demo-baseline`, из стадии `надо решить первый slice Фазы 3`, из стадии `надо закрыть notification hardening`, из стадии `нужно выбрать shipping provider только на бумаге`, из стадии `bootstrap idempotency hardening ещё не закрыт`, а также из стадии `storefront core ещё текущий workstream`, `VK ID ещё не реализован`, `MTS Exolve ещё не реализован` и `client-init tranche 1 ещё активен`. Теперь текущая operational реальность — держать tranche 1 закрытым как source-of-truth contract baseline, держать tranche 2 materialized как canonical packaging narrative и не переоткрывать narrative про storefront cleanup или уже закрытый init-baseline.
