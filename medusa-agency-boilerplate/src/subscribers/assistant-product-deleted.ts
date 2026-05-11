import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { enqueueAssistantProductReindex } from "./_assistant-product-event"

export default async function assistantProductDeletedHandler(args: SubscriberArgs<{ id?: string }>) {
  await enqueueAssistantProductReindex(args, {
    eventName: "product.deleted",
    action: "delete",
  })
}

export const config: SubscriberConfig = {
  event: "product.deleted",
}
