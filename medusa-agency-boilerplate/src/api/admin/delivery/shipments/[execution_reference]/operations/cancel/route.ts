import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  getDeliveryHubService,
  getRouteParam,
  handleDeliveryHubError,
  sanitizeAdminDeliveryAdminShipmentOperationsCancelResponse,
} from "../../../../shared"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  try {
    const service = getDeliveryHubService(req)
    const executionReference = getRouteParam(req, "execution_reference")
    const body = (req.validatedBody ?? {}) as { correlation_id?: string | null }
    const result = sanitizeAdminDeliveryAdminShipmentOperationsCancelResponse(
      await service.cancelAdminShipmentOperationsShipment({
        execution_reference: executionReference,
        correlation_id: body.correlation_id,
      })
    )

    res.status(200).json(result)
  } catch (error) {
    handleDeliveryHubError(res, error)
  }
}
