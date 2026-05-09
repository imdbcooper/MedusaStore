# MedusaStore

Готовый шаблон для e-commerce проектов с backend, storefront, CMS-контентом, checkout, доставкой, платежами, уведомлениями, Docker-окружением и документацией для запуска. Подходит как стартовая база для интернет-магазинов и клиентских коммерческих проектов.

## Что внутри

- Medusa backend в `medusa-agency-boilerplate/`
- Next.js storefront в `medusa-agency-boilerplate-storefront/`
- Payload CMS в `payload-cms/`
- Docker Compose для локальной инфраструктуры
- Документация и runbooks в `Docs/`
- Root scripts для preflight, build, typecheck, smoke и staging verification

## Быстрый старт

1. Скопируйте env-шаблоны и заполните локальные значения.
2. Установите зависимости в backend, storefront и Payload.
3. Поднимите PostgreSQL/Redis через Docker Compose.
4. Запустите preflight и нужные приложения.

Основные root-команды:

```bash
npm run preflight
npm run backend:build
npm run storefront:build
npm run payload:build
```

## Проверки перед релизом

Безопасный локальный pre-repo контур включает:

```bash
npm run backend:typecheck
npm run storefront:lint
npm run storefront:typecheck
npm run backend:build
npm run storefront:build
npm run payload:types
npm run payload:importmap
npm run payload:build
```

Runtime/staging smoke-команды требуют подготовленного окружения и валидных secrets.

## Секреты

Не коммитьте локальные `.env` файлы. Используйте только шаблоны:

- `.env.example`
- `medusa-agency-boilerplate/.env.template`
- `medusa-agency-boilerplate-storefront/.env.local.example`
- `payload-cms/.env.example`

Production/staging значения храните в GitHub Secrets или во внешнем secret store.

## Лицензия

MIT. Отдельные upstream-компоненты и шаблоны сохраняют свои copyright notices и лицензии.
