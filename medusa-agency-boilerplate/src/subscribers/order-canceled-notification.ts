import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import sendOrderCanceledNotificationWorkflow from "../workflows/send-order-canceled-notification"

export default async function orderCanceledNotificationHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id?: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const orderId = data.id?.trim()

  if (!orderId) {
    logger.warn(
      "[order-canceled-notification] skip: order.canceled event received without order id"
    )

    return
  }

  const { result } = await sendOrderCanceledNotificationWorkflow(container).run({
    input: {
      orderId,
    },
  })

  const workflowResult = result.result

  logger.info(
    `[order-canceled-notification] completed status=${workflowResult.status} reason=${workflowResult.reason ?? "none"} order_id=${workflowResult.order_id} display_id=${workflowResult.display_id ?? "n/a"} canceled_at=${workflowResult.canceled_at ?? "n/a"} recipient=${workflowResult.recipient ?? "n/a"} recipient_normalized=${workflowResult.recipient_normalized ?? "n/a"} notification_id=${workflowResult.notification?.id ?? "n/a"} dedupe_key=${workflowResult.dedupe_key ?? "n/a"} duplicate_of_notification_id=${workflowResult.duplicate_of_notification_id ?? "n/a"} duplicate_of_notification_status=${workflowResult.duplicate_of_notification_status ?? "n/a"} duplicate_of_notification_created_at=${workflowResult.duplicate_of_notification_created_at ?? "n/a"} provider_requested=${workflowResult.provider_requested} provider_resolved=${workflowResult.provider_resolved} dedupe_strategy=${workflowResult.dedupe_strategy} dedupe_race_window=${workflowResult.dedupe_race_window}`
  )
}

export const config: SubscriberConfig = {
  event: "order.canceled",
}
