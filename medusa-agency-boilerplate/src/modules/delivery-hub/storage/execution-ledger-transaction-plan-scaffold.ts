import {
  DELIVERY_HUB_EXECUTION_STATE,
  type DeliveryHubExecutionReservationDraft,
  type DeliveryHubExecutionState,
  canFailBlockedDeliveryHubControlledExecution,
  compareDeliveryHubExecutionReservationDrafts,
  validateDeliveryHubExecutionStateTransition,
} from "../shipment-execution-contract"
import type {
  DeliveryHubExecutionLedgerAppendAuditInput,
  DeliveryHubExecutionLedgerReserveInput,
  DeliveryHubExecutionLedgerTransitionInput,
} from "./execution-ledger-repository"
import {
  type DeliveryHubExecutionLedgerPlanOperation,
  type DeliveryHubExecutionLedgerQueryPlan,
  buildDeliveryHubExecutionLedgerAppendAuditEventPlan,
  buildDeliveryHubExecutionLedgerRecordTransitionPlan,
  buildDeliveryHubExecutionLedgerReserveExecutionPlan,
} from "./execution-ledger-query-plan-scaffold"
import type { DeliveryHubExecutionLedgerStorageQueryDescriptor } from "./execution-ledger-storage-descriptor-scaffold"

export const DELIVERY_HUB_EXECUTION_LEDGER_TRANSACTION_PLAN_VERSION = 1
export const DELIVERY_HUB_EXECUTION_LEDGER_TRANSACTION_PLAN_MODE = "transaction_plan_only"

export type DeliveryHubExecutionLedgerTransactionPlanOperation =
  | "reserveExecutionUnitOfWork"
  | "recordTransitionUnitOfWork"
  | "appendAuditEventUnitOfWork"
  | "recordFailedBlockedTransitionUnitOfWork"

export type DeliveryHubExecutionLedgerTransactionPlanConfirmation = {
  query_execution_enabled: false
  transaction_open_enabled: false
  transaction_commit_enabled: false
  transaction_rollback_enabled: false
  transaction_execution_enabled: false
  runtime_wiring_enabled: false
  production_writes_enabled: false
  live_execution_enabled: false
  provider_dispatch_enabled: false
  shipment_creation_enabled: false
  compensation_writes_enabled: false
}

export type DeliveryHubExecutionLedgerTransactionBoundaryIntent = {
  atomicity_required: true
  transaction_execution_enabled: false
  open_transaction: "disabled"
  commit_transaction: "disabled"
  rollback_transaction: "disabled"
  isolation_intent: "future_repository_defined"
  connection_factory_invocation_enabled: false
}

export type DeliveryHubExecutionLedgerRollbackCompensationIntent = {
  mode: "descriptor_only"
  executable_logic_enabled: false
  rollback_writes_enabled: false
  compensation_writes_enabled: false
  description: string
}

export type DeliveryHubExecutionLedgerTransactionConflictGuard = {
  guard:
    | "reservation_dedupe_scope"
    | "reservation_fingerprint_match"
    | "transition_allowed"
    | "current_state_matches_transition_from"
    | "failed_blocked_transition_allowed"
    | "audit_execution_reference_present"
    | "descriptor_inertness"
  expected: string | boolean
  source: "reservation_contract" | "transition_contract" | "audit_contract" | "descriptor_contract"
}

export type DeliveryHubExecutionLedgerTransactionPlanStep = {
  order: number
  unit_step:
    | "reservation_lookup"
    | "reservation_write_projection"
    | "execution_lookup"
    | "transition_write_projection"
    | "audit_write_projection"
    | "main_record_refresh_projection"
  query_plan_operation: DeliveryHubExecutionLedgerPlanOperation
  query_step_index: number
  descriptor_operation: DeliveryHubExecutionLedgerStorageQueryDescriptor["operation"]
  descriptor: DeliveryHubExecutionLedgerStorageQueryDescriptor
  execution_enabled: false
}

export type DeliveryHubExecutionLedgerTransactionPlan = {
  version: typeof DELIVERY_HUB_EXECUTION_LEDGER_TRANSACTION_PLAN_VERSION
  operation: DeliveryHubExecutionLedgerTransactionPlanOperation
  mode: typeof DELIVERY_HUB_EXECUTION_LEDGER_TRANSACTION_PLAN_MODE
  unit_of_work_name: string
  transaction_boundary: DeliveryHubExecutionLedgerTransactionBoundaryIntent
  rollback_compensation_intent: DeliveryHubExecutionLedgerRollbackCompensationIntent
  ordered_steps: DeliveryHubExecutionLedgerTransactionPlanStep[]
  query_plans: DeliveryHubExecutionLedgerQueryPlan[]
  conflict_guards: DeliveryHubExecutionLedgerTransactionConflictGuard[]
  descriptor_alignment: {
    all_descriptors_inert: true
    query_plan_operations: DeliveryHubExecutionLedgerPlanOperation[]
    descriptor_operations: DeliveryHubExecutionLedgerStorageQueryDescriptor["operation"][]
  }
  confirmations: DeliveryHubExecutionLedgerTransactionPlanConfirmation
}

export function buildDeliveryHubExecutionLedgerReserveTransactionPlan(
  input: DeliveryHubExecutionLedgerReserveInput & {
    table_name?: string
  }
): DeliveryHubExecutionLedgerTransactionPlan {
  const reservePlan = buildDeliveryHubExecutionLedgerReserveExecutionPlan(input)
  const auditPlan = input.audit_event
    ? buildDeliveryHubExecutionLedgerAppendAuditEventPlan({
        execution_reference: input.reservation_draft.execution_reference,
        event: input.audit_event,
        sequence: 1,
        table_name: input.table_name,
      })
    : undefined

  return buildDeliveryHubExecutionLedgerTransactionPlan({
    operation: "reserveExecutionUnitOfWork",
    unit_of_work_name: "reserve execution plus optional audit intent",
    query_plans: auditPlan ? [reservePlan, auditPlan] : [reservePlan],
    rollback_description:
      "Future repository must treat reservation row projection and optional audit projection as one atomic unit; rollback remains a descriptor only in this scaffold.",
    conflict_guards: [
      {
        guard: "reservation_dedupe_scope",
        expected: input.reservation_draft.dedupe_scope,
        source: "reservation_contract",
      },
      {
        guard: "reservation_fingerprint_match",
        expected: compareDeliveryHubExecutionReservationDrafts({
          expected: input.reservation_draft,
          incoming: input.reservation_draft,
        }).status,
        source: "reservation_contract",
      },
      buildDescriptorInertnessGuard(),
    ],
  })
}

export function buildDeliveryHubExecutionLedgerTransitionTransactionPlan(
  input: DeliveryHubExecutionLedgerTransitionInput & {
    sequence: number
    recorded_at?: string
    table_name?: string
  }
): DeliveryHubExecutionLedgerTransactionPlan {
  const transitionPlan = buildDeliveryHubExecutionLedgerRecordTransitionPlan(input)
  const auditPlan = input.audit_event
    ? buildDeliveryHubExecutionLedgerAppendAuditEventPlan({
        execution_reference: input.execution_reference,
        event: input.audit_event,
        sequence: input.sequence,
        recorded_at: input.recorded_at,
        table_name: input.table_name,
      })
    : undefined
  const transitionValidation = validateDeliveryHubExecutionStateTransition({
    from: input.from,
    to: input.to,
  })

  return buildDeliveryHubExecutionLedgerTransactionPlan({
    operation: "recordTransitionUnitOfWork",
    unit_of_work_name: "record transition plus optional audit intent",
    query_plans: auditPlan ? [transitionPlan, auditPlan] : [transitionPlan],
    rollback_description:
      "Future repository must atomically verify current state, append transition projection and optional audit projection; rollback remains a descriptor only in this scaffold.",
    conflict_guards: [
      {
        guard: "transition_allowed",
        expected: transitionValidation.allowed,
        source: "transition_contract",
      },
      {
        guard: "current_state_matches_transition_from",
        expected: input.from,
        source: "transition_contract",
      },
      buildDescriptorInertnessGuard(),
    ],
  })
}

export function buildDeliveryHubExecutionLedgerAppendAuditTransactionPlan(
  input: DeliveryHubExecutionLedgerAppendAuditInput & {
    sequence: number
    recorded_at?: string
    table_name?: string
  }
): DeliveryHubExecutionLedgerTransactionPlan {
  const auditPlan = buildDeliveryHubExecutionLedgerAppendAuditEventPlan(input)

  return buildDeliveryHubExecutionLedgerTransactionPlan({
    operation: "appendAuditEventUnitOfWork",
    unit_of_work_name: "append audit event only",
    query_plans: [auditPlan],
    rollback_description:
      "Future repository must atomically verify execution presence and append audit projection; rollback remains a descriptor only in this scaffold.",
    conflict_guards: [
      {
        guard: "audit_execution_reference_present",
        expected: Boolean(input.execution_reference),
        source: "audit_contract",
      },
      buildDescriptorInertnessGuard(),
    ],
  })
}

export function buildDeliveryHubExecutionLedgerFailedBlockedTransactionPlan(
  input: Omit<DeliveryHubExecutionLedgerTransitionInput, "to" | "audit_event"> & {
    from: Exclude<DeliveryHubExecutionState, typeof DELIVERY_HUB_EXECUTION_STATE.completed | typeof DELIVERY_HUB_EXECUTION_STATE.failedBlocked>
    audit_event: DeliveryHubExecutionLedgerAppendAuditInput["event"]
    sequence: number
    recorded_at?: string
    table_name?: string
  }
): DeliveryHubExecutionLedgerTransactionPlan {
  const transitionInput = {
    ...input,
    to: DELIVERY_HUB_EXECUTION_STATE.failedBlocked,
  }
  const transitionPlan = buildDeliveryHubExecutionLedgerRecordTransitionPlan(transitionInput)
  const auditPlan = buildDeliveryHubExecutionLedgerAppendAuditEventPlan({
    execution_reference: input.execution_reference,
    event: input.audit_event,
    sequence: input.sequence,
    recorded_at: input.recorded_at,
    table_name: input.table_name,
  })

  return buildDeliveryHubExecutionLedgerTransactionPlan({
    operation: "recordFailedBlockedTransitionUnitOfWork",
    unit_of_work_name: "record failed-blocked transition plus required audit intent",
    query_plans: [transitionPlan, auditPlan],
    rollback_description:
      "Future repository must atomically verify non-terminal current state and append failed-blocked transition/audit projections; rollback remains a descriptor only in this scaffold.",
    conflict_guards: [
      {
        guard: "failed_blocked_transition_allowed",
        expected: canFailBlockedDeliveryHubControlledExecution(input.from),
        source: "transition_contract",
      },
      {
        guard: "current_state_matches_transition_from",
        expected: input.from,
        source: "transition_contract",
      },
      buildDescriptorInertnessGuard(),
    ],
  })
}

function buildDeliveryHubExecutionLedgerTransactionPlan(input: {
  operation: DeliveryHubExecutionLedgerTransactionPlanOperation
  unit_of_work_name: string
  query_plans: DeliveryHubExecutionLedgerQueryPlan[]
  rollback_description: string
  conflict_guards: DeliveryHubExecutionLedgerTransactionConflictGuard[]
}): DeliveryHubExecutionLedgerTransactionPlan {
  const orderedSteps = input.query_plans.flatMap((queryPlan) =>
    queryPlan.steps.map((step, index) => ({
      order: 0,
      unit_step: mapQueryDescriptorOperationToUnitStep(step.descriptor.operation),
      query_plan_operation: queryPlan.operation,
      query_step_index: index,
      descriptor_operation: step.descriptor.operation,
      descriptor: step.descriptor,
      execution_enabled: false as const,
    }))
  )

  return {
    version: DELIVERY_HUB_EXECUTION_LEDGER_TRANSACTION_PLAN_VERSION,
    operation: input.operation,
    mode: DELIVERY_HUB_EXECUTION_LEDGER_TRANSACTION_PLAN_MODE,
    unit_of_work_name: input.unit_of_work_name,
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
      description: input.rollback_description,
    },
    ordered_steps: orderedSteps.map((step, index) => ({
      ...step,
      order: index + 1,
    })),
    query_plans: input.query_plans,
    conflict_guards: input.conflict_guards,
    descriptor_alignment: {
      all_descriptors_inert: true,
      query_plan_operations: input.query_plans.map((queryPlan) => queryPlan.operation),
      descriptor_operations: orderedSteps.map((step) => step.descriptor_operation),
    },
    confirmations: buildDisabledConfirmations(),
  }
}

function mapQueryDescriptorOperationToUnitStep(
  operation: DeliveryHubExecutionLedgerStorageQueryDescriptor["operation"]
): DeliveryHubExecutionLedgerTransactionPlanStep["unit_step"] {
  if (operation === "select_execution_by_reservation_key") {
    return "reservation_lookup"
  }

  if (operation === "insert_execution_reservation") {
    return "reservation_write_projection"
  }

  if (operation === "insert_execution_transition") {
    return "transition_write_projection"
  }

  if (operation === "insert_execution_audit_event") {
    return "audit_write_projection"
  }

  if (operation === "update_execution_main_record") {
    return "main_record_refresh_projection"
  }

  return "execution_lookup"
}

function buildDescriptorInertnessGuard(): DeliveryHubExecutionLedgerTransactionConflictGuard {
  return {
    guard: "descriptor_inertness",
    expected: true,
    source: "descriptor_contract",
  }
}

function buildDisabledConfirmations(): DeliveryHubExecutionLedgerTransactionPlanConfirmation {
  return {
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
  }
}
