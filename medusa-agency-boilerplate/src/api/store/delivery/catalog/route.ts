import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { DeliveryHubStoreCatalogQuerySchema } from "../../../../modules/delivery-hub"
import {
  getStoreDeliveryHubService,
  handleStoreDeliveryHubError,
  sanitizeStoreDeliveryCatalogResponse,
} from "../shared"

export const StoreDeliveryCatalogQuerySchema = DeliveryHubStoreCatalogQuerySchema

type StoreDeliveryCatalogQuery = z.infer<typeof StoreDeliveryCatalogQuerySchema>

export async function GET(
  req: MedusaRequest<unknown, StoreDeliveryCatalogQuery>,
  res: MedusaResponse
) {
  try {
    const service = getStoreDeliveryHubService(req)
    const result = sanitizeStoreDeliveryCatalogResponse(await service.listStoreCatalog())

    res.status(200).json(result)
  } catch (error) {
    handleStoreDeliveryHubError(res, error)
  }
}
