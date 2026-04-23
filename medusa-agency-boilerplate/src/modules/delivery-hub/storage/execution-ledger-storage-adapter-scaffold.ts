import type {
  DeliveryHubControlledExecutionRecordDraft,
  DeliveryHubExecutionAuditDraft,
  DeliveryHubExecutionReservationDraft,
} from "../shipment-execution-contract"
import type { DeliveryHubPgConnection } from "./pg"
import type {
  DeliveryHubExecutionLedgerAppendAuditInput,
  DeliveryHubExecutionLedgerAuditEvent,
  DeliveryHubExecutionLedgerRecord,
  DeliveryHubExecutionLedgerRepository,
  DeliveryHubExecutionLedgerReserveInput,
  DeliveryHubExecutionLedgerReserveResult,
  DeliveryHubExecutionLedgerTransitionEntry,
  DeliveryHubExecutionLedgerTransitionInput,
  DeliveryHubExecutionLedgerTransitionResult,
} from "./execution-ledger-repository"
import {
  redactDeliveryHubExecutionLedgerValue,
  stableSerializeDeliveryHubExecutionLedgerValue,
  validateDeliveryHubExecutionLedgerReservation,
  validateDeliveryHubExecutionLedgerTransition,
} from "./execution-ledger-repository"

const DELIVERY_HUB_EXECUTION_LEDGER_STORAGE_ADAPTER_ERROR_CODE =
  "DELIVERY_HUB_EXECUTION_LEDGER_STORAGE_ADAPTER_NOT_CONFIGURED"
const DELIVERY_HUB_EXECUTION_LEDGER_STORAGE_RECORDED_AT_PLACEHOLDER =
  "1970-01-01T00:00:00.000Z"

export type DeliveryHubExecutionLedgerStorageLookupKey = {
  execution_reference: string
  idempotency_key: string
}

export type DeliveryHubExecutionLedgerStorageRecord = {
  execution_reference: string
  idempotency_key: string
  execution_payload: string
  reservation_payload: string
  transitions_payload: string
  audit_events_payload: string
}

export type DeliveryHubExecutionLedgerStorageReserveRecord = {
  execution_reference: string
  idempotency_key: string
  execution_payload: string
  reservation_payload: string
}

export type DeliveryHubExecutionLedgerStorageTransitionRecord = {
  sequence: number
  recorded_at: string
  execution_reference: string
  from_state: DeliveryHubExecutionLedgerTransitionEntry["from"]
  to_state: DeliveryHubExecutionLedgerTransitionEntry["to"]
  reason: string
}

export type DeliveryHubExecutionLedgerStorageAuditRecord = {
  sequence: number
  recorded_at: string
  execution_reference: string
  event_payload: string
}

export type DeliveryHubExecutionLedgerStorageAppendAuditRecord = {
  execution_reference: string
  sequence: number
  recorded_at: string
  event_payload: string
}

export type DeliveryHubExecutionLedgerStorageAdapterScaffoldOptions = {
  connection?: DeliveryHubPgConnection | (() => DeliveryHubPgConnection | Promise<DeliveryHubPgConnection>)
  table_name?: string
}

export class DeliveryHubExecutionLedgerStorageAdapterNotConfiguredError extends Error {
  readonly code = DELIVERY_HUB_EXECUTION_LEDGER_STORAGE_ADAPTER_ERROR_CODE

  constructor(message = "Delivery Hub execution ledger storage adapter scaffold is inert and not configured for active persistence writes.") {
    super(message)
    this.name = "DeliveryHubExecutionLedgerStorageAdapterNotConfiguredError"
  }
}

export class DeliveryHubExecutionLedgerStorageAdapterScaffold
  implements DeliveryHubExecutionLedgerRepository
{
  protected readonly connection
  protected readonly tableName

  constructor(options?: DeliveryHubExecutionLedgerStorageAdapterScaffoldOptions) {
    this.connection = options?.connection
    this.tableName = normalizeDeliveryHubExecutionLedgerStorageTableName(
      options?.table_name
    )
  }

  async getExecutionByReference(
    executionReference: string
  ): Promise<DeliveryHubExecutionLedgerRecord | null> {
    const normalizedReference = executionReference.trim()

    if (!normalizedReference) {
      return null
    }

    return null
  }

  async getExecutionByIdempotencyKey(
    idempotencyKey: string
  ): Promise<DeliveryHubExecutionLedgerRecord | null> {
    const normalizedKey = idempotencyKey.trim()

    if (!normalizedKey) {
      return null
    }

    return null
  }

  async reserveExecution(
    input: DeliveryHubExecutionLedgerReserveInput
  ): Promise<DeliveryHubExecutionLedgerReserveResult> {
    buildDeliveryHubExecutionLedgerStorageReserveRecord(input)

    throw createDeliveryHubExecutionLedgerStorageAdapterNotConfiguredError({
      operation: "reserveExecution",
      detail: `Execution ${input.execution_record.execution.execution_reference} remains preview-only and is not persisted by the inert storage adapter scaffold.`,
    })
  }

  async recordTransition(
    input: DeliveryHubExecutionLedgerTransitionInput
  ): Promise<DeliveryHubExecutionLedgerTransitionResult> {
    buildDeliveryHubExecutionLedgerStorageTransitionRecord({
      sequence: 0,
      recorded_at: DELIVERY_HUB_EXECUTION_LEDGER_STORAGE_RECORDED_AT_PLACEHOLDER,
      execution_reference: input.execution_reference,
      from: input.from,
      to: input.to,
    })

    return {
      status: "rejected",
      record: null,
      reason: createDeliveryHubExecutionLedgerStorageAdapterNotConfiguredError({
        operation: "recordTransition",
        detail: `Execution ${input.execution_reference} remains preview-only and transition persistence is not wired into runtime.`,
      }).message,
    }
  }

  async appendAuditEvent(
    input: DeliveryHubExecutionLedgerAppendAuditInput
  ): Promise<DeliveryHubExecutionLedgerRecord | null> {
    buildDeliveryHubExecutionLedgerStorageAppendAuditRecord({
      execution_reference: input.execution_reference,
      sequence: 0,
      recorded_at: DELIVERY_HUB_EXECUTION_LEDGER_STORAGE_RECORDED_AT_PLACEHOLDER,
      event: input.event,
    })

    return null
  }

  protected async resolveConnection(): Promise<DeliveryHubPgConnection> {
    if (!this.connection) {
      throw createDeliveryHubExecutionLedgerStorageAdapterNotConfiguredError({
        operation: "resolveConnection",
        detail: "No explicit storage connection was supplied to the execution ledger scaffold.",
      })
    }

    if (typeof this.connection === "function") {
      return await this.connection()
    }

    return this.connection
  }
}

export function buildDeliveryHubExecutionLedgerStorageLookupKey(input: {
  execution_record: DeliveryHubControlledExecutionRecordDraft
  reservation_draft: DeliveryHubExecutionReservationDraft
}): DeliveryHubExecutionLedgerStorageLookupKey {
  return {
    execution_reference: input.execution_record.execution.execution_reference,
    idempotency_key: input.reservation_draft.reservation_key,
  }
}

export function buildDeliveryHubExecutionLedgerStorageReserveRecord(
  input: DeliveryHubExecutionLedgerReserveInput
): DeliveryHubExecutionLedgerStorageReserveRecord {
  const lookupKey = buildDeliveryHubExecutionLedgerStorageLookupKey({
    execution_record: input.execution_record,
    reservation_draft: input.reservation_draft,
  })

  return {
    execution_reference: lookupKey.execution_reference,
    idempotency_key: lookupKey.idempotency_key,
    execution_payload: serializeDeliveryHubExecutionLedgerExecutionRecordDraft(
      input.execution_record
    ),
    reservation_payload: serializeDeliveryHubExecutionLedgerReservationDraft(
      input.reservation_draft
    ),
  }
}

export function buildDeliveryHubExecutionLedgerStorageTransitionRecord(input: {
  sequence: number
  recorded_at?: string
  execution_reference: string
  from: DeliveryHubExecutionLedgerTransitionEntry["from"]
  to: DeliveryHubExecutionLedgerTransitionEntry["to"]
}): DeliveryHubExecutionLedgerStorageTransitionRecord {
  const validation = validateDeliveryHubExecutionLedgerTransition({
    from: input.from,
    to: input.to,
  })

  return {
    sequence: input.sequence,
    recorded_at:
      input.recorded_at ?? DELIVERY_HUB_EXECUTION_LEDGER_STORAGE_RECORDED_AT_PLACEHOLDER,
    execution_reference: input.execution_reference,
    from_state: input.from,
    to_state: input.to,
    reason: validation.reason,
  }
}

export function buildDeliveryHubExecutionLedgerStorageAuditRecord(input: {
  sequence: number
  recorded_at?: string
  execution_reference: string
  event: DeliveryHubExecutionAuditDraft
}): DeliveryHubExecutionLedgerStorageAuditRecord {
  return {
    sequence: input.sequence,
    recorded_at:
      input.recorded_at ?? DELIVERY_HUB_EXECUTION_LEDGER_STORAGE_RECORDED_AT_PLACEHOLDER,
    execution_reference: input.execution_reference,
    event_payload: serializeDeliveryHubExecutionLedgerAuditDraft(input.event),
  }
}

export function buildDeliveryHubExecutionLedgerStorageAppendAuditRecord(input: {
  execution_reference: string
  sequence: number
  recorded_at?: string
  event: DeliveryHubExecutionAuditDraft
}): DeliveryHubExecutionLedgerStorageAppendAuditRecord {
  return {
    execution_reference: input.execution_reference,
    sequence: input.sequence,
    recorded_at:
      input.recorded_at ?? DELIVERY_HUB_EXECUTION_LEDGER_STORAGE_RECORDED_AT_PLACEHOLDER,
    event_payload: serializeDeliveryHubExecutionLedgerAuditDraft(input.event),
  }
}

export function buildDeliveryHubExecutionLedgerStorageRecord(input: {
  execution_record: DeliveryHubControlledExecutionRecordDraft
  reservation_draft: DeliveryHubExecutionReservationDraft
  transitions?: DeliveryHubExecutionLedgerTransitionEntry[]
  audit_events?: DeliveryHubExecutionLedgerAuditEvent[]
}): DeliveryHubExecutionLedgerStorageRecord {
  const lookupKey = buildDeliveryHubExecutionLedgerStorageLookupKey({
    execution_record: input.execution_record,
    reservation_draft: input.reservation_draft,
  })

  return {
    execution_reference: lookupKey.execution_reference,
    idempotency_key: lookupKey.idempotency_key,
    execution_payload: serializeDeliveryHubExecutionLedgerExecutionRecordDraft(
      input.execution_record
    ),
    reservation_payload: serializeDeliveryHubExecutionLedgerReservationDraft(
      input.reservation_draft
    ),
    transitions_payload: serializeDeliveryHubExecutionLedgerTransitionEntries(
      input.transitions ?? []
    ),
    audit_events_payload: serializeDeliveryHubExecutionLedgerAuditEvents(
      input.audit_events ?? []
    ),
  }
}

export function mapDeliveryHubExecutionLedgerStorageRecordToLedgerRecord(
  record: DeliveryHubExecutionLedgerStorageRecord
): DeliveryHubExecutionLedgerRecord {
  const execution = deserializeDeliveryHubExecutionLedgerExecutionRecordDraft(
    record.execution_payload
  )
  const reservation = deserializeDeliveryHubExecutionLedgerReservationDraft(
    record.reservation_payload
  )

  validateDeliveryHubExecutionLedgerReservation({
    expected: reservation,
    incoming: {
      ...reservation,
      reservation_key: record.idempotency_key,
      execution_reference: record.execution_reference,
    },
  })

  return {
    execution,
    reservation: {
      ...reservation,
      reservation_key: record.idempotency_key,
      execution_reference: record.execution_reference,
    },
    transitions: deserializeDeliveryHubExecutionLedgerTransitionEntries(
      record.transitions_payload
    ),
    audit_events: deserializeDeliveryHubExecutionLedgerAuditEvents(
      record.audit_events_payload
    ),
  }
}

export function serializeDeliveryHubExecutionLedgerExecutionRecordDraft(
  draft: DeliveryHubControlledExecutionRecordDraft
): string {
  return stableSerializeDeliveryHubExecutionLedgerValue(draft)
}

export function deserializeDeliveryHubExecutionLedgerExecutionRecordDraft(
  payload: string
): DeliveryHubControlledExecutionRecordDraft {
  return JSON.parse(payload) as DeliveryHubControlledExecutionRecordDraft
}

export function serializeDeliveryHubExecutionLedgerReservationDraft(
  draft: DeliveryHubExecutionReservationDraft
): string {
  return stableSerializeDeliveryHubExecutionLedgerValue(draft)
}

export function deserializeDeliveryHubExecutionLedgerReservationDraft(
  payload: string
): DeliveryHubExecutionReservationDraft {
  return JSON.parse(payload) as DeliveryHubExecutionReservationDraft
}

export function serializeDeliveryHubExecutionLedgerAuditDraft(
  draft: DeliveryHubExecutionAuditDraft
): string {
  return stableSerializeDeliveryHubExecutionLedgerValue(
    redactDeliveryHubExecutionLedgerValue(draft)
  )
}

export function deserializeDeliveryHubExecutionLedgerAuditDraft(
  payload: string
): DeliveryHubExecutionAuditDraft {
  return JSON.parse(payload) as DeliveryHubExecutionAuditDraft
}

export function serializeDeliveryHubExecutionLedgerTransitionEntries(
  entries: DeliveryHubExecutionLedgerTransitionEntry[]
): string {
  return stableSerializeDeliveryHubExecutionLedgerValue(entries)
}

export function deserializeDeliveryHubExecutionLedgerTransitionEntries(
  payload: string
): DeliveryHubExecutionLedgerTransitionEntry[] {
  return JSON.parse(payload) as DeliveryHubExecutionLedgerTransitionEntry[]
}

export function serializeDeliveryHubExecutionLedgerAuditEvents(
  events: DeliveryHubExecutionLedgerAuditEvent[]
): string {
  return stableSerializeDeliveryHubExecutionLedgerValue(events)
}

export function deserializeDeliveryHubExecutionLedgerAuditEvents(
  payload: string
): DeliveryHubExecutionLedgerAuditEvent[] {
  return JSON.parse(payload) as DeliveryHubExecutionLedgerAuditEvent[]
}

export function normalizeDeliveryHubExecutionLedgerStorageTableName(
  value?: string
): string {
  const normalizedValue = value?.trim()

  return normalizedValue || "deliveryhub_execution_ledger"
}

export function createDeliveryHubExecutionLedgerStorageAdapterNotConfiguredError(input: {
  operation: string
  detail: string
}): DeliveryHubExecutionLedgerStorageAdapterNotConfiguredError {
  return new DeliveryHubExecutionLedgerStorageAdapterNotConfiguredError(
    `[${DELIVERY_HUB_EXECUTION_LEDGER_STORAGE_ADAPTER_ERROR_CODE}] ${input.operation}: ${input.detail}`
  )
}
