import type { DeliveryHubAcceptedShipmentLifecycleSnapshot } from "./shipment-lifecycle-read-model"
import type { DeliveryHubExecutionLedgerRecord } from "./storage/execution-ledger-repository"
import type { DeliveryHubShipmentRecord } from "./storage/shipments-repository"

export const DELIVERY_HUB_SHIPMENT_RETRY_POLICY_VERSION = 1

export type DeliveryHubShipmentRetryBlockedReasonCode =
  | "accepted_shipment_not_retryable"
  | "neutral_status_not_retryable"
  | "execution_ledger_required"
  | "execution_ledger_state_not_retryable"
  | "execution_ledger_terminal_completed"
  | "execution_ledger_transition_history_required"
  | "execution_ledger_idempotency_required"
  | "execution_diagnostic_plan_required"
  | "lifecycle_duplicate_blocked"
  | "lifecycle_drift_blocked"
  | "persisted_accepted_shipment_exists"
  | "provider_shipment_reference_present"
  | "retry_execution_not_materialized"

export type DeliveryHubShipmentRetryReadiness = {
  version: typeof DELIVERY_HUB_SHIPMENT_RETRY_POLICY_VERSION
  available: boolean
  blocked_reason_code: DeliveryHubShipmentRetryBlockedReasonCode | null
  blocked_reason: string | null
  lifecycle_classification: string | null
  ledger_state: string | null
  terminal_completed: boolean
  terminal_blocked: boolean
  idempotency_linked: boolean
  persisted_shipment_present: boolean
  accepted_shipment_present: boolean
  provider_shipment_reference_present: boolean
  redacted: true
  anti_leak_confirmations: DeliveryHubShipmentRetryAntiLeakConfirmations
}

export type DeliveryHubShipmentRetryResult = {
  version: typeof DELIVERY_HUB_SHIPMENT_RETRY_POLICY_VERSION
  status: "blocked"
  provider_call_attempted: false
  blocked_reason_code: DeliveryHubShipmentRetryBlockedReasonCode
  blocked_reason: string
  lifecycle_classification: string | null
  readiness: DeliveryHubShipmentRetryReadiness
  retry: {
    attempted: false
    performed: false
    safe_message: string
    semantics_certainty: "readiness_only_no_live_redispatch"
    redacted: true
  }
  anti_leak_confirmations: DeliveryHubShipmentRetryAntiLeakConfirmations
}

export type DeliveryHubShipmentRetryAntiLeakConfirmations = {
  raw_provider_payloads_included: false
  raw_provider_request_included: false
  raw_provider_response_included: false
  raw_yandex_response_body_included: false
  auth_headers_included: false
  credentials_included: false
  raw_quote_key_included: false
  raw_provider_identifier_included: false
  raw_execution_secret_included: false
}

export function resolveDeliveryHubShipmentRetryReadiness(input: {
  lifecycle: DeliveryHubAcceptedShipmentLifecycleSnapshot
  shipment: DeliveryHubShipmentRecord | null
  ledger: DeliveryHubExecutionLedgerRecord | null
}): DeliveryHubShipmentRetryReadiness {
  const providerShipmentReferencePresent = hasProviderShipmentReference(input.shipment)
  const blocked = validateRetryReadiness({
    lifecycle: input.lifecycle,
    shipment: input.shipment,
    ledger: input.ledger,
    provider_shipment_reference_present: providerShipmentReferencePresent,
  })

  return {
    version: DELIVERY_HUB_SHIPMENT_RETRY_POLICY_VERSION,
    available: blocked === null,
    blocked_reason_code: blocked?.code ?? null,
    blocked_reason: blocked?.message ?? null,
    lifecycle_classification: input.lifecycle?.classification ?? null,
    ledger_state: input.ledger?.execution.current_state ?? null,
    terminal_completed: input.ledger?.execution.terminality.completed ?? false,
    terminal_blocked: input.ledger?.execution.terminality.blocked ?? false,
    idempotency_linked: hasIdempotencyLinkage(input.ledger),
    persisted_shipment_present: Boolean(input.shipment),
    accepted_shipment_present: isAcceptedShipment(input.shipment),
    provider_shipment_reference_present: providerShipmentReferencePresent,
    redacted: true,
    anti_leak_confirmations: buildAntiLeakConfirmations(),
  }
}

export async function requestDeliveryHubShipmentManualRetry(input: {
  lifecycle: DeliveryHubAcceptedShipmentLifecycleSnapshot
  shipment: DeliveryHubShipmentRecord | null
  ledger: DeliveryHubExecutionLedgerRecord | null
  correlation_id: string
}): Promise<DeliveryHubShipmentRetryResult> {
  const readiness = resolveDeliveryHubShipmentRetryReadiness(input)

  if (!readiness.available) {
    return buildBlockedResult({
      readiness,
      blocked_reason_code: readiness.blocked_reason_code ?? "execution_ledger_required",
      blocked_reason: readiness.blocked_reason ?? "Manual retry is blocked by retry readiness policy.",
      lifecycle_classification: input.lifecycle.classification,
    })
  }

  return buildBlockedResult({
    readiness: {
      ...readiness,
      available: false,
      blocked_reason_code: "retry_execution_not_materialized",
      blocked_reason:
        "Manual retry readiness passed, but live provider redispatch remains intentionally not materialized in this tranche to avoid bypassing deterministic execution identity and execution-ledger guards.",
    },
    blocked_reason_code: "retry_execution_not_materialized",
    blocked_reason:
      "Manual retry readiness passed, but live provider redispatch remains intentionally not materialized in this tranche to avoid bypassing deterministic execution identity and execution-ledger guards.",
    lifecycle_classification: input.lifecycle.classification,
  })
}

function validateRetryReadiness(input: {
  lifecycle: DeliveryHubAcceptedShipmentLifecycleSnapshot
  shipment: DeliveryHubShipmentRecord | null
  ledger: DeliveryHubExecutionLedgerRecord | null
  provider_shipment_reference_present: boolean
}): { code: DeliveryHubShipmentRetryBlockedReasonCode; message: string } | null {
  if (input.lifecycle.classification === "duplicate_blocked") {
    return {
      code: "lifecycle_duplicate_blocked",
      message:
        "Manual retry is blocked because lifecycle classification indicates duplicate execution blocking and retry must not bypass dedupe guards.",
    }
  }

  if (input.lifecycle.classification === "drift_blocked") {
    return {
      code: "lifecycle_drift_blocked",
      message:
        "Manual retry is blocked because lifecycle classification indicates execution drift and retry must not proceed until drift is reconciled.",
    }
  }

  if (isAcceptedShipment(input.shipment) || input.lifecycle.accepted) {
    return {
      code: "accepted_shipment_not_retryable",
      message:
        "Manual retry is blocked because this execution already has an accepted shipment and redispatch would risk duplicate shipment creation.",
    }
  }

  const neutralStatus = readNeutralStatus(input.shipment)
  if (
    neutralStatus === "cancelled" ||
    neutralStatus === "delivered" ||
    neutralStatus === "returned" ||
    neutralStatus === "unknown" ||
    neutralStatus === "in_transit" ||
    neutralStatus === "ready_for_pickup" ||
    neutralStatus === "accepted"
  ) {
    return {
      code: "neutral_status_not_retryable",
      message: `Manual retry is blocked because the latest neutral shipment status is ${neutralStatus}.`,
    }
  }

  if (!input.ledger) {
    return {
      code: "execution_ledger_required",
      message:
        "Manual retry is blocked because no execution-ledger record was resolved for this execution reference.",
    }
  }

  if (input.ledger.execution.terminality.completed) {
    return {
      code: "execution_ledger_terminal_completed",
      message:
        "Manual retry is blocked because execution-ledger state is terminal completed and replay is not allowed.",
    }
  }

  if (input.ledger.execution.current_state !== "failed_blocked") {
    return {
      code: "execution_ledger_state_not_retryable",
      message:
        "Manual retry is allowed only for execution-ledger state failed_blocked in this tranche.",
    }
  }

  if (!input.ledger.transitions.length) {
    return {
      code: "execution_ledger_transition_history_required",
      message:
        "Manual retry is blocked because execution-ledger transition history is missing and idempotency posture cannot be verified safely.",
    }
  }

  if (!hasIdempotencyLinkage(input.ledger)) {
    return {
      code: "execution_ledger_idempotency_required",
      message:
        "Manual retry is blocked because execution-ledger idempotency linkage is missing for this execution.",
    }
  }

  if (!hasExecutionDiagnosticPlan(input.ledger)) {
    return {
      code: "execution_diagnostic_plan_required",
      message:
        "Manual retry is blocked because the execution-ledger record does not contain a valid persisted diagnostic execution plan contour.",
    }
  }

  if (input.shipment && isAcceptedShipment(input.shipment)) {
    return {
      code: "persisted_accepted_shipment_exists",
      message:
        "Manual retry is blocked because a persisted accepted shipment already exists for this execution reference.",
    }
  }

  if (input.provider_shipment_reference_present) {
    return {
      code: "provider_shipment_reference_present",
      message:
        "Manual retry is blocked because a provider shipment reference marker is already present and may indicate shipment creation happened earlier.",
    }
  }

  return null
}

function buildBlockedResult(input: {
  readiness: DeliveryHubShipmentRetryReadiness
  blocked_reason_code: DeliveryHubShipmentRetryBlockedReasonCode
  blocked_reason: string
  lifecycle_classification: string | null
}): DeliveryHubShipmentRetryResult {
  return {
    version: DELIVERY_HUB_SHIPMENT_RETRY_POLICY_VERSION,
    status: "blocked",
    provider_call_attempted: false,
    blocked_reason_code: input.blocked_reason_code,
    blocked_reason: input.blocked_reason,
    lifecycle_classification: input.lifecycle_classification,
    readiness: input.readiness,
    retry: {
      attempted: false,
      performed: false,
      safe_message:
        "Manual retry provider redispatch is not materialized in this tranche; only readiness and blocked diagnostics are returned.",
      semantics_certainty: "readiness_only_no_live_redispatch",
      redacted: true,
    },
    anti_leak_confirmations: buildAntiLeakConfirmations(),
  }
}

function hasExecutionDiagnosticPlan(ledger: DeliveryHubExecutionLedgerRecord | null) {
  const planSnapshot = ledger?.execution?.plan_snapshot

  if (!planSnapshot || typeof planSnapshot !== "object") {
    return false
  }

  return Boolean(
    normalizeText((planSnapshot as Record<string, unknown>).operation) === "create_shipment" &&
      normalizeText((planSnapshot as Record<string, unknown>).connection_id) &&
      normalizeText((planSnapshot as Record<string, unknown>).mode_code) &&
      normalizeText((planSnapshot as Record<string, unknown>).origin_kind) &&
      normalizeText((planSnapshot as Record<string, unknown>).destination_kind) &&
      typeof (planSnapshot as Record<string, unknown>).item_count === "number"
  )
}

function hasIdempotencyLinkage(ledger: DeliveryHubExecutionLedgerRecord | null) {
  const reservation = ledger?.reservation

  return Boolean(
    reservation &&
      normalizeText(reservation.dedupe_scope) === "deliveryhub:create_shipment" &&
      normalizeText(reservation.reservation_key) &&
      normalizeText(reservation.reservation_fingerprint) &&
      normalizeText(reservation.execution_reference) &&
      normalizeText(reservation.plan_fingerprint) &&
      normalizeText(reservation.execution_fingerprint)
  )
}

function hasProviderShipmentReference(shipment: DeliveryHubShipmentRecord | null) {
  return Boolean(
    shipment?.provider_shipment_reference_present ||
      normalizeText(shipment?.metadata.provider_shipment_reference) ||
      normalizeText(shipment?.response_summary.provider_shipment_reference)
  )
}

function readNeutralStatus(shipment: DeliveryHubShipmentRecord | null) {
  return normalizeText(shipment?.provider_status_summary?.neutral_status)
}

function isAcceptedShipment(shipment: DeliveryHubShipmentRecord | null): shipment is DeliveryHubShipmentRecord {
  return Boolean(
    shipment &&
      shipment.outcome === "accepted" &&
      shipment.status === "dispatch_accepted" &&
      shipment.accepted &&
      shipment.succeeded
  )
}

function normalizeText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function buildAntiLeakConfirmations(): DeliveryHubShipmentRetryAntiLeakConfirmations {
  return {
    raw_provider_payloads_included: false,
    raw_provider_request_included: false,
    raw_provider_response_included: false,
    raw_yandex_response_body_included: false,
    auth_headers_included: false,
    credentials_included: false,
    raw_quote_key_included: false,
    raw_provider_identifier_included: false,
    raw_execution_secret_included: false,
  }
}
