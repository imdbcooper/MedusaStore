import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  DEFAULT_PAYMENT_FAILED_SMS_NOTIFICATION_TRIGGER_TYPE,
} from "../modules/notification-sms"
import sendPaymentFailedSmsNotificationWorkflow from "../workflows/send-payment-failed-sms-notification"

type PaymentFailedEventData = {
  payment_session_id?: string
  payment_id?: string
  provider_id?: string
  payment_status?: string
  payment_session_status?: string
  source?: string
}

export default async function paymentFailedSmsNotificationHandler({
  event: { data },
  container,
}: SubscriberArgs<PaymentFailedEventData>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const paymentSessionId = data.payment_session_id?.trim()

  if (!paymentSessionId) {
    logger.warn(
      "[payment-failed-sms-notification] skip: payment failed notification event received without payment_session_id"
    )

    return
  }

  const { result } = await sendPaymentFailedSmsNotificationWorkflow(container).run({
    input: {
      paymentSessionId,
      paymentId: data.payment_id,
      providerId: data.provider_id,
      paymentStatus: data.payment_status,
      paymentSessionStatus: data.payment_session_status,
      source: data.source,
    },
  })

  const workflowResult = result.result

  logger.info(
    `[payment-failed-sms-notification] completed status=${workflowResult.status} reason=${workflowResult.reason ?? "none"} payment_session_id=${workflowResult.payment_session_id} payment_collection_id=${workflowResult.payment_collection_id ?? "n/a"} cart_id=${workflowResult.cart_id ?? "n/a"} order_id=${workflowResult.order_id ?? "n/a"} payment_id=${workflowResult.payment_id ?? "n/a"} provider_id=${workflowResult.provider_id ?? "n/a"} payment_status=${workflowResult.payment_status ?? "n/a"} payment_session_status=${workflowResult.payment_session_status ?? "n/a"} recipient=${workflowResult.recipient ?? "n/a"} recipient_normalized=${workflowResult.recipient_normalized ?? "n/a"} recipient_source=${workflowResult.recipient_source ?? "n/a"} notification_id=${workflowResult.notification?.id ?? "n/a"} dedupe_key=${workflowResult.dedupe_key ?? "n/a"} duplicate_of_notification_id=${workflowResult.duplicate_of_notification_id ?? "n/a"} duplicate_of_notification_status=${workflowResult.duplicate_of_notification_status ?? "n/a"} duplicate_of_notification_created_at=${workflowResult.duplicate_of_notification_created_at ?? "n/a"} provider_requested=${workflowResult.provider_requested} provider_resolved=${workflowResult.provider_resolved} provider_label=${workflowResult.provider_label} dedupe_strategy=${workflowResult.dedupe_strategy} dedupe_race_window=${workflowResult.dedupe_race_window} source=${workflowResult.source ?? "n/a"}`
  )
}

export const config: SubscriberConfig = {
  event: DEFAULT_PAYMENT_FAILED_SMS_NOTIFICATION_TRIGGER_TYPE,
}
