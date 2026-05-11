import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { errorResponse } from "../../../../../lib/route-utils"
import { requireAssistantBackendClient } from "../../../../../modules/assistant-runtime"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const jobId = String(req.params?.id || req.query?.id || "").trim()

  if (!jobId) {
    res.status(400).json({ ok: false, error: { code: "JOB_ID_REQUIRED", message: "Job id is required" } })
    return
  }

  try {
    const client = requireAssistantBackendClient()
    const job = await client.jobStatus(jobId)
    res.status(200).json({ ok: true, job })
  } catch (error) {
    errorResponse(res, error)
  }
}
