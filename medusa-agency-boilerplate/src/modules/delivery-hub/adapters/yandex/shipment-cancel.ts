import { isDeliveryHubError } from "../../errors"
import type { YandexDeliveryClient } from "./client"

export const YANDEX_SHIPMENT_CANCEL_VERSION = 1

/**
 * Conservative direct-Yandex adapter seam for shipment cancellation.
 *
 * The local repository already models direct Yandex create/status paths but does not contain an
 * authoritative provider contract for cancellation. This path intentionally stays adapter-local,
 * covered by mocked no-network tests, and must be live-validated against Yandex documentation or a
 * test account before any production guarantee is claimed.
 */
export const YANDEX_SHIPMENT_CANCEL_API_PATH = "/shipments/cancel"

export type YandexShipmentCancelStatusCategory =
  | "cancelled"
  | "already_cancelled"
  | "provider_rejected"
  | "auth"
  | "transport"
  | "provider_unavailable"
  | "provider_error"
  | "unknown"

export type YandexShipmentCancelRequest = {
  version: typeof YANDEX_SHIPMENT_CANCEL_VERSION
  provider_code: "yandex"
  operation: "cancel_shipment"
  path: typeof YANDEX_SHIPMENT_CANCEL_API_PATH
  correlation_id: string
  request_payload: {
    shipment_id: string
  }
  semantics_certainty: "adapter_boundary_mocked_only"
}

export type YandexShipmentCancelResult = {
  version: typeof YANDEX_SHIPMENT_CANCEL_VERSION
  provider_code: "yandex"
  operation: "cancel_shipment"
  attempted: boolean
  succeeded: boolean
  status_category: YandexShipmentCancelStatusCategory
  neutral_status: "cancelled" | "unknown"
  provider_status_code: number | null
  provider_status_present: boolean
  provider_status_normalized: string | null
  correlation_id_present: boolean
  correlation_id_masked: string | null
  provider_shipment_reference_present: boolean
  provider_shipment_reference_masked: string | null
  safe_message: string
  redacted: true
  semantics_certainty: "adapter_boundary_mocked_only"
  credentials_included: false
  auth_headers_included: false
  raw_provider_request_included: false
  raw_provider_response_included: false
  raw_response_body_included: false
  raw_quote_key_included: false
  raw_provider_identifier_included: false
}

export type YandexShipmentCancelClientLike = Pick<YandexDeliveryClient, "post">

export function buildYandexShipmentCancelRequest(input: {
  provider_shipment_reference: string
  correlation_id: string
}): YandexShipmentCancelRequest | null {
  const shipmentReference = normalizeString(input.provider_shipment_reference)
  const correlationId = normalizeString(input.correlation_id)

  if (!shipmentReference || !correlationId) {
    return null
  }

  return {
    version: YANDEX_SHIPMENT_CANCEL_VERSION,
    provider_code: "yandex",
    operation: "cancel_shipment",
    path: YANDEX_SHIPMENT_CANCEL_API_PATH,
    correlation_id: correlationId,
    request_payload: {
      shipment_id: shipmentReference,
    },
    semantics_certainty: "adapter_boundary_mocked_only",
  }
}

export async function executeYandexShipmentCancel(input: {
  client: YandexShipmentCancelClientLike
  request: YandexShipmentCancelRequest
}): Promise<YandexShipmentCancelResult> {
  try {
    const response = await input.client.post<Record<string, unknown>>(
      input.request.path,
      input.request.request_payload,
      input.request.correlation_id
    )

    return normalizeYandexShipmentCancelSuccess({
      response,
      correlation_id: input.request.correlation_id,
    })
  } catch (error) {
    return normalizeYandexShipmentCancelFailure({
      error,
      correlation_id: input.request.correlation_id,
    })
  }
}

export function normalizeYandexShipmentCancelSuccess(input: {
  response: Record<string, unknown>
  correlation_id: string
}): YandexShipmentCancelResult {
  const status = extractProviderStatus(input.response)
  const normalizedStatus = normalizeProviderStatus(status)
  const providerShipmentReference = extractProviderShipmentReference(input.response)
  const providerCorrelationReference = extractProviderCorrelationReference(input.response)
  const alreadyCancelled = isAlreadyCancelledStatus(normalizedStatus)

  return {
    version: YANDEX_SHIPMENT_CANCEL_VERSION,
    provider_code: "yandex",
    operation: "cancel_shipment",
    attempted: true,
    succeeded: true,
    status_category: alreadyCancelled ? "already_cancelled" : "cancelled",
    neutral_status: "cancelled",
    provider_status_code: null,
    provider_status_present: !!normalizedStatus,
    provider_status_normalized: alreadyCancelled ? "cancelled" : normalizedStatus ?? "cancelled",
    correlation_id_present: !!normalizeString(input.correlation_id) || !!providerCorrelationReference,
    correlation_id_masked: maskReference(input.correlation_id ?? providerCorrelationReference),
    provider_shipment_reference_present: !!providerShipmentReference,
    provider_shipment_reference_masked: maskReference(providerShipmentReference),
    safe_message: alreadyCancelled
      ? "Yandex shipment cancellation returned an already-cancelled posture and was normalized without raw provider payloads."
      : "Yandex shipment cancellation was accepted by the adapter boundary and normalized without raw provider payloads.",
    redacted: true,
    semantics_certainty: "adapter_boundary_mocked_only",
    credentials_included: false,
    auth_headers_included: false,
    raw_provider_request_included: false,
    raw_provider_response_included: false,
    raw_response_body_included: false,
    raw_quote_key_included: false,
    raw_provider_identifier_included: false,
  }
}

export function normalizeYandexShipmentCancelFailure(input: {
  error: unknown
  correlation_id: string
}): YandexShipmentCancelResult {
  const details = isDeliveryHubError(input.error) ? input.error.details : null
  const providerStatusCode =
    details && typeof details.provider_status === "number" ? details.provider_status : null
  const errorCategory = normalizeFailureCategory(
    details && typeof details.error_category === "string" ? details.error_category : null,
    providerStatusCode
  )

  return {
    version: YANDEX_SHIPMENT_CANCEL_VERSION,
    provider_code: "yandex",
    operation: "cancel_shipment",
    attempted: true,
    succeeded: false,
    status_category: errorCategory,
    neutral_status: "unknown",
    provider_status_code: providerStatusCode,
    provider_status_present: false,
    provider_status_normalized: null,
    correlation_id_present: !!normalizeString(input.correlation_id),
    correlation_id_masked: maskReference(input.correlation_id),
    provider_shipment_reference_present: false,
    provider_shipment_reference_masked: null,
    safe_message: "Yandex shipment cancellation failed and was safely normalized without raw provider payloads.",
    redacted: true,
    semantics_certainty: "adapter_boundary_mocked_only",
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

function isAlreadyCancelledStatus(status: string | null) {
  return status === "cancelled" || status === "canceled" || status === "already_cancelled"
}

function normalizeFailureCategory(
  category: string | null,
  providerStatusCode: number | null
): YandexShipmentCancelStatusCategory {
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
