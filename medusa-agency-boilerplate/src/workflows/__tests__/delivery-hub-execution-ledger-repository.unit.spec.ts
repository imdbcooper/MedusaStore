import { describe, expect, it, jest } from "@jest/globals"
import type { DeliveryHubProviderExecutionPlan } from "../../modules/delivery-hub/fulfillment-provider-bridge"
import { createDeliveryHubQuoteReference } from "../../modules/delivery-hub/cart-selection"
import { DELIVERY_HUB_MODE_CODE } from "../../modules/delivery-hub/constants"
import {
  DELIVERY_HUB_EXECUTION_STATE,
  buildDeliveryHubControlledExecutionAuditDraft,
  buildDeliveryHubControlledExecutionIdentity,
  buildDeliveryHubControlledExecutionRecordDraft,
  buildDeliveryHubControlledExecutionReservationDraft,
} from "../../modules/delivery-hub/shipment-execution-contract"
import {
  InMemoryDeliveryHubExecutionLedgerRepository,
  redactDeliveryHubExecutionLedgerValue,
  stableSerializeDeliveryHubExecutionLedgerValue,
} from "../../modules/delivery-hub/storage/execution-ledger-repository"
import type { DeliveryHubPgConnection } from "../../modules/delivery-hub/storage/pg"
import { DeliveryHubExecutionLedgerPgRepository } from "../../modules/delivery-hub/storage/execution-ledger-pg-repository"
import {
  DeliveryHubExecutionLedgerStorageAdapterScaffold,
  buildDeliveryHubExecutionLedgerStorageAppendAuditRecord,
  buildDeliveryHubExecutionLedgerStorageAuditRecord,
  buildDeliveryHubExecutionLedgerStorageLookupKey,
  buildDeliveryHubExecutionLedgerStorageRecord,
  buildDeliveryHubExecutionLedgerStorageReserveRecord,
  buildDeliveryHubExecutionLedgerStorageTransitionRecord,
  mapDeliveryHubExecutionLedgerStorageRecordToLedgerRecord,
  serializeDeliveryHubExecutionLedgerAuditDraft,
} from "../../modules/delivery-hub/storage/execution-ledger-storage-adapter-scaffold"
import {
  DELIVERY_HUB_EXECUTION_LEDGER_STORAGE_ENTITY,
  buildDeliveryHubExecutionLedgerInsertAuditEventQueryDescriptor,
  buildDeliveryHubExecutionLedgerInsertReservationQueryDescriptor,
  buildDeliveryHubExecutionLedgerInsertTransitionQueryDescriptor,
  buildDeliveryHubExecutionLedgerSelectByIdempotencyKeyQueryDescriptor,
  buildDeliveryHubExecutionLedgerSelectByReferenceQueryDescriptor,
  buildDeliveryHubExecutionLedgerSelectByReservationKeyQueryDescriptor,
  buildDeliveryHubExecutionLedgerStorageDescriptorBundle,
  buildDeliveryHubExecutionLedgerUpdateMainRecordQueryDescriptor,
  listDeliveryHubExecutionLedgerStorageEntityDescriptors,
} from "../../modules/delivery-hub/storage/execution-ledger-storage-descriptor-scaffold"
import {
  DELIVERY_HUB_EXECUTION_LEDGER_QUERY_PLAN_MODE,
  buildDeliveryHubExecutionLedgerAppendAuditEventPlan,
  buildDeliveryHubExecutionLedgerGetByIdempotencyKeyPlan,
  buildDeliveryHubExecutionLedgerGetByReferencePlan,
  buildDeliveryHubExecutionLedgerPlanRecordMapper,
  buildDeliveryHubExecutionLedgerRecordTransitionPlan,
  buildDeliveryHubExecutionLedgerRefreshMainRecordPlan,
  buildDeliveryHubExecutionLedgerReserveExecutionPlan,
  mapDeliveryHubExecutionLedgerPlanResultToLedgerRecord,
} from "../../modules/delivery-hub/storage/execution-ledger-query-plan-scaffold"
import {
  DELIVERY_HUB_EXECUTION_LEDGER_TRANSACTION_PLAN_MODE,
  buildDeliveryHubExecutionLedgerAppendAuditTransactionPlan,
  buildDeliveryHubExecutionLedgerFailedBlockedTransactionPlan,
  buildDeliveryHubExecutionLedgerReserveTransactionPlan,
  buildDeliveryHubExecutionLedgerTransitionTransactionPlan,
} from "../../modules/delivery-hub/storage/execution-ledger-transaction-plan-scaffold"
import {
  DELIVERY_HUB_EXECUTION_LEDGER_REPOSITORY_ASSEMBLY_MODE,
  DELIVERY_HUB_EXECUTION_LEDGER_REPOSITORY_PORT_OPERATIONS,
  buildDeliveryHubExecutionLedgerRepositoryAssemblyReadiness,
  createDeliveryHubExecutionLedgerPgRepository,
  createDeliveryHubExecutionLedgerRepositoryAssemblyWithInertAdapter,
} from "../../modules/delivery-hub/storage/execution-ledger-repository-assembly-scaffold"
import { buildDeliveryHubExecutionLedgerPgMigrationArtifact } from "../../modules/delivery-hub/storage/execution-ledger-pg-migration-artifact"
import { DELIVERY_HUB_EXECUTION_LEDGER_SCHEMA_VERIFICATION_MODE } from "../../modules/delivery-hub/storage/execution-ledger-schema-verification-scaffold"
import {
  DELIVERY_HUB_EXECUTION_LEDGER_SCHEMA_CHECK_PLAN_MODE,
  DELIVERY_HUB_EXECUTION_LEDGER_SCHEMA_CHECK_PLAN_SOURCE,
} from "../../modules/delivery-hub/storage/execution-ledger-schema-check-plan-scaffold"
import {
  DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
  DELIVERY_HUB_FULFILLMENT_PROVIDER_ID,
} from "../../modules/delivery-hub/shipping-option-contract"

describe("Delivery Hub execution ledger repository scaffold", () => {
  it("requires explicit pg connection injection for controlled durable repository", () => {
    expect(() => new DeliveryHubExecutionLedgerPgRepository({} as never)).toThrow(
      "DeliveryHubExecutionLedgerPgRepository requires an explicit DeliveryHubPgConnection injection."
    )

    const connection = createFakePgConnection()
    const repository = createDeliveryHubExecutionLedgerPgRepository({ connection })

    expect(repository).toBeInstanceOf(DeliveryHubExecutionLedgerPgRepository)
    expect(connection.calls).toEqual([])
  })

  it("maps pg lookup rows by execution reference and idempotency key through storage mapper", async () => {
    const { repository, identity, reservationDraft, recordDraft } = await buildReservedPgRepository()

    const byReference = await repository.getExecutionByReference(identity.execution_reference)
    const byIdempotency = await repository.getExecutionByIdempotencyKey(
      identity.idempotency_key
    )

    expect(byReference).toEqual({
      execution: recordDraft,
      reservation: reservationDraft,
      transitions: [],
      audit_events: [],
    })
    expect(byIdempotency).toEqual(byReference)
  })

  it("reserves the same draft idempotently in pg repository", async () => {
    const connection = createFakePgConnection()
    const executionPlan = buildExecutionPlan()
    const identity = buildDeliveryHubControlledExecutionIdentity(executionPlan)
    const reservationDraft = buildDeliveryHubControlledExecutionReservationDraft({
      execution_plan: executionPlan,
      execution_identity: identity,
    })
    const executionRecord = buildDeliveryHubControlledExecutionRecordDraft({
      execution_plan: executionPlan,
      execution_identity: identity,
      reservation_draft: reservationDraft,
    })
    const repository = new DeliveryHubExecutionLedgerPgRepository({ connection })

    const created = await repository.reserveExecution({
      execution_record: executionRecord,
      reservation_draft: reservationDraft,
    })
    const matched = await repository.reserveExecution({
      execution_record: executionRecord,
      reservation_draft: reservationDraft,
    })

    expect(created.status).toBe("created")
    expect(matched.status).toBe("matched")
    expect(matched.record).toEqual(created.record)
    expect(matched.comparison.status).toBe("match")
    expect(connection.calls.some((call) => call.sql.startsWith("insert into deliveryhub_execution_ledger"))).toBe(true)
  })

  it("reports pg reservation drift without corrupting existing record", async () => {
    const { repository, identity, recordDraft, reservationDraft } = await buildReservedPgRepository()
    const before = await repository.getExecutionByReference(identity.execution_reference)
    const driftedReservation = {
      ...reservationDraft,
      plan_fingerprint: `${reservationDraft.plan_fingerprint.slice(0, 63)}0`,
      reservation_fingerprint: `${reservationDraft.reservation_fingerprint.slice(0, 63)}0`,
    }

    const drifted = await repository.reserveExecution({
      execution_record: recordDraft,
      reservation_draft: driftedReservation,
    })
    const after = await repository.getExecutionByReference(identity.execution_reference)

    expect(drifted.status).toBe("drifted")
    expect(drifted.comparison.drift_reasons).toEqual([
      "plan_fingerprint_mismatch",
      "reservation_fingerprint_mismatch",
    ])
    expect(after).toEqual(before)
  })

  it("re-reads pg reservation after insert conflict and avoids non-owned audit or main updates", async () => {
    const connection = createFakePgConnection({ conflictNextReservationInsert: true })
    const existingPlan = buildExecutionPlan()
    const existingIdentity = buildDeliveryHubControlledExecutionIdentity(existingPlan)
    const existingReservation = buildDeliveryHubControlledExecutionReservationDraft({
      execution_plan: existingPlan,
      execution_identity: existingIdentity,
    })
    const existingRecord = buildDeliveryHubControlledExecutionRecordDraft({
      execution_plan: existingPlan,
      execution_identity: existingIdentity,
      reservation_draft: existingReservation,
    })
    const incomingPlan = buildExecutionPlan({
      items: [
        {
          line_item_id: "item_1",
          quantity: 2,
        },
      ],
    })
    const incomingIdentity = {
      ...buildDeliveryHubControlledExecutionIdentity(incomingPlan),
      idempotency_key: existingIdentity.idempotency_key,
    }
    const incomingReservation = {
      ...buildDeliveryHubControlledExecutionReservationDraft({
        execution_plan: incomingPlan,
        execution_identity: incomingIdentity,
      }),
      reservation_key: existingReservation.reservation_key,
    }
    const incomingRecord = buildDeliveryHubControlledExecutionRecordDraft({
      execution_plan: incomingPlan,
      execution_identity: incomingIdentity,
      reservation_draft: incomingReservation,
    })
    const auditDraft = buildDeliveryHubControlledExecutionAuditDraft({
      execution_plan: incomingPlan,
      execution_identity: incomingIdentity,
    })
    const repository = new DeliveryHubExecutionLedgerPgRepository({ connection })

    seedFakePgLedgerRecord(connection, {
      execution_record: existingRecord,
      reservation_draft: existingReservation,
    })
    connection.referenceByIdempotencyKey.clear()
    connection.rowsByReference.delete(existingIdentity.execution_reference)
    connection.rowsByReference.set(incomingIdentity.execution_reference, buildDeliveryHubExecutionLedgerStorageRecord({
      execution_record: existingRecord,
      reservation_draft: existingReservation,
    }))

    const result = await repository.reserveExecution({
      execution_record: incomingRecord,
      reservation_draft: incomingReservation,
      audit_event: auditDraft,
    })

    expect(result.status).toBe("drifted")
    expect(result.status).not.toBe("created")
    expect(result.record).toEqual({
      execution: existingRecord,
      reservation: existingReservation,
      transitions: [],
      audit_events: [],
    })
    expect(result.comparison.drift_reasons).toEqual(
      expect.arrayContaining([
        "plan_fingerprint_mismatch",
        "execution_fingerprint_mismatch",
        "reservation_fingerprint_mismatch",
      ])
    )
    expect(connection.calls.filter((call) => call.sql.includes(" where idempotency_key = ? limit 1"))).toHaveLength(2)
    expect(connection.calls.some((call) => call.sql.startsWith("insert into deliveryhub_execution_ledger_audit_events"))).toBe(false)
    expect(connection.calls.some((call) => call.sql.startsWith("update deliveryhub_execution_ledger set "))).toBe(false)
  })

  it("records valid pg transition and rejects invalid or current-state mismatches", async () => {
    const { repository, identity } = await buildReservedPgRepository()

    const recorded = await repository.recordTransition({
      execution_reference: identity.execution_reference,
      from: DELIVERY_HUB_EXECUTION_STATE.planned,
      to: DELIVERY_HUB_EXECUTION_STATE.reserved,
    })
    const mismatch = await repository.recordTransition({
      execution_reference: identity.execution_reference,
      from: DELIVERY_HUB_EXECUTION_STATE.planned,
      to: DELIVERY_HUB_EXECUTION_STATE.reserved,
    })
    const invalid = await repository.recordTransition({
      execution_reference: identity.execution_reference,
      from: DELIVERY_HUB_EXECUTION_STATE.reserved,
      to: DELIVERY_HUB_EXECUTION_STATE.resultReceived,
    })

    expect(recorded.status).toBe("recorded")
    expect(recorded.record?.execution.current_state).toBe(DELIVERY_HUB_EXECUTION_STATE.reserved)
    expect(recorded.record?.transitions).toEqual([
      expect.objectContaining({
        sequence: 1,
        from: DELIVERY_HUB_EXECUTION_STATE.planned,
        to: DELIVERY_HUB_EXECUTION_STATE.reserved,
      }),
    ])
    expect(mismatch.status).toBe("rejected")
    expect(mismatch.reason).toBe(
      "Transition planned -> reserved does not match current ledger state reserved."
    )
    expect(invalid.status).toBe("rejected")
    expect(invalid.reason).toBe(
      "Transition reserved -> result_received is not allowed by the controlled execution contract."
    )
  })

  it("uses descriptor/query-plan generated SQL and bindings for pg main-record refreshes", async () => {
    const { repository, connection, identity, recordDraft, reservationDraft } = await buildReservedPgRepository()

    const recorded = await repository.recordTransition({
      execution_reference: identity.execution_reference,
      from: DELIVERY_HUB_EXECUTION_STATE.planned,
      to: DELIVERY_HUB_EXECUTION_STATE.reserved,
    })
    const storageRecord = buildDeliveryHubExecutionLedgerStorageRecord({
      execution_record: recorded.record!.execution,
      reservation_draft: reservationDraft,
      transitions: recorded.record!.transitions,
      audit_events: recorded.record!.audit_events,
    })
    const descriptor = buildDeliveryHubExecutionLedgerRefreshMainRecordPlan({
      ...storageRecord,
      table_name: "deliveryhub_execution_ledger",
    }).steps[0]!.descriptor
    const refreshCalls = connection.calls.filter(
      (call) => call.sql === descriptor.sql
    )

    expect(recordDraft.execution.execution_reference).toBe(identity.execution_reference)
    expect(descriptor.operation).toBe("update_execution_main_record")
    expect(refreshCalls.at(-1)).toEqual({
      sql: descriptor.sql,
      bindings: descriptor.bindings.map((binding) => binding.value),
    })
    expect(connection.rowsByReference.get(identity.execution_reference)?.transitions_payload).toBe(
      storageRecord.transitions_payload
    )
  })

  it("proves repository reserve success SQL matches descriptors, refresh plan and migration artifact", async () => {
    const connection = createFakePgConnection()
    const repository = new DeliveryHubExecutionLedgerPgRepository({ connection })
    const executionPlan = buildExecutionPlan()
    const identity = buildDeliveryHubControlledExecutionIdentity(executionPlan)
    const reservationDraft = buildDeliveryHubControlledExecutionReservationDraft({
      execution_plan: executionPlan,
      execution_identity: identity,
    })
    const recordDraft = buildDeliveryHubControlledExecutionRecordDraft({
      execution_plan: executionPlan,
      execution_identity: identity,
      reservation_draft: reservationDraft,
    })
    const auditDraft = buildDeliveryHubControlledExecutionAuditDraft({
      execution_plan: executionPlan,
      execution_identity: identity,
    })

    const result = await repository.reserveExecution({
      execution_record: recordDraft,
      reservation_draft: reservationDraft,
      audit_event: auditDraft,
    })
    const mainRecord = buildDeliveryHubExecutionLedgerStorageRecord({
      execution_record: result.record.execution,
      reservation_draft: result.record.reservation,
      transitions: result.record.transitions,
      audit_events: result.record.audit_events,
    })
    const expectedReservePlan = buildDeliveryHubExecutionLedgerReserveExecutionPlan({
      execution_record: recordDraft,
      reservation_draft: reservationDraft,
      audit_event: auditDraft,
    })
    const expectedAuditPlan = buildDeliveryHubExecutionLedgerAppendAuditEventPlan({
      execution_reference: identity.execution_reference,
      event: result.record.audit_events[0]!.event,
      sequence: 1,
      recorded_at: result.record.audit_events[0]!.recorded_at,
    })
    const expectedRefreshPlan = buildDeliveryHubExecutionLedgerRefreshMainRecordPlan(mainRecord)

    expect(result.status).toBe("created")
    expect(connection.calls.map((call) => call.sql)).toEqual([
      expectedReservePlan.steps[0]!.descriptor.sql,
      expectedReservePlan.steps[1]!.descriptor.sql,
      expectedAuditPlan.steps[1]!.descriptor.sql,
      expectedRefreshPlan.steps[0]!.descriptor.sql,
      buildDeliveryHubExecutionLedgerSelectByReferenceQueryDescriptor({
        execution_reference: identity.execution_reference,
      }).sql,
    ])
    expectCallToMatchDescriptor(connection.calls[0], expectedReservePlan.steps[0]!.descriptor)
    expectCallToMatchDescriptor(connection.calls[1], expectedReservePlan.steps[1]!.descriptor)
    expectCallToMatchDescriptor(connection.calls[2], expectedAuditPlan.steps[1]!.descriptor)
    expectMainRecordRefreshCallToUseNormalizedDescriptor(
      connection.calls[3],
      expectedRefreshPlan.steps[0]!.descriptor
    )
    expectRepositoryCallsReferenceMigrationArtifact(
      connection.calls,
      buildDeliveryHubExecutionLedgerPgMigrationArtifact()
    )
  })

  it("proves repository conflict reread SQL stays descriptor-aligned without owned audit or refresh writes", async () => {
    const connection = createFakePgConnection({ conflictNextReservationInsert: true })
    const existingPlan = buildExecutionPlan()
    const existingIdentity = buildDeliveryHubControlledExecutionIdentity(existingPlan)
    const existingReservation = buildDeliveryHubControlledExecutionReservationDraft({
      execution_plan: existingPlan,
      execution_identity: existingIdentity,
    })
    const existingRecord = buildDeliveryHubControlledExecutionRecordDraft({
      execution_plan: existingPlan,
      execution_identity: existingIdentity,
      reservation_draft: existingReservation,
    })
    const incomingPlan = buildExecutionPlan({
      items: [
        {
          line_item_id: "item_1",
          quantity: 2,
        },
      ],
    })
    const incomingIdentity = {
      ...buildDeliveryHubControlledExecutionIdentity(incomingPlan),
      idempotency_key: existingIdentity.idempotency_key,
    }
    const incomingReservation = {
      ...buildDeliveryHubControlledExecutionReservationDraft({
        execution_plan: incomingPlan,
        execution_identity: incomingIdentity,
      }),
      reservation_key: existingReservation.reservation_key,
    }
    const incomingRecord = buildDeliveryHubControlledExecutionRecordDraft({
      execution_plan: incomingPlan,
      execution_identity: incomingIdentity,
      reservation_draft: incomingReservation,
    })
    const repository = new DeliveryHubExecutionLedgerPgRepository({ connection })
    const expectedReservePlan = buildDeliveryHubExecutionLedgerReserveExecutionPlan({
      execution_record: incomingRecord,
      reservation_draft: incomingReservation,
    })

    seedFakePgLedgerRecord(connection, {
      execution_record: existingRecord,
      reservation_draft: existingReservation,
    })
    connection.referenceByIdempotencyKey.clear()
    connection.rowsByReference.delete(existingIdentity.execution_reference)
    connection.rowsByReference.set(incomingIdentity.execution_reference, buildDeliveryHubExecutionLedgerStorageRecord({
      execution_record: existingRecord,
      reservation_draft: existingReservation,
    }))

    const result = await repository.reserveExecution({
      execution_record: incomingRecord,
      reservation_draft: incomingReservation,
    })

    expect(result.status).toBe("drifted")
    expect(connection.calls.map((call) => call.sql)).toEqual([
      expectedReservePlan.steps[0]!.descriptor.sql,
      expectedReservePlan.steps[1]!.descriptor.sql,
      expectedReservePlan.steps[0]!.descriptor.sql,
    ])
    expectCallToMatchDescriptor(connection.calls[0], expectedReservePlan.steps[0]!.descriptor)
    expectCallToMatchDescriptor(connection.calls[1], expectedReservePlan.steps[1]!.descriptor)
    expectCallToMatchDescriptor(connection.calls[2], expectedReservePlan.steps[0]!.descriptor)
    expect(connection.calls.some((call) => call.sql.includes("_audit_events"))).toBe(false)
    expect(connection.calls.some((call) => call.sql.startsWith("update "))).toBe(false)
    expectRepositoryCallsReferenceMigrationArtifact(
      connection.calls,
      buildDeliveryHubExecutionLedgerPgMigrationArtifact()
    )
  })

  it("proves repository transition and audit append SQL refresh normalized main columns only", async () => {
    const { repository, connection, identity, reservationDraft } = await buildReservedPgRepository()
    const auditDraft = buildDeliveryHubControlledExecutionAuditDraft({
      execution_plan: buildExecutionPlan(),
      execution_identity: identity,
    })

    connection.calls.splice(0)
    const recorded = await repository.recordTransition({
      execution_reference: identity.execution_reference,
      from: DELIVERY_HUB_EXECUTION_STATE.planned,
      to: DELIVERY_HUB_EXECUTION_STATE.reserved,
    })
    const transitionRecord = buildDeliveryHubExecutionLedgerStorageRecord({
      execution_record: recorded.record!.execution,
      reservation_draft: reservationDraft,
      transitions: recorded.record!.transitions,
      audit_events: recorded.record!.audit_events,
    })
    const expectedTransitionPlan = buildDeliveryHubExecutionLedgerRecordTransitionPlan({
      execution_reference: identity.execution_reference,
      from: DELIVERY_HUB_EXECUTION_STATE.planned,
      to: DELIVERY_HUB_EXECUTION_STATE.reserved,
      sequence: 1,
    })
    const expectedTransitionRefreshPlan = buildDeliveryHubExecutionLedgerRefreshMainRecordPlan(
      transitionRecord
    )

    expect(recorded.status).toBe("recorded")
    expect(connection.calls.map((call) => call.sql)).toEqual([
      expectedTransitionPlan.steps[0]!.descriptor.sql,
      expectedTransitionPlan.steps[1]!.descriptor.sql,
      expectedTransitionRefreshPlan.steps[0]!.descriptor.sql,
    ])
    expectCallToMatchDescriptor(connection.calls[0], expectedTransitionPlan.steps[0]!.descriptor)
    expectCallToMatchDescriptor(connection.calls[1], expectedTransitionPlan.steps[1]!.descriptor)
    expectMainRecordRefreshCallToUseNormalizedDescriptor(
      connection.calls[2],
      expectedTransitionRefreshPlan.steps[0]!.descriptor
    )

    connection.calls.splice(0)
    const audited = await repository.appendAuditEvent({
      execution_reference: identity.execution_reference,
      event: auditDraft,
    })
    const auditRecord = buildDeliveryHubExecutionLedgerStorageRecord({
      execution_record: audited!.execution,
      reservation_draft: reservationDraft,
      transitions: audited!.transitions,
      audit_events: audited!.audit_events,
    })
    const appendedAudit = audited!.audit_events.at(-1)!
    const expectedAuditPlan = buildDeliveryHubExecutionLedgerAppendAuditEventPlan({
      execution_reference: identity.execution_reference,
      event: appendedAudit.event,
      sequence: appendedAudit.sequence,
      recorded_at: appendedAudit.recorded_at,
    })
    const expectedAuditRefreshPlan = buildDeliveryHubExecutionLedgerRefreshMainRecordPlan(auditRecord)

    expect(connection.calls.map((call) => call.sql)).toEqual([
      expectedAuditPlan.steps[0]!.descriptor.sql,
      expectedAuditPlan.steps[1]!.descriptor.sql,
      expectedAuditRefreshPlan.steps[0]!.descriptor.sql,
    ])
    expectCallToMatchDescriptor(connection.calls[0], expectedAuditPlan.steps[0]!.descriptor)
    expectCallToMatchDescriptor(connection.calls[1], expectedAuditPlan.steps[1]!.descriptor)
    expectMainRecordRefreshCallToUseNormalizedDescriptor(
      connection.calls[2],
      expectedAuditRefreshPlan.steps[0]!.descriptor
    )
    expectRepositoryCallsReferenceMigrationArtifact(
      connection.calls,
      buildDeliveryHubExecutionLedgerPgMigrationArtifact()
    )
  })

  it("proves repository-emitted custom-table SQL references only custom migration artifact tables", async () => {
    const tableName = "custom_execution_ledger"
    const connection = createFakePgConnection()
    const repository = new DeliveryHubExecutionLedgerPgRepository({
      connection,
      table_name: tableName,
    })
    const executionPlan = buildExecutionPlan()
    const identity = buildDeliveryHubControlledExecutionIdentity(executionPlan)
    const reservationDraft = buildDeliveryHubControlledExecutionReservationDraft({
      execution_plan: executionPlan,
      execution_identity: identity,
    })
    const recordDraft = buildDeliveryHubControlledExecutionRecordDraft({
      execution_plan: executionPlan,
      execution_identity: identity,
      reservation_draft: reservationDraft,
    })

    const result = await repository.reserveExecution({
      execution_record: recordDraft,
      reservation_draft: reservationDraft,
    })
    const mainRecord = buildDeliveryHubExecutionLedgerStorageRecord({
      execution_record: result.record.execution,
      reservation_draft: result.record.reservation,
      transitions: result.record.transitions,
      audit_events: result.record.audit_events,
    })
    const expectedReservePlan = buildDeliveryHubExecutionLedgerReserveExecutionPlan({
      execution_record: recordDraft,
      reservation_draft: reservationDraft,
      table_name: tableName,
    })
    const expectedRefreshPlan = buildDeliveryHubExecutionLedgerRefreshMainRecordPlan({
      ...mainRecord,
      table_name: tableName,
    })

    expect(result.status).toBe("created")
    expect(connection.calls.map((call) => call.sql)).toEqual([
      expectedReservePlan.steps[0]!.descriptor.sql,
      expectedReservePlan.steps[1]!.descriptor.sql,
      expectedRefreshPlan.steps[0]!.descriptor.sql,
      buildDeliveryHubExecutionLedgerSelectByReferenceQueryDescriptor({
        execution_reference: identity.execution_reference,
        table_name: tableName,
      }).sql,
    ])
    expect(connection.calls.every((call) => call.sql.includes(tableName))).toBe(true)
    expectMainRecordRefreshCallToUseNormalizedDescriptor(
      connection.calls[2],
      expectedRefreshPlan.steps[0]!.descriptor
    )
    expectRepositoryCallsReferenceMigrationArtifact(
      connection.calls,
      buildDeliveryHubExecutionLedgerPgMigrationArtifact({ table_name: tableName })
    )
  })

  it("appends deterministic redacted pg audit events", async () => {
    const { repository, identity } = await buildReservedPgRepository()
    const executionPlan = buildExecutionPlan()
    const auditDraft = {
      ...buildDeliveryHubControlledExecutionAuditDraft({
        execution_plan: executionPlan,
        execution_identity: identity,
      }),
      summary: "Bearer pg-sensitive-token",
      identity: {
        ...buildDeliveryHubControlledExecutionAuditDraft({
          execution_plan: executionPlan,
          execution_identity: identity,
        }).identity,
        provider_token: "secret",
      },
    } as ReturnType<typeof buildDeliveryHubControlledExecutionAuditDraft> & {
      identity: ReturnType<typeof buildDeliveryHubControlledExecutionAuditDraft>["identity"] & {
        provider_token: string
      }
    }

    const updated = await repository.appendAuditEvent({
      execution_reference: identity.execution_reference,
      event: auditDraft,
    })

    expect(updated?.audit_events).toEqual([
      {
        sequence: 1,
        recorded_at: "1970-01-01T00:00:00.000Z",
        execution_reference: identity.execution_reference,
        event: expect.objectContaining({
          summary: "[redacted]",
          identity: expect.objectContaining({
            provider_token: "[redacted]",
          }),
        }),
      },
    ])
  })

  it("reserves the same draft idempotently by idempotency key", async () => {
    const repository = new InMemoryDeliveryHubExecutionLedgerRepository()
    const executionPlan = buildExecutionPlan()
    const identity = buildDeliveryHubControlledExecutionIdentity(executionPlan)
    const reservationDraft = buildDeliveryHubControlledExecutionReservationDraft({
      execution_plan: executionPlan,
      execution_identity: identity,
    })
    const executionRecord = buildDeliveryHubControlledExecutionRecordDraft({
      execution_plan: executionPlan,
      execution_identity: identity,
      reservation_draft: reservationDraft,
    })

    const created = await repository.reserveExecution({
      execution_record: executionRecord,
      reservation_draft: reservationDraft,
    })
    const matched = await repository.reserveExecution({
      execution_record: executionRecord,
      reservation_draft: reservationDraft,
    })

    expect(created.status).toBe("created")
    expect(created.comparison.status).toBe("match")
    expect(matched.status).toBe("matched")
    expect(matched.comparison).toEqual({
      status: "match",
      drift_reasons: [],
      expected_reservation_fingerprint: reservationDraft.reservation_fingerprint,
      incoming_reservation_fingerprint: reservationDraft.reservation_fingerprint,
      expected_plan_fingerprint: reservationDraft.plan_fingerprint,
      incoming_plan_fingerprint: reservationDraft.plan_fingerprint,
      expected_execution_fingerprint: reservationDraft.execution_fingerprint,
      incoming_execution_fingerprint: reservationDraft.execution_fingerprint,
    })
    expect(await repository.getExecutionByReference(identity.execution_reference)).toEqual(created.record)
    expect(await repository.getExecutionByIdempotencyKey(identity.idempotency_key)).toEqual(created.record)
  })

  it("detects drifted reservation fingerprints and plan or execution mismatches", async () => {
    const repository = new InMemoryDeliveryHubExecutionLedgerRepository()
    const baselinePlan = buildExecutionPlan()
    const baselineIdentity = buildDeliveryHubControlledExecutionIdentity(baselinePlan)
    const baselineReservation = buildDeliveryHubControlledExecutionReservationDraft({
      execution_plan: baselinePlan,
      execution_identity: baselineIdentity,
    })
    const baselineRecord = buildDeliveryHubControlledExecutionRecordDraft({
      execution_plan: baselinePlan,
      execution_identity: baselineIdentity,
      reservation_draft: baselineReservation,
    })

    await repository.reserveExecution({
      execution_record: baselineRecord,
      reservation_draft: baselineReservation,
    })

    const driftedPlan = buildExecutionPlan({
      items: [
        {
          line_item_id: "item_1",
          quantity: 2,
        },
      ],
    })
    const driftedIdentity = {
      ...buildDeliveryHubControlledExecutionIdentity(driftedPlan),
      idempotency_key: baselineIdentity.idempotency_key,
    }
    const driftedReservation = {
      ...buildDeliveryHubControlledExecutionReservationDraft({
        execution_plan: driftedPlan,
        execution_identity: driftedIdentity,
      }),
      reservation_key: baselineReservation.reservation_key,
    }
    const fingerprintOnlyDrift = {
      ...baselineReservation,
      reservation_fingerprint: `${baselineReservation.reservation_fingerprint.slice(0, 63)}0`,
    }

    const drifted = await repository.reserveExecution({
      execution_record: baselineRecord,
      reservation_draft: driftedReservation,
    })
    const fingerprintMismatch = await repository.reserveExecution({
      execution_record: baselineRecord,
      reservation_draft: fingerprintOnlyDrift,
    })

    expect(drifted.status).toBe("drifted")
    expect(drifted.comparison.drift_reasons).toEqual(
      expect.arrayContaining([
        "plan_fingerprint_mismatch",
        "execution_fingerprint_mismatch",
        "reservation_fingerprint_mismatch",
      ])
    )
    expect(fingerprintMismatch.status).toBe("drifted")
    expect(fingerprintMismatch.comparison.drift_reasons).toEqual([
      "reservation_fingerprint_mismatch",
    ])
  })

  it("records only valid canonical state transitions", async () => {
    const repository = await buildReservedRepository()
    const executionReference = "dhprev_ref"

    const recorded = await repository.recordTransition({
      execution_reference: executionReference,
      from: DELIVERY_HUB_EXECUTION_STATE.planned,
      to: DELIVERY_HUB_EXECUTION_STATE.reserved,
    })

    expect(recorded.status).toBe("recorded")
    expect(recorded.reason).toBe(
      "Transition planned -> reserved is allowed with reason code reservation_projected."
    )
    expect(recorded.record?.execution.current_state).toBe(DELIVERY_HUB_EXECUTION_STATE.reserved)
    expect(recorded.record?.transitions).toEqual([
      {
        sequence: 1,
        recorded_at: "1970-01-01T00:00:00.000Z",
        execution_reference: executionReference,
        from: DELIVERY_HUB_EXECUTION_STATE.planned,
        to: DELIVERY_HUB_EXECUTION_STATE.reserved,
        reason: "Transition planned -> reserved is allowed with reason code reservation_projected.",
      },
    ])
  })

  it("rejects invalid state transitions and current state mismatches", async () => {
    const repository = await buildReservedRepository()

    await expect(
      repository.recordTransition({
        execution_reference: "missing_ref",
        from: DELIVERY_HUB_EXECUTION_STATE.planned,
        to: DELIVERY_HUB_EXECUTION_STATE.reserved,
      })
    ).resolves.toEqual({
      status: "rejected",
      record: null,
      reason:
        "Execution missing_ref is not reserved in the in-memory controlled execution ledger.",
    })

    const invalid = await repository.recordTransition({
      execution_reference: "dhprev_ref",
      from: DELIVERY_HUB_EXECUTION_STATE.planned,
      to: DELIVERY_HUB_EXECUTION_STATE.resultReceived,
    })

    expect(invalid.status).toBe("rejected")
    expect(invalid.reason).toBe(
      "Transition planned -> result_received is not allowed by the controlled execution contract."
    )

    await repository.recordTransition({
      execution_reference: "dhprev_ref",
      from: DELIVERY_HUB_EXECUTION_STATE.planned,
      to: DELIVERY_HUB_EXECUTION_STATE.reserved,
    })

    const mismatchedCurrentState = await repository.recordTransition({
      execution_reference: "dhprev_ref",
      from: DELIVERY_HUB_EXECUTION_STATE.planned,
      to: DELIVERY_HUB_EXECUTION_STATE.reserved,
    })

    expect(mismatchedCurrentState.status).toBe("rejected")
    expect(mismatchedCurrentState.reason).toBe(
      "Transition planned -> reserved does not match current ledger state reserved."
    )
  })

  it("appends deterministic redacted audit events in the test double only", async () => {
    const repository = await buildReservedRepository()
    const executionPlan = buildExecutionPlan()
    const identity = buildDeliveryHubControlledExecutionIdentity(executionPlan)
    const auditEvent = {
      ...buildDeliveryHubControlledExecutionAuditDraft({
        execution_plan: executionPlan,
        execution_identity: identity,
        current_state: DELIVERY_HUB_EXECUTION_STATE.planned,
      }),
      summary: "Authorization Bearer test-token should never appear in audit storage.",
      identity: {
        ...buildDeliveryHubControlledExecutionAuditDraft({
          execution_plan: executionPlan,
          execution_identity: identity,
        }).identity,
        authorization_hint: "Bearer sensitive-token",
      },
    } as ReturnType<typeof buildDeliveryHubControlledExecutionAuditDraft> & {
      identity: ReturnType<typeof buildDeliveryHubControlledExecutionAuditDraft>["identity"] & {
        authorization_hint: string
      }
    }

    const updatedRecord = await repository.appendAuditEvent({
      execution_reference: "dhprev_ref",
      event: auditEvent,
    })

    expect(updatedRecord?.audit_events).toEqual([
      {
        sequence: 1,
        recorded_at: "1970-01-01T00:00:00.000Z",
        execution_reference: "dhprev_ref",
        event: expect.objectContaining({
          summary: "[redacted]",
          identity: expect.objectContaining({
            authorization_hint: "[redacted]",
          }),
        }),
      },
    ])
    expect(
      stableSerializeDeliveryHubExecutionLedgerValue(updatedRecord?.audit_events ?? [])
    ).toBe(
      JSON.stringify([
        {
          event: {
            correlation: {
              connection_id: "conn_ready",
              fulfillment_id: "ful_1",
              mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
              order_id: "order_1",
              quote_reference_id: executionPlan.quote_reference.id,
            },
            current_state: DELIVERY_HUB_EXECUTION_STATE.planned,
            event_type: "deliveryhub.execution.planned",
            execution_reference: identity.execution_reference,
            identity: {
              authorization_hint: "[redacted]",
              execution_fingerprint: identity.execution_fingerprint,
              idempotency_key: identity.idempotency_key,
              plan_fingerprint: identity.plan_fingerprint,
              reservation_fingerprint: identity.reservation_fingerprint,
            },
            summary: "[redacted]",
            version: 1,
          },
          execution_reference: "dhprev_ref",
          recorded_at: "1970-01-01T00:00:00.000Z",
          sequence: 1,
        },
      ])
    )
    expect(
      redactDeliveryHubExecutionLedgerValue({
        nested: {
          provider_token: "secret-token",
        },
      })
    ).toEqual({
      nested: {
        provider_token: "[redacted]",
      },
    })
  })
  it("materializes deterministic storage mapping helpers for execution ledger drafts", () => {
    const executionPlan = buildExecutionPlan()
    const identity = buildDeliveryHubControlledExecutionIdentity(executionPlan)
    const reservationDraft = buildDeliveryHubControlledExecutionReservationDraft({
      execution_plan: executionPlan,
      execution_identity: identity,
    })
    const recordDraft = buildDeliveryHubControlledExecutionRecordDraft({
      execution_plan: executionPlan,
      execution_identity: identity,
      reservation_draft: reservationDraft,
    })
    const auditDraft = {
      ...buildDeliveryHubControlledExecutionAuditDraft({
        execution_plan: executionPlan,
        execution_identity: identity,
      }),
      summary: "Bearer hidden-token",
    }

    const lookupKey = buildDeliveryHubExecutionLedgerStorageLookupKey({
      execution_record: recordDraft,
      reservation_draft: reservationDraft,
    })
    const reserveRecord = buildDeliveryHubExecutionLedgerStorageReserveRecord({
      execution_record: recordDraft,
      reservation_draft: reservationDraft,
      audit_event: auditDraft,
    })
    const transitionRecord = buildDeliveryHubExecutionLedgerStorageTransitionRecord({
      sequence: 4,
      execution_reference: identity.execution_reference,
      from: DELIVERY_HUB_EXECUTION_STATE.planned,
      to: DELIVERY_HUB_EXECUTION_STATE.reserved,
    })
    const auditRecord = buildDeliveryHubExecutionLedgerStorageAuditRecord({
      sequence: 5,
      execution_reference: identity.execution_reference,
      event: auditDraft,
    })
    const appendAuditRecord = buildDeliveryHubExecutionLedgerStorageAppendAuditRecord({
      execution_reference: identity.execution_reference,
      sequence: 6,
      event: auditDraft,
    })
    const storageRecord = buildDeliveryHubExecutionLedgerStorageRecord({
      execution_record: recordDraft,
      reservation_draft: reservationDraft,
      transitions: [
        {
          sequence: 4,
          recorded_at: "1970-01-01T00:00:00.000Z",
          execution_reference: identity.execution_reference,
          from: DELIVERY_HUB_EXECUTION_STATE.planned,
          to: DELIVERY_HUB_EXECUTION_STATE.reserved,
          reason:
            "Transition planned -> reserved is allowed with reason code reservation_projected.",
        },
      ],
      audit_events: [
        {
          sequence: 5,
          recorded_at: "1970-01-01T00:00:00.000Z",
          execution_reference: identity.execution_reference,
          event: JSON.parse(serializeDeliveryHubExecutionLedgerAuditDraft(auditDraft)),
        },
      ],
    })

    expect(lookupKey).toEqual({
      execution_reference: identity.execution_reference,
      idempotency_key: identity.idempotency_key,
    })
    expect(reserveRecord.execution_reference).toBe(identity.execution_reference)
    expect(reserveRecord.idempotency_key).toBe(identity.idempotency_key)
    expect(transitionRecord).toEqual({
      sequence: 4,
      recorded_at: "1970-01-01T00:00:00.000Z",
      execution_reference: identity.execution_reference,
      from_state: DELIVERY_HUB_EXECUTION_STATE.planned,
      to_state: DELIVERY_HUB_EXECUTION_STATE.reserved,
      reason: "Transition planned -> reserved is allowed with reason code reservation_projected.",
    })
    expect(auditRecord.event_payload).toBe(appendAuditRecord.event_payload)
    expect(auditRecord.event_payload).toContain('"summary":"[redacted]"')

    expect(mapDeliveryHubExecutionLedgerStorageRecordToLedgerRecord(storageRecord)).toEqual({
      execution: recordDraft,
      reservation: reservationDraft,
      transitions: [
        {
          sequence: 4,
          recorded_at: "1970-01-01T00:00:00.000Z",
          execution_reference: identity.execution_reference,
          from: DELIVERY_HUB_EXECUTION_STATE.planned,
          to: DELIVERY_HUB_EXECUTION_STATE.reserved,
          reason:
            "Transition planned -> reserved is allowed with reason code reservation_projected.",
        },
      ],
      audit_events: [
        {
          sequence: 5,
          recorded_at: "1970-01-01T00:00:00.000Z",
          execution_reference: identity.execution_reference,
          event: expect.objectContaining({
            summary: "[redacted]",
          }),
        },
      ],
    })
  })

  it("materializes deterministic schema and query descriptors aligned with canonical ledger drafts", () => {
    const executionPlan = buildExecutionPlan()
    const identity = buildDeliveryHubControlledExecutionIdentity(executionPlan)
    const reservationDraft = buildDeliveryHubControlledExecutionReservationDraft({
      execution_plan: executionPlan,
      execution_identity: identity,
    })
    const recordDraft = buildDeliveryHubControlledExecutionRecordDraft({
      execution_plan: executionPlan,
      execution_identity: identity,
      reservation_draft: reservationDraft,
    })
    const auditDraft = buildDeliveryHubControlledExecutionAuditDraft({
      execution_plan: executionPlan,
      execution_identity: identity,
      current_state: DELIVERY_HUB_EXECUTION_STATE.reserved,
      event_type: "deliveryhub.execution.reserved",
    })

    const entityDescriptors = listDeliveryHubExecutionLedgerStorageEntityDescriptors()
    const descriptorBundle = buildDeliveryHubExecutionLedgerStorageDescriptorBundle({
      execution_record: recordDraft,
      reservation_draft: reservationDraft,
      transitions: [
        {
          sequence: 9,
          recorded_at: "1970-01-01T00:00:00.000Z",
          execution_reference: identity.execution_reference,
          from: DELIVERY_HUB_EXECUTION_STATE.planned,
          to: DELIVERY_HUB_EXECUTION_STATE.reserved,
          reason: "Transition planned -> reserved is allowed with reason code reservation_projected.",
        },
      ],
      audit_events: [
        {
          sequence: 10,
          recorded_at: "1970-01-01T00:00:00.000Z",
          execution_reference: identity.execution_reference,
          event: auditDraft,
        },
      ],
    })
    const byReference = buildDeliveryHubExecutionLedgerSelectByReferenceQueryDescriptor({
      execution_reference: identity.execution_reference,
    })
    const byIdempotency = buildDeliveryHubExecutionLedgerSelectByIdempotencyKeyQueryDescriptor({
      idempotency_key: identity.idempotency_key,
    })
    const byReservation = buildDeliveryHubExecutionLedgerSelectByReservationKeyQueryDescriptor({
      reservation_key: reservationDraft.reservation_key,
    })
    const insertReservation = buildDeliveryHubExecutionLedgerInsertReservationQueryDescriptor({
      execution_record: recordDraft,
      reservation_draft: reservationDraft,
      audit_event: auditDraft,
    })
    const insertTransition = buildDeliveryHubExecutionLedgerInsertTransitionQueryDescriptor({
      execution_reference: identity.execution_reference,
      from: DELIVERY_HUB_EXECUTION_STATE.planned,
      to: DELIVERY_HUB_EXECUTION_STATE.reserved,
      sequence: 11,
    })
    const insertAudit = buildDeliveryHubExecutionLedgerInsertAuditEventQueryDescriptor({
      execution_reference: identity.execution_reference,
      event: auditDraft,
      sequence: 12,
    })
    const refreshMainRecord = buildDeliveryHubExecutionLedgerUpdateMainRecordQueryDescriptor(
      descriptorBundle.main_record
    )

    expect(entityDescriptors).toHaveLength(3)
    expect(entityDescriptors).toEqual([
      expect.objectContaining({
        entity: DELIVERY_HUB_EXECUTION_LEDGER_STORAGE_ENTITY.main,
        table: "deliveryhub_execution_ledger",
        indexes: expect.arrayContaining([
          expect.objectContaining({
            purpose: "primary_lookup",
            columns: ["execution_reference"],
          }),
          expect.objectContaining({
            purpose: "idempotency_lookup",
            columns: ["idempotency_key"],
          }),
        ]),
      }),
      expect.objectContaining({
        entity: DELIVERY_HUB_EXECUTION_LEDGER_STORAGE_ENTITY.transitionLog,
        table: "deliveryhub_execution_ledger_transitions",
      }),
      expect.objectContaining({
        entity: DELIVERY_HUB_EXECUTION_LEDGER_STORAGE_ENTITY.auditEvent,
        table: "deliveryhub_execution_ledger_audit_events",
      }),
    ])
    expect(descriptorBundle.lookup_key).toEqual({
      execution_reference: identity.execution_reference,
      idempotency_key: identity.idempotency_key,
      reservation_key: reservationDraft.reservation_key,
    })
    expect(descriptorBundle.main_record.execution_reference).toBe(identity.execution_reference)
    expect(descriptorBundle.reservation_record.idempotency_key).toBe(identity.idempotency_key)
    expect(descriptorBundle.transition_records).toEqual([
      {
        sequence: 9,
        recorded_at: "1970-01-01T00:00:00.000Z",
        execution_reference: identity.execution_reference,
        from_state: DELIVERY_HUB_EXECUTION_STATE.planned,
        to_state: DELIVERY_HUB_EXECUTION_STATE.reserved,
        reason: "Transition planned -> reserved is allowed with reason code reservation_projected.",
      },
    ])
    expect(descriptorBundle.audit_records[0]?.event_payload).toContain(
      '"event_type":"deliveryhub.execution.reserved"'
    )
    expect(descriptorBundle.append_audit_records[0]).toEqual({
      execution_reference: identity.execution_reference,
      sequence: 10,
      recorded_at: "1970-01-01T00:00:00.000Z",
      event_payload: descriptorBundle.audit_records[0]?.event_payload,
    })

    expect(byReference).toEqual({
      version: 1,
      operation: "select_execution_by_reference",
      inert: true,
      entity: DELIVERY_HUB_EXECUTION_LEDGER_STORAGE_ENTITY.main,
      table: "deliveryhub_execution_ledger",
      sql:
        "select execution_reference, idempotency_key, execution_payload, reservation_payload, transitions_payload, audit_events_payload from deliveryhub_execution_ledger where execution_reference = ? limit 1",
      bindings: [{ name: "execution_reference", value: identity.execution_reference }],
      lookup_keys: { execution_reference: identity.execution_reference },
      payload_summary: {
        execution_reference: identity.execution_reference,
      },
    })
    expect(byIdempotency.lookup_keys).toEqual({
      idempotency_key: identity.idempotency_key,
    })
    expect(byIdempotency.payload_summary).toEqual({
      idempotency_key: identity.idempotency_key,
      reservation_key: identity.idempotency_key,
    })
    expect(byReservation.bindings).toEqual([
      { name: "reservation_key", value: reservationDraft.reservation_key },
    ])
    expect(insertReservation.inert).toBe(true)
    expect(insertReservation.lookup_keys).toEqual({
      execution_reference: identity.execution_reference,
      idempotency_key: identity.idempotency_key,
      reservation_key: identity.idempotency_key,
    })
    expect(insertReservation.payload_summary).toEqual({
      execution_reference: identity.execution_reference,
      idempotency_key: identity.idempotency_key,
      reservation_key: identity.idempotency_key,
      current_state: DELIVERY_HUB_EXECUTION_STATE.planned,
    })
    expect(insertTransition).toEqual({
      version: 1,
      operation: "insert_execution_transition",
      inert: true,
      entity: DELIVERY_HUB_EXECUTION_LEDGER_STORAGE_ENTITY.transitionLog,
      table: "deliveryhub_execution_ledger_transitions",
      sql:
        "insert into deliveryhub_execution_ledger_transitions (execution_reference, sequence, recorded_at, from_state, to_state, reason) values (?, ?, ?, ?, ?, ?)",
      bindings: [
        { name: "execution_reference", value: identity.execution_reference },
        { name: "sequence", value: 11 },
        { name: "recorded_at", value: "1970-01-01T00:00:00.000Z" },
        { name: "from_state", value: DELIVERY_HUB_EXECUTION_STATE.planned },
        { name: "to_state", value: DELIVERY_HUB_EXECUTION_STATE.reserved },
        {
          name: "reason",
          value: "Transition planned -> reserved is allowed with reason code reservation_projected.",
        },
      ],
      lookup_keys: {
        execution_reference: identity.execution_reference,
        sequence: 11,
      },
      payload_summary: {
        execution_reference: identity.execution_reference,
        transition: {
          from: DELIVERY_HUB_EXECUTION_STATE.planned,
          to: DELIVERY_HUB_EXECUTION_STATE.reserved,
        },
        current_state: DELIVERY_HUB_EXECUTION_STATE.reserved,
      },
    })
    expect(insertAudit.inert).toBe(true)
    expect(insertAudit.entity).toBe(DELIVERY_HUB_EXECUTION_LEDGER_STORAGE_ENTITY.auditEvent)
    expect(insertAudit.lookup_keys).toEqual({
      execution_reference: identity.execution_reference,
      sequence: 12,
    })
    expect(insertAudit.payload_summary).toEqual({
      execution_reference: identity.execution_reference,
      event_type: "deliveryhub.execution.reserved",
      current_state: DELIVERY_HUB_EXECUTION_STATE.reserved,
    })
    expect(refreshMainRecord).toEqual({
      version: 1,
      operation: "update_execution_main_record",
      inert: true,
      entity: DELIVERY_HUB_EXECUTION_LEDGER_STORAGE_ENTITY.main,
      table: "deliveryhub_execution_ledger",
      sql:
        "update deliveryhub_execution_ledger set execution_payload = ?, reservation_payload = ?, transitions_payload = ?, audit_events_payload = ? where execution_reference = ?",
      bindings: [
        { name: "execution_payload", value: descriptorBundle.main_record.execution_payload },
        { name: "reservation_payload", value: descriptorBundle.main_record.reservation_payload },
        { name: "transitions_payload", value: descriptorBundle.main_record.transitions_payload },
        { name: "audit_events_payload", value: descriptorBundle.main_record.audit_events_payload },
        { name: "execution_reference", value: identity.execution_reference },
      ],
      lookup_keys: {
        execution_reference: identity.execution_reference,
        idempotency_key: identity.idempotency_key,
        reservation_key: identity.idempotency_key,
      },
      payload_summary: {
        execution_reference: identity.execution_reference,
        idempotency_key: identity.idempotency_key,
        reservation_key: identity.idempotency_key,
        current_state: DELIVERY_HUB_EXECUTION_STATE.planned,
      },
    })
  })

  it("materializes deterministic inert query plans aligned with descriptors and storage projections", () => {
    const executionPlan = buildExecutionPlan()
    const identity = buildDeliveryHubControlledExecutionIdentity(executionPlan)
    const reservationDraft = buildDeliveryHubControlledExecutionReservationDraft({
      execution_plan: executionPlan,
      execution_identity: identity,
    })
    const recordDraft = buildDeliveryHubControlledExecutionRecordDraft({
      execution_plan: executionPlan,
      execution_identity: identity,
      reservation_draft: reservationDraft,
    })
    const auditDraft = buildDeliveryHubControlledExecutionAuditDraft({
      execution_plan: executionPlan,
      execution_identity: identity,
      current_state: DELIVERY_HUB_EXECUTION_STATE.reserved,
      event_type: "deliveryhub.execution.reserved",
    })

    const byReferencePlan = buildDeliveryHubExecutionLedgerGetByReferencePlan({
      execution_reference: identity.execution_reference,
    })
    const byIdempotencyPlan = buildDeliveryHubExecutionLedgerGetByIdempotencyKeyPlan({
      idempotency_key: identity.idempotency_key,
    })
    const reservePlan = buildDeliveryHubExecutionLedgerReserveExecutionPlan({
      execution_record: recordDraft,
      reservation_draft: reservationDraft,
      audit_event: auditDraft,
    })
    const transitionPlan = buildDeliveryHubExecutionLedgerRecordTransitionPlan({
      execution_reference: identity.execution_reference,
      from: DELIVERY_HUB_EXECUTION_STATE.planned,
      to: DELIVERY_HUB_EXECUTION_STATE.reserved,
      sequence: 7,
      audit_event: auditDraft,
    })
    const appendAuditPlan = buildDeliveryHubExecutionLedgerAppendAuditEventPlan({
      execution_reference: identity.execution_reference,
      event: auditDraft,
      sequence: 8,
    })
    const refreshMainRecordPlan = buildDeliveryHubExecutionLedgerRefreshMainRecordPlan({
      ...buildDeliveryHubExecutionLedgerStorageRecord({
        execution_record: recordDraft,
        reservation_draft: reservationDraft,
        transitions: [],
        audit_events: [],
      }),
      table_name: "custom_execution_ledger",
    })
    const mapper = buildDeliveryHubExecutionLedgerPlanRecordMapper()
    const storageRecord = buildDeliveryHubExecutionLedgerStorageRecord({
      execution_record: recordDraft,
      reservation_draft: reservationDraft,
      transitions: [],
      audit_events: [],
    })

    expect(byReferencePlan).toEqual({
      version: 1,
      operation: "getExecutionByReference",
      mode: DELIVERY_HUB_EXECUTION_LEDGER_QUERY_PLAN_MODE,
      execution_enabled: false,
      runtime_wiring: "disabled",
      mapping_target: "ledger_record",
      entity_kind: DELIVERY_HUB_EXECUTION_LEDGER_STORAGE_ENTITY.main,
      steps: [
        {
          kind: "lookup",
          descriptor: buildDeliveryHubExecutionLedgerSelectByReferenceQueryDescriptor({
            execution_reference: identity.execution_reference,
          }),
          entity: DELIVERY_HUB_EXECUTION_LEDGER_STORAGE_ENTITY.main,
          execution_enabled: false,
        },
      ],
      lookup_keys: { execution_reference: identity.execution_reference },
      payload_summary: {
        execution_reference: identity.execution_reference,
      },
      descriptor_bundle: undefined,
      storage_projection: undefined,
    })
    expect(byIdempotencyPlan.steps[0]?.descriptor).toEqual(
      buildDeliveryHubExecutionLedgerSelectByIdempotencyKeyQueryDescriptor({
        idempotency_key: identity.idempotency_key,
      })
    )
    expect(byIdempotencyPlan.lookup_keys).toEqual({
      idempotency_key: identity.idempotency_key,
    })

    expect(reservePlan.steps).toEqual([
      {
        kind: "lookup",
        descriptor: buildDeliveryHubExecutionLedgerSelectByReservationKeyQueryDescriptor({
          reservation_key: reservationDraft.reservation_key,
        }),
        entity: DELIVERY_HUB_EXECUTION_LEDGER_STORAGE_ENTITY.main,
        execution_enabled: false,
      },
      {
        kind: "write_projection",
        descriptor: buildDeliveryHubExecutionLedgerInsertReservationQueryDescriptor({
          execution_record: recordDraft,
          reservation_draft: reservationDraft,
          audit_event: auditDraft,
        }),
        entity: DELIVERY_HUB_EXECUTION_LEDGER_STORAGE_ENTITY.main,
        execution_enabled: false,
      },
    ])
    expect(reservePlan.payload_summary).toEqual({
      execution_reference: identity.execution_reference,
      idempotency_key: identity.idempotency_key,
      reservation_key: identity.idempotency_key,
      current_state: DELIVERY_HUB_EXECUTION_STATE.planned,
      audit_event_present: true,
      descriptor_bundle_version: 1,
    })
    expect(reservePlan.descriptor_bundle).toEqual(
      buildDeliveryHubExecutionLedgerStorageDescriptorBundle({
        execution_record: recordDraft,
        reservation_draft: reservationDraft,
        audit_events: [
          {
            sequence: 1,
            recorded_at: "1970-01-01T00:00:00.000Z",
            execution_reference: identity.execution_reference,
            event: auditDraft,
          },
        ],
      })
    )
    expect(reservePlan.storage_projection).toEqual({
      reserve_record: buildDeliveryHubExecutionLedgerStorageReserveRecord({
        execution_record: recordDraft,
        reservation_draft: reservationDraft,
        audit_event: auditDraft,
      }),
      main_record: buildDeliveryHubExecutionLedgerStorageRecord({
        execution_record: recordDraft,
        reservation_draft: reservationDraft,
      }),
      audit_record: reservePlan.descriptor_bundle?.audit_records[0],
      append_audit_record: reservePlan.descriptor_bundle?.append_audit_records[0],
    })

    expect(transitionPlan.steps[0]?.descriptor).toEqual(
      buildDeliveryHubExecutionLedgerSelectByReferenceQueryDescriptor({
        execution_reference: identity.execution_reference,
      })
    )
    expect(transitionPlan.steps[1]?.descriptor).toEqual(
      buildDeliveryHubExecutionLedgerInsertTransitionQueryDescriptor({
        execution_reference: identity.execution_reference,
        from: DELIVERY_HUB_EXECUTION_STATE.planned,
        to: DELIVERY_HUB_EXECUTION_STATE.reserved,
        sequence: 7,
        audit_event: auditDraft,
      })
    )
    expect(transitionPlan.payload_summary).toEqual({
      execution_reference: identity.execution_reference,
      transition: {
        from: DELIVERY_HUB_EXECUTION_STATE.planned,
        to: DELIVERY_HUB_EXECUTION_STATE.reserved,
      },
      current_state: DELIVERY_HUB_EXECUTION_STATE.reserved,
      audit_event_present: true,
    })
    expect(transitionPlan.storage_projection?.transition_record).toEqual(
      buildDeliveryHubExecutionLedgerStorageTransitionRecord({
        sequence: 7,
        execution_reference: identity.execution_reference,
        from: DELIVERY_HUB_EXECUTION_STATE.planned,
        to: DELIVERY_HUB_EXECUTION_STATE.reserved,
      })
    )
    expect(transitionPlan.execution_enabled).toBe(false)

    expect(appendAuditPlan.steps[0]?.descriptor).toEqual(
      buildDeliveryHubExecutionLedgerSelectByReferenceQueryDescriptor({
        execution_reference: identity.execution_reference,
      })
    )
    expect(appendAuditPlan.steps[1]?.descriptor).toEqual(
      buildDeliveryHubExecutionLedgerInsertAuditEventQueryDescriptor({
        execution_reference: identity.execution_reference,
        event: auditDraft,
        sequence: 8,
      })
    )
    expect(appendAuditPlan.payload_summary).toEqual({
      execution_reference: identity.execution_reference,
      event_type: "deliveryhub.execution.reserved",
      current_state: DELIVERY_HUB_EXECUTION_STATE.reserved,
      audit_event_present: true,
    })
    expect(appendAuditPlan.storage_projection?.append_audit_record).toEqual(
      buildDeliveryHubExecutionLedgerStorageAppendAuditRecord({
        execution_reference: identity.execution_reference,
        sequence: 8,
        event: auditDraft,
      })
    )

    expect(refreshMainRecordPlan).toEqual({
      version: 1,
      operation: "refreshMainRecord",
      mode: DELIVERY_HUB_EXECUTION_LEDGER_QUERY_PLAN_MODE,
      execution_enabled: false,
      runtime_wiring: "disabled",
      mapping_target: "main_record_refresh_result",
      entity_kind: DELIVERY_HUB_EXECUTION_LEDGER_STORAGE_ENTITY.main,
      steps: [
        {
          kind: "write_projection",
          descriptor: buildDeliveryHubExecutionLedgerUpdateMainRecordQueryDescriptor({
            ...storageRecord,
            table_name: "custom_execution_ledger",
          }),
          entity: DELIVERY_HUB_EXECUTION_LEDGER_STORAGE_ENTITY.main,
          execution_enabled: false,
        },
      ],
      lookup_keys: {
        execution_reference: identity.execution_reference,
        idempotency_key: identity.idempotency_key,
        reservation_key: identity.idempotency_key,
      },
      payload_summary: {
        execution_reference: identity.execution_reference,
        idempotency_key: identity.idempotency_key,
        reservation_key: identity.idempotency_key,
        current_state: DELIVERY_HUB_EXECUTION_STATE.planned,
      },
      descriptor_bundle: undefined,
      storage_projection: {
        main_record: storageRecord,
      },
    })
    expect(refreshMainRecordPlan.steps[0]?.descriptor.sql).toBe(
      "update custom_execution_ledger set execution_payload = ?, reservation_payload = ?, transitions_payload = ?, audit_events_payload = ? where execution_reference = ?"
    )

    expect(mapper).toMatchObject({
      mode: DELIVERY_HUB_EXECUTION_LEDGER_QUERY_PLAN_MODE,
      execution_enabled: false,
      entity_kind: "execution_ledger",
      target: "ledger_record",
    })
    expect(mapper.map(storageRecord)).toEqual(
      mapDeliveryHubExecutionLedgerStorageRecordToLedgerRecord(storageRecord)
    )
    expect(mapDeliveryHubExecutionLedgerPlanResultToLedgerRecord(storageRecord)).toEqual(
      mapDeliveryHubExecutionLedgerStorageRecordToLedgerRecord(storageRecord)
    )
  })

  it("materializes deterministic transaction unit-of-work plans without execution", () => {
    const executionPlan = buildExecutionPlan()
    const identity = buildDeliveryHubControlledExecutionIdentity(executionPlan)
    const reservationDraft = buildDeliveryHubControlledExecutionReservationDraft({
      execution_plan: executionPlan,
      execution_identity: identity,
    })
    const recordDraft = buildDeliveryHubControlledExecutionRecordDraft({
      execution_plan: executionPlan,
      execution_identity: identity,
      reservation_draft: reservationDraft,
    })
    const reservedAuditDraft = buildDeliveryHubControlledExecutionAuditDraft({
      execution_plan: executionPlan,
      execution_identity: identity,
      current_state: DELIVERY_HUB_EXECUTION_STATE.reserved,
      event_type: "deliveryhub.execution.reserved",
    })
    const dispatchReadyAuditDraft = buildDeliveryHubControlledExecutionAuditDraft({
      execution_plan: executionPlan,
      execution_identity: identity,
      current_state: DELIVERY_HUB_EXECUTION_STATE.dispatchReady,
      event_type: "deliveryhub.execution.dispatch_ready",
    })
    const failedBlockedAuditDraft = buildDeliveryHubControlledExecutionAuditDraft({
      execution_plan: executionPlan,
      execution_identity: identity,
      current_state: DELIVERY_HUB_EXECUTION_STATE.failedBlocked,
      event_type: "deliveryhub.execution.dispatch_ready",
    })

    const reserveTransactionPlan = buildDeliveryHubExecutionLedgerReserveTransactionPlan({
      execution_record: recordDraft,
      reservation_draft: reservationDraft,
      audit_event: reservedAuditDraft,
    })
    const transitionTransactionPlan = buildDeliveryHubExecutionLedgerTransitionTransactionPlan({
      execution_reference: identity.execution_reference,
      from: DELIVERY_HUB_EXECUTION_STATE.reserved,
      to: DELIVERY_HUB_EXECUTION_STATE.dispatchReady,
      sequence: 2,
      audit_event: dispatchReadyAuditDraft,
    })
    const appendAuditTransactionPlan = buildDeliveryHubExecutionLedgerAppendAuditTransactionPlan({
      execution_reference: identity.execution_reference,
      event: dispatchReadyAuditDraft,
      sequence: 3,
    })
    const failedBlockedTransactionPlan = buildDeliveryHubExecutionLedgerFailedBlockedTransactionPlan({
      execution_reference: identity.execution_reference,
      from: DELIVERY_HUB_EXECUTION_STATE.dispatchReady,
      sequence: 4,
      audit_event: failedBlockedAuditDraft,
    })

    expect(reserveTransactionPlan).toMatchObject({
      version: 1,
      operation: "reserveExecutionUnitOfWork",
      mode: DELIVERY_HUB_EXECUTION_LEDGER_TRANSACTION_PLAN_MODE,
      unit_of_work_name: "reserve execution plus optional audit intent",
      transaction_boundary: {
        atomicity_required: true,
        transaction_execution_enabled: false,
        open_transaction: "disabled",
        commit_transaction: "disabled",
        rollback_transaction: "disabled",
        isolation_intent: "future_repository_defined",
        connection_factory_invocation_enabled: false,
      },
      rollback_compensation_intent: {
        mode: "descriptor_only",
        executable_logic_enabled: false,
        rollback_writes_enabled: false,
        compensation_writes_enabled: false,
      },
      confirmations: {
        query_execution_enabled: false,
        transaction_open_enabled: false,
        transaction_commit_enabled: false,
        transaction_rollback_enabled: false,
        transaction_execution_enabled: false,
        runtime_wiring_enabled: false,
        production_writes_enabled: false,
        live_execution_enabled: false,
        provider_dispatch_enabled: false,
        shipment_creation_enabled: false,
        compensation_writes_enabled: false,
      },
    })
    expect(reserveTransactionPlan.query_plans).toEqual([
      buildDeliveryHubExecutionLedgerReserveExecutionPlan({
        execution_record: recordDraft,
        reservation_draft: reservationDraft,
        audit_event: reservedAuditDraft,
      }),
      buildDeliveryHubExecutionLedgerAppendAuditEventPlan({
        execution_reference: identity.execution_reference,
        event: reservedAuditDraft,
        sequence: 1,
      }),
    ])
    expect(reserveTransactionPlan.ordered_steps.map((step) => ({
      order: step.order,
      unit_step: step.unit_step,
      query_plan_operation: step.query_plan_operation,
      query_step_index: step.query_step_index,
      descriptor_operation: step.descriptor_operation,
      execution_enabled: step.execution_enabled,
      inert: step.descriptor.inert,
    }))).toEqual([
      {
        order: 1,
        unit_step: "reservation_lookup",
        query_plan_operation: "reserveExecution",
        query_step_index: 0,
        descriptor_operation: "select_execution_by_reservation_key",
        execution_enabled: false,
        inert: true,
      },
      {
        order: 2,
        unit_step: "reservation_write_projection",
        query_plan_operation: "reserveExecution",
        query_step_index: 1,
        descriptor_operation: "insert_execution_reservation",
        execution_enabled: false,
        inert: true,
      },
      {
        order: 3,
        unit_step: "execution_lookup",
        query_plan_operation: "appendAuditEvent",
        query_step_index: 0,
        descriptor_operation: "select_execution_by_reference",
        execution_enabled: false,
        inert: true,
      },
      {
        order: 4,
        unit_step: "audit_write_projection",
        query_plan_operation: "appendAuditEvent",
        query_step_index: 1,
        descriptor_operation: "insert_execution_audit_event",
        execution_enabled: false,
        inert: true,
      },
    ])
    expect(reserveTransactionPlan.descriptor_alignment).toEqual({
      all_descriptors_inert: true,
      query_plan_operations: ["reserveExecution", "appendAuditEvent"],
      descriptor_operations: [
        "select_execution_by_reservation_key",
        "insert_execution_reservation",
        "select_execution_by_reference",
        "insert_execution_audit_event",
      ],
    })
    expect(reserveTransactionPlan.conflict_guards).toEqual([
      {
        guard: "reservation_dedupe_scope",
        expected: "deliveryhub:create_shipment",
        source: "reservation_contract",
      },
      {
        guard: "reservation_fingerprint_match",
        expected: "match",
        source: "reservation_contract",
      },
      {
        guard: "descriptor_inertness",
        expected: true,
        source: "descriptor_contract",
      },
    ])

    expect(transitionTransactionPlan.unit_of_work_name).toBe(
      "record transition plus optional audit intent"
    )
    expect(transitionTransactionPlan.ordered_steps.map((step) => ({
      operation: step.query_plan_operation,
      descriptor_operation: step.descriptor_operation,
    }))).toEqual([
      {
        operation: "recordTransition",
        descriptor_operation: "select_execution_by_reference",
      },
      {
        operation: "recordTransition",
        descriptor_operation: "insert_execution_transition",
      },
      {
        operation: "appendAuditEvent",
        descriptor_operation: "select_execution_by_reference",
      },
      {
        operation: "appendAuditEvent",
        descriptor_operation: "insert_execution_audit_event",
      },
    ])
    expect(transitionTransactionPlan.conflict_guards).toEqual([
      {
        guard: "transition_allowed",
        expected: true,
        source: "transition_contract",
      },
      {
        guard: "current_state_matches_transition_from",
        expected: DELIVERY_HUB_EXECUTION_STATE.reserved,
        source: "transition_contract",
      },
      {
        guard: "descriptor_inertness",
        expected: true,
        source: "descriptor_contract",
      },
    ])
    expect(transitionTransactionPlan.query_plans).toEqual([
      buildDeliveryHubExecutionLedgerRecordTransitionPlan({
        execution_reference: identity.execution_reference,
        from: DELIVERY_HUB_EXECUTION_STATE.reserved,
        to: DELIVERY_HUB_EXECUTION_STATE.dispatchReady,
        sequence: 2,
        audit_event: dispatchReadyAuditDraft,
      }),
      buildDeliveryHubExecutionLedgerAppendAuditEventPlan({
        execution_reference: identity.execution_reference,
        event: dispatchReadyAuditDraft,
        sequence: 2,
      }),
    ])

    expect(appendAuditTransactionPlan.operation).toBe("appendAuditEventUnitOfWork")
    expect(appendAuditTransactionPlan.unit_of_work_name).toBe("append audit event only")
    expect(appendAuditTransactionPlan.ordered_steps.map((step) => step.descriptor_operation)).toEqual([
      "select_execution_by_reference",
      "insert_execution_audit_event",
    ])
    expect(appendAuditTransactionPlan.conflict_guards).toEqual([
      {
        guard: "audit_execution_reference_present",
        expected: true,
        source: "audit_contract",
      },
      {
        guard: "descriptor_inertness",
        expected: true,
        source: "descriptor_contract",
      },
    ])
    expect(appendAuditTransactionPlan.query_plans[0]).toEqual(
      buildDeliveryHubExecutionLedgerAppendAuditEventPlan({
        execution_reference: identity.execution_reference,
        event: dispatchReadyAuditDraft,
        sequence: 3,
      })
    )

    expect(failedBlockedTransactionPlan.operation).toBe(
      "recordFailedBlockedTransitionUnitOfWork"
    )
    expect(failedBlockedTransactionPlan.unit_of_work_name).toBe(
      "record failed-blocked transition plus required audit intent"
    )
    expect(failedBlockedTransactionPlan.query_plans.map((queryPlan) => queryPlan.operation)).toEqual([
      "recordTransition",
      "appendAuditEvent",
    ])
    expect(failedBlockedTransactionPlan.query_plans[0]?.payload_summary.transition).toEqual({
      from: DELIVERY_HUB_EXECUTION_STATE.dispatchReady,
      to: DELIVERY_HUB_EXECUTION_STATE.failedBlocked,
    })
    expect(failedBlockedTransactionPlan.query_plans[1]).toEqual(
      buildDeliveryHubExecutionLedgerAppendAuditEventPlan({
        execution_reference: identity.execution_reference,
        event: failedBlockedAuditDraft,
        sequence: 4,
      })
    )
    expect(failedBlockedTransactionPlan.ordered_steps.map((step) => ({
      operation: step.query_plan_operation,
      descriptor_operation: step.descriptor_operation,
    }))).toEqual([
      {
        operation: "recordTransition",
        descriptor_operation: "select_execution_by_reference",
      },
      {
        operation: "recordTransition",
        descriptor_operation: "insert_execution_transition",
      },
      {
        operation: "appendAuditEvent",
        descriptor_operation: "select_execution_by_reference",
      },
      {
        operation: "appendAuditEvent",
        descriptor_operation: "insert_execution_audit_event",
      },
    ])
    expect(failedBlockedTransactionPlan.conflict_guards).toEqual([
      {
        guard: "failed_blocked_transition_allowed",
        expected: true,
        source: "transition_contract",
      },
      {
        guard: "current_state_matches_transition_from",
        expected: DELIVERY_HUB_EXECUTION_STATE.dispatchReady,
        source: "transition_contract",
      },
      {
        guard: "descriptor_inertness",
        expected: true,
        source: "descriptor_contract",
      },
    ])

    const allTransactionPlans = [
      reserveTransactionPlan,
      transitionTransactionPlan,
      appendAuditTransactionPlan,
      failedBlockedTransactionPlan,
    ]

    for (const transactionPlan of allTransactionPlans) {
      expect(transactionPlan.transaction_boundary.atomicity_required).toBe(true)
      expect(transactionPlan.transaction_boundary.transaction_execution_enabled).toBe(false)
      expect(transactionPlan.rollback_compensation_intent.executable_logic_enabled).toBe(false)
      expect(transactionPlan.confirmations.query_execution_enabled).toBe(false)
      expect(transactionPlan.confirmations.runtime_wiring_enabled).toBe(false)
      expect(transactionPlan.confirmations.provider_dispatch_enabled).toBe(false)
      expect(transactionPlan.query_plans.every((queryPlan) => queryPlan.execution_enabled === false)).toBe(true)
      expect(transactionPlan.ordered_steps.every((step) => step.execution_enabled === false)).toBe(true)
      expect(transactionPlan.ordered_steps.every((step) => step.descriptor.inert === true)).toBe(true)
    }
  })

  it("materializes inert pg migration DDL aligned with descriptor and query contract", () => {
    const artifact = buildDeliveryHubExecutionLedgerPgMigrationArtifact()
    const descriptors = listDeliveryHubExecutionLedgerStorageEntityDescriptors({
      table_name: "deliveryhub_execution_ledger",
    })
    const mainDescriptor = descriptors.find(
      (descriptor) => descriptor.entity === DELIVERY_HUB_EXECUTION_LEDGER_STORAGE_ENTITY.main
    )!
    const transitionDescriptor = descriptors.find(
      (descriptor) => descriptor.entity === DELIVERY_HUB_EXECUTION_LEDGER_STORAGE_ENTITY.transitionLog
    )!
    const auditDescriptor = descriptors.find(
      (descriptor) => descriptor.entity === DELIVERY_HUB_EXECUTION_LEDGER_STORAGE_ENTITY.auditEvent
    )!
    const normalizedUpSql = normalizeSql(artifact.up_sql)
    const normalizedDownSql = normalizeSql(artifact.down_sql)

    expect(artifact).toMatchObject({
      version: 1,
      inert: true,
      runtime_application_enabled: false,
      table_name: "deliveryhub_execution_ledger",
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
    })
    expect(artifact.up.map((statement) => statement.purpose)).toEqual([
      "create_main_table",
      "create_lookup_index",
      "create_transition_table",
      "create_ordering_index",
      "create_audit_table",
      "create_ordering_index",
    ])
    expect(artifact.down.map((statement) => statement.purpose)).toEqual([
      "drop_audit_table",
      "drop_transition_table",
      "drop_main_table",
    ])
    expect(normalizedUpSql).toContain("create table if not exists deliveryhub_execution_ledger")
    expect(normalizedUpSql).toContain("execution_reference text primary key")
    expect(normalizedUpSql).toContain("idempotency_key text not null")
    expect(normalizedUpSql).toContain("execution_payload jsonb not null")
    expect(normalizedUpSql).toContain("reservation_payload jsonb not null")
    expect(normalizedUpSql).toContain("transitions_payload jsonb not null default '[]'::jsonb")
    expect(normalizedUpSql).toContain("audit_events_payload jsonb not null default '[]'::jsonb")
    expect(normalizedUpSql).toContain(
      "constraint deliveryhub_execution_ledger_idempotency_key_key unique (idempotency_key)"
    )
    expect(normalizedUpSql).toContain(
      "create unique index if not exists deliveryhub_execution_ledger_idempotency_key_uidx on deliveryhub_execution_ledger (idempotency_key)"
    )
    expect(normalizedUpSql).toContain(
      "create table if not exists deliveryhub_execution_ledger_transitions"
    )
    expect(normalizedUpSql).toContain("sequence integer not null")
    expect(normalizedUpSql).toContain("recorded_at timestamptz not null")
    expect(normalizedUpSql).toContain("from_state text not null")
    expect(normalizedUpSql).toContain("to_state text not null")
    expect(normalizedUpSql).toContain("reason text not null")
    expect(normalizedUpSql).toContain(
      "constraint deliveryhub_execution_ledger_transitions_execution_sequence_key unique (execution_reference, sequence)"
    )
    expect(normalizedUpSql).toContain(
      "foreign key (execution_reference) references deliveryhub_execution_ledger (execution_reference) on delete cascade"
    )
    expect(normalizedUpSql).toContain(
      "create table if not exists deliveryhub_execution_ledger_audit_events"
    )
    expect(normalizedUpSql).toContain("event_payload jsonb not null")
    expect(normalizedUpSql).toContain(
      "constraint deliveryhub_execution_ledger_audit_events_execution_sequence_key unique (execution_reference, sequence)"
    )
    expect(normalizedUpSql).toContain(
      "create unique index if not exists deliveryhub_execution_ledger_transitions_execution_sequence_uidx on deliveryhub_execution_ledger_transitions (execution_reference, sequence)"
    )
    expect(normalizedUpSql).toContain(
      "create unique index if not exists deliveryhub_execution_ledger_audit_events_execution_sequence_uidx on deliveryhub_execution_ledger_audit_events (execution_reference, sequence)"
    )
    expect(normalizedDownSql).toBe(
      "drop table if exists deliveryhub_execution_ledger_audit_events; drop table if exists deliveryhub_execution_ledger_transitions; drop table if exists deliveryhub_execution_ledger;"
    )
  })

  it("keeps migration DDL compatible with query descriptors and repository projections", () => {
    const artifact = buildDeliveryHubExecutionLedgerPgMigrationArtifact({
      table_name: "custom_execution_ledger",
    })
    const executionPlan = buildExecutionPlan()
    const identity = buildDeliveryHubControlledExecutionIdentity(executionPlan)
    const reservationDraft = buildDeliveryHubControlledExecutionReservationDraft({
      execution_plan: executionPlan,
      execution_identity: identity,
    })
    const recordDraft = buildDeliveryHubControlledExecutionRecordDraft({
      execution_plan: executionPlan,
      execution_identity: identity,
      reservation_draft: reservationDraft,
    })
    const auditDraft = buildDeliveryHubControlledExecutionAuditDraft({
      execution_plan: executionPlan,
      execution_identity: identity,
    })
    const selectByReference = buildDeliveryHubExecutionLedgerSelectByReferenceQueryDescriptor({
      execution_reference: identity.execution_reference,
      table_name: artifact.table_name,
    })
    const selectByIdempotency = buildDeliveryHubExecutionLedgerSelectByIdempotencyKeyQueryDescriptor({
      idempotency_key: identity.idempotency_key,
      table_name: artifact.table_name,
    })
    const insertReservation = buildDeliveryHubExecutionLedgerInsertReservationQueryDescriptor({
      execution_record: recordDraft,
      reservation_draft: reservationDraft,
      table_name: artifact.table_name,
    })
    const insertTransition = buildDeliveryHubExecutionLedgerInsertTransitionQueryDescriptor({
      execution_reference: identity.execution_reference,
      from: DELIVERY_HUB_EXECUTION_STATE.planned,
      to: DELIVERY_HUB_EXECUTION_STATE.reserved,
      sequence: 1,
      table_name: artifact.table_name,
    })
    const insertAudit = buildDeliveryHubExecutionLedgerInsertAuditEventQueryDescriptor({
      execution_reference: identity.execution_reference,
      event: auditDraft,
      sequence: 2,
      table_name: artifact.table_name,
    })
    const normalizedUpSql = normalizeSql(artifact.up_sql)

    expect(selectByReference.sql).toContain(
      "select execution_reference, idempotency_key, execution_payload, reservation_payload, transitions_payload, audit_events_payload from custom_execution_ledger where execution_reference = ? limit 1"
    )
    expect(selectByIdempotency.sql).toContain(
      "from custom_execution_ledger where idempotency_key = ? limit 1"
    )
    expect(insertReservation.sql).toBe(
      "insert into custom_execution_ledger (execution_reference, idempotency_key, execution_payload, reservation_payload) values (?, ?, ?, ?) on conflict (idempotency_key) do nothing"
    )
    expect(insertTransition.sql).toBe(
      "insert into custom_execution_ledger_transitions (execution_reference, sequence, recorded_at, from_state, to_state, reason) values (?, ?, ?, ?, ?, ?)"
    )
    expect(insertAudit.sql).toBe(
      "insert into custom_execution_ledger_audit_events (execution_reference, sequence, recorded_at, event_payload) values (?, ?, ?, ?)"
    )
    expect(normalizedUpSql).toContain("create table if not exists custom_execution_ledger")
    expect(normalizedUpSql).toContain("create table if not exists custom_execution_ledger_transitions")
    expect(normalizedUpSql).toContain("create table if not exists custom_execution_ledger_audit_events")
    expect(normalizedUpSql).toContain("constraint custom_execution_ledger_idempotency_key_key unique (idempotency_key)")
    expect(normalizedUpSql).toContain(
      "constraint custom_execution_ledger_transitions_execution_sequence_key unique (execution_reference, sequence)"
    )
    expect(normalizedUpSql).toContain(
      "constraint custom_execution_ledger_audit_events_execution_sequence_key unique (execution_reference, sequence)"
    )
    expect(normalizedUpSql).toContain("execution_payload jsonb not null")
    expect(normalizedUpSql).toContain("reservation_payload jsonb not null")
    expect(normalizedUpSql).toContain("transitions_payload jsonb not null")
    expect(normalizedUpSql).toContain("audit_events_payload jsonb not null")
    expect(normalizedUpSql).toContain("event_payload jsonb not null")
  })

  it("materializes deterministic repository assembly readiness without runtime wiring", () => {
    const readiness = buildDeliveryHubExecutionLedgerRepositoryAssemblyReadiness()
    const repeated = buildDeliveryHubExecutionLedgerRepositoryAssemblyReadiness()

    expect(readiness).toEqual(repeated)
    expect(readiness).toMatchObject({
      version: 1,
      mode: DELIVERY_HUB_EXECUTION_LEDGER_REPOSITORY_ASSEMBLY_MODE,
      repository_status: "pg_repository_implementation_available",
      table_name: "deliveryhub_execution_ledger",
      plan_layer: {
        query_plan_version: 1,
        query_plan_mode: DELIVERY_HUB_EXECUTION_LEDGER_QUERY_PLAN_MODE,
        transaction_plan_version: 1,
        transaction_plan_mode: DELIVERY_HUB_EXECUTION_LEDGER_TRANSACTION_PLAN_MODE,
        builders_are_referenced_only: true,
        query_execution_enabled: false,
        transaction_execution_enabled: false,
      },
      disabled_confirmations: {
        query_execution: false,
        transaction_execution: false,
        transaction_open: false,
        transaction_commit: false,
        transaction_rollback: false,
        production_writes: false,
        runtime_wiring: false,
        live_execution: false,
        provider_dispatch: false,
        shipment_creation: false,
        label_or_document_generation: false,
        order_or_fulfillment_mutation: false,
        retry_scheduling: false,
        compensation_or_rollback_writes: false,
        checkout_or_storefront_cutover: false,
        connection_factory_invocation: false,
        migration_or_table_creation: false,
      },
    })
    expect(readiness.component_inventory).toEqual([
      {
        component: "repository_port",
        status: "available",
        source: "execution-ledger-repository.ts#DeliveryHubExecutionLedgerRepository",
        runtime_wiring: "disabled",
        execution_enabled: false,
      },
      {
        component: "storage_adapter_scaffold",
        status: "inert",
        source: "execution-ledger-storage-adapter-scaffold.ts#DeliveryHubExecutionLedgerStorageAdapterScaffold",
        runtime_wiring: "disabled",
        execution_enabled: false,
      },
      {
        component: "pg_repository_implementation",
        status: "available",
        source: "execution-ledger-pg-repository.ts#DeliveryHubExecutionLedgerPgRepository",
        runtime_wiring: "disabled",
        execution_enabled: false,
      },
      {
        component: "descriptor_layer",
        status: "plan_only",
        source: "execution-ledger-storage-descriptor-scaffold.ts",
        runtime_wiring: "disabled",
        execution_enabled: false,
      },
      {
        component: "query_plan_layer",
        status: "plan_only",
        source: "execution-ledger-query-plan-scaffold.ts",
        runtime_wiring: "disabled",
        execution_enabled: false,
      },
      {
        component: "transaction_plan_layer",
        status: "plan_only",
        source: "execution-ledger-transaction-plan-scaffold.ts",
        runtime_wiring: "disabled",
        execution_enabled: false,
      },
      {
        component: "schema_migration_artifact",
        status: "available",
        source: "execution-ledger-pg-migration-artifact.ts",
        runtime_wiring: "disabled",
        execution_enabled: false,
      },
      {
        component: "schema_verification_layer",
        status: "plan_only",
        source: "execution-ledger-schema-verification-scaffold.ts#verifyDeliveryHubExecutionLedgerSchemaSnapshot",
        runtime_wiring: "disabled",
        execution_enabled: false,
      },
      {
        component: "schema_check_plan_layer",
        status: "plan_only",
        source: "execution-ledger-schema-check-plan-scaffold.ts#buildDeliveryHubExecutionLedgerSchemaCheckPlan",
        runtime_wiring: "disabled",
        execution_enabled: false,
      },
    ])
    expect(readiness.descriptor_layer).toEqual({
      version: 1,
      table_name: "deliveryhub_execution_ledger",
      entity_descriptors: listDeliveryHubExecutionLedgerStorageEntityDescriptors({
        table_name: "deliveryhub_execution_ledger",
      }),
      descriptor_bundle_builder: "buildDeliveryHubExecutionLedgerStorageDescriptorBundle",
      descriptor_bundle_execution: "not_invoked_without_controlled_execution_drafts",
      query_descriptors_inert: true,
    })
    expect(readiness.migration_layer).toEqual({
      schema_migration_artifact_available: true,
      artifact: buildDeliveryHubExecutionLedgerPgMigrationArtifact(),
      artifact_review_ready: true,
      artifact_application_mode: "manual_external_only",
      automatic_application_enabled: false,
      table_creation_at_runtime_enabled: false,
    })
    expect(readiness.schema_verification_layer).toEqual({
      verifier_available: true,
      check_plan_available: true,
      verifier_mode: DELIVERY_HUB_EXECUTION_LEDGER_SCHEMA_VERIFICATION_MODE,
      verifier_source: "supplied_snapshot_only",
      check_plan_mode: DELIVERY_HUB_EXECUTION_LEDGER_SCHEMA_CHECK_PLAN_MODE,
      check_plan_source: DELIVERY_HUB_EXECUTION_LEDGER_SCHEMA_CHECK_PLAN_SOURCE,
      db_connection_required: false,
      db_introspection_required: false,
      repository_required: false,
      db_adapter_required: false,
      sql_execution_required: false,
      migration_application_enabled: false,
      runtime_table_creation_enabled: false,
      runtime_wiring_enabled: false,
      transaction_runner_required: false,
      transaction_runner_enabled: false,
      admin_exposure_enabled: false,
      disabled_confirmations: {
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
      },
    })
    expect(readiness.persistence_readiness_contour).toEqual({
      stages: [
        "artifact_defined",
        "manual_application_external",
        "snapshot_verification_available",
        "activation_blocked",
      ],
      current_stage: "activation_blocked",
      review_preparation_available_now: [
        "descriptor_bundle_defined",
        "migration_artifact_reviewable",
        "snapshot_schema_verifier_available",
        "snapshot_schema_check_plan_available",
      ],
      external_manual_application_remaining: [
        "manual_migration_review",
        "manual_table_creation_or_migration_execution",
        "manual_schema_snapshot_capture",
      ],
      activation_blocked_until: [
        "migration_or_table_creation",
        "transaction_runner",
        "explicit_runtime_wiring",
        "operational_runbook",
        "safety_review",
      ],
    })
    expect(readiness.missing_activation_prerequisites).toEqual([
      "migration_or_table_creation",
      "transaction_runner",
      "explicit_runtime_wiring",
      "operational_runbook",
      "safety_review",
    ])
  })

  it("covers every ledger port operation in the assembly operation matrix", () => {
    const readiness = buildDeliveryHubExecutionLedgerRepositoryAssemblyReadiness()

    expect(readiness.port_operations).toEqual(DELIVERY_HUB_EXECUTION_LEDGER_REPOSITORY_PORT_OPERATIONS)
    expect(readiness.operation_readiness.map((entry) => entry.operation)).toEqual([
      "getExecutionByReference",
      "getExecutionByIdempotencyKey",
      "reserveExecution",
      "recordTransition",
      "appendAuditEvent",
    ])
    expect(readiness.operation_readiness).toEqual([
      {
        operation: "getExecutionByReference",
        plan_available: true,
        execution_enabled: false,
        runtime_wiring: "disabled",
        repository_status: "pg_repository_implementation_available",
        query_plan_mode: DELIVERY_HUB_EXECUTION_LEDGER_QUERY_PLAN_MODE,
        query_plan_builder: "buildDeliveryHubExecutionLedgerGetByReferencePlan",
        descriptor_operations: ["select_execution_by_reference"],
        transaction_plan_available: false,
        transaction_plan_mode: undefined,
        transaction_plan_builder: undefined,
        allowed_action: "plan_only",
      },
      {
        operation: "getExecutionByIdempotencyKey",
        plan_available: true,
        execution_enabled: false,
        runtime_wiring: "disabled",
        repository_status: "pg_repository_implementation_available",
        query_plan_mode: DELIVERY_HUB_EXECUTION_LEDGER_QUERY_PLAN_MODE,
        query_plan_builder: "buildDeliveryHubExecutionLedgerGetByIdempotencyKeyPlan",
        descriptor_operations: ["select_execution_by_idempotency_key"],
        transaction_plan_available: false,
        transaction_plan_mode: undefined,
        transaction_plan_builder: undefined,
        allowed_action: "plan_only",
      },
      {
        operation: "reserveExecution",
        plan_available: true,
        execution_enabled: false,
        runtime_wiring: "disabled",
        repository_status: "pg_repository_implementation_available",
        query_plan_mode: DELIVERY_HUB_EXECUTION_LEDGER_QUERY_PLAN_MODE,
        query_plan_builder: "buildDeliveryHubExecutionLedgerReserveExecutionPlan",
        descriptor_operations: ["select_execution_by_reservation_key", "insert_execution_reservation"],
        transaction_plan_available: true,
        transaction_plan_mode: DELIVERY_HUB_EXECUTION_LEDGER_TRANSACTION_PLAN_MODE,
        transaction_plan_builder: "buildDeliveryHubExecutionLedgerReserveTransactionPlan",
        allowed_action: "plan_only",
      },
      {
        operation: "recordTransition",
        plan_available: true,
        execution_enabled: false,
        runtime_wiring: "disabled",
        repository_status: "pg_repository_implementation_available",
        query_plan_mode: DELIVERY_HUB_EXECUTION_LEDGER_QUERY_PLAN_MODE,
        query_plan_builder: "buildDeliveryHubExecutionLedgerRecordTransitionPlan",
        descriptor_operations: ["select_execution_by_reference", "insert_execution_transition"],
        transaction_plan_available: true,
        transaction_plan_mode: DELIVERY_HUB_EXECUTION_LEDGER_TRANSACTION_PLAN_MODE,
        transaction_plan_builder: "buildDeliveryHubExecutionLedgerTransitionTransactionPlan",
        allowed_action: "plan_only",
      },
      {
        operation: "appendAuditEvent",
        plan_available: true,
        execution_enabled: false,
        runtime_wiring: "disabled",
        repository_status: "pg_repository_implementation_available",
        query_plan_mode: DELIVERY_HUB_EXECUTION_LEDGER_QUERY_PLAN_MODE,
        query_plan_builder: "buildDeliveryHubExecutionLedgerAppendAuditEventPlan",
        descriptor_operations: ["select_execution_by_reference", "insert_execution_audit_event"],
        transaction_plan_available: true,
        transaction_plan_mode: DELIVERY_HUB_EXECUTION_LEDGER_TRANSACTION_PLAN_MODE,
        transaction_plan_builder: "buildDeliveryHubExecutionLedgerAppendAuditTransactionPlan",
        allowed_action: "plan_only",
      },
    ])
    expect(readiness.operation_readiness.every((entry) => entry.plan_available)).toBe(true)
    expect(readiness.operation_readiness.every((entry) => entry.execution_enabled === false)).toBe(true)
    expect(readiness.operation_readiness.every((entry) => entry.runtime_wiring === "disabled")).toBe(true)
  })

  it("references descriptor, migration, schema verification and plan layers without executing them", () => {
    const readiness = buildDeliveryHubExecutionLedgerRepositoryAssemblyReadiness({
      table_name: "custom_execution_ledger",
      adapter_scaffold_available: false,
      pg_repository_implementation_available: false,
    })

    expect(readiness.repository_status).toBe("not_configured")
    expect(readiness.component_inventory.find((entry) => entry.component === "storage_adapter_scaffold")).toMatchObject({
      status: "not_configured",
      runtime_wiring: "disabled",
      execution_enabled: false,
    })
    expect(readiness.descriptor_layer.entity_descriptors.map((descriptor) => descriptor.table)).toEqual([
      "custom_execution_ledger",
      "custom_execution_ledger_transitions",
      "custom_execution_ledger_audit_events",
    ])
    expect(readiness.descriptor_layer.descriptor_bundle_execution).toBe(
      "not_invoked_without_controlled_execution_drafts"
    )
    expect(readiness.plan_layer.builders_are_referenced_only).toBe(true)
    expect(readiness.plan_layer.query_execution_enabled).toBe(false)
    expect(readiness.plan_layer.transaction_execution_enabled).toBe(false)
    expect(readiness.migration_layer.artifact.table_name).toBe("custom_execution_ledger")
    expect(readiness.migration_layer.artifact.descriptor_tables).toEqual({
      main: "custom_execution_ledger",
      transitions: "custom_execution_ledger_transitions",
      audit_events: "custom_execution_ledger_audit_events",
    })
    expect(readiness.schema_verification_layer.verifier_available).toBe(true)
    expect(readiness.schema_verification_layer.check_plan_available).toBe(true)
    expect(readiness.schema_verification_layer.verifier_source).toBe("supplied_snapshot_only")
    expect(readiness.schema_verification_layer.db_connection_required).toBe(false)
    expect(readiness.schema_verification_layer.db_introspection_required).toBe(false)
    expect(readiness.schema_verification_layer.repository_required).toBe(false)
    expect(readiness.schema_verification_layer.db_adapter_required).toBe(false)
    expect(readiness.schema_verification_layer.sql_execution_required).toBe(false)
    expect(readiness.persistence_readiness_contour.review_preparation_available_now).toEqual([
      "descriptor_bundle_defined",
      "migration_artifact_reviewable",
      "snapshot_schema_verifier_available",
      "snapshot_schema_check_plan_available",
    ])
    expect(readiness.operation_readiness.every((entry) => entry.repository_status === "not_configured")).toBe(true)
    expect(readiness.disabled_confirmations.query_execution).toBe(false)
    expect(readiness.disabled_confirmations.transaction_execution).toBe(false)
    expect(readiness.disabled_confirmations.production_writes).toBe(false)
  })

  it("creates optional inert repository assembly without invoking connection factories or writes", async () => {
    const connectionFactory = jest.fn(() => {
      throw new Error("connection should remain unused by assembly factory")
    })

    const assembly = createDeliveryHubExecutionLedgerRepositoryAssemblyWithInertAdapter({
      table_name: "factory_execution_ledger",
      connection: connectionFactory,
    })

    expect(assembly.readiness.repository_status).toBe("pg_repository_implementation_available")
    expect(assembly.readiness.table_name).toBe("factory_execution_ledger")
    expect(assembly.readiness.disabled_confirmations.connection_factory_invocation).toBe(false)
    await expect(assembly.repository.getExecutionByReference("dhprev_ref")).resolves.toBeNull()
    await expect(assembly.repository.getExecutionByIdempotencyKey("idem_ref")).resolves.toBeNull()
    expect(connectionFactory).not.toHaveBeenCalled()
  })

  it("keeps transaction planning from invoking runtime connection factories", () => {
    const connectionFactory = jest.fn(() => {
      throw new Error("connection should remain unused by transaction planning")
    })
    const executionPlan = buildExecutionPlan()
    const identity = buildDeliveryHubControlledExecutionIdentity(executionPlan)
    const reservationDraft = buildDeliveryHubControlledExecutionReservationDraft({
      execution_plan: executionPlan,
      execution_identity: identity,
    })
    const recordDraft = buildDeliveryHubControlledExecutionRecordDraft({
      execution_plan: executionPlan,
      execution_identity: identity,
      reservation_draft: reservationDraft,
    })

    buildDeliveryHubExecutionLedgerReserveTransactionPlan({
      execution_record: recordDraft,
      reservation_draft: reservationDraft,
    })
    buildDeliveryHubExecutionLedgerTransitionTransactionPlan({
      execution_reference: identity.execution_reference,
      from: DELIVERY_HUB_EXECUTION_STATE.planned,
      to: DELIVERY_HUB_EXECUTION_STATE.reserved,
      sequence: 1,
    })
    buildDeliveryHubExecutionLedgerAppendAuditTransactionPlan({
      execution_reference: identity.execution_reference,
      event: buildDeliveryHubControlledExecutionAuditDraft({
        execution_plan: executionPlan,
        execution_identity: identity,
      }),
      sequence: 2,
    })

    expect(connectionFactory).not.toHaveBeenCalled()
  })

  it("keeps the storage adapter scaffold inert and non-writing by default", async () => {
    const connectionFactory = jest.fn(async () => {
      throw new Error("connection should remain unused by the inert scaffold")
    })
    const repository = new DeliveryHubExecutionLedgerStorageAdapterScaffold({
      connection: connectionFactory,
    })
    const executionPlan = buildExecutionPlan()
    const identity = buildDeliveryHubControlledExecutionIdentity(executionPlan)
    const reservationDraft = buildDeliveryHubControlledExecutionReservationDraft({
      execution_plan: executionPlan,
      execution_identity: identity,
    })
    const recordDraft = buildDeliveryHubControlledExecutionRecordDraft({
      execution_plan: executionPlan,
      execution_identity: identity,
      reservation_draft: reservationDraft,
    })
    const auditDraft = buildDeliveryHubControlledExecutionAuditDraft({
      execution_plan: executionPlan,
      execution_identity: identity,
    })

    await expect(
      repository.getExecutionByReference(identity.execution_reference)
    ).resolves.toBeNull()
    await expect(
      repository.getExecutionByIdempotencyKey(identity.idempotency_key)
    ).resolves.toBeNull()
    await expect(
      repository.reserveExecution({
        execution_record: recordDraft,
        reservation_draft: reservationDraft,
        audit_event: auditDraft,
      })
    ).rejects.toMatchObject({
      code: "DELIVERY_HUB_EXECUTION_LEDGER_STORAGE_ADAPTER_NOT_CONFIGURED",
      message: expect.stringContaining("reserveExecution"),
    })
    await expect(
      repository.recordTransition({
        execution_reference: identity.execution_reference,
        from: DELIVERY_HUB_EXECUTION_STATE.planned,
        to: DELIVERY_HUB_EXECUTION_STATE.reserved,
        audit_event: auditDraft,
      })
    ).resolves.toEqual({
      status: "rejected",
      record: null,
      reason: expect.stringContaining("recordTransition"),
    })
    await expect(
      repository.appendAuditEvent({
        execution_reference: identity.execution_reference,
        event: auditDraft,
      })
    ).resolves.toBeNull()
    expect(connectionFactory).not.toHaveBeenCalled()
  })
})

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, " ").trim()
}

type DescriptorLike = {
  sql: string
  bindings: Array<{ name: string; value: string | number }>
}

function expectCallToMatchDescriptor(
  call: FakePgCall | undefined,
  descriptor: DescriptorLike
): void {
  expect(call).toEqual({
    sql: descriptor.sql,
    bindings: descriptor.bindings.map((binding) => binding.value),
  })
}

function expectMainRecordRefreshCallToUseNormalizedDescriptor(
  call: FakePgCall | undefined,
  descriptor: DescriptorLike
): void {
  expectCallToMatchDescriptor(call, descriptor)
  expect(call?.sql).toMatch(
    /^update [a-z0-9_]+ set execution_payload = \?, reservation_payload = \?, transitions_payload = \?, audit_events_payload = \? where execution_reference = \?$/
  )
  expect(descriptor.bindings.map((binding) => binding.name)).toEqual([
    "execution_payload",
    "reservation_payload",
    "transitions_payload",
    "audit_events_payload",
    "execution_reference",
  ])
  expect(extractUpdatedColumns(call?.sql ?? "")).toEqual([
    "execution_payload",
    "reservation_payload",
    "transitions_payload",
    "audit_events_payload",
  ])
}

function expectRepositoryCallsReferenceMigrationArtifact(
  calls: FakePgCall[],
  artifact: ReturnType<typeof buildDeliveryHubExecutionLedgerPgMigrationArtifact>
): void {
  const allowedColumnsByTable = new Map<string, Set<string>>([
    [artifact.descriptor_tables.main, new Set(artifact.descriptor_columns.main)],
    [artifact.descriptor_tables.transitions, new Set(artifact.descriptor_columns.transitions)],
    [artifact.descriptor_tables.audit_events, new Set(artifact.descriptor_columns.audit_events)],
  ])

  for (const call of calls) {
    const tableName = extractStatementTableName(call.sql)
    expect(tableName).toBeDefined()
    expect(allowedColumnsByTable.has(tableName!)).toBe(true)

    const allowedColumns = allowedColumnsByTable.get(tableName!)!
    for (const column of extractStatementColumns(call.sql)) {
      expect(allowedColumns.has(column)).toBe(true)
    }
  }
}

function extractStatementTableName(sql: string): string | undefined {
  return sql.match(/\b(?:from|into|update)\s+([a-z0-9_]+)/)?.[1]
}

function extractStatementColumns(sql: string): string[] {
  const selectColumns = sql.match(/^select (.+?) from /)?.[1]
  const insertColumns = sql.match(/^insert into [a-z0-9_]+ \((.+?)\) values/)?.[1]
  const updateColumns = extractUpdatedColumns(sql).join(", ")
  const columns = selectColumns ?? insertColumns ?? updateColumns

  return columns
    .split(",")
    .map((column) => column.trim())
    .filter(Boolean)
}

function extractUpdatedColumns(sql: string): string[] {
  const assignments = sql.match(/^update [a-z0-9_]+ set (.+?) where /)?.[1]

  if (!assignments) {
    return []
  }

  return assignments.split(",").map((assignment) => assignment.trim().split(" = ")[0]!)
}

type FakePgCall = {
  sql: string
  bindings: unknown[]
}

type FakePgConnection = DeliveryHubPgConnection & {
  calls: FakePgCall[]
  rowsByReference: Map<string, ReturnType<typeof buildDeliveryHubExecutionLedgerStorageRecord>>
  referenceByIdempotencyKey: Map<string, string>
}

type FakePgConnectionOptions = {
  conflictNextReservationInsert?: boolean
}

function createFakePgConnection(options: FakePgConnectionOptions = {}): FakePgConnection {
  const calls: FakePgCall[] = []
  const rowsByReference = new Map<string, ReturnType<typeof buildDeliveryHubExecutionLedgerStorageRecord>>()
  const referenceByIdempotencyKey = new Map<string, string>()
  let conflictNextReservationInsert = Boolean(options.conflictNextReservationInsert)

  return {
    calls,
    rowsByReference,
    referenceByIdempotencyKey,
    async raw<T = unknown>(sql: string, bindings: unknown[] = []) {
      calls.push({ sql, bindings })

      if (sql.includes(" where execution_reference = ? limit 1")) {
        const row = rowsByReference.get(String(bindings[0]))
        return { rows: (row ? [row] : []) as T[] }
      }

      if (sql.includes(" where idempotency_key = ? limit 1")) {
        const reference = referenceByIdempotencyKey.get(String(bindings[0]))
        const row = reference ? rowsByReference.get(reference) : undefined
        return { rows: (row ? [row] : []) as T[] }
      }

      if (
        /^insert into [a-z0-9_]+ \(execution_reference, idempotency_key, execution_payload, reservation_payload\) values/.test(sql)
      ) {
        if (conflictNextReservationInsert) {
          conflictNextReservationInsert = false
          referenceByIdempotencyKey.set(String(bindings[1]), String(bindings[0]))
          return { rowCount: 0, rows: [] as T[] }
        }

        const row = {
          execution_reference: String(bindings[0]),
          idempotency_key: String(bindings[1]),
          execution_payload: String(bindings[2]),
          reservation_payload: String(bindings[3]),
          transitions_payload: "[]",
          audit_events_payload: "[]",
        }
        rowsByReference.set(row.execution_reference, row)
        referenceByIdempotencyKey.set(row.idempotency_key, row.execution_reference)
        return { rowCount: 1, rows: [] as T[] }
      }

      if (/^insert into [a-z0-9_]+_(?:transitions|audit_events) /.test(sql)) {
        return { rowCount: 1, rows: [] as T[] }
      }

      if (/^update [a-z0-9_]+ set execution_payload = \?/.test(sql)) {
        const reference = String(bindings[4])
        const existing = rowsByReference.get(reference)

        if (existing) {
          rowsByReference.set(reference, {
            ...existing,
            execution_payload: String(bindings[0]),
            reservation_payload: String(bindings[1]),
            transitions_payload: String(bindings[2]),
            audit_events_payload: String(bindings[3]),
          })
        }

        return { rows: [] as T[] }
      }

      return { rows: [] as T[] }
    },
  }
}

function seedFakePgLedgerRecord(
  connection: FakePgConnection,
  input: Parameters<typeof buildDeliveryHubExecutionLedgerStorageRecord>[0]
): void {
  const row = buildDeliveryHubExecutionLedgerStorageRecord(input)

  connection.rowsByReference.set(row.execution_reference, row)
  connection.referenceByIdempotencyKey.set(row.idempotency_key, row.execution_reference)
}

async function buildReservedPgRepository() {
  const connection = createFakePgConnection()
  const repository = new DeliveryHubExecutionLedgerPgRepository({ connection })
  const executionPlan = buildExecutionPlan()
  const identity = buildDeliveryHubControlledExecutionIdentity(executionPlan)
  const reservationDraft = buildDeliveryHubControlledExecutionReservationDraft({
    execution_plan: executionPlan,
    execution_identity: identity,
  })
  const recordDraft = buildDeliveryHubControlledExecutionRecordDraft({
    execution_plan: executionPlan,
    execution_identity: identity,
    reservation_draft: reservationDraft,
  })

  await repository.reserveExecution({
    execution_record: recordDraft,
    reservation_draft: reservationDraft,
  })

  return {
    connection,
    repository,
    executionPlan,
    identity,
    reservationDraft,
    recordDraft,
  }
}

async function buildReservedRepository() {
  const repository = new InMemoryDeliveryHubExecutionLedgerRepository()
  const executionPlan = buildExecutionPlan()
  const identity = {
    ...buildDeliveryHubControlledExecutionIdentity(executionPlan),
    execution_reference: "dhprev_ref",
  }
  const reservationDraft = buildDeliveryHubControlledExecutionReservationDraft({
    execution_plan: executionPlan,
    execution_identity: identity,
  })
  const recordDraft = buildDeliveryHubControlledExecutionRecordDraft({
    execution_plan: executionPlan,
    execution_identity: identity,
    reservation_draft: reservationDraft,
  })

  await repository.reserveExecution({
    execution_record: recordDraft,
    reservation_draft: reservationDraft,
  })

  return repository
}

function buildExecutionPlan(overrides?: {
  items?: Array<{ line_item_id: string | null; quantity: number }>
}): DeliveryHubProviderExecutionPlan {
  return {
    version: 1 as const,
    provider_code: DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
    provider_id: DELIVERY_HUB_FULFILLMENT_PROVIDER_ID,
    operation: "create_shipment" as const,
    connection_id: "conn_ready",
    mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
    quote_reference: createDeliveryHubQuoteReference({
      connection_id: "conn_ready",
      quote_type: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
      quote_key: "quote_ledger_repository",
    }),
    order: {
      id: "order_1",
      display_id: 42,
      currency_code: "RUB",
    },
    fulfillment: {
      id: "ful_1",
      location_id: "sloc_1",
    },
    items: overrides?.items ?? [
      {
        line_item_id: "item_1",
        quantity: 1,
      },
    ],
    outbound_request: {
      method: "POST" as const,
      path: "/shipments" as const,
      headers: {
        authorization: "Bearer delivery-hub-provider-credential",
        "content-type": "application/json" as const,
      },
      body: {
        provider_code: DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
        provider_id: DELIVERY_HUB_FULFILLMENT_PROVIDER_ID,
        connection_id: "conn_ready",
        mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
        quote_reference: createDeliveryHubQuoteReference({
          connection_id: "conn_ready",
          quote_type: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
          quote_key: "quote_ledger_repository",
        }),
        order: {
          id: "order_1",
          display_id: 42,
          currency_code: "RUB",
        },
        fulfillment: {
          id: "ful_1",
          location_id: "sloc_1",
        },
        items: overrides?.items ?? [
          {
            line_item_id: "item_1",
            quantity: 1,
          },
        ],
        quote: {
          carrier_code: "yandex",
          carrier_label: "Yandex Delivery",
          amount: 299,
          currency_code: "RUB",
          delivery_eta_min: 1,
          delivery_eta_max: 1,
          pickup_point_required: true,
          pickup_window_required: false,
        },
        pickup_point: {
          provider_point_id: "pvz_2",
          provider_point_code: "code_2",
          name: "PVZ 2",
          address: "Arbat 10",
          city: "Moscow",
          region: "Moscow",
          postal_code: "119019",
          lat: 55.75,
          lng: 37.6,
          is_origin_dropoff_allowed: true,
          is_destination_pickup_allowed: true,
          payment_methods: ["card"],
        },
        pickup_window: null,
      },
    },
  }
}
