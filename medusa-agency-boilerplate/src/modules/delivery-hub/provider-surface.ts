import { MedusaError } from "@medusajs/framework/utils"
import type {
  DeliveryHubCartSelectionPickupPoint,
  DeliveryHubCartSelectionPickupWindow,
  DeliveryHubCartSelectionPublic,
  DeliveryHubQuoteReference,
} from "./cart-selection"
import type { DeliveryHubCustomerPrice } from "./domain/pricing-policy"
import { DELIVERY_HUB_MODE_CODE } from "./constants"
import {
  buildDeliveryHubShippingOptionData,
  DELIVERY_HUB_FULFILLMENT_OPTION_DEFINITIONS,
  DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
  DELIVERY_HUB_FULFILLMENT_PROVIDER_ID,
  type DeliveryHubFulfillmentModeCode,
  type DeliveryHubShippingOptionData,
  normalizeDeliveryHubShippingOptionData,
} from "./shipping-option-contract"

export {
  DELIVERY_HUB_FULFILLMENT_OPTION_DEFINITIONS,
  DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
  DELIVERY_HUB_FULFILLMENT_PROVIDER_ID,
}

export const DELIVERY_HUB_FULFILLMENT_DATA_VERSION = 1

export type DeliveryHubFulfillmentOptionData = DeliveryHubShippingOptionData

export type DeliveryHubFulfillmentQuoteSummary = DeliveryHubCartSelectionPublic["quote"]

export type DeliveryHubFulfillmentSelectionData = {
  version: number
  connection_id: string
  mode_code: DeliveryHubFulfillmentModeCode
  quote_reference: DeliveryHubQuoteReference
  quote: DeliveryHubFulfillmentQuoteSummary
  pickup_point: DeliveryHubCartSelectionPickupPoint
  pickup_window: DeliveryHubCartSelectionPickupWindow | null
}

export function buildDeliveryHubFulfillmentOptionData(
  modeCode: DeliveryHubFulfillmentModeCode
): DeliveryHubFulfillmentOptionData {
  return buildDeliveryHubShippingOptionData(modeCode)
}

export function normalizeDeliveryHubFulfillmentOptionData(
  data?: Record<string, unknown>
): DeliveryHubFulfillmentOptionData {
  return normalizeDeliveryHubShippingOptionData(data)
}

export function normalizeDeliveryHubFulfillmentData(
  data?: Record<string, unknown>,
  input?: {
    default_mode_code?: string | null
  }
) {
  const root = asRecord(data)

  if (!Object.keys(root).length) {
    return {}
  }

  const quoteReference = asRecord(root.quote_reference)
  const quote = asRecord(root.quote)
  const pickupPoint = asRecord(root.pickup_point)
  const pickupWindow = asRecord(root.pickup_window)
  const modeCode =
    readModeCode(root.mode_code) ??
    readModeCode(root.quote_type) ??
    readModeCode(input?.default_mode_code)
  const connectionId = requireNonEmptyString(root.connection_id, "connection_id")
  const quoteReferenceId = requireNonEmptyString(quoteReference.id, "quote_reference.id")
  const quoteReferenceVersion = requirePositiveInteger(
    quoteReference.version,
    "quote_reference.version"
  )
  const quoteAmount = requireFiniteNumber(quote.amount, "quote.amount")
  const carrierCode = requireNonEmptyString(quote.carrier_code, "quote.carrier_code")
  const carrierLabel = requireNonEmptyString(quote.carrier_label, "quote.carrier_label")
  const currencyCode = requireNonEmptyString(quote.currency_code, "quote.currency_code")
  const customerPrice = normalizeCustomerPrice(quote.customer_price, {
    amount: quoteAmount,
    currency_code: currencyCode,
  })
  const pickupPointRequired = requireBoolean(
    quote.pickup_point_required,
    "quote.pickup_point_required"
  )
  const pickupWindowRequired = requireBoolean(
    quote.pickup_window_required,
    "quote.pickup_window_required"
  )
  const providerPointId = normalizeNullableText(pickupPoint.provider_point_id)
  const normalizedPickupWindow = normalizePickupWindow(
    pickupWindow,
    pickupWindowRequired && modeCode === DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint
  )

  if (!modeCode) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Delivery Hub shipping selection must include a supported mode_code or quote_type."
    )
  }

  if (pickupPointRequired && !providerPointId) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Delivery Hub shipping selection must include pickup_point.provider_point_id."
    )
  }

  return {
    version:
      requirePositiveInteger(
        root.version ?? quoteReferenceVersion ?? DELIVERY_HUB_FULFILLMENT_DATA_VERSION,
        "version"
      ) ?? DELIVERY_HUB_FULFILLMENT_DATA_VERSION,
    connection_id: connectionId,
    mode_code: modeCode,
    quote_reference: {
      id: quoteReferenceId,
      version: quoteReferenceVersion,
    },
    quote: {
      carrier_code: carrierCode,
      carrier_label: carrierLabel,
      amount: quoteAmount,
      currency_code: currencyCode,
      customer_price: customerPrice,
      delivery_eta_min: normalizeNullableFiniteNumber(quote.delivery_eta_min),
      delivery_eta_max: normalizeNullableFiniteNumber(quote.delivery_eta_max),
      pickup_point_required: pickupPointRequired,
      pickup_window_required: pickupWindowRequired,
    },
    pickup_point: {
      provider_point_id: providerPointId ?? "",
      provider_point_code: normalizeNullableText(pickupPoint.provider_point_code),
      name: requireNonEmptyString(pickupPoint.name, "pickup_point.name"),
      address: requireNonEmptyString(pickupPoint.address, "pickup_point.address"),
      city: normalizeNullableText(pickupPoint.city),
      region: normalizeNullableText(pickupPoint.region),
      postal_code: normalizeNullableText(pickupPoint.postal_code),
      lat: normalizeNullableFiniteNumber(pickupPoint.lat),
      lng: normalizeNullableFiniteNumber(pickupPoint.lng),
      is_origin_dropoff_allowed: readBoolean(pickupPoint.is_origin_dropoff_allowed) ?? false,
      is_destination_pickup_allowed:
        readBoolean(pickupPoint.is_destination_pickup_allowed) ?? false,
      payment_methods: readStringArray(pickupPoint.payment_methods),
    },
    pickup_window: normalizedPickupWindow,
  } satisfies DeliveryHubFulfillmentSelectionData
}

export function parseDeliveryHubFulfillmentData(
  data?: Record<string, unknown>,
  input?: {
    default_mode_code?: string | null
  }
): DeliveryHubFulfillmentSelectionData | null {
  const normalized = normalizeDeliveryHubFulfillmentData(data, input)

  if (!Object.keys(normalized).length) {
    return null
  }

  return normalized as DeliveryHubFulfillmentSelectionData
}

function normalizeCustomerPrice(
  value: unknown,
  quote: Record<string, unknown>
): DeliveryHubCustomerPrice {
  const record = asRecord(value)
  const amount = normalizeNullableFiniteNumber(record.amount) ??
    requireFiniteNumber(quote.amount, "quote.amount")
  const currencyCode = normalizeNullableText(record.currency_code) ??
    requireNonEmptyString(quote.currency_code, "quote.currency_code")
  const source = readCustomerPriceSource(record.source) ?? "provider_quote"

  return {
    amount,
    currency_code: currencyCode,
    source,
    policy_id: normalizeNullableText(record.policy_id),
  }
}

function readCustomerPriceSource(value: unknown): DeliveryHubCustomerPrice["source"] | null {
  const normalized = normalizeNullableText(value)

  return normalized === "fixed" ||
    normalized === "free_threshold" ||
    normalized === "free" ||
    normalized === "provider_quote" ||
    normalized === "provider_quote_markup" ||
    normalized === "manual"
    ? normalized
    : null
}

export function buildDeliveryHubCalculatedPriceData(
  selection: DeliveryHubFulfillmentSelectionData
) {
  return {
    version: selection.version,
    provider_code: DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
    connection_id: selection.connection_id,
    mode_code: selection.mode_code,
    quote_reference: selection.quote_reference,
    quote: selection.quote,
    pickup_point: selection.pickup_point,
    pickup_window: selection.pickup_window,
  }
}

function normalizePickupWindow(
  pickupWindow: Record<string, unknown>,
  required: boolean
): DeliveryHubCartSelectionPickupWindow | null {
  if (!Object.keys(pickupWindow).length) {
    if (required) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Delivery Hub shipping selection must include pickup_window for this quote."
      )
    }

    return null
  }

  const interval = asRecord(pickupWindow.interval_utc)
  const from = normalizeNullableText(interval.from)
  const to = normalizeNullableText(interval.to)

  if (required && (!from || !to)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Delivery Hub pickup_window.interval_utc must include from and to."
    )
  }

  if (!from || !to) {
    return null
  }

  return {
    date: requireNonEmptyString(pickupWindow.date, "pickup_window.date"),
    time_from: normalizeNullableText(pickupWindow.time_from),
    time_to: normalizeNullableText(pickupWindow.time_to),
    interval_utc: {
      from,
      to,
    },
    label: requireNonEmptyString(pickupWindow.label, "pickup_window.label"),
  }
}

function readModeCode(value: unknown): DeliveryHubFulfillmentModeCode | null {
  const normalized = normalizeNullableText(value)

  if (
    normalized === DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint ||
    normalized === DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint
  ) {
    return normalized
  }

  return null
}

function requireNonEmptyString(value: unknown, field: string) {
  const normalized = normalizeNullableText(value)

  if (normalized) {
    return normalized
  }

  throw new MedusaError(
    MedusaError.Types.INVALID_DATA,
    `Delivery Hub field "${field}" is required.`
  )
}

function requireFiniteNumber(value: unknown, field: string) {
  const normalized = normalizeNullableFiniteNumber(value)

  if (normalized !== null) {
    return normalized
  }

  throw new MedusaError(
    MedusaError.Types.INVALID_DATA,
    `Delivery Hub field "${field}" must be a finite number.`
  )
}

function requirePositiveInteger(value: unknown, field: string) {
  const normalized = readPositiveInteger(value)

  if (normalized !== null) {
    return normalized
  }

  throw new MedusaError(
    MedusaError.Types.INVALID_DATA,
    `Delivery Hub field "${field}" must be a positive integer.`
  )
}

function requireBoolean(value: unknown, field: string) {
  const normalized = readBoolean(value)

  if (normalized !== null) {
    return normalized
  }

  throw new MedusaError(
    MedusaError.Types.INVALID_DATA,
    `Delivery Hub field "${field}" must be a boolean.`
  )
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}

function normalizeNullableText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function normalizeNullableFiniteNumber(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null
  }

  return value
}

function readPositiveInteger(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    return null
  }

  return value
}

function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => normalizeNullableText(item))
    .filter((item): item is string => !!item)
}
