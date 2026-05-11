import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { enqueueAssistantProductReindex } from "./_assistant-product-event"

export default async function assistantProductUpdatedHandler(args: SubscriberArgs<{ id?: string }>) {
  await enqueueAssistantProductReindex(args, {
    eventName: "product.updated",
    action: "reindex",
  })
}

export const config: SubscriberConfig = {
  event: "product.updated",
}
