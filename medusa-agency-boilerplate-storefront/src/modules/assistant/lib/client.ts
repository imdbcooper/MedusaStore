import type { AssistantChatRequest, AssistantChatResponse } from "../types"

const DEFAULT_CHAT_ENDPOINT = "/store/assistant/chat"

export function isAssistantWidgetEnabled() {
  return process.env.NEXT_PUBLIC_AI_ASSISTANT_WIDGET_ENABLED === "true"
}

export function getAssistantChatEndpoint() {
  return process.env.NEXT_PUBLIC_AI_ASSISTANT_CHAT_ENDPOINT || DEFAULT_CHAT_ENDPOINT
}

export async function sendAssistantMessage(input: AssistantChatRequest): Promise<AssistantChatResponse> {
  const response = await fetch(getAssistantChatEndpoint(), {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error?: { message?: unknown } }).error?.message || "Assistant request failed")
        : "Assistant request failed"
    throw new Error(message)
  }

  return payload as AssistantChatResponse
}
