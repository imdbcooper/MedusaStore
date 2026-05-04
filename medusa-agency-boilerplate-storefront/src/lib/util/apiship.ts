export const APISHIP_STORE_API_PREFIX = "/store/apiship" as const

export const APISHIP_PICKUP_POINT_SHIPPING_OPTION_PROVIDER_DATA_ID =
  "apiship_doortopoint" as const

export const APISHIP_PICKUP_POINT_PROVIDER_ID = "apiship_apiship" as const
export const APISHIP_FULFILLMENT_PROVIDER_CODE = "apiship" as const

export type ApishipPointListQuery = {
  key?: string
  filter?: string
  fields?: string
  limit?: number
  offset?: number
}

export type ApishipCalculateShippingOptionPayload = {
  cart_id: string
}

export type ApishipProvider = {
  key?: string
  name?: string
  description?: string
}

export type ApishipPoint = {
  id?: string | number
  code?: string
  name?: string
  providerKey?: string
  providerName?: string
  countryCode?: string
  region?: string
  city?: string
  street?: string
  address?: string
  lat?: number
  lng?: number
  latitude?: number
  longitude?: number
  phone?: string
  email?: string
  timetable?: string
  [key: string]: unknown
}

export type ApishipTariff = {
  id?: string | number
  tariffId?: string | number
  tariff_id?: string | number
  providerKey?: string
  deliveryCost?: number
  delivery_cost?: number
  amount?: number
  price?: number
  daysMin?: number
  days_min?: number
  daysMax?: number
  days_max?: number
  deliveryMin?: number
  delivery_min?: number
  deliveryMax?: number
  delivery_max?: number
  [key: string]: unknown
}

export type ApishipCalculation = {
  deliveryToDoor?: Array<{
    providerKey?: string
    tariffs?: ApishipTariff[]
    [key: string]: unknown
  }>
  deliveryToPoint?: Array<{
    providerKey?: string
    tariffs?: ApishipTariff[]
    [key: string]: unknown
  }>
  [key: string]: unknown
}

export type ApishipProviderListResponse = {
  providers: ApishipProvider[]
}

export type ApishipPointListResponse = {
  points: ApishipPoint[]
}

export type ApishipCalculationResponse = {
  calculation: ApishipCalculation
}

export type ApishipSelectedDeliveryData = {
  tariff: ApishipTariff
  point?: ApishipPoint
  contextKey?: string
}

export type ApishipAddShippingMethodData = {
  apishipData: ApishipSelectedDeliveryData
}

type ApishipCartLike = {
  id?: string
  currency_code?: string | null
  subtotal?: number | null
  shipping_address?: {
    country_code?: string | null
    city?: string | null
    postal_code?: string | null
    address_1?: string | null
  } | null
  shipping_methods?: unknown[] | null
}

type ApishipReadinessOptions = {
  contextKey?: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function toNonEmptyString(value: unknown) {
  if (value === undefined || value === null) {
    return null
  }

  const normalized = String(value).trim()

  return normalized.length > 0 ? normalized : null
}

function toFiniteNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string" && value.trim()) {
    const numericValue = Number(value)

    return Number.isFinite(numericValue) ? numericValue : null
  }

  return null
}

export function getApishipCheckoutAddressRequestKey(cart: ApishipCartLike) {
  const address = cart.shipping_address

  if (!address?.country_code || !address.city) {
    return null
  }

  return [
    address.country_code.toUpperCase(),
    address.city,
    address.postal_code,
    address.address_1,
  ]
    .filter(Boolean)
    .join("|")
}

export function getApishipCheckoutContextKey(
  cart: ApishipCartLike,
  shippingOptionId?: string | null
) {
  return [
    cart.id ?? "missing_cart",
    cart.currency_code ?? "missing_currency",
    String(cart.subtotal ?? ""),
    getApishipCheckoutAddressRequestKey(cart) ?? "missing_address",
    shippingOptionId ?? "missing_apiship_option",
  ].join("|")
}

export function getApishipPointId(point?: ApishipPoint | null) {
  const id = point?.id ?? point?.code
  return toNonEmptyString(id)
}

export function getApishipPersistablePointId(point?: ApishipPoint | null) {
  return toNonEmptyString(point?.id)
}

export function getApishipTariffId(tariff?: ApishipTariff | null) {
  const id = tariff?.tariffId ?? tariff?.tariff_id
  return toNonEmptyString(id)
}

export function getApishipTariffCost(tariff: ApishipTariff) {
  const cost =
    tariff.deliveryCost ?? tariff.delivery_cost ?? tariff.amount ?? tariff.price

  return typeof cost === "number" && Number.isFinite(cost) ? cost : null
}

export function normalizeApishipTariffForCheckout(
  tariff?: ApishipTariff | null
): ApishipTariff | null {
  if (!tariff) {
    return null
  }

  const tariffId = toFiniteNumber(tariff.tariffId ?? tariff.tariff_id)
  const providerKey = toNonEmptyString(tariff.providerKey)
  const deliveryCost = getApishipTariffCost(tariff)

  if (tariffId === null || !providerKey || deliveryCost === null) {
    return null
  }

  return {
    ...tariff,
    tariffId,
    providerKey,
    deliveryCost,
  }
}

export function getApishipDataFromShippingMethod(method?: unknown) {
  if (!isRecord(method)) {
    return null
  }

  const methodData = method.data

  if (!isRecord(methodData) || !isRecord(methodData.apishipData)) {
    return null
  }

  return methodData.apishipData as Partial<ApishipSelectedDeliveryData>
}

export function isApishipShippingMethodLike(method?: unknown) {
  if (!isRecord(method)) {
    return false
  }

  const methodData = isRecord(method.data) ? method.data : null
  const provider = isRecord(method.provider) ? method.provider : null
  const shippingOption = isRecord(method.shipping_option) ? method.shipping_option : null
  const shippingOptionData = isRecord(shippingOption?.data)
    ? shippingOption.data
    : null
  const providerDataId =
    methodData?.id ??
    methodData?.provider_data_id ??
    methodData?.providerDataId ??
    methodData?.code ??
    shippingOptionData?.id ??
    shippingOptionData?.provider_data_id ??
    shippingOptionData?.providerDataId ??
    shippingOptionData?.code

  return Boolean(
    getApishipDataFromShippingMethod(method) ||
      method.provider_id === APISHIP_PICKUP_POINT_PROVIDER_ID ||
      provider?.id === APISHIP_PICKUP_POINT_PROVIDER_ID ||
      shippingOption?.provider_id === APISHIP_PICKUP_POINT_PROVIDER_ID ||
      methodData?.provider_id === APISHIP_PICKUP_POINT_PROVIDER_ID ||
      providerDataId === APISHIP_PICKUP_POINT_SHIPPING_OPTION_PROVIDER_DATA_ID ||
      methodData?.provider_code === APISHIP_FULFILLMENT_PROVIDER_CODE ||
      shippingOptionData?.provider_code === APISHIP_FULFILLMENT_PROVIDER_CODE
  )
}

export function isApishipShippingMethodReady(
  method?: unknown,
  options: ApishipReadinessOptions = {}
) {
  if (!isApishipShippingMethodLike(method)) {
    return false
  }

  const apishipData = getApishipDataFromShippingMethod(method)
  const tariff = normalizeApishipTariffForCheckout(apishipData?.tariff)
  const pointId = getApishipPersistablePointId(apishipData?.point)

  if (!tariff || !pointId) {
    return false
  }

  if (options.contextKey && apishipData?.contextKey !== options.contextKey) {
    return false
  }

  return true
}

export function isApishipCheckoutReady(
  cart?: ApishipCartLike | null,
  options: ApishipReadinessOptions = {}
) {
  const shippingMethod = cart?.shipping_methods?.at(-1)

  return isApishipShippingMethodReady(shippingMethod, options)
}

export function shapeApishipPointListQuery(
  input: ApishipPointListQuery = {}
): ApishipPointListQuery {
  const query: ApishipPointListQuery = {}

  if (input.key) {
    query.key = input.key
  }

  if (input.filter) {
    query.filter = input.filter
  }

  if (input.fields) {
    query.fields = input.fields
  }

  if (typeof input.limit === "number") {
    query.limit = input.limit
  }

  if (typeof input.offset === "number") {
    query.offset = input.offset
  }

  return query
}

export function shapeApishipCalculatePayload(
  cartId: string
): ApishipCalculateShippingOptionPayload {
  return {
    cart_id: cartId,
  }
}

export function shapeApishipAddShippingMethodData(
  input: ApishipSelectedDeliveryData
): ApishipAddShippingMethodData {
  return {
    apishipData: input,
  }
}
