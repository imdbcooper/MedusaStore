import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { errorResponse } from "../../../../lib/route-utils"
import { requireAssistantBackendClient } from "../../../../modules/assistant-runtime"

export async function GET(_req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  try {
    const client = requireAssistantBackendClient()
    const stats = await client.stats()
    res.status(200).json({ ok: true, stats })
  } catch (error) {
    errorResponse(res, error)
  }
}
