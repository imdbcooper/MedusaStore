import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { sanitizeLogValue } from "../modules/email-verification"
import sendEmailVerificationWorkflow from "../workflows/send-email-verification"

export default async function customerCreatedEmailVerificationHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id?: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const customerId = data.id?.trim()

  if (!customerId) {
    logger.warn(
      "[email-verification-on-create] skip: customer.created event received without customer id"
    )
    return
  }

  try {
    const { result } = await sendEmailVerificationWorkflow(container).run({
      input: {
        customerId,
        reason: "customer_created",
      },
    })

    const outcome = result.result

    logger.info(
      `[email-verification-on-create] completed status=${outcome.status} reason=${outcome.reason ?? "none"} customer_id=${sanitizeLogValue(outcome.customer_id)} recipient=${sanitizeLogValue(outcome.recipient)} notification_id=${sanitizeLogValue(outcome.notification?.id)} expires_at=${sanitizeLogValue(outcome.expires_at)} provider_requested=${outcome.provider_requested} provider_resolved=${outcome.provider_resolved}`
    )
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "unknown_workflow_error"
    logger.error(
      `[email-verification-on-create] send failed customer_id=${sanitizeLogValue(customerId)} message=${sanitizeLogValue(message)}`
    )
  }
}

export const config: SubscriberConfig = {
  event: "customer.created",
}
