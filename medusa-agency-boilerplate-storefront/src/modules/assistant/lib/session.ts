const ASSISTANT_SESSION_STORAGE_KEY = "medusastore:assistant_session_id"

function createFallbackSessionId() {
  return `assistant_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export function createAssistantSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }

  return createFallbackSessionId()
}

export function getAssistantSessionId() {
  if (typeof window === "undefined") {
    return createAssistantSessionId()
  }

  const existing = window.localStorage.getItem(ASSISTANT_SESSION_STORAGE_KEY)
  if (existing) {
    return existing
  }

  const next = createAssistantSessionId()
  window.localStorage.setItem(ASSISTANT_SESSION_STORAGE_KEY, next)
  return next
}

export function resetAssistantSessionId() {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.removeItem(ASSISTANT_SESSION_STORAGE_KEY)
}
