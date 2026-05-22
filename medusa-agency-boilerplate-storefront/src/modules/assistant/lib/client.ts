import type {
  AssistantChatRequest,
  AssistantChatResponse,
  AssistantHandoffRequest,
  AssistantHandoffResponse,
  AssistantHistoryRequest,
  AssistantHistoryResponse,
} from "../types"

const DEFAULT_CHAT_ENDPOINT = "/store/assistant/chat"
const DEFAULT_HISTORY_ENDPOINT = "/store/assistant/history"
const DEFAULT_HANDOFF_ENDPOINT = "/store/assistant/handoff"

export function isAssistantWidgetEnabled() {
  return process.env.NEXT_PUBLIC_AI_ASSISTANT_WIDGET_ENABLED === "true"
}

export function getAssistantChatEndpoint() {
  return process.env.NEXT_PUBLIC_AI_ASSISTANT_CHAT_ENDPOINT || DEFAULT_CHAT_ENDPOINT
}

export function getAssistantHistoryEndpoint() {
  const chatEndpoint = getAssistantChatEndpoint()
  if (chatEndpoint.endsWith("/chat")) {
    return `${chatEndpoint.slice(0, -"/chat".length)}/history`
  }

  return DEFAULT_HISTORY_ENDPOINT
}

export function getAssistantHandoffEndpoint() {
  const chatEndpoint = getAssistantChatEndpoint()
  if (chatEndpoint.endsWith("/chat")) {
    return `${chatEndpoint.slice(0, -"/chat".length)}/handoff`
  }

  return DEFAULT_HANDOFF_ENDPOINT
}

function buildAssistantRequestHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    accept: "application/json",
    "content-type": "application/json",
  }

  const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY

  if (publishableKey) {
    headers["x-publishable-api-key"] = publishableKey
  }

  return headers
}

export async function sendAssistantMessage(input: AssistantChatRequest): Promise<AssistantChatResponse> {
  const response = await fetch(getAssistantChatEndpoint(), {
    method: "POST",
    headers: buildAssistantRequestHeaders(),
    body: JSON.stringify(input),
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(extractAssistantErrorMessage(payload, "Assistant request failed"))
  }

  return payload as AssistantChatResponse
}

export async function fetchAssistantHistory(input: AssistantHistoryRequest): Promise<AssistantHistoryResponse> {
  const response = await fetch(getAssistantHistoryEndpoint(), {
    method: "POST",
    headers: buildAssistantRequestHeaders(),
    body: JSON.stringify(input),
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(extractAssistantErrorMessage(payload, "Assistant history request failed"))
  }

  return payload as AssistantHistoryResponse
}

export async function submitAssistantHandoff(input: AssistantHandoffRequest): Promise<AssistantHandoffResponse> {
  const response = await fetch(getAssistantHandoffEndpoint(), {
    method: "POST",
    headers: buildAssistantRequestHeaders(),
    body: JSON.stringify(input),
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(extractAssistantErrorMessage(payload, "Assistant handoff request failed"))
  }

  return payload as AssistantHandoffResponse
}

function extractAssistantErrorMessage(payload: unknown, fallback: string) {
  return payload && typeof payload === "object" && "error" in payload
    ? String((payload as { error?: { message?: unknown } }).error?.message || fallback)
    : fallback
}
