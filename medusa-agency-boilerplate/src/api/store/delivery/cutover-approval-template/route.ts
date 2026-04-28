import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import * as deliveryHub from "../../../../modules/delivery-hub"
import {
  getStoreDeliveryHubService,
  getStoreQuery,
  handleStoreDeliveryHubError,
  sanitizeStoreDeliveryCutoverApprovalArtifactResponse,
} from "../shared"

export const StoreDeliveryCutoverApprovalArtifactQuerySchema =
  deliveryHub.DeliveryHubStoreCutoverApprovalArtifactQuerySchema

type StoreDeliveryCutoverApprovalArtifactQuery = z.infer<
  typeof StoreDeliveryCutoverApprovalArtifactQuerySchema
>

type StoreDeliveryCutoverApprovalShippingOptionQuery = {
  graph: <T = Record<string, unknown>>(input: {
    entity: string
    fields: string[]
    filters?: Record<string, unknown>
  }) => Promise<{ data?: T[] }>
}

type StoreDeliveryCutoverApprovalShippingOptionSnapshot = {
  id: string
  name?: string | null
  provider_id?: string | null
  data?: Record<string, unknown> | null
}

export type StoreDeliveryCutoverApprovalArtifactDeps = {
  getDeliveryHubCartById: typeof deliveryHub.getDeliveryHubCartById
  requireDeliveryHubCart: typeof deliveryHub.requireDeliveryHubCart
}

export const storeDeliveryCutoverApprovalArtifactDeps: StoreDeliveryCutoverApprovalArtifactDeps = {
  getDeliveryHubCartById: deliveryHub.getDeliveryHubCartById,
  requireDeliveryHubCart: deliveryHub.requireDeliveryHubCart,
}

export async function GET(
  req: MedusaRequest<unknown, StoreDeliveryCutoverApprovalArtifactQuery>,
  res: MedusaResponse
) {
  try {
    const validatedQuery = req.validatedQuery
    const service = getStoreDeliveryHubService(req)
    let metadata: unknown = undefined
    let cartId = validatedQuery.cart_id ?? null
    let currentShippingOptions: StoreDeliveryCutoverApprovalShippingOptionSnapshot[] = []

    if (cartId) {
      const storeQuery = getStoreQuery(req)
      const cart = await storeDeliveryCutoverApprovalArtifactDeps.getDeliveryHubCartById(
        storeQuery,
        cartId
      )
      const existingCart = storeDeliveryCutoverApprovalArtifactDeps.requireDeliveryHubCart(
        cart,
        cartId
      )
      const shippingOptionQuery = req.scope.resolve(
        ContainerRegistrationKeys.QUERY
      ) as StoreDeliveryCutoverApprovalShippingOptionQuery
      const { data } = await shippingOptionQuery.graph<StoreDeliveryCutoverApprovalShippingOptionSnapshot>({
        entity: "shipping_option",
        fields: ["id", "name", "provider_id", "data"],
      })

      cartId = existingCart.id
      metadata = existingCart.metadata
      currentShippingOptions = data ?? []
    }

    const result = sanitizeStoreDeliveryCutoverApprovalArtifactResponse(
      await service.getStoreCutoverApprovalArtifact({
        cart_id: cartId,
        metadata,
        current_shipping_options: currentShippingOptions,
      })
    )

    res.status(200).json(result)
  } catch (error) {
    handleStoreDeliveryHubError(res, error)
  }
}
