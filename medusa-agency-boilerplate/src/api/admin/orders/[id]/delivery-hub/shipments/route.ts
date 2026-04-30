import { z } from "@medusajs/framework/zod"
import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  getDeliveryHubService,
  getRouteParam,
  handleDeliveryHubError,
  sanitizeAdminOrderDeliveryHubActionResponse,
} from "../../../../delivery/shared"
import { getAdminDeliveryHubOrder } from "../order-query"

export const AdminOrderDeliveryHubCreateShipmentSchema = z
  .object({
    correlation_id: z.string().trim().min(1).max(200).nullable().optional(),
  })
  .strict()

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  try {
    const service = getDeliveryHubService(req)
    const orderId = getRouteParam(req, "id")
    const order = await getAdminDeliveryHubOrder(req, orderId)
    const body = (req.validatedBody ?? {}) as { correlation_id?: string | null }
    const result = sanitizeAdminOrderDeliveryHubActionResponse(
      await service.createAdminOrderDeliveryHubShipment({
        order_id: orderId,
        order,
        correlation_id: body.correlation_id,
      })
    )

    res.status(202).json(result)
  } catch (error) {
    handleDeliveryHubError(res, error)
  }
}
