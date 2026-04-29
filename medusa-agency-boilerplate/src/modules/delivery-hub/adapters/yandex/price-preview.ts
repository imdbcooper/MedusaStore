import crypto from "node:crypto"
import { DeliveryHubError } from "../../errors"
import type { DeliveryHubAdapter, DeliveryHubRoutePointAddressInput } from "../types"

export type YandexCheckPriceItemsInput = Parameters<DeliveryHubAdapter["quoteWarehouseToPickupPoint"]>[1]["items"]

export type YandexCheckPricePayloadBuildInput = {
  mode_code: string
  source_address?: DeliveryHubRoutePointAddressInput | null
  destination_address?: DeliveryHubRoutePointAddressInput | null
  destination_point_id: string
  items?: YandexCheckPriceItemsInput
}

export function buildYandexCheckPriceQuoteInput(input: YandexCheckPricePayloadBuildInput) {
  const sourcePoint = requireYandexCheckPriceRoutePointAddress(input.source_address, "origin_address")
  const destinationPoint = requireYandexCheckPriceRoutePointAddress(input.destination_address, "destination_address")
  const quoteKey = buildYandexCheckPriceQuoteKey(input.mode_code, input.destination_point_id)

  return {
    quote_key: quoteKey,
    payload: {
      route_points: [
        buildYandexCheckPriceRoutePoint(1, "source", sourcePoint),
        buildYandexCheckPriceRoutePoint(2, "destination", destinationPoint),
      ],
      items: buildYandexCheckPriceItems(input.items),
      places: buildYandexCheckPricePlaces(input.items),
      billing_info: {
        payment_method: "already_paid",
      },
    },
  }
}

function requireYandexCheckPriceRoutePointAddress(
  value: DeliveryHubRoutePointAddressInput | null | undefined,
  field: string
) {
  const fullname = normalizeNullableText(value?.fullname)

  if (!fullname) {
    throw new DeliveryHubError({
      code: "DELIVERY_HUB_VALIDATION_ERROR",
      message: `Yandex Delivery /check-price requires ${field}.fullname`,
      status: 400,
      details: {
        field,
        required_shape: "{ fullname, coordinates: [lng, lat], contact? }",
      },
    })
  }

  const coordinates = normalizeYandexCoordinates(value?.coordinates)

  if (!coordinates) {
    throw new DeliveryHubError({
      code: "DELIVERY_HUB_VALIDATION_ERROR",
      message: `Yandex Delivery /check-price requires ${field}.coordinates [lng, lat]`,
      status: 409,
      details: {
        field,
        required_shape: "{ fullname, coordinates: [lng, lat], contact? }",
        operator_hint:
          field === "origin_address"
            ? "Укажите координаты склада в Admin Settings → Delivery. Для тестового адреса Москва, Льва Толстого, 16 используйте longitude 37.588144, latitude 55.733842."
            : "Выберите ПВЗ из Yandex pickup-points/list, чтобы quote path получил position.longitude/latitude как destination coordinates.",
      },
    })
  }

  const contactName = normalizeNullableText(value?.contact?.name)
  const contactPhone = normalizeNullableText(value?.contact?.phone)

  return {
    fullname,
    coordinates,
    contact: {
      name: contactName ?? (field === "origin_address" ? "Seller" : "Recipient"),
      phone: contactPhone ?? "+79990000000",
    },
  }
}

function buildYandexCheckPriceRoutePoint(
  id: number,
  type: "source" | "destination",
  point: ReturnType<typeof requireYandexCheckPriceRoutePointAddress>
) {
  return {
    id,
    coordinates: point.coordinates,
    fullname: point.fullname,
    type,
    contact: point.contact,
  }
}

function buildYandexCheckPriceItems(items: YandexCheckPriceItemsInput) {
  const sourceItems = Array.isArray(items) && items.length ? items : [{}]

  return sourceItems.map((item, index) => ({
    title: `Delivery Hub item ${index + 1}`,
    quantity: normalizePositiveInteger(item.quantity, 1),
    cost_currency: "RUB",
    cost_value: String(normalizeNonNegativeInteger(item.price, 0)),
    weight: normalizeWeightKg(item.weight_grams),
    size: {
      length: 0.1,
      width: 0.1,
      height: 0.1,
    },
  }))
}

function buildYandexCheckPricePlaces(items: YandexCheckPriceItemsInput) {
  const sourceItems = Array.isArray(items) && items.length ? items : [{}]

  return sourceItems.map((item) => ({
    physical_dims: buildYandexPhysicalDims(item),
  }))
}

function buildYandexPhysicalDims(item: NonNullable<YandexCheckPriceItemsInput>[number] | Record<string, never>) {
  return {
    dx: 1,
    dy: 1,
    dz: 1,
    weight_gross: normalizePositiveInteger(item.weight_grams, 1),
  }
}

function buildYandexCheckPriceQuoteKey(modeCode: string, destinationPointId: string) {
  const fingerprint = crypto
    .createHash("sha256")
    .update(`${modeCode}:${destinationPointId}:${Date.now()}:${crypto.randomUUID()}`)
    .digest("hex")
    .slice(0, 32)

  return `check_price_${fingerprint}`
}

function normalizeWeightKg(value: unknown) {
  const grams = normalizeFiniteNumber(value)

  if (grams === null || grams <= 0) {
    return 1
  }

  return Math.max(0.001, grams / 1000)
}

function normalizeYandexCoordinates(value: unknown): [number, number] | null {
  if (!Array.isArray(value) || value.length !== 2) {
    return null
  }

  const lng = normalizeFiniteNumber(value[0])
  const lat = normalizeFiniteNumber(value[1])

  return lng === null || lat === null ? null : [lng, lat]
}

function normalizeNonNegativeInteger(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.trunc(value)
    : fallback
}

function normalizePositiveInteger(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.trunc(value)
    : fallback
}

function normalizeFiniteNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function normalizeNullableText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}
