import type { MedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  APISHIP_TO_DOOR_OPTION_ID,
  APISHIP_TO_POINT_OPTION_ID,
  type ApiShipSettings,
  type ApiShipShopperModeKey,
  getShopperModeLabel,
  resolveAllowedPickupTypesForShopperMode,
} from "./apiship-settings"

export type CartShippingAddress = {
  address_1?: string | null
  address_2?: string | null
  city?: string | null
  country_code?: string | null
  province?: string | null
  postal_code?: string | null
}

export type CartRecord = {
  id: string
  currency_code: string
  shipping_address?: CartShippingAddress | null
  shipping_methods?: {
    shipping_option_id?: string | null
  }[]
}

export type ShippingOptionRecord = {
  id: string
  name?: string | null
  provider_id?: string | null
  data?: Record<string, unknown> | null
}

export type CalculatedShippingOption = {
  id: string
  amount?: number | null
  calculated_price?: {
    calculated_amount?: number | null
    is_calculated_price_tax_inclusive?: boolean
    data?: Record<string, unknown> | null
  } | null
}

export type ApiShipTariff = {
  deliveryCost?: number
  daysMin?: number
  daysMax?: number
  workDaysMin?: number
  workDaysMax?: number
  calendarDaysMin?: number
  calendarDaysMax?: number
  providerKey?: string
  tariffId?: number
  tariffName?: string
  providerName?: string
  pickupTypes?: number[]
  deliveryTypes?: number[]
  pointIds?: number[]
}

export type ApiShipTariffGroup = {
  providerKey?: string
  providerName?: string
  tariffs?: ApiShipTariff[]
}

export type ApiShipCalculatedData = {
  deliveryToDoor?: ApiShipTariffGroup[]
  deliveryToPoint?: ApiShipTariffGroup[]
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

export async function queryApiShipCalculation(
  req: MedusaRequest,
  cartId: string,
  shippingOptionId: string,
  data?: Record<string, unknown>
) {
  const protocol = req.protocol || "http"
  const host = req.get("host")
  const url = `${protocol}://${host}/store/shipping-options/${shippingOptionId}/calculate`

  const response = await fetch(url, {
    method: "POST",
    headers: forwardHeaders(req.headers),
    body: JSON.stringify({
      cart_id: cartId,
      ...(data ? { data } : {}),
    }),
  })

  if (!response.ok) {
    return null
  }

  const payload = (await response.json()) as {
    shipping_option?: CalculatedShippingOption
  }

  return payload.shipping_option ?? null
}

export function buildApiShipQuotesResponse(input: {
  cartCurrencyCode: string
  shippingOption: ShippingOptionRecord
  calculatedData: ApiShipCalculatedData
  settings: ApiShipSettings
}) {
  const shopperModeKey = resolveShopperModeKeyFromShippingOption(input.shippingOption)

  if (!shopperModeKey) {
    return buildEmptyApiShipRatesResponse("apiship_mode_not_supported")
  }

  const allowedPickupTypes = resolveAllowedPickupTypesForShopperMode(
    input.settings,
    shopperModeKey
  )
  const deliveryType = shopperModeKey === APISHIP_TO_POINT_OPTION_ID ? 2 : 1
  const groups = deliveryType === 2 ? input.calculatedData.deliveryToPoint ?? [] : input.calculatedData.deliveryToDoor ?? []

  const groupedQuotes = groups
    .map((group) => {
      const tariffs = (group.tariffs ?? [])
        .flatMap((tariff) => {
          const tariffPickupTypes = normalizeTariffPickupTypes(tariff.pickupTypes)
          const pickupTypes = (tariffPickupTypes.length ? tariffPickupTypes : allowedPickupTypes).filter(
            (pickupType) => allowedPickupTypes.includes(pickupType as 1 | 2)
          )

          return pickupTypes
            .map((pickupType) =>
              buildApiShipRateQuote({
                cartCurrencyCode: input.cartCurrencyCode,
                shippingOption: input.shippingOption,
                group,
                tariff,
                pickupType,
                deliveryType,
                shopperModeKey,
              })
            )
            .filter((quote): quote is ApiShipRateQuote => quote !== null)
        })
        .sort((left, right) => left.amount - right.amount)

      if (!tariffs.length) {
        return null
      }

      return {
        provider_key: tariffs[0].provider_key,
        provider_name: tariffs[0].provider_name,
        provider_label: tariffs[0].provider_label,
        mode_key: tariffs[0].mode_key,
        mode_label: tariffs[0].mode_label,
        pickup_type: tariffs[0].pickup_type,
        delivery_type: tariffs[0].delivery_type,
        tariffs,
      } satisfies ApiShipRateGroup
    })
    .filter((group): group is ApiShipRateGroup => group !== null)
    .sort((left, right) => left.tariffs[0].amount - right.tariffs[0].amount)

  const quotes = groupedQuotes
    .flatMap((group) => group.tariffs)
    .sort((left, right) => left.amount - right.amount)

  if (!quotes.length) {
    return buildEmptyApiShipRatesResponse("apiship_quotes_unavailable")
  }

  return {
    quotes,
    grouped_quotes: groupedQuotes,
    selected_quote: quotes[0] ?? null,
    selection_mode: "provider_aware_v2",
  }
}

export function buildEmptyApiShipRatesResponse(code: string) {
  return {
    quotes: [],
    grouped_quotes: [],
    selected_quote: null,
    selection_mode: "provider_aware_v2",
    code,
  }
}

export async function getCartForApiShip(query: any, cartId: string) {
  const { data } = await query.graph({
    entity: "cart",
    fields: [
      "id",
      "currency_code",
      "shipping_address.address_1",
      "shipping_address.address_2",
      "shipping_address.city",
      "shipping_address.country_code",
      "shipping_address.province",
      "shipping_address.postal_code",
      "shipping_methods.shipping_option_id",
    ],
    filters: {
      id: cartId,
    },
  })

  return (data?.[0] as CartRecord | undefined) ?? null
}

export async function getShippingOptionForApiShip(query: any, shippingOptionId: string) {
  const { data } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "name", "provider_id", "data"],
    filters: {
      id: shippingOptionId,
    },
  })

  return (data?.[0] as ShippingOptionRecord | undefined) ?? null
}

export function hasAddressForApiShip(address?: CartShippingAddress | null) {
  return !!(
    address?.country_code?.trim() &&
    address.city?.trim() &&
    address.address_1?.trim()
  )
}

export function forwardHeaders(headers: MedusaRequest["headers"]) {
  const xPublishableApiKey = headers["x-publishable-api-key"]
  const authorization = headers.authorization

  return {
    "content-type": "application/json",
    ...(typeof xPublishableApiKey === "string"
      ? { "x-publishable-api-key": xPublishableApiKey }
      : {}),
    ...(typeof authorization === "string" ? { authorization } : {}),
  }
}

export function getApiShipQuery(req: MedusaRequest) {
  return req.scope.resolve(ContainerRegistrationKeys.QUERY)
}

export function resolveEstimatedDays(tariff: ApiShipTariff) {
  const legacyMin = getFiniteNumber(tariff.daysMin)
  const legacyMax = getFiniteNumber(tariff.daysMax)

  if (legacyMin !== null || legacyMax !== null) {
    return {
      min: legacyMin,
      max: legacyMax ?? legacyMin,
    }
  }

  const workMin = getFiniteNumber(tariff.workDaysMin)
  const workMax = getFiniteNumber(tariff.workDaysMax)

  if (workMin !== null || workMax !== null) {
    return {
      min: workMin,
      max: workMax ?? workMin,
    }
  }

  const calendarMin = getFiniteNumber(tariff.calendarDaysMin)
  const calendarMax = getFiniteNumber(tariff.calendarDaysMax)

  return {
    min: calendarMin,
    max: calendarMax ?? calendarMin,
  }
}

export function createQuoteKey(providerKey: string, tariffId: number, pickupType: number, deliveryType: number) {
  return `${providerKey}:${tariffId}:${pickupType}:${deliveryType}`
}

export function resolveShopperModeKeyFromShippingOption(
  shippingOption: ShippingOptionRecord
): ApiShipShopperModeKey | null {
  const dataId = getNonEmptyString(shippingOption.data?.id)

  if (dataId === APISHIP_TO_DOOR_OPTION_ID || dataId === APISHIP_TO_POINT_OPTION_ID) {
    return dataId
  }

  return null
}

function normalizeTariffPickupTypes(value: unknown) {
  return Array.isArray(value)
    ? value
        .map((entry) => getFiniteInteger(entry))
        .filter((entry): entry is number => entry !== null)
    : []
}

function buildApiShipRateQuote(input: {
  cartCurrencyCode: string
  shippingOption: ShippingOptionRecord
  group: ApiShipTariffGroup
  tariff: ApiShipTariff
  pickupType: number
  deliveryType: number
  shopperModeKey: ApiShipShopperModeKey
}): ApiShipRateQuote | null {
  const amount = getFiniteNumber(input.tariff.deliveryCost)
  const providerKey = getNonEmptyString(input.tariff.providerKey ?? input.group.providerKey)
  const tariffId = getFiniteInteger(input.tariff.tariffId)

  if (amount === null || !providerKey || tariffId === null) {
    return null
  }

  const eta = resolveEstimatedDays(input.tariff)
  const providerName = getNonEmptyString(
    input.tariff.providerName ?? input.group.providerName
  )
  const tariffName = getNonEmptyString(input.tariff.tariffName)
  const providerLabel = formatApiShipProviderLabel(providerKey, providerName)
  const pointIds = Array.isArray(input.tariff.pointIds)
    ? input.tariff.pointIds
        .map((entry) => getFiniteInteger(entry))
        .filter((entry): entry is number => entry !== null)
    : []

  return {
    provider_key: providerKey,
    provider_name: providerName,
    provider_label: providerLabel ?? tariffName ?? providerKey,
    tariff_id: tariffId,
    tariff_name: tariffName,
    quote_key: createQuoteKey(providerKey, tariffId, input.pickupType, input.deliveryType),
    pickup_type: input.pickupType,
    delivery_type: input.deliveryType,
    mode_key: input.shopperModeKey,
    mode_label: getShopperModeLabel(input.shopperModeKey),
    amount,
    eta,
    shipping_option_id: input.shippingOption.id,
    shipping_option_name: input.shippingOption.name ?? getShopperModeLabel(input.shopperModeKey),
    point_ids: pointIds,
    point_selection_required: input.deliveryType === 2,
    point_selection_supported: input.deliveryType === 2,
  }
}

function getFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function getFiniteInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) ? value : null
}

function getNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function formatApiShipProviderLabel(
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
