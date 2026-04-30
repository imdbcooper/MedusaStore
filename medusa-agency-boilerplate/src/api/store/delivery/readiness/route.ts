import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import * as deliveryHub from "../../../../modules/delivery-hub"
import {
  getStoreDeliveryHubService,
  getStoreQuery,
  handleStoreDeliveryHubError,
  readCartShippingMethodOptions,
  sanitizeStoreDeliveryReadinessResponse,
} from "../shared"

export const StoreDeliverySelectionReadinessQuerySchema =
  deliveryHub.DeliveryHubStoreSelectionReadinessQuerySchema

export type StoreDeliverySelectionReadinessDeps = {
  getDeliveryHubCartById: typeof deliveryHub.getDeliveryHubCartById
  requireDeliveryHubCart: typeof deliveryHub.requireDeliveryHubCart
}

export const storeDeliverySelectionReadinessDeps: StoreDeliverySelectionReadinessDeps = {
  getDeliveryHubCartById: deliveryHub.getDeliveryHubCartById,
  requireDeliveryHubCart: deliveryHub.requireDeliveryHubCart,
}

type StoreDeliverySelectionReadinessQuery = z.infer<
  typeof StoreDeliverySelectionReadinessQuerySchema
>

type StoreDeliverySelectionReadinessShippingOptionQuery = {
  graph: <T = Record<string, unknown>>(input: {
    entity: string
    fields: string[]
    filters?: Record<string, unknown>
  }) => Promise<{ data?: T[] }>
}

type StoreDeliverySelectionReadinessShippingOptionSnapshot = {
  id: string
  name?: string | null
  provider_id?: string | null
  data?: Record<string, unknown> | null
}

function mergeShippingOptionSnapshots(
  left: StoreDeliverySelectionReadinessShippingOptionSnapshot[],
  right: StoreDeliverySelectionReadinessShippingOptionSnapshot[]
) {
  const snapshots = new Map<string, StoreDeliverySelectionReadinessShippingOptionSnapshot>()

  for (const option of [...left, ...right]) {
    snapshots.set(option.id, option)
  }

  return Array.from(snapshots.values())
}

export async function GET(
  req: MedusaRequest<unknown, StoreDeliverySelectionReadinessQuery>,
  res: MedusaResponse
) {
  try {
    const query = getStoreQuery(req)
    const validatedQuery = req.validatedQuery
    const cart = await storeDeliverySelectionReadinessDeps.getDeliveryHubCartById(
      query,
      validatedQuery.cart_id
    )
    const existingCart = storeDeliverySelectionReadinessDeps.requireDeliveryHubCart(
      cart,
      validatedQuery.cart_id
    )
    const shippingOptionQuery = req.scope.resolve(
      ContainerRegistrationKeys.QUERY
    ) as StoreDeliverySelectionReadinessShippingOptionQuery
    const { data } = await shippingOptionQuery.graph<StoreDeliverySelectionReadinessShippingOptionSnapshot>({
      entity: "shipping_option",
      fields: ["id", "name", "provider_id", "data"],
    })
    const service = getStoreDeliveryHubService(req)
    const result = sanitizeStoreDeliveryReadinessResponse(
      await service.getStoreSelectionReadiness({
        cart_id: existingCart.id,
        metadata: existingCart.metadata,
        cart: existingCart,
        current_shipping_options: mergeShippingOptionSnapshots(
          data ?? [],
          readCartShippingMethodOptions(existingCart)
        ),
      })
    )

    res.status(200).json(result)
  } catch (error) {
    handleStoreDeliveryHubError(res, error)
  }
}
