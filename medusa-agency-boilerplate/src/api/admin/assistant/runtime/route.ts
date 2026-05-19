import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { isEncryptionConfigured } from "../../../../lib/crypto/secret-cipher"
import { resolveAssistantAdapterConfig } from "../../../../lib/config"

export async function GET(_req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const adapter = resolveAssistantAdapterConfig()
  const missing: string[] = []

  if (process.env.AI_ASSISTANT_ENABLED !== "true") {
    missing.push("AI_ASSISTANT_ENABLED=true")
  }
  if (!adapter.baseUrl) {
    missing.push("AI_ASSISTANT_BASE_URL")
  }
  if (!adapter.serverToken) {
    missing.push("AI_ASSISTANT_SERVER_TOKEN")
  }

  const encryptionConfigured = isEncryptionConfigured()

  res.status(200).json({
    ok: true,
    runtime: {
      adapter: {
        enabled: adapter.enabled,
        base_url_configured: Boolean(adapter.baseUrl),
        server_token_configured: Boolean(adapter.serverToken),
        timeout_ms: adapter.timeoutMs,
        missing,
      },
      secrets: {
        assistant_settings_encryption_key_configured: encryptionConfigured,
      },
      capabilities: {
        provider_secrets_write: encryptionConfigured,
        assistant_backend_proxy: adapter.enabled,
        catalog_reindex: adapter.enabled,
        queue_processing: adapter.enabled,
        markdown_sync: adapter.enabled,
        vector_reindex: adapter.enabled,
      },
    },
  })
}
