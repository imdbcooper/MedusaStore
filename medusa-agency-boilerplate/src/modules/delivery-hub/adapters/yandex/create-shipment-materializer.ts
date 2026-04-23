import { DELIVERY_HUB_MODE_CODE, DELIVERY_HUB_PROVIDER_YANDEX } from "../../constants"
import type { DeliveryHubProviderOriginDispatchContext } from "../../cart-selection"

export const YANDEX_CREATE_SHIPMENT_PAYLOAD_MATERIALIZER_VERSION = 1

export type YandexCreateShipmentMaterializerMode =
  | typeof DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint
  | typeof DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint

export type YandexCreateShipmentMaterializerBlockedReasonCode =
  | "missing_or_unsupported_mode"
  | "missing_provider_origin_dispatch_context"
  | "wrong_origin_context_for_mode"
  | "missing_destination_pickup_point"
  | "missing_pickup_interval_window"
  | "missing_recipient_contact"
  | "missing_package_items"

export type YandexCreateShipmentMaterializerPickupInterval = {
  from: string
  to: string
}

export type YandexCreateShipmentMaterializerDestinationPickupPoint = {
  provider_point_id?: string | null
  provider_point_code?: string | null
  name?: string | null
  address?: string | null
  city?: string | null
}

export type YandexCreateShipmentMaterializerRecipient = {
  full_name?: string | null
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  phone?: string | null
}

export type YandexCreateShipmentMaterializerAddress = {
  country_code?: string | null
  city?: string | null
  region?: string | null
  postal_code?: string | null
  address_line?: string | null
}

export type YandexCreateShipmentMaterializerOrderSummary = {
  order_id?: string | null
  display_id?: string | number | null
  external_order_reference?: string | null
  currency_code?: string | null
  total?: number | null
}

export type YandexCreateShipmentMaterializerItem = {
  title?: string | null
  sku?: string | null
  quantity: number
  price?: number | null
  currency_code?: string | null
  weight_grams?: number | null
}

export type YandexCreateShipmentMaterializerPackage = {
  package_reference?: string | null
  weight_grams?: number | null
  length_cm?: number | null
  width_cm?: number | null
  height_cm?: number | null
  items: YandexCreateShipmentMaterializerItem[]
}

export type YandexCreateShipmentMaterializerConnectionSummary = {
  connection_id?: string | null
  provider_code?: string | null
  mode?: "test" | "live" | string | null
  provider_account_reference?: string | null
}

export type YandexCreateShipmentPayloadMaterializerInput = {
  mode?: string | null
  provider_origin_dispatch_context?: DeliveryHubProviderOriginDispatchContext | null
  destination_pickup_point?: YandexCreateShipmentMaterializerDestinationPickupPoint | null
  pickup_interval_utc?: YandexCreateShipmentMaterializerPickupInterval | null
  order?: YandexCreateShipmentMaterializerOrderSummary | null
  recipient?: YandexCreateShipmentMaterializerRecipient | null
  address?: YandexCreateShipmentMaterializerAddress | null
  packages?: YandexCreateShipmentMaterializerPackage[] | null
  connection?: YandexCreateShipmentMaterializerConnectionSummary | null
  quote_reference?: {
    id?: string | null
    version?: number | null
  } | null
  correlation_id?: string | null
}

export type YandexCreateShipmentPayloadPreview = {
  provider_code: typeof DELIVERY_HUB_PROVIDER_YANDEX
  operation: "create_shipment"
  redacted: true
  network_dispatch_performed: false
  credentials_included: false
  auth_headers_included: false
  raw_execution_token_included: false
  raw_provider_payload_included: false
  payload: {
    source: {
      type: "warehouse" | "dropoff_point"
      provider_warehouse_id: string | null
      origin_point_id: string | null
    }
    destination: {
      pickup_point_id: string
      pickup_point_code: string | null
      label: string | null
      city: string | null
    }
    pickup_interval_utc: YandexCreateShipmentMaterializerPickupInterval | null
    order: {
      order_reference: string | null
      display_id: string | null
      currency_code: string | null
      total_present: boolean
    }
    recipient_contact: {
      name_present: boolean
      email: string | null
      phone: string | null
    }
    address_summary: {
      country_code: string | null
      city: string | null
      region: string | null
      postal_code: string | null
      address_line_present: boolean
    }
    packages: Array<{
      package_reference: string | null
      weight_grams: number | null
      dimensions_cm: {
        length: number | null
        width: number | null
        height: number | null
      }
      item_count: number
      items: Array<{
        title: string | null
        sku: string | null
        quantity: number
        price_present: boolean
        currency_code: string | null
        weight_grams: number | null
      }>
    }>
    connection: {
      connection_id: string | null
      provider_code: typeof DELIVERY_HUB_PROVIDER_YANDEX
      mode: string | null
      provider_account_reference: string | null
    }
    quote_reference_summary: {
      id: string | null
      version: number | null
    }
    correlation_id: string | null
  }
}

export type YandexCreateShipmentPayloadMaterializerReadyResult = {
  version: typeof YANDEX_CREATE_SHIPMENT_PAYLOAD_MATERIALIZER_VERSION
  status: "ready"
  blocked_reasons: []
  preview: YandexCreateShipmentPayloadPreview
}

export type YandexCreateShipmentPayloadMaterializerBlockedResult = {
  version: typeof YANDEX_CREATE_SHIPMENT_PAYLOAD_MATERIALIZER_VERSION
  status: "blocked"
  blocked_reasons: Array<{
    code: YandexCreateShipmentMaterializerBlockedReasonCode
    message: string
  }>
  preview: null
}

export type YandexCreateShipmentPayloadMaterializerResult =
  | YandexCreateShipmentPayloadMaterializerReadyResult
  | YandexCreateShipmentPayloadMaterializerBlockedResult

export function materializeYandexCreateShipmentPayloadPreview(
  input: YandexCreateShipmentPayloadMaterializerInput
): YandexCreateShipmentPayloadMaterializerResult {
  const mode = normalizeMode(input.mode)
  const origin = input.provider_origin_dispatch_context ?? null
  const destinationPickupPointId = normalizeString(
    input.destination_pickup_point?.provider_point_id
  )
  const pickupInterval = normalizePickupInterval(input.pickup_interval_utc)
  const recipientContactReady = isRecipientContactReady(input.recipient)
  const packages = normalizePackages(input.packages)
  const blockedReasons: YandexCreateShipmentPayloadMaterializerBlockedResult["blocked_reasons"] = []

  if (!mode) {
    blockedReasons.push({
      code: "missing_or_unsupported_mode",
      message:
        "Yandex create_shipment payload preview requires warehouse_to_pickup_point or dropoff_point_to_pickup_point mode.",
    })
  }

  if (mode && !origin) {
    blockedReasons.push({
      code: "missing_provider_origin_dispatch_context",
      message:
        "Yandex create_shipment payload preview requires backend-only provider origin dispatch context.",
    })
  }

  if (mode && origin && !isOriginContextCorrectForMode(origin, mode)) {
    blockedReasons.push({
      code: "wrong_origin_context_for_mode",
      message:
        "Yandex create_shipment payload preview received provider origin context that does not match the selected delivery mode.",
    })
  }

  if (!destinationPickupPointId) {
    blockedReasons.push({
      code: "missing_destination_pickup_point",
      message:
        "Yandex create_shipment payload preview requires a destination pickup point provider id.",
    })
  }

  if (mode === DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint && !pickupInterval) {
    blockedReasons.push({
      code: "missing_pickup_interval_window",
      message:
        "Yandex warehouse_to_pickup_point create_shipment payload preview requires a pickup interval/window.",
    })
  }

  if (!recipientContactReady) {
    blockedReasons.push({
      code: "missing_recipient_contact",
      message:
        "Yandex create_shipment payload preview requires recipient name plus at least one contact channel.",
    })
  }

  if (!packages.length) {
    blockedReasons.push({
      code: "missing_package_items",
      message:
        "Yandex create_shipment payload preview requires at least one package with at least one positive-quantity item.",
    })
  }

  if (blockedReasons.length || !mode || !origin || !destinationPickupPointId) {
    return {
      version: YANDEX_CREATE_SHIPMENT_PAYLOAD_MATERIALIZER_VERSION,
      status: "blocked",
      blocked_reasons: blockedReasons,
      preview: null,
    }
  }

  return {
    version: YANDEX_CREATE_SHIPMENT_PAYLOAD_MATERIALIZER_VERSION,
    status: "ready",
    blocked_reasons: [],
    preview: {
      provider_code: DELIVERY_HUB_PROVIDER_YANDEX,
      operation: "create_shipment",
      redacted: true,
      network_dispatch_performed: false,
      credentials_included: false,
      auth_headers_included: false,
      raw_execution_token_included: false,
      raw_provider_payload_included: false,
      payload: {
        source: buildRedactedSourcePreview(origin, mode),
        destination: {
          pickup_point_id: maskProviderReference(destinationPickupPointId),
          pickup_point_code: maskNullableProviderReference(
            input.destination_pickup_point?.provider_point_code
          ),
          label: normalizeString(input.destination_pickup_point?.name),
          city: normalizeString(input.destination_pickup_point?.city),
        },
        pickup_interval_utc: pickupInterval,
        order: {
          order_reference: maskNullableProviderReference(
            input.order?.external_order_reference ?? input.order?.order_id
          ),
          display_id:
            input.order?.display_id === null || input.order?.display_id === undefined
              ? null
              : String(input.order.display_id),
          currency_code: normalizeString(input.order?.currency_code)?.toUpperCase() ?? null,
          total_present: typeof input.order?.total === "number" && Number.isFinite(input.order.total),
        },
        recipient_contact: {
          name_present: hasRecipientName(input.recipient),
          email: maskEmail(input.recipient?.email),
          phone: maskPhone(input.recipient?.phone),
        },
        address_summary: {
          country_code: normalizeString(input.address?.country_code)?.toUpperCase() ?? null,
          city: normalizeString(input.address?.city),
          region: normalizeString(input.address?.region),
          postal_code: maskNullableProviderReference(input.address?.postal_code),
          address_line_present: !!normalizeString(input.address?.address_line),
        },
        packages,
        connection: {
          connection_id: maskNullableProviderReference(input.connection?.connection_id),
          provider_code: DELIVERY_HUB_PROVIDER_YANDEX,
          mode: normalizeString(input.connection?.mode),
          provider_account_reference: maskNullableProviderReference(
            input.connection?.provider_account_reference
          ),
        },
        quote_reference_summary: {
          id: maskNullableProviderReference(input.quote_reference?.id),
          version:
            typeof input.quote_reference?.version === "number" &&
            Number.isFinite(input.quote_reference.version)
              ? input.quote_reference.version
              : null,
        },
        correlation_id: maskNullableProviderReference(input.correlation_id),
      },
    },
  }
}

function normalizeMode(value: unknown): YandexCreateShipmentMaterializerMode | null {
  if (
    value === DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint ||
    value === DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint
  ) {
    return value
  }

  return null
}

function isOriginContextCorrectForMode(
  origin: DeliveryHubProviderOriginDispatchContext,
  mode: YandexCreateShipmentMaterializerMode
) {
  if (mode === DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint) {
    return (
      origin.mode_code === DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint &&
      !!normalizeString(origin.provider_warehouse_id)
    )
  }

  return (
    origin.mode_code === DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint &&
    !!normalizeString(origin.origin_point_id)
  )
}

function buildRedactedSourcePreview(
  origin: DeliveryHubProviderOriginDispatchContext,
  mode: YandexCreateShipmentMaterializerMode
): YandexCreateShipmentPayloadPreview["payload"]["source"] {
  if (mode === DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint) {
    return {
      type: "warehouse",
      provider_warehouse_id: maskProviderReference(
        origin.mode_code === DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint
          ? origin.provider_warehouse_id
          : ""
      ),
      origin_point_id: null,
    }
  }

  return {
    type: "dropoff_point",
    provider_warehouse_id: null,
    origin_point_id: maskProviderReference(
      origin.mode_code === DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint
        ? origin.origin_point_id
        : ""
    ),
  }
}

function normalizePickupInterval(
  value: YandexCreateShipmentMaterializerPickupInterval | null | undefined
): YandexCreateShipmentMaterializerPickupInterval | null {
  const from = normalizeString(value?.from)
  const to = normalizeString(value?.to)

  return from && to ? { from, to } : null
}

function isRecipientContactReady(
  value: YandexCreateShipmentMaterializerRecipient | null | undefined
) {
  return hasRecipientName(value) && (!!normalizeString(value?.email) || !!normalizeString(value?.phone))
}

function hasRecipientName(value: YandexCreateShipmentMaterializerRecipient | null | undefined) {
  return !!(
    normalizeString(value?.full_name) ||
    normalizeString(value?.first_name) ||
    normalizeString(value?.last_name)
  )
}

function normalizePackages(value: YandexCreateShipmentMaterializerPackage[] | null | undefined) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((pkg) => {
      const items = Array.isArray(pkg.items)
        ? pkg.items
            .filter((item) => isPositiveFiniteNumber(item.quantity))
            .map((item) => ({
              title: normalizeString(item.title),
              sku: maskNullableProviderReference(item.sku),
              quantity: item.quantity,
              price_present: typeof item.price === "number" && Number.isFinite(item.price),
              currency_code: normalizeString(item.currency_code)?.toUpperCase() ?? null,
              weight_grams: normalizeFiniteNumber(item.weight_grams),
            }))
        : []

      return {
        package_reference: maskNullableProviderReference(pkg.package_reference),
        weight_grams: normalizeFiniteNumber(pkg.weight_grams),
        dimensions_cm: {
          length: normalizeFiniteNumber(pkg.length_cm),
          width: normalizeFiniteNumber(pkg.width_cm),
          height: normalizeFiniteNumber(pkg.height_cm),
        },
        item_count: items.length,
        items,
      }
    })
    .filter((pkg) => pkg.items.length > 0)
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

function maskEmail(value: unknown) {
  const normalized = normalizeString(value)

  if (!normalized || !normalized.includes("@")) {
    return null
  }

  const [local, domain] = normalized.split("@")
  const safeLocal = local ? `${local.slice(0, 1)}***` : "***"
  return `${safeLocal}@${domain}`
}

function maskPhone(value: unknown) {
  const normalized = normalizeString(value)?.replace(/\s+/g, "")

  if (!normalized) {
    return null
  }

  if (normalized.length <= 4) {
    return "***"
  }

  return `${normalized.slice(0, 2)}***${normalized.slice(-2)}`
}
