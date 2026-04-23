import { describe, expect, it } from "@jest/globals"
import {
  buildDeliveryHubExecutionLedgerExpectedSchemaContract,
  type DeliveryHubExecutionLedgerSuppliedSchemaSnapshot,
  verifyDeliveryHubExecutionLedgerSchemaSnapshot,
} from "../../modules/delivery-hub/storage/execution-ledger-schema-verification-scaffold"

describe("Delivery Hub execution ledger schema verification scaffold", () => {
  it("reports happy-path compatibility for default tables", () => {
    const snapshot = buildCompatibleSnapshot()
    const result = verifyDeliveryHubExecutionLedgerSchemaSnapshot({ snapshot })

    expect(result.verdict).toBe("compatible")
    expect(result.mismatches).toEqual([])
    expect(result.table_name).toBe("deliveryhub_execution_ledger")
    expect(result.trace.checked_table_names).toEqual([
      "deliveryhub_execution_ledger",
      "deliveryhub_execution_ledger_transitions",
      "deliveryhub_execution_ledger_audit_events",
    ])
  })

  it("supports custom table-name compatibility consistently with descriptors and artifact", () => {
    const snapshot = buildCompatibleSnapshot("custom_execution_ledger")
    const result = verifyDeliveryHubExecutionLedgerSchemaSnapshot({
      table_name: "custom_execution_ledger",
      snapshot,
    })

    expect(result.verdict).toBe("compatible")
    expect(result.expected.descriptor_tables).toEqual({
      main: "custom_execution_ledger",
      transitions: "custom_execution_ledger_transitions",
      audit_events: "custom_execution_ledger_audit_events",
    })
    expect(result.expected.tables.map((table) => table.table)).toEqual([
      "custom_execution_ledger",
      "custom_execution_ledger_transitions",
      "custom_execution_ledger_audit_events",
    ])
  })

  it("reports missing main table", () => {
    const snapshot = buildCompatibleSnapshot()
    snapshot.tables = snapshot.tables.filter((table) => table.role !== "main")

    const result = verifyDeliveryHubExecutionLedgerSchemaSnapshot({ snapshot })

    expect(result.verdict).toBe("incompatible")
    expect(result.mismatches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "missing_table",
          table: "deliveryhub_execution_ledger",
          role: "main",
        }),
      ])
    )
  })

  it("reports missing transition table and audit table", () => {
    const snapshot = buildCompatibleSnapshot()
    snapshot.tables = snapshot.tables.filter((table) => table.role === "main")

    const result = verifyDeliveryHubExecutionLedgerSchemaSnapshot({ snapshot })

    expect(result.verdict).toBe("incompatible")
    expect(result.mismatches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "missing_table",
          table: "deliveryhub_execution_ledger_transitions",
          role: "transitions",
        }),
        expect.objectContaining({
          code: "missing_table",
          table: "deliveryhub_execution_ledger_audit_events",
          role: "audit_events",
        }),
      ])
    )
  })

  it("reports missing required main payload columns and child event payload", () => {
    const snapshot = buildCompatibleSnapshot()
    const main = requireSnapshotTable(snapshot, "deliveryhub_execution_ledger")
    main.columns = main.columns?.filter(
      (column) =>
        ![
          "execution_payload",
          "reservation_payload",
          "transitions_payload",
          "audit_events_payload",
        ].includes(column.name)
    )
    const audit = requireSnapshotTable(snapshot, "deliveryhub_execution_ledger_audit_events")
    audit.columns = audit.columns?.filter((column) => column.name !== "event_payload")

    const result = verifyDeliveryHubExecutionLedgerSchemaSnapshot({ snapshot })

    expect(result.verdict).toBe("incompatible")
    expect(result.mismatches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "missing_column", column: "execution_payload" }),
        expect.objectContaining({ code: "missing_column", column: "reservation_payload" }),
        expect.objectContaining({ code: "missing_column", column: "transitions_payload" }),
        expect.objectContaining({ code: "missing_column", column: "audit_events_payload" }),
        expect.objectContaining({
          code: "missing_column",
          table: "deliveryhub_execution_ledger_audit_events",
          column: "event_payload",
        }),
      ])
    )
  })

  it("reports idempotency uniqueness mismatch", () => {
    const snapshot = buildCompatibleSnapshot()
    const main = requireSnapshotTable(snapshot, "deliveryhub_execution_ledger")
    main.indexes = main.indexes?.filter((index) => index.columns.join("|") !== "idempotency_key")
    main.unique_constraints = main.unique_constraints?.filter(
      (constraint) => constraint.columns.join("|") !== "idempotency_key"
    )

    const result = verifyDeliveryHubExecutionLedgerSchemaSnapshot({ snapshot })

    expect(result.verdict).toBe("incompatible")
    expect(result.mismatches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "missing_unique_or_index_constraint",
          table: "deliveryhub_execution_ledger",
          columns: ["idempotency_key"],
        }),
      ])
    )
  })

  it("reports transition and audit sequence uniqueness mismatch", () => {
    const snapshot = buildCompatibleSnapshot()
    const transitions = requireSnapshotTable(snapshot, "deliveryhub_execution_ledger_transitions")
    transitions.indexes = []
    transitions.unique_constraints = []
    const audit = requireSnapshotTable(snapshot, "deliveryhub_execution_ledger_audit_events")
    audit.indexes = []
    audit.unique_constraints = []

    const result = verifyDeliveryHubExecutionLedgerSchemaSnapshot({ snapshot })

    expect(result.verdict).toBe("incompatible")
    expect(result.mismatches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "missing_unique_or_index_constraint",
          table: "deliveryhub_execution_ledger_transitions",
          columns: ["execution_reference", "sequence"],
        }),
        expect.objectContaining({
          code: "missing_unique_or_index_constraint",
          table: "deliveryhub_execution_ledger_audit_events",
          columns: ["execution_reference", "sequence"],
        }),
      ])
    )
  })

  it("reports child-table foreign key missing", () => {
    const snapshot = buildCompatibleSnapshot()
    requireSnapshotTable(snapshot, "deliveryhub_execution_ledger_transitions").foreign_keys = []

    const result = verifyDeliveryHubExecutionLedgerSchemaSnapshot({ snapshot })

    expect(result.verdict).toBe("incompatible")
    expect(result.mismatches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "missing_foreign_key",
          table: "deliveryhub_execution_ledger_transitions",
          columns: ["execution_reference"],
        }),
      ])
    )
  })

  it("reports child-table foreign key targeting wrong table or column", () => {
    const snapshot = buildCompatibleSnapshot()
    const audit = requireSnapshotTable(snapshot, "deliveryhub_execution_ledger_audit_events")
    audit.foreign_keys = [
      {
        name: "wrong_audit_fkey",
        columns: ["execution_reference"],
        referenced_table: "wrong_table",
        referenced_columns: ["wrong_column"],
      },
    ]

    const result = verifyDeliveryHubExecutionLedgerSchemaSnapshot({ snapshot })

    expect(result.verdict).toBe("incompatible")
    expect(result.mismatches).toEqual(
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

  it("returns deterministic repeated verification result", () => {
    const snapshot = buildCompatibleSnapshot()
    const first = verifyDeliveryHubExecutionLedgerSchemaSnapshot({ snapshot })
    const second = verifyDeliveryHubExecutionLedgerSchemaSnapshot({ snapshot })

    expect(second).toEqual(first)
    expect(JSON.stringify(second)).toBe(JSON.stringify(first))
  })

  it("requires no connection, repository, or DB adapter", () => {
    const expected = buildDeliveryHubExecutionLedgerExpectedSchemaContract()
    const result = verifyDeliveryHubExecutionLedgerSchemaSnapshot({
      snapshot: buildCompatibleSnapshot(),
    })

    expect(expected.runtime_application_enabled).toBe(false)
    expect(result.disabled_confirmations).toEqual({
      connection_required: false,
      repository_required: false,
      db_adapter_required: false,
      sql_execution: false,
      migration_application: false,
      runtime_table_creation: false,
      runtime_wiring: false,
    })
  })
})

function buildCompatibleSnapshot(
  tableName = "deliveryhub_execution_ledger"
): DeliveryHubExecutionLedgerSuppliedSchemaSnapshot {
  const mainTable = tableName
  const transitionTable = `${tableName}_transitions`
  const auditTable = `${tableName}_audit_events`

  return {
    tables: [
      {
        name: mainTable,
        role: "main",
        columns: [
          { name: "execution_reference" },
          { name: "idempotency_key" },
          { name: "execution_payload" },
          { name: "reservation_payload" },
          { name: "transitions_payload" },
          { name: "audit_events_payload" },
          { name: "created_at" },
          { name: "updated_at" },
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
          { name: "execution_reference" },
          { name: "sequence" },
          { name: "recorded_at" },
          { name: "from_state" },
          { name: "to_state" },
          { name: "reason" },
          { name: "created_at" },
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
          { name: "execution_reference" },
          { name: "sequence" },
          { name: "recorded_at" },
          { name: "event_payload" },
          { name: "created_at" },
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
  snapshot: DeliveryHubExecutionLedgerSuppliedSchemaSnapshot,
  tableName: string
): DeliveryHubExecutionLedgerSuppliedSchemaSnapshot["tables"][number] {
  const table = snapshot.tables.find((entry) => entry.name === tableName)

  if (!table) {
    throw new Error(`Missing test snapshot table ${tableName}.`)
  }

  return table
}
