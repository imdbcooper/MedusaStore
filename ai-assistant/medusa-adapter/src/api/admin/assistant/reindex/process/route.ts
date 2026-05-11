import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { errorResponse } from "../../../../../lib/route-utils"
import { requireAssistantBackendClient } from "../../../../../modules/assistant-runtime"

export const AdminAssistantReindexProcessSchema = z.object({
  limit: z.number().int().min(1).max(100).default(10),
  retry_backoff_seconds: z.number().int().min(1).max(3600).default(60),
})

type AdminAssistantReindexProcessBody = z.infer<typeof AdminAssistantReindexProcessSchema>

export async function POST(
  req: AuthenticatedMedusaRequest<AdminAssistantReindexProcessBody>,
  res: MedusaResponse
) {
  const body = req.validatedBody || AdminAssistantReindexProcessSchema.parse(req.body || {})
  try {
    const client = requireAssistantBackendClient()
    const result = await client.processReindexQueue({
      limit: body.limit,
      retry_backoff_seconds: body.retry_backoff_seconds,
    })
    res.status(202).json({ ok: true, result })
  } catch (error) {
    errorResponse(res, error)
  }
}
