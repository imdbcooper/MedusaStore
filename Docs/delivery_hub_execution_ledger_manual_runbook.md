# Delivery Hub Execution Ledger Manual Runbook

> Статус: documentation-only operational runbook для manual external migration review/application и externally supplied schema snapshot verification.
>
> Posture: plan-only, admin-unexposed, runtime-unwired, manual external preparation only.
>
> Этот документ описывает только операторский review/apply/verify contour вокруг inert migration artifact и pure snapshot verification scaffolds. Он не означает runtime activation, не включает DB wiring, не включает app-driven migration application и не ослабляет hard blockers.

---

## 1. Purpose and posture

Этот runbook нужен для одного approved manual contour:

1. review inert execution-ledger schema artifact;
2. manually apply schema changes outside application runtime;
3. capture externally supplied schema snapshot outside application runtime;
4. normalize snapshot к plain supplied contract;
5. conceptually verify compatibility через existing pure check-plan and verifier layers;
6. persist evidence и остановиться на `activation_blocked`.

Каноническая readiness contour для этого шага уже зафиксирована в коде как:

- `artifact_defined`
- `manual_application_external`
- `snapshot_verification_available`
- `activation_blocked`

Эта contour отражена в readiness source of truth и должна читаться буквально: artifact уже определён, manual external application остаётся внешним шагом, snapshot verification уже доступен как pure/manual capability, а runtime activation остаётся заблокированной.

---

## 2. Preconditions and source of truth

Для короткого operator/reviewer entry path использовать navigation-only [`delivery_hub_execution_ledger_operator_reviewer_quickstart.md`](./delivery_hub_execution_ledger_operator_reviewer_quickstart.md), но authority для manual workflow остаётся в этом runbook.

Перед любыми manual действиями оператор должен опираться только на уже approved scaffolds:

- readiness source of truth: `buildDeliveryHubExecutionLedgerRepositoryAssemblyReadiness()`
- readiness contour: `persistence_readiness_contour`
- schema verification availability: `schema_verification_layer`
- inert schema artifact: `buildDeliveryHubExecutionLedgerPgMigrationArtifact()`
- pure verifier: `verifyDeliveryHubExecutionLedgerSchemaSnapshot()`
- pure check-plan builder: `buildDeliveryHubExecutionLedgerSchemaCheckPlan()`
- pure check-plan runner: `runDeliveryHubExecutionLedgerSchemaCheckPlan()`
- externally supplied snapshot vocabulary: `DeliveryHubExecutionLedgerExternallySuppliedPlainSchemaSnapshot`
- plain table snapshot vocabulary: `DeliveryHubExecutionLedgerPlainSchemaTableSnapshot`
- canonical fixture contract authority: `DeliveryHubExecutionLedgerSuppliedSchemaSnapshotFixtureContract`
- canonical fixture validator: `validateDeliveryHubExecutionLedgerSuppliedSchemaSnapshotFixtureContract()`
- verifier snapshot vocabulary: `DeliveryHubExecutionLedgerSuppliedSchemaSnapshot`
- snapshot normalization seam: `normalizeDeliveryHubExecutionLedgerSuppliedSchemaSnapshot()`
- canonical fixture-contract note: [`delivery_hub_execution_ledger_snapshot_fixture_contract.md`](./delivery_hub_execution_ledger_snapshot_fixture_contract.md)

Также должны оставаться truthfully preserved следующие guardrails:

- migration artifact inert only;
- schema application external/manual only;
- no DB introspection inside app runtime;
- no migration application by app runtime;
- no runtime wiring;
- no admin exposure;
- no repository activation;
- `createFulfillment()` remains hard-blocked.

---

## 3. Canonical contour mapping

| Contour stage | Meaning now | Operator action posture |
| --- | --- | --- |
| `artifact_defined` | Inert schema artifact exists and is reviewable | Review approved artifact only |
| `manual_application_external` | Any schema application remains external to app runtime | Apply manually outside runtime only |
| `snapshot_verification_available` | Pure snapshot verifier and check-plan are available | Supply snapshot manually and verify conceptually |
| `activation_blocked` | Runtime activation is not approved | Stop after evidence capture |

---

## 4. Canonical snapshot vocabulary

Для manual snapshot preparation использовать только vocabulary, совместимый с approved snapshot/check-plan scaffolds.

### 4.1 Root snapshot contract

Externally supplied plain snapshot must match the canonical plain supplied contract shape:

- `tables`: required array of plain table snapshots
- optional `indexes`: root-level index snapshots
- optional `unique_constraints`: root-level unique constraint snapshots
- optional `foreign_keys`: root-level foreign key snapshots

Accepted/optional/normalized/ignored/rejected fixture semantics are now documented canonically in [`delivery_hub_execution_ledger_snapshot_fixture_contract.md`](./delivery_hub_execution_ledger_snapshot_fixture_contract.md) and trace directly to `DeliveryHubExecutionLedgerSuppliedSchemaSnapshotFixtureContract` plus `validateDeliveryHubExecutionLedgerSuppliedSchemaSnapshotFixtureContract()`.

Это соответствует plain contract vocabulary вокруг `DeliveryHubExecutionLedgerExternallySuppliedPlainSchemaSnapshot`.

### 4.2 Table snapshot contract

Каждый table entry должен быть совместим с `DeliveryHubExecutionLedgerPlainSchemaTableSnapshot`:

- `name`: фактическое внешнее имя таблицы
- `role`: canonical role for execution-ledger schema table
- optional `columns`
- optional `indexes`
- optional `unique_constraints`
- optional `foreign_keys`

Canonical execution-ledger roles для supplied snapshot:

- `main`
- `transitions`
- `audit_events`

### 4.3 Column vocabulary

Plain snapshot допускает компактную или расширенную форму column entries:

- string form: column name only
- object form: `name`, optional `type`, optional `nullable`

Object-form extra fields may be present in externally supplied reviewer fixtures, but current normalization seam preserves only `name`, `type`, `nullable` for verifier-consumable shape.

Для compatibility authority наличие required column names важнее, чем попытка invent additional runtime metadata.

### 4.4 Constraint and foreign-key vocabulary

Plain snapshot должен использовать следующие canonical fields:

- index: `name`, `table`, `columns`, `unique`
- unique constraint: `name`, `table`, `columns`
- foreign key: `name`, `table`, `columns`, `referenced_table`, `referenced_columns`

### 4.5 Normalization posture

Если внешний snapshot captured в более сыром или heterogeneous виде, он должен быть manually reshaped к plain supplied contract и затем conceptualized as normalized through `normalizeDeliveryHubExecutionLedgerSuppliedSchemaSnapshot()` before verification. Это normalization step только для data shaping around the supplied snapshot contract; оно не означает DB access, app introspection или runtime mediation.

---

## 5. Sequential manual workflow

### Step 1. Review inert migration artifact

Source of truth: inert artifact from `buildDeliveryHubExecutionLedgerPgMigrationArtifact()`.

Operator review should confirm only the documented artifact surface:

- main ledger table is defined;
- transition log table is defined;
- audit event table is defined;
- unique idempotency lookup exists for main table;
- deterministic `execution_reference, sequence` uniqueness exists for child tables;
- child-table foreign keys target the main ledger table;
- artifact remains inert and `runtime_application_enabled=false`.

Что нельзя утверждать на этом шаге:

- что migration уже applied;
- что tables уже существуют в target database;
- что repository already wired or active;
- что runtime can perform DDL.

Completion status for this step maps to contour term `artifact_defined`.

### Step 2. Manually apply externally and outside runtime

Operator may manually apply the reviewed schema externally, outside application runtime, using organization-approved external DB administration process.

Этот runbook не определяет scripts, CLI, app commands, admin screens или automated execution path. Он фиксирует только posture:

- application happens outside app runtime;
- application remains manual and externally controlled;
- no app-driven migration execution occurs;
- no runtime table creation occurs.

Completion status for this step maps to contour term `manual_application_external`.

### Step 3. Capture external schema snapshot outside application runtime

После external manual application оператор должен получить schema snapshot тоже вне application runtime.

Snapshot capture evidence must be external/manual only:

- no in-app introspection;
- no repository-mediated inspection;
- no runtime verification endpoint;
- no admin screen export.

Captured snapshot should describe the externally observed schema state for the execution-ledger tables, columns, unique/index constraints and foreign keys.

### Step 4. Shape and normalize snapshot to the plain supplied contract

Prepared external snapshot must then be manually shaped to the plain supplied contract expected by `buildDeliveryHubExecutionLedgerSchemaCheckPlan()`.

Operator should ensure the supplied structure is aligned with approved vocabulary:

- root object compatible with `DeliveryHubExecutionLedgerExternallySuppliedPlainSchemaSnapshot`
- table entries compatible with `DeliveryHubExecutionLedgerPlainSchemaTableSnapshot`
- roles mapped canonically as `main`, `transitions`, `audit_events`
- constraints and foreign keys represented using the approved plain field names
- fixture examples and invalid-shape expectations aligned with [`delivery_hub_execution_ledger_snapshot_fixture_contract.md`](./delivery_hub_execution_ledger_snapshot_fixture_contract.md)

After shaping, the snapshot is conceptually normalization-ready for the verifier-compatible supplied contract exposed via `normalizeDeliveryHubExecutionLedgerSuppliedSchemaSnapshot()`. Malformed fixture shapes should be treated as contract-boundary failures before any compatibility verdict is interpreted.

### Step 5. Verify conceptually through the existing pure check-plan layer

Verification authority remains the already approved pure layers:

1. shape external snapshot for `buildDeliveryHubExecutionLedgerSchemaCheckPlan()`;
2. rely on the check-plan to normalize the supplied snapshot into verifier-compatible form;
3. rely on `runDeliveryHubExecutionLedgerSchemaCheckPlan()` for final compatibility verdict semantics;
4. understand that final compatibility authority is delegated to `verifyDeliveryHubExecutionLedgerSchemaSnapshot()`.

Expected conceptual outputs for operator review:

- plan mode remains pure snapshot check only;
- source remains externally supplied schema snapshot;
- planned checks cover tables, columns, unique-or-index constraints and foreign keys;
- verification verdict is interpreted as `compatible` or `incompatible` only;
- mismatch inventory, if present, is treated as review evidence rather than runtime remediation;
- if the local validator script is used, stdout should be attached as the canonical versioned JSON evidence envelope rather than reformatted ad hoc.

Completion status for this step maps to contour term `snapshot_verification_available`.

### Step 6. Record evidence and stop at `activation_blocked`

After external application review and snapshot verification evidence are assembled, operator must package the bundle according to [`delivery_hub_execution_ledger_evidence_bundle_packaging_convention.md`](./delivery_hub_execution_ledger_evidence_bundle_packaging_convention.md), prepare reviewer-ready submission completeness against [`delivery_hub_execution_ledger_evidence_submission_checklist.md`](./delivery_hub_execution_ledger_evidence_submission_checklist.md) and stop at `activation_blocked`.

This runbook does not authorize:

- runtime activation;
- repository wiring;
- transaction runner introduction;
- app-level migration application;
- DB introspection inside runtime;
- create-fulfillment unblocking.

Final posture remains exactly `activation_blocked` until separate approved work explicitly covers activation prerequisites such as operational review and safety review.

---

## 6. Evidence model

Operator should attach or store review evidence sufficient for asynchronous human review. Evidence may be stored in the organization-approved review location, but this runbook does not define or require a new storage system. Canonical bundle identity and attachment naming are defined in [`delivery_hub_execution_ledger_evidence_bundle_packaging_convention.md`](./delivery_hub_execution_ledger_evidence_bundle_packaging_convention.md), while canonical reviewer intake completeness, required attachment set and incomplete-package return conditions are defined in [`delivery_hub_execution_ledger_evidence_submission_checklist.md`](./delivery_hub_execution_ledger_evidence_submission_checklist.md).

Recommended evidence set:

1. Artifact review evidence
   - reviewed artifact identity
   - reviewed table names
   - reviewed column/constraint/foreign-key expectations
   - reviewer identity and review date

2. External manual application evidence
   - confirmation that application happened externally and outside runtime
   - target environment classification without secrets
   - operator identity and application date
   - scope summary of what was manually applied

3. External schema snapshot evidence
   - supplied plain snapshot payload or redacted equivalent
   - source note stating the snapshot was captured externally
   - snapshot capture date
   - reviewer/operator identity

4. Verification evidence
   - normalized/plain contract review note
   - check-plan/verifier verdict summary
   - mismatch inventory if verdict is `incompatible`
   - table-name context if custom `table_name` was used

5. Final status evidence
   - explicit contour progression summary
   - explicit final status `activation_blocked`
   - explicit confirmation that runtime activation and `createFulfillment()` unblock were not performed

Evidence must avoid real secrets, credentials, connection strings, hostnames or environment values.

---

## 7. Stop conditions

Operator must stop immediately if any of the following is true:

- inert artifact review is incomplete or disputed;
- external manual application cannot be independently evidenced;
- external snapshot does not map cleanly to the plain supplied contract;
- snapshot lacks canonical role mapping for `main`, `transitions`, `audit_events`;
- verification result is `incompatible`;
- review attempts start to depend on app runtime DB access, in-app introspection or repository activation;
- any step would imply enabling runtime migration application or weakening the hard block in `createFulfillment()`.

In all such cases the truthful outcome remains `activation_blocked`.

---

## 8. Explicit non-goals

This runbook intentionally does not cover and does not imply any of the following:

- automatic migrations
- runtime DDL or table creation
- DB connection from app runtime for verification
- DB introspection inside app runtime
- repository activation or container wiring
- transaction runner enablement
- admin exposure
- provider dispatch
- live shipment creation
- order mutation
- fulfillment mutation
- retry scheduling
- compensation writes
- checkout or storefront cutover
- ApiShip weakening or removal
- official Admin patching
- unblocking `createFulfillment()`

---

## 9. Truthful end state

At the end of this runbook the only truthful completion statement is:

- migration artifact is defined and reviewable;
- external manual application may have been reviewed and evidenced;
- external schema snapshot may have been shaped and conceptually verified against the approved pure check-plan and verifier layers;
- runtime activation remains blocked;
- final contour state remains `activation_blocked`.
