import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { enqueueAssistantProductReindex } from "./_assistant-product-event"

export default async function assistantProductCreatedHandler(args: SubscriberArgs<{ id?: string }>) {
  await enqueueAssistantProductReindex(args, {
    eventName: "product.created",
    action: "reindex",
  })
}

export const config: SubscriberConfig = {
  event: "product.created",
}
