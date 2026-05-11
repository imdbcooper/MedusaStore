import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { safePassthroughHeaders } from "../../../../lib/assistant-client"
import { errorResponse, wantsEventStream } from "../../../../lib/route-utils"
import { requireAssistantBackendClient } from "../../../../modules/assistant-runtime"

type StoreAssistantChatBody = {
  message: string
  session_id?: string
  cart_id?: string
  store_id?: string
  region_id?: string
  currency_code?: string
  locale?: string
  mode?: "markdown" | "vector" | "auto" | "lightrag"
  page_context?: Record<string, unknown>
}

export async function POST(req: MedusaRequest<StoreAssistantChatBody>, res: MedusaResponse) {
  const client = requireAssistantBackendClient()
  const body = req.body || req.validatedBody
  const customerId = extractAuthenticatedCustomerId(req)

  const { cart_id: _untrustedCartId, ...safeBody } = body
  const payload = {
    ...safeBody,
    store_id: safeBody.store_id || "default",
    locale: safeBody.locale || "ru",
  }

  try {
    if (payload.session_id && customerId) {
      await client.bindSession({
        session_id: payload.session_id,
        customer_id: customerId,
        store_id: payload.store_id,
        locale: payload.locale,
        customer_context: {
          source: "medusa_store_auth_context",
        },
      })
    }

    if (wantsEventStream(req.headers)) {
      const assistantResponse = await client.streamChat(payload, safePassthroughHeaders(req.headers))
      res.status(assistantResponse.status)
      res.setHeader("content-type", "text/event-stream")
      res.setHeader("cache-control", "no-cache")
      res.setHeader("x-accel-buffering", "no")

      if (!assistantResponse.body) {
        res.end()
        return
      }

      const reader = assistantResponse.body.getReader()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            break
          }
          res.write(Buffer.from(value))
        }
      } finally {
        reader.releaseLock()
        res.end()
      }
      return
    }

    const response = await client.chat(payload, safePassthroughHeaders(req.headers))
    res.status(200).json(response)
  } catch (error) {
    errorResponse(res, error)
  }
}

function extractAuthenticatedCustomerId(req: MedusaRequest<StoreAssistantChatBody>) {
  const authContext = (req as unknown as {
    auth_context?: { actor_id?: string; actor_type?: string; auth_identity_id?: string }
  }).auth_context
  if (authContext?.actor_type && authContext.actor_type !== "customer") {
    return undefined
  }
  return authContext?.actor_id?.trim() || undefined
}
