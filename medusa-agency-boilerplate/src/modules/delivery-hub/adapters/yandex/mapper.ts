import { DELIVERY_HUB_MODE_CODE, DELIVERY_HUB_PROVIDER_YANDEX } from "../../constants"
import type { DeliveryQuote } from "../../domain/quote"
import type { DeliveryPickupPoint } from "../../domain/pickup-point"
import { DeliveryHubError } from "../../errors"
import type { DeliveryPickupWindow } from "../../domain/pickup-window"
import type {
  YandexCalculateOffersDto,
  YandexCheckPriceDto,
  YandexPickupPointDto,
  YandexPickupWindowDto,
  YandexPricingOfferDto,
} from "./dto"

export function mapYandexPickupPoint(dto: YandexPickupPointDto): DeliveryPickupPoint {
  const providerPointId = String(dto.id ?? dto.code ?? "")
  const operatorId = normalizeNullableString(dto.operator_id)
  const name = normalizeString(dto.name, providerPointId || "Yandex pickup point")
  const isYandexBranded = normalizeNullableBoolean(dto.is_yandex_branded)
  const isMarketPartner = normalizeNullableBoolean(dto.is_market_partner)

  return {
    provider_point_id: providerPointId,
    provider_point_code: normalizeNullableString(dto.code),
    provider_operator_id: operatorId,
    network_label: buildYandexPickupPointNetworkLabel({
      operator_id: operatorId,
      name,
      is_yandex_branded: isYandexBranded,
      is_market_partner: isMarketPartner,
    }),
    is_yandex_branded: isYandexBranded,
    is_market_partner: isMarketPartner,
    station_type: normalizeNullableString(dto.type),
    name,
    address: buildYandexPickupPointAddressLabel(dto),
    city: normalizeNullableString(dto.address?.locality),
    region: normalizeNullableString(dto.address?.province),
    postal_code: normalizeNullableString(dto.address?.zip_code),
    lat: normalizeNumber(dto.address?.latitude),
    lng: normalizeNumber(dto.address?.longitude),
    is_origin_dropoff_allowed: !!dto.available_for_dropoff,
    is_destination_pickup_allowed: true,
    payment_methods: Array.isArray(dto.payment_methods) ? dto.payment_methods : [],
    metadata: {
      available_for_dropoff: !!dto.available_for_dropoff,
      operator_id: operatorId,
      operator_station_id: normalizeNullableString(dto.operator_station_id),
      station_type: normalizeNullableString(dto.type),
      is_yandex_branded: isYandexBranded,
      is_market_partner: isMarketPartner,
      network_label: buildYandexPickupPointNetworkLabel({
        operator_id: operatorId,
        name,
        is_yandex_branded: isYandexBranded,
        is_market_partner: isMarketPartner,
      }),
    },
  }
}

export function mapYandexPickupWindow(dto: YandexPickupWindowDto): DeliveryPickupWindow {
  const intervalFrom = normalizeString(dto.interval_utc?.from ?? dto.from, "")
  const intervalTo = normalizeString(dto.interval_utc?.to ?? dto.to, "")
  const date = normalizeString(dto.date, deriveUtcDate(intervalFrom))
  const timeFrom = normalizeNullableString(dto.time_from) ?? deriveUtcTime(intervalFrom)
  const timeTo = normalizeNullableString(dto.time_to) ?? deriveUtcTime(intervalTo)

  return {
    date,
    time_from: timeFrom,
    time_to: timeTo,
    interval_utc: {
      from: intervalFrom,
      to: intervalTo,
    },
    label: buildPickupWindowLabel({
      ...dto,
      date,
      time_from: timeFrom,
      time_to: timeTo,
    }),
    metadata: {},
  }
}

export function mapYandexQuote(
  offer: YandexPricingOfferDto,
  input: {
    mode_code: string
    destination_point_id: string
    pickup_window_options?: DeliveryPickupWindow[]
  }
): DeliveryQuote {
  const pricing = parseYandexPricing(offer)
  const amount = pricing.amount
  const currency = pricing.currency
  const quoteKey = normalizeNullableString(offer.offer_id)

  if (amount === null || amount < 0) {
    throw createYandexOfferShapeError("price.amount|offer_details.pricing_total", offer, "missing_or_invalid_amount")
  }

  if (!currency) {
    throw createYandexOfferShapeError("price.currency|offer_details.pricing_total", offer, "missing_or_invalid_currency")
  }

  if (!quoteKey) {
    throw createYandexOfferShapeError("offer_id", offer, "missing_or_invalid_offer_id")
  }

  return buildYandexQuote({
    mode_code: input.mode_code,
    destination_point_id: input.destination_point_id,
    quote_key: quoteKey,
    amount,
    currency,
    delivery_eta_min: normalizeEtaDays(offer.eta?.days_min, offer.offer_details?.delivery_interval?.min),
    delivery_eta_max:
      normalizeEtaDays(offer.eta?.days_max, offer.offer_details?.delivery_interval?.max) ??
      normalizeEtaDays(offer.eta?.days_min, offer.offer_details?.delivery_interval?.min),
    pickup_window_options: input.pickup_window_options ?? [],
    raw_reference: {
      provider_offer_id: quoteKey,
      provider: DELIVERY_HUB_PROVIDER_YANDEX,
    },
  })
}

export function mapYandexCheckPriceQuote(
  response: YandexCheckPriceDto,
  input: {
    mode_code: string
    destination_point_id: string
    quote_key: string
    pickup_window_options?: DeliveryPickupWindow[]
  }
): DeliveryQuote {
  const amount = normalizeNumber(response.price)
  const currency = normalizeNullableString(response.currency_rules?.code) ??
    normalizeNullableString(response.currency)

  if (amount === null || amount < 0) {
    throw createYandexCheckPriceShapeError("price", response, "missing_or_invalid_amount")
  }

  if (!currency) {
    throw createYandexCheckPriceShapeError("currency_rules.code|currency", response, "missing_or_invalid_currency")
  }

  return buildYandexQuote({
    mode_code: input.mode_code,
    destination_point_id: input.destination_point_id,
    quote_key: input.quote_key,
    amount,
    currency,
    delivery_eta_min: normalizeEtaMinutesToDays(response.eta),
    delivery_eta_max: normalizeEtaMinutesToDays(response.eta),
    pickup_window_options: input.pickup_window_options ?? [],
    raw_reference: {
      provider: DELIVERY_HUB_PROVIDER_YANDEX,
      provider_price_endpoint: "check-price",
    },
  })
}

export function mapYandexCalculateQuote(
  response: YandexCalculateOffersDto,
  input: {
    mode_code: string
    destination_point_id: string
    quote_key: string
    pickup_window_options?: DeliveryPickupWindow[]
  }
): DeliveryQuote {
  const offers = extractYandexCalculateOffers(response)
  const offer = selectBestYandexCalculateOffer(offers)

  if (!offer) {
    throw createYandexCalculateShapeError("offers", response, "missing_or_empty_offers")
  }

  const pricing = parseYandexPricing(offer)
  const amount = pricing.amount
  const currency = pricing.currency

  if (amount === null || amount < 0) {
    throw createYandexCalculateShapeError("price|pricing_total|pricing", response, "missing_or_invalid_amount")
  }

  if (!currency) {
    throw createYandexCalculateShapeError("currency|pricing_total|pricing", response, "missing_or_invalid_currency")
  }

  return buildYandexQuote({
    mode_code: input.mode_code,
    destination_point_id: input.destination_point_id,
    quote_key: input.quote_key,
    amount,
    currency,
    delivery_eta_min: normalizeEtaDays(
      offer.eta?.days_min,
      offer.offer_details?.delivery_interval?.min ?? offer.delivery_interval?.min
    ),
    delivery_eta_max:
      normalizeEtaDays(
        offer.eta?.days_max,
        offer.offer_details?.delivery_interval?.max ?? offer.delivery_interval?.max
      ) ??
      normalizeEtaDays(
        offer.eta?.days_min,
        offer.offer_details?.delivery_interval?.min ?? offer.delivery_interval?.min
      ),
    pickup_window_options: input.pickup_window_options ?? [],
    raw_reference: {
      provider: DELIVERY_HUB_PROVIDER_YANDEX,
      provider_price_endpoint: "offers-calculate",
      provider_offer_present: true,
    },
  })
}

function buildYandexPickupPointAddressLabel(dto: YandexPickupPointDto) {
  const address = dto.address ?? null
  const fullAddress = normalizeNullableString(address?.full_address)
  const locality = normalizeNullableString(address?.locality)

  if (!fullAddress) {
    return ""
  }

  if (!locality || fullAddress.toLocaleLowerCase("ru-RU").includes(locality.toLocaleLowerCase("ru-RU"))) {
    return fullAddress
  }

  return `${locality}, ${fullAddress}`
}

function buildYandexPickupPointNetworkLabel(input: {
  operator_id: string | null
  name: string
  is_yandex_branded: boolean | null
  is_market_partner: boolean | null
}) {
  if (input.operator_id === "5post" || /5\s*post|пят[её]роч/i.test(input.name)) {
    return "5 Post"
  }

  if (
    input.operator_id === "market_l4g" ||
    input.is_yandex_branded === true ||
    /яндекс|yandex/i.test(input.name)
  ) {
    return input.is_yandex_branded === true ? "Яндекс Маркет" : "Яндекс Маркет / партнёр"
  }

  if (input.is_market_partner === true) {
    return "Партнёрский ПВЗ Яндекса"
  }

  return input.operator_id
}

function normalizeNullableBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null
}

function buildYandexQuote(input: {
  mode_code: string
  destination_point_id: string
  quote_key: string
  amount: number
  currency: string
  delivery_eta_min: number | null
  delivery_eta_max: number | null
  pickup_window_options?: DeliveryPickupWindow[]
  raw_reference: Record<string, unknown>
}): DeliveryQuote {
  return {
    carrier_code: DELIVERY_HUB_PROVIDER_YANDEX,
    carrier_label: "Yandex Delivery",
    mode_code: input.mode_code,
    quote_key: input.quote_key,
    amount: input.amount,
    currency_code: input.currency.toLowerCase(),
    delivery_eta_min: input.delivery_eta_min,
    delivery_eta_max: input.delivery_eta_max,
    pickup_point_required: true,
    pickup_point_ids: [input.destination_point_id],
    pickup_points_embedded: [],
    pickup_window_required: false,
    pickup_window_options: input.pickup_window_options ?? [],
    raw_reference: input.raw_reference,
  }
}

function createYandexOfferShapeError(
  field: string,
  offer: YandexPricingOfferDto,
  reason: string
) {
  return new DeliveryHubError({
    code: "DELIVERY_HUB_PROVIDER_ERROR",
    message: `Yandex Delivery response shape drift: invalid quote offer ${field}`,
    status: 502,
    details: {
      provider_status: "ok",
      error_category: "provider_shape",
      reason,
      expected_field: field,
      offer_shape: describeYandexOfferShape(offer),
    },
  })
}

function extractYandexCalculateOffers(response: YandexCalculateOffersDto): YandexPricingOfferDto[] {
  if (Array.isArray(response.offers)) {
    return response.offers
  }

  if (Array.isArray(response.data?.offers)) {
    return response.data.offers
  }

  return []
}

function selectBestYandexCalculateOffer(offers: YandexPricingOfferDto[]) {
  return offers
    .map((offer) => ({
      offer,
      amount: parseYandexPricing(offer).amount,
    }))
    .filter((entry): entry is { offer: YandexPricingOfferDto; amount: number } =>
      entry.amount !== null && entry.amount >= 0
    )
    .sort((left, right) => left.amount - right.amount)[0]?.offer ?? offers[0] ?? null
}

function createYandexCalculateShapeError(
  field: string,
  response: YandexCalculateOffersDto,
  reason: string
) {
  return new DeliveryHubError({
    code: "DELIVERY_HUB_PROVIDER_ERROR",
    message: `Yandex Delivery response shape drift: invalid offers-calculate ${field}`,
    status: 502,
    details: {
      provider_status: "ok",
      error_category: "provider_shape",
      reason,
      expected_field: field,
      response_shape: describeYandexCalculateResponseShape(response),
    },
  })
}

function describeYandexCalculateResponseShape(response: YandexCalculateOffersDto): Record<string, unknown> {
  const root = response && typeof response === "object" ? response as Record<string, unknown> : {}
  const data = root.data && typeof root.data === "object" ? root.data as Record<string, unknown> : null
  const offers = Array.isArray(root.offers)
    ? root.offers
    : Array.isArray(data?.offers)
      ? data.offers
      : []

  return {
    type: response && typeof response === "object" ? "object" : typeof response,
    keys: Object.keys(root).sort(),
    data_keys: data ? Object.keys(data).sort() : null,
    offers_count: offers.length,
    first_offer_shape: offers.length ? describeYandexOfferShape(offers[0] as YandexPricingOfferDto) : null,
  }
}

function describeYandexOfferShape(offer: YandexPricingOfferDto): Record<string, unknown> {
  const root = offer && typeof offer === "object" ? offer as Record<string, unknown> : {}
  const price = root.price && typeof root.price === "object" ? root.price as Record<string, unknown> : null
  const eta = root.eta && typeof root.eta === "object" ? root.eta as Record<string, unknown> : null

  return {
    type: offer && typeof offer === "object" ? "object" : typeof offer,
    keys: Object.keys(root).sort(),
    price_keys: price ? Object.keys(price).sort() : null,
    eta_keys: eta ? Object.keys(eta).sort() : null,
    offer_details_keys:
      root.offer_details && typeof root.offer_details === "object"
        ? Object.keys(root.offer_details as Record<string, unknown>).sort()
        : null,
  }
}

function createYandexCheckPriceShapeError(
  field: string,
  response: YandexCheckPriceDto,
  reason: string
) {
  return new DeliveryHubError({
    code: "DELIVERY_HUB_PROVIDER_ERROR",
    message: `Yandex Delivery response shape drift: invalid check-price ${field}`,
    status: 502,
    details: {
      provider_status: "ok",
      error_category: "provider_shape",
      reason,
      expected_field: field,
      response_shape: describeYandexCheckPriceShape(response),
    },
  })
}

function describeYandexCheckPriceShape(response: YandexCheckPriceDto): Record<string, unknown> {
  const root = response && typeof response === "object" ? response as Record<string, unknown> : {}
  const currencyRules = root.currency_rules && typeof root.currency_rules === "object"
    ? root.currency_rules as Record<string, unknown>
    : null

  return {
    type: response && typeof response === "object" ? "object" : typeof response,
    keys: Object.keys(root).sort(),
    currency_rules_keys: currencyRules ? Object.keys(currencyRules).sort() : null,
  }
}

function parseYandexPricing(offer: YandexPricingOfferDto) {
  const directAmount = normalizeNumber(offer.price?.amount)
  const directCurrency = normalizeNullableString(offer.price?.currency)

  if (directAmount !== null || directCurrency) {
    return {
      amount: directAmount,
      currency: directCurrency,
    }
  }

  const parsedPricing = parseYandexMoney(offer.offer_details?.pricing_total) ??
    parseYandexMoney(offer.offer_details?.pricing) ??
    parseYandexMoney(offer.pricing_total) ??
    parseYandexMoney(offer.pricing)
  const fallbackCurrency = normalizeNullableString(offer.currency)

  return {
    amount: parsedPricing?.amount ?? null,
    currency: parsedPricing?.currency ?? fallbackCurrency,
  }
}

function parseYandexMoney(value: unknown) {
  if (typeof value !== "string") {
    return null
  }

  const match = value.trim().match(/^(-?\d+(?:[.,]\d+)?)\s*([A-Za-zА-Яа-я]{3})$/u)

  if (!match) {
    return null
  }

  const amount = Number(match[1].replace(",", "."))

  if (!Number.isFinite(amount)) {
    return null
  }

  return {
    amount,
    currency: match[2],
  }
}

function normalizeEtaDays(value: unknown, intervalBoundary?: string | null) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (!intervalBoundary) {
    return null
  }

  const parsed = new Date(intervalBoundary)

  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  const diffMs = parsed.getTime() - Date.now()
  return Math.max(0, Math.ceil(diffMs / 86_400_000))
}

function normalizeEtaMinutesToDays(value: unknown) {
  const minutes = normalizeNumber(value)

  if (minutes === null) {
    return null
  }

  return Math.max(0, Math.ceil(minutes / 1440))
}

function buildPickupWindowLabel(dto: YandexPickupWindowDto) {
  const date = normalizeString(dto.date, "")
  const from = normalizeString(dto.time_from, "")
  const to = normalizeString(dto.time_to, "")

  return [date, from && to ? `${from}-${to}` : from || to].filter(Boolean).join(" ")
}

function deriveUtcDate(value: string) {
  if (!value.trim()) {
    return ""
  }

  const parsed = new Date(value)

  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10)
}

function deriveUtcTime(value: string) {
  if (!value.trim()) {
    return null
  }

  const parsed = new Date(value)

  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(11, 16)
}

function normalizeString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback
}

function normalizeNullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function normalizeNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}
