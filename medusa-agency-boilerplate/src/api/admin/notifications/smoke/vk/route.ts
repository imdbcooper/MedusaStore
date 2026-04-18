import type {
  AuthenticatedMedusaRequest,
  MedusaNextFunction,
  MedusaResponse,
} from "@medusajs/framework/http"
import { setSecretApiKeyContext } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import {
  DEFAULT_NOTIFICATION_VK_SMOKE_MESSAGE,
  DEFAULT_NOTIFICATION_VK_SMOKE_TRIGGER_TYPE,
  getNotificationVkRuntime,
  normalizeVkPeerId,
} from "../../../../../modules/notification-vk"
import sendVkNotificationSmokeWorkflow from "../../../../../workflows/send-vk-notification-smoke"

export const AdminVkNotificationSmokeSchema = z.object({
  peer_id: z.string().trim().regex(/^-?\d+$/),
  message: z.string().trim().min(1).max(2000).optional(),
})

type AdminVkNotificationSmokeRequestBody = z.infer<
  typeof AdminVkNotificationSmokeSchema
>

export async function POST(
  req: AuthenticatedMedusaRequest<AdminVkNotificationSmokeRequestBody>,
  res: MedusaResponse
) {
  await attachSecretApiKeyContext(req, res)

  const notificationRuntime = getNotificationVkRuntime()
  const peerId =
    normalizeVkPeerId(req.validatedBody.peer_id) || req.validatedBody.peer_id
  const message =
    req.validatedBody.message?.trim() || DEFAULT_NOTIFICATION_VK_SMOKE_MESSAGE

  const { result } = await sendVkNotificationSmokeWorkflow(req.scope).run({
    input: {
      to: peerId,
      message,
      triggerType: DEFAULT_NOTIFICATION_VK_SMOKE_TRIGGER_TYPE,
    },
  })

  const workflowResult = result.result
  const authenticatedWithSecretApiKey = req.auth_context.actor_type === "api-key"

  res.status(200).json({
    ok: true,
    request: {
      peer_id: peerId,
      message,
      trigger_type: DEFAULT_NOTIFICATION_VK_SMOKE_TRIGGER_TYPE,
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
      configured: notificationRuntime.communityConfigured,
      fallback_to_disabled:
        notificationRuntime.requestedProviderId !==
        notificationRuntime.providerId,
      group_id: notificationRuntime.groupId || null,
      api_version: notificationRuntime.apiVersion,
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
            workflowResult.notification.provider_id ||
            notificationRuntime.providerId,
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
