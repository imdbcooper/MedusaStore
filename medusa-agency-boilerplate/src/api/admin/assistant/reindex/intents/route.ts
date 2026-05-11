import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { errorResponse } from "../../../../../lib/route-utils"
import { requireAssistantBackendClient } from "../../../../../modules/assistant-runtime"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  try {
    const client = requireAssistantBackendClient()
    const query = (req as unknown as { query?: { status?: string; limit?: string } }).query || {}
    const result = await client.listReindexIntents({
      status: query.status,
      limit: query.limit ? Number.parseInt(query.limit, 10) : undefined,
    })
    res.status(200).json({ ok: true, result })
  } catch (error) {
    errorResponse(res, error)
  }
}
