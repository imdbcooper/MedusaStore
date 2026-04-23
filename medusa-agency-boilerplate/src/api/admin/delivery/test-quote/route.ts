import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { DeliveryHubTestQuoteSchema } from "../../../../modules/delivery-hub"
import {
  getDeliveryHubService,
  handleDeliveryHubError,
  sanitizeAdminDeliveryTestQuoteResponse,
} from "../shared"

export const AdminDeliveryTestQuoteSchema = DeliveryHubTestQuoteSchema

type AdminDeliveryTestQuoteBody = z.infer<typeof AdminDeliveryTestQuoteSchema>

export async function POST(
  req: AuthenticatedMedusaRequest<AdminDeliveryTestQuoteBody>,
  res: MedusaResponse
) {
  try {
    const service = getDeliveryHubService(req)
    const result = sanitizeAdminDeliveryTestQuoteResponse(
      await service.testQuote(req.validatedBody)
    )

    res.status(200).json(result)
  } catch (error) {
    handleDeliveryHubError(res, error)
  }
}
