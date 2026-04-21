import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { getDeliveryHubService, handleDeliveryHubError } from "../shared"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  try {
    const service = getDeliveryHubService(req)
    const providers = await service.listProviders()

    res.status(200).json({
      ok: true,
      providers,
    })
  } catch (error) {
    handleDeliveryHubError(res, error)
  }
}
