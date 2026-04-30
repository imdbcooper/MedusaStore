import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  getDeliveryHubService,
  getRouteParam,
  handleDeliveryHubError,
  sanitizeAdminDeliveryAdminShipmentOperationsCancelResponse,
} from "../../../../../../delivery/shared"
import { AdminOrderDeliveryHubShipmentActionSchema } from "../refresh/route"

export { AdminOrderDeliveryHubShipmentActionSchema }

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  try {
    const service = getDeliveryHubService(req)
    const body = (req.validatedBody ?? {}) as { correlation_id?: string | null }
    const result = sanitizeAdminDeliveryAdminShipmentOperationsCancelResponse(
      await service.cancelAdminOrderDeliveryHubShipment({
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
