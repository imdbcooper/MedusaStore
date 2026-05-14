import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import {
  buildVkIdLinkConflictReturnUrl,
  buildVkIdLoginErrorReturnUrl,
  buildVkIdRegisteredReturnUrl,
  buildVkIdResultReturnUrl,
  createVkIdCustomer,
  createVkIdPendingLinkToken,
  exchangeVkIdAuthorizationCode,
  fetchVkIdUserInfo,
  findVkIdCustomersByIdentity,
  findVkIdentityCustomer,
  getVkIdCustomerById,
  getVkIdRuntime,
  getVkIdSessionIntent,
  lookupCustomerByEmail,
  persistVkIdCustomerLinkWithOwnershipGuard,
  readVkIdLinkSession,
  resolveAllowedVkIdLoginReturnUrl,
  resolveAllowedVkIdReturnUrl,
  resolveVkIdentity,
  VkIdCustomerCreationError,
  withVkIdRegisterLock,
  generatePlaceholderEmail,
  type VkIdAuthIntent,
  type VkIdLinkSessionPayload,
  type VkIdRuntime,
  type VkResolvedIdentity,
} from "../../../../modules/vk-id"
import { issueCustomerJwtForVkIdentity } from "../../../../modules/vk-id-auth"

function normalizeCookieSecureFlag(value?: string | null) {
  const normalized = value?.trim().toLowerCase()
  if (normalized === "true") return "true"
  if (normalized === "false") return "false"
  if (normalized === "auto" || !normalized) return "auto"
  return "auto"
}

/**
 * Resolves the Secure flag for the `_medusa_jwt` cookie minted by the VK ID
 * login callback.
 *
 * Order of precedence:
 * 1. Explicit override via `VK_ID_COOKIE_SECURE` (`true` | `false`).
 * 2. Auto mode: derived from the scheme of `runtime.redirectUri`. HTTPS wins
 *    Secure, plain HTTP (local dev) omits it so the cookie still sticks.
 *
 * Unlike the previous `NODE_ENV === "production"` heuristic, this does not
 * depend on env mode labels that might be wrong in staging (our staging
 * containers legitimately run `NODE_ENV=production`, but even if that flips,
 * the cookie stays Secure as long as the callback is served over HTTPS).
 */
export function shouldUseSecureCookie(runtime: VkIdRuntime): boolean {
  const mode = normalizeCookieSecureFlag(process.env.VK_ID_COOKIE_SECURE)
  if (mode === "true") return true
  if (mode === "false") return false

  if (!runtime.redirectUri) {
    return false
  }

  try {
    return new URL(runtime.redirectUri).protocol === "https:"
  } catch {
    return false
  }
}

export const StoreVkIdCallbackSchema = z.object({
  state: z.string().trim().min(1),
  code: z.string().trim().min(1).optional(),
  device_id: z.string().trim().min(1).optional(),
  error: z.string().trim().min(1).optional(),
  error_description: z.string().trim().min(1).optional(),
})

type StoreVkIdCallbackRequest = z.infer<typeof StoreVkIdCallbackSchema>

const MEDUSA_JWT_COOKIE = "_medusa_jwt"
const MEDUSA_JWT_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7

function sanitizeReason(value?: string | null) {
  return value?.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_") || null
}

function resolveCallbackReturnUrl(state?: string | null) {
  const session = readVkIdLinkSession(state)
  const intent = getVkIdSessionIntent(session)
  const returnUrl =
    intent === "login"
      ? resolveAllowedVkIdLoginReturnUrl(session?.returnUrl || null)
      : resolveAllowedVkIdReturnUrl(session?.returnUrl || null)

  return {
    session,
    intent,
    returnUrl,
  }
}

function redirectWithLinkResult(
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

function redirectWithLoginError(
  res: MedusaResponse,
  returnUrl: URL,
  reason: string
) {
  const nextUrl = buildVkIdLoginErrorReturnUrl({
    returnUrl,
    reason,
  })

  res.redirect(302, nextUrl.toString())
}

function setMedusaJwtCookie(
  res: MedusaResponse,
  token: string,
  runtime: VkIdRuntime
) {
  // Mirrors `setAuthToken` semantics on the storefront. Caddy publishes both
  // backend and storefront under the same public origin (studio.slavx.ru), so
  // a single Secure cookie is readable by the storefront after redirect.
  //
  // `Secure` is decided from the callback URL scheme (+ VK_ID_COOKIE_SECURE
  // override), not from NODE_ENV. See shouldUseSecureCookie for rationale.
  const parts = [
    `${MEDUSA_JWT_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    `Max-Age=${MEDUSA_JWT_COOKIE_MAX_AGE_SECONDS}`,
    "HttpOnly",
    "SameSite=Lax",
  ]

  if (shouldUseSecureCookie(runtime)) {
    parts.push("Secure")
  }

  // `appendHeader` preserves any other Set-Cookie headers the response might
  // already carry (e.g. from upstream middleware) instead of overwriting them.
  res.appendHeader("Set-Cookie", parts.join("; "))
}

export type VkIdLoginIntentDeps = {
  exchangeAuthorizationCode: typeof exchangeVkIdAuthorizationCode
  fetchUserInfo: typeof fetchVkIdUserInfo
  resolveIdentity: typeof resolveVkIdentity
  findCustomersByIdentity: typeof findVkIdCustomersByIdentity
  findIdentityCustomer: typeof findVkIdentityCustomer
  issueCustomerJwt: typeof issueCustomerJwtForVkIdentity
  /**
   * Phase 5.2: register-branch injections. These are kept optional at the
   * type level so existing Phase 5.1 tests that pass `deps` without touching
   * registration keep working without edits.
   */
  lookupCustomerByEmail?: typeof lookupCustomerByEmail
  createVkIdCustomer?: typeof createVkIdCustomer
  /**
   * Phase 5.4: advisory-lock wrapper around the lookup + create pair. Exposed
   * for tests so they can stub the DB connection without spinning up PG.
   */
  withVkIdRegisterLock?: typeof withVkIdRegisterLock
}

const defaultLoginIntentDeps: VkIdLoginIntentDeps = {
  exchangeAuthorizationCode: exchangeVkIdAuthorizationCode,
  fetchUserInfo: fetchVkIdUserInfo,
  resolveIdentity: resolveVkIdentity,
  findCustomersByIdentity: findVkIdCustomersByIdentity,
  findIdentityCustomer: findVkIdentityCustomer,
  issueCustomerJwt: issueCustomerJwtForVkIdentity,
  lookupCustomerByEmail,
  createVkIdCustomer,
  withVkIdRegisterLock,
}

/**
 * Phase 5.3 conflict UX: VK callback detected an existing email/password
 * customer with the same email. We mint a signed, short-lived pending-link
 * token carrying the VK identity and redirect the storefront to the conflict
 * page, where the user logs in with the existing password to complete the
 * VK linking.
 *
 * Returns `{ handled: true }` so the caller stops processing. Falls back to
 * the legacy `?vk_login_error=email_exists` banner if the return origin is
 * not configured or the token cannot be built (no session secret): minting a
 * token without a trustworthy signing key would let attackers forge the
 * conflict flow, so we prefer a benign error banner over a broken security
 * posture.
 */
function handleEmailExistsConflict(
  res: MedusaResponse,
  input: {
    runtime: VkIdRuntime
    returnUrl: URL
    identity: VkResolvedIdentity
  }
): { handled: true } | { handled: false; fallbackReason: string } {
  const { runtime, returnUrl, identity } = input

  if (!identity.email) {
    // Defensive: the caller already checked this, but we never want to mint
    // a pending token without an email — the conflict page depends on it.
    return { handled: false, fallbackReason: "email_exists" }
  }

  const allowedOrigin =
    runtime.allowedStorefrontOrigins[0] || new URL(returnUrl.toString()).origin

  let pendingToken: string
  try {
    const minted = createVkIdPendingLinkToken({ identity })
    pendingToken = minted.token
  } catch (error) {
    console.error("[vk-id] pending link token mint failed", {
      error: error instanceof Error ? error.message : String(error),
    })
    return { handled: false, fallbackReason: "email_exists" }
  }

  const conflictUrl = buildVkIdLinkConflictReturnUrl({
    allowedOrigin,
    pendingToken,
  })

  res.redirect(302, conflictUrl.toString())
  return { handled: true }
}

export async function handleVkIdLoginIntent(
  req: MedusaRequest,
  res: MedusaResponse,
  input: {
    runtime: ReturnType<typeof getVkIdRuntime>
    session: VkIdLinkSessionPayload
    returnUrl: URL
    code: string
    deviceId: string
    state: string
  },
  deps: VkIdLoginIntentDeps = defaultLoginIntentDeps
) {
  const { runtime, session, returnUrl, code, deviceId, state } = input

  if (!runtime.loginEnabled) {
    redirectWithLoginError(res, returnUrl, "vk_id_login_disabled")
    return
  }

  let identity: VkResolvedIdentity | null = null

  try {
    const tokenResult = await deps.exchangeAuthorizationCode({
      runtime,
      code,
      state,
      deviceId,
      codeVerifier: session.codeVerifier,
    })
    const userInfo = tokenResult.access_token
      ? await deps.fetchUserInfo({
          runtime,
          accessToken: tokenResult.access_token,
        })
      : null

    identity = deps.resolveIdentity({ tokenResult, userInfo })
  } catch (error) {
    console.error("[vk-id] login token exchange failed", {
      error: error instanceof Error ? error.message : String(error),
    })

    redirectWithLoginError(res, returnUrl, "token_exchange_failed")
    return
  }

  if (!identity?.vkPeerId) {
    redirectWithLoginError(res, returnUrl, "missing_vk_peer_id")
    return
  }

  const pgConnection = req.scope.resolve(
    ContainerRegistrationKeys.PG_CONNECTION
  )
  const customers = await deps.findCustomersByIdentity(pgConnection, identity)
  const lookup = deps.findIdentityCustomer({ customers, identity })

  if (lookup.status === "ambiguous") {
    // Data-integrity breach: two or more customers claim the same VK identity.
    // The persist path is guarded by an advisory lock, so reaching this branch
    // means something bypassed it (manual SQL / historical import). Fail
    // closed with a generic error instead of silently authenticating the first
    // match.
    let logger: { warn?: (msg: string, meta?: unknown) => void } | null = null
    try {
      logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
    } catch {
      logger = null
    }
    logger?.warn?.("[vk-id] ambiguous VK identity login attempt", {
      vk_peer_id: identity.vkPeerId,
      match_ids: lookup.matches.map((m) => m.id),
    })
    redirectWithLoginError(res, returnUrl, "not_linked")
    return
  }

  if (lookup.status === "not_found" || !lookup.customer) {
    const registered = await tryVkIdRegisterBranch(req, res, {
      runtime,
      returnUrl,
      identity,
      session,
      deps,
    })

    if (registered.handled) {
      return
    }

    redirectWithLoginError(res, returnUrl, registered.fallbackReason)
    return
  }

  const customer = lookup.customer
  const issued = await deps.issueCustomerJwt(req.scope, customer.id)

  if (!issued.ok) {
    console.error("[vk-id] login jwt issue failed", {
      customer_id: customer.id,
      code: issued.code,
    })
    redirectWithLoginError(res, returnUrl, issued.code)
    return
  }

  setMedusaJwtCookie(res, issued.token, runtime)
  res.redirect(302, returnUrl.toString())
}

/**
 * Phase 5.2 register branch. Invoked when the VK identity is not yet linked
 * to any Medusa customer. Returns `{ handled: true }` if the branch fully
 * answered the request (cookie + redirect already written), or
 * `{ handled: false, fallbackReason }` so the caller can keep the Phase 5.1
 * `?vk_login_error=...` redirect as the final answer.
 *
 * Conditions for REGISTER (all must hold):
 * 1. `runtime.registerEnabled === true` — the operator explicitly opted in.
 * 2. VK returned an email (the configured `vkid.personal_info + email`
 *    scope always returns one in practice; if the provider drops it we
 *    surface `email_required`).
 * 3. `runtime.emailTrustPolicy !== "reject"` — otherwise the register flow
 *    is shut off and we surface `email_trust_policy_reject`.
 * 4. No existing Medusa customer already owns that email with an account.
 *    If one exists, we redirect to the Phase 5.3 conflict page instead of
 *    surfacing a dead-end banner.
 *
 * Any failure returns a specific `fallbackReason` so the storefront banner
 * can describe the exact mismatch.
 */
async function tryVkIdRegisterBranch(
  req: MedusaRequest,
  res: MedusaResponse,
  input: {
    runtime: VkIdRuntime
    returnUrl: URL
    identity: VkResolvedIdentity
    session: VkIdLinkSessionPayload
    deps: VkIdLoginIntentDeps
  }
): Promise<
  | { handled: true }
  | {
      handled: false
      fallbackReason: string
    }
> {
  const { runtime, returnUrl, identity, session, deps } = input

  if (!runtime.registerEnabled) {
    return { handled: false, fallbackReason: "not_linked" }
  }

  // Phase 5.5: VK ID may not return an email (scope mismatch, consent
  // revoked, or user has no email on VK profile). Instead of blocking
  // registration, we proceed with a placeholder email and mark onboarding
  // as pending. The storefront will prompt the user to provide a real email.
  // If `reject` trust policy is active, we still block registration entirely.

  // Phase 5.3: `reject` trust policy disables VK-driven registration entirely
  // even before we try to look up the email. Operators opting into this
  // policy are declaring that VK's email is not trustworthy enough to seed
  // an account without a separate verification step; we surface a specific
  // banner so the storefront copy explains why the VK flow stopped.
  if (runtime.emailTrustPolicy === "reject") {
    return { handled: false, fallbackReason: "email_trust_policy_reject" }
  }

  const lookupByEmailFn = deps.lookupCustomerByEmail ?? lookupCustomerByEmail
  const createFn = deps.createVkIdCustomer ?? createVkIdCustomer
  const registerLock = deps.withVkIdRegisterLock ?? withVkIdRegisterLock
  const pgConnection = req.scope.resolve(
    ContainerRegistrationKeys.PG_CONNECTION
  )

  // Phase 5.4: wrap the lookup + create pair in a PG advisory lock keyed by
  // both VK user id and email, so two concurrent callbacks for the same
  // identity cannot both reach the create branch and race. The second
  // request waits until the first finishes, then observes the created
  // customer via `lookupCustomerByEmail` and takes the conflict branch.
  //
  // Phase 5.5: when identity.email is null, we use the deterministic
  // placeholder email for the lock key and lookup. This ensures the same
  // VK user always resolves to the same placeholder customer.
  const emailForLookup = identity.email || generatePlaceholderEmail(identity.vkUserId)

  let existing: Awaited<ReturnType<typeof lookupCustomerByEmail>>
  let creation: Awaited<ReturnType<typeof createVkIdCustomer>> | null = null
  try {
    const outcome = await registerLock(
      pgConnection,
      { vkUserId: identity.vkUserId, email: emailForLookup },
      async () => {
        const lookup = await lookupByEmailFn(pgConnection, emailForLookup)

        if (lookup) {
          return { kind: "existing" as const, existing: lookup }
        }

        const created = await createFn(req.scope, {
          email: identity.email,
          firstName: identity.firstName,
          lastName: identity.lastName,
          phone: identity.phone,
          avatar: identity.avatar,
          identity,
          verifiedAt: new Date().toISOString(),
          linkSource: session.linkSource || "vk_id_register",
          emailTrustPolicy: runtime.emailTrustPolicy,
        })

        return { kind: "created" as const, creation: created }
      }
    )

    if (outcome.kind === "existing") {
      existing = outcome.existing
    } else {
      existing = null
      creation = outcome.creation
    }
  } catch (error) {
    // Fix #9: `error.message` from VkIdCustomerCreationError intentionally
    // carries an opaque `code:details_length:name` hint (see vk-id.ts), and
    // non-VK errors can echo the email back. We log code only, plus an
    // opaque length, so the email never reaches logs here.
    const code =
      error instanceof VkIdCustomerCreationError
        ? error.code
        : "customer_account_creation_failed"
    const rawMessage = error instanceof Error ? error.message : String(error)
    console.error("[vk-id] register lookup/create failed", {
      code,
      vk_user_id: identity.vkUserId,
      error_length: rawMessage.length,
      error_name: error instanceof Error ? error.name : null,
    })
    return { handled: false, fallbackReason: code }
  }

  if (existing) {
    // Phase 5.3 conflict UX: instead of showing a dead-end banner, mint a
    // short-lived pending-link token that carries the VK identity and
    // redirect to the storefront conflict page. The user signs in with the
    // existing password; the backend then completes VK linking.
    return handleEmailExistsConflict(res, {
      runtime,
      returnUrl,
      identity,
    })
  }

  if (!creation) {
    // Defensive: the lock callback always sets one of the two branches.
    return { handled: false, fallbackReason: "customer_account_creation_failed" }
  }

  const issued = await deps.issueCustomerJwt(req.scope, creation.customerId)

  if (!issued.ok) {
    console.error("[vk-id] register jwt issue failed", {
      customer_id: creation.customerId,
      code: issued.code,
    })
    return { handled: false, fallbackReason: issued.code }
  }

  setMedusaJwtCookie(res, issued.token, runtime)
  const registeredUrl = buildVkIdRegisteredReturnUrl({ returnUrl })
  // Phase 5.5: signal onboarding status to storefront via query param
  if (!identity.email) {
    registeredUrl.searchParams.set("onboarding", "pending")
  }
  res.redirect(302, registeredUrl.toString())
  return { handled: true }
}

export type VkIdLinkIntentDeps = {
  exchangeAuthorizationCode: typeof exchangeVkIdAuthorizationCode
  fetchUserInfo: typeof fetchVkIdUserInfo
  resolveIdentity: typeof resolveVkIdentity
  getCustomerById: typeof getVkIdCustomerById
  persistLink: typeof persistVkIdCustomerLinkWithOwnershipGuard
}

const defaultLinkIntentDeps: VkIdLinkIntentDeps = {
  exchangeAuthorizationCode: exchangeVkIdAuthorizationCode,
  fetchUserInfo: fetchVkIdUserInfo,
  resolveIdentity: resolveVkIdentity,
  getCustomerById: getVkIdCustomerById,
  persistLink: persistVkIdCustomerLinkWithOwnershipGuard,
}

export async function handleVkIdLinkIntent(
  req: MedusaRequest,
  res: MedusaResponse,
  input: {
    runtime: ReturnType<typeof getVkIdRuntime>
    session: VkIdLinkSessionPayload
    returnUrl: URL
    code: string
    deviceId: string
    state: string
  },
  deps: VkIdLinkIntentDeps = defaultLinkIntentDeps
) {
  const { runtime, session, returnUrl, code, deviceId, state } = input
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const customer = await deps.getCustomerById(query, session.customerId)

  if (!customer) {
    redirectWithLinkResult(
      res,
      returnUrl,
      "failed",
      "customer_not_found",
      session.customerId
    )
    return
  }

  try {
    const tokenResult = await deps.exchangeAuthorizationCode({
      runtime,
      code,
      state,
      deviceId,
      codeVerifier: session.codeVerifier,
    })
    const userInfo = tokenResult.access_token
      ? await deps.fetchUserInfo({
          runtime,
          accessToken: tokenResult.access_token,
        })
      : null
    const identity = deps.resolveIdentity({
      tokenResult,
      userInfo,
    })

    if (!identity?.vkPeerId) {
      redirectWithLinkResult(
        res,
        returnUrl,
        "failed",
        "missing_vk_peer_id",
        customer.id
      )
      return
    }

    const mutation = await deps.persistLink(
      req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION),
      {
        customerId: customer.id,
        identity,
        verifiedAt: new Date().toISOString(),
        linkSource: session.linkSource,
      }
    )

    if (mutation.status === "conflict") {
      redirectWithLinkResult(
        res,
        returnUrl,
        "conflict",
        mutation.reason,
        mutation.conflictCustomerId || customer.id
      )
      return
    }

    redirectWithLinkResult(
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

    redirectWithLinkResult(
      res,
      returnUrl,
      "failed",
      "callback_processing_failed",
      customer.id
    )
  }
}

export async function GET(
  req: MedusaRequest<StoreVkIdCallbackRequest>,
  res: MedusaResponse
) {
  const runtime = getVkIdRuntime()
  const validatedQuery = req.validatedQuery as StoreVkIdCallbackRequest
  const { session, intent, returnUrl } = resolveCallbackReturnUrl(
    validatedQuery.state
  )

  if (!runtime.enabled) {
    if (intent === "login") {
      redirectWithLoginError(res, returnUrl, "vk_id_disabled")
    } else {
      redirectWithLinkResult(res, returnUrl, "failed", "vk_id_disabled")
    }
    return
  }

  if (!session) {
    if (intent === "login") {
      redirectWithLoginError(res, returnUrl, "invalid_or_expired_state")
    } else {
      redirectWithLinkResult(
        res,
        returnUrl,
        "failed",
        "invalid_or_expired_state"
      )
    }
    return
  }

  if (validatedQuery.error) {
    if (intent === "login") {
      redirectWithLoginError(
        res,
        returnUrl,
        validatedQuery.error || "vk_login_failed"
      )
    } else {
      redirectWithLinkResult(
        res,
        returnUrl,
        "failed",
        validatedQuery.error,
        session.customerId
      )
    }
    return
  }

  if (!validatedQuery.code || !validatedQuery.device_id) {
    if (intent === "login") {
      redirectWithLoginError(res, returnUrl, "missing_callback_params")
    } else {
      redirectWithLinkResult(
        res,
        returnUrl,
        "failed",
        "missing_callback_params",
        session.customerId
      )
    }
    return
  }

  const sessionIntent: VkIdAuthIntent = intent

  if (sessionIntent === "login") {
    await handleVkIdLoginIntent(req, res, {
      runtime,
      session,
      returnUrl,
      code: validatedQuery.code,
      deviceId: validatedQuery.device_id,
      state: validatedQuery.state,
    })
    return
  }

  await handleVkIdLinkIntent(req, res, {
    runtime,
    session,
    returnUrl,
    code: validatedQuery.code,
    deviceId: validatedQuery.device_id,
    state: validatedQuery.state,
  })
}
