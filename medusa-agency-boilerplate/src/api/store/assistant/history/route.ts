import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { errorResponse } from "../../../../lib/route-utils"
import { requireAssistantBackendClient } from "../../../../modules/assistant-runtime"

type StoreAssistantHistoryBody = {
  session_id?: string
  store_id?: string
  locale?: string
  limit?: number
}

type AssistantHistoryMessage = {
  id: string
  session_id: string
  role: "user" | "assistant" | "tool" | "system"
  content: string
  intent?: string | null
  products?: unknown[]
  actions?: unknown[]
  metadata?: Record<string, unknown>
  created_at?: string
}

type AssistantHandoffTicket = {
  channel?: "telegram" | string
  status?: string
  message?: string | null
  updated_at?: string | null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_HISTORY_LIMIT = 50

export const StoreAssistantHistorySchema = z.object({
  session_id: z.string().trim().regex(UUID_RE),
  store_id: z.string().trim().min(1).max(128).optional(),
  locale: z.string().trim().min(2).max(16).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_HISTORY_LIMIT).optional(),
})

export async function POST(req: MedusaRequest<StoreAssistantHistoryBody>, res: MedusaResponse) {
  const body = req.body || req.validatedBody || {}
  const sessionId = typeof body.session_id === "string" ? body.session_id.trim() : ""

  if (!UUID_RE.test(sessionId)) {
    res.status(400).json({
      error: {
        code: "INVALID_ASSISTANT_SESSION_ID",
        message: "A valid assistant session_id is required.",
        retryable: false,
      },
    })
    return
  }

  const storeId = normalizeScopeValue(body.store_id, "default", 128)
  const locale = normalizeScopeValue(body.locale, "ru", 16)
  const limit = clampLimit(body.limit)
  const customerId = extractAuthenticatedCustomerId(req)
  const client = requireAssistantBackendClient()

  try {
    const history = await client.scopedHistory({
      session_id: sessionId,
      store_id: storeId,
      locale,
      customer_id: customerId,
      limit,
    })

    res.status(200).json({
      session_id: history.session_id,
      messages: sanitizeMessages(history.messages),
      handoff_ticket: sanitizeHandoffTicket(history.handoff_ticket),
    })
  } catch (error) {
    if (isMissingScopedHistoryError(error)) {
      res.status(200).json({
        session_id: sessionId,
        messages: [],
        handoff_ticket: null,
      })
      return
    }

    errorResponse(res, error)
  }
}

function sanitizeMessages(messages: AssistantHistoryMessage[]) {
  return messages
    .filter((message) => message.role === "user" || message.role === "assistant" || message.role === "system")
    .slice(-MAX_HISTORY_LIMIT)
    .map((message) => ({
      id: String(message.id),
      session_id: String(message.session_id),
      role: message.role,
      content: String(message.content || ""),
      intent: message.intent ?? null,
      products: Array.isArray(message.products) ? message.products : [],
      actions: Array.isArray(message.actions) ? message.actions : [],
      metadata: sanitizeMessageMetadata(message.metadata),
      created_at: message.created_at,
    }))
}

function sanitizeMessageMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {}
  }

  const record = metadata as Record<string, unknown>
  const source = typeof record.source === "string" ? record.source.trim() : ""
  if (source === "telegram_operator") {
    return { source }
  }

  return {}
}

function sanitizeHandoffTicket(ticket: AssistantHandoffTicket | null | undefined) {
  if (!ticket || typeof ticket !== "object") {
    return null
  }

  const status = typeof ticket.status === "string" ? ticket.status.trim() : ""
  if (!status) {
    return null
  }

  return {
    channel: ticket.channel === "telegram" ? "telegram" : "telegram",
    status,
    message: typeof ticket.message === "string" ? ticket.message : null,
    updated_at: typeof ticket.updated_at === "string" ? ticket.updated_at : null,
  }
}

function normalizeScopeValue(value: unknown, fallback: string, maxLength: number) {
  if (typeof value !== "string") {
    return fallback
  }

  const normalized = value.trim()
  if (!normalized || normalized.length > maxLength) {
    return fallback
  }

  return normalized
}

function clampLimit(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(numeric)) {
    return MAX_HISTORY_LIMIT
  }

  return Math.min(Math.max(Math.trunc(numeric), 1), MAX_HISTORY_LIMIT)
}

function extractAuthenticatedCustomerId(req: MedusaRequest<StoreAssistantHistoryBody>) {
  const authContext = (req as unknown as {
    auth_context?: { actor_id?: string; actor_type?: string; auth_identity_id?: string }
  }).auth_context
  if (authContext?.actor_type && authContext.actor_type !== "customer") {
    return undefined
  }
  return authContext?.actor_id?.trim() || undefined
}

function isMissingScopedHistoryError(error: unknown) {
  const assistantError = error as { status?: number; code?: string }
  return assistantError.status === 404 && assistantError.code === "SESSION_HISTORY_NOT_FOUND"
}
