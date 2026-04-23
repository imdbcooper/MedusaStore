# Env Contract

> Статус документа: рабочая спецификация окружения по состоянию на `2026-04-20`
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

## 1.1. Канонический `client-init` contract для Фазы 7 tranche 1

Канонический Phase 7 tranche 1 contract теперь materialized в [`Docs/client_init_contract.md`](./client_init_contract.md).

Этот contract фиксирует:
- один стандартизированный entrypoint через `npm run client:init:contract`;
- inventory client-specific inputs across root/backend/storefront surfaces;
- разделение на `mandatory`, `bootstrap-generated` и `optional` inputs;
- template-safe placeholder baseline без workstation/demo residue в env и storefront branding/legal-contact surfaces.

После closure checkpoint `2026-04-19` этот baseline нужно читать вместе с уже materialized `Phase 7 / tranche 2` artifact в [`Docs/template_release_handoff.md`](./template_release_handoff.md):
- tranche 1 остается узким source of truth именно для init/env contract baseline;
- tranche 2 является canonical handoff/release packaging narrative для checklist, onboarding path и clean release-package contour;
- это не означает вход в `Фазу 8` и не меняет scope текущего env-документа.

После repeat closure-check `2026-04-20` нужно дополнительно удерживать:
- `Фаза 7` теперь truthfully закрыта целиком;
- активный следующий roadmap stage = `Фаза 8`;
- baseline integrity contour уже materialized и validated, но это всё ещё не staging/prod hardening contour.

`Фаза 6 storefront customization` при этом не переоткрывается:
- sanctioned preset selector остается [`NEXT_PUBLIC_STOREFRONT_PRESET`](../medusa-agency-boilerplate-storefront/src/lib/env.ts:14);
- sanctioned preset authority остается [`storefront-client-config.ts`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts).

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
- `UNISENDER_API_KEY`
- `UNISENDER_BASE_URL`
- `MEDUSA_BACKEND_URL`
- `NOTIFICATION_SMOKE_TO`
- `NOTIFICATION_SMOKE_SUBJECT`
- `NOTIFICATION_SMOKE_MESSAGE`
- `APISHIP_TOKEN`
- `APISHIP_TEST_MODE`
- `NOTIFICATION_SMS_PROVIDER`
- `MTS_EXOLVE_API_KEY`
- `MTS_EXOLVE_SENDER`
- `MTS_EXOLVE_BASE_URL`
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
- `UNISENDER_API_KEY` и optional `UNISENDER_BASE_URL` — строго **opt-in** backend-only keys для текущего production email path; пустое значение не должно ломать startup, build и runtime, а при `NOTIFICATION_EMAIL_PROVIDER=unisender` система должна безопасно падать обратно на local provider;
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
- `UNISENDER_API_KEY`
- `UNISENDER_BASE_URL`
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
- `NOTIFICATION_SMS_PROVIDER`
- `MTS_EXOLVE_API_KEY`
- `MTS_EXOLVE_SENDER`
- `MTS_EXOLVE_BASE_URL`

Простыми словами:
если корневой `.env` описывает инфраструктуру и orchestration, то backend `.env` описывает то, как Medusa должна работать как приложение.

### Opt-in integration notes для backend runtime

#### Notifications

- `NOTIFICATION_EMAIL_PROVIDER` нормализуется через [`getNotificationEmailRuntime()`](../medusa-agency-boilerplate/src/modules/notification-email.ts:119) в два значения: `requestedProviderId` и `providerId`.
- `NOTIFICATION_EMAIL_PROVIDER=local` — подтвержденный baseline-default.
- Если requested provider равен `unisender`, но `UNISENDER_API_KEY` пустой, runtime остается baseline-safe:
  - Medusa startup, build и runtime не ломаются;
  - в [`medusa-config.ts`](../medusa-agency-boilerplate/medusa-config.ts:17) фиксируется warn про fallback;
  - итоговый provider definition остается local через [`getNotificationEmailProviderDefinition()`](../medusa-agency-boilerplate/src/modules/notification-email.ts:143).
- `NOTIFICATION_EMAIL_FROM` задает sender для runtime, smoke workflow и lifecycle workflows, но не делает внешний provider обязательным.
- Ни один markdown-документ этого репозитория не должен содержать фактическое значение `UNISENDER_API_KEY`, `UNISENDER_BASE_URL` c секретным query/token payload или другого notification secret.

#### Approved communication stack after delivered UniSender, VK, SMS and marketing workstreams

На уровне roadmap уже зафиксированы такие направления:
- `UniSender` — целевой email provider для service и marketing email, уже materialized в runtime;
- `VK Community Messaging` — целевой VK transport для service и marketing messages, уже materialized как opt-in provider/channel;
- `VK ID` — optional auth/identity layer для привязки сайта к VK-каналу пользователя;
- `MTS Exolve` — целевой SMS provider, уже materialized как opt-in transport/channel;
- `marketing layer v1` — уже materialized orchestration слой с metadata-first consent/preferences contract, campaign execution, frequency cap, suppression и delivery journal.

Guardrails для этого env-contract:
- базовый email selector по-прежнему проходит через `NOTIFICATION_EMAIL_PROVIDER`, а backend-only opt-in secret для текущего email transport path материализован как `UNISENDER_API_KEY`;
- `VK Community Messaging v1` уже реализован как отдельный opt-in transport surface и не меняет baseline-safe email contract;
- `VK ID v1` уже materialized как отдельный optional identity-linking surface и не меняет baseline-safe transport startup contract;
- `MTS Exolve` уже materialized как отдельный opt-in SMS transport surface и не меняет baseline-safe startup contract для clean onboarding;
- metadata-first source of truth для marketing consent/preferences теперь живет в [`MarketingPreferences`](../medusa-agency-boilerplate/src/modules/marketing-preferences.ts:37) внутри `customer.metadata.marketing`, а не в отдельном provider-owned storage;
- campaign and audit surface теперь живут в backend-only таблицах [`marketing_campaign`](../medusa-agency-boilerplate/src/modules/marketing-layer.ts:307) и [`marketing_delivery_journal`](../medusa-agency-boilerplate/src/modules/marketing-layer.ts:333);
- storefront не должен получать приватные provider secrets ни для `UniSender`, ни для `VK`, ни для `Exolve`, а для `VK ID` допустим только public feature-flag без client secret;
- `Payload` не должен становиться местом хранения provider secrets, consent truth или delivery journal; его зона ответственности — content, а не transport credentials.

#### Implemented `VK Community Messaging v1` env/runtime contract

Фактически реализованный contract для текущего communication-step теперь такой:
- `VK Community Messaging` введён как **новый Notification Module provider/channel**, а не как замена email runtime в [`getNotificationEmailRuntime()`](../medusa-agency-boilerplate/src/modules/notification-email.ts:119) или [`getNotificationEmailProviderDefinition()`](../medusa-agency-boilerplate/src/modules/notification-email.ts:143);
- baseline-safe startup сохранён: при отсутствии VK env keys backend startup, build, bootstrap, preflight и email runtime не ломаются;
- минимальный opt-in backend contract `v1` материализован через:
  - `NOTIFICATION_VK_PROVIDER` со значениями `disabled | community`, где default = `disabled`;
  - `VK_COMMUNITY_ACCESS_TOKEN` как required secret только при `NOTIFICATION_VK_PROVIDER=community`;
  - `VK_COMMUNITY_GROUP_ID` как required identifier только при `NOTIFICATION_VK_PROVIDER=community`;
  - optional `VK_API_VERSION`;
- новые VK keys добавлены в [`.env.example`](../.env.example) и [`medusa-agency-boilerplate/.env.template`](../medusa-agency-boilerplate/.env.template) как optional и синхронизируются в backend через [`env-sync.sh`](../scripts/env-sync.sh), но storefront `.env.local` и публичные runtime surfaces не получают VK transport secrets;
- provider/runtime surface материализован в [`notification-vk.ts`](../medusa-agency-boilerplate/src/modules/notification-vk.ts:1), а provider registration идёт через [`medusa-config.ts`](../medusa-agency-boilerplate/medusa-config.ts:10) и custom provider [`notification-vk-community.ts`](../medusa-agency-boilerplate/src/modules/notification-vk-community.ts:1);
- runtime фиксирует requested/resolved semantics отдельно: `community` без полного набора credentials controlled-resolve'ится в `disabled`, а [`medusa-config.ts`](../medusa-agency-boilerplate/medusa-config.ts:32) пишет явный warning про disabled fallback;
- sibling VK smoke и lifecycle VK workflows, как и email path, создают notification entity через Notification Module, так что dedupe authority остаётся в existing notification storage;
- canonical recipient для `VK Community Messaging v1` реализован не как email, а как нормализованный `vk_peer_id`; минимальный mapping-source для service notifications `v1` = `customer.metadata.vk_peer_id` через helper [`resolveCustomerVkPeerId()`](../medusa-agency-boilerplate/src/modules/notification-vk.ts:54);
- controlled skip при отсутствии customer linkage или `customer.metadata.vk_peer_id` считается нормальной baseline-semantics для opt-in VK rollout, а не runtime error.

#### Implemented `VK ID v1` env/runtime contract

Фактически реализованный contract для optional identity-linking шага теперь такой:
- `VK ID` введён как отдельный auth and linking helper surface поверх already delivered VK transport, а не как transport replacement или prerequisite для `VK Community Messaging`;
- baseline-safe startup сохранён: при отсутствии VK ID env keys backend startup, build, bootstrap, preflight, existing VK transport и storefront baseline runtime не ломаются;
- минимальный opt-in backend contract materialized через `VK_ID_ENABLED`, `VK_ID_CLIENT_ID`, `VK_ID_CLIENT_SECRET`, `VK_ID_REDIRECT_URI`, optional `VK_ID_SCOPES`, `VK_ID_SESSION_SECRET`, `VK_ID_STOREFRONT_RETURN_ORIGINS` в [`.env.example`](../.env.example), [`medusa-agency-boilerplate/.env.template`](../medusa-agency-boilerplate/.env.template) и root sync path [`env-sync.sh`](../scripts/env-sync.sh:95);
- storefront получает только public feature-flag `NEXT_PUBLIC_VK_ID_ENABLED` в [`medusa-agency-boilerplate-storefront/.env.local.example`](../medusa-agency-boilerplate-storefront/.env.local.example) и через [`env-sync.sh`](../scripts/env-sync.sh:119), без передачи `VK_ID_CLIENT_SECRET` или других backend-only secrets в public runtime;
- runtime фиксирует requested/resolved semantics отдельно: `VK_ID_ENABLED=true` без полного набора credentials controlled-resolve'ится в disabled linking surface, а profile UI остаётся скрытым при `NEXT_PUBLIC_VK_ID_ENABLED=false`;
- authenticated customer linking routes materialized в [`route.ts`](../medusa-agency-boilerplate/src/api/store/customers/me/vk-id/route.ts), [`route.ts`](../medusa-agency-boilerplate/src/api/store/customers/me/vk-id/start/route.ts), [`route.ts`](../medusa-agency-boilerplate/src/api/store/customers/me/vk-id/unlink/route.ts) и callback [`route.ts`](../medusa-agency-boilerplate/src/api/store/vk-id/callback/route.ts), а storefront account UX — в [`index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/account/components/profile-vk-link/index.tsx);
- metadata contract намеренно legacy-compatible: existing transport-facing truth `customer.metadata.vk_peer_id` сохраняется для delivery compatibility, а structured `customer.metadata.vk_link` хранит provider-aware linking state, `vk_user_id`, `vk_peer_id`, `linked_at`, `last_verified_at`, `link_source`, `link_status`, `unlinked_at` через [`resolveVkLinkState()`](../medusa-agency-boilerplate/src/modules/vk-id.ts:626);
- unlink contract не разрушает historical state: root `vk_peer_id` убирается, а structured `vk_link` остаётся с `link_status=unlinked`, чтобы account UX и diagnostics сохраняли предыдущее состояние;
- return-url и storefront-origin contract зафиксирован как allowlisted opt-in surface, а local fallback допустим только для controlled dev/test semantics внутри [`getAllowedStorefrontOrigins()`](../medusa-agency-boilerplate/src/modules/vk-id.ts:234);
- workstream закрыт после blocker-fix cycle, repeat targeted validation `8/8` tests PASS + backend typecheck PASS и review verdict `approve`.

#### Implemented `MTS Exolve` SMS env/runtime contract

Фактически реализованный contract для optional SMS шага теперь такой:
- `MTS Exolve` введён как **новый Notification Module provider/channel** c `channel = sms`, а не как замена email runtime в [`getNotificationEmailRuntime()`](../medusa-agency-boilerplate/src/modules/notification-email.ts:119) или VK runtime в [`getNotificationVkRuntime()`](../medusa-agency-boilerplate/src/modules/notification-vk.ts:96);
- baseline-safe startup сохранён: при отсутствии SMS env keys backend startup, build, bootstrap, preflight и existing email/VK runtime не ломаются;
- минимальный opt-in backend contract materialized через `NOTIFICATION_SMS_PROVIDER` со значениями `disabled | exolve`, `MTS_EXOLVE_API_KEY`, `MTS_EXOLVE_SENDER` и optional `MTS_EXOLVE_BASE_URL` в [`.env.example`](../.env.example) и [`medusa-agency-boilerplate/.env.template`](../medusa-agency-boilerplate/.env.template);
- runtime/provider resolution материализованы в [`getNotificationSmsRuntime()`](../medusa-agency-boilerplate/src/modules/notification-sms.ts:107) и [`getNotificationSmsProviderDefinition()`](../medusa-agency-boilerplate/src/modules/notification-sms.ts:128): default = `disabled`, а `exolve` без полного набора credentials controlled-resolve'ится обратно в `disabled`;
- [`defineConfig()`](../medusa-agency-boilerplate/medusa-config.ts:98) регистрирует provider `exolve` только при полном configured state, а при `NOTIFICATION_SMS_PROVIDER=exolve` без `MTS_EXOLVE_API_KEY` и/или `MTS_EXOLVE_SENDER` пишет явный warn из [`medusa-config.ts`](../medusa-agency-boilerplate/medusa-config.ts:40);
- provider implementation materialized в [`ExolveNotificationService`](../medusa-agency-boilerplate/src/modules/notification-exolve.ts:29): provider валидирует `api_key` и `sender`, normalizes `base_url`, нормализует phone через [`normalizeSmsPhone()`](../medusa-agency-boilerplate/src/modules/notification-sms.ts:57), отправляет `POST` в Exolve API и пытается извлечь `message_id` из response body;
- canonical admin smoke surface materialized в route [`POST()`](../medusa-agency-boilerplate/src/api/admin/notifications/smoke/sms/route.ts:25) для `/admin/notifications/smoke/sms`, а blocker на boundary закрыт matcher'ом [`defineMiddlewares()`](../medusa-agency-boilerplate/src/api/middlewares.ts:17) для [`"/admin/notifications/smoke/sms"`](../medusa-agency-boilerplate/src/api/middlewares.ts:36), чтобы route получал auth и body validation так же, как sibling smoke routes;
- smoke workflow [`sendSmsNotificationSmokeWorkflow`](../medusa-agency-boilerplate/src/workflows/send-sms-notification-smoke.ts:118) остаётся provider-aware и diagnostics-friendly: при disabled runtime даёт controlled skip `provider_not_configured`, при невалидном номере — `missing_or_invalid_phone`, а при send path пишет notification через existing Notification Module;
- lifecycle SMS recipients для order-like flows materialized через [`resolveOrderLikeSmsRecipient()`](../medusa-agency-boilerplate/src/workflows/notification-sms-shared.ts:71) с canonical fallback chain `shipping_address.phone → billing_address.phone → customer.phone`, а duplicate suppression по-прежнему опирается на existing notification storage;
- repeat targeted validation для workstream подтверждена: `3/3` suites PASS, `12/12` tests PASS, backend typecheck PASS, review verdict `approve`, финальный commit = `b13f6fa93473bb8bc0320566a75d264d60739784`.

#### Implemented `UniSender email migration v1` env/runtime contract

Фактически реализованный contract для текущего communication-stack шага теперь такой:
- migration boundary действительно остался внутри email transport runtime: provider resolution заменён в [`getNotificationEmailRuntime()`](../medusa-agency-boilerplate/src/modules/notification-email.ts:119) и [`getNotificationEmailProviderDefinition()`](../medusa-agency-boilerplate/src/modules/notification-email.ts:143), а lifecycle workflows, subscribers и smoke route не переписывались по поведению;
- `NOTIFICATION_EMAIL_PROVIDER` и `NOTIFICATION_EMAIL_FROM` сохранены как базовый cross-runtime contract;
- `local` остаётся baseline-default и baseline-safe fallback path для clean onboarding, local dev и misconfiguration scenarios;
- `unisender` реализован как opt-in requested provider value для production email path в `v1`, а runtime по-прежнему отдельно фиксирует requested и resolved provider semantics;
- backend-only opt-in secret contract теперь минимально материализован через `UNISENDER_API_KEY` и optional `UNISENDER_BASE_URL`; эти ключи добавлены в [`.env.example`](../.env.example) и [`medusa-agency-boilerplate/.env.template`](../medusa-agency-boilerplate/.env.template) как optional, а не baseline-mandatory;
- runtime fallback expectation реализован так: при `NOTIFICATION_EMAIL_PROVIDER=unisender` без `UNISENDER_API_KEY` runtime controlled-resolve'ится в `local`, а [`medusa-config.ts`](../medusa-agency-boilerplate/medusa-config.ts:17) пишет явный warning про fallback;
- provider registration для `unisender` идёт через custom provider [`notification-unisender.ts`](../medusa-agency-boilerplate/src/modules/notification-unisender.ts:1), который отправляет transactional email через UniSender HTTP API `/ru/transactional/api/v1/email/send.json`, используя `api_key`, `from` и optional `base_url`;
- smoke и lifecycle workflows, включая [`sendNotificationSmokeWorkflow`](../medusa-agency-boilerplate/src/workflows/send-notification-smoke.ts:60), сохраняют provider-agnostic поведение и продолжают писать `provider_requested` / `provider_resolved` diagnostics;
- rollback expectation не изменился: оператор может вернуть `NOTIFICATION_EMAIL_PROVIDER=local` без schema rollback, storefront changes или lifecycle rewiring.

#### Canonical order lifecycle notifications: current contract and shipped-slice extension

Подтвержденный production-like contract для уже реализованного первого customer-facing notification slice такой:
1. subscriber [`orderPlacedNotificationHandler()`](../medusa-agency-boilerplate/src/subscribers/order-placed-notification.ts:5) слушает trigger `order.placed` через config [`config`](../medusa-agency-boilerplate/src/subscribers/order-placed-notification.ts:33);
2. workflow [`sendOrderPlacedNotificationWorkflow`](../medusa-agency-boilerplate/src/workflows/send-order-placed-notification.ts:308) читает order только в минимальной форме `{ id, display_id, email }` через query [`graph()`](../medusa-agency-boilerplate/src/workflows/send-order-placed-notification.ts:117);
3. canonical recipient rule в `v1` — только `order.email`, без fallback chain на customer, shipping address или другие поля;
4. hardening v1.1 фиксирует anti-duplicate contract для `order.placed`: dedupe authority = existing notification storage, strategy = query-before-create, а canonical match set = `trigger_type + resource_type + resource_id + channel + template + normalized recipient`;
5. normalized recipient вычисляется через [`normalizeNotificationRecipient()`](../medusa-agency-boilerplate/src/modules/notification-email.ts:79) и входит в canonical dedupe identity;
6. при отсутствии order или email workflow делает controlled skip с reason `order_not_found` или `missing_order_email`, а при duplicate match делает controlled skip с reason `duplicate_notification`, а не создает второй notification;
7. Notification Module получает template [`DEFAULT_ORDER_PLACED_NOTIFICATION_TEMPLATE`](../medusa-agency-boilerplate/src/modules/notification-email.ts:36) = `order-placed-v1` и trigger type [`DEFAULT_ORDER_PLACED_NOTIFICATION_TRIGGER_TYPE`](../medusa-agency-boilerplate/src/modules/notification-email.ts:38) = `order.placed.customer.notification_requested`.

Реализованный lifecycle slice `order shipped notification v1` теперь такой:
1. subscriber [`orderShippedNotificationHandler()`](../medusa-agency-boilerplate/src/subscribers/order-shipped-notification.ts:9) слушает именно event `shipment.created`, а не `order.fulfillment_created`, потому что в рамках этого slice customer-facing `shipped` трактуется как факт создания shipment, а не факт подготовки fulfillment;
2. event payload contract для `v1` опирается на Medusa event shape `{ id, no_notification }`, где `id` = `fulfillment_id`; subscriber trim-ит и валидирует `id`, а при пустом значении делает ранний warn и skip без запуска workflow;
3. workflow [`sendOrderShippedNotificationWorkflow`](../medusa-agency-boilerplate/src/workflows/send-order-shipped-notification.ts:346) читает fulfillment в минимальной форме `{ id, order.id, order.display_id, order.email }`; tracking links, carrier copy, line-item detail и storefront deep-linking не входят в минимальный query shape `v1`;
4. canonical recipient rule для shipped slice остается таким же строгим, как у placed slice: только `fulfillment.order.email`, без fallback chain на `customer.email`, shipping address fields или admin recipients;
5. если event приходит с `no_notification=true`, workflow делает controlled skip с причиной `no_notification_requested`; это suppression-ветка самого Medusa event contract, а не duplicate path;
6. template and identity для shipped slice отделены от placed slice: template [`DEFAULT_ORDER_SHIPPED_NOTIFICATION_TEMPLATE`](../medusa-agency-boilerplate/src/modules/notification-email.ts:40) = `order-shipped-v1`, trigger type [`DEFAULT_ORDER_SHIPPED_NOTIFICATION_TRIGGER_TYPE`](../medusa-agency-boilerplate/src/modules/notification-email.ts:42) = `shipment.created.customer.notification_requested`, log prefix = `order-shipped-notification`;
7. anti-duplicate strategy переиспользует уже подтвержденный подход из hardening v1.1: dedupe authority = existing notification storage, strategy = query-before-create, canonical match set остается `trigger_type + resource_type + resource_id + channel + template + normalized recipient`, normalized recipient по-прежнему вычисляется через [`normalizeNotificationRecipient()`](../medusa-agency-boilerplate/src/modules/notification-email.ts:79);
8. для shipped slice canonical resource identity = `resource_type=fulfillment` и `resource_id=fulfillment.id`, а не `order.id`, чтобы частичные или повторные shipment'ы одного и того же заказа не подавляли друг друга как ложные дубликаты;
9. реализованные skip paths для `v1`: missing shipment id на subscriber boundary, `no_notification_requested`, `fulfillment_not_found`, `order_not_found`, `missing_order_email`, `duplicate_notification`; sent-path допускается только после успешного query и dedupe miss;
10. observability contract зеркалит placed slice: итоговый info log из subscriber и step-level warn/info logs из workflow включают `status`, `reason`, `order_id`, `display_id`, `fulfillment_id`, `recipient`, `recipient_normalized`, `notification_id`, `dedupe_key`, `duplicate_of_notification_id`, `provider_requested`, `provider_resolved`, `dedupe_strategy`, `dedupe_race_window`, `no_notification`;
11. `payment failed notification v1` теперь реализован как отдельный slice: webhook path в [handleYooKassaWebhook()](../medusa-agency-boilerplate/src/api/yookassa/webhook/shared.ts:15) после `process-payment-workflow` публикует внутренний event `payment_session.failed.customer.notification_requested` только для terminal failed `payment_status=canceled`; subscriber [`paymentFailedNotificationHandler()`](../medusa-agency-boilerplate/src/subscribers/payment-failed-notification.ts:15) запускает workflow [`sendPaymentFailedNotificationWorkflow`](../medusa-agency-boilerplate/src/workflows/send-payment-failed-notification.ts:508), template/identity отделены через [`DEFAULT_PAYMENT_FAILED_NOTIFICATION_TEMPLATE`](../medusa-agency-boilerplate/src/modules/notification-email.ts:44) = `payment-failed-v1`, [`DEFAULT_PAYMENT_FAILED_NOTIFICATION_TRIGGER_TYPE`](../medusa-agency-boilerplate/src/modules/notification-email.ts:46) = `payment_session.failed.customer.notification_requested`, а dedupe boundary зафиксирована как `resource_type=payment_session` и `resource_id=payment_session.id`;
12. canonical recipient rule для failed-payment slice остается строгой: используется только `cart.email`, без fallback chain; controlled skip paths включают `payment_session_not_found`, `non_terminal_payment_state`, `payment_already_completed`, `payment_collection_not_found`, `cart_link_not_found`, `cart_not_found`, `missing_cart_email`, `duplicate_notification`, а observability contract расширен полями `payment_session_id`, `payment_collection_id`, `cart_id`, `order_id`, `payment_id`, `provider_id`, `payment_status`, `payment_session_status`, `recipient`, `recipient_normalized`, `notification_id`, duplicate metadata, `provider_requested`, `provider_resolved`, `dedupe_strategy`, `dedupe_race_window`, `source`;
13. `order canceled notification v1` теперь зафиксирован как следующий designed slice: subscriber должен слушать официальный Medusa event `order.canceled` с payload `{ id }`, workflow читает order в минимальной форме `{ id, display_id, email, canceled_at }`, canonical recipient = только `order.email`, template = `order-canceled-v1`, trigger type = `order.canceled.customer.notification_requested`, а dedupe boundary остается order-level: `resource_type=order` и `resource_id=order.id`;
14. controlled skip/non-send contract для canceled slice такой: ранний subscriber skip при отсутствии `id`, workflow skip paths = `order_not_found`, `order_not_canceled`, `missing_order_email`, `duplicate_notification`; sent-path допускается только после подтвержденного `canceled_at`, canonical recipient и dedupe miss; отдельная ветка `no_notification` здесь не проектируется;
15. observability contract для canceled slice зеркалит placed/shipped и не смешивается с refund/dispute телеметрией: итоговый info log из subscriber и step-level warn/info logs из workflow должны включать `status`, `reason`, `order_id`, `display_id`, `canceled_at`, `recipient`, `recipient_normalized`, `notification_id`, `dedupe_key`, `duplicate_of_notification_id`, `provider_requested`, `provider_resolved`, `dedupe_strategy`, `dedupe_race_window`; targeted validation должна подтверждать single send, missing recipient skip, `order_not_canceled`, duplicate reprocessing того же `order.id` и отсутствие ложного dedupe между двумя разными canceled orders одного recipient;
16. non-goals для текущего lifecycle scope теперь формулируются явно: здесь не проектируются refunds, returns/exchanges, payment disputes/chargebacks, multi-recipient routing, tracking URL rendering, storefront account links, SMS/push channels, новый storage-level lock или новые обязательные env keys.

Guardrails этого контракта:
- path `subscriber → workflow → Notification Module` остается source of truth для уже реализованных `order.placed`, `shipment.created`, internal failed-payment trigger и для спроектированного `order.canceled` slice;
- dedupe не выносится в отдельный ledger или новый storage layer: source of truth для duplicate suppression остается existing notification storage;
- duplicate suppression трактуется только как controlled skip с diagnostics и trace fields, а не как второй notification с отдельным status-flow;
- race window в query-before-create dedupe признается и документируется как accepted limitation текущего уровня hardening для placed, shipped, failed-payment и designed canceled slice тоже;
- smoke path через [`sendNotificationSmokeWorkflow`](../medusa-agency-boilerplate/src/workflows/send-notification-smoke.ts:60) и route [`POST()`](../medusa-agency-boilerplate/src/api/admin/notifications/smoke/route.ts:26) остается отдельным baseline/regression anchor и не подменяет order lifecycle runtime;
- для этих lifecycle slices не должно появиться новых обязательных env keys: baseline по-прежнему держится на `NOTIFICATION_EMAIL_PROVIDER`, `NOTIFICATION_EMAIL_FROM` и opt-in `UNISENDER_API_KEY`.

#### Canonical authenticated smoke path

Подтвержденный канонический локальный smoke path теперь такой:
1. создать свежий secret admin API key через helper [`createSecretAdminApiKey()`](../medusa-agency-boilerplate/src/scripts/create-secret-admin-api-key.ts:22);
2. использовать именно свежий `sk_*` token, потому что helper не должен полагаться на reuse старого считанного ключа;
3. закодировать `secret_api_key:` в Basic auth через [`encodeAdminApiKeyAsBasicAuth()`](../medusa-agency-boilerplate/src/modules/notification-email.ts:138);
4. вызвать `POST /admin/notifications/smoke` по URL из [`getNotificationSmokeUrl()`](../medusa-agency-boilerplate/src/modules/notification-email.ts:142) или готовому `curl` из [`getNotificationSmokeCurlCommand()`](../medusa-agency-boilerplate/src/modules/notification-email.ts:146).

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
- Runtime helper [`getNotificationEmailRuntime()`](../medusa-agency-boilerplate/src/modules/notification-email.ts:95) обязан вычислять те же `requested provider` и `resolved provider`.
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
- Safe default изменен: templates фиксируют `APISHIP_TEST_MODE=true`, а helper [`parseApiShipTestMode()`](../medusa-agency-boilerplate/src/modules/apiship.ts:461) трактует пустое и невалидное значение как test-mode, чтобы local/dev не уходил в live молча.
- Подтверждённый runtime path `2026-04-18` использовал production token и явное `APISHIP_TEST_MODE=false`; это now-fixed source of truth для live-проверки текущего поддерживаемого slice, но не меняет baseline-safe default для clean clone.
- Backend route [`GET()`](../medusa-agency-boilerplate/src/api/store/apiship/rates/route.ts:67) подтверждён runtime-проверкой: targeted fixes в route/data path закрыли blocker, rates из ApiShip/Yandex начали возвращаться.
- Текущий shipping scope теперь описывается как `provider_aware_v1`: route возвращает `quotes`, `grouped_quotes`, `selected_quote` и `selection_mode`, storefront сохраняет `provider_key` и `tariff_id` в cart shipping method data, а checkout больше не сводится к silent cheapest-only fallback.
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
- optional `NEXT_PUBLIC_STOREFRONT_PRESET` используется в [src/lib/env.ts](/home/somdev/Projects/medusa-agency-boilerplate/medusa-agency-boilerplate-storefront/src/lib/env.ts:14) и [src/lib/storefront-client-config.ts](/home/somdev/Projects/medusa-agency-boilerplate/medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:1) как единственный sanctioned Phase 6 switch между preset scenarios `atelier` и `market`, включая уже закрытые typed [`landingSurfaces`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:317) для `home`, `collectionLanding`, `contentPage`, `postPage`, adjacent typed [`productSurfaces.supportHighlights`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:323), typed listing/card contract [`listingSurfaces.productCard`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:324), typed global shell contract [`StorefrontShellConfig`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:74) и typed catalog shell contract [`StorefrontCatalogShellConfig`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:298)
- `NEXT_PUBLIC_YOOKASSA_ENABLED` остается storefront opt-in flag для payment path и не является baseline requirement, что видно в [medusa-agency-boilerplate-storefront/.env.local.example](../medusa-agency-boilerplate-storefront/.env.local.example)

Практическое правило:
- publishable key хранится здесь и остается единственным storefront env, который preflight действительно hard-require'ит через [`check-env-variables.js`](../medusa-agency-boilerplate-storefront/check-env-variables.js:3);
- `MEDUSA_BACKEND_URL`, `NEXT_PUBLIC_BASE_URL` и `NEXT_PUBLIC_DEFAULT_REGION` — truthful optional storefront runtime inputs для tranche 1 baseline: [`env.ts`](../medusa-agency-boilerplate-storefront/src/lib/env.ts:4) подставляет safe fallback'и `http://localhost:${MEDUSA_BACKEND_PORT || 9000}`, `http://localhost:8000` и `ru`, поэтому отсутствие этих ключей не ломает clean-clone runtime contract;
- backend URL может задаваться здесь;
- root-level скрипты могут подставлять `MEDUSA_BACKEND_URL` и `NEXT_PUBLIC_BASE_URL` сверху, если запуск идет через корневые команды;
- `NEXT_PUBLIC_STOREFRONT_PRESET` остается optional public config: при отсутствии или невалидном значении storefront безопасно откатывается к preset `atelier`, а sanctioned client-specific divergence должна оформляться через preset/config layer, typed landing-surface registry, adjacent product surfaces, typed listing/card contract, typed global shell contract [`StorefrontShellConfig`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:74), typed catalog shell contract [`StorefrontCatalogShellConfig`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:298) и sanctioned resolver boundaries, а не через форк shared templates;
- `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` намеренно остается placeholder-only в template baseline и должен materialize'иться только успешным [`bootstrap.sh`](../scripts/bootstrap.sh:1) после seed, а не ручным копированием из старого клиента;
- `PAYLOAD_CONTENT_PREVIEW_TOKEN`, `PAYLOAD_PREVIEW_SECRET`, `PAYLOAD_REVALIDATE_SECRET` и `REVALIDATE_SECRET` в storefront template baseline теперь намеренно пустые: secret values допускаются только при явном включении соответствующих preview/revalidate hooks;
- storefront не хранит отдельный ApiShip token, `UNISENDER_API_KEY`, `UNISENDER_BASE_URL` с credential-параметрами или secret admin API key и не должен получать эти значения в публичный env;
- текущий первый ApiShip slice использует storefront только как consumer backend route [src/lib/data/apiship.ts](../medusa-agency-boilerplate-storefront/src/lib/data/apiship.ts:22), а все чувствительные integration credentials остаются на backend стороне;
- notification authenticated smoke path является backend-admin concern и не должен переноситься в storefront env;
- cart identity для checkout runtime хранится storefront-side cookie helper [`setCartId()`](../medusa-agency-boilerplate-storefront/src/lib/data/cookies.ts:74), и для подтвержденного YooKassa hosted return path эта cookie policy должна оставаться совместимой с cross-site return;
- подтвержденный source of truth для текущего checkout path — `sameSite: "lax"`, а не `sameSite: "strict"`, потому что strict policy ломала автоматический возврат из hosted payment обратно в review/order placement flow;
- practical guardrail: storefront checkout runtime может считать hosted return успешным только если после возврата сохранены cart state и review step, а вызов order placement происходит уже после завершённой hosted authorization, а не до неё.

---

## 5. Канонические команды локальной разработки

Теперь вход в проект должен идти через корневые команды из [package.json](package.json):

- `npm run client:init:contract`
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

`npm run smoke:backend` нужно читать как probe-only health check для уже поднятого backend runtime через `/health`, а не как startup-команду. Сначала должен быть запущен backend sanctioned path'ом вроде `npm run dev` или отдельно поднятым backend ad-hoc runtime, и только потом допустим этот smoke probe.

Смысл:
разработчик и агент должны входить в проект через корень репозитория, а не вспоминать разрозненные команды по папкам.

### Канонический clean-clone path

Для нового разработчика канонический сценарий теперь такой:
1. `npm run client:init:contract`
2. `cp .env.example .env`
3. при необходимости поменять только root-level порты и локальные секреты в [.env.example](.env.example) → локальном `.env`
4. заменить все mandatory client-specific placeholders из [`Docs/client_init_contract.md`](./client_init_contract.md)
5. `npm run bootstrap`
6. `npm run preflight`
7. `npm run dev`

Root clean-start путь остается каноническим именно в последовательности `client:init:contract → bootstrap → preflight → dev`.

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
- после этого `npm run smoke:backend` можно использовать как отдельный probe готовности уже поднятого backend, но не как замену самому startup path;
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
1. оставить `NOTIFICATION_EMAIL_PROVIDER=local` как baseline-default или явно понимать, что `unisender` без `UNISENDER_API_KEY` все равно будет разрешен в `local` fallback;
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

Runtime/env guardrail этого helper path:
- root `.env` по-прежнему остаётся orchestration-layer source of truth и может содержать `DATABASE_URL` / `REDIS_URL` с docker-network hostnames для compose runtime;
- local helper step `createSecretAdminApiKey()` при этом не должен наследовать эти root connection values, потому что локальный `medusa exec` должен читать backend-local connection settings из [`medusa-agency-boilerplate/.env`](../medusa-agency-boilerplate/.env);
- targeted remediation `2026-04-20` теперь materialized в [`scripts/notification-smoke.sh`](../scripts/notification-smoke.sh:1): helper запускает local admin API key script с очищенными `DATABASE_URL` и `REDIS_URL`, чтобы orchestration env не подменял backend-local runtime contract.

Guardrails этого пути:
- docs и templates не должны содержать реальный `sk_*` key;
- docs и templates не должны содержать реальный `UNISENDER_API_KEY`, credential-bearing `UNISENDER_BASE_URL` или другой notification secret;
- reuse старого уже прочитанного secret token не считается каноническим способом smoke-проверки;
- helper не заменяет route contract и не считается новой baseline requirement;
- authenticated smoke path — opt-in operational path, а не обязательная часть clean onboarding baseline.
- уже materialized communication providers `UniSender` и `VK Community Messaging`, а также будущие tracks `VK ID` и `MTS Exolve`, не должны превращаться в baseline requirement для smoke или clean onboarding вне их explicit opt-in contract.

Статус по ApiShip и checkout для этого канонического пути:
- отсутствие `APISHIP_TOKEN` считается подтвержденным baseline-safe состоянием;
- наличие `APISHIP_TOKEN` переводит shipping integration в opt-in режим и требует повторного seed для появления shipping option `ApiShip Courier to Address`;
- для local/dev safe default теперь test-only: live endpoint не должен включаться неявно при пустом или невалидном `APISHIP_TEST_MODE`;
- подтверждённый runtime path `2026-04-18` использовал production token и явное `APISHIP_TEST_MODE=false`;
- blocker по текущему slice `provider_aware_v1` закрыт targeted fixes в route/data path: route подтверждён runtime-проверкой, grouped rates начали возвращаться, а выбранный тариф сохраняется и используется backend recalculation path;
- текущая v1 семантика checkout теперь честно provider-aware: grouped quotes и выбранный тариф materialized, а `providerConnectId` / `extraParams` support и live multi-provider switching на одном тестовом адресе остаются deferred;
- полная runtime-цепочка `shipping → hosted YooKassa payment → automatic return → review → order placement → confirmed order page` теперь подтверждена end-to-end;
- practical return contract после hosted payment теперь такой: storefront должен вернуться в review state с сохранённым cart context, не вызывать `placeOrder()` до hosted authorization и только затем завершать order placement;
- `order lifecycle notifications v1` уже реализован как первый production-like slice от события `order.placed`, а hardening v1.1 фиксирует anti-duplicate contract через existing notification storage, normalized recipient matching, controlled duplicate suppression и accepted race window;
- `payment failed notification v1`, `order canceled notification v1`, `post-UniSender cleanup-step`, `VK Community Messaging v1 foundation`, `storefront core baseline v1`, `VK ID v1`, `MTS Exolve`, `marketing layer v1`, `Payload CMS v1`, [`Preset-driven landing-surface contract v1`](../plans/preset-driven-landing-surface-contract-v1.md), [`adjacent-preset-rollout-product-support-highlights.md`](../plans/adjacent-preset-rollout-product-support-highlights.md), [`preset-driven-listing-surface-contract-v1.md`](../plans/preset-driven-listing-surface-contract-v1.md), [`preset-driven-global-shell-contract-v1.md`](../plans/preset-driven-global-shell-contract-v1.md) и [`preset-driven-catalog-shell-contract-v1.md`](../plans/preset-driven-catalog-shell-contract-v1.md) уже тоже закрыты как materialized/validated workstreams;
- source of truth для marketing consent/preferences теперь проходит через `customer.metadata.marketing`, а campaign execution semantics остаются single-channel per campaign через [`sendMarketingCampaignWorkflow`](../medusa-agency-boilerplate/src/workflows/send-marketing-campaign.ts:508);
- store/admin surfaces для marketing layer materialized в [`route.ts`](../medusa-agency-boilerplate/src/api/store/customers/me/marketing-preferences/route.ts), [`route.ts`](../medusa-agency-boilerplate/src/api/admin/marketing/campaigns/route.ts) и [`route.ts`](../medusa-agency-boilerplate/src/api/admin/marketing/campaigns/[id]/route.ts), а storefront profile section materialized в [`profile-marketing-preferences/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/account/components/profile-marketing-preferences/index.tsx);
- source of truth для content layer теперь тоже materialized: отдельный app [`payload-cms`](../payload-cms) отвечает за marketing pages, preview/drafts, globals и publish/revalidate lifecycle, а storefront интегрирован с Payload через content client и fallback behaviour для commerce-only режима;
- root orchestration layer теперь включает payload scripts [`payload:dev`](../package.json:22), [`payload:build`](../package.json:23), [`payload:start`](../package.json:24), [`payload:types`](../package.json:25), [`payload:importmap`](../package.json:26), env sync для payload app и blocker-fix через нормализацию `NODE_ENV` в [`scripts/payload-run.sh`](../scripts/payload-run.sh:28), который закрыл residual build blocker `Html should not be imported outside of pages/_document`;
- validation contract для закрытого `Payload CMS v1` зафиксирован как PASS по [`payload:types`](../package.json:25), [`payload:importmap`](../package.json:26) и [`payload:build`](../package.json:23), а review aftermath удерживается как approveable без blocking findings; post-review hardening дополнительно закрыл preview-access residuals для draft globals и preview-exit path.
- `Фаза 6 storefront customization` теперь должна описываться как truthfully re-closed scope, а не как straight-line closure: sanctioned preset selector [`NEXT_PUBLIC_STOREFRONT_PRESET`](../medusa-agency-boilerplate-storefront/src/lib/env.ts:21) и central config authority [`storefront-client-config.ts`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts) не менялись, базовый preset-driven stack [`landingSurfaces`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:317) → [`productSurfaces.supportHighlights`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:323) → [`listingSurfaces.productCard`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:324) → [`StorefrontShellConfig`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:74) → [`StorefrontCatalogShellConfig`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:298) materialized на одном storefront core, но прежний closure verdict был пересмотрен после valid reopen.
- reopened gaps зафиксированы явно и уже закрыты remediation-коммитами: category browse contour через `adb8df25ed64d9540e36588ee91dc5ff24951009`, related products rail через `275dc4d823b8203bd1d49364ba4d02211bf42799`, loading/skeleton sync через `97a4837c483b054d25511f216ee487bf150306b4`.
- финальный post-remediation cross-preset regression/readiness pass по preset matrix `atelier|market` зафиксирован как **PASS**: category browse routed через sanctioned `catalogShell`, related products rail routed через sanctioned listing surface contract, loading/skeleton state синхронизирован с sanctioned card/listing contract; accepted non-blocking baseline observations теперь ограничены controlled Store API warnings during static params generation, соответствующими baseline в [`template_readiness_regression.md`](./template_readiness_regression.md), а storefront [`npm run lint`](../medusa-agency-boilerplate-storefront/package.json:14) после remediation lint stack и hook-dependency cleanup проходит clean.
- следующий рекомендуемый workstream после этого docs sync уже лежит вне `Фазы 6`: readiness verdict = готово к следующему roadmap stage, то есть к **Фазе 7** template/client packaging; Phase 6 preset-driven stack не переоткрывать без нового evidence о regression.

---

## 6. Практические правила

- Если сломалась `.medusa` из-за прав, первым делом запускать `npm run permissions:fix`.
- Если нужно понять, что делать прямо сейчас, смотреть [current_work.md](/home/somdev/Projects/medusa-agency-boilerplate/Docs/current_work.md).
- Если нужно понять, куда проект идет дальше, смотреть [master_repo_plan_v2.md](/home/somdev/Projects/medusa-agency-boilerplate/Docs/master_repo_plan_v2.md).
- Если нужно понять, что уже подтверждено, а что еще нет, смотреть [plan_analysis.md](/home/somdev/Projects/medusa-agency-boilerplate/Docs/plan_analysis.md).
- Если нужно понять канонический regression-pack для template readiness, смотреть [template_readiness_regression.md](./template_readiness_regression.md).
- Если нужно понять канонический notification smoke path, опираться на [medusa-agency-boilerplate/src/modules/notification-email.ts](../medusa-agency-boilerplate/src/modules/notification-email.ts), [medusa-agency-boilerplate/src/api/admin/notifications/smoke/route.ts](../medusa-agency-boilerplate/src/api/admin/notifications/smoke/route.ts), [medusa-agency-boilerplate/src/scripts/create-secret-admin-api-key.ts](../medusa-agency-boilerplate/src/scripts/create-secret-admin-api-key.ts) и [scripts/notification-smoke.sh](../scripts/notification-smoke.sh).
