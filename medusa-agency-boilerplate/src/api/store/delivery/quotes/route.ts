import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import {
  DeliveryHubIntervalUtcSchema,
  DeliveryHubQuoteItemsSchema,
  DeliveryHubStoreQuotesBodySchema,
  DeliveryHubStoreQuotesQuerySchema,
} from "../../../../modules/delivery-hub"
import {
  createStoreDeliveryValidationError,
  getStoreDeliveryHubService,
  handleStoreDeliveryHubError,
  parseStoreDeliveryInterval,
  parseStoreDeliveryItems,
  sanitizeStoreDeliveryQuotesResponse,
} from "../shared"

export const StoreDeliveryQuotesQuerySchema = DeliveryHubStoreQuotesQuerySchema
export const StoreDeliveryQuotesBodySchema = DeliveryHubStoreQuotesBodySchema

type StoreDeliveryQuotesQuery = z.infer<typeof StoreDeliveryQuotesQuerySchema>
type StoreDeliveryQuotesBody = z.infer<typeof StoreDeliveryQuotesBodySchema>

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

export async function POST(
  req: MedusaRequest<StoreDeliveryQuotesBody>,
  res: MedusaResponse
) {
  try {
    const service = getStoreDeliveryHubService(req)
    const validatedBody = StoreDeliveryQuotesBodySchema.parse(
      req.validatedBody ?? req.body ?? failMissingValidatedBody()
    )

    const result = sanitizeStoreDeliveryQuotesResponse(
      await service.listStoreQuotes({
        connection_id: validatedBody.connection_id,
        mode_code: validatedBody.mode_code,
        currency_code: validatedBody.currency_code,
        destination_point_id: validatedBody.destination_point_id,
        destination_address: validatedBody.destination_address,
        origin_point_id: validatedBody.origin_point_id,
        origin_address: validatedBody.origin_address,
        warehouse_id: validatedBody.warehouse_id,
        interval_utc: validatedBody.interval_utc ?? undefined,
        items: validatedBody.items,
      })
    )

    res.status(200).json(result)
  } catch (error) {
    handleStoreDeliveryHubError(res, error)
  }
}

function failMissingValidatedBody(): never {
  throw createStoreDeliveryValidationError(
    "Store delivery quote request body was not validated",
    "body"
  )
}
