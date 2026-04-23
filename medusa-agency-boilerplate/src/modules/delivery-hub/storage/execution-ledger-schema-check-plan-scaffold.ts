import {
  DELIVERY_HUB_EXECUTION_LEDGER_SCHEMA_VERIFICATION_MODE,
  type DeliveryHubExecutionLedgerExpectedSchemaContract,
  type DeliveryHubExecutionLedgerSchemaVerificationResult,
  type DeliveryHubExecutionLedgerSuppliedSchemaColumnSnapshot,
  type DeliveryHubExecutionLedgerSuppliedSchemaForeignKeySnapshot,
  type DeliveryHubExecutionLedgerSuppliedSchemaIndexSnapshot,
  type DeliveryHubExecutionLedgerSuppliedSchemaSnapshot,
  type DeliveryHubExecutionLedgerSuppliedSchemaTableSnapshot,
  type DeliveryHubExecutionLedgerSuppliedSchemaUniqueConstraintSnapshot,
  verifyDeliveryHubExecutionLedgerSchemaSnapshot,
} from "./execution-ledger-schema-verification-scaffold"

export const DELIVERY_HUB_EXECUTION_LEDGER_SCHEMA_CHECK_PLAN_VERSION = 1
export const DELIVERY_HUB_EXECUTION_LEDGER_SCHEMA_CHECK_PLAN_MODE = "pure_snapshot_check_plan"
export const DELIVERY_HUB_EXECUTION_LEDGER_SCHEMA_CHECK_PLAN_SOURCE = "externally_supplied_schema_snapshot"

export type DeliveryHubExecutionLedgerSchemaCheckPlanMode =
  typeof DELIVERY_HUB_EXECUTION_LEDGER_SCHEMA_CHECK_PLAN_MODE

export type DeliveryHubExecutionLedgerSchemaCheckPlanSource =
  typeof DELIVERY_HUB_EXECUTION_LEDGER_SCHEMA_CHECK_PLAN_SOURCE

export type DeliveryHubExecutionLedgerPlainSchemaColumnSnapshot =
  | string
  | DeliveryHubExecutionLedgerSuppliedSchemaColumnSnapshot

export type DeliveryHubExecutionLedgerPlainSchemaIndexSnapshot =
  DeliveryHubExecutionLedgerSuppliedSchemaIndexSnapshot

export type DeliveryHubExecutionLedgerPlainSchemaUniqueConstraintSnapshot =
  DeliveryHubExecutionLedgerSuppliedSchemaUniqueConstraintSnapshot

export type DeliveryHubExecutionLedgerPlainSchemaForeignKeySnapshot =
  DeliveryHubExecutionLedgerSuppliedSchemaForeignKeySnapshot

export type DeliveryHubExecutionLedgerPlainSchemaTableSnapshot = Omit<
  DeliveryHubExecutionLedgerSuppliedSchemaTableSnapshot,
  "columns" | "indexes" | "unique_constraints" | "foreign_keys"
> & {
  columns?: DeliveryHubExecutionLedgerPlainSchemaColumnSnapshot[]
  indexes?: DeliveryHubExecutionLedgerPlainSchemaIndexSnapshot[]
  unique_constraints?: DeliveryHubExecutionLedgerPlainSchemaUniqueConstraintSnapshot[]
  foreign_keys?: DeliveryHubExecutionLedgerPlainSchemaForeignKeySnapshot[]
}

export type DeliveryHubExecutionLedgerExternallySuppliedPlainSchemaSnapshot = {
  tables: DeliveryHubExecutionLedgerPlainSchemaTableSnapshot[]
  indexes?: DeliveryHubExecutionLedgerPlainSchemaIndexSnapshot[]
  unique_constraints?: DeliveryHubExecutionLedgerPlainSchemaUniqueConstraintSnapshot[]
  foreign_keys?: DeliveryHubExecutionLedgerPlainSchemaForeignKeySnapshot[]
}

export type DeliveryHubExecutionLedgerSuppliedSchemaSnapshotFixtureContract =
  DeliveryHubExecutionLedgerExternallySuppliedPlainSchemaSnapshot

export const DELIVERY_HUB_EXECUTION_LEDGER_SUPPLIED_SCHEMA_SNAPSHOT_FIXTURE_CONTRACT = {
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
} as const

export type DeliveryHubExecutionLedgerSchemaCheckPlanInput = {
  table_name?: string
  snapshot: DeliveryHubExecutionLedgerExternallySuppliedPlainSchemaSnapshot
}

export type DeliveryHubExecutionLedgerSchemaCheckPlanDisabledConfirmations = {
  db_connection: false
  db_introspection: false
  repository_required: false
  db_adapter_required: false
  sql_execution: false
  migration_application: false
  runtime_table_creation: false
  runtime_wiring: false
  transaction_runner: false
  admin_exposure: false
}

export type DeliveryHubExecutionLedgerSchemaCheckPlanTableCheck = {
  role: DeliveryHubExecutionLedgerExpectedSchemaContract["tables"][number]["role"]
  table: string
  entity: DeliveryHubExecutionLedgerExpectedSchemaContract["tables"][number]["entity"]
  source: "descriptor_and_migration_artifact"
}

export type DeliveryHubExecutionLedgerSchemaCheckPlanColumnCheck = {
  table: string
  column: string
  nullable: boolean
  kind: DeliveryHubExecutionLedgerExpectedSchemaContract["tables"][number]["columns"][number]["kind"]
  source: DeliveryHubExecutionLedgerExpectedSchemaContract["tables"][number]["columns"][number]["source"]
}

export type DeliveryHubExecutionLedgerSchemaCheckPlanUniqueOrIndexCheck = {
  table: string
  name: string
  columns: string[]
  unique: true
  source: DeliveryHubExecutionLedgerExpectedSchemaContract["tables"][number]["unique_or_index_constraints"][number]["source"]
  purpose?: string
}

export type DeliveryHubExecutionLedgerSchemaCheckPlanForeignKeyCheck = {
  table: string
  name: string
  columns: string[]
  referenced_table: string
  referenced_columns: string[]
  source: "migration_artifact"
}

export type DeliveryHubExecutionLedgerSchemaCheckPlanPlannedChecks = {
  tables: DeliveryHubExecutionLedgerSchemaCheckPlanTableCheck[]
  columns: DeliveryHubExecutionLedgerSchemaCheckPlanColumnCheck[]
  unique_or_index_constraints: DeliveryHubExecutionLedgerSchemaCheckPlanUniqueOrIndexCheck[]
  foreign_keys: DeliveryHubExecutionLedgerSchemaCheckPlanForeignKeyCheck[]
}

export type DeliveryHubExecutionLedgerSchemaCheckPlan = {
  version: typeof DELIVERY_HUB_EXECUTION_LEDGER_SCHEMA_CHECK_PLAN_VERSION
  mode: DeliveryHubExecutionLedgerSchemaCheckPlanMode
  source: DeliveryHubExecutionLedgerSchemaCheckPlanSource
  verifier_mode: typeof DELIVERY_HUB_EXECUTION_LEDGER_SCHEMA_VERIFICATION_MODE
  table_name: string
  normalized_snapshot: DeliveryHubExecutionLedgerSuppliedSchemaSnapshot
  planned_checks: DeliveryHubExecutionLedgerSchemaCheckPlanPlannedChecks
  verification_result: DeliveryHubExecutionLedgerSchemaVerificationResult
  disabled_confirmations: DeliveryHubExecutionLedgerSchemaCheckPlanDisabledConfirmations
}

export function buildDeliveryHubExecutionLedgerSchemaCheckPlan(
  input: DeliveryHubExecutionLedgerSchemaCheckPlanInput
): DeliveryHubExecutionLedgerSchemaCheckPlan {
  const normalizedSnapshot = normalizeDeliveryHubExecutionLedgerSuppliedSchemaSnapshot(input.snapshot)
  const verificationResult = verifyDeliveryHubExecutionLedgerSchemaSnapshot({
    table_name: input.table_name,
    snapshot: normalizedSnapshot,
  })

  return {
    version: DELIVERY_HUB_EXECUTION_LEDGER_SCHEMA_CHECK_PLAN_VERSION,
    mode: DELIVERY_HUB_EXECUTION_LEDGER_SCHEMA_CHECK_PLAN_MODE,
    source: DELIVERY_HUB_EXECUTION_LEDGER_SCHEMA_CHECK_PLAN_SOURCE,
    verifier_mode: DELIVERY_HUB_EXECUTION_LEDGER_SCHEMA_VERIFICATION_MODE,
    table_name: verificationResult.table_name,
    normalized_snapshot: normalizedSnapshot,
    planned_checks: buildPlannedChecks(verificationResult.expected),
    verification_result: verificationResult,
    disabled_confirmations: buildDisabledConfirmations(),
  }
}

export function runDeliveryHubExecutionLedgerSchemaCheckPlan(
  input: DeliveryHubExecutionLedgerSchemaCheckPlanInput
): DeliveryHubExecutionLedgerSchemaVerificationResult {
  return buildDeliveryHubExecutionLedgerSchemaCheckPlan(input).verification_result
}

export function normalizeDeliveryHubExecutionLedgerSuppliedSchemaSnapshot(
  snapshot: DeliveryHubExecutionLedgerExternallySuppliedPlainSchemaSnapshot
): DeliveryHubExecutionLedgerSuppliedSchemaSnapshot {
  return {
    tables: snapshot.tables.map((table) => normalizeTableSnapshot(table)),
    indexes: normalizeOptionalIndexes(snapshot.indexes),
    unique_constraints: normalizeOptionalUniqueConstraints(snapshot.unique_constraints),
    foreign_keys: normalizeOptionalForeignKeys(snapshot.foreign_keys),
  }
}

export function validateDeliveryHubExecutionLedgerSuppliedSchemaSnapshotFixtureContract(input: {
  value: unknown
  source_label: string
}): DeliveryHubExecutionLedgerExternallySuppliedPlainSchemaSnapshot {
  if (!isRecord(input.value)) {
    throw new Error(
      `Delivery Hub execution ledger supplied schema snapshot fixture contract expected root JSON object at ${input.source_label}.`
    )
  }

  if (!Array.isArray(input.value.tables)) {
    throw new Error(
      `Delivery Hub execution ledger supplied schema snapshot fixture contract expected root.tables array at ${input.source_label}.`
    )
  }

  validateTableSnapshots(input.value.tables, input.source_label)
  validateOptionalIndexes(input.value.indexes, `${input.source_label}.indexes`)
  validateOptionalUniqueConstraints(
    input.value.unique_constraints,
    `${input.source_label}.unique_constraints`
  )
  validateOptionalForeignKeys(input.value.foreign_keys, `${input.source_label}.foreign_keys`)

  return input.value as DeliveryHubExecutionLedgerExternallySuppliedPlainSchemaSnapshot
}

function normalizeTableSnapshot(
  table: DeliveryHubExecutionLedgerPlainSchemaTableSnapshot
): DeliveryHubExecutionLedgerSuppliedSchemaTableSnapshot {
  return {
    name: table.name,
    role: table.role,
    columns: normalizeOptionalColumns(table.columns),
    indexes: normalizeOptionalIndexes(table.indexes),
    unique_constraints: normalizeOptionalUniqueConstraints(table.unique_constraints),
    foreign_keys: normalizeOptionalForeignKeys(table.foreign_keys),
  }
}

function normalizeOptionalColumns(
  columns: DeliveryHubExecutionLedgerPlainSchemaColumnSnapshot[] | undefined
): DeliveryHubExecutionLedgerSuppliedSchemaColumnSnapshot[] | undefined {
  if (!columns) {
    return undefined
  }

  return columns.map((column) => {
    if (typeof column === "string") {
      return { name: column }
    }

    return {
      name: column.name,
      type: column.type,
      nullable: column.nullable,
    }
  })
}

function normalizeOptionalIndexes(
  indexes: DeliveryHubExecutionLedgerPlainSchemaIndexSnapshot[] | undefined
): DeliveryHubExecutionLedgerSuppliedSchemaIndexSnapshot[] | undefined {
  if (!indexes) {
    return undefined
  }

  return indexes.map((index) => ({
    name: index.name,
    table: index.table,
    columns: [...index.columns],
    unique: index.unique,
  }))
}

function normalizeOptionalUniqueConstraints(
  uniqueConstraints: DeliveryHubExecutionLedgerPlainSchemaUniqueConstraintSnapshot[] | undefined
): DeliveryHubExecutionLedgerSuppliedSchemaUniqueConstraintSnapshot[] | undefined {
  if (!uniqueConstraints) {
    return undefined
  }

  return uniqueConstraints.map((constraint) => ({
    name: constraint.name,
    table: constraint.table,
    columns: [...constraint.columns],
  }))
}

function normalizeOptionalForeignKeys(
  foreignKeys: DeliveryHubExecutionLedgerPlainSchemaForeignKeySnapshot[] | undefined
): DeliveryHubExecutionLedgerSuppliedSchemaForeignKeySnapshot[] | undefined {
  if (!foreignKeys) {
    return undefined
  }

  return foreignKeys.map((foreignKey) => ({
    name: foreignKey.name,
    table: foreignKey.table,
    columns: [...foreignKey.columns],
    referenced_table: foreignKey.referenced_table,
    referenced_columns: [...foreignKey.referenced_columns],
  }))
}

function validateTableSnapshots(tables: unknown[], sourceLabel: string): void {
  tables.forEach((table, index) => {
    const tableLabel = `${sourceLabel}.tables[${index}]`

    if (!isRecord(table)) {
      throw new Error(
        `Delivery Hub execution ledger supplied schema snapshot fixture contract expected object table entry at ${tableLabel}.`
      )
    }

    if (typeof table.name !== "string" || table.name.trim().length === 0) {
      throw new Error(
        `Delivery Hub execution ledger supplied schema snapshot fixture contract expected non-empty string table.name at ${tableLabel}.`
      )
    }

    if (table.role !== undefined && !isRecognizedTableRole(table.role)) {
      throw new Error(
        `Delivery Hub execution ledger supplied schema snapshot fixture contract expected table.role to be one of main, transitions, audit_events at ${tableLabel}.`
      )
    }

    validateOptionalColumns(table.columns, `${tableLabel}.columns`)
    validateOptionalIndexes(table.indexes, `${tableLabel}.indexes`)
    validateOptionalUniqueConstraints(table.unique_constraints, `${tableLabel}.unique_constraints`)
    validateOptionalForeignKeys(table.foreign_keys, `${tableLabel}.foreign_keys`)
  })
}

function validateOptionalColumns(columns: unknown, sourceLabel: string): void {
  if (columns === undefined) {
    return
  }

  if (!Array.isArray(columns)) {
    throw new Error(
      `Delivery Hub execution ledger supplied schema snapshot fixture contract expected array at ${sourceLabel}.`
    )
  }

  columns.forEach((column, index) => {
    const columnLabel = `${sourceLabel}[${index}]`

    if (typeof column === "string") {
      if (column.trim().length === 0) {
        throw new Error(
          `Delivery Hub execution ledger supplied schema snapshot fixture contract expected non-empty string column name at ${columnLabel}.`
        )
      }

      return
    }

    if (!isRecord(column)) {
      throw new Error(
        `Delivery Hub execution ledger supplied schema snapshot fixture contract expected column string or object at ${columnLabel}.`
      )
    }

    if (typeof column.name !== "string" || column.name.trim().length === 0) {
      throw new Error(
        `Delivery Hub execution ledger supplied schema snapshot fixture contract expected non-empty string column.name at ${columnLabel}.`
      )
    }

    if (column.type !== undefined && typeof column.type !== "string") {
      throw new Error(
        `Delivery Hub execution ledger supplied schema snapshot fixture contract expected optional string column.type at ${columnLabel}.`
      )
    }

    if (column.nullable !== undefined && typeof column.nullable !== "boolean") {
      throw new Error(
        `Delivery Hub execution ledger supplied schema snapshot fixture contract expected optional boolean column.nullable at ${columnLabel}.`
      )
    }
  })
}

function validateOptionalIndexes(indexes: unknown, sourceLabel: string): void {
  validateOptionalConstraintCollection(indexes, sourceLabel, {
    requireUniqueFlag: true,
    requireReferenceTarget: false,
  })
}

function validateOptionalUniqueConstraints(uniqueConstraints: unknown, sourceLabel: string): void {
  validateOptionalConstraintCollection(uniqueConstraints, sourceLabel, {
    requireUniqueFlag: false,
    requireReferenceTarget: false,
  })
}

function validateOptionalForeignKeys(foreignKeys: unknown, sourceLabel: string): void {
  validateOptionalConstraintCollection(foreignKeys, sourceLabel, {
    requireUniqueFlag: false,
    requireReferenceTarget: true,
  })
}

function validateOptionalConstraintCollection(
  value: unknown,
  sourceLabel: string,
  options: {
    requireUniqueFlag: boolean
    requireReferenceTarget: boolean
  }
): void {
  if (value === undefined) {
    return
  }

  if (!Array.isArray(value)) {
    throw new Error(
      `Delivery Hub execution ledger supplied schema snapshot fixture contract expected array at ${sourceLabel}.`
    )
  }

  value.forEach((entry, index) => {
    const entryLabel = `${sourceLabel}[${index}]`

    if (!isRecord(entry)) {
      throw new Error(
        `Delivery Hub execution ledger supplied schema snapshot fixture contract expected object entry at ${entryLabel}.`
      )
    }

    if (entry.name !== undefined && typeof entry.name !== "string") {
      throw new Error(
        `Delivery Hub execution ledger supplied schema snapshot fixture contract expected optional string name at ${entryLabel}.`
      )
    }

    if (entry.table !== undefined && typeof entry.table !== "string") {
      throw new Error(
        `Delivery Hub execution ledger supplied schema snapshot fixture contract expected optional string table at ${entryLabel}.`
      )
    }

    if (!Array.isArray(entry.columns) || !entry.columns.every(isNonEmptyString)) {
      throw new Error(
        `Delivery Hub execution ledger supplied schema snapshot fixture contract expected columns string[] at ${entryLabel}.`
      )
    }

    if (options.requireUniqueFlag && entry.unique !== undefined && typeof entry.unique !== "boolean") {
      throw new Error(
        `Delivery Hub execution ledger supplied schema snapshot fixture contract expected optional boolean unique at ${entryLabel}.`
      )
    }

    if (!options.requireReferenceTarget) {
      return
    }

    if (typeof entry.referenced_table !== "string" || entry.referenced_table.trim().length === 0) {
      throw new Error(
        `Delivery Hub execution ledger supplied schema snapshot fixture contract expected non-empty string referenced_table at ${entryLabel}.`
      )
    }

    if (
      !Array.isArray(entry.referenced_columns) ||
      !entry.referenced_columns.every(isNonEmptyString)
    ) {
      throw new Error(
        `Delivery Hub execution ledger supplied schema snapshot fixture contract expected referenced_columns string[] at ${entryLabel}.`
      )
    }
  })
}

function isRecognizedTableRole(role: unknown): role is DeliveryHubExecutionLedgerSuppliedSchemaTableSnapshot["role"] {
  return role === "main" || role === "transitions" || role === "audit_events"
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function buildPlannedChecks(
  expected: DeliveryHubExecutionLedgerExpectedSchemaContract
): DeliveryHubExecutionLedgerSchemaCheckPlanPlannedChecks {
  return {
    tables: expected.tables.map((table) => ({
      role: table.role,
      table: table.table,
      entity: table.entity,
      source: "descriptor_and_migration_artifact",
    })),
    columns: expected.tables.flatMap((table) =>
      table.columns.map((column) => ({
        table: table.table,
        column: column.name,
        nullable: column.nullable,
        kind: column.kind,
        source: column.source,
      }))
    ),
    unique_or_index_constraints: expected.tables.flatMap((table) =>
      table.unique_or_index_constraints.map((constraint) => ({
        table: table.table,
        name: constraint.name,
        columns: [...constraint.columns],
        unique: constraint.unique,
        source: constraint.source,
        purpose: constraint.purpose,
      }))
    ),
    foreign_keys: expected.tables.flatMap((table) =>
      table.foreign_keys.map((foreignKey) => ({
        table: table.table,
        name: foreignKey.name,
        columns: [...foreignKey.columns],
        referenced_table: foreignKey.referenced_table,
        referenced_columns: [...foreignKey.referenced_columns],
        source: foreignKey.source,
      }))
    ),
  }
}

function buildDisabledConfirmations(): DeliveryHubExecutionLedgerSchemaCheckPlanDisabledConfirmations {
  return {
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
  }
}
