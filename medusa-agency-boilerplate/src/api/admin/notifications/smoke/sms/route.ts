import type {
  AuthenticatedMedusaRequest,
  MedusaNextFunction,
  MedusaResponse,
} from "@medusajs/framework/http"
import { setSecretApiKeyContext } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import {
  DEFAULT_NOTIFICATION_SMS_SMOKE_MESSAGE,
  DEFAULT_NOTIFICATION_SMS_SMOKE_TRIGGER_TYPE,
  getNotificationSmsRuntime,
  normalizeSmsPhone,
} from "../../../../../modules/notification-sms"
import sendSmsNotificationSmokeWorkflow from "../../../../../workflows/send-sms-notification-smoke"

export const AdminSmsNotificationSmokeSchema = z.object({
  to: z.string().trim().min(1).max(32),
  message: z.string().trim().min(1).max(1000).optional(),
})

type AdminSmsNotificationSmokeRequestBody = z.infer<
  typeof AdminSmsNotificationSmokeSchema
>

export async function POST(
  req: AuthenticatedMedusaRequest<AdminSmsNotificationSmokeRequestBody>,
  res: MedusaResponse
) {
  await attachSecretApiKeyContext(req, res)

  const notificationRuntime = getNotificationSmsRuntime()
  const to = req.validatedBody.to.trim()
  const normalizedRecipient = normalizeSmsPhone(to)
  const message =
    req.validatedBody.message?.trim() || DEFAULT_NOTIFICATION_SMS_SMOKE_MESSAGE

  const { result } = await sendSmsNotificationSmokeWorkflow(req.scope).run({
    input: {
      to,
      message,
      triggerType: DEFAULT_NOTIFICATION_SMS_SMOKE_TRIGGER_TYPE,
    },
  })

  const workflowResult = result.result
  const authenticatedWithSecretApiKey = req.auth_context.actor_type === "api-key"

  res.status(200).json({
    ok: true,
    request: {
      to,
      recipient_normalized: normalizedRecipient,
      message,
      trigger_type: DEFAULT_NOTIFICATION_SMS_SMOKE_TRIGGER_TYPE,
    },
    auth: {
      actor_id: req.auth_context.actor_id,
      actor_type: req.auth_context.actor_type,
      secret_api_key: authenticatedWithSecretApiKey,
      secret_api_key_created_by: req.secret_key_context?.created_by || null,
    },
    provider: {
      requested: notificationRuntime.requestedProviderId,
      resolved: notificationRuntime.providerId,
      label: notificationRuntime.providerLabel,
      configured: notificationRuntime.exolveConfigured,
      fallback_to_disabled:
        notificationRuntime.requestedProviderId !== notificationRuntime.providerId,
      sender: notificationRuntime.sender || null,
      base_url: notificationRuntime.baseUrl,
    },
    result: {
      status: workflowResult.status,
      reason: workflowResult.reason,
      recipient: workflowResult.recipient,
      recipient_normalized: workflowResult.recipient_normalized,
      template: workflowResult.template,
      trigger_type: workflowResult.trigger_type,
    },
    notification: workflowResult.notification
      ? {
          id: workflowResult.notification.id,
          to: workflowResult.notification.to,
          channel: workflowResult.notification.channel,
          template: workflowResult.notification.template,
          provider_id:
            workflowResult.notification.provider_id || notificationRuntime.providerId,
          status: workflowResult.notification.status,
          trigger_type: workflowResult.notification.trigger_type,
          created_at: workflowResult.notification.created_at,
        }
      : null,
  })
}

async function attachSecretApiKeyContext(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  await new Promise<void>((resolve, reject) => {
    void setSecretApiKeyContext(
      req,
      res,
      ((error?: unknown) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      }) as MedusaNextFunction
    )
  })
}
