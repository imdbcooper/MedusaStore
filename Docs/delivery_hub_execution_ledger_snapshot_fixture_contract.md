# Delivery Hub Execution Ledger Snapshot Fixture Contract

> Статус: canonical docs-only fixture contract note для externally supplied local JSON snapshot around [`normalizeDeliveryHubExecutionLedgerSuppliedSchemaSnapshot()`](../medusa-agency-boilerplate/src/modules/delivery-hub/storage/execution-ledger-schema-check-plan-scaffold.ts:167).
>
> Posture: local-offline, fixture-contract-only, pure-verification-authority-preserving.
>
> Этот документ описывает только canonical externally supplied schema snapshot fixture contract для offline/manual verification path. Он не добавляет runtime capability, DB access, DB introspection, migration execution, repository activation, runtime wiring или ослабление hard blocker в [`createFulfillment()`](../medusa-agency-boilerplate/src/modules/deliveryhub.ts:119).

---

## 1. Authority and scope

Canonical fixture contract materialized at code level through [`DeliveryHubExecutionLedgerSuppliedSchemaSnapshotFixtureContract`](../medusa-agency-boilerplate/src/modules/delivery-hub/storage/execution-ledger-schema-check-plan-scaffold.ts:54), [`DELIVERY_HUB_EXECUTION_LEDGER_SUPPLIED_SCHEMA_SNAPSHOT_FIXTURE_CONTRACT`](../medusa-agency-boilerplate/src/modules/delivery-hub/storage/execution-ledger-schema-check-plan-scaffold.ts:57) and [`validateDeliveryHubExecutionLedgerSuppliedSchemaSnapshotFixtureContract()`](../medusa-agency-boilerplate/src/modules/delivery-hub/storage/execution-ledger-schema-check-plan-scaffold.ts:180).

Normalization authority remains unchanged in [`normalizeDeliveryHubExecutionLedgerSuppliedSchemaSnapshot()`](../medusa-agency-boilerplate/src/modules/delivery-hub/storage/execution-ledger-schema-check-plan-scaffold.ts:167). Compatibility authority remains unchanged in [`buildDeliveryHubExecutionLedgerSchemaCheckPlan()`](../medusa-agency-boilerplate/src/modules/delivery-hub/storage/execution-ledger-schema-check-plan-scaffold.ts:142), [`runDeliveryHubExecutionLedgerSchemaCheckPlan()`](../medusa-agency-boilerplate/src/modules/delivery-hub/storage/execution-ledger-schema-check-plan-scaffold.ts:164) and [`verifyDeliveryHubExecutionLedgerSchemaSnapshot()`](../medusa-agency-boilerplate/src/modules/delivery-hub/storage/execution-ledger-schema-verification-scaffold.ts:243).

The local/offline boundary enforces the same fixture shape through [`parseDeliveryHubExecutionLedgerSuppliedSnapshotJson()`](../medusa-agency-boilerplate/src/modules/delivery-hub/storage/execution-ledger-local-offline-validator-scaffold.ts:205) and [`runDeliveryHubExecutionLedgerLocalOfflineValidator()`](../medusa-agency-boilerplate/src/modules/delivery-hub/storage/execution-ledger-local-offline-validator-scaffold.ts:98).

---

## 2. Canonical contract summary

### 2.1 Accepted root fields

Accepted root fields:

- `tables` — required array
- `indexes` — optional array
- `unique_constraints` — optional array
- `foreign_keys` — optional array

### 2.2 Accepted table fields

Accepted per-table fields:

- `name` — required non-empty string
- `role` — optional, but if present must be one of `main`, `transitions`, `audit_events`
- `columns` — optional array
- `indexes` — optional array
- `unique_constraints` — optional array
- `foreign_keys` — optional array

### 2.3 Accepted column forms

Accepted `columns` entry forms:

1. string form: `<column_name>`
2. object form with:
   - `name` — required non-empty string
   - `type` — optional string
   - `nullable` — optional boolean

### 2.4 Normalized fields

[`normalizeDeliveryHubExecutionLedgerSuppliedSchemaSnapshot()`](../medusa-agency-boilerplate/src/modules/delivery-hub/storage/execution-ledger-schema-check-plan-scaffold.ts:167) normalizes:

- string column entries into object form `{ name }`
- column object entries into verifier-consumable object shape containing only `name`, `type`, `nullable`
- `indexes`, `unique_constraints` and `foreign_keys` arrays into copied verifier-consumable arrays
- `table_name` support remains external to the fixture via existing optional override input on [`buildDeliveryHubExecutionLedgerSchemaCheckPlan()`](../medusa-agency-boilerplate/src/modules/delivery-hub/storage/execution-ledger-schema-check-plan-scaffold.ts:142) and [`runDeliveryHubExecutionLedgerLocalOfflineValidator()`](../medusa-agency-boilerplate/src/modules/delivery-hub/storage/execution-ledger-local-offline-validator-scaffold.ts:98)

### 2.5 Ignored fields

Ignored if present inside accepted object entries:

- unknown extra properties on column object entries
- unknown extra properties on index, unique-constraint and foreign-key object entries
- unknown extra properties on table objects and root object are not used by normalization or verification authority in the current offline/manual contour

This ignored-fields posture does not create new capability. It only preserves current plain-object tolerance while canonical contract examples stay narrow.

### 2.6 Rejected or invalid shapes

Rejected deterministically at the contract boundary or local/offline boundary:

- non-object root payload
- missing or non-array `tables`
- non-object table entries
- missing or empty `table.name`
- invalid `table.role`
- non-array `columns` / `indexes` / `unique_constraints` / `foreign_keys`
- column entries that are neither non-empty strings nor valid objects
- non-string `column.name`
- non-string `column.type`
- non-boolean `column.nullable`
- malformed `columns` lists inside indexes/constraints/foreign keys
- missing or malformed `referenced_table` / `referenced_columns` for foreign keys

---

## 3. Canonical fixture examples

### 3.1 Minimal compatible snapshot

```json
{
  "tables": [
    {
      "name": "deliveryhub_execution_ledger",
      "role": "main",
      "columns": [
        "execution_reference",
        "idempotency_key",
        "execution_payload",
        "reservation_payload",
        "transitions_payload",
        "audit_events_payload",
        "created_at",
        "updated_at"
      ],
      "indexes": [
        {
          "name": "deliveryhub_execution_ledger_pkey",
          "columns": ["execution_reference"],
          "unique": true
        },
        {
          "name": "deliveryhub_execution_ledger_idempotency_key_uidx",
          "columns": ["idempotency_key"],
          "unique": true
        }
      ],
      "unique_constraints": [
        {
          "name": "deliveryhub_execution_ledger_idempotency_key_key",
          "columns": ["idempotency_key"]
        }
      ]
    },
    {
      "name": "deliveryhub_execution_ledger_transitions",
      "role": "transitions",
      "columns": [
        "execution_reference",
        "sequence",
        "recorded_at",
        "from_state",
        "to_state",
        "reason",
        "created_at"
      ],
      "indexes": [
        {
          "name": "deliveryhub_execution_ledger_transitions_execution_sequence_uidx",
          "columns": ["execution_reference", "sequence"],
          "unique": true
        }
      ],
      "unique_constraints": [
        {
          "name": "deliveryhub_execution_ledger_transitions_execution_sequence_key",
          "columns": ["execution_reference", "sequence"]
        }
      ],
      "foreign_keys": [
        {
          "name": "deliveryhub_execution_ledger_transitions_execution_reference_fkey",
          "columns": ["execution_reference"],
          "referenced_table": "deliveryhub_execution_ledger",
          "referenced_columns": ["execution_reference"]
        }
      ]
    },
    {
      "name": "deliveryhub_execution_ledger_audit_events",
      "role": "audit_events",
      "columns": [
        "execution_reference",
        "sequence",
        "recorded_at",
        "event_payload",
        "created_at"
      ],
      "indexes": [
        {
          "name": "deliveryhub_execution_ledger_audit_events_execution_sequence_uidx",
          "columns": ["execution_reference", "sequence"],
          "unique": true
        }
      ],
      "unique_constraints": [
        {
          "name": "deliveryhub_execution_ledger_audit_events_execution_sequence_key",
          "columns": ["execution_reference", "sequence"]
        }
      ],
      "foreign_keys": [
        {
          "name": "deliveryhub_execution_ledger_audit_events_execution_reference_fkey",
          "columns": ["execution_reference"],
          "referenced_table": "deliveryhub_execution_ledger",
          "referenced_columns": ["execution_reference"]
        }
      ]
    }
  ]
}
```

### 3.2 Explicit column-object snapshot

Same snapshot may be supplied with explicit column objects. The normalizer converges this form to the same verifier-consumable shape as the minimal fixture.

```json
{
  "tables": [
    {
      "name": "deliveryhub_execution_ledger",
      "role": "main",
      "columns": [
        {
          "name": "execution_reference",
          "type": "text",
          "nullable": false,
          "reviewer_note": "ignored_by_normalizer"
        },
        {
          "name": "idempotency_key",
          "type": "text",
          "nullable": false,
          "reviewer_note": "ignored_by_normalizer"
        }
      ]
    }
  ]
}
```

The example above is intentionally abbreviated for readability. In practice a compatible explicit fixture still needs the same required table/column/constraint/foreign-key coverage as the minimal compatible snapshot.

### 3.3 Custom `table_name` snapshot

Custom naming remains supported when the externally supplied fixture and explicit override agree:

```json
{
  "tables": [
    {
      "name": "custom_execution_ledger",
      "role": "main"
    },
    {
      "name": "custom_execution_ledger_transitions",
      "role": "transitions"
    },
    {
      "name": "custom_execution_ledger_audit_events",
      "role": "audit_events"
    }
  ]
}
```

Use the custom table-name override through [`validateDeliveryHubExecutionLedgerSnapshot()`](../medusa-agency-boilerplate/src/scripts/validate-delivery-hub-execution-ledger-snapshot.ts:11) only when the supplied snapshot was captured for that same custom table family.

### 3.4 Intentionally mismatching snapshot for reviewer understanding

This form is syntactically valid but intentionally incompatible for reviewer understanding. Example: omit required `event_payload` from the `audit_events` table.

```json
{
  "tables": [
    {
      "name": "deliveryhub_execution_ledger_audit_events",
      "role": "audit_events",
      "columns": [
        "execution_reference",
        "sequence",
        "recorded_at",
        "created_at"
      ]
    }
  ]
}
```

This should remain accepted as a fixture shape, normalized as usual, and then reported as `incompatible` by the existing pure verification authority because the required schema contract is drifted.

---

## 4. Truthful posture reminders

- Current readiness contour remains `artifact_defined -> manual_application_external -> snapshot_verification_available -> activation_blocked`.
- [`createFulfillment()`](../medusa-agency-boilerplate/src/modules/deliveryhub.ts:119) remains hard-blocked.
- No DB access, DB introspection, migration execution, repository activation, transaction-runner activation, runtime wiring, provider dispatch, shipment creation, order mutation, fulfillment mutation or checkout/storefront cutover are introduced by this fixture contract.
- Canonical JSON envelope and exit-code semantics remain owned by [`validateDeliveryHubExecutionLedgerSnapshot()`](../medusa-agency-boilerplate/src/scripts/validate-delivery-hub-execution-ledger-snapshot.ts:11).
