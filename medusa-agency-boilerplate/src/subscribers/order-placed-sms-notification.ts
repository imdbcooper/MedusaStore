import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import sendOrderPlacedSmsNotificationWorkflow from "../workflows/send-order-placed-sms-notification"

export default async function orderPlacedSmsNotificationHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id?: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const orderId = data.id?.trim()

  if (!orderId) {
    logger.warn(
      "[order-placed-sms-notification] skip: order.placed event received without order id"
    )

    return
  }

  const { result } = await sendOrderPlacedSmsNotificationWorkflow(container).run({
    input: {
      orderId,
    },
  })

  const workflowResult = result.result

  logger.info(
    `[order-placed-sms-notification] completed status=${workflowResult.status} reason=${workflowResult.reason ?? "none"} order_id=${workflowResult.order_id} customer_id=${workflowResult.customer_id ?? "n/a"} recipient=${workflowResult.recipient ?? "n/a"} recipient_normalized=${workflowResult.recipient_normalized ?? "n/a"} recipient_source=${workflowResult.recipient_source ?? "n/a"} notification_id=${workflowResult.notification?.id ?? "n/a"} dedupe_key=${workflowResult.dedupe_key ?? "n/a"} duplicate_of_notification_id=${workflowResult.duplicate_of_notification_id ?? "n/a"} duplicate_of_notification_status=${workflowResult.duplicate_of_notification_status ?? "n/a"} duplicate_of_notification_created_at=${workflowResult.duplicate_of_notification_created_at ?? "n/a"} provider_requested=${workflowResult.provider_requested} provider_resolved=${workflowResult.provider_resolved} provider_label=${workflowResult.provider_label} dedupe_strategy=${workflowResult.dedupe_strategy} dedupe_race_window=${workflowResult.dedupe_race_window}`
  )
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
