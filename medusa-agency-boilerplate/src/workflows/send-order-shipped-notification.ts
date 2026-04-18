import type { CreateNotificationDTO, NotificationDTO } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  DEFAULT_ORDER_SHIPPED_NOTIFICATION_TEMPLATE,
  DEFAULT_ORDER_SHIPPED_NOTIFICATION_TRIGGER_TYPE,
  NOTIFICATION_DEDUPE_AUTHORITY,
  NOTIFICATION_DEDUPE_CANONICAL_FIELDS,
  NOTIFICATION_DEDUPE_RACE_WINDOW,
  NOTIFICATION_DEDUPE_STRATEGY,
  buildNotificationDedupeKey,
  getNotificationEmailRuntime,
  normalizeNotificationRecipient,
} from "../modules/notification-email"

type SendOrderShippedNotificationInput = {
  fulfillmentId: string
  noNotification?: boolean
}

type FulfillmentNotificationOrder = {
  id: string
  display_id: number | string | null
  email: string | null
}

type FulfillmentNotificationRecord = {
  id: string
  order?: FulfillmentNotificationOrder | null
}

type ExistingNotificationRecord = {
  id: string
  to: string
  status: NotificationDTO["status"]
  created_at: Date | string
}

type SendOrderShippedNotificationResult = {
  status: "sent" | "skipped"
  reason:
    | "no_notification_requested"
    | "fulfillment_not_found"
    | "order_not_found"
    | "missing_order_email"
    | "duplicate_notification"
    | null
  order_id: string | null
  display_id: number | string | null
  fulfillment_id: string
  recipient: string | null
  recipient_normalized: string | null
  template: string
  trigger_type: string
  provider_requested: "local" | "sendgrid"
  provider_resolved: "local" | "sendgrid"
  dedupe_key: string | null
  dedupe_authority: typeof NOTIFICATION_DEDUPE_AUTHORITY
  dedupe_strategy: typeof NOTIFICATION_DEDUPE_STRATEGY
  dedupe_race_window: typeof NOTIFICATION_DEDUPE_RACE_WINDOW
  dedupe_canonical_fields: readonly string[]
  duplicate_of_notification_id: string | null
  duplicate_of_notification_status: NotificationDTO["status"] | null
  duplicate_of_notification_created_at: string | null
  no_notification: boolean
  notification?: NotificationDTO
}

type SendOrderShippedNotificationOutput = {
  result: SendOrderShippedNotificationResult
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

const sendOrderShippedNotificationStep = createStep(
  "send-order-shipped-notification-step",
  async (input: SendOrderShippedNotificationInput, { container }) => {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const notificationModuleService = container.resolve(Modules.NOTIFICATION)
    const notificationRuntime = getNotificationEmailRuntime()
    const template = DEFAULT_ORDER_SHIPPED_NOTIFICATION_TEMPLATE
    const triggerType = DEFAULT_ORDER_SHIPPED_NOTIFICATION_TRIGGER_TYPE
    const dedupeCanonicalFields = [...NOTIFICATION_DEDUPE_CANONICAL_FIELDS]

    if (input.noNotification) {
      logger.info(
        `[order-shipped-notification] skip reason=no_notification_requested fulfillment_id=${input.fulfillmentId} order_id=n/a display_id=n/a recipient=n/a recipient_normalized=n/a dedupe_key=n/a duplicate_of_notification_id=n/a provider_requested=${notificationRuntime.requestedProviderId} provider_resolved=${notificationRuntime.providerId} status=skipped no_notification=true dedupe_strategy=${NOTIFICATION_DEDUPE_STRATEGY} dedupe_race_window=${NOTIFICATION_DEDUPE_RACE_WINDOW}`
      )

      return new StepResponse<SendOrderShippedNotificationResult>({
        status: "skipped",
        reason: "no_notification_requested",
        order_id: null,
        display_id: null,
        fulfillment_id: input.fulfillmentId,
        recipient: null,
        recipient_normalized: null,
        template,
        trigger_type: triggerType,
        provider_requested: notificationRuntime.requestedProviderId,
        provider_resolved: notificationRuntime.providerId,
        dedupe_key: null,
        dedupe_authority: NOTIFICATION_DEDUPE_AUTHORITY,
        dedupe_strategy: NOTIFICATION_DEDUPE_STRATEGY,
        dedupe_race_window: NOTIFICATION_DEDUPE_RACE_WINDOW,
        dedupe_canonical_fields: dedupeCanonicalFields,
        duplicate_of_notification_id: null,
        duplicate_of_notification_status: null,
        duplicate_of_notification_created_at: null,
        no_notification: true,
      })
    }

    const { data: fulfillments } = await query.graph({
      entity: "fulfillment",
      fields: ["id", "order.id", "order.display_id", "order.email"],
      filters: {
        id: input.fulfillmentId,
      },
    })

    const fulfillment = fulfillments[0] as FulfillmentNotificationRecord | undefined

    if (!fulfillment) {
      logger.warn(
        `[order-shipped-notification] skip reason=fulfillment_not_found fulfillment_id=${input.fulfillmentId} order_id=n/a display_id=n/a recipient=n/a recipient_normalized=n/a dedupe_key=n/a duplicate_of_notification_id=n/a provider_requested=${notificationRuntime.requestedProviderId} provider_resolved=${notificationRuntime.providerId} status=skipped no_notification=false dedupe_strategy=${NOTIFICATION_DEDUPE_STRATEGY} dedupe_race_window=${NOTIFICATION_DEDUPE_RACE_WINDOW}`
      )

      return new StepResponse<SendOrderShippedNotificationResult>({
        status: "skipped",
        reason: "fulfillment_not_found",
        order_id: null,
        display_id: null,
        fulfillment_id: input.fulfillmentId,
        recipient: null,
        recipient_normalized: null,
        template,
        trigger_type: triggerType,
        provider_requested: notificationRuntime.requestedProviderId,
        provider_resolved: notificationRuntime.providerId,
        dedupe_key: null,
        dedupe_authority: NOTIFICATION_DEDUPE_AUTHORITY,
        dedupe_strategy: NOTIFICATION_DEDUPE_STRATEGY,
        dedupe_race_window: NOTIFICATION_DEDUPE_RACE_WINDOW,
        dedupe_canonical_fields: dedupeCanonicalFields,
        duplicate_of_notification_id: null,
        duplicate_of_notification_status: null,
        duplicate_of_notification_created_at: null,
        no_notification: false,
      })
    }

    const order = fulfillment.order

    if (!order?.id) {
      logger.warn(
        `[order-shipped-notification] skip reason=order_not_found fulfillment_id=${fulfillment.id} order_id=n/a display_id=n/a recipient=n/a recipient_normalized=n/a dedupe_key=n/a duplicate_of_notification_id=n/a provider_requested=${notificationRuntime.requestedProviderId} provider_resolved=${notificationRuntime.providerId} status=skipped no_notification=false dedupe_strategy=${NOTIFICATION_DEDUPE_STRATEGY} dedupe_race_window=${NOTIFICATION_DEDUPE_RACE_WINDOW}`
      )

      return new StepResponse<SendOrderShippedNotificationResult>({
        status: "skipped",
        reason: "order_not_found",
        order_id: null,
        display_id: null,
        fulfillment_id: fulfillment.id,
        recipient: null,
        recipient_normalized: null,
        template,
        trigger_type: triggerType,
        provider_requested: notificationRuntime.requestedProviderId,
        provider_resolved: notificationRuntime.providerId,
        dedupe_key: null,
        dedupe_authority: NOTIFICATION_DEDUPE_AUTHORITY,
        dedupe_strategy: NOTIFICATION_DEDUPE_STRATEGY,
        dedupe_race_window: NOTIFICATION_DEDUPE_RACE_WINDOW,
        dedupe_canonical_fields: dedupeCanonicalFields,
        duplicate_of_notification_id: null,
        duplicate_of_notification_status: null,
        duplicate_of_notification_created_at: null,
        no_notification: false,
      })
    }

    const normalizedRecipient = normalizeNotificationRecipient(order.email)

    if (!normalizedRecipient) {
      logger.warn(
        `[order-shipped-notification] skip reason=missing_order_email fulfillment_id=${fulfillment.id} order_id=${order.id} display_id=${order.display_id ?? "n/a"} recipient=n/a recipient_normalized=n/a dedupe_key=n/a duplicate_of_notification_id=n/a provider_requested=${notificationRuntime.requestedProviderId} provider_resolved=${notificationRuntime.providerId} status=skipped no_notification=false dedupe_strategy=${NOTIFICATION_DEDUPE_STRATEGY} dedupe_race_window=${NOTIFICATION_DEDUPE_RACE_WINDOW}`
      )

      return new StepResponse<SendOrderShippedNotificationResult>({
        status: "skipped",
        reason: "missing_order_email",
        order_id: order.id,
        display_id: order.display_id ?? null,
        fulfillment_id: fulfillment.id,
        recipient: null,
        recipient_normalized: null,
        template,
        trigger_type: triggerType,
        provider_requested: notificationRuntime.requestedProviderId,
        provider_resolved: notificationRuntime.providerId,
        dedupe_key: null,
        dedupe_authority: NOTIFICATION_DEDUPE_AUTHORITY,
        dedupe_strategy: NOTIFICATION_DEDUPE_STRATEGY,
        dedupe_race_window: NOTIFICATION_DEDUPE_RACE_WINDOW,
        dedupe_canonical_fields: dedupeCanonicalFields,
        duplicate_of_notification_id: null,
        duplicate_of_notification_status: null,
        duplicate_of_notification_created_at: null,
        no_notification: false,
      })
    }

    const dedupeKey = buildNotificationDedupeKey({
      triggerType,
      resourceType: "fulfillment",
      resourceId: fulfillment.id,
      channel: "email",
      template,
      recipient: normalizedRecipient,
    })

    const { data: existingNotifications } = await query.graph({
      entity: "notification",
      fields: ["id", "to", "status", "created_at"],
      filters: {
        trigger_type: triggerType,
        resource_type: "fulfillment",
        resource_id: fulfillment.id,
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
        `[order-shipped-notification] duplicate suppressed reason=duplicate_notification fulfillment_id=${fulfillment.id} order_id=${order.id} display_id=${order.display_id ?? "n/a"} recipient=${normalizedRecipient} recipient_normalized=${normalizedRecipient} dedupe_key=${dedupeKey} duplicate_of_notification_id=${duplicateOf.id} duplicate_of_notification_status=${duplicateOf.status} duplicate_of_notification_created_at=${duplicateCreatedAt ?? "n/a"} provider_requested=${notificationRuntime.requestedProviderId} provider_resolved=${notificationRuntime.providerId} status=skipped no_notification=false dedupe_strategy=${NOTIFICATION_DEDUPE_STRATEGY} dedupe_race_window=${NOTIFICATION_DEDUPE_RACE_WINDOW}`
      )

      return new StepResponse<SendOrderShippedNotificationResult>({
        status: "skipped",
        reason: "duplicate_notification",
        order_id: order.id,
        display_id: order.display_id ?? null,
        fulfillment_id: fulfillment.id,
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
        duplicate_of_notification_id: duplicateOf.id,
        duplicate_of_notification_status: duplicateOf.status,
        duplicate_of_notification_created_at: duplicateCreatedAt,
        no_notification: false,
      })
    }

    const payload: CreateNotificationDTO = {
      to: normalizedRecipient,
      from: notificationRuntime.from,
      channel: "email",
      template,
      trigger_type: triggerType,
      resource_type: "fulfillment",
      resource_id: fulfillment.id,
      content: {
        subject: `Order #${order.display_id ?? order.id} shipped`,
      },
      data: {
        fulfillment: {
          id: fulfillment.id,
        },
        order: {
          id: order.id,
          display_id: order.display_id,
          email: normalizedRecipient,
        },
        fulfillment_id: fulfillment.id,
        order_id: order.id,
        order_display_id: order.display_id,
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
        no_notification: false,
      },
    }

    const notification = await notificationModuleService.createNotifications(payload)

    logger.info(
      `[order-shipped-notification] sent notification fulfillment_id=${fulfillment.id} order_id=${order.id} display_id=${order.display_id ?? "n/a"} recipient=${normalizedRecipient} recipient_normalized=${normalizedRecipient} dedupe_key=${dedupeKey} duplicate_of_notification_id=n/a notification_id=${notification.id} provider_requested=${notificationRuntime.requestedProviderId} provider_resolved=${notificationRuntime.providerId} status=sent no_notification=false dedupe_strategy=${NOTIFICATION_DEDUPE_STRATEGY} dedupe_race_window=${NOTIFICATION_DEDUPE_RACE_WINDOW}`
    )

    return new StepResponse<SendOrderShippedNotificationResult>({
      status: "sent",
      reason: null,
      order_id: order.id,
      display_id: order.display_id ?? null,
      fulfillment_id: fulfillment.id,
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
      no_notification: false,
      notification,
    })
  }
)

const sendOrderShippedNotificationWorkflow = createWorkflow(
  "send-order-shipped-notification-workflow",
  (input: SendOrderShippedNotificationInput) => {
    const result = sendOrderShippedNotificationStep(input)

    return new WorkflowResponse<SendOrderShippedNotificationOutput>({
      result,
    })
  }
)

export default sendOrderShippedNotificationWorkflow
