import type { AssistantMessage } from "../types"

const HISTORY_SCHEMA_VERSION = 1
const HISTORY_STORAGE_PREFIX = "medusastore:assistant_history"
const MAX_MESSAGES = 50
const MAX_CONTENT_LENGTH = 4000
const MAX_PRODUCT_COUNT = 6
const MAX_ACTION_COUNT = 8
const OPTIMISTIC_REPLACEMENT_WINDOW_MS = 120_000

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
  const result = [...localMessages]
  const replacedLocalIndices = new Set<number>()
  for (const remoteMessage of remoteMessages) {
    const localIndex = findOptimisticLocalMatch(result, remoteMessage, replacedLocalIndices)
    if (localIndex >= 0) {
      result[localIndex] = remoteMessage
      replacedLocalIndices.add(localIndex)
      continue
    }
    result.push(remoteMessage)
  }

  const deduped: AssistantMessage[] = []
  const seen = new Set<string>()
  for (const message of result) {
    pushUniqueMessage(deduped, seen, message)
  }

  return sanitizeMessages(deduped)
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
      metadata: sanitizeMessageMetadata(message.metadata),
      safety: message.safety,
      created_at: safeIsoDateString(message.created_at),
      pending: message.pending === true ? true : undefined,
      error: message.error ? safeString(message.error, 512) : undefined,
    }))
    .filter((message) => message.content.length > 0)
}

function sanitizeMessageMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return undefined
  }

  const record = metadata as Record<string, unknown>
  const source = typeof record.source === "string" ? record.source.trim() : ""
  if (source === "telegram_operator") {
    return { source }
  }

  return undefined
}

function safeString(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return ""
  }

  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value
}

function safeIsoDateString(value: unknown) {
  if (typeof value !== "string") {
    return undefined
  }

  const normalized = value.trim()
  if (!normalized || Number.isNaN(Date.parse(normalized))) {
    return undefined
  }

  return normalized
}

function stableMessageKey(message: AssistantMessage) {
  if (message.id) {
    return `id:${message.id}`
  }

  return `content:${message.role}:${message.content}`
}

function pushUniqueMessage(messages: AssistantMessage[], seen: Set<string>, message: AssistantMessage) {
  const key = stableMessageKey(message)
  if (seen.has(key)) {
    return
  }
  seen.add(key)
  messages.push(message)
}

function findOptimisticLocalMatch(
  localMessages: AssistantMessage[],
  remoteMessage: AssistantMessage,
  usedLocalIndices: Set<number>
) {
  if (!isOptimisticReplacementCandidate(remoteMessage)) {
    return -1
  }

  let bestIndex = -1
  let bestDistance = Number.POSITIVE_INFINITY
  const remoteTimestamp = parseMessageTimestamp(remoteMessage.created_at)
  if (remoteTimestamp === null) {
    return -1
  }

  for (let index = 0; index < localMessages.length; index += 1) {
    if (usedLocalIndices.has(index)) {
      continue
    }

    const localMessage = localMessages[index]
    if (!isOptimisticLocalUserMessage(localMessage)) {
      continue
    }
    if (normalizeComparableContent(localMessage.content) !== normalizeComparableContent(remoteMessage.content)) {
      continue
    }

    const localTimestamp = parseMessageTimestamp(localMessage.created_at)
    if (localTimestamp === null) {
      continue
    }

    const distance = Math.abs(remoteTimestamp - localTimestamp)
    if (distance > OPTIMISTIC_REPLACEMENT_WINDOW_MS || distance >= bestDistance) {
      continue
    }

    bestDistance = distance
    bestIndex = index
  }

  return bestIndex
}

function isOptimisticReplacementCandidate(message: AssistantMessage) {
  return message.role === "user" && Boolean(message.id) && typeof message.created_at === "string"
}

function isOptimisticLocalUserMessage(message: AssistantMessage) {
  return message.role === "user" && message.pending === true
}

function normalizeComparableContent(content: string) {
  return content.trim().replace(/\s+/g, " ")
}

function parseMessageTimestamp(value: string | undefined) {
  if (!value) {
    return null
  }

  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? null : timestamp
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
