import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { DeliveryHubConnectionTestSchema } from "../../../../../../modules/delivery-hub"
import {
  getDeliveryHubService,
  getRouteParam,
  handleDeliveryHubError,
  sanitizeAdminDeliveryConnectionTestResult,
} from "../../../shared"

export const AdminDeliveryConnectionTestSchema = DeliveryHubConnectionTestSchema

type AdminDeliveryConnectionTestBody = z.infer<typeof AdminDeliveryConnectionTestSchema>

export async function POST(
  req: AuthenticatedMedusaRequest<AdminDeliveryConnectionTestBody>,
  res: MedusaResponse
) {
  try {
    const id = getRouteParam(req, "id")
    const service = getDeliveryHubService(req)
    const result = sanitizeAdminDeliveryConnectionTestResult(
      await service.testConnection(id, req.validatedBody)
    )

    res.status(200).json({
      ok: true,
      result,
    })
  } catch (error) {
    handleDeliveryHubError(res, error)
  }
}
