import type {
  CreateNotificationDTO,
  NotificationDTO,
} from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  NOTIFICATION_DEDUPE_AUTHORITY,
  NOTIFICATION_DEDUPE_CANONICAL_FIELDS,
  NOTIFICATION_DEDUPE_RACE_WINDOW,
  NOTIFICATION_DEDUPE_STRATEGY,
  buildNotificationDedupeKey,
} from "../modules/notification-email"
import {
  DEFAULT_NOTIFICATION_SMS_CHANNEL,
  DEFAULT_ORDER_CANCELED_SMS_NOTIFICATION_TEMPLATE,
  DEFAULT_ORDER_CANCELED_SMS_NOTIFICATION_TRIGGER_TYPE,
  getNotificationSmsRuntime,
} from "../modules/notification-sms"
import {
  ExistingSmsNotificationRecord,
  resolveOrderLikeSmsRecipient,
  selectDuplicateSmsNotification,
  toNotificationTimestamp,
} from "./notification-sms-shared"

type SendOrderCanceledSmsNotificationInput = {
  orderId: string
}

type OrderCanceledSmsNotificationRecord = {
  id: string
  display_id: number | string | null
  canceled_at: Date | string | null
  shipping_address?: {
    phone?: string | null
  } | null
  billing_address?: {
    phone?: string | null
  } | null
  customer?: {
    id?: string | null
    phone?: string | null
  } | null
}

type SendOrderCanceledSmsNotificationResult = {
  status: "sent" | "skipped"
  reason:
    | "provider_not_configured"
    | "order_not_found"
    | "order_not_canceled"
    | "missing_or_invalid_phone"
    | "duplicate_notification"
    | null
  order_id: string
  display_id: number | string | null
  canceled_at: string | null
  customer_id: string | null
  recipient: string | null
  recipient_normalized: string | null
  recipient_source:
    | "shipping_address.phone"
    | "billing_address.phone"
    | "customer.phone"
    | null
  template: string
  trigger_type: string
  provider_requested: ReturnType<typeof getNotificationSmsRuntime>["requestedProviderId"]
  provider_resolved: ReturnType<typeof getNotificationSmsRuntime>["providerId"]
  provider_label: ReturnType<typeof getNotificationSmsRuntime>["providerLabel"]
  dedupe_key: string | null
  dedupe_authority: typeof NOTIFICATION_DEDUPE_AUTHORITY
  dedupe_strategy: typeof NOTIFICATION_DEDUPE_STRATEGY
  dedupe_race_window: typeof NOTIFICATION_DEDUPE_RACE_WINDOW
  dedupe_canonical_fields: readonly string[]
  duplicate_of_notification_id: string | null
  duplicate_of_notification_status: NotificationDTO["status"] | null
  duplicate_of_notification_created_at: string | null
  notification?: NotificationDTO
}

type SendOrderCanceledSmsNotificationOutput = {
  result: SendOrderCanceledSmsNotificationResult
}

const sendOrderCanceledSmsNotificationStep = createStep(
  "send-order-canceled-sms-notification-step",
  async (input: SendOrderCanceledSmsNotificationInput, { container }) => {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const notificationModuleService = container.resolve(Modules.NOTIFICATION)
    const notificationRuntime = getNotificationSmsRuntime()
    const template = DEFAULT_ORDER_CANCELED_SMS_NOTIFICATION_TEMPLATE
    const triggerType = DEFAULT_ORDER_CANCELED_SMS_NOTIFICATION_TRIGGER_TYPE
    const dedupeCanonicalFields = [...NOTIFICATION_DEDUPE_CANONICAL_FIELDS]

    const skip = (
      reason: SendOrderCanceledSmsNotificationResult["reason"],
      details?: Partial<SendOrderCanceledSmsNotificationResult>
    ) => {
      return new StepResponse<SendOrderCanceledSmsNotificationResult>({
        status: "skipped",
        reason,
        order_id: details?.order_id ?? input.orderId,
        display_id: details?.display_id ?? null,
        canceled_at: details?.canceled_at ?? null,
        customer_id: details?.customer_id ?? null,
        recipient: details?.recipient ?? null,
        recipient_normalized: details?.recipient_normalized ?? null,
        recipient_source: details?.recipient_source ?? null,
        template,
        trigger_type: triggerType,
        provider_requested: notificationRuntime.requestedProviderId,
        provider_resolved: notificationRuntime.providerId,
        provider_label: notificationRuntime.providerLabel,
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
      })
    }

    if (notificationRuntime.providerId !== "exolve") {
      logger.info(
        `[order-canceled-sms-notification] skip reason=provider_not_configured order_id=${input.orderId} provider_requested=${notificationRuntime.requestedProviderId} provider_resolved=${notificationRuntime.providerId}`
      )

      return skip("provider_not_configured")
    }

    const { data: orders } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "canceled_at",
        "shipping_address.phone",
        "billing_address.phone",
        "customer.id",
        "customer.phone",
      ],
      filters: {
        id: input.orderId,
      },
    })

    const order = orders[0] as OrderCanceledSmsNotificationRecord | undefined

    if (!order) {
      logger.warn(
        `[order-canceled-sms-notification] skip reason=order_not_found order_id=${input.orderId} provider_requested=${notificationRuntime.requestedProviderId} provider_resolved=${notificationRuntime.providerId}`
      )

      return skip("order_not_found")
    }

    const canceledAt = toNotificationTimestamp(order.canceled_at)

    if (!canceledAt) {
      logger.info(
        `[order-canceled-sms-notification] skip reason=order_not_canceled order_id=${order.id} provider_requested=${notificationRuntime.requestedProviderId} provider_resolved=${notificationRuntime.providerId}`
      )

      return skip("order_not_canceled", {
        order_id: order.id,
        display_id: order.display_id ?? null,
      })
    }

    const resolvedRecipient = resolveOrderLikeSmsRecipient(order)

    if (!resolvedRecipient.recipientNormalized) {
      logger.info(
        `[order-canceled-sms-notification] skip reason=missing_or_invalid_phone order_id=${order.id} customer_id=${order.customer?.id ?? "n/a"} canceled_at=${canceledAt} recipient_source=${resolvedRecipient.recipientSource ?? "n/a"} provider_requested=${notificationRuntime.requestedProviderId} provider_resolved=${notificationRuntime.providerId}`
      )

      return skip("missing_or_invalid_phone", {
        order_id: order.id,
        display_id: order.display_id ?? null,
        canceled_at: canceledAt,
        customer_id: order.customer?.id ?? null,
        recipient: resolvedRecipient.recipient,
        recipient_source: resolvedRecipient.recipientSource,
      })
    }

    const dedupeKey = buildNotificationDedupeKey({
      triggerType,
      resourceType: "order",
      resourceId: order.id,
      channel: DEFAULT_NOTIFICATION_SMS_CHANNEL,
      template,
      recipient: resolvedRecipient.recipientNormalized,
    })

    const { data: existingNotifications } = await query.graph({
      entity: "notification",
      fields: ["id", "to", "status", "created_at"],
      filters: {
        trigger_type: triggerType,
        resource_type: "order",
        resource_id: order.id,
        channel: DEFAULT_NOTIFICATION_SMS_CHANNEL,
        template,
      },
    })

    const duplicateOf = selectDuplicateSmsNotification(
      (existingNotifications || []) as ExistingSmsNotificationRecord[],
      resolvedRecipient.recipientNormalized
    )

    if (duplicateOf) {
      const duplicateCreatedAt = toNotificationTimestamp(duplicateOf.created_at)

      logger.info(
        `[order-canceled-sms-notification] duplicate suppressed reason=duplicate_notification order_id=${order.id} display_id=${order.display_id ?? "n/a"} canceled_at=${canceledAt} customer_id=${order.customer?.id ?? "n/a"} recipient=${resolvedRecipient.recipientNormalized} recipient_source=${resolvedRecipient.recipientSource ?? "n/a"} dedupe_key=${dedupeKey} duplicate_of_notification_id=${duplicateOf.id} duplicate_of_notification_status=${duplicateOf.status} duplicate_of_notification_created_at=${duplicateCreatedAt ?? "n/a"} provider_requested=${notificationRuntime.requestedProviderId} provider_resolved=${notificationRuntime.providerId} status=skipped dedupe_strategy=${NOTIFICATION_DEDUPE_STRATEGY} dedupe_race_window=${NOTIFICATION_DEDUPE_RACE_WINDOW}`
      )

      return skip("duplicate_notification", {
        order_id: order.id,
        display_id: order.display_id ?? null,
        canceled_at: canceledAt,
        customer_id: order.customer?.id ?? null,
        recipient: resolvedRecipient.recipient,
        recipient_normalized: resolvedRecipient.recipientNormalized,
        recipient_source: resolvedRecipient.recipientSource,
        dedupe_key: dedupeKey,
        duplicate_of_notification_id: duplicateOf.id,
        duplicate_of_notification_status: duplicateOf.status,
        duplicate_of_notification_created_at: duplicateCreatedAt,
      })
    }

    const payload: CreateNotificationDTO = {
      to: resolvedRecipient.recipientNormalized,
      from: notificationRuntime.sender,
      channel: DEFAULT_NOTIFICATION_SMS_CHANNEL,
      template,
      trigger_type: triggerType,
      resource_type: "order",
      resource_id: order.id,
      content: {
        text: `Заказ №${order.display_id ?? order.id} отменен.`,
      },
      data: {
        order: {
          id: order.id,
          display_id: order.display_id,
          canceled_at: canceledAt,
        },
        customer: order.customer?.id
          ? {
              id: order.customer.id,
              phone: resolvedRecipient.recipientNormalized,
            }
          : null,
        order_id: order.id,
        order_display_id: order.display_id,
        canceled_at: canceledAt,
        customer_id: order.customer?.id ?? null,
        recipient: resolvedRecipient.recipient,
        recipient_normalized: resolvedRecipient.recipientNormalized,
        recipient_source: resolvedRecipient.recipientSource,
        trigger_type: triggerType,
        provider_requested: notificationRuntime.requestedProviderId,
        provider_resolved: notificationRuntime.providerId,
        provider_label: notificationRuntime.providerLabel,
        dedupe_key: dedupeKey,
        dedupe_authority: NOTIFICATION_DEDUPE_AUTHORITY,
        dedupe_strategy: NOTIFICATION_DEDUPE_STRATEGY,
        dedupe_race_window: NOTIFICATION_DEDUPE_RACE_WINDOW,
        dedupe_canonical_fields: dedupeCanonicalFields,
        duplicate_of_notification_id: null,
        duplicate_of_notification_status: null,
        duplicate_of_notification_created_at: null,
      },
    }

    const notification = await notificationModuleService.createNotifications(payload)

    logger.info(
      `[order-canceled-sms-notification] sent notification order_id=${order.id} display_id=${order.display_id ?? "n/a"} canceled_at=${canceledAt} customer_id=${order.customer?.id ?? "n/a"} recipient=${resolvedRecipient.recipientNormalized} recipient_source=${resolvedRecipient.recipientSource ?? "n/a"} notification_id=${notification.id} dedupe_key=${dedupeKey} provider_requested=${notificationRuntime.requestedProviderId} provider_resolved=${notificationRuntime.providerId} status=sent dedupe_strategy=${NOTIFICATION_DEDUPE_STRATEGY} dedupe_race_window=${NOTIFICATION_DEDUPE_RACE_WINDOW}`
    )

    return new StepResponse<SendOrderCanceledSmsNotificationResult>({
      status: "sent",
      reason: null,
      order_id: order.id,
      display_id: order.display_id ?? null,
      canceled_at: canceledAt,
      customer_id: order.customer?.id ?? null,
      recipient: resolvedRecipient.recipient,
      recipient_normalized: resolvedRecipient.recipientNormalized,
      recipient_source: resolvedRecipient.recipientSource,
      template,
      trigger_type: triggerType,
      provider_requested: notificationRuntime.requestedProviderId,
      provider_resolved: notificationRuntime.providerId,
      provider_label: notificationRuntime.providerLabel,
      dedupe_key: dedupeKey,
      dedupe_authority: NOTIFICATION_DEDUPE_AUTHORITY,
      dedupe_strategy: NOTIFICATION_DEDUPE_STRATEGY,
      dedupe_race_window: NOTIFICATION_DEDUPE_RACE_WINDOW,
      dedupe_canonical_fields: dedupeCanonicalFields,
      duplicate_of_notification_id: null,
      duplicate_of_notification_status: null,
      duplicate_of_notification_created_at: null,
      notification,
    })
  }
)

const sendOrderCanceledSmsNotificationWorkflow = createWorkflow(
  "send-order-canceled-sms-notification-workflow",
  (input: SendOrderCanceledSmsNotificationInput) => {
    const result = sendOrderCanceledSmsNotificationStep(input)

    return new WorkflowResponse<SendOrderCanceledSmsNotificationOutput>({
      result,
    })
  }
)

export default sendOrderCanceledSmsNotificationWorkflow
