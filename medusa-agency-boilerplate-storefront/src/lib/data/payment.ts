"use server"

import { sdk } from "@lib/config"
import { getAuthHeaders, getCacheOptions } from "./cookies"
import { HttpTypes } from "@medusajs/types"

export const listCartPaymentMethods = async (regionId: string) => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  const next = {
    ...(await getCacheOptions("payment_providers")),
  }

  return sdk.client
    .fetch<HttpTypes.StorePaymentProviderListResponse>(
      `/store/payment-providers`,
      {
        method: "GET",
        query: { region_id: regionId },
        headers,
        next,
        cache: "force-cache",
      }
    )
    .then(({ payment_providers }) =>
      payment_providers.sort((a, b) => {
        return a.id > b.id ? 1 : -1
      })
    )
    .catch(() => {
      return null
    })
}

export async function getYooKassaPaymentStatus({
  cartId,
  paymentId,
}: {
  cartId: string
  paymentId: string
}) {
  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.client.fetch<{
    ok: boolean
    payment_status: string
    session_status: string
    can_place_order: boolean
    confirmation_url: string | null
  }>(`/store/payment/yookassa`, {
    method: "GET",
    query: {
      cart_id: cartId,
      payment_id: paymentId,
    },
    headers,
    cache: "no-store",
  })
}
