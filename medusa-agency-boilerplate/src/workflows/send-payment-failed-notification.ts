import type { CreateNotificationDTO, NotificationDTO } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  DEFAULT_PAYMENT_FAILED_NOTIFICATION_TEMPLATE,
  DEFAULT_PAYMENT_FAILED_NOTIFICATION_TRIGGER_TYPE,
  NOTIFICATION_DEDUPE_AUTHORITY,
  NOTIFICATION_DEDUPE_CANONICAL_FIELDS,
  NOTIFICATION_DEDUPE_RACE_WINDOW,
  NOTIFICATION_DEDUPE_STRATEGY,
  buildNotificationDedupeKey,
  getNotificationEmailRuntime,
  normalizeNotificationRecipient,
} from "../modules/notification-email"
import { renderPaymentFailedEmail } from "../modules/order-email-templates"

type SendPaymentFailedNotificationInput = {
  paymentSessionId: string
  paymentId?: string | null
  providerId?: string | null
  paymentStatus?: string | null
  paymentSessionStatus?: string | null
  source?: string | null
}

type PaymentSessionNotificationRecord = {
  id: string
  provider_id: string | null
  status: string | null
  payment_collection_id: string | null
  data?: Record<string, unknown> | null
}

type CartPaymentCollectionRecord = {
  cart_id: string
}

type CartNotificationRecord = {
  id: string
  email: string | null
}

type OrderCartRecord = {
  id: string
}

type ExistingNotificationRecord = {
  id: string
  to: string
  status: NotificationDTO["status"]
  created_at: Date | string
}

type SendPaymentFailedNotificationResult = {
  status: "sent" | "skipped"
  reason:
    | "payment_session_not_found"
    | "non_terminal_payment_state"
    | "payment_already_completed"
    | "payment_collection_not_found"
    | "cart_link_not_found"
    | "cart_not_found"
    | "missing_cart_email"
    | "duplicate_notification"
    | null
  payment_session_id: string
  payment_collection_id: string | null
  cart_id: string | null
  order_id: string | null
  payment_id: string | null
  provider_id: string | null
  payment_status: string | null
  payment_session_status: string | null
  recipient: string | null
  recipient_normalized: string | null
  template: string
  trigger_type: string
  provider_requested: ReturnType<typeof getNotificationEmailRuntime>["requestedProviderId"]
  provider_resolved: ReturnType<typeof getNotificationEmailRuntime>["providerId"]
  dedupe_key: string | null
  dedupe_authority: typeof NOTIFICATION_DEDUPE_AUTHORITY
  dedupe_strategy: typeof NOTIFICATION_DEDUPE_STRATEGY
  dedupe_race_window: typeof NOTIFICATION_DEDUPE_RACE_WINDOW
  dedupe_canonical_fields: readonly string[]
  duplicate_of_notification_id: string | null
  duplicate_of_notification_status: NotificationDTO["status"] | null
  duplicate_of_notification_created_at: string | null
  source: string | null
  notification?: NotificationDTO
}

type SendPaymentFailedNotificationOutput = {
  result: SendPaymentFailedNotificationResult
}

function toNotificationTimestamp(value?: Date | string | null): string | null {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toISOString()
}

function selectDuplicateNotification(
  notifications: ExistingNotificationRecord[],
  normalizedRecipient: string
): ExistingNotificationRecord | undefined {
  return notifications
    .filter((notification) => {
      return normalizeNotificationRecipient(notification.to) === normalizedRecipient
    })
    .sort((left, right) => {
      const leftTimestamp = toNotificationTimestamp(left.created_at) || ""
      const rightTimestamp = toNotificationTimestamp(right.created_at) || ""

      if (leftTimestamp === rightTimestamp) {
        return left.id.localeCompare(right.id)
      }

      return leftTimestamp.localeCompare(rightTimestamp)
    })[0]
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function isTerminalFailedPaymentStatus(status?: string | null) {
  return status === "canceled"
}

const sendPaymentFailedNotificationStep = createStep(
  "send-payment-failed-notification-step",
  async (input: SendPaymentFailedNotificationInput, { container }) => {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const notificationModuleService = container.resolve(Modules.NOTIFICATION)
    const notificationRuntime = getNotificationEmailRuntime()
    const template = DEFAULT_PAYMENT_FAILED_NOTIFICATION_TEMPLATE
    const triggerType = DEFAULT_PAYMENT_FAILED_NOTIFICATION_TRIGGER_TYPE
    const dedupeCanonicalFields = [...NOTIFICATION_DEDUPE_CANONICAL_FIELDS]

    const skip = (
      reason: SendPaymentFailedNotificationResult["reason"],
      details?: Partial<SendPaymentFailedNotificationResult>
    ) => {
      return new StepResponse<SendPaymentFailedNotificationResult>({
        status: "skipped",
        reason,
        payment_session_id: details?.payment_session_id ?? input.paymentSessionId,
        payment_collection_id: details?.payment_collection_id ?? null,
        cart_id: details?.cart_id ?? null,
        order_id: details?.order_id ?? null,
        payment_id: details?.payment_id ?? input.paymentId ?? null,
        provider_id: details?.provider_id ?? input.providerId ?? null,
        payment_status: details?.payment_status ?? input.paymentStatus ?? null,
        payment_session_status:
          details?.payment_session_status ?? input.paymentSessionStatus ?? null,
        recipient: details?.recipient ?? null,
        recipient_normalized: details?.recipient_normalized ?? null,
        template,
        trigger_type: triggerType,
        provider_requested: notificationRuntime.requestedProviderId,
        provider_resolved: notificationRuntime.providerId,
        dedupe_key: details?.dedupe_key ?? null,
        dedupe_authority: NOTIFICATION_DEDUPE_AUTHORITY,
        dedupe_strategy: NOTIFICATION_DEDUPE_STRATEGY,
        dedupe_race_window: NOTIFICATION_DEDUPE_RACE_WINDOW,
        dedupe_canonical_fields: dedupeCanonicalFields,
        duplicate_of_notification_id:
          details?.duplicate_of_notification_id ?? null,
        duplicate_of_notification_status:
          details?.duplicate_of_notification_status ?? null,
        duplicate_of_notification_created_at:
          details?.duplicate_of_notification_created_at ?? null,
        source: details?.source ?? input.source ?? null,
      })
    }

    const { data: sessions } = await query.graph({
      entity: "payment_session",
      fields: ["id", "provider_id", "status", "payment_collection_id", "data"],
      filters: {
        id: input.paymentSessionId,
      },
    })

    const paymentSession = sessions[0] as PaymentSessionNotificationRecord | undefined

    if (!paymentSession) {
      logger.warn(
        `[payment-failed-notification] skip reason=payment_session_not_found payment_session_id=${input.paymentSessionId} payment_collection_id=n/a cart_id=n/a order_id=n/a payment_id=${input.paymentId ?? "n/a"} provider_id=${input.providerId ?? "n/a"} payment_status=${input.paymentStatus ?? "n/a"} payment_session_status=${input.paymentSessionStatus ?? "n/a"} recipient=n/a recipient_normalized=n/a dedupe_key=n/a duplicate_of_notification_id=n/a provider_requested=${notificationRuntime.requestedProviderId} provider_resolved=${notificationRuntime.providerId} status=skipped dedupe_strategy=${NOTIFICATION_DEDUPE_STRATEGY} dedupe_race_window=${NOTIFICATION_DEDUPE_RACE_WINDOW} source=${input.source ?? "n/a"}`
      )

      return skip("payment_session_not_found")
    }

    const paymentStatus =
      getString(input.paymentStatus) ||
      getString(paymentSession.data?.status) ||
      getString(paymentSession.status)
    const paymentSessionStatus =
      getString(input.paymentSessionStatus) || getString(paymentSession.status)
    const providerId =
      getString(input.providerId) || getString(paymentSession.provider_id) || null
    const paymentId =
      getString(input.paymentId) || getString(paymentSession.data?.id) || null

    if (!isTerminalFailedPaymentStatus(paymentStatus)) {
      logger.info(
        `[payment-failed-notification] skip reason=non_terminal_payment_state payment_session_id=${paymentSession.id} payment_collection_id=${paymentSession.payment_collection_id ?? "n/a"} cart_id=n/a order_id=n/a payment_id=${paymentId ?? "n/a"} provider_id=${providerId ?? "n/a"} payment_status=${paymentStatus ?? "n/a"} payment_session_status=${paymentSessionStatus ?? "n/a"} recipient=n/a recipient_normalized=n/a dedupe_key=n/a duplicate_of_notification_id=n/a provider_requested=${notificationRuntime.requestedProviderId} provider_resolved=${notificationRuntime.providerId} status=skipped dedupe_strategy=${NOTIFICATION_DEDUPE_STRATEGY} dedupe_race_window=${NOTIFICATION_DEDUPE_RACE_WINDOW} source=${input.source ?? "n/a"}`
      )

      return skip("non_terminal_payment_state", {
        payment_collection_id: paymentSession.payment_collection_id,
        payment_id: paymentId,
        provider_id: providerId,
        payment_status: paymentStatus,
        payment_session_status: paymentSessionStatus,
      })
    }

    const { data: payments } = await query.graph({
      entity: "payment",
      fields: ["id"],
      filters: {
        payment_session_id: paymentSession.id,
      },
    })

    if (payments.length > 0) {
      logger.info(
        `[payment-failed-notification] skip reason=payment_already_completed payment_session_id=${paymentSession.id} payment_collection_id=${paymentSession.payment_collection_id ?? "n/a"} cart_id=n/a order_id=n/a payment_id=${paymentId ?? "n/a"} provider_id=${providerId ?? "n/a"} payment_status=${paymentStatus ?? "n/a"} payment_session_status=${paymentSessionStatus ?? "n/a"} recipient=n/a recipient_normalized=n/a dedupe_key=n/a duplicate_of_notification_id=n/a provider_requested=${notificationRuntime.requestedProviderId} provider_resolved=${notificationRuntime.providerId} status=skipped dedupe_strategy=${NOTIFICATION_DEDUPE_STRATEGY} dedupe_race_window=${NOTIFICATION_DEDUPE_RACE_WINDOW} source=${input.source ?? "n/a"}`
      )

      return skip("payment_already_completed", {
        payment_collection_id: paymentSession.payment_collection_id,
        payment_id: paymentId,
        provider_id: providerId,
        payment_status: paymentStatus,
        payment_session_status: paymentSessionStatus,
      })
    }

    if (!paymentSession.payment_collection_id) {
      logger.warn(
        `[payment-failed-notification] skip reason=payment_collection_not_found payment_session_id=${paymentSession.id} payment_collection_id=n/a cart_id=n/a order_id=n/a payment_id=${paymentId ?? "n/a"} provider_id=${providerId ?? "n/a"} payment_status=${paymentStatus ?? "n/a"} payment_session_status=${paymentSessionStatus ?? "n/a"} recipient=n/a recipient_normalized=n/a dedupe_key=n/a duplicate_of_notification_id=n/a provider_requested=${notificationRuntime.requestedProviderId} provider_resolved=${notificationRuntime.providerId} status=skipped dedupe_strategy=${NOTIFICATION_DEDUPE_STRATEGY} dedupe_race_window=${NOTIFICATION_DEDUPE_RACE_WINDOW} source=${input.source ?? "n/a"}`
      )

      return skip("payment_collection_not_found", {
        payment_id: paymentId,
        provider_id: providerId,
        payment_status: paymentStatus,
        payment_session_status: paymentSessionStatus,
      })
    }

    const { data: cartPaymentCollections } = await query.graph({
      entity: "cart_payment_collection",
      fields: ["cart_id"],
      filters: {
        payment_collection_id: paymentSession.payment_collection_id,
      },
    })

    const cartPaymentCollection = cartPaymentCollections[0] as
      | CartPaymentCollectionRecord
      | undefined

    if (!cartPaymentCollection?.cart_id) {
      logger.warn(
        `[payment-failed-notification] skip reason=cart_link_not_found payment_session_id=${paymentSession.id} payment_collection_id=${paymentSession.payment_collection_id} cart_id=n/a order_id=n/a payment_id=${paymentId ?? "n/a"} provider_id=${providerId ?? "n/a"} payment_status=${paymentStatus ?? "n/a"} payment_session_status=${paymentSessionStatus ?? "n/a"} recipient=n/a recipient_normalized=n/a dedupe_key=n/a duplicate_of_notification_id=n/a provider_requested=${notificationRuntime.requestedProviderId} provider_resolved=${notificationRuntime.providerId} status=skipped dedupe_strategy=${NOTIFICATION_DEDUPE_STRATEGY} dedupe_race_window=${NOTIFICATION_DEDUPE_RACE_WINDOW} source=${input.source ?? "n/a"}`
      )

      return skip("cart_link_not_found", {
        payment_collection_id: paymentSession.payment_collection_id,
        payment_id: paymentId,
        provider_id: providerId,
        payment_status: paymentStatus,
        payment_session_status: paymentSessionStatus,
      })
    }

    const cartId = cartPaymentCollection.cart_id

    const { data: carts } = await query.graph({
      entity: "cart",
      fields: ["id", "email"],
      filters: {
        id: cartId,
      },
    })

    const cart = carts[0] as CartNotificationRecord | undefined

    if (!cart) {
      logger.warn(
        `[payment-failed-notification] skip reason=cart_not_found payment_session_id=${paymentSession.id} payment_collection_id=${paymentSession.payment_collection_id} cart_id=${cartId} order_id=n/a payment_id=${paymentId ?? "n/a"} provider_id=${providerId ?? "n/a"} payment_status=${paymentStatus ?? "n/a"} payment_session_status=${paymentSessionStatus ?? "n/a"} recipient=n/a recipient_normalized=n/a dedupe_key=n/a duplicate_of_notification_id=n/a provider_requested=${notificationRuntime.requestedProviderId} provider_resolved=${notificationRuntime.providerId} status=skipped dedupe_strategy=${NOTIFICATION_DEDUPE_STRATEGY} dedupe_race_window=${NOTIFICATION_DEDUPE_RACE_WINDOW} source=${input.source ?? "n/a"}`
      )

      return skip("cart_not_found", {
        payment_collection_id: paymentSession.payment_collection_id,
        cart_id: cartId,
        payment_id: paymentId,
        provider_id: providerId,
        payment_status: paymentStatus,
        payment_session_status: paymentSessionStatus,
      })
    }

    const { data: orderLinks } = await query.graph({
      entity: "order_cart",
      fields: ["id"],
      filters: {
        cart_id: cart.id,
      },
    })

    const order =
      ((orderLinks?.[0] as unknown as OrderCartRecord | undefined) ?? null)
    const normalizedRecipient = normalizeNotificationRecipient(cart.email)

    if (!normalizedRecipient) {
      logger.warn(
        `[payment-failed-notification] skip reason=missing_cart_email payment_session_id=${paymentSession.id} payment_collection_id=${paymentSession.payment_collection_id} cart_id=${cart.id} order_id=${order?.id ?? "n/a"} payment_id=${paymentId ?? "n/a"} provider_id=${providerId ?? "n/a"} payment_status=${paymentStatus ?? "n/a"} payment_session_status=${paymentSessionStatus ?? "n/a"} recipient=n/a recipient_normalized=n/a dedupe_key=n/a duplicate_of_notification_id=n/a provider_requested=${notificationRuntime.requestedProviderId} provider_resolved=${notificationRuntime.providerId} status=skipped dedupe_strategy=${NOTIFICATION_DEDUPE_STRATEGY} dedupe_race_window=${NOTIFICATION_DEDUPE_RACE_WINDOW} source=${input.source ?? "n/a"}`
      )

      return skip("missing_cart_email", {
        payment_collection_id: paymentSession.payment_collection_id,
        cart_id: cart.id,
        order_id: order?.id ?? null,
        payment_id: paymentId,
        provider_id: providerId,
        payment_status: paymentStatus,
        payment_session_status: paymentSessionStatus,
      })
    }

    const dedupeKey = buildNotificationDedupeKey({
      triggerType,
      resourceType: "payment_session",
      resourceId: paymentSession.id,
      channel: "email",
      template,
      recipient: normalizedRecipient,
    })

    const { data: existingNotifications } = await query.graph({
      entity: "notification",
      fields: ["id", "to", "status", "created_at"],
      filters: {
        trigger_type: triggerType,
        resource_type: "payment_session",
        resource_id: paymentSession.id,
        channel: "email",
        template,
      },
    })

    const duplicateOf = selectDuplicateNotification(
      (existingNotifications || []) as ExistingNotificationRecord[],
      normalizedRecipient
    )

    if (duplicateOf) {
      const duplicateCreatedAt = toNotificationTimestamp(duplicateOf.created_at)

      logger.info(
        `[payment-failed-notification] duplicate suppressed reason=duplicate_notification payment_session_id=${paymentSession.id} payment_collection_id=${paymentSession.payment_collection_id} cart_id=${cart.id} order_id=${order?.id ?? "n/a"} payment_id=${paymentId ?? "n/a"} provider_id=${providerId ?? "n/a"} payment_status=${paymentStatus ?? "n/a"} payment_session_status=${paymentSessionStatus ?? "n/a"} recipient=${normalizedRecipient} recipient_normalized=${normalizedRecipient} dedupe_key=${dedupeKey} duplicate_of_notification_id=${duplicateOf.id} duplicate_of_notification_status=${duplicateOf.status} duplicate_of_notification_created_at=${duplicateCreatedAt ?? "n/a"} provider_requested=${notificationRuntime.requestedProviderId} provider_resolved=${notificationRuntime.providerId} status=skipped dedupe_strategy=${NOTIFICATION_DEDUPE_STRATEGY} dedupe_race_window=${NOTIFICATION_DEDUPE_RACE_WINDOW} source=${input.source ?? "n/a"}`
      )

      return skip("duplicate_notification", {
        payment_collection_id: paymentSession.payment_collection_id,
        cart_id: cart.id,
        order_id: order?.id ?? null,
        payment_id: paymentId,
        provider_id: providerId,
        payment_status: paymentStatus,
        payment_session_status: paymentSessionStatus,
        recipient: normalizedRecipient,
        recipient_normalized: normalizedRecipient,
        dedupe_key: dedupeKey,
        duplicate_of_notification_id: duplicateOf.id,
        duplicate_of_notification_status: duplicateOf.status,
        duplicate_of_notification_created_at: duplicateCreatedAt,
      })
    }

    const renderedEmail = renderPaymentFailedEmail({
      cartId: cart.id,
      orderId: order?.id ?? null,
      paymentProvider: providerId,
      storefrontUrl: process.env.STOREFRONT_URL || null,
    })

    const payload: CreateNotificationDTO = {
      to: normalizedRecipient,
      from: notificationRuntime.from,
      channel: "email",
      template,
      trigger_type: triggerType,
      resource_type: "payment_session",
      resource_id: paymentSession.id,
      content: {
        subject: renderedEmail.subject,
        html: renderedEmail.html,
        text: renderedEmail.text,
      },
      data: {
        payment_session: {
          id: paymentSession.id,
          provider_id: providerId,
          status: paymentSessionStatus,
        },
        payment_collection: {
          id: paymentSession.payment_collection_id,
        },
        cart: {
          id: cart.id,
          email: normalizedRecipient,
        },
        order: order?.id
          ? {
              id: order.id,
            }
          : null,
        payment_session_id: paymentSession.id,
        payment_collection_id: paymentSession.payment_collection_id,
        cart_id: cart.id,
        order_id: order?.id ?? null,
        payment_id: paymentId,
        provider_id: providerId,
        payment_status: paymentStatus,
        payment_session_status: paymentSessionStatus,
        recipient: normalizedRecipient,
        recipient_normalized: normalizedRecipient,
        trigger_type: triggerType,
        provider_requested: notificationRuntime.requestedProviderId,
        provider_resolved: notificationRuntime.providerId,
        dedupe_key: dedupeKey,
        dedupe_authority: NOTIFICATION_DEDUPE_AUTHORITY,
        dedupe_strategy: NOTIFICATION_DEDUPE_STRATEGY,
        dedupe_race_window: NOTIFICATION_DEDUPE_RACE_WINDOW,
        dedupe_canonical_fields: dedupeCanonicalFields,
        duplicate_of_notification_id: null,
        duplicate_of_notification_status: null,
        duplicate_of_notification_created_at: null,
        source: input.source ?? null,
      },
    }

    const notification =
      await notificationModuleService.createNotifications(payload)

    logger.info(
      `[payment-failed-notification] sent notification payment_session_id=${paymentSession.id} payment_collection_id=${paymentSession.payment_collection_id} cart_id=${cart.id} order_id=${order?.id ?? "n/a"} payment_id=${paymentId ?? "n/a"} provider_id=${providerId ?? "n/a"} payment_status=${paymentStatus ?? "n/a"} payment_session_status=${paymentSessionStatus ?? "n/a"} recipient=${normalizedRecipient} recipient_normalized=${normalizedRecipient} dedupe_key=${dedupeKey} duplicate_of_notification_id=n/a notification_id=${notification.id} provider_requested=${notificationRuntime.requestedProviderId} provider_resolved=${notificationRuntime.providerId} status=sent dedupe_strategy=${NOTIFICATION_DEDUPE_STRATEGY} dedupe_race_window=${NOTIFICATION_DEDUPE_RACE_WINDOW} source=${input.source ?? "n/a"}`
    )

    return new StepResponse<SendPaymentFailedNotificationResult>({
      status: "sent",
      reason: null,
      payment_session_id: paymentSession.id,
      payment_collection_id: paymentSession.payment_collection_id,
      cart_id: cart.id,
      order_id: order?.id ?? null,
      payment_id: paymentId,
      provider_id: providerId,
      payment_status: paymentStatus,
      payment_session_status: paymentSessionStatus,
      recipient: normalizedRecipient,
      recipient_normalized: normalizedRecipient,
      template,
      trigger_type: triggerType,
      provider_requested: notificationRuntime.requestedProviderId,
      provider_resolved: notificationRuntime.providerId,
      dedupe_key: dedupeKey,
      dedupe_authority: NOTIFICATION_DEDUPE_AUTHORITY,
      dedupe_strategy: NOTIFICATION_DEDUPE_STRATEGY,
      dedupe_race_window: NOTIFICATION_DEDUPE_RACE_WINDOW,
      dedupe_canonical_fields: dedupeCanonicalFields,
      duplicate_of_notification_id: null,
      duplicate_of_notification_status: null,
      duplicate_of_notification_created_at: null,
      source: input.source ?? null,
      notification,
    })
  }
)

const sendPaymentFailedNotificationWorkflow = createWorkflow(
  "send-payment-failed-notification-workflow",
  (input: SendPaymentFailedNotificationInput) => {
    const result = sendPaymentFailedNotificationStep(input)

    return new WorkflowResponse<SendPaymentFailedNotificationOutput>({
      result,
    })
  }
)

export default sendPaymentFailedNotificationWorkflow
