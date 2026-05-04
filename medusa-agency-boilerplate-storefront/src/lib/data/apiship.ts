"use server"

import { sdk } from "@lib/config"
import {
  APISHIP_STORE_API_PREFIX,
  shapeApishipAddShippingMethodData,
  shapeApishipCalculatePayload,
  shapeApishipPointListQuery,
  type ApishipCalculationResponse,
  type ApishipPointListQuery,
  type ApishipPointListResponse,
  type ApishipProviderListResponse,
  type ApishipSelectedDeliveryData,
} from "@lib/util/apiship"
import { setShippingMethod } from "./cart"
import { getAuthHeaders } from "./cookies"

async function getApishipStoreHeaders() {
  return {
    ...(await getAuthHeaders()),
  }
}

export async function listApishipProviders() {
  const headers = await getApishipStoreHeaders()

  return sdk.client
    .fetch<ApishipProviderListResponse>(`${APISHIP_STORE_API_PREFIX}/providers`, {
      method: "GET",
      headers,
      cache: "no-store",
    })
    .then(({ providers }) => providers)
    .catch(() => null)
}

export async function listApishipPoints(input: ApishipPointListQuery = {}) {
  const headers = await getApishipStoreHeaders()

  return sdk.client
    .fetch<ApishipPointListResponse>(`${APISHIP_STORE_API_PREFIX}/points`, {
      method: "GET",
      query: shapeApishipPointListQuery(input),
      headers,
      cache: "no-store",
    })
    .then(({ points }) => points)
    .catch(() => null)
}

export async function calculateApishipShippingOption(
  shippingOptionId: string,
  cartId: string
) {
  const headers = await getApishipStoreHeaders()

  return sdk.client
    .fetch<ApishipCalculationResponse>(
      `${APISHIP_STORE_API_PREFIX}/${shippingOptionId}/calculate`,
      {
        method: "POST",
        body: shapeApishipCalculatePayload(cartId),
        headers,
        cache: "no-store",
      }
    )
    .then(({ calculation }) => calculation)
    .catch(() => null)
}

export async function addApishipShippingMethodToCart({
  cartId,
  shippingOptionId,
  apishipData,
}: {
  cartId: string
  shippingOptionId: string
  apishipData: ApishipSelectedDeliveryData
}) {
  return setShippingMethod({
    cartId,
    shippingMethodId: shippingOptionId,
    data: shapeApishipAddShippingMethodData(apishipData),
  })
}
