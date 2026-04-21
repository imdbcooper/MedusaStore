import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { DeliveryHubCreateConnectionSchema } from "../../../../modules/delivery-hub"
import { getDeliveryHubService, handleDeliveryHubError } from "../shared"

export const AdminCreateDeliveryConnectionSchema = DeliveryHubCreateConnectionSchema

type AdminCreateDeliveryConnectionBody = z.infer<typeof AdminCreateDeliveryConnectionSchema>

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  try {
    const service = getDeliveryHubService(req)
    const connections = await service.listConnections()

    res.status(200).json({
      ok: true,
      connections,
    })
  } catch (error) {
    handleDeliveryHubError(res, error)
  }
}

export async function POST(
  req: AuthenticatedMedusaRequest<AdminCreateDeliveryConnectionBody>,
  res: MedusaResponse
) {
  try {
    const service = getDeliveryHubService(req)
    const connection = await service.createConnection(req.validatedBody)

    res.status(201).json({
      ok: true,
      connection,
    })
  } catch (error) {
    handleDeliveryHubError(res, error)
  }
}
