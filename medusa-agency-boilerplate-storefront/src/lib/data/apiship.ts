"use server"

import { sdk } from "@lib/config"
import type {
  ApiShipPointsResponse,
  ApiShipRatesResponse,
  ApiShipStorefrontSettings,
} from "@lib/util/apiship"
import { getAuthHeaders } from "./cookies"

async function fetchLegacyApiShipStorefront<T>(
  path: "/store/apiship/settings" | "/store/apiship/rates" | "/store/apiship/points",
  query?: Record<string, string | number>
) {
  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.client
    .fetch<T>(path, {
      method: "GET",
      query,
      headers,
      cache: "no-store",
    })
    .catch(() => null)
}

export async function getApiShipStorefrontSettings() {
  const response = await fetchLegacyApiShipStorefront<{ settings: ApiShipStorefrontSettings }>(
    "/store/apiship/settings"
  )

  return response?.settings ?? null
}

export async function listApiShipRates(cartId: string, shippingOptionId: string) {
  return fetchLegacyApiShipStorefront<ApiShipRatesResponse>("/store/apiship/rates", {
    cart_id: cartId,
    shipping_option_id: shippingOptionId,
  })
}

export async function listApiShipPoints(input: {
  cartId: string
  shippingOptionId: string
  providerKey: string
  tariffId: number
  pickupType: number
  deliveryType: number
  query?: string | null
}) {
  return fetchLegacyApiShipStorefront<ApiShipPointsResponse>("/store/apiship/points", {
    cart_id: input.cartId,
    shipping_option_id: input.shippingOptionId,
    provider_key: input.providerKey,
    tariff_id: input.tariffId,
    pickup_type: input.pickupType,
    delivery_type: input.deliveryType,
    ...(input.query?.trim() ? { q: input.query.trim() } : {}),
  })
}
