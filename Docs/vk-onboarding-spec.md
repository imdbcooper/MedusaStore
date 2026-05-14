# VK ID Registration Without Email + Onboarding Flow

Спецификация архитектуры: регистрация через VK ID без email и onboarding-форма после первого входа.

**Статус:** Draft  
**Дата:** 2026-05-14  
**Область:** Backend (vk-id module, callback route), Storefront (onboarding UI, checkout gate)

---

## 1. Проблема

VK ID OAuth может не вернуть email пользователя:
- Пользователь не привязал email к VK-профилю.
- Пользователь отказал в scope `email`.
- VK по техническим причинам не отдал поле.

Текущая реализация в `createVkIdCustomer` (`medusa-agency-boilerplate/src/modules/vk-id.ts:1828`) жёстко требует email:

```typescript
if (!normalizedEmail) {
  throw new VkIdCustomerCreationError("email_required")
}
```

Callback route (`medusa-agency-boilerplate/src/api/store/vk-id/callback/route.ts:402-407`) при отсутствии email возвращает `fallbackReason: "email_required"` — регистрация невозможна.

**Результат:** пользователь без email в VK не может зарегистрироваться через VK ID.

---

## 2. Выбранный подход: Placeholder Email

### Почему не nullable email

Medusa core (`createCustomerAccountWorkflow`) требует `email` в `customerData`. Поле `email` в таблице `customer` имеет NOT NULL constraint + unique index. Делать email nullable потребует:
- Форк/патч Medusa core workflow.
- Миграцию схемы (ALTER TABLE customer ALTER COLUMN email DROP NOT NULL).
- Правку всех downstream workflows (password-reset, email-verification, marketing, notifications).

Это слишком инвазивно для MVP.

### Подход: generated placeholder email

При отсутствии email от VK генерируем детерминированный placeholder:

```
vk_{vk_user_id}@placeholder.internal
```

Свойства:
- **Детерминированный** — повторный вход того же VK-пользователя найдёт существующего customer.
- **Невалидный домен** — `placeholder.internal` не резолвится, письма не уйдут.
- **Уникальный** — привязан к `vk_user_id`.
- **Распознаваемый** — легко отличить от реального email по паттерну.

### Маркер неполного профиля

В `customer.metadata` добавляем:

```json
{
  "onboarding": {
    "status": "pending",
    "missing_fields": ["email"],
    "placeholder_email": true,
    "created_at": "2026-05-14T10:00:00.000Z"
  }
}
```

Когда пользователь заполняет email через onboarding:
- `customer.email` обновляется на реальный.
- `metadata.onboarding.status` → `"completed"`.
- `metadata.onboarding.placeholder_email` → `false`.
- Запускается стандартный email-verification flow.

---

## 3. Данные из VK: расширение scope

### Текущее состояние

`VkIdUserInfoResult.user` уже типизирует `phone`, но `resolveVkIdentity` (`vk-id.ts:999-1029`) не извлекает phone:

```typescript
export type VkIdUserInfoResult = {
  user?: {
    user_id?: string
    first_name?: string
    last_name?: string
    phone?: string      // ← определён, но не используется
    email?: string
    avatar?: string
    sex?: number
    verified?: boolean
    birthday?: string
  }
}
```

### Изменения

1. **Расширить scope** — добавить `phone` к `DEFAULT_VK_ID_SCOPES`:
   ```
   "vkid.personal_info phone"
   ```
   Или через env `VK_ID_SCOPES="vkid.personal_info phone"`.

2. **Расширить `VkResolvedIdentity`**:
   ```typescript
   export type VkResolvedIdentity = {
     provider: "vkid"
     vkUserId: string
     vkPeerId: string
     email: string | null
     emailVerified: boolean
     firstName: string | null
     lastName: string | null
     phone: string | null       // NEW
     avatar: string | null      // NEW
   }
   ```

3. **Обновить `resolveVkIdentity`** — извлекать `phone` и `avatar`:
   ```typescript
   return {
     provider: "vkid",
     vkUserId,
     vkPeerId,
     email,
     emailVerified,
     firstName: normalizeIdentityString(user?.first_name),
     lastName: normalizeIdentityString(user?.last_name),
     phone: normalizeIdentityString(user?.phone),      // NEW
     avatar: normalizeIdentityString(user?.avatar),    // NEW
   } satisfies VkResolvedIdentity
   ```

4. **Сохранять phone в customer** при регистрации:
   ```typescript
   customerData: {
     email: normalizedEmail,  // placeholder или реальный
     first_name: input.firstName || undefined,
     last_name: input.lastName || undefined,
     phone: input.phone || undefined,  // NEW
   }
   ```

5. **Сохранять phone/avatar в metadata.vk_link**:
   ```json
   {
     "vk_link": {
       "provider": "vkid",
       "vk_user_id": "...",
       "vk_peer_id": "...",
       "phone": "+79001234567",
       "avatar": "https://...",
       "phone_verified": true
     }
   }
   ```

---

## 4. Backend Changes

### 4.1. `src/modules/vk-id.ts`

| Изменение | Детали |
|-----------|--------|
| `VkResolvedIdentity` | Добавить `phone: string \| null`, `avatar: string \| null` |
| `resolveVkIdentity` | Извлекать `phone`, `avatar` из `userInfo.user` |
| `createVkIdCustomer` | Убрать hard throw на `email_required`. Генерировать placeholder если email отсутствует. Передавать phone в customerData. Записывать `metadata.onboarding`. |
| `DEFAULT_VK_ID_SCOPES` | Добавить `phone` (или вынести в env) |
| Новая функция `generatePlaceholderEmail(vkUserId: string)` | `vk_${vkUserId}@placeholder.internal` |
| Новая функция `isPlaceholderEmail(email: string)` | Проверка паттерна `@placeholder.internal` |

### 4.2. `src/api/store/vk-id/callback/route.ts`

| Изменение | Детали |
|-----------|--------|
| `tryVkIdRegisterBranch` | Убрать ранний return при `!identity.email`. Вместо этого: если email отсутствует — использовать placeholder, пометить onboarding pending. |
| Redirect после регистрации без email | Добавить query param `?onboarding=pending` к return URL |

### 4.3. Новый API endpoint: `POST /store/customers/me/onboarding`

Назначение: принять email (и опционально phone) от onboarding-формы.

```typescript
// Schema
{
  email?: string       // реальный email для замены placeholder
  phone?: string       // если не получен из VK
}
```

Логика:
1. Проверить авторизацию (authenticated customer).
2. Проверить `metadata.onboarding.status === "pending"`.
3. Если передан email:
   - Нормализовать.
   - Проверить уникальность (нет другого customer с таким email).
   - Обновить `customer.email`.
   - Обновить `emailpass` provider_identity entity_id на новый email.
   - Запустить email-verification flow.
4. Если передан phone:
   - Обновить `customer.phone`.
5. Обновить `metadata.onboarding`:
   - Убрать заполненные поля из `missing_fields`.
   - Если `missing_fields` пуст → `status: "completed"`.
6. Вернуть `{ ok: true, onboarding: { status, missing_fields } }`.

### 4.4. Новый API endpoint: `GET /store/customers/me/onboarding`

Назначение: storefront запрашивает текущий статус onboarding.

Response:
```json
{
  "onboarding": {
    "status": "pending" | "completed",
    "missing_fields": ["email"],
    "placeholder_email": true,
    "has_phone": false
  }
}
```

### 4.5. Изменения в существующих workflows

| Workflow | Изменение |
|----------|-----------|
| `send-email-verification` | Добавить guard: skip если email — placeholder (`isPlaceholderEmail`) |
| `send-password-reset` | Добавить guard: skip если email — placeholder |
| `send-marketing-confirmation` | Добавить guard: skip если email — placeholder |
| `customer-created-email-verification` subscriber | Добавить guard: skip если `metadata.onboarding.placeholder_email === true` |

### 4.6. Env variables

| Variable | Default | Описание |
|----------|---------|----------|
| `VK_ID_SCOPES` | `"vkid.personal_info phone"` | Scopes для VK ID OAuth |
| `VK_ID_ALLOW_NO_EMAIL_REGISTER` | `"true"` | Разрешить регистрацию без email (с placeholder) |

---

## 5. Storefront Changes

### 5.1. Onboarding Banner Component

**Путь:** `medusa-agency-boilerplate-storefront/src/modules/account/components/onboarding-banner/index.tsx`

Мягкий баннер, показываемый на всех страницах аккаунта когда `onboarding.status === "pending"`:

```
┌─────────────────────────────────────────────────────┐
│ 👋 Завершите настройку профиля                      │
│                                                     │
│ Укажите email для получения уведомлений о заказах.  │
│                                                     │
│ [Заполнить →]                                       │
└─────────────────────────────────────────────────────┘
```

- Не блокирует навигацию.
- Ссылка ведёт на `/account/onboarding`.
- Скрывается после `onboarding.status === "completed"`.

### 5.2. Onboarding Page

**Путь:** `medusa-agency-boilerplate-storefront/src/app/[countryCode]/(main)/account/onboarding/page.tsx`

Форма с шагами:

**Шаг 1: Email** (если `missing_fields` содержит `"email"`)
```
┌─────────────────────────────────────────────────────┐
│ Укажите ваш email                                   │
│                                                     │
│ Email нужен для уведомлений о заказах и             │
│ восстановления доступа.                             │
│                                                     │
│ ┌─────────────────────────────────────────────┐     │
│ │ email@example.com                           │     │
│ └─────────────────────────────────────────────┘     │
│                                                     │
│ [Сохранить]                                         │
└─────────────────────────────────────────────────────┘
```

**Шаг 2: Телефон** (если `has_phone === false` и phone не получен из VK)
```
┌─────────────────────────────────────────────────────┐
│ Подтвердите телефон                                  │
│                                                     │
│ Телефон нужен для связи по заказам.                 │
│                                                     │
│ ┌─────────────────────────────────────────────┐     │
│ │ +7 (___) ___-__-__                          │     │
│ └─────────────────────────────────────────────┘     │
│                                                     │
│ [Сохранить]                                         │
└─────────────────────────────────────────────────────┘
```

**Логика пропуска шагов:**
- Если email получен из VK → шаг email пропускается.
- Если phone получен из VK → шаг phone пропускается.
- Если оба получены → onboarding не показывается.

### 5.3. Checkout Gate

**Путь:** Модификация `medusa-agency-boilerplate-storefront/src/modules/checkout/templates/checkout-form/index.tsx`

Перед рендером checkout формы проверяем:
- Если `onboarding.status === "pending"` И `missing_fields` содержит `"email"`:
  - Показать блокирующий баннер:
    ```
    ┌─────────────────────────────────────────────────────┐
    │ ⚠️ Для оформления заказа необходимо указать email   │
    │                                                     │
    │ [Заполнить профиль →]                               │
    └─────────────────────────────────────────────────────┘
    ```
  - Кнопка ведёт на `/account/onboarding`.
  - Checkout форма не рендерится.

**Минимальные требования для checkout:**
- `customer.first_name` — обязательно (обычно есть из VK).
- `customer.phone` ИЛИ phone в shipping address — обязательно.
- `customer.email` не placeholder — желательно, но не блокирует если phone есть.

**Решение:** блокировать checkout только если email — placeholder. Phone из VK считается верифицированным и достаточным для связи.

### 5.4. State Management

Onboarding status загружается:
1. При mount layout аккаунта — `GET /store/customers/me/onboarding`.
2. Кэшируется в Next.js cache tag `"onboarding"`.
3. Инвалидируется после `POST /store/customers/me/onboarding`.

Альтернатива (проще): читать `customer.metadata.onboarding` из уже загруженного customer объекта через `retrieveCustomer()`. Не требует отдельного endpoint для чтения.

**Рекомендация:** использовать `customer.metadata.onboarding` напрямую. Отдельный GET endpoint не нужен — metadata уже доступна через стандартный `GET /store/customers/me`.

### 5.5. Routing

| Route | Назначение |
|-------|-----------|
| `/[countryCode]/account/onboarding` | Onboarding форма |
| `/[countryCode]/account` | Показывает onboarding banner если pending |
| `/[countryCode]/checkout` | Блокирует если placeholder email |

---

## 6. Data Flow Diagram

```
VK ID OAuth
    │
    ▼
┌──────────────────────────────────────────────────────────────┐
│ /api/auth/vk-id/callback (storefront proxy)                  │
│   → forwards to /store/vk-id/callback (backend)              │
└──────────────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────────────┐
│ handleVkIdRegisterBranch                                     │
│                                                              │
│ identity.email exists?                                       │
│   YES → use real email                                       │
│   NO  → generatePlaceholderEmail(identity.vkUserId)          │
│                                                              │
│ identity.phone exists?                                       │
│   YES → save to customer.phone                               │
│   NO  → add "phone" to onboarding.missing_fields            │
│                                                              │
│ createVkIdCustomer(email, phone, firstName, lastName)         │
│ stamp metadata.onboarding = pending/completed                │
└──────────────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────────────┐
│ Redirect to storefront                                       │
│   ?vk_registered=success&onboarding=pending                  │
└──────────────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────────────┐
│ Storefront: Account Page                                     │
│                                                              │
│ customer.metadata.onboarding.status === "pending"?           │
│   YES → show onboarding banner                               │
│   NO  → normal account view                                  │
└──────────────────────────────────────────────────────────────┘
    │
    ▼ (user clicks banner)
┌──────────────────────────────────────────────────────────────┐
│ /account/onboarding                                          │
│                                                              │
│ Step 1: Email (if missing)                                   │
│   → POST /store/customers/me/onboarding { email }            │
│   → triggers email-verification flow                         │
│                                                              │
│ Step 2: Phone (if missing)                                   │
│   → POST /store/customers/me/onboarding { phone }            │
│                                                              │
│ All done → redirect to /account                              │
└──────────────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────────────┐
│ Checkout Gate                                                │
│                                                              │
│ isPlaceholderEmail(customer.email)?                           │
│   YES → block checkout, show "fill profile" CTA             │
│   NO  → normal checkout flow                                 │
└──────────────────────────────────────────────────────────────┘
```

---

## 7. Edge Cases

### 7.1. Повторный вход VK-пользователя с placeholder email

- `findVkIdCustomersByIdentity` ищет по `metadata.vk_link.vk_user_id` — найдёт customer.
- Login flow работает без изменений.
- Onboarding banner продолжает показываться.

### 7.2. Пользователь указывает email, который уже занят

- `POST /store/customers/me/onboarding` проверяет уникальность.
- Если email занят → вернуть ошибку `email_already_exists`.
- Storefront показывает: «Этот email уже используется другим аккаунтом».

### 7.3. VK вернул email при повторном входе (scope изменился)

- Login flow находит customer по `vk_user_id`.
- Если `metadata.onboarding.placeholder_email === true` И identity.email !== null:
  - Автоматически обновить customer.email на реальный.
  - Обновить emailpass entity_id.
  - Пометить onboarding email как completed.
  - Запустить email-verification.

### 7.4. Телефон из VK — верифицированный

- VK отдаёт телефон только после подтверждения на стороне VK.
- Дополнительная верификация не нужна.
- Сохраняем `metadata.vk_link.phone_verified = true`.

### 7.5. Пользователь пытается оформить заказ без email

- Checkout gate блокирует.
- Показывает CTA «Укажите email для оформления заказа».
- После заполнения email — checkout разблокируется.

### 7.6. Placeholder email и forgot-password

- `send-password-reset` workflow проверяет `isPlaceholderEmail` → skip.
- Пользователь не может запросить reset для placeholder.
- После указания реального email — forgot-password работает нормально.

### 7.7. Race condition: два VK callback одновременно

- Существующий `withVkIdRegisterLock` (PG advisory lock) защищает от дублей.
- Placeholder email детерминирован (`vk_{id}@placeholder.internal`) → unique constraint работает.

### 7.8. Onboarding не блокирует навигацию

- Пользователь может:
  - Просматривать каталог.
  - Добавлять товары в корзину.
  - Просматривать аккаунт.
  - Управлять адресами.
- Пользователь НЕ может:
  - Оформить заказ (если email — placeholder).

---

## 8. Миграции

### Database миграции: НЕ НУЖНЫ

- Email остаётся NOT NULL (placeholder заполняет constraint).
- Phone уже nullable в Medusa customer model.
- Все новые данные хранятся в `metadata` (JSONB) — schema change не требуется.

### Auth identity миграции: НЕ НУЖНЫ

- `emailpass` provider_identity создаётся с placeholder email как entity_id.
- При обновлении email — entity_id обновляется через AuthModule API.

---

## 9. Env Changes

Добавить в `.env.example` и `.env.staging.example`:

```env
# VK ID: разрешить регистрацию без email (placeholder email будет сгенерирован)
VK_ID_ALLOW_NO_EMAIL_REGISTER=true

# VK ID: scopes (добавлен phone)
VK_ID_SCOPES="vkid.personal_info phone"
```

---

## 10. Файлы для изменения

### Backend (`medusa-agency-boilerplate/`)

| Файл | Тип изменения |
|------|---------------|
| `src/modules/vk-id.ts` | Modify: VkResolvedIdentity, resolveVkIdentity, createVkIdCustomer, новые helper functions |
| `src/api/store/vk-id/callback/route.ts` | Modify: tryVkIdRegisterBranch — убрать email_required block |
| `src/api/store/customers/me/onboarding/route.ts` | **NEW**: POST endpoint для onboarding |
| `src/api/middlewares.ts` | Modify: добавить matcher для onboarding endpoint |
| `src/workflows/send-email-verification.ts` | Modify: guard для placeholder email |
| `src/workflows/send-password-reset.ts` | Modify: guard для placeholder email |
| `src/workflows/send-marketing-confirmation.ts` | Modify: guard для placeholder email |
| `src/subscribers/customer-created-email-verification.ts` | Modify: guard для placeholder email |
| `.env.example` | Modify: добавить VK_ID_ALLOW_NO_EMAIL_REGISTER, VK_ID_SCOPES |
| `.env.staging.example` | Modify: аналогично |

### Storefront (`medusa-agency-boilerplate-storefront/`)

| Файл | Тип изменения |
|------|---------------|
| `src/app/[countryCode]/(main)/account/onboarding/page.tsx` | **NEW**: onboarding page |
| `src/modules/account/components/onboarding-banner/index.tsx` | **NEW**: banner component |
| `src/modules/account/components/onboarding-form/index.tsx` | **NEW**: form component |
| `src/app/[countryCode]/(main)/account/layout.tsx` | Modify: добавить onboarding banner |
| `src/app/[countryCode]/(main)/account/page.tsx` | Modify: handle onboarding query param |
| `src/modules/checkout/templates/checkout-form/index.tsx` | Modify: checkout gate |
| `src/lib/data/customer.ts` | Modify: добавить submitOnboarding action |
| `src/lib/util/onboarding.ts` | **NEW**: helper для проверки onboarding status |

### Тесты

| Файл | Тип изменения |
|------|---------------|
| `src/modules/__tests__/vk-id-create-customer.unit.spec.ts` | Modify: тесты для placeholder email path |
| `src/api/store/vk-id/callback/__tests__/route.unit.spec.ts` | Modify: тесты для no-email register |
| `src/api/store/customers/me/onboarding/__tests__/route.unit.spec.ts` | **NEW** |
| `src/workflows/__tests__/send-email-verification.unit.spec.ts` | Modify: тест placeholder guard |

---

## 11. Порядок реализации

1. **Backend: vk-id.ts** — расширить VkResolvedIdentity, resolveVkIdentity, добавить placeholder helpers.
2. **Backend: createVkIdCustomer** — убрать hard email requirement, добавить placeholder logic и onboarding metadata.
3. **Backend: callback route** — убрать email_required early return, передавать phone.
4. **Backend: onboarding endpoint** — новый POST /store/customers/me/onboarding.
5. **Backend: workflow guards** — добавить isPlaceholderEmail guards.
6. **Backend: тесты** — обновить и добавить.
7. **Storefront: onboarding page + form** — новая страница.
8. **Storefront: onboarding banner** — баннер в account layout.
9. **Storefront: checkout gate** — блокировка checkout.
10. **Storefront: тесты** — unit тесты для onboarding helpers.
11. **Env/docs** — обновить env examples и документацию.

---

## 12. Безопасность

- Placeholder email использует `.internal` TLD (RFC 6762) — гарантированно не резолвится.
- Onboarding endpoint требует authenticated session.
- Email uniqueness проверяется перед обновлением.
- При смене email обновляется emailpass entity_id — предотвращает account takeover через forgot-password на старый placeholder.
- Phone из VK считается верифицированным — не требует SMS-подтверждения.
- Checkout gate предотвращает заказы без контактных данных.
