import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import {
  buildVkIdAuthorizeUrl,
  createVkIdLoginSession,
  getVkIdRuntime,
  resolveAllowedVkIdLoginReturnUrl,
} from "../../../../../modules/vk-id"

export const StoreAuthVkIdStartSchema = z.object({
  return_url: z.string().trim().url().optional(),
  login_source: z.string().trim().min(1).max(128).optional(),
})

type StoreAuthVkIdStartRequestBody = z.infer<typeof StoreAuthVkIdStartSchema>

/**
 * Public, customer-less endpoint that builds an authorize URL with the
 * `intent: "login"` state for the VK ID login flow.
 *
 * Phase 5.1 only powers login for customers that are already linked. When
 * `VK_ID_LOGIN_ENABLED=false`, the endpoint refuses to start the flow even if
 * the linking surface is enabled.
 */
export async function POST(
  req: MedusaRequest<StoreAuthVkIdStartRequestBody>,
  res: MedusaResponse
) {
  const runtime = getVkIdRuntime()

  if (!runtime.enabled) {
    res.status(409).json({
      ok: false,
      code: "vk_id_disabled",
      runtime: {
        requested_enabled: runtime.requestedEnabled,
        enabled: runtime.enabled,
        configured: runtime.configured,
        login_requested_enabled: runtime.loginRequestedEnabled,
        login_enabled: runtime.loginEnabled,
      },
    })
    return
  }

  if (!runtime.loginEnabled) {
    res.status(409).json({
      ok: false,
      code: "vk_id_login_disabled",
      runtime: {
        requested_enabled: runtime.requestedEnabled,
        enabled: runtime.enabled,
        configured: runtime.configured,
        login_requested_enabled: runtime.loginRequestedEnabled,
        login_enabled: runtime.loginEnabled,
      },
    })
    return
  }

  const body = (req.validatedBody || {}) as StoreAuthVkIdStartRequestBody
  let returnUrl: URL

  try {
    returnUrl = resolveAllowedVkIdLoginReturnUrl(body.return_url || null)
  } catch (error) {
    res.status(500).json({
      ok: false,
      code: "vk_id_return_origin_unconfigured",
      message:
        error instanceof Error ? error.message : "Return origin is not configured",
    })
    return
  }

  const session = createVkIdLoginSession({
    returnUrl: returnUrl.toString(),
    loginSource: body.login_source || null,
  })
  const authorizeUrl = buildVkIdAuthorizeUrl({
    runtime,
    state: session.state,
    codeChallenge: session.codeChallenge,
  })

  res.status(200).json({
    ok: true,
    intent: "login",
    authorize_url: authorizeUrl.toString(),
    expires_at: session.expiresAt,
    return_url: returnUrl.toString(),
  })
}
