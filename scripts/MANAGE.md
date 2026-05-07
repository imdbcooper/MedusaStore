# scripts/manage.sh — инструкция

Интерактивная обёртка для управления локальным запуском
`medusa-agency-boilerplate`. Не дублирует canonical-логику
(`bootstrap.sh`, `preflight.sh`, `dev.sh`, `docker compose`),
а предоставляет единое меню с проверками, защитами и удобными
шорткатами.

## 1. Запуск

Два способа:

```bash
# через npm (alias добавлен в package.json)
npm run manage

# напрямую
bash scripts/manage.sh
```

Скрипт работает в двух режимах:

- **Интерактивный** — без аргументов, открывается меню.
- **CLI** — одной командой, удобно для скриптования / CI:

```bash
bash scripts/manage.sh status
bash scripts/manage.sh up           # = npm run dev
bash scripts/manage.sh up:infra
bash scripts/manage.sh up:backend
bash scripts/manage.sh up:storefront        # dev/HMR foreground
bash scripts/manage.sh start:storefront     # production preview after build
bash scripts/manage.sh stop
bash scripts/manage.sh stop:storefront   # только host-процесс storefront на :STOREFRONT_PORT
bash scripts/manage.sh payload:stop      # только Payload/Next dev/start, без очистки payload-cms/.next
bash scripts/manage.sh down
bash scripts/manage.sh nuke         # ОПАСНО: down -v (удаляет БД)
bash scripts/manage.sh restart:backend
bash scripts/manage.sh rebuild:backend
bash scripts/manage.sh rebuild:storefront
bash scripts/manage.sh logs
bash scripts/manage.sh shell        # bash в backend контейнере
bash scripts/manage.sh psql
bash scripts/manage.sh permissions
bash scripts/manage.sh typecheck
bash scripts/manage.sh smoke
bash scripts/manage.sh preflight
bash scripts/manage.sh bootstrap
bash scripts/manage.sh help
```

## 2. Почему storefront НЕ контейнеризован — это не баг

В [`docker-compose.yml`](../docker-compose.yml:1) подняты только
`medusa-db`, `medusa-redis`, `medusa-backend`. Storefront
(`medusa-agency-boilerplate-storefront`) запускается на хосте через
[`scripts/storefront-dev.sh`](./storefront-dev.sh:1) и далее
`next dev`. Это **сознательное архитектурное решение**, оно явно
зафиксировано в документации репозитория:

- [`Docs/master_repo_plan_v2.md`](../Docs/master_repo_plan_v2.md:84)
  — «`docker-compose.yml` поднимает PostgreSQL, Redis и backend, но
  не поднимает storefront».
- [`Docs/staging_deploy_path.md`](../Docs/staging_deploy_path.md:55)
  — «отсутствие storefront в `docker-compose.yml` означает, что
  staging deploy path обязан трактовать storefront как отдельную
  единицу выката».
- [`Docs/staging_checklist.md`](../Docs/staging_checklist.md:45) —
  «storefront не входит в `docker-compose.yml`, поэтому для staging
  он должен существовать как отдельный runtime surface».

Причины (по сумме доков и реальному коду):

1. **Bootstrap-зависимость.**
   [`scripts/bootstrap.sh`](./bootstrap.sh:1) сначала поднимает БД и
   backend, затем читает `ROOT_BOOTSTRAP_PUBLISHABLE_KEY` из живого
   backend и записывает его в
   `medusa-agency-boilerplate-storefront/.env.local`. Storefront не
   может быть поднят раньше backend и до выполнения bootstrap, иначе
   `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` будет плейсхолдером
   (`REPLACE_WITH_ROOT_BOOTSTRAP`), что
   [`scripts/preflight.sh`](./preflight.sh:75) явно ловит как ошибку.
2. **Next.js dev/HMR.** На хосте удобнее: быстрее цикл, нет проблем
   с file-watch внутри bind-mount на разных ОС.
3. **Контракт деплоя.** Backend и storefront деплоятся как
   независимые runtime surface. Включение storefront в общий
   compose дезориентировало бы staging/prod пайплайн.
4. **Не реальный «фронт» Medusa.** В компоуз входит **Medusa Admin**
   (HMR порт `5173`) — он часть backend-приложения. Storefront —
   это отдельный Next.js проект витрины.

### Можно ли всё-таки положить storefront в контейнер?

Технически — да, локально для своего удобства. Не правьте
canonical-файлы; используйте локальный override
(`docker-compose.override.yml`, не коммитить), например:

```yaml
services:
  medusa-storefront:
    image: node:20-bookworm
    working_dir: /app
    user: "${HOST_UID:-1000}:${HOST_GID:-1000}"
    volumes:
      - ./medusa-agency-boilerplate-storefront:/app
    environment:
      - NODE_ENV=development
      - HOME=/tmp/sf-home
      - NPM_CONFIG_CACHE=/tmp/sf-npm
    command: sh -lc 'npm install && npm run dev -- -p 8000 -H 0.0.0.0'
    ports:
      - "${STOREFRONT_PORT:-8000}:8000"
    depends_on:
      medusa-backend:
        condition: service_started
    networks:
      - medusa_net
```

Подводные камни такого override:

- порядок: `bootstrap` всё равно нужен **до** первого старта
  storefront, иначе `.env.local` без publishable key;
- внутри контейнера `MEDUSA_BACKEND_URL` должен указывать на
  `http://medusa-backend:9000`, а из браузера —
  `http://localhost:9000`; storefront читает обе переменные;
- HMR Next.js может потребовать `WATCHPACK_POLLING=true`;
- права на `.next/` придётся чинить аналогично
  `npm run permissions:fix` для backend.

Если делаете так — рассматривайте это как локальный dev-комфорт, а
не часть master-repo контракта.

## 3. Что умеет меню

| Группа | Пункт | Что делает |
|---|---|---|
| Состояние | `status` | env-файлы, `docker compose ps`, занятость портов, HTTP `/health` backend, доступность storefront |
| Состояние | `preflight` | `npm run preflight` — валидация env/портов |
| Состояние | `typecheck` | `npm run typecheck` (backend + storefront) |
| Запуск | `bootstrap` | `npm run bootstrap` с подтверждением |
| Запуск | `up all` | `npm run dev` — canonical полный запуск |
| Запуск | `up infra` | только Postgres + Redis |
| Запуск | `up backend` | поднять backend контейнер |
| Запуск | `up storefront dev` | foreground `next dev` на хосте |
| Запуск | `start storefront` | foreground `next start` на хосте после `npm run storefront:build`; удобно для production-preview smoke/browser-проверки |
| Управление | `restart backend` | `docker compose restart medusa-backend` |
| Управление | `rebuild backend` | stop → permissions:fix → install → build → up |
| Управление | `rebuild storefront` | install + build на хосте |
| Управление | `permissions:fix` | чинит права на сгенерированных backend-файлах |
| Управление | `logs` | follow логи выбранного сервиса |
| Управление | `shell` | `bash` внутри backend контейнера |
| Управление | `psql` | psql в `medusa-db` |
| Управление | `smoke` | выбор: backend / storefront / browser / notification / delivery-hub cutover |
| Остановка | `stop` | `docker compose stop` + остановка host-процесса storefront на `:STOREFRONT_PORT` (тома живы) |
| Остановка | `down` | `docker compose down` + остановка storefront (тома живы) |
| Остановка | `nuke` | `docker compose down -v` + остановка storefront — **удаляет БД**, два подтверждения |
| Остановка | `stop storefront` | только host-процесс storefront (без касания docker) |
| Payload CMS | `payload status/health` | статус env/runtime, процессов, порта и admin healthcheck |
| Payload CMS | `payload dev` | foreground Payload/Next dev server |
| Payload CMS | `payload build` | production build с защитой от активного Payload/Next dev/start |
| Payload CMS | `payload start` | foreground production start после build |
| Payload CMS | `payload types` | generate types + importmap |
| Payload CMS | `payload seed` | тестовые страницы + globals |
| Payload CMS | `payload stop` | остановить активные Payload/Next dev/start процессы без удаления [`payload-cms/.next`](../payload-cms/.next) |
| Payload CMS | `payload clean` | остановить Payload/Next dev/start и дополнительно удалить [`payload-cms/.next`](../payload-cms/.next) |
| Payload CMS | `payload restart` | clean + запуск dev server в foreground |

### Как останавливается storefront

Storefront не входит в `docker-compose.yml` (см. §2), поэтому
`docker compose stop/down` его не трогает. Чтобы `stop`/`down`/`nuke`
из меню/CLI не оставляли «висящий» `next dev` на хосте, скрипт
дополнительно выполняет `cmd_stop_storefront`.

Алгоритм (намеренно консервативный — после инцидента с убийством
терминальной сессии запрещены `kill -PGID` и широкий `pgrep`):

1. Находит **listener-PID** на `:STOREFRONT_PORT` через `ss` →
   `fuser` → `lsof` (первый, который вернёт результат).
2. От каждого listener-PID идёт вверх по дереву родителей и
   добавляет в список ровно тех родителей, кто **сам по себе**
   является storefront-обёрткой (`storefront-dev.sh`, `npm`,
   `sh -c 'next dev …'`). Как только встречается «чужой»
   родитель — обход останавливается.
3. Каждый кандидат проходит `_safe_to_kill_storefront_pid`:
   - PID существует и принадлежит текущему UID;
   - PID **не** session leader (`sid != pid`) — иначе можно
     было бы убить сессию текущего терминала / VSCode shell;
   - `cmdline` процесса соответствует одному из шаблонов
     storefront (`next-server`, `next dev`, `storefront-dev.sh`,
     путь `medusa-agency-boilerplate-storefront`).
4. Только прошедшим фильтр PID шлётся `SIGTERM` (по одному, **не**
   по process group). Ждёт до 8 секунд.
5. Если процесс не завершился — `SIGKILL` тому же конкретному PID.
6. Если после этого порт всё ещё занят — берётся актуальный
   listener-PID и проверяется тем же фильтром; чужие PID не трогаются,
   о них печатается `warn`.

Если `STOREFRONT_PORT` свободен — пункт молча сообщает «уже остановлен»
и завершается с `0`. Доступен и отдельным пунктом меню `21) stop storefront`
и CLI-командой `bash scripts/manage.sh stop:storefront` — удобно, когда
backend оставляем работать, а перезапускаем только витрину.

### Production-preview запуск storefront

Для проверки после сборки доступен отдельный путь:

```bash
npm run storefront:build
npm run storefront:start
# или
bash scripts/manage.sh start:storefront
```

[`scripts/storefront-start.sh`](./storefront-start.sh:1) загружает root `.env`,
экспортирует те же backend/base URL переменные, что и dev-запуск, проверяет
наличие [`medusa-agency-boilerplate-storefront/.next/BUILD_ID`](../medusa-agency-boilerplate-storefront/.next/BUILD_ID)
и запускает `next start` на `STOREFRONT_PORT`. Это не заменяет canonical dev/HMR
путь, а даёт стабильный production-preview smoke-контур для браузерной проверки
после `next build`.

Для StudioPro/Stitch frontend-аудита этот путь является предпочтительным
runtime-контуром: сначала остановить старый host storefront через
`bash scripts/manage.sh stop:storefront`, затем выполнить
`npm run storefront:build && npm run storefront:start` и проверять ключевые
routes (`/ru`, `/ru/store`, `/ru/products/<handle>`, `/ru/contacts`, `/ru/cart`).
Текущий список code-vs-interface gaps и ожидаемых проверок ведётся в
[`Docs/stitch_frontend_gap_log.md`](../Docs/stitch_frontend_gap_log.md).

### Как останавливается Payload CMS

Payload CMS запускается отдельным Next/Payload процессом из
[`payload-cms/`](../payload-cms) и не является частью `docker compose stop`.
Для безопасной остановки без очистки cache/build output используйте:

```bash
bash scripts/manage.sh payload:stop
# или
npm run payload:stop
```

В интерактивном меню это пункт `28) payload stop`. Он вызывает
[`scripts/payload-run.sh`](./payload-run.sh:1) с командой `stop`, находит
активные Payload/Next `dev`/`start` процессы в директории
[`payload-cms/`](../payload-cms) и отправляет им `SIGTERM`, при необходимости
после ожидания — `SIGKILL`. Команда **не удаляет**
[`payload-cms/.next`](../payload-cms/.next).

Если нужно именно сбросить повреждённый или устаревший Next output,
используйте `payload clean`: `bash scripts/manage.sh payload:clean` или
`npm run payload:clean`. В отличие от stop, clean сначала останавливает
Payload/Next процессы, а затем дополнительно удаляет
[`payload-cms/.next`](../payload-cms/.next).

## 4. Защиты

- `nuke` требует **двух** подтверждений и явно предупреждает о
  потере данных.
- `bootstrap`, `up storefront`, `start storefront`, `rebuild backend` спрашивают
  подтверждение перед действием.
- `set -uo pipefail` — без `-e`, чтобы меню не падало после ошибки
  одной команды; пользователь видит код возврата и возвращается в
  меню по Enter.
- Скрипт читает корневой `.env`, чтобы знать актуальные порты
  (`POSTGRES_PORT`, `REDIS_PORT`, `MEDUSA_BACKEND_PORT`,
  `STOREFRONT_PORT`); при отсутствии — берёт значения из
  [`.env.example`](../.env.example:13).

## 5. Канонический «холодный старт» проекта

Для нового клона/новой машины:

```bash
cp .env.example .env
# отредактируйте секреты в .env (POSTGRES_PASSWORD, JWT_SECRET, COOKIE_SECRET, ...)
npm run manage          # → пункт 4 bootstrap
npm run manage          # → пункт 2 preflight
npm run manage          # → пункт 5 up all
```

Эквивалентно:

```bash
cp .env.example .env
npm run bootstrap
npm run preflight
npm run dev
```

`scripts/manage.sh` — это удобный shell поверх того же контракта.
