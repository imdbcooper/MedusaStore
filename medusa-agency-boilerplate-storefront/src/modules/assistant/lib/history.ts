import type { AssistantMessage } from "../types"

const HISTORY_SCHEMA_VERSION = 1
const HISTORY_STORAGE_PREFIX = "medusastore:assistant_history"
const MAX_MESSAGES = 50
const MAX_CONTENT_LENGTH = 4000
const MAX_PRODUCT_COUNT = 6
const MAX_ACTION_COUNT = 8

type AssistantHistoryScope = {
  storeId: string
  locale: string
  countryCode: string
}

type PersistedAssistantHistory = {
  version: number
  session_id: string
  scope: AssistantHistoryScope
  updated_at: string
  messages: AssistantMessage[]
}

export type AssistantHistorySnapshot = {
  sessionId: string
  messages: AssistantMessage[]
  updatedAt: string
}

export function loadAssistantHistory(scope: AssistantHistoryScope, sessionId: string): AssistantHistorySnapshot | null {
  const storage = getStorage()
  if (!storage) {
    return null
  }

  try {
    const raw = storage.getItem(storageKey(scope))
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as Partial<PersistedAssistantHistory>
    if (parsed.version !== HISTORY_SCHEMA_VERSION || parsed.session_id !== sessionId) {
      return null
    }
    if (!isMatchingScope(parsed.scope, scope) || !Array.isArray(parsed.messages)) {
      return null
    }

    const messages = sanitizeMessages(parsed.messages)
    if (!messages.length) {
      return null
    }

    return {
      sessionId: parsed.session_id,
      messages,
      updatedAt: typeof parsed.updated_at === "string" ? parsed.updated_at : new Date(0).toISOString(),
    }
  } catch {
    return null
  }
}

export function saveAssistantHistory(scope: AssistantHistoryScope, sessionId: string, messages: AssistantMessage[]) {
  const storage = getStorage()
  if (!storage || !sessionId) {
    return
  }

  const sanitized = sanitizeMessages(messages)
  if (!sanitized.length) {
    return
  }

  const payload: PersistedAssistantHistory = {
    version: HISTORY_SCHEMA_VERSION,
    session_id: sessionId,
    scope,
    updated_at: new Date().toISOString(),
    messages: sanitized,
  }

  try {
    storage.setItem(storageKey(scope), JSON.stringify(payload))
  } catch {
    // Ignore quota/private-mode errors. The backend chat flow must keep working without local persistence.
  }
}

export function mergeAssistantMessages(localMessages: AssistantMessage[], remoteMessages: AssistantMessage[]) {
  const result: AssistantMessage[] = []
  const seen = new Set<string>()

  for (const message of [...localMessages, ...remoteMessages]) {
    const key = stableMessageKey(message)
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    result.push(message)
  }

  return sanitizeMessages(result)
}

function sanitizeMessages(messages: AssistantMessage[]) {
  return messages
    .filter((message) => message && (message.role === "user" || message.role === "assistant" || message.role === "system"))
    .slice(-MAX_MESSAGES)
    .map((message) => ({
      id: safeString(message.id, 128) || stableMessageKey(message),
      role: message.role,
      content: safeString(message.content, MAX_CONTENT_LENGTH),
      products: Array.isArray(message.products) ? message.products.slice(0, MAX_PRODUCT_COUNT) : undefined,
      actions: Array.isArray(message.actions) ? message.actions.slice(0, MAX_ACTION_COUNT) : undefined,
      safety: message.safety,
      error: message.error ? safeString(message.error, 512) : undefined,
    }))
    .filter((message) => message.content.length > 0)
}

function safeString(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return ""
  }

  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value
}

function stableMessageKey(message: AssistantMessage) {
  if (message.id) {
    return `id:${message.id}`
  }

  return `content:${message.role}:${message.content}`
}

function storageKey(scope: AssistantHistoryScope) {
  return `${HISTORY_STORAGE_PREFIX}:${encodeScopePart(scope.storeId)}:${encodeScopePart(scope.locale)}:${encodeScopePart(scope.countryCode)}`
}

function encodeScopePart(value: string) {
  return encodeURIComponent(value || "default")
}

function isMatchingScope(candidate: Partial<AssistantHistoryScope> | undefined, scope: AssistantHistoryScope) {
  return (
    candidate?.storeId === scope.storeId &&
    candidate?.locale === scope.locale &&
    candidate?.countryCode === scope.countryCode
  )
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null
  }

  try {
    return window.localStorage
  } catch {
    return null
  }
}
