import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { DeliveryHubStoreSettingsQuerySchema } from "../../../../modules/delivery-hub"
import {
  getStoreDeliveryHubService,
  handleStoreDeliveryHubError,
  sanitizeStoreDeliverySettingsResponse,
} from "../shared"

export const StoreDeliverySettingsQuerySchema = DeliveryHubStoreSettingsQuerySchema

type StoreDeliverySettingsQuery = z.infer<typeof StoreDeliverySettingsQuerySchema>

export async function GET(
  req: MedusaRequest<unknown, StoreDeliverySettingsQuery>,
  res: MedusaResponse
) {
  try {
    const service = getStoreDeliveryHubService(req)
    const result = sanitizeStoreDeliverySettingsResponse(await service.getStoreSettings())

    res.status(200).json(result)
  } catch (error) {
    handleStoreDeliveryHubError(res, error)
  }
}
