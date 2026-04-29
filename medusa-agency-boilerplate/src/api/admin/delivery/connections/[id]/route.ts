import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { DeliveryHubUpdateConnectionSchema } from "../../../../../modules/delivery-hub"
import {
  getDeliveryHubService,
  getRouteParam,
  handleDeliveryHubError,
  sanitizeAdminDeliveryConnection,
} from "../../shared"

export const AdminUpdateDeliveryConnectionSchema = DeliveryHubUpdateConnectionSchema

type AdminUpdateDeliveryConnectionBody = z.infer<typeof AdminUpdateDeliveryConnectionSchema>

export async function PUT(
  req: AuthenticatedMedusaRequest<AdminUpdateDeliveryConnectionBody>,
  res: MedusaResponse
) {
  try {
    const id = getRouteParam(req, "id")
    const service = getDeliveryHubService(req)
    const connection = sanitizeAdminDeliveryConnection(
      await service.updateConnection(id, req.validatedBody)
    )

    res.status(200).json({
      ok: true,
      connection,
    })
  } catch (error) {
    handleDeliveryHubError(res, error)
  }
}

export async function DELETE(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  try {
    const id = getRouteParam(req, "id")
    const service = getDeliveryHubService(req)
    const result = await service.deleteConnection(id)
    const connection = sanitizeAdminDeliveryConnection(result.connection)

    res.status(200).json({
      ok: true,
      deleted: true,
      connection,
    })
  } catch (error) {
    handleDeliveryHubError(res, error)
  }
}
