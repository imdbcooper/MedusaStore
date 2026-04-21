import { HttpTypes } from "@medusajs/types"

export const APISHIP_PROVIDER_ID = "apiship_apiship"
export const APISHIP_TO_DOOR_OPTION_ID = "apiship_to_door"
export const APISHIP_TO_POINT_OPTION_ID = "apiship_to_point"

export const APISHIP_SHOPPER_MODE_KEYS = [
  APISHIP_TO_DOOR_OPTION_ID,
  APISHIP_TO_POINT_OPTION_ID,
] as const

export type ApiShipShopperModeKey = (typeof APISHIP_SHOPPER_MODE_KEYS)[number]

export type ApiShipStorefrontModeSettings = {
  mode_key: ApiShipShopperModeKey
  mode_label: string
  shipping_option_id: string
  enabled: boolean
  technical_mode_keys: string[]
  pickup_types: number[]
  delivery_type: 1 | 2
}

export type ApiShipStorefrontSettings = {
  enabled: boolean
  shopper_modes: Record<ApiShipShopperModeKey, ApiShipStorefrontModeSettings>
}

export type ApiShipRateQuote = {
  provider_key: string
  provider_name: string | null
  provider_label: string
  tariff_id: number
  tariff_name: string | null
  quote_key: string
  pickup_type: number
  delivery_type: number
  mode_key: ApiShipShopperModeKey
  mode_label: string
  amount: number
  eta: {
    min: number | null
    max: number | null
  }
  shipping_option_id: string
  shipping_option_name: string
  point_ids: number[]
  point_selection_required: boolean
  point_selection_supported: boolean
}

export type ApiShipRateGroup = {
  provider_key: string
  provider_name: string | null
  provider_label: string
  mode_key: ApiShipShopperModeKey
  mode_label: string
  pickup_type: number
  delivery_type: number
  tariffs: ApiShipRateQuote[]
}

export type ApiShipRatesResponse = {
  quotes: ApiShipRateQuote[]
  grouped_quotes: ApiShipRateGroup[]
  selected_quote: ApiShipRateQuote | null
  selection_mode: string
  code?: string | null
  settings?: ApiShipStorefrontSettings
}

export type ApiShipShippingSelectionData = {
  provider_key: string
  tariff_id: number
  pickup_type?: number
  delivery_type?: number
  mode_key: ApiShipShopperModeKey
  provider_name?: string
  tariff_name?: string
  quote_key?: string
  point_out_id?: number
  point_label?: string
  point_address?: string
  estimated_days_min?: number
  estimated_days_max?: number
  selection_mode?: string
  shipping_option_id?: string
  address_fingerprint?: string
}

export type ApiShipPoint = {
  id: number
  provider_key: string
  code: string | null
  name: string | null
  address: string | null
  city: string | null
  region: string | null
  post_index: string | null
  lat: number | null
  lng: number | null
  phone: string | null
  timetable: string | null
  payment_cash: number | null
  payment_card: number | null
  payment_online: number | null
  cod: number | null
  fitting_room: number | null
  selection_data: ApiShipShippingSelectionData
}

export type ApiShipPointsResponse = {
  points: ApiShipPoint[]
  selected_selection: ApiShipShippingSelectionData | null
  selection_confirmation_required: boolean
  selected_quote_key: string | null
  code?: string | null
  settings?: ApiShipStorefrontSettings
}

type ShippingOptionLike =
  | Pick<HttpTypes.StoreCartShippingOption, "provider_id" | "id" | "data">
  | null
  | undefined

type ShippingMethodLike = {
  data?: Record<string, unknown> | null
} | null | undefined

export function isApiShipShippingOption(option: ShippingOptionLike) {
  const modeKey = getApiShipShopperModeKey(option)

  return option?.provider_id === APISHIP_PROVIDER_ID || modeKey !== null
}

export function isApiShipShopperModeKey(value: unknown): value is ApiShipShopperModeKey {
  return (
    value === APISHIP_TO_DOOR_OPTION_ID || value === APISHIP_TO_POINT_OPTION_ID
  )
}

export function isApiShipShippingMethodId(value: string | null | undefined) {
  return isApiShipShopperModeKey(value)
}

export function getApiShipStorefrontModeSettings(
  settings: ApiShipStorefrontSettings | null | undefined,
  shippingOption: ShippingOptionLike | string | null | undefined
) {
  if (!settings || !shippingOption) {
    return null
  }

  const modeKey =
    typeof shippingOption === "string"
      ? isApiShipShopperModeKey(shippingOption)
        ? shippingOption
        : null
      : getApiShipShopperModeKey(shippingOption)

  if (!modeKey) {
    return null
  }

  return settings.shopper_modes[modeKey] ?? null
}

export function getApiShipModeLabel(
  modeKey: string | null | undefined,
  deliveryType?: number | null
) {
  if (modeKey === APISHIP_TO_POINT_OPTION_ID || deliveryType === 2) {
    return "В пункт выдачи"
  }

  if (modeKey === APISHIP_TO_DOOR_OPTION_ID || deliveryType === 1) {
    return "До двери"
  }

  return null
}

export function getApiShipShippingOptionLabel(
  option: ShippingOptionLike | ApiShipShopperModeKey | null | undefined,
  settings?: ApiShipStorefrontSettings | null
) {
  const modeKey =
    typeof option === "string" ? option : getApiShipShopperModeKey(option)
  const configuredMode = getApiShipStorefrontModeSettings(settings, option)

  return (
    configuredMode?.mode_label ??
    getApiShipModeLabel(
      modeKey,
      typeof option === "string"
        ? null
        : getFiniteInteger(option?.data?.deliveryType)
    ) ??
    (typeof option === "string" ? getNonEmptyString(option) : getNonEmptyString(option?.id)) ??
    "ApiShip"
  )
}

export function buildApiShipShippingSelectionData(
  quote: ApiShipRateQuote,
  point?: ApiShipPoint | null,
  options?: {
    shippingOptionId?: string | null
    addressFingerprint?: string | null
  }
): ApiShipShippingSelectionData {
  const selection: ApiShipShippingSelectionData = {
    provider_key: quote.provider_key,
    tariff_id: quote.tariff_id,
    pickup_type: quote.pickup_type,
    delivery_type: quote.delivery_type,
    mode_key: quote.mode_key,
    provider_name: quote.provider_name ?? undefined,
    tariff_name: quote.tariff_name ?? undefined,
    quote_key: quote.quote_key,
    estimated_days_min: quote.eta.min ?? undefined,
    estimated_days_max: quote.eta.max ?? undefined,
    selection_mode: "provider_aware_v2",
    shipping_option_id: getNonEmptyString(options?.shippingOptionId) ?? undefined,
    address_fingerprint: getNonEmptyString(options?.addressFingerprint) ?? undefined,
  }

  if (quote.delivery_type === 2) {
    if (!point) {
      throw new Error(
        "ApiShip pickup-point selection must include a selected pickup point before saving the shipping method."
      )
    }

    selection.point_out_id = point.selection_data.point_out_id ?? point.id
    selection.point_label = getApiShipPointLabel(point) ?? undefined
    selection.point_address = point.address?.trim() || undefined
  }

  return selection
}

export function isApiShipShippingSelectionData(
  data: Record<string, unknown> | null | undefined
): data is Record<string, unknown> {
  return parseApiShipShippingSelectionDataRecord(data) !== null
}

export function validateApiShipShippingSelectionData(
  data: Record<string, unknown> | null | undefined,
  options?: {
    shippingOptionId?: string | null
    shopperModeKey?: ApiShipShopperModeKey | null
    addressFingerprint?: string | null
  }
): ApiShipShippingSelectionData {
  const selection = parseApiShipShippingSelectionDataRecord(data)

  if (!selection) {
    throw new Error("ApiShip shipping selection must include exact provider and tariff data.")
  }

  if (selection.pickup_type !== 1 && selection.pickup_type !== 2) {
    throw new Error("ApiShip shipping selection must include pickup_type.")
  }

  if (selection.delivery_type !== 1 && selection.delivery_type !== 2) {
    throw new Error("ApiShip shipping selection must include delivery_type.")
  }

  if (!isApiShipShopperModeKey(selection.mode_key)) {
    throw new Error("ApiShip shipping selection must include shopper-visible mode_key.")
  }

  const normalizedShippingOptionId = getNonEmptyString(options?.shippingOptionId)
  const normalizedSelectionOptionId = getNonEmptyString(selection.shipping_option_id)

  if (
    options?.shopperModeKey &&
    selection.mode_key !== options.shopperModeKey
  ) {
    throw new Error("ApiShip shipping selection mode_key does not match the selected shopper mode.")
  }

  if (
    normalizedShippingOptionId &&
    isApiShipShopperModeKey(normalizedShippingOptionId) &&
    selection.mode_key !== normalizedShippingOptionId
  ) {
    throw new Error("ApiShip shipping selection mode_key does not match the selected shopper mode.")
  }

  if (
    normalizedShippingOptionId &&
    normalizedSelectionOptionId &&
    normalizedShippingOptionId !== normalizedSelectionOptionId
  ) {
    throw new Error(
      "ApiShip shipping selection shipping_option_id does not match the selected shipping option."
    )
  }

  if (selection.delivery_type === 2) {
    if (selection.point_out_id === undefined) {
      throw new Error("ApiShip pickup-point selection must include point_out_id.")
    }

    if (!selection.point_label?.trim()) {
      throw new Error("ApiShip pickup-point selection must include point_label.")
    }

    if (!selection.point_address?.trim()) {
      throw new Error("ApiShip pickup-point selection must include point_address.")
    }
  }

  return {
    ...selection,
    shipping_option_id:
      normalizedSelectionOptionId ?? normalizedShippingOptionId ?? undefined,
    address_fingerprint:
      getNonEmptyString(selection.address_fingerprint) ??
      getNonEmptyString(options?.addressFingerprint) ??
      undefined,
  }
}

export function readApiShipShippingSelectionData(
  shippingMethod: ShippingMethodLike
): ApiShipShippingSelectionData | null {
  return parseApiShipShippingSelectionDataRecord(shippingMethod?.data)
}

export function quoteMatchesApiShipSelection(
  quote: ApiShipRateQuote,
  selection: ApiShipShippingSelectionData | null
) {
  if (!selection) {
    return false
  }

  if (
    quote.provider_key !== selection.provider_key ||
    quote.tariff_id !== selection.tariff_id
  ) {
    return false
  }

  if (
    typeof selection.pickup_type === "number" &&
    quote.pickup_type !== selection.pickup_type
  ) {
    return false
  }

  if (
    typeof selection.delivery_type === "number" &&
    quote.delivery_type !== selection.delivery_type
  ) {
    return false
  }

  return true
}

export function isApiShipSelectionFresh(
  selection: ApiShipShippingSelectionData | null | undefined,
  addressFingerprint: string | null | undefined
) {
  if (!selection) {
    return false
  }

  const persistedFingerprint = getNonEmptyString(selection.address_fingerprint)
  const currentFingerprint = getNonEmptyString(addressFingerprint)

  if (!persistedFingerprint) {
    return true
  }

  if (!currentFingerprint) {
    return false
  }

  return persistedFingerprint === currentFingerprint
}

export function apiShipSelectionsEqual(
  left: ApiShipShippingSelectionData | null | undefined,
  right: ApiShipShippingSelectionData | null | undefined
) {
  if (!left || !right) {
    return false
  }

  return (
    left.provider_key === right.provider_key &&
    left.tariff_id === right.tariff_id &&
    left.pickup_type === right.pickup_type &&
    left.delivery_type === right.delivery_type &&
    left.mode_key === right.mode_key &&
    (left.point_out_id ?? null) === (right.point_out_id ?? null) &&
    (left.shipping_option_id ?? null) === (right.shipping_option_id ?? null) &&
    (left.address_fingerprint ?? null) === (right.address_fingerprint ?? null)
  )
}

export function getApiShipQuoteTitle(quote: ApiShipRateQuote) {
  return quote.tariff_name?.trim() || `Тариф #${quote.tariff_id}`
}

export function getApiShipPointLabel(point: ApiShipPoint) {
  return point.name?.trim() || point.code?.trim() || `ПВЗ #${point.id}`
}

export function getApiShipSelectionDetails(
  selection: ApiShipShippingSelectionData | null
) {
  if (!selection) {
    return null
  }

  const modeLabel = getApiShipModeLabel(selection.mode_key, selection.delivery_type)
  const providerLabel = formatApiShipProviderLabel(
    selection.provider_key,
    selection.provider_name
  )
  const tariffLabel = selection.tariff_name?.trim() || `Тариф #${selection.tariff_id}`
  const etaLabel = formatApiShipEtaLabel(
    selection.estimated_days_min ?? null,
    selection.estimated_days_max ?? null
  )

  return {
    modeLabel,
    providerLabel,
    tariffLabel,
    pointLabel: selection.point_label?.trim() || null,
    pointAddress: selection.point_address?.trim() || null,
    etaLabel,
    label: [providerLabel, tariffLabel].filter(Boolean).join(" — "),
  }
}

export function formatApiShipProviderLabel(
  providerKey: string,
  providerName?: string | null
) {
  const normalizedProviderName = providerName?.trim()

  if (normalizedProviderName) {
    return normalizedProviderName
  }

  const normalizedKey = providerKey.trim().toLowerCase()

  if (normalizedKey === "yataxi" || normalizedKey.includes("yandex")) {
    return "Яндекс.Доставка"
  }

  return providerKey.trim() || null
}

export function formatApiShipEtaLabel(
  minDays: number | null,
  maxDays: number | null
) {
  const min = typeof minDays === "number" ? minDays : null
  const max = typeof maxDays === "number" ? maxDays : null

  if (min === null && max === null) {
    return null
  }

  if (min !== null && max !== null && min !== max) {
    return `${min}–${max} дн.`
  }

  return `${max ?? min} дн.`
}

export function buildApiShipAddressFingerprint(
  address:
    | {
        address_1?: string | null
        city?: string | null
        country_code?: string | null
        postal_code?: string | null
        province?: string | null
      }
    | null
    | undefined
) {
  const fingerprint = [
    getNonEmptyString(address?.country_code)?.toLowerCase() ?? "",
    getNonEmptyString(address?.postal_code)?.toLowerCase() ?? "",
    getNonEmptyString(address?.province)?.toLowerCase() ?? "",
    getNonEmptyString(address?.city)?.toLowerCase() ?? "",
    getNonEmptyString(address?.address_1)?.toLowerCase() ?? "",
  ].join("|")

  return fingerprint === "||||" ? null : fingerprint
}

function parseApiShipShippingSelectionDataRecord(
  data: Record<string, unknown> | null | undefined
): ApiShipShippingSelectionData | null {
  if (!isRecord(data)) {
    return null
  }

  const providerKey = getNonEmptyString(data.provider_key)
  const tariffId = getFiniteInteger(data.tariff_id)

  if (!providerKey || tariffId === null) {
    return null
  }

  const deliveryType = getFiniteInteger(data.delivery_type)
  const modeKey = getNonEmptyString(data.mode_key)

  return {
    provider_key: providerKey,
    tariff_id: tariffId,
    pickup_type: getFiniteInteger(data.pickup_type) ?? undefined,
    delivery_type: deliveryType ?? undefined,
    mode_key:
      (isApiShipShopperModeKey(modeKey)
        ? modeKey
        : deriveModeKeyFromDeliveryType(deliveryType)) ?? APISHIP_TO_DOOR_OPTION_ID,
    provider_name: getNonEmptyString(data.provider_name) ?? undefined,
    tariff_name: getNonEmptyString(data.tariff_name) ?? undefined,
    quote_key: getNonEmptyString(data.quote_key) ?? undefined,
    point_out_id: getFiniteInteger(data.point_out_id) ?? undefined,
    point_label: getNonEmptyString(data.point_label) ?? undefined,
    point_address: getNonEmptyString(data.point_address) ?? undefined,
    estimated_days_min: getFiniteInteger(data.estimated_days_min) ?? undefined,
    estimated_days_max: getFiniteInteger(data.estimated_days_max) ?? undefined,
    selection_mode: getNonEmptyString(data.selection_mode) ?? undefined,
    shipping_option_id: getNonEmptyString(data.shipping_option_id) ?? undefined,
    address_fingerprint: getNonEmptyString(data.address_fingerprint) ?? undefined,
  }
}

function deriveModeKeyFromDeliveryType(deliveryType: number | null) {
  if (deliveryType === 2) {
    return APISHIP_TO_POINT_OPTION_ID
  }

  if (deliveryType === 1) {
    return APISHIP_TO_DOOR_OPTION_ID
  }

  return null
}

function getApiShipShopperModeKey(option: ShippingOptionLike) {
  const dataId = getNonEmptyString(option?.data?.id)

  if (isApiShipShopperModeKey(dataId)) {
    return dataId
  }

  const optionId = getNonEmptyString(option?.id)

  return isApiShipShopperModeKey(optionId) ? optionId : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function getNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function getFiniteInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) ? value : null
}
