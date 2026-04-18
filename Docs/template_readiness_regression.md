# Template Readiness Regression Pack

> Статус документа: канонический regression-pack для локальной проверки template readiness по состоянию на `2026-04-17`
>
> Назначение: зафиксировать минимальный, воспроизводимый и профессиональный набор проверок для уже реализованных критичных путей без построения отдельного CI-контура.

---

## 1. Что именно покрывает этот regression-pack

Этот regression-pack формализует только уже реализованные и подтвержденные critical paths:

1. bootstrap path через `scripts/bootstrap.sh`;
2. notification smoke через `POST /admin/notifications/smoke`;
3. YooKassa runtime path через:
   - `GET /store/payment/yookassa`;
   - `GET /store/payment/yookassa/return`;
   - `POST /yookassa/webhook`;
4. текущий поддерживаемый ApiShip scope через `GET /store/apiship/rates` как `cheapest_only_v1` + safe-by-default env semantics.

Этот документ не расширяет scope до полноценного test framework, e2e harness или CI redesign.

---

## 2. Общие правила перед прогоном

### Обязательные предпосылки

Перед любым regression pass предполагается:

1. из корня репозитория создан локальный root `.env` из `.env.example`;
2. root orchestration остается канонической точкой входа;
3. разработчик работает из корня репозитория, а не из отдельных подпроектов;
4. для базового regression pass не требуются обязательные внешние notification/payment/shipping secrets.

### Базовые команды подготовки

Минимальная подготовка:

```bash
cp .env.example .env
npm run bootstrap
npm run preflight
```

Если нужен runtime-pass с backend:

```bash
npm run dev
```

### Что считается общим failure signal

Ниже перечислен baseline failure signal, который должен трактоваться как регрессия template readiness, если не объяснен ожидаемым opt-in состоянием:

- `npm run bootstrap` завершается не `0` на clean baseline;
- `npm run preflight` завершается не `0` после успешного bootstrap;
- storefront `.env.local` сохраняет placeholder `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=REPLACE_WITH_ROOT_BOOTSTRAP` после успешного bootstrap;
- backend health-check не отвечает на `/health` после ожидаемого старта;
- opt-in integration path начинает требовать секреты для baseline startup.

---

## 3. Regression 01 — bootstrap baseline and bootstrap hardening

### Цель

Подтвердить, что bootstrap остается каноническим template-ready входом в проект и не ломает publishable key propagation.

### Канонические команды

#### Проверка clean baseline

```bash
cp .env.example .env
npm run bootstrap
npm run preflight
npm run smoke:backend
```

#### Проверка dirty-db rerun

```bash
npm run bootstrap
```

### Что должно быть true

- `npm run bootstrap` завершается с exit code `0` на clean baseline;
- `npm run bootstrap` повторно завершается с exit code `0` на уже инициализированной БД;
- bootstrap logs заканчиваются сообщениями уровня:
  - `Bootstrap completed.`;
  - `Canonical next step: npm run dev`;
- storefront `.env.local` содержит реальный `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`, а не placeholder;
- `npm run preflight` проходит;
- `npm run smoke:backend` проходит через `/health`.

### Что считается явным regression signal

- missing required root env values для bootstrap baseline;
- bootstrap больше не может извлечь `ROOT_BOOTSTRAP_PUBLISHABLE_KEY=` из seed output;
- bootstrap записывает storefront publishable key при неуспешном seed;
- повторный `npm run bootstrap` создает конфликтное состояние там, где раньше был подтвержден reuse-or-fail path.

### Что допускается как expected hardening failure

Следующий сценарий не считается регрессией, а считается подтвержденной hardening-semantics:

- bootstrap завершается с exit code `1` на конфликтном dirty-state, где нельзя однозначно выбрать baseline publishable key;
- в этом случае storefront `.env.local` не должен обновляться ложным значением.

---

## 4. Regression 02 — canonical authenticated notification smoke

### Цель

Подтвердить, что authenticated smoke path для notifications остается воспроизводимым и baseline-safe.

### Каноническая команда

```bash
npm run smoke:notification
```

Команда делает только минимально необходимое:

1. проверяет backend health;
2. создает fresh secret admin API key через backend helper;
3. извлекает `ROOT_LOCAL_ADMIN_SECRET_API_KEY` из helper output;
4. кодирует `Authorization: Basic <base64(secret_api_key:)>`;
5. вызывает `POST /admin/notifications/smoke`.

### Что должно быть true

- команда завершается с exit code `0`;
- в stdout печатается JSON-ответ smoke route;
- в ответе есть блоки:
  - `ok`;
  - `request`;
  - `auth`;
  - `provider`;
  - `notification`;
- `auth.secret_api_key` равен `true`;
- `provider.requested` и `provider.resolved` отражают текущую runtime-semantics;
- при `NOTIFICATION_EMAIL_PROVIDER=sendgrid` без `SENDGRID_API_KEY` ответ остается успешным, а `provider.fallback_to_local` должен показывать fallback-поведение.

### Что считается regression signal

- helper перестает выдавать fresh secret key signal;
- smoke route больше не принимает canonical Basic auth path;
- response shape route перестает содержать стабильные блоки `ok/request/auth/provider/notification`;
- local baseline начинает требовать внешний email secret для smoke или startup.

---

## 5. Regression 03 — YooKassa runtime path

### Цель

Формализовать source of truth для уже подтвержденного YooKassa-first runtime path без написания отдельного brittle e2e harness.

### Preconditions

Нужен opt-in payment env комплект:

- `YOOKASSA_SHOP_ID`;
- `YOOKASSA_SECRET_KEY`;
- `YOOKASSA_RETURN_URL`;
- `YOOKASSA_STOREFRONT_RETURN_ORIGINS` как явный allowlist для storefront return origin-ов;
- при проверке signed webhook — `YOOKASSA_WEBHOOK_SECRET`;
- для deliberate unsigned-dev check — только явный `YOOKASSA_ALLOW_UNSIGNED_WEBHOOKS=true` в development/test;
- storefront flag `NEXT_PUBLIC_YOOKASSA_ENABLED=true`.

Также нужен checkout-ready runtime state:

```bash
cd medusa-agency-boilerplate && npm run prepare:checkout-runtime
```

После этого используется уже реализованный storefront/backend flow для создания cart и payment session.

### Канонический verification scope

#### A. Payment status route

Route: `GET /store/payment/yookassa?cart_id=<id>&payment_id=<id>`

Что должно быть true:

- при валидном cart/session/payment route отвечает `200`;
- response содержит:
  - `ok: true`;
  - `cart_id`;
  - `payment_session_id`;
  - `payment_id`;
  - `provider_id`;
  - `session_status`;
  - `payment_status`;
  - `confirmation_url`;
  - `can_place_order`.

Expected failure signals:

- `404 cart_payment_session_not_found` если у cart нет payment session;
- `404 yookassa_session_not_found` если у cart нет YooKassa session;
- `400 payment_id_mismatch` если query не совпадает с session data;
- runtime error `YooKassa is not configured...` если route вызывается без согласованного `YOOKASSA_*` комплекта.

#### B. Return route

Route: `GET /store/payment/yookassa/return?cart_id=<id>&payment_id=<id>&country_code=ru&storefront_origin=<url>`

Что должно быть true:

- route отвечает `302` redirect;
- redirect URL ведет на `/{country_code}/checkout`;
- если передан `storefront_origin`, route использует его только когда normalised origin входит в `YOOKASSA_STOREFRONT_RETURN_ORIGINS`; иначе redirect обязан идти на первый allowlisted origin или fallback-origin из `STORE_CORS`, а не на произвольный query URL;
- query string содержит:
  - `step=review`;
  - `yookassa=return`;
  - `provider_id=pp_yookassa_yookassa`;
  - `cart_id=<id>`;
  - `payment_id=<id>` если он был передан.

Expected failure signals:

- route перестает делать redirect на checkout review step;
- route начинает строить redirect на произвольный `http/https` origin вне allowlist вместо backend-controlled origin policy;
- route теряет provider/cart/payment markers, на которые опирается storefront return flow.

#### C. Webhook route

Route: `POST /yookassa/webhook`

Что должно быть true:

- при валидном webhook для существующей session route отвечает `200 { "ok": true }`;
- при webhook для несуществующей session route честно отвечает `202` с `ignored: true` и `reason: session_not_found`;
- при заданном `YOOKASSA_WEBHOOK_SECRET` неверный secret должен давать `401` и `code: invalid_webhook_secret`;
- если `YOOKASSA_WEBHOOK_SECRET` не задан и не включен explicit override `YOOKASSA_ALLOW_UNSIGNED_WEBHOOKS=true` в development/test, route тоже должен давать `401` и `code: invalid_webhook_secret`.

Expected behavior, который не считается регрессией:

- если `YOOKASSA_WEBHOOK_SECRET` не задан, route может принимать unsigned webhook только при явном `YOOKASSA_ALLOW_UNSIGNED_WEBHOOKS=true` в development/test и должен warn-логировать это как controlled-environment override, а не как baseline behavior.

### Почему здесь нет отдельного helper script

Для YooKassa regression-pack сознательно не добавляется новый pseudo-e2e script:

- runtime path уже проходит через реальный checkout/session/provider lifecycle;
- отдельный shell helper быстро стал бы brittle-заглушкой вместо source of truth;
- для этого track важнее стабильно зафиксированные route contracts и failure signals, чем имитация платежного провайдера в bash.

---

## 6. Regression 04 — ApiShip supported scope as `cheapest_only_v1`

### Цель

Зафиксировать поддерживаемый и честно ограниченный shipping contract без попытки обойти внешний account-state blocker.

### Scope этого regression-контракта

Проверяется только следующее:

1. baseline-safe отсутствие обязательного `APISHIP_TOKEN`;
2. safe-by-default semantics для `APISHIP_TEST_MODE`;
3. route contract `GET /store/apiship/rates`;
4. текущая selection semantics как `cheapest_only_v1`.

### Канонические ожидания по env

- пустой `APISHIP_TOKEN` не должен ломать bootstrap, preflight и baseline runtime;
- `APISHIP_TEST_MODE=true` остается шаблонным default;
- пустое или невалидное `APISHIP_TEST_MODE` трактуется как test-mode;
- live разрешен только при явном `APISHIP_TEST_MODE=false`.

### Канонический route contract

Route: `GET /store/apiship/rates?cart_id=<id>&shipping_option_id=<id>`

Что должно быть true:

- response всегда остается честным JSON contract, а не необработанным crash path;
- при наличии тарифов route возвращает:
  - `quotes`;
  - `selected_quote`;
  - `selection_mode: "cheapest_only_v1"`;
- `selected_quote` должен совпадать с самым дешевым элементом отсортированного `quotes`;
- ETA mapping допускает legacy `daysMin/daysMax` и fallback на `workDays*` / `calendarDays*`.

Expected non-crash responses:

- `404`-style contract через JSON `code: cart_not_found`;
- `200` + `code: shipping_address_incomplete`;
- `200` + `code: apiship_option_not_found`;
- `200` + `code: apiship_calculation_unavailable`.

### Что deliberately не считается regression внутри этого pack

Следующее остается внешним или отдельным scope и не должно подменяться ложной кодовой регрессией:

- пустой `/connections` у аккаунта ApiShip;
- отсутствие активных подключений и договоров;
- отсутствие тарифов из-за account-state в кабинете ApiShip;
- полноценный multi-quote checkout UX;
- `providerConnectId` / `extraParams` support.

---

## 7. Минимальные helper artifacts этого pack

В pack добавлен только один operational helper:

- `scripts/notification-smoke.sh`;
- root command `npm run smoke:notification`.

Причина добавления именно этого helper:

- notification smoke уже имеет канонический authenticated contract;
- ручное создание fresh secret key и сборка Basic auth делают локальную проверку шумной;
- helper не меняет бизнес-логику и не строит новый framework, а лишь воспроизводит уже подтвержденный path.

Что сознательно не добавлялось:

- отдельный bootstrap harness;
- отдельный YooKassa e2e runner;
- отдельный ApiShip mock runner;
- новый CI pipeline.

---

## 8. Как использовать этот документ как source of truth

Если нужно понять, что именно прогонять для template readiness, использовать этот документ как канонический regression-pack, а рядом держать:

- `Docs/current_work.md` — operational sequencing;
- `Docs/plan_analysis.md` — честный аудит текущего статуса;
- `Docs/env_contract.md` — env and command contract;
- `.codex/skills/medusa-master-repo/SKILL.md` — быстрый вход агента в текущую verified reality.

Этот regression-pack должен обновляться только когда меняется хотя бы одно из следующих:

- канонический critical path;
- route contract;
- expected success/failure signal;
- минимально необходимый helper command для локальной проверки.
