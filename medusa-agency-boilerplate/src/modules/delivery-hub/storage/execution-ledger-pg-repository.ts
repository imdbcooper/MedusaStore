import {
  DELIVERY_HUB_EXECUTION_STATE,
  type DeliveryHubExecutionAuditDraft,
} from "../shipment-execution-contract"
import type { DeliveryHubPgConnection } from "./pg"
import { getRawRows } from "./pg"
import {
  type DeliveryHubExecutionLedgerAppendAuditInput,
  type DeliveryHubExecutionLedgerAuditEvent,
  type DeliveryHubExecutionLedgerRecord,
  type DeliveryHubExecutionLedgerRepository,
  type DeliveryHubExecutionLedgerReserveInput,
  type DeliveryHubExecutionLedgerReserveResult,
  type DeliveryHubExecutionLedgerTransitionInput,
  type DeliveryHubExecutionLedgerTransitionResult,
  validateDeliveryHubExecutionLedgerReservation,
  validateDeliveryHubExecutionLedgerTransition,
} from "./execution-ledger-repository"
import {
  type DeliveryHubExecutionLedgerStorageRecord,
  buildDeliveryHubExecutionLedgerStorageRecord,
  deserializeDeliveryHubExecutionLedgerAuditDraft,
  mapDeliveryHubExecutionLedgerStorageRecordToLedgerRecord,
  normalizeDeliveryHubExecutionLedgerStorageTableName,
} from "./execution-ledger-storage-adapter-scaffold"
import {
  buildDeliveryHubExecutionLedgerAppendAuditEventPlan,
  buildDeliveryHubExecutionLedgerGetByIdempotencyKeyPlan,
  buildDeliveryHubExecutionLedgerGetByReferencePlan,
  buildDeliveryHubExecutionLedgerRecordTransitionPlan,
  buildDeliveryHubExecutionLedgerRefreshMainRecordPlan,
  buildDeliveryHubExecutionLedgerReserveExecutionPlan,
} from "./execution-ledger-query-plan-scaffold"
import {
  buildDeliveryHubExecutionLedgerAppendAuditTransactionPlan,
  buildDeliveryHubExecutionLedgerReserveTransactionPlan,
  buildDeliveryHubExecutionLedgerTransitionTransactionPlan,
} from "./execution-ledger-transaction-plan-scaffold"

const DELIVERY_HUB_EXECUTION_LEDGER_PG_RECORDED_AT_PLACEHOLDER =
  "1970-01-01T00:00:00.000Z"

export type DeliveryHubExecutionLedgerPgRepositoryOptions = {
  connection: DeliveryHubPgConnection
  table_name?: string
  now?: () => string
}

export class DeliveryHubExecutionLedgerPgRepository
  implements DeliveryHubExecutionLedgerRepository
{
  private readonly connection: DeliveryHubPgConnection
  private readonly tableName: string
  private readonly now: () => string

  constructor(options: DeliveryHubExecutionLedgerPgRepositoryOptions) {
    if (!options?.connection) {
      throw new Error(
        "DeliveryHubExecutionLedgerPgRepository requires an explicit DeliveryHubPgConnection injection."
      )
    }

    this.connection = options.connection
    this.tableName = normalizeDeliveryHubExecutionLedgerStorageTableName(options.table_name)
    this.now = options.now ?? (() => DELIVERY_HUB_EXECUTION_LEDGER_PG_RECORDED_AT_PLACEHOLDER)
  }

  async getExecutionByReference(
    executionReference: string
  ): Promise<DeliveryHubExecutionLedgerRecord | null> {
    const normalizedReference = executionReference.trim()

    if (!normalizedReference) {
      return null
    }

    const plan = buildDeliveryHubExecutionLedgerGetByReferencePlan({
      execution_reference: normalizedReference,
      table_name: this.tableName,
    })
    const descriptor = plan.steps[0]?.descriptor

    if (!descriptor) {
      return null
    }

    return this.selectOneLedgerRecord(
      descriptor.sql,
      descriptor.bindings.map((binding) => binding.value)
    )
  }

  async getExecutionByIdempotencyKey(
    idempotencyKey: string
  ): Promise<DeliveryHubExecutionLedgerRecord | null> {
    const normalizedKey = idempotencyKey.trim()

    if (!normalizedKey) {
      return null
    }

    const plan = buildDeliveryHubExecutionLedgerGetByIdempotencyKeyPlan({
      idempotency_key: normalizedKey,
      table_name: this.tableName,
    })
    const descriptor = plan.steps[0]?.descriptor

    if (!descriptor) {
      return null
    }

    return this.selectOneLedgerRecord(
      descriptor.sql,
      descriptor.bindings.map((binding) => binding.value)
    )
  }

  async reserveExecution(
    input: DeliveryHubExecutionLedgerReserveInput
  ): Promise<DeliveryHubExecutionLedgerReserveResult> {
    const existing = await this.getExecutionByIdempotencyKey(
      input.reservation_draft.reservation_key
    )

    if (existing) {
      const comparison = validateDeliveryHubExecutionLedgerReservation({
        expected: existing.reservation,
        incoming: input.reservation_draft,
      })

      return {
        status: comparison.status === "match" ? "matched" : "drifted",
        record: cloneJson(existing),
        comparison,
      }
    }

    const plan = buildDeliveryHubExecutionLedgerReserveExecutionPlan({
      ...input,
      table_name: this.tableName,
    })
    buildDeliveryHubExecutionLedgerReserveTransactionPlan({
      ...input,
      table_name: this.tableName,
    })

    const insertDescriptor = plan.steps.find(
      (step) => step.descriptor.operation === "insert_execution_reservation"
    )?.descriptor

    if (!insertDescriptor) {
      throw new Error("Execution ledger reserve plan did not include reservation insert descriptor.")
    }

    const insertResult = await this.connection.raw(
      insertDescriptor.sql,
      insertDescriptor.bindings.map((binding) => binding.value)
    )
    const inserted = didDeliveryHubExecutionLedgerInsertCreateRow(insertResult)

    if (!inserted) {
      const conflicted = await this.getExecutionByIdempotencyKey(
        input.reservation_draft.reservation_key
      )

      if (conflicted) {
        const comparison = validateDeliveryHubExecutionLedgerReservation({
          expected: conflicted.reservation,
          incoming: input.reservation_draft,
        })

        return {
          status: comparison.status === "match" ? "matched" : "drifted",
          record: cloneJson(conflicted),
          comparison,
        }
      }
    }

    let record: DeliveryHubExecutionLedgerRecord = {
      execution: cloneJson(input.execution_record),
      reservation: cloneJson(input.reservation_draft),
      transitions: [],
      audit_events: [],
    }

    if (input.audit_event) {
      const auditEvent = this.buildAuditEvent({
        execution_reference: input.execution_record.execution.execution_reference,
        event: input.audit_event,
        sequence: 1,
      })
      record = {
        ...record,
        audit_events: [auditEvent],
      }

      await this.insertAuditEvent(auditEvent)
    }

    await this.updateMainRecord(record)

    const stored =
      (await this.getExecutionByReference(
        input.execution_record.execution.execution_reference
      )) ?? record

    return {
      status: "created",
      record: cloneJson(stored),
      comparison: validateDeliveryHubExecutionLedgerReservation({
        expected: stored.reservation,
        incoming: input.reservation_draft,
      }),
    }
  }

  async recordTransition(
    input: DeliveryHubExecutionLedgerTransitionInput
  ): Promise<DeliveryHubExecutionLedgerTransitionResult> {
    const existing = await this.getExecutionByReference(input.execution_reference)

    if (!existing) {
      return {
        status: "rejected",
        record: null,
        reason: `Execution ${input.execution_reference} is not reserved in the controlled execution ledger pg repository.`,
      }
    }

    const transitionValidation = validateDeliveryHubExecutionLedgerTransition({
      from: input.from,
      to: input.to,
    })

    if (!transitionValidation.allowed || existing.execution.current_state !== input.from) {
      const reason = !transitionValidation.allowed
        ? transitionValidation.reason
        : `Transition ${input.from} -> ${input.to} does not match current ledger state ${existing.execution.current_state}.`

      return {
        status: "rejected",
        record: cloneJson(existing),
        reason,
      }
    }

    const sequence = this.nextSequence(existing)
    const transition = {
      sequence,
      recorded_at: this.now(),
      execution_reference: input.execution_reference,
      from: input.from,
      to: input.to,
      reason: transitionValidation.reason,
    }
    const updatedRecord: DeliveryHubExecutionLedgerRecord = {
      ...cloneJson(existing),
      execution: {
        ...cloneJson(existing.execution),
        current_state: input.to,
        terminality: {
          completed: input.to === DELIVERY_HUB_EXECUTION_STATE.completed,
          blocked: input.to === DELIVERY_HUB_EXECUTION_STATE.failedBlocked,
        },
      },
      transitions: [...existing.transitions, transition],
      audit_events: input.audit_event
        ? [
            ...existing.audit_events,
            this.buildAuditEvent({
              execution_reference: input.execution_reference,
              event: input.audit_event,
              sequence: sequence + 1,
            }),
          ]
        : existing.audit_events,
    }

    const transitionPlan = buildDeliveryHubExecutionLedgerRecordTransitionPlan({
      ...input,
      sequence: transition.sequence,
      recorded_at: transition.recorded_at,
      table_name: this.tableName,
    })
    buildDeliveryHubExecutionLedgerTransitionTransactionPlan({
      ...input,
      sequence: transition.sequence,
      recorded_at: transition.recorded_at,
      table_name: this.tableName,
    })

    const insertDescriptor = transitionPlan.steps.find(
      (step) => step.descriptor.operation === "insert_execution_transition"
    )?.descriptor

    if (!insertDescriptor) {
      throw new Error("Execution ledger transition plan did not include transition insert descriptor.")
    }

    await this.connection.raw(
      insertDescriptor.sql,
      insertDescriptor.bindings.map((binding) => binding.value)
    )

    if (input.audit_event) {
      await this.insertAuditEvent(updatedRecord.audit_events[updatedRecord.audit_events.length - 1]!)
    }

    await this.updateMainRecord(updatedRecord)

    return {
      status: "recorded",
      record: cloneJson(updatedRecord),
      reason: transitionValidation.reason,
    }
  }

  async appendAuditEvent(
    input: DeliveryHubExecutionLedgerAppendAuditInput
  ): Promise<DeliveryHubExecutionLedgerRecord | null> {
    const existing = await this.getExecutionByReference(input.execution_reference)

    if (!existing) {
      return null
    }

    const auditEvent = this.buildAuditEvent({
      execution_reference: input.execution_reference,
      event: input.event,
      sequence: this.nextSequence(existing),
    })
    const updatedRecord: DeliveryHubExecutionLedgerRecord = {
      ...cloneJson(existing),
      audit_events: [...existing.audit_events, auditEvent],
    }

    buildDeliveryHubExecutionLedgerAppendAuditTransactionPlan({
      ...input,
      sequence: auditEvent.sequence,
      recorded_at: auditEvent.recorded_at,
      table_name: this.tableName,
    })
    await this.insertAuditEvent(auditEvent)
    await this.updateMainRecord(updatedRecord)

    return cloneJson(updatedRecord)
  }

  private async selectOneLedgerRecord(
    sql: string,
    bindings: unknown[]
  ): Promise<DeliveryHubExecutionLedgerRecord | null> {
    const rows = getRawRows<DeliveryHubExecutionLedgerStorageRecord>(
      await this.connection.raw(sql, bindings)
    )
    const row = rows[0]

    if (!row) {
      return null
    }

    return mapDeliveryHubExecutionLedgerStorageRecordToLedgerRecord(
      normalizeStorageRecord(row)
    )
  }

  private async insertAuditEvent(
    event: DeliveryHubExecutionLedgerAuditEvent
  ): Promise<void> {
    const plan = buildDeliveryHubExecutionLedgerAppendAuditEventPlan({
      execution_reference: event.execution_reference,
      event: event.event,
      sequence: event.sequence,
      recorded_at: event.recorded_at,
      table_name: this.tableName,
    })
    const descriptor = plan.steps.find(
      (step) => step.descriptor.operation === "insert_execution_audit_event"
    )?.descriptor

    if (!descriptor) {
      throw new Error("Execution ledger audit plan did not include audit insert descriptor.")
    }

    await this.connection.raw(
      descriptor.sql,
      descriptor.bindings.map((binding) => binding.value)
    )
  }

  private async updateMainRecord(record: DeliveryHubExecutionLedgerRecord): Promise<void> {
    const storageRecord = buildDeliveryHubExecutionLedgerStorageRecord({
      execution_record: record.execution,
      reservation_draft: record.reservation,
      transitions: record.transitions,
      audit_events: record.audit_events,
    })
    const plan = buildDeliveryHubExecutionLedgerRefreshMainRecordPlan({
      ...storageRecord,
      table_name: this.tableName,
    })
    const descriptor = plan.steps.find(
      (step) => step.descriptor.operation === "update_execution_main_record"
    )?.descriptor

    if (!descriptor) {
      throw new Error("Execution ledger main-record refresh plan did not include update descriptor.")
    }

    await this.connection.raw(
      descriptor.sql,
      descriptor.bindings.map((binding) => binding.value)
    )
  }

  private buildAuditEvent(input: {
    execution_reference: string
    event: DeliveryHubExecutionAuditDraft
    sequence: number
  }): DeliveryHubExecutionLedgerAuditEvent {
    const recordedAt = this.now()
    const payload = buildDeliveryHubExecutionLedgerAppendAuditEventPlan({
      execution_reference: input.execution_reference,
      event: input.event,
      sequence: input.sequence,
      recorded_at: recordedAt,
      table_name: this.tableName,
    }).storage_projection?.append_audit_record?.event_payload

    if (!payload) {
      throw new Error("Execution ledger audit plan did not include redacted audit payload.")
    }

    return {
      sequence: input.sequence,
      recorded_at: recordedAt,
      execution_reference: input.execution_reference,
      event: deserializeDeliveryHubExecutionLedgerAuditDraft(payload),
    }
  }

  private nextSequence(record: DeliveryHubExecutionLedgerRecord): number {
    const transitionSequences = record.transitions.map((entry) => entry.sequence)
    const auditSequences = record.audit_events.map((entry) => entry.sequence)

    return Math.max(0, ...transitionSequences, ...auditSequences) + 1
  }
}

function normalizeStorageRecord(
  record: DeliveryHubExecutionLedgerStorageRecord
): DeliveryHubExecutionLedgerStorageRecord {
  return {
    execution_reference: record.execution_reference,
    idempotency_key: record.idempotency_key,
    execution_payload: normalizePayload(record.execution_payload),
    reservation_payload: normalizePayload(record.reservation_payload),
    transitions_payload: normalizePayload(record.transitions_payload ?? []),
    audit_events_payload: normalizePayload(record.audit_events_payload ?? []),
  }
}

function normalizePayload(value: unknown): string {
  if (typeof value === "string") {
    return value
  }

  return JSON.stringify(value)
}

function didDeliveryHubExecutionLedgerInsertCreateRow(result: unknown): boolean {
  const rowCount = (result as { rowCount?: unknown; rowsAffected?: unknown })?.rowCount
  const rowsAffected = (result as { rowCount?: unknown; rowsAffected?: unknown })?.rowsAffected
  const affected = rowCount ?? rowsAffected

  if (typeof affected === "number") {
    return affected > 0
  }

  if (Array.isArray(affected)) {
    return Number(affected[0] ?? 0) > 0
  }

  return true
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
