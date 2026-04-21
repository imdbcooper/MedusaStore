import { DELIVERY_HUB_MODE_CODE } from "../../constants"
import type { DeliveryConnectionTestResult } from "../../domain/test-dto"
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
      const response = await client.post<{ points?: YandexPickupPointDto[] }>(
        "/pickup-points/list",
        payload,
        context.correlation_id
      )

      const result: DeliveryConnectionTestResult = {
        ok: true,
        provider_code: yandexAdapterDefinition.code,
        diagnostics: {
          pickup_points_count: Array.isArray(response?.points)
            ? response.points.length
            : 0,
        },
      }

      return result
    },
    async listPickupPoints(context, input) {
      const client = new YandexDeliveryClient(context.connection)
      const response = await client.post<{ points?: YandexPickupPointDto[] }>(
        "/pickup-points/list",
        {
          city: input.city ?? undefined,
          country: input.country_code ?? context.connection.country_code,
        },
        context.correlation_id
      )

      return Array.isArray(response?.points)
        ? response.points.map(mapYandexPickupPoint)
        : []
    },
    async listPickupWindows(context, input) {
      const client = new YandexDeliveryClient(context.connection)
      const response = await client.post<{ options?: YandexPickupWindowDto[] }>(
        "/pickups/pickup-options",
        {
          warehouse_id: input.warehouse_id,
        },
        context.correlation_id
      )

      return Array.isArray(response?.options)
        ? response.options.map(mapYandexPickupWindow)
        : []
    },
    async quoteWarehouseToPickupPoint(context, input) {
      const client = new YandexDeliveryClient(context.connection)
      const pickupWindows = input.interval_utc
        ? []
        : await this.listPickupWindows(context, { warehouse_id: input.warehouse_id })
      const interval = input.interval_utc ?? pickupWindows[0]?.interval_utc

      const response = await client.post<{ offers?: YandexPricingOfferDto[] }>(
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

      return Array.isArray(response?.offers)
        ? response.offers.map((offer) =>
            mapYandexQuote(offer, {
              mode_code: DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint,
              destination_point_id: input.destination_point_id,
              pickup_window_options: pickupWindows,
            })
          )
        : []
    },
    async quoteDropoffPointToPickupPoint(context, input) {
      const client = new YandexDeliveryClient(context.connection)
      const response = await client.post<{ offers?: YandexPricingOfferDto[] }>(
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

      return Array.isArray(response?.offers)
        ? response.offers.map((offer) =>
            mapYandexQuote(offer, {
              mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
              destination_point_id: input.destination_point_id,
            })
          )
        : []
    },
  }
}
