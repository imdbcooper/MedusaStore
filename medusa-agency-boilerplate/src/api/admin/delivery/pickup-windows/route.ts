import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { DeliveryHubAdminPickupWindowsQuerySchema } from "../../../../modules/delivery-hub"
import {
  getDeliveryHubService,
  handleDeliveryHubError,
  sanitizeAdminDeliveryPickupWindowLookupResponse,
} from "../shared"

export const AdminDeliveryPickupWindowsQuerySchema = DeliveryHubAdminPickupWindowsQuerySchema

type AdminDeliveryPickupWindowsQuery = z.infer<typeof AdminDeliveryPickupWindowsQuerySchema>

export async function GET(
  req: AuthenticatedMedusaRequest<unknown, AdminDeliveryPickupWindowsQuery>,
  res: MedusaResponse
) {
  try {
    const service = getDeliveryHubService(req)
    const result = sanitizeAdminDeliveryPickupWindowLookupResponse(
      await service.listAdminPickupWindows(req.validatedQuery)
    )

    res.status(200).json(result)
  } catch (error) {
    handleDeliveryHubError(res, error)
  }
}
