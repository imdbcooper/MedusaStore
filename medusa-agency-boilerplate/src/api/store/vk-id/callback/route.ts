import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import {
  buildVkIdResultReturnUrl,
  exchangeVkIdAuthorizationCode,
  fetchVkIdUserInfo,
  getVkIdCustomerById,
  getVkIdRuntime,
  persistVkIdCustomerLinkWithOwnershipGuard,
  readVkIdLinkSession,
  resolveAllowedVkIdReturnUrl,
  resolveVkIdentity,
} from "../../../../modules/vk-id"

export const StoreVkIdCallbackSchema = z.object({
  state: z.string().trim().min(1),
  code: z.string().trim().min(1).optional(),
  device_id: z.string().trim().min(1).optional(),
  error: z.string().trim().min(1).optional(),
  error_description: z.string().trim().min(1).optional(),
})

type StoreVkIdCallbackRequest = z.infer<typeof StoreVkIdCallbackSchema>

function sanitizeReason(value?: string | null) {
  return value?.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_") || null
}

function resolveCallbackReturnUrl(state?: string | null) {
  const session = readVkIdLinkSession(state)
  const returnUrl = resolveAllowedVkIdReturnUrl(session?.returnUrl || null)

  return {
    session,
    returnUrl,
  }
}

function redirectWithResult(
  res: MedusaResponse,
  returnUrl: URL,
  result: string,
  reason?: string | null,
  customerId?: string | null
) {
  const nextUrl = buildVkIdResultReturnUrl({
    returnUrl,
    result,
    reason: sanitizeReason(reason),
    customerId: customerId || null,
  })

  res.redirect(302, nextUrl.toString())
}

export async function GET(
  req: MedusaRequest<StoreVkIdCallbackRequest>,
  res: MedusaResponse
) {
  const runtime = getVkIdRuntime()
  const validatedQuery = req.validatedQuery as StoreVkIdCallbackRequest
  const { session, returnUrl } = resolveCallbackReturnUrl(validatedQuery.state)

  if (!runtime.enabled) {
    redirectWithResult(res, returnUrl, "failed", "vk_id_disabled")
    return
  }

  if (!session) {
    redirectWithResult(res, returnUrl, "failed", "invalid_or_expired_state")
    return
  }

  if (validatedQuery.error) {
    redirectWithResult(
      res,
      returnUrl,
      "failed",
      validatedQuery.error,
      session.customerId
    )
    return
  }

  if (!validatedQuery.code || !validatedQuery.device_id) {
    redirectWithResult(
      res,
      returnUrl,
      "failed",
      "missing_callback_params",
      session.customerId
    )
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const customer = await getVkIdCustomerById(query, session.customerId)

  if (!customer) {
    redirectWithResult(
      res,
      returnUrl,
      "failed",
      "customer_not_found",
      session.customerId
    )
    return
  }

  try {
    const tokenResult = await exchangeVkIdAuthorizationCode({
      runtime,
      code: validatedQuery.code,
      state: validatedQuery.state,
      deviceId: validatedQuery.device_id,
      codeVerifier: session.codeVerifier,
    })
    const userInfo = tokenResult.access_token
      ? await fetchVkIdUserInfo({
          runtime,
          accessToken: tokenResult.access_token,
        })
      : null
    const identity = resolveVkIdentity({
      tokenResult,
      userInfo,
    })

    if (!identity?.vkPeerId) {
      redirectWithResult(
        res,
        returnUrl,
        "failed",
        "missing_vk_peer_id",
        customer.id
      )
      return
    }

    const mutation = await persistVkIdCustomerLinkWithOwnershipGuard(
      req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION),
      {
        customerId: customer.id,
        identity,
        verifiedAt: new Date().toISOString(),
        linkSource: session.linkSource,
      }
    )

    if (mutation.status === "conflict") {
      redirectWithResult(
        res,
        returnUrl,
        "conflict",
        mutation.reason,
        mutation.conflictCustomerId || customer.id
      )
      return
    }

    redirectWithResult(
      res,
      returnUrl,
      mutation.status === "already_linked" ? "already_linked" : "linked",
      null,
      customer.id
    )
  } catch (error) {
    console.error("[vk-id] callback processing failed", {
      customer_id: customer.id,
      error: error instanceof Error ? error.message : String(error),
    })

    redirectWithResult(
      res,
      returnUrl,
      "failed",
      "callback_processing_failed",
      customer.id
    )
  }
}
