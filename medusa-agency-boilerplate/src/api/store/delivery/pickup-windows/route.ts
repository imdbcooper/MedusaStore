import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { DeliveryHubStorePickupWindowsQuerySchema } from "../../../../modules/delivery-hub"
import {
  getStoreDeliveryHubService,
  handleStoreDeliveryHubError,
  sanitizeStoreDeliveryPickupWindowsResponse,
} from "../shared"

export const StoreDeliveryPickupWindowsQuerySchema = DeliveryHubStorePickupWindowsQuerySchema

type StoreDeliveryPickupWindowsQuery = z.infer<typeof StoreDeliveryPickupWindowsQuerySchema>

export async function GET(
  req: MedusaRequest<unknown, StoreDeliveryPickupWindowsQuery>,
  res: MedusaResponse
) {
  try {
    const service = getStoreDeliveryHubService(req)
    const result = sanitizeStoreDeliveryPickupWindowsResponse(
      await service.listStorePickupWindows(req.validatedQuery ?? {})
    )

    res.status(200).json(result)
  } catch (error) {
    handleStoreDeliveryHubError(res, error)
  }
}
