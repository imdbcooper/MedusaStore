import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import {
  buildVkIdAuthorizeUrl,
  createVkIdLinkSession,
  getVkIdCustomerById,
  getVkIdRuntime,
  resolveAllowedVkIdReturnUrl,
  resolveVkLinkState,
} from "../../../../../../modules/vk-id"

export const StoreVkIdStartLinkSchema = z.object({
  return_url: z.string().trim().url().optional(),
  link_source: z.string().trim().min(1).max(128).optional(),
})

type StoreVkIdStartLinkRequestBody = z.infer<typeof StoreVkIdStartLinkSchema>

export async function POST(
  req: AuthenticatedMedusaRequest<StoreVkIdStartLinkRequestBody>,
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
      },
    })
    return
  }

  const customerId = req.auth_context.actor_id?.trim()

  if (!customerId) {
    res.status(401).json({
      ok: false,
      code: "customer_auth_required",
    })
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const customer = await getVkIdCustomerById(query, customerId)

  if (!customer) {
    res.status(404).json({
      ok: false,
      code: "customer_not_found",
    })
    return
  }

  const returnUrl = resolveAllowedVkIdReturnUrl(
    req.validatedBody.return_url || null
  )
  const session = createVkIdLinkSession({
    customerId,
    returnUrl: returnUrl.toString(),
    linkSource: req.validatedBody.link_source || null,
  })
  const authorizeUrl = buildVkIdAuthorizeUrl({
    runtime,
    state: session.state,
    codeChallenge: session.codeChallenge,
  })
  const link = resolveVkLinkState(customer.metadata)

  res.status(200).json({
    ok: true,
    authorize_url: authorizeUrl.toString(),
    expires_at: session.expiresAt,
    customer_id: customerId,
    return_url: returnUrl.toString(),
    link: {
      is_linked: link.isLinked,
      provider: link.provider,
      vk_user_id: link.vkUserId,
      vk_peer_id: link.vkPeerId,
      linked_at: link.linkedAt,
      link_source: link.linkSource,
      link_status: link.linkStatus,
      last_verified_at: link.lastVerifiedAt,
      unlinked_at: link.unlinkedAt,
    },
  })
}
