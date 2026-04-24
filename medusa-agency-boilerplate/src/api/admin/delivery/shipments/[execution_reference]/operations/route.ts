import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  getDeliveryHubService,
  getRouteParam,
  handleDeliveryHubError,
  sanitizeAdminDeliveryAdminShipmentOperationsResponse,
} from "../../../shared"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  try {
    const service = getDeliveryHubService(req)
    const executionReference = getRouteParam(req, "execution_reference")
    const result = sanitizeAdminDeliveryAdminShipmentOperationsResponse(
      await service.getAdminShipmentOperationsSnapshot({
        execution_reference: executionReference,
      })
    )

    res.status(200).json(result)
  } catch (error) {
    handleDeliveryHubError(res, error)
  }
}
