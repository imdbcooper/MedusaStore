import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import {
  DeliveryHubIntervalUtcSchema,
  DeliveryHubQuoteItemsSchema,
  DeliveryHubStoreQuotesQuerySchema,
} from "../../../../modules/delivery-hub"
import {
  getStoreDeliveryHubService,
  handleStoreDeliveryHubError,
  parseStoreDeliveryInterval,
  parseStoreDeliveryItems,
  sanitizeStoreDeliveryQuotesResponse,
} from "../shared"

export const StoreDeliveryQuotesQuerySchema = DeliveryHubStoreQuotesQuerySchema

type StoreDeliveryQuotesQuery = z.infer<typeof StoreDeliveryQuotesQuerySchema>

export async function GET(
  req: MedusaRequest<unknown, StoreDeliveryQuotesQuery>,
  res: MedusaResponse
) {
  try {
    const service = getStoreDeliveryHubService(req)
    const validatedQuery = req.validatedQuery ?? {}
    const interval_utc = DeliveryHubIntervalUtcSchema.parse(
      parseStoreDeliveryInterval(validatedQuery.interval_utc)
    )
    const items = DeliveryHubQuoteItemsSchema.parse(
      parseStoreDeliveryItems(validatedQuery.items)
    )

    const result = sanitizeStoreDeliveryQuotesResponse(
      await service.listStoreQuotes({
        connection_id: validatedQuery.connection_id,
        mode_code: validatedQuery.mode_code,
        currency_code: validatedQuery.currency_code,
        destination_point_id: validatedQuery.destination_point_id,
        origin_point_id: validatedQuery.origin_point_id,
        warehouse_id: validatedQuery.warehouse_id,
        interval_utc,
        items,
      })
    )

    res.status(200).json(result)
  } catch (error) {
    handleStoreDeliveryHubError(res, error)
  }
}
