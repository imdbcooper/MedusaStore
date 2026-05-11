import type { SubscriberArgs } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { resolveAssistantAdapterConfig } from "../lib/config"

type ProductEventData = {
  id?: string
  product_id?: string
  product?: { id?: string }
  [key: string]: unknown
}

type AssistantProductReindexIntent = {
  type: "assistant.product_reindex.intent"
  event_name: string
  product_ids?: string[]
  scope?: "all_products"
  action?: "reindex" | "delete"
  reason: string
  event_id?: string
  coalescing_key: string
}

export async function enqueueAssistantProductReindex(
  args: SubscriberArgs<ProductEventData>,
  options: { eventName: string; action?: "reindex" | "delete" }
) {
  const logger = args.container.resolve(ContainerRegistrationKeys.LOGGER)
  const config = resolveAssistantAdapterConfig()

  if (!config.enabled) {
    logger.debug?.(`[assistant-adapter] skip ${options.eventName}: adapter disabled`)
    return
  }

  const productId = extractProductId(args.event.data)
  if (!productId) {
    logger.warn(`[assistant-adapter] skip ${options.eventName}: product id missing`)
    return
  }

  const intent: AssistantProductReindexIntent = {
    type: "assistant.product_reindex.intent",
    event_name: options.eventName,
    product_ids: [productId],
    action: options.action || "reindex",
    reason: options.eventName,
    event_id: extractEventId(args.event),
    coalescing_key: `assistant:product:${productId}`,
  }

  logger.info(
    `[assistant-adapter] enqueue intent ${intent.event_name} action=${intent.action} product_id=${productId} coalescing_key=${intent.coalescing_key} event_id=${intent.event_id ?? "n/a"}`
  )
}

export async function enqueueAssistantAllProductsReindex(
  args: SubscriberArgs<ProductEventData>,
  options: { eventName: string }
) {
  const logger = args.container.resolve(ContainerRegistrationKeys.LOGGER)
  const config = resolveAssistantAdapterConfig()

  if (!config.enabled) {
    logger.debug?.(`[assistant-adapter] skip ${options.eventName}: adapter disabled`)
    return
  }

  const intent: AssistantProductReindexIntent = {
    type: "assistant.product_reindex.intent",
    event_name: options.eventName,
    scope: "all_products",
    reason: `${options.eventName}:broad_catalog_event`,
    event_id: extractEventId(args.event),
    coalescing_key: "assistant:catalog:all-products",
  }

  logger.info(
    `[assistant-adapter] enqueue broad reindex intent ${intent.event_name} scope=${intent.scope} reason=${intent.reason} coalescing_key=${intent.coalescing_key} event_id=${intent.event_id ?? "n/a"}`
  )
}

export function extractProductId(data: ProductEventData = {}) {
  return data.product_id?.trim() || data.product?.id?.trim() || data.id?.trim() || undefined
}

function extractEventId(event: unknown): string | undefined {
  if (!event || typeof event !== "object") {
    return undefined
  }

  const eventId = (event as { id?: unknown; event_id?: unknown }).id || (event as { event_id?: unknown }).event_id
  return typeof eventId === "string" && eventId.trim() ? eventId.trim() : undefined
}
