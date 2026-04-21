import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { DeliveryHubStorePickupPointsQuerySchema } from "../../../../modules/delivery-hub"
import { getStoreDeliveryHubService, handleStoreDeliveryHubError } from "../shared"

export const StoreDeliveryPickupPointsQuerySchema = DeliveryHubStorePickupPointsQuerySchema

type StoreDeliveryPickupPointsQuery = z.infer<typeof StoreDeliveryPickupPointsQuerySchema>

export async function GET(
  req: MedusaRequest<unknown, StoreDeliveryPickupPointsQuery>,
  res: MedusaResponse
) {
  try {
    const service = getStoreDeliveryHubService(req)
    const result = await service.listStorePickupPoints(req.validatedQuery ?? {})

    res.status(200).json(result)
  } catch (error) {
    handleStoreDeliveryHubError(res, error)
  }
}
