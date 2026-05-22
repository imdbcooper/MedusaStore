import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { errorResponse } from "../../../../lib/route-utils"
import { requireAssistantBackendClient } from "../../../../modules/assistant-runtime"

type StoreAssistantHandoffBody = {
  session_id: string
  message_id?: string
  store_id?: string
  tenant_id?: string
  locale?: string
  source?: string
  name?: string
  email?: string
  phone?: string
  summary?: string
  reason?: string
  note?: string
  metadata?: Record<string, unknown>
}

export async function POST(req: MedusaRequest<StoreAssistantHandoffBody>, res: MedusaResponse) {
  const client = requireAssistantBackendClient()
  const body = req.body || req.validatedBody || {}
  const payload = {
    ...body,
    store_id: body.store_id || "default",
    locale: body.locale || "ru",
    source: body.source || "assistant_widget",
  }

  try {
    const response = await client.handoff(payload)
    res.status(200).json(response)
  } catch (error) {
    errorResponse(res, error)
  }
}
