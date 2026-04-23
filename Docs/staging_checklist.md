# Staging Checklist — Phase 8 tranche 2

> Статус: первый canonical artifact для `Phase 8 / tranche 2` по состоянию на `2026-04-20`.
>
> Основание: `Phase 8 / tranche 1` уже materialized как baseline integrity contour в [`Docs/current_work.md`](./current_work.md), [`Docs/master_repo_plan_v2.md`](./master_repo_plan_v2.md) и [`.github/workflows/integrity-baseline.yml`](../.github/workflows/integrity-baseline.yml).
>
> Назначение: формализовать **первый staging-ready contour** поверх уже подтвержденного baseline, не заходя в deploy automation, rollback, backup/restore drills или monitoring implementation.

## 1. Цель staging-контура и его границы

### Цель

Этот staging checklist нужен не для доказательства production-ready состояния, а для подтверждения более узкого и честного факта:

- шаблон поднимается в отдельном non-local окружении на том же baseline-контуре, который уже подтвержден локально;
- обязательные runtime-зависимости backend и storefront согласованы между собой;
- staging-контур воспроизводит минимально необходимый readiness path до deploy/rollback/monitoring follow-up шагов.

### Границы первого staging-ready шага

В scope этого документа входят только:

- обязательные сервисы и их зависимости;
- минимальные env/runtime assumptions, вытекающие из текущего baseline;
- readiness criteria для backend и storefront;
- минимальный staging smoke path как проекция уже подтвержденного baseline contour;
- единый actionable checklist для ручной staging-валидации.

В этот документ **не** входят:

- новая staging-архитектура сверх уже существующих артефактов;
- новый CI/CD pipeline или infra provisioning;
- deploy automation;
- rollback runbook;
- backup/restore drills;
- monitoring implementation.

## 2. Обязательные сервисы, компоненты и зависимости

| Компонент | Обязательный статус для staging | Зависимости | Примечание |
| --- | --- | --- | --- |
| PostgreSQL | Доступен, persistent, с валидными credentials | staging network, non-placeholder secrets | Текущий baseline опирается на PostgreSQL как primary store через [`.env.example`](../.env.example). |
| Redis | Доступен и reachable из backend runtime | staging network | Нужен для текущего Medusa runtime contour и уже входит в локальный baseline через [`docker-compose.yml`](../docker-compose.yml). |
| Medusa backend | Запускается и отвечает на `/health` | PostgreSQL, Redis, backend env, CORS | Локальный baseline уже подтверждает именно этот runtime path. |
| Storefront runtime | Запускается и reachable по staging URL | backend public URL, publishable key, storefront env | Важно: storefront **не** входит в [`docker-compose.yml`](../docker-compose.yml), поэтому для staging он должен существовать как отдельный runtime surface, а не подразумеваться автоматически. |
| Baseline seed state | Присутствуют `ru` region, `rub` currency, publishable API key, sales channel, минимальный shipping skeleton | успешный bootstrap/seed path | Это уже зафиксировано как часть подтвержденного baseline в [`Docs/current_work.md`](./current_work.md). |
| Baseline smoke surface | Доступны backend health, storefront root, storefront account login surface, authenticated notification smoke | работающие backend/storefront runtime и seeded state | Это staging-проекция уже materialized baseline smoke contour, а не новый e2e suite. |

## 3. Обязательные env/runtime assumptions

Первый staging contour опирается на те же runtime assumptions, что и локальный baseline path `cp .env.example .env → bootstrap → preflight → dev`, но с **staging-specific значениями** вместо локальных placeholder/default значений.

### Обязательные assumptions

- staging env не использует placeholder-значения для `POSTGRES_PASSWORD`, `JWT_SECRET` и `COOKIE_SECRET` из [`.env.example`](../.env.example);
- `DATABASE_URL` и `REDIS_URL` указывают на реально доступные staging PostgreSQL и Redis endpoints;
- backend public URL стабилен и используется как canonical `MEDUSA_BACKEND_URL` для storefront/runtime smoke;
- storefront получает валидный `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`, materialized из bootstrap/seed, а не вручную скопированный произвольный ключ;
- baseline region остается `ru`, а baseline currency остается `rub`;
- `STORE_CORS`, `ADMIN_CORS` и `AUTH_CORS` включают staging origins, соответствующие реальному backend/storefront/admin access contour;
- staging contour не требует включения opt-in integrations только ради базового старта;
- пустое или disabled состояние для `UNISENDER_*`, `MTS_EXOLVE_*`, `VK_*`, `APISHIP_*`, `YOOKASSA_*` и `PAYLOAD_*` остается допустимым для первого readiness step, если эти integrations отдельно не включены и не утверждены для конкретного staging pass;
- storefront runtime assumptions остаются минимальными и согласованными с текущим baseline: backend URL, publishable key, base URL и default region;
- staging не должен подменять baseline-контур ad-hoc ручными действиями, которые нельзя повторить тем же sanctioned path.

### Что это значит practically

- [`.env.example`](../.env.example) остается source-of-truth по составу переменных, но не является staging-ready набором значений сам по себе;
- [`docker-compose.yml`](../docker-compose.yml) остается baseline reference по обязательным infra-компонентам `PostgreSQL + Redis + backend`, но не описывает полный staging topology, потому что storefront в него не включен;
- root scripts из [`package.json`](../package.json) остаются canonical naming для integrity/smoke surface, даже если staging orchestration запускается не буквально тем же локальным способом.

## 4. Readiness criteria

### Backend readiness

Backend считается staging-ready для этого первого шага, если выполнены все условия ниже:

- runtime стартует на staging без требования обязательных opt-in integration secrets;
- endpoint `/health` отвечает успешно;
- baseline seed state подтвержден: существуют `ru` region, `rub` currency, sales channel, publishable API key и минимальный shipping skeleton;
- authenticated notification smoke path остается воспроизводимым в канонической схеме `fresh sk_* key → Basic auth → POST /admin/notifications/smoke`;
- backend contour соответствует уже подтвержденному baseline и не требует staging-only обходных manual fixes для самого факта старта.

### Storefront readiness

Storefront считается staging-ready для этого первого шага, если выполнены все условия ниже:

- storefront runtime существует как отдельный staging surface и reachable по стабильному URL;
- storefront подключен к правильному backend public URL;
- storefront использует валидный publishable key из текущего baseline seed state;
- storefront root page открывается успешно;
- `/ru/account` открывается успешно и подтверждает тот же минимальный login/account surface, на который уже опирается baseline browser smoke;
- storefront readiness не зависит от включения optional payment/shipping/content integrations, если они не являются явно утвержденной частью данного staging pass.

## 5. Минимальный staging smoke path как проекция текущего baseline

Ниже перечислен **минимальный** smoke path, который честно продолжает текущий baseline contour и не притворяется полным e2e release flow.

1. Подтвердить доступность обязательных runtime components: PostgreSQL, Redis, backend, storefront.
2. Подтвердить, что candidate не ломает sanctioned baseline integrity contour из [`package.json`](../package.json):
   - `lint`;
   - `typecheck`;
   - `backend:build`;
   - `storefront:build`.
3. Поднять staging candidate и дождаться readiness двух обязательных HTTP endpoints:
   - backend `GET /health`;
   - storefront root URL.
4. Подтвердить backend health-check ответ без manual intervention.
5. Подтвердить storefront viability через два минимальных surface checks:
   - storefront root URL отвечает успешно;
   - storefront route `/ru/account` загружается и показывает login/account surface, эквивалентный текущему browser smoke baseline.
6. Подтвердить authenticated notification smoke как действующий baseline runtime anchor:
   - создать fresh secret admin API key;
   - выполнить `Basic auth` запрос на `POST /admin/notifications/smoke`;
   - получить успешный smoke verdict без требования production-only provider rollout.
7. Зафиксировать результат staging pass и отдельно отметить любые opt-in integration smokes как follow-up, а не как часть обязательного первого contour.

## 6. Явный out-of-scope для следующего шага

Следующие темы **не** закрываются этим документом и должны идти отдельными follow-up артефактами/шагами `Phase 8`:

- deploy automation;
- rollback runbook;
- backup/restore drills;
- monitoring implementation.

Дополнительно вне scope этого первого artifact остаются:

- production topology hardening;
- webhook monitoring и log/alert baseline implementation;
- full end-to-end checkout/order smoke как обязательный staging gate;
- release candidate checklist целиком.

## 7. Canonical actionable checklist

- [ ] Staging environment содержит обязательные runtime surfaces: PostgreSQL, Redis, backend и storefront.
- [ ] Storefront трактуется как отдельный runtime component и не теряется из-за того, что он отсутствует в [`docker-compose.yml`](../docker-compose.yml).
- [ ] Все staging secrets materialized отдельно от template-safe placeholder значений из [`.env.example`](../.env.example).
- [ ] `DATABASE_URL`, `REDIS_URL`, backend public URL и staging CORS values указывают на реальные staging endpoints.
- [ ] Baseline seed state подтвержден: `ru`, `rub`, sales channel, publishable key, минимальный shipping skeleton.
- [ ] Optional integrations остаются disabled/empty-by-default либо явно утверждены отдельно, но не превращены в prerequisite для первого staging pass.
- [ ] Candidate проходит baseline static contour: lint, typecheck, backend build, storefront build.
- [ ] Backend `/health` отвечает успешно в staging runtime.
- [ ] Storefront root URL отвечает успешно в staging runtime.
- [ ] Route `/ru/account` успешно загружается и подтверждает минимальный login/account surface.
- [ ] Authenticated `POST /admin/notifications/smoke` проходит через fresh `sk_*` key и `Basic auth`.
- [ ] Итог staging pass задокументирован без overclaim, что уже закрыты deploy, rollback, backup/restore или monitoring tracks.

## 8. Основание этого checklist

Документ опирается на уже materialized baseline artifacts и не вводит новую архитектуру поверх них:

- [`Docs/current_work.md`](./current_work.md);
- [`Docs/master_repo_plan_v2.md`](./master_repo_plan_v2.md);
- [`.env.example`](../.env.example);
- [`docker-compose.yml`](../docker-compose.yml);
- [`package.json`](../package.json);
- [`medusa-agency-boilerplate/package.json`](../medusa-agency-boilerplate/package.json);
- [`medusa-agency-boilerplate-storefront/package.json`](../medusa-agency-boilerplate-storefront/package.json);
- [`.github/workflows/integrity-baseline.yml`](../.github/workflows/integrity-baseline.yml).
