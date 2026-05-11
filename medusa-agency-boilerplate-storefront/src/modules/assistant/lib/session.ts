const ASSISTANT_SESSION_STORAGE_KEY = "medusastore:assistant_session_id"

function createFallbackSessionId() {
  const randomPart = Math.random().toString(16).slice(2).padEnd(12, "0")
  const timePart = Date.now().toString(16).padStart(12, "0")

  return `00000000-0000-4000-8000-${randomPart.slice(0, 8)}${timePart.slice(-4)}`
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

  try {
    const existing = window.localStorage.getItem(ASSISTANT_SESSION_STORAGE_KEY)
    if (existing) {
      return existing
    }

    const next = createAssistantSessionId()
    window.localStorage.setItem(ASSISTANT_SESSION_STORAGE_KEY, next)
    return next
  } catch {
    return createAssistantSessionId()
  }
}

export function resetAssistantSessionId() {
  if (typeof window === "undefined") {
    return
  }

  try {
    window.localStorage.removeItem(ASSISTANT_SESSION_STORAGE_KEY)
  } catch {
    // Ignore storage errors in private/incognito contexts.
  }
}
