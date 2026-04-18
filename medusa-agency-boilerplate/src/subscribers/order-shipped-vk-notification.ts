import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import sendOrderShippedVkNotificationWorkflow from "../workflows/send-order-shipped-vk-notification"

type OrderShippedEventData = {
  id?: string
  no_notification?: boolean
}

export default async function orderShippedVkNotificationHandler({
  event: { data },
  container,
}: SubscriberArgs<OrderShippedEventData>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const fulfillmentId = data.id?.trim()
  const noNotification = !!data.no_notification

  if (!fulfillmentId) {
    logger.warn(
      `[order-shipped-vk-notification] skip: shipment.created event received without fulfillment id no_notification=${noNotification}`
    )

    return
  }

  const { result } = await sendOrderShippedVkNotificationWorkflow(
    container
  ).run({
    input: {
      fulfillmentId,
      noNotification,
    },
  })

  const workflowResult = result.result

  logger.info(
    `[order-shipped-vk-notification] completed status=${workflowResult.status} reason=${workflowResult.reason ?? "none"} order_id=${workflowResult.order_id ?? "n/a"} display_id=${workflowResult.display_id ?? "n/a"} fulfillment_id=${workflowResult.fulfillment_id} customer_id=${workflowResult.customer_id ?? "n/a"} recipient=${workflowResult.recipient ?? "n/a"} recipient_normalized=${workflowResult.recipient_normalized ?? "n/a"} notification_id=${workflowResult.notification?.id ?? "n/a"} dedupe_key=${workflowResult.dedupe_key ?? "n/a"} duplicate_of_notification_id=${workflowResult.duplicate_of_notification_id ?? "n/a"} duplicate_of_notification_status=${workflowResult.duplicate_of_notification_status ?? "n/a"} duplicate_of_notification_created_at=${workflowResult.duplicate_of_notification_created_at ?? "n/a"} provider_requested=${workflowResult.provider_requested} provider_resolved=${workflowResult.provider_resolved} dedupe_strategy=${workflowResult.dedupe_strategy} dedupe_race_window=${workflowResult.dedupe_race_window} no_notification=${workflowResult.no_notification}`
  )
}

export const config: SubscriberConfig = {
  event: "shipment.created",
}
