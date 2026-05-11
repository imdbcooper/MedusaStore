import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { enqueueAssistantAllProductsReindex } from "./_assistant-product-event"

export default async function assistantProductCategoryUpdatedHandler(args: SubscriberArgs<{ id?: string }>) {
  await enqueueAssistantAllProductsReindex(args, {
    eventName: "product-category.updated",
  })
}

export const config: SubscriberConfig = {
  event: "product-category.updated",
}
