import type { CreateNotificationDTO, NotificationDTO } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  DEFAULT_ORDER_PLACED_NOTIFICATION_TEMPLATE,
  DEFAULT_ORDER_PLACED_NOTIFICATION_TRIGGER_TYPE,
  getNotificationEmailRuntime,
} from "../modules/notification-email"

type SendOrderPlacedNotificationInput = {
  orderId: string
}

type OrderNotificationOrder = {
  id: string
  display_id: number | string | null
  email: string | null
}

type SendOrderPlacedNotificationResult = {
  status: "sent" | "skipped"
  reason: "missing_order_email" | "order_not_found" | null
  order_id: string
  display_id: number | string | null
  recipient: string | null
  template: string
  trigger_type: string
  provider_requested: "local" | "sendgrid"
  provider_resolved: "local" | "sendgrid"
  notification?: NotificationDTO
}

type SendOrderPlacedNotificationOutput = {
  result: SendOrderPlacedNotificationResult
}

const sendOrderPlacedNotificationStep = createStep(
  "send-order-placed-notification-step",
  async (input: SendOrderPlacedNotificationInput, { container }) => {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const notificationModuleService = container.resolve(Modules.NOTIFICATION)
    const notificationRuntime = getNotificationEmailRuntime()

    const { data: orders } = await query.graph({
      entity: "order",
      fields: ["id", "display_id", "email"],
      filters: {
        id: input.orderId,
      },
    })

    const order = orders[0] as OrderNotificationOrder | undefined
    const template = DEFAULT_ORDER_PLACED_NOTIFICATION_TEMPLATE
    const triggerType = DEFAULT_ORDER_PLACED_NOTIFICATION_TRIGGER_TYPE

    if (!order) {
      logger.warn(
        `[order-placed-notification] skip: order ${input.orderId} was not found`
      )

      return new StepResponse<SendOrderPlacedNotificationResult>({
        status: "skipped",
        reason: "order_not_found",
        order_id: input.orderId,
        display_id: null,
        recipient: null,
        template,
        trigger_type: triggerType,
        provider_requested: notificationRuntime.requestedProviderId,
        provider_resolved: notificationRuntime.providerId,
      })
    }

    const recipient = order.email?.trim() || ""

    if (!recipient) {
      logger.warn(
        `[order-placed-notification] skip: order ${order.id} has no email`
      )

      return new StepResponse<SendOrderPlacedNotificationResult>({
        status: "skipped",
        reason: "missing_order_email",
        order_id: order.id,
        display_id: order.display_id ?? null,
        recipient: null,
        template,
        trigger_type: triggerType,
        provider_requested: notificationRuntime.requestedProviderId,
        provider_resolved: notificationRuntime.providerId,
      })
    }

    const payload: CreateNotificationDTO = {
      to: recipient,
      from: notificationRuntime.from,
      channel: "email",
      template,
      trigger_type: triggerType,
      resource_type: "order",
      resource_id: order.id,
      content: {
        subject: `Order #${order.display_id ?? order.id} placed`,
      },
      data: {
        order: {
          id: order.id,
          display_id: order.display_id,
          email: recipient,
        },
        order_id: order.id,
        order_display_id: order.display_id,
        recipient,
        trigger_type: triggerType,
        provider_requested: notificationRuntime.requestedProviderId,
        provider_resolved: notificationRuntime.providerId,
      },
    }

    const notification = await notificationModuleService.createNotifications(payload)

    logger.info(
      `[order-placed-notification] sent notification for order ${order.id} to ${recipient}`
    )

    return new StepResponse<SendOrderPlacedNotificationResult>({
      status: "sent",
      reason: null,
      order_id: order.id,
      display_id: order.display_id ?? null,
      recipient,
      template,
      trigger_type: triggerType,
      provider_requested: notificationRuntime.requestedProviderId,
      provider_resolved: notificationRuntime.providerId,
      notification,
    })
  }
)

const sendOrderPlacedNotificationWorkflow = createWorkflow(
  "send-order-placed-notification-workflow",
  (input: SendOrderPlacedNotificationInput) => {
    const result = sendOrderPlacedNotificationStep(input)

    return new WorkflowResponse<SendOrderPlacedNotificationOutput>({
      result,
    })
  }
)

export default sendOrderPlacedNotificationWorkflow
