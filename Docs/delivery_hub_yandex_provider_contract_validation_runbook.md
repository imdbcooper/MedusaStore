# Delivery Hub Yandex provider-contract validation runbook (manual-only)

> Статус: `2026-04-24`.
>
> Назначение: безопасный, ручной и reviewable контур валидации provider-contract для Delivery Hub Yandex operations без автоматических live вызовов в этом tranche.
>
> Канонический script entrypoint: [`medusa-agency-boilerplate/src/scripts/delivery-hub-yandex-provider-contract-validation.ts`](../medusa-agency-boilerplate/src/scripts/delivery-hub-yandex-provider-contract-validation.ts).

---

## 1) Scope этого runbook

Этот runbook покрывает только controlled/manual validation contour для сценариев:

1. create shipment validation;
2. shipment info/status refresh validation;
3. cancel shipment validation;
4. repeated/already-cancelled cancel handling;
5. missing/invalid provider shipment reference;
6. sanitized provider failure;
7. duplicate prevention/idempotency posture;
8. evidence bundle и redaction rules.

Этот документ **не** означает, что live evidence уже собрано автоматически. В текущем tranche materialized только harness + runbook + no-network coverage.

---

## 2) Жёсткие safety boundaries

Harness из [`delivery-hub-yandex-provider-contract-validation.ts`](../medusa-agency-boilerplate/src/scripts/delivery-hub-yandex-provider-contract-validation.ts) спроектирован fail-closed:

- default mode = `plan`;
- default dry-run = `true`;
- live call не выполняется автоматически;
- требуется явный opt-in env: `DELIVERY_HUB_YANDEX_PROVIDER_CONTRACT_VALIDATION_LIVE_ENABLED=true`;
- требуется явное подтверждение: `--live-confirm=I_UNDERSTAND_LIVE_PROVIDER_CALLS`;
- без `DELIVERY_HUB_ENCRYPTION_KEY` в live режиме gate блокирует выполнение;
- без готового connection (`active + enabled + sealed`, provider=`yandex`) gate блокирует выполнение;
- structured output всегда redacted/sanitized.

В текущем tranche `live_call_performed` остаётся `false` во всех no-network сценариях harness.

---

## 3) Supported operations

Поддерживаемые `--operation`:

- `create_shipment`
- `refresh_status`
- `cancel_shipment`
- `repeated_cancel`
- `missing_provider_shipment_reference`
- `invalid_provider_shipment_reference`
- `sanitized_provider_failure`
- `duplicate_prevention_posture`

---

## 4) Baseline usage (plan/dry-run only)

Запускать из backend repo (`medusa-agency-boilerplate`) через `medusa exec`:

```bash
npx medusa exec ./src/scripts/delivery-hub-yandex-provider-contract-validation.ts --operation=create_shipment
```

Примеры безопасного plan-mode запуска:

```bash
npx medusa exec ./src/scripts/delivery-hub-yandex-provider-contract-validation.ts --operation=refresh_status --connection-id=<connection_id>
npx medusa exec ./src/scripts/delivery-hub-yandex-provider-contract-validation.ts --operation=cancel_shipment --connection-id=<connection_id> --provider-shipment-reference=<masked_or_test_ref>
npx medusa exec ./src/scripts/delivery-hub-yandex-provider-contract-validation.ts --operation=duplicate_prevention_posture --connection-id=<connection_id>
```

Ожидаемо в default-path:

- `invocation.mode = "plan"`
- `invocation.dry_run = true`
- `gate.status = "blocked_default_dry_run"`
- `invocation.live_call_performed = false`

---

## 5) Controlled live-session preflight (manual operator decision)

Live session допускается только вручную и только после отдельного operator approval.

Минимальные preconditions:

1. оператор осознанно включает env gate: `DELIVERY_HUB_YANDEX_PROVIDER_CONTRACT_VALIDATION_LIVE_ENABLED=true`;
2. передаёт `--mode=live --dry-run=false`;
3. передаёт `--live-confirm=I_UNDERSTAND_LIVE_PROVIDER_CALLS`;
4. backend runtime имеет `DELIVERY_HUB_ENCRYPTION_KEY`;
5. выбранный connection действительно готов: `enabled=true`, `status=active`, `credentials_state=sealed`, `provider_code=yandex`.

Пример preflight-команды (не auto-run, operator-only):

```bash
DELIVERY_HUB_YANDEX_PROVIDER_CONTRACT_VALIDATION_LIVE_ENABLED=true npx medusa exec ./src/scripts/delivery-hub-yandex-provider-contract-validation.ts --mode=live --dry-run=false --operation=refresh_status --connection-id=<connection_id> --provider-shipment-reference=<reference> --live-confirm=I_UNDERSTAND_LIVE_PROVIDER_CALLS
```

Если любой prerequisite отсутствует, harness обязан вернуть blocked gate (`blocked_live_opt_in_required`, `blocked_live_confirm_required`, `blocked_encryption_key_required`, `blocked_connection_*` и т.д.).

---

## 6) Validation matrix (manual runbook)

### 6.1 Create shipment contract

Цель: проверить prepared contract surface для create shipment.

- command: `--operation=create_shipment`
- expected: evidence содержит `create_shipment_dispatch_contract` summary;
- leakage check: нет raw payload/credentials/provider ids.

### 6.2 Shipment info/status refresh

Цель: проверить status request/normalization contour.

- command: `--operation=refresh_status --provider-shipment-reference=<ref>`
- expected: evidence с `refresh_status_contract` и neutral status summary;
- leakage check: `shipment_id` masked/redacted.

### 6.3 Cancel shipment

Цель: проверить cancel contract surface.

- command: `--operation=cancel_shipment --provider-shipment-reference=<ref>`
- expected: evidence с `cancel_contract`, `cancel_request_present=true`.

### 6.4 Repeated/already-cancelled

Цель: проверить `already_cancelled` posture.

- command: `--operation=repeated_cancel --provider-shipment-reference=<ref>`
- expected: simulated cancel summary указывает already-cancelled semantics.

### 6.5 Missing provider shipment reference

Цель: fail-safe/blocked path.

- command: `--operation=missing_provider_shipment_reference`
- expected: status request не materialize-ится (`status_request_present=false` или blocked evidence).

### 6.6 Invalid provider shipment reference

Цель: некорректный reference path.

- command: `--operation=invalid_provider_shipment_reference`
- expected: cancel request unavailable/blocked semantics либо safe normalized result без raw identifiers.

### 6.7 Sanitized provider failure

Цель: проверить redacted failure surface.

- command: `--operation=sanitized_provider_failure --force-provider-failure=true`
- expected: failure normalized; нет raw provider response/request/auth/token.

### 6.8 Duplicate prevention / idempotency posture

Цель: зафиксировать posture, что live retry redispatch не materialized.

- command: `--operation=duplicate_prevention_posture`
- expected: evidence показывает `idempotency_scope=deliveryhub:create_shipment`, duplicate-prevention guardrails, `live_retry_redispatch_materialized=false`.

---

## 7) Evidence bundle rules (required)

Разрешённый evidence артефакт для этого runbook — только redacted structured JSON output harness.

### 7.1 Обязательно включать

- timestamp запуска;
- operation;
- invocation summary (`mode`, `dry_run`, `live_call_attempted`, `live_call_performed`);
- gate summary (`status`, `reason_code`);
- primary/additional evidence summary;
- anti-leak confirmations.

### 7.2 Запрещено включать

- raw credentials/tokens/keys/secrets;
- raw auth headers;
- raw provider request/response payload bodies;
- raw quote keys;
- raw provider shipment ids/references;
- raw execution secrets/references;
- full unredacted operator env dump.

### 7.3 Redaction policy

Для evidence serialization используется helper [`medusa-agency-boilerplate/src/modules/delivery-hub/provider-contract-validation-evidence.ts`](../medusa-agency-boilerplate/src/modules/delivery-hub/provider-contract-validation-evidence.ts):

- secret-like fields -> `***`;
- provider/reference-like fields -> masked form (`xx***yy` or `***`);
- payload-like fields -> `[REDACTED_PAYLOAD]`;
- anti-leak flags всегда explicit `false` для raw/secrets inclusion.

---

## 8) Contract certainty / uncertainty (truthful)

- Create/status/cancel seams в коде materialized на adapter boundary и покрыты no-network tests.
- Для Yandex cancel semantics в local code/docs нет полностью authoritative live provider contract; текущая certainty остаётся adapter-boundary + mocked/no-network until manual live validation.
- Этот runbook/harness tranche intentionally не заявляет production SLA certainty для cancel/retry-adjacent live semantics.

---

## 9) Deferred items (explicit)

По итогам этого tranche остаются deferred:

- фактический manual live evidence collection (если оператор отдельно не запускал live с явным opt-in);
- production live retry redispatch;
- scheduler/background queue/auto-retry;
- webhooks;
- broad shipment dashboard/table/filter/export;
- storefront/store shipment operations APIs;
- checkout rewrite/cutover changes.
