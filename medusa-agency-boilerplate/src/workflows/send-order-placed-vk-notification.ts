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
  DEFAULT_ORDER_PLACED_VK_NOTIFICATION_TEMPLATE,
  DEFAULT_ORDER_PLACED_VK_NOTIFICATION_TRIGGER_TYPE,
  getNotificationVkRuntime,
  normalizeVkPeerId,
  resolveCustomerVkPeerId,
} from "../modules/notification-vk"

type SendOrderPlacedVkNotificationInput = {
  orderId: string
}

type OrderNotificationOrder = {
  id: string
  display_id: number | string | null
  customer?: {
    id: string | null
    metadata?: Record<string, unknown> | null
  } | null
}

type ExistingNotificationRecord = {
  id: string
  to: string
  status: NotificationDTO["status"]
  created_at: Date | string
}

type SendOrderPlacedVkNotificationResult = {
  status: "sent" | "skipped"
  reason:
    | "provider_not_configured"
    | "order_not_found"
    | "missing_customer_vk_peer_id"
    | "duplicate_notification"
    | null
  order_id: string
  display_id: number | string | null
  customer_id: string | null
  recipient: string | null
  recipient_normalized: string | null
  template: string
  trigger_type: string
  provider_requested: ReturnType<typeof getNotificationVkRuntime>["requestedProviderId"]
  provider_resolved: ReturnType<typeof getNotificationVkRuntime>["providerId"]
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

type SendOrderPlacedVkNotificationOutput = {
  result: SendOrderPlacedVkNotificationResult
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
      return normalizeVkPeerId(notification.to) === normalizedRecipient
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

const sendOrderPlacedVkNotificationStep = createStep(
  "send-order-placed-vk-notification-step",
  async (input: SendOrderPlacedVkNotificationInput, { container }) => {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const notificationModuleService = container.resolve(Modules.NOTIFICATION)
    const notificationRuntime = getNotificationVkRuntime()
    const template = DEFAULT_ORDER_PLACED_VK_NOTIFICATION_TEMPLATE
    const triggerType = DEFAULT_ORDER_PLACED_VK_NOTIFICATION_TRIGGER_TYPE
    const dedupeCanonicalFields = [...NOTIFICATION_DEDUPE_CANONICAL_FIELDS]

    const skip = (
      reason: SendOrderPlacedVkNotificationResult["reason"],
      details?: Partial<SendOrderPlacedVkNotificationResult>
    ) => {
      return new StepResponse<SendOrderPlacedVkNotificationResult>({
        status: "skipped",
        reason,
        order_id: details?.order_id ?? input.orderId,
        display_id: details?.display_id ?? null,
        customer_id: details?.customer_id ?? null,
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

    if (notificationRuntime.providerId !== "community") {
      logger.info(
        `[order-placed-vk-notification] skip reason=provider_not_configured order_id=${input.orderId} provider_requested=${notificationRuntime.requestedProviderId} provider_resolved=${notificationRuntime.providerId}`
      )

      return skip("provider_not_configured")
    }

    const { data: orders } = await query.graph({
      entity: "order",
      fields: ["id", "display_id", "customer.id", "customer.metadata"],
      filters: {
        id: input.orderId,
      },
    })

    const order = orders[0] as OrderNotificationOrder | undefined

    if (!order) {
      logger.warn(
        `[order-placed-vk-notification] skip reason=order_not_found order_id=${input.orderId} provider_requested=${notificationRuntime.requestedProviderId} provider_resolved=${notificationRuntime.providerId}`
      )

      return skip("order_not_found")
    }

    const customerId = order.customer?.id || null
    const normalizedRecipient = resolveCustomerVkPeerId(order.customer?.metadata)

    if (!normalizedRecipient) {
      logger.info(
        `[order-placed-vk-notification] skip reason=missing_customer_vk_peer_id order_id=${order.id} customer_id=${customerId ?? "n/a"} provider_requested=${notificationRuntime.requestedProviderId} provider_resolved=${notificationRuntime.providerId}`
      )

      return skip("missing_customer_vk_peer_id", {
        order_id: order.id,
        display_id: order.display_id ?? null,
        customer_id: customerId,
      })
    }

    const dedupeKey = buildNotificationDedupeKey({
      triggerType,
      resourceType: "order",
      resourceId: order.id,
      channel: "vk",
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
        channel: "vk",
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
        `[order-placed-vk-notification] duplicate suppressed reason=duplicate_notification order_id=${order.id} customer_id=${customerId ?? "n/a"} recipient=${normalizedRecipient} dedupe_key=${dedupeKey} duplicate_of_notification_id=${duplicateOf.id} duplicate_of_notification_status=${duplicateOf.status} duplicate_of_notification_created_at=${duplicateCreatedAt ?? "n/a"} provider_requested=${notificationRuntime.requestedProviderId} provider_resolved=${notificationRuntime.providerId} dedupe_race_window=${NOTIFICATION_DEDUPE_RACE_WINDOW}`
      )

      return skip("duplicate_notification", {
        order_id: order.id,
        display_id: order.display_id ?? null,
        customer_id: customerId,
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
      channel: "vk",
      template,
      trigger_type: triggerType,
      resource_type: "order",
      resource_id: order.id,
      content: {
        text: `Заказ №${order.display_id ?? order.id} успешно оформлен.`,
      },
      data: {
        order: {
          id: order.id,
          display_id: order.display_id,
        },
        customer: {
          id: customerId,
        },
        order_id: order.id,
        order_display_id: order.display_id,
        customer_id: customerId,
        recipient: normalizedRecipient,
        recipient_normalized: normalizedRecipient,
        message: `Заказ №${order.display_id ?? order.id} успешно оформлен.`,
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
      `[order-placed-vk-notification] sent notification order_id=${order.id} customer_id=${customerId ?? "n/a"} recipient=${normalizedRecipient} notification_id=${notification.id} dedupe_key=${dedupeKey} provider_requested=${notificationRuntime.requestedProviderId} provider_resolved=${notificationRuntime.providerId} dedupe_race_window=${NOTIFICATION_DEDUPE_RACE_WINDOW}`
    )

    return new StepResponse<SendOrderPlacedVkNotificationResult>({
      status: "sent",
      reason: null,
      order_id: order.id,
      display_id: order.display_id ?? null,
      customer_id: customerId,
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

const sendOrderPlacedVkNotificationWorkflow = createWorkflow(
  "send-order-placed-vk-notification-workflow",
  (input: SendOrderPlacedVkNotificationInput) => {
    const result = sendOrderPlacedVkNotificationStep(input)

    return new WorkflowResponse<SendOrderPlacedVkNotificationOutput>({
      result,
    })
  }
)

export default sendOrderPlacedVkNotificationWorkflow
