import { DELIVERY_HUB_MODE_CODE, DELIVERY_HUB_PROVIDER_YANDEX } from "../../constants"
import type { DeliveryQuote } from "../../domain/quote"
import type { DeliveryPickupPoint } from "../../domain/pickup-point"
import { DeliveryHubError } from "../../errors"
import type { DeliveryPickupWindow } from "../../domain/pickup-window"
import type {
  YandexPickupPointDto,
  YandexPickupWindowDto,
  YandexPricingOfferDto,
} from "./dto"

export function mapYandexPickupPoint(dto: YandexPickupPointDto): DeliveryPickupPoint {
  const providerPointId = String(dto.id ?? dto.code ?? "")

  return {
    provider_point_id: providerPointId,
    provider_point_code: normalizeNullableString(dto.code),
    name: normalizeString(dto.name, providerPointId || "Yandex pickup point"),
    address: normalizeString(dto.address?.full_address, ""),
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
    },
  }
}

export function mapYandexPickupWindow(dto: YandexPickupWindowDto): DeliveryPickupWindow {
  return {
    date: normalizeString(dto.date, ""),
    time_from: normalizeNullableString(dto.time_from),
    time_to: normalizeNullableString(dto.time_to),
    interval_utc: {
      from: normalizeString(dto.interval_utc?.from, ""),
      to: normalizeString(dto.interval_utc?.to, ""),
    },
    label: buildPickupWindowLabel(dto),
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
  const amount = normalizeNumber(offer.price?.amount)
  const currency = normalizeNullableString(offer.price?.currency)
  const quoteKey = normalizeNullableString(offer.offer_id)

  if (amount === null || amount < 0) {
    throw createYandexOfferShapeError("price.amount", offer, "missing_or_invalid_amount")
  }

  if (!currency) {
    throw createYandexOfferShapeError("price.currency", offer, "missing_or_invalid_currency")
  }

  if (!quoteKey) {
    throw createYandexOfferShapeError("offer_id", offer, "missing_or_invalid_offer_id")
  }

  return {
    carrier_code: DELIVERY_HUB_PROVIDER_YANDEX,
    carrier_label: "Yandex Delivery",
    mode_code: input.mode_code,
    quote_key: quoteKey,
    amount,
    currency_code: currency.toLowerCase(),
    delivery_eta_min: offer.eta?.days_min ?? null,
    delivery_eta_max: offer.eta?.days_max ?? offer.eta?.days_min ?? null,
    pickup_point_required: true,
    pickup_point_ids: [input.destination_point_id],
    pickup_points_embedded: [],
    pickup_window_required:
      input.mode_code === DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint,
    pickup_window_options: input.pickup_window_options ?? [],
    raw_reference: {
      provider_offer_id: quoteKey,
      provider: DELIVERY_HUB_PROVIDER_YANDEX,
    },
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

function describeYandexOfferShape(offer: YandexPricingOfferDto): Record<string, unknown> {
  const root = offer && typeof offer === "object" ? offer as Record<string, unknown> : {}
  const price = root.price && typeof root.price === "object" ? root.price as Record<string, unknown> : null
  const eta = root.eta && typeof root.eta === "object" ? root.eta as Record<string, unknown> : null

  return {
    type: offer && typeof offer === "object" ? "object" : typeof offer,
    keys: Object.keys(root).sort(),
    price_keys: price ? Object.keys(price).sort() : null,
    eta_keys: eta ? Object.keys(eta).sort() : null,
  }
}

function buildPickupWindowLabel(dto: YandexPickupWindowDto) {
  const date = normalizeString(dto.date, "")
  const from = normalizeString(dto.time_from, "")
  const to = normalizeString(dto.time_to, "")

  return [date, from && to ? `${from}-${to}` : from || to].filter(Boolean).join(" ")
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
