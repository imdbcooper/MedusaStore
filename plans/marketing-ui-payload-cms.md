# План: UI маркетинговых рассылок в Payload CMS

> Статус: обновлённый план для простой Phase 1
> Дата: 2026-05-15
> Решение: сначала делаем минимальную рабочую email-версию без сложной синхронизации, сегментов и rich-text конвертации.

## Status

- **Phase 1 — Done.** Дата: 2026-05-16.
  - Коллекция: [`payload-cms/src/collections/MarketingCampaigns/index.ts`](../payload-cms/src/collections/MarketingCampaigns/index.ts:1)
  - Launch endpoint: [`payload-cms/src/collections/MarketingCampaigns/launch-endpoint.ts`](../payload-cms/src/collections/MarketingCampaigns/launch-endpoint.ts:1)
  - Launch button: [`payload-cms/src/components/MarketingCampaignLaunchButton/index.tsx`](../payload-cms/src/components/MarketingCampaignLaunchButton/index.tsx:1)
  - Регистрация в Payload config: [`payload-cms/src/payload.config.ts`](../payload-cms/src/payload.config.ts:14)
  - Миграция БД: [`payload-cms/src/migrations/20260516_062031_marketing_campaigns.ts`](../payload-cms/src/migrations/20260516_062031_marketing_campaigns.ts:1) (зарегистрирована в [`payload-cms/src/migrations/index.ts`](../payload-cms/src/migrations/index.ts:1))
  - CLI helper для миграций без TLA-падения: [`payload-cms/scripts/migrate.mjs`](../payload-cms/scripts/migrate.mjs:1)
  - Регенерированы: [`payload-cms/src/payload-types`](../payload-cms/src/payload-types:1) и [`payload-cms/src/app/(payload)/importMap.js`](../payload-cms/src/app/(payload)/importMap.js:1).
  - Verify: `cd payload-cms && npx tsc --noEmit -p tsconfig.json` — без ошибок.
- **Не входило в Phase 1 (отдельные todo для Phase 1.1+):**
  - `Idempotency-Key` header на launch endpoint (сейчас только lite re-read guard);
  - rate-limit на launch endpoint;
  - read-only журнал доставки прямо в карточке кампании;
  - перенос отправки в очередь (Phase 4);
  - статус-документ в `Docs/marketing_ui_status.md`.

---

## 1. Цель

Дать маркетологу простой интерфейс в Payload CMS для создания и запуска email-рассылки через уже существующий Medusa backend.

Phase 1 должна решить только базовую задачу:

- создать черновик email-кампании в Payload;
- отредактировать тему, HTML и plain text;
- выбрать простую аудиторию;
- нажать «Отправить»;
- увидеть результат отправки: selected/sent/skipped/failed;
- не получить дубли кампаний в Medusa при каждом сохранении черновика.

---

## 2. Главное архитектурное решение Phase 1

### Payload — источник черновика

До запуска рассылки кампания живёт только в Payload CMS.

Маркетолог может сколько угодно раз сохранять черновик. Эти сохранения не создают и не обновляют кампанию в Medusa.

### Medusa — источник отправки

Medusa campaign создаётся только в момент нажатия кнопки «Отправить».

Порядок:

1. Payload валидирует черновик.
2. Payload вызывает `POST /admin/marketing/campaigns`.
3. Medusa создаёт campaign в `marketing_campaign`.
4. Payload сохраняет `medusaCampaignId`.
5. Payload вызывает `POST /admin/marketing/campaigns/:medusaCampaignId`.
6. Medusa выполняет отправку через `sendMarketingCampaignWorkflow`.
7. Payload сохраняет итоговую статистику и блокирует кампанию от редактирования.

### Почему не делаем sync on save

В текущем backend есть API для создания кампании, но нет API для обновления кампании.

Если делать `afterChange` sync на каждое сохранение Payload-документа, каждое сохранение может создать новый дубль в Medusa.

Поэтому в Phase 1:

- нет `afterChange` sync в Medusa;
- нет `PATCH /admin/marketing/campaigns/:id`;
- нет двусторонней синхронизации;
- Medusa campaign создаётся только на Launch.

---

## 3. Текущее состояние backend

### Уже реализовано в Medusa backend

| Компонент | Файл | Описание |
|-----------|------|----------|
| Marketing Preferences | `medusa-agency-boilerplate/src/modules/marketing-preferences.ts` | Подписки по email/SMS/VK, global status, pending/subscribed/unsubscribed, double opt-in, suppression |
| Marketing Layer | `medusa-agency-boilerplate/src/modules/marketing-layer.ts` | Campaign CRUD на уровне raw SQL, audience resolution, delivery journal, frequency capping |
| Marketing Unsubscribe | `medusa-agency-boilerplate/src/modules/marketing-unsubscribe.ts` | One-click unsubscribe, token-based links |
| Send Campaign Workflow | `medusa-agency-boilerplate/src/workflows/send-marketing-campaign.ts` | audience → consent check → frequency cap → unsubscribe link → notification → journal |
| Send Confirmation Workflow | `medusa-agency-boilerplate/src/workflows/send-marketing-confirmation.ts` | Double opt-in email |
| Email Template | `medusa-agency-boilerplate/src/modules/email-template.ts` | Branded HTML email template |
| Admin API: List/Create campaigns | `medusa-agency-boilerplate/src/api/admin/marketing/campaigns/route.ts` | `GET /admin/marketing/campaigns`, `POST /admin/marketing/campaigns` |
| Admin API: Get/Launch campaign | `medusa-agency-boilerplate/src/api/admin/marketing/campaigns/[id]/route.ts` | `GET /admin/marketing/campaigns/:id`, `POST /admin/marketing/campaigns/:id` |
| Admin API: Update customer prefs | `PUT /admin/marketing/campaigns?customer_id=...` | Управление подписками конкретного покупателя |
| Store API: Customer prefs | `GET/POST /store/customers/me/marketing-preferences` | Покупатель управляет своими подписками |
| Store API: Confirm | `POST /store/customers/marketing/confirm` | Double opt-in подтверждение |
| Store API: Unsubscribe | `POST/GET /store/customers/marketing/unsubscribe` | Отписка по токену |
| DB tables | PostgreSQL | `marketing_campaign`, `marketing_delivery_journal` |

### Важные ограничения текущего backend

1. Нет `PATCH /admin/marketing/campaigns/:id`.
2. Нет delete/archive campaign endpoint.
3. `POST /admin/marketing/campaigns` всегда создаёт новую кампанию.
4. `POST /admin/marketing/campaigns/:id` запускает workflow синхронно внутри HTTP request.
5. Launch route возвращает HTTP `200 { ok: true, result }` даже при логической ошибке workflow; Payload должен проверять `result.status` и `result.reason`.
6. `audience_filters` сейчас поддерживает только `customer_ids`.
7. Сегменты, city, total spent, last order и другие фильтры ещё не реализованы.

### Модель Medusa campaign

```typescript
{
  id: string
  name: string
  description: string | null
  channel: "email" | "sms" | "vk"
  audience_type: "all" | "email_consent" | "sms_consent" | "vk_consent" | "vk_linked" | "manual"
  audience_filters: { customer_ids?: string[] }
  template: string
  subject: string | null
  content: {
    text?: string
    html?: string
    subject?: string
    message?: string
  }
  status: "draft" | "running" | "completed" | "failed"
  frequency_cap_window_hours: number
  frequency_cap_count: number
  total_selected: number
  total_sent: number
  total_skipped: number
  total_failed: number
  created_by: string | null
  launched_at: string | null
  completed_at: string | null
  last_error: string | null
  created_at: string
  updated_at: string
}
```

---

## 4. Текущее состояние Payload CMS

- Payload CMS — отдельное Next.js приложение в `payload-cms/`.
- Текущие коллекции: `Users`, `Media`, `Pages`, `Posts`.
- Текущие globals: `SiteSettings`, `Navigation`, `Footer`.
- Payload доступен через канонический домен `cms.slavx.ru`; storefront остаётся на `studio.slavx.ru`.
- Rich text editor — Lexical.
- Коллекций для маркетинговых рассылок сейчас нет.
- Пользовательские роли сейчас: `admin`, `editor`.

---

## 5. Scope Phase 1

### Что делаем

1. Payload collection `MarketingCampaigns`.
2. Простое поле для HTML письма как `textarea` или `code`, не Lexical.
3. Email-only campaign.
4. Простые audience types:
   - `all`;
   - `email_consent`;
   - `manual`.
5. Payload custom endpoint `POST /api/marketing-campaigns/:id/launch`.
6. Кнопка «Отправить» в Payload UI.
7. Сохранение `medusaCampaignId` и статистики в Payload.
8. Блокировка редактирования после запуска.
9. Минимальная server-side защита read-only/stat fields.

### Что не делаем в Phase 1

- SMS campaigns.
- VK campaigns.
- Сегменты.
- Audience preview/count.
- Управление подписками покупателей из Payload.
- Rich text → HTML converter.
- Drag-and-drop email builder.
- Email templates library.
- Open/click tracking.
- A/B testing.
- Scheduled campaigns.
- Async queue/worker for large campaigns.
- Full production consent migration.

---

## 6. Payload collection: `MarketingCampaigns`

### Назначение

Коллекция хранит черновик и локальный UI-state кампании.

До запуска это source of truth для маркетолога.

После запуска source of truth по отправке — Medusa campaign и delivery journal, а Payload хранит снимок итоговой статистики.

### Поля Phase 1

| Поле | Тип | Описание |
|------|-----|----------|
| `name` | text, required | Внутреннее название кампании |
| `subject` | text, required | Тема email |
| `channel` | select или hidden | В Phase 1 всегда `email` |
| `audienceType` | select | `all`, `email_consent`, `manual` |
| `audienceCustomerIds` | textarea | Список customer IDs для `manual`, по одному ID на строку или через запятую |
| `htmlContent` | textarea/code, required | Готовая HTML-строка для письма |
| `plainText` | textarea | Plain text fallback |
| `frequencyCapHours` | number, default 24 | Окно frequency cap |
| `frequencyCapCount` | number, default 1 | Лимит отправок в окне |
| `status` | select | `draft`, `launching`, `completed`, `failed` |
| `medusaCampaignId` | text, read-only | ID кампании в Medusa, например `mc_...` |
| `medusaStatus` | text, read-only | Последний статус из Medusa |
| `totalSelected` | number, read-only | Выбрано backend-аудиторией |
| `totalSent` | number, read-only | Успешно отправлено |
| `totalSkipped` | number, read-only | Пропущено |
| `totalFailed` | number, read-only | Ошибки отправки |
| `launchedAt` | date, read-only | Дата запуска |
| `completedAt` | date, read-only | Дата завершения |
| `lastError` | textarea/text, read-only | Последняя ошибка или reason workflow |
| `launchResult` | json, read-only | Raw result из Medusa launch workflow для диагностики |

### Важные правила коллекции

1. Если `status !== "draft"` или есть `medusaCampaignId`, контентные поля становятся read-only.
2. Read-only должен быть enforced не только в UI, но и в Payload hooks/access.
3. `medusaCampaignId` — обычное `text` поле, не Payload `relationship`.
4. `htmlContent` в Phase 1 — именно HTML string, не Lexical JSON.
5. `channel` в Phase 1 либо скрыт, либо disabled со значением `email`.

---

## 7. Mapping Payload → Medusa

### Create campaign payload

Payload custom endpoint должен отправлять в Medusa:

```typescript
{
  name: doc.name,
  description: null,
  channel: "email",
  audience_type: doc.audienceType,
  audience_filters: {
    customer_ids: doc.audienceType === "manual"
      ? parseCustomerIds(doc.audienceCustomerIds)
      : []
  },
  template: "marketing-v1",
  subject: doc.subject,
  content: {
    html: doc.htmlContent,
    text: doc.plainText || stripHtmlFallback(doc.htmlContent),
    subject: doc.subject,
    message: doc.plainText || undefined
  },
  frequency_cap_window_hours: doc.frequencyCapHours || 24,
  frequency_cap_count: doc.frequencyCapCount || 1
}
```

### Audience types Phase 1

| Payload | Medusa | Комментарий |
|---------|--------|-------------|
| `all` | `all` | Backend всё равно применит consent/channel checks при отправке |
| `email_consent` | `email_consent` | Самый безопасный дефолт для UI |
| `manual` | `manual` | Использует `audience_filters.customer_ids` |

### Рекомендуемый дефолт

Для UI default лучше поставить `email_consent`.

Так маркетолог по умолчанию отправляет только email-подписанным пользователям.

Для тестового сервера можно использовать `all`, если нужно быстрее проверить механику.

---

## 8. Launch flow в Payload

### Endpoint

Payload custom endpoint:

```http
POST /api/marketing-campaigns/:id/launch
```

### Алгоритм

1. Найти Payload campaign по `id`.
2. Проверить, что кампания существует.
3. Проверить, что `status === "draft"`.
4. Проверить обязательные поля:
   - `name`;
   - `subject`;
   - `htmlContent`;
   - валидный `audienceType`;
   - customer IDs для `manual`.
5. Поставить Payload status `launching`.
6. Если `medusaCampaignId` пустой:
   - вызвать `POST /admin/marketing/campaigns`;
   - сохранить `medusaCampaignId`.
7. Вызвать `POST /admin/marketing/campaigns/:medusaCampaignId`.
8. Проверить body:
   - `ok`;
   - `result.status`;
   - `result.reason`.
9. Обновить Payload stats:
   - `status`;
   - `medusaStatus`;
   - `totalSelected`;
   - `totalSent`;
   - `totalSkipped`;
   - `totalFailed`;
   - `launchedAt`;
   - `completedAt`;
   - `lastError`;
   - `launchResult`.
10. Вернуть результат UI.

### Обработка ошибок

Если ошибка произошла до создания Medusa campaign:

- Payload status → `failed`;
- `medusaCampaignId` остаётся пустым;
- можно разрешить оператору вручную вернуть в `draft` или сделать кнопку retry позже.

Если Medusa campaign создана, но launch не завершился:

- `medusaCampaignId` сохраняется;
- Payload status → `failed`;
- повторный launch должен быть осторожным, потому что Medusa запускает только campaign в status `draft`.

Для Phase 1 достаточно:

- не делать автоматический retry;
- показывать `lastError`;
- разбирать такие случаи вручную на тестовом сервере.

---

## 9. Авторизация Payload → Medusa

Payload backend должен ходить в Medusa Admin API server-to-server.

Новые env для Payload:

```env
MEDUSA_BACKEND_URL=http://medusa-backend:9000
MEDUSA_ADMIN_SECRET_API_KEY=<secret-admin-api-key>
```

Auth header:

```http
Authorization: Basic <base64(MEDUSA_ADMIN_SECRET_API_KEY + ":")>
Content-Type: application/json
```

Почему `MEDUSA_ADMIN_SECRET_API_KEY`, а не просто `MEDUSA_ADMIN_API_KEY`:

- в Medusa есть publishable keys и secret admin keys;
- для admin routes нужен именно secret admin API key;
- название должно явно указывать, что это server-only secret.

Правила безопасности:

- ключ хранится только в env Payload container;
- ключ не попадает в client-side bundle;
- endpoint launch выполняется только на Payload backend;
- маркетолог не видит Medusa token.

---

## 10. UI Phase 1

### List view

Колонки:

- Name;
- Subject;
- Status;
- Audience;
- Sent;
- Skipped;
- Failed;
- Launched At;
- Updated At.

Фильтры:

- status;
- audience type;
- launched date.

### Edit view

Блоки формы:

1. Основное:
   - name;
   - subject.
2. Content:
   - htmlContent;
   - plainText.
3. Audience:
   - audienceType;
   - audienceCustomerIds для manual.
4. Frequency cap:
   - frequencyCapHours;
   - frequencyCapCount.
5. Result:
   - medusaCampaignId;
   - status;
   - stats;
   - lastError.

### Actions

Phase 1:

- Save draft — стандартный Payload save.
- Launch / Отправить — custom button.

Необязательное, если быстро:

- Preview HTML — отдельная кнопка/компонент, который показывает `htmlContent` в iframe.

---

## 11. Env и deploy изменения для Phase 1

### Payload local env

Добавить в `payload-cms/.env.example`:

```env
# Payload → Medusa Admin API
MEDUSA_BACKEND_URL=http://localhost:9000
MEDUSA_ADMIN_SECRET_API_KEY=
```

### Staging env

Добавить в `.env.staging.example`:

```env
# Payload → Medusa Admin API
MEDUSA_BACKEND_URL=http://medusa-backend:9000
MEDUSA_ADMIN_SECRET_API_KEY=CHANGE_ME_SECRET_ADMIN_API_KEY
```

### Docker compose

Если Payload env берётся из root `.env`, отдельного compose mapping может не потребоваться.

Но нужно проверить, что `payload-cms` container действительно получает:

- `MEDUSA_BACKEND_URL`;
- `MEDUSA_ADMIN_SECRET_API_KEY`.

---

## 12. Проверка Phase 1

### Local/dev smoke

1. Создать Payload campaign draft.
2. Несколько раз нажать Save.
3. Проверить, что в Medusa не появились дубли.
4. Нажать Launch.
5. Проверить, что Medusa campaign создана один раз.
6. Проверить, что Payload сохранил `medusaCampaignId`.
7. Проверить, что stats появились в Payload.
8. Проверить, что кампания стала read-only.

### Backend check

Проверить:

```http
GET /admin/marketing/campaigns
GET /admin/marketing/campaigns/:id
```

Ожидаемо:

- campaign status `completed` или `failed`;
- totals соответствуют Payload stats;
- journal содержит sent/skipped/failed entries.

### Manual audience test

1. Взять 1 тестового customer ID.
2. Создать campaign `manual`.
3. Вставить customer ID.
4. Запустить.
5. Проверить, что `total_selected` не больше ручного списка.

---

## 13. Тестовый сервер и consent

Сейчас сервер тестовый, реальных покупателей нет.

Поэтому для Phase 1 не тратим время на production consent migration.

Можно использовать текущую backend-логику как есть:

- старые customers без `customer.metadata.marketing` считаются subscribed, если у них есть email;
- для тестовой разработки это допустимо;
- перед реальным production запуском это нужно пересмотреть.

Production note на будущее:

- перед первой настоящей маркетинговой рассылкой нужно подтвердить consent-модель;
- возможно потребуется bulk reset в `pending`;
- возможно потребуется re-confirmation campaign;
- это не блокирует Phase 1 на тестовом сервере.

---

## 14. Куда стремимся после Phase 1

Phase 1 — это не финальная маркетинговая платформа. Это безопасный минимальный мост между Payload UI и текущим Medusa marketing backend.

После первой версии цель — постепенно прийти к полноценному marketing cockpit.

### Phase 1.1: стабилизация и удобство оператора

После первой рабочей версии:

1. Добавить кнопку «Обновить статус из Medusa».
2. Показывать delivery journal в Payload:
   - recipient;
   - status;
   - reason;
   - notification id;
   - created at.
3. Улучшить error states:
   - create failed;
   - launch failed;
   - campaign not launchable;
   - provider disabled.
4. Добавить server-side guard от повторного launch.
5. Добавить понятные success/error notifications в UI.
6. Добавить HTML preview.

### Phase 2: audience preview и сегменты

Цель: маркетолог до запуска понимает, кому уйдёт письмо.

Backend:

1. Добавить endpoint:

```http
GET или POST /admin/marketing/campaigns/audience-count
```

2. Возвращать не только count, а breakdown:

```typescript
{
  selected: number
  sendable_estimate: number
  skipped_by_consent: number
  skipped_by_missing_recipient: number
  skipped_by_frequency_cap: number
  skipped_by_suppression: number
}
```

3. Расширить `audience_filters`:
   - `segments`;
   - `registered_after`;
   - `last_order_after`;
   - `last_order_before`;
   - `total_spent_min`;
   - `total_spent_max`;
   - `city`.

Payload:

1. Добавить UI фильтров.
2. Добавить кнопку «Оценить аудиторию».
3. Добавить коллекцию `MarketingSegments`.
4. Добавить управление customer segments.

### Phase 3: редактор писем и шаблоны

Цель: маркетолог не пишет HTML руками.

Варианты развития:

1. Lexical rich text → HTML converter.
2. Email template collection:
   - name;
   - slug;
   - html;
   - variables;
   - preview image.
3. Библиотека готовых шаблонов:
   - promo;
   - news;
   - reactivation;
   - service announcement.
4. Preview с тестовым customer.
5. Переменные:
   - `{{customer_name}}`;
   - `{{unsubscribe_url}}`;
   - `{{campaign_name}}`;
   - `{{product_name}}`.

### Phase 4: async sending и scheduled campaigns

Цель: рассылки не должны выполняться внутри одного HTTP request.

Что сделать:

1. Перевести launch на job/queue/worker.
2. Payload launch endpoint только ставит задачу.
3. UI показывает `queued/running/completed/failed`.
4. Добавить scheduled campaigns:
   - `scheduledAt`;
   - cron/worker;
   - cancel before send.
5. Добавить rate/batch controls:
   - batch size;
   - delay between batches;
   - provider daily limit.

### Phase 5: analytics

Цель: понимать эффективность рассылок.

Добавить:

1. Open tracking pixel.
2. Click tracking через redirect links.
3. Campaign metrics:
   - delivered;
   - opened;
   - clicked;
   - unsubscribed;
   - bounced, если provider отдаёт bounce events.
4. UTM builder.
5. Export CSV.

### Phase 6: multi-channel

Цель: единый интерфейс для email/SMS/VK.

Добавить после readiness провайдеров:

1. SMS channel UI.
2. VK channel UI.
3. Разные content fields по каналам:
   - email: subject/html/text;
   - sms: short text;
   - vk: message/buttons.
4. Channel-specific audience preview.
5. Channel-specific provider readiness checks.

---

## 15. Итоговый порядок реализации

### Phase 1 implementation checklist

1. Создать Payload collection `MarketingCampaigns`.
2. Добавить поля draft/content/audience/stats.
3. Добавить read-only guard после launch.
4. Добавить Payload env для Medusa Admin API.
5. Реализовать Medusa admin client helper в Payload.
6. Реализовать `POST /api/marketing-campaigns/:id/launch`.
7. Добавить custom Launch button в Payload admin.
8. Проверить local/dev flow.
9. Проверить staging flow на тестовых customers.
10. После успешной проверки решить, что переносить в Phase 1.1.

### Главный критерий готовности Phase 1

Маркетолог может создать email-кампанию в Payload, нажать «Отправить» и увидеть итоговую статистику, при этом обычные сохранения черновика не создают дублей в Medusa.
