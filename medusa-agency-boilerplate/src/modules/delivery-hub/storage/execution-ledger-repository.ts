import {
  DELIVERY_HUB_EXECUTION_STATE,
  type DeliveryHubControlledExecutionRecordDraft,
  type DeliveryHubExecutionAuditDraft,
  type DeliveryHubExecutionReservationComparison,
  type DeliveryHubExecutionReservationDraft,
  type DeliveryHubExecutionState,
  compareDeliveryHubExecutionReservationDrafts,
  validateDeliveryHubExecutionStateTransition,
} from "../shipment-execution-contract"

export type DeliveryHubExecutionLedgerReservationStatus = "created" | "matched" | "drifted"

export type DeliveryHubExecutionLedgerTransitionStatus = "recorded" | "rejected"

export type DeliveryHubExecutionLedgerAuditEvent = {
  sequence: number
  recorded_at: string
  execution_reference: string
  event: DeliveryHubExecutionAuditDraft
}

export type DeliveryHubExecutionLedgerRecord = {
  execution: DeliveryHubControlledExecutionRecordDraft
  reservation: DeliveryHubExecutionReservationDraft
  transitions: DeliveryHubExecutionLedgerTransitionEntry[]
  audit_events: DeliveryHubExecutionLedgerAuditEvent[]
}

export type DeliveryHubExecutionLedgerTransitionEntry = {
  sequence: number
  recorded_at: string
  execution_reference: string
  from: DeliveryHubExecutionState
  to: DeliveryHubExecutionState
  reason: string
}

export type DeliveryHubExecutionLedgerReserveInput = {
  execution_record: DeliveryHubControlledExecutionRecordDraft
  reservation_draft: DeliveryHubExecutionReservationDraft
  audit_event?: DeliveryHubExecutionAuditDraft
}

export type DeliveryHubExecutionLedgerReserveResult = {
  status: DeliveryHubExecutionLedgerReservationStatus
  record: DeliveryHubExecutionLedgerRecord
  comparison: DeliveryHubExecutionReservationComparison
}

export type DeliveryHubExecutionLedgerTransitionInput = {
  execution_reference: string
  from: DeliveryHubExecutionState
  to: DeliveryHubExecutionState
  audit_event?: DeliveryHubExecutionAuditDraft
}

export type DeliveryHubExecutionLedgerTransitionResult = {
  status: DeliveryHubExecutionLedgerTransitionStatus
  record: DeliveryHubExecutionLedgerRecord | null
  reason: string
}

export type DeliveryHubExecutionLedgerAppendAuditInput = {
  execution_reference: string
  event: DeliveryHubExecutionAuditDraft
}

export interface DeliveryHubExecutionLedgerRepository {
  getExecutionByReference(
    executionReference: string
  ): Promise<DeliveryHubExecutionLedgerRecord | null>
  getExecutionByIdempotencyKey(
    idempotencyKey: string
  ): Promise<DeliveryHubExecutionLedgerRecord | null>
  reserveExecution(
    input: DeliveryHubExecutionLedgerReserveInput
  ): Promise<DeliveryHubExecutionLedgerReserveResult>
  recordTransition(
    input: DeliveryHubExecutionLedgerTransitionInput
  ): Promise<DeliveryHubExecutionLedgerTransitionResult>
  appendAuditEvent(
    input: DeliveryHubExecutionLedgerAppendAuditInput
  ): Promise<DeliveryHubExecutionLedgerRecord | null>
}

export function validateDeliveryHubExecutionLedgerReservation(input: {
  expected: DeliveryHubExecutionReservationDraft
  incoming: DeliveryHubExecutionReservationDraft
}): DeliveryHubExecutionReservationComparison {
  return compareDeliveryHubExecutionReservationDrafts(input)
}

export function validateDeliveryHubExecutionLedgerTransition(input: {
  from: DeliveryHubExecutionState
  to: DeliveryHubExecutionState
}) {
  return validateDeliveryHubExecutionStateTransition(input)
}

export function stableSerializeDeliveryHubExecutionLedgerValue(value: unknown): string {
  return JSON.stringify(sortDeliveryHubExecutionLedgerValue(value))
}

export function redactDeliveryHubExecutionLedgerValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => redactDeliveryHubExecutionLedgerValue(entry))
  }

  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((accumulator, key) => {
        const normalizedKey = key.toLowerCase()
        const entry = (value as Record<string, unknown>)[key]

        if (
          normalizedKey.includes("secret") ||
          normalizedKey.includes("token") ||
          normalizedKey.includes("password") ||
          normalizedKey.includes("authorization") ||
          normalizedKey.includes("credential")
        ) {
          accumulator[key] = "[redacted]"
          return accumulator
        }

        accumulator[key] = redactDeliveryHubExecutionLedgerValue(entry)
        return accumulator
      }, {})
  }

  if (typeof value === "string" && /bearer\s+/i.test(value)) {
    return "[redacted]"
  }

  return value
}

export class InMemoryDeliveryHubExecutionLedgerRepository
  implements DeliveryHubExecutionLedgerRepository
{
  private readonly recordsByReference = new Map<string, DeliveryHubExecutionLedgerRecord>()
  private readonly referencesByIdempotencyKey = new Map<string, string>()
  private sequence = 0

  async getExecutionByReference(
    executionReference: string
  ): Promise<DeliveryHubExecutionLedgerRecord | null> {
    return cloneLedgerRecord(this.recordsByReference.get(executionReference) ?? null)
  }

  async getExecutionByIdempotencyKey(
    idempotencyKey: string
  ): Promise<DeliveryHubExecutionLedgerRecord | null> {
    const executionReference = this.referencesByIdempotencyKey.get(idempotencyKey)

    if (!executionReference) {
      return null
    }

    return this.getExecutionByReference(executionReference)
  }

  async reserveExecution(
    input: DeliveryHubExecutionLedgerReserveInput
  ): Promise<DeliveryHubExecutionLedgerReserveResult> {
    const existingReference = this.referencesByIdempotencyKey.get(
      input.reservation_draft.reservation_key
    )
    const existingRecord = existingReference
      ? this.recordsByReference.get(existingReference) ?? null
      : null

    if (existingRecord) {
      const comparison = validateDeliveryHubExecutionLedgerReservation({
        expected: existingRecord.reservation,
        incoming: input.reservation_draft,
      })

      return {
        status: comparison.status === "match" ? "matched" : "drifted",
        record: cloneExistingLedgerRecord(existingRecord),
        comparison,
      }
    }

    const record: DeliveryHubExecutionLedgerRecord = {
      execution: cloneJson(input.execution_record),
      reservation: cloneJson(input.reservation_draft),
      transitions: [],
      audit_events: [],
    }

    if (input.audit_event) {
      record.audit_events.push(this.buildAuditEvent(input.execution_record.execution.execution_reference, input.audit_event))
    }

    this.recordsByReference.set(input.execution_record.execution.execution_reference, record)
    this.referencesByIdempotencyKey.set(
      input.reservation_draft.reservation_key,
      input.execution_record.execution.execution_reference
    )

    return {
      status: "created",
      record: cloneExistingLedgerRecord(record),
      comparison: validateDeliveryHubExecutionLedgerReservation({
        expected: input.reservation_draft,
        incoming: input.reservation_draft,
      }),
    }
  }

  async recordTransition(
    input: DeliveryHubExecutionLedgerTransitionInput
  ): Promise<DeliveryHubExecutionLedgerTransitionResult> {
    const record = this.recordsByReference.get(input.execution_reference) ?? null

    if (!record) {
      return {
        status: "rejected",
        record: null,
        reason: `Execution ${input.execution_reference} is not reserved in the in-memory controlled execution ledger.`,
      }
    }

    const transitionValidation = validateDeliveryHubExecutionLedgerTransition({
      from: input.from,
      to: input.to,
    })

    if (!transitionValidation.allowed || record.execution.current_state !== input.from) {
      const reason = !transitionValidation.allowed
        ? transitionValidation.reason
        : `Transition ${input.from} -> ${input.to} does not match current ledger state ${record.execution.current_state}.`

      return {
        status: "rejected",
        record: cloneLedgerRecord(record),
        reason,
      }
    }

    record.execution.current_state = input.to
    record.execution.terminality = {
      completed: input.to === DELIVERY_HUB_EXECUTION_STATE.completed,
      blocked: input.to === DELIVERY_HUB_EXECUTION_STATE.failedBlocked,
    }
    record.transitions.push({
      sequence: this.nextSequence(),
      recorded_at: "1970-01-01T00:00:00.000Z",
      execution_reference: input.execution_reference,
      from: input.from,
      to: input.to,
      reason: transitionValidation.reason,
    })

    if (input.audit_event) {
      record.audit_events.push(this.buildAuditEvent(input.execution_reference, input.audit_event))
    }

    return {
      status: "recorded",
      record: cloneLedgerRecord(record),
      reason: transitionValidation.reason,
    }
  }

  async appendAuditEvent(
    input: DeliveryHubExecutionLedgerAppendAuditInput
  ): Promise<DeliveryHubExecutionLedgerRecord | null> {
    const record = this.recordsByReference.get(input.execution_reference) ?? null

    if (!record) {
      return null
    }

    record.audit_events.push(this.buildAuditEvent(input.execution_reference, input.event))

    return cloneLedgerRecord(record)
  }

  private buildAuditEvent(
    executionReference: string,
    event: DeliveryHubExecutionAuditDraft
  ): DeliveryHubExecutionLedgerAuditEvent {
    return {
      sequence: this.nextSequence(),
      recorded_at: "1970-01-01T00:00:00.000Z",
      execution_reference: executionReference,
      event: cloneJson(redactDeliveryHubExecutionLedgerValue(event)) as DeliveryHubExecutionAuditDraft,
    }
  }

  private nextSequence(): number {
    this.sequence += 1
    return this.sequence
  }
}

function sortDeliveryHubExecutionLedgerValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sortDeliveryHubExecutionLedgerValue(entry))
  }

  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((accumulator, key) => {
        accumulator[key] = sortDeliveryHubExecutionLedgerValue(
          (value as Record<string, unknown>)[key]
        )
        return accumulator
      }, {})
  }

  return value
}

function cloneLedgerRecord(
  record: DeliveryHubExecutionLedgerRecord | null
): DeliveryHubExecutionLedgerRecord | null {
  return record ? cloneJson(record) : null
}

function cloneExistingLedgerRecord(
  record: DeliveryHubExecutionLedgerRecord
): DeliveryHubExecutionLedgerRecord {
  return cloneJson(record)
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
