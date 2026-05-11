export type AssistantAdapterEnv = Record<string, string | undefined>

export type AssistantAdapterConfig = {
  baseUrl: string
  serverToken: string
  timeoutMs: number
  enabled: boolean
}

const DEFAULT_TIMEOUT_MS = 60_000

export function resolveAssistantAdapterConfig(
  env: AssistantAdapterEnv = process.env
): AssistantAdapterConfig {
  const baseUrl = trimTrailingSlash(env.AI_ASSISTANT_BASE_URL || "")
  const serverToken = env.AI_ASSISTANT_SERVER_TOKEN?.trim() || ""
  const timeoutMs = parsePositiveInteger(env.AI_ASSISTANT_TIMEOUT_MS, DEFAULT_TIMEOUT_MS)
  const explicitlyEnabled = env.AI_ASSISTANT_ENABLED === "true"
  const enabled = explicitlyEnabled && Boolean(baseUrl) && Boolean(serverToken)

  return {
    baseUrl,
    serverToken,
    timeoutMs,
    enabled,
  }
}

export function requireAssistantAdapterConfig(
  env: AssistantAdapterEnv = process.env
): AssistantAdapterConfig {
  const config = resolveAssistantAdapterConfig(env)

  if (!config.enabled) {
    const missing = []
    if (!config.baseUrl) {
      missing.push("AI_ASSISTANT_BASE_URL")
    }
    if (!config.serverToken) {
      missing.push("AI_ASSISTANT_SERVER_TOKEN")
    }
    if (env.AI_ASSISTANT_ENABLED !== "true") {
      missing.push("AI_ASSISTANT_ENABLED=true")
    }

    throw new Error(
      `AI Assistant adapter is disabled or incomplete: ${missing.join(", ") || "configuration missing"}`
    )
  }

  return config
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback
  }

  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function trimTrailingSlash(value: string): string {
  return value.trim().replace(/\/+$/, "")
}
