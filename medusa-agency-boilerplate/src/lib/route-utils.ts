import type { AssistantClientError } from "./assistant-client"

export function errorResponse(res: { status: (code: number) => { json: (body: unknown) => unknown } }, error: unknown) {
  const assistantError = error as Partial<AssistantClientError>
  const status = typeof assistantError.status === "number" ? assistantError.status : 500

  return res.status(status).json({
    ok: false,
    error: {
      code: assistantError.code || "AI_ASSISTANT_ADAPTER_ERROR",
      message: error instanceof Error ? error.message : "AI Assistant adapter request failed",
      retryable: Boolean(assistantError.retryable),
    },
  })
}

export function wantsEventStream(headers: Record<string, string | string[] | undefined>) {
  const accept = headers.accept
  const value = Array.isArray(accept) ? accept.join(",") : accept || ""
  return value.toLowerCase().includes("text/event-stream")
}

export function jsonResponse(res: { status: (code: number) => { json: (body: unknown) => unknown } }, status: number, body: unknown) {
  return res.status(status).json(body)
}
