import type { SubscriberArgs } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { resolveAssistantAdapterConfig } from "./config"
import { AssistantBackendClient, type AssistantReindexIntentRequest } from "./assistant-client"

export type AssistantProductReindexIntent = AssistantReindexIntentRequest & {
  event_name: string
  coalescing_key: string
}

export async function enqueueAssistantReindexIntent(
  args: SubscriberArgs<unknown>,
  intent: AssistantProductReindexIntent
) {
  const logger = args.container.resolve(ContainerRegistrationKeys.LOGGER)
  const config = resolveAssistantAdapterConfig()

  if (!config.enabled) {
    logger.debug?.(`[assistant-adapter] skip ${intent.event_name}: adapter disabled`)
    return null
  }

  const client = new AssistantBackendClient(config)
  const payload: AssistantReindexIntentRequest = {
    store_id: intent.store_id || "default",
    tenant_id: intent.tenant_id,
    locale: intent.locale || "ru",
    event_name: intent.event_name,
    event_id: intent.event_id,
    action: intent.action || "reindex",
    scope: intent.scope || "products",
    product_ids: intent.product_ids || [],
    reason: intent.reason || intent.event_name,
    coalescing_key: intent.coalescing_key,
    max_attempts: intent.max_attempts || 3,
    metadata: intent.metadata || {},
  }

  const response = await client.enqueueReindexIntent(payload)
  logger.info(
    `[assistant-adapter] queued reindex intent event=${payload.event_name} action=${payload.action} scope=${payload.scope} coalescing_key=${payload.coalescing_key}`
  )
  return response
}
