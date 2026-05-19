# Независимый технический аудит — MedusaStore

Дата аудита: 2026-05-17

Область аудита: весь репозиторий [`medusa-agency-boilerplate`](.), включая корневую orchestration-зону, Medusa backend, Next.js storefront, Payload CMS, AI Assistant, Docker/staging runtime, CI/CD, env-контракты, операционные документы и локальные developer workflows.

Аудит выполнен как независимый технический обзор по доступному состоянию файловой системы и исходного кода. Реальные секреты, закрытые GitHub Secrets/Variables и фактическое состояние удаленного staging-хоста не проверялись напрямую. Проверки выполнялись без изменения runtime-инфраструктуры.

---

## 1. Резюме для команды

Репозиторий представляет собой зрелый, но сложный e-commerce runtime/template для российского рынка на базе Medusa v2. В нем объединены:

- Medusa backend как источник commerce truth: каталог, регионы, корзина, checkout, заказы, платежи, fulfillment, уведомления, отзывы, маркетинг, VK ID, ApiShip/Gorgo.
- Next.js storefront как shopper-facing приложение с динамическими product pages, checkout/account/cart flows, Payload content pages и optional assistant widget.
- Payload CMS как отдельный headless CMS для маркетинговых страниц, глобальных настроек, навигации, footer, posts/news и marketing campaigns.
- Caddy как единственный public reverse proxy staging-среды.
- Docker Compose production-mode staging stack.
- GitHub Actions based staging deployment.
- Optional FastAPI AI Assistant с Markdown/vector retrieval, Medusa live commerce tools и adapter integration.

Сильные стороны проекта:

- Хорошо оформлены operational-документы и runbooks.
- Явно разделены local/staging/future production контуры.
- Staging runtime описан декларативно через [`docker-compose.prod.yml`](docker-compose.prod.yml) и Caddy.
- Есть env-contract tooling для local/staging validation/rendering.
- Backend содержит защитные guardrails для секретов, checkout readiness, delivery execution, notification fallback и VK onboarding.
- Storefront уже учитывает важную разницу server-side internal URL vs browser public URL.
- AI Assistant спроектирован как optional/default-off, что снижает риск случайного включения недозрелой функции.
- В проекте много unit/integration tests, особенно вокруг backend workflows и AI Assistant.

Главные риски после повторной проверки:

1. Локальный [`.env`](.env) сейчас не проходит env-contract check из-за placeholder-значений.
2. Storefront production build отключает fail-fast для ESLint и TypeScript ошибок.
3. GitHub Actions deploy не содержит обязательных lint/typecheck/test gates перед удаленной сборкой staging-образов.
4. Staging smoke недостаточно покрывает product/cart/checkout/API critical paths.
5. Payload CMS запускается как обязательный staging-контейнер, но env-contract делает часть Payload-секретов обязательной только при `PAYLOAD_ENABLED=true`; это создает условный config gap.
6. Payload secret может быть пустым в runtime-конфиге, если env ошибочно не задан.
7. Caddyfile содержит жестко прошитые staging subdomains и S3 bucket/upstream, что ограничивает template portability и может расходиться с env-контрактом S3.
8. AI Assistant заявлен как установленный, но все еще требует review/validation перед включением; public chat остается abuse/cost surface при включенном LLM.
9. В рабочем дереве много незакоммиченных изменений и удалений документов, что повышает риск смешивания workstreams.
10. Документация и реализация в целом согласованы, но есть устаревшие следы Delivery Hub и исторических planning-документов.
11. Внешняя image-generation capability отсутствует внутри проекта; внешний OpenAI-compatible endpoint не является частью текущей архитектуры.

Общая оценка: проект технически сильный и детально документированный, но находится в состоянии активной интеграции. Для production readiness нужен отдельный hardening pass по env hygiene, CI quality gates, smoke coverage, assistant launch readiness, observability и управлению незакоммиченными изменениями.

---

## 2. Методология и просмотренные зоны

Были изучены следующие ключевые зоны:

- Root orchestration: [`package.json`](package.json), [`docker-compose.yml`](docker-compose.yml), [`docker-compose.prod.yml`](docker-compose.prod.yml).
- Operational docs: [`README.md`](README.md), [`Docs/architecture.md`](Docs/architecture.md), [`Docs/production_runbook.md`](Docs/production_runbook.md), [`Docs/local_development.md`](Docs/local_development.md), [`Docs/staging_runbook.md`](Docs/staging_runbook.md), [`Docs/troubleshooting.md`](Docs/troubleshooting.md), [`Docs/env_contract.md`](Docs/env_contract.md), [`Docs/current_work.md`](Docs/current_work.md), [`Docs/payload_cms_runbook.md`](Docs/payload_cms_runbook.md).
- Medusa backend: [`medusa-agency-boilerplate/package.json`](medusa-agency-boilerplate/package.json), [`medusa-agency-boilerplate/medusa-config.ts`](medusa-agency-boilerplate/medusa-config.ts), [`medusa-agency-boilerplate/src/api/middlewares.ts`](medusa-agency-boilerplate/src/api/middlewares.ts), modules/workflows/subscribers/tests layout.
- Storefront: [`medusa-agency-boilerplate-storefront/package.json`](medusa-agency-boilerplate-storefront/package.json), [`next.config.js`](medusa-agency-boilerplate-storefront/next.config.js), [`src/lib/env.ts`](medusa-agency-boilerplate-storefront/src/lib/env.ts), [`src/lib/config.ts`](medusa-agency-boilerplate-storefront/src/lib/config.ts), [`src/lib/data/products.ts`](medusa-agency-boilerplate-storefront/src/lib/data/products.ts), [`src/app`](medusa-agency-boilerplate-storefront/src/app) routes.
- Payload CMS: [`payload-cms/package.json`](payload-cms/package.json), [`src/payload.config.ts`](payload-cms/src/payload.config.ts), collections, migrations and run scripts.
- AI Assistant: [`ai-assistant/README.md`](ai-assistant/README.md), [`pyproject.toml`](ai-assistant/pyproject.toml), [`ENV.example`](ai-assistant/ENV.example), [`backend/app/main.py`](ai-assistant/backend/app/main.py), [`backend/app/core/config.py`](ai-assistant/backend/app/core/config.py), [`backend/app/core/security.py`](ai-assistant/backend/app/core/security.py), [`backend/app/core/auth.py`](ai-assistant/backend/app/core/auth.py), chat service/API, tests layout.
- Docker: [`docker/medusa-backend/Dockerfile`](docker/medusa-backend/Dockerfile), [`docker/storefront/Dockerfile`](docker/storefront/Dockerfile), [`docker/payload/Dockerfile`](docker/payload/Dockerfile), entrypoints, Caddyfile.
- CI/CD and scripts: [`.github/workflows/deploy-staging.yml`](.github/workflows/deploy-staging.yml), [`scripts/env-contract.mjs`](scripts/env-contract.mjs), [`scripts/bootstrap.sh`](scripts/bootstrap.sh), [`scripts/env-sync.sh`](scripts/env-sync.sh), [`scripts/preflight.sh`](scripts/preflight.sh), [`scripts/github-deploy-staging.sh`](scripts/github-deploy-staging.sh), [`scripts/staging-container-smoke.sh`](scripts/staging-container-smoke.sh).

Проверки, выполненные во время аудита:

- `docker compose -f docker-compose.prod.yml --env-file .env.staging.example config -q` — успешно.
- `npm run env:check` — неуспешно из-за placeholder-значений в локальном [`.env`](.env).
- `git status --short` — обнаружено большое количество незакоммиченных изменений и удалений.
- Повторный исходный review ключевых зон: [`docker-compose.prod.yml`](docker-compose.prod.yml), [`docker/caddy/Caddyfile`](docker/caddy/Caddyfile), [`.github/workflows/deploy-staging.yml`](.github/workflows/deploy-staging.yml), [`scripts/env-contract.mjs`](scripts/env-contract.mjs), [`scripts/github-deploy-staging.sh`](scripts/github-deploy-staging.sh), [`scripts/staging-container-smoke.sh`](scripts/staging-container-smoke.sh), Payload collections/access endpoints, AI Assistant config/Dockerfile, storefront package/config.
- Проверка качества самого документа: 81 Markdown-link проверен на существование, битых ссылок не найдено; nested-link markers не найдены; duplicate headings не найдены.

---

## 3. Архитектура проекта

### 3.1. Компоненты

#### Root orchestration

Корень репозитория управляет локальным запуском, env sync, bootstrap, validation, smoke checks и staging deployment. Основной entrypoint — root [`package.json`](package.json).

Ключевые команды:

- `npm run bootstrap` — синхронизация env, запуск DB/Redis, миграции Medusa, seed и запись publishable key в storefront env.
- `npm run preflight` — проверка env, файлов, портов и compose-конфига.
- `npm run dev` — локальный dev runtime.
- `npm run env:check` — local env contract validation.
- `npm run env:render:staging` — render staging env из contract/secrets.
- `npm run staging:verify` — staging verification contour.

Root layer хорошо отделяет локальные и staging сценарии. Это снижает риск случайного смешивания Docker-network URL и public URL.

#### Medusa backend

Backend — главный commerce source of truth. Он отвечает за:

- Store/Admin/Auth API.
- Products, variants, regions, sales channels.
- Checkout/cart/order/payment flows.
- YooKassa payment provider.
- ApiShip/Gorgo fulfillment baseline.
- Notification providers: local, SMTP, UniSender, VK, SMS.
- VK ID auth/onboarding.
- Product reviews and moderation.
- Marketing preferences/campaign workflows.
- Optional AI Assistant adapter routes.

Backend использует Medusa v2.13.6 и содержит значительный набор custom modules/workflows/subscribers. Конфигурация в [`medusa-config.ts`](medusa-agency-boilerplate/medusa-config.ts) достаточно defensive: JWT/cookie secrets обязательны, значение `supersecret` явно запрещено, payment provider включается только если YooKassa сконфигурирована, notification providers имеют fallback/disabled semantics, fulfillment baseline включает manual + ApiShip/Gorgo.

Важная особенность: backend не является «чистым starter». Это уже сильно расширенный runtime с большим количеством бизнес-логики и интеграционных guardrails. Любые обновления Medusa, маршрутов, middleware или схем должны рассматриваться как потенциально breaking.

#### Storefront

Storefront — Next.js 15.3.9 приложение на React 19.0.5. Оно отвечает за:

- публичную витрину;
- маршруты `/{countryCode}`;
- динамические product pages;
- cart/checkout/account UX;
- YooKassa/VK ID frontend flows;
- Payload-rendered content pages;
- product reviews UI;
- optional AI Assistant widget.

Ключевой положительный момент: server-side URL resolution в [`env.ts`](medusa-agency-boilerplate-storefront/src/lib/env.ts) предпочитает `MEDUSA_BACKEND_URL` перед `NEXT_PUBLIC_MEDUSA_BACKEND_URL`. Это правильно для staging Docker runtime, где server-side rendering должен ходить на `http://medusa-backend:9000`, а browser-facing requests могут идти через Caddy.

Ключевой риск: [`next.config.js`](medusa-agency-boilerplate-storefront/next.config.js) отключает fail-fast для ESLint и TypeScript во время production build через `ignoreDuringBuilds: true` и `ignoreBuildErrors: true`. Это удобно при быстрой интеграции, но опасно для production readiness.

#### Payload CMS

Payload CMS — отдельное Next/Payload приложение на Payload 3.83.0. Оно отвечает за:

- Pages, Posts, Media, Users;
- SiteSettings, Navigation, Footer;
- marketing campaign editorial/admin layer;
- preview/revalidation integration;
- seed marketing content;
- dedicated `payload_cms` database in staging.

Конфигурация в [`payload.config.ts`](payload-cms/src/payload.config.ts) минимальна и понятна. Основные runtime-зависимости: `PAYLOAD_SECRET`, `PAYLOAD_DATABASE_URL`, `PAYLOAD_PUBLIC_SERVER_URL`, `PAYLOAD_CORS`, `PAYLOAD_CSRF`.

Риск: `secret: process.env.PAYLOAD_SECRET || ''` допускает пустой secret на уровне кода. Возможно, Payload сам упадет или предупредит, но лучше fail-fast явно в проектном коде, чтобы staging/prod не стартовали в небезопасном состоянии.

#### AI Assistant

AI Assistant — optional FastAPI service, реализованный в [`ai-assistant`](ai-assistant). Он содержит:

- REST/SSE chat API;
- Markdown ingestion;
- optional PostgreSQL repository;
- optional Qdrant vector retrieval;
- deterministic hashing embeddings fallback;
- Medusa product ingestion;
- live commerce tools;
- safety/PII redaction/prompt-injection guardrails;
- in-memory rate limiting;
- admin/reindex endpoints;
- tests.

Сервис хорошо отделен от основного commerce runtime и запускается только при Compose profile `ai-assistant` + `AI_ASSISTANT_ENABLED=true`. Это правильная модель для незрелой/дорогой/рискованной AI-функции.

Ограничения:

- rate limiting in-memory и process-local;
- LLM provider фактически optional, а текущий chat answer builder в изученном коде в основном deterministic/retrieval-grounded;
- для multi-replica production нужны Redis/gateway limits;
- необходимо четко проверить session binding и запрет прямого доступа к privileged endpoints из браузера перед включением.

#### Docker/Staging runtime

Staging stack в [`docker-compose.prod.yml`](docker-compose.prod.yml) включает:

- `medusa-db` → `medusastore-db`;
- `medusa-redis` → `medusastore-redis`;
- `medusa-backend` → `medusastore-backend`;
- `payload-cms` → `medusastore-payload`;
- `storefront` → `medusastore-storefront`;
- `caddy` → `medusastore-caddy`;
- optional profile `ai-assistant` → `medusastore-ai-assistant`.

Caddy в [`Caddyfile`](docker/caddy/Caddyfile) обслуживает:

- `api.slavx.ru` → backend;
- `admin.slavx.ru` → backend Admin UI/API;
- `cms.slavx.ru` → Payload;
- `media.slavx.ru` → S3 proxy;
- `studio.slavx.ru` → storefront + compatibility `/store`, `/auth`, `/admin`, `/payload`, `/api/content`.

Compose template валиден с [`.env.staging.example`](.env.staging.example): `docker compose -f docker-compose.prod.yml --env-file .env.staging.example config -q` прошел успешно.

---

## 4. Карта зависимостей сервисов

### 4.1. Runtime-зависимости

| Потребитель | Зависимость | Назначение | Влияние отказа |
| --- | --- | --- | --- |
| Medusa backend | PostgreSQL | Commerce data, orders, customers, products | Backend unusable |
| Medusa backend | Redis | runtime/cache/event behavior | degraded/unhealthy backend |
| Medusa backend | S3 optional | media uploads | local file fallback if S3 absent |
| Medusa backend | YooKassa optional | hosted payment path | payment method unavailable |
| Medusa backend | ApiShip/Gorgo | delivery calculation/baseline | checkout delivery risk |
| Medusa backend | SMTP/UniSender/VK/SMS optional | notifications | fallback/disabled notifications |
| Storefront | Medusa backend | catalog/cart/checkout/account | core storefront broken |
| Storefront | Payload CMS optional | content pages/globals | content pages unavailable/fallback |
| Storefront | Caddy/public origin | browser API routing | public access broken |
| Payload CMS | PostgreSQL `payload_cms` | content data | CMS/content unavailable |
| Payload CMS | Medusa backend optional | marketing/review/admin integrations | editorial integration broken |
| AI Assistant | Medusa backend | live product data/tools | no grounded price/stock |
| AI Assistant | PostgreSQL optional | persistent sessions/reindex | in-memory state only |
| AI Assistant | Qdrant optional | vector retrieval | markdown/simple fallback |
| AI Assistant | OpenAI-compatible LLM optional | generative responses | deterministic/fallback answers only |

### 4.2. Владение URL

Проект правильно различает:

- internal Docker URLs: `http://medusa-backend:9000`, `http://payload-cms:3100`, `http://storefront:8000`;
- public browser URLs: `https://studio.slavx.ru`, `https://api.slavx.ru`, `https://admin.slavx.ru`, `https://cms.slavx.ru`.

Это критично для Next.js SSR. Ошибка в этой зоне приводит к runtime `500` на product/content pages, хотя браузерные `/store/*` requests могут выглядеть рабочими.

---

## 5. Аудит окружения и конфигурации

### 5.1. Положительные наблюдения

- Есть root [`.env.example`](.env.example) и staging [`.env.staging.example`](.env.staging.example).
- Есть dedicated env contract script [`env-contract.mjs`](scripts/env-contract.mjs).
- Staging deploy renders full [`.env`](.env) из GitHub Secrets/Variables.
- Manual remote [`.env`](.env) edits documented как overwritten next deploy — это хорошо для reproducibility.
- `JWT_SECRET` и `COOKIE_SECRET` в backend проверяются fail-fast.
- `MEDUSA_ADMIN_BACKEND_URL=/` защищает Admin browser bundle от hardcoded retired/public backend origins.
- `REVALIDATE_SECRET` и `STOREFRONT_REVALIDATE_SECRET` синхронизируются в staging render logic.

### 5.2. Проблема: локальный [`.env`](.env) не проходит validation

- Контекст: `npm run env:check` завершился ошибкой.
- Наблюдение: placeholder values обнаружены для `POSTGRES_PASSWORD`, `DATABASE_URL`, `PAYLOAD_DATABASE_URL`.
- Почему это проблема: canonical local flow `cp .env.example .env -> npm run bootstrap -> npm run preflight -> npm run dev` не пройдет, если разработчик не заменит placeholder-значения.
- Последствия: onboarding ломается, bootstrap не стартует, разработчик может начать обходить env checks вручную.
- Критичность: High для DX/local onboarding, Medium для production.
- Рекомендация: добавить команду `npm run env:init-local`, которая генерирует безопасные local-only значения для `POSTGRES_PASSWORD`, `JWT_SECRET`, `COOKIE_SECRET`, `PAYLOAD_SECRET`, `REVALIDATE_SECRET` и пересобирает local URLs. Либо сделать [`bootstrap.sh`](scripts/bootstrap.sh) интерактивно/автоматически заменяющим placeholder для local-only режима.

### 5.3. Проблема: Payload допускает пустой secret в коде

- Контекст: [`payload.config.ts`](payload-cms/src/payload.config.ts) использует `process.env.PAYLOAD_SECRET || ''`.
- Почему это проблема: даже если Payload framework сам валидирует secret, проектный contract должен быть явным. Пустой secret в CMS auth/session/csrf context недопустим для staging/prod.
- Последствия: небезопасная конфигурация, непредсказуемое поведение auth/session, поздний runtime failure.
- Критичность: High для staging/prod.
- Рекомендация: добавить explicit guard: если `NODE_ENV=production` и `PAYLOAD_SECRET` пустой или placeholder — бросать ошибку до `buildConfig`. Добавить это в env-contract mandatory checks.

### 5.4. Проблема: большое количество переменных окружения усложняет управление

- Контекст: root/staging env содержит десятки переменных для Medusa, Payload, AI, payment, delivery, notifications, marketing, VK, S3.
- Почему это проблема: высокая вероятность drift между [`.env.example`](.env.example), [`.env.staging.example`](.env.staging.example), GitHub workflow env block, [`env-contract.mjs`](scripts/env-contract.mjs), `env-sync.sh`, Docker compose args/runtime env.
- Последствия: staging deploy может собрать приложение с одним набором public env, а запустить с другим; client bundle может получить stale flags; operator может забыть mandatory secret.
- Критичность: Medium/High.
- Рекомендация: ввести machine-readable env schema, например `env.schema.json` или TypeScript/Zod schema, из которой генерируются examples, GitHub workflow mapping и validation docs. Минимум — добавить automated test, сравнивающий ключи между [`.env.staging.example`](.env.staging.example), render script и workflow env block.

---

## 6. Аудит сборки, деплоя и runtime

### 6.1. Local runtime

Локальный runtime хорошо описан:

- DB/Redis/Medusa backend в [`docker-compose.yml`](docker-compose.yml);
- storefront и Payload обычно host processes;
- preflight проверяет required files, env, ports, compose config;
- bootstrap создает/синхронизирует env и получает publishable key из seed output.

Риск: backend local compose использует `node:20-bookworm`, а production Dockerfiles используют `node:22-bookworm-slim`. Это может давать subtle differences в npm/node behavior.

- Критичность: Medium.
- Рекомендация: унифицировать Node major между local и prod или явно документировать, почему local backend dev остается на Node 20 при production Node 22.

### 6.2. Staging deploy

GitHub Actions deploy хорошо структурирован:

1. checkout;
2. validate compose template;
3. render `.env.staging.generated` from Secrets/Variables;
4. validate rendered compose;
5. upload [`.env`](.env) to remote;
6. run remote deploy script;
7. build images;
8. start db/redis;
9. optional Payload migrations/seed;
10. start app containers;
11. smoke checks.

Положительно:

- `concurrency` prevents overlapping staging deploys.
- SSH heartbeat added for long docker builds.
- remote [`.env`](.env) is generated, not manually curated.
- `--force-recreate --remove-orphans` reduces interrupted deploy residue.

### 6.3. Проблема: smoke checks недостаточно покрывают business-critical paths

- Контекст: [`staging-container-smoke.sh`](scripts/staging-container-smoke.sh) проверяет health, home, about/promotions/delivery, admin URL, payload pages, optional assistant health.
- Почему это проблема: не проверяются реальные product handle, Store API, cart creation, region resolution, publishable key validity, YooKassa enabled path, ApiShip readiness, VK callback sanity, Payload preview/revalidate secrets.
- Последствия: deploy может считаться успешным, хотя checkout или product pages broken.
- Критичность: High.
- Рекомендация: добавить staged smoke tiers:
  - Tier 0: current infrastructure checks.
  - Tier 1: `/store/regions`, `/store/products?limit=1`, known product page, cart create.
  - Tier 2: checkout readiness with safe mocked/minimal cart, ApiShip readiness diagnostic, payment session dry run if allowed.
  - Tier 3: optional assistant, notifications, VK/YooKassa integration checks behind explicit flags.

### 6.4. Проблема: production build storefront игнорирует TypeScript/ESLint ошибки

- Контекст: [`next.config.js`](medusa-agency-boilerplate-storefront/next.config.js) содержит `eslint.ignoreDuringBuilds=true`, `typescript.ignoreBuildErrors=true`.
- Почему это проблема: production image can build even with type errors and lint regressions.
- Последствия: runtime failures, hydration issues, missed dead imports, API contract drift.
- Критичность: High.
- Рекомендация: убрать ignore flags либо оставить только временно с CI gate `npm run storefront:typecheck && npm run storefront:lint` mandatory before Docker build. В GitHub Actions deploy добавить explicit typecheck/lint/build validation before uploading env.

### 6.5. Проблема: Docker builds запускают `npm ci --include=dev` и копируют весь app в runner

- Контекст: Dockerfiles для backend/storefront/Payload устанавливают dev dependencies в builder/deps, затем runner получает `/app` из builder.
- Почему это проблема: runner image может содержать dev dependencies/build tooling, увеличенный attack surface и размер образов.
- Последствия: более медленные deploys, больше CVEs, больше места на сервере, дольше cold recovery.
- Критичность: Medium.
- Рекомендация: проверить необходимость dev deps at runtime. Для Next/Payload/Medusa может быть сложно из-за build artifacts, но стоит сделать image audit и multi-stage prune: `npm prune --omit=dev` или dedicated production install after build.

---

## 7. Аудит backend

### 7.1. Сильные стороны

- Strong startup guard for JWT/cookie secrets.
- Conditional provider registration.
- ApiShip/Gorgo baseline documented and backed by unit smoke evidence.
- Live shipment execution guard defaults off.
- Admin routes protected via `authenticate("user", ["session", "bearer", "api-key"])`.
- Middleware centralizes validation and auth for many custom routes.
- Many targeted unit tests for workflows/modules.
- Notification providers are opt-in/fallback safe.
- VK ID no-email onboarding has checkout gate.

### 7.2. Проблема: middleware file is large and high-risk

- Контекст: [`middlewares.ts`](medusa-agency-boilerplate/src/api/middlewares.ts) содержит много route registrations, auth, validation and guards.
- Почему это проблема: один файл становится central routing policy registry. Ошибка matcher/order/method может открыть маршрут или сломать flow.
- Последствия: security regression, route bypass, admin endpoint unprotected, validation skipped.
- Критичность: High.
- Рекомендация: добавить route-policy tests, которые snapshot-проверяют, что все `/admin/*` custom routes имеют `adminAuth`, все public mutation routes имеют validation/rate limit where applicable. Рассмотреть split по доменам: `assistantMiddlewares`, `reviewsMiddlewares`, `marketingMiddlewares`, `deliveryMiddlewares`.

### 7.3. Проблема: legacy Delivery Hub remnants still exist in code while docs удаляются

- Контекст: docs show deletion of many Delivery Hub files, but backend still has `delivery-hub-runtime-quarantine.ts` and middleware routes for `/admin/orders/:id/delivery-hub*` guarded by quarantine.
- Почему это проблема: даже quarantine code is still surface area and cognitive load. It can confuse future agents/operators about active delivery baseline.
- Последствия: accidental reactivation, stale assumptions, wasted maintenance.
- Критичность: Medium.
- Рекомендация: если Delivery Hub permanently removed, create explicit ADR: either keep quarantine until DB cleanup complete or remove routes/code/tests after migration. Add tests proving quarantine always blocks.

### 7.4. Проблема: integration-heavy backend may be hard to upgrade

- Контекст: many custom modules depend on Medusa internals/workflows.
- Почему это проблема: Medusa minor updates can break admin SDK, module APIs, workflow behavior, fulfillment/payment contracts.
- Последствия: upgrade lock-in, security patch delays.
- Критичность: Medium.
- Рекомендация: maintain upgrade test matrix: backend typecheck, unit, integration http, seed/bootstrap, storefront build, staging smoke. Add Renovate/Dependabot with grouped Medusa updates and required manual smoke.

---

## 8. Аудит storefront

### 8.1. Сильные стороны

- Correct backend URL precedence for SSR.
- Country-code route structure matches Russian market default.
- Product pages documented as dynamic runtime pages.
- Storefront has direct ApiShip data layer.
- Next public feature flags passed at Docker build time to avoid hydration mismatch.
- Payload content routes have fallback semantics.

### 8.2. Проблема: product listing fetch uses `cache: "force-cache"`

- Контекст: [`products.ts`](medusa-agency-boilerplate-storefront/src/lib/data/products.ts) fetches `/store/products` with `cache: "force-cache"` and tag-based cache options.
- Почему это проблема: catalog freshness depends entirely on invalidation/tag setup. If revalidation is incomplete, products/prices/inventory can stale.
- Последствия: stale product listings, outdated availability, customer confusion.
- Критичность: Medium/High depending on cache invalidation completeness.
- Рекомендация: audit all cache tags and revalidation triggers. For price/stock-sensitive areas use shorter TTL or dynamic fetch. Ensure product update/order inventory changes invalidate relevant tags.

### 8.3. Проблема: broad image remote allowlist

- Контекст: [`next.config.js`](medusa-agency-boilerplate-storefront/next.config.js) allows Unsplash, Google user content, Medusa public test buckets, itecocloud S3, media domain, Payload host.
- Почему это проблема: broad remote image domains can increase privacy/security and availability risks.
- Последствия: external dependency leakage, broken images, possible abuse if untrusted image URLs enter catalog/CMS.
- Критичность: Medium.
- Рекомендация: production preset should restrict image hosts to approved media/CDN domains. Keep Unsplash/test buckets only in dev/demo mode.

### 8.4. Проблема: package versions use `latest` for Medusa storefront dependencies

- Контекст: storefront [`package.json`](medusa-agency-boilerplate-storefront/package.json) uses `@medusajs/icons`, `@medusajs/js-sdk`, `@medusajs/ui`, `@medusajs/types`, `@medusajs/ui-preset` as `latest`.
- Почему это проблема: non-reproducible installs if lockfile is regenerated; accidental major/minor drift.
- Последствия: build breaks, runtime API changes, UI regressions.
- Критичность: Medium.
- Рекомендация: pin versions to known compatible Medusa v2.13.6 family or use explicit ranges with Renovate-controlled updates.

---

## 9. Аудит Payload CMS

### 9.1. Сильные стороны

- Dedicated app and DB; does not own commerce truth.
- Staging public URL separated from internal Docker URL.
- Migrations and seed are controlled by explicit toggles.
- Build guard/runbook warns against concurrent dev/build corruption.
- Content pages have clear fallback behavior.

### 9.2. Проблема: access control needs explicit review

- Контекст: `Media` collection has public read access; Users auth exists with role field, but role-based access policies were not deeply audited across all collections in this pass.
- Почему это проблема: CMS often becomes a privilege escalation or content publishing vector.
- Последствия: unpublished content exposure, unauthorized editorial changes, marketing campaign misuse.
- Критичность: High if staging/prod CMS is internet-exposed.
- Рекомендация: add access-control matrix for each collection/global. Ensure write/update/delete requires authenticated admin/editor with role checks. Add tests for published vs draft read behavior.

### 9.3. Проблема: Payload migrations/seed toggles can be misused

- Контекст: `RUN_PAYLOAD_MIGRATIONS` and `RUN_PAYLOAD_SEED` are env toggles executed during deploy/entrypoint.
- Почему это проблема: accidental seed in staging/prod may overwrite curated content if seed script is not perfectly idempotent and non-destructive.
- Последствия: content drift/loss, editorial surprises.
- Критичность: Medium.
- Рекомендация: keep `RUN_PAYLOAD_SEED=false` default. Add explicit deploy workflow input or manual approval for seed/migration. Ensure seed script logs all upserts and never deletes editor content.

---

## 10. Аудит AI Assistant

### 10.1. Сильные стороны

- Separate service boundary.
- Default-off in Compose.
- Token-protected privileged endpoints.
- Browser-origin forbidden for privileged endpoints.
- PII redaction in logs/messages.
- Prompt-injection deterministic guardrails.
- No-hallucination behavior for sellable facts when live Medusa grounding unavailable.
- Deep health service exists.
- Good backend test coverage.

### 10.2. Проблема: in-memory rate limiting is not production scalable

- Контекст: [`security.py`](ai-assistant/backend/app/core/security.py) implements `InMemoryRateLimiter`.
- Почему это проблема: limits are per-process. Multiple replicas multiply allowed traffic and do not share state.
- Последствия: abuse/spend risk, uneven limiting, gateway bypass.
- Критичность: High if assistant is public and multi-replica; Medium for one replica.
- Рекомендация: before production enablement, use Redis-backed distributed limiter or enforce limits at Caddy/API gateway. Document max one replica until then.

### 10.3. Проблема: public chat is tokenless by design

- Контекст: chat endpoint allows public storefront chat without assistant API token.
- Почему это проблема: even with rate limits, public AI endpoints are abuse magnets.
- Последствия: LLM cost spikes, prompt abuse, scraping, denial of service.
- Критичность: High when LLM provider enabled.
- Рекомендация: keep widget disabled until gateway rate limits, CAPTCHA/turnstile or signed storefront session binding, per-IP/per-session quotas and cost monitoring are in place.

### 10.4. Проблема: LLM/image-generation expectations are unclear

- Контекст: AI Assistant supports OpenAI-compatible text LLM env fields, but does not implement image generation. The external `/images/generations` endpoint tested separately returned provider auth errors.
- Почему это проблема: team may assume AI Assistant can generate images or proxy OpenAI image APIs, but current architecture does not include that capability.
- Последствия: failed feature expectations, ad-hoc scripts with secrets, insecure external API usage.
- Критичность: Medium.
- Рекомендация: if image generation is required, create explicit `image-generation` service/adapter with env contract, provider fallback, audit logging, request limits, secret handling and output storage policy. Do not overload shopping assistant chat service silently.

---

## 11. Аудит безопасности

### 11.1. Положительные security controls

- No real secrets should be committed by policy.
- [`.env`](.env) files are ignored/treated as local runtime files.
- GitHub Secrets/Variables are canonical staging secret source.
- Backend rejects missing/default JWT/cookie secrets.
- Admin routes mostly use Medusa auth middleware.
- AI privileged endpoints require API token and reject browser-origin requests.
- SMTP/UniSender/YooKassa/VK/S3 are opt-in.
- Live ApiShip shipment execution is default-off.
- Caddy sets baseline security headers.

### 11.2. Проблема: current chat included real-looking external API key

- Контекст: during image generation testing, a real-looking key for `https://hoor.mooo.com/v1` was provided in chat.
- Почему это проблема: secrets in chat/logs are not governed like GitHub Secrets.
- Последствия: credential leakage, uncontrolled provider use.
- Критичность: High.
- Рекомендация: rotate that key if real. Store provider credentials only in [`.env`](.env) ignored locally or GitHub Secrets. Add explicit docs for external AI provider credentials.

### 11.3. Проблема: secret scanning should be mandatory

- Контекст: repo has many env examples and integration docs. Active work includes AI/payment/S3/SMTP/VK.
- Почему это проблема: high probability of accidental secret leakage.
- Последствия: credential compromise.
- Критичность: High.
- Рекомендация: add pre-commit or CI secret scan using `gitleaks`/`trufflehog`. Block commits containing private keys, API tokens, database URLs with passwords and provider secrets.

### 11.4. Проблема: Caddy security headers are basic

- Контекст: Caddy sets HSTS, nosniff, frame options, referrer policy.
- Почему это проблема: no CSP, Permissions-Policy or strict cross-origin isolation policy. Adding CSP can be hard with Medusa Admin/Next/Payload, but absence should be intentional.
- Последствия: higher XSS blast radius if app vulnerability appears.
- Критичность: Medium.
- Рекомендация: add report-only CSP first per subdomain, then enforce gradually. Admin/CMS/storefront likely need different policies.

---

## 12. Аудит надежности и масштабируемости

### 12.1. Current reliability controls

- Docker healthchecks for DB, Redis, backend, Payload, storefront, Caddy, assistant.
- GitHub Actions deployment has concurrency and heartbeat.
- Caddy-only ingress simplifies topology.
- Staging smoke checks exist.
- Backend provider fallbacks reduce startup brittleness.
- Payload migrations/seed are controlled.

### 12.2. Gaps

- No explicit backup/restore validation was run during this audit.
- No SLO/error budget definitions.
- No metrics stack visible in root compose.
- No log aggregation/alerting stack visible.
- No canary/blue-green deploy.
- Single VPS/single Compose stack likely has single points of failure.
- AI Assistant one-replica limitation documented but not technically enforced except by operational convention.

Рекомендации:

1. Add backup restore smoke for PostgreSQL and Payload CMS.
2. Add uptime/error-rate monitoring for all public subdomains.
3. Add synthetic checks for product page and checkout create-cart.
4. Add log retention policy and structured log fields for request IDs across Caddy/backend/storefront/Payload.
5. Document RTO/RPO for staging and future production.

---

## 13. Аудит observability

### 13.1. Existing observability

- AI Assistant has structured request logs and request IDs.
- Staging deploy/smoke scripts print statuses.
- Troubleshooting docs include useful `docker compose logs` commands.
- Caddy public `/healthz` exists.
- Backend notification/assistant logs include some structured/diagnostic text.

### 13.2. Gaps

- No central metrics/tracing stack visible.
- Storefront Next.js errors depend on container logs; no Sentry/OpenTelemetry integration observed.
- Medusa backend custom workflows have tests/logs, but no unified trace correlation across storefront → Caddy → backend → payment/delivery.
- Smoke checks do not persist evidence artifact except GitHub logs.

Рекомендации:

- Add OpenTelemetry/Sentry or equivalent for backend/storefront/Payload.
- Propagate `X-Request-ID` from Caddy to upstreams and from storefront server requests to Medusa.
- Add structured JSON logs for critical checkout/payment/delivery events.
- Persist staging smoke report as GitHub Actions artifact.

---

## 14. Аудит тестируемости

### 14.1. Strong areas

- Backend has extensive unit tests around workflows/modules.
- AI Assistant has pytest coverage for chat, ingestion, live commerce, vector, hardening, repository and streaming.
- Root scripts expose typecheck/lint/smoke commands.
- ApiShip baseline has deterministic smoke evidence without live credentials.

### 14.2. Weak areas

- Storefront build currently ignores TypeScript and ESLint failures.
- End-to-end checkout coverage is not clearly mandatory in deploy.
- Payload access-control tests are not obvious from quick scan.
- Contract tests for env/workflow variable coverage are missing.
- Route security matrix tests for backend custom routes should be expanded.

Рекомендации:

1. Make `npm run typecheck` required before staging deploy.
2. Add storefront Playwright smoke for homepage/product/cart/checkout shell/account auth edge cases.
3. Add env schema drift test.
4. Add Payload access-policy tests.
5. Add route auth coverage tests for custom Medusa routes.

---

## 15. Аудит документации

### 15.1. Strengths

Documentation is unusually strong. Current operational docs clearly state:

- staging is not production;
- production not provisioned yet;
- Caddy is only public reverse proxy;
- GitHub Actions is only canonical deploy path;
- secrets flow through GitHub Secrets/Variables;
- local/staging topology differs;
- Payload is content-only, not commerce truth;
- ApiShip/Gorgo is active delivery baseline;
- AI Assistant is optional/default-off.

### 15.2. Problems

#### 15.2.1. Historical doc churn is high

- Контекст: `git status --short` shows many modified/deleted docs, especially Delivery Hub related.
- Почему это проблема: agents/developers can read stale or deleted planning docs and infer wrong state.
- Последствия: reintroducing removed providers, wrong delivery strategy, incorrect status reporting.
- Критичность: Medium.
- Рекомендация: after current doc cleanup, commit a single documentation governance cleanup PR. Add an index of deprecated docs or remove them entirely after ensuring no references remain.

#### 15.2.2. Some docs use absolute local paths

- Контекст: [`Docs/env_contract.md`](Docs/env_contract.md) contains absolute paths like `/home/somdev/Projects/...`.
- Почему это проблема: reduces portability and can confuse future contributors/agents.
- Последствия: broken links outside current workstation.
- Критичность: Low/Medium.
- Рекомендация: convert absolute paths to relative repository links.

---

## 16. Аудит developer experience

### 16.1. Strengths

- Clear root commands.
- `scripts/manage.sh` exists for interactive local management.
- Preflight checks ports and required files.
- Permission repair command exists.
- Payload run script protects against dev/build corruption.
- Local/staging distinctions are documented.

### 16.2. Pain points

- First-run local [`.env`](.env) placeholder replacement is manual and currently failing validation.
- Multiple app env files can drift despite sync tooling.
- Root `packageManager` requires npm 11.6.2, but local Node/npm state not enforced except convention.
- AI Assistant uses Python venv flow separately from Node workspace.
- Large active worktree makes it risky for a new developer/agent to know what is intentional.

Рекомендации:

1. Add `npm run doctor` combining env check, compose check, Node/npm version check, dirty worktree summary and app env drift detection.
2. Add local env generator.
3. Add `CONTRIBUTING.md` with recommended branch/worktree hygiene.
4. Add `make` or `justfile` aliases if team prefers simpler commands.

---

## 17. Аудит интеграционных рисков

### 17.1. ApiShip/Gorgo

Risk: delivery is business-critical and provider-specific. Current baseline is direct `/store/apiship/*` and external shipment execution default-off.

Recommendation: keep live execution disabled until operator validates credentials, idempotency, sender/warehouse config and cancellation/refund flows. Add live sandbox runbook if available.

### 17.2. YooKassa

Risk: payment return/webhook flows must be highly reliable and secure.

Recommendation: ensure unsigned webhooks are rejected by default, webhook secret present in staging/prod, and return origin allowlist is tested. Add smoke that verifies payment provider availability without creating real charges.

### 17.3. SMTP/UniSender/VK/SMS

Risk: notification providers are opt-in but many env keys exist.

Recommendation: maintain provider readiness diagnostics and never switch staging/prod to live provider without smoke + DNS/TLS/PTR/DMARC checks. Rotate all secrets if ever shared outside GitHub Secrets.

### 17.4. Payload ↔ Medusa admin API

Risk: Payload marketing/review widgets may call Medusa admin APIs with secret admin key.

Recommendation: keep secret admin API keys backend-only/server-only. Add request logging with redaction and explicit scope-limited key if Medusa supports it.

### 17.5. AI provider / OpenAI-compatible endpoints

Risk: OpenAI-compatible providers can fail at model routing/auth layer, as observed with image generation endpoint returning `503 auth_not_found`.

Recommendation: treat external AI providers as unreliable dependencies. Add provider healthcheck, model capability discovery, request budgets, fallback policy and clear separation between text assistant and image generation.

---


## 18. Детальный реестр замечаний после повторной проверки

Ниже приведен структурированный реестр существенных замечаний. Он дополняет предыдущие разделы, а не заменяет их. Для спорных пунктов явно указано, что требуется подтверждение на staging/runtime.

### F-001 — Local `.env` не проходит env-contract validation

- Критичность: High для DX/local onboarding; Medium для staging/prod.
- Приоритет исправления: P0 перед следующей массовой onboarding-проверкой.
- Затронутые файлы/компоненты: [`.env.example`](.env.example), локальный [`.env`](.env), [`scripts/env-contract.mjs`](scripts/env-contract.mjs), [`scripts/bootstrap.sh`](scripts/bootstrap.sh), [`scripts/preflight.sh`](scripts/preflight.sh).
- В чем проблема: `npm run env:check` падает из-за placeholder-значений `POSTGRES_PASSWORD`, `DATABASE_URL`, `PAYLOAD_DATABASE_URL`.
- Почему важно: документированный локальный путь начинается с `cp .env.example .env`, но без генерации local-only secrets разработчик получает нерабочий старт.
- Последствия: сломанный onboarding, ручные обходы contract-checks, риск случайно использовать слабые или общие секреты.
- Как проверить: выполнить `npm run env:check` из корня репозитория после копирования [`.env.example`](.env.example) в локальный [`.env`](.env).
- Как исправить: добавить `npm run env:init-local`, который генерирует local-only значения для `POSTGRES_PASSWORD`, `JWT_SECRET`, `COOKIE_SECRET`, `PAYLOAD_SECRET`, `STOREFRONT_REVALIDATE_SECRET`/`REVALIDATE_SECRET` и пересобирает local DB URLs. Альтернатива — встроить safe local auto-fill в [`bootstrap.sh`](scripts/bootstrap.sh) до запуска проверок.

### F-002 — Storefront production build игнорирует TypeScript и ESLint ошибки

- Критичность: High.
- Приоритет исправления: P0 до production-readiness и желательно до следующего staging deploy hardening.
- Затронутые файлы/компоненты: [`medusa-agency-boilerplate-storefront/next.config.js`](medusa-agency-boilerplate-storefront/next.config.js), [`medusa-agency-boilerplate-storefront/package.json`](medusa-agency-boilerplate-storefront/package.json), [`.github/workflows/deploy-staging.yml`](.github/workflows/deploy-staging.yml), [`docker/storefront/Dockerfile`](docker/storefront/Dockerfile).
- В чем проблема: `eslint.ignoreDuringBuilds=true` и `typescript.ignoreBuildErrors=true` позволяют собрать production image при ошибках типов и lint-регрессиях.
- Почему важно: Next.js build становится не quality gate, а packaging step; ошибка в SSR/data layer может попасть в staging незамеченной.
- Последствия: runtime `500`, hydration mismatch, неправильные env assumptions, broken checkout/product pages.
- Как проверить: выполнить `npm run typecheck` в storefront и сравнить с `npm run build`; build не должен быть единственной проверкой качества.
- Как исправить: убрать оба ignore-флага. Если это пока невозможно, добавить в [`.github/workflows/deploy-staging.yml`](.github/workflows/deploy-staging.yml) обязательные шаги `npm ci && npm run typecheck && npm run lint` для storefront до render/upload/deploy.

### F-003 — Staging deploy не запускает обязательные tests/typechecks/lint gates

- Критичность: High.
- Приоритет исправления: P0/P1.
- Затронутые файлы/компоненты: [`.github/workflows/deploy-staging.yml`](.github/workflows/deploy-staging.yml), root [`package.json`](package.json), app package scripts.
- В чем проблема: workflow валидирует compose/env и затем деплоит, но не выполняет root/app typecheck, unit tests, lint или production build verification локально на GitHub runner до SSH deploy.
- Почему важно: staging становится первым местом, где обнаруживаются ошибки кода; это увеличивает время восстановления и риск частично сломанного деплоя.
- Последствия: remote Docker build может упасть поздно; хуже — build пройдет из-за ignore flags, но runtime будет нерабочим.
- Как проверить: просмотреть [`.github/workflows/deploy-staging.yml`](.github/workflows/deploy-staging.yml); между checkout и deploy отсутствуют обязательные test/typecheck steps.
- Как исправить: добавить job `validate` с matrix или последовательными шагами: backend `npm ci && npm run typecheck/test`, storefront `npm ci && npm run typecheck && npm run lint && npm run build`, Payload `npm ci && npm run payload:generate:types && npm run build`, AI `pip install -e .[dev] && pytest`. Сделать deploy зависимым от `validate`.

### F-004 — Staging smoke покрывает инфраструктуру, но не core commerce flows

- Критичность: High.
- Приоритет исправления: P0/P1.
- Затронутые файлы/компоненты: [`scripts/staging-container-smoke.sh`](scripts/staging-container-smoke.sh), [`scripts/github-deploy-staging.sh`](scripts/github-deploy-staging.sh), Store API, storefront product/cart/checkout routes.
- В чем проблема: smoke проверяет `/healthz`, home/content pages, admin URL и Payload pages, но не проверяет `/store/regions`, `/store/products`, known product page, cart creation, publishable key validity, checkout shell, ApiShip readiness.
- Почему важно: e-commerce runtime может выглядеть «здоровым» по health/content pages, но быть сломанным для покупки.
- Последствия: успешный deploy с нерабочими product pages, cart или checkout.
- Как проверить: выполнить текущий [`staging-container-smoke.sh`](scripts/staging-container-smoke.sh) и вручную дополнительно запросить Store API/product/cart endpoints.
- Как исправить: ввести smoke tiers: Tier 0 infra; Tier 1 Store API/product/cart; Tier 2 checkout readiness/payment/delivery diagnostics без live charge/shipment; Tier 3 optional AI/notifications/VK/YooKassa behind explicit flags.

### F-005 — Payload контейнер обязателен в staging, но часть env requirements условна

- Критичность: High для staging reliability/security, если `PAYLOAD_ENABLED=false` при обязательном запуске контейнера.
- Приоритет исправления: P1.
- Затронутые файлы/компоненты: [`docker-compose.prod.yml`](docker-compose.prod.yml), [`scripts/env-contract.mjs`](scripts/env-contract.mjs), [`payload-cms/src/payload.config.ts`](payload-cms/src/payload.config.ts), [`docker/caddy/Caddyfile`](docker/caddy/Caddyfile).
- В чем проблема: [`docker-compose.prod.yml`](docker-compose.prod.yml) всегда поднимает `payload-cms`, `storefront` и `caddy` зависят от его healthcheck. При этом [`env-contract.mjs`](scripts/env-contract.mjs) добавляет `PAYLOAD_SECRET`, `PAYLOAD_DATABASE_URL`, `PAYLOAD_CMS_URL`, `PAYLOAD_PUBLIC_SERVER_URL` в required только при `PAYLOAD_ENABLED=true`.
- Почему важно: флаг `PAYLOAD_ENABLED` выглядит как feature flag storefront-content, но runtime topology делает Payload обязательным сервисом staging.
- Последствия: возможный старт Payload с пустым/placeholder secret или поздний runtime failure; неочевидная причина падения storefront/caddy health при выключенном content flag.
- Как проверить: срендерить staging env с `PAYLOAD_ENABLED=false` и без `PAYLOAD_SECRET`, затем выполнить `docker compose -f docker-compose.prod.yml --env-file .env.staging.generated config` и попытаться поднять stack.
- Как исправить: либо сделать Payload действительно optional через Compose profile и убрать unconditional `depends_on`, либо считать Payload обязательным staging-сервисом и всегда требовать его секреты/URLs/DB в staging validation независимо от `PAYLOAD_ENABLED`.

### F-006 — Payload допускает пустой `PAYLOAD_SECRET` в коде

- Критичность: High.
- Приоритет исправления: P0/P1.
- Затронутые файлы/компоненты: [`payload-cms/src/payload.config.ts`](payload-cms/src/payload.config.ts), [`scripts/env-contract.mjs`](scripts/env-contract.mjs), [`.env.staging.example`](.env.staging.example).
- В чем проблема: `secret: process.env.PAYLOAD_SECRET || ''` не делает проектный fail-fast до передачи конфигурации в Payload.
- Почему важно: CMS secret связан с auth/session/security; пустой secret недопустим для публичного CMS.
- Последствия: небезопасная или нестабильная auth/session конфигурация, late failure в runtime/build.
- Как проверить: запустить Payload build/start без `PAYLOAD_SECRET` и убедиться, где именно происходит failure; проверить staging render с `PAYLOAD_ENABLED=false`.
- Как исправить: добавить явный guard до `buildConfig`: в production/staging бросать ошибку при пустом/placeholder `PAYLOAD_SECRET`. Добавить аналогичную проверку в [`env-contract.mjs`](scripts/env-contract.mjs).

### F-007 — Caddyfile жестко привязан к доменам и S3 bucket текущего staging

- Критичность: Medium/High для template portability; Medium для текущего staging.
- Приоритет исправления: P1/P2.
- Затронутые файлы/компоненты: [`docker/caddy/Caddyfile`](docker/caddy/Caddyfile), [`docker-compose.prod.yml`](docker-compose.prod.yml), [`.env.staging.example`](.env.staging.example), [`scripts/env-contract.mjs`](scripts/env-contract.mjs).
- В чем проблема: `api.slavx.ru`, `admin.slavx.ru`, `cms.slavx.ru`, `media.slavx.ru`, S3 upstream `s3.itecocloud.online` и bucket path `/slavx-media-ddfd0e31` зашиты в Caddyfile. Только основной `{$DEPLOY_DOMAIN}` параметризован.
- Почему важно: репозиторий позиционируется как template/runtime, но proxy config переносится хуже, чем env contract.
- Последствия: новый домен/клиент потребует ручного редактирования Caddyfile; S3 bucket может расходиться с `S3_BUCKET`/`S3_FILE_URL`; высок риск ошибиться в media routing.
- Как проверить: изменить `DEPLOY_DOMAIN` в staging env на другой домен и выполнить `docker compose config`; sibling subdomains и media bucket в Caddyfile останутся прежними.
- Как исправить: параметризовать sibling domains и media proxy через env (`API_DOMAIN`, `ADMIN_DOMAIN`, `CMS_DOMAIN`, `MEDIA_DOMAIN`, `MEDIA_S3_BUCKET`, `MEDIA_S3_UPSTREAM`) или генерировать Caddyfile из шаблона в deploy step.

### F-008 — Workflow env mapping слишком большой и drift-prone

- Критичность: Medium/High.
- Приоритет исправления: P1.
- Затронутые файлы/компоненты: [`.github/workflows/deploy-staging.yml`](.github/workflows/deploy-staging.yml), [`scripts/env-contract.mjs`](scripts/env-contract.mjs), [`.env.staging.example`](.env.staging.example).
- В чем проблема: workflow вручную перечисляет большое количество env keys из Secrets/Variables. Любое новое поле нужно добавить в несколько мест.
- Почему важно: env-contract может знать о переменной, но GitHub workflow не передаст ее в render step.
- Последствия: скрытый staging drift, placeholder/default вместо реального значения, broken feature flag или secret omission.
- Как проверить: написать скрипт, который сравнит keys из [`.env.staging.example`](.env.staging.example), `process.env` allowlist в workflow и required/conditional keys в [`env-contract.mjs`](scripts/env-contract.mjs).
- Как исправить: перейти к machine-readable schema и codegen workflow env block; минимум — добавить CI drift test, падающий при рассинхронизации.

### F-009 — Docker runner images могут содержать dev dependencies

- Критичность: Medium.
- Приоритет исправления: P2.
- Затронутые файлы/компоненты: [`docker/medusa-backend/Dockerfile`](docker/medusa-backend/Dockerfile), [`docker/storefront/Dockerfile`](docker/storefront/Dockerfile), [`docker/payload/Dockerfile`](docker/payload/Dockerfile).
- В чем проблема: Dockerfiles делают `npm ci --include=dev`, затем runner stage копирует `/app` из builder целиком.
- Почему важно: production images могут включать dev tooling и лишние пакеты.
- Последствия: больший размер образа, больше CVE surface, более долгие build/deploy/prune cycles.
- Как проверить: собрать образ и выполнить `docker run --rm <image> npm ls --omit=prod --depth=0` или сравнить размер `node_modules` до/после `npm prune --omit=dev`.
- Как исправить: после build выполнять `npm prune --omit=dev` в builder перед копированием в runner либо делать отдельный production-deps stage. Для Medusa/Next/Payload сначала подтвердить, какие dev deps реально нужны runtime.

### F-010 — AI Assistant не имеет lockfile и использует broad Python dependency ranges

- Критичность: Medium.
- Приоритет исправления: P1/P2 перед публичным включением AI.
- Затронутые файлы/компоненты: [`ai-assistant/pyproject.toml`](ai-assistant/pyproject.toml), [`ai-assistant/Dockerfile`](ai-assistant/Dockerfile).
- В чем проблема: `pip install .` устанавливает зависимости по broad ranges (`fastapi>=`, `uvicorn>=`, `pydantic>=`) без lockfile/constraints.
- Почему важно: повторная сборка Docker image может получить другие версии зависимостей без изменения кода.
- Последствия: неожиданные regression в API, auth middleware, streaming, Pydantic settings, тестах.
- Как проверить: пересобрать AI образ в разные даты/с очищенным cache и сравнить `pip freeze`; проверить отсутствие `requirements.lock`, `uv.lock` или `poetry.lock` в [`ai-assistant`](ai-assistant).
- Как исправить: добавить `uv.lock`/`requirements.lock`/constraints и строить Docker image через pinned install. В CI запускать pytest на lockfile.

### F-011 — AI Assistant public chat является abuse/cost surface

- Критичность: High при включенном LLM; Medium при deterministic/no-LLM mode.
- Приоритет исправления: P0 перед public widget enablement.
- Затронутые файлы/компоненты: [`ai-assistant/backend/app/core/security.py`](ai-assistant/backend/app/core/security.py), [`ai-assistant/backend/app/core/config.py`](ai-assistant/backend/app/core/config.py), [`medusa-agency-boilerplate/src/api/store/assistant/chat/route.ts`](medusa-agency-boilerplate/src/api/store/assistant/chat/route.ts), [`docker-compose.prod.yml`](docker-compose.prod.yml).
- В чем проблема: public storefront chat tokenless by design; rate limiting in-memory/process-local; LLM provider может быть включен env-ом.
- Почему важно: публичные AI endpoints быстро становятся целью abuse, scraping и cost attacks.
- Последствия: рост расходов LLM, деградация сервиса, блокировки провайдера, prompt abuse.
- Как проверить: включить assistant profile в staging-like окружении и провести нагрузочный тест по IP/session; проверить, что лимиты не обходятся при нескольких replicas или прямом доступе.
- Как исправить: держать widget disabled до Redis/gateway limiter, signed session binding, per-IP/per-session quotas, бюджетов/alerts провайдера и clear kill switch.

### F-012 — Rate limiting в Medusa/Payload/AI в основном process-local

- Критичность: Medium сейчас; High при горизонтальном масштабировании.
- Приоритет исправления: P2 сейчас, P0 перед multi-replica.
- Затронутые файлы/компоненты: [`medusa-agency-boilerplate/src/modules/public-rate-limit.ts`](medusa-agency-boilerplate/src/modules/public-rate-limit.ts), [`payload-cms/src/lib/rate-limit.ts`](payload-cms/src/lib/rate-limit.ts), [`ai-assistant/backend/app/core/security.py`](ai-assistant/backend/app/core/security.py).
- В чем проблема: лимиты хранятся в памяти процесса и сбрасываются при рестарте; несколько replicas умножают допустимый traffic.
- Почему важно: это guardrail, а не полноценный distributed control.
- Последствия: bypass лимитов, неравномерные ограничения, memory churn под атакой.
- Как проверить: поднять две реплики сервиса и отправлять запросы через round-robin; лимит будет считаться отдельно в каждой реплике.
- Как исправить: использовать Redis-backed limiter или enforce лимиты на Caddy/API gateway/WAF. В docs явно закрепить single-replica assumption до внедрения distributed limiter.

### F-013 — Payload preview token сравнивается обычным equality

- Критичность: Low/Medium.
- Приоритет исправления: P3, но дешево исправить.
- Затронутые файлы/компоненты: [`payload-cms/src/access/publishedOrPreview.ts`](payload-cms/src/access/publishedOrPreview.ts), Payload content preview routes.
- В чем проблема: `header === previewToken` не constant-time comparison.
- Почему важно: для секретных токенов лучше исключать даже теоретические timing side channels, особенно на публичном CMS API.
- Последствия: низковероятный token probing risk; больше security debt, чем практическая уязвимость.
- Как проверить: просмотреть `isPreviewRequest` в [`publishedOrPreview.ts`](payload-cms/src/access/publishedOrPreview.ts).
- Как исправить: использовать `crypto.timingSafeEqual` после проверки длины Buffer и добавить тесты для valid/invalid/missing preview token.

### F-014 — Storefront dependency reproducibility ослаблена `latest` и старым `@types/node`

- Критичность: Medium.
- Приоритет исправления: P1/P2.
- Затронутые файлы/компоненты: [`medusa-agency-boilerplate-storefront/package.json`](medusa-agency-boilerplate-storefront/package.json), [`medusa-agency-boilerplate-storefront/package-lock.json`](medusa-agency-boilerplate-storefront/package-lock.json).
- В чем проблема: Medusa storefront packages указаны как `latest`, а `@types/node` равен `17.0.21` при runtime Node 20/22 и Next 15.
- Почему важно: lockfile частично защищает, но его regeneration может привести к незапланированным Medusa package versions; старые Node types могут скрывать/создавать несовместимости.
- Последствия: non-reproducible install, type drift, build/runtime regressions.
- Как проверить: выполнить `npm outdated`/`npm ls @medusajs/js-sdk @types/node` в storefront.
- Как исправить: pin Medusa packages к проверенному диапазону, синхронизированному с backend Medusa 2.13.6, и поднять `@types/node` до версии, соответствующей runtime Node 22.

### F-015 — Caddy security headers базовые, CSP отсутствует

- Критичность: Medium.
- Приоритет исправления: P2.
- Затронутые файлы/компоненты: [`docker/caddy/Caddyfile`](docker/caddy/Caddyfile), storefront, Medusa Admin, Payload CMS.
- В чем проблема: есть HSTS/nosniff/frame/referrer, но нет Content-Security-Policy и Permissions-Policy.
- Почему важно: CSP снижает blast radius XSS, но требует аккуратного внедрения по subdomain.
- Последствия: при XSS уязвимости браузерные ограничения слабее; admin/CMS особенно чувствительны.
- Как проверить: `curl -I https://studio.slavx.ru`/`api`/`admin`/`cms` и проверить headers.
- Как исправить: начать с `Content-Security-Policy-Report-Only` отдельно для storefront/admin/CMS, собрать нарушения, затем постепенно enforce. Добавить `Permissions-Policy` для лишних browser capabilities.

### F-016 — Secret-like external AI key был передан вне secret storage

- Критичность: High, если ключ настоящий.
- Приоритет исправления: P0.
- Затронутые файлы/компоненты: операционные процессы, AI provider credentials, local ignored env/GitHub Secrets.
- В чем проблема: во время проверки image-generation endpoint был предоставлен real-looking API key.
- Почему важно: chat/logs не являются контролируемым secret storage и могут сохраняться дольше, чем ожидается.
- Последствия: credential leakage, неконтролируемые расходы, компрометация провайдера.
- Как проверить: проверить у владельца ключа, реальный ли он, где еще был использован и есть ли provider logs.
- Как исправить: немедленно rotate/revoke, если ключ настоящий. В дальнейшем передавать только через локальный [`.env`](.env) или GitHub Secrets; в документации добавить запрет на передачу raw provider keys в chat/issues/logs.

### F-017 — Documentation/worktree churn повышает риск неверных выводов

- Критичность: Medium.
- Приоритет исправления: P1.
- Затронутые файлы/компоненты: operational docs, historical plans, Delivery Hub cleanup, `git status`.
- В чем проблема: `git status --short` показал много незакоммиченных изменений/удалений; часть исторических Delivery Hub следов еще видна в backend quarantine code.
- Почему важно: агент или разработчик может принять промежуточное состояние за canonical source of truth.
- Последствия: wrong delivery baseline, повторное открытие закрытых workstreams, случайная потеря документации.
- Как проверить: выполнить `git status --short` и `git diff --name-status`, затем сверить с [`README.md`](README.md), [`Docs/current_work.md`](Docs/current_work.md) и проектным skill/source-of-truth.
- Как исправить: оформить отдельный cleanup PR/commit, удалить или явно заархивировать deprecated docs, добавить index deprecated docs и ADR по Delivery Hub quarantine: оставить с тестами или удалить после DB cleanup.

### F-018 — External image generation не является частью архитектуры проекта

- Критичность: Medium.
- Приоритет исправления: P2, если image generation нужен продуктово.
- Затронутые файлы/компоненты: [`ai-assistant`](ai-assistant), external OpenAI-compatible endpoints, generated assets policy.
- В чем проблема: AI Assistant имеет text/retrieval/chat контур, но не image-generation adapter. Проверенный внешний `/images/generations` endpoint был недоступен из-за provider auth/routing errors.
- Почему важно: ожидания команды могут смешать shopping assistant и image generation, что приведет к ad-hoc scripts и небезопасной работе с ключами.
- Последствия: нестабильные генерации, утечки ключей, отсутствие rate limits/storage policy/audit trail.
- Как проверить: поискать image-generation endpoints/adapters в [`ai-assistant`](ai-assistant) и backend; их нет как продуктового сервиса.
- Как исправить: если функция нужна, создать отдельный adapter/service с env contract, provider capability discovery, fallback policy, request budgets, content/storage policy и secret governance.

### F-019 — Backup/restore и observability не видны как обязательные operational gates

- Критичность: Medium для staging; High для будущего production.
- Приоритет исправления: P1 перед production provisioning.
- Затронутые файлы/компоненты: [`docker-compose.prod.yml`](docker-compose.prod.yml), [`Docs/production_runbook.md`](Docs/production_runbook.md), [`Docs/staging_runbook.md`](Docs/staging_runbook.md), deploy/smoke scripts.
- В чем проблема: в compose/runbooks видны healthchecks и logs commands, но не обнаружены обязательные backup restore drills, metrics/log aggregation/tracing/alerting gates.
- Почему важно: e-commerce без recovery/observability не production-ready даже при рабочем checkout.
- Последствия: долгий MTTR, непроверенные бэкапы, отсутствие раннего сигнала о деградации платежей/checkout/API.
- Как проверить: найти runbook с регулярным restore test и monitoring alerts; проверить staging/prod monitoring stack.
- Как исправить: добавить scheduled backup + restore verification, Sentry/OTel/log aggregation, synthetic product/cart/checkout checks, GitHub artifact для smoke report, RTO/RPO в runbook.

### F-020 — Документ аудита после самопроверки: ссылки корректны, но прежний формат был недостаточно actionable

- Критичность: Low для кода; Medium для управляемости исправлений.
- Приоритет исправления: P0 для самого аудита — выполнено в этой редакции.
- Затронутые файлы/компоненты: [`INDEPENDENT_TECHNICAL_AUDIT.md`](INDEPENDENT_TECHNICAL_AUDIT.md).
- В чем проблема: первая версия аудита покрывала основные зоны, но не для каждого замечания содержала единый набор «где/почему/последствия/как проверить/как исправить/приоритет».
- Почему важно: команде сложнее превращать обзор в backlog.
- Последствия: часть важных рисков могла остаться только narrative-текстом без clear owner/action.
- Как проверить: сравнить sections 5–17 с текущим детальным реестром; текущий файл дополнен структурированными карточками F-001–F-020.
- Как исправить: поддерживать этот реестр как backlog-ready документ; при закрытии findings добавлять дату, commit/PR и validation evidence, а не удалять пункт бесследно.

---

## 19. Таблица приоритетных замечаний

| ID | Замечание | Критичность | Область | Приоритет | Рекомендация |
| --- | --- | --- | --- | --- | --- |
| F-001 | Local [`.env`](.env) fails env check due placeholders | High | DX/env | P0 | Add local env generator or bootstrap auto-fill for local-only secrets |
| F-002 | Storefront build ignores TS/ESLint errors | High | Quality/build | P0 | Remove ignore flags or enforce CI typecheck/lint before deploy |
| F-003 | Staging deploy lacks mandatory tests/typechecks/lint gates | High | CI/CD | P0/P1 | Add validation job before SSH deploy |
| F-004 | Staging smoke misses product/cart/API critical flows | High | Reliability | P0/P1 | Add tiered smoke for Store API, product handle, cart create, checkout readiness |
| F-005 | Payload container is mandatory while some env requirements are conditional | High conditional | Config/staging | P1 | Make Payload truly optional or always require Payload runtime secrets in staging |
| F-006 | Payload secret can be empty in code | High | Security/config | P0/P1 | Add fail-fast guard and env-contract mandatory check |
| F-007 | Caddyfile hardcodes subdomains and media S3 bucket/upstream | Medium/High | Proxy/template | P1/P2 | Parameterize or generate Caddyfile from env |
| F-008 | Env variable drift risk across examples/workflow/render/compose | Medium/High | Config | P1 | Introduce schema-generated env contract and drift tests |
| F-009 | Docker runner images may include dev dependencies | Medium | Supply chain/runtime | P2 | Audit image contents and prune dev deps where possible |
| F-010 | AI Assistant Python dependencies are not locked | Medium | AI/supply chain | P1/P2 | Add lockfile/constraints and CI build from pinned deps |
| F-011 | Public AI chat can become abuse/cost vector | High | AI/security | P0 before enablement | Keep widget disabled until signed session/rate/cost controls exist |
| F-012 | Rate limiting is process-local across Medusa/Payload/AI surfaces | Medium/High on scale | Security/reliability | P2 now/P0 before scale | Use Redis/gateway distributed limits |
| F-013 | Payload preview token comparison is not constant-time | Low/Medium | CMS/security | P3 | Use `crypto.timingSafeEqual` with tests |
| F-014 | Storefront Medusa packages use `latest`; `@types/node` is old | Medium | Reproducibility/types | P1/P2 | Pin package versions and update Node types |
| F-015 | Caddy security headers lack CSP/Permissions-Policy | Medium | Security/proxy | P2 | Add report-only CSP per subdomain, then enforce |
| F-016 | Secret-like external AI key was shared in chat | High if real | Security/process | P0 | Rotate if real; store only in GitHub Secrets/local ignored env |
| F-017 | Documentation/worktree churn and Delivery Hub remnants create ambiguity | Medium | Docs/tech debt | P1 | Commit cleanup, archive/remove deprecated docs, decide quarantine ADR |
| F-018 | Image generation is not part of current project architecture | Medium | AI/product | P2 | Build explicit adapter/service if required |
| F-019 | Backup/restore and central observability are not visible as gates | Medium now/High prod | Ops | P1 before prod | Add restore drills, monitoring, tracing, synthetic checks |
| F-020 | First audit format was less actionable; document QA needed | Medium for governance | Audit doc | P0 done | Maintain findings as backlog-ready register with evidence |

---

## 20. Рекомендуемый roadmap исправлений

### Срочно, перед дальнейшей активной staging-работой

1. Fix local [`.env`](.env) placeholders or add local env generator.
2. Commit or intentionally stash current documentation cleanup; avoid mixed workstreams.
3. Rotate any real external AI/image API key shared outside secret storage.
4. Add Payload `PAYLOAD_SECRET` fail-fast guard and align Payload mandatory/optional staging semantics.
5. Add CI validation job with typecheck/lint/tests before remote deploy.
6. Add route/security tests for backend custom admin routes if not already present.

### Перед публичным включением AI Assistant

1. Keep `NEXT_PUBLIC_AI_ASSISTANT_WIDGET_ENABLED=false` by default.
2. Add gateway/Redis rate limiting.
3. Add signed session binding or other anti-abuse mechanism.
4. Add provider cost budgets and monitoring.
5. Run E2E for chat, history, product recommendation, live data fallback, admin reindex and security checks.

### Перед подготовкой реального production

1. Split staging and production runbooks/workflows/secrets.
2. Add backup/restore validation.
3. Add central observability and alerting.
4. Make typecheck/lint mandatory in CI/deploy.
5. Expand smoke coverage to checkout-critical paths.
6. Lock dependency versions and introduce dependency update policy.
7. Add CSP report-only and security header review per subdomain.
8. Parameterize or generate Caddyfile for production domains/media bucket.
9. Add production image hardening/pruning.
10. Add lockfile/constraints for AI Assistant dependencies if the service remains enabled in production scope.

---

## 21. Независимое заключение

Проект находится выше среднего уровня зрелости для кастомного e-commerce boilerplate: он имеет продуманную staging архитектуру, хорошие runbooks, env governance, защитные guardrails и сильную бизнес-доменную проработку для российского рынка. Основные риски не в отсутствии архитектуры, а в сложности и количестве интеграций.

Критический путь к надежному production-ready состоянию:

1. стабилизировать env onboarding;
2. усилить CI quality gates;
3. расширить staging smoke до реальных commerce flows;
4. закрыть security gaps вокруг Payload secret, AI provider secrets и public AI abuse;
5. формализовать observability/backup/restore;
6. зафиксировать текущий documentation cleanup и убрать неоднозначные исторические следы.

Если эти пункты закрыть, репозиторий может служить надежной основой для staging-to-production перехода и для дальнейшего масштабирования как template/runtime платформы.
