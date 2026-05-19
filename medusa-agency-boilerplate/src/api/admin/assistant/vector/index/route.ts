import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"

import { errorResponse } from "../../../../../lib/route-utils"
import { requireAssistantBackendClient } from "../../../../../modules/assistant-runtime"

export const AdminAssistantVectorIndexSchema = z.object({
  store_id: z.string().trim().min(1).default("default"),
  locale: z.string().trim().min(1).default("ru"),
  source_type: z.enum(["markdown", "medusa_product"]).optional(),
})

type AdminAssistantVectorIndexBody = z.infer<typeof AdminAssistantVectorIndexSchema>

export async function POST(
  req: AuthenticatedMedusaRequest<AdminAssistantVectorIndexBody>,
  res: MedusaResponse,
) {
  const body = req.validatedBody || AdminAssistantVectorIndexSchema.parse(req.body || {})

  try {
    const client = requireAssistantBackendClient()
    const result = await client.indexVectors({
      store_id: body.store_id,
      locale: body.locale,
      source_type: body.source_type,
    })
    res.status(200).json({ ok: true, result })
  } catch (error) {
    errorResponse(res, error)
  }
}
