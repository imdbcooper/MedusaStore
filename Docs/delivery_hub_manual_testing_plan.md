# Delivery Hub — дружелюбный пошаговый план ручного тестирования


> Phase 8 note (2026-05-01): the active shopper checkout is one Delivery Hub delivery flow. Older preview/shadow/cutover sections below are historical or advanced dev/admin diagnostics only unless explicitly framed as product-flow checks. Product-flow browser smoke must use buyer-facing Delivery Hub hooks and must not depend on shopper-visible diagnostic labels. Public preview warehouse env values are diagnostic/dev-only.

## 0) Быстрый маршрут (2 минуты)

Если нужно быстро проверить, что Admin и Delivery Hub доступны локально:

1. Откройте `http://localhost:9000/app/login`.
2. Войдите локальным dev-admin пользователем из раздела **«Локальный admin для тестирования»**.
3. Перейдите в **Settings → Delivery**.
4. Пройдите основной русскоязычный путь на странице:
   - **1. Подключение Яндекс Доставки** — сохраните connection; token вводится только при создании/ротации, пустое поле на edit означает «оставить сохранённый sealed token»;
   - **Адрес продавца / склада** — заполните city/address и координаты склада; для теста `Москва, Льва Толстого, 16` используйте longitude `37.588144`, latitude `55.733842`;
   - **2. Проверить подключение** — запустите safe **Test connection**;
   - **3. Найти ПВЗ** — получите destination PVZ и убедитесь, что в lookup/Store response есть coordinates из Yandex `position.longitude/latitude`;
   - **4. Проверить стоимость доставки** — запустите Test quote.
5. Для `warehouse_to_pickup_point` простая цена считается через Yandex legacy cargo `POST /b2b/cargo/integration/v2/check-price`: backend отправляет flat `route_points[].fullname`, `route_points[].coordinates`, `contact`, `items`, `places`, `billing_info.payment_method=already_paid`; pickup windows не являются обязательным prereq для этого price preview.

Если на шаге 1 снова белый экран — сразу переходите в раздел **«Если в Admin белый экран»** ниже.

---

## 1) Цель документа

Этот план нужен для ручной проверки текущего этапа Delivery Hub в локальной среде:

- проверить доступность Admin и раздела Delivery;
- безопасно заполнить Yandex connection;
- выполнить `Test connection` и `Test quote` сценарии;
- зафиксировать PASS/FAIL без утечки секретов.

Важно: live-вызовы выполняются только как отдельная manual/operator-approved диагностика. В актуальной ручной проверке **Admin → Settings → Delivery → Test quote** подтверждены оба обязательных first-tranche quote flows через прямой Yandex `/offers/create`: `warehouse_to_pickup_point` и `dropoff_point_to_pickup_point`. Raw token/auth/provider body/ciphertext не выводились, shipment/order/confirmation endpoints не вызывались.

### Статус подтверждённых backend-блокеров (обновлено)

- ✅ Исправлен backend validation blocker для `GET /admin/delivery/execution-plan/preview`: поле `repository_assembly_summary` теперь проходит admin schema/sanitizer и больше не приводит к `DELIVERY_HUB_UNEXPECTED_ERROR · HTTP 500`.
- ✅ На странице **Settings → Delivery** этот конкретный validation error (`unrecognized_keys: ["repository_assembly_summary"]`) больше не воспроизводится.
- ✅ Локальный `DELIVERY_HUB_ENCRYPTION_KEY` настроен в untracked env и подхватывается backend container; credentials smoke с dummy token подтвердил sealed/encrypted envelope без plaintext leakage, затем test record был очищен.
- ✅ Локальный Admin/Vite HMR для Docker закреплён на `5173`; после пересоздания backend console больше не показывает прежний `ws://localhost:<random>/app` `ERR_CONNECTION_REFUSED` шум, а `/app/@vite/client` и virtual modules отдаются как JavaScript.
- ✅ Диагностика ручного `Test connection` с публичными test credentials Яндекса показала не frontend/backend-encryption проблему, а provider route mismatch: Yandex вернул `404 · No route for URL` на `POST /pickup-points/list`, что backend безопасно маппил в `502`. Adapter теперь выбирает sandbox host для `mode=test`, production host для `mode=live`, а в Admin есть явный selector **Yandex API host** без хранения/вывода токена.
- ✅ После restart backend подтверждён safe runtime state: таблиц `delivery_hub_connections` / `delivery_hub_warehouses` в текущей локальной БД ещё нет, значит connection `yandexTestname` не был persisted и Yandex live/provider вызовы этим диагнозом не запускались. UI теперь явно блокирует **Test connection** до successful **Create connection** и блокирует **Test quote** до saved connection + обязательных полей, чтобы не получать неочевидные локальные `400` validation ошибки.
- ✅ Повторный ручной `Test connection` после сохранения connection подтвердил persisted state без раскрытия token: connection сохранён, credentials sealed/present, `mode=test`, выбран sandbox/test host, default warehouse присутствует. Backend дошёл до Yandex sandbox по `POST /pickup-points/list`; provider вернул именно `403`, не локальную validation/encryption ошибку. Это маппится в `DELIVERY_HUB_CREDENTIALS_INVALID · HTTP 401`, потому что для Admin это credential/access failure; дополнительная безопасная диагностика теперь отдельно распознаёт HTML access-block page как `provider_access_blocked` и не сохраняет raw provider HTML body.
- ✅ Последний пользовательский screenshot и safe runtime inspection подтвердили successful **Test connection**: UI показал `Yandex connection updated`, `Connection diagnostics` со status `ready`, `ok · provider=ok · category=n/a`; event log зафиксировал latest `connection_test` success на sandbox/test host `https://b2b.taxi.tst.yandex.net/api/b2b/platform` с `provider_status=ok`, `include_pickup_points=true`, `pickup_points_count=1079` и safe correlation id. Это подтверждает, что endpoint/base-path fix и saved connection теперь работают для Yandex sandbox/test data. `pickup_points_count=1079` означает, что provider вернул каталог PVZ/points для diagnostic call; это не quote, не shipment и не подтверждение цены/доставки. Raw token, auth headers, request body и raw provider body в docs/log summary не выводились. **Test quote** автоматически не запускался.
- ✅ Добавлен operator-friendly lookup для получения destination PVZ id перед ручным **Test quote**: admin-only route `GET /admin/delivery/pickup-points?connection_id=<id>&city=<optional>&limit=20` и UI-блок **Pickup point lookup** на **Settings → Delivery**. Он вызывает existing adapter `listPickupPoints` только по кнопке оператора, возвращает capped sanitized sample (`id/code/name/address/city/available_for_dropoff/coordinates`), не выводит raw credentials/provider body и позволяет кнопкой **Use as destination** заполнить поле **Destination point id**.
- ✅ Добавлен safe fix для `warehouse_to_pickup_point` pickup windows: adapter больше не делает скрытый pre-call `/offers/info` с `places: []`; Admin получил operator-only блок **Pickup windows lookup** (`GET /admin/delivery/pickup-windows`) с sanitized/capped windows и кнопкой **Use interval**. После follow-up по docs pickup windows больше не являются обязательным prerequisite для sandbox **Test quote**.
- ✅ Диагностика следующего provider `400` на **Pickup windows lookup** показала локальный request/response-contract drift, а не проблему disabled **Test quote**: safe log имел documented sandbox family `/api/b2b/platform`, path `/offers/info`, non-empty `places`, но не было `last_mile_policy=self_pickup`, поэтому Yandex применял default `time_interval` и вернул safe `no_delivery_options`. Adapter теперь вызывает `/offers/info?last_mile_policy=self_pickup` и маппит documented `offers[].from/to` в neutral windows.
- ✅ Follow-up по рабочему пользовательскому примеру подтвердил, что для простого warehouse → PVZ price preview нужен Yandex legacy cargo `POST /b2b/cargo/integration/v2/check-price`, а не platform `/offers/create` / `/offers/calculate`. Payload должен иметь flat `route_points` (`id`, `type`, `fullname`, `coordinates`, `contact`), `items`, `places`, `billing_info.payment_method=already_paid`; `merchant_id` и `platform_station_id` для этого price preview не передаются.
- ✅ Ручной smoke baseline для `warehouse_to_pickup_point` теперь подтверждается через corrected `/check-price` contour: склад-источник должен иметь coordinates `[lng, lat]`, выбранный ПВЗ должен иметь coordinates из `pickup-points/list`, Store quote возвращает neutral price/ETA, а storefront показывает buyer-visible price. Это price-preview проверка без shipment/order/confirmation endpoint.
- ✅ Свежий пользовательский screenshot подтвердил второй обязательный smoke baseline для `dropoff_point_to_pickup_point` через прямой Yandex `/offers/create`: connection `yandexTestname · test · active`, destination PVZ/platform station id `e1139f6d-e34f-47a9-a55f-31f032a861a6`, origin dropoff point id `019d2a9da5877011a771b75e903f3039`, currency `RUB`, quantity `1`, weight `500` grams, declared price `2000`, correlation id `a4adab14-ff1c-40da-a2cd-bfa0726e3be7`, `quotes count=13`, first offer price `181.9 rub`, visible ETA examples `3–4`, `4–5`, `5–6`, `6–7`, pickup window required `no`; provider reference intentionally redacted. Это закрывает оба обязательных first-tranche quote paths: warehouse → PVZ и dropoff point → PVZ.

---

## 1.1) Storefront Delivery Hub checkout flow and advanced diagnostics

Цель этого шага — проверить текущий buyer-facing Delivery Hub checkout flow без привязки product smoke к диагностическим labels.

### Product-flow ручная проверка в storefront

1. Перезапустите storefront после изменения env. Для обычного shopper flow `NEXT_PUBLIC_DELIVERY_HUB_PREVIEW_ENABLED` не требуется.
2. Откройте checkout и перейдите на шаг доставки.
3. Убедитесь, что виден один активный Delivery Hub delivery contour: quote/PVZ selection, сохранение доставки, Medusa shipping option handoff, затем payment только после ready delivery.
4. Используйте buyer-facing hooks для ручной или automated проверки:
   - `data-testid="delivery-hub-customer-delivery-card"`;
   - `data-testid="delivery-hub-pickup-point-selector"`;
   - `data-testid="delivery-hub-pickup-point-option"`;
   - `data-testid="delivery-hub-customer-save-selection-button"`;
   - `data-testid="delivery-hub-customer-save-message"`;
   - `data-testid="delivery-hub-customer-selection-status"`;
   - `data-testid="submit-delivery-option-button"`.
5. Выберите ПВЗ, сохраните доставку, проверьте buyer-visible price/ETA/PVZ labels и переход к payment только после сохранённой Delivery Hub shipping option.
6. Shopper-visible copy не должен содержать preview/shadow/cutover/debug/source-of-truth/legacy-fallback формулировки.
7. В UI не должно быть raw provider body, token, auth header, ciphertext, publishable key value, quote key, offer id, execution reference или других секретов.

### Advanced diagnostics

Optional diagnostics остаются только за `NEXT_PUBLIC_DELIVERY_HUB_PREVIEW_ENABLED=true` и collapsed details `data-testid="delivery-hub-dev-diagnostics"`. Это dev/admin validation surface, а не active shopper flow.

Дополнительные local/sandbox defaults допускаются только для диагностики:

```text
NEXT_PUBLIC_DELIVERY_HUB_PREVIEW_ENABLED=true
NEXT_PUBLIC_DELIVERY_HUB_PREVIEW_DEV_DEFAULTS_ENABLED=true
NEXT_PUBLIC_DELIVERY_HUB_PREVIEW_DEFAULT_CONNECTION_ID=30e7b02b-71de-42d8-8587-86780c2850b8
NEXT_PUBLIC_DELIVERY_HUB_PREVIEW_DEFAULT_DESTINATION_POINT_ID=e1139f6d-e34f-47a9-a55f-31f032a861a6
NEXT_PUBLIC_DELIVERY_HUB_PREVIEW_DEFAULT_ORIGIN_POINT_ID=019d2a9da5877011a771b75e903f3039
NEXT_PUBLIC_DELIVERY_HUB_PREVIEW_DEFAULT_WAREHOUSE_ID=fa279b9d-316d-45c2-aa8d-aa92a77d15ba
```

Эти значения — только documented sandbox/dev defaults. Не переносите их как production behavior и не добавляйте туда секреты.

### Mock-friendly browser smoke

Root commands:

```bash
npm run smoke:delivery-hub-preview:browser
npm run smoke:delivery-hub-cutover:browser
npm run smoke:delivery-hub-rollback:browser
```

Команды intentionally не используют live backend/Yandex. Они поднимают локальный mock Store API для cart/fulfillment/payment prerequisites and Delivery Hub product endpoints. Product-flow assertions должны проверять buyer-facing Delivery Hub card/PVZ/save/payment gating and safe one-key Medusa shipping-method handoff; diagnostics may exist behind the collapsed details flag but must not be required DOM/text dependencies for PASS.

Expected result:

- disabled diagnostics run: active Delivery Hub shipping option remains visible, diagnostic details are hidden/absent, no legacy delivery fallback shipping is required or visible, and no Delivery Hub shipping-method commit request is made while handoff flag is false;
- enabled diagnostics / handoff false: product quote/PVZ/save path works through mocked Store API, but no Medusa shipping-method commit request is made;
- enabled diagnostics / handoff true: product save path commits exactly one Medusa shipping-method payload containing only the mapped Delivery Hub option id;
- rollback drill: after the handoff-true rehearsal, restarting with flags off hides diagnostics again and does not reintroduce a legacy fallback path;
- visible UI text scan contains no raw provider/auth/secret needles and no shipment lifecycle actions.

### Controlled staging enablement / rollback checklist

1. Confirm committed examples/templates keep `NEXT_PUBLIC_DELIVERY_HUB_CHECKOUT_CUTOVER_ENABLED=false`; do not commit a `true` default.
2. Set `NEXT_PUBLIC_DELIVERY_HUB_CHECKOUT_CUTOVER_ENABLED=true` only in the staging deployment config for the intended storefront environment, not in production and not in committed examples.
3. Run the local mock/no-network handoff smoke before staging rollout:

   ```bash
   npm run smoke:delivery-hub-cutover:browser
   ```

4. If a controlled staging cart/order path is available, place one operator-approved test cart/order through the guarded Delivery Hub checkout path and record only sanitized outcome/status. Do not put secrets, auth headers, provider raw bodies, raw Yandex DTOs, raw offer ids, raw quote keys, ciphertext, or publishable key values into docs/log excerpts.
5. Roll back by setting `NEXT_PUBLIC_DELIVERY_HUB_CHECKOUT_CUTOVER_ENABLED=false` in staging and redeploying/restarting the storefront. No legacy delivery fallback must be required or reintroduced.
6. Run the rollback/fallback smoke after rollback:

   ```bash
   npm run smoke:delivery-hub-rollback:browser
   ```

This checklist is for controlled staging enablement only. It is not production rollout approval, does not change committed defaults, and does not enable shipment create/cancel/status/retry.

### Staging dry-run evidence bundle

After the controlled staging run/rollback above, generate a local sanitized staging dry-run bundle from the repository root:

```bash
npm run evidence:delivery-hub-staging-dry-run:check
npm run evidence:delivery-hub-staging-dry-run -- \
  --cutover-smoke-status PASS \
  --rollback-smoke-status PASS \
  --staging-flag-state false \
  --manual-staging-note "sanitized staging cart/order outcome only" \
  --rollback-verification-note "sanitized fallback verified after flag-off redeploy"
```

The default statuses are `NOT_RUN` and the default staging flag assertion is `unknown` unless the operator explicitly passes values or the matching `STAGING_CUTOVER_SMOKE_STATUS`, `STAGING_ROLLBACK_SMOKE_STATUS`, `STAGING_DELIVERY_HUB_CUTOVER_FLAG_STATE`, `STAGING_DELIVERY_HUB_MANUAL_NOTE`, and `STAGING_DELIVERY_HUB_ROLLBACK_NOTE` environment variables. Output is local/ignored under `.delivery-hub-cutover-evidence/staging-dry-run/` and must not be committed. The exporter records only timestamp, safe git summary, expected smoke commands/status assertions, staging flag assertion, sanitized manual note, sanitized rollback note, and hard guardrails. It rejects notes that look like credentials, auth headers, token/ciphertext fragments, raw provider/Yandex payloads, raw offer ids, raw quote keys, request/response bodies, or `.env` contents. It performs no live provider/Yandex calls and captures no request/response bodies.

### Cutover evidence bundle exporter

Before attaching evidence to a Delivery Hub checkout go/no-go review, generate the read-only bundle from the repository root:

```bash
npm run evidence:delivery-hub-cutover:check
npm run evidence:delivery-hub-cutover
```

The exporter writes a sanitized markdown bundle by default to `.delivery-hub-cutover-evidence/delivery-hub-cutover-evidence-bundle.md`; that directory is ignored and the generated artifact should not be committed. The bundle contains safe summaries and placeholders for the cutover plan, this manual testing plan, preconditions verifier, candidate planner, decision artifact, preview browser smoke, rollback smoke, redaction guardrails, and remaining blockers.

Important boundaries:

- exporter mode is read-only/no-network;
- it does not call Yandex/live providers, backend runtime, Store API endpoints, storefront runtime, or browser smoke commands;
- it records command/status placeholders for `npm run smoke:delivery-hub-preview:browser`, `npm run smoke:delivery-hub-cutover:browser`, and `npm run smoke:delivery-hub-rollback:browser`, but those smokes remain separate operator actions;
- it does not create executable approval, does not enable `can_commit_shipping_method`, and does not add Delivery Hub checkout commit wiring.

Full convention: [`delivery_hub_cutover_evidence_bundle.md`](./delivery_hub_cutover_evidence_bundle.md).

### Checkout cutover readiness gate

Формальный go/no-go gate для будущего checkout source-of-truth cutover теперь вынесен в [`delivery_hub_checkout_cutover_plan.md`](./delivery_hub_checkout_cutover_plan.md).

Этот раздел является historical/evidence context. Для текущего buyer-facing Phase 8 product flow используйте §1.1 выше и browser smokes. Если нужно вручную проверить advanced diagnostics, откройте collapsed `data-testid="delivery-hub-dev-diagnostics"` при `NEXT_PUBLIC_DELIVERY_HUB_PREVIEW_ENABLED=true`.

Критично для historical/advanced проверки:

- успешный Admin quote smoke, store-neutral quote/selection smoke, storefront preview validation и mock browser smoke являются readiness evidence only;
- manual preview validation **не** является approval на checkout cutover;
- default decision remains **NO-GO** until a separate approval gate explicitly records `GO`;
- reserved future flag `NEXT_PUBLIC_DELIVERY_HUB_CHECKOUT_CUTOVER_ENABLED=false` is runtime-visible only in advanced diagnostics as a default-off read-only/preflight gate;
- read-only verifier `GET /store/delivery/cutover-preconditions` is evidence/preflight only: it must not call Yandex/live providers, must not expose raw provider/Yandex DTOs or secrets, and must not be treated as approval;
- read-only artifact endpoint `GET /store/delivery/cutover-approval-template?cart_id=<cart_id>` is a decision-record template only: default `decision_status=not_requested`, allowed statuses are `not_requested | go_requested | no_go | approved_but_commit_disabled`, and even an approved evidence state does not enable checkout commit;
- human record template for operators is [`delivery_hub_cutover_decision_record_template.md`](./delivery_hub_cutover_decision_record_template.md); use it only as sanitized evidence, not runtime state;
- when the handoff flag is absent/false, `data-testid="delivery-hub-advanced-readiness-status"` must show default-off and `canCommitShippingMethod=false`;
- if an operator explicitly sets `NEXT_PUBLIC_DELIVERY_HUB_CHECKOUT_CUTOVER_ENABLED=true` in local/staging, the same advanced readiness block may show `canCommitShippingMethod=true` only when a ready candidate maps to an available Delivery Hub Medusa shipping option; otherwise it must fail closed as `false`;
- `data-testid="delivery-hub-advanced-preconditions-status"` must show either available verifier evidence or fail-safe unavailable state, and the verifier artifact itself remains non-executable;
- `data-testid="delivery-hub-advanced-approval-record"` must show either available non-executable decision evidence or fail-safe unavailable state;
- active shopper checkout must not show these historical/advanced labels, must not reintroduce legacy delivery fallback checkout, and must not run shipment create/cancel/status/retry.

---

## 2) Что обязательно помнить по безопасности

1. **Yandex API token вводится только в Admin UI**.
2. Токен нельзя вставлять в чат, markdown, тикеты, скриншоты, логи.
3. Write-only token field намеренно остаётся пустым при редактировании существующей connection: если connection уже показывает credentials `sealed` / present, не вводите token заново для обычного **Save connection**. Пустое поле означает «оставить уже сохранённый sealed token»; вводите token повторно только при создании новой connection, первой настройке пустой/не sealed connection или осознанной ротации token.
4. Если token уже был вставлен в чат или публичный канал, считайте его скомпрометированным: для тестирования создайте/используйте новый тестовый token и старый отзовите, если это был реальный секрет.
5. В отчётах используем маску: `***`.
6. `DELIVERY_HUB_ENCRYPTION_KEY` нельзя копировать в docs/chat/logs; в templates/examples оставляем только placeholder.
7. Публикуем только безопасные артефакты без секретов.
8. Локальные admin credentials из этого документа предназначены только для local-dev.
9. Эти credentials нельзя использовать на staging/prod и нельзя заменять ими реальные production/staging секреты.

---

## 3) Локальный admin для тестирования

Для локального ручного тестирования создан dev-only Medusa admin пользователь:

| Поле | Значение |
|---|---|
| Email/login | `admin@delivery-hub.local` |
| Password | `DeliveryHubLocalAdmin123!` |
| Назначение | Только локальная разработка и ручное тестирование |

Security warning:

- это **не production** и **не staging** credentials;
- не используйте этот пароль вне локального окружения;
- не добавляйте реальные секреты в docs/chat;
- если локальная база пересоздана, пользователя можно создать заново командой ниже.

Команда создания/повторного создания local-dev пользователя из корня репозитория:

```bash
cd medusa-agency-boilerplate && set -a && . ./.env && set +a && npm exec medusa user -- --email admin@delivery-hub.local --password 'DeliveryHubLocalAdmin123!'
```

Ожидаемый успешный вывод CLI:

```text
User created successfully.
```

---

## 3.1) Локальные runtime prerequisites Delivery Hub

- Локальный `DELIVERY_HUB_ENCRYPTION_KEY` уже настроен в untracked root `.env` и backend env для текущей машины; значение намеренно не документируется.
- Backend container получает этот key через `docker-compose.yml`; проверяйте только факт наличия переменной в container env, не печатая значение.
- Если локальная среда пересоздаётся с нуля, сгенерируйте новый dev-only key командой вида `openssl rand -base64 32` и запишите его только в untracked env. Не используйте key из чужой среды.
- `DELIVERY_HUB_SHIPMENT_EXECUTION_ENABLED=false` остаётся безопасным default: live shipment dispatch не должен запускаться автоматически во время ручной подготовки connection.
- Новый тестовый Yandex token вводите в **Settings → Delivery → Create Yandex connection → Write-only token**. Не используйте token, который ранее был отправлен в чат.

---

## 4) Подготовка перед тестом

Перед началом убедитесь, что:

- локально поднят backend Medusa;
- открывается `http://localhost:9000/app/login`;
- вход в Admin проходит с local-dev credentials из раздела 3;
- подготовлены тестовые значения:
  - `provider warehouse id`,
  - destination `pickup point id` (PVZ),
  - origin `dropoff point id` (для dropoff-сценария),
  - optional `interval_utc` из pickup windows, если Yandex вернёт interval validation;
- для dropoff origin подтверждён флаг `available_for_dropoff=true`.

---

## 5) Как войти в Admin

1. Откройте `http://localhost:9000/app/login`.
2. В поле **Email** введите `admin@delivery-hub.local`.
3. В поле **Password** введите `DeliveryHubLocalAdmin123!`.
4. Нажмите **Continue with Email**.
5. После успешного входа перейдите в **Settings → Delivery**.

Если пароль локального пользователя потерян или база пересоздана, не пытайтесь доставать старые password hashes. Создайте пользователя заново командой из раздела 3.

---

## 6) Какие данные и куда вводить

| Данные | Куда вводить | Обязательно | Можно писать в docs/chat |
|---|---|---|---|
| Yandex API token | Поле token в **1. Подключение Яндекс Доставки** | Да при создании/ротации; необязательно при edit saved sealed connection | **Нет** |
| Склад-отправитель: `country_code`, city, address, longitude/latitude | **Адрес продавца / склада**; затем выбор saved warehouse в **4. Проверить стоимость доставки** | Да для `warehouse_to_pickup_point`; city должен быть городом (`Москва`), coordinates обязательны для live `/check-price` | Да, если не секрет |
| `provider warehouse id` / `platform_station_id` склада | Advanced-блок складов/source mapping; для `check-price` price preview не отправляется, но может использоваться pickup windows/shipment diagnostics | Необязательно для `check-price`, может быть нужно для advanced операций | Да, если не секрет |
| Destination `pickup point id` / PVZ `platform_station_id` + coordinates | **3. Найти ПВЗ** → **Использовать как destination** или storefront selector; coordinates берутся из `pickup-points/list position.longitude/latitude` | Да для обоих Test quote сценариев; для warehouse → PVZ live `/check-price` coordinates обязательны | Да |
| Origin `dropoff point id` | **4. Проверить стоимость доставки** (`dropoff_point_to_pickup_point`) | Да для dropoff-сценария | Да |
| `available_for_dropoff=true` | Проверка origin dropoff точки в **3. Найти ПВЗ** | Да для origin в dropoff-сценарии | Да |
| `interval_utc` из pickup windows | Optional advanced diagnostics в **4. Проверить стоимость доставки** | Необязательно для sandbox `/offers/create`; используйте только если хотите interval-specific проверку или provider явно требует interval validation | Да |

---

## 7) Основной пошаговый сценарий тестирования

### Шаг 1. Открыть Admin и дойти до Delivery

1. Откройте `http://localhost:9000/app/login`.
2. Войдите с local-dev credentials из раздела 3.
3. Перейдите в **Settings → Delivery**.
4. Убедитесь, что страница **Delivery** отрисовалась.

Ожидаемо:

- нет белого экрана;
- нет MIME errors для `medusa/routes` и `medusa/menu-items`;
- заголовок страницы: **Delivery**.

### Шаг 2. Открыть/создать Yandex connection

1. Откройте блок **1. Подключение Яндекс Доставки**.
2. Заполните basic поля:
   - понятное название connection;
   - mode: `test` для публичных test credentials / sandbox-проверки, `live` только для реальных production credentials;
   - Yandex token — только в UI; при редактировании saved sealed connection оставьте поле пустым, если не ротируете token.
3. При необходимости откройте **Расширенные настройки подключения**:
   - **Yandex API host**: оставьте `Auto by mode` или явно выберите `Yandex sandbox/test host` для данных из публичной документации Яндекса;
   - label format и auto confirm — advanced config, не нужны для basic Test connection/Test quote.
4. Убедитесь, что warehouse/source mapping задан через saved warehouse: `provider_warehouse_id` должен быть Yandex `platform_station_id` склада.
5. Нажмите **Create connection** или **Save changes**.

Ожидаемо:

- connection сохранён без ошибок формы;
- после успешного create созданная connection автоматически выбирается в UI и получает persisted connection id;
- токен не отображается в ваших заметках/артефактах;
- в UI и логах не раскрываются auth headers или provider secrets;
- для `mode=test` backend обращается к sandbox/test host, для `mode=live` — к production host, если не задан явный override в **Yandex API host**.

Важно: заполненные поля формы ещё не являются saved connection. До успешного **Create connection** кнопка **Test connection** должна оставаться disabled с пояснением. Если вместо этого раньше было видно `DELIVERY_HUB_CONNECTION_REQUIRED`, это означало отсутствие persisted connection id, а не проблему токена или sandbox host.

### Шаг 3. Выполнить Test connection

1. Откройте блок **2. Проверить подключение**.
2. Убедитесь, что saved connection выбрана.
3. Нажмите **Test connection** только вручную.
4. Дождитесь результата.
5. Зафиксируйте PASS/FAIL и текст ошибки, если есть.
6. Не копируйте в отчёт токены, auth headers или сырые provider responses с секретами.

Если снова видно ошибку после **Test connection**, откройте backend/admin Delivery logs и смотрите только безопасные поля:

- `provider_status=404` + `error_category=provider_route_mismatch` + `response.message=No route for URL` означает, что host/path не соответствует текущим credentials/documentation sample; проверьте **Yandex API host** и mode.
- `provider_status=401/403` + `error_category=auth` означает, что backend дошёл до Yandex, но credential/account/API permission не принят для выбранного host/resource; публичного token-like примера из документации обычно недостаточно как real merchant credential.
- `provider_status=403` + `error_category=provider_access_blocked` означает, что Yandex вернул HTML access-block page до нормального API JSON response. Это всё ещё не локальная validation/encryption ошибка и не route mismatch; проверяйте sandbox-доступ, кабинет/API permissions и network/IP reputation. Raw HTML body не нужно копировать в отчёт.
- UI `DELIVERY_HUB_CREDENTIALS_INVALID · HTTP 401` при provider `403` — ожидаемая admin-normalization: backend скрывает provider-specific status за credential/access failure, но в diagnostics/logs оставляет безопасный `provider_status=403` и category.
- Default warehouse не влияет на basic **Test connection**, потому что текущий adapter test ходит только в `POST /pickup-points/list` с `{ limit: 1 }`; warehouse используется в quote/warehouse-сценариях.
- `React Router Future Flag Warning` в browser console к этому backend test не относится и не является причиной provider `401/403/404/502`.

### Шаг 4. Получить destination pickup point id через Pickup point lookup

1. Откройте блок **3. Найти ПВЗ**.
2. Выберите ту же saved Yandex connection, которая прошла **Test connection**.
3. Для стабильного sandbox warehouse → PVZ сценария оставьте дефолтные documented-фильтры:
   - **Geo ID**: `213` (Москва);
   - **Сеть ПВЗ**: `market_l4g` (Яндекс Маркет / партнёры);
   - **Тип станции**: `pickup_point`;
   - **Яндекс-бренд**: `true`.
4. Если нужен полностью deterministic тест из документации/песочницы, нажмите **Использовать тестовый PVZ Яндекса** или укажите exact PVZ id `e1139f6d-e34f-47a9-a55f-31f032a861a6`; это `Пункт выдачи заказов Яндекс Маркета`, Москва, Ленинградский проспект 27.
5. Оставьте небольшой **Limit** (`20` по умолчанию, максимум `50`) и нажмите **Load pickup points** только вручную.
6. В returned sample найдите подходящий PVZ и нажмите **Use as destination**. UI скопирует `id` этой точки в поле **Destination point id** в **4. Проверить стоимость доставки**.
7. Для `dropoff_point_to_pickup_point`, если точка имеет `available_for_dropoff=true`, можно нажать **Use as origin** для поля **Origin dropoff point id**.

Почему могут быть видны `5 Post (Пятерочка)`: это нормальная партнёрская сеть внутри каталога Yandex Delivery. Провайдер остаётся `Yandex`; `5 Post` — это сеть/оператор ПВЗ. Для теста склада `fbed3aa1-2cc6-4370-ab4d-59c5cc9bb924` стабильнее выбирать `market_l4g` / Яндекс Маркет, потому что sampled 5Post-точки в sandbox возвращали `no_delivery_options`.

Если **Test quote** возвращает `provider_code=pickups_not_configured`, это не то же самое, что `no_delivery_options`: Yandex говорит, что для выбранного склада не настроены pickups под переданный pickup interval. Сначала очистите optional **Interval from/to** и повторите `/offers/create`; если нужен interval-specific тест, используйте только interval, возвращённый provider pickup diagnostics/support. Для deterministic smoke используйте кнопку **Использовать тестовый PVZ Яндекса**.

Без UI можно использовать admin-only API после Admin login/session:

```text
GET /admin/delivery/pickup-points?connection_id=<saved_connection_id>&geo_id=213&operator_id=market_l4g&station_type=pickup_point&is_yandex_branded=true&limit=20
GET /admin/delivery/pickup-points?connection_id=<saved_connection_id>&pickup_point_id=e1139f6d-e34f-47a9-a55f-31f032a861a6&limit=1
```

Ответ намеренно sanitized/capped: `points[].id` — это значение для **Destination point id**; также доступны `code`, `name`, `address`, `city`, `operator_id`, `network_label`, `station_type`, `is_yandex_branded`, `is_market_partner`, `available_for_dropoff`, `coordinates`, `returned_count`, `total_available`, `truncated`, `correlation_id`. Raw token/auth headers/raw provider response не возвращаются и не сохраняются в docs.

### Шаг 5. Опционально получить pickup window interval через Pickup windows lookup

Pickup windows lookup — это advanced diagnostic/helper, а не обязательный blocker для warehouse → PVZ `/offers/create` Test quote.

1. В блоке **4. Проверить стоимость доставки** откройте details **Диагностика pickup windows (не блокирует Test quote)**.
2. Выберите ту же saved Yandex connection, которая прошла **Test connection**.
3. Выберите saved warehouse из списка **Warehouse**.
4. Укажите destination `pickup point id` (PVZ), полученный на предыдущем шаге. Для актуального Yandex Other-day `POST /offers/info?last_mile_policy=self_pickup` это поле должно соответствовать PVZ/self-pickup delivery destination, иначе provider может легитимно вернуть `no_delivery_options`.
5. Оставьте небольшой **Limit** (`20` по умолчанию, максимум `50`).
6. Нажмите **Load pickup windows** только вручную.
7. В returned sanitized windows выберите future interval и нажмите **Use interval**. UI заполнит optional **Interval from** / **Interval to** в **4. Проверить стоимость доставки**.

Без UI можно использовать admin-only API после Admin login/session:

```text
GET /admin/delivery/pickup-windows?connection_id=<saved_connection_id>&warehouse_id=<warehouse_id>&destination_point_id=<pvz_id>&limit=20
```

Ответ намеренно sanitized/capped: `windows[].interval_utc.from/to`, `date`, `time_from`, `time_to`, `label`, `returned_count`, `total_available`, `truncated`, `correlation_id`. Backend нормализует documented provider response `offers[].from/to` в эти neutral fields. Raw token/auth headers/raw provider response не возвращаются и не сохраняются в docs.

### Шаг 6. Выполнить Test quote: warehouse → PVZ

1. Откройте блок **4. Проверить стоимость доставки**.
2. Выберите saved connection в поле **Connection**. Без saved connection backend вернёт локальную validation ошибку `DELIVERY_HUB_VALIDATION_ERROR` по `connection_id`.
3. Выберите mode code `warehouse_to_pickup_point`.
4. Укажите:
   - saved warehouse из списка **Warehouse**;
   - destination `pickup point id` (PVZ) из **Pickup point lookup**;
   - optional future `interval_utc` из **Pickup windows lookup**, если хотите отдельную interval-specific диагностику.
5. Нажмите **Проверить стоимость** только вручную.
6. Зафиксируйте PASS/FAIL.

Критично:

- **Test quote** должен быть disabled, пока нет saved connection, destination PVZ и required origin field для выбранного mode;
- для `warehouse_to_pickup_point` **Test quote** использует `/check-price`, а не `/offers/create`/`/offers/calculate`: required origin field — saved warehouse with city/address/coordinates; provider warehouse/platform station id не отправляется в simple price preview;
- destination PVZ должен иметь coordinates; если `pickup-points/list` не вернул `position.longitude/latitude`, выберите другой ПВЗ или повторите lookup, иначе backend/storefront должны блокировать quote до provider call;
- after successful **Test connection** minimal ручные шаги: **Адрес продавца / склада** → **Pickup point lookup** → **Use as destination** → **Test quote**; pickup windows остаётся optional diagnostic/helper;
- city склада должен быть city (`Москва`), not country (`Russia` / `RU` / `Россия`); для тестового склада `Москва, Льва Толстого, 16` используйте longitude `37.588144`, latitude `55.733842`;
- случайный/устаревший `interval_utc` не нужен для simple `/check-price` price preview;
- shipment ids и реальные provider responses не публикуем в docs/chat.

### Шаг 7. Выполнить Test quote: dropoff point → PVZ

1. В **Test quote** выберите saved connection.
2. Выберите mode code `dropoff_point_to_pickup_point`.
3. Укажите origin `dropoff point id`.
4. Проверьте, что для origin есть `available_for_dropoff=true`.
5. Укажите destination `pickup point id` (PVZ).
6. Нажмите **Test quote** только вручную.
7. Зафиксируйте PASS/FAIL.

### 7.1) Зафиксированные successful quote smoke baselines (`2026-04-27`)

| Flow | Manual result | Safe evidence fields |
|---|---|---|
| `warehouse_to_pickup_point` | PASS through direct Yandex `POST /offers/create` | `quotes count=4`; currency `RUB`; first/UI price `181.9 rub`; pickup window required `no`; interval пустой/не передавался |
| `dropoff_point_to_pickup_point` | PASS through direct Yandex `POST /offers/create` | connection `yandexTestname · test · active`; destination PVZ/platform station id `e1139f6d-e34f-47a9-a55f-31f032a861a6`; origin dropoff point id `019d2a9da5877011a771b75e903f3039`; currency `RUB`; quantity `1`; weight `500` grams; declared price `2000`; correlation id `a4adab14-ff1c-40da-a2cd-bfa0726e3be7`; `quotes count=13`; first offer price `181.9 rub`; visible ETA examples `3–4`, `4–5`, `5–6`, `6–7`; pickup window required `no`; provider reference redacted |

Эти baselines подтверждают именно quote/offer-only contour. Они не означают checkout cutover, shipping-method commit activation, shipment create, status/cancel/retry validation или legacy-provider execution.

### 7.2) Storefront-neutral quote/selection smoke без checkout cutover

Текущий backend/storefront-facing smoke contour теперь можно проверить одной безопасной командой. Harness вызывает только `POST /store/delivery/quotes` и `POST /store/delivery/selection`, берёт первый neutral quote, сохраняет selection в cart metadata only и печатает только safe summary. Он не вызывает `setShippingMethod`, не меняет committed Medusa shipping method, не делает checkout source-of-truth cutover, не вызывает shipment create/cancel/status/retry и не трогает legacy delivery route execution.

#### 2026-04-27 autonomous local smoke result

Autonomous local smoke was rerun against running backend `http://localhost:9000` without user participation. Safe discovery found local publishable key presence, fresh dev cart `cart_01KQ82YXCRW3QQ01GP9CK5RCT8`, saved warehouse `fa279b9d-316d-45c2-aa8d-aa92a77d15ba` / provider warehouse `fbed3aa1-2cc6-4370-ab4d-59c5cc9bb924`, and two saved Yandex test connections: `60208aa4-01e7-45a1-ba53-c8be5506bd86` and `30e7b02b-71de-42d8-8587-86780c2850b8`. No publishable key value/token/ciphertext/raw provider body/auth header was documented.

Initial blockers and fixes:

- Store quote POST body validation is now registered in backend middleware for `POST /store/delivery/quotes`; the route also validates `req.validatedBody ?? req.body` against the neutral Delivery Hub store quote schema and fails closed with `DELIVERY_HUB_VALIDATION_ERROR` if validation is absent or raw/provider-specific fields are present.
- Medusa `exec` in this local toolchain rejects unknown script CLI args, so env vars are the canonical supported harness invocation. The safe summary now declares `canonical_invocation="env_vars"`.
- Saved connection `60208aa4-01e7-45a1-ba53-c8be5506bd86` revalidated successfully but then provider quote returned `403`, so it was not used as the final public-ready smoke connection.
- Saved connection `30e7b02b-71de-42d8-8587-86780c2850b8` revalidated successfully, was safely enabled after `active+sealed`, and was used for PASS evidence.

Final result is **PASS for neutral quote + selection**:

- Dropoff → PVZ: connection `30e7b02b-71de-42d8-8587-86780c2850b8`, cart `cart_01KQ82YXCRW3QQ01GP9CK5RCT8`, origin `019d2a9da5877011a771b75e903f3039`, destination `e1139f6d-e34f-47a9-a55f-31f032a861a6`, `RUB`, item quantity `1`, weight `500`, price `2000`; quote HTTP `200`, `quotes_count=13`, first price `181.9 rub`, selection HTTP `200`, `selection.saved=true`, `checkout_source_of_truth="unchanged"`, safe correlation id `9f2cdca3-6b4b-4275-903d-c739429ded34`.
- Warehouse → PVZ optional run: same cart/connection, warehouse `fa279b9d-316d-45c2-aa8d-aa92a77d15ba`; quote HTTP `200`, `quotes_count=4`, first price `181.9 rub`, selection HTTP `200`, `selection.saved=true`, `checkout_source_of_truth="unchanged"`, safe correlation id `802348f7-21b3-4389-87f8-5f81a6fc9125`.
- No checkout cutover, legacy delivery action, shipment create/cancel/status/retry was executed.

Что подготовить перед командой:

1. Running backend Medusa, обычно `http://localhost:9000`.
2. Saved active Yandex connection id из **Settings → Delivery** после successful **Create connection/Test connection**. Это persisted connection id, не название connection.
3. `cart_id` из storefront/dev cart: откройте storefront checkout/dev cart и возьмите id текущей корзины из network/API response, cookie/local dev state или Medusa cart response. Не используйте admin token для store smoke.
4. Destination PVZ/platform station id. Для deterministic sandbox можно использовать подтверждённый `e1139f6d-e34f-47a9-a55f-31f032a861a6`.
5. Для `dropoff_point_to_pickup_point` — origin dropoff point id с `available_for_dropoff=true`, например подтверждённый `019d2a9da5877011a771b75e903f3039`.
6. Для `warehouse_to_pickup_point` — saved warehouse id из Admin/warehouse mapping; backend сам возьмёт mapped provider warehouse reference.
7. Store publishable key нужен только если локальный store middleware требует `x-publishable-api-key`; передавайте его через placeholder/локальный env, не публикуйте в отчёте.

Рекомендуемая canonical команда для уже подтверждённого dropoff → PVZ smoke использует env vars, чтобы Medusa `exec` не отклонял unknown script args:

```bash
cd medusa-agency-boilerplate && MEDUSA_PUBLISHABLE_KEY=<store_publishable_key> DELIVERY_HUB_STORE_SMOKE_BACKEND_URL=http://localhost:9000 DELIVERY_HUB_STORE_SMOKE_CONNECTION_ID=<saved_connection_id> DELIVERY_HUB_STORE_SMOKE_CART_ID=<storefront_cart_id> DELIVERY_HUB_STORE_SMOKE_MODE=dropoff_point_to_pickup_point DELIVERY_HUB_STORE_SMOKE_ORIGIN_POINT_ID=019d2a9da5877011a771b75e903f3039 DELIVERY_HUB_STORE_SMOKE_DESTINATION_POINT_ID=e1139f6d-e34f-47a9-a55f-31f032a861a6 DELIVERY_HUB_STORE_SMOKE_CURRENCY_CODE=RUB DELIVERY_HUB_STORE_SMOKE_ITEMS_JSON='[{"quantity":1,"weight_grams":500,"price":2000}]' npm run delivery:store-smoke
```

Команда для warehouse → PVZ smoke:

```bash
cd medusa-agency-boilerplate && MEDUSA_PUBLISHABLE_KEY=<store_publishable_key> DELIVERY_HUB_STORE_SMOKE_BACKEND_URL=http://localhost:9000 DELIVERY_HUB_STORE_SMOKE_CONNECTION_ID=<saved_connection_id> DELIVERY_HUB_STORE_SMOKE_CART_ID=<storefront_cart_id> DELIVERY_HUB_STORE_SMOKE_MODE=warehouse_to_pickup_point DELIVERY_HUB_STORE_SMOKE_WAREHOUSE_ID=<saved_warehouse_id> DELIVERY_HUB_STORE_SMOKE_DESTINATION_POINT_ID=e1139f6d-e34f-47a9-a55f-31f032a861a6 DELIVERY_HUB_STORE_SMOKE_CURRENCY_CODE=RUB DELIVERY_HUB_STORE_SMOKE_ITEMS_JSON='[{"quantity":1,"weight_grams":500,"price":2000}]' npm run delivery:store-smoke
```

Ожидаемый safe summary shape:

```text
{
  "status": "success",
  "quote": {
    "http_status": 200,
    "ok": true,
    "quotes_count": 13,
    "selected_quote_reference": { "id": "dhsel_...", "version": 1 },
    "selected_quote_price": { "amount": 181.9, "currency_code": "RUB" },
    "pickup_point_id": "e1139f6d-e34f-47a9-a55f-31f032a861a6",
    "correlation_id": "<safe uuid>"
  },
  "selection": {
    "http_status": 200,
    "ok": true,
    "saved": true,
    "checkout_source_of_truth": "unchanged",
    "contour": "delivery_hub_storefront_preview"
  },
  "diagnostics": {
    "source_of_truth_unchanged": true
  },
  "safety": {
    "checkout_cutover_performed": false,
    "shipment_create_cancel_status_retry_performed": false,
    "api_ship_or_legacy_provider_touched": false
  }
}
```

Success criteria:

- `status="success"`;
- `quote.quotes_count > 0`;
- есть opaque `quote.selected_quote_reference.id` вида `dhsel_...`;
- `selection.saved=true`;
- `selection.checkout_source_of_truth="unchanged"` и `diagnostics.source_of_truth_unchanged=true`;
- вывод не содержит `token`, `Authorization`, raw provider body, `raw_reference`, `quote_key`, `provider_offer_id`, ciphertext, backend execution reference или merchant credentials.

Если harness недоступен, можно использовать ручные `curl` только с placeholder values по тому же контракту: сначала `POST /store/delivery/quotes`, затем взять первый `quotes[0].quote_reference` и отправить neutral payload в `POST /store/delivery/selection`. Не вставляйте реальные secrets/raw provider output в docs/chat.

---

## 8) PASS / FAIL критерии

### PASS

- вход в Admin успешен;
- раздел **Settings → Delivery** доступен;
- Yandex connection сохраняется;
- `Test connection` успешен для корректных данных;
- warehouse → PVZ quote проходит с валидными `provider warehouse id` как source `platform_station_id` и destination `pickup point id`; `interval_utc` optional для sandbox `/offers/create`;
- dropoff → PVZ quote проходит для валидной точки с `available_for_dropoff=true`;
- в отчётах нет секретов.

### FAIL

- белый экран или недоступен Admin/Delivery;
- connection не сохраняется при корректной форме;
- стабильные 401/403 при корректном токене;
- quote падает на валидных входных данных;
- в артефактах обнаружены секреты.

---

## 9) Как фиксировать результаты без секретов

Рекомендуемый шаблон:

- Дата/время (UTC+3)
- Окружение: local
- Сценарий: `Test connection` / `warehouse → PVZ` / `dropoff → PVZ`
- Входные данные, маскировано:
  - token: `***`
  - warehouse id: `<id>`
  - origin dropoff id: `<id>`
  - destination PVZ id: `<id>`
  - `interval_utc`: `<from..to>`
- Результат: PASS/FAIL
- Сообщение системы без секретов
- Ссылка на безопасный артефакт

---

## 10) Если в Admin белый экран

Ниже безопасный локальный troubleshooting без остановки лишних процессов.

### 10.1 Быстрая проверка URL

1. Откройте `http://localhost:9000/app/login`, не только `/app`.
2. Если всё ещё белый экран — откройте DevTools Console.
3. Проверьте, есть ли MIME errors по virtual Admin modules.

### 10.2 Что было причиной в текущей локальной среде

В текущей runtime-диагностике был подтверждён и исправлен блокер Admin dev-shell:

- `/app` и `/app/login` отдавали HTML shell, но frontend не стартовал;
- virtual modules Admin Vite:
  - `/app/@id/__x00__virtual:medusa/routes`,
  - `/app/@id/__x00__virtual:medusa/menu-items`
  отдавались как `text/html`, а должны отдаваться как JavaScript;
- backend logs показывали, что Vite не мог разрешить import из virtual module:
  - `/src/admin/routes/settings/delivery/page.tsx`;
- фактическая причина: backend container был смонтирован в filesystem path `/app`, а Medusa Admin URL base тоже `/app`;
- из-за совпадения путей Vite/Admin генерировал imports вида `/app/src/admin/...`, которые дальше интерпретировались как URL-base-prefixed imports и превращались в несуществующий `/src/admin/...`.

Исправление внесено в `docker-compose.yml`:

- `medusa-backend.working_dir` изменён с `/app` на `/server`;
- bind mount изменён с `./medusa-agency-boilerplate:/app` на `./medusa-agency-boilerplate:/server`;
- очистка Vite cache в command изменена на `/server/node_modules/.vite`;
- HMR port проброшен как `5173:5173`, а Admin Vite config в `medusa-config.ts` фиксирует `server.host=0.0.0.0`, `hmr.port=5173`, `hmr.clientPort=5173`.

После пересоздания backend container virtual modules начали отдаваться как `text/javascript`, `http://localhost:9000/app/login` стал рендерить страницу логина, а прежний HMR WebSocket к случайному localhost port больше не воспроизводится в browser console.

### 10.3 Как быстро перепроверить MIME-проблему

Из корня репозитория можно выполнить:

```bash
curl -sS -D - http://localhost:9000/app/@id/__x00__virtual:medusa/routes -o /tmp/medusa-routes.js
curl -sS -D - http://localhost:9000/app/@id/__x00__virtual:medusa/menu-items -o /tmp/medusa-menu-items.js
```

Ожидаемо в headers:

```text
Content-Type: text/javascript
```

Если вместо этого снова `text/html`, значит Admin dev-shell снова не смог собрать virtual module и отдал HTML fallback.

### 10.4 Пошаговые действия при повторении

1. Убедитесь, что backend dev-процесс действительно запущен.
2. Проверьте, что `http://localhost:9000/app/@vite/client` отдаёт JavaScript, а не HTML.
3. Проверьте `medusa/routes` и `medusa/menu-items` командами из раздела 10.3.
4. Если virtual modules отдаются как HTML, посмотрите backend logs на `Failed to resolve import`.
5. Проверьте, что `docker-compose.yml` не вернулся к mount/working_dir `/app` для `medusa-backend`.
6. Пересоздайте только backend container, не трогая Payload, если нужно применить compose-изменение:

```bash
docker compose up -d --force-recreate medusa-backend
```

7. Обновите `http://localhost:9000/app/login`.

Примечание: если локальная ошибка HMR WebSocket вида `ws://localhost:<random>/app` `ERR_CONNECTION_REFUSED` вернётся, сначала проверьте, что backend container пересоздан после compose/config изменений и что port `5173` не занят другим процессом. Если login page рендерится и virtual modules отдаются как JavaScript, сама по себе HMR-ошибка остаётся non-blocking для ручного теста, но текущая локальная проверка после фикса её не показала.

---

## 11) Короткий чеклист

- [ ] Открыт `http://localhost:9000/app/login`
- [ ] Успешный вход в Admin с `admin@delivery-hub.local`
- [ ] Открыт **Settings → Delivery**
- [ ] В блоке **1. Подключение Яндекс Доставки** создана/открыта Yandex connection
- [ ] Token введён только в UI; при edit saved sealed connection пустое поле использовано как «оставить сохранённый token»
- [ ] Заполнен `provider_warehouse_id` / warehouse `platform_station_id` для warehouse-сценария
- [ ] В блоке **2. Проверить подключение** выполнен `Test connection`
- [ ] Через **3. Найти ПВЗ** загружен sanitized sample PVZ/points
- [ ] В **4. Проверить стоимость доставки** скопирован/выбран destination `pickup point id`
- [ ] Опционально через advanced **Диагностика pickup windows** загружены sanitized pickup windows
- [ ] Опционально кнопкой **Use interval** заполнен future `interval_utc` из provider windows
- [ ] Выполнен warehouse → PVZ `Test quote` через `/offers/create` без обязательного interval prereq
- [ ] Для dropoff → PVZ выбран origin `dropoff point id` с `available_for_dropoff=true`
- [ ] Выполнен dropoff → PVZ `Test quote`
- [ ] Для store smoke подготовлен `cart_id` из storefront/dev cart и persisted `connection_id` из saved Yandex connection
- [ ] Выполнен env-var canonical `npm run delivery:store-smoke` для neutral quote + selection
- [ ] Store smoke summary показал `quotes_count > 0`, `selection.saved=true`, `checkout_source_of_truth="unchanged"`
- [ ] Зафиксированы PASS/FAIL по каждому сценарию
- [ ] Проверено отсутствие секретов в отчёте и артефактах

---

## 12) Что вне рамок этого документа

- массовые/нагрузочные тесты;
- production hardening;
- автоматические live-вызовы к Yandex внутри docs-задачи;
- публикация Yandex tokens, auth headers, real provider responses или shipment ids;
- использование local-dev admin credentials на staging/prod.

## 2026-04-27 latest safe findings: pickup windows and 5Post

- **5Post in the Admin UI is expected for the current Yandex sandbox pickup-point catalog.** The admin lookup returns sanitized Yandex pickup point fields, and the visible `5 Post (Пятерочка)` value comes from the Yandex `name` field. Provider remains `yandex`; this is not a UI label bug, not warehouse/provider mapping, and not legacy delivery contamination.
- For `Test_warehouse` / mapped provider warehouse `fbed3aa1-2cc6-4370-ab4d-59c5cc9bb924`, sampled Moscow/near-Moscow PVZ ids from the Yandex list did not produce pickup windows. Safe sampled ids included `0195749be6e...`, `0195749be91...`, `0195749be9b...`, `0195749bedc...`, `0195749bf06...`.
- The original UI failure was reproduced safely on sampled PVZ `0195749be9b...`: admin error `DELIVERY_HUB_PROVIDER_ERROR`, provider status `400`, safe provider code/message `no_delivery_options / No delivery options for interval`.
- Backend request shape was confirmed through safe summaries: test host `https://b2b.taxi.tst.yandex.net/api/b2b/platform`, path `/offers/info?last_mile_policy=self_pickup`, non-empty `places`, mapped source warehouse, and destination PVZ id when selected.
- `destination_point_id` is required for the admin pickup windows lookup flow. Use **Поиск ПВЗ** first, click **Использовать как destination**, then run **Поиск pickup windows**. If no windows are returned and the provider says `no_delivery_options`, pick another PVZ/warehouse pair or obtain documented Yandex sandbox-compatible PVZ ids from provider docs/support.
- One saved test connection later hit provider `403`/access-block and was safely normalized to `DELIVERY_HUB_CREDENTIALS_INVALID`. If this appears again, refresh/replace provider access before further diagnostics.
- 2026-04-27 `/offers/create` follow-up: Yandex docs distinguish `/offers/create` (offer variants / quote-like request, returns `offers[].offer_id`, separate confirmation) from `/request/create` (order creation). A controlled sandbox diagnostic using saved sealed credentials did not print token/auth/raw provider body and did not call shipment/order/confirm endpoints. Documented `/offers/create` shape with test source warehouse `fbed3aa1-2cc6-4370-ab4d-59c5cc9bb924` and sampled destination PVZ reached meaningful JSON validation (`items[0].place_barcode` missing), then access-block resumed after adding matching item/place barcode. Adapter/UI now treat warehouse → PVZ Test quote as `/offers/create` with source warehouse `platform_station_id`; pickup windows are optional helper, not mandatory prerequisite.

### 2026-04-27 current provider `400` diagnosis for `Test quote`

Latest safe Admin retry confirmed the main **4. Проверить стоимость доставки** call uses Yandex Other-day `POST /offers/create`, not the old `pricing-calculator` and not the optional `offers/info` helper. The safe request shape includes warehouse source `platform_station`, destination PVZ `platform_station`, `items`, `places`, matching barcode linkage, `billing_info`, `recipient_info`, dimensions and `last_mile_policy=self_pickup`.

Final sandbox candidate testing found working Yandex Market points. If the UI shows `provider_code=no_delivery_options` and `provider_message=No delivery options for interval`, first check whether the selected point is a random `5Post`/unsupported sandbox pair. If it shows `provider_code=pickups_not_configured`, first check whether optional **Interval from/to** was manually filled: the latest `019c3374bf187276bedb048cb8058c14` case failed with a manual warehouse pickup interval but succeeded without interval. Next manual steps:

1. Keep the saved Yandex sandbox connection selected.
2. In **3. Найти ПВЗ**, use documented filters `geo_id=213`, `operator_id=market_l4g`, `station_type=pickup_point`, `is_yandex_branded=true`, or press **Использовать тестовый PVZ Яндекса**.
3. For deterministic sandbox testing use destination PVZ id `e1139f6d-e34f-47a9-a55f-31f032a861a6` (`Пункт выдачи заказов Яндекс Маркета`, Москва, Ленинградский проспект 27), or another returned `market_l4g` point.
4. In **4. Проверить стоимость доставки**, clear optional **Interval from/to** unless the interval came from provider-supported diagnostics/support.
5. Retry **4. Проверить стоимость доставки** without running shipment/order endpoints.
6. Optionally run **Диагностика pickup windows** for the same pair; it is a helper only and may return provider-specific interval/config reasons.
7. If `market_l4g` / documented PVZ also fails after credentials/access are healthy and interval is empty, request a Yandex-supported sandbox warehouse/PVZ pair or pickup interval from provider docs/support.

The Admin error panel now displays safe fields only: HTTP status, Delivery Hub code, provider status/category, provider code/message, provider path, operator hint and correlation id. It must not display raw token, auth headers, ciphertext or raw provider response body.

### 2026-04-27 manual validation success checkpoint

Manual **Admin → Settings → Delivery → Test quote** validation now has two confirmed quote-only baselines through the direct Yandex adapter:

- `warehouse_to_pickup_point`: direct `POST /offers/create`, `quotes count=4`, currency `RUB`, first/UI price `181.9 rub`, pickup window required `no`, interval empty.
- `dropoff_point_to_pickup_point`: direct `POST /offers/create`, connection `yandexTestname · test · active`, destination PVZ/platform station id `e1139f6d-e34f-47a9-a55f-31f032a861a6`, origin dropoff point id `019d2a9da5877011a771b75e903f3039`, currency `RUB`, quantity `1`, weight `500` grams, declared price `2000`, correlation id `a4adab14-ff1c-40da-a2cd-bfa0726e3be7`, `quotes count=13`, first offer price `181.9 rub`, visible ETA examples `3–4`, `4–5`, `5–6`, `6–7`, pickup window required `no`, provider reference redacted.

No token, auth headers, raw provider body, ciphertext or real secret should be copied into the manual evidence. The storefront-neutral smoke harness is now env-var canonical:

```bash
cd medusa-agency-boilerplate && MEDUSA_PUBLISHABLE_KEY=<store_publishable_key> DELIVERY_HUB_STORE_SMOKE_BACKEND_URL=http://localhost:9000 DELIVERY_HUB_STORE_SMOKE_CONNECTION_ID=<saved_connection_id> DELIVERY_HUB_STORE_SMOKE_CART_ID=<storefront_cart_id> DELIVERY_HUB_STORE_SMOKE_MODE=dropoff_point_to_pickup_point DELIVERY_HUB_STORE_SMOKE_ORIGIN_POINT_ID=019d2a9da5877011a771b75e903f3039 DELIVERY_HUB_STORE_SMOKE_DESTINATION_POINT_ID=e1139f6d-e34f-47a9-a55f-31f032a861a6 DELIVERY_HUB_STORE_SMOKE_CURRENCY_CODE=RUB DELIVERY_HUB_STORE_SMOKE_ITEMS_JSON='[{"quantity":1,"weight_grams":500,"price":2000}]' npm run delivery:store-smoke
```

This verifies Delivery Hub public neutral quote + selection persistence without checkout cutover. Expected success: `quotes_count > 0`, `selection.saved=true`, `checkout_source_of_truth="unchanged"`, safe correlation id present, and no token/auth/raw provider/ciphertext fragments in output. The local `2026-04-27` rerun passed this check for both dropoff→PVZ and warehouse→PVZ scenarios.


### Manual check: advanced shipping-option planner diagnostics

1. Open checkout delivery step with `NEXT_PUBLIC_DELIVERY_HUB_PREVIEW_ENABLED=true`.
2. Confirm the active shopper flow works through buyer-facing hooks from §1.1 and does not show preview/shadow/cutover wording.
3. Open collapsed `data-testid="delivery-hub-dev-diagnostics"` only for operator/dev validation.
4. Confirm `data-testid="delivery-hub-advanced-candidate-status"` shows sanitized shipping-option planner evidence.
5. With no saved Delivery Hub selection, confirm the planner is blocked or missing selection and cannot enable handoff by itself.
6. Save a Delivery Hub selection through the buyer-facing flow. Confirm advanced candidate diagnostics can show a candidate shipping option summary when a safe matching Delivery Hub shipping option is available.
7. Inspect page text/network payloads for absence of raw provider body, raw `quote_key`, provider offer ids, auth headers, tokens, ciphertext, credentials, event logs, or publishable key values.
8. Do not treat planner output as production approval; shipment execution and production rollout remain separately gated.
