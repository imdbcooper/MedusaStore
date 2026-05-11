import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { enqueueAssistantProductReindex } from "./_assistant-product-event"

export default async function assistantProductVariantUpdatedHandler(
  args: SubscriberArgs<{ id?: string; product_id?: string }>
) {
  await enqueueAssistantProductReindex(args, {
    eventName: "product-variant.updated",
    action: "reindex",
  })
}

export const config: SubscriberConfig = {
  event: "product-variant.updated",
}
