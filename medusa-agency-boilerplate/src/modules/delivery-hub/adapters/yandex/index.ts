import crypto from "node:crypto"
import { DELIVERY_HUB_MODE_CODE } from "../../constants"
import type { DeliveryConnectionTestResult } from "../../domain/test-dto"
import { DeliveryHubError } from "../../errors"
import type { DeliveryHubAdapter, DeliveryHubRoutePointAddressInput } from "../types"
import { yandexAdapterDefinition } from "./capabilities"
import { YandexDeliveryClient } from "./client"
import {
  YANDEX_DELIVERY_API_PATH,
  YANDEX_DELIVERY_LEGACY_API_PATH,
} from "./endpoints"
import {
  mapYandexCheckPriceQuote,
  mapYandexPickupPoint,
  mapYandexPickupWindow,
  mapYandexQuote,
} from "./mapper"
import type {
  YandexCheckPriceDto,
  YandexPickupPointDto,
  YandexPickupWindowDto,
  YandexPricingOfferDto,
} from "./dto"

export function createYandexDeliveryAdapter(): DeliveryHubAdapter {
  return {
    definition: yandexAdapterDefinition,
    async testConnection(context) {
      const client = new YandexDeliveryClient(context.connection)
      const payload = {}
      const response = await client.post<YandexListResponse<YandexPickupPointDto, "points">>(
        YANDEX_DELIVERY_API_PATH.pickupPointsList,
        payload,
        context.correlation_id
      )
      const points = extractYandexArray(response, "points")

      const result: DeliveryConnectionTestResult = {
        ok: true,
        provider_code: yandexAdapterDefinition.code,
        diagnostics: {
          provider_status: "ok",
          pickup_points_count: points.length,
        },
      }

      return result
    },
    async listPickupPoints(context, input) {
      const client = new YandexDeliveryClient(context.connection)
      const response = await client.post<YandexListResponse<YandexPickupPointDto, "points">>(
        YANDEX_DELIVERY_API_PATH.pickupPointsList,
        buildYandexPickupPointsPayload(input, context.connection.country_code),
        context.correlation_id
      )

      return extractYandexArray<YandexPickupPointDto>(response, "points").map(mapYandexPickupPoint)
    },
    async listPickupWindows(context, input) {
      const client = new YandexDeliveryClient(context.connection)
      const response = await client.post<YandexListResponse<YandexPickupWindowDto, "offers">>(
        `${YANDEX_DELIVERY_API_PATH.offersInfo}?last_mile_policy=self_pickup`,
        buildYandexPickupWindowsPayload(input),
        context.correlation_id
      )

      return extractYandexArray<YandexPickupWindowDto>(response, "offers").map(mapYandexPickupWindow)
    },
    async quoteWarehouseToPickupPoint(context, input) {
      const client = new YandexDeliveryClient(context.connection)
      const routeQuote = buildYandexCheckPriceRouteQuoteInput({
        mode_code: DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint,
        source_address: input.origin_address,
        destination_address: input.destination_address,
        destination_point_id: input.destination_point_id,
        items: input.items,
      })
      const response = await client.postLegacy<YandexCheckPriceDto>(
        YANDEX_DELIVERY_LEGACY_API_PATH.checkPrice,
        routeQuote.payload,
        context.correlation_id
      )

      return [
        mapYandexCheckPriceQuote(response, {
          mode_code: DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint,
          destination_point_id: input.destination_point_id,
          quote_key: routeQuote.quote_key,
          pickup_window_options: [],
        }),
      ]
    },
    async quoteDropoffPointToPickupPoint(context, input) {
      const client = new YandexDeliveryClient(context.connection)
      const response = await client.post<YandexListResponse<YandexPricingOfferDto, "offers">>(
        YANDEX_DELIVERY_API_PATH.offersCreate,
        buildYandexOfferCreatePayload({
          source_platform_station_id: input.origin_point_id,
          destination_platform_station_id: input.destination_point_id,
          interval_utc: null,
          items: input.items,
          diagnostic_comment: "Delivery Hub dropoff to PVZ quote diagnostic; do not confirm",
        }),
        context.correlation_id
      )

      return extractYandexArray<YandexPricingOfferDto>(response, "offers").map((offer) =>
        mapYandexQuote(offer, {
          mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
          destination_point_id: input.destination_point_id,
        })
      )
    },
  }
}

type YandexPickupPointsInput = Parameters<DeliveryHubAdapter["listPickupPoints"]>[1]

type YandexPickupWindowsInput = Parameters<DeliveryHubAdapter["listPickupWindows"]>[1]

type YandexQuoteItemsInput = Parameters<DeliveryHubAdapter["quoteWarehouseToPickupPoint"]>[1]["items"]

type YandexListResponse<T, K extends "points" | "offers"> = Partial<Record<K, T[]>> & {
  data?: Partial<Record<K, T[]>> | null
}

function buildYandexPickupPointsPayload(input: YandexPickupPointsInput, fallbackCountryCode?: string | null) {
  const payload: Record<string, unknown> = {}

  if (Number.isInteger(input.geo_id)) {
    payload.geo_id = input.geo_id
  }

  if (input.pickup_point_ids?.length) {
    payload.pickup_point_ids = input.pickup_point_ids
  }

  if (input.operator_ids?.length) {
    payload.operator_ids = input.operator_ids
  }

  if (input.station_type) {
    payload.type = input.station_type
  }

  if (input.payment_method) {
    payload.payment_method = input.payment_method
  }

  if (typeof input.available_for_dropoff === "boolean") {
    payload.available_for_dropoff = input.available_for_dropoff
  }

  if (typeof input.is_yandex_branded === "boolean") {
    payload.is_yandex_branded = input.is_yandex_branded
  }

  if (typeof input.is_not_branded_partner_station === "boolean") {
    payload.is_not_branded_partner_station = input.is_not_branded_partner_station
  }

  if (input.payment_methods?.length) {
    payload.payment_methods = input.payment_methods
  }

  if (input.pickup_services?.length) {
    payload.pickup_services = input.pickup_services
  }

  const hasDocumentedFilter = Object.keys(payload).length > 0
  const countryCode = input.country_code ?? fallbackCountryCode

  if (!hasDocumentedFilter && input.city) {
    payload.city = input.city
  }

  if (!hasDocumentedFilter && countryCode) {
    payload.country = countryCode
  }

  return payload
}

function buildYandexPickupWindowsPayload(input: YandexPickupWindowsInput) {
  const payload: Record<string, unknown> = {
    source: {
      platform_station_id: input.warehouse_id,
    },
    places: normalizeYandexPlaces(input.items),
  }

  if (input.destination_point_id) {
    payload.destination = {
      platform_station_id: input.destination_point_id,
    }
  }

  return payload
}

function buildYandexCheckPriceRouteQuoteInput(input: {
  mode_code: string
  source_address?: DeliveryHubRoutePointAddressInput | null
  destination_address?: DeliveryHubRoutePointAddressInput | null
  destination_point_id: string
  items?: YandexQuoteItemsInput
}) {
  const sourcePoint = requireYandexRoutePointAddress(input.source_address, "origin_address")
  const destinationPoint = requireYandexRoutePointAddress(input.destination_address, "destination_address")
  const quoteKey = buildYandexCheckPriceQuoteKey(input.mode_code, input.destination_point_id)

  return {
    quote_key: quoteKey,
    payload: {
      route_points: [
        buildYandexCheckPriceRoutePoint(1, "source", sourcePoint),
        buildYandexCheckPriceRoutePoint(2, "destination", destinationPoint),
      ],
      items: buildYandexCheckPriceItems(input.items),
      places: normalizeYandexPlaces(input.items),
      billing_info: {
        payment_method: "already_paid",
      },
    },
  }
}

function requireYandexRoutePointAddress(
  value: DeliveryHubRoutePointAddressInput | null | undefined,
  field: string
) {
  const fullname = normalizeNullableText(value?.fullname)

  if (!fullname) {
    throw new DeliveryHubError({
      code: "DELIVERY_HUB_VALIDATION_ERROR",
      message: `Yandex Delivery check-price requires ${field}.fullname`,
      status: 400,
      details: {
        field,
        required_shape: "{ fullname, coordinates?, contact? }",
      },
    })
  }

  const coordinates = normalizeYandexCoordinates(value?.coordinates)
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
  point: ReturnType<typeof requireYandexRoutePointAddress>
) {
  return {
    id,
    type,
    ...(point.coordinates ? { coordinates: point.coordinates } : {}),
    fullname: point.fullname,
    contact: point.contact,
  }
}

function buildYandexCheckPriceItems(items: YandexQuoteItemsInput) {
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

function normalizeWeightKg(value: unknown) {
  const grams = normalizeFiniteNumber(value)

  if (grams === null || grams <= 0) {
    return 1
  }

  return Math.max(0.001, grams / 1000)
}

function buildYandexCheckPriceQuoteKey(modeCode: string, destinationPointId: string) {
  const fingerprint = crypto
    .createHash("sha256")
    .update(`${modeCode}:${destinationPointId}:${Date.now()}:${crypto.randomUUID()}`)
    .digest("hex")
    .slice(0, 32)

  return `check_price_${fingerprint}`
}

function normalizeYandexCoordinates(value: unknown): [number, number] | null {
  if (!Array.isArray(value) || value.length !== 2) {
    return null
  }

  const lng = normalizeFiniteNumber(value[0])
  const lat = normalizeFiniteNumber(value[1])

  return lng === null || lat === null ? null : [lng, lat]
}

function normalizeYandexPlaces(items: YandexQuoteItemsInput) {
  const sourceItems = Array.isArray(items) && items.length ? items : [{}]

  return sourceItems.map((item) => ({
    physical_dims: buildYandexPhysicalDims(item),
  }))
}

function buildYandexOfferCreatePayload(input: {
  source_platform_station_id: string
  destination_platform_station_id: string
  interval_utc?: Parameters<DeliveryHubAdapter["quoteWarehouseToPickupPoint"]>[1]["interval_utc"] | null
  items?: YandexQuoteItemsInput
  diagnostic_comment: string
}) {
  const places = buildYandexOfferPlaces(input.items)

  const source: Record<string, unknown> = {
    platform_station: {
      platform_id: input.source_platform_station_id,
    },
  }

  if (input.interval_utc?.from && input.interval_utc.to) {
    source.interval_utc = input.interval_utc
  }

  return {
    info: {
      operator_request_id: `dh_quote_${Date.now()}`,
      comment: input.diagnostic_comment,
    },
    source,
    destination: {
      type: "platform_station",
      platform_station: {
        platform_id: input.destination_platform_station_id,
      },
      custom_location: null,
      interval_utc: null,
    },
    items: buildYandexOfferItems(input.items, places),
    places,
    billing_info: {
      payment_method: "already_paid",
      delivery_cost: 0,
      variable_delivery_cost_for_recipient: [
        {
          min_cost_of_accepted_items: 1,
          delivery_cost: 0,
        },
      ],
    },
    recipient_info: {
      first_name: "Delivery",
      last_name: "Hub",
      phone: "+79990000000",
      email: "delivery-hub-quote@example.invalid",
    },
    last_mile_policy: "self_pickup",
    particular_items_refuse: false,
    forbid_unboxing: true,
  }
}

function buildYandexOfferPlaces(items: YandexQuoteItemsInput) {
  return normalizeYandexPlaces(items).map((place, index) => ({
    ...place,
    barcode: buildYandexDiagnosticPlaceBarcode(index),
  }))
}

function buildYandexOfferItems(
  items: YandexQuoteItemsInput,
  places: Array<{ barcode: string; physical_dims: ReturnType<typeof buildYandexPhysicalDims> }>
) {
  const sourceItems = Array.isArray(items) && items.length ? items : [{}]

  return sourceItems.map((item, index) => ({
    count: normalizePositiveInteger(item.quantity, 1),
    name: `Delivery Hub diagnostic item ${index + 1}`,
    article: `DH-DIAG-${index + 1}`,
    place_barcode: places[index]?.barcode ?? buildYandexDiagnosticPlaceBarcode(index),
    billing_details: {
      unit_price: normalizeNonNegativeInteger(item.price, 0),
      assessed_unit_price: normalizeNonNegativeInteger(item.price, 0),
    },
    physical_dims: buildYandexPhysicalDims(item),
  }))
}

function buildYandexPhysicalDims(item: NonNullable<YandexQuoteItemsInput>[number] | Record<string, never>) {
  return {
    dx: 1,
    dy: 1,
    dz: 1,
    weight_gross: normalizePositiveInteger(item.weight_grams, 1),
  }
}

function buildYandexDiagnosticPlaceBarcode(index: number) {
  return `DH-DIAG-PLACE-${index + 1}`
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

function extractYandexArray<T>(response: unknown, key: "points" | "offers"): T[] {
  if (!response || typeof response !== "object") {
    throw createYandexProviderShapeError(key, response, "response_object_missing")
  }

  const root = response as Record<string, unknown>
  const data = root.data && typeof root.data === "object" ? root.data as Record<string, unknown> : null
  const candidates = [
    { location: key, value: root[key] },
    { location: `data.${key}`, value: data?.[key] },
  ]

  for (const candidate of candidates) {
    if (Array.isArray(candidate.value)) {
      return candidate.value as T[]
    }

    if (candidate.value !== undefined) {
      throw createYandexProviderShapeError(key, response, "expected_array_invalid", candidate.location)
    }
  }

  throw createYandexProviderShapeError(key, response, "expected_array_missing")
}

function createYandexProviderShapeError(
  key: "points" | "offers",
  response: unknown,
  reason: string,
  location?: string
) {
  return new DeliveryHubError({
    code: "DELIVERY_HUB_PROVIDER_ERROR",
    message: `Yandex Delivery response shape drift: expected ${key} array`,
    status: 502,
    details: {
      provider_status: "ok",
      error_category: "provider_shape",
      reason,
      expected_array: key,
      location: location ?? null,
      response_shape: describeYandexResponseShape(response),
      operator_hint: key === "points"
        ? "Yandex pickup-points/list returned a non-list response. Check provider route/contract availability; storefront price quote is skipped until a selectable PVZ is available."
        : "Yandex offer response shape changed. Check provider contract availability before enabling quote flow.",
    },
  })
}

function describeYandexResponseShape(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") {
    return {
      type: value === null ? "null" : typeof value,
    }
  }

  const root = value as Record<string, unknown>
  const data = root.data && typeof root.data === "object" ? root.data as Record<string, unknown> : null

  return {
    type: "object",
    keys: Object.keys(root).sort(),
    data_keys: data ? Object.keys(data).sort() : null,
  }
}
