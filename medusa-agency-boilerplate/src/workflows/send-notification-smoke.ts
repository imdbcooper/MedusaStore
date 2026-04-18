import type { CreateNotificationDTO, NotificationDTO } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  DEFAULT_NOTIFICATION_SMOKE_TRIGGER_TYPE,
  getNotificationEmailRuntime,
} from "../modules/notification-email"

type NotificationSmokeInput = {
  to: string
  subject: string
  text: string
  html: string
  triggerType?: string
}

type NotificationSmokeOutput = {
  notification: NotificationDTO
}

const sendNotificationSmokeStep = createStep(
  "send-notification-smoke-step",
  async (input: NotificationSmokeInput, { container }) => {
    const notificationModuleService = container.resolve(Modules.NOTIFICATION)
    const notificationRuntime = getNotificationEmailRuntime()

    const payload: CreateNotificationDTO = {
      to: input.to,
      from: notificationRuntime.from,
      channel: "email",
      template: "notification-v1-smoke",
      trigger_type:
        input.triggerType?.trim() || DEFAULT_NOTIFICATION_SMOKE_TRIGGER_TYPE,
      resource_type: "notification_smoke",
      content: {
        subject: input.subject,
        text: input.text,
        html: input.html,
      },
      data: {
        subject: input.subject,
        trigger_type:
          input.triggerType?.trim() || DEFAULT_NOTIFICATION_SMOKE_TRIGGER_TYPE,
        provider_requested: notificationRuntime.requestedProviderId,
        provider_resolved: notificationRuntime.providerId,
      },
    }

    const notification = await notificationModuleService.createNotifications(payload)

    return new StepResponse(notification)
  }
)

const sendNotificationSmokeWorkflow = createWorkflow(
  "send-notification-smoke-workflow",
  (input: NotificationSmokeInput) => {
    const notification = sendNotificationSmokeStep(input)

    return new WorkflowResponse<NotificationSmokeOutput>({
      notification,
    })
  }
)

export default sendNotificationSmokeWorkflow
