import {
  type DeliveryHubExecutionLedgerStorageEntityDescriptor,
  listDeliveryHubExecutionLedgerStorageEntityDescriptors,
} from "./execution-ledger-storage-descriptor-scaffold"
import { normalizeDeliveryHubExecutionLedgerStorageTableName } from "./execution-ledger-storage-adapter-scaffold"

export const DELIVERY_HUB_EXECUTION_LEDGER_PG_MIGRATION_ARTIFACT_VERSION = 1

export type DeliveryHubExecutionLedgerPgMigrationStatement = {
  order: number
  sql: string
  purpose:
    | "create_main_table"
    | "create_transition_table"
    | "create_audit_table"
    | "create_lookup_index"
    | "create_ordering_index"
    | "drop_audit_table"
    | "drop_transition_table"
    | "drop_main_table"
}

export type DeliveryHubExecutionLedgerPgMigrationArtifact = {
  version: typeof DELIVERY_HUB_EXECUTION_LEDGER_PG_MIGRATION_ARTIFACT_VERSION
  inert: true
  runtime_application_enabled: false
  table_name: string
  descriptor_tables: {
    main: string
    transitions: string
    audit_events: string
  }
  descriptor_columns: {
    main: string[]
    transitions: string[]
    audit_events: string[]
  }
  up: DeliveryHubExecutionLedgerPgMigrationStatement[]
  down: DeliveryHubExecutionLedgerPgMigrationStatement[]
  up_sql: string
  down_sql: string
}

export function buildDeliveryHubExecutionLedgerPgMigrationArtifact(input?: {
  table_name?: string
}): DeliveryHubExecutionLedgerPgMigrationArtifact {
  const tableName = normalizeDeliveryHubExecutionLedgerStorageTableName(input?.table_name)
  const descriptors = listDeliveryHubExecutionLedgerStorageEntityDescriptors({
    table_name: tableName,
  })
  const mainDescriptor = requireDescriptor(descriptors, "execution_ledger")
  const transitionDescriptor = requireDescriptor(descriptors, "transition_log")
  const auditDescriptor = requireDescriptor(descriptors, "audit_event")

  const up: DeliveryHubExecutionLedgerPgMigrationStatement[] = [
    {
      order: 1,
      purpose: "create_main_table",
      sql: buildCreateMainTableSql(mainDescriptor.table),
    },
    {
      order: 2,
      purpose: "create_lookup_index",
      sql: `create unique index if not exists ${mainDescriptor.table}_idempotency_key_uidx on ${mainDescriptor.table} (idempotency_key);`,
    },
    {
      order: 3,
      purpose: "create_transition_table",
      sql: buildCreateTransitionTableSql(transitionDescriptor.table, mainDescriptor.table),
    },
    {
      order: 4,
      purpose: "create_ordering_index",
      sql: `create unique index if not exists ${transitionDescriptor.table}_execution_sequence_uidx on ${transitionDescriptor.table} (execution_reference, sequence);`,
    },
    {
      order: 5,
      purpose: "create_audit_table",
      sql: buildCreateAuditTableSql(auditDescriptor.table, mainDescriptor.table),
    },
    {
      order: 6,
      purpose: "create_ordering_index",
      sql: `create unique index if not exists ${auditDescriptor.table}_execution_sequence_uidx on ${auditDescriptor.table} (execution_reference, sequence);`,
    },
  ]

  const down: DeliveryHubExecutionLedgerPgMigrationStatement[] = [
    {
      order: 1,
      purpose: "drop_audit_table",
      sql: `drop table if exists ${auditDescriptor.table};`,
    },
    {
      order: 2,
      purpose: "drop_transition_table",
      sql: `drop table if exists ${transitionDescriptor.table};`,
    },
    {
      order: 3,
      purpose: "drop_main_table",
      sql: `drop table if exists ${mainDescriptor.table};`,
    },
  ]

  return {
    version: DELIVERY_HUB_EXECUTION_LEDGER_PG_MIGRATION_ARTIFACT_VERSION,
    inert: true,
    runtime_application_enabled: false,
    table_name: tableName,
    descriptor_tables: {
      main: mainDescriptor.table,
      transitions: transitionDescriptor.table,
      audit_events: auditDescriptor.table,
    },
    descriptor_columns: {
      main: mainDescriptor.columns.map((column) => column.column),
      transitions: transitionDescriptor.columns.map((column) => column.column),
      audit_events: auditDescriptor.columns.map((column) => column.column),
    },
    up,
    down,
    up_sql: joinMigrationSql(up),
    down_sql: joinMigrationSql(down),
  }
}

function buildCreateMainTableSql(table: string): string {
  return `create table if not exists ${table} (
  execution_reference text primary key,
  idempotency_key text not null,
  execution_payload jsonb not null,
  reservation_payload jsonb not null,
  transitions_payload jsonb not null default '[]'::jsonb,
  audit_events_payload jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ${table}_idempotency_key_key unique (idempotency_key)
);`
}

function buildCreateTransitionTableSql(table: string, mainTable: string): string {
  return `create table if not exists ${table} (
  execution_reference text not null,
  sequence integer not null,
  recorded_at timestamptz not null,
  from_state text not null,
  to_state text not null,
  reason text not null,
  created_at timestamptz not null default now(),
  constraint ${table}_execution_sequence_key unique (execution_reference, sequence),
  constraint ${table}_execution_reference_fkey foreign key (execution_reference) references ${mainTable} (execution_reference) on delete cascade
);`
}

function buildCreateAuditTableSql(table: string, mainTable: string): string {
  return `create table if not exists ${table} (
  execution_reference text not null,
  sequence integer not null,
  recorded_at timestamptz not null,
  event_payload jsonb not null,
  created_at timestamptz not null default now(),
  constraint ${table}_execution_sequence_key unique (execution_reference, sequence),
  constraint ${table}_execution_reference_fkey foreign key (execution_reference) references ${mainTable} (execution_reference) on delete cascade
);`
}

function requireDescriptor(
  descriptors: DeliveryHubExecutionLedgerStorageEntityDescriptor[],
  entity: DeliveryHubExecutionLedgerStorageEntityDescriptor["entity"]
): DeliveryHubExecutionLedgerStorageEntityDescriptor {
  const descriptor = descriptors.find((entry) => entry.entity === entity)

  if (!descriptor) {
    throw new Error(`Missing execution ledger storage descriptor for ${entity}.`)
  }

  return descriptor
}

function joinMigrationSql(statements: DeliveryHubExecutionLedgerPgMigrationStatement[]): string {
  return statements.map((statement) => statement.sql).join("\n\n")
}
