import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import type { IAuthModuleService } from "@medusajs/framework/types"
import { z } from "@medusajs/framework/zod"
import {
  getVkIdRuntime,
  identityFromPendingLinkTokenPayload,
  lookupCustomerByEmail,
  persistVkIdCustomerLinkWithOwnershipGuard,
  resolveAllowedVkIdLoginReturnUrl,
  verifyVkIdPendingLinkToken,
} from "../../../../../modules/vk-id"
import { issueCustomerJwtForVkIdentity } from "../../../../../modules/vk-id-auth"
import { normalizeNotificationRecipient } from "../../../../../modules/notification-email"
import { EMAILPASS_PROVIDER_ID } from "../../../../../workflows/apply-password-reset"

/**
 * Phase 5.3 backend route that completes the VK ID conflict-resolution flow.
 *
 * Inputs:
 * - `email` — the email returned by VK (same value the conflict page shows).
 * - `password` — the customer's existing emailpass password.
 * - `pending_token` — signed, short-lived token minted by the VK callback
 *   when it detected the `email_exists` conflict.
 *
 * The token carries the VK identity; verifying the password proves the
 * caller owns the existing customer account and unlocks the VK linking. We
 * intentionally do NOT let the caller pass an arbitrary VK identity: the VK
 * side is authenticated exclusively through the `pending_token` signature.
 *
 * On success we:
 * 1. Link the VK identity to the existing customer via the same advisory-lock
 *    path used by the profile-level linking flow.
 * 2. Issue a Medusa customer JWT so the storefront logs in immediately.
 *
 * The JWT is returned in the response body (not as a Set-Cookie) because
 * this endpoint is called from a storefront server action, not via a browser
 * redirect. The server action writes the `_medusa_jwt` cookie itself.
 */

export const StoreAuthVkIdLinkConflictResolveSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(1024),
  pending_token: z.string().trim().min(1).max(8192),
})

type RequestBody = z.infer<typeof StoreAuthVkIdLinkConflictResolveSchema>

type ErrorCode =
  | "vk_id_disabled"
  | "vk_id_register_disabled"
  | "pending_token_missing"
  | "pending_token_malformed"
  | "pending_token_invalid_signature"
  | "pending_token_expired"
  | "email_mismatch"
  | "customer_not_found"
  | "invalid_password"
  | "link_failed"
  | "link_conflict"
  | "jwt_signing_failed"
  | "internal_error"

type ErrorResponse = {
  ok: false
  code: ErrorCode
  message?: string
}

type SuccessResponse = {
  ok: true
  token: string
  customer_id: string
  redirect_to: string
}

function jsonError(
  res: MedusaResponse,
  status: number,
  body: ErrorResponse
) {
  res.status(status).json(body)
}

function resolveSuccessRedirect(): string {
  // Keep the redirect within the allowlist — same mechanism used by the
  // login/callback flows. We deliberately do not accept a caller-provided
  // URL here: the conflict page always lands on the account overview,
  // which shows the `vk_linked=success` banner.
  const url = resolveAllowedVkIdLoginReturnUrl(null)
  url.searchParams.set("vk_linked", "success")
  return url.toString()
}

export async function POST(
  req: MedusaRequest<RequestBody>,
  res: MedusaResponse
) {
  const runtime = getVkIdRuntime()

  if (!runtime.enabled) {
    jsonError(res, 409, { ok: false, code: "vk_id_disabled" })
    return
  }

  // Register must be enabled, otherwise the callback never minted a pending
  // token — rejecting here matches the rest of the VK ID surface.
  if (!runtime.registerEnabled) {
    jsonError(res, 409, { ok: false, code: "vk_id_register_disabled" })
    return
  }

  const body = (req.validatedBody || {}) as RequestBody
  const verification = verifyVkIdPendingLinkToken(body.pending_token)

  if (!verification.ok) {
    jsonError(res, 400, { ok: false, code: verification.code })
    return
  }

  const payload = verification.payload
  const tokenEmail = normalizeNotificationRecipient(payload.email)
  const submittedEmail = normalizeNotificationRecipient(body.email)

  if (!tokenEmail || !submittedEmail || tokenEmail !== submittedEmail) {
    // The email on the form must match the one the pending token carries.
    // Blocking a mismatch prevents using a token captured for one user to
    // resolve the conflict as a different user.
    jsonError(res, 400, { ok: false, code: "email_mismatch" })
    return
  }

  const pgConnection = req.scope.resolve(
    ContainerRegistrationKeys.PG_CONNECTION
  )

  let customer
  try {
    customer = await lookupCustomerByEmail(pgConnection, submittedEmail)
  } catch (error) {
    console.error("[vk-id] conflict-resolve lookup failed", {
      error: error instanceof Error ? error.message : String(error),
    })
    jsonError(res, 500, { ok: false, code: "internal_error" })
    return
  }

  if (!customer) {
    jsonError(res, 404, { ok: false, code: "customer_not_found" })
    return
  }

  const authModule = req.scope.resolve<IAuthModuleService>(Modules.AUTH)

  let authCheck
  try {
    authCheck = await authModule.authenticate(EMAILPASS_PROVIDER_ID, {
      body: {
        email: submittedEmail,
        password: body.password,
      },
    } as any)
  } catch (error) {
    // Some emailpass failures (e.g. unknown entity) throw; treat them the
    // same as a failed authenticate result to avoid account enumeration.
    console.error("[vk-id] conflict-resolve authenticate threw", {
      error: error instanceof Error ? error.name : String(error),
    })
    jsonError(res, 401, { ok: false, code: "invalid_password" })
    return
  }

  if (!authCheck?.success) {
    jsonError(res, 401, { ok: false, code: "invalid_password" })
    return
  }

  const identity = identityFromPendingLinkTokenPayload(payload)

  let mutation
  try {
    mutation = await persistVkIdCustomerLinkWithOwnershipGuard(pgConnection, {
      customerId: customer.id,
      identity,
      verifiedAt: new Date().toISOString(),
      linkSource: "vk_id_conflict_resolve",
    })
  } catch (error) {
    console.error("[vk-id] conflict-resolve link persist failed", {
      customer_id: customer.id,
      error: error instanceof Error ? error.message : String(error),
    })
    jsonError(res, 500, { ok: false, code: "link_failed" })
    return
  }

  if (mutation.status === "conflict") {
    // Another customer already owns this VK identity; this can happen if a
    // race between the original email-exists path and a separate VK link
    // landed first. We surface a dedicated code instead of pretending
    // success.
    jsonError(res, 409, {
      ok: false,
      code: "link_conflict",
      message: mutation.reason || "link_conflict",
    })
    return
  }

  const issued = await issueCustomerJwtForVkIdentity(req.scope, customer.id)

  if (!issued.ok) {
    console.error("[vk-id] conflict-resolve jwt issue failed", {
      customer_id: customer.id,
      code: issued.code,
    })
    jsonError(res, 500, { ok: false, code: issued.code as ErrorCode })
    return
  }

  const response: SuccessResponse = {
    ok: true,
    token: issued.token,
    customer_id: customer.id,
    redirect_to: resolveSuccessRedirect(),
  }

  res.status(200).json(response)
}
