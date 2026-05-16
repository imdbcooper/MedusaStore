# Phase 4: Перенос UI модерации отзывов из Payload в Medusa Admin

> Статус: черновик (16.05.2026)
> Зависимости: Phase 1–3 завершены и в production (`main` после двух P0 hotfix'ов, последний коммит `f3b1031`)
> Branch: `feat/product-reviews-phase-4-medusa-admin-refactor`

---

## 1. Цель и обоснование

### Что
Перенести весь UI модерации отзывов с [`payload-cms/src/views/product-reviews-moderation/`](payload-cms/src/views/product-reviews-moderation/Page.tsx:1) (рендерится сейчас под `cms.slavx.ru/admin/product-reviews/moderation`) в Medusa Admin Extensions ([`medusa-agency-boilerplate/src/admin/`](medusa-agency-boilerplate/src/admin/README.md:1)) — кастомные routes + widgets, доступные под `https://admin.slavx.ru/app/product-reviews`.

### Почему сейчас
- Модерация отзывов — это **commerce-операция**, а не CMS-операция. Концептуально она должна жить рядом с продуктами и заказами в Medusa Admin, а не в Payload.
- Payload-версия требует **Basic-auth с `MEDUSA_ADMIN_SECRET_API_KEY`** (плюс контейнерный override `MEDUSA_BACKEND_URL` через hotfix `abc0a19`) — лишний secret, лишний proxy-hop, лишняя CORS-поверхность. Medusa Admin ходит к собственному backend по session-cookie из того же origin — без секрета и без proxy.
- В Payload админка модерации существует как **single-tenant самодельный view** на инлайн-стилях; в Medusa мы получаем нативные Tabler/UI primitives (`Table`, `DataTable`, `Drawer`, `StatusBadge`, `Toaster`) и предсказуемое L&F.
- На стороне backend всё уже готово (Phase 1–3 + P0 hotfix'ы): `/admin/reviews/*` поддерживает session/bearer/api-key auth, валидацию, email-уведомления, cache-invalidation. Backend контракт **не меняется** — переносим только UI.

### Что меняется
- Появляются `medusa-agency-boilerplate/src/admin/routes/product-reviews/page.tsx` (список) и `medusa-agency-boilerplate/src/admin/routes/product-reviews/[id]/page.tsx` (детали).
- Появляются widget'ы: счётчик «Отзывы на модерации» и опциональный inline-список отзывов на странице товара.
- Удаляется Payload-версия после успешного парallel-run.

### Что НЕ меняется
- Backend API `/admin/reviews/*` — endpoints, схемы, auth-chain, email-уведомления, cache-invalidation тегов остаются как есть.
- Storefront UI отзывов на `medusa-agency-boilerplate-storefront/` — backend контракт `ProductReviewPublic.images: string[]`, `merchant_reply.*`, рейтинговый виджет — без изменений.
- Public Payload routes (страницы магазина в Payload) — без изменений; Phase 4 трогает только `/admin/product-reviews/moderation` view.

---

## 2. Текущее состояние (что переносим)

### 2.1 Map Payload → Medusa Admin

| Payload (current)                                                                                                                                                            | Medusa Admin (target)                                                              | Назначение                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------- |
| [`Page.tsx`](payload-cms/src/views/product-reviews-moderation/Page.tsx:1) (server, dispatch list/detail)                                                                     | `src/admin/routes/product-reviews/page.tsx` + `[id]/page.tsx`                      | Список + детали (две страницы вместо dispatch'а)    |
| [`ModerationFilters.client.tsx`](payload-cms/src/views/product-reviews-moderation/ModerationFilters.client.tsx:1)                                                            | inline в `routes/product-reviews/page.tsx` (или отдельный component)               | URL-driven фильтры status/rating/dates/productId    |
| [`ModerationRowActions.client.tsx`](payload-cms/src/views/product-reviews-moderation/ModerationRowActions.client.tsx:1)                                                      | inline в `routes/product-reviews/page.tsx`                                         | Quick approve/reject в строке                       |
| [`ModerationDetailActions.client.tsx`](payload-cms/src/views/product-reviews-moderation/ModerationDetailActions.client.tsx:1)                                                | inline в `routes/product-reviews/[id]/page.tsx`                                    | Approve / reject (with reason) / delete / reply CRUD |
| [`DashboardWidget.tsx`](payload-cms/src/views/product-reviews-moderation/DashboardWidget.tsx:1) (server, `beforeDashboard`)                                                  | `src/admin/widgets/product-reviews-counter.tsx` в зоне `product.list.before` *     | Счётчик pending-отзывов                             |
| [`copy.ts`](payload-cms/src/views/product-reviews-moderation/copy.ts:1)                                                                                                      | `src/admin/routes/product-reviews/lib/copy.ts`                                     | Все RU-строки в одном месте                         |
| [`actions.ts`](payload-cms/src/views/product-reviews-moderation/actions.ts:1) (server actions с revalidatePath)                                                              | `src/admin/routes/product-reviews/lib/data.ts` (TanStack `useMutation` + invalidate) | Approve/reject/delete/reply мутации                 |
| [`helpers.ts`](payload-cms/src/views/product-reviews-moderation/helpers.ts:1) + [`primitives.tsx`](payload-cms/src/views/product-reviews-moderation/primitives.tsx:1)        | `src/admin/routes/product-reviews/lib/helpers.ts` + `components/`                  | Format helpers + StatusPill/StarRating/VerifiedBadge |
| [`NavLink.tsx`](payload-cms/src/views/product-reviews-moderation/NavLink.tsx:1)                                                                                              | `defineRouteConfig({ label, icon: ChatBubbleLeftRight })`                          | Sidebar-link генерируется автоматически             |
| [`product-reviews-admin-client.ts`](payload-cms/src/lib/product-reviews-admin-client.ts:1) + [`medusa-admin-client.ts`](payload-cms/src/lib/medusa-admin-client.ts:1)        | `src/admin/routes/product-reviews/lib/api.ts` (тонкая обёртка над `sdk.client.fetch`) | Fetch helpers без секрета — session-cookie auth     |

`*` — См. §3.1.b. У Medusa 2.13.6 **нет** `dashboard.*` injection-zone в [`@medusajs/admin-shared`](medusa-agency-boilerplate/node_modules/@medusajs/admin-shared/dist/index.d.ts:63). Альтернативу детально рассмотрим в §3.1.b и §6.5.

### 2.2 Что переносим — feature checklist
- [x] Список с пагинацией (page-size 20, как сейчас).
- [x] Фильтры: `status` (default `pending`), `rating` (5/4/3/2/1), `productId`, `dateFrom`, `dateTo`.
- [x] Таблица с колонками: Товар (product_id), Покупатель (display name + customer_id), Рейтинг (★), Текст (title + truncated text), Статус (StatusBadge), Дата создания, Действия.
- [x] Quick approve / reject в строке — только для `pending` (reject через prompt-диалог).
- [x] Детали: Title, Text, Pros, Cons, Rejection reason (если rejected), Photo grid (если есть `images`), Verified-purchase badge.
- [x] Sidebar детали: product_id, status, rating, created_at, moderated_by, moderated_at, verified_purchase, order_id, customer_name, customer_id.
- [x] Action panel: Approve, Reject (textarea с reason 1..500 chars), Delete (confirm с warning «фото будут удалены», если `images.length > 0`).
- [x] «Ответ магазина»: добавить, редактировать, удалить (textarea 1..1000 chars, charCounter, plain-text rendering).
- [x] Invalidation: после mutation таблица и детали обновляются без перезагрузки страницы (TanStack `queryClient.invalidateQueries`).
- [x] Error mapping: `config_missing` / `transport_error` / `unauthorized` / `not_found` / `reason_required` / `reason_too_long` / `reply_required` / `reply_too_long` → user-friendly RU copy.

### 2.3 Backend layer не трогается
Все 5 admin route файлов остаются как есть:
- [`src/api/admin/reviews/route.ts`](medusa-agency-boilerplate/src/api/admin/reviews/route.ts:1) — GET list.
- [`src/api/admin/reviews/[id]/route.ts`](medusa-agency-boilerplate/src/api/admin/reviews/[id]/route.ts:1) — GET / DELETE.
- [`src/api/admin/reviews/[id]/approve/route.ts`](medusa-agency-boilerplate/src/api/admin/reviews/[id]/approve/route.ts:1).
- [`src/api/admin/reviews/[id]/reject/route.ts`](medusa-agency-boilerplate/src/api/admin/reviews/[id]/reject/route.ts:1).
- [`src/api/admin/reviews/[id]/reply/route.ts`](medusa-agency-boilerplate/src/api/admin/reviews/[id]/reply/route.ts:1).

Auth-chain `authenticate("user", ["session", "bearer", "api-key"])` уже включает session-cookie — Medusa Admin UI отправит cookie автоматически, никаких header'ов вручную не нужно.

---

## 3. Архитектурные решения

### 3.1 Где (file layout)

```
medusa-agency-boilerplate/
├── medusa-config.ts                       # без изменений
└── src/
    └── admin/
        ├── routes/
        │   └── product-reviews/
        │       ├── page.tsx                                  # список + фильтры + quick actions + pagination
        │       ├── [id]/
        │       │   └── page.tsx                              # детали + actions panel + reply CRUD
        │       ├── components/
        │       │   ├── moderation-filters.tsx                # URL-driven фильтр-форма
        │       │   ├── status-badge.tsx                      # обёртка @medusajs/ui StatusBadge
        │       │   ├── star-rating.tsx                       # «★★★★☆» + aria-label
        │       │   ├── review-detail-actions.tsx             # approve / reject / delete / reply
        │       │   ├── reply-section.tsx                     # display + edit form
        │       │   ├── reject-form.tsx                       # textarea с reason
        │       │   ├── delete-confirm.tsx                    # usePrompt с warning при hasImages
        │       │   ├── review-images-grid.tsx                # photo thumbnails
        │       │   └── empty-state.tsx
        │       └── lib/
        │           ├── api.ts                                # sdk.client.fetch обёртки
        │           ├── copy.ts                               # все RU-строки
        │           ├── helpers.ts                            # formatStarRating, truncateText, formatDate, customerDisplayName, normalizeImageUrls, statusPill mapping
        │           ├── query-keys.ts                         # ['product-reviews', 'list', filters] / ['product-reviews', 'detail', id] / ['product-reviews', 'pending-count']
        │           └── error-mapping.ts                      # error_code → copy
        └── widgets/
            ├── product-reviews-pending-counter.tsx           # зона product.list.before — карточка-счётчик с CTA
            └── product-reviews-on-product-detail.tsx         # (optional, шаг 6) зона product.details.side.after — последние 5 отзывов товара
```

#### 3.1.a Почему два раздельных route-файла, а не один dispatch
Payload использует один `Page.tsx` с веткой по `params.segments` потому, что регистрация двух entries в `payload.config.ts` указывает на одну Component. У Medusa Admin Extensions разделение **на уровне файловой системы** (`page.tsx` vs `[id]/page.tsx`) — типовой паттерн, нативный для Medusa router. Это даёт:
- меньше boilerplate (никаких `parseListFilters` / `getReviewId` диспетчеров),
- естественный prefetch при наведении на ссылку,
- предсказуемый URL без обработки `segments`.

#### 3.1.b Sidebar entry vs nested route
- **Top-level** через `defineRouteConfig({ label: 'Модерация отзывов', icon: ChatBubbleLeftRight })` — самый простой и наиболее видимый вариант. URL: `/app/product-reviews`.
- Альтернатива — `nested: '/products'` (`NestedRoutePosition` поддерживает `/products` — см. [`@medusajs/admin-shared`](medusa-agency-boilerplate/node_modules/@medusajs/admin-shared/dist/index.d.ts:55)). Тогда «Модерация отзывов» уйдёт в подменю «Products» — более логично концептуально, но менее заметно.
- **Решение по умолчанию: top-level**, как сейчас в Payload. Если product-team скажет переехать в submenu — простое изменение в `defineRouteConfig`.

#### 3.1.c Зона для widget счётчика — открытый вопрос
В Medusa 2.13.6 нет `dashboard.*` injection-zone (см. полный список в [`INJECTION_ZONES`](medusa-agency-boilerplate/node_modules/@medusajs/admin-shared/dist/index.d.ts:63)). Доступные зоны для счётчика pending:
- **`product.list.before`** — отображается над таблицей продуктов (модератор всегда видит при заходе в Products). **Рекомендация**.
- **`order.list.before`** — отображается над таблицей заказов.
- Никакой зоны на самом дашборде Medusa Admin (Home page) **нет** — это ограничение SDK 2.13.6.

Альтернативные стратегии счётчика:
1. Карточка в `product.list.before` (рекомендуется).
2. Отказаться от счётчика, опираться только на sidebar-link.
3. Динамический label у sidebar-link с числом — невозможно: `defineRouteConfig.label` — статичная строка, без render hook.

### 3.2 Как (стек)

#### 3.2.a Data layer
- **Auth**: session-cookie. Medusa Admin UI пробрасывает cookie автоматически в `fetch('/admin/...')` благодаря same-origin (`admin.slavx.ru` host обслуживает оба `/app/*` UI и `/admin/*` API).
- **Fetch**: тонкая обёртка над `fetch('/admin/reviews/...', { credentials: 'include' })` либо через `@medusajs/js-sdk`'s `sdk.client.fetch`. **Решение: native `fetch`** — добавлять зависимость `@medusajs/js-sdk` ради 5 endpoint'ов избыточно; типов мало (5 helper'ов), типы скопируем из [`product-reviews-admin-client.ts`](payload-cms/src/lib/product-reviews-admin-client.ts:1) с переименованием.
- **Server-state**: `@tanstack/react-query`'s `useQuery` / `useMutation`. React Query доступен транзитивно через `@medusajs/dashboard` — используется внутри Medusa Admin UI и доступен в admin-extensions без явного npm-install (виден в [`@medusajs/dashboard`](medusa-agency-boilerplate/node_modules/@medusajs/dashboard) deps). Если runtime ругается на duplicate — добавим `@tanstack/react-query` в `package.json` peerDependency.
- **Cache invalidation**: `queryClient.invalidateQueries({ queryKey: ['product-reviews'] })` после mutation. Заменяет Payload-овский `revalidatePath` + `router.refresh()` — без полного перезахода на страницу.

#### 3.2.b UI primitives
Все из [`@medusajs/ui`](medusa-agency-boilerplate/node_modules/@medusajs/ui/dist/esm/index.d.ts:1):
- **`Container`** — внешняя обёртка.
- **`Heading`**, **`Text`**, **`Label`**, **`Hint`** — типографика.
- **`Table`** или **`DataTable`** (block) — Table проще, DataTable даёт sortable/selection. **Решение: `Table`** для list — фильтры у нас URL-driven, sortable не требуется per-spec, DataTable излишен.
- **`Button`**, **`IconButton`** — actions.
- **`Input`**, **`Select`**, **`Textarea`**, **`DatePicker`** — фильтры и формы.
- **`StatusBadge`** — pending/approved/rejected. Маппинг: `pending → orange`, `approved → green`, `rejected → red`.
- **`Drawer`** или **`FocusModal`** vs **полноценная route** для деталей: см. §3.4.
- **`Toaster`** + **`toast`** — successs/error feedback (зарегистрировать `<Toaster />` если ещё нет — у Medusa Admin он уже глобально установлен).
- **`Prompt`** + **`usePrompt`** — confirm-диалог удаления (заменяет `window.confirm`).
- **`Skeleton`** — loading state для list/detail (Phase 2 TODO из Payload-версии — теперь делаем сразу).

#### 3.2.c Иконки
Из [`@medusajs/icons`](medusa-agency-boilerplate/node_modules/@medusajs/icons/dist/components/index.d.ts:1):
- `ChatBubbleLeftRight` — sidebar-icon для «Модерация отзывов».
- `Star` / `StarSolid` — рейтинг.
- `CheckCircle` / `CheckCircleSolid` — approve.
- `XCircle` / `XCircleSolid` — reject.
- `Trash` — delete.
- `Eye` — open detail.
- `PencilSquare` — edit reply.
- `Funnel` — фильтры.
- `MagnifyingGlass` — productId search.

### 3.3 Что мигрирует один-в-один
| Источник                                                                                                                | Назначение                                            |
| ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Все ключи [`moderationCopy`](payload-cms/src/views/product-reviews-moderation/copy.ts:14)                              | `routes/product-reviews/lib/copy.ts` (структура `as const` сохраняется) |
| `formatStarRating`, `truncateText`, `formatDate`, `statusLabel`, `customerDisplayName`, `STATUS_OPTIONS`, `RATING_OPTIONS`, `normalizeAdminReviewImageUrls`, `PAGE_SIZE`, `statusPillStyle` | `routes/product-reviews/lib/helpers.ts` (один-в-один) |
| `mapErrorToCopy` (внутри `ModerationDetailActions.client.tsx` и `ModerationRowActions.client.tsx`)                     | `routes/product-reviews/lib/error-mapping.ts`         |

### 3.4 UX выбор: Drawer vs route для деталей
| Вариант                          | Pros                                                                                                                                                                                                  | Cons                                                                                                                                       |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Отдельный route `[id]/page.tsx`** | URL shareable, browser history natural, легко Cmd-click открывать в новой вкладке, отдельный prefetch                                                                                              | Нужно уйти с list ради детали (контекст теряется)                                                                                          |
| **Drawer поверх list**            | Контекст списка сохраняется, быстрая итеративная модерация (открыл-одобрил-закрыл), нативный Medusa pattern для quick-edit                                                                          | URL не shareable без extra query-params, сложнее delete-and-navigate                                                                      |
| **FocusModal**                    | Полноразмерный, как route, но без потери контекста                                                                                                                                                   | Тяжёлый для частого открытия                                                                                                              |

**Решение по умолчанию**: отдельная route `[id]/page.tsx` (как у Payload сейчас). Совместимо с текущим UX и URL-shareable. Drawer-альтернатива — open question §8.

### 3.5 Loading / error states
- **List**: до получения данных — `<Skeleton>` rows × 5. На ошибку — `Container` с error copy (по `error-mapping.ts`) + `Button` «Повторить» (запускает `refetch`).
- **Detail**: до получения — `Skeleton` для основного блока + sidebar. На 404 — отдельный empty-state с link «Назад к списку».
- **Mutation**: button показывает spinner (через `isPending` от `useMutation`), форма disabled. На успех — `toast.success(...)` + invalidate. На ошибку — `toast.error(mapErrorToCopy(...))`, форма не очищается (UX — можно поправить и retry).

### 3.6 Auth — session-cookie контракт
- Medusa Admin UI хостится и API на одном origin (`admin.slavx.ru`). Cookie `connect.sid` (Medusa session) автоматически отправляется во все `fetch('/admin/...')` запросы.
- При expired session middleware backend возвращает 401. UI должен в этом случае:
  - показать `toast.error('Сессия истекла. Перезайдите.')`,
  - редирект на `/app/login` (стандартный Medusa flow).
- Native `fetch` сам не редиректит — wrapper в `lib/api.ts` обрабатывает 401 централизованно.
- **Никаких** `MEDUSA_ADMIN_SECRET_API_KEY`, `Authorization: Basic ...`, `Authorization: Bearer ...` headers вручную — это всё артефакты Payload-версии.

---

## 4. Что удаляется из Payload (Шаг 7)

### 4.1 Файлы (все удалить целиком)
- [`payload-cms/src/views/product-reviews-moderation/Page.tsx`](payload-cms/src/views/product-reviews-moderation/Page.tsx:1)
- [`payload-cms/src/views/product-reviews-moderation/ModerationFilters.client.tsx`](payload-cms/src/views/product-reviews-moderation/ModerationFilters.client.tsx:1)
- [`payload-cms/src/views/product-reviews-moderation/ModerationRowActions.client.tsx`](payload-cms/src/views/product-reviews-moderation/ModerationRowActions.client.tsx:1)
- [`payload-cms/src/views/product-reviews-moderation/ModerationDetailActions.client.tsx`](payload-cms/src/views/product-reviews-moderation/ModerationDetailActions.client.tsx:1)
- [`payload-cms/src/views/product-reviews-moderation/DashboardWidget.tsx`](payload-cms/src/views/product-reviews-moderation/DashboardWidget.tsx:1)
- [`payload-cms/src/views/product-reviews-moderation/NavLink.tsx`](payload-cms/src/views/product-reviews-moderation/NavLink.tsx:1)
- [`payload-cms/src/views/product-reviews-moderation/copy.ts`](payload-cms/src/views/product-reviews-moderation/copy.ts:1)
- [`payload-cms/src/views/product-reviews-moderation/actions.ts`](payload-cms/src/views/product-reviews-moderation/actions.ts:1)
- [`payload-cms/src/views/product-reviews-moderation/helpers.ts`](payload-cms/src/views/product-reviews-moderation/helpers.ts:1)
- [`payload-cms/src/views/product-reviews-moderation/primitives.tsx`](payload-cms/src/views/product-reviews-moderation/primitives.tsx:1)
- Вся директория [`payload-cms/src/views/product-reviews-moderation/`](payload-cms/src/views/product-reviews-moderation/Page.tsx:1) после очистки.
- [`payload-cms/src/lib/product-reviews-admin-client.ts`](payload-cms/src/lib/product-reviews-admin-client.ts:1) — **только если** ничего другого его не импортирует.
- [`payload-cms/src/lib/medusa-admin-client.ts`](payload-cms/src/lib/medusa-admin-client.ts:1) — **только если** marketing UI и любой другой код Payload его не использует. До phase-out marketing UI **сохранить**.

### 4.2 Регистрации в [`payload-cms/src/payload.config.ts`](payload-cms/src/payload.config.ts:1)
- `admin.components.views.ProductReviewsModerationView` (top-level + `/:id` entries).
- `admin.components.beforeNavLinks` — entry, указывающий на `NavLink.tsx`.
- `admin.components.beforeDashboard` — entry, указывающий на `DashboardWidget.tsx`.
- Регенерация `importMap.js` (`pnpm payload generate:importmap` или эквивалент).

### 4.3 Тесты (если есть)
Тестов на Payload-версии не было (выявлено в trail Phase 1–3 — она опиралась на ручную smoke-проверку). Удалять нечего; в Medusa-версии тесты добавляем по необходимости только на helpers (см. §6).

---

## 5. Что меняется в env / docker-compose

### 5.1 Env переменные
- **`MEDUSA_ADMIN_SECRET_API_KEY`** — секрет для Basic-auth от Payload.
  - Payload-версия модерации **больше не использует** — после Шага 7 переменная не нужна для product-reviews flow.
  - **Условие удаления**: marketing UI ([`plans/marketing-ui-payload-cms.md`](plans/marketing-ui-payload-cms.md:1)) тоже мигрировал в Medusa Admin **или** этот план явно отказывается от marketing migration.
  - Если marketing UI остаётся в Payload — **переменную НЕ удалять**, она нужна для marketing campaigns.
  - Действие на этом этапе: **никаких изменений до подтверждения статуса marketing UI** (см. §7 risk #3).

### 5.2 Docker-compose / Hotfix `abc0a19` (override `MEDUSA_BACKEND_URL` для payload-cms)
- Hotfix добавил override `MEDUSA_BACKEND_URL: http://medusa:9000` (внутри Docker network) для payload-cms контейнера, потому что Payload-server-component делал админ-вызовы к Medusa и не мог достучаться до публичного `https://api.slavx.ru` из Docker network.
- После Шага 7 (удаления Payload-версии модерации) Payload **больше не делает прямых server-side вызовов к Medusa Admin API** для product-reviews.
- **Когда откатывать override**:
  - **Если marketing UI остался в Payload** — НЕ откатывать. Marketing UI всё ещё ходит к Medusa из Payload-server.
  - **Если marketing UI тоже мигрирует или его серверная часть в Payload отсутствует** — можно откатить как часть Шага 8.
- **Решение по умолчанию**: hotfix НЕ трогаем в этом плане. Откат — отдельная задача после ревизии всех Payload→Medusa server-call паттернов.

---

## 6. Поэтапная реализация

> Каждый шаг должен заканчиваться чистым `tsc --noEmit`, чистым `npm run typecheck` в обоих проектах (`medusa-agency-boilerplate` и `payload-cms`), и (для шагов 3–6) ручным smoke-тестом против локального backend.

### Шаг 1 — branch + плейсхолдеры
- Создать ветку `feat/product-reviews-phase-4-medusa-admin-refactor` от `main` (`f3b1031`).
- Создать пустые директории `src/admin/routes/product-reviews/`, `src/admin/widgets/`.
- Никакого кода — просто структура и `.gitkeep`/README-stub.
- Acceptance: `git status` показывает только новые директории.

### Шаг 2 — admin client + helpers + copy
Создать утилиты, изолированные от React:
- `src/admin/routes/product-reviews/lib/api.ts`:
  - `listProductReviews(filters)` → `GET /admin/reviews` (filter маппинг snake_case `product_id`).
  - `getProductReview(id)` → `GET /admin/reviews/:id`.
  - `approveProductReview(id)` → `POST /admin/reviews/:id/approve`.
  - `rejectProductReview(id, reason)` → `POST /admin/reviews/:id/reject`.
  - `deleteProductReview(id)` → `DELETE /admin/reviews/:id`.
  - `setReply(id, text)` → `POST /admin/reviews/:id/reply`.
  - `clearReply(id)` → `DELETE /admin/reviews/:id/reply`.
  - Все возвращают discriminated union `{ ok: true, data } | { ok: false, status, error, message? }` — копируем shape из Payload-версии.
  - 401 → нормальный `{ ok: false, error: 'unauthorized' }` (no auto-redirect on lib level).
- `src/admin/routes/product-reviews/lib/copy.ts` — порт [`moderationCopy`](payload-cms/src/views/product-reviews-moderation/copy.ts:14) один-в-один.
- `src/admin/routes/product-reviews/lib/helpers.ts` — порт `formatStarRating`, `truncateText`, `formatDate`, `statusLabel`, `customerDisplayName`, `STATUS_OPTIONS`, `RATING_OPTIONS`, `normalizeAdminReviewImageUrls`, `PAGE_SIZE`.
- `src/admin/routes/product-reviews/lib/error-mapping.ts` — порт `mapErrorToCopy`.
- `src/admin/routes/product-reviews/lib/query-keys.ts`:
  - `productReviewsListKey(filters)` — `['product-reviews', 'list', filters]`.
  - `productReviewDetailKey(id)` — `['product-reviews', 'detail', id]`.
  - `pendingReviewsCountKey` — `['product-reviews', 'pending-count']`.
- Опциональный mini-test (jest unit) для `helpers.ts` (`normalizeAdminReviewImageUrls`, `formatStarRating`, `truncateText`) — это уже есть как контракт в Payload-версии, переносим вместе.
- Acceptance: `tsc --noEmit` чистый, helpers покрыты unit-тестами на парность с Payload-версией.

### Шаг 3 — список + фильтры + quick actions
Файл: `src/admin/routes/product-reviews/page.tsx`.
- Component-level:
  - `defineRouteConfig({ label: copy.nav.label, icon: ChatBubbleLeftRight })` — sidebar entry.
  - `useSearchParams` (от react-router внутри Medusa Admin) — читаем `status`, `rating`, `productId`, `dateFrom`, `dateTo`, `page`.
  - `useQuery({ queryKey: productReviewsListKey(filters), queryFn: () => listProductReviews(filters) })`.
  - Render: `Container` → `Heading` (heading + subheading) → `<ModerationFilters>` (отдельный component) → conditional `<Table>` / `<EmptyState>` / `<ErrorBanner>` → `<Pagination>`.
- Sub-components:
  - `<ModerationFilters>` — форма с 5 полями + Submit/Reset, push в URL через `setSearchParams` (replace, без ререндера полной страницы).
  - `<Table>` — `@medusajs/ui` `Table.{Root, Header, Row, HeaderCell, Body, Cell}`, 7 колонок (см. §2.2). В колонке «Действия» — `<Link to={`/product-reviews/${id}`}><IconButton><Eye /></IconButton></Link>` + quick approve/reject `Button`'ы для pending.
  - `<Pagination>` — `Table.Pagination` либо ручной (prev/next + counter).
  - `<RatingClientFilterNotice>` — если `rating` фильтр активен (он клиент-сайд per-page, как сейчас в Payload).
- Quick actions:
  - Quick approve = `useMutation({ mutationFn: approveProductReview, onSuccess: () => { toast.success(copy.detail.success.approved); queryClient.invalidateQueries({ queryKey: ['product-reviews'] }) } })`.
  - Quick reject = open mini-prompt (через `usePrompt`) с `<Textarea>` для reason, на confirm — `rejectProductReview(id, reason)`.
- Acceptance: на `https://localhost:9000/app/product-reviews` (или dev port) виден список pending-отзывов; фильтры status/rating/dates работают; quick approve меняет status в БД и список обновляется без перезагрузки.

### Шаг 4 — детали + полный action panel + reply CRUD
Файл: `src/admin/routes/product-reviews/[id]/page.tsx`.
- Component-level:
  - `useParams<{ id: string }>()` → reviewId.
  - `useQuery({ queryKey: productReviewDetailKey(id), queryFn: () => getProductReview(id) })`.
  - Layout: 2-column grid (`minmax(0, 2fr) minmax(0, 1fr)`). Слева `<ReviewBody>`, справа `<ReviewSidebar>` + `<ReviewDetailActions>`.
- `<ReviewBody>` — title, text, pros, cons, rejection_reason (если rejected), photo grid.
- `<ReviewSidebar>` — все meta-поля (product_id, status, rating, created_at, moderated_by, moderated_at, verified_purchase, order_id, customer_name, customer_id).
- `<ReviewDetailActions>`:
  - `<Button variant="primary">{copy.detail.actions.approve}</Button>` (если status !== 'approved').
  - `<Button variant="secondary">{copy.detail.actions.reject}</Button>` (если status !== 'rejected') — toggle `<RejectForm>`.
  - `<Button variant="danger">{copy.detail.actions.delete}</Button>` — `usePrompt` confirm + warning при `hasImages`.
- `<RejectForm>` — `<Textarea required maxLength={500}>` + char counter + Submit/Cancel.
- `<ReplySection>`:
  - Если reply есть и форма не открыта — display block (текст + by + at).
  - Если reply нет и форма не открыта — empty hint + button «Добавить ответ».
  - Если форма открыта — `<Textarea required maxLength={1000}>` + char counter + Submit/Cancel + Remove button (если был reply).
- All mutations используют `useMutation` + `queryClient.invalidateQueries({ queryKey: ['product-reviews'] })`.
- После успешного delete — `navigate('/product-reviews')`.
- Acceptance: full UX parity с Payload-версией; approve/reject/delete/reply работают; photo grid рендерится; warning при delete с images; reject валидирует 500-char limit; reply валидирует 1000-char limit.

### Шаг 5 — счётчик pending в зоне `product.list.before`
Файл: `src/admin/widgets/product-reviews-pending-counter.tsx`.
- `defineWidgetConfig({ zone: 'product.list.before' })`.
- `useQuery({ queryKey: pendingReviewsCountKey, queryFn: () => listProductReviews({ status: 'pending', page: 1, pageSize: 1 }), staleTime: 30_000 })` — короткий stale, no aggressive refetch.
- Render: `<Container>` с `<StatusBadge color="orange">` + heading + count. Если 0 — нейтральный empty-state.
- CTA `<Link to="/product-reviews?status=pending">Перейти к очереди</Link>`.
- Error fallback — короткий error-banner с copy из `dashboardWidget.errors`.
- Acceptance: на `/app/products` сверху появляется карточка с числом pending-отзывов; click ведёт в очередь модерации.

### Шаг 6 (optional) — product-detail widget
Файл: `src/admin/widgets/product-reviews-on-product-detail.tsx`.
- `defineWidgetConfig({ zone: 'product.details.side.after' })`.
- `data: AdminProduct` — берём `data.id` как productId.
- `useQuery({ queryKey: ['product-reviews', 'list', { productId: data.id, pageSize: 5 }], queryFn: () => listProductReviews({ productId: data.id, pageSize: 5 }) })`.
- Render: `<Container>` → `<Heading>` «Отзывы товара» → list (Star + truncated text + StatusBadge + дата) → `<Link to={`/product-reviews?productId=${data.id}`}>Открыть полную модерацию</Link>`.
- Acceptance: на странице любого товара справа виден список последних 5 отзывов с переходом в полную модерацию.

### Шаг 7 — удаление Payload-версии
- В [`payload-cms/src/payload.config.ts`](payload-cms/src/payload.config.ts:1) убрать:
  - `admin.components.views.ProductReviewsModerationView` (обе entry: top-level + `:id`).
  - Запись в `admin.components.beforeNavLinks`, ссылающуюся на `NavLink.tsx`.
  - Запись в `admin.components.beforeDashboard`, ссылающуюся на `DashboardWidget.tsx`.
- Удалить директорию [`payload-cms/src/views/product-reviews-moderation/`](payload-cms/src/views/product-reviews-moderation/Page.tsx:1) целиком.
- Удалить [`payload-cms/src/lib/product-reviews-admin-client.ts`](payload-cms/src/lib/product-reviews-admin-client.ts:1) (проверить через `grep` — нет других импортов).
- [`payload-cms/src/lib/medusa-admin-client.ts`](payload-cms/src/lib/medusa-admin-client.ts:1) — **проверить usage** (marketing-кампании в Payload могут использовать). Если использует marketing — оставить; если нет — удалить.
- Регенерация importMap: `cd payload-cms && pnpm payload generate:importmap` (или эквивалент).
- Smoke: `cms.slavx.ru/admin/product-reviews/moderation` отвечает 404; sidebar Payload не содержит «Модерация отзывов»; dashboard Payload не содержит счётчик; остальной Payload UI работает.
- Acceptance: typecheck чистый, ручная smoke-проверка зелёная.

### Шаг 8 — env / docker-compose cleanup
- Перепроверить usage `MEDUSA_ADMIN_SECRET_API_KEY` в `payload-cms/`.
- Если он остался ТОЛЬКО для marketing UI — оставить переменную в env.
- Если usage не осталось — удалить из `.env.example` обоих проектов и [`Docs/env_contract.md`](Docs/env_contract.md:1), также из staging-secrets workflow.
- Hotfix `abc0a19` (override `MEDUSA_BACKEND_URL` для payload-cms): откатить **только** если marketing UI больше не делает server-side calls к Medusa.
- Acceptance: только подтверждённые удаления, никаких поломок marketing flow.

### Шаг 9 — обновить план §5 product-reviews-module.md
- Открыть `plans/product-reviews-module.md` (root project plan).
- Заменить упоминания «UI модерации в Payload» на «UI модерации в Medusa Admin (`src/admin/routes/product-reviews/`)».
- Добавить пометку о завершении Phase 4 в журнал плана.
- Acceptance: план синхронизирован с реальностью.

### Шаг 10 — sweep + merge + redeploy
- `npm run typecheck` в `medusa-agency-boilerplate/` и `payload-cms/`.
- Полный test pass (700+ unit + integration на backend).
- Manual smoke-checklist (см. §9 Acceptance Criteria).
- Открыть PR `feat/product-reviews-phase-4-medusa-admin-refactor` → `main`.
- После merge — deploy staging, ручной QA по checklist.
- После QA — production deploy.
- Acceptance: продакшн `admin.slavx.ru/app/product-reviews` работает; `cms.slavx.ru/admin/product-reviews/moderation` 404.

---

## 7. Риски и митигации

1. **TanStack Query availability в admin-extensions context**
   - Risk: `@tanstack/react-query` транзитивный, не peerDependency `@medusajs/admin-sdk`. Возможен Vite-bundle conflict.
   - Mitigation: Шаг 2 — попробовать `import { useQuery } from '@tanstack/react-query'`. Если упадёт — добавить в `package.json` (devDep) и зафиксировать версию из `@medusajs/dashboard` (чтобы не расходились client'ы).
   - Fallback: использовать обычные `useEffect + useState` если query-react не работает; cost — больше boilerplate, но функционально парно.

2. **Session-cookie auth на cross-origin staging**
   - Risk: если admin-UI и admin-API на разных host'ах (`admin.slavx.ru` vs `api.slavx.ru`) — cookie `connect.sid` не уйдёт без `credentials: 'include'` + правильный CORS + `SameSite=None; Secure`.
   - Mitigation: проверить текущий [`medusa-config.ts`](medusa-agency-boilerplate/medusa-config.ts:1) — `adminCors`, `authCors` настроены, и Medusa Admin UI хостится на том же домене что и API. Если не так — fallback на bearer-token (Medusa Admin UI имеет рабочий login flow).
   - Test gate: в Шаге 3 локально + staging проверить devtools network tab — что cookie реально летит.

3. **Marketing UI parallel migration**
   - Risk: marketing UI ([`plans/marketing-ui-payload-cms.md`](plans/marketing-ui-payload-cms.md:1)) использует тот же `medusa-admin-client.ts` и тот же `MEDUSA_ADMIN_SECRET_API_KEY`. Если этот план игнорирует marketing, env/docker cleanup (Шаги 8) частичен и hotfix `abc0a19` нельзя откатить.
   - Mitigation: **до старта реализации** запросить у пользователя решение — переносим ли в этот же спринт marketing UI (и тогда план расширяется), или оставляем marketing в Payload (и тогда env/secret cleanup deferred).
   - Open question — см. §8.

4. **Widget zone compatibility (нет `dashboard.*`)**
   - Risk: пользователь явно просил счётчик «на дашборде» (как сейчас в Payload). У Medusa 2.13.6 dashboard-zone не существует.
   - Mitigation: Шаг 5 — счётчик в `product.list.before`. Альтернативно — `order.list.before`. Это open question — см. §8.

5. **Drawer vs route UX выбор**
   - Risk: текущая Payload-версия — отдельная route. План по умолчанию повторяет это. Если product-team решит drawer — нужен рефакторинг Шага 4 (но не разрушительный — Drawer обёртка вокруг той же `<ReviewBody>` / `<ReviewSidebar>` / `<ReviewDetailActions>`).
   - Mitigation: компоненты в Шаге 4 проектируем без знания о shell (route vs Drawer) — все props через интерфейсы. UX-выбор откладывается на manual review после Шага 4.

6. **Кэширование `pending-count` widget**
   - Risk: широкий `staleTime: 30_000` означает, что после approve/reject счётчик может ещё минуту показывать старое число.
   - Mitigation: invalidate `pendingReviewsCountKey` в onSuccess approve/reject/delete мутаций.
   - Уточнение: Payload-версия использовала `cache: 'no-store'` — каждый рендер дашборда был новый запрос. У нас 30s + invalidate — компромисс между перегрузкой backend и свежестью.

7. **Pre-existing image rendering на storefront** — НЕ задет. Backend контракт `ProductReviewPublic.images: string[]` не меняется, storefront `medusa-agency-boilerplate-storefront/` тоже не трогаем.

8. **CMS-команда vs commerce-команда (бизнес-вопрос)**
   - Risk: модераторы привычны заходить в Payload `cms.slavx.ru` для редактирования контента. Перенос в `admin.slavx.ru` (commerce-домен) меняет их workflow.
   - Mitigation: бизнес-вопрос, не блокирует план. Решение — задокументировать в release-notes и обучить команду.

---

## 8. Open vs blocking questions

### Blocking (нужны до Шага 1)
1. **Marketing UI parallel migration** — переносим ли marketing UI в Medusa Admin в этом же спринте?
   - **Если да** — план расширяется, env/secret cleanup и hotfix-rollback включаем в Шаги 7–8.
   - **Если нет** — env/secret cleanup deferred, hotfix `abc0a19` НЕ откатываем.
   - **Default assumption (если ответа нет)**: НЕТ, marketing UI остаётся в Payload — план идёт по conservative-варианту.

### Open (можно решить по ходу или deferred на Phase 5)
2. **Зона счётчика widget'а** — `product.list.before` (default) или `order.list.before`, или отказ от widget'а вообще (только sidebar-link)?
   - Default: `product.list.before`.
3. **Drawer vs route для деталей** — оставляем route (default, parity с Payload) или переходим на Drawer?
   - Default: route.
4. **Sidebar entry — top-level или nested под `/products`**?
   - Default: top-level.
5. **`@tanstack/react-query`** — добавлять в `package.json` сразу или попробовать транзитивно?
   - Default: попробовать транзитивно в Шаге 2; добавить если не работает.

---

## 9. Acceptance Criteria

Все критерии должны быть зелёные перед merge → main:

### UI / UX
- [ ] На `https://admin.slavx.ru/app/product-reviews` открывается список pending-отзывов (default filter).
- [ ] Sidebar Medusa Admin содержит entry «Модерация отзывов» с иконкой ChatBubbleLeftRight.
- [ ] Фильтры status / rating / productId / dateFrom / dateTo — работают и отражаются в URL.
- [ ] Pagination работает; total и pageOf считаются корректно.
- [ ] Quick approve / reject в строке (для pending) работают; статус в БД меняется; список обновляется без перезагрузки страницы.
- [ ] Открытие детали (`/app/product-reviews/{id}`) показывает review body, sidebar meta, photo grid (если есть).
- [ ] Approve на детальной — статус меняется, toast success, sidebar и photo grid persisted.
- [ ] Reject с reason 1..500 chars — статус меняется, reason сохраняется, отображается в `rejection_reason`.
- [ ] Reject с пустым reason — клиентская валидация (toast error), backend не вызывается.
- [ ] Delete — confirm dialog с warning «фото будут удалены» при `images.length > 0`; после confirm — review удаляется, navigate назад в список, toast success.
- [ ] Reply add — текст 1..1000 chars сохраняется; в карточке появляется блок «Ответ магазина» с автором и датой.
- [ ] Reply edit — отображается старый текст, можно изменить и сохранить.
- [ ] Reply remove — confirm; merchant_reply очищается.
- [ ] Pending counter widget на `/app/products` показывает актуальное число; CTA ведёт в очередь.

### Backend / data
- [ ] Все `/admin/reviews/*` endpoint'ы продолжают работать (никаких изменений в backend).
- [ ] Email-уведомления отправляются (approve / reject — backend hook не тронут).
- [ ] Storefront UI отзывов не сломан (smoke `https://www.slavx.ru/products/{slug}` показывает approved-отзывы).
- [ ] Cache invalidation: после approve `product-rating-{productId}` / `product-reviews-{productId}` / `customer-reviews-{customer_id}` (если был) / `top-reviews` инвалидируются (backend hook не тронут).

### Tests / quality
- [ ] 700+ unit-tests на backend остаются зелёными.
- [ ] Новые helper'ы (`normalizeAdminReviewImageUrls`, `formatStarRating`, `truncateText`, `formatDate`) покрыты unit-тестами на parity с Payload-версией.
- [ ] `tsc --noEmit` зелёный в `medusa-agency-boilerplate/` и `payload-cms/`.
- [ ] Lint зелёный.

### Cleanup
- [ ] `cms.slavx.ru/admin/product-reviews/moderation` отвечает 404 (Payload-версия удалена).
- [ ] Sidebar Payload не содержит entry «Модерация отзывов».
- [ ] Dashboard Payload не содержит счётчик pending-отзывов.
- [ ] [`payload-cms/src/views/product-reviews-moderation/`](payload-cms/src/views/product-reviews-moderation/Page.tsx:1) полностью удалена.
- [ ] [`payload-cms/src/lib/product-reviews-admin-client.ts`](payload-cms/src/lib/product-reviews-admin-client.ts:1) удалён (если не используется ничем кроме модерации).
- [ ] План `product-reviews-module.md` обновлён.

---

## 10. Deferred / Phase 5+

- **Marketing UI migration в Medusa Admin** — отдельный план, использует тот же паттерн (admin-extensions routes/widgets).
- **Lightbox для фото** в Medusa Admin moderation detail — текущий план показывает thumbnails с `<a target="_blank">`, full-screen lightbox можно добавить позже.
- **JSON-LD `Review.image`** — SEO-улучшение для storefront, не привязано к admin UI.
- **Orphaned uploads janitor** — фоновая задача для S3 cleanup осиротевших фотографий после bulk-delete.
- **Customer email на новый merchant reply** — уведомление покупателю «Магазин ответил на ваш отзыв» (требует email-template + subscriber).
- **Drawer-альтернатива для deталей** (если product-team захочет).
- **Server-side rating filter** в `/admin/reviews` (сейчас client-side per-page) — backend-feature, потом synced UI.
- **Динамический pending-count в sidebar entry label** — невозможно в SDK 2.13.6, ждём upstream feature или hack.
- **Bulk approve / reject** через DataTable selection — Medusa `DataTable` block поддерживает selection; при росте нагрузки на модерацию может быть полезным.
