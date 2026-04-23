import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { DeliveryHubCreateWarehouseSchema } from "../../../../modules/delivery-hub"
import {
  getDeliveryHubService,
  handleDeliveryHubError,
  sanitizeAdminDeliveryWarehouse,
} from "../shared"

export const AdminCreateDeliveryWarehouseSchema = DeliveryHubCreateWarehouseSchema

type AdminCreateDeliveryWarehouseBody = z.infer<typeof AdminCreateDeliveryWarehouseSchema>

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  try {
    const service = getDeliveryHubService(req)
    const warehouses = (await service.listWarehouses()).map(sanitizeAdminDeliveryWarehouse)

    res.status(200).json({
      ok: true,
      warehouses,
    })
  } catch (error) {
    handleDeliveryHubError(res, error)
  }
}

export async function POST(
  req: AuthenticatedMedusaRequest<AdminCreateDeliveryWarehouseBody>,
  res: MedusaResponse
) {
  try {
    const service = getDeliveryHubService(req)
    const warehouse = sanitizeAdminDeliveryWarehouse(
      await service.createWarehouse(req.validatedBody)
    )

    res.status(201).json({
      ok: true,
      warehouse,
    })
  } catch (error) {
    handleDeliveryHubError(res, error)
  }
}
