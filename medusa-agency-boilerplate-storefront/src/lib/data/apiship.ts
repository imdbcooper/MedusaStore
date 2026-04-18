"use server"

import { sdk } from "@lib/config"
import { getAuthHeaders } from "./cookies"

type ApiShipRateQuote = {
  amount: number
  currency_code: string
  shipping_option_id: string
  shipping_option_name: string
  provider_key: string | null
  tariff_id: number | null
  provider_label: string
  estimated_days_min: number | null
  estimated_days_max: number | null
}

type ApiShipRateResponse = {
  quotes: ApiShipRateQuote[]
}

export async function listApiShipCourierRates(
  cartId: string,
  shippingOptionId: string
) {
  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.client
    .fetch<ApiShipRateResponse>(`/store/apiship/rates`, {
      method: "GET",
      query: {
        cart_id: cartId,
        shipping_option_id: shippingOptionId,
      },
      headers,
      cache: "no-store",
    })
    .then(({ quotes }) => quotes)
    .catch(() => null)
}
