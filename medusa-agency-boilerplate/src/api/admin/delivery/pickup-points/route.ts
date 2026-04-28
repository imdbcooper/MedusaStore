import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { DeliveryHubAdminPickupPointsQuerySchema } from "../../../../modules/delivery-hub"
import {
  getDeliveryHubService,
  handleDeliveryHubError,
  sanitizeAdminDeliveryPickupPointLookupResponse,
} from "../shared"

export const AdminDeliveryPickupPointsQuerySchema = DeliveryHubAdminPickupPointsQuerySchema

type AdminDeliveryPickupPointsQuery = z.infer<typeof AdminDeliveryPickupPointsQuerySchema>

export async function GET(
  req: AuthenticatedMedusaRequest<unknown, AdminDeliveryPickupPointsQuery>,
  res: MedusaResponse
) {
  try {
    const service = getDeliveryHubService(req)
    const result = sanitizeAdminDeliveryPickupPointLookupResponse(
      await service.listAdminPickupPoints(req.validatedQuery)
    )

    res.status(200).json(result)
  } catch (error) {
    handleDeliveryHubError(res, error)
  }
}
