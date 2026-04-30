import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  getDeliveryHubService,
  getRouteParam,
  handleDeliveryHubError,
  sanitizeAdminOrderDeliveryHubResponse,
} from "../../../delivery/shared"
import { getAdminDeliveryHubOrder } from "./order-query"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  try {
    const service = getDeliveryHubService(req)
    const orderId = getRouteParam(req, "id")
    const order = await getAdminDeliveryHubOrder(req, orderId)
    const result = sanitizeAdminOrderDeliveryHubResponse(
      await service.getAdminOrderDeliveryHubSnapshot({
        order_id: orderId,
        order,
      })
    )

    res.status(200).json(result)
  } catch (error) {
    handleDeliveryHubError(res, error)
  }
}
