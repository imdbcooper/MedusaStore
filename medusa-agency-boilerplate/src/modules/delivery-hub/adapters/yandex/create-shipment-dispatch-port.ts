import { DELIVERY_HUB_MODE_CODE, DELIVERY_HUB_PROVIDER_YANDEX } from "../../constants"
import { isDeliveryHubError } from "../../errors"
import type { YandexDeliveryClient } from "./client"
import { YANDEX_DELIVERY_SHIPMENT_API_PATH } from "./endpoints"
import {
  materializeYandexCreateShipmentPayloadPreview,
  type YandexCreateShipmentMaterializerMode,
  type YandexCreateShipmentPayloadMaterializerBlockedResult,
  type YandexCreateShipmentPayloadMaterializerInput,
} from "./create-shipment-materializer"

export const YANDEX_CREATE_SHIPMENT_DISPATCH_PORT_VERSION = 1
export const YANDEX_CREATE_SHIPMENT_API_PATH = YANDEX_DELIVERY_SHIPMENT_API_PATH.create

export type YandexCreateShipmentDispatchPortBlockedReasonCode =
  | "execution_gate_disabled"
  | "dispatch_runtime_blocked"
  | "dispatch_port_not_implemented"
  | "provider_not_supported"
  | "mode_not_supported"

export type YandexCreateShipmentDispatchPortSummary = {
  provider_code: typeof DELIVERY_HUB_PROVIDER_YANDEX
  operation: "create_shipment"
  available: boolean
  implemented: boolean
  execution_gate_enabled: boolean
  dispatch_attempted: boolean
  dispatch_blocked: boolean
  blocked_reason_code: YandexCreateShipmentDispatchPortBlockedReasonCode | null
  blocked_reason: string | null
  preview_materialization_available: boolean
  preview_materialization_ready: boolean
  preview_mode: "preview_only"
  supported_mode: boolean
  mode_code: YandexCreateShipmentMaterializerMode | string | null
}

export type YandexCreateShipmentDispatchPortContract = {
  version: typeof YANDEX_CREATE_SHIPMENT_DISPATCH_PORT_VERSION
  provider_code: typeof DELIVERY_HUB_PROVIDER_YANDEX
  operation: "create_shipment"
  summary: YandexCreateShipmentDispatchPortSummary
}

export type YandexCreateShipmentDispatchRequestPayload = {
  source: {
    pickup_point_id?: string
    warehouse_id?: string
    interval_utc?: {
      from: string
      to: string
    }
  }
  destination: {
    pickup_point_id: string
  }
  recipient: {
    full_name: string
    email?: string
    phone?: string
  }
  items: Array<{
    title?: string
    sku?: string
    quantity: number
    price?: number
    assessed_unit_price?: number
    currency?: string
    weight?: number
  }>
  places: Array<{
    reference?: string
    weight?: number
    dimensions?: {
      length?: number
      width?: number
      height?: number
    }
    items: Array<{
      title?: string
      sku?: string
      quantity: number
      price?: number
      assessed_unit_price?: number
      currency?: string
      weight?: number
    }>
  }>
  contact?: {
    email?: string
    phone?: string
  }
  route?: {
    destination?: {
      address?: {
        country_code?: string
        locality?: string
        region?: string
        postal_code?: string
        address_line?: string
      }
    }
  }
  external_order_id?: string
  order_reference?: string
  display_order_id?: string
  currency?: string
  total_assessed_value?: number
  comment?: string
}

export type YandexCreateShipmentDispatchRequest = {
  version: typeof YANDEX_CREATE_SHIPMENT_DISPATCH_PORT_VERSION
  provider_code: typeof DELIVERY_HUB_PROVIDER_YANDEX
  operation: "create_shipment"
  mode_code: YandexCreateShipmentMaterializerMode
  path: typeof YANDEX_CREATE_SHIPMENT_API_PATH
  correlation_id: string
  request_payload: YandexCreateShipmentDispatchRequestPayload
}

export type YandexCreateShipmentDispatchRequestBuildResult =
  | {
      status: "ready"
      request: YandexCreateShipmentDispatchRequest
      blocked_reasons: []
    }
  | {
      status: "blocked"
      request: null
      blocked_reasons: YandexCreateShipmentPayloadMaterializerBlockedResult["blocked_reasons"]
    }

export type YandexCreateShipmentDispatchClientLike = Pick<YandexDeliveryClient, "post">

export type YandexCreateShipmentDispatchStatusCategory =
  | "accepted"
  | "provider_rejected"
  | "auth"
  | "transport"
  | "provider_unavailable"
  | "provider_error"
  | "unknown"

const YANDEX_CREATE_SHIPMENT_BACKEND_REFERENCE_SYMBOL = Symbol(
  "deliveryHubYandexCreateShipmentBackendProviderReference"
)

type YandexCreateShipmentDispatchResultWithBackendReference = YandexCreateShipmentDispatchResult & {
  [YANDEX_CREATE_SHIPMENT_BACKEND_REFERENCE_SYMBOL]?: string | null
}

export type YandexCreateShipmentDispatchResult = {
  version: typeof YANDEX_CREATE_SHIPMENT_DISPATCH_PORT_VERSION
  provider_code: typeof DELIVERY_HUB_PROVIDER_YANDEX
  operation: "create_shipment"
  attempted: boolean
  accepted: boolean
  succeeded: boolean
  status_category: YandexCreateShipmentDispatchStatusCategory
  provider_status_code: number | null
  correlation_id_present: boolean
  correlation_id_masked: string | null
  provider_shipment_reference_present: boolean
  provider_shipment_reference_masked: string | null
  label_available: boolean
  documents_available: boolean
  blocked_reason_code: null
  blocked_reason: null
  error_code: string | null
  redacted: true
  credentials_included: false
  auth_headers_included: false
  raw_provider_request_included: false
  raw_provider_response_included: false
  raw_execution_token_included: false
  raw_quote_key_included: false
}

export function readYandexCreateShipmentDispatchBackendProviderShipmentReference(
  result: YandexCreateShipmentDispatchResult | null | undefined
): string | null {
  return normalizeString(
    (result as YandexCreateShipmentDispatchResultWithBackendReference | null | undefined)?.[
      YANDEX_CREATE_SHIPMENT_BACKEND_REFERENCE_SYMBOL
    ]
  )
}

export function buildYandexCreateShipmentDispatchPortContract(input: {
  execution_gate_enabled: boolean
  preview_available: boolean
  preview_ready: boolean
  mode_code: YandexCreateShipmentMaterializerMode | string | null
  supported_mode: boolean
  provider_supported: boolean
  runtime_dispatch_implemented?: boolean
  dispatch_attempted?: boolean
  dispatch_blocked?: boolean
}): YandexCreateShipmentDispatchPortContract {
  const runtimeDispatchImplemented = input.runtime_dispatch_implemented ?? false
  const dispatchAttempted = input.dispatch_attempted ?? false
  const dispatchBlocked = input.dispatch_blocked ?? true
  const blockedReason =
    dispatchBlocked
      ? resolveBlockedReason({
          execution_gate_enabled: input.execution_gate_enabled,
          supported_mode: input.supported_mode,
          provider_supported: input.provider_supported,
          runtime_dispatch_implemented: runtimeDispatchImplemented,
        })
      : null

  return {
    version: YANDEX_CREATE_SHIPMENT_DISPATCH_PORT_VERSION,
    provider_code: DELIVERY_HUB_PROVIDER_YANDEX,
    operation: "create_shipment",
    summary: {
      provider_code: DELIVERY_HUB_PROVIDER_YANDEX,
      operation: "create_shipment",
      available:
        input.provider_supported &&
        input.supported_mode &&
        input.execution_gate_enabled &&
        runtimeDispatchImplemented,
      implemented: runtimeDispatchImplemented,
      execution_gate_enabled: input.execution_gate_enabled,
      dispatch_attempted: dispatchAttempted,
      dispatch_blocked: dispatchBlocked,
      blocked_reason_code: blockedReason?.code ?? null,
      blocked_reason: blockedReason?.message ?? null,
      preview_materialization_available: input.preview_available,
      preview_materialization_ready: input.preview_ready,
      preview_mode: "preview_only",
      supported_mode: input.supported_mode,
      mode_code: input.mode_code,
    },
  }
}

export function buildYandexCreateShipmentDispatchRequest(
  input: YandexCreateShipmentPayloadMaterializerInput
): YandexCreateShipmentDispatchRequestBuildResult {
  const preview = materializeYandexCreateShipmentPayloadPreview(input)

  if (preview.status === "blocked") {
    return {
      status: "blocked",
      request: null,
      blocked_reasons: preview.blocked_reasons,
    }
  }

  const mode = normalizeMode(input.mode)
  const correlationId = normalizeString(input.correlation_id) ?? buildFallbackCorrelationId(input)

  return {
    status: "ready",
    blocked_reasons: [],
    request: {
      version: YANDEX_CREATE_SHIPMENT_DISPATCH_PORT_VERSION,
      provider_code: DELIVERY_HUB_PROVIDER_YANDEX,
      operation: "create_shipment",
      mode_code: mode,
      path: YANDEX_CREATE_SHIPMENT_API_PATH,
      correlation_id: correlationId,
      request_payload: buildExecutableRequestPayload(input, mode),
    },
  }
}

export async function executeYandexCreateShipmentDispatch(input: {
  client: YandexCreateShipmentDispatchClientLike
  request: YandexCreateShipmentDispatchRequest
}): Promise<YandexCreateShipmentDispatchResult> {
  try {
    const response = await input.client.post<Record<string, unknown>>(
      input.request.path,
      input.request.request_payload as Record<string, unknown>,
      input.request.correlation_id
    )

    return normalizeYandexCreateShipmentDispatchSuccess({
      correlation_id: input.request.correlation_id,
      response,
    })
  } catch (error) {
    return normalizeYandexCreateShipmentDispatchFailure({
      correlation_id: input.request.correlation_id,
      error,
    })
  }
}

function resolveBlockedReason(input: {
  execution_gate_enabled: boolean
  supported_mode: boolean
  provider_supported: boolean
  runtime_dispatch_implemented: boolean
}) {
  if (!input.provider_supported) {
    return {
      code: "provider_not_supported" as const,
      message:
        "Direct Yandex create_shipment dispatch port is not available because the controlled execution seam is not on the Yandex provider contour.",
    }
  }

  if (!input.supported_mode) {
    return {
      code: "mode_not_supported" as const,
      message:
        "Direct Yandex create_shipment dispatch port is not available because the committed Delivery Hub mode is outside the currently supported direct Yandex contour.",
    }
  }

  if (!input.execution_gate_enabled) {
    return {
      code: "execution_gate_disabled" as const,
      message:
        "Direct Yandex create_shipment dispatch port remains runtime-blocked because DELIVERY_HUB_SHIPMENT_EXECUTION_ENABLED is disabled.",
    }
  }

  if (input.runtime_dispatch_implemented) {
    return {
      code: "dispatch_runtime_blocked" as const,
      message:
        "Direct Yandex create_shipment executable layer is materialized, but this controlled execution path remains blocked by readiness, payload materialization, or provider-origin context prerequisites.",
    }
  }

  return {
    code: "dispatch_port_not_implemented" as const,
    message:
      "Direct Yandex create_shipment dispatch port is not implemented for the current controlled execution contour.",
  }
}

function buildExecutableRequestPayload(
  input: YandexCreateShipmentPayloadMaterializerInput,
  mode: YandexCreateShipmentMaterializerMode
): YandexCreateShipmentDispatchRequestPayload {
  const orderReference =
    normalizeString(input.order?.external_order_reference) ?? normalizeString(input.order?.order_id)
  const recipientName = buildRecipientFullName(input)
  const normalizedPackages = normalizeExecutablePackages(input.packages)
  const warehouseOriginId =
    input.provider_origin_dispatch_context?.mode_code === DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint
      ? normalizeString(input.provider_origin_dispatch_context.provider_warehouse_id)
      : null
  const dropoffOriginPointId =
    input.provider_origin_dispatch_context?.mode_code === DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint
      ? normalizeString(input.provider_origin_dispatch_context.origin_point_id)
      : null

  const source: YandexCreateShipmentDispatchRequestPayload["source"] =
    mode === DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint
      ? {
          warehouse_id: warehouseOriginId ?? "",
        }
      : {
          pickup_point_id: dropoffOriginPointId ?? "",
        }

  if (mode === DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint) {
    const interval = normalizePickupInterval(input.pickup_interval_utc)

    if (interval) {
      source.interval_utc = interval
    }
  }

  return {
    source,
    destination: {
      pickup_point_id: normalizeString(input.destination_pickup_point?.provider_point_id) ?? "",
    },
    recipient: {
      full_name: recipientName,
      email: normalizeString(input.recipient?.email) ?? undefined,
      phone: normalizeString(input.recipient?.phone) ?? undefined,
    },
    items: normalizedPackages.flatMap((pkg) => pkg.items),
    places: normalizedPackages,
    contact: {
      email: normalizeString(input.recipient?.email) ?? undefined,
      phone: normalizeString(input.recipient?.phone) ?? undefined,
    },
    route: {
      destination: {
        address: {
          country_code: normalizeString(input.address?.country_code)?.toUpperCase() ?? undefined,
          locality: normalizeString(input.address?.city) ?? undefined,
          region: normalizeString(input.address?.region) ?? undefined,
          postal_code: normalizeString(input.address?.postal_code) ?? undefined,
          address_line: normalizeString(input.address?.address_line) ?? undefined,
        },
      },
    },
    external_order_id: normalizeString(input.order?.order_id) ?? undefined,
    order_reference: orderReference ?? undefined,
    display_order_id:
      input.order?.display_id === null || input.order?.display_id === undefined
        ? undefined
        : String(input.order.display_id),
    currency: normalizeString(input.order?.currency_code)?.toUpperCase() ?? undefined,
    total_assessed_value:
      typeof input.order?.total === "number" && Number.isFinite(input.order.total)
        ? input.order.total
        : undefined,
    comment: buildRequestComment(input),
  }
}

function normalizeYandexCreateShipmentDispatchSuccess(input: {
  correlation_id: string
  response: Record<string, unknown>
}): YandexCreateShipmentDispatchResult {
  const response = unwrapResponseObject(input.response)
  const providerShipmentReference = extractProviderShipmentReference(response)
  const responseCorrelationId = extractProviderCorrelationId(response)
  const result: YandexCreateShipmentDispatchResultWithBackendReference = {
    version: YANDEX_CREATE_SHIPMENT_DISPATCH_PORT_VERSION,
    provider_code: DELIVERY_HUB_PROVIDER_YANDEX,
    operation: "create_shipment",
    attempted: true,
    accepted: true,
    succeeded: true,
    status_category: "accepted",
    provider_status_code: null,
    correlation_id_present: !!(responseCorrelationId || input.correlation_id),
    correlation_id_masked: maskNullableProviderReference(responseCorrelationId ?? input.correlation_id),
    provider_shipment_reference_present: !!providerShipmentReference,
    provider_shipment_reference_masked: maskNullableProviderReference(providerShipmentReference),
    label_available: hasDocumentPayload(response, ["label", "labels", "label_url", "label_urls"]),
    documents_available: hasDocumentPayload(response, ["document", "documents", "files", "acts"]),
    blocked_reason_code: null,
    blocked_reason: null,
    error_code: null,
    redacted: true,
    credentials_included: false,
    auth_headers_included: false,
    raw_provider_request_included: false,
    raw_provider_response_included: false,
    raw_execution_token_included: false,
    raw_quote_key_included: false,
  }

  Object.defineProperty(result, YANDEX_CREATE_SHIPMENT_BACKEND_REFERENCE_SYMBOL, {
    enumerable: false,
    configurable: false,
    writable: false,
    value: providerShipmentReference,
  })

  return result
}

function normalizeYandexCreateShipmentDispatchFailure(input: {
  correlation_id: string
  error: unknown
}): YandexCreateShipmentDispatchResult {
  if (isDeliveryHubError(input.error)) {
    const details = input.error.details ?? {}
    const providerStatusCode =
      typeof details.provider_status === "number" ? details.provider_status : null
    const detailsCorrelationId =
      typeof details.correlation_id === "string" ? details.correlation_id : null
    const providerShipmentReference = extractProviderShipmentReference(details.response)

    return {
      version: YANDEX_CREATE_SHIPMENT_DISPATCH_PORT_VERSION,
      provider_code: DELIVERY_HUB_PROVIDER_YANDEX,
      operation: "create_shipment",
      attempted: true,
      accepted: false,
      succeeded: false,
      status_category: normalizeFailureCategory(details.error_category),
      provider_status_code: providerStatusCode,
      correlation_id_present: !!(detailsCorrelationId || input.correlation_id),
      correlation_id_masked: maskNullableProviderReference(detailsCorrelationId ?? input.correlation_id),
      provider_shipment_reference_present: !!providerShipmentReference,
      provider_shipment_reference_masked: maskNullableProviderReference(providerShipmentReference),
      label_available: hasDocumentPayload(details.response, ["label", "labels", "label_url", "label_urls"]),
      documents_available: hasDocumentPayload(details.response, ["document", "documents", "files", "acts"]),
      blocked_reason_code: null,
      blocked_reason: null,
      error_code: input.error.code,
      redacted: true,
      credentials_included: false,
      auth_headers_included: false,
      raw_provider_request_included: false,
      raw_provider_response_included: false,
      raw_execution_token_included: false,
      raw_quote_key_included: false,
    }
  }

  return {
    version: YANDEX_CREATE_SHIPMENT_DISPATCH_PORT_VERSION,
    provider_code: DELIVERY_HUB_PROVIDER_YANDEX,
    operation: "create_shipment",
    attempted: true,
    accepted: false,
    succeeded: false,
    status_category: "unknown",
    provider_status_code: null,
    correlation_id_present: !!input.correlation_id,
    correlation_id_masked: maskNullableProviderReference(input.correlation_id),
    provider_shipment_reference_present: false,
    provider_shipment_reference_masked: null,
    label_available: false,
    documents_available: false,
    blocked_reason_code: null,
    blocked_reason: null,
    error_code: null,
    redacted: true,
    credentials_included: false,
    auth_headers_included: false,
    raw_provider_request_included: false,
    raw_provider_response_included: false,
    raw_execution_token_included: false,
    raw_quote_key_included: false,
  }
}

function normalizeMode(value: unknown): YandexCreateShipmentMaterializerMode {
  if (value === DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint) {
    return DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint
  }

  return DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint
}

function buildFallbackCorrelationId(input: YandexCreateShipmentPayloadMaterializerInput) {
  return [
    DELIVERY_HUB_PROVIDER_YANDEX,
    normalizeMode(input.mode),
    normalizeString(input.order?.order_id) ?? "order",
    normalizeString(input.quote_reference?.id) ?? "dispatch",
  ].join(":")
}

function buildRecipientFullName(input: YandexCreateShipmentPayloadMaterializerInput) {
  const fullName = normalizeString(input.recipient?.full_name)

  if (fullName) {
    return fullName
  }

  return [normalizeString(input.recipient?.first_name), normalizeString(input.recipient?.last_name)]
    .filter((part): part is string => !!part)
    .join(" ")
}

function normalizeExecutablePackages(
  value: YandexCreateShipmentPayloadMaterializerInput["packages"]
): YandexCreateShipmentDispatchRequestPayload["places"] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((pkg) => {
      const items = Array.isArray(pkg.items)
        ? pkg.items
            .filter((item) => isPositiveFiniteNumber(item.quantity))
            .map((item) => ({
              title: normalizeString(item.title) ?? undefined,
              sku: normalizeString(item.sku) ?? undefined,
              quantity: item.quantity,
              price: normalizeFiniteNumber(item.price) ?? undefined,
              assessed_unit_price: normalizeFiniteNumber(item.price) ?? undefined,
              currency: normalizeString(item.currency_code)?.toUpperCase() ?? undefined,
              weight: normalizeFiniteNumber(item.weight_grams) ?? undefined,
            }))
        : []

      return {
        reference: normalizeString(pkg.package_reference) ?? undefined,
        weight: normalizeFiniteNumber(pkg.weight_grams) ?? undefined,
        dimensions: {
          length: normalizeFiniteNumber(pkg.length_cm) ?? undefined,
          width: normalizeFiniteNumber(pkg.width_cm) ?? undefined,
          height: normalizeFiniteNumber(pkg.height_cm) ?? undefined,
        },
        items,
      }
    })
    .filter((pkg) => pkg.items.length > 0)
}

function buildRequestComment(input: YandexCreateShipmentPayloadMaterializerInput) {
  const destinationName = normalizeString(input.destination_pickup_point?.name)
  const connectionId = normalizeString(input.connection?.connection_id)

  const segments = [
    destinationName ? `pickup:${destinationName}` : null,
    connectionId ? `connection:${connectionId}` : null,
  ].filter((segment): segment is string => !!segment)

  return segments.length ? segments.join(" | ") : undefined
}

function unwrapResponseObject(value: Record<string, unknown>) {
  const data = value.data
  return data && typeof data === "object" ? (data as Record<string, unknown>) : value
}

function extractProviderShipmentReference(value: unknown): string | null {
  const object = value && typeof value === "object" ? (value as Record<string, unknown>) : null

  if (!object) {
    return null
  }

  const shipment =
    object.shipment && typeof object.shipment === "object"
      ? (object.shipment as Record<string, unknown>)
      : null

  const candidates = [
    object.shipment_id,
    shipment?.id,
    object.claim_id,
    object.id,
    object.reference,
  ]

  for (const candidate of candidates) {
    const normalized = normalizeString(candidate)
    if (normalized) {
      return normalized
    }
  }

  return null
}

function extractProviderCorrelationId(value: unknown): string | null {
  const object = value && typeof value === "object" ? (value as Record<string, unknown>) : null

  if (!object) {
    return null
  }

  const candidates = [
    object.correlation_id,
    object.request_id,
    object.x_request_id,
    object.tracking_id,
  ]

  for (const candidate of candidates) {
    const normalized = normalizeString(candidate)
    if (normalized) {
      return normalized
    }
  }

  return null
}

function hasDocumentPayload(value: unknown, keys: string[]) {
  const object = value && typeof value === "object" ? (value as Record<string, unknown>) : null

  if (!object) {
    return false
  }

  return keys.some((key) => {
    const candidate = object[key]
    if (Array.isArray(candidate)) {
      return candidate.length > 0
    }

    if (candidate && typeof candidate === "object") {
      return true
    }

    return !!normalizeString(candidate)
  })
}

function normalizeFailureCategory(value: unknown): YandexCreateShipmentDispatchStatusCategory {
  if (
    value === "provider_rejected" ||
    value === "auth" ||
    value === "transport" ||
    value === "provider_unavailable" ||
    value === "provider_error"
  ) {
    return value
  }

  return "unknown"
}

function normalizePickupInterval(value: { from?: string | null; to?: string | null } | null | undefined) {
  const from = normalizeString(value?.from)
  const to = normalizeString(value?.to)

  return from && to ? { from, to } : null
}

function normalizeString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function normalizeFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
}

function maskNullableProviderReference(value: unknown) {
  const normalized = normalizeString(value)
  return normalized ? maskProviderReference(normalized) : null
}

function maskProviderReference(value: string) {
  const normalized = normalizeString(value) ?? ""

  if (normalized.length <= 4) {
    return "***"
  }

  return `${normalized.slice(0, 2)}***${normalized.slice(-2)}`
}
