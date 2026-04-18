import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  getVkIdCustomerById,
  planVkIdUnlinkMutation,
  persistVkIdCustomerMetadata,
  resolveVkLinkState,
} from "../../../../../../modules/vk-id"

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
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

  const mutation = planVkIdUnlinkMutation({
    currentMetadata: customer.metadata,
    unlinkedAt: new Date().toISOString(),
  })

  if (mutation.metadata) {
    await persistVkIdCustomerMetadata(req.scope as any, customer.id, mutation.metadata)
  }

  const link = resolveVkLinkState(mutation.metadata ?? customer.metadata)

  res.status(200).json({
    ok: true,
    status: mutation.status,
    reason: mutation.reason,
    customer_id: customer.id,
    link: {
      is_linked: link.isLinked,
      is_legacy_only: link.isLegacyOnly,
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
