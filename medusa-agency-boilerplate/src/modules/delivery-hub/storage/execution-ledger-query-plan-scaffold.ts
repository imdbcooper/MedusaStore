import type {
  DeliveryHubControlledExecutionRecordDraft,
  DeliveryHubExecutionAuditDraft,
} from "../shipment-execution-contract"
import type {
  DeliveryHubExecutionLedgerAppendAuditInput,
  DeliveryHubExecutionLedgerRecord,
  DeliveryHubExecutionLedgerReserveInput,
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
  buildDeliveryHubExecutionLedgerStorageRecord,
  buildDeliveryHubExecutionLedgerStorageReserveRecord,
  buildDeliveryHubExecutionLedgerStorageTransitionRecord,
  mapDeliveryHubExecutionLedgerStorageRecordToLedgerRecord,
} from "./execution-ledger-storage-adapter-scaffold"
import {
  type DeliveryHubExecutionLedgerStorageDescriptorBundle,
  type DeliveryHubExecutionLedgerStorageEntity,
  type DeliveryHubExecutionLedgerStorageQueryDescriptor,
  buildDeliveryHubExecutionLedgerInsertAuditEventQueryDescriptor,
  buildDeliveryHubExecutionLedgerInsertReservationQueryDescriptor,
  buildDeliveryHubExecutionLedgerInsertTransitionQueryDescriptor,
  buildDeliveryHubExecutionLedgerSelectByIdempotencyKeyQueryDescriptor,
  buildDeliveryHubExecutionLedgerSelectByReferenceQueryDescriptor,
  buildDeliveryHubExecutionLedgerSelectByReservationKeyQueryDescriptor,
  buildDeliveryHubExecutionLedgerStorageDescriptorBundle,
  buildDeliveryHubExecutionLedgerUpdateMainRecordQueryDescriptor,
} from "./execution-ledger-storage-descriptor-scaffold"

export const DELIVERY_HUB_EXECUTION_LEDGER_QUERY_PLAN_VERSION = 1
export const DELIVERY_HUB_EXECUTION_LEDGER_QUERY_PLAN_MODE = "plan_only"

export type DeliveryHubExecutionLedgerPlanOperation =
  | "getExecutionByReference"
  | "getExecutionByIdempotencyKey"
  | "reserveExecution"
  | "recordTransition"
  | "appendAuditEvent"
  | "refreshMainRecord"

export type DeliveryHubExecutionLedgerPlanMappingTarget =
  | "ledger_record"
  | "reserve_result"
  | "transition_result"
  | "audit_append_result"
  | "main_record_refresh_result"

export type DeliveryHubExecutionLedgerPlanStep = {
  kind: "lookup" | "write_projection"
  descriptor: DeliveryHubExecutionLedgerStorageQueryDescriptor
  entity: DeliveryHubExecutionLedgerStorageEntity
  execution_enabled: false
}

export type DeliveryHubExecutionLedgerQueryPlan = {
  version: typeof DELIVERY_HUB_EXECUTION_LEDGER_QUERY_PLAN_VERSION
  operation: DeliveryHubExecutionLedgerPlanOperation
  mode: typeof DELIVERY_HUB_EXECUTION_LEDGER_QUERY_PLAN_MODE
  execution_enabled: false
  runtime_wiring: "disabled"
  mapping_target: DeliveryHubExecutionLedgerPlanMappingTarget
  entity_kind: DeliveryHubExecutionLedgerStorageEntity
  steps: DeliveryHubExecutionLedgerPlanStep[]
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
    current_state?: DeliveryHubControlledExecutionRecordDraft["current_state"]
    event_type?: DeliveryHubExecutionAuditDraft["event_type"]
    transition?: {
      from: DeliveryHubExecutionLedgerTransitionInput["from"]
      to: DeliveryHubExecutionLedgerTransitionInput["to"]
    }
    audit_event_present?: boolean
    descriptor_bundle_version?: DeliveryHubExecutionLedgerStorageDescriptorBundle["version"]
  }
  descriptor_bundle?: DeliveryHubExecutionLedgerStorageDescriptorBundle
  storage_projection?: {
    reserve_record?: DeliveryHubExecutionLedgerStorageReserveRecord
    transition_record?: DeliveryHubExecutionLedgerStorageTransitionRecord
    append_audit_record?: DeliveryHubExecutionLedgerStorageAppendAuditRecord
    audit_record?: DeliveryHubExecutionLedgerStorageAuditRecord
    main_record?: DeliveryHubExecutionLedgerStorageRecord
  }
}

export type DeliveryHubExecutionLedgerPlanRecordMapper = {
  mode: typeof DELIVERY_HUB_EXECUTION_LEDGER_QUERY_PLAN_MODE
  execution_enabled: false
  entity_kind: "execution_ledger"
  target: "ledger_record"
  map: (record: DeliveryHubExecutionLedgerStorageRecord) => DeliveryHubExecutionLedgerRecord
}

export function buildDeliveryHubExecutionLedgerGetByReferencePlan(input: {
  execution_reference: string
  table_name?: string
}): DeliveryHubExecutionLedgerQueryPlan {
  const descriptor = buildDeliveryHubExecutionLedgerSelectByReferenceQueryDescriptor(input)

  return buildDeliveryHubExecutionLedgerQueryPlan({
    operation: "getExecutionByReference",
    mapping_target: "ledger_record",
    entity_kind: descriptor.entity,
    steps: [
      {
        kind: "lookup",
        descriptor,
        entity: descriptor.entity,
        execution_enabled: false,
      },
    ],
    lookup_keys: descriptor.lookup_keys,
    payload_summary: descriptor.payload_summary,
  })
}

export function buildDeliveryHubExecutionLedgerGetByIdempotencyKeyPlan(input: {
  idempotency_key: string
  table_name?: string
}): DeliveryHubExecutionLedgerQueryPlan {
  const descriptor = buildDeliveryHubExecutionLedgerSelectByIdempotencyKeyQueryDescriptor(input)

  return buildDeliveryHubExecutionLedgerQueryPlan({
    operation: "getExecutionByIdempotencyKey",
    mapping_target: "ledger_record",
    entity_kind: descriptor.entity,
    steps: [
      {
        kind: "lookup",
        descriptor,
        entity: descriptor.entity,
        execution_enabled: false,
      },
    ],
    lookup_keys: descriptor.lookup_keys,
    payload_summary: descriptor.payload_summary,
  })
}

export function buildDeliveryHubExecutionLedgerReserveExecutionPlan(
  input: DeliveryHubExecutionLedgerReserveInput & {
    table_name?: string
  }
): DeliveryHubExecutionLedgerQueryPlan {
  const reservationLookupDescriptor =
    buildDeliveryHubExecutionLedgerSelectByReservationKeyQueryDescriptor({
      reservation_key: input.reservation_draft.reservation_key,
      table_name: input.table_name,
    })
  const insertDescriptor = buildDeliveryHubExecutionLedgerInsertReservationQueryDescriptor({
    ...input,
    table_name: input.table_name,
  })
  const descriptorBundle = buildDeliveryHubExecutionLedgerStorageDescriptorBundle({
    execution_record: input.execution_record,
    reservation_draft: input.reservation_draft,
    audit_events: input.audit_event
      ? [
          {
            sequence: 1,
            recorded_at: "1970-01-01T00:00:00.000Z",
            execution_reference: input.execution_record.execution.execution_reference,
            event: input.audit_event,
          },
        ]
      : [],
  })

  return buildDeliveryHubExecutionLedgerQueryPlan({
    operation: "reserveExecution",
    mapping_target: "reserve_result",
    entity_kind: insertDescriptor.entity,
    steps: [
      {
        kind: "lookup",
        descriptor: reservationLookupDescriptor,
        entity: reservationLookupDescriptor.entity,
        execution_enabled: false,
      },
      {
        kind: "write_projection",
        descriptor: insertDescriptor,
        entity: insertDescriptor.entity,
        execution_enabled: false,
      },
    ],
    lookup_keys: insertDescriptor.lookup_keys,
    payload_summary: {
      ...insertDescriptor.payload_summary,
      audit_event_present: Boolean(input.audit_event),
      descriptor_bundle_version: descriptorBundle.version,
    },
    descriptor_bundle: descriptorBundle,
    storage_projection: {
      reserve_record: buildDeliveryHubExecutionLedgerStorageReserveRecord(input),
      main_record: buildDeliveryHubExecutionLedgerStorageRecord({
        execution_record: input.execution_record,
        reservation_draft: input.reservation_draft,
      }),
      audit_record: input.audit_event
        ? descriptorBundle.audit_records[0]
        : undefined,
      append_audit_record: input.audit_event
        ? descriptorBundle.append_audit_records[0]
        : undefined,
    },
  })
}

export function buildDeliveryHubExecutionLedgerRecordTransitionPlan(
  input: DeliveryHubExecutionLedgerTransitionInput & {
    sequence: number
    recorded_at?: string
    table_name?: string
  }
): DeliveryHubExecutionLedgerQueryPlan {
  const lookupDescriptor = buildDeliveryHubExecutionLedgerSelectByReferenceQueryDescriptor({
    execution_reference: input.execution_reference,
    table_name: input.table_name,
  })
  const insertDescriptor = buildDeliveryHubExecutionLedgerInsertTransitionQueryDescriptor(input)

  return buildDeliveryHubExecutionLedgerQueryPlan({
    operation: "recordTransition",
    mapping_target: "transition_result",
    entity_kind: insertDescriptor.entity,
    steps: [
      {
        kind: "lookup",
        descriptor: lookupDescriptor,
        entity: lookupDescriptor.entity,
        execution_enabled: false,
      },
      {
        kind: "write_projection",
        descriptor: insertDescriptor,
        entity: insertDescriptor.entity,
        execution_enabled: false,
      },
    ],
    lookup_keys: insertDescriptor.lookup_keys,
    payload_summary: {
      ...insertDescriptor.payload_summary,
      audit_event_present: Boolean(input.audit_event),
    },
    storage_projection: {
      transition_record: buildDeliveryHubExecutionLedgerStorageTransitionRecord({
        sequence: input.sequence,
        recorded_at: input.recorded_at,
        execution_reference: input.execution_reference,
        from: input.from,
        to: input.to,
      }),
      audit_record: input.audit_event
        ? buildDeliveryHubExecutionLedgerStorageAuditRecordFromInput({
            execution_reference: input.execution_reference,
            sequence: input.sequence,
            recorded_at: input.recorded_at,
            event: input.audit_event,
          })
        : undefined,
      append_audit_record: input.audit_event
        ? buildDeliveryHubExecutionLedgerStorageAppendAuditRecord({
            execution_reference: input.execution_reference,
            sequence: input.sequence,
            recorded_at: input.recorded_at,
            event: input.audit_event,
          })
        : undefined,
    },
  })
}

export function buildDeliveryHubExecutionLedgerRefreshMainRecordPlan(
  input: DeliveryHubExecutionLedgerStorageRecord & {
    table_name?: string
  }
): DeliveryHubExecutionLedgerQueryPlan {
  const descriptor = buildDeliveryHubExecutionLedgerUpdateMainRecordQueryDescriptor(input)

  return buildDeliveryHubExecutionLedgerQueryPlan({
    operation: "refreshMainRecord",
    mapping_target: "main_record_refresh_result",
    entity_kind: descriptor.entity,
    steps: [
      {
        kind: "write_projection",
        descriptor,
        entity: descriptor.entity,
        execution_enabled: false,
      },
    ],
    lookup_keys: descriptor.lookup_keys,
    payload_summary: descriptor.payload_summary,
    storage_projection: {
      main_record: {
        execution_reference: input.execution_reference,
        idempotency_key: input.idempotency_key,
        execution_payload: input.execution_payload,
        reservation_payload: input.reservation_payload,
        transitions_payload: input.transitions_payload,
        audit_events_payload: input.audit_events_payload,
      },
    },
  })
}

export function buildDeliveryHubExecutionLedgerAppendAuditEventPlan(
  input: DeliveryHubExecutionLedgerAppendAuditInput & {
    sequence: number
    recorded_at?: string
    table_name?: string
  }
): DeliveryHubExecutionLedgerQueryPlan {
  const lookupDescriptor = buildDeliveryHubExecutionLedgerSelectByReferenceQueryDescriptor({
    execution_reference: input.execution_reference,
    table_name: input.table_name,
  })
  const insertDescriptor = buildDeliveryHubExecutionLedgerInsertAuditEventQueryDescriptor(input)

  return buildDeliveryHubExecutionLedgerQueryPlan({
    operation: "appendAuditEvent",
    mapping_target: "audit_append_result",
    entity_kind: insertDescriptor.entity,
    steps: [
      {
        kind: "lookup",
        descriptor: lookupDescriptor,
        entity: lookupDescriptor.entity,
        execution_enabled: false,
      },
      {
        kind: "write_projection",
        descriptor: insertDescriptor,
        entity: insertDescriptor.entity,
        execution_enabled: false,
      },
    ],
    lookup_keys: insertDescriptor.lookup_keys,
    payload_summary: {
      ...insertDescriptor.payload_summary,
      audit_event_present: true,
    },
    storage_projection: {
      audit_record: buildDeliveryHubExecutionLedgerStorageAuditRecordFromInput({
        execution_reference: input.execution_reference,
        sequence: input.sequence,
        recorded_at: input.recorded_at,
        event: input.event,
      }),
      append_audit_record: buildDeliveryHubExecutionLedgerStorageAppendAuditRecord({
        execution_reference: input.execution_reference,
        sequence: input.sequence,
        recorded_at: input.recorded_at,
        event: input.event,
      }),
    },
  })
}

export function buildDeliveryHubExecutionLedgerPlanRecordMapper(): DeliveryHubExecutionLedgerPlanRecordMapper {
  return {
    mode: DELIVERY_HUB_EXECUTION_LEDGER_QUERY_PLAN_MODE,
    execution_enabled: false,
    entity_kind: "execution_ledger",
    target: "ledger_record",
    map: (record) => mapDeliveryHubExecutionLedgerPlanResultToLedgerRecord(record),
  }
}

export function mapDeliveryHubExecutionLedgerPlanResultToLedgerRecord(
  record: DeliveryHubExecutionLedgerStorageRecord
): DeliveryHubExecutionLedgerRecord {
  return mapDeliveryHubExecutionLedgerStorageRecordToLedgerRecord(record)
}

function buildDeliveryHubExecutionLedgerQueryPlan(input: {
  operation: DeliveryHubExecutionLedgerPlanOperation
  mapping_target: DeliveryHubExecutionLedgerPlanMappingTarget
  entity_kind: DeliveryHubExecutionLedgerStorageEntity
  steps: DeliveryHubExecutionLedgerPlanStep[]
  lookup_keys: DeliveryHubExecutionLedgerQueryPlan["lookup_keys"]
  payload_summary: DeliveryHubExecutionLedgerQueryPlan["payload_summary"]
  descriptor_bundle?: DeliveryHubExecutionLedgerStorageDescriptorBundle
  storage_projection?: DeliveryHubExecutionLedgerQueryPlan["storage_projection"]
}): DeliveryHubExecutionLedgerQueryPlan {
  return {
    version: DELIVERY_HUB_EXECUTION_LEDGER_QUERY_PLAN_VERSION,
    operation: input.operation,
    mode: DELIVERY_HUB_EXECUTION_LEDGER_QUERY_PLAN_MODE,
    execution_enabled: false,
    runtime_wiring: "disabled",
    mapping_target: input.mapping_target,
    entity_kind: input.entity_kind,
    steps: input.steps,
    lookup_keys: input.lookup_keys,
    payload_summary: input.payload_summary,
    descriptor_bundle: input.descriptor_bundle,
    storage_projection: input.storage_projection,
  }
}

function buildDeliveryHubExecutionLedgerStorageAuditRecordFromInput(input: {
  execution_reference: string
  sequence: number
  recorded_at?: string
  event: DeliveryHubExecutionAuditDraft
}): DeliveryHubExecutionLedgerStorageAuditRecord {
  return {
    execution_reference: input.execution_reference,
    sequence: input.sequence,
    recorded_at: input.recorded_at ?? "1970-01-01T00:00:00.000Z",
    event_payload: buildDeliveryHubExecutionLedgerStorageAppendAuditRecord({
      execution_reference: input.execution_reference,
      sequence: input.sequence,
      recorded_at: input.recorded_at,
      event: input.event,
    }).event_payload,
  }
}
