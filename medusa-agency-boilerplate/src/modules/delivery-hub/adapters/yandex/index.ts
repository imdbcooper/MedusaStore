import { DELIVERY_HUB_MODE_CODE } from "../../constants"
import type { DeliveryConnectionTestResult } from "../../domain/test-dto"
import { DeliveryHubError } from "../../errors"
import type { DeliveryHubAdapter } from "../types"
import { yandexAdapterDefinition } from "./capabilities"
import { YandexDeliveryClient } from "./client"
import {
  mapYandexPickupPoint,
  mapYandexPickupWindow,
  mapYandexQuote,
} from "./mapper"
import type {
  YandexPickupPointDto,
  YandexPickupWindowDto,
  YandexPricingOfferDto,
} from "./dto"

export function createYandexDeliveryAdapter(): DeliveryHubAdapter {
  return {
    definition: yandexAdapterDefinition,
    async testConnection(context) {
      const client = new YandexDeliveryClient(context.connection)
      const payload = { limit: 1 }
      const response = await client.post<YandexListResponse<YandexPickupPointDto, "points">>(
        "/pickup-points/list",
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
        "/pickup-points/list",
        {
          city: input.city ?? undefined,
          country: input.country_code ?? context.connection.country_code,
        },
        context.correlation_id
      )

      return extractYandexArray<YandexPickupPointDto>(response, "points").map(mapYandexPickupPoint)
    },
    async listPickupWindows(context, input) {
      const client = new YandexDeliveryClient(context.connection)
      const response = await client.post<YandexListResponse<YandexPickupWindowDto, "options">>(
        "/pickups/pickup-options",
        {
          warehouse_id: input.warehouse_id,
        },
        context.correlation_id
      )

      return extractYandexArray<YandexPickupWindowDto>(response, "options").map(mapYandexPickupWindow)
    },
    async quoteWarehouseToPickupPoint(context, input) {
      const client = new YandexDeliveryClient(context.connection)
      const pickupWindows = input.interval_utc
        ? []
        : await this.listPickupWindows(context, { warehouse_id: input.warehouse_id })
      const interval = input.interval_utc ?? pickupWindows[0]?.interval_utc

      const response = await client.post<YandexListResponse<YandexPricingOfferDto, "offers">>(
        "/pricing-calculator",
        {
          source: {
            warehouse_id: input.warehouse_id,
            interval_utc: interval,
          },
          destination: {
            pickup_point_id: input.destination_point_id,
          },
          items: input.items ?? [],
          currency: input.currency_code ?? "RUB",
          last_mile_policy: "self_pickup",
        },
        context.correlation_id
      )

      return extractYandexArray<YandexPricingOfferDto>(response, "offers").map((offer) =>
        mapYandexQuote(offer, {
          mode_code: DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint,
          destination_point_id: input.destination_point_id,
          pickup_window_options: pickupWindows,
        })
      )
    },
    async quoteDropoffPointToPickupPoint(context, input) {
      const client = new YandexDeliveryClient(context.connection)
      const response = await client.post<YandexListResponse<YandexPricingOfferDto, "offers">>(
        "/offers/create",
        {
          source: {
            pickup_point_id: input.origin_point_id,
          },
          destination: {
            pickup_point_id: input.destination_point_id,
          },
          items: input.items ?? [],
          currency: input.currency_code ?? "RUB",
          last_mile_policy: "self_pickup",
        },
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

type YandexListResponse<T, K extends "points" | "options" | "offers"> = Partial<Record<K, T[]>> & {
  data?: Partial<Record<K, T[]>> | null
}

function extractYandexArray<T>(response: unknown, key: "points" | "options" | "offers"): T[] {
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
  key: "points" | "options" | "offers",
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
