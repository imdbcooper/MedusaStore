import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import * as deliveryHub from "../../../../modules/delivery-hub"
import {
  getStoreDeliveryHubService,
  getStoreQuery,
  handleStoreDeliveryHubError,
  readCartShippingMethodOptions,
  sanitizeStoreDeliveryCutoverCandidateResponse,
} from "../shared"

export const StoreDeliveryCutoverCandidateQuerySchema =
  deliveryHub.DeliveryHubStoreCutoverCandidateQuerySchema

type StoreDeliveryCutoverCandidateQuery = z.infer<
  typeof StoreDeliveryCutoverCandidateQuerySchema
>

type StoreDeliveryCutoverCandidateShippingOptionQuery = {
  graph: <T = Record<string, unknown>>(input: {
    entity: string
    fields: string[]
    filters?: Record<string, unknown>
  }) => Promise<{ data?: T[] }>
}

type StoreDeliveryCutoverCandidateShippingOptionSnapshot = {
  id: string
  name?: string | null
  provider_id?: string | null
  data?: Record<string, unknown> | null
}

function mergeShippingOptionSnapshots(
  left: StoreDeliveryCutoverCandidateShippingOptionSnapshot[],
  right: StoreDeliveryCutoverCandidateShippingOptionSnapshot[]
) {
  const snapshots = new Map<string, StoreDeliveryCutoverCandidateShippingOptionSnapshot>()

  for (const option of [...left, ...right]) {
    snapshots.set(option.id, option)
  }

  return Array.from(snapshots.values())
}

export type StoreDeliveryCutoverCandidateDeps = {
  getDeliveryHubCartById: typeof deliveryHub.getDeliveryHubCartById
  requireDeliveryHubCart: typeof deliveryHub.requireDeliveryHubCart
}

export const storeDeliveryCutoverCandidateDeps: StoreDeliveryCutoverCandidateDeps = {
  getDeliveryHubCartById: deliveryHub.getDeliveryHubCartById,
  requireDeliveryHubCart: deliveryHub.requireDeliveryHubCart,
}

export async function GET(
  req: MedusaRequest<unknown, StoreDeliveryCutoverCandidateQuery>,
  res: MedusaResponse
) {
  try {
    const validatedQuery = req.validatedQuery
    const storeQuery = getStoreQuery(req)
    const cart = await storeDeliveryCutoverCandidateDeps.getDeliveryHubCartById(
      storeQuery,
      validatedQuery.cart_id
    )
    const existingCart = storeDeliveryCutoverCandidateDeps.requireDeliveryHubCart(
      cart,
      validatedQuery.cart_id
    )
    const shippingOptionQuery = req.scope.resolve(
      ContainerRegistrationKeys.QUERY
    ) as StoreDeliveryCutoverCandidateShippingOptionQuery
    const { data } = await shippingOptionQuery.graph<StoreDeliveryCutoverCandidateShippingOptionSnapshot>({
      entity: "shipping_option",
      fields: ["id", "name", "provider_id", "data"],
    })
    const currentShippingOptions = data ?? []
    const existingShippingMethodOptions = readCartShippingMethodOptions(existingCart)
    const service = getStoreDeliveryHubService(req)
    const result = sanitizeStoreDeliveryCutoverCandidateResponse(
      await service.getStoreCutoverCandidate({
        cart_id: existingCart.id,
        metadata: existingCart.metadata,
        current_shipping_options: mergeShippingOptionSnapshots(
          currentShippingOptions,
          existingShippingMethodOptions
        ),
      })
    )


    res.status(200).json(result)
  } catch (error) {
    handleStoreDeliveryHubError(res, error)
  }
}
