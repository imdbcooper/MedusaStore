import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"

import { errorResponse } from "../../../../../lib/route-utils"
import { requireAssistantBackendClient } from "../../../../../modules/assistant-runtime"

export const AdminAssistantKnowledgeSyncSchema = z.object({
  store_id: z.string().trim().min(1).default("default"),
  locale: z.string().trim().min(1).default("ru"),
})

type AdminAssistantKnowledgeSyncBody = z.infer<typeof AdminAssistantKnowledgeSyncSchema>

export async function POST(
  req: AuthenticatedMedusaRequest<AdminAssistantKnowledgeSyncBody>,
  res: MedusaResponse,
) {
  const body = req.validatedBody || AdminAssistantKnowledgeSyncSchema.parse(req.body || {})

  try {
    const client = requireAssistantBackendClient()
    const result = await client.syncMarkdown({
      store_id: body.store_id,
      locale: body.locale,
    })
    res.status(200).json({ ok: true, result })
  } catch (error) {
    errorResponse(res, error)
  }
}
