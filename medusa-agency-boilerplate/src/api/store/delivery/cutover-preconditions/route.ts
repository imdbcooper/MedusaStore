import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import * as deliveryHub from "../../../../modules/delivery-hub"
import {
  getStoreDeliveryHubService,
  handleStoreDeliveryHubError,
  sanitizeStoreDeliveryCutoverPreconditionsResponse,
} from "../shared"

export const StoreDeliveryCutoverPreconditionsQuerySchema =
  deliveryHub.DeliveryHubStoreCutoverPreconditionsQuerySchema

type StoreDeliveryCutoverPreconditionsQuery = z.infer<
  typeof StoreDeliveryCutoverPreconditionsQuerySchema
>

export async function GET(
  req: MedusaRequest<unknown, StoreDeliveryCutoverPreconditionsQuery>,
  res: MedusaResponse
) {
  try {
    const service = getStoreDeliveryHubService(req)
    const result = sanitizeStoreDeliveryCutoverPreconditionsResponse(
      await service.getStoreCutoverPreconditions()
    )

    res.status(200).json(result)
  } catch (error) {
    handleStoreDeliveryHubError(res, error)
  }
}
