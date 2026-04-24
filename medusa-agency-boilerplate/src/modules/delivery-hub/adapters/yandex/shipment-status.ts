import { isDeliveryHubError } from "../../errors"
import type { YandexDeliveryClient } from "./client"

export const YANDEX_SHIPMENT_STATUS_POLLING_VERSION = 1
export const YANDEX_SHIPMENT_STATUS_API_PATH = "/shipments/info"

export type YandexShipmentStatusNeutralStatus =
  | "accepted"
  | "in_transit"
  | "ready_for_pickup"
  | "delivered"
  | "cancelled"
  | "failed"
  | "returned"
  | "unknown"

export type YandexShipmentStatusRefreshCategory =
  | "received"
  | "unknown_provider_status"
  | "provider_rejected"
  | "auth"
  | "transport"
  | "provider_unavailable"
  | "provider_error"
  | "unknown"

export type YandexShipmentStatusRequest = {
  version: typeof YANDEX_SHIPMENT_STATUS_POLLING_VERSION
  provider_code: "yandex"
  operation: "get_shipment_status"
  path: typeof YANDEX_SHIPMENT_STATUS_API_PATH
  correlation_id: string
  request_payload: {
    shipment_id: string
  }
}

export type YandexShipmentStatusRefreshResult = {
  version: typeof YANDEX_SHIPMENT_STATUS_POLLING_VERSION
  provider_code: "yandex"
  operation: "get_shipment_status"
  attempted: boolean
  succeeded: boolean
  status_category: YandexShipmentStatusRefreshCategory
  neutral_status: YandexShipmentStatusNeutralStatus
  provider_status_known: boolean
  provider_status_present: boolean
  provider_status_normalized: string | null
  provider_status_code: number | null
  correlation_id_present: boolean
  correlation_id_masked: string | null
  provider_shipment_reference_present: boolean
  provider_shipment_reference_masked: string | null
  safe_message: string
  redacted: true
  credentials_included: false
  auth_headers_included: false
  raw_provider_request_included: false
  raw_provider_response_included: false
  raw_response_body_included: false
  raw_quote_key_included: false
  raw_provider_identifier_included: false
}

export type YandexShipmentStatusClientLike = Pick<YandexDeliveryClient, "post">

export function buildYandexShipmentStatusRequest(input: {
  provider_shipment_reference: string
  correlation_id: string
}): YandexShipmentStatusRequest | null {
  const shipmentReference = normalizeString(input.provider_shipment_reference)
  const correlationId = normalizeString(input.correlation_id)

  if (!shipmentReference || !correlationId) {
    return null
  }

  return {
    version: YANDEX_SHIPMENT_STATUS_POLLING_VERSION,
    provider_code: "yandex",
    operation: "get_shipment_status",
    path: YANDEX_SHIPMENT_STATUS_API_PATH,
    correlation_id: correlationId,
    request_payload: {
      shipment_id: shipmentReference,
    },
  }
}

export async function executeYandexShipmentStatusRefresh(input: {
  client: YandexShipmentStatusClientLike
  request: YandexShipmentStatusRequest
}): Promise<YandexShipmentStatusRefreshResult> {
  try {
    const response = await input.client.post<Record<string, unknown>>(
      input.request.path,
      input.request.request_payload,
      input.request.correlation_id
    )

    return normalizeYandexShipmentStatusSuccess({
      response,
      correlation_id: input.request.correlation_id,
    })
  } catch (error) {
    return normalizeYandexShipmentStatusFailure({
      error,
      correlation_id: input.request.correlation_id,
    })
  }
}

export function normalizeYandexShipmentStatusSuccess(input: {
  response: Record<string, unknown>
  correlation_id: string
}): YandexShipmentStatusRefreshResult {
  const status = extractProviderStatus(input.response)
  const normalizedStatus = normalizeProviderStatus(status)
  const neutralStatus = mapYandexProviderStatusToNeutralStatus(normalizedStatus)
  const statusKnown = neutralStatus !== "unknown"
  const providerShipmentReference = extractProviderShipmentReference(input.response)
  const providerCorrelationReference = extractProviderCorrelationReference(input.response)

  return {
    version: YANDEX_SHIPMENT_STATUS_POLLING_VERSION,
    provider_code: "yandex",
    operation: "get_shipment_status",
    attempted: true,
    succeeded: true,
    status_category: statusKnown ? "received" : "unknown_provider_status",
    neutral_status: neutralStatus,
    provider_status_known: statusKnown,
    provider_status_present: !!normalizedStatus,
    provider_status_normalized: statusKnown ? neutralStatus : "unknown",
    provider_status_code: null,
    correlation_id_present: !!normalizeString(input.correlation_id) || !!providerCorrelationReference,
    correlation_id_masked: maskReference(input.correlation_id ?? providerCorrelationReference),
    provider_shipment_reference_present: !!providerShipmentReference,
    provider_shipment_reference_masked: maskReference(providerShipmentReference),
    safe_message: statusKnown
      ? "Yandex shipment status was refreshed and normalized into the neutral delivery-hub status summary."
      : "Yandex shipment status was refreshed but the provider status was unknown and safely normalized as unknown.",
    redacted: true,
    credentials_included: false,
    auth_headers_included: false,
    raw_provider_request_included: false,
    raw_provider_response_included: false,
    raw_response_body_included: false,
    raw_quote_key_included: false,
    raw_provider_identifier_included: false,
  }
}

export function normalizeYandexShipmentStatusFailure(input: {
  error: unknown
  correlation_id: string
}): YandexShipmentStatusRefreshResult {
  const details = isDeliveryHubError(input.error) ? input.error.details : null
  const providerStatusCode =
    details && typeof details.provider_status === "number" ? details.provider_status : null
  const errorCategory = normalizeFailureCategory(
    details && typeof details.error_category === "string" ? details.error_category : null,
    providerStatusCode
  )

  return {
    version: YANDEX_SHIPMENT_STATUS_POLLING_VERSION,
    provider_code: "yandex",
    operation: "get_shipment_status",
    attempted: true,
    succeeded: false,
    status_category: errorCategory,
    neutral_status: "unknown",
    provider_status_known: false,
    provider_status_present: false,
    provider_status_normalized: "unknown",
    provider_status_code: providerStatusCode,
    correlation_id_present: !!normalizeString(input.correlation_id),
    correlation_id_masked: maskReference(input.correlation_id),
    provider_shipment_reference_present: false,
    provider_shipment_reference_masked: null,
    safe_message: "Yandex shipment status refresh failed and was safely normalized without changing the accepted shipment snapshot.",
    redacted: true,
    credentials_included: false,
    auth_headers_included: false,
    raw_provider_request_included: false,
    raw_provider_response_included: false,
    raw_response_body_included: false,
    raw_quote_key_included: false,
    raw_provider_identifier_included: false,
  }
}

function extractProviderStatus(response: Record<string, unknown>) {
  const data = isRecord(response.data) ? response.data : null
  const shipment = isRecord(response.shipment)
    ? response.shipment
    : data && isRecord(data.shipment)
      ? data.shipment
      : null

  return firstString([
    response.status,
    response.state,
    response.shipment_status,
    data?.status,
    data?.state,
    data?.shipment_status,
    shipment?.status,
    shipment?.state,
    shipment?.shipment_status,
  ])
}

function extractProviderShipmentReference(response: Record<string, unknown>) {
  const data = isRecord(response.data) ? response.data : null
  const shipment = isRecord(response.shipment)
    ? response.shipment
    : data && isRecord(data.shipment)
      ? data.shipment
      : null

  return firstString([
    response.shipment_id,
    response.claim_id,
    response.id,
    data?.shipment_id,
    data?.claim_id,
    data?.id,
    shipment?.shipment_id,
    shipment?.claim_id,
    shipment?.id,
  ])
}

function extractProviderCorrelationReference(response: Record<string, unknown>) {
  const data = isRecord(response.data) ? response.data : null

  return firstString([
    response.request_id,
    response.correlation_id,
    response.idempotency_key,
    data?.request_id,
    data?.correlation_id,
    data?.idempotency_key,
  ])
}

function mapYandexProviderStatusToNeutralStatus(status: string | null): YandexShipmentStatusNeutralStatus {
  switch (status) {
    case "created":
    case "new":
    case "accepted":
    case "confirmed":
    case "ready_for_approval":
      return "accepted"
    case "pickup_arrived":
    case "pickuped":
    case "picked_up":
    case "pickuped_by_courier":
    case "delivery_arrived":
    case "delivering":
    case "transporting":
    case "sorting":
    case "in_transit":
      return "in_transit"
    case "ready_for_pickup":
    case "storage_period_started":
    case "arrived_to_pickup_point":
      return "ready_for_pickup"
    case "delivered":
    case "finished":
    case "complete":
    case "completed":
      return "delivered"
    case "cancelled":
    case "canceled":
    case "cancelled_by_provider":
    case "cancelled_by_client":
      return "cancelled"
    case "failed":
    case "error":
    case "rejected":
    case "expired":
      return "failed"
    case "returned":
    case "returning":
    case "returned_to_sender":
      return "returned"
    default:
      return "unknown"
  }
}

function normalizeFailureCategory(
  category: string | null,
  providerStatusCode: number | null
): YandexShipmentStatusRefreshCategory {
  if (category === "auth" || providerStatusCode === 401 || providerStatusCode === 403) {
    return "auth"
  }

  if (category === "transport") {
    return "transport"
  }

  if (category === "provider_unavailable") {
    return "provider_unavailable"
  }

  if (category === "provider_rejected") {
    return "provider_rejected"
  }

  if (providerStatusCode && providerStatusCode >= 500) {
    return "provider_unavailable"
  }

  if (providerStatusCode && providerStatusCode >= 400) {
    return "provider_rejected"
  }

  return "provider_error"
}

function normalizeProviderStatus(value: string | null) {
  const normalized = normalizeString(value)

  return normalized
    ? normalized
        .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
        .replace(/[^a-zA-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .toLowerCase()
    : null
}

function firstString(values: unknown[]) {
  for (const value of values) {
    const normalized = normalizeString(value)
    if (normalized) {
      return normalized
    }
  }

  return null
}

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function maskReference(value: string | null | undefined) {
  const normalized = normalizeString(value)

  if (!normalized) {
    return null
  }

  if (normalized.length <= 6) {
    return "***"
  }

  const masked = `${normalized.slice(0, 2)}***${normalized.slice(-2)}`
  return masked === normalized ? "***" : masked
}
