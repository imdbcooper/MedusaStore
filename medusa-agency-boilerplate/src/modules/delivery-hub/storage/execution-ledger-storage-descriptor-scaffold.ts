import type {
  DeliveryHubControlledExecutionRecordDraft,
  DeliveryHubExecutionAuditDraft,
  DeliveryHubExecutionReservationDraft,
  DeliveryHubExecutionState,
} from "../shipment-execution-contract"
import type {
  DeliveryHubExecutionLedgerAppendAuditInput,
  DeliveryHubExecutionLedgerAuditEvent,
  DeliveryHubExecutionLedgerReserveInput,
  DeliveryHubExecutionLedgerTransitionEntry,
  DeliveryHubExecutionLedgerTransitionInput,
} from "./execution-ledger-repository"
import {
  type DeliveryHubExecutionLedgerStorageAppendAuditRecord,
  type DeliveryHubExecutionLedgerStorageAuditRecord,
  type DeliveryHubExecutionLedgerStorageLookupKey,
  type DeliveryHubExecutionLedgerStorageRecord,
  type DeliveryHubExecutionLedgerStorageReserveRecord,
  type DeliveryHubExecutionLedgerStorageTransitionRecord,
  buildDeliveryHubExecutionLedgerStorageAppendAuditRecord,
  buildDeliveryHubExecutionLedgerStorageAuditRecord,
  buildDeliveryHubExecutionLedgerStorageLookupKey,
  buildDeliveryHubExecutionLedgerStorageRecord,
  buildDeliveryHubExecutionLedgerStorageReserveRecord,
  buildDeliveryHubExecutionLedgerStorageTransitionRecord,
  mapDeliveryHubExecutionLedgerStorageRecordToLedgerRecord,
  normalizeDeliveryHubExecutionLedgerStorageTableName,
} from "./execution-ledger-storage-adapter-scaffold"

export const DELIVERY_HUB_EXECUTION_LEDGER_DESCRIPTOR_VERSION = 1

export const DELIVERY_HUB_EXECUTION_LEDGER_STORAGE_ENTITY = {
  main: "execution_ledger",
  transitionLog: "transition_log",
  auditEvent: "audit_event",
} as const

export type DeliveryHubExecutionLedgerStorageEntity =
  (typeof DELIVERY_HUB_EXECUTION_LEDGER_STORAGE_ENTITY)[keyof typeof DELIVERY_HUB_EXECUTION_LEDGER_STORAGE_ENTITY]

export type DeliveryHubExecutionLedgerStorageColumnDescriptor = {
  column: string
  value_kind: "string" | "number" | "json"
  nullable: boolean
  source:
    | "execution.execution_reference"
    | "execution.execution.idempotency_key"
    | "reservation.reservation_key"
    | "execution_record_payload"
    | "reservation_draft_payload"
    | "transition_entry.sequence"
    | "transition_entry.recorded_at"
    | "transition_entry.from"
    | "transition_entry.to"
    | "transition_entry.reason"
    | "audit_event.sequence"
    | "audit_event.recorded_at"
    | "audit_event.payload"
}

export type DeliveryHubExecutionLedgerStorageIndexDescriptor = {
  name: string
  entity: DeliveryHubExecutionLedgerStorageEntity
  unique: boolean
  columns: string[]
  purpose:
    | "primary_lookup"
    | "idempotency_lookup"
    | "reservation_lookup"
    | "transition_ordering"
    | "audit_ordering"
}

export type DeliveryHubExecutionLedgerStorageEntityDescriptor = {
  version: typeof DELIVERY_HUB_EXECUTION_LEDGER_DESCRIPTOR_VERSION
  entity: DeliveryHubExecutionLedgerStorageEntity
  table: string
  purpose: string
  columns: DeliveryHubExecutionLedgerStorageColumnDescriptor[]
  indexes: DeliveryHubExecutionLedgerStorageIndexDescriptor[]
}

export type DeliveryHubExecutionLedgerStorageQueryBinding = {
  name: string
  value: string | number
}

export type DeliveryHubExecutionLedgerStorageQueryDescriptor = {
  version: typeof DELIVERY_HUB_EXECUTION_LEDGER_DESCRIPTOR_VERSION
  operation:
    | "select_execution_by_reference"
    | "select_execution_by_idempotency_key"
    | "select_execution_by_reservation_key"
    | "insert_execution_reservation"
    | "insert_execution_transition"
    | "insert_execution_audit_event"
    | "update_execution_main_record"
  inert: true
  entity: DeliveryHubExecutionLedgerStorageEntity
  table: string
  sql: string
  bindings: DeliveryHubExecutionLedgerStorageQueryBinding[]
  lookup_keys: Partial<
    DeliveryHubExecutionLedgerStorageLookupKey & {
      reservation_key: string
      sequence: number
    }
  >
  payload_summary: {
    execution_reference?: string
    idempotency_key?: string
    reservation_key?: string
    current_state?: DeliveryHubExecutionState
    event_type?: DeliveryHubExecutionAuditDraft["event_type"]
    transition?: {
      from: DeliveryHubExecutionState
      to: DeliveryHubExecutionState
    }
  }
}

export type DeliveryHubExecutionLedgerStorageDescriptorBundle = {
  version: typeof DELIVERY_HUB_EXECUTION_LEDGER_DESCRIPTOR_VERSION
  main_record: DeliveryHubExecutionLedgerStorageRecord
  reservation_record: DeliveryHubExecutionLedgerStorageReserveRecord
  transition_records: DeliveryHubExecutionLedgerStorageTransitionRecord[]
  audit_records: DeliveryHubExecutionLedgerStorageAuditRecord[]
  append_audit_records: DeliveryHubExecutionLedgerStorageAppendAuditRecord[]
  lookup_key: DeliveryHubExecutionLedgerStorageLookupKey & {
    reservation_key: string
  }
}

function buildExecutionLedgerTableName(input?: { table_name?: string }): string {
  return normalizeDeliveryHubExecutionLedgerStorageTableName(input?.table_name)
}

function buildTransitionTableName(input?: { table_name?: string }): string {
  return `${buildExecutionLedgerTableName(input)}_transitions`
}

function buildAuditTableName(input?: { table_name?: string }): string {
  return `${buildExecutionLedgerTableName(input)}_audit_events`
}

export function listDeliveryHubExecutionLedgerStorageEntityDescriptors(input?: {
  table_name?: string
}): DeliveryHubExecutionLedgerStorageEntityDescriptor[] {
  const ledgerTable = buildExecutionLedgerTableName(input)
  const transitionTable = buildTransitionTableName(input)
  const auditTable = buildAuditTableName(input)

  return [
    {
      version: DELIVERY_HUB_EXECUTION_LEDGER_DESCRIPTOR_VERSION,
      entity: DELIVERY_HUB_EXECUTION_LEDGER_STORAGE_ENTITY.main,
      table: ledgerTable,
      purpose:
        "Canonical controlled-execution ledger record keyed by execution_reference and idempotency reservation lookup.",
      columns: [
        {
          column: "execution_reference",
          value_kind: "string",
          nullable: false,
          source: "execution.execution_reference",
        },
        {
          column: "idempotency_key",
          value_kind: "string",
          nullable: false,
          source: "reservation.reservation_key",
        },
        {
          column: "execution_payload",
          value_kind: "json",
          nullable: false,
          source: "execution_record_payload",
        },
        {
          column: "reservation_payload",
          value_kind: "json",
          nullable: false,
          source: "reservation_draft_payload",
        },
        {
          column: "transitions_payload",
          value_kind: "json",
          nullable: false,
          source: "execution_record_payload",
        },
        {
          column: "audit_events_payload",
          value_kind: "json",
          nullable: false,
          source: "execution_record_payload",
        },
      ],
      indexes: [
        {
          name: `${ledgerTable}_pkey`,
          entity: DELIVERY_HUB_EXECUTION_LEDGER_STORAGE_ENTITY.main,
          unique: true,
          columns: ["execution_reference"],
          purpose: "primary_lookup",
        },
        {
          name: `${ledgerTable}_idempotency_key_uidx`,
          entity: DELIVERY_HUB_EXECUTION_LEDGER_STORAGE_ENTITY.main,
          unique: true,
          columns: ["idempotency_key"],
          purpose: "idempotency_lookup",
        },
        {
          name: `${ledgerTable}_reservation_key_uidx`,
          entity: DELIVERY_HUB_EXECUTION_LEDGER_STORAGE_ENTITY.main,
          unique: true,
          columns: ["idempotency_key"],
          purpose: "reservation_lookup",
        },
      ],
    },
    {
      version: DELIVERY_HUB_EXECUTION_LEDGER_DESCRIPTOR_VERSION,
      entity: DELIVERY_HUB_EXECUTION_LEDGER_STORAGE_ENTITY.transitionLog,
      table: transitionTable,
      purpose:
        "Ordered transition history for controlled execution state changes without activating runtime persistence.",
      columns: [
        {
          column: "execution_reference",
          value_kind: "string",
          nullable: false,
          source: "execution.execution_reference",
        },
        {
          column: "sequence",
          value_kind: "number",
          nullable: false,
          source: "transition_entry.sequence",
        },
        {
          column: "recorded_at",
          value_kind: "string",
          nullable: false,
          source: "transition_entry.recorded_at",
        },
        {
          column: "from_state",
          value_kind: "string",
          nullable: false,
          source: "transition_entry.from",
        },
        {
          column: "to_state",
          value_kind: "string",
          nullable: false,
          source: "transition_entry.to",
        },
        {
          column: "reason",
          value_kind: "string",
          nullable: false,
          source: "transition_entry.reason",
        },
      ],
      indexes: [
        {
          name: `${transitionTable}_execution_sequence_uidx`,
          entity: DELIVERY_HUB_EXECUTION_LEDGER_STORAGE_ENTITY.transitionLog,
          unique: true,
          columns: ["execution_reference", "sequence"],
          purpose: "transition_ordering",
        },
      ],
    },
    {
      version: DELIVERY_HUB_EXECUTION_LEDGER_DESCRIPTOR_VERSION,
      entity: DELIVERY_HUB_EXECUTION_LEDGER_STORAGE_ENTITY.auditEvent,
      table: auditTable,
      purpose:
        "Ordered audit-event projection for controlled execution observability with redacted payload storage shape.",
      columns: [
        {
          column: "execution_reference",
          value_kind: "string",
          nullable: false,
          source: "execution.execution_reference",
        },
        {
          column: "sequence",
          value_kind: "number",
          nullable: false,
          source: "audit_event.sequence",
        },
        {
          column: "recorded_at",
          value_kind: "string",
          nullable: false,
          source: "audit_event.recorded_at",
        },
        {
          column: "event_payload",
          value_kind: "json",
          nullable: false,
          source: "audit_event.payload",
        },
      ],
      indexes: [
        {
          name: `${auditTable}_execution_sequence_uidx`,
          entity: DELIVERY_HUB_EXECUTION_LEDGER_STORAGE_ENTITY.auditEvent,
          unique: true,
          columns: ["execution_reference", "sequence"],
          purpose: "audit_ordering",
        },
      ],
    },
  ]
}

export function buildDeliveryHubExecutionLedgerStorageDescriptorBundle(input: {
  execution_record: DeliveryHubControlledExecutionRecordDraft
  reservation_draft: DeliveryHubExecutionReservationDraft
  transitions?: DeliveryHubExecutionLedgerTransitionEntry[]
  audit_events?: DeliveryHubExecutionLedgerAuditEvent[]
}): DeliveryHubExecutionLedgerStorageDescriptorBundle {
  const lookupKey = buildDeliveryHubExecutionLedgerStorageLookupKey({
    execution_record: input.execution_record,
    reservation_draft: input.reservation_draft,
  })

  return {
    version: DELIVERY_HUB_EXECUTION_LEDGER_DESCRIPTOR_VERSION,
    main_record: buildDeliveryHubExecutionLedgerStorageRecord({
      execution_record: input.execution_record,
      reservation_draft: input.reservation_draft,
      transitions: input.transitions,
      audit_events: input.audit_events,
    }),
    reservation_record: buildDeliveryHubExecutionLedgerStorageReserveRecord({
      execution_record: input.execution_record,
      reservation_draft: input.reservation_draft,
    }),
    transition_records: (input.transitions ?? []).map((transition) =>
      buildDeliveryHubExecutionLedgerStorageTransitionRecord({
        sequence: transition.sequence,
        recorded_at: transition.recorded_at,
        execution_reference: transition.execution_reference,
        from: transition.from,
        to: transition.to,
      })
    ),
    audit_records: (input.audit_events ?? []).map((event) =>
      buildDeliveryHubExecutionLedgerStorageAuditRecord({
        sequence: event.sequence,
        recorded_at: event.recorded_at,
        execution_reference: event.execution_reference,
        event: event.event,
      })
    ),
    append_audit_records: (input.audit_events ?? []).map((event) =>
      buildDeliveryHubExecutionLedgerStorageAppendAuditRecord({
        execution_reference: event.execution_reference,
        sequence: event.sequence,
        recorded_at: event.recorded_at,
        event: event.event,
      })
    ),
    lookup_key: {
      ...lookupKey,
      reservation_key: input.reservation_draft.reservation_key,
    },
  }
}

export function buildDeliveryHubExecutionLedgerSelectByReferenceQueryDescriptor(input: {
  execution_reference: string
  table_name?: string
}): DeliveryHubExecutionLedgerStorageQueryDescriptor {
  const table = buildExecutionLedgerTableName(input)

  return {
    version: DELIVERY_HUB_EXECUTION_LEDGER_DESCRIPTOR_VERSION,
    operation: "select_execution_by_reference",
    inert: true,
    entity: DELIVERY_HUB_EXECUTION_LEDGER_STORAGE_ENTITY.main,
    table,
    sql:
      "select execution_reference, idempotency_key, execution_payload, reservation_payload, transitions_payload, audit_events_payload from " +
      `${table} where execution_reference = ? limit 1`,
    bindings: [{ name: "execution_reference", value: input.execution_reference }],
    lookup_keys: { execution_reference: input.execution_reference },
    payload_summary: {
      execution_reference: input.execution_reference,
    },
  }
}

export function buildDeliveryHubExecutionLedgerSelectByIdempotencyKeyQueryDescriptor(input: {
  idempotency_key: string
  table_name?: string
}): DeliveryHubExecutionLedgerStorageQueryDescriptor {
  const table = buildExecutionLedgerTableName(input)

  return {
    version: DELIVERY_HUB_EXECUTION_LEDGER_DESCRIPTOR_VERSION,
    operation: "select_execution_by_idempotency_key",
    inert: true,
    entity: DELIVERY_HUB_EXECUTION_LEDGER_STORAGE_ENTITY.main,
    table,
    sql:
      "select execution_reference, idempotency_key, execution_payload, reservation_payload, transitions_payload, audit_events_payload from " +
      `${table} where idempotency_key = ? limit 1`,
    bindings: [{ name: "idempotency_key", value: input.idempotency_key }],
    lookup_keys: { idempotency_key: input.idempotency_key },
    payload_summary: {
      idempotency_key: input.idempotency_key,
      reservation_key: input.idempotency_key,
    },
  }
}

export function buildDeliveryHubExecutionLedgerSelectByReservationKeyQueryDescriptor(input: {
  reservation_key: string
  table_name?: string
}): DeliveryHubExecutionLedgerStorageQueryDescriptor {
  const table = buildExecutionLedgerTableName(input)

  return {
    version: DELIVERY_HUB_EXECUTION_LEDGER_DESCRIPTOR_VERSION,
    operation: "select_execution_by_reservation_key",
    inert: true,
    entity: DELIVERY_HUB_EXECUTION_LEDGER_STORAGE_ENTITY.main,
    table,
    sql:
      "select execution_reference, idempotency_key, execution_payload, reservation_payload, transitions_payload, audit_events_payload from " +
      `${table} where idempotency_key = ? limit 1`,
    bindings: [{ name: "reservation_key", value: input.reservation_key }],
    lookup_keys: { reservation_key: input.reservation_key },
    payload_summary: {
      reservation_key: input.reservation_key,
      idempotency_key: input.reservation_key,
    },
  }
}

export function buildDeliveryHubExecutionLedgerInsertReservationQueryDescriptor(
  input: DeliveryHubExecutionLedgerReserveInput & {
    table_name?: string
  }
): DeliveryHubExecutionLedgerStorageQueryDescriptor {
  const table = buildExecutionLedgerTableName(input)
  const record = buildDeliveryHubExecutionLedgerStorageReserveRecord(input)

  return {
    version: DELIVERY_HUB_EXECUTION_LEDGER_DESCRIPTOR_VERSION,
    operation: "insert_execution_reservation",
    inert: true,
    entity: DELIVERY_HUB_EXECUTION_LEDGER_STORAGE_ENTITY.main,
    table,
    sql:
      `insert into ${table} (execution_reference, idempotency_key, execution_payload, reservation_payload) values (?, ?, ?, ?) ` +
      "on conflict (idempotency_key) do nothing",
    bindings: [
      { name: "execution_reference", value: record.execution_reference },
      { name: "idempotency_key", value: record.idempotency_key },
      { name: "execution_payload", value: record.execution_payload },
      { name: "reservation_payload", value: record.reservation_payload },
    ],
    lookup_keys: {
      execution_reference: record.execution_reference,
      idempotency_key: record.idempotency_key,
      reservation_key: record.idempotency_key,
    },
    payload_summary: {
      execution_reference: record.execution_reference,
      idempotency_key: record.idempotency_key,
      reservation_key: record.idempotency_key,
      current_state: input.execution_record.current_state,
    },
  }
}

export function buildDeliveryHubExecutionLedgerInsertTransitionQueryDescriptor(
  input: DeliveryHubExecutionLedgerTransitionInput & {
    sequence: number
    recorded_at?: string
    table_name?: string
  }
): DeliveryHubExecutionLedgerStorageQueryDescriptor {
  const table = buildTransitionTableName(input)
  const record = buildDeliveryHubExecutionLedgerStorageTransitionRecord({
    sequence: input.sequence,
    recorded_at: input.recorded_at,
    execution_reference: input.execution_reference,
    from: input.from,
    to: input.to,
  })

  return {
    version: DELIVERY_HUB_EXECUTION_LEDGER_DESCRIPTOR_VERSION,
    operation: "insert_execution_transition",
    inert: true,
    entity: DELIVERY_HUB_EXECUTION_LEDGER_STORAGE_ENTITY.transitionLog,
    table,
    sql:
      `insert into ${table} (execution_reference, sequence, recorded_at, from_state, to_state, reason) values (?, ?, ?, ?, ?, ?)`,
    bindings: [
      { name: "execution_reference", value: record.execution_reference },
      { name: "sequence", value: record.sequence },
      { name: "recorded_at", value: record.recorded_at },
      { name: "from_state", value: record.from_state },
      { name: "to_state", value: record.to_state },
      { name: "reason", value: record.reason },
    ],
    lookup_keys: {
      execution_reference: record.execution_reference,
      sequence: record.sequence,
    },
    payload_summary: {
      execution_reference: record.execution_reference,
      transition: {
        from: input.from,
        to: input.to,
      },
      current_state: input.to,
    },
  }
}

export function buildDeliveryHubExecutionLedgerUpdateMainRecordQueryDescriptor(
  input: DeliveryHubExecutionLedgerStorageRecord & {
    table_name?: string
  }
): DeliveryHubExecutionLedgerStorageQueryDescriptor {
  const table = buildExecutionLedgerTableName(input)
  const ledgerRecord = mapDeliveryHubExecutionLedgerStorageRecordToLedgerRecord(input)

  return {
    version: DELIVERY_HUB_EXECUTION_LEDGER_DESCRIPTOR_VERSION,
    operation: "update_execution_main_record",
    inert: true,
    entity: DELIVERY_HUB_EXECUTION_LEDGER_STORAGE_ENTITY.main,
    table,
    sql:
      `update ${table} set execution_payload = ?, reservation_payload = ?, transitions_payload = ?, audit_events_payload = ? ` +
      "where execution_reference = ?",
    bindings: [
      { name: "execution_payload", value: input.execution_payload },
      { name: "reservation_payload", value: input.reservation_payload },
      { name: "transitions_payload", value: input.transitions_payload },
      { name: "audit_events_payload", value: input.audit_events_payload },
      { name: "execution_reference", value: input.execution_reference },
    ],
    lookup_keys: {
      execution_reference: input.execution_reference,
      idempotency_key: input.idempotency_key,
      reservation_key: input.idempotency_key,
    },
    payload_summary: {
      execution_reference: input.execution_reference,
      idempotency_key: input.idempotency_key,
      reservation_key: input.idempotency_key,
      current_state: ledgerRecord.execution.current_state,
    },
  }
}

export function buildDeliveryHubExecutionLedgerInsertAuditEventQueryDescriptor(
  input: DeliveryHubExecutionLedgerAppendAuditInput & {
    sequence: number
    recorded_at?: string
    table_name?: string
  }
): DeliveryHubExecutionLedgerStorageQueryDescriptor {
  const table = buildAuditTableName(input)
  const record = buildDeliveryHubExecutionLedgerStorageAppendAuditRecord({
    execution_reference: input.execution_reference,
    sequence: input.sequence,
    recorded_at: input.recorded_at,
    event: input.event,
  })

  return {
    version: DELIVERY_HUB_EXECUTION_LEDGER_DESCRIPTOR_VERSION,
    operation: "insert_execution_audit_event",
    inert: true,
    entity: DELIVERY_HUB_EXECUTION_LEDGER_STORAGE_ENTITY.auditEvent,
    table,
    sql: `insert into ${table} (execution_reference, sequence, recorded_at, event_payload) values (?, ?, ?, ?)`,
    bindings: [
      { name: "execution_reference", value: record.execution_reference },
      { name: "sequence", value: record.sequence },
      { name: "recorded_at", value: record.recorded_at },
      { name: "event_payload", value: record.event_payload },
    ],
    lookup_keys: {
      execution_reference: record.execution_reference,
      sequence: record.sequence,
    },
    payload_summary: {
      execution_reference: record.execution_reference,
      event_type: input.event.event_type,
      current_state: input.event.current_state,
    },
  }
}
