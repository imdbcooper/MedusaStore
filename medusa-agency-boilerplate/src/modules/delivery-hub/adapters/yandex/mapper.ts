import { DELIVERY_HUB_MODE_CODE, DELIVERY_HUB_PROVIDER_YANDEX } from "../../constants"
import type { DeliveryQuote } from "../../domain/quote"
import type { DeliveryPickupPoint } from "../../domain/pickup-point"
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
  const amount = normalizeNumber(offer.price?.amount) ?? 0
  const currency = normalizeString(offer.price?.currency, "RUB")
  const quoteKey = normalizeString(
    offer.offer_id,
    `${DELIVERY_HUB_PROVIDER_YANDEX}:${input.mode_code}:${input.destination_point_id}`
  )

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
      provider_offer_id: offer.offer_id ?? null,
      provider: DELIVERY_HUB_PROVIDER_YANDEX,
    },
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
