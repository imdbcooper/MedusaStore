import crypto from "node:crypto"
import {
  DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
  DELIVERY_HUB_FULFILLMENT_PROVIDER_ID,
  type DeliveryHubFulfillmentModeCode,
} from "./shipping-option-contract"
import type {
  DeliveryHubCreateFulfillmentBridgeFulfillment,
  DeliveryHubCreateFulfillmentBridgeItem,
  DeliveryHubCreateFulfillmentBridgeOrder,
  DeliveryHubProviderExecutionPlan,
} from "./fulfillment-provider-bridge"

export const DELIVERY_HUB_CONTROLLED_EXECUTION_CONTRACT_VERSION = 1
export const DELIVERY_HUB_EXECUTION_RESERVATION_DRAFT_VERSION = 1
export const DELIVERY_HUB_EXECUTION_AUDIT_DRAFT_VERSION = 1

export const DELIVERY_HUB_EXECUTION_STATE = {
  planned: "planned",
  reserved: "reserved",
  dispatchReady: "dispatch_ready",
  dispatchInflight: "dispatch_inflight",
  resultReceived: "result_received",
  applicationReady: "application_ready",
  completed: "completed",
  failedBlocked: "failed_blocked",
} as const

export type DeliveryHubExecutionState =
  (typeof DELIVERY_HUB_EXECUTION_STATE)[keyof typeof DELIVERY_HUB_EXECUTION_STATE]

export type DeliveryHubControlledExecutionTransitionReasonCode =
  | "reservation_projected"
  | "dispatch_gate_satisfied"
  | "dispatch_started"
  | "result_normalized"
  | "application_projection_ready"
  | "application_projection_completed"
  | "execution_blocked"

export type DeliveryHubControlledExecutionTransition = {
  from: DeliveryHubExecutionState
  to: DeliveryHubExecutionState
  reason_code: DeliveryHubControlledExecutionTransitionReasonCode
}

export type DeliveryHubControlledExecutionIdentity = {
  execution_reference: string
  provider_operation_label: string
  provider_key: typeof DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE
  provider_code: typeof DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE
  provider_id: typeof DELIVERY_HUB_FULFILLMENT_PROVIDER_ID
  operation: DeliveryHubProviderExecutionPlan["operation"]
  idempotency_key: string
  plan_fingerprint: string
  execution_fingerprint: string
  reservation_fingerprint: string
}

export type DeliveryHubControlledExecutionCorrelation = {
  connection_id: string
  mode_code: DeliveryHubFulfillmentModeCode
  quote_reference_id: string
  order_id: string | null
  order_display_id: string | number | null
  fulfillment_id: string | null
  fulfillment_location_id: string | null
}

export type DeliveryHubControlledExecutionRecordDraft = {
  version: typeof DELIVERY_HUB_CONTROLLED_EXECUTION_CONTRACT_VERSION
  record_type: "deliveryhub_controlled_shipment_execution"
  lifecycle: "controlled_future_orchestration"
  provider: {
    provider_key: typeof DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE
    provider_code: typeof DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE
    provider_id: typeof DELIVERY_HUB_FULFILLMENT_PROVIDER_ID
  }
  execution: DeliveryHubControlledExecutionIdentity
  correlation: DeliveryHubControlledExecutionCorrelation
  current_state: DeliveryHubExecutionState
  allowed_transitions: DeliveryHubControlledExecutionTransition[]
  plan_snapshot: {
    operation: DeliveryHubProviderExecutionPlan["operation"]
    connection_id: string
    mode_code: DeliveryHubFulfillmentModeCode
    item_count: number
    destination_kind: "pickup_point" | "unknown"
    origin_kind: "fulfillment_location" | "dropoff_point"
  }
  reservation: {
    dedupe_scope: "deliveryhub:create_shipment"
    reservation_key: string
    reservation_fingerprint: string
    plan_fingerprint: string
    drift_status: "in_sync"
  }
  terminality: {
    completed: boolean
    blocked: boolean
  }
}

export type DeliveryHubExecutionReservationDriftStatus =
  | "in_sync"
  | "plan_fingerprint_mismatch"
  | "execution_fingerprint_mismatch"
  | "reservation_fingerprint_mismatch"
  | "reservation_scope_mismatch"

export type DeliveryHubExecutionReservationDraft = {
  version: typeof DELIVERY_HUB_EXECUTION_RESERVATION_DRAFT_VERSION
  reservation_type: "deliveryhub_execution_idempotency_reservation"
  dedupe_scope: "deliveryhub:create_shipment"
  reservation_key: string
  reservation_fingerprint: string
  execution_reference: string
  provider_key: typeof DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE
  operation: DeliveryHubProviderExecutionPlan["operation"]
  connection_id: string
  mode_code: DeliveryHubFulfillmentModeCode
  quote_reference_id: string
  plan_fingerprint: string
  execution_fingerprint: string
  matched_identity_fields: Array<{
    field: string
    value_preview: string
  }>
}

export type DeliveryHubExecutionReservationComparison = {
  status: "match" | "drifted"
  drift_reasons: DeliveryHubExecutionReservationDriftStatus[]
  expected_reservation_fingerprint: string
  incoming_reservation_fingerprint: string
  expected_plan_fingerprint: string
  incoming_plan_fingerprint: string
  expected_execution_fingerprint: string
  incoming_execution_fingerprint: string
}

export type DeliveryHubExecutionAuditDraft = {
  version: typeof DELIVERY_HUB_EXECUTION_AUDIT_DRAFT_VERSION
  event_type:
    | "deliveryhub.execution.planned"
    | "deliveryhub.execution.reserved"
    | "deliveryhub.execution.dispatch_ready"
  execution_reference: string
  current_state: DeliveryHubExecutionState
  summary: string
  correlation: {
    connection_id: string
    mode_code: DeliveryHubFulfillmentModeCode
    quote_reference_id: string
    order_id: string | null
    fulfillment_id: string | null
  }
  identity: {
    idempotency_key: string
    plan_fingerprint: string
    execution_fingerprint: string
    reservation_fingerprint: string
  }
}

export type DeliveryHubExecutionTransitionValidation = {
  allowed: boolean
  reason: string
}

const DELIVERY_HUB_ALLOWED_CONTROLLED_EXECUTION_TRANSITIONS: DeliveryHubControlledExecutionTransition[] = [
  {
    from: DELIVERY_HUB_EXECUTION_STATE.planned,
    to: DELIVERY_HUB_EXECUTION_STATE.reserved,
    reason_code: "reservation_projected",
  },
  {
    from: DELIVERY_HUB_EXECUTION_STATE.reserved,
    to: DELIVERY_HUB_EXECUTION_STATE.dispatchReady,
    reason_code: "dispatch_gate_satisfied",
  },
  {
    from: DELIVERY_HUB_EXECUTION_STATE.dispatchReady,
    to: DELIVERY_HUB_EXECUTION_STATE.dispatchInflight,
    reason_code: "dispatch_started",
  },
  {
    from: DELIVERY_HUB_EXECUTION_STATE.dispatchInflight,
    to: DELIVERY_HUB_EXECUTION_STATE.resultReceived,
    reason_code: "result_normalized",
  },
  {
    from: DELIVERY_HUB_EXECUTION_STATE.resultReceived,
    to: DELIVERY_HUB_EXECUTION_STATE.applicationReady,
    reason_code: "application_projection_ready",
  },
  {
    from: DELIVERY_HUB_EXECUTION_STATE.applicationReady,
    to: DELIVERY_HUB_EXECUTION_STATE.completed,
    reason_code: "application_projection_completed",
  },
  {
    from: DELIVERY_HUB_EXECUTION_STATE.planned,
    to: DELIVERY_HUB_EXECUTION_STATE.failedBlocked,
    reason_code: "execution_blocked",
  },
  {
    from: DELIVERY_HUB_EXECUTION_STATE.reserved,
    to: DELIVERY_HUB_EXECUTION_STATE.failedBlocked,
    reason_code: "execution_blocked",
  },
  {
    from: DELIVERY_HUB_EXECUTION_STATE.dispatchReady,
    to: DELIVERY_HUB_EXECUTION_STATE.failedBlocked,
    reason_code: "execution_blocked",
  },
  {
    from: DELIVERY_HUB_EXECUTION_STATE.dispatchInflight,
    to: DELIVERY_HUB_EXECUTION_STATE.failedBlocked,
    reason_code: "execution_blocked",
  },
  {
    from: DELIVERY_HUB_EXECUTION_STATE.resultReceived,
    to: DELIVERY_HUB_EXECUTION_STATE.failedBlocked,
    reason_code: "execution_blocked",
  },
  {
    from: DELIVERY_HUB_EXECUTION_STATE.applicationReady,
    to: DELIVERY_HUB_EXECUTION_STATE.failedBlocked,
    reason_code: "execution_blocked",
  },
] as const

export function listDeliveryHubControlledExecutionTransitions(): DeliveryHubControlledExecutionTransition[] {
  return DELIVERY_HUB_ALLOWED_CONTROLLED_EXECUTION_TRANSITIONS.map((transition) => ({
    ...transition,
  }))
}

export function validateDeliveryHubExecutionStateTransition(input: {
  from: DeliveryHubExecutionState
  to: DeliveryHubExecutionState
}): DeliveryHubExecutionTransitionValidation {
  const allowedTransition = DELIVERY_HUB_ALLOWED_CONTROLLED_EXECUTION_TRANSITIONS.find(
    (transition) => transition.from === input.from && transition.to === input.to
  )

  if (!allowedTransition) {
    return {
      allowed: false,
      reason: `Transition ${input.from} -> ${input.to} is not allowed by the controlled execution contract.`,
    }
  }

  return {
    allowed: true,
    reason: `Transition ${input.from} -> ${input.to} is allowed with reason code ${allowedTransition.reason_code}.`,
  }
}

export function canStartDeliveryHubControlledExecution(state: DeliveryHubExecutionState): boolean {
  return state === DELIVERY_HUB_EXECUTION_STATE.planned
}

export function canReserveDeliveryHubControlledExecution(state: DeliveryHubExecutionState): boolean {
  return state === DELIVERY_HUB_EXECUTION_STATE.planned
}

export function canDispatchDeliveryHubControlledExecution(state: DeliveryHubExecutionState): boolean {
  return state === DELIVERY_HUB_EXECUTION_STATE.dispatchReady
}

export function canApplyDeliveryHubControlledExecution(state: DeliveryHubExecutionState): boolean {
  return state === DELIVERY_HUB_EXECUTION_STATE.applicationReady
}

export function canFinalizeDeliveryHubControlledExecution(state: DeliveryHubExecutionState): boolean {
  return state === DELIVERY_HUB_EXECUTION_STATE.applicationReady
}

export function canFailBlockedDeliveryHubControlledExecution(state: DeliveryHubExecutionState): boolean {
  return (
    state !== DELIVERY_HUB_EXECUTION_STATE.completed &&
    state !== DELIVERY_HUB_EXECUTION_STATE.failedBlocked
  )
}

export function buildDeliveryHubControlledExecutionIdentity(
  executionPlan: DeliveryHubProviderExecutionPlan
): DeliveryHubControlledExecutionIdentity {
  const planMaterial = {
    version: executionPlan.version,
    provider_code: executionPlan.provider_code,
    provider_id: executionPlan.provider_id,
    operation: executionPlan.operation,
    connection_id: executionPlan.connection_id,
    mode_code: executionPlan.mode_code,
    quote_reference: executionPlan.quote_reference,
    order: executionPlan.order,
    fulfillment: executionPlan.fulfillment,
    items: executionPlan.items,
    quote: executionPlan.outbound_request.body.quote,
    pickup_point: executionPlan.outbound_request.body.pickup_point,
    pickup_window: executionPlan.outbound_request.body.pickup_window,
  }

  const planFingerprint = createDeliveryHubControlledExecutionFingerprint({
    namespace: "deliveryhub.execution_plan",
    version: DELIVERY_HUB_CONTROLLED_EXECUTION_CONTRACT_VERSION,
    plan: planMaterial,
  })

  const executionFingerprint = createDeliveryHubControlledExecutionFingerprint({
    namespace: "deliveryhub.execution_request",
    version: DELIVERY_HUB_CONTROLLED_EXECUTION_CONTRACT_VERSION,
    method: executionPlan.outbound_request.method,
    path: executionPlan.outbound_request.path,
    plan: planMaterial,
  })

  const idempotencyKey = `deliveryhub:preview:${executionPlan.operation}:${executionFingerprint}`
  const reservationFingerprint = createDeliveryHubControlledExecutionFingerprint({
    namespace: "deliveryhub.execution_reservation",
    version: DELIVERY_HUB_CONTROLLED_EXECUTION_CONTRACT_VERSION,
    dedupe_scope: "deliveryhub:create_shipment",
    reservation_key: idempotencyKey,
    plan_fingerprint: planFingerprint,
    execution_fingerprint: executionFingerprint,
    quote_reference_id: executionPlan.quote_reference.id,
  })

  return {
    execution_reference: `dhprev_${executionFingerprint.slice(0, 16)}`,
    provider_operation_label: `${executionPlan.operation}:${executionPlan.mode_code}`,
    provider_key: DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
    provider_code: DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
    provider_id: DELIVERY_HUB_FULFILLMENT_PROVIDER_ID,
    operation: executionPlan.operation,
    idempotency_key: idempotencyKey,
    plan_fingerprint: planFingerprint,
    execution_fingerprint: executionFingerprint,
    reservation_fingerprint: reservationFingerprint,
  }
}

export function buildDeliveryHubControlledExecutionReservationDraft(input: {
  execution_plan: DeliveryHubProviderExecutionPlan
  execution_identity?: DeliveryHubControlledExecutionIdentity
}): DeliveryHubExecutionReservationDraft {
  const executionIdentity =
    input.execution_identity ?? buildDeliveryHubControlledExecutionIdentity(input.execution_plan)

  return {
    version: DELIVERY_HUB_EXECUTION_RESERVATION_DRAFT_VERSION,
    reservation_type: "deliveryhub_execution_idempotency_reservation",
    dedupe_scope: "deliveryhub:create_shipment",
    reservation_key: executionIdentity.idempotency_key,
    reservation_fingerprint: executionIdentity.reservation_fingerprint,
    execution_reference: executionIdentity.execution_reference,
    provider_key: executionIdentity.provider_key,
    operation: executionIdentity.operation,
    connection_id: input.execution_plan.connection_id,
    mode_code: input.execution_plan.mode_code,
    quote_reference_id: input.execution_plan.quote_reference.id,
    plan_fingerprint: executionIdentity.plan_fingerprint,
    execution_fingerprint: executionIdentity.execution_fingerprint,
    matched_identity_fields: [
      {
        field: "provider_key",
        value_preview: executionIdentity.provider_key,
      },
      {
        field: "connection_id",
        value_preview: input.execution_plan.connection_id,
      },
      {
        field: "mode_code",
        value_preview: input.execution_plan.mode_code,
      },
      {
        field: "quote_reference_id",
        value_preview: input.execution_plan.quote_reference.id,
      },
      {
        field: "execution_reference",
        value_preview: executionIdentity.execution_reference,
      },
      {
        field: "plan_fingerprint",
        value_preview: executionIdentity.plan_fingerprint,
      },
      {
        field: "execution_fingerprint",
        value_preview: executionIdentity.execution_fingerprint,
      },
    ],
  }
}

export function compareDeliveryHubExecutionReservationDrafts(input: {
  expected: DeliveryHubExecutionReservationDraft
  incoming: DeliveryHubExecutionReservationDraft
}): DeliveryHubExecutionReservationComparison {
  const driftReasons: DeliveryHubExecutionReservationDriftStatus[] = []

  if (input.expected.dedupe_scope !== input.incoming.dedupe_scope) {
    driftReasons.push("reservation_scope_mismatch")
  }

  if (input.expected.plan_fingerprint !== input.incoming.plan_fingerprint) {
    driftReasons.push("plan_fingerprint_mismatch")
  }

  if (input.expected.execution_fingerprint !== input.incoming.execution_fingerprint) {
    driftReasons.push("execution_fingerprint_mismatch")
  }

  if (input.expected.reservation_fingerprint !== input.incoming.reservation_fingerprint) {
    driftReasons.push("reservation_fingerprint_mismatch")
  }

  return {
    status: driftReasons.length === 0 ? "match" : "drifted",
    drift_reasons: driftReasons,
    expected_reservation_fingerprint: input.expected.reservation_fingerprint,
    incoming_reservation_fingerprint: input.incoming.reservation_fingerprint,
    expected_plan_fingerprint: input.expected.plan_fingerprint,
    incoming_plan_fingerprint: input.incoming.plan_fingerprint,
    expected_execution_fingerprint: input.expected.execution_fingerprint,
    incoming_execution_fingerprint: input.incoming.execution_fingerprint,
  }
}

export function buildDeliveryHubControlledExecutionRecordDraft(input: {
  execution_plan: DeliveryHubProviderExecutionPlan
  order?: DeliveryHubCreateFulfillmentBridgeOrder
  fulfillment?: DeliveryHubCreateFulfillmentBridgeFulfillment
  items?: DeliveryHubCreateFulfillmentBridgeItem[]
  execution_identity?: DeliveryHubControlledExecutionIdentity
  reservation_draft?: DeliveryHubExecutionReservationDraft
}): DeliveryHubControlledExecutionRecordDraft {
  const executionIdentity =
    input.execution_identity ?? buildDeliveryHubControlledExecutionIdentity(input.execution_plan)
  const reservationDraft =
    input.reservation_draft ??
    buildDeliveryHubControlledExecutionReservationDraft({
      execution_plan: input.execution_plan,
      execution_identity: executionIdentity,
    })

  return {
    version: DELIVERY_HUB_CONTROLLED_EXECUTION_CONTRACT_VERSION,
    record_type: "deliveryhub_controlled_shipment_execution",
    lifecycle: "controlled_future_orchestration",
    provider: {
      provider_key: executionIdentity.provider_key,
      provider_code: executionIdentity.provider_code,
      provider_id: executionIdentity.provider_id,
    },
    execution: executionIdentity,
    correlation: {
      connection_id: input.execution_plan.connection_id,
      mode_code: input.execution_plan.mode_code,
      quote_reference_id: input.execution_plan.quote_reference.id,
      order_id: (input.order ?? input.execution_plan.order).id,
      order_display_id: (input.order ?? input.execution_plan.order).display_id,
      fulfillment_id: (input.fulfillment ?? input.execution_plan.fulfillment).id,
      fulfillment_location_id: (input.fulfillment ?? input.execution_plan.fulfillment).location_id,
    },
    current_state: DELIVERY_HUB_EXECUTION_STATE.planned,
    allowed_transitions: listDeliveryHubControlledExecutionTransitions(),
    plan_snapshot: {
      operation: input.execution_plan.operation,
      connection_id: input.execution_plan.connection_id,
      mode_code: input.execution_plan.mode_code,
      item_count: (input.items ?? input.execution_plan.items).length,
      destination_kind: input.execution_plan.outbound_request.body.pickup_point
        ? "pickup_point"
        : "unknown",
      origin_kind:
        input.execution_plan.mode_code === "dropoff_point_to_pickup_point"
          ? "dropoff_point"
          : "fulfillment_location",
    },
    reservation: {
      dedupe_scope: reservationDraft.dedupe_scope,
      reservation_key: reservationDraft.reservation_key,
      reservation_fingerprint: reservationDraft.reservation_fingerprint,
      plan_fingerprint: reservationDraft.plan_fingerprint,
      drift_status: "in_sync",
    },
    terminality: {
      completed: false,
      blocked: false,
    },
  }
}

export function buildDeliveryHubControlledExecutionAuditDraft(input: {
  execution_plan: DeliveryHubProviderExecutionPlan
  execution_identity?: DeliveryHubControlledExecutionIdentity
  current_state?: DeliveryHubExecutionState
  event_type?: DeliveryHubExecutionAuditDraft["event_type"]
}): DeliveryHubExecutionAuditDraft {
  const executionIdentity =
    input.execution_identity ?? buildDeliveryHubControlledExecutionIdentity(input.execution_plan)
  const currentState = input.current_state ?? DELIVERY_HUB_EXECUTION_STATE.planned
  const eventType = input.event_type ?? "deliveryhub.execution.planned"

  return {
    version: DELIVERY_HUB_EXECUTION_AUDIT_DRAFT_VERSION,
    event_type: eventType,
    execution_reference: executionIdentity.execution_reference,
    current_state: currentState,
    summary: `Controlled execution ${eventType} remains a pure projection for ${input.execution_plan.mode_code}.`,
    correlation: {
      connection_id: input.execution_plan.connection_id,
      mode_code: input.execution_plan.mode_code,
      quote_reference_id: input.execution_plan.quote_reference.id,
      order_id: input.execution_plan.order.id,
      fulfillment_id: input.execution_plan.fulfillment.id,
    },
    identity: {
      idempotency_key: executionIdentity.idempotency_key,
      plan_fingerprint: executionIdentity.plan_fingerprint,
      execution_fingerprint: executionIdentity.execution_fingerprint,
      reservation_fingerprint: executionIdentity.reservation_fingerprint,
    },
  }
}

function createDeliveryHubControlledExecutionFingerprint(value: unknown): string {
  const canonicalMaterial = JSON.stringify(sortDeliveryHubControlledExecutionFingerprintMaterial(value))

  return crypto.createHash("sha256").update(canonicalMaterial).digest("hex")
}

function sortDeliveryHubControlledExecutionFingerprintMaterial(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sortDeliveryHubControlledExecutionFingerprintMaterial(entry))
  }

  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((accumulator, key) => {
        accumulator[key] = sortDeliveryHubControlledExecutionFingerprintMaterial(
          (value as Record<string, unknown>)[key]
        )
        return accumulator
      }, {})
  }

  return value
}
