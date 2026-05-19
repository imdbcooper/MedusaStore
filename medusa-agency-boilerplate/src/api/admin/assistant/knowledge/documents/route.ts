import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"

import { errorResponse } from "../../../../../lib/route-utils"
import { requireAssistantBackendClient } from "../../../../../modules/assistant-runtime"

export const AdminAssistantKnowledgeDocumentCreateSchema = z.object({
  store_id: z.string().trim().min(1).default("default"),
  locale: z.string().trim().min(1).default("ru"),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(4000),
  content: z.string().min(1).max(500_000),
  file_name: z.string().trim().min(1).max(255).optional(),
})

type AdminAssistantKnowledgeDocumentCreateBody = z.infer<
  typeof AdminAssistantKnowledgeDocumentCreateSchema
>

export async function POST(
  req: AuthenticatedMedusaRequest<AdminAssistantKnowledgeDocumentCreateBody>,
  res: MedusaResponse,
) {
  const body =
    req.validatedBody ||
    AdminAssistantKnowledgeDocumentCreateSchema.parse(req.body || {})

  try {
    const client = requireAssistantBackendClient()
    const result = await client.createKnowledgeDocument({
      store_id: body.store_id,
      locale: body.locale,
      title: body.title,
      description: body.description,
      content: body.content,
      file_name: body.file_name,
    })
    res.status(200).json({ ok: true, result })
  } catch (error) {
    errorResponse(res, error)
  }
}
