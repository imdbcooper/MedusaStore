# Env Contract

> Статус документа: рабочая спецификация окружения по состоянию на `2026-04-16`
>
> Назначение: зафиксировать, какой `.env` за что отвечает в проекте и какие команды теперь считаются каноническими для локальной разработки.

---

## 1. Общая схема

В проекте сейчас есть три слоя переменных окружения:

1. корневой `.env`
2. backend `.env`
3. storefront `.env.local`

Это не три равноправных файла.

Роли распределяются так:
- корневой `.env` управляет инфраструктурой и root-level orchestration;
- backend `.env` управляет runtime Medusa;
- storefront `.env.local` управляет runtime Next.js storefront.

---

## 2. Корневой `.env`

Файл:
[.env](/home/somdev/Projects/medusa-agency-boilerplate/.env)

Шаблон:
[.env.example](/home/somdev/Projects/medusa-agency-boilerplate/.env.example)

Этот файл является главным для:
- `docker compose`;
- root-level скриптов из [package.json](/home/somdev/Projects/medusa-agency-boilerplate/package.json);
- портов локальной разработки;
- user mapping для борьбы с `root-owned` файлами.

Подтвержденные переменные этого слоя:
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `POSTGRES_PORT`
- `REDIS_PORT`
- `MEDUSA_BACKEND_PORT`
- `STOREFRONT_PORT`
- `HOST_UID`
- `HOST_GID`
- `DATABASE_URL`
- `REDIS_URL`
- `NODE_ENV`
- `JWT_SECRET`
- `COOKIE_SECRET`
- `STORE_CORS`
- `ADMIN_CORS`
- `AUTH_CORS`

Примечание:
root-level скрипты используют этот файл как источник портов и значений по умолчанию. Если файла нет, они могут читать `.env.example`, но для реальной работы проекта корневой `.env` должен существовать.

---

## 3. Backend `.env`

Файл:
[medusa-agency-boilerplate/.env](/home/somdev/Projects/medusa-agency-boilerplate/medusa-agency-boilerplate/.env)

Шаблон:
[medusa-agency-boilerplate/.env.template](/home/somdev/Projects/medusa-agency-boilerplate/medusa-agency-boilerplate/.env.template)

Этот файл загружается Medusa через `loadEnv(...)` в [medusa-config.ts](/home/somdev/Projects/medusa-agency-boilerplate/medusa-agency-boilerplate/medusa-config.ts:3).

Подтвержденные переменные backend runtime:
- `DATABASE_URL`
- `REDIS_URL`
- `STORE_CORS`
- `ADMIN_CORS`
- `AUTH_CORS`
- `JWT_SECRET`
- `COOKIE_SECRET`

Простыми словами:
если корневой `.env` описывает инфраструктуру и orchestration, то backend `.env` описывает то, как Medusa должна работать как приложение.

---

## 4. Storefront `.env.local`

Файл:
[medusa-agency-boilerplate-storefront/.env.local](/home/somdev/Projects/medusa-agency-boilerplate/medusa-agency-boilerplate-storefront/.env.local)

Этот файл нужен storefront для работы с backend и runtime-настройками Next.js.

Подтверждено кодом:
- `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` обязателен, это проверяется в [check-env-variables.js](/home/somdev/Projects/medusa-agency-boilerplate/medusa-agency-boilerplate-storefront/check-env-variables.js:3)
- `MEDUSA_BACKEND_URL` используется в [src/lib/config.ts](/home/somdev/Projects/medusa-agency-boilerplate/medusa-agency-boilerplate-storefront/src/lib/config.ts:5)
- `MEDUSA_BACKEND_URL`, `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` и `NEXT_PUBLIC_DEFAULT_REGION` используются в [src/middleware.ts](/home/somdev/Projects/medusa-agency-boilerplate/medusa-agency-boilerplate-storefront/src/middleware.ts:4)
- `NEXT_PUBLIC_BASE_URL` используется в [src/lib/util/env.ts](/home/somdev/Projects/medusa-agency-boilerplate/medusa-agency-boilerplate-storefront/src/lib/util/env.ts:2)

Практическое правило:
- publishable key хранится здесь;
- backend URL может задаваться здесь;
- root-level скрипты могут подставлять `MEDUSA_BACKEND_URL` и `NEXT_PUBLIC_BASE_URL` сверху, если запуск идет через корневые команды.

---

## 5. Канонические команды локальной разработки

Теперь вход в проект должен идти через корневые команды из [package.json](package.json):

- `npm run env:sync`
- `npm run bootstrap`
- `npm run preflight`
- `npm run dev`
- `npm run infra:up`
- `npm run infra:down`
- `npm run backend:build`
- `npm run storefront:build`
- `npm run smoke:backend`
- `npm run smoke:storefront`
- `npm run permissions:fix`

Смысл:
разработчик и агент должны входить в проект через корень репозитория, а не вспоминать разрозненные команды по папкам.

### Канонический clean-clone path

Для нового разработчика канонический сценарий теперь такой:
1. `cp .env.example .env`
2. при необходимости поменять только root-level порты/секреты в [.env.example](.env.example) → локальном `.env`;
3. `npm run bootstrap`
4. `npm run preflight`
5. `npm run dev`

Что делает `npm run bootstrap`:
- синхронизирует [medusa-agency-boilerplate/.env](medusa-agency-boilerplate/.env) и [medusa-agency-boilerplate-storefront/.env.local](medusa-agency-boilerplate-storefront/.env.local) из root `.env`;
- поднимает PostgreSQL и Redis;
- запускает Medusa migration flow для пустой БД;
- запускает application-level seed из [medusa-agency-boilerplate/src/scripts/seed.ts](medusa-agency-boilerplate/src/scripts/seed.ts:58);
- записывает реальный publishable API key из seed в storefront `.env.local`.

Почему именно этот путь канонический:
- он не зависит от локального SQL dump;
- использует поддерживаемый Medusa CLI migration flow и существующий application-level seed;
- seed уже создает region, sales channel и publishable API key, то есть покрывает минимальные требования storefront onboarding.

Guardrail:
если [medusa-agency-boilerplate-storefront/.env.local](medusa-agency-boilerplate-storefront/.env.local) все еще содержит `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=REPLACE_WITH_ROOT_BOOTSTRAP`, то [scripts/preflight.sh](scripts/preflight.sh) специально валит preflight и требует сначала выполнить `npm run bootstrap`.

Примечание:
- шаблонный [.env.example](.env.example) по-прежнему хранит `9000` как стандартный дефолт;
- локальный [.env](.env) на этой машине сейчас выровнен на `9001`, потому что `9000` занят сторонним сервисом.

---

## 6. Практические правила

- Если сломалась `.medusa` из-за прав, первым делом запускать `npm run permissions:fix`.
- Если нужно понять, что делать прямо сейчас, смотреть [current_work.md](/home/somdev/Projects/medusa-agency-boilerplate/Docs/current_work.md).
- Если нужно понять, куда проект идет дальше, смотреть [master_repo_plan_v2.md](/home/somdev/Projects/medusa-agency-boilerplate/Docs/master_repo_plan_v2.md).
- Если нужно понять, что уже подтверждено, а что еще нет, смотреть [plan_analysis.md](/home/somdev/Projects/medusa-agency-boilerplate/Docs/plan_analysis.md).
