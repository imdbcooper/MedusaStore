import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import * as deliveryHub from "../../../../modules/delivery-hub"
import {
  createStoreDeliveryValidationError,
  getStoreDeliveryHubService,
  getStoreQuery,
  handleStoreDeliveryHubError,
  parseStoreDeliveryInterval,
  parseStoreDeliveryItems,
  sanitizeStoreDeliveryQuotesResponse,
} from "../shared"

export const StoreDeliveryQuotesQuerySchema = deliveryHub.DeliveryHubStoreQuotesQuerySchema
export const StoreDeliveryQuotesBodySchema = deliveryHub.DeliveryHubStoreQuotesBodySchema

export type StoreDeliveryQuotesDeps = {
  getDeliveryHubCartById: typeof deliveryHub.getDeliveryHubCartById
  requireDeliveryHubCart: typeof deliveryHub.requireDeliveryHubCart
}

export const storeDeliveryQuotesDeps: StoreDeliveryQuotesDeps = {
  getDeliveryHubCartById: deliveryHub.getDeliveryHubCartById,
  requireDeliveryHubCart: deliveryHub.requireDeliveryHubCart,
}

type StoreDeliveryQuotesQuery = z.infer<typeof StoreDeliveryQuotesQuerySchema>
type StoreDeliveryQuotesBody = z.infer<typeof StoreDeliveryQuotesBodySchema>

export async function GET(
  req: MedusaRequest<unknown, StoreDeliveryQuotesQuery>,
  res: MedusaResponse
) {
  try {
    const service = getStoreDeliveryHubService(req)
    const validatedQuery = req.validatedQuery ?? {}
    const interval_utc = deliveryHub.DeliveryHubIntervalUtcSchema.parse(
      parseStoreDeliveryInterval(validatedQuery.interval_utc)
    )
    const items = deliveryHub.DeliveryHubQuoteItemsSchema.parse(
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

    const query = getStoreQuery(req)
    const cart = await storeDeliveryQuotesDeps.getDeliveryHubCartById(
      query,
      validatedBody.cart_id
    )
    const existingCart = storeDeliveryQuotesDeps.requireDeliveryHubCart(
      cart,
      validatedBody.cart_id
    )

    const result = sanitizeStoreDeliveryQuotesResponse(
      await service.listCheckoutQuotes({
        cart: existingCart,
        cart_id: validatedBody.cart_id,
        currency_code: validatedBody.currency_code,
        destination_point_id: validatedBody.destination_point_id,
        destination_address: validatedBody.destination_address,
        shipping_address: validatedBody.shipping_address ?? null,
        interval_utc: validatedBody.interval_utc ?? undefined,
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
