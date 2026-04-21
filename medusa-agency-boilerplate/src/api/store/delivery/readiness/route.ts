import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import * as deliveryHub from "../../../../modules/delivery-hub"
import {
  getStoreDeliveryHubService,
  getStoreQuery,
  handleStoreDeliveryHubError,
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
    const service = getStoreDeliveryHubService(req)
    const result = await service.getStoreSelectionReadiness({
      cart_id: existingCart.id,
      metadata: existingCart.metadata,
    })

    res.status(200).json(result)
  } catch (error) {
    handleStoreDeliveryHubError(res, error)
  }
}
