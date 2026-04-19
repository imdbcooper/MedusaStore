# Current Work

> Статус документа: текущий операционный фокус проекта по состоянию на `2026-04-19`
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

`Фаза 6 storefront customization` теперь truthfully закрыта только после reopen/remediation cycle: прежний closure verdict был overstated, затем reopening был признан валидным по трём gap'ам, а post-remediation regression/readiness checkpoint `2026-04-19` зафиксировал финальный verdict **PASS**.

Текущий operational context больше не находится внутри открытого implementation workstream `Фазы 6`: readiness для storefront customization зафиксирован как **готово к следующему roadmap stage**, то есть к **Фазе 7: шаблонизация и ускорение запуска нового клиента**, потому что reopened gaps уже закрыты remediation-коммитами и повторный checkpoint подтвердил truthful re-closure без marketing-style overclaim.

Первые интеграционные шаги Фазы 3 и последующие foundational steps уже зафиксированы в репозитории:

- **notification slice v1** реализован и подтвержден как первый integration slice;
- **notification hardening v1** теперь тоже реализован и проверен как закрытый delivery result для notification-track;
- **order lifecycle notifications hardening v1.1** реализован поверх `order lifecycle notifications v1` как source-of-truth update для первого production-like customer-facing notification slice: trigger = `order.placed`, path = `subscriber → workflow → Notification Module`, canonical recipient в runtime по-прежнему = `order.email`, а anti-duplicate contract теперь опирается на existing notification storage, query-before-create dedupe и controlled skip с diagnostics при duplicate match;
- **payment track v1** реализован как **YooKassa-first** путь и ранее подтвержден end-to-end для текущего payment scope;
- **shipping track v1** реализован как backend-first **ApiShip** slice; **`cheapest_only_v1` подтверждён runtime-проверкой `2026-04-18`**: production token получен, provider активирован, route path [`GET /store/apiship/rates`](../medusa-agency-boilerplate/src/api/store/apiship/rates/route.ts) подтверждён, rates из ApiShip/Yandex возвращаются; blocker по ApiShip **закрыт targeted code fixes** в route и seed, а не ожиданием account-state;
- **checkout end-to-end validation v1** закрыт: подтвержден полный flow `shipping → hosted YooKassa payment → automatic return → review → order placement → confirmed order page`; ложный blocker вокруг `payment_collection` снят; targeted fix в [`payment-button/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/checkout/components/payment-button/index.tsx) больше не допускает вызов `placeOrder()` до hosted authorization, а targeted fix в [`cookies.ts`](../medusa-agency-boilerplate-storefront/src/lib/data/cookies.ts) меняет policy для cart cookie c `sameSite: "strict"` на `sameSite: "lax"` для корректного cross-site return.

`Payload CMS v1` как content layer маркетинговых страниц уже реализован и закрыт как отдельный workstream после стабилизации storefront core.
В каноническом плане это больше не будущий трек **Фаза 5.5**, а завершённый source-of-truth этап перед переходом к **Фазе 6** с client customization.

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
- `unisender` без `UNISENDER_API_KEY` не ломает startup, build и runtime и корректно падает обратно на local provider;
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
- **`storefront core baseline v1` закрыт и больше не считается current work**: shared storefront shell, runtime/config baseline и starter/demo cleanup синхронизированы как предыдущий repo-level шаг и зафиксированы коммитом `6f9a5499e2c9fcf08e2e6d1fffa75f350e82f5bb`;
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
  - `UniSender` path для production;
  - fallback к local provider при `unisender` без `UNISENDER_API_KEY`;
  - provider-agnostic workflow;
  - admin smoke route;
  - authenticated smoke через Basic auth и secret admin API key;
  - opt-in helper для on-demand fresh secret admin API key.
  - roadmap уже больше не описывает SendGrid как актуальный bridge: целевой email provider для шаблона зафиксирован как `UniSender` для service и marketing email.
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
  - notification runtime сохраняет baseline-safe semantics и не требует `UNISENDER_API_KEY` для local default path;
  - ApiShip provider реально включается только при наличии токена;
  - safe-by-default закрыт не только в runtime-коде, но и на orchestration/env-sync уровне: отсутствие `APISHIP_TEST_MODE` в root env после sync больше не ведет backend env в live;
  - shipping option `ApiShip Courier to Address` появляется после повторного seed в ApiShip-enabled окружении;
  - storefront `500` на checkout оказался runtime and data-state проблемой отсутствующего или невалидного cart, а не подтвержденной code regression;
  - payload mapping, endpoint usage и live and test режим по текущей реализации выглядят корректно;
  - расширение env-contract осталось opt-in и baseline-safe.

### Статус после закрытия `marketing layer v1`

**`storefront core baseline v1` уже закрыт коммитом `6f9a5499e2c9fcf08e2e6d1fffa75f350e82f5bb`, `VK ID v1` закрыт коммитом `f48a02658d116a04afd794c1134ac72e0ab00bc8` `feat(vk): add vk id linking v1`, `MTS Exolve` закрыт коммитом `b13f6fa93473bb8bc0320566a75d264d60739784` `feat(notification): add MTS Exolve SMS workstream`, а `marketing layer v1` закрыт коммитом `a4711906b16523dcf03da9601ccf1a914702ca7d` `feat(marketing-layer): add marketing preferences and campaign workflows`.**

Новый подтвержденный результат закрытого `marketing layer v1` шага:

- metadata-first consent/preferences contract материализован в `customer.metadata.marketing`: каноническая структура описана типом [`MarketingPreferences`](../medusa-agency-boilerplate/src/modules/marketing-preferences.ts:37), а channel bindings нормализуются через [`resolveMarketingBindings()`](../medusa-agency-boilerplate/src/modules/marketing-preferences.ts:202) из existing customer email, phone и VK metadata surfaces;
- customer self-service и admin updates пишут обратно в один и тот же metadata contract через store route [`POST()`](../medusa-agency-boilerplate/src/api/store/customers/me/marketing-preferences/route.ts:80) и admin route [`PUT()`](../medusa-agency-boilerplate/src/api/admin/marketing/campaigns/route.ts:110), а не через отдельный consent storage;
- campaign and journal surface материализованы в [`ensureMarketingLayerTables()`](../medusa-agency-boilerplate/src/modules/marketing-layer.ts:305) как внутренние таблицы `marketing_campaign` и `marketing_delivery_journal` с audience selection, frequency cap и delivery audit trail;
- execution semantics теперь зафиксированы как single-channel per campaign: каждая campaign record хранит один `channel`, а [`sendMarketingCampaignWorkflow`](../medusa-agency-boilerplate/src/workflows/send-marketing-campaign.ts:508) при launch использует ровно один delivery runtime, пишет `sent/skipped/failed` journal rows, уважает global/channel consent, `suppressed_until`, recipient binding availability и frequency cap;
- store API surface материализован в [`GET()`](../medusa-agency-boilerplate/src/api/store/customers/me/marketing-preferences/route.ts:45) и [`POST()`](../medusa-agency-boilerplate/src/api/store/customers/me/marketing-preferences/route.ts:80) для `/store/customers/me/marketing-preferences`;
- admin API surface материализован в campaign list/create/preferences route [`GET()`](../medusa-agency-boilerplate/src/api/admin/marketing/campaigns/route.ts:72), [`POST()`](../medusa-agency-boilerplate/src/api/admin/marketing/campaigns/route.ts:85), [`PUT()`](../medusa-agency-boilerplate/src/api/admin/marketing/campaigns/route.ts:110) и в per-campaign route [`GET()`](../medusa-agency-boilerplate/src/api/admin/marketing/campaigns/[id]/route.ts:28) / [`POST()`](../medusa-agency-boilerplate/src/api/admin/marketing/campaigns/[id]/route.ts:62); auth and validation boundary синхронизирован через [`defineMiddlewares()`](../medusa-agency-boilerplate/src/api/middlewares.ts:20);
- storefront profile preferences section материализован в компоненте [`ProfileMarketingPreferences`](../medusa-agency-boilerplate-storefront/src/modules/account/components/profile-marketing-preferences/index.tsx:92), data helpers [`retrieveMarketingPreferences()`](../medusa-agency-boilerplate-storefront/src/lib/data/marketing.ts:61) и [`updateMarketingPreferences()`](../medusa-agency-boilerplate-storefront/src/lib/data/marketing.ts:80), а также встраивании в [`Profile()`](../medusa-agency-boilerplate-storefront/src/app/[countryCode]/(main)/account/@dashboard/profile/page.tsx:35);
- validation and review outcome закрыты: backend typecheck PASS, storefront typecheck PASS, targeted tests в [`marketing-layer.unit.spec.ts`](../medusa-agency-boilerplate/src/workflows/__tests__/marketing-layer.unit.spec.ts:27) PASS `1` suite / `6` tests, review verdict = `approve`;
- review notes остались только non-blocker: admin [`PUT()`](../medusa-agency-boilerplate/src/api/admin/marketing/campaigns/route.ts:110) всё ещё опирается на `customer_id` query ergonomics, а dynamic route пока использует manual URL parsing в [`getCampaignId()`](../medusa-agency-boilerplate/src/api/admin/marketing/campaigns/[id]/route.ts:21).

Это значит для дальнейшего sequencing:

- не переоткрывать `storefront core baseline v1`, `VK Community Messaging v1 foundation`, `VK ID v1`, `MTS Exolve`, `marketing layer v1` и теперь уже закрытый `Payload CMS v1` без нового evidence о регрессии;
- approved communication stack теперь materialized end-to-end как `UniSender + VK Community Messaging + optional VK ID + MTS Exolve + marketing layer`, при этом role split остается прежним: `Payload = content`, `admin = operations`, `marketing layer = orchestration`;
- `Payload CMS v1` уже зафиксирован как закрытый workstream: отдельный app [`payload-cms`](../payload-cms), storefront content integration, preview/revalidate path, globals и fallback behaviour materialized и закоммичены как [`22486388f4c89d884b4c3cbe668ebec4ab695dee`](../package.json:1) `feat(content): add Payload CMS marketing content layer`;
- storefront build blocker перед `Фазой 6` дополнительно закрыт: [`generateStaticParams()`](../medusa-agency-boilerplate-storefront/src/app/[countryCode]/(main)/categories/[...category]/page.tsx:19), [`generateStaticParams()`](../medusa-agency-boilerplate-storefront/src/app/[countryCode]/(main)/collections/[handle]/page.tsx:21) и уже защищенный [`generateStaticParams()`](../medusa-agency-boilerplate-storefront/src/app/[countryCode]/(main)/products/[handle]/page.tsx:15) теперь не роняют `next build` при недоступном Store API, а деградируют до пустых static params;
- активным roadmap step теперь считать **Фазу 6**: client customization layer поверх уже materialized commerce-core и content-layer, без повторного открытия Payload integration track;
- `Фаза 6` уже продвинулась дальше стартового foundation slice: [`storefront-client-config.ts`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts) теперь удерживает sanctioned preset catalog `atelier|market`, env-driven switch `NEXT_PUBLIC_STOREFRONT_PRESET`, anti-fork guardrails и два реально разных client scenarios на одном storefront core; typed section registry и preset-driven composition уже покрывают `home`, `collectionLanding`, `contentPage` и `postPage`, а adjacent product support surface продолжает жить в том же customization layer без дублирования cart/checkout/account/order logic;
- не смешивать текущий client customization track с template release packaging до соответствующих фаз плана;
- сохранять distinction между каноническим root clean-start workflow и ad-hoc local debug через прямой [`npx medusa develop`](../medusa-agency-boilerplate/package.json) плюс отдельный storefront runtime.

Отдельно зафиксировано на уровне плана:

- `Payload CMS v1` уже встроен как отдельный headless content service через app [`payload-cms`](../payload-cms);
- текущий roadmap track после закрытого `Payload CMS v1` — уже стартовавшая **Фаза 6** с client customization layer;
- approved communication stack больше не находится в статусе открытого выбора:
  - `UniSender` — целевой email provider для service и marketing email;
  - `VK Community Messaging` — целевой VK transport для service и marketing messages;
  - `VK ID` — optional auth/identity link для привязки пользователя к VK-каналу, а не самостоятельный transport;
  - `MTS Exolve` — целевой SMS provider для service и marketing SMS;
  - внешний marketing hub вроде `Sendsay` не является выбранным направлением для этого master repo.
- marketing architecture больше не planning-only и читается так:
  - `customer.metadata.marketing` = consent/preferences source of truth;
  - `marketing_campaign` + `marketing_delivery_journal` = campaign and audit surface;
  - `Payload` отвечает за marketing content, promo blocks, campaign copy и landing content;
  - `admin` отвечает за operational visibility, ручные запуски, статусы кампаний и пользовательские channel preferences.

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

Payload-related рабочая поверхность уже **materialized и закрыта как completed track**, а её source of truth теперь удерживает:

- отдельное приложение [`payload-cms`](../payload-cms);
- storefront block renderer, content-provider boundary, globals integration и fallback behaviour;
- content schema docs, preview and revalidate flow и root orchestration scripts для payload runtime.

Для закрытого notification-track канонический source of truth остается в:

- документах по operational status, sequencing и env-contract;
- contract `order.placed` path `subscriber → workflow → Notification Module`, включая anti-duplicate semantics hardening v1.1;
- existing notification storage как dedupe authority для `order.placed`, а не отдельный ledger;
- admin smoke route, workflow и helper для authenticated smoke как отдельном baseline/regression anchor.

Для подтверждённого ApiShip track рабочая поверхность включает:

- документы по shipping status и ограничениям;
- server-side shipping adapter и contracts вокруг **ApiShip-first** сценария;
- storefront checkout shipping selection и cart and runtime validation.

Текущий roadmap step после уже закрытых shipping/payment/checkout proof points, завершённых placed + shipped + failed-payment + canceled slices, закрытых `post-UniSender cleanup-step`, `VK Community Messaging v1 foundation`, `storefront core baseline v1`, `VK ID v1`, `MTS Exolve`, `marketing layer v1`, `Payload CMS v1` и теперь уже закрытой `Фазы 6 storefront customization` — это readiness-переход к **Фазе 7 client/template packaging**: sequencing больше не возвращается к storefront-core, VK identity-linking, SMS transport, marketing orchestration, Payload content layer или Phase 6 browse customization и должен читать следующий workstream только как post-Phase-6 roadmap stage.

---

## 4. Конкретные задачи текущего этапа

### 4.1. Зафиксировать checkout end-to-end validation v1 как закрытый входной инвариант

Теперь source of truth должен явно удерживать, что checkout path уже подтвержден runtime/E2E:

- `shipping → hosted YooKassa payment → automatic return → review → order placement → confirmed order page` реально пройден;
- blocker вокруг `payment_collection` снят и больше не считается реальным ограничением checkout path;
- targeted fix в [`payment-button/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/checkout/components/payment-button/index.tsx) предотвращает преждевременный `placeOrder()` до hosted authorization;
- targeted fix в [`cookies.ts`](../medusa-agency-boilerplate-storefront/src/lib/data/cookies.ts) меняет cart cookie policy с `sameSite: "strict"` на `sameSite: "lax"`, чтобы cross-site return не терял checkout state.

### 4.2. Закрытый предыдущий operational workstream — `storefront core baseline v1`

Этот шаг уже завершён как предыдущий repo-level track: `UniSender email migration v1`, `post-UniSender cleanup-step` и `VK Community Messaging v1 foundation` были его входным sequencing, затем storefront core был закрыт отдельным delivery-result и больше не считается текущим operational focus. Его подтверждённый scope сохраняется здесь как closed snapshot, чтобы не переоткрывать drift.

### 4.2.1. Exact implementation scope для `storefront core baseline v1`

**В baseline входят:**

- shared commerce shell в [`medusa-agency-boilerplate-storefront/src/app/[countryCode]/(main)/page.tsx`](../medusa-agency-boilerplate-storefront/src/app/[countryCode]/(main)/page.tsx), [`medusa-agency-boilerplate-storefront/src/modules/layout/templates/nav/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/layout/templates/nav/index.tsx), [`medusa-agency-boilerplate-storefront/src/modules/layout/templates/footer/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/layout/templates/footer/index.tsx), catalog/category/collection/product/cart/checkout/account/order entrypoints и их shared templates;
- runtime/config слой в [`medusa-agency-boilerplate-storefront/src/lib/storefront-config.ts`](../medusa-agency-boilerplate-storefront/src/lib/storefront-config.ts), [`medusa-agency-boilerplate-storefront/.env.local.example`](../medusa-agency-boilerplate-storefront/.env.local.example), [`medusa-agency-boilerplate-storefront/src/lib/config.ts`](../medusa-agency-boilerplate-storefront/src/lib/config.ts), [`medusa-agency-boilerplate-storefront/src/middleware.ts`](../medusa-agency-boilerplate-storefront/src/middleware.ts), [`medusa-agency-boilerplate-storefront/src/lib/data/regions.ts`](../medusa-agency-boilerplate-storefront/src/lib/data/regions.ts) и [`medusa-agency-boilerplate-storefront/src/lib/data/locales.ts`](../medusa-agency-boilerplate-storefront/src/lib/data/locales.ts);
- shared customer-facing copy для home, navigation, footer, cart, checkout, account и order surfaces;
- provider-aware storefront adaptation только для уже подтвержденных backend inputs: YooKassa-first payment path, manual fallback, optional Stripe-compatible reference path при наличии такого provider в backend и ApiShip `cheapest_only_v1` delivery UI;
- удаление или нейтрализация starter/demo/admin-onboarding surfaces из shopper-facing entrypoints и storefront docs.

### 4.2.2. Какие проблемы и drifts нужно закрыть в первую очередь

- starter branding ещё протекает в shopper-facing shell через [`medusa-agency-boilerplate-storefront/src/modules/layout/components/medusa-cta/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/layout/components/medusa-cta/index.tsx), [`medusa-agency-boilerplate-storefront/src/modules/layout/templates/footer/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/layout/templates/footer/index.tsx) и [`medusa-agency-boilerplate-storefront/src/app/[countryCode]/(checkout)/layout.tsx`](../medusa-agency-boilerplate-storefront/src/app/[countryCode]/(checkout)/layout.tsx);
- demo/onboarding UX всё ещё доступен покупателю через [`medusa-agency-boilerplate-storefront/src/modules/products/components/product-onboarding-cta/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/products/components/product-onboarding-cta/index.tsx), [`medusa-agency-boilerplate-storefront/src/modules/order/components/onboarding-cta/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/order/components/onboarding-cta/index.tsx), [`medusa-agency-boilerplate-storefront/src/modules/order/templates/order-completed-template.tsx`](../medusa-agency-boilerplate-storefront/src/modules/order/templates/order-completed-template.tsx) и helper [`medusa-agency-boilerplate-storefront/src/lib/data/onboarding.ts`](../medusa-agency-boilerplate-storefront/src/lib/data/onboarding.ts);
- storefront README в [`medusa-agency-boilerplate-storefront/README.md`](../medusa-agency-boilerplate-storefront/README.md) всё ещё описывает Medusa starter и Stripe-first setup, а не template backend contract текущего repo;
- region/default semantics частично выровнены, но не унифицированы до конца: [`middleware.ts`](../medusa-agency-boilerplate-storefront/src/middleware.ts) уже опирается на env-driven default region, тогда как [`getRegion()`](../medusa-agency-boilerplate-storefront/src/lib/data/regions.ts) всё ещё содержит жесткий fallback на `ru`;
- optional Stripe-compatible code path может оставаться reference adapter, но не должен формировать ощущение, что Stripe env — обязательный baseline для шаблона.

### 4.2.3. Какие backend/storefront boundaries уже достаточны

- текущие store APIs и runtime contracts уже достаточны для baseline-step: `/store/regions`, optional `/store/locales`, cart/checkout/account/order surfaces, confirmed YooKassa hosted return contract и ApiShip rates route;
- storefront на этом шаге должен адаптироваться к уже существующим provider IDs, checkout semantics и confirmed region data, а не требовать новые backend endpoints или новый orchestration layer;
- notification stack, `VK Community Messaging`, `VK ID`, `MTS Exolve`, marketing-layer и Payload content layer не являются prerequisites для storefront core baseline.

### 4.2.4. Env и runtime assumptions, которые нужно зафиксировать

- baseline runtime остаётся привязан к текущему root orchestration contract: backend на `9000`, storefront на `8000`, template region = `ru` по умолчанию;
- storefront baseline env ограничивается `MEDUSA_BACKEND_URL`, `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`, `NEXT_PUBLIC_BASE_URL` и `NEXT_PUBLIC_DEFAULT_REGION`, а `NEXT_PUBLIC_STOREFRONT_PRESET` теперь допускается как optional `Фаза 6` switch для sanctioned client scenarios;
- `NEXT_PUBLIC_YOOKASSA_ENABLED` остаётся opt-in public flag для уже подтвержденного payment slice;
- `NEXT_PUBLIC_STRIPE_KEY`, `NEXT_PUBLIC_MEDUSA_PAYMENTS_PUBLISHABLE_KEY` и `NEXT_PUBLIC_MEDUSA_PAYMENTS_ACCOUNT_ID` допускаются только как optional compatibility env для reference adapter path, а не как baseline requirement;
- отсутствие `/store/locales` должно оставаться baseline-safe и не ломать build/runtime;
- storefront не получает новые public secrets для notification/VK/Payload tracks и не делает эти tracks частью core baseline.

### 4.2.5. Required storefront files/areas для implementation шага

- config/runtime: [`medusa-agency-boilerplate-storefront/.env.local.example`](../medusa-agency-boilerplate-storefront/.env.local.example), [`medusa-agency-boilerplate-storefront/src/lib/storefront-config.ts`](../medusa-agency-boilerplate-storefront/src/lib/storefront-config.ts), [`medusa-agency-boilerplate-storefront/src/lib/config.ts`](../medusa-agency-boilerplate-storefront/src/lib/config.ts), [`medusa-agency-boilerplate-storefront/src/middleware.ts`](../medusa-agency-boilerplate-storefront/src/middleware.ts), [`medusa-agency-boilerplate-storefront/src/lib/data/regions.ts`](../medusa-agency-boilerplate-storefront/src/lib/data/regions.ts), [`medusa-agency-boilerplate-storefront/src/lib/data/locales.ts`](../medusa-agency-boilerplate-storefront/src/lib/data/locales.ts);
- shared shell and copy: [`medusa-agency-boilerplate-storefront/src/app/[countryCode]/(main)/page.tsx`](../medusa-agency-boilerplate-storefront/src/app/[countryCode]/(main)/page.tsx), [`medusa-agency-boilerplate-storefront/src/modules/home/components/hero/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/home/components/hero/index.tsx), [`medusa-agency-boilerplate-storefront/src/modules/layout/templates/footer/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/layout/templates/footer/index.tsx), [`medusa-agency-boilerplate-storefront/src/modules/layout/templates/nav/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/layout/templates/nav/index.tsx), [`medusa-agency-boilerplate-storefront/src/modules/layout/components/country-select/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/layout/components/country-select/index.tsx);
- checkout/provider adaptation: [`medusa-agency-boilerplate-storefront/src/modules/checkout/components/payment/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/checkout/components/payment/index.tsx), [`medusa-agency-boilerplate-storefront/src/modules/checkout/components/payment-wrapper/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/checkout/components/payment-wrapper/index.tsx), [`medusa-agency-boilerplate-storefront/src/modules/checkout/components/payment-container/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/checkout/components/payment-container/index.tsx), [`medusa-agency-boilerplate-storefront/src/modules/checkout/components/payment-button/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/checkout/components/payment-button/index.tsx), [`medusa-agency-boilerplate-storefront/src/modules/checkout/components/shipping/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/checkout/components/shipping/index.tsx);
- demo/onboarding cleanup: [`medusa-agency-boilerplate-storefront/src/modules/products/components/product-onboarding-cta/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/products/components/product-onboarding-cta/index.tsx), [`medusa-agency-boilerplate-storefront/src/modules/order/components/onboarding-cta/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/order/components/onboarding-cta/index.tsx), [`medusa-agency-boilerplate-storefront/src/modules/order/templates/order-completed-template.tsx`](../medusa-agency-boilerplate-storefront/src/modules/order/templates/order-completed-template.tsx), [`medusa-agency-boilerplate-storefront/src/lib/data/onboarding.ts`](../medusa-agency-boilerplate-storefront/src/lib/data/onboarding.ts), [`medusa-agency-boilerplate-storefront/README.md`](../medusa-agency-boilerplate-storefront/README.md).

### 4.2.6. Expected deliverables, validation strategy и sequencing

**Expected deliverables:**

- storefront core без shopper-visible starter/demo branding;
- синхронизированный RU-neutral copy/config baseline;
- унифицированные region/runtime assumptions без скрытого возврата к demo defaults;
- provider-aware checkout and shipping presentation, совместимый с текущими backend inputs без новых API;
- storefront onboarding/readme notes, описывающие template backend contract, а не оригинальный starter.

**Validation strategy:**

- статическая проверка shared entrypoints на отсутствие shopper-visible `Medusa`, `demo`, `onboarding` и admin-setup CTA там, где это больше не часть baseline;
- regression review для home, catalog, product, cart, checkout, account и confirmed order surfaces;
- отдельная проверка того, что region switching и optional locales остаются baseline-safe;
- отдельная проверка того, что текущий YooKassa-first checkout path и ApiShip `cheapest_only_v1` semantics не ломаются адаптацией storefront shell;
- при implementation step использовать storefront build/lint/runtime smoke как validation surface, но не расширять baseline до новых integration tracks.

**Recommended sequencing:**

1. Сначала унифицировать runtime/config и region assumptions.
2. Затем убрать shopper-visible starter/onboarding surfaces и starter docs.
3. После этого дочистить shared copy и metadata до RU-neutral baseline.
4. Затем довести payment/shipping presentation до provider-aware baseline без новых backend APIs.
5. В конце зафиксировать validation notes и docs sync.

### 4.2.7. Explicit non-goals для этого workstream

- не запускать `VK ID`, `MTS Exolve`, Payload CMS, marketing pages или другой соседний roadmap track;
- не делать клиентский visual branding system, theme engine или глубокую витринную кастомизацию под конкретного заказчика;
- не вводить новые backend endpoints, новые payment providers, новый shipping scope или новый notification logic;
- не расширять scope до multi-quote delivery UX, `providerConnectId` / `extraParams`, campaign/service pages или полноценного translation-management layer.

### 4.3. Почему после `VK Community Messaging` сначала шёл `storefront core baseline v1`, а теперь следующим стал `MTS Exolve`

- communication expansion `VK Community Messaging` уже материализован и закрыт, поэтому повторно называть его текущим planning-selected шагом больше нельзя;
- storefront core действительно был ближайшим repo track и уже закрыт как предыдущий storefront-focused шаг, согласованный с [`Фаза 5. Общий storefront core и RU baseline`](./master_repo_plan_v2.md#фаза-5-общий-storefront-core-и-ru-baseline);
- после закрытия storefront core и `VK ID v1` следующим явным opt-in communication track остаётся `MTS Exolve`;
- sequencing по-прежнему безопаснее читать именно так, потому что marketing-layer и `Payload CMS v1` идут только после materialized channel stack и устойчивого storefront core.

### 4.4. Закрытый delivery snapshot — `VK Community Messaging`

**Что означает этот workstream в текущем repo state**

- это **новый notification channel/provider** для Notification Module, а не замена существующего email runtime;
- email path через [`getNotificationEmailRuntime()`](../medusa-agency-boilerplate/src/modules/notification-email.ts:119), [`getNotificationEmailProviderDefinition()`](../medusa-agency-boilerplate/src/modules/notification-email.ts:143), [`sendNotificationSmokeWorkflow`](../medusa-agency-boilerplate/src/workflows/send-notification-smoke.ts) и [`POST()`](../medusa-agency-boilerplate/src/api/admin/notifications/smoke/route.ts:26) остаётся source of truth для email и не переписывается в рамках VK rollout;
- первый VK scope должен использовать **уже существующие lifecycle events/workflows как trigger source pattern**, а не открывать новый event surface без подтвержденной необходимости.

**Какие notification slices входят в `v1`**

- обязательный foundation slice: отдельный authenticated smoke path для канала `vk`;
- service notification slices первого этапа:
  - `order.placed`;
  - `shipment.created`;
  - `order.canceled`;
- `payment_session.failed.customer.notification_requested` в `v1` **не входит**: pre-order `cart`-контекст и guest-checkout recipient binding пока хуже подходит для первого VK rollout, чем уже закрытые post-order order-level triggers;
- marketing campaigns, broadcasts и audience orchestration в `v1` не входят, даже если transport позже будет переиспользован marketing-layer.

**Trigger source и event surface**

- source of truth для trigger boundary остаётся тем же, что и у email lifecycle paths: существующие Medusa events `order.placed`, `shipment.created`, `order.canceled`;
- для `v1` не нужен новый upstream event surface, если достаточно подписаться на те же события отдельными VK subscribers или вызвать отдельные VK workflows из параллельного subscriber layer;
- новый internal event surface допускается только позже, если появится подтвержденный runtime-pressure для multi-channel fan-out, но это не часть `v1` blueprint.

**Required backend files/modules**

- новый provider module: `medusa-agency-boilerplate/src/modules/notification-vk-community.ts`;
- новый VK runtime/helper module для env parsing и recipient normalization: `medusa-agency-boilerplate/src/modules/notification-vk.ts`;
- расширение provider registration в [`medusa-config.ts`](../medusa-agency-boilerplate/medusa-config.ts) через добавление opt-in VK provider в Notification Module рядом с текущим email provider;
- отдельный smoke workflow: `medusa-agency-boilerplate/src/workflows/send-vk-notification-smoke.ts`;
- отдельный admin smoke route: `medusa-agency-boilerplate/src/api/admin/notifications/smoke/vk/route.ts`;
- lifecycle workflows `v1`:
  - `medusa-agency-boilerplate/src/workflows/send-order-placed-vk-notification.ts`;
  - `medusa-agency-boilerplate/src/workflows/send-order-shipped-vk-notification.ts`;
  - `medusa-agency-boilerplate/src/workflows/send-order-canceled-vk-notification.ts`;
- lifecycle subscribers `v1`:
  - `medusa-agency-boilerplate/src/subscribers/order-placed-vk-notification.ts`;
  - `medusa-agency-boilerplate/src/subscribers/order-shipped-vk-notification.ts`;
  - `medusa-agency-boilerplate/src/subscribers/order-canceled-vk-notification.ts`;
- targeted validation surface:
  - `medusa-agency-boilerplate/src/workflows/__tests__/notification-vk-runtime.unit.spec.ts`;
  - `medusa-agency-boilerplate/src/workflows/__tests__/send-order-placed-vk-notification.unit.spec.ts`;
  - `medusa-agency-boilerplate/src/workflows/__tests__/send-order-shipped-vk-notification.unit.spec.ts`;
  - `medusa-agency-boilerplate/src/workflows/__tests__/send-order-canceled-vk-notification.unit.spec.ts`.

**Env contract и provider credentials surface**

- `NOTIFICATION_VK_PROVIDER` — opt-in selector для VK transport runtime, где baseline-default = `disabled`, а `community` означает явный запрос на VK Community Messaging provider;
- `VK_COMMUNITY_ACCESS_TOKEN` — required только при `NOTIFICATION_VK_PROVIDER=community`;
- `VK_COMMUNITY_GROUP_ID` — required только при `NOTIFICATION_VK_PROVIDER=community`;
- `VK_API_VERSION` — optional override для VK API version, если implementation решит не хардкодить её в provider module;
- storefront и public env не должны получать никакие VK transport secrets;
- отсутствие всех `VK_*` переменных должно оставаться baseline-safe и не ломать clean onboarding, bootstrap, preflight, build или local email runtime.

**Recipient resolution, dedupe и skip semantics**

- canonical recipient для VK `v1` — не email, а нормализованный `vk_peer_id` как string;
- первый storage surface для привязки recipient должен быть максимально узким и opt-in: `customer.metadata.vk_peer_id` как canonical mapping source для service notifications `v1`;
- следствие для `v1`: VK lifecycle slices допускают controlled skip, если у order нет customer linkage или у customer отсутствует `metadata.vk_peer_id`;
- dedupe authority не меняется: source of truth по duplicate suppression остаётся existing notification storage;
- canonical dedupe identity для VK повторяет уже подтвержденную модель, но с `channel=vk` и VK recipient: `trigger_type + resource_type + resource_id + channel + template + normalized recipient`;
- duplicate match должен оставаться controlled skip с diagnostics, а не отдельным resend-flow;
- accepted limitation сохраняется: query-before-create race window остаётся допустимым ограничением и для VK `v1`.

**Ожидаемая интеграция с Notification Module**

- VK provider должен регистрироваться как второй opt-in provider в том же Notification Module, а не как отдельный ad-hoc transport bypass;
- smoke и lifecycle VK workflows должны, как и email, создавать notification entity через Notification Module, чтобы не потерять единый storage, statuses и dedupe surface;
- email и VK должны жить как параллельные каналы: одинаковый trigger source может приводить к email notification, VK notification или обоим, но без смешения provider-specific runtime helpers;
- `VK Community Messaging` `v1` не должен требовать переписывания существующих email workflows, runtime helpers или smoke route.

**Smoke и validation strategy**

- существующий email smoke path через [`sendNotificationSmokeWorkflow`](../medusa-agency-boilerplate/src/workflows/send-notification-smoke.ts:60) и [`POST()`](../medusa-agency-boilerplate/src/api/admin/notifications/smoke/route.ts:26) остаётся неизменным regression anchor;
- для VK добавляется sibling smoke path с отдельным route/workflow, который проверяет auth, provider resolution и успешное создание `channel=vk` notification без касания email route contract;
- unit validation для VK runtime должна подтвердить provider resolution semantics `disabled | community`, required credential guardrails и baseline-safe no-secret mode;
- targeted workflow validation для VK lifecycle slices должна зеркалить email harness pattern: single send, missing recipient skip, duplicate suppression и отсутствие ложного dedupe между двумя разными resources;
- live smoke на реального VK recipient допустим только как opt-in operator validation и не становится baseline regression requirement.

**Sequencing относительно `VK ID`, `MTS Exolve` и marketing-layer**

- `VK Community Messaging` идёт раньше `VK ID`: transport можно внедрить поверх manual или operator-managed `customer.metadata.vk_peer_id`, а `VK ID` позже автоматизирует и стандартизирует linking, но не владеет delivery;
- `MTS Exolve` не смешивается с VK rollout и не использует его env/runtime surface;
- marketing-layer позже должен переиспользовать transport как delivery adapter, но не должен появляться внутри `v1` transport implementation;
- `Payload` и `admin` остаются выше по стеку: content и operations, а не transport credential owners.

**Explicit non-goals**

- не переписывать existing email provider/runtime surface и не объединять его с VK в один большой cross-channel helper в том же шаге;
- не менять existing lifecycle email workflows, their templates, recipient rules и dedupe boundaries;
- не запускать `VK ID`, storefront linking UX, consent center, campaign builder, segmentation, suppression journal или marketing orchestration;
- не покрывать `payment failed` в первом VK rollout;
- не делать public/storefront env contract для VK secrets;
- не превращать live VK smoke в обязательный regression-pack baseline;
- не вводить новый dedicated delivery ledger, queue framework или storage-level lock только ради VK `v1`.

**Фактический implementation result этого шага**

1. Opt-in VK provider/runtime surface и sibling authenticated VK smoke path материализованы без изменения email smoke contract.
2. Lifecycle slice `order.placed` реализован для `channel=vk` поверх existing trigger source и existing notification storage dedupe model.
3. Lifecycle slices `shipment.created` и `order.canceled` добавлены тем же pattern'ом.
4. Step закрыт targeted validation без перехода к `VK ID`, `MTS Exolve` или marketing-layer.

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
  - email runtime на `UniSender`, post-migration cleanup, `VK Community Messaging v1 foundation`, `storefront core baseline v1`, `VK ID v1`, `MTS Exolve` и `marketing layer v1` уже не являются активными blockers;
  - `customer.metadata.vk_peer_id` и structured `customer.metadata.vk_link` остаются совместимым opt-in VK binding surface, а source-of-truth для marketing consent/preferences теперь материализован в `customer.metadata.marketing`;
  - campaign storage и audit surface уже materialized как внутренние таблицы `marketing_campaign` и `marketing_delivery_journal`, поэтому marketing layer больше не считается design-only целью;
  - `providerConnectId` / `extraParams` support и true multi-quote checkout остаются deferred;
  - race window в query-before-create dedupe для placed, shipped, failed-payment, canceled, VK и SMS paths осознанно принят как accepted limitation и пока не закрыт отдельным storage-level lock;
  - ApiShip `cheapest_only_v1` подтверждён runtime-проверкой `2026-04-18`, но это не полноценный multi-quote UX;
  - review notes по marketing layer остаются только non-blocker: query ergonomics для admin preferences update и manual URL parsing в dynamic admin campaign route.
- повторный `npm run bootstrap` поверх уже заполненной БД подтвержден runtime validation как idempotent path и больше не является открытым hardening concern;
- checkout end-to-end validation v1 закрыт: полный flow `shipping → hosted YooKassa payment → automatic return → review → order placement → confirmed order page` подтверждён runtime/E2E, а blockers сняты targeted fixes в [`payment-button/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/checkout/components/payment-button/index.tsx) и [`cookies.ts`](../medusa-agency-boilerplate-storefront/src/lib/data/cookies.ts);
- order lifecycle notifications v1 уже реализован как первый production-like customer-facing slice, а hardening v1.1 синхронизирован как действующий operational contract: subscriber [`orderPlacedNotificationHandler()`](../medusa-agency-boilerplate/src/subscribers/order-placed-notification.ts:5) слушает `order.placed`, workflow [`sendOrderPlacedNotificationWorkflow`](../medusa-agency-boilerplate/src/workflows/send-order-placed-notification.ts:308) делает query по минимальной форме `{ id, display_id, email }`, dedupe authority остается existing notification storage, canonical dedupe identity использует `trigger_type + resource_type + resource_id + channel + template + normalized recipient`, а duplicate suppression выполняется как controlled skip с diagnostics без второго notification;
- `order shipped notification v1` уже реализован и его targeted validation закрыта через [send-order-shipped-notification.unit.spec.ts](../medusa-agency-boilerplate/src/workflows/__tests__/send-order-shipped-notification.unit.spec.ts): event = `shipment.created`, payload baseline = `{ id, no_notification }`, query baseline = `{ fulfillment.id, order.id, order.display_id, order.email }`, template = `order-shipped-v1`, trigger type = `shipment.created.customer.notification_requested`, canonical recipient = `order.email`, canonical dedupe resource identity = `fulfillment.id`;
- `payment failed notification v1` уже реализован и его targeted validation закрыта через [`send-payment-failed-notification.unit.spec.ts`](../medusa-agency-boilerplate/src/workflows/__tests__/send-payment-failed-notification.unit.spec.ts): event = internal `payment_session.failed.customer.notification_requested`, canonical recipient = `cart.email`, canonical dedupe resource identity = `payment_session.id`, а duplicate suppression не смешивает два разных failed attempts одного cart;
- `order canceled notification v1` уже реализован и его targeted validation закрыта через [send-order-canceled-notification.unit.spec.ts](../medusa-agency-boilerplate/src/workflows/__tests__/send-order-canceled-notification.unit.spec.ts): event = `order.canceled`, canonical recipient = `order.email`, canonical dedupe resource identity = `order.id`, а duplicate suppression не смешивает два разных canceled orders одного recipient;
- `MTS Exolve` уже реализован и закрыт как SMS channel: runtime/provider resolution материализованы в [`notification-sms.ts`](../medusa-agency-boilerplate/src/modules/notification-sms.ts), provider implementation — в [`notification-exolve.ts`](../medusa-agency-boilerplate/src/modules/notification-exolve.ts), smoke/admin route — в [`route.ts`](../medusa-agency-boilerplate/src/api/admin/notifications/smoke/sms/route.ts), middleware boundary — в [`defineMiddlewares()`](../medusa-agency-boilerplate/src/api/middlewares.ts:17), а targeted validation закрыта с результатом `3/3` suites PASS, `12/12` tests PASS и backend typecheck PASS;
- `marketing layer v1` уже реализован и закрыт коммитом `a4711906b16523dcf03da9601ccf1a914702ca7d` `feat(marketing-layer): add marketing preferences and campaign workflows`: metadata-first consent surface живет в [`marketing-preferences.ts`](../medusa-agency-boilerplate/src/modules/marketing-preferences.ts), campaign and journal surface — в [`marketing-layer.ts`](../medusa-agency-boilerplate/src/modules/marketing-layer.ts), launch workflow — в [`send-marketing-campaign.ts`](../medusa-agency-boilerplate/src/workflows/send-marketing-campaign.ts), storefront profile section — в [`profile-marketing-preferences/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/account/components/profile-marketing-preferences/index.tsx), а validation закрыта как backend typecheck PASS + storefront typecheck PASS + `1` suite / `6` tests PASS с review verdict `approve`;
- `Payload CMS v1` уже реализован и закрыт коммитом [`22486388f4c89d884b4c3cbe668ebec4ab695dee`](../package.json:1) `feat(content): add Payload CMS marketing content layer`: отдельный app [`payload-cms`](../payload-cms) materialized как content layer маркетинговых страниц, storefront получил content integration, preview/revalidate, globals и fallback behaviour, а root orchestration layer теперь включает payload scripts, env sync и blocker-fix по нормализации `NODE_ENV` в [`scripts/payload-run.sh`](../scripts/payload-run.sh:28);
- финальный validation state для этого workstream зафиксирован как PASS по [`payload:types`](../package.json:25), [`payload:importmap`](../package.json:26) и [`payload:build`](../package.json:23), а final review verdict зафиксирован как approveable без blocking findings для commit;
- residual non-blocking observations после review больше не считаются открытым security aftermath: preview access для draft globals и signed preview-exit доведены до закрытого состояния post-review hardening.
- текущий roadmap step больше не находится внутри **Фазы 6**: `storefront customization` truthfully re-closed post-remediation checkpoint `2026-04-19`, а следующий roadmap transition теперь читается как readiness к **Фазе 7. Шаблонизация и ускорение запуска нового клиента**;
- все sanctioned базовые `Phase 6` workstreams закрыты и остаются historical source-of-truth markers: [`Preset-driven landing-surface contract v1`](../plans/preset-driven-landing-surface-contract-v1.md), [`adjacent-preset-rollout-product-support-highlights.md`](../plans/adjacent-preset-rollout-product-support-highlights.md), [`preset-driven-listing-surface-contract-v1.md`](../plans/preset-driven-listing-surface-contract-v1.md), [`preset-driven-global-shell-contract-v1.md`](../plans/preset-driven-global-shell-contract-v1.md) и [`preset-driven-catalog-shell-contract-v1.md`](../plans/preset-driven-catalog-shell-contract-v1.md);
- storefront customization удерживается на одном shared storefront core и на двух центральных selector/config authority:
  - sanctioned preset selector остаётся только [`NEXT_PUBLIC_STOREFRONT_PRESET`](../medusa-agency-boilerplate-storefront/src/lib/env.ts:21) с preset catalog `atelier|market`;
  - sanctioned preset config authority остаётся [`storefront-client-config.ts`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts);
  - typed [`landingSurfaces`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:317) покрывают `home`, `collectionLanding`, `contentPage` и `postPage` через [`collection-landing-surface/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/collection-landing-surface/index.tsx), [`content-page-surface/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/content-page-surface/index.tsx), [`post-page-surface/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/post-page-surface/index.tsx) и shared [`landing-surface-sections/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/landing-surface-sections/index.tsx);
  - adjacent product display surface [`productSurfaces.supportHighlights`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:323) materialized через [`resolveProductSupportHighlightsSurface()`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/product-surface-resolver.ts:14) и [`ProductSupportHighlights`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/product-support-highlights/index.tsx:16);
  - typed listing/card contract [`listingSurfaces.productCard`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:324) materialized через [`resolveDefaultProductCardSurface()`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/listing-surface-resolver.ts:14), [`resolveFeaturedProductCardSurface()`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/listing-surface-resolver.ts:17) и [`ProductCardSurface`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/product-card-surface.tsx:55);
  - typed global shell contract [`StorefrontShellConfig`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:74) materialized через [`resolveNavShellSurface()`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/shell-surface-resolver.ts:15), [`resolveSideMenuShellSurface()`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/shell-surface-resolver.ts:18), [`resolveFooterShellSurface()`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/shell-surface-resolver.ts:21) и thin seam в [`RootLayout`](../medusa-agency-boilerplate-storefront/src/app/layout.tsx:14);
  - typed catalog shell contract [`catalogShell`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:325) materialized через [`resolveStoreCatalogIntroSurface()`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/catalog-shell-resolver.ts:15), [`resolveStoreCatalogResultsSurface()`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/catalog-shell-resolver.ts:18), [`resolveCollectionCatalogResultsSurface()`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/catalog-shell-resolver.ts:21), [`resolveFeaturedRailCatalogShellSurface()`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/catalog-shell-resolver.ts:24), [`StoreCatalogIntroSurface`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/catalog-shell-surface.tsx:51), [`CatalogResultsShellSurface`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/catalog-shell-surface.tsx:104) и [`FeaturedRailCatalogShellSurface`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/catalog-shell-surface.tsx:130).
- truthful closure narrative для `Фазы 6` теперь зафиксирован явно:
  - прежний closure verdict был overstated после закрытия базовых preset-driven slices и позже пересмотрен;
  - reopening был признан валидным по трём gap'ам: category browse route вне sanctioned [`catalogShell`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:325) contour, related products вне sanctioned listing surface contract и loading/skeleton state вне card/listing contract;
  - remediation slice по category browse contour закрыт коммитом `adb8df25ed64d9540e36588ee91dc5ff24951009` `fix(storefront): route category browse through catalogShell contour`;
  - remediation slice по related products rail закрыт коммитом `275dc4d823b8203bd1d49364ba4d02211bf42799` `fix(storefront): move related products to sanctioned listing surface contract`;
  - remediation slice по loading/skeleton sync закрыт коммитом `97a4837c483b054d25511f216ee487bf150306b4` `fix(storefront): align skeleton loading states with card surface contract`.
- post-remediation regression/readiness checkpoint зафиксирован как **PASS**:
  - category browse теперь routed через sanctioned `catalogShell` contour;
  - related products rail теперь routed через sanctioned listing surface contract;
  - loading/skeleton state синхронизирован с sanctioned card/listing contract;
  - cross-preset typecheck/build для `atelier` и `market` завершён успешно;
  - storefront `npm run lint` теперь проходит clean, а remaining warnings ограничены только controlled Store API warnings во время static params generation и не относятся к reopened gaps.
- финальный readiness verdict для `Фазы 6` теперь такой: sanctioned preset-driven storefront customization **truthfully закрыта и готова к следующему roadmap stage**;
- после truthful re-closure `Фазы 6` открытых пунктов внутри storefront customization больше нет, а дальнейшие открытые пункты лежат только в следующих roadmap стадиях: **Фаза 7** template/client packaging и **Фаза 8** release-grade checks, CI, staging и production readiness.
- `Phase 7 / tranche 1` `client-init contract and placeholder-safe template baseline` теперь truthfully закрыт closure-коммитом `a96aa81adfd655ddda9b6fea03dacf61c3174737` `feat(template): add client-init contract baseline`.
- канонический baseline tranche 1 materialized в [`Docs/client_init_contract.md`](./client_init_contract.md), а env/source-of-truth narrative синхронизирован с runtime: `MEDUSA_BACKEND_URL`, `NEXT_PUBLIC_BASE_URL` и `NEXT_PUBLIC_DEFAULT_REGION` зафиксированы как optional storefront inputs с safe fallback semantics; `Phase 6` guardrails по [`NEXT_PUBLIC_STOREFRONT_PRESET`](../medusa-agency-boilerplate-storefront/src/lib/env.ts:14) и [`storefront-client-config.ts`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts) остаются неизменными.
- blocking inconsistency между docs/manifest/runtime classification этих ключей была закрыта truthful remediation, после чего повторный review дал verdict **APPROVE**.
- `Phase 7 / tranche 2` теперь materialized как markdown-only packaging step через [`Docs/template_release_handoff.md`](./template_release_handoff.md): этот artifact является canonical source of truth для template release checklist, onboarding path и clean release-package contour.
- текущий packaging step truthfully ограничен docs/readiness/handoff narrative: он не переоткрывает `Фазу 6`, не делает overclaim про `Фазу 8` и не смешивается с unrelated working-tree changes вроде `payload-cms`, backend marketing work или несвязанных storefront refactor paths.
- новый человек теперь должен читать `Phase 7` так: tranche 1 = canonical init contract baseline в [`Docs/client_init_contract.md`](./client_init_contract.md), tranche 2 = canonical handoff/release packaging narrative в [`Docs/template_release_handoff.md`](./template_release_handoff.md).

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
   - считать order lifecycle notifications v1 уже реализованным как первый production-like customer-facing slice с anti-duplicate contract поверх existing notification storage, включая shipped, failed-payment и canceled expansions;
   - считать `UniSender email migration v1`, `post-UniSender cleanup-step`, `VK Community Messaging v1 foundation`, `storefront core baseline v1`, `VK ID v1`, `MTS Exolve`, `marketing layer v1` и `Payload CMS v1` закрытыми workstreams;
   - считать payment v1 подтвержденным YooKassa-first path;
   - считать shipping v1 подтверждённым ApiShip-first rate-selection slice `cheapest_only_v1` — runtime-проверка `2026-04-18` пройдена;
   - считать **bootstrap idempotency hardening v1** подтвержденным runtime validation;
   - считать checkout end-to-end validation v1 закрытым подтвержденным runtime/E2E результатом;
   - считать payload content layer закрытым commit-уровнем, validation PASS по [`payload:types`](../package.json:25), [`payload:importmap`](../package.json:26), [`payload:build`](../package.json:23) и review-level residual observations без blocking findings;
   - использовать [template_readiness_regression.md](./template_readiness_regression.md) как source of truth по локальным regression-командам и failure signals;
   - считать storefront production build перед `Фазой 6` защищённым от обязательной live-зависимости на backend во время SSG static params collection;
   - считать **Фазу 6 storefront customization** truthfully закрытой только после уже зафиксированного reopen/remediation cycle: sanctioned preset-driven stack materialized, три reopened gap'а закрыты remediation-коммитами, post-remediation cross-preset checkpoint зафиксирован как PASS, поэтому повторно Phase 6 не переоткрывать без нового evidence и использовать authenticated smoke path только как отдельный regression anchor вне storefront customization scope.
7. Не начинать template release или phase `7/8` work, пока по плану не дойдем до соответствующих фаз после **Фазы 6**.
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
