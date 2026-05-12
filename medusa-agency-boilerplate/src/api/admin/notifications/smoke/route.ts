import type {
  AuthenticatedMedusaRequest,
  MedusaNextFunction,
  MedusaResponse,
} from "@medusajs/framework/http"
import { setSecretApiKeyContext } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import {
  DEFAULT_NOTIFICATION_SMOKE_MESSAGE,
  DEFAULT_NOTIFICATION_SMOKE_SUBJECT,
  DEFAULT_NOTIFICATION_SMOKE_TRIGGER_TYPE,
  getNotificationEmailRuntime,
} from "../../../../modules/notification-email"
import sendNotificationSmokeWorkflow from "../../../../workflows/send-notification-smoke"

export const AdminNotificationSmokeSchema = z.object({
  to: z.string().email(),
  subject: z.string().trim().min(1).max(120).optional(),
  message: z.string().trim().min(1).max(2000).optional(),
  dry_run: z.boolean().optional(),
})

type AdminNotificationSmokeRequestBody = z.infer<
  typeof AdminNotificationSmokeSchema
>

export async function POST(
  req: AuthenticatedMedusaRequest<AdminNotificationSmokeRequestBody>,
  res: MedusaResponse
) {
  await attachSecretApiKeyContext(req, res)

  const notificationRuntime = getNotificationEmailRuntime()
  const to = req.validatedBody.to.trim()
  const subject =
    req.validatedBody.subject?.trim() || DEFAULT_NOTIFICATION_SMOKE_SUBJECT
  const message =
    req.validatedBody.message?.trim() || DEFAULT_NOTIFICATION_SMOKE_MESSAGE
  const dryRun = req.validatedBody.dry_run === true
  const authenticatedWithSecretApiKey = req.auth_context.actor_type === "api-key"
  const baseResponse = {
    ok: true,
    request: {
      to,
      subject,
      message,
      trigger_type: DEFAULT_NOTIFICATION_SMOKE_TRIGGER_TYPE,
      dry_run: dryRun,
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
      fallback_to_local:
        notificationRuntime.requestedProviderId !== notificationRuntime.providerId,
      from: notificationRuntime.from,
    },
  }

  if (dryRun) {
    res.status(200).json({
      ...baseResponse,
      notification: null,
    })
    return
  }

  const { result } = await sendNotificationSmokeWorkflow(req.scope).run({
    input: {
      to,
      subject,
      text: message,
      html: `<p>${escapeHtml(message)}</p>`,
      triggerType: DEFAULT_NOTIFICATION_SMOKE_TRIGGER_TYPE,
    },
  })

  res.status(200).json({
    ...baseResponse,
    notification: {
      id: result.notification.id,
      to: result.notification.to,
      channel: result.notification.channel,
      template: result.notification.template,
      provider_id:
        result.notification.provider_id || notificationRuntime.providerId,
      status: result.notification.status,
      trigger_type: result.notification.trigger_type,
      created_at: result.notification.created_at,
    },
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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}
