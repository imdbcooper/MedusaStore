# VK ID Registration Without Email + Onboarding Flow

Спецификация фактической реализации: регистрация через VK ID без email и
onboarding-форма после первого входа.

> **Статус:** Implemented (Phase 5.5).
> **Дата последней синхронизации с кодом:** `2026-05-14`.
> **Область:** Backend (`vk-id` module, callback route, onboarding endpoint,
> checkout gate middleware), Storefront (onboarding page/form/banner,
> profile/checkout integration).

Этот документ — current source of truth по VK onboarding контракту.
Историческая постановка задачи и проектная аргументация частично сохранены,
но все runtime-факты приведены в соответствие с реализацией. При расхождении
этого документа с кодом — побеждает код.

---

## 1. Проблема и принятое решение

VK ID OAuth может не вернуть email пользователя. До Phase 5.5 это блокировало
регистрацию: callback возвращал `fallbackReason: "email_required"`, а
`createVkIdCustomer` бросал `VkIdCustomerCreationError("email_required")`.

Phase 5.5 принял подход **placeholder email + onboarding metadata**:

- Если VK не отдал email, backend генерирует детерминированный
  placeholder `vk_{vk_user_id}@placeholder.internal` через
  [`generatePlaceholderEmail()`](../medusa-agency-boilerplate/src/modules/vk-id.ts:40).
- Customer создаётся через стандартный
  [`createCustomerAccountWorkflow`](../medusa-agency-boilerplate/src/modules/vk-id.ts:1952)
  без форка Medusa.
- На customer ставится `metadata.onboarding` со статусом, описанным в §3.
- Storefront показывает onboarding banner/page и блокирует только cart
  completion, пока email — placeholder.

Результат: пользователь без email в VK регистрируется, входит в аккаунт и
заполняет email постфактум; всё остальное (каталог, корзина, профиль)
остаётся доступным.

---

## 2. Placeholder email contract

| Свойство | Значение |
| --- | --- |
| Формат | `vk_{vk_user_id}@placeholder.internal` |
| Домен | [`PLACEHOLDER_EMAIL_DOMAIN`](../medusa-agency-boilerplate/src/modules/vk-id.ts:33) = `"placeholder.internal"` |
| Generator | [`generatePlaceholderEmail(vkUserId)`](../medusa-agency-boilerplate/src/modules/vk-id.ts:40) |
| Detector | [`isPlaceholderEmail(email)`](../medusa-agency-boilerplate/src/modules/vk-id.ts:48) |
| TLD-семантика | `.internal` (RFC 6762) — не резолвится наружу, письма не уйдут. |
| Уникальность | Привязан к `vk_user_id` → unique constraint Medusa `customer.email` соблюдается. |
| Detect rule | Любой email, заканчивающийся на `@placeholder.internal` (lowercase compare). |

`isPlaceholderEmail` используется:

- onboarding endpoint — определить, обязателен ли email на этом запросе;
- checkout gate middleware — блокировать `cart.complete` до завершения onboarding;
- workflow guards для transactional email (verification/password-reset/marketing)
  — пропускать отправку для placeholder получателей.

---

## 3. Onboarding metadata contract

`customer.metadata.onboarding` ставится один раз при регистрации через
[`buildOnboardingMetadata()`](../medusa-agency-boilerplate/src/modules/vk-id.ts:57)
и затем мутируется только onboarding endpoint'ом.

```jsonc
{
  "status": "pending" | "complete",
  "missing_fields": ["email"],
  "placeholder_email": true,
  "vk_phone_verified": false,
  "created_at": "2026-05-14T10:00:00.000Z",
  "completed_at": "2026-05-14T11:00:00.000Z"
}
```

**Поля:**

- `status` — `"pending"` пока email — placeholder; `"complete"` после
  заполнения реального email. **Внимание:** строка `"complete"`, не
  `"completed"` (см. [`route.ts:50`](../medusa-agency-boilerplate/src/api/store/customers/me/onboarding/route.ts:50) и [`vk-id.ts:67`](../medusa-agency-boilerplate/src/modules/vk-id.ts:67)).
- `missing_fields` — массив имён полей, которые ещё не заполнены. На
  регистрации может содержать `"email"` и/или `"phone"`. **Phone
  семантически опционален**: см. §4.
- `placeholder_email` — boolean, `true` пока `customer.email` соответствует
  placeholder-домену. Выставляется в `false` при первом успешном email update.
- `vk_phone_verified` — `true`, если VK отдал телефон. VK выдаёт телефон
  только после собственной верификации, поэтому отдельного SMS-шага на
  storefront нет.
- `created_at` — ISO timestamp регистрации.
- `completed_at` — ISO timestamp перехода в `"complete"`. Ставится только в
  момент перехода (см. [`route.ts:251-253`](../medusa-agency-boilerplate/src/api/store/customers/me/onboarding/route.ts:251)).

### 3.1. Семантика phone в `missing_fields`

`buildOnboardingMetadata` записывает `"phone"` в `missing_fields`, если VK не
отдал телефон. Однако onboarding endpoint **всегда удаляет `"phone"` из
`missing_fields`** перед расчётом нового статуса
([`route.ts:183-185`](../medusa-agency-boilerplate/src/api/store/customers/me/onboarding/route.ts:183)).
Это сделано осознанно: phone не блокирует завершение onboarding и не блокирует
checkout. Пользователь может никогда не вводить телефон через onboarding и
профиль аккаунта останется в статусе `"complete"` после заполнения email.

Таким образом эффективный required set для перехода в `"complete"` — только
`{"email"}`.

---

## 4. VK identity scope и извлечение phone

VK OAuth scope по умолчанию включает `phone`:

```env
VK_ID_SCOPES="vkid.personal_info phone"
```

Дефолт зафиксирован в
[`DEFAULT_VK_ID_SCOPES`](../medusa-agency-boilerplate/src/modules/vk-id.ts:21) и
переопределяется через env. См. шаблоны
[`.env.example`](../.env.example),
[`.env.staging.example`](../.env.staging.example),
[`medusa-agency-boilerplate/.env.template`](../medusa-agency-boilerplate/.env.template).

`VkResolvedIdentity` дополнен полями `phone: string | null` и
`avatar: string | null`. Они извлекаются из `userInfo.user.phone` /
`userInfo.user.avatar` в `resolveVkIdentity`.

При создании customer:

- `customer.phone` заполняется из `input.phone` если VK его отдал;
- `customer.metadata.vk_link` обогащается `phone`, `avatar`,
  `phone_verified: Boolean(identity.phone)` ([`vk-id.ts:2007-2013`](../medusa-agency-boilerplate/src/modules/vk-id.ts:2007));
- `customer.metadata.onboarding.vk_phone_verified` дублирует тот же флаг для
  storefront UX.

Если VK не отдал телефон, ничего страшного не происходит: пользователь
сможет указать его опционально через onboarding-форму или позже в профиле.

---

## 5. VK ID OAuth state format (Phase 5.5 hardening)

VK ID `/authorize` bridge переписывает `state` в `redirect_state` и удаляет
пунктуацию (`.`, `~`, `:`, `*`) перед финальной auth-страницей. Старый формат
`{base64url-payload}.{signature}` ломался у части пользователей: VK выкидывал
точку и подпись становилась невалидной.

**Текущий формат signed state** ([`vk-id.ts:489-499`](../medusa-agency-boilerplate/src/modules/vk-id.ts:489)):

```
{base64url-payload}{43-char-signature}
```

- payload + signature конкатенируются без разделителя;
- alphabet — base64url (`A-Z a-z 0-9 - _`), VK его не трогает;
- длина signature фиксирована на 43 символа (SHA-256 HMAC, base64url без `=`).

**Backward-compatible read** ([`verifySignedState()`](../medusa-agency-boilerplate/src/modules/vk-id.ts:501)):
если state содержит `.`, читается старый формат `payload.signature`. Это
полезно для local/direct smokes; production-callback от VK по определению
не содержит `.`.

Связанная диагностика — см. troubleshooting `invalid_or_expired_state`.

---

## 6. Backend Implementation Map

### 6.1. `medusa-agency-boilerplate/src/modules/vk-id.ts`

| Символ | Назначение |
| --- | --- |
| [`PLACEHOLDER_EMAIL_DOMAIN`](../medusa-agency-boilerplate/src/modules/vk-id.ts:33) | Константа домена placeholder. |
| [`generatePlaceholderEmail`](../medusa-agency-boilerplate/src/modules/vk-id.ts:40) | Генератор placeholder по `vk_user_id`. |
| [`isPlaceholderEmail`](../medusa-agency-boilerplate/src/modules/vk-id.ts:48) | Детектор placeholder; используется во всех guard-точках. |
| [`buildOnboardingMetadata`](../medusa-agency-boilerplate/src/modules/vk-id.ts:57) | Конструктор `metadata.onboarding` для нового customer. |
| [`DEFAULT_VK_ID_SCOPES`](../medusa-agency-boilerplate/src/modules/vk-id.ts:21) | `"vkid.personal_info phone"`. |
| [`buildSignedState`](../medusa-agency-boilerplate/src/modules/vk-id.ts:489) / [`verifySignedState`](../medusa-agency-boilerplate/src/modules/vk-id.ts:501) | VK-safe compact state format + legacy reader. |
| [`createVkIdCustomer`](../medusa-agency-boilerplate/src/modules/vk-id.ts:1866) | Регистрация: placeholder email + phone из identity + `metadata.onboarding`. |
| [`lookupCustomerByEmail`](../medusa-agency-boilerplate/src/modules/vk-id.ts) | Используется onboarding endpoint для проверки уникальности email. |

### 6.2. `medusa-agency-boilerplate/src/api/store/vk-id/callback/route.ts`

- При `!identity.email` callback не возвращает `email_required`, а
  продолжает регистрацию с placeholder email (см.
  [`route.ts:402-440`](../medusa-agency-boilerplate/src/api/store/vk-id/callback/route.ts:402)).
- Лок-ключ `withVkIdRegisterLock` использует `identity.email ||
  generatePlaceholderEmail(identity.vkUserId)`, чтобы повторные запросы для
  одного и того же VK-пользователя сериализовались.
- При `!identity.vkPeerId` → `redirectWithLoginError(res, returnUrl, "missing_vk_peer_id")`.
- При `runtime.emailTrustPolicy === "reject"` → `fallbackReason:
  "email_trust_policy_reject"`. (Этот режим выключает register branch
  полностью; placeholder здесь не применяется.)
- Успешная регистрация без email добавляет к storefront return URL query
  param `?onboarding=pending` ([`route.ts:518-521`](../medusa-agency-boilerplate/src/api/store/vk-id/callback/route.ts:518)).

### 6.3. `medusa-agency-boilerplate/src/api/store/customers/me/onboarding/route.ts`

`POST /store/customers/me/onboarding` — единственный endpoint этого пути.
GET намеренно **не реализован**: storefront читает onboarding metadata из
обычного `GET /store/customers/me`.

**Validation schema** ([`route.ts:32-45`](../medusa-agency-boilerplate/src/api/store/customers/me/onboarding/route.ts:32)):

```ts
{
  email?: string  // RFC email, max 255, trim+lowercase
  phone?: string  // нормализуется: пробелы/дефисы/скобки удаляются;
                  // допустимые форматы: +7XXXXXXXXXX, 8XXXXXXXXXX, +XXXXXXXXXX..XXXXXXXXXXXXXXX
}
```

**Контракт** ([`route.ts:91-316`](../medusa-agency-boilerplate/src/api/store/customers/me/onboarding/route.ts:91)):

| Условие | HTTP | Code | Семантика |
| --- | --- | --- | --- |
| Нет authenticated customer | `401` | `customer_auth_required` | Клиент не залогинен. |
| `customer` не найден | `404` | `customer_not_found` | Сессия валидна, но customer удалён. |
| `metadata.onboarding` отсутствует или `status === "complete"` | `400` | `onboarding_already_complete` | Onboarding уже завершён или не нужен. |
| Текущий email — placeholder и `body.email` пуст | `400` | `email_required` | Phone один не закрывает onboarding. |
| Передан `email`, но текущий email **не** placeholder | `400` | `email_already_set` | Защита от случайной подмены email. |
| Передан `email`, но он уже занят другим customer | `409` | `email_already_exists` | Уникальность email. |
| Прочая ошибка update | `500` | `update_failed` / `internal_error` | Логируется без PII. |
| Успех | `200` | — | Возвращает обновлённое `onboarding` представление. |

**Response (200)**:

```json
{
  "ok": true,
  "onboarding": {
    "status": "complete",
    "missing_fields": [],
    "placeholder_email": false
  }
}
```

**Поведение при успехе**:

1. `customer.email` обновляется на новый (если был передан и текущий — placeholder).
2. Phone обновляется только если `customer.phone` пуст (повторная установка
   через onboarding не делает overwrite — лог `[onboarding] phone already set ... skipping`).
3. `metadata.onboarding.placeholder_email` → `false`, если email обновлён.
4. `"phone"` всегда удаляется из `missing_fields`.
5. `"email"` удаляется из `missing_fields` при успешном email update.
6. Если `missing_fields` пуст и `placeholder_email = false`, status → `"complete"` и
   ставится `completed_at`.
7. Если email обновлён, очищаются email-verification флаги
   (`email_verified`, `email_verified_at`, `email_verified_for`) — это
   позволяет `customer-created` / verification flow заново выслать письмо
   стандартным subscriber-каналом.

### 6.4. `medusa-agency-boilerplate/src/modules/onboarding-checkout-gate.ts`

Middleware [`enforceOnboardingEmailForCheckout`](../medusa-agency-boilerplate/src/modules/onboarding-checkout-gate.ts:19)
применён только к `POST /store/carts/:id/complete`
([`middlewares.ts:392-396`](../medusa-agency-boilerplate/src/api/middlewares.ts:392)).

Поведение:

- Guest checkout (нет authenticated customer) — pass-through; cart использует
  email из самого cart.
- Авторизованный customer с placeholder email → `400` с телом:

  ```json
  {
    "type": "invalid_data",
    "code": "onboarding_required",
    "message": "Для оформления заказа укажите email",
    "details": {
      "reason": "placeholder_email",
      "action": "complete_onboarding"
    }
  }
  ```

- При infrastructure-ошибке (BD недоступна) middleware **не** блокирует
  checkout — логирует warning и пропускает. Это сознательный fail-open: в
  норме placeholder email отлавливается, при отказе инфраструктуры лучше не
  ронять заказы.

Endpoint `/store/payment-collections/:id/payment-sessions` **не** покрыт этим
middleware (в отличие от ранней постановки задачи). Email обязателен только
на финальной стадии cart completion; promiscuous payment session может быть
создан раньше.

---

## 7. Storefront Implementation Map

### 7.1. Onboarding helpers

[`medusa-agency-boilerplate-storefront/src/lib/util/onboarding.ts`](../medusa-agency-boilerplate-storefront/src/lib/util/onboarding.ts):

- `OnboardingMetadata` тип, дублирующий backend shape;
- `getOnboardingMetadata(customer)` — безопасное чтение;
- `isOnboardingPending(customer)` — `true` если `status === "pending"`.

[`medusa-agency-boilerplate-storefront/src/lib/data/customer.ts`](../medusa-agency-boilerplate-storefront/src/lib/data/customer.ts):

- Server action `submitOnboarding({ email?, phone? })` инкапсулирует POST
  endpoint, прокидывает auth, маппит backend error codes на storefront keys
  (`email_already_exists`, `email_required`, `auth_required`, generic).

### 7.2. Routes и страницы

| Route | Путь | Поведение |
| --- | --- | --- |
| Onboarding form | [`/[countryCode]/account/onboarding/page.tsx`](../medusa-agency-boilerplate-storefront/src/app/[countryCode]/(main)/account/onboarding/page.tsx) | Если customer не залогинен → redirect на `/account`. Если onboarding уже complete → redirect на `/account`. Иначе рендерит форму. |
| Profile | [`/[countryCode]/account/profile/page.tsx`](../medusa-agency-boilerplate-storefront/src/app/[countryCode]/(main)/account/profile/page.tsx) | Unauthenticated → redirect на `/account` (не `notFound()`); это исправлено в commit `15d6304`. Для pending onboarding показывается banner. |
| Banner | [`modules/account/components/onboarding-banner/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/account/components/onboarding-banner/index.tsx) | Мягкий баннер со ссылкой на `/account/onboarding`, не блокирует навигацию. |
| Form | [`modules/account/components/onboarding-form/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/account/components/onboarding-form/index.tsx) | Email required только если `placeholder_email` или `missing_fields` содержит `"email"`. Phone — всегда optional с подсказкой «VK не передал ваш телефон. Можете указать его сейчас или позже в профиле». |
| Checkout gate UI | Storefront рендер checkout проверяет cart customer email, пропуская UI до onboarding если placeholder. Сетевой gate — backend middleware §6.4. |

### 7.3. Логика отображения формы

- `needsEmail = onboarding.placeholder_email || onboarding.missing_fields.includes("email")`.
- Если `needsEmail = true` → видно поле email + поле phone (optional).
- Если `needsEmail = false` → видно только phone (optional). Это путь, когда
  email уже подтверждён, а пользователь просто ничего не указал — в норме
  такая ситуация не возникнет, но fallback корректный.

---

## 8. Environment Variables

| Variable | Default | Источник | Назначение |
| --- | --- | --- | --- |
| `VK_ID_SCOPES` | `"vkid.personal_info phone"` | [`vk-id.ts:21`](../medusa-agency-boilerplate/src/modules/vk-id.ts:21) | OAuth scopes; `phone` нужен для извлечения телефона. |
| `VK_ID_ALLOW_NO_EMAIL_REGISTER` | `true` (по env шаблонам) | [`.env.example`](../.env.example) `:170-173`, [`.env.staging.example`](../.env.staging.example) `:218-221` | Operator-facing flag «разрешить регистрацию без email». **Read-семантика:** в текущей реализации callback не делает прямой gate по этому флагу — placeholder branch включён всегда после реализации Phase 5.5. Флаг сохранён как documentation hook на случай будущего отключения. |
| `VK_ID_EMAIL_TRUST_POLICY` | `any` | Phase 5.3 | `any` пропускает email-verification для VK; `require_verification` обязывает обычный verify; `reject` отключает register branch (placeholder не применяется). |
| `VK_ID_REQUIRE_EMAIL` | — (deprecated) | env шаблоны | **Deprecated, runtime игнорирует.** Оставлен в шаблонах с комментарием для обратной совместимости. |

Storefront использует public flag `NEXT_PUBLIC_VK_ID_ENABLED` для UI; он
читается на build-time (см. troubleshooting `Hydration mismatch`).

---

## 9. Data Flow

```
VK ID OAuth
  │
  ▼
/api/auth/vk-id/callback (storefront proxy, attaches publishable key)
  │  forwards to
  ▼
/store/vk-id/callback (Medusa backend)
  │
  ├── identity.email present?
  │     YES → use real email
  │     NO  → generatePlaceholderEmail(identity.vkUserId)
  │
  ├── identity.phone present?
  │     YES → save to customer.phone, vk_phone_verified=true
  │     NO  → "phone" added to onboarding.missing_fields
  │             (informational; phone is optional for completion)
  │
  ├── createVkIdCustomer (auth identity + emailpass + customer + metadata)
  │
  └── redirect → storefront return URL
        + ?vk_registered=success
        + ?onboarding=pending  (only when email is placeholder)
  │
  ▼
Storefront /account/profile
  │
  ├── isOnboardingPending(customer)?
  │     YES → render OnboardingBanner
  │     NO  → normal account view
  │
  ▼
User clicks banner → /account/onboarding
  │
  ▼
OnboardingForm submit → POST /store/customers/me/onboarding
  │
  ├── email saved → status flips to "complete" (phone always optional)
  │
  ▼
router.refresh() → /account
  │
  ▼
Checkout gate (POST /store/carts/:id/complete)
  │
  └── isPlaceholderEmail(customer.email)?
        YES → 400 onboarding_required
        NO  → continue to apiship readiness gate
```

---

## 10. Edge Cases

| Сценарий | Поведение |
| --- | --- |
| Повторный VK login пользователя с placeholder email | `findVkIdCustomersByIdentity` находит customer по `metadata.vk_link.vk_user_id`. Login flow ничем не отличается. Banner и onboarding gate продолжают работать до email update. |
| Пользователь указывает email, который уже занят | Onboarding endpoint возвращает `409 email_already_exists`. Storefront форма выводит локализованное сообщение. |
| VK впервые отдал email (после расширения scope или подтверждения email в VK) при повторном логине | Текущая реализация **не** делает auto-migrate placeholder→real email на login. Пользователь должен пройти onboarding вручную. (Возможный следующий слайс — оставлен как known limitation.) |
| VK-телефон считается верифицированным | VK выдаёт телефон только после собственной верификации; дополнительный SMS-шаг не требуется. `metadata.vk_link.phone_verified=true`, `metadata.onboarding.vk_phone_verified=true`. |
| Попытка checkout без реального email | Backend middleware блокирует с `onboarding_required`. Storefront показывает CTA «Заполнить профиль». |
| Forgot-password для placeholder email | Workflow guard проверяет `isPlaceholderEmail` и не отправляет письмо (placeholder домен не маршрутизируется). После заполнения реального email forgot-password работает обычным способом. |
| Race: два VK callback одновременно для одного `vk_user_id` | `withVkIdRegisterLock` (PG advisory lock) сериализует запросы. Лок-ключ использует placeholder email если identity.email пуст, поэтому детерминирован. Известная остаточная race для разных email — см. [`Docs/troubleshooting.md`](./troubleshooting.md) §12. |
| Onboarding не блокирует навигацию | Доступны: каталог, корзина, аккаунт, адреса. Заблокировано: только финальный `cart.complete`. |
| `onboarding_already_complete` после успешного завершения | Повторный POST на endpoint вернёт `400 onboarding_already_complete` — это нормальное состояние, storefront не должен его показывать пользователю. |

---

## 11. Migrations

- Database миграции **не нужны**: email остаётся NOT NULL, placeholder
  заполняет constraint; phone уже nullable; всё остальное в `metadata` (JSONB).
- Auth identity миграции **не нужны**: `emailpass` provider_identity создаётся
  с placeholder email как `entity_id` и обновляется в составе onboarding endpoint
  через standard `updateCustomersWorkflow` (внутри Medusa core).

---

## 12. Безопасность

- Placeholder TLD `.internal` (RFC 6762) — гарантированно не резолвится.
- Onboarding endpoint требует authenticated session.
- Email uniqueness проверяется до апдейта.
- При смене email очищаются email-verification флаги — следующий
  verification email уйдёт на новый адрес, а не на placeholder.
- Phone из VK считается верифицированным — отдельный SMS-шаг не нужен.
- Checkout gate предотвращает заказы без реального email.
- Логи endpoint'а намеренно не содержат email/телефон/error message; только
  `customer_id` и `error_length` (см. `[onboarding] update failed customer_id=… error_length=…`).
- VK state HMAC-подпись HMAC-SHA-256 фиксированной длины 43 символа,
  timing-safe сравнение через `timingSafeEqual`.

---

## 13. Тесты

| Файл | Что покрывает |
| --- | --- |
| [`src/modules/__tests__/vk-id-create-customer.unit.spec.ts`](../medusa-agency-boilerplate/src/modules/__tests__/vk-id-create-customer.unit.spec.ts) | Placeholder email path, `metadata.onboarding`, vk_link обогащение. |
| [`src/api/store/vk-id/callback/__tests__/route.unit.spec.ts`](../medusa-agency-boilerplate/src/api/store/vk-id/callback/__tests__/route.unit.spec.ts) | No-email register flow, `?onboarding=pending` redirect, `missing_vk_peer_id`. |
| [`src/api/store/customers/me/onboarding/__tests__/route.unit.spec.ts`](../medusa-agency-boilerplate/src/api/store/customers/me/onboarding/__tests__/route.unit.spec.ts) | Endpoint contract, error codes, completion flag transitions, phone optional. |
| [`src/workflows/__tests__/send-email-verification.unit.spec.ts`](../medusa-agency-boilerplate/src/workflows/__tests__/send-email-verification.unit.spec.ts) | Placeholder guard для verification flow. |

---

## 14. Связанные документы

- [`Docs/env_contract.md`](./env_contract.md) — VK ID env keys и phase notes.
- [`Docs/troubleshooting.md`](./troubleshooting.md) — диагностика
  `invalid_or_expired_state`, `email_required`, `onboarding_required`,
  `missing_vk_peer_id` и других ошибок Phase 5.5.
- [`Docs/architecture.md`](./architecture.md) — где живут callback proxy,
  Store API surface и checkout gate в общей топологии.
- [`Docs/current_work.md`](./current_work.md) — текущее операционное
  состояние slice.
