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
  DEFAULT_ORDER_CANCELED_NOTIFICATION_TEMPLATE,
  DEFAULT_ORDER_CANCELED_NOTIFICATION_TRIGGER_TYPE,
  NOTIFICATION_DEDUPE_AUTHORITY,
  NOTIFICATION_DEDUPE_CANONICAL_FIELDS,
  NOTIFICATION_DEDUPE_RACE_WINDOW,
  NOTIFICATION_DEDUPE_STRATEGY,
  buildNotificationDedupeKey,
  getNotificationEmailRuntime,
  normalizeNotificationRecipient,
} from "../modules/notification-email"

type SendOrderCanceledNotificationInput = {
  orderId: string
}

type OrderCanceledNotificationOrder = {
  id: string
  display_id: number | string | null
  email: string | null
  canceled_at: Date | string | null
}

type ExistingNotificationRecord = {
  id: string
  to: string
  status: NotificationDTO["status"]
  created_at: Date | string
}

type SendOrderCanceledNotificationResult = {
  status: "sent" | "skipped"
  reason:
    | "order_not_found"
    | "order_not_canceled"
    | "missing_order_email"
    | "duplicate_notification"
    | null
  order_id: string
  display_id: number | string | null
  canceled_at: string | null
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
  notification?: NotificationDTO
}

type SendOrderCanceledNotificationOutput = {
  result: SendOrderCanceledNotificationResult
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

const sendOrderCanceledNotificationStep = createStep(
  "send-order-canceled-notification-step",
  async (input: SendOrderCanceledNotificationInput, { container }) => {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const notificationModuleService = container.resolve(Modules.NOTIFICATION)
    const notificationRuntime = getNotificationEmailRuntime()
    const template = DEFAULT_ORDER_CANCELED_NOTIFICATION_TEMPLATE
    const triggerType = DEFAULT_ORDER_CANCELED_NOTIFICATION_TRIGGER_TYPE
    const dedupeCanonicalFields = [...NOTIFICATION_DEDUPE_CANONICAL_FIELDS]

    const skip = (
      reason: SendOrderCanceledNotificationResult["reason"],
      details?: Partial<SendOrderCanceledNotificationResult>
    ) => {
      return new StepResponse<SendOrderCanceledNotificationResult>({
        status: "skipped",
        reason,
        order_id: details?.order_id ?? input.orderId,
        display_id: details?.display_id ?? null,
        canceled_at: details?.canceled_at ?? null,
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
      })
    }

    const { data: orders } = await query.graph({
      entity: "order",
      fields: ["id", "display_id", "email", "canceled_at"],
      filters: {
        id: input.orderId,
      },
    })

    const order = orders[0] as OrderCanceledNotificationOrder | undefined

    if (!order) {
      logger.warn(
        `[order-canceled-notification] skip reason=order_not_found order_id=${input.orderId} display_id=n/a canceled_at=n/a recipient=n/a recipient_normalized=n/a dedupe_key=n/a duplicate_of_notification_id=n/a provider_requested=${notificationRuntime.requestedProviderId} provider_resolved=${notificationRuntime.providerId} status=skipped dedupe_strategy=${NOTIFICATION_DEDUPE_STRATEGY} dedupe_race_window=${NOTIFICATION_DEDUPE_RACE_WINDOW}`
      )

      return skip("order_not_found")
    }

    const canceledAt = toNotificationTimestamp(order.canceled_at)

    if (!canceledAt) {
      logger.info(
        `[order-canceled-notification] skip reason=order_not_canceled order_id=${order.id} display_id=${order.display_id ?? "n/a"} canceled_at=n/a recipient=n/a recipient_normalized=n/a dedupe_key=n/a duplicate_of_notification_id=n/a provider_requested=${notificationRuntime.requestedProviderId} provider_resolved=${notificationRuntime.providerId} status=skipped dedupe_strategy=${NOTIFICATION_DEDUPE_STRATEGY} dedupe_race_window=${NOTIFICATION_DEDUPE_RACE_WINDOW}`
      )

      return skip("order_not_canceled", {
        order_id: order.id,
        display_id: order.display_id ?? null,
      })
    }

    const normalizedRecipient = normalizeNotificationRecipient(order.email)

    if (!normalizedRecipient) {
      logger.warn(
        `[order-canceled-notification] skip reason=missing_order_email order_id=${order.id} display_id=${order.display_id ?? "n/a"} canceled_at=${canceledAt} recipient=n/a recipient_normalized=n/a dedupe_key=n/a duplicate_of_notification_id=n/a provider_requested=${notificationRuntime.requestedProviderId} provider_resolved=${notificationRuntime.providerId} status=skipped dedupe_strategy=${NOTIFICATION_DEDUPE_STRATEGY} dedupe_race_window=${NOTIFICATION_DEDUPE_RACE_WINDOW}`
      )

      return skip("missing_order_email", {
        order_id: order.id,
        display_id: order.display_id ?? null,
        canceled_at: canceledAt,
      })
    }

    const dedupeKey = buildNotificationDedupeKey({
      triggerType,
      resourceType: "order",
      resourceId: order.id,
      channel: "email",
      template,
      recipient: normalizedRecipient,
    })

    const { data: existingNotifications } = await query.graph({
      entity: "notification",
      fields: ["id", "to", "status", "created_at"],
      filters: {
        trigger_type: triggerType,
        resource_type: "order",
        resource_id: order.id,
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
        `[order-canceled-notification] duplicate suppressed reason=duplicate_notification order_id=${order.id} display_id=${order.display_id ?? "n/a"} canceled_at=${canceledAt} recipient=${normalizedRecipient} recipient_normalized=${normalizedRecipient} dedupe_key=${dedupeKey} duplicate_of_notification_id=${duplicateOf.id} duplicate_of_notification_status=${duplicateOf.status} duplicate_of_notification_created_at=${duplicateCreatedAt ?? "n/a"} provider_requested=${notificationRuntime.requestedProviderId} provider_resolved=${notificationRuntime.providerId} status=skipped dedupe_strategy=${NOTIFICATION_DEDUPE_STRATEGY} dedupe_race_window=${NOTIFICATION_DEDUPE_RACE_WINDOW}`
      )

      return skip("duplicate_notification", {
        order_id: order.id,
        display_id: order.display_id ?? null,
        canceled_at: canceledAt,
        recipient: normalizedRecipient,
        recipient_normalized: normalizedRecipient,
        dedupe_key: dedupeKey,
        duplicate_of_notification_id: duplicateOf.id,
        duplicate_of_notification_status: duplicateOf.status,
        duplicate_of_notification_created_at: duplicateCreatedAt,
      })
    }

    const payload: CreateNotificationDTO = {
      to: normalizedRecipient,
      from: notificationRuntime.from,
      channel: "email",
      template,
      trigger_type: triggerType,
      resource_type: "order",
      resource_id: order.id,
      content: {
        subject: `Order #${order.display_id ?? order.id} canceled`,
      },
      data: {
        order: {
          id: order.id,
          display_id: order.display_id,
          email: normalizedRecipient,
          canceled_at: canceledAt,
        },
        order_id: order.id,
        order_display_id: order.display_id,
        canceled_at: canceledAt,
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
      },
    }

    const notification =
      await notificationModuleService.createNotifications(payload)

    logger.info(
      `[order-canceled-notification] sent notification order_id=${order.id} display_id=${order.display_id ?? "n/a"} canceled_at=${canceledAt} recipient=${normalizedRecipient} recipient_normalized=${normalizedRecipient} dedupe_key=${dedupeKey} duplicate_of_notification_id=n/a notification_id=${notification.id} provider_requested=${notificationRuntime.requestedProviderId} provider_resolved=${notificationRuntime.providerId} status=sent dedupe_strategy=${NOTIFICATION_DEDUPE_STRATEGY} dedupe_race_window=${NOTIFICATION_DEDUPE_RACE_WINDOW}`
    )

    return new StepResponse<SendOrderCanceledNotificationResult>({
      status: "sent",
      reason: null,
      order_id: order.id,
      display_id: order.display_id ?? null,
      canceled_at: canceledAt,
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
      notification,
    })
  }
)

const sendOrderCanceledNotificationWorkflow = createWorkflow(
  "send-order-canceled-notification-workflow",
  (input: SendOrderCanceledNotificationInput) => {
    const result = sendOrderCanceledNotificationStep(input)

    return new WorkflowResponse<SendOrderCanceledNotificationOutput>({
      result,
    })
  }
)

export default sendOrderCanceledNotificationWorkflow
