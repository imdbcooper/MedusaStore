# Env Contract

> Статус документа: рабочая спецификация окружения по состоянию на `2026-04-17`
>
> Назначение: зафиксировать, какой `.env` за что отвечает в проекте и какие команды теперь считаются каноническими для локальной разработки.

---

## 1. Общая схема

В проекте сейчас есть три слоя переменных окружения:

1. корневой `.env`
2. backend `.env`
3. storefront `.env.local`

Это не три равноправных файла.

Роли распределяются так:
- корневой `.env` управляет инфраструктурой и root-level orchestration;
- backend `.env` управляет runtime Medusa;
- storefront `.env.local` управляет runtime Next.js storefront.

---

## 2. Корневой `.env`

Файл:
[.env](/home/somdev/Projects/medusa-agency-boilerplate/.env)

Шаблон:
[.env.example](/home/somdev/Projects/medusa-agency-boilerplate/.env.example)

Этот файл является главным для:
- `docker compose`;
- root-level скриптов из [package.json](/home/somdev/Projects/medusa-agency-boilerplate/package.json);
- портов локальной разработки;
- user mapping для борьбы с `root-owned` файлами.

Подтвержденные переменные этого слоя:
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `POSTGRES_PORT`
- `REDIS_PORT`
- `MEDUSA_BACKEND_PORT`
- `STOREFRONT_PORT`
- `HOST_UID`
- `HOST_GID`
- `DATABASE_URL`
- `REDIS_URL`
- `NODE_ENV`
- `JWT_SECRET`
- `COOKIE_SECRET`
- `STORE_CORS`
- `ADMIN_CORS`
- `AUTH_CORS`
- `NOTIFICATION_EMAIL_PROVIDER`
- `NOTIFICATION_EMAIL_FROM`
- `SENDGRID_API_KEY`
- `MEDUSA_BACKEND_URL`
- `NOTIFICATION_SMOKE_TO`
- `NOTIFICATION_SMOKE_SUBJECT`
- `NOTIFICATION_SMOKE_MESSAGE`
- `APISHIP_TOKEN`
- `APISHIP_TEST_MODE`
- `YOOKASSA_SHOP_ID`
- `YOOKASSA_SECRET_KEY`
- `YOOKASSA_RETURN_URL`
- `YOOKASSA_STOREFRONT_RETURN_ORIGINS`
- `YOOKASSA_WEBHOOK_URL`
- `YOOKASSA_WEBHOOK_SECRET`
- `YOOKASSA_ALLOW_UNSIGNED_WEBHOOKS`

Примечание:
root-level скрипты используют этот файл как источник портов и значений по умолчанию. Если файла нет, они могут читать `.env.example`, но для реальной работы проекта корневой `.env` должен существовать.

Интеграционные guardrails этого слоя:
- `NOTIFICATION_EMAIL_PROVIDER` и `NOTIFICATION_EMAIL_FROM` описывают только желаемый notification runtime, но не делают внешнего email provider обязательным для baseline;
- `NOTIFICATION_EMAIL_PROVIDER=local` — подтвержденный baseline-default как в [medusa-agency-boilerplate/.env.template](../medusa-agency-boilerplate/.env.template), так и в [.env.example](../.env.example);
- `SENDGRID_API_KEY` — строго **opt-in** секрет для SendGrid path; пустое значение не должно ломать startup, build и runtime, а при `NOTIFICATION_EMAIL_PROVIDER=sendgrid` система должна безопасно падать обратно на local provider;
- `MEDUSA_BACKEND_URL`, `NOTIFICATION_SMOKE_TO`, `NOTIFICATION_SMOKE_SUBJECT` и `NOTIFICATION_SMOKE_MESSAGE` — helper-переменные только для локального authenticated smoke path; они не являются baseline requirement и не должны содержать реальные боевые секреты;
- `APISHIP_TOKEN` — строго **opt-in** переменная для включения ApiShip shipping slice; пустое значение означает, что provider не должен регистрироваться и baseline onboarding, build и runtime не должны ломаться; при этом подтверждённый runtime path `2026-04-18` был проверен именно с production token, без фиксации самого секрета в документации;
- `APISHIP_TEST_MODE` — safe-by-default флаг выбора ApiShip endpoint: шаблонный default теперь `true`, пустое или невалидное значение трактуется как test-mode, а live допускается только при явном `false`; это правило теперь закрыто и на orchestration-слое, потому что [scripts/env-sync.sh](../scripts/env-sync.sh) при отсутствии root-переменной синхронизирует в backend env именно `true`, а не live-значение; подтверждённый runtime path `2026-04-18` был проверен в live-режиме через явное `APISHIP_TEST_MODE=false`;
- `YOOKASSA_SHOP_ID`, `YOOKASSA_SECRET_KEY` и `YOOKASSA_RETURN_URL` остаются opt-in activation set для hosted YooKassa payment path;
- `YOOKASSA_STOREFRONT_RETURN_ORIGINS` задает comma-separated allowlist storefront origin-ов для return redirect; канонический root path `cp .env.example .env` → `npm run bootstrap` должен протаскивать этот ключ в backend env через [scripts/env-sync.sh](../scripts/env-sync.sh), а при отсутствии root-переменной sync пишет детерминированный local default `http://localhost:8000`;
- `YOOKASSA_WEBHOOK_SECRET` больше не означает permissive webhook baseline при пустом значении: unsigned webhook по умолчанию должен отклоняться, а controlled local/dev override допускается только через явный `YOOKASSA_ALLOW_UNSIGNED_WEBHOOKS=true`;
- `YOOKASSA_WEBHOOK_URL` — optional operator-facing URL для настройки уведомлений в YooKassa; root orchestration синхронизирует его в backend env, но startup и baseline onboarding не должны требовать непустого значения;
- в документации и шаблонах допустимо фиксировать только сами имена переменных и их роль, но нельзя записывать реальный пользовательский токен, API key или другой секрет.

---

## 3. Backend `.env`

Файл:
[medusa-agency-boilerplate/.env](/home/somdev/Projects/medusa-agency-boilerplate/medusa-agency-boilerplate/.env)

Шаблон:
[medusa-agency-boilerplate/.env.template](/home/somdev/Projects/medusa-agency-boilerplate/medusa-agency-boilerplate/.env.template)

Этот файл загружается Medusa через `loadEnv(...)` в [medusa-config.ts](/home/somdev/Projects/medusa-agency-boilerplate/medusa-agency-boilerplate/medusa-config.ts:12).

Подтвержденные переменные backend runtime:
- `DATABASE_URL`
- `REDIS_URL`
- `STORE_CORS`
- `ADMIN_CORS`
- `AUTH_CORS`
- `JWT_SECRET`
- `COOKIE_SECRET`
- `NOTIFICATION_EMAIL_PROVIDER`
- `NOTIFICATION_EMAIL_FROM`
- `SENDGRID_API_KEY`
- `MEDUSA_BACKEND_URL`
- `NOTIFICATION_SMOKE_TO`
- `NOTIFICATION_SMOKE_SUBJECT`
- `NOTIFICATION_SMOKE_MESSAGE`
- `YOOKASSA_SHOP_ID`
- `YOOKASSA_SECRET_KEY`
- `YOOKASSA_RETURN_URL`
- `YOOKASSA_STOREFRONT_RETURN_ORIGINS`
- `YOOKASSA_WEBHOOK_URL`
- `YOOKASSA_WEBHOOK_SECRET`
- `YOOKASSA_ALLOW_UNSIGNED_WEBHOOKS`
- `APISHIP_TOKEN`
- `APISHIP_TEST_MODE`

Простыми словами:
если корневой `.env` описывает инфраструктуру и orchestration, то backend `.env` описывает то, как Medusa должна работать как приложение.

### Opt-in integration notes для backend runtime

#### Notifications

- `NOTIFICATION_EMAIL_PROVIDER` нормализуется через [`getNotificationEmailRuntime()`](../medusa-agency-boilerplate/src/modules/notification-email.ts:49) в два значения: `requestedProviderId` и `providerId`.
- `NOTIFICATION_EMAIL_PROVIDER=local` — подтвержденный baseline-default.
- Если requested provider равен `sendgrid`, но `SENDGRID_API_KEY` пустой, runtime остается baseline-safe:
  - Medusa startup, build и runtime не ломаются;
  - в [medusa-config.ts](../medusa-agency-boilerplate/medusa-config.ts:17) фиксируется warn про fallback;
  - итоговый provider definition остается local через [`getNotificationEmailProviderDefinition()`](../medusa-agency-boilerplate/src/modules/notification-email.ts:68).
- `NOTIFICATION_EMAIL_FROM` задает sender для runtime, smoke workflow и `order.placed` lifecycle workflow, но не делает внешний provider обязательным.
- Ни один markdown-документ этого репозитория не должен содержать фактическое значение `SENDGRID_API_KEY` или другого notification secret.

#### Canonical order lifecycle notifications v1 contract

Подтвержденный production-like contract для первого customer-facing notification slice теперь такой:
1. subscriber [`orderPlacedNotificationHandler()`](../medusa-agency-boilerplate/src/subscribers/order-placed-notification.ts:5) слушает trigger `order.placed` через config [`config`](../medusa-agency-boilerplate/src/subscribers/order-placed-notification.ts:31);
2. workflow [`sendOrderPlacedNotificationWorkflow`](../medusa-agency-boilerplate/src/workflows/send-order-placed-notification.ts:147) читает order только в минимальной форме `{ id, display_id, email }` через query [`graph()`](../medusa-agency-boilerplate/src/workflows/send-order-placed-notification.ts:117);
3. canonical recipient rule в `v1` — только `order.email`, без fallback chain на customer, shipping address или другие поля;
4. hardening v1.1 фиксирует anti-duplicate contract для `order.placed`: dedupe authority = existing notification storage, strategy = query-before-create, а canonical match set = `trigger_type + resource_type + resource_id + channel + template + normalized recipient`;
5. normalized recipient вычисляется через [`normalizeNotificationRecipient()`](../medusa-agency-boilerplate/src/modules/notification-email.ts:121) и входит в canonical dedupe identity;
6. при отсутствии order или email workflow делает controlled skip с reason `order_not_found` или `missing_order_email`, а при duplicate match делает controlled skip с reason `duplicate_notification`, а не создает второй notification;
7. Notification Module получает template [`DEFAULT_ORDER_PLACED_NOTIFICATION_TEMPLATE`](../medusa-agency-boilerplate/src/modules/notification-email.ts:13) = `order-placed-v1` и trigger type [`DEFAULT_ORDER_PLACED_NOTIFICATION_TRIGGER_TYPE`](../medusa-agency-boilerplate/src/modules/notification-email.ts:14) = `order.placed.customer.notification_requested`.

Guardrails этого контракта:
- path `subscriber → workflow → Notification Module` считается source of truth для `order lifecycle notifications v1` и hardening v1.1;
- dedupe не выносится в отдельный ledger или новый storage layer: source of truth для duplicate suppression остается existing notification storage;
- duplicate suppression трактуется только как controlled skip с diagnostics и trace fields, а не как второй notification с отдельным status-flow;
- race window в query-before-create dedupe признается и документируется как accepted limitation текущего уровня hardening;
- smoke path через [`sendNotificationSmokeWorkflow`](../medusa-agency-boilerplate/src/workflows/send-notification-smoke.ts:60) и route [`POST()`](../medusa-agency-boilerplate/src/api/admin/notifications/smoke/route.ts:26) остается отдельным baseline/regression anchor и не подменяет order lifecycle runtime;
- для этого lifecycle slice не добавлялись новые обязательные env keys: baseline по-прежнему держится на `NOTIFICATION_EMAIL_PROVIDER`, `NOTIFICATION_EMAIL_FROM` и opt-in `SENDGRID_API_KEY`.

#### Canonical authenticated smoke path

Подтвержденный канонический локальный smoke path теперь такой:
1. создать свежий secret admin API key через helper [`createSecretAdminApiKey()`](../medusa-agency-boilerplate/src/scripts/create-secret-admin-api-key.ts:22);
2. использовать именно свежий `sk_*` token, потому что helper не должен полагаться на reuse старого считанного ключа;
3. закодировать `secret_api_key:` в Basic auth через [`encodeAdminApiKeyAsBasicAuth()`](../medusa-agency-boilerplate/src/modules/notification-email.ts:88);
4. вызвать `POST /admin/notifications/smoke` по URL из [`getNotificationSmokeUrl()`](../medusa-agency-boilerplate/src/modules/notification-email.ts:92) или готовому `curl` из [`getNotificationSmokeCurlCommand()`](../medusa-agency-boilerplate/src/modules/notification-email.ts:96).

Этот путь считается каноническим потому что он подтвержден реальным verification pass и отражает текущий source of truth по аутентифицированному smoke без раскрытия секретов в документации.

##### Что возвращает smoke route

Route [`POST()`](../medusa-agency-boilerplate/src/api/admin/notifications/smoke/route.ts:26) теперь должен возвращать стабильную JSON-форму:
- `ok`
- `request`
- `auth`
- `provider`
- `notification`

Смысл блоков:
- `request` фиксирует `to`, `subject`, `message`, `trigger_type`;
- `auth` фиксирует actor context и факт secret API key auth;
- `provider` фиксирует `requested`, `resolved`, `fallback_to_local`, `from`;
- `notification` фиксирует созданную notification entity.

##### Что считается согласованным contract

- Workflow [`sendNotificationSmokeWorkflow`](../medusa-agency-boilerplate/src/workflows/send-notification-smoke.ts:60) обязан записывать в notification data `provider_requested` и `provider_resolved`.
- Runtime helper [`getNotificationEmailRuntime()`](../medusa-agency-boilerplate/src/modules/notification-email.ts:49) обязан вычислять те же `requested provider` и `resolved provider`.
- Route [`POST()`](../medusa-agency-boilerplate/src/api/admin/notifications/smoke/route.ts:26) обязан отражать этот contract в блоке `provider` ответа.

Именно эта связка теперь считается source of truth для notification hardening v1, а anti-duplicate semantics для `order.placed` дополнительно закреплены в hardening v1.1 через existing notification storage, normalized recipient matching и controlled skip diagnostics.

#### Payments

- `YOOKASSA_SHOP_ID`, `YOOKASSA_SECRET_KEY` и `YOOKASSA_RETURN_URL` включают YooKassa payment initiation только когда реально заданы как согласованный opt-in комплект.
- `YOOKASSA_STOREFRONT_RETURN_ORIGINS` — backend-controlled comma-separated allowlist, которую читает [`buildStorefrontCheckoutReturnUrl()`](../medusa-agency-boilerplate/src/api/store/payment/yookassa/return/route.ts:49): query-параметр `storefront_origin` можно использовать только если его normalised origin входит в allowlist; иначе route падает обратно на первый allowlisted origin или первый origin из `STORE_CORS`, а localhost fallback допустим только в development/test.
- `YOOKASSA_WEBHOOK_SECRET` проверяется в [`verifyYooKassaWebhook()`](../medusa-agency-boilerplate/src/api/yookassa/webhook/shared.ts:91) по `x-yookassa-webhook-secret`, `x-yookassa-secret` или `Authorization: Bearer ...`.
- Пустой `YOOKASSA_WEBHOOK_SECRET` остается baseline-safe только в модели reject-by-default: unsigned webhook должен получать `401`, если не включен явный development/test override `YOOKASSA_ALLOW_UNSIGNED_WEBHOOKS=true`.
- `YOOKASSA_WEBHOOK_URL` может оставаться пустым для baseline startup, но canonical root orchestration должен синхронизировать его в backend env вместе с остальными YooKassa guardrails.
- Пустые `YOOKASSA_*` — это валидный baseline-state для clean clone, пока opt-in интеграция не включена осознанно.
- Подтвержденный checkout runtime/E2E path теперь включает hosted authorization и automatic return обратно в storefront review step до order placement.
- Практический storefront contract для этого return path зафиксирован targeted fixes в [`payment-button/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/checkout/components/payment-button/index.tsx) и [`cookies.ts`](../medusa-agency-boilerplate-storefront/src/lib/data/cookies.ts): storefront не должен вызывать `placeOrder()` до завершения hosted authorization, а cart cookie должна переживать cross-site return.

#### Shipping

- `APISHIP_TOKEN` включает ApiShip fulfillment provider только при непустом значении, что проверяется через [`isApiShipConfigured()`](../medusa-agency-boilerplate/src/modules/apiship.ts:69) и используется в [medusa-config.ts](../medusa-agency-boilerplate/medusa-config.ts:49).
- `APISHIP_TEST_MODE` переключает live and test base URL внутри [`getApiShipProviderOptionsFromEnv()`](../medusa-agency-boilerplate/src/modules/apiship.ts:62) для уже включенного provider.
- Safe default изменен: templates фиксируют `APISHIP_TEST_MODE=true`, а helper [`parseApiShipTestMode()`](../medusa-agency-boilerplate/src/modules/apiship.ts:449) трактует пустое и невалидное значение как test-mode, чтобы local/dev не уходил в live молча.
- Подтверждённый runtime path `2026-04-18` использовал production token и явное `APISHIP_TEST_MODE=false`; это now-fixed source of truth для live-проверки текущего поддерживаемого slice, но не меняет baseline-safe default для clean clone.
- Backend route [`GET()`](../medusa-agency-boilerplate/src/api/store/apiship/rates/route.ts:67) подтверждён runtime-проверкой: targeted fixes в route/data path закрыли blocker, rates из ApiShip/Yandex начали возвращаться.
- Текущий shipping scope честно ограничен до `cheapest_only_v1`: route возвращает `quotes`, `selected_quote` и `selection_mode`, но checkout не считается полноценным multi-quote UX.
- Пустой `APISHIP_TOKEN` — это валидный baseline-state для clean clone: provider не регистрируется, а onboarding, build и runtime остаются рабочими.
- Ни один markdown-документ этого репозитория не должен содержать фактическое значение `APISHIP_TOKEN`.

---

## 4. Storefront `.env.local`

Файл:
[medusa-agency-boilerplate-storefront/.env.local](/home/somdev/Projects/medusa-agency-boilerplate/medusa-agency-boilerplate-storefront/.env.local)

Этот файл нужен storefront для работы с backend и runtime-настройками Next.js.

Подтверждено кодом:
- `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` обязателен, это проверяется в [check-env-variables.js](/home/somdev/Projects/medusa-agency-boilerplate/medusa-agency-boilerplate-storefront/check-env-variables.js:3)
- `MEDUSA_BACKEND_URL` используется в [src/lib/config.ts](/home/somdev/Projects/medusa-agency-boilerplate/medusa-agency-boilerplate-storefront/src/lib/config.ts:5)
- `MEDUSA_BACKEND_URL`, `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` и `NEXT_PUBLIC_DEFAULT_REGION` используются в [src/middleware.ts](/home/somdev/Projects/medusa-agency-boilerplate/medusa-agency-boilerplate-storefront/src/middleware.ts:4)
- `NEXT_PUBLIC_BASE_URL` используется в [src/lib/util/env.ts](/home/somdev/Projects/medusa-agency-boilerplate/medusa-agency-boilerplate-storefront/src/lib/util/env.ts:2)
- `NEXT_PUBLIC_YOOKASSA_ENABLED` остается storefront opt-in flag для payment path и не является baseline requirement, что видно в [medusa-agency-boilerplate-storefront/.env.local.example](../medusa-agency-boilerplate-storefront/.env.local.example)

Практическое правило:
- publishable key хранится здесь;
- backend URL может задаваться здесь;
- root-level скрипты могут подставлять `MEDUSA_BACKEND_URL` и `NEXT_PUBLIC_BASE_URL` сверху, если запуск идет через корневые команды;
- storefront не хранит отдельный ApiShip token, SendGrid API key или secret admin API key и не должен получать эти значения в публичный env;
- текущий первый ApiShip slice использует storefront только как consumer backend route [src/lib/data/apiship.ts](../medusa-agency-boilerplate-storefront/src/lib/data/apiship.ts:22), а все чувствительные integration credentials остаются на backend стороне;
- notification authenticated smoke path является backend-admin concern и не должен переноситься в storefront env;
- cart identity для checkout runtime хранится storefront-side cookie helper [`setCartId()`](../medusa-agency-boilerplate-storefront/src/lib/data/cookies.ts:74), и для подтвержденного YooKassa hosted return path эта cookie policy должна оставаться совместимой с cross-site return;
- подтвержденный source of truth для текущего checkout path — `sameSite: "lax"`, а не `sameSite: "strict"`, потому что strict policy ломала автоматический возврат из hosted payment обратно в review/order placement flow;
- practical guardrail: storefront checkout runtime может считать hosted return успешным только если после возврата сохранены cart state и review step, а вызов order placement происходит уже после завершённой hosted authorization, а не до неё.

---

## 5. Канонические команды локальной разработки

Теперь вход в проект должен идти через корневые команды из [package.json](package.json):

- `npm run env:sync`
- `npm run bootstrap`
- `npm run preflight`
- `npm run dev`
- `npm run infra:up`
- `npm run infra:down`
- `npm run backend:build`
- `npm run storefront:build`
- `npm run smoke:backend`
- `npm run smoke:notification`
- `npm run smoke:storefront`
- `npm run permissions:fix`

Смысл:
разработчик и агент должны входить в проект через корень репозитория, а не вспоминать разрозненные команды по папкам.

### Канонический clean-clone path

Для нового разработчика канонический сценарий теперь такой:
1. `cp .env.example .env`
2. при необходимости поменять только root-level порты и локальные секреты в [.env.example](.env.example) → локальном `.env`
3. `npm run bootstrap`
4. `npm run preflight`
5. `npm run dev`

Root clean-start путь остается каноническим именно в последовательности `bootstrap → preflight → dev`.

Что делает `npm run bootstrap`:
- синхронизирует [medusa-agency-boilerplate/.env](medusa-agency-boilerplate/.env) и [medusa-agency-boilerplate-storefront/.env.local](medusa-agency-boilerplate-storefront/.env.local) из root `.env`, включая YooKassa guardrails `YOOKASSA_STOREFRONT_RETURN_ORIGINS`, `YOOKASSA_WEBHOOK_URL`, `YOOKASSA_WEBHOOK_SECRET` и `YOOKASSA_ALLOW_UNSIGNED_WEBHOOKS`;
- поднимает PostgreSQL и Redis;
- запускает Medusa migration flow для пустой или уже существующей БД;
- запускает application-level seed из [medusa-agency-boilerplate/src/scripts/seed.ts](medusa-agency-boilerplate/src/scripts/seed.ts:166);
- переиспользует уже существующие baseline entity там, где это безопасно и однозначно;
- при конфликтном dirty-state не притворяется успешным bootstrap и не перезаписывает storefront publishable key ложным результатом;
- записывает реальный publishable API key из успешного seed в storefront `.env.local`.

Почему именно этот путь канонический:
- он не зависит от локального SQL dump;
- использует поддерживаемый Medusa CLI migration flow и существующий application-level seed;
- clean-clone path остается рабочим;
- повторный запуск теперь либо доинициализирует недостающие baseline сущности, либо честно short-circuit-ится с диагностикой по конфликтующим baseline entity.

Что на самом деле гарантирует [scripts/preflight.sh](../scripts/preflight.sh):
- проверяет наличие обязательных файлов, базовых команд и валидность `docker compose config`;
- допускает reuse только для compose-owned PostgreSQL, Redis и backend, когда соответствующий сервис уже запущен через `docker compose`;
- не является generic reuse-any-running-runtime checker для произвольного локального состояния;
- при уже занятых локальными процессами портах backend или storefront ожидаемо завершает preflight с ошибкой, если этот reuse не подтвержден как compose-owned path.

Как читать [scripts/dev.sh](../scripts/dev.sh):
- сначала всегда запускается [scripts/preflight.sh](../scripts/preflight.sh);
- затем root orchestration поднимает PostgreSQL, Redis и backend через `docker compose` и ждет backend healthcheck;
- storefront стартует локально только после готовности backend;
- это root orchestration semantics, а не универсальный wrapper поверх произвольного уже собранного локального runtime state.

Guardrail:
- если [medusa-agency-boilerplate-storefront/.env.local](medusa-agency-boilerplate-storefront/.env.local) все еще содержит `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=REPLACE_WITH_ROOT_BOOTSTRAP`, то [scripts/preflight.sh](../scripts/preflight.sh) специально валит preflight и требует сначала выполнить `npm run bootstrap`;
- если bootstrap падает на конфликтном seed-state, [scripts/bootstrap.sh](../scripts/bootstrap.sh) теперь завершает команду с ошибкой и не обновляет `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` в storefront env по неполному или невалидному seed-output;
- уже занятые локальными процессами `9000` и `8000` вне канонического clean-start сценария считаются ожидаемым failure-mode для root preflight, а не нарушением контракта скриптов.

### Ad-hoc local dev/debug path

Если нужен не канонический clean-start, а ручной debug уже собранного локального состояния, это нужно описывать отдельно от root orchestration:
- backend ad-hoc runtime можно поднимать напрямую через `cd medusa-agency-boilerplate && npx medusa develop`;
- storefront runtime можно поднимать отдельно локальными командами внутри `medusa-agency-boilerplate-storefront`;
- такой путь допустим для local dev/debug, но не является контрактом root `preflight` и root `dev`.

Примечание:
- шаблонный [.env.example](.env.example) и текущий root [.env](.env) сейчас выровнены на backend `9000` и storefront `8000`;
- старые notes про workstation-specific `9001` больше не считаются актуальным source of truth.

### Канонический authenticated notification smoke path

После закрытия notification hardening v1 и синхронизации `order lifecycle notifications hardening v1.1` для локальной проверки notifications каноническим считается только такой порядок:
1. оставить `NOTIFICATION_EMAIL_PROVIDER=local` как baseline-default или явно понимать, что `sendgrid` без `SENDGRID_API_KEY` все равно будет разрешен в `local` fallback;
2. создать fresh secret admin API key через helper [`createSecretAdminApiKey()`](../medusa-agency-boilerplate/src/scripts/create-secret-admin-api-key.ts:22);
3. использовать полученный fresh `sk_*` key в Basic auth формате `Authorization: Basic <base64(secret_api_key:)>`;
4. вызвать backend route `POST /admin/notifications/smoke`;
5. проверить в ответе блоки `ok`, `request`, `auth`, `provider`, `notification`.

Для уменьшения ручного шума этот же канонический путь теперь доступен через root helper command:
- `npm run smoke:notification`

Этот helper:
- проверяет backend health;
- создает fresh secret admin API key;
- извлекает `ROOT_LOCAL_ADMIN_SECRET_API_KEY` из helper output;
- кодирует Basic auth;
- вызывает `POST /admin/notifications/smoke` с JSON payload;
- печатает response как operational smoke result.

Guardrails этого пути:
- docs и templates не должны содержать реальный `sk_*` key;
- docs и templates не должны содержать реальный `SENDGRID_API_KEY`;
- reuse старого уже прочитанного secret token не считается каноническим способом smoke-проверки;
- helper не заменяет route contract и не считается новой baseline requirement;
- authenticated smoke path — opt-in operational path, а не обязательная часть clean onboarding baseline.

Статус по ApiShip и checkout для этого канонического пути:
- отсутствие `APISHIP_TOKEN` считается подтвержденным baseline-safe состоянием;
- наличие `APISHIP_TOKEN` переводит shipping integration в opt-in режим и требует повторного seed для появления shipping option `ApiShip Courier to Address`;
- для local/dev safe default теперь test-only: live endpoint не должен включаться неявно при пустом или невалидном `APISHIP_TEST_MODE`;
- подтверждённый runtime path `2026-04-18` использовал production token и явное `APISHIP_TEST_MODE=false`;
- blocker по текущему slice `cheapest_only_v1` закрыт targeted fixes в route/data path: route подтверждён runtime-проверкой, а ApiShip/Yandex rates начали возвращаться;
- текущая v1 семантика checkout честно ограничена до cheapest-only, а true multi-quote UX и `providerConnectId` / `extraParams` support остаются deferred;
- полная runtime-цепочка `shipping → hosted YooKassa payment → automatic return → review → order placement → confirmed order page` теперь подтверждена end-to-end;
- practical return contract после hosted payment теперь такой: storefront должен вернуться в review state с сохранённым cart context, не вызывать `placeOrder()` до hosted authorization и только затем завершать order placement;
- `order lifecycle notifications v1` уже реализован как первый production-like slice от события `order.placed`, а hardening v1.1 фиксирует anti-duplicate contract через existing notification storage, normalized recipient matching, controlled duplicate suppression и accepted race window;
- smoke baseline остается отдельным regression anchor и не смешивается с lifecycle anti-duplicate contract;
- следующий рекомендуемый workstream после docs sync — **validation order lifecycle notifications v1** и затем commit, а не повторная checkout validation.

---

## 6. Практические правила

- Если сломалась `.medusa` из-за прав, первым делом запускать `npm run permissions:fix`.
- Если нужно понять, что делать прямо сейчас, смотреть [current_work.md](/home/somdev/Projects/medusa-agency-boilerplate/Docs/current_work.md).
- Если нужно понять, куда проект идет дальше, смотреть [master_repo_plan_v2.md](/home/somdev/Projects/medusa-agency-boilerplate/Docs/master_repo_plan_v2.md).
- Если нужно понять, что уже подтверждено, а что еще нет, смотреть [plan_analysis.md](/home/somdev/Projects/medusa-agency-boilerplate/Docs/plan_analysis.md).
- Если нужно понять канонический regression-pack для template readiness, смотреть [template_readiness_regression.md](./template_readiness_regression.md).
- Если нужно понять канонический notification smoke path, опираться на [medusa-agency-boilerplate/src/modules/notification-email.ts](../medusa-agency-boilerplate/src/modules/notification-email.ts), [medusa-agency-boilerplate/src/api/admin/notifications/smoke/route.ts](../medusa-agency-boilerplate/src/api/admin/notifications/smoke/route.ts), [medusa-agency-boilerplate/src/scripts/create-secret-admin-api-key.ts](../medusa-agency-boilerplate/src/scripts/create-secret-admin-api-key.ts) и [scripts/notification-smoke.sh](../scripts/notification-smoke.sh).
