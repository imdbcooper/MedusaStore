# Client Init Contract — Phase 7 tranche 1

> Статус: tranche `client-init contract and placeholder-safe template baseline` truthfully закрыт commit'ом `a96aa81adfd655ddda9b6fea03dacf61c3174737` `feat(template): add client-init contract baseline`.
>
> Цель: дать один канонический contract для инициализации нового клиента без reopening `Фазы 6 storefront customization`.
>
> Closure checkpoint: после materialization tranche 1 blocking inconsistency между docs / manifest / storefront runtime classification для `MEDUSA_BACKEND_URL`, `NEXT_PUBLIC_BASE_URL` и `NEXT_PUBLIC_DEFAULT_REGION` была закрыта truthful remediation к runtime semantics, где все три ключа canonical classified как optional; повторный review verdict = **APPROVE**.

---

## 1. Канонический entrypoint

Новый клиент теперь должен стартовать с одного entrypoint:

```bash
npm run client:init:contract
```

Этот entrypoint печатает contract из [`package.json`](../package.json) и ведёт к одному и тому же baseline path:

1. `npm run client:init:contract`
2. `cp .env.example .env`
3. заменить все `mandatory` placeholder values из этого документа
4. `npm run bootstrap`
5. `npm run preflight`
6. `npm run dev`

Guardrails:
- не переоткрывать `Фазу 6`;
- не менять sanctioned preset selector вне [`NEXT_PUBLIC_STOREFRONT_PRESET`](../medusa-agency-boilerplate-storefront/src/lib/env.ts:14);
- не обходить central preset authority вне [`storefrontClientConfig`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:1311);
- не смешивать этот contract с release CI/staging/prod-hardening из `Фазы 8`.

---

## 2. Правило классификации inputs

### Mandatory

`Mandatory` = без этого новый клиент не считается честно инициализированным для baseline review.

### Bootstrap-generated

`Bootstrap-generated` = значение не задаётся руками в template baseline и должно появиться только после успешного `npm run bootstrap`.

### Optional

`Optional` = пустое или default-safe значение не должно ломать clean-clone bootstrap, preflight, build baseline и storefront/backend startup.

---

## 3. Inventory client-specific inputs

### 3.1 Root orchestration surface — [`.env.example`](../.env.example)

| Input | Class | Rule |
| --- | --- | --- |
| `POSTGRES_PASSWORD` | Mandatory | Заменить placeholder перед первым bootstrap. |
| `JWT_SECRET` | Mandatory | Заменить placeholder перед первым bootstrap. |
| `COOKIE_SECRET` | Mandatory | Заменить placeholder перед первым bootstrap. |
| `POSTGRES_USER`, `POSTGRES_DB`, `POSTGRES_PORT`, `REDIS_PORT`, `MEDUSA_BACKEND_PORT`, `STOREFRONT_PORT`, `PAYLOAD_PORT` | Optional | Generic local defaults допустимы и не считаются client-specific residue. |
| `HOST_UID`, `HOST_GID` | Optional | Local workstation mapping; менять только при необходимости. |
| `NOTIFICATION_EMAIL_PROVIDER`, `NOTIFICATION_EMAIL_FROM` | Optional | Baseline-safe defaults допустимы; provider rollout остаётся opt-in. |
| `UNISENDER_*`, `NOTIFICATION_SMS_PROVIDER`, `MTS_EXOLVE_*`, `NOTIFICATION_VK_PROVIDER`, `VK_COMMUNITY_*`, `VK_ID_*`, `APISHIP_*`, `YOOKASSA_*` | Optional | Все integration/env switches остаются opt-in и не являются baseline requirement. |
| `PAYLOAD_ENABLED`, `PAYLOAD_CMS_URL` | Optional | Content layer по умолчанию disabled. |
| `PAYLOAD_CONTENT_PREVIEW_TOKEN`, `PAYLOAD_PREVIEW_SECRET`, `PAYLOAD_REVALIDATE_SECRET` | Optional | Заполнять только если включается content preview/revalidate path. |
| `MEDUSA_BACKEND_URL`, `STORE_CORS`, `ADMIN_CORS`, `AUTH_CORS`, `NOTIFICATION_SMOKE_*` | Optional | Имеют safe local defaults и не считаются обязательными client-specific replacements. |

### 3.2 Backend runtime mirror — [`medusa-agency-boilerplate/.env.template`](../medusa-agency-boilerplate/.env.template)

| Input | Class | Rule |
| --- | --- | --- |
| `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `COOKIE_SECRET`, notification/provider keys | Generated mirror | Этот слой materialized root sync path'ом; source of truth остаётся root `.env`. |
| Ручные client-specific edits в backend `.env.template` | Not allowed for init flow | Новый клиент не должен инициализироваться через ad-hoc правки backend env мимо root contract. |

### 3.3 Storefront env surface — [`medusa-agency-boilerplate-storefront/.env.local.example`](../medusa-agency-boilerplate-storefront/.env.local.example)

| Input | Class | Rule |
| --- | --- | --- |
| `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` | Bootstrap-generated | Должен оставаться `REPLACE_WITH_ROOT_BOOTSTRAP` в template baseline и записываться только успешным root bootstrap. |
| `MEDUSA_BACKEND_URL`, `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_DEFAULT_REGION` | Optional | Truthful storefront runtime inputs: [`env.ts`](../medusa-agency-boilerplate-storefront/src/lib/env.ts:4) даёт fallback'и `http://localhost:${MEDUSA_BACKEND_PORT \|\| 9000}`, `http://localhost:8000` и `ru`, поэтому canonical baseline остаётся placeholder-safe и не требует client-specific replacement. |
| `NEXT_PUBLIC_STOREFRONT_PRESET` | Optional | Единственный sanctioned preset switch. Допустимые значения: `atelier` или `market`. При отсутствии storefront fallback'ится к `atelier`. |
| `NEXT_PUBLIC_YOOKASSA_ENABLED`, `NEXT_PUBLIC_VK_ID_ENABLED`, `NEXT_PUBLIC_STRIPE_KEY`, `NEXT_PUBLIC_MEDUSA_PAYMENTS_*` | Optional | Public feature flags / provider toggles остаются opt-in. |
| `PAYLOAD_*`, `REVALIDATE_SECRET`, `MEDUSA_CLOUD_S3_*` | Optional | По умолчанию пустые template-safe placeholders без локальных/demo secrets. |

### 3.4 Branding / legal-contact surface — [`medusa-agency-boilerplate-storefront/src/lib/storefront-config.ts`](../medusa-agency-boilerplate-storefront/src/lib/storefront-config.ts)

| Field | Class | Rule |
| --- | --- | --- |
| `storefrontConfig.storeName` | Mandatory | Заменить template placeholder до отдельного review step. |
| `storefrontConfig.defaultTitle` | Mandatory | Заменить template placeholder до отдельного review step. |
| `storefrontConfig.defaultDescription` | Mandatory | Заменить template placeholder до отдельного review step. |
| `storefrontConfig.tagline` | Mandatory | Заменить template placeholder до отдельного review step. |
| `storefrontConfig.contact.email` | Mandatory | Должен стать реальным клиентским legal/contact email. |
| `storefrontConfig.contact.phone` | Mandatory | Должен стать реальным клиентским contact phone. |
| `storefrontConfig.socialLinks[*].href` | Mandatory | Telegram / VK / WhatsApp links не должны оставаться template placeholders перед review/release. |
| Остальной neutral storefront copy | Optional for tranche 1 | Может временно оставаться shared baseline, пока не начат отдельный client copy/content slice. |

### 3.5 Phase 6 preset authority — [`medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts)

| Surface | Class | Rule |
| --- | --- | --- |
| [`NEXT_PUBLIC_STOREFRONT_PRESET`](../medusa-agency-boilerplate-storefront/src/lib/env.ts:14) selector | Optional | Единственный sanctioned switch между preset scenarios. |
| [`storefrontPresetCatalog`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:407) | Locked authority | Не fork'ать shared templates и не выносить preset logic в ad-hoc client branches. |
| [`storefrontClientInitSurfaceContract`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:1269) | Contract artifact | Использовать как code-facing inventory для preset/runtime/branding boundaries storefront tranche 1. |

---

## 4. Placeholder policy

Template baseline теперь должен соблюдать такие правила:

- не хранить workstation-specific identity вроде `slavx` в template env;
- не хранить hard-coded demo/local secrets вроде `supersecret` в init-facing storefront env examples;
- не хранить реальный publishable key в template baseline;
- не хранить fake-but-real-looking client contact/social values как будто они уже утверждены;
- оставлять optional integrations пустыми или safe-default only, если feature реально opt-in.

---

## 5. Что считается завершением tranche 1

`Tranche 1` считался готовым к review, когда одновременно выполнялось всё ниже:

- есть один канонический contract через `npm run client:init:contract`;
- mandatory vs bootstrap-generated vs optional inputs перечислены явно;
- root/backend/storefront env examples не содержат accidental workstation/demo residue;
- branding/legal-contact placeholders вынесены в явный template-safe baseline;
- `Phase 6` guardrails по preset selector и central authority не нарушены.

---

## 6. Минимальная targeted validation

Для closure checkpoint этого tranche достаточен такой baseline набор:

1. проверить, что [`package.json`](../package.json) содержит `client:init:contract` entrypoint;
2. проверить, что [`.env.example`](../.env.example), [`medusa-agency-boilerplate/.env.template`](../medusa-agency-boilerplate/.env.template) и [`medusa-agency-boilerplate-storefront/.env.local.example`](../medusa-agency-boilerplate-storefront/.env.local.example) содержат template-safe placeholders;
3. проверить, что [`medusa-agency-boilerplate-storefront/src/lib/storefront-config.ts`](../medusa-agency-boilerplate-storefront/src/lib/storefront-config.ts) больше не содержит demo/legal-contact residue;
4. проверить, что [`medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts) всё ещё остаётся central preset authority и не меняет `Phase 6` behaviour.

## 7. Truthful closure outcome

По состоянию closure checkpoint этот tranche зафиксирован так:

- канонический `client-init` contract materialized и остаётся source of truth в [`Docs/client_init_contract.md`](./client_init_contract.md);
- root/backend/storefront init-facing surfaces перечислены без overclaim и без reopening `Фазы 6`;
- `MEDUSA_BACKEND_URL`, `NEXT_PUBLIC_BASE_URL` и `NEXT_PUBLIC_DEFAULT_REGION` truthfully зафиксированы как optional storefront runtime inputs с safe fallback semantics;
- canonical preset authority остаётся в [`storefront-client-config.ts`](../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts), а sanctioned selector остаётся [`NEXT_PUBLIC_STOREFRONT_PRESET`](../medusa-agency-boilerplate-storefront/src/lib/env.ts:14);
- remediation по blocking inconsistency завершена, повторный review дал **APPROVE**.

Следующий logical slice внутри `Фазы 7` лежит уже после этого baseline: template release checklist, onboarding doc и cleaned template release/package path.

По состоянию markdown-only packaging sync этот следующий tranche уже materialized отдельным canonical artifact в [`Docs/template_release_handoff.md`](./template_release_handoff.md). При этом сам этот документ остаётся узким source of truth именно для tranche 1 contract baseline и не подменяет собой tranche 2 handoff/release narrative.
