import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import sendOrderPlacedNotificationWorkflow from "../workflows/send-order-placed-notification"

export default async function orderPlacedNotificationHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id?: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const orderId = data.id?.trim()

  if (!orderId) {
    logger.warn(
      "[order-placed-notification] skip: order.placed event received without order id"
    )

    return
  }

  const { result } = await sendOrderPlacedNotificationWorkflow(container).run({
    input: {
      orderId,
    },
  })

  logger.info(
    `[order-placed-notification] completed with status=${result.result.status} order_id=${result.result.order_id}`
  )
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
