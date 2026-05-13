import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { sanitizeLogValue } from "../modules/email-verification"
import sendEmailVerificationWorkflow from "../workflows/send-email-verification"

type VkLinkMetadataShape = {
  vk_user_id?: string | null
  vk_peer_id?: string | null
  link_status?: string | null
}

/**
 * Phase 5.2 fix #2: detect customers created through the VK ID register flow
 * so we can skip the transactional verification email. VK ID only releases
 * the user's primary email after VK-side confirmation, so re-asking the user
 * to verify it the first time they land on the storefront is spammy and
 * also breaks the UX promise that "logged in via VK = account ready".
 *
 * We recognise the skip signal via the metadata `createVkIdCustomer` stamps
 * synchronously right after `createCustomerAccountWorkflow`. Both signals must
 * hold:
 * - `vk_link.vk_user_id` is present (the register path links this customer
 *   to a VK identity immediately)
 * - `email_verified === true` (we trust VK's email for the first-send skip)
 */
function shouldSkipForVkRegisteredCustomer(
  metadata: Record<string, unknown> | null | undefined
): boolean {
  if (!metadata || typeof metadata !== "object") {
    return false
  }

  const emailVerified = (metadata as Record<string, unknown>).email_verified
  if (emailVerified !== true) {
    return false
  }

  const vkLink = (metadata as Record<string, unknown>).vk_link as
    | VkLinkMetadataShape
    | null
    | undefined

  if (!vkLink || typeof vkLink !== "object") {
    return false
  }

  const vkUserId =
    typeof vkLink.vk_user_id === "string" && vkLink.vk_user_id.trim()
      ? vkLink.vk_user_id.trim()
      : null

  return Boolean(vkUserId)
}

async function lookupCustomerMetadata(
  container: SubscriberArgs<{ id?: string }>["container"],
  customerId: string
): Promise<Record<string, unknown> | null> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "customer",
    fields: ["id", "metadata"],
    filters: { id: customerId },
  })

  const customer = data[0] as { metadata?: Record<string, unknown> | null } | undefined
  return customer?.metadata ?? null
}

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

  // Phase 5.2 fix #2: skip VK-registered customers before spinning up the
  // send workflow. Metadata read is best-effort — if it fails we fall back to
  // the send workflow so regular emailpass signups are not accidentally
  // blocked when the query module hiccups.
  try {
    const metadata = await lookupCustomerMetadata(container, customerId)
    if (shouldSkipForVkRegisteredCustomer(metadata)) {
      logger.info(
        `[email-verification-on-create] skip reason=vk_registered_already_verified customer_id=${sanitizeLogValue(customerId)}`
      )
      return
    }
  } catch (lookupError) {
    const lookupMessage =
      lookupError instanceof Error
        ? lookupError.name || "unknown_lookup_error"
        : "unknown_lookup_error"
    logger.warn(
      `[email-verification-on-create] metadata lookup failed, falling back to send path customer_id=${sanitizeLogValue(customerId)} error_name=${sanitizeLogValue(lookupMessage)}`
    )
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
