# Current Work

> Статус документа: текущий операционный фокус проекта по состоянию на `2026-04-18`
>
> Назначение: дать агенту с пустым контекстом быстрый и однозначный ответ на три вопроса:
>
> 1. что делаем прямо сейчас;
> 2. где именно в репозитории идет работа;
> 3. что еще рано начинать.

---

## 1. Роль документа

Этот файл является **каноническим оперативным статусом проекта**.

Именно здесь должно быть явно написано:

- какая фаза активна сейчас;
- что является текущей задачей разработки;
- какие файлы и директории являются рабочей поверхностью;
- в каком порядке агент должен продолжать работу.

Если этот документ расходится с кодом, важнее код и проверенное состояние репозитория. После проверки этот документ нужно обновить.

---

## 2. Что делаем сейчас

### Активная фаза

**Фаза 2** из [master_repo_plan_v2.md](./master_repo_plan_v2.md) завершена и подтверждена проверками.

Текущий operational context по-прежнему находится в **Фазе 3: архитектура интеграций и техническая верификация провайдеров**, но ее notification-ветка больше не является открытым workstream.

Первые интеграционные шаги Фазы 3 уже зафиксированы в репозитории:

- **notification slice v1** реализован и подтвержден как первый integration slice;
- **notification hardening v1** теперь тоже реализован и проверен как закрытый delivery result для notification-track;
- **order lifecycle notifications hardening v1.1** реализован поверх `order lifecycle notifications v1` как source-of-truth update для первого production-like customer-facing notification slice: trigger = `order.placed`, path = `subscriber → workflow → Notification Module`, canonical recipient в runtime по-прежнему = `order.email`, а anti-duplicate contract теперь опирается на existing notification storage, query-before-create dedupe и controlled skip с diagnostics при duplicate match;
- **payment track v1** реализован как **YooKassa-first** путь и ранее подтвержден end-to-end для текущего payment scope;
- **shipping track v1** реализован как backend-first **ApiShip** slice; **`cheapest_only_v1` подтверждён runtime-проверкой `2026-04-18`**: production token получен, provider активирован, route path [`GET /store/apiship/rates`](../medusa-agency-boilerplate/src/api/store/apiship/rates/route.ts) подтверждён, rates из ApiShip/Yandex возвращаются; blocker по ApiShip **закрыт targeted code fixes** в route и seed, а не ожиданием account-state;
- **checkout end-to-end validation v1** закрыт: подтвержден полный flow `shipping → hosted YooKassa payment → automatic return → review → order placement → confirmed order page`; ложный blocker вокруг `payment_collection` снят; targeted fix в [`payment-button/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/checkout/components/payment-button/index.tsx) больше не допускает вызов `placeOrder()` до hosted authorization, а targeted fix в [`cookies.ts`](../medusa-agency-boilerplate-storefront/src/lib/data/cookies.ts) меняет policy для cart cookie c `sameSite: "strict"` на `sameSite: "lax"` для корректного cross-site return.

Payload CMS как будущий content layer уже считается **зафиксированным архитектурным направлением**, но его реализация по плану начинается только после storefront core, а не в текущем integration track.
В каноническом плане это отдельный трек **Фаза 5.5**, а не расплывчатая идея на потом.

Отдельная обязательная рамка текущего sequencing:

- этот master repo по умолчанию делается для **российского рынка**;
- для payments текущий v1 path остается **YooKassa-first**;
- для shipping следующий целевой track по умолчанию — **ApiShip-first**;
- решения, не подходящие для типового магазина в РФ, нельзя выбирать как default path только потому, что они лучше документированы в экосистеме Medusa.

### Текущий статус

Подтвержден честный clean-state сценарий:

1. `cp .env.example .env`
2. `npm run bootstrap`
3. `npm run preflight`
4. `npm run dev`

После этого подтвержден template-ready backend baseline:

- `ru` region;
- `rub` как baseline currency;
- publishable API key;
- default sales channel;
- минимальный shipping skeleton;
- отсутствие обязательного demo-catalog baseline.

Дополнительно подтвержден storefront fix:

- edge-case с redirect-loop в `medusa-agency-boilerplate-storefront/src/middleware.ts` исправлен;
- повторная проверка подтвердила, что loop больше не воспроизводится;
- нормальная семантика middleware сохранена.

Дополнительно подтвержден закрытый результат **notification hardening v1**:

- baseline-safe режим без внешних notification secrets подтвержден;
- `NOTIFICATION_EMAIL_PROVIDER=local` остается baseline-default;
- `sendgrid` без `SENDGRID_API_KEY` не ломает startup, build и runtime и корректно падает обратно на local provider;
- authenticated smoke path реально работает через secret admin API key и Basic auth;
- helper `createSecretAdminApiKey()` теперь обязан создавать свежий `sk_*` key для канонического smoke path и не полагается на reuse старого считанного token;
- route `POST /admin/notifications/smoke` возвращает стабильную форму ответа с блоками `ok`, `request`, `auth`, `provider`, `notification`;
- workflow и runtime helper согласованы по `requested provider` и `resolved provider`;
- документация и skill не должны содержать реальные ключи, токены и секреты.

Это значит:

- **Gate A закрыт для clean local onboarding**;
- **Фаза 1 подтверждена как baseline локального старта**;
- **Фаза 2 подтверждена полностью, без оговорок**;
- **notification track Фазы 3 закрыт на уровне hardening v1**;
- **payment track v1 подтвержден для текущего YooKassa-first scope** и не является активным кодовым blocker;
- **shipping slice `cheapest_only_v1` подтверждён runtime-проверкой** `2026-04-18`: production token получен и активирован, provider включён через [`medusa-config.ts`](../medusa-agency-boilerplate/medusa-config.ts), route [`GET /store/apiship/rates`](../medusa-agency-boilerplate/src/api/store/apiship/rates/route.ts) подтверждён, rates из ApiShip/Yandex начали возвращаться;
- blocker по ApiShip **закрыт**: проблема оказалась не в account-state, а была устранена targeted code fixes в [`route.ts`](../medusa-agency-boilerplate/src/api/store/apiship/rates/route.ts) и [`seed.ts`](../medusa-agency-boilerplate/src/scripts/seed.ts);
- для подтверждённого runtime path использовался production token с `APISHIP_TEST_MODE=false`;
- storefront `500` на checkout отделен от shipping slice и снят как ложный blocker: при валидном cart checkout route отвечает `200`;
- **checkout end-to-end validation v1 подтвержден runtime/E2E pass**: полный flow `shipping → hosted YooKassa payment → automatic return → review → order placement → confirmed order page` реально пройден;
- targeted storefront fixes для этого pass зафиксированы в [`payment-button/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/checkout/components/payment-button/index.tsx) и [`cookies.ts`](../medusa-agency-boilerplate-storefront/src/lib/data/cookies.ts): YooKassa больше не инициирует преждевременный `placeOrder()`, а cart cookie сохраняется с `sameSite: "lax"` для cross-site return;
- **bootstrap idempotency hardening v1 подтвержден runtime validation**: clean DB, dirty DB idempotent rerun и dirty DB conflict injection — все три сценария прошли;
- стартовал независимый storefront track **storefront core baseline v1**: ключевой starter/demo branding убран с shared entrypoints, добавлен минимальный [`storefrontConfig`](../medusa-agency-boilerplate-storefront/src/lib/storefront-config.ts), а checkout/review copy оставлен совместимым с текущими YooKassa-first, подтверждённым ApiShip `cheapest_only_v1` и уже закрытым checkout E2E путями без новых обязательных env-переменных;
- повторный `npm run bootstrap` поверх уже заполненной БД теперь является подтвержденным idempotent path: seed reuse-or-fail семантика корректно работает, publishable key стабильно извлекается, дубликаты не создаются;
- при конфликтном состоянии базы (несколько publishable keys без baseline title match) bootstrap корректно завершается с exit code 1 и не обновляет storefront env.

### Уже закреплено и остается опорой

Подтверждено кодом и прогоном:

- добавлен корневой orchestration-слой через [package.json](../package.json) и папку [scripts/](../scripts);
- добавлены команды `bootstrap`, `preflight`, `dev`, `backend:build`, `storefront:build`, `smoke:backend`, `permissions:fix`;
- `permissions:fix` чинит `.medusa` и `node_modules/.vite`;
- bootstrap использует application-level seed из [medusa-agency-boilerplate/src/scripts/seed.ts](../medusa-agency-boilerplate/src/scripts/seed.ts), а не SQL dump как канонический путь;
- root `npm run dev` подтвержден в схеме:
  - backend через `docker compose`;
  - storefront локально;
  - root preflight перед стартом;
- env-контракт зафиксирован в [env_contract.md](./env_contract.md);
- добавлен [scripts/env-sync.sh](../scripts/env-sync.sh) для синхронизации backend и storefront env из root `.env`;
- добавлен tracked-шаблон [medusa-agency-boilerplate-storefront/.env.local.example](../medusa-agency-boilerplate-storefront/.env.local.example);
- clean bootstrap теперь поднимает template-ready RU baseline вместо demo-oriented baseline.

- notification slice v1 и notification hardening v1 подтверждены в backend-only контуре:
  - Notification Module;
  - local provider для dev и baseline-default;
  - SendGrid path для production;
  - fallback к local provider при `sendgrid` без `SENDGRID_API_KEY`;
  - provider-agnostic workflow;
  - admin smoke route;
  - authenticated smoke через Basic auth и secret admin API key;
  - opt-in helper для on-demand fresh secret admin API key.
- payment slice v1 реализован как YooKassa-first minimal vertical slice и ранее подтвержден end-to-end для текущего payment scope:
  - provider registration;
  - session initiation;
  - hosted redirect and return path;
  - webhook and status handling;
  - minimal storefront provider-aware adaptation.
- env-contract для payment path расширен opt-in переменными:
  - `YOOKASSA_SHOP_ID`;
  - `YOOKASSA_SECRET_KEY`;
  - `YOOKASSA_RETURN_URL`;
  - `YOOKASSA_STOREFRONT_RETURN_ORIGINS`;
  - `YOOKASSA_WEBHOOK_URL`;
  - `YOOKASSA_WEBHOOK_SECRET`;
  - `YOOKASSA_ALLOW_UNSIGNED_WEBHOOKS`;
  - storefront flag `NEXT_PUBLIC_YOOKASSA_ENABLED`.
- shipping slice v1 реализован как backend-first ApiShip rate-selection slice:
  - opt-in provider registration в [medusa-config.ts](../medusa-agency-boilerplate/medusa-config.ts);
  - fulfillment provider в [src/modules/apiship.ts](../medusa-agency-boilerplate/src/modules/apiship.ts);
  - store route для rate lookup в [src/api/store/apiship/rates/route.ts](../medusa-agency-boilerplate/src/api/store/apiship/rates/route.ts);
  - seed-path для shipping option в [src/scripts/seed.ts](../medusa-agency-boilerplate/src/scripts/seed.ts);
  - storefront data layer в [src/lib/data/apiship.ts](../medusa-agency-boilerplate-storefront/src/lib/data/apiship.ts) и [src/lib/data/cart.ts](../medusa-agency-boilerplate-storefront/src/lib/data/cart.ts);
  - checkout shipping selection в [src/modules/checkout/components/shipping/index.tsx](../medusa-agency-boilerplate-storefront/src/modules/checkout/components/shipping/index.tsx);
  - safe-by-default режим `APISHIP_TEST_MODE`: пустое/невалидное значение теперь оставляет integration в test-mode, а live включается только явным `false`;
  - root orchestration доведен до той же семантики: [scripts/env-sync.sh](../scripts/env-sync.sh) теперь пишет в backend env безопасный default `APISHIP_TEST_MODE=true`, если переменная отсутствует в root `.env`;
  - локальный [medusa-agency-boilerplate/.env](../medusa-agency-boilerplate/.env) выровнен под эту политику и больше не хранит `APISHIP_TEST_MODE=false` как silent live-default;
  - route quotes сохраняют backward-compatible ETA mapping по `daysMin/daysMax` и добавляют fallback на `workDays*` и `calendarDays*`;
  - request error handling теперь сохраняет status/code/message/description и отдельную diagnosability для account-state, billing и config failures без логирования токена;
  - текущая checkout-семантика честно зафиксирована как `cheapest_only_v1`: storefront и backend выбирают один самый дешевый тариф, а не полноценный multi-quote UX.
- подтверждено verification pass, что baseline не сломан:
  - `npm run bootstrap`, `npm run preflight` и `npm run dev` продолжают работать без обязательных payment secrets, без обязательного `APISHIP_TOKEN` и без обязательных внешних notification secrets;
  - notification runtime сохраняет baseline-safe semantics и не требует `SENDGRID_API_KEY` для local default path;
  - ApiShip provider реально включается только при наличии токена;
  - safe-by-default закрыт не только в runtime-коде, но и на orchestration/env-sync уровне: отсутствие `APISHIP_TEST_MODE` в root env после sync больше не ведет backend env в live;
  - shipping option `ApiShip Courier to Address` появляется после повторного seed в ApiShip-enabled окружении;
  - storefront `500` на checkout оказался runtime and data-state проблемой отсутствующего или невалидного cart, а не подтвержденной code regression;
  - payload mapping, endpoint usage и live and test режим по текущей реализации выглядят корректно;
  - расширение env-contract осталось opt-in и baseline-safe.

### Текущая цель

**Текущий подшаг: source-of-truth sync по уже реализованному `order lifecycle notifications v1`.**

**Notification hardening v1**, **order lifecycle notifications hardening v1.1**, **bootstrap idempotency hardening v1**, **YooKassa runtime/E2E**, **ApiShip `cheapest_only_v1`**, **checkout end-to-end validation v1**, **storefront core baseline**, **RU copy baseline**, **post-review cleanup**, **template-readiness regression formalization v1** и **order lifecycle notifications v1** уже подтверждены и не являются активными implementation-треками.

Результат runtime validation, который теперь считается входным инвариантом:

- **clean DB path:** PASS — bootstrap exit 0, все baseline entities создаются, publishable key извлекается и пишется в storefront `.env.local`;
- **dirty DB idempotent rerun:** PASS — bootstrap exit 0, все entities reused, тот же publishable key, нет дубликатов;
- **dirty DB conflict injection:** PASS — bootstrap exit 1, hardening error message, storefront env не обновляется;
- **canonical root workflow:** source of truth остается `bootstrap → preflight → dev`; root scripts описываются как clean-start orchestration, а не как универсальный reuse-any-running-runtime слой;
- **preflight/dev runtime semantics:** [scripts/preflight.sh](../scripts/preflight.sh) допускает reuse только для compose-owned PostgreSQL, Redis и backend там, где это предусмотрено, а уже занятые локальными процессами `9000` и `8000` могут давать ожидаемый fail вне канонического сценария;
- **ApiShip `cheapest_only_v1`:** PASS `2026-04-18` — production token получен, provider активирован, rates из ApiShip/Yandex возвращаются, blocker закрыт targeted code fixes в [`route.ts`](../medusa-agency-boilerplate/src/api/store/apiship/rates/route.ts) и [`seed.ts`](../medusa-agency-boilerplate/src/scripts/seed.ts);
- **checkout end-to-end validation v1:** PASS — подтвержден полный flow `shipping → hosted YooKassa payment → automatic return → review → order placement → confirmed order page`; blocker вокруг `payment_collection` снят, а targeted fixes в [`payment-button/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/checkout/components/payment-button/index.tsx) и [`cookies.ts`](../medusa-agency-boilerplate-storefront/src/lib/data/cookies.ts) закрепили корректный hosted authorization и cross-site return.

Рекомендуемый следующий workstream: **validation для order lifecycle notifications v1** — подтвердить runtime path `order.placed` на уже реализованной цепочке `subscriber → workflow → Notification Module`, отдельно проверить anti-duplicate contract hardening v1.1, сохранить authenticated smoke как отдельный regression anchor и затем зафиксировать validation result отдельным commit. Обоснование в [plan_analysis.md](./plan_analysis.md).

Что это значит для выбора решений:

- не переоткрывать payment track в сторону Stripe или других нецелевых для РФ default-кандидатов;
- не переоткрывать notification-track без нового подтвержденного evidence о регрессии;
- ApiShip `cheapest_only_v1` теперь **подтверждён runtime-проверкой** — calculator возвращает реальные тарифы;
- сохранять distinction между каноническим root clean-start workflow и ad-hoc local debug через прямой [`npx medusa develop`](../medusa-agency-boilerplate/package.json) плюс отдельный storefront runtime;
- не описывать root `preflight` и root `dev` как wrapper для произвольного уже запущенного локального состояния;
- не раздувать текущий шаг в отдельный CI framework или новый большой test harness.

Отдельно зафиксировано на уровне плана:

- Payload CMS будет встроен как отдельный headless content service;
- это произойдет после Фазы 5 как трек `Payload CMS v1 как content layer маркетинговых страниц`;
- до этого момента Payload не является активной фазой реализации;
- агент не должен начинать `payload-cms` app, block renderer и publish and revalidate flow, пока текущий integration track и storefront core не доведены до соответствующих ворот плана.

---

## 3. Где ведется работа прямо сейчас

На текущем этапе основная рабочая поверхность остается здесь:

- [Docs/master_repo_plan_v2.md](./master_repo_plan_v2.md)
- [Docs/current_work.md](./current_work.md)
- [Docs/plan_analysis.md](./plan_analysis.md)
- [Docs/env_contract.md](./env_contract.md)
- [Docs/template_readiness_regression.md](./template_readiness_regression.md)
- [.codex/skills/medusa-master-repo/SKILL.md](../.codex/skills/medusa-master-repo/SKILL.md)
- [package.json](../package.json)
- [scripts/bootstrap.sh](../scripts/bootstrap.sh)
- [scripts/notification-smoke.sh](../scripts/notification-smoke.sh)
- [medusa-agency-boilerplate/src/scripts/create-secret-admin-api-key.ts](../medusa-agency-boilerplate/src/scripts/create-secret-admin-api-key.ts)
- [medusa-agency-boilerplate/src/api/admin/notifications/smoke/route.ts](../medusa-agency-boilerplate/src/api/admin/notifications/smoke/route.ts)
- [medusa-agency-boilerplate/src/api/store/payment/yookassa/route.ts](../medusa-agency-boilerplate/src/api/store/payment/yookassa/route.ts)
- [medusa-agency-boilerplate/src/api/store/payment/yookassa/return/route.ts](../medusa-agency-boilerplate/src/api/store/payment/yookassa/return/route.ts)
- [medusa-agency-boilerplate/src/api/yookassa/webhook/route.ts](../medusa-agency-boilerplate/src/api/yookassa/webhook/route.ts)
- [medusa-agency-boilerplate/src/api/store/apiship/rates/route.ts](../medusa-agency-boilerplate/src/api/store/apiship/rates/route.ts)

Если в рамках следующего шага будут вноситься изменения, то в первую очередь это ожидается в таких местах:

- документы по operational status, sequencing и source of truth;
- один канонический regression-pack с воспроизводимыми командами, expected results и failure signals;
- минимальные helper commands для локальной проверки уже подтвержденных путей;
- env-contract для opt-in notification, payment и shipping переменных без превращения их в baseline requirement;
- кодовые изменения по integration runtime только если они действительно нужны для regression-support, а не для нового product scope.

Payload-related рабочая поверхность пока **не активна**, но позже основной контур сместится в:

- отдельное приложение `payload-cms`;
- storefront block renderer и content-provider boundary;
- content schema docs и publish and revalidate flow.

Для закрытого notification-track канонический source of truth остается в:

- документах по operational status, sequencing и env-contract;
- contract `order.placed` path `subscriber → workflow → Notification Module`, включая anti-duplicate semantics hardening v1.1;
- existing notification storage как dedupe authority для `order.placed`, а не отдельный ledger;
- admin smoke route, workflow и helper для authenticated smoke как отдельном baseline/regression anchor.

Для подтверждённого ApiShip track рабочая поверхность включает:

- документы по shipping status и ограничениям;
- server-side shipping adapter и contracts вокруг **ApiShip-first** сценария;
- storefront checkout shipping selection и cart and runtime validation.

Следующий шаг после закрытия shipping/payment/checkout proof points — **validation order lifecycle notifications v1**: подтвердить уже реализованное первое customer-facing событие `order.placed` на подтверждённом order placement path.

---

## 4. Конкретные задачи текущего этапа

### 4.1. Зафиксировать checkout end-to-end validation v1 как закрытый входной инвариант

Теперь source of truth должен явно удерживать, что checkout path уже подтвержден runtime/E2E:

- `shipping → hosted YooKassa payment → automatic return → review → order placement → confirmed order page` реально пройден;
- blocker вокруг `payment_collection` снят и больше не считается реальным ограничением checkout path;
- targeted fix в [`payment-button/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/checkout/components/payment-button/index.tsx) предотвращает преждевременный `placeOrder()` до hosted authorization;
- targeted fix в [`cookies.ts`](../medusa-agency-boilerplate-storefront/src/lib/data/cookies.ts) меняет cart cookie policy с `sameSite: "strict"` на `sameSite: "lax"`, чтобы cross-site return не терял checkout state.

### 4.2. Следующий implementation workstream — validation order lifecycle notifications v1

Следующий конкретный шаг должен опираться на уже реализованный `order.placed` path, а не снова открывать provider-selection треки:

- подтвердить runtime-цепочку `subscriber → workflow → Notification Module` для первого production-like customer-facing notification slice;
- валидировать минимальный query shape `{ id, display_id, email }` и зафиксированный trigger `order.placed`;
- проверить canonical recipient rule `order.email` без fallback chain и controlled skip при отсутствии email;
- отдельно подтвердить anti-duplicate contract hardening v1.1: dedupe authority = existing notification storage, strategy = query-before-create, canonical match set = `trigger_type + resource_type + resource_id + channel + template + normalized recipient`, duplicate path = controlled skip без второго notification;
- удержать [send-notification-smoke.ts](../medusa-agency-boilerplate/src/workflows/send-notification-smoke.ts) и [route.ts](../medusa-agency-boilerplate/src/api/admin/notifications/smoke/route.ts) как отдельный baseline/regression anchor, а не как часть order lifecycle runtime path.

### 4.3. Удерживать закрытые delivery results как входные инварианты, а не как открытые задачи

Сейчас уже подтверждено и должно читаться именно как входной baseline:

- notifications были первым vertical slice Фазы 3, а notification hardening v1 закрыт;
- payment track v1 подтвержден как YooKassa-first path для текущего scope;
- shipping track v1 реализован как ApiShip-first rate-selection slice с честной semantics `cheapest_only_v1`;
- checkout end-to-end validation v1 закрыт как подтверждённый runtime/E2E path;
- bootstrap idempotency hardening v1 подтвержден runtime validation и не является текущим implementation workstream.

Практический смысл:
текущий этап не переоткрывает эти треки, а начинает первый post-order operational path поверх уже подтвержденного checkout.

### 4.4. Что остается вне scope нового шага

На этом шаге не нужно раздувать следующий workstream в целую новую фазу:

- `payment failed`, `order canceled` и `order.shipped` notifications остаются следующими подшагами, а не частью первого `order.placed` slice;
- refund/cancel path по payment не становится частью этого workstream автоматически;
- полноценный multi-quote checkout UX остается отдельным scope;
- `providerConnectId` / `extraParams` support остается **deferred** до отдельного бизнес-решения.

Практический смысл:

- checkout proof points уже закрыты;
- следующий шаг должен использовать подтвержденный order placement как вход, а не снова спорить о платежном или логистическом направлении.

---

## 5. Что сейчас не делаем

До закрытия remaining tracks не начинаем:

- объявлять всю Фазу 3 или Фазу 4 завершенной только потому, что подтверждены notification slice, notification hardening, payment path, shipping slice, regression-pack и checkout E2E;
- подменять подтвержденный checkout end-to-end pass заявлением, будто уже закрыт весь post-order и order-lifecycle контур;
- возвращать в статус open уже закрытый storefront `500` blocker, если речь идет о ранее подтвержденной проблеме отсутствующего или невалидного cart;
- раскрывать реальный пользовательский token или secret в документах и skill;
- переоткрывать notification hardening как активный workstream без нового подтвержденного evidence о регрессии;
- переоткрывать payment selection в сторону нецелевых для РФ провайдеров только из-за их official and first-party статуса;
- начинать shipping track с произвольного провайдера, минуя ApiShip-first направление, если пользователь явно не сменил рынок проекта;
- реализацию Payload CMS как отдельного content layer раньше storefront core и до завершения integration tracks;
- глубокую русификацию и брендирование storefront;
- систему клиентских тем и секций;
- template release и автоматизацию создания нового клиента;
- staging and prod packaging как будто remaining integration path уже утвержден.

Простыми словами:
checkout path уже закрыт, а текущий шаг — это не новый выбор payment/shipping направления, а первый post-order operational workstream поверх уже подтверждённого order placement.

---

## 6. Подтвержденные ограничения и notes текущего этапа

- clean-state сценарий `cp .env.example .env` → `npm run bootstrap` → `npm run preflight` → `npm run dev` подтвержден и не считается открытым блокером;
- bootstrap baseline теперь подтвержден как RU and template-ready skeleton, а не demo-oriented baseline;
- redirect-loop в storefront middleware закрыт и не считается текущим открытым дефектом;
- notification slice v1, notification hardening v1 и order lifecycle notifications hardening v1.1 подтверждены как закрытый notification result Фазы 3;
- authenticated local smoke path теперь считается каноническим только в схеме `fresh secret admin API key` → `Basic auth` → `POST /admin/notifications/smoke`;
- для этого канонического пути теперь допустим минимальный helper `npm run smoke:notification`, который создает fresh key и вызывает smoke route без ручной сборки Basic auth;
- payment track v1 подтвержден для текущего YooKassa-first scope и не считается активным blocker;
- первый shipping slice реализован как ApiShip-first opt-in and baseline-safe rate-selection slice;
- env-contract для payment path расширен opt-in переменными `YOOKASSA_SHOP_ID`, `YOOKASSA_SECRET_KEY`, `YOOKASSA_RETURN_URL`, `YOOKASSA_STOREFRONT_RETURN_ORIGINS`, `YOOKASSA_WEBHOOK_URL`, `YOOKASSA_WEBHOOK_SECRET`, `YOOKASSA_ALLOW_UNSIGNED_WEBHOOKS` и storefront flag `NEXT_PUBLIC_YOOKASSA_ENABLED`;
- canonical root orchestration теперь явно синхронизирует YooKassa guardrails `YOOKASSA_STOREFRONT_RETURN_ORIGINS`, `YOOKASSA_WEBHOOK_URL` и `YOOKASSA_ALLOW_UNSIGNED_WEBHOOKS` из root `.env` в backend `.env`, поэтому путь `cp .env.example .env` → `npm run bootstrap` действительно переносит новый hardening contract в runtime;
- env-contract для shipping path теперь явно отражает safe-by-default semantics: `APISHIP_TOKEN` остается opt-in, а `APISHIP_TEST_MODE=true` закреплен как шаблонный default; live допускается только при явном `false`;
- verification pass подтвердил, что baseline and no-secret startup path не сломан, notification runtime сохраняет fallback semantics, ApiShip provider включается только opt-in, а env-contract остался baseline-safe;
- cheapest-only semantics теперь честно зафиксирована в коде и docs как текущий v1 scope, а не как полноценный multi-quote checkout;
- storefront `500` на checkout снят как ложный blocker для текущего shipping slice: проблема была в отсутствии или невалидности cart, а при валидном cart route отвечает `200`;
- для template readiness теперь должен существовать один канонический regression-pack/source-of-truth с командами, expected results и failure signals в [Docs/template_readiness_regression.md](./template_readiness_regression.md);
- remaining risks текущего этапа ограничены и явно известны:
  - validation для уже реализованного `order.placed` path и его anti-duplicate contract hardening v1.1 ещё не зафиксирована как отдельный verification result;
  - `payment failed`, `order canceled` и `order.shipped` flows остаются следующими подшагами, а не закрытым контуром;
  - `providerConnectId` / `extraParams` support и true multi-quote checkout остаются deferred;
  - race window в query-before-create dedupe для `order.placed` осознанно принят как accepted limitation и пока не закрыт отдельным storage-level lock;
  - ApiShip `cheapest_only_v1` подтверждён runtime-проверкой `2026-04-18`, но это не полноценный multi-quote UX;
- повторный `npm run bootstrap` поверх уже заполненной БД подтвержден runtime validation как idempotent path и больше не является открытым hardening concern;
- checkout end-to-end validation v1 закрыт: полный flow `shipping → hosted YooKassa payment → automatic return → review → order placement → confirmed order page` подтверждён runtime/E2E, а blockers сняты targeted fixes в [`payment-button/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/checkout/components/payment-button/index.tsx) и [`cookies.ts`](../medusa-agency-boilerplate-storefront/src/lib/data/cookies.ts);
- order lifecycle notifications v1 уже реализован как первый production-like customer-facing slice, а hardening v1.1 синхронизирован как действующий operational contract: subscriber [`orderPlacedNotificationHandler()`](../medusa-agency-boilerplate/src/subscribers/order-placed-notification.ts:5) слушает `order.placed`, workflow [`sendOrderPlacedNotificationWorkflow`](../medusa-agency-boilerplate/src/workflows/send-order-placed-notification.ts:308) делает query по минимальной форме `{ id, display_id, email }`, dedupe authority остается existing notification storage, canonical dedupe identity использует `trigger_type + resource_type + resource_id + channel + template + normalized recipient`, а duplicate suppression выполняется как controlled skip с diagnostics без второго notification;
- следующий шаг — **validation order lifecycle notifications v1** с hardening v1.1 и затем отдельный commit, а smoke path остается отдельным regression anchor через [send-notification-smoke.ts](../medusa-agency-boilerplate/src/workflows/send-notification-smoke.ts) и [route.ts](../medusa-agency-boilerplate/src/api/admin/notifications/smoke/route.ts);
- Payload уже встроен в канонический план как post-storefront-core content layer, но не является текущей активной реализацией.

---

## 7. Порядок действий для агента с пустым контекстом

Если пользователь пишет `начинай` или `продолжай реализацию`, агент должен действовать так:

1. Прочитать этот файл: [current_work.md](./current_work.md).
2. Открыть дорожную карту: [master_repo_plan_v2.md](./master_repo_plan_v2.md).
3. Прочитать аудит состояния: [plan_analysis.md](./plan_analysis.md).
4. Принять как уже подтвержденные инварианты:
   - `cp .env.example .env` → `npm run bootstrap` → `npm run preflight` → `npm run dev`;
   - `ru` region и `rub` baseline currency;
   - publishable key, sales channel и минимальный shipping skeleton;
   - отсутствие обязательного demo-catalog baseline;
   - закрытый storefront redirect-loop;
   - закрытый notification hardening v1;
   - канонический authenticated smoke path в схеме `fresh sk_* key` → `Basic auth` → `POST /admin/notifications/smoke`;
   - подтвержденный YooKassa-first payment path v1 без обязательных secret and env требований для baseline startup;
   - реализованный ApiShip-first shipping slice как opt-in and baseline-safe rate-selection path;
   - storefront `500` для checkout уже отделен как cart and data-state issue, а не как доказанная shipping code regression.
5. Проверить рабочую поверхность текущего этапа:
   - [Docs/current_work.md](./current_work.md)
   - [Docs/plan_analysis.md](./plan_analysis.md)
   - [Docs/env_contract.md](./env_contract.md)
   - [.codex/skills/medusa-master-repo/SKILL.md](../.codex/skills/medusa-master-repo/SKILL.md)
   - [package.json](../package.json)
   - [medusa-agency-boilerplate/src/scripts/seed.ts](../medusa-agency-boilerplate/src/scripts/seed.ts)
6. По умолчанию работать так:
   - считать notification-track закрытым на уровне hardening v1 и order lifecycle notifications hardening v1.1;
   - считать order lifecycle notifications v1 уже реализованным как первый production-like customer-facing slice с anti-duplicate contract поверх existing notification storage;
   - считать payment v1 подтвержденным YooKassa-first path;
   - считать shipping v1 подтверждённым ApiShip-first rate-selection slice `cheapest_only_v1` — runtime-проверка `2026-04-18` пройдена;
   - считать **bootstrap idempotency hardening v1** подтвержденным runtime validation;
   - считать checkout end-to-end validation v1 закрытым подтвержденным runtime/E2E результатом;
   - использовать [template_readiness_regression.md](./template_readiness_regression.md) как source of truth по локальным regression-командам и failure signals;
   - следующим workstream считать **validation order lifecycle notifications v1**, а authenticated smoke path удерживать как отдельный regression anchor.
7. Не начинать Payload implementation, пока по плану не дойдем до storefront core и отдельного content-layer трека.
8. После значимых изменений обновить:
   - [current_work.md](./current_work.md)
   - [template_readiness_regression.md](./template_readiness_regression.md), если меняется сам regression-pack;
   - [master_repo_plan_v2.md](./master_repo_plan_v2.md), если меняется сам план;
   - [plan_analysis.md](./plan_analysis.md), если меняется аудит;
   - [.codex/skills/medusa-master-repo/SKILL.md](../.codex/skills/medusa-master-repo/SKILL.md), если меняется навигация или current known reality.

---

## 8. Где смотреть статус разных типов

- Что делаем прямо сейчас: [current_work.md](./current_work.md)
- Куда идем и в каком порядке: [master_repo_plan_v2.md](./master_repo_plan_v2.md)
- Что реально уже подтверждено и какие есть разрывы: [plan_analysis.md](./plan_analysis.md)
- Как агенту быстро войти в контекст: [.codex/skills/medusa-master-repo/SKILL.md](../.codex/skills/medusa-master-repo/SKILL.md)

---

## 9. Когда этот документ нужно обновлять

Этот файл нужно обновлять обязательно, если:

- изменилась активная фаза;
- начался новый конкретный рабочий трек;
- изменилась рабочая поверхность текущего этапа;
- был снят или добавлен блокер;
- поменялся ответ на вопрос `что делаем прямо сейчас`.
