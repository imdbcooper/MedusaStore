import { AssistantBackendClient } from "../lib/assistant-client"
import { requireAssistantAdapterConfig, resolveAssistantAdapterConfig } from "../lib/config"

export function getAssistantAdapterRuntime() {
  const config = resolveAssistantAdapterConfig()

  return {
    config,
    enabled: config.enabled,
    client: config.enabled ? new AssistantBackendClient(config) : null,
  }
}

export function requireAssistantBackendClient() {
  return new AssistantBackendClient(requireAssistantAdapterConfig())
}
