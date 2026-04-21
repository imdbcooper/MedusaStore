import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { DeliveryHubUpdateWarehouseSchema } from "../../../../../modules/delivery-hub"
import {
  getDeliveryHubService,
  getRouteParam,
  handleDeliveryHubError,
} from "../../shared"

export const AdminUpdateDeliveryWarehouseSchema = DeliveryHubUpdateWarehouseSchema

type AdminUpdateDeliveryWarehouseBody = z.infer<typeof AdminUpdateDeliveryWarehouseSchema>

export async function PUT(
  req: AuthenticatedMedusaRequest<AdminUpdateDeliveryWarehouseBody>,
  res: MedusaResponse
) {
  try {
    const id = getRouteParam(req, "id")
    const service = getDeliveryHubService(req)
    const warehouse = await service.updateWarehouse(id, req.validatedBody)

    res.status(200).json({
      ok: true,
      warehouse,
    })
  } catch (error) {
    handleDeliveryHubError(res, error)
  }
}
