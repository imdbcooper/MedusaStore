import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { enqueueAssistantAllProductsReindex } from "./_assistant-product-event"

export default async function assistantProductCollectionUpdatedHandler(args: SubscriberArgs<{ id?: string }>) {
  await enqueueAssistantAllProductsReindex(args, {
    eventName: "product-collection.updated",
  })
}

export const config: SubscriberConfig = {
  event: "product-collection.updated",
}
