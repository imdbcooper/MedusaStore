# Marketing UI status

Статус-документ по UI маркетинговых рассылок поверх Medusa marketing layer. Источник правды по плану — [`plans/marketing-ui-payload-cms.md`](plans/marketing-ui-payload-cms.md:1) (секция `## Status`); этот документ собирает фактическое состояние кода Payload, env-контракт и операционные предостережения для будущих разработчиков и агентов.

_Updated 2026-05-16_

---

## 1. Scope и архитектурная картинка

Workstream состоит из трёх независимых слоёв:

1. **Backend marketing layer (Medusa)** — campaign CRUD, audience resolution, `sendMarketingCampaignWorkflow`, delivery journal, frequency cap, double opt-in, suppression. Закрыт ранее как `marketing layer v1`, упомянут в [`Docs/master_repo_plan_v2.md`](Docs/master_repo_plan_v2.md:511).
2. **Payload UI (этот workstream)** — коллекция-черновик в Payload `/admin`, кнопка «Отправить кампанию», read-only журнал доставки.
3. **Storefront preference center** — `/account/profile` и unsubscribe routes; не входит в этот workstream.

Поток запуска кампании:

```
Маркетолог в Payload /admin
        │
        ▼
коллекция MarketingCampaigns (черновик в Payload DB)
        │  «Отправить кампанию»
        ▼
POST /api/marketing-campaigns/:id/launch          (Payload, server-only)
        │  Authorization: Basic base64(MEDUSA_ADMIN_SECRET_API_KEY:)
        ▼
POST /admin/marketing/campaigns                   (Medusa, create)
POST /admin/marketing/campaigns/:medusaId         (Medusa, launch)
        │
        ▼
sendMarketingCampaignWorkflow → SMTP → клиенты
        │
        ▼
Payload сохраняет totals, status, launchResult и закрывает черновик от правок

Параллельно:
GET /api/marketing-campaigns/:id/journal          (Payload, server-only)
   → GET /admin/marketing/campaigns/:medusaId     (Medusa, read journal)
```

Payload никогда не разговаривает с Medusa из браузера; весь Basic-auth трафик идёт server-to-server через [`medusaAdminFetch()`](payload-cms/src/lib/medusa-admin-client.ts:157).

---

## 2. Что закрыто (Phase 1 + 1.1)

### Phase 1 — Done (2026-05-16)

- Коллекция-черновик c 18 полями, табами и read-only enforcement: [`MarketingCampaigns`](payload-cms/src/collections/MarketingCampaigns/index.ts:272). Read-only после launch держится тремя слоями — `admin.readOnly` на полях, `access.update` коллекции и `beforeChange` hook ([`FROZEN_CONTENT_FIELDS`](payload-cms/src/collections/MarketingCampaigns/index.ts:36)).
- Custom endpoint `POST /api/marketing-campaigns/:id/launch`: [`launchEndpoint`](payload-cms/src/collections/MarketingCampaigns/launch-endpoint.ts:178). Делает create + launch в Medusa и persist'ит totals.
- Server-only helper Payload → Medusa Admin: [`medusa-admin-client.ts`](payload-cms/src/lib/medusa-admin-client.ts:1). Закреплено `import 'server-only'`, чтобы ключ не утёк в client bundle.
- UI-кнопка «Отправить кампанию» в карточке: [`MarketingCampaignLaunchButton`](payload-cms/src/components/MarketingCampaignLaunchButton/index.tsx:33). Скрывается после launch.
- Регистрация коллекции: [`payload.config.ts`](payload-cms/src/payload.config.ts:33).
- Миграция БД: [`20260516_062031_marketing_campaigns.ts`](payload-cms/src/migrations/20260516_062031_marketing_campaigns.ts:1) — таблицы `marketing_campaigns` и `marketing_campaigns_audience_customer_ids`, enums `channel/audience_type/status`.

### Phase 1.1 — Done (2026-05-16)

- `Idempotency-Key` header на launch: client генерирует UUID на mount ([`MarketingCampaignLaunchButton`](payload-cms/src/components/MarketingCampaignLaunchButton/index.tsx:42)) и шлёт в header. Сервер сохраняет ключ в поле `idempotencyKey` ([`launch-endpoint.ts`](payload-cms/src/collections/MarketingCampaigns/launch-endpoint.ts:218)) и обрабатывает повтор как 200 idempotent / 409 mismatch / 409 in-progress.
- Миграция под idempotency: [`20260516_063010_idempotency_key.ts`](payload-cms/src/migrations/20260516_063010_idempotency_key.ts:1).
- Per-user rate-limit 3 запроса / 60s: модуль [`rate-limit.ts`](payload-cms/src/lib/rate-limit.ts:50), точка интеграции — [`getLaunchRateLimit()`](payload-cms/src/collections/MarketingCampaigns/launch-endpoint.ts:78). Возвращает 429 с `Retry-After`.
- Журнал доставки в карточке кампании:
  - GET endpoint-прокси: [`journalEndpoint`](payload-cms/src/collections/MarketingCampaigns/journal-endpoint.ts:60).
  - UI-таблица с сортировкой `sent → skipped → failed` и soft-pagination по 50 строк: [`MarketingCampaignDeliveryJournal`](payload-cms/src/components/MarketingCampaignDeliveryJournal/index.tsx:90).

---

## 3. Что отложено (deferred)

- **Async queue для launch** — план §14 «Phase 4». Сейчас отправка идёт синхронно внутри HTTP request (`timeoutMs: 60_000` в [`launch-endpoint.ts`](payload-cms/src/collections/MarketingCampaigns/launch-endpoint.ts:413)). Подходит для аудиторий <500. Для больших нужен queue/worker.
- **Distributed lock на launch** — план §8 «Обработка ошибок». Текущая защита — claim status='launching' + re-read ([`launch-endpoint.ts`](payload-cms/src/collections/MarketingCampaigns/launch-endpoint.ts:309)). Двойной клик в одном инстансе закрыт; кросс-репликовая гонка остаётся в наносекундном окне.
- **SMS / VK кампании, segments, audience preview, scheduled, open/click tracking, A/B** — план §5 (Phase 2-5).
- **Bounce-handling и suppression list** — план §5 «Phase 5». Сейчас отказы доставки не парсятся, suppression-list не ведётся; повторные рассылки на bounced-адреса не блокируются автоматически. До реализации — оператор контролирует адресатов вручную через журнал доставки.
- **Bulk-миграция legacy customers в `pending`** перед prod — это операторская задача, не код. Сейчас на стейдже сознательно `default-subscribed = true` для customers без `customer.metadata.marketing` (см. [`Docs/env_contract.md`](Docs/env_contract.md:178)). Перед первой реальной prod-кампанией нужен либо bulk reset в `pending` + confirmation blast, либо re-confirm campaign.
- **DNS-настройка SPF/DKIM/DMARC** — отдельная prod-операция, не нужна на стейдже.
- **Удаление/архив кампаний** — Medusa endpoint отсутствует (план §3 «Важные ограничения»), Payload `delete: () => false` намеренный.

---

## 4. Env-переменные

| Имя | Сторона | Зачем | Дефолт / источник |
|-----|---------|-------|-------------------|
| `MEDUSA_BACKEND_URL` | Payload | Куда ходит launch и journal endpoint. Trailing slash нормализуется в [`medusaAdminBaseUrl()`](payload-cms/src/lib/medusa-admin-client.ts:76). | `http://localhost:9000`, см. [`payload-cms/.env.example`](payload-cms/.env.example:30) |
| `MEDUSA_ADMIN_SECRET_API_KEY` | Payload | `sk_*` token для Basic auth (`base64(secret:)`). Server-only — закреплено `import 'server-only'` в [`medusa-admin-client.ts`](payload-cms/src/lib/medusa-admin-client.ts:1) и [`rate-limit.ts`](payload-cms/src/lib/rate-limit.ts:1). Не должен попадать в client bundle. | пусто, см. [`payload-cms/.env.example`](payload-cms/.env.example:31) |
| `MARKETING_EMAIL_FROM` / `MARKETING_EMAIL_FROM_NAME` / `MARKETING_EMAIL_REPLY_TO` | Medusa | Sender identity для маркетинговой рассылки. Fallback — `SMTP_FROM`/`NOTIFICATION_EMAIL_FROM`. | См. [`Docs/env_contract.md`](Docs/env_contract.md:167) |
| `MARKETING_UNSUBSCRIBE_MAILTO` | Medusa | Mailto target для `List-Unsubscribe` header. | См. [`Docs/env_contract.md`](Docs/env_contract.md:168) |
| `MARKETING_DOUBLE_OPTIN_TOKEN_TTL_DAYS` / `MARKETING_UNSUBSCRIBE_TOKEN_TTL_DAYS` | Medusa | TTL подтверждения подписки и unsubscribe-токенов. | `7` / `365`, см. [`Docs/env_contract.md`](Docs/env_contract.md:169) |
| `MARKETING_CONFIRMATION_REDIRECT_PATH` / `MARKETING_UNSUBSCRIBE_REDIRECT_PATH` / `MARKETING_DEFAULT_COUNTRY_CODE` | Medusa | Storefront landing paths и country segment в marketing URLs. | `/marketing/confirm` / `/unsubscribe` / `ru`, см. [`Docs/env_contract.md`](Docs/env_contract.md:170) |

Payload UI новых переменных не добавляет — переиспользует уже существующий контракт через [`medusaAdminFetch()`](payload-cms/src/lib/medusa-admin-client.ts:157).

---

## 5. Операционные предостережения

1. **Default-subscribed legacy customers.** Для customers без `customer.metadata.marketing` backend трактует канал как `subscribed`, чтобы не ломать baseline на стейдже. Это противоречит GDPR explicit opt-in для prod. Перед первой реальной кампанией оператор обязан либо bulk-перевести customers в `pending` + confirmation blast, либо отправить отдельную re-confirm campaign. Контекст и три легитимных сценария — [`Docs/env_contract.md`](Docs/env_contract.md:176).
2. **Synchronous launch.** Workflow отправки выполняется внутри HTTP request к Payload. Phase 1 поднял timeout до 60 секунд ([`launch-endpoint.ts`](payload-cms/src/collections/MarketingCampaigns/launch-endpoint.ts:413)), но это потолок: при больших аудиториях вероятен Caddy/upstream timeout. Для prod — ограничивать аудиторию вручную или ждать Phase 4 (queue).
3. **In-memory rate-limit.** `Map` в одном Node-процессе ([`rate-limit.ts`](payload-cms/src/lib/rate-limit.ts:60)). Сбрасывается на рестарте, не делится между репликами. Для одного инстанса Payload — достаточно; масштабировать репликами в этой схеме нельзя без Redis-варианта.
4. **Lite idempotency.** Защита от двойного клика — claim status + re-read ([`launch-endpoint.ts`](payload-cms/src/collections/MarketingCampaigns/launch-endpoint.ts:309)). Окно гонки между write и re-read измеряется наносекундами и закрывается только distributed lock'ом (deferred). Двойной клик с одним и тем же `Idempotency-Key` обрабатывается корректно.
5. **Журнал не пагинируется на сервере.** [`journalEndpoint`](payload-cms/src/collections/MarketingCampaigns/journal-endpoint.ts:60) тянет весь массив, клиент режет по 50 в [`MarketingCampaignDeliveryJournal`](payload-cms/src/components/MarketingCampaignDeliveryJournal/index.tsx:44). Для кампаний на тысячи получателей понадобится server-side pagination в Medusa GET endpoint.
6. **Совмещённый SMTP-аккаунт `noreply@notify.slavx.ru`.** Один envelope sender отправляет и transactional, и marketing — bounce-репутация может перетекать с маркетинга на verification/password-reset. Полное разделение требует отдельного mailbox `news-mailer@news.slavx.ru` и собственных кред в marketing-workflows; см. [`Docs/email_server.md`](Docs/email_server.md:164) и [`Docs/env_contract.md`](Docs/env_contract.md:167).

---

## 6. Связи с другими планами

- [`Docs/master_repo_plan_v2.md`](Docs/master_repo_plan_v2.md:511) — `marketing layer v1` (backend) уже описан как materialized. После закрытия Phase 1+1.1 **UI часть тоже стала materialized**. В сводный план это надо внести отдельной правкой; здесь — не делаем.
- [`plans/product-reviews-phase-4-medusa-admin.md`](plans/product-reviews-phase-4-medusa-admin.md:228) — там зафиксировано, что `MEDUSA_ADMIN_SECRET_API_KEY` и docker-compose hotfix `abc0a19` (override `MEDUSA_BACKEND_URL` для payload-cms) сохраняются ради marketing UI. После Phase 1 эта зависимость **активна**: Payload реально использует ключ через [`medusaAdminFetch()`](payload-cms/src/lib/medusa-admin-client.ts:157), а не «зарезервирован». Откат hotfix откладывается до миграции этого workstream в Medusa Admin (если такое решение появится).

---

## 7. How-to для маркетолога

1. Открыть `/admin` Payload CMS (например `https://cms.slavx.ru/admin`).
2. В сайдбаре выбрать **Маркетинговые рассылки → Создать**.
3. Заполнить вкладки:
   - **Содержимое** — название, тема, HTML письма, опциональный plain text.
   - **Аудитория** — `email_consent` по умолчанию; `manual` — добавить customer IDs построчно; `all` — для теста.
   - **Ограничения** — frequency cap (часы / лимит).
4. Нажать **Сохранить**. Сохранение не создаёт кампанию в Medusa.
5. На вкладке **Результат** нажать **Отправить кампанию** и подтвердить в браузерном confirm.
6. После завершения backend заполнит `medusaCampaignId`, totals, статус и журнал доставки. Документ становится read-only.

---

## 8. Чек-лист тестирования

Полный аудит-чек-лист (sections B/C/D — расхождения, нагрузочные сценарии, observability) живёт в conversation history предыдущего аудита Phase 1.1. Ниже — компактная Smoke-секция, достаточная перед каждым релизом workstream.

Smoke-сценарии (выполнить перед merge / deploy):

1. **Создание черновика** — несколько раз нажать Save: в Medusa `GET /admin/marketing/campaigns` дублей нет.
2. **Single launch** — нажать «Отправить кампанию», убедиться что: status → `completed`/`failed`, появились totals, документ стал read-only, `medusaCampaignId` заполнен.
3. **Idempotency / double-click** — два быстрых клика подряд: только одна кампания в Medusa, второй ответ — 200 idempotent или 409 in-progress.
4. **Rate-limit** — 4 launch-запроса от одного пользователя в течение 60s: четвёртый возвращает 429 с `Retry-After`.
5. **Журнал** — после launch таблица в карточке заполняется через [`/api/marketing-campaigns/:id/journal`](payload-cms/src/collections/MarketingCampaigns/journal-endpoint.ts:60); сортировка `sent → skipped → failed`; «Показать ещё» работает на >50 записях.
6. **Manual audience** — кампания с одним customer_id: `total_selected` ≤ 1.
7. **Read-only после launch** — попытка отредактировать `subject`/`htmlContent` в UI или API отклоняется (UI заблокирован, API падает на `beforeChange` с понятным сообщением).

Для расширенной проверки (поведение при недоступном Medusa, gracefull degrade при `MEDUSA_ADMIN_SECRET_API_KEY=""`, поведение при отсутствии `customer.metadata.marketing`) — см. полный аудит в conversation history.
