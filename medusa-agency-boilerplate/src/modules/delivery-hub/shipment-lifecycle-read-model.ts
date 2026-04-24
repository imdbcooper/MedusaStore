import type {
  DeliveryHubControlledFulfillmentExecutionBlockReasonCode,
  DeliveryHubControlledFulfillmentExecutionResult,
} from "./fulfillment-execution-seam"
import type { DeliveryHubExecutionLedgerRecord } from "./storage/execution-ledger-repository"
import type { DeliveryHubShipmentRecord } from "./storage/shipments-repository"

export const DELIVERY_HUB_ACCEPTED_SHIPMENT_LIFECYCLE_READ_MODEL_VERSION = 1

export type DeliveryHubAcceptedShipmentLifecycleClassification =
  | "accepted_shipment"
  | "absent"
  | "failed_dispatch"
  | "provider_failed"
  | "replay_blocked"
  | "failed_blocked"
  | "duplicate_blocked"
  | "drift_blocked"
  | "blocked_before_acceptance"
  | "not_accepted"

export type DeliveryHubAcceptedShipmentLifecycleSnapshot = {
  version: typeof DELIVERY_HUB_ACCEPTED_SHIPMENT_LIFECYCLE_READ_MODEL_VERSION
  classification: DeliveryHubAcceptedShipmentLifecycleClassification
  accepted: boolean
  safe: true
  shipment: DeliveryHubAcceptedShipmentLifecycleShipmentSnapshot | null
  provider: {
    provider_code: string | null
    mode_code: string | null
    dispatch_status: string | null
    dispatch_outcome: string | null
    provider_shipment_reference_present: boolean
    provider_correlation_reference_present: boolean
  }
  dispatch: {
    attempted: boolean
    accepted: boolean
    succeeded: boolean
    outcome: "not_attempted" | "accepted" | "failed"
    result_decision: string | null
    blocked_reason_code: DeliveryHubControlledFulfillmentExecutionBlockReasonCode | null
  }
  ledger: {
    linked: boolean
    state: string | null
    terminal_completed: boolean
    terminal_blocked: boolean
    execution_reference_preview: string | null
    idempotency_key_preview: string | null
    transition_count: number
    audit_event_count: number
  }
  context: {
    connection_id: string | null
    order_id: string | null
    fulfillment_id: string | null
    cart_id: string | null
    shipping_option_id: string | null
    location_id: string | null
    quote_reference: {
      id: string | null
      version: number | null
    }
    correlation_id_present: boolean
  }
  timestamps: {
    created_at: string | null
    updated_at: string | null
  }
  anti_leak_confirmations: {
    raw_provider_payloads_included: false
    auth_headers_included: false
    credentials_included: false
    raw_yandex_response_body_included: false
    quote_key_included: false
  }
}

export type DeliveryHubAcceptedShipmentLifecycleShipmentSnapshot = {
  id: string
  execution_reference_preview: string
  provider_code: string
  connection_id: string | null
  mode_code: string | null
  outcome: "accepted"
  status: "dispatch_accepted"
  accepted: true
  succeeded: true
  provider_shipment_reference_present: boolean
  provider_correlation_reference_present: boolean
  label_document_present: boolean
  attachment_document_present: boolean
  created_at: string
  updated_at: string
}

export function buildDeliveryHubAcceptedShipmentLifecycleSnapshot(input: {
  shipment?: DeliveryHubShipmentRecord | null
  ledger?: DeliveryHubExecutionLedgerRecord | null
  controlled_execution?: DeliveryHubControlledFulfillmentExecutionResult | null
}): DeliveryHubAcceptedShipmentLifecycleSnapshot {
  const shipment = input.shipment ?? null
  const ledger = input.ledger ?? null
  const controlledExecution = input.controlled_execution ?? null
  const classification = classifyDeliveryHubAcceptedShipmentLifecycle({
    shipment,
    ledger,
    controlled_execution: controlledExecution,
  })
  const acceptedShipment = isAcceptedShipmentRecord(shipment)
  const exposesAcceptedShipment = classification === "accepted_shipment" && acceptedShipment
  const executionReference =
    shipment?.execution_reference ??
    controlledExecution?.execution_identity.provider_operation_reference ??
    ledger?.execution.execution.execution_reference ??
    null
  const idempotencyKey =
    shipment?.idempotency_key ??
    controlledExecution?.execution_identity.idempotency_key_preview ??
    ledger?.reservation.reservation_key ??
    null

  return {
    version: DELIVERY_HUB_ACCEPTED_SHIPMENT_LIFECYCLE_READ_MODEL_VERSION,
    classification,
    accepted: classification === "accepted_shipment",
    safe: true,
    shipment: exposesAcceptedShipment ? buildAcceptedShipmentSnapshot(shipment) : null,
    provider: {
      provider_code:
        shipment?.provider_code ?? controlledExecution?.connection.provider_code ?? null,
      mode_code:
        shipment?.mode_code ?? controlledExecution?.dispatch_preparation.mode_code ?? null,
      dispatch_status: shipment?.status ?? null,
      dispatch_outcome: shipment?.outcome ?? controlledExecution?.dispatch_result.outcome ?? null,
      provider_shipment_reference_present:
        shipment?.provider_shipment_reference_present ??
        controlledExecution?.provider_dispatch_result?.provider_shipment_reference_present ??
        false,
      provider_correlation_reference_present:
        shipment?.provider_correlation_reference_present ??
        Boolean(controlledExecution?.provider_dispatch_result?.correlation_id_masked),
    },
    dispatch: {
      attempted: controlledExecution?.dispatch_result.attempted ?? Boolean(shipment),
      accepted: exposesAcceptedShipment,
      succeeded: exposesAcceptedShipment,
      outcome: controlledExecution?.dispatch_result.outcome ?? shipmentOutcomeToDispatchOutcome(shipment),
      result_decision: controlledExecution?.result_decision ?? null,
      blocked_reason_code: controlledExecution?.blocked_reason_code ?? null,
    },
    ledger: {
      linked: Boolean(ledger) || Boolean(shipment?.metadata.ledger_persistence_performed),
      state: ledger?.execution.current_state ?? null,
      terminal_completed: ledger?.execution.terminality.completed ?? false,
      terminal_blocked: ledger?.execution.terminality.blocked ?? false,
      execution_reference_preview: buildSafeReferencePreview(executionReference),
      idempotency_key_preview: buildSafeReferencePreview(idempotencyKey),
      transition_count: ledger?.transitions.length ?? 0,
      audit_event_count: ledger?.audit_events.length ?? 0,
    },
    context: {
      connection_id: shipment?.connection_id ?? controlledExecution?.handoff.connection_id ?? null,
      order_id: shipment?.order_id ?? controlledExecution?.handoff.references?.order_id ?? null,
      fulfillment_id:
        shipment?.fulfillment_id ?? controlledExecution?.handoff.references?.fulfillment_id ?? null,
      cart_id: shipment?.cart_id ?? controlledExecution?.handoff.references?.cart_id ?? null,
      shipping_option_id:
        shipment?.shipping_option_id ?? controlledExecution?.handoff.references?.shipping_option_id ?? null,
      location_id: shipment?.location_id ?? controlledExecution?.handoff.references?.location_id ?? null,
      quote_reference: {
        id: shipment?.quote_reference_id ?? controlledExecution?.handoff.quote_reference_summary.id ?? null,
        version:
          shipment?.quote_reference_version ??
          controlledExecution?.handoff.quote_reference_summary.version ??
          null,
      },
      correlation_id_present: Boolean(shipment?.correlation_id ?? controlledExecution?.handoff.correlation_id),
    },
    timestamps: {
      created_at: exposesAcceptedShipment ? shipment.created_at : null,
      updated_at: exposesAcceptedShipment ? shipment.updated_at : null,
    },
    anti_leak_confirmations: {
      raw_provider_payloads_included: false,
      auth_headers_included: false,
      credentials_included: false,
      raw_yandex_response_body_included: false,
      quote_key_included: false,
    },
  }
}

export function classifyDeliveryHubAcceptedShipmentLifecycle(input: {
  shipment?: DeliveryHubShipmentRecord | null
  ledger?: DeliveryHubExecutionLedgerRecord | null
  controlled_execution?: DeliveryHubControlledFulfillmentExecutionResult | null
}): DeliveryHubAcceptedShipmentLifecycleClassification {
  const shipment = input.shipment ?? null
  const controlledExecution = input.controlled_execution ?? null
  const blockedReasonCode = controlledExecution?.blocked_reason_code ?? null
  const shipmentOutcome = shipment ? shipment.outcome : null
  const shipmentStatus = shipment ? shipment.status : null

  if (blockedReasonCode === "execution_ledger_replay_blocked") {
    return "replay_blocked"
  }

  if (blockedReasonCode === "execution_ledger_failed_blocked") {
    return "failed_blocked"
  }

  if (blockedReasonCode === "execution_ledger_duplicate_execution") {
    return "duplicate_blocked"
  }

  if (blockedReasonCode === "execution_ledger_drift_detected") {
    return "drift_blocked"
  }

  if (isAcceptedShipmentRecord(shipment)) {
    return "accepted_shipment"
  }

  if (shipmentOutcome === "failed" || shipmentStatus === "dispatch_failed") {
    return "failed_dispatch"
  }

  if (controlledExecution?.dispatch_result.outcome === "failed") {
    return "provider_failed"
  }

  if (controlledExecution?.status === "blocked" || controlledExecution?.blocked_reason_code) {
    return "blocked_before_acceptance"
  }

  if (!shipment) {
    return "absent"
  }

  return "not_accepted"
}

function buildAcceptedShipmentSnapshot(
  shipment: DeliveryHubShipmentRecord
): DeliveryHubAcceptedShipmentLifecycleShipmentSnapshot {
  return {
    id: shipment.id,
    execution_reference_preview: buildSafeReferencePreview(shipment.execution_reference) ?? "present",
    provider_code: shipment.provider_code,
    connection_id: shipment.connection_id,
    mode_code: shipment.mode_code,
    outcome: "accepted",
    status: "dispatch_accepted",
    accepted: true,
    succeeded: true,
    provider_shipment_reference_present: shipment.provider_shipment_reference_present,
    provider_correlation_reference_present: shipment.provider_correlation_reference_present,
    label_document_present: shipment.label_document_present,
    attachment_document_present: shipment.attachment_document_present,
    created_at: shipment.created_at,
    updated_at: shipment.updated_at,
  }
}

function isAcceptedShipmentRecord(
  shipment: DeliveryHubShipmentRecord | null
): shipment is DeliveryHubShipmentRecord {
  return Boolean(
    shipment &&
      shipment.outcome === "accepted" &&
      shipment.status === "dispatch_accepted" &&
      shipment.accepted &&
      shipment.succeeded
  )
}

function shipmentOutcomeToDispatchOutcome(
  shipment: DeliveryHubShipmentRecord | null
): "not_attempted" | "accepted" | "failed" {
  if (!shipment) {
    return "not_attempted"
  }

  return shipment.outcome === "accepted" ? "accepted" : "failed"
}

function buildSafeReferencePreview(value: string | null | undefined): string | null {
  const normalized = typeof value === "string" && value.trim() ? value.trim() : null

  if (!normalized) {
    return null
  }

  if (normalized.length <= 6) {
    return "***"
  }

  const maskedPreview = `${normalized.slice(0, 2)}***${normalized.slice(-2)}`

  return maskedPreview === normalized ? "***" : maskedPreview
}
