import { z } from "@medusajs/framework/zod"
import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  getDeliveryHubService,
  getRouteParam,
  handleDeliveryHubError,
  sanitizeAdminDeliveryAdminShipmentOperationsRefreshResponse,
} from "../../../../../../delivery/shared"

export const AdminOrderDeliveryHubShipmentActionSchema = z
  .object({
    correlation_id: z.string().trim().min(1).max(200).nullable().optional(),
  })
  .strict()

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  try {
    const service = getDeliveryHubService(req)
    const body = (req.validatedBody ?? {}) as { correlation_id?: string | null }
    const result = sanitizeAdminDeliveryAdminShipmentOperationsRefreshResponse(
      await service.refreshAdminOrderDeliveryHubShipment({
        order_id: getRouteParam(req, "id"),
        shipment_id: getRouteParam(req, "shipment_id"),
        correlation_id: body.correlation_id,
      })
    )

    res.status(200).json(result)
  } catch (error) {
    handleDeliveryHubError(res, error)
  }
}
