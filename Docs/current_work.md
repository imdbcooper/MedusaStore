# Current Work

> Статус документа: текущий операционный фокус проекта по состоянию на `2026-04-16`
>
> Назначение: дать агенту с пустым контекстом быстрый и однозначный ответ на три вопроса:
> 1. что делаем прямо сейчас;
> 2. где именно в репозитории идет работа;
> 3. что еще рано начинать.

---

## 1. Роль документа

Этот файл является **каноническим оперативным статусом проекта**.

Именно здесь должно быть явно написано:
- какая фаза активна сейчас;
- что является текущей задачей разработки;
- какие файлы и директории являются рабочей поверхностью;
- в каком порядке агент должен продолжать работу.

Если этот документ расходится с кодом, важнее код и проверенное состояние репозитория. После проверки этот документ нужно обновить.

---

## 2. Что делаем сейчас

### Активная фаза

Чистый локальный onboarding baseline по **Фазе 1** подтвержден, и текущий рабочий фокус смещен на **Фазу 2: шаблонный backend baseline вместо demo-baseline** из [master_repo_plan_v2.md](./master_repo_plan_v2.md).

### Текущий статус

Честный clean-state прогон канонического сценария подтвержден:
1. `cp .env.example .env`
2. `npm run bootstrap`
3. `npm run preflight`
4. `npm run dev`

Это значит:
- **Gate A закрыт для clean local onboarding**;
- **Фаза 1 как baseline локального старта подтверждена**;
- повторный `npm run bootstrap` поверх уже заполненной БД остается отдельным hardening concern, но не блокирует clean onboarding baseline.

### Уже закреплено и остается опорой

Подтверждено кодом и прогоном:
- добавлен корневой orchestration-слой через [package.json](/home/somdev/Projects/medusa-agency-boilerplate/package.json) и папку [scripts/](/home/somdev/Projects/medusa-agency-boilerplate/scripts);
- добавлены команды `bootstrap`, `preflight`, `dev`, `backend:build`, `storefront:build`, `smoke:backend`, `permissions:fix`;
- `permissions:fix` теперь чинит не только `.medusa`, но и `node_modules/.vite`;
- bootstrap использует application-level seed из [medusa-agency-boilerplate/src/scripts/seed.ts](medusa-agency-boilerplate/src/scripts/seed.ts:58), а не SQL dump как канонический путь;
- root `.env` на текущей машине выровнен на backend-порт `9001`, и команды по умолчанию больше не требуют ручного override;
- root `npm run dev` подтвержден в схеме:
  - backend через `docker compose`
  - storefront локально
  - root preflight перед стартом
- создан и зафиксирован env-контракт в [env_contract.md](/home/somdev/Projects/medusa-agency-boilerplate/Docs/env_contract.md);
- добавлен [scripts/env-sync.sh](scripts/env-sync.sh) для синхронизации backend/storefront env из root `.env`;
- добавлен tracked-шаблон [medusa-agency-boilerplate-storefront/.env.local.example](medusa-agency-boilerplate-storefront/.env.local.example) вместо неявной зависимости от уже существующего локального `.env.local`.

### Текущая цель

Следующий шаг по каноническому плану после закрытия Gate A — пройти **Фазу 2**:
- убрать demo-oriented baseline из clean DB bootstrap;
- заменить привязку к `Europe/EUR` на шаблонный baseline;
- обеспечить корректные store/region/publishable key данные без ручной раскладки через админку;
- сохранить рабочим уже подтвержденный clean onboarding path.

---

## 3. Где ведется работа прямо сейчас

На текущем этапе основная рабочая поверхность смещается сюда:

- [medusa-agency-boilerplate/src/scripts/seed.ts](/home/somdev/Projects/medusa-agency-boilerplate/medusa-agency-boilerplate/src/scripts/seed.ts)
- [medusa-agency-boilerplate/medusa-config.ts](/home/somdev/Projects/medusa-agency-boilerplate/medusa-agency-boilerplate/medusa-config.ts)
- [medusa-agency-boilerplate-storefront/src/lib/config.ts](/home/somdev/Projects/medusa-agency-boilerplate/medusa-agency-boilerplate-storefront/src/lib/config.ts)
- [medusa-agency-boilerplate-storefront/.env.local.example](/home/somdev/Projects/medusa-agency-boilerplate/medusa-agency-boilerplate-storefront/.env.local.example)
- [package.json](/home/somdev/Projects/medusa-agency-boilerplate/package.json)
- [scripts/](/home/somdev/Projects/medusa-agency-boilerplate/scripts)
- [Docs/env_contract.md](/home/somdev/Projects/medusa-agency-boilerplate/Docs/env_contract.md)
- [Docs/master_repo_plan_v2.md](/home/somdev/Projects/medusa-agency-boilerplate/Docs/master_repo_plan_v2.md)
- [Docs/plan_analysis.md](/home/somdev/Projects/medusa-agency-boilerplate/Docs/plan_analysis.md)
- [.codex/skills/medusa-master-repo/SKILL.md](/home/somdev/Projects/medusa-agency-boilerplate/.codex/skills/medusa-master-repo/SKILL.md)

Если в рамках Фазы 2 будут создаваться новые файлы, то в первую очередь это ожидается в таких местах:
- backend seed/bootstrap-логика;
- storefront-конфиг и env-шаблоны;
- документы, которые фиксируют новый baseline и правила старта.

---

## 4. Конкретные задачи текущего этапа

### 4.1. Убрать demo-oriented baseline из clean DB

Сейчас нужно:
- перестать считать `Europe/EUR` и стартовые demo-данные нормой шаблона;
- определить минимальный шаблонный baseline, который реально должен появляться после bootstrap;
- зафиксировать, какие данные считаются обязательной частью шаблона.

Практический смысл:
после clean bootstrap проект должен подниматься не как демо-магазин Medusa, а как нейтральная стартовая база шаблона.

### 4.2. Сделать bootstrap источником шаблонного baseline

Сейчас нужно:
- довести [medusa-agency-boilerplate/src/scripts/seed.ts](/home/somdev/Projects/medusa-agency-boilerplate/medusa-agency-boilerplate/src/scripts/seed.ts) до шаблонного baseline;
- обеспечить корректные store, region и publishable key данные без ручной раскладки через админку;
- сохранить текущий clean-state short path без дополнительных шагов.

Практический смысл:
канонический onboarding уже подтвержден, теперь его результат должен создавать правильную стартовую модель данных.

### 4.3. Сверить storefront с новым baseline

Сейчас нужно:
- убрать лишнюю привязку витрины к demo-defaults;
- проверить, что storefront получает корректный backend URL, publishable key и рабочий region из нового baseline;
- не сломать уже подтвержденный локальный старт.

Практический смысл:
если backend baseline меняется, storefront должен оставаться совместимым с ним без ручных костылей.

---

## 5. Что сейчас не делаем

До закрытия Фазы 2 не начинаем:
- внедрение YooKassa, ApiShip, SMTP или других внешних интеграций;
- глубокую русификацию и брендирование storefront;
- систему клиентских тем и секций;
- migration в workspace/monorepo;
- template release и автоматизацию создания нового клиента.

Простыми словами:
сейчас мы не возвращаемся к Gate A как к основному треку, а приводим baseline данных к следующему рабочему состоянию.

---

## 6. Подтвержденные ограничения и notes текущего этапа

- clean-state сценарий `cp .env.example .env` → `npm run bootstrap` → `npm run preflight` → `npm run dev` уже подтвержден и не считается открытым блокером;
- повторный `npm run bootstrap` поверх уже заполненной БД остается отдельным hardening concern;
- storefront по-прежнему зависит от корректного `MEDUSA_BACKEND_URL`, publishable API key и наличия region;
- baseline данных все еще остается слишком demo-oriented, пока в нем сохраняются привязки к `Europe/EUR` и стартовым демо-настройкам.

---

## 7. Порядок действий для агента с пустым контекстом

Если пользователь пишет "начинай" или "продолжай реализацию", агент должен действовать так:

1. Прочитать этот файл: [current_work.md](/home/somdev/Projects/medusa-agency-boilerplate/Docs/current_work.md).
2. Открыть дорожную карту: [master_repo_plan_v2.md](/home/somdev/Projects/medusa-agency-boilerplate/Docs/master_repo_plan_v2.md).
3. Прочитать аудит состояния: [plan_analysis.md](/home/somdev/Projects/medusa-agency-boilerplate/Docs/plan_analysis.md).
4. Проверить рабочую поверхность текущего этапа:
   - [medusa-agency-boilerplate/src/scripts/seed.ts](/home/somdev/Projects/medusa-agency-boilerplate/medusa-agency-boilerplate/src/scripts/seed.ts)
   - [medusa-agency-boilerplate/medusa-config.ts](/home/somdev/Projects/medusa-agency-boilerplate/medusa-agency-boilerplate/medusa-config.ts)
   - [medusa-agency-boilerplate-storefront/src/lib/config.ts](/home/somdev/Projects/medusa-agency-boilerplate/medusa-agency-boilerplate-storefront/src/lib/config.ts)
   - [package.json](/home/somdev/Projects/medusa-agency-boilerplate/package.json)
   - [scripts/](/home/somdev/Projects/medusa-agency-boilerplate/scripts)
   - [env_contract.md](/home/somdev/Projects/medusa-agency-boilerplate/Docs/env_contract.md)
5. Если задача затрагивает onboarding path, не ломать уже подтвержденный clean-state сценарий:
   - `cp .env.example .env`
   - `npm run bootstrap`
   - `npm run preflight`
   - `npm run dev`
6. По умолчанию работать в рамках Фазы 2; hardening повторного `npm run bootstrap` на заполненной БД считать отдельной задачей, а не текущим главным треком.
7. После значимых изменений обновить:
   - [current_work.md](/home/somdev/Projects/medusa-agency-boilerplate/Docs/current_work.md)
   - [master_repo_plan_v2.md](/home/somdev/Projects/medusa-agency-boilerplate/Docs/master_repo_plan_v2.md)
   - [plan_analysis.md](/home/somdev/Projects/medusa-agency-boilerplate/Docs/plan_analysis.md), если аудит устарел
   - [.codex/skills/medusa-master-repo/SKILL.md](/home/somdev/Projects/medusa-agency-boilerplate/.codex/skills/medusa-master-repo/SKILL.md), если меняется навигация или правила работы

---

## 8. Где смотреть статус разных типов

- Что делаем прямо сейчас: [current_work.md](/home/somdev/Projects/medusa-agency-boilerplate/Docs/current_work.md)
- Куда идем и в каком порядке: [master_repo_plan_v2.md](/home/somdev/Projects/medusa-agency-boilerplate/Docs/master_repo_plan_v2.md)
- Что реально уже подтверждено и какие есть разрывы: [plan_analysis.md](/home/somdev/Projects/medusa-agency-boilerplate/Docs/plan_analysis.md)
- Как агенту быстро войти в контекст: [.codex/skills/medusa-master-repo/SKILL.md](/home/somdev/Projects/medusa-agency-boilerplate/.codex/skills/medusa-master-repo/SKILL.md)

---

## 9. Когда этот документ нужно обновлять

Этот файл нужно обновлять обязательно, если:
- изменилась активная фаза;
- начался новый конкретный рабочий трек;
- изменилась рабочая поверхность текущего этапа;
- был снят или добавлен блокер;
- поменялся ответ на вопрос "что делаем прямо сейчас".
