# План: Модуль отзывов о товарах (Product Reviews)

> Статус: черновик (ревизия 2026-05-14)
> Дата: 2026-05-14
> Зависимости: Medusa backend, Payload CMS (модерация), Storefront (UI отзывов)

---

## 1. Цель

Реализовать систему отзывов о товарах:
- Покупатели оставляют отзывы с рейтингом и текстом.
- Отзывы проходят модерацию в Medusa Admin (с Phase 4 — см. [`plans/product-reviews-phase-4-medusa-admin.md`](plans/product-reviews-phase-4-medusa-admin.md:1); до Phase 4 UI модерации жил в Payload Admin).
- На карточке товара отображаются одобренные отзывы и средний рейтинг.
- Отзыв можно оставить только после покупки товара (verified purchase).

## 1.1 Открытые решения / поправки до Phase 1

Этот раздел фиксирует критичные правки, внесённые ревизией 2026-05-14. Все они уже отражены в соответствующих секциях ниже; сюда вынесены как чек-лист «закрыть до старта реализации».

**Critical (целостность данных и безопасность):**

1. **UNIQUE-инвариант «1 отзыв на товар на покупателя»** — на уровне БД, не только в коде: `UNIQUE (product_id, customer_id) WHERE customer_id IS NOT NULL AND status <> 'rejected'` (см. §3.2). Закрывает race condition при параллельных POST.
2. **CHECK `verified_purchase = false OR order_id IS NOT NULL`** — `verified_purchase=true` без `order_id` запрещён на уровне БД (см. §3.2).
3. **Атомарный пересчёт `product_rating_summary`** — единый `INSERT ... ON CONFLICT DO UPDATE` из агрегации, вызывается при approve / reject (бывший approved) / delete (бывший approved) / auto-approve (см. §4.3 «Пересчёт summary»). Никаких read-modify-write.
4. **Atomic increment `helpful_count`** — `UPDATE ... SET helpful_count = helpful_count + 1` после `INSERT ... ON CONFLICT DO NOTHING` в `product_review_helpful` (см. §4.3 «Голос Полезно»).
5. **Recalc summary при reject/delete** — пересчёт обязателен, если предыдущий статус был `approved`; не только при approve (см. §4.3).
6. **Авторизация Medusa Admin (после Phase 4)**: UI модерации работает через session-cookie Medusa Admin — никаких секретов в client bundle. Server-to-server `MEDUSA_ADMIN_SECRET_API_KEY` (формат `Authorization: Basic <base64(sk_xxx:)>`) остаётся для marketing UI и других Payload→Medusa интеграций (см. [`plans/marketing-ui-payload-cms.md`](plans/marketing-ui-payload-cms.md:1)). Историческая справка: до Phase 4 этот же ключ использовался Payload-вью модерации; после Phase 4 — только marketing flow. См. §5 и §11.
7. **GDPR / удаление сущностей** — subscriber на `customer.deleted` (анонимизация: `customer_id=NULL`, `customer_name='Покупатель'`) и `product.deleted` (cascade-удаление review/summary). См. §10.3.
8. **Anti-spam защита формы** — public rate-limit middleware (как для VK ID) на `POST /store/products/:id/reviews` и `/store/reviews/:id/helpful` + honeypot-поле в форме + pending-by-default. CAPTCHA — Phase 2 опция (env `REVIEWS_CAPTCHA_PROVIDER`). См. §10.1.

**High (архитектура и UX):**

9. **Канал нотификаций «отзыв опубликован/отклонён» — Phase 2** через [`notification-email.ts`](medusa-agency-boilerplate/src/modules/notification-email.ts:1) и шаблоны в [`email-template.ts`](medusa-agency-boilerplate/src/modules/email-template.ts:1); transactional, не зависит от marketing consent. Из §4.3 убран «опционально notification» в Phase 1 (см. §9 Phase 2).
10. **Кэш и инвалидация рейтинга** — server fetch с `next: { tags: [...] }`; approve/reject/delete вызывают `revalidateTag('product-rating-${id}')`, `revalidateTag('product-reviews-${id}')`, `revalidateTag('customer-reviews-${id}')`. См. §6.6.
11. **Server/client boundary в `ProductTabs`** — `ProductReviewsSummary` и `ProductReviewsList` (initial page) — server, `ProductReviewsListPager` / `ProductReviewForm` / helpful-кнопка — client. См. §6.1.
12. **Composite-индексы под основные запросы** — `(product_id, status, created_at DESC)`, `(product_id, status, helpful_count DESC)`, `(status, created_at DESC)`, `(customer_id, created_at DESC)`. См. §3.2.
13. **i18n / source of copy** — все тексты живут в `storefrontConfig.copy.reviews.*`, не литералы; контракт preset-driven copy. См. §6.7.
14. **Phase 1 vs `images`** — поле `images` в Phase 1 отбрасывается strict Zod-схемой (POST с `images` → 400). UI-поле upload скрыто. См. §13 и §10.2.
15. **Стиль интеграции** — soft FK по text-id, без `defineLink`, как в [`marketing-layer.ts`](medusa-agency-boilerplate/src/modules/marketing-layer.ts:1); миграции через `ensureProductReviewsTables()`. См. §9 шаг 1.

**Medium (детали):**

16. **`average_rating numeric(3,2) NULL`** — `NULL` при `total_reviews=0`, UI рендерит «Нет отзывов» (`copy.reviews.empty.shortLabel`), не «★ 0.0». См. §3.2 и §6.2/§6.3.
17. **`customer_name` snapshot и fallback-цепочка** — `first_name + initial(last_name)` → `first_name` → `email.local` → `'Покупатель'`. Поле `NOT NULL`. См. §3.2.
18. **DELETE approved отзыва** — запрещён для customer (409 «Опубликованный отзыв удалить нельзя»); admin DELETE триггерит recalc summary. См. §4.3.
19. **Helpful dedup в endpoint** — явный `INSERT ... ON CONFLICT DO NOTHING` + atomic update; голосовать можно только за `approved`. См. §4.3 и §10.4.
20. **Конвенция unit-тестов** — `__tests__/route.unit.spec.ts` рядом с роутом, как в [`onboarding`](medusa-agency-boilerplate/src/api/store/onboarding/__tests__/route.unit.spec.ts:1). Минимальный набор: validation (Zod strict, отбрасывание `images`), verified_purchase branch, UNIQUE-конфликт → 409, rate-limit, atomic recalc, helpful idempotency. См. §9 шаг 10.
21. **Customer без email/last_name (VK ID)** — `customer_id` единый ключ независимо от способа auth; имя берётся из fallback-цепочки.
22. **S3 cleanup для images** — TODO Phase 3; в Phase 1 не нужен (поле не принимается).

---

## 2. Текущее состояние

> Снимок «как было до Phase 1». Актуальное состояние после Phase 4 — см. блок «Историческая справка» в §5: UI модерации сейчас в Medusa Admin (`admin.slavx.ru/app/product-reviews`).

- Модуля отзывов в проекте нет.
- Официального модуля от Medusa v2 нет.
- Карточка товара: [`ProductTabs`](medusa-agency-boilerplate-storefront/src/modules/products/components/product-tabs/index.tsx:15) — вкладки «Детали», «Доставка». Сюда добавится вкладка «Отзывы».
- Payload CMS: коллекции `Pages`, `Posts`, `Media`, `Users`. Добавится `ProductReviews`.
- Medusa backend: custom modules в `src/modules/`, API routes в `src/api/`.

---

## 3. Архитектура

### 3.1 Где хранить отзывы

**Решение: Medusa backend (custom module) + Payload CMS (модерация UI).**

Причины:
- Отзывы привязаны к Medusa customer и product — нужна прямая связь.
- Проверка «купил ли товар» требует доступа к orders в Medusa.
- Payload используется только как UI модерации (читает/обновляет через Medusa Admin API).

### 3.2 Модель данных

#### Таблица `product_review` (PostgreSQL, Medusa DB)

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | text, PK | UUID |
| `product_id` | text, NOT NULL | Medusa product ID (soft FK, без `defineLink` — стиль `marketing-layer`) |
| `customer_id` | text, NULL | Medusa customer ID; может быть `NULL` после анонимизации (см. §10) |
| `order_id` | text, NULL | Order ID (verified purchase proof) |
| `rating` | integer, NOT NULL, CHECK `rating BETWEEN 1 AND 5` | 1–5 |
| `title` | text, NULL | Заголовок отзыва (опционально) |
| `text` | text, NOT NULL | Текст отзыва |
| `pros` | text, NULL | Достоинства (опционально) |
| `cons` | text, NULL | Недостатки (опционально) |
| `status` | text, NOT NULL, DEFAULT 'pending', CHECK `status IN ('pending','approved','rejected')` | `pending` / `approved` / `rejected` |
| `moderated_by` | text, NULL | ID модератора |
| `moderated_at` | timestamptz, NULL | Дата модерации |
| `rejection_reason` | text, NULL | Причина отклонения |
| `verified_purchase` | boolean, NOT NULL, DEFAULT false, CHECK `verified_purchase = false OR order_id IS NOT NULL` | Подтверждённая покупка; `true` ⇒ `order_id` обязателен |
| `helpful_count` | integer, NOT NULL, DEFAULT 0 | Счётчик «Полезно» |
| `images` | jsonb, NULL | Массив URL фото от покупателя (Phase 3; в Phase 1 endpoint отбрасывает поле) |
| `customer_name` | text, NOT NULL | Отображаемое имя (кэш, см. §10) |
| `created_at` | timestamptz, NOT NULL | Дата создания |
| `updated_at` | timestamptz, NOT NULL | Дата обновления |

**Constraints / индексы:**

- `UNIQUE (product_id, customer_id) WHERE customer_id IS NOT NULL AND status <> 'rejected'` — один отзыв на товар на покупателя; повторный отзыв допустим только после `rejected` (закрывает race condition при параллельных POST).
- `INDEX (product_id, status, created_at DESC)` — основной запрос «список одобренных отзывов товара».
- `INDEX (product_id, status, helpful_count DESC)` — сортировка «по полезности».
- `INDEX (status, created_at DESC)` — очередь модерации в admin.
- `INDEX (customer_id, created_at DESC)` — «мои отзывы» и rate-limit «10 в день».
- `INDEX (order_id)` — для дедупликации/аудита verified-purchase.
- Поведение при удалении связанных сущностей — soft FK (нет реального FK):
  - удаление `product` → cascade-удаление строк `product_review` и `product_rating_summary` для этого `product_id` (выполняет cleanup-job при подписке на `product.deleted`);
  - удаление `customer` → анонимизация: `customer_id = NULL`, `customer_name = 'Покупатель'` (отзыв сохраняется, чтобы рейтинг не пересчитывался; см. §10 GDPR).

#### Таблица `product_review_helpful` (дедупликация голосов)

| Поле | Тип | Описание |
|------|-----|----------|
| `review_id` | text, NOT NULL, ON DELETE CASCADE → `product_review.id` | Отзыв |
| `customer_id` | text, NOT NULL | Кто голосовал |
| `created_at` | timestamptz, NOT NULL | Дата голоса |
| PK | (review_id, customer_id) | Один голос на отзыв (защита от двойного голосования на уровне БД) |

> Дедупликация выполняется через `INSERT ... ON CONFLICT (review_id, customer_id) DO NOTHING` + проверка `rowCount`. Инкремент `helpful_count` в `product_review` — atomic (`UPDATE ... SET helpful_count = helpful_count + 1 WHERE id = ?`), без read-modify-write (см. §4.3).

#### Таблица `product_rating_summary` (кэш агрегатов)

| Поле | Тип | Описание |
|------|-----|----------|
| `product_id` | text, PK | Medusa product ID |
| `average_rating` | numeric(3,2), NULL | Средний рейтинг (1.00–5.00); `NULL`, если `total_reviews = 0` |
| `total_reviews` | integer, NOT NULL, DEFAULT 0 | Количество одобренных отзывов |
| `rating_1` | integer, NOT NULL, DEFAULT 0 | Количество оценок 1 |
| `rating_2` | integer, NOT NULL, DEFAULT 0 | Количество оценок 2 |
| `rating_3` | integer, NOT NULL, DEFAULT 0 | Количество оценок 3 |
| `rating_4` | integer, NOT NULL, DEFAULT 0 | Количество оценок 4 |
| `rating_5` | integer, NOT NULL, DEFAULT 0 | Количество оценок 5 |
| `updated_at` | timestamptz, NOT NULL | Последнее обновление |

> `average_rating = NULL` сигнализирует UI «нет оценок» (`ProductRatingBadge` рендерит «Нет отзывов» вместо `0.0`). Точность `numeric(3,2)` достаточна для отображения «4.75»; округление до `4.7` — на стороне UI.

**Кэш `customer_name` в `product_review`:**

- Заполняется при создании отзыва (snapshot, не обновляется при смене имени в профиле).
- Источники в порядке приоритета:
  1. `customer.first_name` + ` ` + первая буква `customer.last_name` + `.` (например, `Иван И.`).
  2. Только `customer.first_name`, если `last_name` пуст (типично для VK ID регистрации).
  3. `customer.email` без домена (часть до `@`), если `first_name` пуст.
  4. Литерал `'Покупатель'` — последний fallback и значение при анонимизации (см. §10).
- Поле `NOT NULL` — endpoint обязан вычислить имя на этапе POST.

---

## 4. API Endpoints (Medusa Backend)

### 4.1 Store API (для покупателей)

| Method | Path | Auth | Описание |
|--------|------|------|----------|
| `GET` | `/store/products/:id/reviews` | нет | Список одобренных отзывов (pagination, sort) |
| `GET` | `/store/products/:id/rating` | нет | Агрегат: средний рейтинг + распределение |
| `POST` | `/store/products/:id/reviews` | customer | Создать отзыв |
| `POST` | `/store/reviews/:id/helpful` | customer | Отметить «Полезно» |
| `GET` | `/store/customers/me/reviews` | customer | Мои отзывы |
| `DELETE` | `/store/customers/me/reviews/:id` | customer | Удалить свой отзыв (только pending) |

### 4.2 Admin API (для модерации из Payload)

| Method | Path | Auth | Описание |
|--------|------|------|----------|
| `GET` | `/admin/reviews` | admin | Список всех отзывов (фильтры: status, product, date) |
| `GET` | `/admin/reviews/:id` | admin | Детали отзыва |
| `POST` | `/admin/reviews/:id/approve` | admin | Одобрить |
| `POST` | `/admin/reviews/:id/reject` | admin | Отклонить (с причиной) |
| `DELETE` | `/admin/reviews/:id` | admin | Удалить |

### 4.3 Бизнес-логика

#### Создание отзыва (`POST /store/products/:id/reviews`)

```
Body: { rating: 1-5, title?: string, text: string, pros?: string, cons?: string }
       (поле images принимается только в Phase 3; в Phase 1 — отбрасывается на уровне схемы валидации)

Логика:
1. Проверить authenticated customer (иначе 401).
2. Проверить, что product_id существует (иначе 404).
3. Anti-spam pre-check: rate-limit на endpoint (см. §10) + бизнес-правило «10 отзывов в день на customer».
4. Валидация payload (Zod): rating 1-5 integer, text 10-2000 chars, title max 120, pros/cons max 1000.
   В Phase 1 поле images отбрасывается из body (strict schema → 400 при попытке передать).
5. Проверить verified_purchase: есть ли completed order с этим product_id для этого customer_id.
   Если REVIEWS_REQUIRE_PURCHASE=true и не verified — 403.
6. Вычислить customer_name по правилам §3.2 (snapshot, NOT NULL).
7. INSERT review со status='pending' (или 'approved', если REVIEWS_AUTO_APPROVE=true),
   verified_purchase, order_id (NULL если нет verified).
   Уникальность гарантируется UNIQUE-индексом из §3.2: при конфликте → 409 «Вы уже оставили отзыв».
8. Если status='approved' (auto-approve) — синхронно пересчитать summary (см. ниже).
9. Вернуть 201 с review object.
```

#### Модерация (`POST /admin/reviews/:id/approve`)

```
Логика (выполняется в одной транзакции):
1. SELECT ... FOR UPDATE отзыв по id, проверить, что текущий status != 'approved' (idempotency).
2. UPDATE product_review SET status='approved', moderated_by=?, moderated_at=now().
3. Пересчитать product_rating_summary для product_id (см. «Пересчёт summary» ниже).
4. COMMIT.
5. После коммита (не в транзакции):
   - revalidateTag(`product-rating-${product_id}`) на сторфронте (см. §6.6).
   - Транзакционная нотификация покупателю — в Phase 2 (§9), в Phase 1 не отправляется.
```

#### Модерация (`POST /admin/reviews/:id/reject`)

```
Body: { reason: string }

Логика (в одной транзакции):
1. SELECT ... FOR UPDATE; проверить, что status != 'rejected'.
2. Сохранить prev_status (для решения о пересчёте).
3. UPDATE product_review SET status='rejected', rejection_reason=?, moderated_by=?, moderated_at=now().
4. Если prev_status = 'approved' — пересчитать product_rating_summary (отзыв уходит из агрегата).
5. COMMIT.
6. После коммита: revalidateTag(`product-rating-${product_id}`), если был пересчёт.
   Нотификация покупателю — Phase 2.
```

#### Удаление (`DELETE /admin/reviews/:id`, `DELETE /store/customers/me/reviews/:id`)

```
Логика (в одной транзакции):
1. SELECT ... FOR UPDATE; для store-эндпоинта дополнительно проверить, что customer_id совпадает
   и status='pending' (approved нельзя удалить, ответ 409 с сообщением «Опубликованный отзыв удалить нельзя»).
2. Запомнить product_id и prev_status.
3. DELETE FROM product_review (CASCADE удалит product_review_helpful).
4. Если prev_status = 'approved' — пересчитать product_rating_summary.
5. COMMIT.
6. После коммита: revalidateTag(`product-rating-${product_id}`), если был пересчёт.
```

#### Пересчёт `product_rating_summary` (атомарный)

Один SQL `INSERT ... ON CONFLICT (product_id) DO UPDATE` на основе агрегации `product_review` —
никаких read-modify-write, две параллельных операции не могут «потерять» друг друга:

```sql
INSERT INTO product_rating_summary (
  product_id, average_rating, total_reviews,
  rating_1, rating_2, rating_3, rating_4, rating_5, updated_at
)
SELECT
  $1::text,
  CASE WHEN COUNT(*) = 0 THEN NULL ELSE ROUND(AVG(rating)::numeric, 2) END,
  COUNT(*),
  COUNT(*) FILTER (WHERE rating = 1),
  COUNT(*) FILTER (WHERE rating = 2),
  COUNT(*) FILTER (WHERE rating = 3),
  COUNT(*) FILTER (WHERE rating = 4),
  COUNT(*) FILTER (WHERE rating = 5),
  now()
FROM product_review
WHERE product_id = $1 AND status = 'approved'
ON CONFLICT (product_id) DO UPDATE SET
  average_rating = EXCLUDED.average_rating,
  total_reviews  = EXCLUDED.total_reviews,
  rating_1 = EXCLUDED.rating_1,
  rating_2 = EXCLUDED.rating_2,
  rating_3 = EXCLUDED.rating_3,
  rating_4 = EXCLUDED.rating_4,
  rating_5 = EXCLUDED.rating_5,
  updated_at = now();
```

Этот запрос — единственный путь обновления `product_rating_summary`. Он вызывается в 4 кейсах:
approve / reject (бывший approved) / delete (бывший approved) / создание с auto-approve.

#### Голос «Полезно» (`POST /store/reviews/:id/helpful`)

```
Логика:
1. Проверить authenticated customer.
2. Проверить, что review существует и status='approved' (на pending/rejected голосовать нельзя).
3. INSERT INTO product_review_helpful (review_id, customer_id, created_at)
   VALUES ($1, $2, now()) ON CONFLICT (review_id, customer_id) DO NOTHING;
4. Если rowCount = 1 — atomic: UPDATE product_review SET helpful_count = helpful_count + 1 WHERE id = $1
   RETURNING helpful_count;
   Если rowCount = 0 — голос уже был, вернуть текущий helpful_count без изменения.
5. Вернуть { helpful_count, already_voted: rowCount === 0 }.
```

> Все инкременты `helpful_count` — atomic UPDATE; read-modify-write запрещён.

---

## 5. Medusa Admin: UI модерации (после Phase 4)

> Историческая справка: Phase 1-3 размещали UI модерации в Payload Admin (`cms.slavx.ru/admin/product-reviews/moderation`).
> Phase 4 (рефакторинг) перенёс UI в Medusa Admin (`admin.slavx.ru/app/product-reviews`),
> чтобы модерация жила рядом с продуктами/заказами в коммерс-админке.
> См. [`plans/product-reviews-phase-4-medusa-admin.md`](plans/product-reviews-phase-4-medusa-admin.md:1).

### 5.1 Custom routes в Medusa Admin

Маршруты регистрируются через `defineRouteConfig` в [`medusa-agency-boilerplate/src/admin/`](medusa-agency-boilerplate/src/admin/):

- **Список модерации**: `/admin/product-reviews` — таблица с фильтрами (status/rating/dateFrom/dateTo/productId), pagination, quick approve/reject.
- **Детальная**: `/admin/product-reviews/:id` — полная карточка отзыва, approve/reject (textarea reason)/delete (confirm)/reply (CRUD).

Sidebar entry — единый top-level пункт «Модерация отзывов» через `defineRouteConfig({ label, icon: ChatBubbleLeftRight })`.

### 5.2 Widgets

- `widgets/product-reviews-pending-counter.tsx` — zone `product.list.before`. Счётчик "Отзывы на модерации: N" с ссылкой в очередь pending. Виден при заходе в раздел Products. (Medusa 2.13.6 не имеет dashboard.* zone, поэтому не на главной.)
- `widgets/product-reviews-on-product-detail.tsx` — zone `product.details.side.after`. Inline-секция в боковой колонке страницы товара: total / pending count + 5 последних отзывов + ссылка на отфильтрованную очередь.

### 5.3 Интеграция Medusa Admin → API

Маршруты Medusa Admin делают HTTP-вызовы к собственному backend через session-cookie auth — **никаких Basic auth и `MEDUSA_ADMIN_SECRET_API_KEY` для UI не используется**. Это снимает riski credential leak и упрощает onboarding администраторов (стандартный flow «логин в Medusa Admin → сразу есть доступ к модерации»).

Server-to-server вызовы Payload → Medusa Admin (`MEDUSA_ADMIN_SECRET_API_KEY` через Basic auth) **остаются** для других интеграций — например, marketing UI (см. [`plans/marketing-ui-payload-cms.md`](plans/marketing-ui-payload-cms.md:1)).

### 5.4 i18n / copy

Все UI-строки централизованы в [`medusa-agency-boilerplate/src/admin/routes/product-reviews/lib/copy.ts`](medusa-agency-boilerplate/src/admin/routes/product-reviews/lib/copy.ts:1). Структура:

- `nav.label` — sidebar entry.
- `list.*` — заголовки списка, фильтры, empty/error/loading.
- `detail.*` — заголовки деталей, секции (текст / фото / ответ магазина), reject form, delete confirm, reply CRUD.
- `dashboardWidget.*` — pending-counter widget (название наследовано из Phase 2 Payload).
- `productDetailWidget.*` — product-detail widget (новый Phase 4).
- `actions.*` — общие тексты кнопок approve/reject/delete/cancel.
- `errors.*` — маппинг кодов API → user-facing messages.

### 5.5 Cache / state

UI-слой использует `useQuery` / `useMutation` из `@tanstack/react-query` (доступен через `@medusajs/dashboard` без отдельного npm-install). Mutations approve/reject/delete/setReply/clearReply делают `queryClient.invalidateQueries({ queryKey: productReviewQueryKeys.all })` — список и детали refresh'ятся в lockstep.

`staleTime` — 10 секунд для списка, 5 для деталей, 30 для widget'ов.

---

## 6. Storefront: UI отзывов

### 6.1 Карточка товара — вкладка «Отзывы»

Расположение: новая вкладка в [`ProductTabs`](medusa-agency-boilerplate-storefront/src/modules/products/components/product-tabs/index.tsx:15).

**Содержимое вкладки:**
- Сводка: средний рейтинг (★ 4.7), количество отзывов, распределение по звёздам (progress bars).
- Кнопка «Написать отзыв» (если authenticated + купил товар).
- Список отзывов:
  - Имя покупателя + badge «Проверенная покупка» (если verified).
  - Рейтинг ★★★★☆.
  - Заголовок (если есть).
  - Текст отзыва.
  - Достоинства / Недостатки (если заполнены).
  - Фото (если есть) — lightbox gallery (Phase 3).
  - Дата.
  - Кнопка «Полезно» (N).
- Pagination: «Показать ещё» или infinite scroll.
- Сортировка: по дате (новые), по рейтингу, по полезности.

**Граница server/client.** Поскольку [`ProductTabs`](medusa-agency-boilerplate-storefront/src/modules/products/components/product-tabs/index.tsx:1) — `"use client"` (вкладочный switcher), компоненты рисуем по принципу server-shell + client-interactive:

- `ProductReviewsSummary` — server component, рендерит сводку из server fetch `GET /store/products/:id/rating`. Передаётся через props в `ProductTabs` уже отрендеренным `ReactNode`, как сейчас сделано для `productCopy.details`.
- `ProductReviewsList` (initial page) — server component, рендерит первый page одобренных отзывов через server fetch.
- `ProductReviewsListPager` — `"use client"`, подгружает следующие страницы и применяет сортировку через `GET /store/products/:id/reviews?page=N&sort=...`.
- `ProductReviewForm` — `"use client"` (форма с состоянием, оптимистичный submit, anti-spam токены см. §10).
- Кнопка «Полезно» — `"use client"` внутри `ProductReviewCard` (server card → client button-island).

### 6.2 Карточка товара — рейтинг в шапке

В [`ProductInfo`](medusa-agency-boilerplate-storefront/src/modules/products/templates/product-info/index.tsx:9) рядом с названием товара:
- ★ 4.7 (23 отзыва) — кликабельно, скроллит к вкладке «Отзывы».
- Если `total_reviews = 0` (`average_rating IS NULL` в `product_rating_summary`) — рендерится текст из `copy.reviews.empty.shortLabel` («Нет отзывов»), не «★ 0.0».

### 6.3 Каталог — рейтинг на превью

В [`Thumbnail`](medusa-agency-boilerplate-storefront/src/modules/products/components/thumbnail/index.tsx:19) или product card:
- Маленький badge: ★ 4.7 — под ценой или в углу карточки.
- При `total_reviews = 0` — badge не рендерится (избегаем визуального шума на каталоге).

### 6.4 Форма отзыва

Modal или inline-форма:
- Рейтинг: 5 кликабельных звёзд.
- Заголовок (опционально): input, max 120 chars.
- Текст: textarea, min 10, max 2000 chars.
- Достоинства (опционально): textarea.
- Недостатки (опционально): textarea.
- Фото (опционально): upload до 5 изображений (Phase 3; в Phase 1 поле скрыто).
- Кнопка «Отправить отзыв».
- После отправки: «Спасибо! Ваш отзыв отправлен на модерацию.»
- Anti-spam: honeypot-поле + public rate-limit middleware (см. §10).

### 6.5 Страница «Мои отзывы»

В account section (`/account/reviews`):
- Список отзывов покупателя с статусами (на модерации / опубликован / отклонён).
- Для отклонённых: показать причину.
- Для pending: кнопка «Удалить».
- Для approved: попытка удалить блокируется на бэкенде (409, см. §4.3); в UI кнопка не показывается.

### 6.6 Кэширование и инвалидация рейтинга

Страница товара кэшируется (Next.js App Router, ISR/server fetch). Чтобы рейтинг и список отзывов не «застревали» после модерации:

- Server fetch для рейтинга и списка вызывается с `next: { tags: [\`product-rating-${id}\`, \`product-reviews-${id}\`] }`.
- Medusa-эндпоинты `approve` / `reject` / `DELETE /admin/reviews/:id` после коммита транзакции вызывают
  `revalidateTag` сторфронта через server-action или внутренний webhook (см. §4.3 «после коммита»).
- Контракт revalidateTag-ов:
  - `product-rating-${product_id}` — для `ProductRatingBadge`, `ProductReviewsSummary`.
  - `product-reviews-${product_id}` — для `ProductReviewsList` (initial page).
  - `customer-reviews-${customer_id}` — для страницы «Мои отзывы» (после approve/reject своего отзыва).

### 6.7 Источник UI-копий

Все тексты — литералы только для прототипа; production-вариант живёт в `storefrontConfig.copy.reviews.*`
(контракт preset-driven copy, см. [`plans/preset-driven-listing-surface-contract-v1.md`](plans/preset-driven-listing-surface-contract-v1.md:1)). Минимальный набор ключей:

- `copy.reviews.tabTitle` — «Отзывы».
- `copy.reviews.summary.average` — «★ {rating} · {count} {count|plural:отзыв,отзыва,отзывов}».
- `copy.reviews.summary.empty` — «Пока никто не оставил отзыв».
- `copy.reviews.empty.shortLabel` — «Нет отзывов» (для badge в `ProductInfo`/`Thumbnail`).
- `copy.reviews.cta.write` — «Написать отзыв».
- `copy.reviews.cta.helpful` — «Полезно».
- `copy.reviews.cta.helpfulVoted` — «Спасибо!».
- `copy.reviews.form.submitSuccess` — «Спасибо! Ваш отзыв отправлен на модерацию.».
- `copy.reviews.form.alreadyExists` — «Вы уже оставили отзыв на этот товар».
- `copy.reviews.form.requirePurchase` — «Отзыв можно оставить только после покупки».
- `copy.reviews.status.pending|approved|rejected` — лейблы статусов в «Мои отзывы».
- `copy.reviews.verified` — «Проверенная покупка».

---

## 7. Компоненты Storefront

| Компонент | Путь | Описание |
|-----------|------|----------|
| `ProductReviewsSummary` | `src/modules/products/components/product-reviews-summary/` | Сводка рейтинга (звёзды + bars) |
| `ProductReviewsList` | `src/modules/products/components/product-reviews-list/` | Список отзывов с pagination |
| `ProductReviewCard` | `src/modules/products/components/product-review-card/` | Один отзыв |
| `ProductReviewForm` | `src/modules/products/components/product-review-form/` | Форма создания отзыва |
| `ProductRatingBadge` | `src/modules/products/components/product-rating-badge/` | Компактный badge ★ 4.7 |
| `ReviewStars` | `src/modules/common/components/review-stars/` | Переиспользуемые звёзды (display + input) |
| `MyReviews` | `src/modules/account/components/my-reviews/` | Список отзывов в аккаунте |

---

## 8. Data Flow

```
┌──────────────┐     GET /store/products/:id/reviews     ┌──────────────────┐
│  Storefront  │◄────────────────────────────────────────│  Medusa Backend  │
│  (Next.js)   │                                         │                  │
│              │     POST /store/products/:id/reviews     │  product_review  │
│  ReviewForm  │────────────────────────────────────────►│  table           │
│              │                                         │                  │
│              │     GET /store/products/:id/rating       │  rating_summary  │
│  RatingBadge │◄────────────────────────────────────────│  table           │
└──────────────┘                                         └────────┬─────────┘
                                                                  │
                                                                  │ Admin API
                                                                  │
                                                         ┌────────▼─────────┐
                                                         │   Payload CMS    │
                                                         │   (модерация)    │
                                                         │                  │
                                                         │  GET /admin/     │
                                                         │  reviews         │
                                                         │                  │
                                                         │  POST /admin/    │
                                                         │  reviews/:id/    │
                                                         │  approve|reject  │
                                                         └──────────────────┘
```

---

## 9. Порядок реализации

### Phase 1: Backend + базовый Storefront

1. Создать DB таблицы: `product_review`, `product_review_helpful`, `product_rating_summary` с constraints/индексами из §3.2 (через `ensureProductReviewsTables()` в стиле [`marketing-layer.ts`](medusa-agency-boilerplate/src/modules/marketing-layer.ts:1)). Без `defineLink` — soft FK по text-id.
2. Реализовать Medusa module: `src/modules/product-reviews.ts` (CRUD, atomic rating recalc, verified purchase check, customer_name resolver).
3. Реализовать Store API endpoints: GET reviews, GET rating, POST review, POST helpful, DELETE my review (только pending).
4. Реализовать Admin API endpoints: GET reviews (list+filters), approve, reject, delete; защита `authenticate("user", ["session", "bearer", "api-key"])` (см. §5.2).
5. Subscriber для GDPR/cleanup: на `customer.deleted` — анонимизация, на `product.deleted` — cascade-удаление (см. §10.3).
6. Добавить вкладку «Отзывы» в `ProductTabs` с `ProductReviewsSummary` (server) + `ProductReviewsList` (server initial + `ProductReviewsListPager` client).
7. Добавить `ProductRatingBadge` в `ProductInfo` (с empty-state по `copy.reviews.empty.shortLabel`, см. §6.7).
8. Реализовать `ProductReviewForm` (modal, client) с honeypot и привязкой к `copy.reviews.*`.
9. Подключить `revalidateTag('product-rating-${id}')` и `revalidateTag('product-reviews-${id}')` в approve/reject/delete (см. §6.6).
10. Unit tests рядом с роутами по конвенции [`onboarding/__tests__/route.unit.spec.ts`](medusa-agency-boilerplate/src/api/store/onboarding/__tests__/route.unit.spec.ts:1) — минимум: validation (Zod, strict, отбрасывание `images`), verified_purchase branch, duplicate review (UNIQUE-конфликт → 409), rate-limit, atomic recalc на approve/reject/delete, helpful idempotency.
11. Typecheck + build + tests + lint в обоих воркспейсах (backend + storefront).
12. Deploy на staging, smoke через `MEDUSA_ADMIN_SECRET_API_KEY` (curl на approve/reject).

### Phase 2: Модерация в Payload + UX

> Историческая справка: исходно Phase 2 ставила UI модерации в Payload Admin. Эта реализация была завершена (commits Phase 2 / hotfix `abc0a19`) и работала в production до Phase 4. После Phase 4 Payload-вью удалена, актуальный UI модерации — Medusa Admin (§5). Описание ниже сохранено для исторической трассировки решений.

1. Создать Payload custom view «Модерация отзывов». _(Phase 4: удалено, перенесено в Medusa Admin.)_
2. Интеграция Payload → Medusa Admin API (list, approve, reject) через `MEDUSA_ADMIN_SECRET_API_KEY` (см. §5.2). _(Phase 4: UI больше не использует этот ключ; ключ остаётся только для marketing UI.)_
3. Dashboard widget «Отзывы на модерации». _(Phase 4: переехал в Medusa Admin как `product.list.before` widget.)_
4. Добавить рейтинг в каталог (product cards) — `ProductRatingBadge` в `Thumbnail`.
5. Страница «Мои отзывы» в account, с invalidate-tag `customer-reviews-${id}` после approve/reject своих отзывов.
6. Транзакционные email-уведомления «Ваш отзыв опубликован» / «отклонён» через [`notification-email.ts`](medusa-agency-boilerplate/src/modules/notification-email.ts:1) и шаблоны в [`email-template.ts`](medusa-agency-boilerplate/src/modules/email-template.ts:1) (стиль `order-email-templates.ts`); НЕ зависят от marketing consent — это transactional channel.
7. (Опционально) `REVIEWS_CAPTCHA_PROVIDER` если поднимется спам.

### Phase 3: Расширения

1. Фото в отзывах (upload через Medusa file provider / S3); cleanup S3-объектов при DELETE отзыва.
2. Фильтрация отзывов по рейтингу (показать только ★5).
3. Ответ магазина на отзыв (admin reply, отображается под отзывом).
4. SEO: structured data (JSON-LD AggregateRating + Review).
5. Виджет «Лучшие отзывы» на главной / в карусели.

---

## 10. Валидация и безопасность

### 10.1 Rate limiting и anti-spam (Phase 1)

- Бизнес-правила (БД): UNIQUE-индекс по `(product_id, customer_id)` для не-rejected — 1 отзыв на товар; SQL counter за 24h по `customer_id` — max 10 отзывов в день.
- Endpoint-уровень — public rate-limit middleware (тот же, что используется для VK ID auth, см. [`public-rate-limit.ts`](medusa-agency-boilerplate/src/api/middlewares.ts:1)):
  - `POST /store/products/:id/reviews` — IP+customer_id, 5/мин и 30/час;
  - `POST /store/reviews/:id/helpful` — IP+customer_id, 30/мин;
  - GET-эндпоинты — без лимита (кэшируются на CDN/Next.js).
- Honeypot-поле в `ProductReviewForm` (скрытый input `website` или `nickname`) — заполненное → молчаливо отклоняем (200 OK без записи).
- Pending-by-default: даже если все anti-spam механики пройдут, отзыв не публикуется без approve. `REVIEWS_AUTO_APPROVE=true` оставлен только для staging/dev.
- CAPTCHA — Phase 2 опция (yaCaptcha/hCaptcha) при росте спама; контракт env-флага `REVIEWS_CAPTCHA_PROVIDER=none|yandex|hcaptcha` зарезервирован, но в Phase 1 не используется.

### 10.2 Валидация контента

- Zod-схема payload (см. §4.3); strict-режим, лишние поля → 400. Поле `images` в Phase 1 — отбрасывается (см. §13).
- XSS: `text/title/pros/cons` нормализуются (trim, схлопывание whitespace) и санитизируются перед рендером (DOMPurify на сторфронте при выводе или экранирование как plain text — без HTML).
- Markdown/HTML в отзывах — запрещены в Phase 1.
- Verified purchase: проверка через Medusa Query Graph (orders, `status='completed'`, `line_items` содержит `product_id`).
- Images (Phase 3): валидация URL (только https, whitelisted домены S3), max 5, max size через Medusa file provider; при удалении отзыва — cleanup S3-объектов в фоновом job. В Phase 1 cleanup не нужен (поле не принимается).

### 10.3 Customer name и GDPR

- `customer_name` — snapshot при создании отзыва по правилам §3.2. При смене имени в профиле не обновляется (исторический контекст модерации).
- При удалении/анонимизации customer (GDPR right-to-erasure):
  - Subscriber на событие `customer.deleted` (или явный admin-action в Payload):
    - `UPDATE product_review SET customer_id = NULL, customer_name = 'Покупатель' WHERE customer_id = $1`,
    - `DELETE FROM product_review_helpful WHERE customer_id = $1` (голос дедуплицирован — нет PII в нём, но удаляем для consistency).
  - Сами тексты отзывов сохраняются (анонимизированные), чтобы не пересчитывать рейтинг и не терять content для других покупателей.
- При удалении продукта (`product.deleted`):
  - `DELETE FROM product_review WHERE product_id = $1` (CASCADE уносит helpful);
  - `DELETE FROM product_rating_summary WHERE product_id = $1`.

### 10.4 Голоса «Полезно»

- Дедупликация на уровне БД: PK `(review_id, customer_id)` в `product_review_helpful`.
- Endpoint выполняет `INSERT ... ON CONFLICT DO NOTHING` + atomic `UPDATE helpful_count = helpful_count + 1`, как в §4.3.
- Только для `status='approved'` отзывов; для pending/rejected — 404.
- Без анонимного голосования: требуется authenticated customer.

---

## 11. Env-переменные

```env
# Medusa backend
REVIEWS_ENABLED=true
REVIEWS_AUTO_APPROVE=false              # true = без модерации (для тестирования)
REVIEWS_MIN_TEXT_LENGTH=10
REVIEWS_MAX_TEXT_LENGTH=2000
REVIEWS_MAX_IMAGES=5
REVIEWS_REQUIRE_PURCHASE=false          # true = только verified purchase могут оставлять отзывы

# Payload (server-to-server вызовы к Medusa)
MEDUSA_BACKEND_URL=http://medusa-backend:9000
# Secret Admin API Key Medusa v2 (sk_* token), формат заголовка Authorization: Basic <base64(sk_xxx:)>.
# Генерируется helper-ом createSecretAdminApiKey() (см. medusa-agency-boilerplate/src/scripts).
# После Phase 4: НЕ используется UI модерации отзывов (Medusa Admin ходит через session-cookie).
# Остаётся актуальным для marketing UI и других Payload→Medusa интеграций (см. plans/marketing-ui-payload-cms.md).
# НЕ путать с NEXT_PUBLIC_MEDUSA_PUBLISHABLE_API_KEY (pk_*) — это ключ сторфронта для Store API.
MEDUSA_ADMIN_SECRET_API_KEY=<sk_...>
```

---

## 12. Зависимости

- Medusa backend: PostgreSQL (уже есть), file provider для фото (Phase 3, зависит от S3 setup).
- Payload CMS: custom views API (Payload 3.x поддерживает).
- Storefront: существующие UI-компоненты (Container, Button, Input из `@medusajs/ui`).
- Для verified purchase: доступ к orders через Medusa Query Graph.

---

## 13. Ограничения Phase 1

- Без фото: поле `images` в БД зарезервировано, но `POST /store/products/:id/reviews` отбрасывает его на уровне strict Zod-схемы (попытка передать → 400). UI-поле upload скрыто. Cleanup S3 — TODO Phase 3.
- Без ответа магазина (Phase 3).
- Без SEO structured data (Phase 3, JSON-LD `AggregateRating` + `Review`).
- Модерация через Admin API (curl/Postman) до реализации UI модерации (Phase 2 — Payload custom view, после Phase 4 — Medusa Admin routes); вызов через `Authorization: Basic <base64(sk_xxx:)>`.
- Без email-уведомлений о статусе отзыва (Phase 2). В Phase 1 покупатель видит статус только в `/account/reviews` (если эта страница включена) или после реализации в Phase 2.
- Без CAPTCHA (Phase 2 опция при росте спама); Phase 1 опирается на public rate-limit + honeypot + pending-by-default.
- Без виджета «Отзывы на модерации» в каталоге/admin dashboard (Phase 2 — изначально Payload dashboard, после Phase 4 — Medusa Admin widget в `product.list.before`).
- Без рейтинга на превью товара (`Thumbnail`) — добавляется в Phase 2 вместе со страницей «Мои отзывы».
