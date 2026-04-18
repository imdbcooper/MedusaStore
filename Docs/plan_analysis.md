# Анализ плана репозитория-шаблона

> Где смотреть текущий операционный статус:
> [current_work.md](./current_work.md)
>
> Назначение этого файла:
> это аудит и разбор реального состояния проекта, а не ежедневный журнал `что делаем прямо сейчас`.

## Краткий вывод

Канонический план по направлению остается правильным.

После подтвержденных проверок проект уже закрыл два критических ранних этапа:
- воспроизводимый clean local onboarding;
- template-ready backend baseline вместо demo-oriented bootstrap.

Простыми словами:
репозиторий уже не находится в статусе `поднимается только как демо-заготовка`, notification slice как первый integration slice Фазы 3 уже подтвержден, notification hardening v1 тоже закрыт и проверен, payment path v1 по YooKassa ранее подтвержден end-to-end для текущего scope, shipping track v1 подтвержден в рамках текущего slice: ApiShip `cheapest_only_v1` прошёл runtime validation `2026-04-18`, provider активирован, route path подтверждён, rates из ApiShip/Yandex возвращаются. Теперь закрыт и **checkout end-to-end validation v1**: подтвержден полный flow `shipping → hosted YooKassa payment → automatic return → review → order placement → confirmed order page`. Ложный blocker вокруг `payment_collection` снят, targeted fix в [`payment-button/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/checkout/components/payment-button/index.tsx) убрал преждевременный вызов `placeOrder()`, а targeted fix в [`cookies.ts`](../medusa-agency-boilerplate-storefront/src/lib/data/cookies.ts) перевёл cart cookie на `sameSite: "lax"` для корректного cross-site return. Bootstrap idempotency hardening v1 **подтвержден runtime validation** `2026-04-17`: clean DB, dirty DB idempotent rerun и dirty DB conflict injection — все три сценария прошли. Template-readiness regression-pack уже формализован и больше не является следующим шагом. `order lifecycle notifications v1` и `order shipped notification v1` уже реализованы, а shipped validation закрыта. Следующим рекомендуемым workstream становится **implementation `payment failed notification v1`**. Параллельно на уровне roadmap уже зафиксирован будущий communication stack: `UniSender` для email, `VK Community Messaging` + optional `VK ID` для VK, `MTS Exolve` для SMS и отдельный internal marketing layer без `Sendsay`.

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
- **shipping track v1 подтвержден для текущего scope**: в репо реализован и runtime-проверкой подтверждён backend-first **ApiShip-first rate-selection slice `cheapest_only_v1`**; provider активирован, route path подтверждён, rates из ApiShip/Yandex возвращаются, а прежний blocker закрыт targeted code fixes.

Отдельные notes после notification, payment и первого shipping slice:
- повторный `npm run bootstrap` поверх уже заполненной БД подтвержден runtime validation как idempotent и больше не является неидемпотентным сценарием;
- этот результат не отменяет подтверждение clean onboarding path и не возвращает Фазы 1-2 в статус open;
- auth-barrier для локального notification smoke закрыт через opt-in helper для on-demand secret admin API key, без расширения baseline и без перевода этого helper в обязательную часть clean onboarding;
- notification hardening v1 дополнительно подтвердил:
  - baseline-safe режим без внешних notification secrets;
  - `NOTIFICATION_EMAIL_PROVIDER=local` как baseline-default;
  - корректный fallback `sendgrid` → `local` при отсутствии `SENDGRID_API_KEY` без поломки startup, build и runtime;
  - рабочий authenticated smoke path через fresh secret admin API key и Basic auth;
  - стабильную форму ответа `POST /admin/notifications/smoke` с блоками `ok`, `request`, `auth`, `provider`, `notification`;
  - согласованный contract между workflow и runtime helper по `requested provider` и `resolved provider`;
  - helper [`createSecretAdminApiKey()`](../medusa-agency-boilerplate/src/scripts/create-secret-admin-api-key.ts:22), который создает свежий `sk_*` key и не полагается на reuse старого считанного token;
- verification pass после первого ApiShip slice подтвердил, что baseline and no-secret startup path не сломан, notification runtime не показал подтвержденной регрессии, а env-contract остался opt-in и baseline-safe;
- storefront `500` на checkout отделен от shipping slice и снят как ложный blocker: проблема оказалась runtime and data-state случаем отсутствующего или невалидного cart, а при валидном cart checkout route отвечает `200`;
- targeted code fixes в [`route.ts`](../medusa-agency-boilerplate/src/api/store/apiship/rates/route.ts) и [`seed.ts`](../medusa-agency-boilerplate/src/scripts/seed.ts) закрыли реальный blocker по ApiShip;
- production token был предоставлен, provider активирован через [`medusa-config.ts`](../medusa-agency-boilerplate/medusa-config.ts), подтверждён runtime path [`GET /store/apiship/rates`](../medusa-agency-boilerplate/src/api/store/apiship/rates/route.ts), а rates из ApiShip/Yandex начали возвращаться;
- blocker больше не считается pending или deferred для текущего шага;

---

## Главный вердикт

Сейчас репозиторий уже выглядит как осмысленная стартовая база будущего master template, а не как просто слегка подправленный Medusa demo bootstrap.

Простыми словами:
фундамент и template-ready backend baseline уже подтверждены, notification path v1 подтвержден и дополнительно доведен до закрытого notification hardening v1, payment path v1 уже подтвержден для текущего YooKassa-first scope, shipping path v1 уже подтвержден как работающий ApiShip-first rate-selection slice `cheapest_only_v1`, а checkout path теперь тоже подтвержден сквозным runtime/E2E pass до confirmed order page. Bootstrap idempotency hardening v1 подтвержден runtime validation и больше не является открытым concern. Так как shipping + payment + checkout proof points уже закрыты, реальная готовность шаблона теперь определяется следующим workstream по sequencing: первым post-order customer-facing path на основе уже существующего notification baseline.

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

**Вердикт:** для локального цикла подтвержден, как production-ready контур еще не завершен.

Что есть:
- есть [docker-compose.yml](../docker-compose.yml);
- поднимаются PostgreSQL, Redis и backend;
- root orchestration, preflight и clean onboarding подтверждены;
- локальный короткий путь старта воспроизводим.

Что еще ограничивает этап:
- storefront по-прежнему не является частью docker compose-контура;
- staging and prod-ready упаковки нет.

Простыми словами:
локальная инженерная сборка уже работает предсказуемо, включая повторный bootstrap на заполненной БД, но это еще не полный операционный контур для релизной эксплуатации.

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

**Вердикт:** ключевые integration slices подтверждены для текущего scope; notifications закрыты как первый slice и доведены до notification hardening v1, payments подтверждены для текущего YooKassa-first scope, shipping подтвержден как работающий ApiShip-first slice `cheapest_only_v1`, а checkout end-to-end validation v1 теперь тоже закрыт. `order.placed` и `shipment.created` customer-facing slices уже реализованы. Следующий шаг по sequencing — не новый выбор payment/shipping направления и не новый lifecycle event, а targeted validation только что завершённого shipped contract.

Что уже подтверждено:
- notifications были выбраны первым vertical slice Фазы 3;
- notification v1 реализован в минимальном backend-only контуре:
  - Notification Module;
  - local provider для dev;
  - текущий SendGrid path для production как transitional bridge;
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
  - fallback `sendgrid` → `local` при отсутствии `SENDGRID_API_KEY` без поломки startup, build и runtime;
  - authenticated smoke path через secret admin API key и Basic auth;
  - helper [`createSecretAdminApiKey()`](../medusa-agency-boilerplate/src/scripts/create-secret-admin-api-key.ts:22), который создает свежий `sk_*` key для канонического smoke path и не полагается на reuse старого token;
  - route [`POST()`](../medusa-agency-boilerplate/src/api/admin/notifications/smoke/route.ts:26) со стабильной формой ответа `ok`, `request`, `auth`, `provider`, `notification`;
  - согласование workflow [`sendNotificationSmokeWorkflow`](../medusa-agency-boilerplate/src/workflows/send-notification-smoke.ts:60) и runtime helper [`getNotificationEmailRuntime()`](../medusa-agency-boilerplate/src/modules/notification-email.ts:45) по `requested provider` и `resolved provider`;
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
- shipping track v1 реализован как backend-first ApiShip rate-selection slice:
  - opt-in provider registration в [medusa-config.ts](../medusa-agency-boilerplate/medusa-config.ts);
  - fulfillment provider в [src/modules/apiship.ts](../medusa-agency-boilerplate/src/modules/apiship.ts);
  - store route для rate lookup в [src/api/store/apiship/rates/route.ts](../medusa-agency-boilerplate/src/api/store/apiship/rates/route.ts);
  - seed-path для shipping option в [src/scripts/seed.ts](../medusa-agency-boilerplate/src/scripts/seed.ts);
  - storefront data layer в [src/lib/data/apiship.ts](../medusa-agency-boilerplate-storefront/src/lib/data/apiship.ts) и [src/lib/data/cart.ts](../medusa-agency-boilerplate-storefront/src/lib/data/cart.ts);
  - checkout shipping selection в [src/modules/checkout/components/shipping/index.tsx](../medusa-agency-boilerplate-storefront/src/modules/checkout/components/shipping/index.tsx);
  - safe-by-default `APISHIP_TEST_MODE`: пустое или невалидное значение теперь оставляет provider в test-mode, а silent live-default убран;
  - root orchestration тоже выровнен под этот contract: [scripts/env-sync.sh](../scripts/env-sync.sh) больше не пишет `APISHIP_TEST_MODE=false` по отсутствующей root-переменной, а синхронизирует безопасный default `true`;
  - локальный backend runtime env на этой машине приведен к той же политике, чтобы не оставалось residual live-default state;
  - route quotes сохраняют legacy ETA mapping и добавляют fallback на `workDays*` / `calendarDays*`;
  - request error handling в [src/modules/apiship.ts](../medusa-agency-boilerplate/src/modules/apiship.ts) теперь извлекает structured error body и держит diagnosability по status/code/message/description без утечки секрета;
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
  - `APISHIP_TOKEN`;
  - `APISHIP_TEST_MODE`;
  - `NOTIFICATION_EMAIL_PROVIDER`;
  - `NOTIFICATION_EMAIL_FROM`;
  - `SENDGRID_API_KEY`.
- verification pass после первого ApiShip slice подтвердил:
  - `npm run bootstrap`, `npm run preflight` и `npm run dev` продолжают работать без обязательных payment secrets, без обязательного `APISHIP_TOKEN` и без обязательных notification secrets;
  - canonical root orchestration больше не теряет YooKassa hardening keys: `scripts/env-sync.sh` синхронизирует `YOOKASSA_STOREFRONT_RETURN_ORIGINS`, optional `YOOKASSA_WEBHOOK_URL` и safe default `YOOKASSA_ALLOW_UNSIGNED_WEBHOOKS=false` в backend env;
  - `NOTIFICATION_EMAIL_PROVIDER=local` остается безопасным baseline-default;
  - `sendgrid` без `SENDGRID_API_KEY` корректно не поднимается как обязательный provider и падает обратно на `local`;
  - ApiShip provider реально включается только при наличии токена;
  - shipping option `ApiShip Courier to Address` появляется после повторного seed в ApiShip-enabled окружении;
  - storefront `500` на checkout не является подтвержденной code regression и при валидном cart route отвечает `200`;
  - payload mapping, endpoint usage и live and test режим по текущей реализации выглядят корректно;
  - env-contract для clean onboarding остался opt-in и baseline-safe.

Что при этом пока не реализовано, хотя уже выбрано на уровне плана:
- migration email runtime с текущего SendGrid bridge на `UniSender`;
- `VK Community Messaging` как transport для service и marketing сообщений;
- `VK ID` как optional auth/identity linking flow;
- `MTS Exolve` как SMS transport;
- отдельный internal marketing layer с orchestration, consent, segmentation и delivery journal;
- разделение ролей `Payload = content`, `admin = operations`, `marketing layer = orchestration` в работающем runtime.

Что требуется дальше по факту:
- не переписывать код без нового evidence о code bug;
- удерживать как source of truth, что notification hardening v1 уже закрыт, `order lifecycle notifications hardening v1.1` уже реализован, bootstrap idempotency hardening v1 **подтвержден runtime validation**, ApiShip `cheapest_only_v1` подтверждён runtime-проверкой, checkout end-to-end validation v1 закрыт, `order lifecycle notifications v1` уже реализован, shipped slice уже реализован и его targeted validation уже закрыта harness-ом [send-order-shipped-notification.unit.spec.ts](../medusa-agency-boilerplate/src/workflows/__tests__/send-order-shipped-notification.unit.spec.ts);
- считать текущий planning-шаг закрытым только после фиксации blueprint для **`payment failed notification v1`** в source-of-truth docs;
- удерживать provider decisions по `UniSender`, `VK`, `VK ID` и `MTS Exolve` как уже принятые архитектурные решения, а не как открытую развилку;
- для этого blueprint удерживать sequencing `placed → shipped → payment failed → order canceled`, а не возвращать shipped validation в статус open;
- source-of-truth trigger boundary для failed-payment slice реализована без предположения про `order.payment_failed`: текущий runtime опирается на [handleYooKassaWebhook()](../medusa-agency-boilerplate/src/api/yookassa/webhook/shared.ts:15), [mapYooKassaWebhookAction()](../medusa-agency-boilerplate/src/api/yookassa/webhook/shared.ts:150) и [mapYooKassaStatusToSessionStatus()](../medusa-agency-boilerplate/src/modules/yookassa.ts:403), а после `process-payment-workflow` webhook path публикует внутренний event `payment_session.failed.customer.notification_requested` только для terminal failed `canceled` path;
- canonical dedupe boundary для failed-payment slice реализована на attempt-level: `resource_type=payment_session` и `resource_id=payment_session.id`, а не `order.id`;
- anti-duplicate operational contract hardening v1.1 переиспользован и для failed-payment slice: dedupe authority = existing notification storage, strategy = query-before-create, canonical match set = `trigger_type + resource_type + resource_id + channel + template + normalized recipient`, duplicate path = controlled skip с diagnostics, race window = accepted limitation;
- удерживать как отдельный baseline/regression anchor [send-notification-smoke.ts](../medusa-agency-boilerplate/src/workflows/send-notification-smoke.ts) и [route.ts](../medusa-agency-boilerplate/src/api/admin/notifications/smoke/route.ts), а не смешивать их с order lifecycle runtime path;
- validation expectation закрыта targeted harness-ом: подтверждены single send для terminal failed attempt, missing recipient skip, non-terminal non-send, duplicate reprocessing того же `payment_session.id` и отсутствие ложного dedupe между двумя разными failed attempts одного cart;
- после failed-payment slice следующим lifecycle expansion считать `order canceled notification v1`, а не запускать несколько равноправных post-order веток сразу;
- добавлять helper artifacts только там, где они реально уменьшают ручной шум и не подменяют route contract новым pseudo-framework;
- не подменять cheapest-only semantics заявлением, будто в checkout уже есть полноценный multi-quote UX;
- не подменять поэтапную интеграцию заявлением, будто вся Фаза 3 или весь order lifecycle уже закрыты.
- не подменять отдельный internal marketing layer внешним marketing hub, потому что это решение уже отвергнуто на уровне roadmap.

Что пока не подтверждено:
- production-ready commerce контур как полностью завершенный end-to-end + post-order lifecycle;
- `payment failed` и `order canceled` как закрытые notification flows;
- выбранная и провалидированная Medusa-side trigger boundary для `payment failed notification v1`;
- новый communication stack `UniSender + VK + Exolve` как реализованный и провалидированный runtime-контур;
- отдельный internal marketing layer как реализованный operational контур;
- полноценный multi-quote checkout UX для shipping;
- `providerConnectId` / `extraParams` support без отдельного бизнес-решения;
- полный общий интеграционный слой для всех направлений Фазы 3.

Что теперь подтверждено дополнительно:
- идемпотентный повторный `npm run bootstrap` поверх уже заполненной БД как закрытый hardening result (runtime validation `2026-04-17`);
- template-readiness regression-pack теперь должен быть централизован в [template_readiness_regression.md](./template_readiness_regression.md), а не размазан по устным договоренностям;
- для канонического authenticated notification smoke допустим один lightweight helper path через root command `npm run smoke:notification`.

Простыми словами:
вопрос `какой notification path берем` уже закрыт для первой версии и доведен до hardening v1, вопрос `какой payment path берем` уже получил и подтвердил практический ответ в виде YooKassa-first path, вопрос `какой shipping path берем` тоже получил практический ответ в виде ApiShip-first rate-selection slice, а checkout path уже подтвержден до confirmed order page. Bootstrap idempotency hardening v1 подтвержден runtime validation. Следующий шаг — не новый checkout pass, не повторное обсуждение провайдеров и не новый post-order event, а targeted validation уже реализованного shipped path `shipment.created`.

### Важный policy-risk, который уже проявился

Проблема:
если не зафиксировать market scope достаточно жестко, агент может предложить `Stripe` или другой удобный official-first провайдер просто потому, что он лучше описан в Medusa docs.

Что это значит технически:
- `official pattern` и `target provider for this repository` — не одно и то же;
- для этого master repo пригодность к типовому магазину в РФ должна быть первичным фильтром;
- YooKassa уже является подтвержденным payment v1 direction, а shipping direction уже начат и должен читаться как ApiShip-first, если пользователь явно не сменил рынок.

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

### 4. Нельзя держать закрытый ApiShip blocker в статусе pending

Проблема:
ApiShip blocker больше не является внешним account-state ожиданием для текущего slice. Production token был предоставлен, targeted fixes в route/data path внесены, route подтверждён runtime-проверкой, а rates начали возвращаться. Если продолжать описывать его как pending blocker, документация снова начнет искажать реальный sequencing.

Простыми словами:
к ApiShip не нужно возвращаться как к незакрытому blocker'у для `cheapest_only_v1`; этот шаг уже отработан и больше не должен отвлекать от post-checkout sequencing.

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
по notifications путь v1 уже подтвержден и доведен до hardening v1, по payments YooKassa-first path подтвержден для текущего scope, по shipping выбранный и реализованный ApiShip-first rate-selection slice подтверждён runtime-проверкой, а checkout chain уже подтверждена до confirmed order page. Поверх этого order creation уже реализован первый production-like customer-facing path: subscriber [`orderPlacedNotificationHandler()`](../medusa-agency-boilerplate/src/subscribers/order-placed-notification.ts:5) слушает `order.placed`, workflow [`sendOrderPlacedNotificationWorkflow`](../medusa-agency-boilerplate/src/workflows/send-order-placed-notification.ts:147) делает query по минимальной форме `{ id, display_id, email }`, а Notification Module отправляет notification с template `order-placed-v1` и trigger type `order.placed.customer.notification_requested`.

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

### 5. Нет productized storefront, marketing layer и release-контура

Что это значит технически:
storefront все еще требует отдельной productization-фазы, marketing orchestration layer еще не собран, а шаблон не упакован в staging and prod-ready процесс тиражирования.

Простыми словами:
ядро стало честнее, но витрина, маркетинговая машина и выпуск нового клиентского проекта пока не превращены в конвейер.

### 6. Content layer для marketing pages и news еще не реализован

Что это значит технически:
Payload CMS уже имеет смысл как отдельный headless content service, но сам контур `payload-cms + storefront block renderer + publish and revalidate flow` пока еще не собран.

Простыми словами:
идея для маркетинговых страниц уже понятна, но сам редакторский слой пока еще не стал частью рабочей платформы.

---

## Как теперь читать канонический план

Текущая честная последовательность такая:
1. Фаза 1 — подтверждена;
2. Фаза 2 — подтверждена;
3. Фаза 3 — integration slices подтверждены: notification hardening v1 закрыт, payment v1 подтвержден как YooKassa-first path, shipping v1 подтвержден как ApiShip-first rate-selection slice `cheapest_only_v1`, checkout end-to-end validation v1 закрыт;
4. bootstrap idempotency hardening v1 — **подтвержден runtime validation** `2026-04-17` и закрыт как template-readiness track;
5. template-readiness regression formalization v1 — зафиксирован и больше не является pending следующим шагом;
6. order lifecycle notifications v1 и `order shipped notification v1` — уже реализованы как первые customer-facing post-order slices поверх подтверждённого checkout path, а shipped validation закрыта;
7. следующий внутренний шаг — **implementation `payment failed notification v1`**, а не повторное проектирование notification/payment/shipping выбора и не возврат к уже закрытому shipped validation;
8. после закрытия failed-payment slice следующим implementation expansion становится **`order canceled notification v1`** как следующий узкий lifecycle slice;
9. после ближайших lifecycle slices на уровне roadmap уже зафиксирован communication stack: `UniSender` для email, `VK Community Messaging` + optional `VK ID` для VK и `MTS Exolve` для SMS, а marketing orchestration должен идти отдельным слоем без `Sendsay`;
10. Фаза 4 читается как следующий крупный слой интеграционного контура уже после ближайшего post-order sequencing, а не как повод заново спорить о payment/shipping выборе;
11. Фазы 5-5.5 — пока не начинать как основные, пока не подтверждены ближайшие post-order tracks Фазы 4.

Простыми словами:
план больше не нужно корректировать так, будто стабилизация и baseline еще не сделаны, будто Фаза 3 еще только начинается, будто notification hardening все еще открыт, будто payment track существует только как решение на бумаге, будто shipping остается на чистом decision stage, будто ApiShip blocker еще pending, будто checkout E2E ещё не закрыт, будто `order.placed` slice ещё только планируется, или будто bootstrap idempotency остается незакрытым hardening concern. Теперь нужно использовать уже реализованный order placement path как опору для validation первого post-order notification slice и только потом двигаться дальше по более широким storefront и release-направлениям.

---

## Что со skills для агента

### Что видно сейчас

В проекте уже есть локальный skill: [.codex/skills/medusa-master-repo/SKILL.md](../.codex/skills/medusa-master-repo/SKILL.md).

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
- shipping track v1 уже реализован как ApiShip-first opt-in / baseline-safe rate-selection slice;
- checkout end-to-end validation v1 закрыт, включая hosted YooKassa return и confirmed order page;
- targeted fixes в [`payment-button/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/checkout/components/payment-button/index.tsx) и [`cookies.ts`](../medusa-agency-boilerplate-storefront/src/lib/data/cookies.ts) являются частью честного source of truth по закрытию checkout path;
- storefront `500` по checkout отделен как cart and data-state issue и не должен возвращаться как подтвержденная shipping code bug;
- order lifecycle notifications v1 и `order shipped notification v1` уже реализованы на path `subscriber → workflow → Notification Module` с canonical recipient = `order.email`, а shipped path использует `shipment.created` и resource boundary = `fulfillment.id`;
- shipped validation уже закрыта через [send-order-shipped-notification.unit.spec.ts](../medusa-agency-boilerplate/src/workflows/__tests__/send-order-shipped-notification.unit.spec.ts);
- следующий внутренний шаг по умолчанию — это **implementation `payment failed notification v1`**, а следующий implementation step после него — **`order canceled notification v1`**;
- provider decisions по `UniSender`, `VK Community Messaging`, optional `VK ID` и `MTS Exolve` уже зафиксированы в плане как approved future stack;
- marketing layer должен оставаться отдельным internal слоем, а `Payload` и `admin` должны играть разные роли: content и operations соответственно;
- bootstrap idempotency hardening v1 подтвержден runtime validation и больше не является открытым hardening concern;
- решения для не-РФ рынка не должны предлагаться как default path только потому, что они official или first-party;
- Payload уже запланирован в дорожной карте как Фаза 5.5, но не должен подменять текущий integration track раньше времени.

Простыми словами:
skill должен вести агента к реальному следующему шагу, а не возвращать его в уже закрытую фазу.

---

## Итог

План хороший как реальная дорожная карта и теперь лучше совпадает с фактически подтвержденным состоянием репозитория.

Самая честная формулировка на сегодня такая:

> У нас уже есть подтвержденный clean onboarding, подтвержденный template-ready backend baseline без demo-oriented bootstrap, закрытый notification hardening v1 с baseline-safe fallback и authenticated smoke, подтвержденный payment v1 как YooKassa-first path для текущего scope, подтвержденный ApiShip-first shipping slice `cheapest_only_v1`, подтвержденный checkout runtime/E2E path и уже реализованные post-order slices `order.placed` и `shipment.created`. Следующий реальный шаг — implementation `payment failed notification v1`, а затем `order canceled notification v1`; после этих узких lifecycle slices roadmap уже зафиксировал будущий communication stack `UniSender + VK Community Messaging + optional VK ID + MTS Exolve`, отдельный internal marketing layer, затем storefront core, Payload content layer, клиентскую кастомизацию и release-упаковку.

Простыми словами:
мы уже вышли из стадии `сначала просто уберем demo-baseline`, из стадии `надо решить первый slice Фазы 3`, из стадии `надо закрыть notification hardening`, из стадии `нужно выбрать shipping provider только на бумаге` и из стадии `bootstrap idempotency hardening ещё не закрыт`. Теперь нужно определить следующий workstream и отдельно ждать внешнего unblock по ApiShip для повторной shipping validation.
