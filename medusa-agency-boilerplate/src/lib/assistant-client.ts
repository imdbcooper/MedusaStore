import type { AssistantAdapterConfig } from "./config"
import type {
  AssistantTelegramHandoffDiagnostics,
  AssistantTelegramHandoffLastTestStatus,
} from "../modules/assistant-settings"

export type FetchLike = typeof fetch

export type AssistantPageContext = {
  type?: "product" | "category" | "cart" | "home" | string
  product_id?: string
  category_handle?: string
  url?: string
  [key: string]: unknown
}

export type AssistantChatRequest = {
  message: string
  session_id?: string
  customer_id?: string
  cart_id?: string
  store_id?: string
  region_id?: string
  currency_code?: string
  locale?: string
  mode?: "markdown" | "vector" | "auto" | "lightrag"
  page_context?: AssistantPageContext
  [key: string]: unknown
}

export type AssistantSessionBindRequest = {
  session_id: string
  customer_id: string
  store_id?: string
  tenant_id?: string
  locale?: string
  customer_context?: Record<string, unknown>
}

export type AssistantChatResponse = {
  session_id: string
  message_id: string
  answer: string
  intent: string
  products: unknown[]
  citations: unknown[]
  actions: unknown[]
  tool_calls?: unknown[]
  safety?: Record<string, unknown>
}

export type AssistantHistoryRequest = {
  session_id: string
  store_id: string
  locale: string
  customer_id?: string
  limit?: number
}

export type AssistantHistoryResponse = {
  session_id: string
  store_id: string
  locale: string
  customer_bound?: boolean
  handoff_ticket?: {
    channel: "telegram"
    status: string
    message?: string | null
    updated_at?: string | null
  } | null
  messages: Array<{
    id: string
    session_id: string
    role: "user" | "assistant" | "tool" | "system"
    content: string
    intent?: string | null
    products?: unknown[]
    actions?: unknown[]
    metadata?: Record<string, unknown>
    created_at?: string
  }>
}

export type AssistantHandoffRequest = {
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

export type AssistantHandoffResponse = {
  handoff_id: string
  session_id: string
  message_id?: string
  store_id: string
  tenant_id?: string | null
  locale: string
  status: string
  source: string
  created_at?: string | null
  ticket?: {
    channel: "telegram"
    status: string
    message?: string | null
    updated_at?: string | null
  } | null
}

export type AssistantReindexRequest = {
  store_id?: string
  locale?: string
  full?: boolean
  product_ids?: string[]
  region_id?: string
  currency_code?: string
}

export type AssistantMarkdownSyncRequest = {
  store_id?: string
  tenant_id?: string
  locale?: string
}

export type AssistantKnowledgeDocumentRequest = {
  store_id?: string
  tenant_id?: string
  locale?: string
  title: string
  description: string
  content: string
  file_name?: string
}

export type AssistantReindexResponse = {
  job: {
    job_id: string
    status: string
    source_type?: string
    source_id?: string
    result?: Record<string, unknown>
    error?: string | null
    created_at?: string | null
  }
  products_indexed?: number
  chunks?: unknown[]
}

export type AssistantMarkdownSyncResponse = {
  job: {
    job_id: string
    status: string
    source_type?: string
    source_id?: string
    result?: Record<string, unknown>
    error?: string | null
    created_at?: string | null
  }
  chunks?: unknown[]
}

export type AssistantKnowledgeDocumentResponse = {
  document: {
    source_id: string
    path: string
    title: string
    description: string
    file_name: string
    store_id: string
    tenant_id?: string | null
    locale: string
    source_type?: string
  }
  job: {
    job_id: string
    status: string
    source_type?: string
    source_id?: string
    result?: Record<string, unknown>
    error?: string | null
    created_at?: string | null
  }
  chunks?: unknown[]
}

export type AssistantVectorIndexRequest = {
  store_id?: string
  tenant_id?: string
  locale?: string
  source_type?: string
}

export type AssistantVectorIndexResponse = {
  job_id: string
  status: string
  source_type?: string
  source_id?: string
  result?: Record<string, unknown>
  error?: string | null
  created_at?: string | null
}

export type AssistantReindexIntentRequest = {
  store_id?: string
  tenant_id?: string
  locale?: string
  event_name: string
  event_id?: string
  action?: "reindex" | "delete"
  scope?: "products" | "all_products"
  product_ids?: string[]
  reason?: string
  coalescing_key?: string
  max_attempts?: number
  metadata?: Record<string, unknown>
}

export type AssistantStatsResponse = Record<string, unknown>
export type AssistantJobStatusResponse = Record<string, unknown>

export type AssistantTelegramHandoffConnectionTestResult = {
  ok: boolean
  status: AssistantTelegramHandoffLastTestStatus
  message: string
  warnings: string[]
  missing_fields: string[]
  tested_at: string
  diagnostics: AssistantTelegramHandoffDiagnostics
  bot?: Record<string, unknown> | null
  support_chat?: Record<string, unknown> | null
  bot_membership?: Record<string, unknown> | null
  webhook?: Record<string, unknown> | null
}

export class AssistantClientError extends Error {
  status: number
  code: string
  retryable: boolean
  details?: unknown

  constructor(message: string, options: { status: number; code?: string; retryable?: boolean; details?: unknown }) {
    super(message)
    this.name = "AssistantClientError"
    this.status = options.status
    this.code = options.code || "AI_ASSISTANT_REQUEST_FAILED"
    this.retryable = options.retryable ?? options.status >= 500
    this.details = options.details
  }
}

export class AssistantBackendClient {
  private readonly fetchImpl: FetchLike

  constructor(
    private readonly config: AssistantAdapterConfig,
    fetchImpl: FetchLike = fetch
  ) {
    this.fetchImpl = fetchImpl
  }

  async bindSession(payload: AssistantSessionBindRequest) {
    return this.requestJson<Record<string, unknown>>("/admin/sessions/bind", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: this.jsonHeaders(),
    })
  }

  async chat(payload: AssistantChatRequest, passthroughHeaders: Record<string, string> = {}) {
    return this.requestJson<AssistantChatResponse>("/chat", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: this.jsonHeaders(passthroughHeaders),
    })
  }

  async streamChat(payload: AssistantChatRequest, passthroughHeaders: Record<string, string> = {}) {
    const response = await this.request("/chat/stream", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: this.jsonHeaders({ ...passthroughHeaders, accept: "text/event-stream" }),
    })

    if (!response.ok) {
      throw await responseToError(response)
    }

    return response
  }

  async scopedHistory(payload: AssistantHistoryRequest) {
    const query = new URLSearchParams({
      session_id: payload.session_id,
      store_id: payload.store_id,
      locale: payload.locale,
      limit: String(payload.limit ?? 50),
    })

    if (payload.customer_id) {
      query.set("customer_id", payload.customer_id)
    }

    return this.requestJson<AssistantHistoryResponse>(`/chat/history/scoped?${query.toString()}`, {
      method: "GET",
      headers: this.authHeaders(),
    })
  }

  async handoff(payload: AssistantHandoffRequest) {
    return this.requestJson<AssistantHandoffResponse>("/handoff", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: this.jsonHeaders(),
    })
  }

  async reindex(payload: AssistantReindexRequest) {
    return this.requestJson<AssistantReindexResponse>("/ingest/medusa/products/sync", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: this.jsonHeaders(),
    })
  }

  async syncMarkdown(payload: AssistantMarkdownSyncRequest) {
    return this.requestJson<AssistantMarkdownSyncResponse>("/ingest/markdown/sync", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: this.jsonHeaders(),
    })
  }

  async createKnowledgeDocument(payload: AssistantKnowledgeDocumentRequest) {
    return this.requestJson<AssistantKnowledgeDocumentResponse>("/admin/knowledge/documents", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: this.jsonHeaders(),
    })
  }

  async indexVectors(payload: AssistantVectorIndexRequest) {
    return this.requestJson<AssistantVectorIndexResponse>("/ingest/vector/index", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: this.jsonHeaders(),
    })
  }

  async deleteProductFromIndex(input: { product_id: string; store_id?: string; locale?: string }) {
    return this.requestJson<Record<string, unknown>>("/ingest/vector/source", {
      method: "DELETE",
      body: JSON.stringify({
        store_id: input.store_id || "default",
        locale: input.locale || "ru",
        source_type: "medusa_product",
        source_id: input.product_id,
      }),
      headers: this.jsonHeaders(),
    })
  }

  async stats() {
    return this.requestJson<AssistantStatsResponse>("/admin/stats", {
      method: "GET",
      headers: this.authHeaders(),
    })
  }

  async testTelegramHandoffConnection() {
    return this.requestJson<AssistantTelegramHandoffConnectionTestResult>(
      "/admin/telegram/handoff/test-connection",
      {
        method: "POST",
        headers: this.jsonHeaders(),
      }
    )
  }

  async jobStatus(jobId: string) {
    return this.requestJson<AssistantJobStatusResponse>(`/ingest/jobs/${encodeURIComponent(jobId)}`, {
      method: "GET",
      headers: this.authHeaders(),
    })
  }

  async enqueueReindexIntent(payload: AssistantReindexIntentRequest) {
    return this.requestJson<Record<string, unknown>>("/admin/reindex/intents", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: this.jsonHeaders(),
    })
  }

  async listReindexIntents(params: { status?: string; limit?: number } = {}) {
    const query = new URLSearchParams()
    if (params.status) {
      query.set("status_filter", params.status)
    }
    if (params.limit) {
      query.set("limit", String(params.limit))
    }
    const suffix = query.toString() ? `?${query.toString()}` : ""
    return this.requestJson<Record<string, unknown>>(`/admin/reindex/intents${suffix}`, {
      method: "GET",
      headers: this.authHeaders(),
    })
  }

  async processReindexQueue(payload: { limit?: number; retry_backoff_seconds?: number } = {}) {
    return this.requestJson<Record<string, unknown>>("/admin/reindex/process", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: this.jsonHeaders(),
    })
  }

  private async requestJson<T>(path: string, init: RequestInit): Promise<T> {
    const response = await this.request(path, init)

    if (!response.ok) {
      throw await responseToError(response)
    }

    return response.json() as Promise<T>
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs)

    try {
      return await this.fetchImpl(buildAssistantUrl(this.config.baseUrl, path), {
        ...init,
        signal: controller.signal,
      })
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new AssistantClientError("AI Assistant request timed out", {
          status: 504,
          code: "AI_ASSISTANT_TIMEOUT",
          retryable: true,
        })
      }

      throw new AssistantClientError("AI Assistant request failed before receiving a response", {
        status: 502,
        code: "AI_ASSISTANT_NETWORK_ERROR",
        retryable: true,
        details: error,
      })
    } finally {
      clearTimeout(timeout)
    }
  }

  private jsonHeaders(extra: Record<string, string> = {}) {
    return {
      ...this.authHeaders(),
      "content-type": "application/json",
      ...extra,
    }
  }

  private authHeaders() {
    return {
      accept: "application/json",
      authorization: `Bearer ${this.config.serverToken}`,
    }
  }
}

export function buildAssistantUrl(baseUrl: string, path: string): string {
  const cleanBase = baseUrl.replace(/\/+$/, "")
  const cleanPath = path.startsWith("/") ? path : `/${path}`
  return `${cleanBase}${cleanPath}`
}

export function safePassthroughHeaders(headers: Record<string, string | string[] | undefined>) {
  const requestId = headerValue(headers["x-request-id"])
  const userAgent = headerValue(headers["user-agent"])
  const forwardedFor = headerValue(headers["x-forwarded-for"])
  const result: Record<string, string> = {}

  if (requestId) {
    result["x-request-id"] = requestId
  }
  if (userAgent) {
    result["user-agent"] = userAgent
  }
  if (forwardedFor) {
    result["x-forwarded-for"] = forwardedFor
  }

  return result
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

async function responseToError(response: Response) {
  let details: unknown = null
  let message = `AI Assistant returned HTTP ${response.status}`
  let code = "AI_ASSISTANT_REQUEST_FAILED"
  let retryable = response.status >= 500

  try {
    details = await response.json()
    const error = extractErrorPayload(details)
    if (error?.message && typeof error.message === "string") {
      message = error.message
    }
    if (error?.code && typeof error.code === "string") {
      code = error.code
    }
    if (typeof error?.retryable === "boolean") {
      retryable = error.retryable
    }
  } catch {
    details = await response.text().catch(() => null)
  }

  return new AssistantClientError(message, {
    status: response.status,
    code,
    retryable,
    details,
  })
}

function extractErrorPayload(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object") {
    return null
  }

  const root = payload as {
    error?: unknown
    detail?: { error?: unknown } | unknown
  }

  if (root.error && typeof root.error === "object") {
    return root.error as Record<string, unknown>
  }

  if (
    root.detail &&
    typeof root.detail === "object" &&
    "error" in root.detail &&
    root.detail.error &&
    typeof root.detail.error === "object"
  ) {
    return root.detail.error as Record<string, unknown>
  }

  return null
}
