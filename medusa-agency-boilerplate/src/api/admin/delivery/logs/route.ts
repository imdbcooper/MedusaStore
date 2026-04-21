import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { getDeliveryHubService, handleDeliveryHubError } from "../shared"

export const AdminDeliveryEventLogsQuerySchema = z.object({
  connection_id: z.string().trim().min(1).optional(),
  provider_code: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

type AdminDeliveryEventLogsQuery = z.infer<typeof AdminDeliveryEventLogsQuerySchema>

export async function GET(
  req: AuthenticatedMedusaRequest<unknown, AdminDeliveryEventLogsQuery>,
  res: MedusaResponse
) {
  try {
    const service = getDeliveryHubService(req)
    const logs = await service.listEventLogs(req.validatedQuery ?? {})

    res.status(200).json({
      ok: true,
      logs,
    })
  } catch (error) {
    handleDeliveryHubError(res, error)
  }
}
