"use server"

import { sdk } from "@lib/config"
import medusaError from "@lib/util/medusa-error"
import {
  normalizeDeliveryHubCatalogResponse,
  normalizeDeliveryHubCutoverCandidateResponse,
  normalizeDeliveryHubCutoverPreconditionsResponse,
  normalizeDeliveryHubPickupPointsResponse,
  normalizeDeliveryHubPickupWindowsResponse,
  normalizeDeliveryHubReadinessResponse,
  normalizeDeliveryHubQuotesResponse,
  normalizeDeliveryHubSelectionResponse,
  normalizeDeliveryHubSettingsResponse,
  shapeDeliveryHubClearSelectionPayload,
  shapeDeliveryHubPickupPointsQuery,
  shapeDeliveryHubPickupWindowsQuery,
  shapeDeliveryHubQuotesPayload,
  shapeDeliveryHubQuotesQuery,
  shapeDeliveryHubSaveSelectionPayload,
  type DeliveryHubCatalogResponse,
  type DeliveryHubClearSelectionInput,
  type DeliveryHubCutoverCandidateResponse,
  type DeliveryHubCutoverPreconditionsResponse,
  type DeliveryHubListPickupPointsInput,
  type DeliveryHubListPickupWindowsInput,
  type DeliveryHubListQuotesInput,
  type DeliveryHubPickupPointsResponse,
  type DeliveryHubPickupWindowsResponse,
  type DeliveryHubQuotesResponse,
  type DeliveryHubReadinessResponse,
  type DeliveryHubSaveSelectionInput,
  type DeliveryHubSelectionResponse,
  type DeliveryHubStoreSettingsResponse,
} from "@lib/util/delivery-hub"
import { revalidateTag } from "next/cache"
import { getAuthHeaders, getCacheTag } from "./cookies"

async function getDeliveryHubHeaders(options?: { json?: boolean }) {
  const headers = {
    ...(await getAuthHeaders()),
  }

  if (options?.json) {
    return {
      ...headers,
      "content-type": "application/json",
    }
  }

  return headers
}

async function revalidateDeliveryHubCartState() {
  const cartCacheTag = await getCacheTag("carts")
  if (cartCacheTag) {
    revalidateTag(cartCacheTag)
  }

  const fulfillmentCacheTag = await getCacheTag("fulfillment")
  if (fulfillmentCacheTag) {
    revalidateTag(fulfillmentCacheTag)
  }
}

export async function listDeliveryHubCatalog() {
  const headers = await getDeliveryHubHeaders()

  return sdk.client
    .fetch<DeliveryHubCatalogResponse>(`/store/delivery/catalog`, {
      method: "GET",
      headers,
      cache: "no-store",
    })
    .then((response) => normalizeDeliveryHubCatalogResponse(response))
    .catch(() => null)
}

export async function retrieveDeliveryHubSettings() {
  const headers = await getDeliveryHubHeaders()

  return sdk.client
    .fetch<DeliveryHubStoreSettingsResponse>(`/store/delivery/settings`, {
      method: "GET",
      headers,
      cache: "no-store",
    })
    .then((response) => normalizeDeliveryHubSettingsResponse(response))
    .catch(() => null)
}

export async function retrieveDeliveryHubCutoverPreconditions() {
  const headers = await getDeliveryHubHeaders()

  return sdk.client
    .fetch<DeliveryHubCutoverPreconditionsResponse>(`/store/delivery/cutover-preconditions`, {
      method: "GET",
      headers,
      cache: "no-store",
    })
    .then((response) => normalizeDeliveryHubCutoverPreconditionsResponse(response))
    .catch(() => null)
}

export async function retrieveDeliveryHubCutoverCandidate(cartId: string) {
  const headers = await getDeliveryHubHeaders()

  return sdk.client
    .fetch<DeliveryHubCutoverCandidateResponse>(`/store/delivery/cutover-candidate`, {
      method: "GET",
      query: {
        cart_id: cartId,
      },
      headers,
      cache: "no-store",
    })
    .then((response) => normalizeDeliveryHubCutoverCandidateResponse(response))
    .catch(() => null)
}

export async function listDeliveryHubQuotes(input: DeliveryHubListQuotesInput) {
  const headers = await getDeliveryHubHeaders()

  return sdk.client
    .fetch<DeliveryHubQuotesResponse>(`/store/delivery/quotes`, {
      method: "GET",
      query: shapeDeliveryHubQuotesQuery(input),
      headers,
      cache: "no-store",
    })
    .then((response) => normalizeDeliveryHubQuotesResponse(response))
    .catch(() => null)
}

export async function previewDeliveryHubQuotes(input: DeliveryHubListQuotesInput) {
  const headers = await getDeliveryHubHeaders({ json: true })

  return sdk.client
    .fetch<DeliveryHubQuotesResponse>(`/store/delivery/quotes`, {
      method: "POST",
      headers,
      body: shapeDeliveryHubQuotesPayload(input),
      cache: "no-store",
    })
    .then((response) => normalizeDeliveryHubQuotesResponse(response))
    .catch(() => null)
}

export async function listDeliveryHubPickupPoints(
  input: DeliveryHubListPickupPointsInput = {}
) {
  const headers = await getDeliveryHubHeaders()

  return sdk.client
    .fetch<DeliveryHubPickupPointsResponse>(`/store/delivery/pickup-points`, {
      method: "GET",
      query: shapeDeliveryHubPickupPointsQuery(input),
      headers,
      cache: "no-store",
    })
    .then((response) => normalizeDeliveryHubPickupPointsResponse(response))
    .catch(() => null)
}

export async function listDeliveryHubPickupWindows(
  input: DeliveryHubListPickupWindowsInput = {}
) {
  const headers = await getDeliveryHubHeaders()

  return sdk.client
    .fetch<DeliveryHubPickupWindowsResponse>(`/store/delivery/pickup-windows`, {
      method: "GET",
      query: shapeDeliveryHubPickupWindowsQuery(input),
      headers,
      cache: "no-store",
    })
    .then((response) => normalizeDeliveryHubPickupWindowsResponse(response))
    .catch(() => null)
}

export async function retrieveDeliveryHubSelection(cartId: string) {
  const headers = await getDeliveryHubHeaders()

  return sdk.client
    .fetch<DeliveryHubSelectionResponse>(`/store/delivery/selection`, {
      method: "GET",
      query: {
        cart_id: cartId,
      },
      headers,
      cache: "no-store",
    })
    .then((response) => normalizeDeliveryHubSelectionResponse(response))
    .catch(() => null)
}

export async function saveDeliveryHubSelection(input: DeliveryHubSaveSelectionInput) {
  const headers = await getDeliveryHubHeaders({ json: true })

  const response = await sdk.client
    .fetch<DeliveryHubSelectionResponse>(`/store/delivery/selection`, {
      method: "POST",
      headers,
      body: shapeDeliveryHubSaveSelectionPayload(input),
      cache: "no-store",
    })
    .then((result) => normalizeDeliveryHubSelectionResponse(result))
    .catch(medusaError)

  await revalidateDeliveryHubCartState()

  return response
}

export async function clearDeliveryHubSelection(input: DeliveryHubClearSelectionInput) {
  const headers = await getDeliveryHubHeaders({ json: true })

  const response = await sdk.client
    .fetch<DeliveryHubSelectionResponse>(`/store/delivery/selection`, {
      method: "DELETE",
      headers,
      body: shapeDeliveryHubClearSelectionPayload(input),
      cache: "no-store",
    })
    .then((result) => normalizeDeliveryHubSelectionResponse(result))
    .catch(medusaError)

  await revalidateDeliveryHubCartState()

  return response
}

export async function retrieveDeliveryHubReadiness(cartId: string) {
  const headers = await getDeliveryHubHeaders()

  return sdk.client
    .fetch<DeliveryHubReadinessResponse>(`/store/delivery/readiness`, {
      method: "GET",
      query: {
        cart_id: cartId,
      },
      headers,
      cache: "no-store",
    })
    .then((response) => normalizeDeliveryHubReadinessResponse(response))
    .catch(() => null)
}
