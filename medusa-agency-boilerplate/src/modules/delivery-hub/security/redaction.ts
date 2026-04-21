const SECRET_KEY_EXACT = new Set([
  "authorization",
  "proxyauthorization",
  "token",
  "accesstoken",
  "refreshtoken",
  "oauthtoken",
  "apikey",
  "xapikey",
  "credential",
  "credentials",
  "secret",
  "clientsecret",
  "serviceticket",
  "xyaserviceticket",
])

const SECRET_KEY_SUFFIXES = ["authorization", "token", "apikey", "secret"]

const SECRET_TEXT_PATTERNS = [
  /\b(Bearer)\s+([^\s,;]+)/gi,
  /((?:authorization|proxy-authorization|x-api-key|api[-_ ]?key|oauth[-_ ]?token|access[-_ ]?token|refresh[-_ ]?token|client[-_ ]?secret|service[-_ ]?ticket|x-ya-service-ticket|token|secret|credentials)["']?\s*[:=]\s*["']?)(?!Bearer\b)([^"',\s}\]]+)/gi,
]

export function redactValue(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }

  return "***"
}

export function redactRecord<T extends Record<string, unknown>>(input: T): T {
  return Object.entries(input).reduce((acc, [key, value]) => {
    acc[key as keyof T] = (
      isSecretLikeKey(key) ? redactSecretLike(value) : redactNestedValue(value)
    ) as T[keyof T]

    return acc
  }, {} as T)
}

export function redactSecretLike(value: unknown): unknown {
  if (typeof value === "string") {
    return redactValue(value)
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redactSecretLike(entry))
  }

  if (value && typeof value === "object") {
    return redactRecord(value as Record<string, unknown>)
  }

  if (value === null || typeof value === "undefined") {
    return value
  }

  return "***"
}

export function redactSensitiveText(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }

  return SECRET_TEXT_PATTERNS.reduce((current, pattern, index) => {
    if (index === 0) {
      return current.replace(pattern, "$1 ***")
    }

    return current.replace(pattern, "$1***")
  }, value)
}

function redactNestedValue(value: unknown): unknown {
  if (typeof value === "string") {
    return redactSensitiveText(value)
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redactNestedValue(entry))
  }

  if (value && typeof value === "object") {
    return redactRecord(value as Record<string, unknown>)
  }

  return value
}

function isSecretLikeKey(key: string) {
  const normalized = key.replace(/[^a-z0-9]/gi, "").toLowerCase()

  if (!normalized) {
    return false
  }

  if (SECRET_KEY_EXACT.has(normalized)) {
    return true
  }

  return SECRET_KEY_SUFFIXES.some((suffix) => normalized.endsWith(suffix))
}
