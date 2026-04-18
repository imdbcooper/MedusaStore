import type { CreateNotificationDTO, NotificationDTO } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  DEFAULT_NOTIFICATION_VK_SMOKE_TEMPLATE,
  DEFAULT_NOTIFICATION_VK_SMOKE_TRIGGER_TYPE,
  getNotificationVkRuntime,
  normalizeVkPeerId,
} from "../modules/notification-vk"

type SendVkNotificationSmokeInput = {
  to: string
  message: string
  triggerType?: string
}

type SendVkNotificationSmokeResult = {
  status: "sent" | "skipped"
  reason: "provider_not_configured" | null
  recipient: string | null
  recipient_normalized: string | null
  template: string
  trigger_type: string
  provider_requested: ReturnType<typeof getNotificationVkRuntime>["requestedProviderId"]
  provider_resolved: ReturnType<typeof getNotificationVkRuntime>["providerId"]
  notification?: NotificationDTO
}

type SendVkNotificationSmokeOutput = {
  result: SendVkNotificationSmokeResult
}

const sendVkNotificationSmokeStep = createStep(
  "send-vk-notification-smoke-step",
  async (input: SendVkNotificationSmokeInput, { container }) => {
    const notificationModuleService = container.resolve(Modules.NOTIFICATION)
    const notificationRuntime = getNotificationVkRuntime()
    const normalizedRecipient = normalizeVkPeerId(input.to)
    const triggerType =
      input.triggerType?.trim() || DEFAULT_NOTIFICATION_VK_SMOKE_TRIGGER_TYPE

    if (notificationRuntime.providerId !== "community") {
      return new StepResponse<SendVkNotificationSmokeResult>({
        status: "skipped",
        reason: "provider_not_configured",
        recipient: normalizedRecipient,
        recipient_normalized: normalizedRecipient,
        template: DEFAULT_NOTIFICATION_VK_SMOKE_TEMPLATE,
        trigger_type: triggerType,
        provider_requested: notificationRuntime.requestedProviderId,
        provider_resolved: notificationRuntime.providerId,
      })
    }

    const payload: CreateNotificationDTO = {
      to: normalizedRecipient || input.to.trim(),
      channel: "vk",
      template: DEFAULT_NOTIFICATION_VK_SMOKE_TEMPLATE,
      trigger_type: triggerType,
      resource_type: "notification_smoke",
      content: {
        text: input.message,
      },
      data: {
        message: input.message,
        recipient: normalizedRecipient,
        recipient_normalized: normalizedRecipient,
        trigger_type: triggerType,
        provider_requested: notificationRuntime.requestedProviderId,
        provider_resolved: notificationRuntime.providerId,
      },
    }

    const notification = await notificationModuleService.createNotifications(payload)

    return new StepResponse<SendVkNotificationSmokeResult>({
      status: "sent",
      reason: null,
      recipient: normalizedRecipient,
      recipient_normalized: normalizedRecipient,
      template: DEFAULT_NOTIFICATION_VK_SMOKE_TEMPLATE,
      trigger_type: triggerType,
      provider_requested: notificationRuntime.requestedProviderId,
      provider_resolved: notificationRuntime.providerId,
      notification,
    })
  }
)

const sendVkNotificationSmokeWorkflow = createWorkflow(
  "send-vk-notification-smoke-workflow",
  (input: SendVkNotificationSmokeInput) => {
    const result = sendVkNotificationSmokeStep(input)

    return new WorkflowResponse<SendVkNotificationSmokeOutput>({
      result,
    })
  }
)

export default sendVkNotificationSmokeWorkflow
