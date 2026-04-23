# Staging Verification Contour — first executable materialization

> Статус: первый исполнимый staging-targeted verification contour поверх уже существующего baseline smoke/integrity path.
>
> Основание: [`Docs/staging_checklist.md`](./staging_checklist.md), [`Docs/staging_deploy_path.md`](./staging_deploy_path.md), [`Docs/staging_monitoring_baseline.md`](./staging_monitoring_baseline.md), [`package.json`](../package.json), [`.github/workflows/integrity-baseline.yml`](../.github/workflows/integrity-baseline.yml).

## Что materialized этим шагом

В репозитории появился воспроизводимый entrypoint [`staging:verify`](../package.json), который запускает [`scripts/staging-verification.sh`](../scripts/staging-verification.sh) против **уже поднятого** staging surface без привязки к конкретному hosting provider.

Этот contour intentionally reuse'ит уже существующие smoke helpers:

- [`scripts/smoke-backend.sh`](../scripts/smoke-backend.sh);
- [`scripts/smoke-storefront.sh`](../scripts/smoke-storefront.sh);
- [`scripts/browser-smoke.sh`](../scripts/browser-smoke.sh);
- [`scripts/notification-smoke.sh`](../scripts/notification-smoke.sh).

Новая materialization не добавляет deploy automation, provisioning или provider-specific orchestration. Она только делает staging verification path исполнимым и configurable через env.

## Что именно проверяет contour

По умолчанию [`scripts/staging-verification.sh`](../scripts/staging-verification.sh) выполняет такой contour:

1. `smoke:backend` — проверка [`GET /health`](../scripts/smoke-backend.sh);
2. `smoke:storefront` — проверка storefront root URL через [`STOREFRONT_URL`](../.env.example);
3. `smoke:browser` — headless browser check для [`/ru/account`](../scripts/browser-smoke.sh);
4. `smoke:notification` — authenticated `POST /admin/notifications/smoke` через [`scripts/notification-smoke.sh`](../scripts/notification-smoke.sh).

Это и есть первый practical staging verification contour, который напрямую соответствует staging checklist, но теперь запускается одной командой.

## Минимальная конфигурация

Запуск опирается на root env contract из [`.env.example`](../.env.example).

Минимально нужны:

- [`MEDUSA_BACKEND_URL`](../.env.example) — публичный backend URL staging;
- [`STOREFRONT_URL`](../.env.example) — публичный storefront URL staging;
- [`BROWSER_SMOKE_BROWSER_BIN`](../scripts/browser-smoke.sh) — путь к Chrome/Chromium для browser smoke, если бинарь не находится автоматически.

Для notification smoke есть два sanctioned варианта:

### Вариант A — передать уже существующий fresh/still-valid secret admin API key

Задать [`NOTIFICATION_SMOKE_ADMIN_SECRET_API_KEY`](../.env.example).

Это preferred путь для already-seeded non-local staging, если не хочется materialize fresh key через data-plane credentials.

### Вариант B — дать contour возможность создать fresh key самостоятельно

Не задавать [`NOTIFICATION_SMOKE_ADMIN_SECRET_API_KEY`](../.env.example), но передать:

- [`BACKEND_DATABASE_URL`](../.env.example);
- [`BACKEND_REDIS_URL`](../.env.example).

Тогда [`scripts/notification-smoke.sh`](../scripts/notification-smoke.sh) использует их для запуска [`admin:api-key:local`](../medusa-agency-boilerplate/package.json) против staging data-plane и создаст fresh key перед authenticated smoke request.

## Базовый запуск

1. Создать staging env-файл на основе [`.env.example`](../.env.example).
2. Указать в нем staging-specific значения.
3. Запустить:

```bash
ROOT_ENV_FILE=./staging.env npm run staging:verify
```

[`ROOT_ENV_FILE`](../scripts/lib/common.sh) позволяет запускать contour не только от root [`.env`](../.env.example), но и от отдельного staging-specific env файла.

## Полезные overrides

В [`.env.example`](../.env.example) добавлены optional overrides:

- [`STAGING_VERIFICATION_CONTOUR`](../.env.example) — список checks через запятую;
- [`STAGING_BROWSER_ACCOUNT_PATH`](../.env.example) — путь для browser smoke, по умолчанию `/ru/account`.

Примеры:

```bash
ROOT_ENV_FILE=./staging.env \
STAGING_VERIFICATION_CONTOUR=smoke:backend,smoke:storefront,smoke:browser \
npm run staging:verify
```

```bash
ROOT_ENV_FILE=./staging.env \
STAGING_BROWSER_ACCOUNT_PATH=/en/account \
npm run staging:verify
```

## Что осталось вне scope

Этот contour **не** делает следующего:

- не поднимает staging environment;
- не выполняет provider-specific deploy;
- не materialize'ит publishable key или seed state;
- не внедряет CI workflow для remote staging;
- не заменяет rollback, backup/restore и monitoring artifacts.

Иными словами, следующий практический шаг теперь звучит как: поднять staging candidate sanctioned способом и прогнать [`npm run staging:verify`](../package.json) по подготовленному env-файлу.
