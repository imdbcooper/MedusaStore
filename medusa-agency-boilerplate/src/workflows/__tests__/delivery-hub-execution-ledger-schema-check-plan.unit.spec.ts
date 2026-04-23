import { describe, expect, it } from "@jest/globals"
import {
  buildDeliveryHubExecutionLedgerSchemaCheckPlan,
  DELIVERY_HUB_EXECUTION_LEDGER_SUPPLIED_SCHEMA_SNAPSHOT_FIXTURE_CONTRACT,
  normalizeDeliveryHubExecutionLedgerSuppliedSchemaSnapshot,
  runDeliveryHubExecutionLedgerSchemaCheckPlan,
  validateDeliveryHubExecutionLedgerSuppliedSchemaSnapshotFixtureContract,
  type DeliveryHubExecutionLedgerExternallySuppliedPlainSchemaSnapshot,
} from "../../modules/delivery-hub/storage/execution-ledger-schema-check-plan-scaffold"
import {
  type DeliveryHubExecutionLedgerSuppliedSchemaSnapshot,
  verifyDeliveryHubExecutionLedgerSchemaSnapshot,
} from "../../modules/delivery-hub/storage/execution-ledger-schema-verification-scaffold"

describe("Delivery Hub execution ledger schema check-plan scaffold", () => {
  it("builds deterministic check plan for compatible externally supplied snapshot", () => {
    const snapshot = buildExternalSnapshot()

    const result = buildDeliveryHubExecutionLedgerSchemaCheckPlan({ snapshot })

    expect(result.mode).toBe("pure_snapshot_check_plan")
    expect(result.source).toBe("externally_supplied_schema_snapshot")
    expect(result.verifier_mode).toBe("pure_snapshot_verification")
    expect(result.table_name).toBe("deliveryhub_execution_ledger")
    expect(result.verification_result.verdict).toBe("compatible")
    expect(result.verification_result.mismatches).toEqual([])
    expect(result.planned_checks.tables).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "main",
          table: "deliveryhub_execution_ledger",
          source: "descriptor_and_migration_artifact",
        }),
        expect.objectContaining({
          role: "transitions",
          table: "deliveryhub_execution_ledger_transitions",
          source: "descriptor_and_migration_artifact",
        }),
        expect.objectContaining({
          role: "audit_events",
          table: "deliveryhub_execution_ledger_audit_events",
          source: "descriptor_and_migration_artifact",
        }),
      ])
    )
    expect(result.planned_checks.columns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: "deliveryhub_execution_ledger",
          column: "execution_reference",
        }),
        expect.objectContaining({
          table: "deliveryhub_execution_ledger_transitions",
          column: "sequence",
        }),
        expect.objectContaining({
          table: "deliveryhub_execution_ledger_audit_events",
          column: "event_payload",
        }),
      ])
    )
    expect(result.planned_checks.unique_or_index_constraints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: "deliveryhub_execution_ledger",
          columns: ["idempotency_key"],
        }),
        expect.objectContaining({
          table: "deliveryhub_execution_ledger_transitions",
          columns: ["execution_reference", "sequence"],
        }),
        expect.objectContaining({
          table: "deliveryhub_execution_ledger_audit_events",
          columns: ["execution_reference", "sequence"],
        }),
      ])
    )
    expect(result.planned_checks.foreign_keys).toEqual([
      {
        table: "deliveryhub_execution_ledger_transitions",
        name: "deliveryhub_execution_ledger_transitions_execution_reference_fkey",
        columns: ["execution_reference"],
        referenced_table: "deliveryhub_execution_ledger",
        referenced_columns: ["execution_reference"],
        source: "migration_artifact",
      },
      {
        table: "deliveryhub_execution_ledger_audit_events",
        name: "deliveryhub_execution_ledger_audit_events_execution_reference_fkey",
        columns: ["execution_reference"],
        referenced_table: "deliveryhub_execution_ledger",
        referenced_columns: ["execution_reference"],
        source: "migration_artifact",
      },
    ])
  })

  it("normalizes canonical minimal fixture and explicit column fixture to equivalent verifier-consumable shape", () => {
    const minimalFixture = buildCanonicalMinimalFixture()
    const explicitFixture = buildCanonicalExplicitColumnFixture()

    const normalizedMinimal = normalizeDeliveryHubExecutionLedgerSuppliedSchemaSnapshot(minimalFixture)
    const normalizedExplicit = normalizeDeliveryHubExecutionLedgerSuppliedSchemaSnapshot(explicitFixture)
    const minimalPlan = buildDeliveryHubExecutionLedgerSchemaCheckPlan({ snapshot: minimalFixture })
    const explicitPlan = buildDeliveryHubExecutionLedgerSchemaCheckPlan({ snapshot: explicitFixture })
    const verifierResult = verifyDeliveryHubExecutionLedgerSchemaSnapshot({
      snapshot: normalizedMinimal,
    })
    const runnerResult = runDeliveryHubExecutionLedgerSchemaCheckPlan({ snapshot: minimalFixture })

    expect(normalizedMinimal.tables.map((table) => table.columns?.map((column) => column.name))).toEqual(
      normalizedExplicit.tables.map((table) => table.columns?.map((column) => column.name))
    )
    expect(normalizedMinimal.tables.map((table) => table.name)).toEqual(
      normalizedExplicit.tables.map((table) => table.name)
    )
    expect(minimalPlan.normalized_snapshot).toEqual(normalizedMinimal)
    expect(minimalPlan.verification_result).toEqual(verifierResult)
    expect(explicitPlan.verification_result).toEqual(verifierResult)
    expect(runnerResult).toEqual(verifierResult)
  })

  it("materializes canonical externally supplied fixture contract metadata", () => {
    expect(DELIVERY_HUB_EXECUTION_LEDGER_SUPPLIED_SCHEMA_SNAPSHOT_FIXTURE_CONTRACT).toEqual({
      accepted_root_fields: ["tables", "indexes", "unique_constraints", "foreign_keys"],
      optional_root_fields: ["indexes", "unique_constraints", "foreign_keys"],
      accepted_table_fields: [
        "name",
        "role",
        "columns",
        "indexes",
        "unique_constraints",
        "foreign_keys",
      ],
      optional_table_fields: ["role", "columns", "indexes", "unique_constraints", "foreign_keys"],
      accepted_column_forms: ["string", "object"],
      normalized_column_object_fields: ["name", "type", "nullable"],
      ignored_unknown_object_fields: true,
      rejected_invalid_shapes: true,
    })
  })

  it("accepts documented canonical fixture examples and normalizes them as documented", () => {
    const sourceLabel = "inline-canonical-fixtures"
    const minimalFixture = validateDeliveryHubExecutionLedgerSuppliedSchemaSnapshotFixtureContract({
      value: buildCanonicalMinimalFixture(),
      source_label: sourceLabel,
    })
    const explicitFixture = validateDeliveryHubExecutionLedgerSuppliedSchemaSnapshotFixtureContract({
      value: buildCanonicalExplicitColumnFixture(),
      source_label: sourceLabel,
    })
    const customTableFixture = validateDeliveryHubExecutionLedgerSuppliedSchemaSnapshotFixtureContract({
      value: buildCanonicalCustomTableFixture(),
      source_label: sourceLabel,
    })

    expect(
      normalizeDeliveryHubExecutionLedgerSuppliedSchemaSnapshot(minimalFixture).tables.map((table) =>
        table.columns?.map((column) => column.name)
      )
    ).toEqual(
      normalizeDeliveryHubExecutionLedgerSuppliedSchemaSnapshot(explicitFixture).tables.map((table) =>
        table.columns?.map((column) => column.name)
      )
    )
    expect(
      normalizeDeliveryHubExecutionLedgerSuppliedSchemaSnapshot(customTableFixture).tables.map(
        (table) => table.name
      )
    ).toEqual([
      "custom_execution_ledger",
      "custom_execution_ledger_transitions",
      "custom_execution_ledger_audit_events",
    ])
  })

  it("preserves intentionally mismatching fixture example as incompatible reviewer evidence", () => {
    const mismatchingFixture = buildCanonicalIntentionallyMismatchingFixture()

    const result = buildDeliveryHubExecutionLedgerSchemaCheckPlan({
      snapshot: mismatchingFixture,
    })

    expect(result.verification_result.verdict).toBe("incompatible")
    expect(result.verification_result.mismatches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "missing_column",
          table: "deliveryhub_execution_ledger_audit_events",
          column: "event_payload",
        }),
      ])
    )
  })

  it("rejects malformed or drifted fixture contract shapes deterministically", () => {
    expect(() =>
      validateDeliveryHubExecutionLedgerSuppliedSchemaSnapshotFixtureContract({
        value: {
          tables: [
            {
              name: "deliveryhub_execution_ledger",
              role: "wrong_role",
            },
          ],
        },
        source_label: "inline-invalid-role",
      })
    ).toThrow(
      "Delivery Hub execution ledger supplied schema snapshot fixture contract expected table.role to be one of main, transitions, audit_events at inline-invalid-role.tables[0]."
    )

    expect(() =>
      validateDeliveryHubExecutionLedgerSuppliedSchemaSnapshotFixtureContract({
        value: {
          tables: [
            {
              name: "deliveryhub_execution_ledger",
              role: "main",
              columns: [{ name: "execution_reference", nullable: "no" }],
            },
          ],
        },
        source_label: "inline-invalid-column",
      })
    ).toThrow(
      "Delivery Hub execution ledger supplied schema snapshot fixture contract expected optional boolean column.nullable at inline-invalid-column.tables[0].columns[0]."
    )
  })

  it("preserves missing table mismatch from verifier", () => {
    const snapshot = buildExternalSnapshot()
    snapshot.tables = snapshot.tables.filter((table) => table.role !== "main")

    const result = buildDeliveryHubExecutionLedgerSchemaCheckPlan({ snapshot })

    expect(result.verification_result.verdict).toBe("incompatible")
    expect(result.verification_result.mismatches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "missing_table",
          table: "deliveryhub_execution_ledger",
          role: "main",
        }),
      ])
    )
  })

  it("preserves missing column mismatch from verifier", () => {
    const snapshot = buildExternalSnapshot()
    const main = requireSnapshotTable(snapshot, "deliveryhub_execution_ledger")
    main.columns = main.columns?.filter((column) => column !== "execution_payload")

    const result = buildDeliveryHubExecutionLedgerSchemaCheckPlan({ snapshot })

    expect(result.verification_result.verdict).toBe("incompatible")
    expect(result.verification_result.mismatches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "missing_column",
          table: "deliveryhub_execution_ledger",
          column: "execution_payload",
        }),
      ])
    )
  })

  it("preserves missing unique/index mismatch from verifier", () => {
    const snapshot = buildExternalSnapshot()
    const transitions = requireSnapshotTable(snapshot, "deliveryhub_execution_ledger_transitions")
    transitions.indexes = []
    transitions.unique_constraints = []

    const result = buildDeliveryHubExecutionLedgerSchemaCheckPlan({ snapshot })

    expect(result.verification_result.verdict).toBe("incompatible")
    expect(result.verification_result.mismatches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "missing_unique_or_index_constraint",
          table: "deliveryhub_execution_ledger_transitions",
          columns: ["execution_reference", "sequence"],
        }),
      ])
    )
  })

  it("preserves missing and wrong foreign key mismatches from verifier", () => {
    const missingSnapshot = buildExternalSnapshot()
    requireSnapshotTable(missingSnapshot, "deliveryhub_execution_ledger_transitions").foreign_keys = []

    const missingResult = buildDeliveryHubExecutionLedgerSchemaCheckPlan({ snapshot: missingSnapshot })

    expect(missingResult.verification_result.mismatches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "missing_foreign_key",
          table: "deliveryhub_execution_ledger_transitions",
          columns: ["execution_reference"],
        }),
      ])
    )

    const wrongSnapshot = buildExternalSnapshot()
    requireSnapshotTable(
      wrongSnapshot,
      "deliveryhub_execution_ledger_audit_events"
    ).foreign_keys = [
      {
        name: "wrong_audit_fkey",
        columns: ["execution_reference"],
        referenced_table: "wrong_table",
        referenced_columns: ["wrong_column"],
      },
    ]

    const wrongResult = buildDeliveryHubExecutionLedgerSchemaCheckPlan({ snapshot: wrongSnapshot })

    expect(wrongResult.verification_result.mismatches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "wrong_foreign_key_target",
          table: "deliveryhub_execution_ledger_audit_events",
          columns: ["execution_reference"],
          expected: ["deliveryhub_execution_ledger", "execution_reference"],
          actual: ["wrong_table", "wrong_column"],
        }),
      ])
    )
  })

  it("supports custom table_name consistently", () => {
    const snapshot = buildExternalSnapshot("custom_execution_ledger")

    const result = buildDeliveryHubExecutionLedgerSchemaCheckPlan({
      table_name: "custom_execution_ledger",
      snapshot,
    })

    expect(result.table_name).toBe("custom_execution_ledger")
    expect(result.normalized_snapshot.tables.map((table) => table.name)).toEqual([
      "custom_execution_ledger",
      "custom_execution_ledger_transitions",
      "custom_execution_ledger_audit_events",
    ])
    expect(result.planned_checks.tables.map((table) => table.table)).toEqual([
      "custom_execution_ledger",
      "custom_execution_ledger_transitions",
      "custom_execution_ledger_audit_events",
    ])
    expect(result.verification_result.verdict).toBe("compatible")
  })

  it("returns stable repeated output for identical input", () => {
    const snapshot = buildExternalSnapshot()

    const first = buildDeliveryHubExecutionLedgerSchemaCheckPlan({ snapshot })
    const second = buildDeliveryHubExecutionLedgerSchemaCheckPlan({ snapshot })

    expect(second).toEqual(first)
    expect(JSON.stringify(second)).toBe(JSON.stringify(first))
  })

  it("confirms all runtime and DB guardrails remain disabled", () => {
    const result = buildDeliveryHubExecutionLedgerSchemaCheckPlan({
      snapshot: buildExternalSnapshot(),
    })

    expect(result.disabled_confirmations).toEqual({
      db_connection: false,
      db_introspection: false,
      repository_required: false,
      db_adapter_required: false,
      sql_execution: false,
      migration_application: false,
      runtime_table_creation: false,
      runtime_wiring: false,
      transaction_runner: false,
      admin_exposure: false,
    })
  })

  it("requires only inline plain snapshot fixtures", () => {
    const snapshot = buildExternalSnapshot()
    const normalized = normalizeDeliveryHubExecutionLedgerSuppliedSchemaSnapshot(snapshot)

    expect(Array.isArray(snapshot.tables)).toBe(true)
    expect(Array.isArray(normalized.tables)).toBe(true)
    expect(normalized).toEqual(expect.any(Object))
    expect(normalized).not.toBe(snapshot as unknown as DeliveryHubExecutionLedgerSuppliedSchemaSnapshot)
  })
})

function buildCanonicalMinimalFixture(
  tableName = "deliveryhub_execution_ledger"
): DeliveryHubExecutionLedgerExternallySuppliedPlainSchemaSnapshot {
  return buildExternalSnapshot(tableName)
}

function buildCanonicalExplicitColumnFixture(
  tableName = "deliveryhub_execution_ledger"
): DeliveryHubExecutionLedgerExternallySuppliedPlainSchemaSnapshot {
  return convertSnapshotColumnsToExplicitObjects(buildExternalSnapshot(tableName))
}

function buildCanonicalCustomTableFixture(): DeliveryHubExecutionLedgerExternallySuppliedPlainSchemaSnapshot {
  return buildCanonicalExplicitColumnFixture("custom_execution_ledger")
}

function buildCanonicalIntentionallyMismatchingFixture(): DeliveryHubExecutionLedgerExternallySuppliedPlainSchemaSnapshot {
  const snapshot = buildCanonicalExplicitColumnFixture()
  const auditTable = requireSnapshotTable(snapshot, "deliveryhub_execution_ledger_audit_events")
  auditTable.columns = auditTable.columns?.filter(
    (column) => typeof column !== "string" && column.name !== "event_payload"
  )
  return snapshot
}

function buildExternalSnapshot(
  tableName = "deliveryhub_execution_ledger"
): DeliveryHubExecutionLedgerExternallySuppliedPlainSchemaSnapshot {
  const mainTable = tableName
  const transitionTable = `${tableName}_transitions`
  const auditTable = `${tableName}_audit_events`

  return {
    tables: [
      {
        name: mainTable,
        role: "main",
        columns: [
          "execution_reference",
          "idempotency_key",
          "execution_payload",
          "reservation_payload",
          "transitions_payload",
          "audit_events_payload",
          "created_at",
          "updated_at",
        ],
        indexes: [
          {
            name: `${mainTable}_pkey`,
            columns: ["execution_reference"],
            unique: true,
          },
          {
            name: `${mainTable}_idempotency_key_uidx`,
            columns: ["idempotency_key"],
            unique: true,
          },
        ],
        unique_constraints: [
          {
            name: `${mainTable}_idempotency_key_key`,
            columns: ["idempotency_key"],
          },
        ],
      },
      {
        name: transitionTable,
        role: "transitions",
        columns: [
          "execution_reference",
          "sequence",
          "recorded_at",
          "from_state",
          "to_state",
          "reason",
          "created_at",
        ],
        indexes: [
          {
            name: `${transitionTable}_execution_sequence_uidx`,
            columns: ["execution_reference", "sequence"],
            unique: true,
          },
        ],
        unique_constraints: [
          {
            name: `${transitionTable}_execution_sequence_key`,
            columns: ["execution_reference", "sequence"],
          },
        ],
        foreign_keys: [
          {
            name: `${transitionTable}_execution_reference_fkey`,
            columns: ["execution_reference"],
            referenced_table: mainTable,
            referenced_columns: ["execution_reference"],
          },
        ],
      },
      {
        name: auditTable,
        role: "audit_events",
        columns: [
          "execution_reference",
          "sequence",
          "recorded_at",
          "event_payload",
          "created_at",
        ],
        indexes: [
          {
            name: `${auditTable}_execution_sequence_uidx`,
            columns: ["execution_reference", "sequence"],
            unique: true,
          },
        ],
        unique_constraints: [
          {
            name: `${auditTable}_execution_sequence_key`,
            columns: ["execution_reference", "sequence"],
          },
        ],
        foreign_keys: [
          {
            name: `${auditTable}_execution_reference_fkey`,
            columns: ["execution_reference"],
            referenced_table: mainTable,
            referenced_columns: ["execution_reference"],
          },
        ],
      },
    ],
  }
}

function requireSnapshotTable(
  snapshot: DeliveryHubExecutionLedgerExternallySuppliedPlainSchemaSnapshot,
  tableName: string
): DeliveryHubExecutionLedgerExternallySuppliedPlainSchemaSnapshot["tables"][number] {
  const table = snapshot.tables.find((entry) => entry.name === tableName)

  if (!table) {
    throw new Error(`Missing test snapshot table ${tableName}.`)
  }

  return table
}

function convertSnapshotColumnsToExplicitObjects(
  snapshot: DeliveryHubExecutionLedgerExternallySuppliedPlainSchemaSnapshot
): DeliveryHubExecutionLedgerExternallySuppliedPlainSchemaSnapshot {
  return {
    ...snapshot,
    tables: snapshot.tables.map((table) => ({
      ...table,
      columns: table.columns?.map((column) =>
        typeof column === "string"
          ? {
              name: column,
              type: inferColumnType(column),
              nullable: inferColumnNullable(column),
              reviewer_note: "ignored_by_normalizer",
            }
          : {
              ...column,
              reviewer_note: "ignored_by_normalizer",
            }
      ),
    })),
  }
}

function inferColumnType(column: string): string {
  if (column === "sequence") {
    return "integer"
  }

  if (column.endsWith("_at")) {
    return "timestamptz"
  }

  if (column.endsWith("_payload")) {
    return "jsonb"
  }

  return "text"
}

function inferColumnNullable(column: string): boolean {
  return column === "updated_at"
}
