# Master Repo Plan v2

> Статус документа: рабочий план, синхронизированный с проверенным состоянием репозитория по состоянию на `2026-04-19`
>
> Назначение: заменить прежний оптимистичный план на проверенную дорожную карту, которая ведет проект к состоянию тиражируемого репозитория-шаблона для интернет-магазинов.

---

## 1. Назначение плана

Этот документ описывает реальную программу работ по превращению текущего репозитория в **репозиторий-шаблон для быстрого запуска клиентских магазинов** на базе Medusa.

План опирается на:
- фактическое состояние текущего репозитория;
- выводы из [plan_analysis.md](./plan_analysis.md);
- текущий операционный статус из [current_work.md](./current_work.md);
- проверенные официальные материалы Medusa;
- согласованные проектные решения из нашего обсуждения.

Этот план **не считает доказанным** то, что не подтверждено исходниками или официальной документацией. Там, где подтверждения пока нет, добавлены отдельные шаги верификации и контрольные ворота.

Важно:
- [current_work.md](./current_work.md) отвечает на вопрос "что делаем прямо сейчас и где";
- `master_repo_plan_v2.md` отвечает на вопрос "куда идем и в каком порядке";
- [plan_analysis.md](./plan_analysis.md) отвечает на вопрос "что уже реально подтверждено, а что еще нет".

---

## 2. Что считается целью проекта

### 2.1. Главная цель

Создать репозиторий-шаблон, из которого новый интернет-магазин для клиента можно поднимать быстро, предсказуемо и без переписывания общей торговой логики.

### 2.2. Практический смысл цели

В шаблоне должны жить:
- общая серверная логика магазина;
- общий торговый поток: каталог, корзина, checkout, заказы, клиенты;
- общая российская базовая адаптация;
- общие интеграции и их контракты;
- общая инфраструктура запуска, сборки, проверки и выкладки;
- общий фронтовый каркас для commerce-функциональности.

На стороне конкретного клиента должны жить:
- фирменный стиль;
- контент;
- изображения;
- отдельные лендинги и визуальные секции;
- реквизиты, контакты, юридические данные;
- ключи и настройки конкретных провайдеров.

### 2.3. Критерии успеха

Репозиторий можно считать достигшим цели, когда выполняются все условия:
- новый проект под клиента создается из шаблона по понятному сценарию;
- технический запуск нового магазина занимает часы, а не недели;
- типовой клиент не требует переписывания общей торговой логики;
- индивидуальный дизайн внедряется поверх общего фронтового ядра;
- общий код можно улучшать один раз и переносить во все новые проекты;
- базовые сборки, проверки и сценарии запуска повторяемы на чистом окружении.

### 2.4. Market Scope Policy

Рынок по умолчанию для этого master repo: **Россия**.

Это означает:
- все core-решения первой версии по умолчанию выбираются для типового интернет-магазина в РФ;
- пригодность для российского рынка важнее, чем наличие у Medusa более подробно задокументированного или более удобного first-party примера;
- для payment track текущим направлением v1 считается **YooKassa-first path**;
- для shipping track целевым следующим направлением v1 считается **ApiShip-first path**, пока не доказано обратное;
- нецелевые для РФ решения можно изучать как reference pattern для архитектуры Medusa, но нельзя выбирать как `default v1 choice`, если пользователь явно не сменил рынок проекта.

---

## 3. Источниковая база и проверенные факты

### 3.1. Что проверено в текущем репозитории

Подтверждено локальными файлами:
- текущий [`medusa-config.ts`](../medusa-agency-boilerplate/medusa-config.ts) уже содержит Notification Module с provider path `local|unisender` и opt-in Payment Module registration для текущего YooKassa-first slice.
- `docker-compose.yml` поднимает PostgreSQL, Redis и backend, но не поднимает storefront: `docker-compose.yml:1-77`.
- bootstrap baseline уже переведен на `ru`/`rub`, создает publishable API key, sales channel и минимальный shipping skeleton: `medusa-agency-boilerplate/src/scripts/seed.ts:51-365`.
- storefront template env уже использует `NEXT_PUBLIC_DEFAULT_REGION=ru`, runtime backend URL синхронизируется из root env, а `NEXT_PUBLIC_STOREFRONT_PRESET` допускается как optional Phase 6 switch для sanctioned client scenarios: `medusa-agency-boilerplate-storefront/.env.local.example:1-21`, `scripts/env-sync.sh:99-107`.
- root env sync теперь также протаскивает YooKassa guardrails `YOOKASSA_STOREFRONT_RETURN_ORIGINS`, `YOOKASSA_WEBHOOK_URL` и `YOOKASSA_ALLOW_UNSIGNED_WEBHOOKS` в backend env, чтобы канонический path `cp .env.example .env` → `npm run bootstrap` не расходился с текущим return/webhook hardening-кодом: `scripts/env-sync.sh:92-98`, `medusa-agency-boilerplate/src/api/store/payment/yookassa/return/route.ts:49-120`, `medusa-agency-boilerplate/src/api/yookassa/webhook/shared.ts:91-130`.
- storefront по-прежнему содержит starter-branding Medusa: `medusa-agency-boilerplate-storefront/src/modules/home/components/hero/index.tsx:1-36`.
- storefront строит выбор региона через `/store/regions` и `x-publishable-api-key`, а fallback-регион уже переведен на `ru`: `medusa-agency-boilerplate-storefront/src/middleware.ts:4-168`, `medusa-agency-boilerplate-storefront/src/lib/data/regions.ts:34-57`.
- notification slice v1 уже присутствует в коде: в `medusa-config.ts` зарегистрирован Notification Module с provider path `local|unisender`, есть admin smoke route и отдельный workflow для smoke-пути: `medusa-agency-boilerplate/medusa-config.ts:1-43`, `medusa-agency-boilerplate/src/api/admin/notifications/smoke/route.ts:1-111`, `medusa-agency-boilerplate/src/workflows/send-notification-smoke.ts:1-71`, `medusa-agency-boilerplate/src/scripts/create-secret-admin-api-key.ts:1-80`.
- payment slice v1 уже присутствует в коде как opt-in YooKassa-first path: есть custom payment provider module, store routes для `return` / `status` / `webhook`, и storefront-aware payment handling для этого сценария: `medusa-agency-boilerplate/src/modules/yookassa.ts:1-462`, `medusa-agency-boilerplate/src/api/store/payment/yookassa/return/route.ts:1-30`, `medusa-agency-boilerplate/src/api/store/payment/yookassa/status/route.ts:1-95`, `medusa-agency-boilerplate/src/api/store/payment/yookassa/webhook/route.ts:1-102`, `medusa-agency-boilerplate-storefront/src/lib/data/payment.ts:1-136`, `medusa-agency-boilerplate-storefront/src/modules/checkout/components/payment-button/index.tsx:1-274`.

Подтверждено запуском и проверками:
- `docker compose config -q` проходит;
- root `permissions:fix` чинит права на `.medusa` и `node_modules/.vite`, а backend build подтвержден как рабочий путь;
- сборка storefront зависит от корректного `MEDUSA_BACKEND_URL` и publishable API key;
- канонический root startup path читается как `bootstrap → preflight → dev`;
- [scripts/preflight.sh](../scripts/preflight.sh) допускает reuse только для compose-owned PostgreSQL, Redis и backend там, где это явно предусмотрено;
- [scripts/dev.sh](../scripts/dev.sh) нужно трактовать как root orchestration поверх clean-start или compose-owned состояния, а не как универсальный wrapper над произвольным локальным runtime.

### 3.2. Что подтверждено официальными материалами Medusa

Проверенные опорные факты:
- Medusa использует `medusa-config.ts`, где можно регистрировать `modules`, `plugins` и их `options`: [Medusa application configuration](https://docs.medusajs.com/learn/configurations/medusa-config).
- Store API требует publishable API key в заголовке запросов: [Use a Publishable API Key in the Storefront](https://docs.medusajs.com/resources/storefront-development/publishable-api-keys).
- Storefront должен использовать publishable key и `MEDUSA_BACKEND_URL`; Next.js Starter по умолчанию работает отдельно от backend: [Next.js Starter Storefront](https://docs.medusajs.com/resources/nextjs-starter).
- Next.js Starter можно использовать как есть или строить поверх него под уникальные use case, дизайн и customer experience: [Next.js Starter Storefront](https://docs.medusajs.com/resources/nextjs-starter).
- для отдельного storefront нужен как минимум один Region в Medusa: [Next.js Starter Storefront](https://docs.medusajs.com/resources/nextjs-starter).
- Store Module поддерживает store locales, а сами переводы завязаны на Translation Module: [Store Locales](https://docs.medusajs.com/resources/commerce-modules/store/locales).
- кастомные workflows являются штатным способом собирать собственные процессы и вызывать их из API, subscribers и scheduled jobs: [Workflows](https://docs.medusajs.com/learn/fundamentals/workflows) и [Core Workflows Reference](https://docs.medusajs.com/resources/medusa-workflows-reference).
- для production Medusa рекомендует Redis Event Module и Redis Workflow Engine Module: [Redis Event Module](https://docs.medusajs.com/resources/infrastructure-modules/event/redis), [Redis Workflow Engine Module](https://docs.medusajs.com/resources/infrastructure-modules/workflow-engine/redis).
- для payment и notification официально подтверждены общие механизмы регистрации провайдеров и кастомных модулей-провайдеров: [Medusa application configuration](https://docs.medusajs.com/learn/configurations/medusa-config), [Stripe Module Provider](https://docs.medusajs.com/resources/commerce-modules/payment/payment-provider/stripe), [Local Notification Module Provider](https://docs.medusajs.com/resources/infrastructure-modules/notification/local).

### 3.3. Что в этом плане сознательно не считается доказанным

Следующие вещи **не считаются уже подтвержденными как готовое решение**, и поэтому входят в план через отдельную фазу верификации:
- наличие подходящего и поддерживаемого first-party решения Medusa для YooKassa;
- наличие подходящего и поддерживаемого first-party решения Medusa для ApiShip;
- наличие готового и безопасного SMTP-провайдера именно под наш сценарий без дополнительной доработки;
- необходимость немедленной миграции текущей структуры в workspace/monorepo;
- необходимость нескольких полноценных шаблонов фронта в первой версии.

Вывод:
все российские интеграции в этом плане рассматриваются как **проверяемые интеграционные треки**, а не как уже существующие готовые кнопки.

---

## 4. Управленческие решения проекта

Ниже зафиксированы проектные решения, на которых строится план.

### 4.1. Структура репозитория в первой итерации

Решение:
сохраняем модель **backend и storefront как отдельные приложения**, а корень репозитория используем как orchestration-слой.

Почему:
- это соответствует текущему состоянию репозитория;
- это соответствует модели установки Next.js Starter в официальной документации;
- это позволяет не тратить ранние этапы на миграцию в workspace без реальной необходимости.

Следствие:
в первой версии не делаем принудительную перестройку в monorepo/workspace. Если она понадобится позже, это будет отдельный проект после стабилизации ядра.

### 4.2. Подход к кастомному фронту

Решение:
в первой версии создается **один общий storefront core**, а не несколько полноценных шаблонов фронта.

Почему:
- поддержка нескольких фронтовых шаблонов на ранней стадии резко усложнит проект;
- общий commerce-core должен оставаться единым;
- индивидуальность клиента должна в основном приходить через тему, контент и управляемые секции.

Следствие:
модель кастомизации будет такой:
- общий storefront core;
- отдельный content layer для маркетинговых страниц и editorial-контента;
- общий design-token layer;
- слой клиентской конфигурации;
- набор управляемых секций;
- точечные client overrides там, где это оправдано.

### 4.2.1. Подход к content layer и Payload CMS

Решение:
Payload CMS рассматривается как **отдельный headless content service рядом с Medusa**, а не как часть Medusa backend и не как замена storefront.

Что это значит:
- `Medusa` остается источником правды для каталога, цен, корзины, checkout, заказов и operational commerce flows;
- `Payload CMS` отвечает за marketing pages, news/posts, global site settings, навигацию, SEO и управляемые маркетинговые блоки;
- `Next storefront` остается единым frontend-приложением и читает commerce-данные из Medusa, а content-данные из Payload.

Следствие:
- контентная интеграция не должна дублировать товарную правду в Payload;
- связи между marketing blocks и commerce-сущностями должны храниться как ссылки на Medusa IDs / handles / slugs;
- реализация Payload откладывается до момента, когда storefront core уже стабилен и готов к интеграции отдельного content layer.

### 4.3. Подход к данным клиента

Решение:
для первой версии используем принцип **configuration as data**.

Что это значит:
- клиентские параметры не должны быть размазаны по десяткам файлов;
- должен существовать один канонический источник клиентской конфигурации;
- из него должны порождаться нужные env-файлы и runtime-конфигурации.

### 4.4. Подход к российским интеграциям

Решение:
каждая внешняя интеграция проходит через три стадии:
1. проверка совместимости;
2. sandbox/POC;
3. включение в шаблон только после подтверждения устойчивости.

Ни один community package не попадает в базовый шаблон без проверки:
- пригодности для типового магазина в РФ;
- совместимости с Medusa `2.13.x`;
- активности поддержки;
- наличия тестового контура;
- сценариев webhook/refund/status update;
- понятного плана поддержки внутри проекта.

Дополнительное правило отбора:
- `official` или `first-party` статус не делает провайдера кандидатом v1 автоматически;
- если решение не подходит для российского рынка, оно не может считаться default path для этого репозитория;
- Stripe и другие нецелевые для РФ payment providers допустимо использовать как reference implementation паттерна Medusa, но не как шаблонный payment choice по умолчанию;
- для текущего payment track не переоткрываем выбор в сторону нецелевых для РФ провайдеров, пока пользователь явно не меняет market scope;
- для следующего shipping track по умолчанию исследуется **ApiShip-first** направление как наиболее соответствующее цели шаблона для РФ-магазинов.

---

## 5. Границы первой версии

### 5.1. Что входит в первую версию шаблона

- стабильный backend Medusa;
- стабильный storefront на базе Next.js Starter;
- единая локальная инфраструктура;
- RU baseline;
- один подтвержденный путь оплаты для типового магазина в РФ;
- один подтвержденный путь доставки для типового магазина в РФ;
- один подтвержденный путь уведомлений;
- шаблонная конфигурация клиента;
- механизм быстрого старта нового проекта;
- smoke-проверки и staging-ready контур.

### 5.2. Что не входит в первую версию

- несколько полноценных front themes, поддерживаемых как отдельные продукты;
- сложный CMS-first контентный конструктор;
- нетиповые B2B-функции;
- омниканальность;
- набор редких интеграций “на всякий случай”;
- глубокие уникальные сценарии под единичного клиента.

---

## 6. Подтвержденные открытые блокеры и ограничения

### 6.1. Оставшиеся ограничения среды и hardening

- `docker-compose.yml` все еще не включает storefront в единый локальный контейнерный контур;
- storefront по-прежнему чувствителен к корректности `MEDUSA_BACKEND_URL`, publishable API key и состоянию baseline region;
- root startup contract нужно читать буквально как `bootstrap → preflight → dev`, а не как произвольный runtime-reuse сценарий;
- [scripts/preflight.sh](../scripts/preflight.sh) не является generic checker для любого уже запущенного локального состояния: reuse разрешен только для compose-owned PostgreSQL, Redis и backend;
- уже занятые локальными процессами `9000` и `8000` могут быть ожидаемым failure-mode для root preflight/dev вне канонического clean-start path.

### 6.2. Открытые блокеры шаблонного ядра

- payment path v1 еще не утвержден как runtime-confirmed шаблонное решение, хотя текущий практический путь уже зафиксирован как YooKassa-first;
- shipping path v1 еще не утвержден как шаблонное решение; целевой следующий кандидат по market scope — ApiShip-first;
- общий end-to-end integration layer еще не собран полностью;
- storefront все еще визуально и смыслово остается starter-проектом Medusa;
- в проекте пока нет завершенного client configuration layer;
- отдельный content layer на базе Payload CMS еще не реализован.

### 6.3. Открытые блокеры template release

- нет завершенного процесса инициализации нового клиента из шаблона;
- нет полного набора release-grade smoke checks, CI и staging-path;
- нет подтвержденного clean template release без локальных и демо-следов;
- template еще не упакован как repeatable distribution для тиражирования.

Обновление по ранним фазам:
- clean-state bootstrap path `cp .env.example .env` → `npm run bootstrap` → `npm run preflight` → `npm run dev` уже подтвержден;
- канонический bootstrap уже опирается на Medusa migrations + application-level seed, а не на [medusa-dump.sql](medusa-dump.sql), для verified clean-state path;
- Gate A и Gate B не считаются открытыми, если речь идет о проверенном clean local onboarding и template-ready RU baseline.

---

## 7. Целевая архитектура

### 7.1. Backend template core

Общий backend должен включать:
- Medusa application;
- типовой bootstrap store;
- типовые регионы, валюты, локали, sales channels;
- общие workflows, subscribers и API routes для шаблона;
- интеграционные контракты для уведомлений, оплаты и доставки;
- staging/prod-ready event/workflow configuration.

### 7.2. Client configuration layer

Должен существовать единый слой данных клиента, в который входят:
- бренд и краткое название магазина;
- домен и ссылки;
- контакты и юридические данные;
- включенные способы доставки;
- включенные способы оплаты;
- публичные SEO-поля;
- feature flags storefront.

Этот слой должен быть единственным источником правды для генерации:
- backend env;
- storefront env;
- runtime-config storefront;
- стартовых данных клиента.

### 7.3. Storefront core

Общий storefront должен включать:
- каталог;
- карточку товара;
- корзину;
- checkout;
- личный кабинет;
- order confirmation;
- region/locale handling;
- SEO baseline;
- provider-aware payment/shipping UI;
- design token system;
- configurable sections.

### 7.4. Client design layer

Клиентский слой должен включать:
- тему;
- typography/colors/spacings;
- homepage composition;
- branded sections;
- optional page overrides;
- assets and copy.

Commerce-flow не должен переписываться для типового проекта только ради нового дизайна.

---

## 8. Критический путь проекта

Если смотреть на зависимость этапов, критический путь такой:

1. стабилизировать среду и сборки;
2. убрать demo-baseline и завести шаблонный bootstrap;
3. проверить и выбрать реальные интеграционные пути;
4. собрать один рабочий end-to-end commerce flow;
5. превратить storefront в общий configurable core;
6. добавить content layer для marketing/editorial scenarios там, где он входит в scope;
7. добавить клиентский слой кастомизации;
8. упаковать это в шаблон и автоматизацию;
9. довести до staging/prod readiness.

Пока не закрыты пункты 1-4, любые разговоры о “готовом мастер-репо” преждевременны.

---

## 9. Подробная дорожная карта

### Фаза 1. Стабилизация репозитория и локального цикла

### Цель

Сделать проект воспроизводимым: чтобы backend, storefront, БД и Redis поднимались и собирались предсказуемо на чистой машине.

### Статус на 2026-04-17

Фаза подтверждена для clean-state onboarding path.

Реализовано и проверено:
- добавлен root-level orchestration через [package.json](../package.json) и `scripts/`;
- добавлен [env_contract.md](./env_contract.md);
- добавлен repair-скрипт для прав на `.medusa` и `node_modules/.vite`;
- root `backend:build` проходит;
- root `storefront:build` проходит при живом backend;
- root `dev` подтвержден в рабочей схеме:
  - каноническая последовательность `bootstrap → preflight → dev`
  - backend через `docker compose`
  - storefront локально
  - reuse допускается только для compose-owned runtime там, где это явно предусмотрено в [scripts/preflight.sh](../scripts/preflight.sh).

Остаточные notes, которые не переоткрывают фазу:
- storefront все еще не включен в docker compose-контур;
- root scripts не следует описывать как wrapper для любого уже поднятого локального состояния;
- конфликт локальных процессов на `9000` и `8000` вне канонического clean-start path остается ожидаемым operational failure-mode.

### Задачи

- ввести единый root-level orchestration слой:
  - команды запуска;
  - команды остановки;
  - команды сборки;
  - команды smoke-проверки;
  - команды preflight-проверки.
- нормализовать карту портов:
  - сохранить стандартные порты как значения по умолчанию;
  - сделать их переопределяемыми;
  - добавить быструю проверку занятости портов перед стартом.
- устранить проблему с правами на `.medusa`:
  - отказаться от генерации root-owned служебных файлов в dev-цикле;
  - выровнять пользователя контейнера и хоста либо изменить подход к bind mount.
- зафиксировать один канонический env-контракт:
  - root infrastructure variables;
  - backend runtime variables;
  - storefront runtime variables;
  - список обязательных и опциональных значений.
- добиться стабильной локальной сборки:
  - backend build;
  - storefront build;
  - docker infra config;
  - local run.
- явно оформить текущие troubleshooting-правила:
  - конфликт порта backend;
  - пустой publishable key;
  - отсутствие region;
  - проблемы CORS.

### Артефакты

- корневой сценарий управления проектом;
- env-specification документ;
- preflight script;
- обновленные README/quickstart инструкции;
- стабильные build/run команды.

### Definition of Done

- `docker compose config -q` проходит;
- backend собирается без `EACCES`;
- storefront собирается при корректном `MEDUSA_BACKEND_URL`;
- новый разработчик может поднять проект по короткой инструкции;
- проект больше не зависит от ручного “разруливания” прав и портов при каждом старте.

### Контрольные риски

- не превратить фазу стабилизации в бессрочную инженерную уборку;
- не делать миграцию в workspace внутри этой фазы.

---

### Фаза 2. Шаблонный backend baseline вместо demo-baseline

### Цель

Заменить стартовую демо-модель Medusa на минимальный, но честный baseline будущего шаблона.

### Статус на 2026-04-17

Фаза подтверждена как завершенная для verified clean bootstrap path.

### Задачи

- убрать зависимость от демо-данных и европейского seed;
- пересобрать начальную инициализацию store:
  - store settings;
  - supported currencies;
  - supported locales;
  - default sales channel;
  - publishable API key;
  - хотя бы один рабочий region;
  - базовая складская и shipping-конфигурация для шаблона.
- привести baseline к российскому контуру:
  - `RUB` как обязательная валюта шаблона;
  - region для `RU`;
  - стартовые locale-коды, если подтверждено решение по translation flow;
  - шаблонные, а не демо-названия shipping methods.
- решить, какие клиентские данные для v1 хранятся в native store settings/metadata, а не в кастомных модулях.
- добавить bootstrap-сценарий, который создает baseline без ручной раскладки через Admin.
- отделить demo-артефакты от шаблонных:
  - удалить или архивировать то, что не должно жить в template release;
  - не хранить в основном рабочем контуре dump, привязанный к случайному локальному состоянию.

### Артефакты

- template seed/bootstrapping flow;
- документ “что создается в чистой базе автоматически”;
- список данных, которые считаются частью шаблона.

### Definition of Done

- чистая база может быть инициализирована без ручной настройки через админку;
- в baseline больше нет привязки к `Europe/EUR`;
- storefront получает корректный region и publishable key;
- шаблонный проект стартует как нейтральный RU-ready skeleton, а не как demo-store Medusa.

### Контрольные риски

- не тащить сюда еще реальные внешние интеграции;
- не раздувать baseline ненужными кастомными сущностями, если native Store/Metadata покрывают первую версию.

---

### Фаза 3. Архитектура интеграций и техническая верификация провайдеров

### Цель

Не “подключить все подряд”, а выбрать и подтвердить безопасный, поддерживаемый путь интеграций под шаблон.

### Статус на 2026-04-17

Фаза активна.

Уже подтверждено:
- notification slice v1 больше не находится на уровне выбора направления;
- в коде уже есть Notification Module, local provider для dev, `UniSender` path для production, provider-agnostic workflow, admin smoke route и opt-in helper для on-demand secret admin API key;
- `order lifecycle notifications v1` уже реализован как первый production-like customer-facing slice: subscriber [`orderPlacedNotificationHandler()`](../medusa-agency-boilerplate/src/subscribers/order-placed-notification.ts:5) слушает `order.placed`, workflow [`sendOrderPlacedNotificationWorkflow`](../medusa-agency-boilerplate/src/workflows/send-order-placed-notification.ts:308) работает по path `subscriber → workflow → Notification Module`, а canonical recipient в `v1` остается `order.email` без fallback chain;
- `order lifecycle notifications hardening v1.1` синхронизирован как действующий operational contract: dedupe authority = existing notification storage, strategy = query-before-create, canonical dedupe identity = `trigger_type + resource_type + resource_id + channel + template + normalized recipient`, duplicate suppression = controlled skip с diagnostics без второго notification, race window = accepted limitation;
- `UniSender email migration v1` уже реализован как завершённая замена transitional SendGrid bridge внутри email runtime, а confirmed clean onboarding и Phase 2 baseline после этого не были сломаны.

Текущий следующий трек:
- `storefront core baseline v1` уже закрыт как предыдущий repo-level шаг коммитом `6f9a5499e2c9fcf08e2e6d1fffa75f350e82f5bb`;
- `VK ID v1` уже закрыт как optional identity/linking track поверх реализованного VK transport коммитом `f48a02658d116a04afd794c1134ac72e0ab00bc8`;
- `MTS Exolve` уже закрыт как optional SMS track коммитом `b13f6fa93473bb8bc0320566a75d264d60739784` `feat(notification): add MTS Exolve SMS workstream`;
- `marketing layer v1` уже закрыт коммитом `a4711906b16523dcf03da9601ccf1a914702ca7d` `feat(marketing-layer): add marketing preferences and campaign workflows`:
  - metadata-first consent/preferences truth живет в [`MarketingPreferences`](../medusa-agency-boilerplate/src/modules/marketing-preferences.ts:37) внутри `customer.metadata.marketing`;
  - campaign and journal surface materialized в [`ensureMarketingLayerTables()`](../medusa-agency-boilerplate/src/modules/marketing-layer.ts:305);
  - launch semantics materialized в [`sendMarketingCampaignWorkflow`](../medusa-agency-boilerplate/src/workflows/send-marketing-campaign.ts:508) как single-channel campaign execution с frequency cap и journaled `sent/skipped/failed` outcomes;
  - store/admin/profile surfaces materialized в [`route.ts`](../medusa-agency-boilerplate/src/api/store/customers/me/marketing-preferences/route.ts), [`route.ts`](../medusa-agency-boilerplate/src/api/admin/marketing/campaigns/route.ts), [`route.ts`](../medusa-agency-boilerplate/src/api/admin/marketing/campaigns/[id]/route.ts) и [`ProfileMarketingPreferences`](../medusa-agency-boilerplate-storefront/src/modules/account/components/profile-marketing-preferences/index.tsx:92);
  - validation and review outcome зафиксированы как backend typecheck PASS, storefront typecheck PASS, targeted tests `1` suite / `6` tests PASS и verdict `approve`, с non-blocker notes по admin `PUT` query ergonomics и manual URL parsing в dynamic route;
  - per-campaign `POST /admin/marketing/campaigns/:id` удерживается как честный bodyless action endpoint для launch, без фиктивного `launch` flag в body-contract;
- `Payload CMS v1 как content layer маркетинговых страниц` уже закрыт коммитом [`22486388f4c89d884b4c3cbe668ebec4ab695dee`](../package.json:1) `feat(content): add Payload CMS marketing content layer`:
  - отдельный app [`payload-cms`](../payload-cms) materialized как first-class headless content service рядом с Medusa;
  - storefront integration materialized через content-provider boundary, block rendering, preview/revalidate flow, globals и fallback behaviour для commerce-only режима;
  - root orchestration layer теперь включает payload scripts [`payload:dev`](../package.json:22), [`payload:build`](../package.json:23), [`payload:start`](../package.json:24), [`payload:types`](../package.json:25), [`payload:importmap`](../package.json:26), env sync для payload app и blocker-fix через нормализацию `NODE_ENV` в [`scripts/payload-run.sh`](../scripts/payload-run.sh:28);
  - финальный validation state зафиксирован как PASS по [`payload:types`](../package.json:25), [`payload:importmap`](../package.json:26) и [`payload:build`](../package.json:23), а final review verdict = approveable без blocking findings для commit;
  - residual observations остаются только non-blocking:
    - post-review hardening закрыл preview access gap для draft globals и подписал preview-exit path; эта зона больше не считается открытым residual security note.
- storefront build hardening перед `Фазой 6` дополнительно закрыт: SSG `generateStaticParams()` для categories, collections и products build-safe и больше не требуют живой backend во время `next build`.
- workstream [`Preset-driven landing-surface contract v1`](../plans/preset-driven-landing-surface-contract-v1.md) уже закрыт коммитом `7e3266c1478ab81f4f6748d6ee6fa5612cf3eecd` `feat(storefront): add preset-driven landing surface contract`:
  - цель slice — нормализовать preset-driven landing customization в typed registry внутри [`storefront-client-config.ts`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts) и убрать drift к template-level branching;
  - sanctioned landing contract теперь покрывает `home` sections, `collectionLanding`, `contentPage` и `postPage`, а общий resolver boundary материализован в [`landing-surface-resolver.ts`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/landing-surface-resolver.ts);
  - shared templates [`index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/collections/templates/index.tsx), [`content-page.tsx`](../medusa-agency-boilerplate-storefront/src/modules/content/templates/content-page.tsx) и [`post-page.tsx`](../medusa-agency-boilerplate-storefront/src/modules/content/templates/post-page.tsx) сохранены как thin sanctioned mount points без preset branching;
  - validation and review outcome зафиксированы как storefront typecheck PASS, storefront build PASS, diff hygiene PASS, controlled static params и Store API fallback warnings accepted as non-blocking, final review verdict = approveable без blocking findings;
  - implementation-level guardrails закреплены: единственный env switch остаётся [`NEXT_PUBLIC_STOREFRONT_PRESET`](../medusa-agency-boilerplate-storefront/src/lib/env.ts:21), locked commerce core не тронут, Store API/data contracts не менялись, rollout третьего preset не входил в scope.
- adjacent Phase 6 slice [`adjacent-preset-rollout-product-support-highlights.md`](../plans/adjacent-preset-rollout-product-support-highlights.md) теперь тоже закрыт коммитом [`8c5451e854c31671e088110670879f69c895e4cf`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:181) `feat(storefront): roll out typed productSurfaces supportHighlights preset contract`:
  - цель slice — продвинуть sanctioned preset contract от typed [`landingSurfaces`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:249) к adjacent typed product display surface [`productSurfaces.supportHighlights`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:207) без новых runtime selectors и без дрейфа к shared-template branching;
  - product page теперь использует typed resolver boundary [`resolveProductSupportHighlightsSurface()`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/product-surface-resolver.ts:14) и display component [`ProductSupportHighlights`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/product-support-highlights/index.tsx:16) как sanctioned extension рядом с landing surfaces;
  - shared [`ProductTemplate`](../medusa-agency-boilerplate-storefront/src/modules/products/templates/index.tsx:23) сохранён как thin mount point без preset branching, а один sanctioned runtime selector по-прежнему [`NEXT_PUBLIC_STOREFRONT_PRESET`](../medusa-agency-boilerplate-storefront/src/lib/env.ts:21);
  - validation, review и closure зафиксированы как [`npx tsc --noEmit`](../medusa-agency-boilerplate-storefront/package.json) PASS, [`npm run build`](../medusa-agency-boilerplate-storefront/package.json:12) PASS, [`git diff --check`](../.gitignore) PASS, review verdict = APPROVE, blocking issues = none, non-blocking observations = none.
- listing/card Phase 6 slice [`preset-driven-listing-surface-contract-v1.md`](../plans/preset-driven-listing-surface-contract-v1.md) тоже закрыт коммитом [`9b378f5af3d84a76545413a34c45d68b1bab8286`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:258) `feat(storefront): roll out typed preset-driven listing surface contract`:
  - цель slice — продвинуть storefront customization от runtime selector [`NEXT_PUBLIC_STOREFRONT_PRESET`](../medusa-agency-boilerplate-storefront/src/lib/env.ts:21), typed [`landingSurfaces`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:273) и adjacent typed [`productSurfaces.supportHighlights`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:231) к typed listing/card contract [`listingSurfaces.productCard`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:258) без новых selectors и без template forks;
  - contract materialized как semantic typed boundary с variants `default|featured`, thin resolver exports [`resolveDefaultProductCardSurface()`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/listing-surface-resolver.ts:14) / [`resolveFeaturedProductCardSurface()`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/listing-surface-resolver.ts:17) и preset-owned presentation consumer [`ProductCardSurface`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/product-card-surface.tsx:55);
  - shared [`ProductPreview`](../medusa-agency-boilerplate-storefront/src/modules/products/components/product-preview/index.tsx:9) сохранён как thin shared boundary, preset branching не размазан по catalog/card path, а raw Tailwind/class-string config не допускается внутрь contract;
  - validation, review и closure зафиксированы как [`npx tsc --noEmit`](../medusa-agency-boilerplate-storefront/package.json) PASS, [`npm run build`](../medusa-agency-boilerplate-storefront/package.json:12) PASS, [`git diff --check`](../.gitignore) PASS, review verdict = APPROVE, blocking issues = none, non-blocking observations = none.
- global-shell Phase 6 slice [`preset-driven-global-shell-contract-v1.md`](../plans/preset-driven-global-shell-contract-v1.md) теперь тоже закрыт коммитом [`4ffc410180bf6d7084d8616713e62b1d51ed7779`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:74) `feat(storefront): roll out typed preset-driven global shell contract`:
  - цель slice — продвинуть storefront customization от runtime selector [`NEXT_PUBLIC_STOREFRONT_PRESET`](../medusa-agency-boilerplate-storefront/src/lib/env.ts:21), typed [`landingSurfaces`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:317), adjacent typed [`productSurfaces.supportHighlights`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:323) и typed listing/card contract [`listingSurfaces.productCard`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:324) к typed global shell surfaces в [`StorefrontShellConfig`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:74) без новых selectors и без shell-level template forks;
  - contract materialized как bounded presentation-only shell boundary с typed surfaces [`shell.nav`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:75), [`shell.sideMenu`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:76) и [`shell.footer`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:77), thin resolver exports [`resolveNavShellSurface()`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/shell-surface-resolver.ts:15), [`resolveSideMenuShellSurface()`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/shell-surface-resolver.ts:18), [`resolveFooterShellSurface()`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/shell-surface-resolver.ts:21) и thin seam [`RootLayout`](../medusa-agency-boilerplate-storefront/src/app/layout.tsx:14);
  - implementation-level guardrails закреплены: единственный env switch остаётся [`NEXT_PUBLIC_STOREFRONT_PRESET`](../medusa-agency-boilerplate-storefront/src/lib/env.ts:21), semantic shell contract не допускает raw Tailwind/class-string config, [`nav/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/layout/templates/nav/index.tsx:17), [`footer/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/layout/templates/footer/index.tsx:12) и [`side-menu/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/layout/components/side-menu/index.tsx:50) не содержат preset-name branching, а locked commerce core, Store API/data contract и checkout/account/order scope не менялись;
  - validation, review и closure зафиксированы как [`npx tsc --noEmit`](../medusa-agency-boilerplate-storefront/package.json) PASS, [`npm run build`](../medusa-agency-boilerplate-storefront/package.json:12) PASS, [`git diff --check`](../.gitignore) PASS, review verdict = APPROVE, blocking issues = none, non-blocking observations = none.
- catalog-shell Phase 6 slice [`preset-driven-catalog-shell-contract-v1.md`](../plans/preset-driven-catalog-shell-contract-v1.md) теперь тоже закрыт коммитом [`c7d101ea506a6602e085be2aaaab5e1b20afac28`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:325) `feat(storefront): roll out typed preset-driven catalog shell contract`:
  - цель slice — продвинуть storefront customization от runtime selector [`NEXT_PUBLIC_STOREFRONT_PRESET`](../medusa-agency-boilerplate-storefront/src/lib/env.ts:21), typed [`landingSurfaces`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:317), adjacent typed [`productSurfaces.supportHighlights`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:323), typed listing/card contract [`listingSurfaces.productCard`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:324) и typed global shell surfaces в [`StorefrontShellConfig`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:74) к typed browse-framing contract [`StorefrontCatalogShellConfig`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:298) без новых selectors и без browse-template forks;
  - contract materialized как bounded presentation-only catalog shell boundary с surfaces [`catalogShell.store.intro`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:300), [`catalogShell.store.results`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:301), [`catalogShell.collection.results`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:304) и [`catalogShell.featuredRail`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:306), thin resolver exports [`resolveStoreCatalogIntroSurface()`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/catalog-shell-resolver.ts:15), [`resolveStoreCatalogResultsSurface()`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/catalog-shell-resolver.ts:18), [`resolveCollectionCatalogResultsSurface()`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/catalog-shell-resolver.ts:21), [`resolveFeaturedRailCatalogShellSurface()`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/catalog-shell-resolver.ts:24) и presentation-only consumers [`StoreCatalogIntroSurface`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/catalog-shell-surface.tsx:51), [`CatalogResultsShellSurface`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/catalog-shell-surface.tsx:104), [`FeaturedRailCatalogShellSurface`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/catalog-shell-surface.tsx:130);
  - thin shared browse seams сохранены в [`store/templates/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/store/templates/index.tsx), [`collections/templates/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/collections/templates/index.tsx) и [`product-rail/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/home/components/featured-products/product-rail/index.tsx), preset branching не размазан по shared browse path, а locked commerce core, Store API/data contract и query logic не менялись.
- truthful Phase 6 closure narrative после catalog-shell closure должен читаться не как straight-line close, а как `close → valid reopen → remediation → truthful re-close`:
  - прежний closure verdict был overstated и позже пересмотрен после post-slice review;
  - central selector/config authority не менялись и по-прежнему ограничены [`NEXT_PUBLIC_STOREFRONT_PRESET`](../medusa-agency-boilerplate-storefront/src/lib/env.ts:21) и [`storefront-client-config.ts`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts);
  - reopening был признан валидным по трём gap'ам: related products вне sanctioned listing surface contract, category browse route вне sanctioned [`catalogShell`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:325) contour и loading/skeleton state вне card/listing contract;
  - remediation по category browse contour закрыт коммитом `adb8df25ed64d9540e36588ee91dc5ff24951009` `fix(storefront): route category browse through catalogShell contour`;
  - remediation по related products rail закрыт коммитом `275dc4d823b8203bd1d49364ba4d02211bf42799` `fix(storefront): move related products to sanctioned listing surface contract`;
  - remediation по loading/skeleton sync закрыт коммитом `97a4837c483b054d25511f216ee487bf150306b4` `fix(storefront): align skeleton loading states with card surface contract`.
- post-remediation cross-preset regression/readiness checkpoint теперь и является каноническим closure marker для всей `Фазы 6`: preset matrix `atelier|market`, category browse routed через sanctioned `catalogShell`, related products rail routed через sanctioned listing surface contract, loading/skeleton state синхронизирован с sanctioned card/listing contract, cross-preset typecheck/build PASS, blocking issues = none.
- accepted non-blocking baseline observations для truthful re-closure ограничены controlled Store API warnings during static params generation; storefront [`npm run lint`](../medusa-agency-boilerplate-storefront/package.json:14) после remediation lint stack и hook-dependency cleanup проходит clean, и эти warnings не относятся к reopened gap'ам и не мешают closure.
- readiness verdict после post-remediation checkpoint теперь такой: **Фаза 6 storefront customization truthfully завершена и готова к следующему roadmap stage**; sequencing больше не должен описывать Phase 6 как текущий implementation track, но также не должен скрывать факт reopen/remediation перед финальным truthful closure.

### Задачи

- сформировать интеграционную матрицу по трем направлениям:
  - уведомления;
  - оплата;
  - доставка.
- для каждого направления определить:
  - пригодность для типового магазина в РФ как первичный фильтр;
  - first-party path;
  - custom provider path;
  - community package path, если он существует и проходит проверку;
  - требования к env;
  - требования к webhook;
  - требования к sandbox/testing;
  - требования к обработке отказов и повторов.
- для уведомлений:
  - использовать официально подтвержденный паттерн Notification Module Provider как основу архитектуры;
  - следующий communication expansion трактовать как `VK Community Messaging` внутри того же Notification Module, а не как ad-hoc direct API integration;
  - для первого VK rollout переиспользовать existing service lifecycle trigger sources `order.placed`, `shipment.created`, `order.canceled`;
  - не делать `VK ID` prerequisite для запуска VK transport: identity-linking идёт отдельным последующим треком;
  - выбрать dev-provider и production path.
- для платежей:
  - использовать официально подтвержденный паттерн Payment Module Provider как основу архитектуры;
  - не подменять market-fit критерием `лучше документирован у Medusa`;
  - продолжать текущий YooKassa-first path и подтвердить его для нужного рынка через POC/runtime validation.
- для доставки:
  - использовать пригодность для РФ как главный критерий отбора;
  - по умолчанию идти в ApiShip-first исследование и validation track;
  - зафиксировать, будет ли это custom module/provider, адаптер к внешнему API или проверенный внешний пакет;
  - отдельно подтвердить получение тарифов, выбор ПВЗ, создание отправления, webhook/status update.
- для каждого кандидата выполнить техническую верификацию:
  - совместимость с текущей версией Medusa;
  - активность поддержки;
  - лицензия;
  - тестовый аккаунт;
  - webhook flow;
  - refund/cancel/retry сценарии;
  - idempotency и auditability.

### Артефакты

- integration decision record по каждому направлению;
- POC-отчеты;
- таблица env и секретов;
- список approved и rejected решений.

### Definition of Done

- по каждому из трех направлений выбран ровно один путь первой версии;
- выбранные payment и shipping пути пригодны для типового магазина в РФ, а не только технически совместимы с Medusa;
- ни один неутвержденный пакет не попал в ядро шаблона;
- есть понятный production-owner path для поддержки выбранных интеграций.

### Контрольные риски

- не путать “найден npm пакет” с “утверждено для master repo”;
- не путать “лучше задокументировано в официальной Medusa docs” с “подходит для рынка этого шаблона”;
- не принимать бизнес-важную интеграцию без sandbox-проверки.

---

### Фаза 4. Реализация общего интеграционного контура

### Цель

Собрать единый рабочий контур реальных продаж, который одинаково нужен большинству будущих клиентов.

### Задачи

- расширить уже выбранный notification path после закрытого v1 slice:
  - dev mode;
  - production provider;
  - следующие order lifecycle notifications после `order.placed`;
  - error handling;
  - retry strategy.
- внедрить выбранный payment path:
  - provider registration;
  - checkout integration;
  - webhook handling;
  - status synchronization;
  - refund/cancel path;
  - failure path.
- внедрить выбранный delivery path:
  - тарифы;
  - выбор метода;
  - при необходимости выбор ПВЗ;
  - адресная логика;
  - служебные статусы;
  - синхронизация статусов.
- создать общие workflows/subscribers/API routes для интеграционного слоя;
- обеспечить, чтобы интеграции не были захардкожены в storefront;
- предусмотреть fallback для запуска клиентов без части интеграций:
  - ручной payment mode;
  - ручной shipping mode;
  - отключаемые channels/features.

### Артефакты

- production-ready integration layer;
- sandbox test cases;
- webhook documentation;
- env examples и onboarding notes для интеграций.

### Definition of Done

- можно пройти sandbox end-to-end сценарий:
  - каталог;
  - корзина;
  - checkout;
  - выбор доставки;
  - инициация оплаты;
  - обновление статуса;
  - уведомление;
  - order confirmation.
- все интеграции включаются конфигурацией, а не ручной правкой логики в нескольких местах;
- отключение провайдера не ломает весь проект.

### Контрольные риски

- не делать интеграции, завязанные на одного клиента;
- не пропустить сценарии `payment failed`, `order canceled`, `webhook retry`.

---

### Фаза 5. Общий storefront core и RU baseline

### Цель

Превратить текущий starter storefront в общий storefront core шаблона.

### Подтвержденный design scope для `storefront core baseline v1`

В этот workstream входят только shared storefront concerns, которые уже опираются на подтвержденный backend/runtime baseline:

- shopper-facing shell и commerce entrypoints: home, catalog, category, collection, product, cart, checkout, account, confirmed order и shared layout surfaces;
- runtime/config слой storefront: env example, storefront config, backend client config, middleware, region/locale helpers;
- shared customer-facing copy и metadata для RU-neutral baseline;
- provider-aware storefront presentation только для уже подтвержденных integration inputs:
  - YooKassa-first checkout path;
  - manual fallback;
  - optional Stripe-compatible reference adapter при наличии соответствующего backend provider;
  - ApiShip `cheapest_only_v1` delivery semantics;
- starter/demo/admin-onboarding cleanup в shopper-visible surfaces и storefront docs.

### Что закрываем в первую очередь

- shopper-visible starter branding и Medusa CTA не должны оставаться в shared shell;
- demo/onboarding CTA и admin-setup links не должны продолжать жить в customer-facing pages;
- README storefront не должен описывать текущий repo как generic Medusa starter со Stripe-first narrative;
- region/default behavior должен быть унифицирован вокруг template-safe config, без скрытого возврата к demo fallbacks;
- optional Stripe-compatible path не должен выглядеть как baseline requirement для РФ-oriented template.

### Задачи

- убрать визуальные и текстовые хвосты starter-проекта:
  - Medusa branding;
  - starter headlines;
  - демонстрационные CTA;
  - shopper-visible onboarding/admin setup prompts;
  - тексты, не относящиеся к шаблону.
- привести storefront к конфигурируемому region/locale поведению:
  - удерживать default region через storefront env/config;
  - унифицировать region fallback semantics между middleware и data layer;
  - подтвердить baseline-safe поведение при наличии template region;
  - сохранить optional locale-handling совместимым с store locales без превращения translation layer в prerequisite.
- привести shared customer-facing copy к нейтральной русской базе:
  - home;
  - account;
  - cart;
  - checkout;
  - order;
  - navigation;
  - footer.
- сделать storefront provider-aware:
  - payment step не должен оставаться заточенным под один стартовый сценарий без адаптационного слоя;
  - delivery UI должен быть совместим с выбранным интеграционным путем;
  - existing backend provider IDs и checkout contracts считаются достаточными input и не требуют нового API слоя.
- внедрить и синхронизировать базовый storefront-config слой:
  - название магазина;
  - контакты;
  - SEO defaults;
  - social/policy links;
  - feature-level assumptions для shared storefront.
- удержать env/runtime assumptions минимальными:
- baseline storefront env = `MEDUSA_BACKEND_URL`, `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`, `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_DEFAULT_REGION`, а `NEXT_PUBLIC_STOREFRONT_PRESET` допускается как optional Phase 6 preset-switch;
  - `NEXT_PUBLIC_YOOKASSA_ENABLED` остаётся opt-in public flag;
  - Stripe-compatible public vars допускаются только как optional compatibility path;
  - новые public secrets для `VK`, `Payload` или соседних tracks не вводятся.
- настроить базовую доступность и адаптивность shared-commerce страниц.

### Required implementation areas

- `medusa-agency-boilerplate-storefront/src/lib/storefront-config.ts`
- `medusa-agency-boilerplate-storefront/.env.local.example`
- `medusa-agency-boilerplate-storefront/src/lib/config.ts`
- `medusa-agency-boilerplate-storefront/src/middleware.ts`
- `medusa-agency-boilerplate-storefront/src/lib/data/regions.ts`
- `medusa-agency-boilerplate-storefront/src/lib/data/locales.ts`
- main shell, home, nav, footer and country selection surfaces
- checkout payment/shipping presentation layer
- customer-facing onboarding/demo leftovers
- storefront README and onboarding notes

### Артефакты

- storefront core без shopper-visible starter-branding;
- RU baseline copy;
- storefront runtime config;
- общий набор commerce pages;
- design-synced storefront onboarding/docs notes;
- validation checklist для implementation pass.

### Validation strategy

- статическая проверка shopper-facing entrypoints на отсутствие `demo`, `onboarding`, admin setup CTA и starter-branding там, где это больше не часть baseline;
- regression review для home, catalog, product, cart, checkout, account и confirmed order surfaces;
- отдельная проверка region switching и optional locale fallback semantics;
- отдельная проверка того, что YooKassa-first checkout path и ApiShip `cheapest_only_v1` semantics не ломаются storefront cleanup-изменениями;
- storefront build/lint/runtime smoke остаются implementation-stage validation surface, но не превращают workstream в новый integration track.

### Definition of Done

- storefront больше не выглядит как демо Medusa;
- storefront собирается и работает против template backend;
- shared pages пригодны для дальнейшего брендирования без переписывания commerce-flow;
- region и locale не захардкожены в демо-значения;
- starter docs и shopper-facing onboarding drift устранены на baseline-уровне.

### Контрольные риски

- не смешать общий storefront core с клиентским визуальным дизайном;
- не вносить в shared-layer случайный контент конкретного клиента;
- не расширить текущий scope до новых backend APIs, `VK ID`, `MTS Exolve`, Payload, marketing pages или multi-quote shipping UX.

### Non-goals

- клиентское брендирование, theme system и дизайн-пакеты под отдельного заказчика;
- новые payment или shipping providers;
- новый notification scope;
- deep translation-management layer;
- marketing/content implementation до старта отдельной фазы Payload.

---

### Фаза 5.5. Payload CMS v1 как content layer маркетинговых страниц

### Статус

Завершено и закоммичено как [`22486388f4c89d884b4c3cbe668ebec4ab695dee`](../package.json:1) `feat(content): add Payload CMS marketing content layer`.

### Что было целью

Добавить в шаблон отдельный content layer для marketing pages, news и editorial-контента, не ломая единый commerce-core storefront.

### Ключевое проектное решение

Payload внедрён после того, как storefront был приведён к состоянию общего storefront core.

Мы не делали:
- payload как часть Medusa backend;
- payload как источник правды для товаров, цен, остатков и checkout;
- payload как тяжелый no-code page builder в первой версии.

Что materialized в закрытом workstream:
- отдельное приложение [`payload-cms`](../payload-cms);
- ограниченный и типизированный набор marketing blocks;
- preview / drafts / revalidation flow;
- storefront integration через content-provider boundary;
- globals для `navigation`, `footer`, `site settings` и fallback behaviour для commerce-only режима;
- root orchestration scripts и env sync для payload runtime.

### Что зафиксировано как реализованное

- отдельный app [`payload-cms`](../payload-cms) заведён в репозитории как first-class content service;
- storefront content integration materialized: marketing и informational routes читают данные из Payload, storefront рендерит blocks через единый renderer, а commerce pages остаются на Medusa data layer;
- editorial workflow v1 materialized: drafts, preview, publish flow и revalidation path после публикации;
- fallback strategy materialized: шаблон сохраняет базовый commerce-only запуск без обязательного поднятия Payload;
- root orchestration layer синхронизирован с Payload через scripts [`payload:dev`](../package.json:22), [`payload:build`](../package.json:23), [`payload:start`](../package.json:24), [`payload:types`](../package.json:25), [`payload:importmap`](../package.json:26), а blocker `Html should not be imported outside of pages/_document` закрыт нормализацией `NODE_ENV` в [`scripts/payload-run.sh`](../scripts/payload-run.sh:28).

### Validation и review outcome

- [`payload:types`](../package.json:25) — PASS;
- [`payload:importmap`](../package.json:26) — PASS;
- [`payload:build`](../package.json:23) — PASS;
- final review verdict — approveable;
- blocking findings для commit отсутствуют.

### Residual non-blocking observations

- residual preview security notes после review больше не остаются открытыми: globals перешли на preview-aware published access, storefront больше не отправляет `overrideAccess`, а preview-exit теперь требует валидную подпись и для `GET`, и для `POST`.

### Итог фазы

- storefront умеет рендерить marketing page из Payload по `slug`;
- опубликованный контент попадает на фронт через подтвержденный publish/revalidate path;
- marketing blocks работают без копирования товарной правды в Payload;
- Payload не ломает базовый commerce-only запуск шаблона;
- есть минимально достаточный редакторский контур для маркетинговых страниц, новостей и globals.

### Что дальше

Следующий roadmap step после закрытия `Payload CMS v1` — [`Фаза 6. Путь к индивидуальному дизайну и управляемой кастомизации фронта`](./master_repo_plan_v2.md#фаза-6-путь-к-индивидуальному-дизайну-и-управляемой-кастомизации-фронта).

---

### Фаза 6. Путь к индивидуальному дизайну и управляемой кастомизации фронта

### Статус

Truthfully closed after valid reopen and remediation: all sanctioned base slices delivered, three reopened gaps remediated, post-remediation cross-preset regression PASS, readiness checkpoint recorded.

### Цель

Создать такой фронтовый слой, при котором новый магазин можно заметно кастомизировать визуально, не разрывая общий торговый контур.

### Ключевое проектное решение

В первой версии мы **не делаем несколько полноценных шаблонов фронта**.

Мы делаем:
- один storefront core;
- один design token layer;
- один слой клиентской конфигурации;
- один механизм секций и переиспользуемых блоков;
- точечные client overrides.

### Задачи

- определить уровни фронтовой кастомизации:
  - уровень 1: брендинг;
  - уровень 2: вариации layout/sections;
  - уровень 3: клиентские page overrides.
- вынести в theme/config слой:
  - colors;
  - typography;
  - spacing;
  - border radius;
  - button styles;
  - card styles;
  - nav/footer variants.
- создать систему управляемых секций для homepage и landing pages:
  - hero;
  - featured collections;
  - text-image sections;
  - trust blocks;
  - FAQ;
  - custom promo blocks.
- определить допустимые override surfaces:
  - homepage;
  - collection landing;
  - product page blocks;
  - informational pages.
- отдельно закрепить, что остается общим всегда:
  - cart;
  - checkout;
  - account;
  - order flow;
  - API/data layer;
  - region/locale layer;
  - provider integration layer.
- предусмотреть путь для премиального клиента:
  - допускается отдельный storefront-проект поверх общей commerce-логики;
  - но это не должно быть частью шаблона v1.

### Артефакты

- theme token system;
- storefront client config schema;
- section registry;
- guideline “что меняется под клиента, а что считается core”.

### Что уже materialized в текущем slice

- отдельный client customization contract заведён в [`storefront-client-config.ts`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:265): theme tokens, typed shell surfaces в [`StorefrontShellConfig`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:74), typed homepage sections, typed [`landingSurfaces`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:273), typed adjacent [`productSurfaces.supportHighlights`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:231), typed listing/card contract [`listingSurfaces.productCard`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:258), explicit `customizable/coreLocked` policy, anti-fork guardrails и sanctioned preset catalog `atelier|market`;
- env-driven preset switch materialized в [`env.ts`](../medusa-agency-boilerplate-storefront/src/lib/env.ts:14) и [`medusa-agency-boilerplate-storefront/.env.local.example`](../medusa-agency-boilerplate-storefront/.env.local.example): [`NEXT_PUBLIC_STOREFRONT_PRESET`](../medusa-agency-boilerplate-storefront/src/lib/env.ts:21) переключает client scenario без изменения commerce core и остаётся единственным sanctioned runtime selector;
- storefront root layout и [`globals.css`](../medusa-agency-boilerplate-storefront/src/styles/globals.css) теперь читают CSS variables из этого слоя, а [`RootLayout`](../medusa-agency-boilerplate-storefront/src/app/layout.tsx:14) остаётся thin seam, который публикует shell data attributes без direct preset branching;
- homepage больше не зашит как fixed `Hero + FeaturedProducts`, а рендерится через typed section registry [`HomeSectionRenderer`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/home-section-renderer/index.tsx);
- workstream [`Preset-driven landing-surface contract v1`](../plans/preset-driven-landing-surface-contract-v1.md) уже materialized и закрыт коммитом `7e3266c1478ab81f4f6748d6ee6fa5612cf3eecd` `feat(storefront): add preset-driven landing surface contract`;
- adjacent product display rollout [`adjacent-preset-rollout-product-support-highlights.md`](../plans/adjacent-preset-rollout-product-support-highlights.md) уже materialized и закрыт коммитом [`8c5451e854c31671e088110670879f69c895e4cf`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:323) `feat(storefront): roll out typed productSurfaces supportHighlights preset contract`;
- listing/card rollout [`preset-driven-listing-surface-contract-v1.md`](../plans/preset-driven-listing-surface-contract-v1.md) уже materialized и закрыт коммитом [`9b378f5af3d84a76545413a34c45d68b1bab8286`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:324) `feat(storefront): roll out typed preset-driven listing surface contract`;
- global-shell rollout [`preset-driven-global-shell-contract-v1.md`](../plans/preset-driven-global-shell-contract-v1.md) уже materialized и закрыт коммитом [`4ffc410180bf6d7084d8616713e62b1d51ed7779`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:74) `feat(storefront): roll out typed preset-driven global shell contract`;
- catalog-shell rollout [`preset-driven-catalog-shell-contract-v1.md`](../plans/preset-driven-catalog-shell-contract-v1.md) уже materialized и закрыт коммитом [`c7d101ea506a6602e085be2aaaab5e1b20afac28`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:325) `feat(storefront): roll out typed preset-driven catalog shell contract`;
- collection landing, informational content page и editorial post больше не должны описываться как разрозненные variant-aware headers или только slot-driven framing: они materialized как section-based preset composition для `collectionLanding`, `contentPage` и `postPage` через [`landing-surface-resolver.ts`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/landing-surface-resolver.ts), [`collection-landing-surface/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/collection-landing-surface/index.tsx), [`content-page-surface/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/content-page-surface/index.tsx) и [`post-page-surface/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/post-page-surface/index.tsx), а homepage удержан как `home` sections member того же registry;
- product page теперь читает adjacent display-only surface через [`product-surface-resolver.ts`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/product-surface-resolver.ts) и [`ProductSupportHighlights`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/product-support-highlights/index.tsx:16), а shared [`ProductTemplate`](../medusa-agency-boilerplate-storefront/src/modules/products/templates/index.tsx:23) остаётся thin sanctioned mount point без preset branching;
- listing/card path теперь читает typed display-only surface через resolver [`resolveDefaultProductCardSurface()`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/listing-surface-resolver.ts:14) / [`resolveFeaturedProductCardSurface()`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/listing-surface-resolver.ts:17), preset-owned consumer [`ProductCardSurface`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/product-card-surface.tsx:55) и shared [`ProductPreview`](../medusa-agency-boilerplate-storefront/src/modules/products/components/product-preview/index.tsx:9) как thin shared boundary;
- global shell path теперь читает typed display-only surfaces через [`shell-surface-resolver.ts`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/shell-surface-resolver.ts), а shared [`nav/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/layout/templates/nav/index.tsx:17), [`footer/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/layout/templates/footer/index.tsx:12) и [`side-menu/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/layout/components/side-menu/index.tsx:50) остаются thin sanctioned consumers без preset-name branching;
- catalog browse path теперь читает typed display-only shell surfaces через [`catalog-shell-resolver.ts`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/catalog-shell-resolver.ts), presentation consumers [`StoreCatalogIntroSurface`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/catalog-shell-surface.tsx:51), [`CatalogResultsShellSurface`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/catalog-shell-surface.tsx:104), [`FeaturedRailCatalogShellSurface`](../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/catalog-shell-surface.tsx:130) и thin shared seams [`store/templates/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/store/templates/index.tsx), [`collections/templates/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/collections/templates/index.tsx), [`product-rail/index.tsx`](../medusa-agency-boilerplate-storefront/src/modules/home/components/featured-products/product-rail/index.tsx);
- implementation-level guardrails подтверждают один env switch [`NEXT_PUBLIC_STOREFRONT_PRESET`](../medusa-agency-boilerplate-storefront/src/lib/env.ts:21), неизменный commerce core и неизменный Store API/data contract; semantic contract для [`listingSurfaces.productCard`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:324), [`StorefrontShellConfig`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:74) и [`StorefrontCatalogShellConfig`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:298) не допускает raw Tailwind/class-string config, а preset branching не должен размазываться по shared catalog/card path, browse template tree или shell template tree;
- Definition-of-Done marker `как минимум два разных клиентских оформления на одном storefront core` уже materialized дальше landing-only scope: `atelier` и `market` читаются из одного config contract и теперь разделяют normalized landing-surface contract, adjacent typed product display surface contract, typed listing/card contract, typed global shell contract и typed catalog shell contract;
- truthful closure `Phase 6` нужно читать как последовательность `initial closure claim → valid reopen → remediation → post-remediation closure checkpoint`, а не как будто catalog-shell close автоматически закрыл весь remaining scope;
- reopened gaps зафиксированы явно и больше не скрываются в narrative:
  - related products rail был вне sanctioned listing surface contract до remediation-коммита `275dc4d823b8203bd1d49364ba4d02211bf42799` `fix(storefront): move related products to sanctioned listing surface contract`;
  - category browse route был вне sanctioned [`catalogShell`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:325) contour до remediation-коммита `adb8df25ed64d9540e36588ee91dc5ff24951009` `fix(storefront): route category browse through catalogShell contour`;
  - loading/skeleton state был не синхронизирован с sanctioned card/listing contract до remediation-коммита `97a4837c483b054d25511f216ee487bf150306b4` `fix(storefront): align skeleton loading states with card surface contract`.
- validation и closure `Phase 6` теперь зафиксированы канонически именно post-remediation matrix-level regression checkpoint: final cross-preset pass = **PASS** для preset'ов `atelier|market`; category browse, related products rail и loading/skeleton contract после remediation подтверждены как routed/aligned через sanctioned preset-driven surfaces; cross-preset typecheck/build завершились успешно; blocking issues = none.
- accepted non-blocking baseline observations для этого финального checkpoint зафиксированы явно и не считаются blockers `Фазы 6`:
  - build warnings про Store API during static params generation, соответствующие baseline в [`template_readiness_regression.md`](./template_readiness_regression.md) и не относящиеся к reopened gap'ам.

### Что ещё остаётся незакрытым после этой фазы

- внутри `Фазы 6` открытых implementation slices больше нет: sanctioned preset selector, landing surfaces, adjacent product support highlights, listing surfaces, global shell и catalog shell закрыты и синхронизированы как один preset-driven stack;
- следующий roadmap step теперь лежит уже вне `Фазы 6`: **Фаза 7** template/client packaging;
- после `Фазы 7` roadmap продолжает идти в **Фазу 8** с release-grade checks, CI, staging и production readiness.

### Definition of Done

- можно собрать как минимум два разных клиентских оформления на одном storefront core;
- при этом cart/checkout/account/order logic не дублируются;
- замена бренда и секций не требует ручной правки десятков shared-компонентов;
- типовой клиентский дизайн можно внедрять поверх core и content layer, а не через новый storefront “с нуля”.

### Контрольные риски

- не строить premature design system ради дизайна;
- не превращать каждую новую клиентскую витрину в скрытый форк core.

---

### Фаза 7. Шаблонизация и ускорение запуска нового клиента

### Цель

Превратить проект из “рабочего кода” в реальный репозиторий-шаблон.

### Задачи

- оформить шаблонную структуру нового клиента:
  - клиентская конфигурация;
  - env generation;
  - assets placeholders;
  - legal/contact placeholders;
  - storefront branding placeholders.
- внедрить один сценарий инициализации нового клиента:
  - создание нового project config;
  - генерация env-файлов;
  - первичная инициализация storefront-branding;
  - стартовый checklist.
- очистить template release от локальных и демо-следов:
  - случайные дампы;
  - временные ключи;
  - локальные состояния;
  - контент, не относящийся к шаблону.
- подготовить документацию запуска:
  - как создать магазин из шаблона;
  - что заменить обязательно;
  - что заменяется по желанию;
  - как подключать клиента к staging/prod.
- подготовить стратегию распространения шаблона:
  - GitHub Template;
  - приватный template repository;
  - внутренний starter distribution.

### Артефакты

- `tranche 1` уже materialized: canonical client init flow / contract baseline через [`Docs/client_init_contract.md`](./client_init_contract.md), [`package.json`](../package.json), [`.env.example`](../.env.example), [`medusa-agency-boilerplate/.env.template`](../medusa-agency-boilerplate/.env.template), [`medusa-agency-boilerplate-storefront/.env.local.example`](../medusa-agency-boilerplate-storefront/.env.local.example), [`Docs/env_contract.md`](./env_contract.md) и [`Docs/current_work.md`](./current_work.md);
- следующий tranche после этого baseline: template release checklist;
- onboarding doc для нового клиента;
- cleaned template branch/release.

### Definition of Done

- новый клиентский проект можно создать по стандартизированному сценарию;
- обязательные client-specific шаги перечислены явно;
- шаблон не содержит случайных демо-зависимостей;
- запуск нового проекта не требует “вспоминать, как мы делали в прошлый раз”.

### Статус после closure `tranche 1`

- `Phase 7 / tranche 1` `client-init contract and placeholder-safe template baseline` truthfully закрыт commit'ом `a96aa81adfd655ddda9b6fea03dacf61c3174737` `feat(template): add client-init contract baseline`;
- closure narrative не означает завершение всей `Фазы 7`: materialized только baseline contract/init slice;
- blocking inconsistency по storefront runtime keys `MEDUSA_BACKEND_URL`, `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_DEFAULT_REGION` закрыта truthful remediation к optional runtime semantics; повторный review verdict = **APPROVE**;
- следующий logical workstream внутри `Фазы 7` остаётся template release/onboarding/package slice.

### Контрольные риски

- не считать шаблонизацией обычный `cp -R`;
- не выпускать template release, пока не закрыты контрольные ворота предыдущих фаз.

---

### Фаза 8. Автоматические проверки, staging и production readiness

### Цель

Довести шаблон до состояния, в котором его можно безопасно тиражировать и выкатывать.

### Задачи

- ввести автоматические проверки:
  - backend build;
  - storefront build;
  - lint/typecheck при наличии;
  - HTTP smoke checks;
  - минимальный browser smoke flow.
- подготовить staging контур;
- описать и автоматизировать deploy path;
- для production использовать рекомендуемые Medusa infrastructure modules там, где это требуется:
  - Redis Event Module;
  - Redis Workflow Engine Module;
  - при необходимости Redis locking/caching для целевого режима развертывания.
- подготовить:
  - backup strategy;
  - restore test;
  - rollback plan;
  - webhook monitoring;
  - log/alert baseline.
- провести релизную проверку шаблона на чистом окружении.

### Артефакты

- CI pipeline;
- staging checklist;
- deploy and rollback docs;
- backup/restore instructions;
- release candidate checklist.

### Definition of Done

- CI подтверждает базовую техническую целостность шаблона;
- staging environment проходит end-to-end smoke flow;
- backup/restore сценарий проверен;
- production path не зависит от ручных неповторяемых действий.

### Контрольные риски

- не путать “локально работает” с “production-ready”;
- не выпускать шаблон без staging smoke и restore test.

---

## 10. Отдельный раздел: стратегия кастомного фронта

Этот раздел закрепляет согласованное видение фронта как части шаблона.

### 10.1. Что является общим фронтовым ядром

Общим считается:
- data layer;
- SDK/config layer;
- region/locale handling;
- catalog mechanics;
- cart mechanics;
- checkout mechanics;
- account area;
- order area;
- provider integration UI contracts;
- storefront block renderer and content-provider boundary;
- shared accessibility and SEO baseline.

### 10.2. Что должно быть клиентским

Клиентским считается:
- логотип и фирменные элементы;
- набор цветовых токенов и типографика;
- главная страница и ее композиция;
- marketing sections;
- promo blocks;
- editorial content;
- landing pages and news pages;
- часть визуальных паттернов карточек и листингов;
- контент и изображения;
- информационные страницы.

### 10.3. Уровни кастомизации

### Уровень A. Быстрый запуск

Меняется:
- бренд;
- токены;
- тексты;
- баннеры;
- порядок секций.

Не меняется:
- торговая логика;
- cart/checkout/account.

### Уровень B. Основной коммерческий сценарий

Меняется:
- главная;
- landing pages;
- часть product/collection presentation;
- branded UI blocks.

Не меняется:
- shared commerce core.

### Уровень C. Премиальная кастомизация

Можно менять:
- почти весь storefront UI.

Но остается общим:
- backend;
- API contracts;
- integration layer;
- общая торговая логика.

### 10.4. Что мы не делаем в v1

- не поддерживаем несколько полноценных front templates;
- не создаем theme marketplace внутри проекта;
- не строим тяжелый визуальный CMS-конструктор поверх Payload в первой версии;
- не допускаем uncontrolled forking storefront core под каждого клиента.

### 10.5. Когда можно вернуться к идее нескольких шаблонов фронта

Только после того, как:
- шаблон пройдет минимум несколько реальных запусков;
- повторятся одни и те же паттерны дизайна;
- станет ясно, что отдельные front archetypes реально экономят время, а не множат поддержку.

---

## 11. Контрольные ворота между фазами

### Gate A — после Фазы 1

Нельзя идти дальше, пока:
- сборки нестабильны;
- есть проблемы с правами;
- нет понятной стратегии env и портов.

### Gate B — после Фазы 2

Нельзя идти дальше, пока:
- baseline остается demo-oriented;
- storefront зависит от европейского/американского seed;
- baseline не инициализируется на чистой базе.

### Gate C — после Фазы 3

Нельзя идти дальше, пока:
- путь интеграций не верифицирован;
- нет sandbox;
- не выбран approved path по каждому направлению.

### Gate D — после Фазы 4

Нельзя идти дальше, пока:
- не работает один общий end-to-end commerce flow;
- интеграции не живут за конфигурируемым слоем.

### Gate E — после Фазы 5.5

Нельзя считать content layer готовым, пока:
- нет подтвержденного publish/revalidate path;
- storefront не умеет рендерить marketing pages из Payload;
- Payload дублирует товарную правду вместо ссылок на Medusa entities.

### Gate F — после Фазы 6

Нельзя считать проект шаблоном, пока:
- storefront нельзя уверенно брендировать без форка commerce-core;
- storefront и content layer нельзя уверенно брендировать без хаотичного переписывания shared-компонентов;
- нет проверенного пути клиентской кастомизации.

### Gate G — перед релизом шаблона

Нельзя выпускать template release, пока:
- не пройдены CI и staging checks;
- не проведен clean-clone запуск;
- не подтвержден backup/restore path.

---

## 12. Приоритеты реализации

### Must-have до первого клиентского запуска из шаблона

- Фаза 1;
- Фаза 2;
- Фаза 3;
- Фаза 4;
- Фаза 5;
- минимально достаточная часть Фазы 5.5, если в scope клиента входят marketing pages / news;
- минимально достаточная часть Фазы 6;
- минимально достаточная часть Фазы 7;
- базовые проверки из Фазы 8.

### Можно отложить до следующей волны

- Payload как расширенный content platform beyond pages/news/blocks v1;
- расширенный theme layer;
- сложный section builder;
- отдельные премиальные storefront patterns;
- расширенная automation beyond first template release.

---

## 13. Итоговое управленческое резюме

Этот проект не должен развиваться как “еще один кастомный магазин”.

Он должен развиваться как:
- общая торговая платформа;
- общий интеграционный контур;
- общий storefront core;
- управляемый клиентский слой;
- ускоритель запуска новых магазинов.

Ключевая дисциплина проекта:
- не тянуть в шаблон непроверенные интеграции;
- не смешивать client-specific и core-specific код;
- не считать “starter + ручные правки” полноценным репозиторием-шаблоном;
- двигаться по проверяемым воротам, а не по ощущениям.

Если соблюдать этот порядок, на выходе получится не просто рабочий Medusa-проект, а **производственный шаблон для агентского запуска магазинов**.

---

## 14. Правила ведения дорожной карты, документов и мастер-скилла

Этот раздел обязателен для проекта. Его цель — не допустить расхождения между фактическим состоянием репозитория, дорожной картой и “памятью команды”.

### 14.1. Канонический набор документов

В проекте фиксируется такой порядок источников правды:

1. `Docs/current_work.md`
   Канонический оперативный статус проекта. Здесь хранится:
   - что делаем прямо сейчас;
   - какая фаза активна;
   - где находится текущая рабочая поверхность;
   - в каком порядке агент должен продолжать работу с пустого контекста.
2. `Docs/master_repo_plan_v2.md`
   Главная дорожная карта проекта. Здесь хранится:
   - целевое состояние;
   - фазы;
   - контрольные ворота;
   - проектные решения;
   - правила обновления документов.
3. `Docs/plan_analysis.md`
   Аудит текущего состояния. Здесь хранится:
   - что реально подтверждено;
   - что завышено в старых документах;
   - какие блокеры и разрывы есть на текущий момент.
4. `.codex/skills/medusa-master-repo/SKILL.md`
   Быстрый ориентир для Codex. Здесь хранится:
   - куда смотреть в первую очередь;
   - какие документы считать основными;
   - какие факты уже известны;
   - что обновлять после изменений.
5. `Docs/master_repo_guide.md`
   Исторический и бизнесовый документ. Не считается главным источником статусов, пока специально не синхронизирован с `master_repo_plan_v2.md`.
6. `Docs/medusa_project_summary.md` и `Docs/Medusa.md`
   Фоновые и обзорные материалы. Используются как справка, а не как основной журнал проекта.
7. `Docs/env_contract.md`
   Рабочая спецификация env-слоев и root-команд запуска. Используется как техническая памятка по локальному циклу.

### 14.2. Когда обновление документов обязательно

Обновление `Docs/current_work.md` обязательно, если:
- изменилась активная фаза;
- стартовал новый конкретный рабочий трек;
- изменился ответ на вопрос "что делаем прямо сейчас";
- изменилась текущая рабочая поверхность;
- был снят или добавлен текущий блокер.

Обновление `Docs/master_repo_plan_v2.md` обязательно, если произошло хотя бы одно из событий:
- старт новой фазы;
- завершение фазы;
- изменение объема или порядка фаз;
- появление нового архитектурного решения;
- появление нового блокера;
- устранение блокера;
- подтверждение или отклонение интеграционного пути;
- изменение правил шаблонизации, rollout-порядка или фронтовой стратегии.

Обновление `Docs/plan_analysis.md` обязательно, если:
- какое-то утверждение аудита перестало быть правдой;
- был закрыт или, наоборот, найден крупный блокер;
- нужно переоценить, что реально сделано, а что нет;
- фактическое состояние проекта заметно изменилось.

Обновление `.codex/skills/medusa-master-repo/SKILL.md` обязательно, если:
- изменился набор основных документов;
- изменились роли документов;
- изменилась структура репозитория и агенту теперь нужно смотреть в другие места;
- изменился список уже подтвержденных фактов;
- добавились новые обязательные правила работы Codex в проекте.

Обновление `Docs/master_repo_guide.md` обязательно только если:
- мы сознательно хотим держать бизнесовый и презентационный документ в актуальном состоянии относительно основного плана.

### 14.3. Минимальный пакет обновлений после завершения значимой работы

После каждого значимого шага, который закрывает часть фазы или меняет состояние проекта, нужно минимум:

1. Обновить `Docs/current_work.md`:
   - что делаем сейчас;
   - активную фазу;
   - текущие блокеры;
   - рабочую поверхность этапа.
2. Обновить `Docs/master_repo_plan_v2.md`:
   - статус фазы или подпункта;
   - блокеры;
   - новые решения;
   - Definition of Done, если она изменилась.
3. Проверить, не устарел ли `Docs/plan_analysis.md`.
4. Проверить, не устарел ли `.codex/skills/medusa-master-repo/SKILL.md`.
5. Если изменилось внешнее позиционирование проекта, обновить `Docs/master_repo_guide.md`.

### 14.4. Обязательное правило завершения задачи

Задача, которая:
- меняет архитектуру;
- меняет статус фазы;
- снимает или создает блокер;
- добавляет новый источник правды;
- меняет путь запуска нового клиента;
- меняет стратегию кастомного фронта;

не считается полностью завершенной, пока не обновлены:
- текущий операционный статус;
- основной план;
- при необходимости аудит;
- при необходимости мастер-скилл Codex.

### 14.5. Практическое правило для агента

Если в коде и документах есть расхождение:
- код и проверенное состояние репозитория важнее;
- `current_work.md` обновляется под фактический текущий фокус;
- `master_repo_plan_v2.md` обновляется под реальность;
- `plan_analysis.md` корректируется как аудит;
- мастер-скилл обновляется, если это влияет на навигацию и правила работы агента.

## 15. Приложение: список основных источников

### Локальные источники

- `Docs/current_work.md`
- `Docs/env_contract.md`
- `Docs/plan_analysis.md`
- `Docs/master_repo_guide.md`
- `Docs/master_repo_plan_v2.md`
- `.codex/skills/medusa-master-repo/SKILL.md`
- `package.json`
- `scripts/`
- `docker-compose.yml:1-77`
- `medusa-agency-boilerplate/medusa-config.ts:1-17`
- `medusa-agency-boilerplate/src/scripts/seed.ts:66-320`
- `medusa-agency-boilerplate-storefront/.env.local:1-27`
- `medusa-agency-boilerplate-storefront/src/modules/home/components/hero/index.tsx:1-36`
- `medusa-agency-boilerplate-storefront/src/middleware.ts:4-159`

### Официальные материалы Medusa

- Medusa application configuration  
  https://docs.medusajs.com/learn/configurations/medusa-config
- Modules  
  https://docs.medusajs.com/learn/fundamentals/modules
- Workflows  
  https://docs.medusajs.com/learn/fundamentals/workflows
- Core workflows reference  
  https://docs.medusajs.com/resources/medusa-workflows-reference
- Use a publishable API key in the storefront  
  https://docs.medusajs.com/resources/storefront-development/publishable-api-keys
- Next.js Starter Storefront  
  https://docs.medusajs.com/resources/nextjs-starter
- Store locales  
  https://docs.medusajs.com/resources/commerce-modules/store/locales
- Redis Event Module  
  https://docs.medusajs.com/resources/infrastructure-modules/event/redis
- Redis Workflow Engine Module  
  https://docs.medusajs.com/resources/infrastructure-modules/workflow-engine/redis
- Stripe Module Provider  
  https://docs.medusajs.com/resources/commerce-modules/payment/payment-provider/stripe
- Local Notification Module Provider  
  https://docs.medusajs.com/resources/infrastructure-modules/notification/local
