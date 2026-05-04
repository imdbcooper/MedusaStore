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
  tariffId?: number
  tariff_id?: number
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
}

export type ApishipAddShippingMethodData = {
  apishipData: ApishipSelectedDeliveryData
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
