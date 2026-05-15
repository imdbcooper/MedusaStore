# Product Reviews Phase 1 — Verification report

> Дата: 2026-05-14
> Шаги 1–10 завершены. Этот отчёт фиксирует зелёный статус перед шагом 12 (staging deploy).
> План: [`plans/product-reviews-module.md`](plans/product-reviews-module.md:1)

---

## Сводка (TL;DR)

| Шаг | Workspace | Команда | Статус | Время |
|-----|-----------|---------|--------|-------|
| 11.1.1 | backend | `npm run typecheck` | ✅ PASS, exit 0 | 5.60s |
| 11.1.2 | backend | `npm run test:unit` | ✅ PASS, 64 suites / 557 tests / 0 failed | 49.49s (wall 51.02s) |
| 11.1.3 | backend | `npm run build` | ✅ PASS | backend 6.96s · frontend 20.53s · общее 24.30s |
| 11.1.4 | backend | `lint` | ⚪ N/A — скрипта нет в [`package.json`](medusa-agency-boilerplate/package.json:15) |
| 11.2.5 | storefront | `npm run typecheck` | ✅ PASS, exit 0 | 2.83s |
| 11.2.6 | storefront | `npm run lint` | ✅ PASS, 0 warnings, 0 errors | 2.62s |
| 11.2.7 | storefront | `npm run build` | ✅ PASS, product page = SSG, `/api/revalidate` = Dynamic | compile 14.0s · общее 28.79s |
| 11.2.8 | storefront | `test` / `test:unit` | ⚪ N/A — скриптов нет в [`package.json`](medusa-agency-boilerplate-storefront/package.json:10) |
| 11.4 | smoke | `ensureProductReviewsTables` экспорт + сигнатура | ✅ PASS (см. ниже) | <1s |

---

## Результаты

### Backend (`medusa-agency-boilerplate/`)

- **typecheck:** PASS, exit 0 (`tsc --noEmit`, 5.60s).
- **test:unit:** PASS, 64 suites, 557 tests, 557 passed, 0 failed, 0 skipped (49.49s test wall, force-exit). Включает покрытие модуля и API отзывов:
  - [`src/modules/__tests__/product-reviews.unit.spec.ts`](medusa-agency-boilerplate/src/modules/__tests__/product-reviews.unit.spec.ts:1)
  - [`src/api/store/products/[id]/reviews/__tests__/route.unit.spec.ts`](medusa-agency-boilerplate/src/api/store/products/[id]/reviews/__tests__/route.unit.spec.ts:1)
  - [`src/api/store/products/[id]/rating/__tests__/route.unit.spec.ts`](medusa-agency-boilerplate/src/api/store/products/[id]/rating/__tests__/route.unit.spec.ts:1)
  - [`src/api/store/reviews/[id]/helpful/__tests__/route.unit.spec.ts`](medusa-agency-boilerplate/src/api/store/reviews/[id]/helpful/__tests__/route.unit.spec.ts:1)
  - [`src/api/store/customers/me/reviews/__tests__/route.unit.spec.ts`](medusa-agency-boilerplate/src/api/store/customers/me/reviews/__tests__/route.unit.spec.ts:1)
  - [`src/api/store/customers/me/reviews/[id]/__tests__/route.unit.spec.ts`](medusa-agency-boilerplate/src/api/store/customers/me/reviews/[id]/__tests__/route.unit.spec.ts:1)
  - [`src/api/admin/reviews/__tests__/route.unit.spec.ts`](medusa-agency-boilerplate/src/api/admin/reviews/__tests__/route.unit.spec.ts:1)
  - [`src/api/admin/reviews/[id]/__tests__/route.unit.spec.ts`](medusa-agency-boilerplate/src/api/admin/reviews/[id]/__tests__/route.unit.spec.ts:1)
  - [`src/api/admin/reviews/[id]/approve/__tests__/route.unit.spec.ts`](medusa-agency-boilerplate/src/api/admin/reviews/[id]/approve/__tests__/route.unit.spec.ts:1)
  - [`src/api/admin/reviews/[id]/reject/__tests__/route.unit.spec.ts`](medusa-agency-boilerplate/src/api/admin/reviews/[id]/reject/__tests__/route.unit.spec.ts:1)
- **build (`medusa build`):** PASS — backend compile 6.96s, frontend (admin UI) compile 20.53s, общий wallclock 24.30s. Артефакты в `.medusa/server` обновлены.
- **lint:** N/A — в [`package.json`](medusa-agency-boilerplate/package.json:15) нет скрипта `lint`/`eslint` (только `build`, `typecheck`, `test:*`, `seed*`, `start`, `dev`, `prepare:checkout-runtime`, `admin:api-key:local`). Lint в этом воркспейсе не настроен — пропуск зафиксирован.

### Storefront (`medusa-agency-boilerplate-storefront/`)

- **typecheck:** PASS, exit 0 (`tsc --noEmit`, 2.83s).
- **lint:** PASS, exit 0 — `next lint` → «✔ No ESLint warnings or errors» (2.62s).
- **build (`next build`, Next.js 15.3.9):** PASS, общее время 28.79s, compile 14.0s, generated 15/15 static pages.
  - Product page **`● /[countryCode]/products/[handle]` → SSG** (uses `generateStaticParams`), prerendered HTML для `/ru/products/test-product`, `/ru/products/runtime-validation-checkout-item`, `/ru/products/practical-seller-1776661617` и ещё 4 хэндлов. Страница НЕ деградировала в `ƒ (Dynamic)`. ✅
  - **`ƒ /api/revalidate` → Dynamic** (server-rendered on demand), как и требуется для on-demand invalidation, ровно 167 B / 102 kB shared. ✅
  - Middleware: 34.2 kB (`ƒ`).
- **test / test:unit:** N/A — в [`package.json`](medusa-agency-boilerplate-storefront/package.json:10) присутствуют только `dev`, `build`, `start`, `lint`, `typecheck`, `analyze`. Тестов в storefront-воркспейсе нет, тест-фреймворк не установлен — пропуск зафиксирован.

---

## Изменённые / созданные файлы

Группировка по областям, перечисленным в задаче. Источник — `git status --porcelain` + `git ls-files --others --exclude-standard` по конкретным каталогам отзывов.

### Backend модуль / API / subscribers / shared lib

Всего **24 файла** в области отзывов (22 новых + 2 модифицированных).

- **Module + unit-spec (2 new):**
  - [`src/modules/product-reviews.ts`](medusa-agency-boilerplate/src/modules/product-reviews.ts:1) — `ensureProductReviewsTables`, CRUD, atomic recalc, helpful idempotency, customer_name resolver.
  - [`src/modules/__tests__/product-reviews.unit.spec.ts`](medusa-agency-boilerplate/src/modules/__tests__/product-reviews.unit.spec.ts:1)
- **Store API (8 new):**
  - [`src/api/store/products/[id]/reviews/route.ts`](medusa-agency-boilerplate/src/api/store/products/[id]/reviews/route.ts:1) + `__tests__/route.unit.spec.ts`
  - [`src/api/store/products/[id]/rating/route.ts`](medusa-agency-boilerplate/src/api/store/products/[id]/rating/route.ts:1) + `__tests__/route.unit.spec.ts`
  - [`src/api/store/reviews/[id]/helpful/route.ts`](medusa-agency-boilerplate/src/api/store/reviews/[id]/helpful/route.ts:1) + `__tests__/route.unit.spec.ts`
  - [`src/api/store/customers/me/reviews/route.ts`](medusa-agency-boilerplate/src/api/store/customers/me/reviews/route.ts:1) + `__tests__/route.unit.spec.ts`
  - [`src/api/store/customers/me/reviews/[id]/route.ts`](medusa-agency-boilerplate/src/api/store/customers/me/reviews/[id]/route.ts:1) + `__tests__/route.unit.spec.ts`
- **Admin API (8 new):**
  - [`src/api/admin/reviews/route.ts`](medusa-agency-boilerplate/src/api/admin/reviews/route.ts:1) + `__tests__/route.unit.spec.ts`
  - [`src/api/admin/reviews/[id]/route.ts`](medusa-agency-boilerplate/src/api/admin/reviews/[id]/route.ts:1) + `__tests__/route.unit.spec.ts`
  - [`src/api/admin/reviews/[id]/approve/route.ts`](medusa-agency-boilerplate/src/api/admin/reviews/[id]/approve/route.ts:1) + `__tests__/route.unit.spec.ts`
  - [`src/api/admin/reviews/[id]/reject/route.ts`](medusa-agency-boilerplate/src/api/admin/reviews/[id]/reject/route.ts:1) + `__tests__/route.unit.spec.ts`
- **Subscribers (2 new, GDPR/cleanup):**
  - [`src/subscribers/customer-deleted-product-reviews.ts`](medusa-agency-boilerplate/src/subscribers/customer-deleted-product-reviews.ts:1)
  - [`src/subscribers/product-deleted-product-reviews.ts`](medusa-agency-boilerplate/src/subscribers/product-deleted-product-reviews.ts:1)
- **Shared lib (1 new):**
  - [`src/lib/storefront-revalidate.ts`](medusa-agency-boilerplate/src/lib/storefront-revalidate.ts:1) — fire-and-forget вызов `/api/revalidate` сторфронта с `STOREFRONT_REVALIDATE_SECRET`.
- **Middleware (1 modified):**
  - [`src/api/middlewares.ts`](medusa-agency-boilerplate/src/api/middlewares.ts:1) — public rate-limit на `POST /store/products/:id/reviews` и `POST /store/reviews/:id/helpful`.

### Storefront UI / data

Всего **18 файлов** в области отзывов (13 новых + 5 модифицированных).

- **Data layer (2 new):**
  - [`src/lib/data/product-reviews.ts`](medusa-agency-boilerplate-storefront/src/lib/data/product-reviews.ts:1) — server-action wrapper + tagged fetch.
  - [`src/lib/util/pluralize-ru.ts`](medusa-agency-boilerplate-storefront/src/lib/util/pluralize-ru.ts:1)
- **API route (1 new):**
  - [`src/app/api/revalidate/route.ts`](medusa-agency-boilerplate-storefront/src/app/api/revalidate/route.ts:1) — on-demand revalidate-tag endpoint, `ƒ Dynamic`.
- **Compoenents (10 new):**
  - [`src/modules/common/components/review-stars/index.tsx`](medusa-agency-boilerplate-storefront/src/modules/common/components/review-stars/index.tsx:1)
  - [`src/modules/common/components/review-stars/input.tsx`](medusa-agency-boilerplate-storefront/src/modules/common/components/review-stars/input.tsx:1)
  - [`src/modules/products/components/product-rating-badge/index.tsx`](medusa-agency-boilerplate-storefront/src/modules/products/components/product-rating-badge/index.tsx:1)
  - [`src/modules/products/components/product-review-card/index.tsx`](medusa-agency-boilerplate-storefront/src/modules/products/components/product-review-card/index.tsx:1)
  - [`src/modules/products/components/product-review-card/helpful-button.tsx`](medusa-agency-boilerplate-storefront/src/modules/products/components/product-review-card/helpful-button.tsx:1)
  - [`src/modules/products/components/product-review-form/index.tsx`](medusa-agency-boilerplate-storefront/src/modules/products/components/product-review-form/index.tsx:1)
  - [`src/modules/products/components/product-reviews-list/index.tsx`](medusa-agency-boilerplate-storefront/src/modules/products/components/product-reviews-list/index.tsx:1)
  - [`src/modules/products/components/product-reviews-list/pager.tsx`](medusa-agency-boilerplate-storefront/src/modules/products/components/product-reviews-list/pager.tsx:1)
  - [`src/modules/products/components/product-reviews-summary/index.tsx`](medusa-agency-boilerplate-storefront/src/modules/products/components/product-reviews-summary/index.tsx:1)
  - [`src/modules/products/components/product-reviews-summary/write-review-button.tsx`](medusa-agency-boilerplate-storefront/src/modules/products/components/product-reviews-summary/write-review-button.tsx:1)
- **Modified (5):**
  - [`src/lib/env.ts`](medusa-agency-boilerplate-storefront/src/lib/env.ts:1) — резолв `REVALIDATE_SECRET`/`STOREFRONT_REVALIDATE_SECRET`.
  - [`src/lib/storefront-config.ts`](medusa-agency-boilerplate-storefront/src/lib/storefront-config.ts:1) — preset-driven copy `copy.reviews.*`.
  - [`src/modules/products/components/product-tabs/index.tsx`](medusa-agency-boilerplate-storefront/src/modules/products/components/product-tabs/index.tsx:1) — вкладка «Отзывы», server/client boundary.
  - [`src/modules/products/templates/index.tsx`](medusa-agency-boilerplate-storefront/src/modules/products/templates/index.tsx:1)
  - [`src/modules/products/templates/product-info/index.tsx`](medusa-agency-boilerplate-storefront/src/modules/products/templates/product-info/index.tsx:1) — `ProductRatingBadge` + empty-state.

### Shared / env (3 modified)

- [`.env.example`](.env.example:1)
- [`.env.staging.example`](.env.staging.example:1)
- [`medusa-agency-boilerplate-storefront/.env.local.example`](medusa-agency-boilerplate-storefront/.env.local.example:1)

### Итог по группам

| Группа | Новых | Модифицир. | Всего |
|--------|------:|-----------:|------:|
| Backend (module + API + subscribers + lib) | 21 | 0 | 21 |
| Backend middleware | 0 | 1 | 1 |
| Storefront (data + API + components) | 13 | 0 | 13 |
| Storefront (modified UI/config/env) | 0 | 5 | 5 |
| Shared/env-контракты | 0 | 3 | 3 |
| **Итого по Phase 1 reviews** | **34** | **9** | **43** |

> Прочие файлы в `git status` (`it_services_portfolio.md`, `plans/marketing-ui-payload-cms.md`, `plans/product-images/*.png`, `plans/vk-id-login-register-integration.md`, `scripts/upload-product-images.py`, `medusa-agency-boilerplate/static/`, и т. д.) к Phase 1 reviews не относятся — это фоновые работы по другим задачам и не попадают в скоп шага 12.

---

## Smoke-проверки контрактов (без БД, без сети) — шаг 11.4

Запущено: `node -e "require('./medusa-agency-boilerplate/.medusa/server/src/modules/product-reviews').ensureProductReviewsTables.toString().slice(0,240)"`

Результат: **PASS**.

```
OK type= function
signature head:
async function ensureProductReviewsTables(pgConnection) {
    await pgConnection.raw(`
    create table if not exists product_review (
      id text primary key,
      product_id text not null,
      customer_id text null,
      order_id te
```

- Экспорт `ensureProductReviewsTables` присутствует в скомпилированном артефакте `.medusa/server/src/modules/product-reviews.js` (после `npm run build`).
- Сигнатура — `async function (pgConnection)`, первое выражение — `pgConnection.raw(\`create table if not exists product_review …\`)` (стиль [`marketing-layer.ts`](medusa-agency-boilerplate/src/modules/marketing-layer.ts:1)).
- Интеграционных вызовов к Postgres / Next.js НЕ выполнялось (это шаг 12).

Прочие smoke-проверки модуля (`UNIQUE`-конфликт, atomic recalc, helpful idempotency, verified_purchase branch, Zod strict отбрасывание `images`) уже покрыты unit-тестами (см. список выше) и зелёные.

---

## Открытые вопросы (унаследованы из шагов 1–10)

Все Phase 1 пункты `1.1` плана закрыты в коде шагов 1–10. Phase 2 и Phase 3 элементы остаются как roadmap, не блокируют staging-deploy:

- **Phase 2 (планово, не Phase 1):**
  - Payload custom view «Модерация отзывов» и dashboard widget — не реализованы (модерация в Phase 1 идёт через Admin API curl, см. smoke-команды ниже).
  - Транзакционные email-уведомления «Ваш отзыв опубликован/отклонён» через [`notification-email.ts`](medusa-agency-boilerplate/src/modules/notification-email.ts:1) — не реализованы.
  - Страница «Мои отзывы» в account, `ProductRatingBadge` в `Thumbnail` каталога — не реализованы.
- **Phase 3:** images upload + S3 cleanup, фильтры по рейтингу, ответ магазина, JSON-LD AggregateRating — не реализованы (поле `images` отбрасывается strict Zod-схемой по контракту §13).
- **CAPTCHA:** env `REVIEWS_CAPTCHA_PROVIDER` зарезервирован, реализация — Phase 2 опция при росте спама.

Никаких регрессий, FIXME, TODO-blocker, незавершённых TS-ошибок или проваленных тестов в шагах 1–10 не зафиксировано.

---

## Готовность к шагу 12

- **Backend:** ✅ typecheck + test:unit + build = зелёные; `ensureProductReviewsTables` экспортируется из скомпилированного артефакта.
- **Storefront:** ✅ typecheck + lint + build = зелёные; product page = SSG, `/api/revalidate` = Dynamic.
- **Env-контракт (должен быть выставлен в staging `.env` перед deploy):**
  - `REVALIDATE_SECRET` (storefront-сторона; alias `STOREFRONT_REVALIDATE_SECRET` для совместимости с marketing-инфраструктурой)
  - `STOREFRONT_REVALIDATE_SECRET` (backend → storefront вызов `/api/revalidate`)
  - `STOREFRONT_URL=https://studio.slavx.ru` (backend знает, куда стучаться для revalidate)
  - `REVIEWS_REQUIRE_PURCHASE=false` (Phase 1, опционально `true`)
  - `REVIEWS_AUTO_APPROVE=false` (Phase 1 production: только модерация)
  - `REVIEWS_MIN_TEXT_LENGTH=10`
  - `REVIEWS_MAX_TEXT_LENGTH=2000`
  - `MEDUSA_ADMIN_SECRET_API_KEY=<sk_…>` — Secret Admin API Key Medusa v2 (НЕ publishable `pk_*`); генерируется через `npm run admin:api-key:local` или эквивалент на staging.
- **Smoke-команды для шага 12** — см. ниже. Реальные curl НЕ запускались на этом шаге, это работа шага 12.

---

## Smoke-команды для шага 12 (черновики)

> Хост `studio.slavx.ru` зафиксирован в [`.env.staging.example`](.env.staging.example:21) (`DEPLOY_DOMAIN=studio.slavx.ru`, `STOREFRONT_URL=https://studio.slavx.ru`, `NEXT_PUBLIC_MEDUSA_BACKEND_URL=https://studio.slavx.ru`). Storefront и backend опубликованы за общим Caddy на одном домене.
> Подставь реальный `<REVIEW_ID>` и `<PROD>` после первого создания отзыва на staging. `MEDUSA_ADMIN_SECRET_API_KEY` и `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_API_KEY` — экспортируй в shell перед запуском (НЕ хардкодить).

```bash
# 0. Подготовка (один раз в shell):
export MEDUSA_ADMIN_SECRET_API_KEY=sk_xxx_from_staging_env
export NEXT_PUBLIC_MEDUSA_PUBLISHABLE_API_KEY=pk_xxx_from_staging_env
export ADMIN_BASIC="Authorization: Basic $(printf '%s:' "$MEDUSA_ADMIN_SECRET_API_KEY" | base64 -w0)"

# 1. Список pending отзывов (admin queue)
curl -sS -X GET "https://studio.slavx.ru/admin/reviews?status=pending&pageSize=5" \
  -H "$ADMIN_BASIC" | jq

# 2. Approve конкретного отзыва
curl -sS -X POST "https://studio.slavx.ru/admin/reviews/<REVIEW_ID>/approve" \
  -H "$ADMIN_BASIC" | jq

# 3. Reject с причиной
curl -sS -X POST "https://studio.slavx.ru/admin/reviews/<REVIEW_ID>/reject" \
  -H "$ADMIN_BASIC" \
  -H "Content-Type: application/json" \
  -d '{"reason":"spam"}' | jq

# 4. Delete отзыва (admin)
curl -sS -X DELETE "https://studio.slavx.ru/admin/reviews/<REVIEW_ID>" \
  -H "$ADMIN_BASIC" | jq

# 5. Public summary (rating + распределение) — без auth, только publishable key
curl -sS -X GET "https://studio.slavx.ru/store/products/<PROD>/rating" \
  -H "x-publishable-api-key: $NEXT_PUBLIC_MEDUSA_PUBLISHABLE_API_KEY" | jq

# 6. (Опционально) Public список одобренных отзывов
curl -sS -X GET "https://studio.slavx.ru/store/products/<PROD>/reviews?limit=10&offset=0&sort=created_at" \
  -H "x-publishable-api-key: $NEXT_PUBLIC_MEDUSA_PUBLISHABLE_API_KEY" | jq

# 7. (Контракт revalidate) — backend сам стучится в storefront /api/revalidate после approve/reject/delete.
#    Можно перепроверить вручную (после approve выше):
curl -sS -X POST "https://studio.slavx.ru/api/revalidate" \
  -H "Content-Type: application/json" \
  -H "x-revalidate-secret: $STOREFRONT_REVALIDATE_SECRET" \
  -d '{"tags":["product-rating-<PROD>","product-reviews-<PROD>"]}' | jq
```

Ожидаемые контракты (что валидируем на шаге 12):

- `GET /admin/reviews?status=pending` → 200, JSON `{ reviews: [...], count, limit, offset }`.
- `POST /admin/reviews/:id/approve` → 200, статус → `approved`, `summary` пересчитан атомарно, в storefront прилетает `revalidateTag('product-rating-<PROD>')` и `product-reviews-<PROD>`.
- `POST /admin/reviews/:id/reject` → 200, `rejection_reason` сохранён; если предыдущий статус был `approved` — recalc summary.
- `DELETE /admin/reviews/:id` → 204 (или 200 c review object); если был `approved` — recalc summary.
- `GET /store/products/:id/rating` (без auth, только publishable key) → 200, JSON `{ average_rating, total_reviews, distribution: { 1..5 } }`. После approve в (2) значения должны измениться.
- `POST /api/revalidate` (storefront) → 200 после правильного секрета; 401 без него.

Если любой из (1)–(7) валится — стоп шага 12, фиксируем root-cause и возвращаемся в код.

---

## Подтверждение

- Шаги 1–10 в зелёном.
- Backend и Storefront готовы к staging-deploy (шаг 12).
- Smoke-команды и env-контракт зафиксированы.
- Никакие файлы Phase 1 в этом отчёте не модифицировались — только наблюдение и фиксация состояния.
