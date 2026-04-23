import { MedusaError } from "@medusajs/framework/utils"
import { DELIVERY_HUB_MODE_CODE } from "./constants"

export const DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE = "deliveryhub"
export const DELIVERY_HUB_FULFILLMENT_PROVIDER_ID =
  `${DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE}_${DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE}`
export const DELIVERY_HUB_SHIPPING_OPTION_DATA_VERSION = 1

export type DeliveryHubFulfillmentModeCode =
  (typeof DELIVERY_HUB_MODE_CODE)[keyof typeof DELIVERY_HUB_MODE_CODE]

export type DeliveryHubShippingOptionId =
  `${typeof DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE}:${DeliveryHubFulfillmentModeCode}`

export type DeliveryHubShippingOptionData = {
  version: typeof DELIVERY_HUB_SHIPPING_OPTION_DATA_VERSION
  provider_code: typeof DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE
  provider_id: typeof DELIVERY_HUB_FULFILLMENT_PROVIDER_ID
  id: DeliveryHubShippingOptionId
  mode_code: DeliveryHubFulfillmentModeCode
}

export const DELIVERY_HUB_SHIPPING_OPTION_IDS = {
  warehouseToPickupPoint: buildDeliveryHubShippingOptionId(
    DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint
  ),
  dropoffPointToPickupPoint: buildDeliveryHubShippingOptionId(
    DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint
  ),
} as const

export const DELIVERY_HUB_FULFILLMENT_OPTION_DEFINITIONS = [
  buildDeliveryHubWarehouseToPickupPointShippingOptionData(),
  buildDeliveryHubDropoffPointToPickupPointShippingOptionData(),
] as const

export function buildDeliveryHubShippingOptionId(
  modeCode: DeliveryHubFulfillmentModeCode
): DeliveryHubShippingOptionId {
  const normalizedModeCode = requireModeCode(modeCode, "mode_code")

  return `${DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE}:${normalizedModeCode}`
}

export function buildDeliveryHubShippingOptionData(
  modeCode: DeliveryHubFulfillmentModeCode
): DeliveryHubShippingOptionData {
  const normalizedModeCode = requireModeCode(modeCode, "mode_code")

  return {
    version: DELIVERY_HUB_SHIPPING_OPTION_DATA_VERSION,
    provider_code: DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
    provider_id: DELIVERY_HUB_FULFILLMENT_PROVIDER_ID,
    id: buildDeliveryHubShippingOptionId(normalizedModeCode),
    mode_code: normalizedModeCode,
  }
}

export function buildDeliveryHubWarehouseToPickupPointShippingOptionData() {
  return buildDeliveryHubShippingOptionData(DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint)
}

export function buildDeliveryHubDropoffPointToPickupPointShippingOptionData() {
  return buildDeliveryHubShippingOptionData(DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint)
}

export function normalizeDeliveryHubShippingOptionData(
  data?: Record<string, unknown>
): DeliveryHubShippingOptionData {
  const root = asRecord(data)
  const version =
    readPositiveInteger(root.version) ?? DELIVERY_HUB_SHIPPING_OPTION_DATA_VERSION
  const providerCode = normalizeNullableText(root.provider_code)
  const providerId = normalizeNullableText(root.provider_id)
  const modeCodeFromModeField = readModeCode(root.mode_code) ?? readModeCode(root.quote_type)
  const modeCodeFromIdField =
    readModeCodeFromOptionIdentifier(root.id) ??
    readModeCodeFromOptionIdentifier(root.option_id)
  const normalizedId = normalizeOptionIdentifier(root.id, "id", modeCodeFromModeField)
  const normalizedOptionId = normalizeOptionIdentifier(
    root.option_id,
    "option_id",
    modeCodeFromModeField
  )

  if (version !== DELIVERY_HUB_SHIPPING_OPTION_DATA_VERSION) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Delivery Hub shipping option data version ${version} is not supported.`
    )
  }

  if (providerCode && providerCode !== DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Delivery Hub field "provider_code" must equal "${DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE}".`
    )
  }

  if (providerId && providerId !== DELIVERY_HUB_FULFILLMENT_PROVIDER_ID) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Delivery Hub field "provider_id" must equal "${DELIVERY_HUB_FULFILLMENT_PROVIDER_ID}".`
    )
  }

  if (
    modeCodeFromModeField &&
    modeCodeFromIdField &&
    modeCodeFromModeField !== modeCodeFromIdField
  ) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Delivery Hub shipping option mode_code does not match the shipping option id."
    )
  }

  if (normalizedId && normalizedOptionId && normalizedId !== normalizedOptionId) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Delivery Hub shipping option id does not match option_id."
    )
  }

  const modeCode = modeCodeFromModeField ?? modeCodeFromIdField

  if (!modeCode) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Delivery Hub shipping option must include a supported mode_code or shipping option id."
    )
  }

  return {
    version: DELIVERY_HUB_SHIPPING_OPTION_DATA_VERSION,
    provider_code: DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
    provider_id: DELIVERY_HUB_FULFILLMENT_PROVIDER_ID,
    id:
      normalizedId ??
      normalizedOptionId ??
      buildDeliveryHubShippingOptionId(modeCode),
    mode_code: modeCode,
  }
}

export function validateDeliveryHubShippingOptionData(data?: Record<string, unknown>) {
  try {
    normalizeDeliveryHubShippingOptionData(data)
    return true
  } catch {
    return false
  }
}

function normalizeOptionIdentifier(
  value: unknown,
  field: string,
  expectedModeCode?: DeliveryHubFulfillmentModeCode | null
): DeliveryHubShippingOptionId | null {
  const normalized = normalizeNullableText(value)

  if (!normalized) {
    return null
  }

  if (expectedModeCode && normalized === expectedModeCode) {
    return buildDeliveryHubShippingOptionId(expectedModeCode)
  }

  const parsedModeCode = readModeCodeFromOptionIdentifier(normalized)

  if (!parsedModeCode) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Delivery Hub field "${field}" must reference a supported shipping option id.`
    )
  }

  if (expectedModeCode && parsedModeCode !== expectedModeCode) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Delivery Hub field "${field}" must match mode_code "${expectedModeCode}".`
    )
  }

  return buildDeliveryHubShippingOptionId(parsedModeCode)
}

function requireModeCode(value: unknown, field: string): DeliveryHubFulfillmentModeCode {
  const modeCode = readModeCode(value)

  if (modeCode) {
    return modeCode
  }

  throw new MedusaError(
    MedusaError.Types.INVALID_DATA,
    `Delivery Hub field "${field}" must reference a supported mode_code.`
  )
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

function readModeCodeFromOptionIdentifier(value: unknown): DeliveryHubFulfillmentModeCode | null {
  const normalized = normalizeNullableText(value)

  if (!normalized) {
    return null
  }

  if (normalized === DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint) {
    return DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint
  }

  if (normalized === DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint) {
    return DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint
  }

  if (!normalized.startsWith(`${DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE}:`)) {
    return null
  }

  return readModeCode(normalized.slice(DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE.length + 1))
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

function readPositiveInteger(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    return null
  }

  return value
}
