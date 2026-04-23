import {
  type DeliveryHubExecutionLedgerStorageEntity,
  type DeliveryHubExecutionLedgerStorageEntityDescriptor,
  DELIVERY_HUB_EXECUTION_LEDGER_STORAGE_ENTITY,
  listDeliveryHubExecutionLedgerStorageEntityDescriptors,
} from "./execution-ledger-storage-descriptor-scaffold"
import {
  buildDeliveryHubExecutionLedgerPgMigrationArtifact,
  type DeliveryHubExecutionLedgerPgMigrationArtifact,
} from "./execution-ledger-pg-migration-artifact"

export const DELIVERY_HUB_EXECUTION_LEDGER_SCHEMA_VERIFICATION_VERSION = 1
export const DELIVERY_HUB_EXECUTION_LEDGER_SCHEMA_VERIFICATION_MODE = "pure_snapshot_verification"

export type DeliveryHubExecutionLedgerSchemaVerificationVerdict = "compatible" | "incompatible"

export type DeliveryHubExecutionLedgerSchemaVerificationMismatchCode =
  | "missing_table"
  | "table_name_mismatch"
  | "missing_column"
  | "missing_unique_or_index_constraint"
  | "missing_foreign_key"
  | "wrong_foreign_key_target"

export type DeliveryHubExecutionLedgerSchemaVerificationTableRole =
  | "main"
  | "transitions"
  | "audit_events"

export type DeliveryHubExecutionLedgerSchemaVerificationColumnKind =
  | "text"
  | "integer"
  | "timestamptz"
  | "jsonb"
  | "unknown"

export type DeliveryHubExecutionLedgerSuppliedSchemaColumnSnapshot = {
  name: string
  type?: string
  nullable?: boolean
}

export type DeliveryHubExecutionLedgerSuppliedSchemaIndexSnapshot = {
  name?: string
  table?: string
  columns: string[]
  unique?: boolean
}

export type DeliveryHubExecutionLedgerSuppliedSchemaUniqueConstraintSnapshot = {
  name?: string
  table?: string
  columns: string[]
}

export type DeliveryHubExecutionLedgerSuppliedSchemaForeignKeySnapshot = {
  name?: string
  table?: string
  columns: string[]
  referenced_table: string
  referenced_columns: string[]
}

export type DeliveryHubExecutionLedgerSuppliedSchemaTableSnapshot = {
  name: string
  role?: DeliveryHubExecutionLedgerSchemaVerificationTableRole
  columns?: DeliveryHubExecutionLedgerSuppliedSchemaColumnSnapshot[]
  indexes?: DeliveryHubExecutionLedgerSuppliedSchemaIndexSnapshot[]
  unique_constraints?: DeliveryHubExecutionLedgerSuppliedSchemaUniqueConstraintSnapshot[]
  foreign_keys?: DeliveryHubExecutionLedgerSuppliedSchemaForeignKeySnapshot[]
}

export type DeliveryHubExecutionLedgerSuppliedSchemaSnapshot = {
  tables: DeliveryHubExecutionLedgerSuppliedSchemaTableSnapshot[]
  indexes?: DeliveryHubExecutionLedgerSuppliedSchemaIndexSnapshot[]
  unique_constraints?: DeliveryHubExecutionLedgerSuppliedSchemaUniqueConstraintSnapshot[]
  foreign_keys?: DeliveryHubExecutionLedgerSuppliedSchemaForeignKeySnapshot[]
}

export type DeliveryHubExecutionLedgerExpectedSchemaColumn = {
  name: string
  kind: DeliveryHubExecutionLedgerSchemaVerificationColumnKind
  nullable: boolean
  source:
    | "descriptor"
    | "migration_artifact"
    | "descriptor_and_migration_artifact"
  descriptor_source?: string
}

export type DeliveryHubExecutionLedgerExpectedSchemaUniqueOrIndex = {
  table: string
  name: string
  columns: string[]
  unique: true
  source: "descriptor" | "migration_artifact" | "descriptor_and_migration_artifact"
  purpose?: string
}

export type DeliveryHubExecutionLedgerExpectedSchemaForeignKey = {
  table: string
  name: string
  columns: string[]
  referenced_table: string
  referenced_columns: string[]
  source: "migration_artifact"
}

export type DeliveryHubExecutionLedgerExpectedSchemaTable = {
  role: DeliveryHubExecutionLedgerSchemaVerificationTableRole
  entity: DeliveryHubExecutionLedgerStorageEntity
  table: string
  descriptor_source: string
  artifact_source: string
  columns: DeliveryHubExecutionLedgerExpectedSchemaColumn[]
  unique_or_index_constraints: DeliveryHubExecutionLedgerExpectedSchemaUniqueOrIndex[]
  foreign_keys: DeliveryHubExecutionLedgerExpectedSchemaForeignKey[]
}

export type DeliveryHubExecutionLedgerExpectedSchemaContract = {
  version: typeof DELIVERY_HUB_EXECUTION_LEDGER_SCHEMA_VERIFICATION_VERSION
  mode: typeof DELIVERY_HUB_EXECUTION_LEDGER_SCHEMA_VERIFICATION_MODE
  table_name: string
  descriptor_tables: DeliveryHubExecutionLedgerPgMigrationArtifact["descriptor_tables"]
  artifact_version: DeliveryHubExecutionLedgerPgMigrationArtifact["version"]
  artifact_inert: DeliveryHubExecutionLedgerPgMigrationArtifact["inert"]
  runtime_application_enabled: DeliveryHubExecutionLedgerPgMigrationArtifact["runtime_application_enabled"]
  tables: DeliveryHubExecutionLedgerExpectedSchemaTable[]
}

export type DeliveryHubExecutionLedgerSchemaVerificationMismatch = {
  code: DeliveryHubExecutionLedgerSchemaVerificationMismatchCode
  table: string
  role?: DeliveryHubExecutionLedgerSchemaVerificationTableRole
  column?: string
  columns?: string[]
  constraint?: string
  expected?: string | string[]
  actual?: string | string[] | null
  source: "descriptor" | "migration_artifact" | "descriptor_and_migration_artifact"
  message: string
}

export type DeliveryHubExecutionLedgerSchemaVerificationTrace = {
  descriptor_tables_checked: Array<{
    role: DeliveryHubExecutionLedgerSchemaVerificationTableRole
    entity: DeliveryHubExecutionLedgerStorageEntity
    table: string
    columns: string[]
    indexes: string[]
  }>
  artifact_tables_checked: DeliveryHubExecutionLedgerPgMigrationArtifact["descriptor_tables"]
  artifact_columns_checked: DeliveryHubExecutionLedgerPgMigrationArtifact["descriptor_columns"]
  checked_table_names: string[]
  checked_columns: Array<{
    table: string
    columns: string[]
  }>
  checked_unique_or_index_constraints: Array<{
    table: string
    name: string
    columns: string[]
    source: DeliveryHubExecutionLedgerExpectedSchemaUniqueOrIndex["source"]
  }>
  checked_foreign_keys: Array<{
    table: string
    name: string
    columns: string[]
    referenced_table: string
    referenced_columns: string[]
  }>
}

export type DeliveryHubExecutionLedgerSchemaVerificationResult = {
  version: typeof DELIVERY_HUB_EXECUTION_LEDGER_SCHEMA_VERIFICATION_VERSION
  mode: typeof DELIVERY_HUB_EXECUTION_LEDGER_SCHEMA_VERIFICATION_MODE
  verdict: DeliveryHubExecutionLedgerSchemaVerificationVerdict
  table_name: string
  expected: DeliveryHubExecutionLedgerExpectedSchemaContract
  mismatches: DeliveryHubExecutionLedgerSchemaVerificationMismatch[]
  trace: DeliveryHubExecutionLedgerSchemaVerificationTrace
  disabled_confirmations: {
    connection_required: false
    repository_required: false
    db_adapter_required: false
    sql_execution: false
    migration_application: false
    runtime_table_creation: false
    runtime_wiring: false
  }
}

export function buildDeliveryHubExecutionLedgerExpectedSchemaContract(input?: {
  table_name?: string
}): DeliveryHubExecutionLedgerExpectedSchemaContract {
  const artifact = buildDeliveryHubExecutionLedgerPgMigrationArtifact(input)
  const descriptors = listDeliveryHubExecutionLedgerStorageEntityDescriptors({
    table_name: artifact.table_name,
  })

  const descriptorByEntity = new Map(descriptors.map((descriptor) => [descriptor.entity, descriptor]))
  const mainDescriptor = requireDescriptor(
    descriptorByEntity,
    DELIVERY_HUB_EXECUTION_LEDGER_STORAGE_ENTITY.main
  )
  const transitionDescriptor = requireDescriptor(
    descriptorByEntity,
    DELIVERY_HUB_EXECUTION_LEDGER_STORAGE_ENTITY.transitionLog
  )
  const auditDescriptor = requireDescriptor(
    descriptorByEntity,
    DELIVERY_HUB_EXECUTION_LEDGER_STORAGE_ENTITY.auditEvent
  )

  return {
    version: DELIVERY_HUB_EXECUTION_LEDGER_SCHEMA_VERIFICATION_VERSION,
    mode: DELIVERY_HUB_EXECUTION_LEDGER_SCHEMA_VERIFICATION_MODE,
    table_name: artifact.table_name,
    descriptor_tables: artifact.descriptor_tables,
    artifact_version: artifact.version,
    artifact_inert: artifact.inert,
    runtime_application_enabled: artifact.runtime_application_enabled,
    tables: [
      buildExpectedTable({
        role: "main",
        descriptor: mainDescriptor,
        artifact,
      }),
      buildExpectedTable({
        role: "transitions",
        descriptor: transitionDescriptor,
        artifact,
      }),
      buildExpectedTable({
        role: "audit_events",
        descriptor: auditDescriptor,
        artifact,
      }),
    ],
  }
}

export function verifyDeliveryHubExecutionLedgerSchemaSnapshot(input: {
  table_name?: string
  snapshot: DeliveryHubExecutionLedgerSuppliedSchemaSnapshot
}): DeliveryHubExecutionLedgerSchemaVerificationResult {
  const expected = buildDeliveryHubExecutionLedgerExpectedSchemaContract({
    table_name: input.table_name,
  })
  const suppliedTables = new Map(input.snapshot.tables.map((table) => [table.name, table]))
  const mismatches: DeliveryHubExecutionLedgerSchemaVerificationMismatch[] = []

  for (const expectedTable of expected.tables) {
    const suppliedTable = suppliedTables.get(expectedTable.table)
    const roleMatchedTable = input.snapshot.tables.find((table) => table.role === expectedTable.role)

    if (roleMatchedTable && roleMatchedTable.name !== expectedTable.table) {
      mismatches.push({
        code: "table_name_mismatch",
        table: expectedTable.table,
        role: expectedTable.role,
        expected: expectedTable.table,
        actual: roleMatchedTable.name,
        source: "descriptor_and_migration_artifact",
        message: `Expected ${expectedTable.role} table ${expectedTable.table} but supplied role points to ${roleMatchedTable.name}.`,
      })
    }

    if (!suppliedTable) {
      mismatches.push({
        code: "missing_table",
        table: expectedTable.table,
        role: expectedTable.role,
        expected: expectedTable.table,
        actual: null,
        source: "descriptor_and_migration_artifact",
        message: `Missing required execution ledger ${expectedTable.role} table ${expectedTable.table}.`,
      })
      continue
    }

    const suppliedColumnNames = new Set((suppliedTable.columns ?? []).map((column) => column.name))
    for (const expectedColumn of expectedTable.columns) {
      if (!suppliedColumnNames.has(expectedColumn.name)) {
        mismatches.push({
          code: "missing_column",
          table: expectedTable.table,
          role: expectedTable.role,
          column: expectedColumn.name,
          expected: expectedColumn.name,
          actual: null,
          source: expectedColumn.source,
          message: `Missing required column ${expectedTable.table}.${expectedColumn.name}.`,
        })
      }
    }

    for (const expectedConstraint of expectedTable.unique_or_index_constraints) {
      if (!hasUniqueOrIndex(input.snapshot, suppliedTable, expectedConstraint)) {
        mismatches.push({
          code: "missing_unique_or_index_constraint",
          table: expectedTable.table,
          role: expectedTable.role,
          constraint: expectedConstraint.name,
          columns: expectedConstraint.columns,
          expected: expectedConstraint.columns,
          actual: null,
          source: expectedConstraint.source,
          message: `Missing required unique/index constraint ${expectedConstraint.name} on ${expectedTable.table} (${expectedConstraint.columns.join(", ")}).`,
        })
      }
    }

    for (const expectedForeignKey of expectedTable.foreign_keys) {
      const matchingColumnForeignKeys = listForeignKeys(input.snapshot, suppliedTable).filter((foreignKey) =>
        sameColumns(foreignKey.columns, expectedForeignKey.columns)
      )
      const exactForeignKey = matchingColumnForeignKeys.find(
        (foreignKey) =>
          foreignKey.referenced_table === expectedForeignKey.referenced_table &&
          sameColumns(foreignKey.referenced_columns, expectedForeignKey.referenced_columns)
      )

      if (exactForeignKey) {
        continue
      }

      if (matchingColumnForeignKeys.length > 0) {
        const first = matchingColumnForeignKeys[0]
        mismatches.push({
          code: "wrong_foreign_key_target",
          table: expectedTable.table,
          role: expectedTable.role,
          constraint: expectedForeignKey.name,
          columns: expectedForeignKey.columns,
          expected: [expectedForeignKey.referenced_table, ...expectedForeignKey.referenced_columns],
          actual: [first.referenced_table, ...first.referenced_columns],
          source: expectedForeignKey.source,
          message: `Foreign key ${expectedForeignKey.name} on ${expectedTable.table} targets ${first.referenced_table} (${first.referenced_columns.join(", ")}) instead of ${expectedForeignKey.referenced_table} (${expectedForeignKey.referenced_columns.join(", ")}).`,
        })
        continue
      }

      mismatches.push({
        code: "missing_foreign_key",
        table: expectedTable.table,
        role: expectedTable.role,
        constraint: expectedForeignKey.name,
        columns: expectedForeignKey.columns,
        expected: [expectedForeignKey.referenced_table, ...expectedForeignKey.referenced_columns],
        actual: null,
        source: expectedForeignKey.source,
        message: `Missing required foreign key ${expectedForeignKey.name} on ${expectedTable.table} (${expectedForeignKey.columns.join(", ")}).`,
      })
    }
  }

  const sortedMismatches = sortMismatches(mismatches)

  return {
    version: DELIVERY_HUB_EXECUTION_LEDGER_SCHEMA_VERIFICATION_VERSION,
    mode: DELIVERY_HUB_EXECUTION_LEDGER_SCHEMA_VERIFICATION_MODE,
    verdict: sortedMismatches.length === 0 ? "compatible" : "incompatible",
    table_name: expected.table_name,
    expected,
    mismatches: sortedMismatches,
    trace: buildTrace(expected),
    disabled_confirmations: {
      connection_required: false,
      repository_required: false,
      db_adapter_required: false,
      sql_execution: false,
      migration_application: false,
      runtime_table_creation: false,
      runtime_wiring: false,
    },
  }
}

function buildExpectedTable(input: {
  role: DeliveryHubExecutionLedgerSchemaVerificationTableRole
  descriptor: DeliveryHubExecutionLedgerStorageEntityDescriptor
  artifact: DeliveryHubExecutionLedgerPgMigrationArtifact
}): DeliveryHubExecutionLedgerExpectedSchemaTable {
  const artifactStatement = input.artifact.up.find((statement) => {
    if (input.role === "main") {
      return statement.purpose === "create_main_table"
    }
    if (input.role === "transitions") {
      return statement.purpose === "create_transition_table"
    }
    return statement.purpose === "create_audit_table"
  })

  const artifactColumns = artifactStatement ? parseColumnsFromCreateTableSql(artifactStatement.sql) : []
  const descriptorColumns = input.descriptor.columns.map((column) => ({
    name: column.column,
    kind: mapDescriptorColumnKind(column.value_kind),
    nullable: column.nullable,
    source: "descriptor" as const,
    descriptor_source: column.source,
  }))
  const columnsByName = new Map<string, DeliveryHubExecutionLedgerExpectedSchemaColumn>()

  for (const column of descriptorColumns) {
    columnsByName.set(column.name, column)
  }

  for (const column of artifactColumns) {
    const existing = columnsByName.get(column.name)
    columnsByName.set(column.name, {
      name: column.name,
      kind: existing?.kind ?? column.kind,
      nullable: existing?.nullable ?? column.nullable,
      source: existing ? "descriptor_and_migration_artifact" : "migration_artifact",
      descriptor_source: existing?.descriptor_source,
    })
  }

  const descriptorUniqueIndexes = input.descriptor.indexes
    .filter((index) => index.unique)
    .map((index) => ({
      table: input.descriptor.table,
      name: index.name,
      columns: index.columns,
      unique: true as const,
      source: "descriptor" as const,
      purpose: index.purpose,
    }))
  const artifactUniqueConstraints = artifactStatement
    ? parseUniqueConstraintsFromCreateTableSql(artifactStatement.sql, input.descriptor.table)
    : []
  const artifactUniqueIndexes = input.artifact.up
    .filter((statement) => statement.sql.includes(` on ${input.descriptor.table} (`))
    .filter((statement) => statement.sql.startsWith("create unique index"))
    .map((statement) => parseUniqueIndexSql(statement.sql, input.descriptor.table))
    .filter((index): index is DeliveryHubExecutionLedgerExpectedSchemaUniqueOrIndex => Boolean(index))
  const uniqueByColumns = new Map<string, DeliveryHubExecutionLedgerExpectedSchemaUniqueOrIndex>()

  for (const unique of [...descriptorUniqueIndexes, ...artifactUniqueConstraints, ...artifactUniqueIndexes]) {
    const key = unique.columns.join("|")
    const existing = uniqueByColumns.get(key)
    uniqueByColumns.set(key, {
      ...unique,
      name: existing?.name ?? unique.name,
      source: existing ? "descriptor_and_migration_artifact" : unique.source,
      purpose: existing?.purpose ?? unique.purpose,
    })
  }

  return {
    role: input.role,
    entity: input.descriptor.entity,
    table: input.descriptor.table,
    descriptor_source: "listDeliveryHubExecutionLedgerStorageEntityDescriptors",
    artifact_source: "buildDeliveryHubExecutionLedgerPgMigrationArtifact",
    columns: Array.from(columnsByName.values()).sort((left, right) => left.name.localeCompare(right.name)),
    unique_or_index_constraints: Array.from(uniqueByColumns.values()).sort((left, right) =>
      left.name.localeCompare(right.name)
    ),
    foreign_keys: artifactStatement
      ? parseForeignKeysFromCreateTableSql(artifactStatement.sql, input.descriptor.table).sort((left, right) =>
          left.name.localeCompare(right.name)
        )
      : [],
  }
}

function parseColumnsFromCreateTableSql(sql: string): DeliveryHubExecutionLedgerExpectedSchemaColumn[] {
  return extractCreateTableBody(sql)
    .map((line) => line.trim().replace(/,$/, ""))
    .filter((line) => line.length > 0)
    .filter((line) => !line.startsWith("constraint "))
    .map((line) => {
      const [name, type] = line.split(/\s+/)
      return {
        name,
        kind: mapSqlColumnKind(type),
        nullable: !line.includes(" not null") && !line.includes(" primary key"),
        source: "migration_artifact" as const,
      }
    })
}

function parseUniqueConstraintsFromCreateTableSql(
  sql: string,
  table: string
): DeliveryHubExecutionLedgerExpectedSchemaUniqueOrIndex[] {
  return extractCreateTableBody(sql)
    .map((line) => line.trim().replace(/,$/, ""))
    .filter((line) => line.startsWith("constraint ") && line.includes(" unique "))
    .map((line) => {
      const name = line.match(/^constraint\s+(\S+)\s+/)?.[1] ?? `${table}_unique_constraint`
      const columns = line.match(/unique\s*\(([^)]+)\)/)?.[1] ?? ""
      return {
        table,
        name,
        columns: splitColumns(columns),
        unique: true as const,
        source: "migration_artifact" as const,
      }
    })
}

function parseForeignKeysFromCreateTableSql(
  sql: string,
  table: string
): DeliveryHubExecutionLedgerExpectedSchemaForeignKey[] {
  return extractCreateTableBody(sql)
    .map((line) => line.trim().replace(/,$/, ""))
    .filter((line) => line.startsWith("constraint ") && line.includes(" foreign key "))
    .map((line) => {
      const name = line.match(/^constraint\s+(\S+)\s+/)?.[1] ?? `${table}_foreign_key`
      const columns = line.match(/foreign key\s*\(([^)]+)\)/)?.[1] ?? ""
      const referenced = line.match(/references\s+(\S+)\s*\(([^)]+)\)/)
      return {
        table,
        name,
        columns: splitColumns(columns),
        referenced_table: referenced?.[1] ?? "",
        referenced_columns: splitColumns(referenced?.[2] ?? ""),
        source: "migration_artifact" as const,
      }
    })
}

function parseUniqueIndexSql(
  sql: string,
  table: string
): DeliveryHubExecutionLedgerExpectedSchemaUniqueOrIndex | null {
  const match = sql.match(/^create unique index if not exists\s+(\S+)\s+on\s+(\S+)\s*\(([^)]+)\)/)

  if (!match || match[2] !== table) {
    return null
  }

  return {
    table,
    name: match[1],
    columns: splitColumns(match[3]),
    unique: true,
    source: "migration_artifact",
  }
}

function extractCreateTableBody(sql: string): string[] {
  const body = sql.match(/\(\n([\s\S]*)\n\);$/)?.[1] ?? ""
  return body.split("\n")
}

function splitColumns(columns: string): string[] {
  return columns
    .split(",")
    .map((column) => column.trim())
    .filter(Boolean)
}

function hasUniqueOrIndex(
  snapshot: DeliveryHubExecutionLedgerSuppliedSchemaSnapshot,
  table: DeliveryHubExecutionLedgerSuppliedSchemaTableSnapshot,
  expected: DeliveryHubExecutionLedgerExpectedSchemaUniqueOrIndex
): boolean {
  const indexes = [
    ...(table.indexes ?? []).map((index) => ({ ...index, table: index.table ?? table.name })),
    ...(snapshot.indexes ?? []),
  ]
  const uniqueConstraints = [
    ...(table.unique_constraints ?? []).map((constraint) => ({
      ...constraint,
      table: constraint.table ?? table.name,
    })),
    ...(snapshot.unique_constraints ?? []),
  ]

  return (
    indexes.some(
      (index) => index.table === expected.table && index.unique === true && sameColumns(index.columns, expected.columns)
    ) ||
    uniqueConstraints.some(
      (constraint) => constraint.table === expected.table && sameColumns(constraint.columns, expected.columns)
    )
  )
}

function listForeignKeys(
  snapshot: DeliveryHubExecutionLedgerSuppliedSchemaSnapshot,
  table: DeliveryHubExecutionLedgerSuppliedSchemaTableSnapshot
): DeliveryHubExecutionLedgerSuppliedSchemaForeignKeySnapshot[] {
  return [
    ...(table.foreign_keys ?? []).map((foreignKey) => ({ ...foreignKey, table: foreignKey.table ?? table.name })),
    ...(snapshot.foreign_keys ?? []),
  ].filter((foreignKey) => foreignKey.table === table.name)
}

function sameColumns(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((column, index) => column === right[index])
}

function mapDescriptorColumnKind(
  kind: DeliveryHubExecutionLedgerStorageEntityDescriptor["columns"][number]["value_kind"]
): DeliveryHubExecutionLedgerSchemaVerificationColumnKind {
  if (kind === "json") {
    return "jsonb"
  }
  if (kind === "number") {
    return "integer"
  }
  return "text"
}

function mapSqlColumnKind(kind?: string): DeliveryHubExecutionLedgerSchemaVerificationColumnKind {
  if (kind === "text") {
    return "text"
  }
  if (kind === "integer") {
    return "integer"
  }
  if (kind === "timestamptz") {
    return "timestamptz"
  }
  if (kind === "jsonb") {
    return "jsonb"
  }
  return "unknown"
}

function requireDescriptor(
  descriptors: Map<DeliveryHubExecutionLedgerStorageEntity, DeliveryHubExecutionLedgerStorageEntityDescriptor>,
  entity: DeliveryHubExecutionLedgerStorageEntity
): DeliveryHubExecutionLedgerStorageEntityDescriptor {
  const descriptor = descriptors.get(entity)

  if (!descriptor) {
    throw new Error(`Missing execution ledger storage descriptor for ${entity}.`)
  }

  return descriptor
}

function buildTrace(
  expected: DeliveryHubExecutionLedgerExpectedSchemaContract
): DeliveryHubExecutionLedgerSchemaVerificationTrace {
  const descriptorTablesChecked = expected.tables.map((table) => ({
    role: table.role,
    entity: table.entity,
    table: table.table,
    columns: table.columns
      .filter((column) => column.source !== "migration_artifact")
      .map((column) => column.name),
    indexes: table.unique_or_index_constraints
      .filter((constraint) => constraint.source !== "migration_artifact")
      .map((constraint) => constraint.name),
  }))

  return {
    descriptor_tables_checked: descriptorTablesChecked,
    artifact_tables_checked: expected.descriptor_tables,
    artifact_columns_checked: {
      main: expected.tables.find((table) => table.role === "main")?.columns.map((column) => column.name) ?? [],
      transitions:
        expected.tables.find((table) => table.role === "transitions")?.columns.map((column) => column.name) ?? [],
      audit_events:
        expected.tables.find((table) => table.role === "audit_events")?.columns.map((column) => column.name) ?? [],
    },
    checked_table_names: expected.tables.map((table) => table.table),
    checked_columns: expected.tables.map((table) => ({
      table: table.table,
      columns: table.columns.map((column) => column.name),
    })),
    checked_unique_or_index_constraints: expected.tables.flatMap((table) =>
      table.unique_or_index_constraints.map((constraint) => ({
        table: table.table,
        name: constraint.name,
        columns: constraint.columns,
        source: constraint.source,
      }))
    ),
    checked_foreign_keys: expected.tables.flatMap((table) =>
      table.foreign_keys.map((foreignKey) => ({
        table: table.table,
        name: foreignKey.name,
        columns: foreignKey.columns,
        referenced_table: foreignKey.referenced_table,
        referenced_columns: foreignKey.referenced_columns,
      }))
    ),
  }
}

function sortMismatches(
  mismatches: DeliveryHubExecutionLedgerSchemaVerificationMismatch[]
): DeliveryHubExecutionLedgerSchemaVerificationMismatch[] {
  return [...mismatches].sort((left, right) => {
    const leftKey = [left.table, left.code, left.column ?? "", left.constraint ?? "", (left.columns ?? []).join("|")].join("|")
    const rightKey = [right.table, right.code, right.column ?? "", right.constraint ?? "", (right.columns ?? []).join("|")].join("|")

    return leftKey.localeCompare(rightKey)
  })
}
