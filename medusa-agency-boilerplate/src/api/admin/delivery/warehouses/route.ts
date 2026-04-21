import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { DeliveryHubCreateWarehouseSchema } from "../../../../modules/delivery-hub"
import { getDeliveryHubService, handleDeliveryHubError } from "../shared"

export const AdminCreateDeliveryWarehouseSchema = DeliveryHubCreateWarehouseSchema

type AdminCreateDeliveryWarehouseBody = z.infer<typeof AdminCreateDeliveryWarehouseSchema>

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  try {
    const service = getDeliveryHubService(req)
    const warehouses = await service.listWarehouses()

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
    const warehouse = await service.createWarehouse(req.validatedBody)

    res.status(201).json({
      ok: true,
      warehouse,
    })
  } catch (error) {
    handleDeliveryHubError(res, error)
  }
}
