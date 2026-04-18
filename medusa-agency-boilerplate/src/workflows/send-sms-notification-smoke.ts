import type {
  CreateNotificationDTO,
  NotificationDTO,
} from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  DEFAULT_NOTIFICATION_SMS_CHANNEL,
  DEFAULT_NOTIFICATION_SMS_SMOKE_TEMPLATE,
  DEFAULT_NOTIFICATION_SMS_SMOKE_TRIGGER_TYPE,
  getNotificationSmsRuntime,
  normalizeSmsPhone,
} from "../modules/notification-sms"

type SendSmsNotificationSmokeInput = {
  to: string
  message: string
  triggerType?: string
}

type SendSmsNotificationSmokeResult = {
  status: "sent" | "skipped"
  reason: "provider_not_configured" | "missing_or_invalid_phone" | null
  recipient: string | null
  recipient_normalized: string | null
  template: string
  trigger_type: string
  provider_requested: ReturnType<typeof getNotificationSmsRuntime>["requestedProviderId"]
  provider_resolved: ReturnType<typeof getNotificationSmsRuntime>["providerId"]
  provider_label: ReturnType<typeof getNotificationSmsRuntime>["providerLabel"]
  notification?: NotificationDTO
}

type SendSmsNotificationSmokeOutput = {
  result: SendSmsNotificationSmokeResult
}

const sendSmsNotificationSmokeStep = createStep(
  "send-sms-notification-smoke-step",
  async (input: SendSmsNotificationSmokeInput, { container }) => {
    const notificationModuleService = container.resolve(Modules.NOTIFICATION)
    const notificationRuntime = getNotificationSmsRuntime()
    const normalizedRecipient = normalizeSmsPhone(input.to)
    const triggerType =
      input.triggerType?.trim() || DEFAULT_NOTIFICATION_SMS_SMOKE_TRIGGER_TYPE

    if (notificationRuntime.providerId !== "exolve") {
      return new StepResponse<SendSmsNotificationSmokeResult>({
        status: "skipped",
        reason: "provider_not_configured",
        recipient: normalizedRecipient,
        recipient_normalized: normalizedRecipient,
        template: DEFAULT_NOTIFICATION_SMS_SMOKE_TEMPLATE,
        trigger_type: triggerType,
        provider_requested: notificationRuntime.requestedProviderId,
        provider_resolved: notificationRuntime.providerId,
        provider_label: notificationRuntime.providerLabel,
      })
    }

    if (!normalizedRecipient) {
      return new StepResponse<SendSmsNotificationSmokeResult>({
        status: "skipped",
        reason: "missing_or_invalid_phone",
        recipient: null,
        recipient_normalized: null,
        template: DEFAULT_NOTIFICATION_SMS_SMOKE_TEMPLATE,
        trigger_type: triggerType,
        provider_requested: notificationRuntime.requestedProviderId,
        provider_resolved: notificationRuntime.providerId,
        provider_label: notificationRuntime.providerLabel,
      })
    }

    const payload: CreateNotificationDTO = {
      to: normalizedRecipient,
      from: notificationRuntime.sender,
      channel: DEFAULT_NOTIFICATION_SMS_CHANNEL,
      template: DEFAULT_NOTIFICATION_SMS_SMOKE_TEMPLATE,
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
        provider_label: notificationRuntime.providerLabel,
      },
    }

    const notification = await notificationModuleService.createNotifications(payload)

    return new StepResponse<SendSmsNotificationSmokeResult>({
      status: "sent",
      reason: null,
      recipient: normalizedRecipient,
      recipient_normalized: normalizedRecipient,
      template: DEFAULT_NOTIFICATION_SMS_SMOKE_TEMPLATE,
      trigger_type: triggerType,
      provider_requested: notificationRuntime.requestedProviderId,
      provider_resolved: notificationRuntime.providerId,
      provider_label: notificationRuntime.providerLabel,
      notification,
    })
  }
)

const sendSmsNotificationSmokeWorkflow = createWorkflow(
  "send-sms-notification-smoke-workflow",
  (input: SendSmsNotificationSmokeInput) => {
    const result = sendSmsNotificationSmokeStep(input)

    return new WorkflowResponse<SendSmsNotificationSmokeOutput>({
      result,
    })
  }
)

export default sendSmsNotificationSmokeWorkflow
