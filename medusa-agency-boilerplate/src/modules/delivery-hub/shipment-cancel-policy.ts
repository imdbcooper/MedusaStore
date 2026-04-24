import { DELIVERY_HUB_PROVIDER_YANDEX } from "./constants"
import type { DeliveryConnectionRecord } from "./domain/connection"
import { YandexDeliveryClient } from "./adapters/yandex/client"
import {
  buildYandexShipmentCancelRequest,
  executeYandexShipmentCancel,
  type YandexShipmentCancelClientLike,
  type YandexShipmentCancelResult,
} from "./adapters/yandex/shipment-cancel"
import type { DeliveryHubAcceptedShipmentLifecycleSnapshot } from "./shipment-lifecycle-read-model"
import type { DeliveryHubShipmentRecord } from "./storage/shipments-repository"

export const DELIVERY_HUB_SHIPMENT_CANCEL_POLICY_VERSION = 1

export type DeliveryHubShipmentCancelBlockedReasonCode =
  | "accepted_lifecycle_required"
  | "accepted_shipment_snapshot_required"
  | "already_cancelled"
  | "terminal_status_not_cancellable"
  | "provider_not_supported"
  | "connection_required"
  | "connection_not_ready"
  | "provider_shipment_reference_required"
  | "cancel_request_unavailable"

export type DeliveryHubShipmentCancelReadiness = {
  version: typeof DELIVERY_HUB_SHIPMENT_CANCEL_POLICY_VERSION
  available: boolean
  blocked_reason_code: DeliveryHubShipmentCancelBlockedReasonCode | null
  blocked_reason: string | null
  lifecycle_classification: string | null
  accepted: boolean
  provider_code: string | null
  provider_shipment_reference_present: boolean
  status_neutral: string | null
  redacted: true
  anti_leak_confirmations: DeliveryHubShipmentCancelAntiLeakConfirmations
}

export type DeliveryHubShipmentCancelResult =
  | {
      version: typeof DELIVERY_HUB_SHIPMENT_CANCEL_POLICY_VERSION
      status: "blocked"
      provider_call_attempted: false
      blocked_reason_code: DeliveryHubShipmentCancelBlockedReasonCode
      blocked_reason: string
      lifecycle_classification: string | null
      accepted: false
      shipment: null
      provider_cancel: null
      readiness: DeliveryHubShipmentCancelReadiness
      anti_leak_confirmations: DeliveryHubShipmentCancelAntiLeakConfirmations
    }
  | {
      version: typeof DELIVERY_HUB_SHIPMENT_CANCEL_POLICY_VERSION
      status: "cancel_requested" | "already_cancelled"
      provider_call_attempted: boolean
      blocked_reason_code: null
      blocked_reason: null
      lifecycle_classification: "accepted_shipment"
      accepted: true
      shipment: DeliveryHubShipmentCancelShipmentSummary
      provider_cancel: DeliveryHubShipmentCancelProviderSummary | null
      readiness: DeliveryHubShipmentCancelReadiness
      anti_leak_confirmations: DeliveryHubShipmentCancelAntiLeakConfirmations
    }

export type DeliveryHubShipmentCancelShipmentSummary = {
  id: string
  execution_reference_preview: string | null
  connection_id: string | null
  mode_code: string | null
  accepted: true
  dispatch_status: "dispatch_accepted"
}

export type DeliveryHubShipmentCancelProviderSummary = {
  provider_code: typeof DELIVERY_HUB_PROVIDER_YANDEX
  operation: "cancel_shipment"
  attempted: boolean
  succeeded: boolean
  status_category: YandexShipmentCancelResult["status_category"]
  neutral_status: YandexShipmentCancelResult["neutral_status"]
  provider_status_code: number | null
  provider_status_present: boolean
  provider_status_normalized: string | null
  correlation_id_present: boolean
  provider_shipment_reference_present: boolean
  safe_message: string
  redacted: true
  semantics_certainty: "adapter_boundary_mocked_only"
}

export type DeliveryHubShipmentCancelAntiLeakConfirmations = {
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

export async function cancelDeliveryHubAcceptedShipment(input: {
  lifecycle: DeliveryHubAcceptedShipmentLifecycleSnapshot
  shipment: DeliveryHubShipmentRecord | null
  connection: DeliveryConnectionRecord | null
  correlation_id: string
  client?: YandexShipmentCancelClientLike
}): Promise<DeliveryHubShipmentCancelResult> {
  const readiness = resolveDeliveryHubShipmentCancelReadiness(input)

  if (!readiness.available) {
    return buildBlockedResult({
      readiness,
      lifecycle_classification: input.lifecycle?.classification ?? null,
      blocked_reason_code: readiness.blocked_reason_code ?? "accepted_lifecycle_required",
      blocked_reason: readiness.blocked_reason ?? "Shipment cancellation is blocked.",
    })
  }

  const shipment = input.shipment as DeliveryHubShipmentRecord
  const connection = input.connection as DeliveryConnectionRecord
  const providerShipmentReference = readProviderShipmentReference(shipment)
  const request = buildYandexShipmentCancelRequest({
    provider_shipment_reference: providerShipmentReference as string,
    correlation_id: input.correlation_id,
  })

  if (!request) {
    return buildBlockedResult({
      readiness: {
        ...readiness,
        available: false,
        blocked_reason_code: "cancel_request_unavailable",
        blocked_reason:
          "Accepted shipment cancellation is blocked because the Yandex cancel request could not be safely materialized.",
      },
      lifecycle_classification: input.lifecycle.classification,
      blocked_reason_code: "cancel_request_unavailable",
      blocked_reason:
        "Accepted shipment cancellation is blocked because the Yandex cancel request could not be safely materialized.",
    })
  }

  const providerCancel = await executeYandexShipmentCancel({
    client: input.client ?? new YandexDeliveryClient(connection),
    request,
  })
  const providerSummary = buildProviderCancelSummary(providerCancel)

  return {
    version: DELIVERY_HUB_SHIPMENT_CANCEL_POLICY_VERSION,
    status: providerCancel.status_category === "already_cancelled" ? "already_cancelled" : "cancel_requested",
    provider_call_attempted: true,
    blocked_reason_code: null,
    blocked_reason: null,
    lifecycle_classification: "accepted_shipment",
    accepted: true,
    shipment: buildShipmentSummary(shipment),
    provider_cancel: providerSummary,
    readiness,
    anti_leak_confirmations: buildAntiLeakConfirmations(),
  }
}

export function resolveDeliveryHubShipmentCancelReadiness(input: {
  lifecycle: DeliveryHubAcceptedShipmentLifecycleSnapshot
  shipment: DeliveryHubShipmentRecord | null
  connection: DeliveryConnectionRecord | null
}): DeliveryHubShipmentCancelReadiness {
  const statusNeutral = readNeutralStatus(input.shipment)
  const providerReference = readProviderShipmentReference(input.shipment)
  const blocked = validateCancelReadiness({
    lifecycle: input.lifecycle,
    shipment: input.shipment,
    connection: input.connection,
    status_neutral: statusNeutral,
  })

  return {
    version: DELIVERY_HUB_SHIPMENT_CANCEL_POLICY_VERSION,
    available: blocked === null,
    blocked_reason_code: blocked?.code ?? null,
    blocked_reason: blocked?.message ?? null,
    lifecycle_classification: input.lifecycle?.classification ?? null,
    accepted: input.lifecycle?.classification === "accepted_shipment" && input.lifecycle.accepted,
    provider_code: input.connection?.provider_code ?? input.lifecycle?.provider.provider_code ?? null,
    provider_shipment_reference_present: !!providerReference,
    status_neutral: statusNeutral,
    redacted: true,
    anti_leak_confirmations: buildAntiLeakConfirmations(),
  }
}

function validateCancelReadiness(input: {
  lifecycle: DeliveryHubAcceptedShipmentLifecycleSnapshot
  shipment: DeliveryHubShipmentRecord | null
  connection: DeliveryConnectionRecord | null
  status_neutral: string | null
}): { code: DeliveryHubShipmentCancelBlockedReasonCode; message: string } | null {
  if (!input.lifecycle || input.lifecycle.classification !== "accepted_shipment" || !input.lifecycle.accepted) {
    return {
      code: "accepted_lifecycle_required",
      message: "Shipment cancellation is allowed only for accepted shipment lifecycle snapshots.",
    }
  }

  if (!isAcceptedShipment(input.shipment)) {
    return {
      code: "accepted_shipment_snapshot_required",
      message: "Shipment cancellation requires a persisted accepted delivery_shipments record.",
    }
  }

  if (input.status_neutral === "cancelled") {
    return {
      code: "already_cancelled",
      message: "Shipment cancellation is blocked because the latest neutral status already indicates cancelled.",
    }
  }

  if (
    input.status_neutral === "delivered" ||
    input.status_neutral === "returned" ||
    input.status_neutral === "failed"
  ) {
    return {
      code: "terminal_status_not_cancellable",
      message: `Shipment cancellation is blocked because the latest neutral status is ${input.status_neutral}.`,
    }
  }

  if (!input.connection) {
    return {
      code: "connection_required",
      message: "Shipment cancellation requires the accepted shipment connection to be resolved before any provider call.",
    }
  }

  if (input.connection.provider_code !== DELIVERY_HUB_PROVIDER_YANDEX) {
    return {
      code: "provider_not_supported",
      message: "Shipment cancellation is currently available only for accepted Yandex Delivery shipments.",
    }
  }

  if (
    !input.connection.enabled ||
    input.connection.status !== "active" ||
    input.connection.credentials_state !== "sealed"
  ) {
    return {
      code: "connection_not_ready",
      message: "Shipment cancellation is blocked because the accepted shipment connection is not active, enabled, and sealed.",
    }
  }

  if (!readProviderShipmentReference(input.shipment)) {
    return {
      code: "provider_shipment_reference_required",
      message: "Shipment cancellation is blocked because no backend-only provider shipment reference is stored.",
    }
  }

  return null
}

function buildBlockedResult(input: {
  readiness: DeliveryHubShipmentCancelReadiness
  lifecycle_classification: string | null
  blocked_reason_code: DeliveryHubShipmentCancelBlockedReasonCode
  blocked_reason: string
}): DeliveryHubShipmentCancelResult {
  return {
    version: DELIVERY_HUB_SHIPMENT_CANCEL_POLICY_VERSION,
    status: "blocked",
    provider_call_attempted: false,
    blocked_reason_code: input.blocked_reason_code,
    blocked_reason: input.blocked_reason,
    lifecycle_classification: input.lifecycle_classification,
    accepted: false,
    shipment: null,
    provider_cancel: null,
    readiness: input.readiness,
    anti_leak_confirmations: buildAntiLeakConfirmations(),
  }
}

function buildProviderCancelSummary(
  providerCancel: YandexShipmentCancelResult
): DeliveryHubShipmentCancelProviderSummary {
  return {
    provider_code: DELIVERY_HUB_PROVIDER_YANDEX,
    operation: "cancel_shipment",
    attempted: providerCancel.attempted,
    succeeded: providerCancel.succeeded,
    status_category: providerCancel.status_category,
    neutral_status: providerCancel.neutral_status,
    provider_status_code: providerCancel.provider_status_code,
    provider_status_present: providerCancel.provider_status_present,
    provider_status_normalized: providerCancel.provider_status_normalized,
    correlation_id_present: providerCancel.correlation_id_present,
    provider_shipment_reference_present: providerCancel.provider_shipment_reference_present,
    safe_message: providerCancel.safe_message,
    redacted: true,
    semantics_certainty: providerCancel.semantics_certainty,
  }
}

function buildShipmentSummary(shipment: DeliveryHubShipmentRecord): DeliveryHubShipmentCancelShipmentSummary {
  return {
    id: shipment.id,
    execution_reference_preview: maskReference(shipment.execution_reference),
    connection_id: shipment.connection_id,
    mode_code: shipment.mode_code,
    accepted: true,
    dispatch_status: "dispatch_accepted",
  }
}

function readNeutralStatus(shipment: DeliveryHubShipmentRecord | null) {
  const status = shipment?.provider_status_summary?.neutral_status
  return typeof status === "string" && status.trim() ? status.trim() : null
}

function readProviderShipmentReference(shipment: DeliveryHubShipmentRecord | null) {
  return (
    normalizeNullableText(shipment?.metadata.provider_shipment_reference) ??
    normalizeNullableText(shipment?.response_summary.provider_shipment_reference)
  )
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

function buildAntiLeakConfirmations(): DeliveryHubShipmentCancelAntiLeakConfirmations {
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

function normalizeNullableText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function maskReference(value: string | null | undefined) {
  const normalized = normalizeNullableText(value)

  if (!normalized) {
    return null
  }

  if (normalized.length <= 6) {
    return "***"
  }

  const masked = `${normalized.slice(0, 2)}***${normalized.slice(-2)}`
  return masked === normalized ? "***" : masked
}
