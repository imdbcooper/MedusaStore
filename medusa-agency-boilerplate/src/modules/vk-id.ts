import {
  createCustomerAccountWorkflow,
  updateCustomersWorkflow,
} from "@medusajs/medusa/core-flows"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type {
  IAuthModuleService,
  MedusaContainer,
} from "@medusajs/framework/types"
import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto"
import scryptKdf from "scrypt-kdf"
import { normalizeVkPeerId } from "./notification-vk"
import { normalizeNotificationRecipient } from "./notification-email"
import {
  EMAIL_VERIFICATION_AT_METADATA_KEY,
  EMAIL_VERIFICATION_FLAG_METADATA_KEY,
  EMAIL_VERIFICATION_FOR_METADATA_KEY,
  EMAIL_VERIFICATION_METADATA_KEY,
} from "./email-verification"

export const DEFAULT_VK_ID_SCOPES = "vkid.personal_info"
export const DEFAULT_VK_ID_AUTHORIZE_URL = "https://id.vk.ru/authorize"
export const DEFAULT_VK_ID_TOKEN_URL = "https://id.vk.ru/oauth2/auth"
export const DEFAULT_VK_ID_USER_INFO_URL = "https://id.vk.ru/oauth2/user_info"
export const DEFAULT_VK_ID_LINK_SOURCE = "storefront.account.profile"
export const DEFAULT_VK_ID_LOGIN_SOURCE = "storefront.account.login"
export const DEFAULT_VK_ID_LINK_SESSION_TTL_SECONDS = 10 * 60
export const DEFAULT_VK_ID_PROFILE_PATH = "/ru/account/profile"
export const DEFAULT_VK_ID_LOGIN_RETURN_PATH = "/ru/account"
export const DEFAULT_VK_ID_LINK_CONFLICT_PATH = "/ru/account/vk-link-conflict"
export const DEFAULT_VK_ID_PENDING_TOKEN_TTL_MINUTES = 10
const DEFAULT_LOCAL_STOREFRONT_ORIGIN = "http://localhost:8000"

/**
 * Phase 5.3: VK ID email trust policy.
 *
 * - `any` (default): current Phase 5.2 behaviour. VK-registered customers get
 *   `metadata.email_verified=true` + skip the transactional verification
 *   email. Keeps the MVP UX but trusts VK's email on face value.
 * - `require_verification`: VK-registered customers get
 *   `metadata.email_verified=false`. The `customer.created` subscriber does
 *   NOT skip the email; the customer goes through the same verification flow
 *   as any emailpass registration.
 * - `reject`: VK ID registration is disabled entirely because VK does not
 *   publish a verified-email claim today. The callback surfaces
 *   `email_trust_policy_reject` so the storefront can explain the policy.
 *
 * Runtime flag because production may want to raise the trust bar without
 * blocking MVP staging; default stays `any` so existing tests/deployments
 * keep working.
 */
export type VkIdEmailTrustPolicy = "any" | "require_verification" | "reject"
export const DEFAULT_VK_ID_EMAIL_TRUST_POLICY: VkIdEmailTrustPolicy = "any"

export type VkIdAuthIntent = "link" | "login"

type NullableString = string | null

type QueryGraphInput = {
  entity: string
  fields: string[]
  filters?: Record<string, unknown>
  pagination?: {
    take: number
    skip: number
  }
}

type QueryGraphResult<T> = {
  data: T[]
  metadata?: {
    count?: number
    take?: number
    skip?: number
  }
}

type QueryGraphLike = {
  graph: <T>(input: QueryGraphInput) => Promise<QueryGraphResult<T>>
}

type RawSqlRowsResult<T> = {
  rows?: T[]
}

type PgTransactionLike = {
  raw: <T = unknown>(sql: string, bindings?: unknown[]) => Promise<RawSqlRowsResult<T>>
}

type PgConnectionLike = {
  transaction: <T>(callback: (trx: PgTransactionLike) => Promise<T>) => Promise<T>
}

export type VkIdRuntime = {
  requestedEnabled: boolean
  enabled: boolean
  configured: boolean
  loginRequestedEnabled: boolean
  loginEnabled: boolean
  /**
   * Phase 5.2: gate for the VK ID registration branch. Requires
   * `VK_ID_ENABLED`, `VK_ID_LOGIN_ENABLED`, and `VK_ID_REGISTER_ENABLED` to
   * all be `true`. When `false`, the callback falls back to the Phase 5.1
   * `?vk_login_error=not_linked` redirect for previously-unknown VK
   * identities.
   */
  registerRequestedEnabled: boolean
  registerEnabled: boolean
  /**
   * Phase 5.3: VK ID email trust policy. Default `"any"` keeps the Phase 5.2
   * behaviour; `"require_verification"` forces the subscriber to send the
   * verification email; `"reject"` refuses VK ID registration entirely.
   *
   * Replaces the Phase 5.2 `VK_ID_REQUIRE_EMAIL` flag: VK ID always returns
   * an email in practice (the scope is `vkid.personal_info` + `email`), and
   * the "require email" toggle never gained a real use case — the only
   * remaining knob is whether we trust that email without re-verification.
   */
  emailTrustPolicy: VkIdEmailTrustPolicy
  clientId?: string
  clientSecret?: string
  redirectUri?: string
  scopes: string
  authorizeUrl: string
  tokenUrl: string
  userInfoUrl: string
  allowedStorefrontOrigins: string[]
}

export type VkLinkMetadata = {
  provider: NullableString
  vk_user_id: NullableString
  vk_peer_id: NullableString
  linked_at: NullableString
  link_source: NullableString
  link_status: NullableString
  last_verified_at: NullableString
  unlinked_at: NullableString
}

export type ResolvedVkLinkState = {
  isLinked: boolean
  isLegacyOnly: boolean
  provider: NullableString
  vkUserId: NullableString
  vkPeerId: NullableString
  linkedAt: NullableString
  linkSource: NullableString
  linkStatus: NullableString
  lastVerifiedAt: NullableString
  unlinkedAt: NullableString
  metadata: VkLinkMetadata | null
}

export type VkResolvedIdentity = {
  provider: "vkid"
  vkUserId: string
  vkPeerId: string
  /**
   * Email returned by VK ID. VK ID Web SDK v2 and OAuth 2.1 public API both
   * surface this through `userInfo.user.email`. The field is optional at the
   * provider layer because the user may have declined the `email` scope or
   * not connected one to their VK profile.
   */
  email: string | null
  /**
   * Best-effort verified flag. VK ID does not currently publish a public
   * `email_verified` claim on the user_info endpoint; `userInfo.user.verified`
   * describes the overall VK profile verification (celebrity checkmark),
   * not the email. We treat any truthy email from VK as "verified enough" to
   * pass to Medusa because VK only releases a user's primary email after
   * VK-side confirmation, but flag this explicitly so future callers can
   * react if VK introduces a real claim.
   */
  emailVerified: boolean
  firstName: string | null
  lastName: string | null
}

export type VkLinkableCustomerRecord = {
  id: string
  metadata?: unknown
}

export type VkIdLinkSessionPayload = {
  stateId: string
  nonce: string
  customerId: string
  returnUrl: string
  codeVerifier: string
  expiresAt: string
  linkSource: string
  intent?: VkIdAuthIntent
}

export type VkIdLinkSession = VkIdLinkSessionPayload & {
  state: string
  codeChallenge: string
}

export type VkIdLoginEnvFlag = {
  loginEnabled: boolean
}

export type VkIdTokenExchangeResult = {
  access_token?: string
  refresh_token?: string
  id_token?: string
  token_type?: string
  expires_in?: number
  user_id?: string
  state?: string
  scope?: string
}

export type VkIdUserInfoResult = {
  user?: {
    user_id?: string
    first_name?: string
    last_name?: string
    phone?: string
    email?: string
    avatar?: string
    sex?: number
    verified?: boolean
    birthday?: string
  }
}

export type VkIdLinkMutationResult = {
  status: "linked" | "already_linked" | "conflict"
  reason:
    | null
    | "customer_linked_to_different_vk_identity"
    | "vk_identity_linked_to_another_customer"
  metadata: Record<string, unknown> | null
  conflictCustomerId: string | null
  currentLink: ResolvedVkLinkState
}

export type VkIdUnlinkMutationResult = {
  status: "unlinked" | "already_unlinked"
  reason: null | "already_unlinked"
  metadata: Record<string, unknown> | null
  currentLink: ResolvedVkLinkState
}

function normalizeBooleanFlag(value?: string | null) {
  return value?.trim().toLowerCase() === "true"
}

/**
 * Phase 5.3: parse `VK_ID_EMAIL_TRUST_POLICY`. Unset/empty/unknown values
 * fall back to the default (`"any"`) so an operator who forgets to set the
 * flag gets the Phase 5.2 behaviour instead of an unexpected hard rejection.
 */
export function normalizeVkIdEmailTrustPolicy(
  value?: string | null
): VkIdEmailTrustPolicy {
  const normalized = value?.trim().toLowerCase()

  if (
    normalized === "any" ||
    normalized === "require_verification" ||
    normalized === "reject"
  ) {
    return normalized
  }

  return DEFAULT_VK_ID_EMAIL_TRUST_POLICY
}

/**
 * Phase 5.3: parse `VK_ID_PENDING_TOKEN_TTL_MINUTES` with a safe floor.
 * Falls back to the default when the value is missing or unparseable.
 * Values below 1 minute are raised to 1 minute to prevent accidentally
 * short-circuiting the conflict flow.
 */
export function resolveVkIdPendingTokenTtlMinutes(
  value?: string | null
): number {
  const normalized = value?.trim()

  if (!normalized) {
    return DEFAULT_VK_ID_PENDING_TOKEN_TTL_MINUTES
  }

  const parsed = Number(normalized)

  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_VK_ID_PENDING_TOKEN_TTL_MINUTES
  }

  return Math.floor(parsed)
}

function normalizeOptionalString(value?: string | null) {
  const normalized = value?.trim()

  return normalized ? normalized : undefined
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {}
}

function normalizeIsoDate(value: unknown) {
  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim()

  return normalized || null
}

function normalizeLinkStatus(value: unknown) {
  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim().toLowerCase()

  return normalized === "linked" || normalized === "unlinked"
    ? normalized
    : null
}

function parseOriginList(value?: string) {
  if (!value?.trim()) {
    return []
  }

  return Array.from(
    new Set(
      value
        .split(",")
        .map((origin) => normalizeOrigin(origin))
        .filter((origin): origin is string => Boolean(origin))
    )
  )
}

function normalizeOrigin(value?: string) {
  if (!value?.trim()) {
    return null
  }

  try {
    const url = new URL(value)

    return url.protocol === "http:" || url.protocol === "https:"
      ? url.origin
      : null
  } catch {
    return null
  }
}

function allowLocalStorefrontFallback() {
  const nodeEnv = process.env.NODE_ENV?.trim().toLowerCase()

  return !nodeEnv || nodeEnv === "development" || nodeEnv === "test"
}

function getAllowedStorefrontOrigins() {
  const configuredOrigins = parseOriginList(
    process.env.VK_ID_STOREFRONT_RETURN_ORIGINS
  )

  if (configuredOrigins.length) {
    return configuredOrigins
  }

  const storeCorsFallback = normalizeOrigin(
    process.env.STORE_CORS?.split(",")?.[0]?.trim()
  )

  if (storeCorsFallback) {
    return [storeCorsFallback]
  }

  if (allowLocalStorefrontFallback()) {
    return [DEFAULT_LOCAL_STOREFRONT_ORIGIN]
  }

  return []
}

/**
 * Resolves the secret used to HMAC-sign VK ID session state.
 *
 * The session state is minted by the public `/store/auth/vk-id/start`
 * endpoint (intent="login") and therefore must not be forgeable. Falling back
 * to a hardcoded literal would let any attacker forge arbitrary states, so we
 * refuse to start the flow when none of the expected secret env vars is set.
 */
function getVkIdSessionSecret() {
  const secret =
    normalizeOptionalString(process.env.VK_ID_SESSION_SECRET) ||
    normalizeOptionalString(process.env.JWT_SECRET) ||
    normalizeOptionalString(process.env.COOKIE_SECRET)

  if (!secret) {
    throw new Error(
      "VK_ID_SESSION_SECRET is not configured (and no JWT_SECRET/COOKIE_SECRET fallback); refusing to mint VK ID login/link state."
    )
  }

  return secret
}

function base64UrlEncode(value: Buffer | string) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/")
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4))

  return Buffer.from(`${normalized}${padding}`, "base64")
}

function signPayload(payload: string) {
  return base64UrlEncode(
    createHmac("sha256", getVkIdSessionSecret()).update(payload).digest()
  )
}

const VK_ID_STATE_SIGNATURE_LENGTH = 43

function buildSignedState(payload: VkIdLinkSessionPayload) {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  const signature = signPayload(encodedPayload)

  // VK ID's `/authorize` bridge rewrites `state` into `redirect_state` and
  // strips punctuation such as `.`, `~`, `:`, and `*` before the final auth
  // page. Keep the state alphabet to base64url alphanumerics plus `-` / `_`,
  // which VK preserves, by concatenating payload + fixed-length SHA-256 HMAC
  // signature instead of using a punctuation separator.
  return `${encodedPayload}${signature}`
}

function verifySignedState(state: string) {
  let encodedPayload: string | undefined
  let providedSignature: string | undefined

  if (state.includes(".")) {
    // Backward-compatible reader for states minted before the VK-safe compact
    // format. This path is useful for local/direct smokes and harmless because
    // VK itself strips the dot before a real callback.
    ;[encodedPayload, providedSignature] = state.split(".")
  } else if (state.length > VK_ID_STATE_SIGNATURE_LENGTH) {
    encodedPayload = state.slice(0, -VK_ID_STATE_SIGNATURE_LENGTH)
    providedSignature = state.slice(-VK_ID_STATE_SIGNATURE_LENGTH)
  }

  if (!encodedPayload || !providedSignature) {
    return null
  }

  const expectedSignature = signPayload(encodedPayload)

  try {
    const expectedBuffer = Buffer.from(expectedSignature)
    const providedBuffer = Buffer.from(providedSignature)

    if (
      expectedBuffer.length !== providedBuffer.length ||
      !timingSafeEqual(expectedBuffer, providedBuffer)
    ) {
      return null
    }

    const parsedPayload = JSON.parse(
      decodeBase64Url(encodedPayload).toString("utf8")
    ) as VkIdLinkSessionPayload

    return parsedPayload
  } catch {
    return null
  }
}

function createRandomToken(size = 32) {
  return base64UrlEncode(randomBytes(size))
}

/**
 * Phase 5.3 pending link token.
 *
 * Signed, short-lived token that carries the VK identity fields needed to
 * complete the conflict-resolution flow on the storefront:
 *
 * 1. `/store/vk-id/callback` detects `email_exists` and mints a token that
 *    captures the VK identity (`vk_user_id`, `vk_peer_id`, `email`,
 *    `first_name`, `last_name`) plus a minted-at timestamp.
 * 2. Storefront renders the `/ru/account/vk-link-conflict` page, showing the
 *    email and asking the user to log in with their existing password.
 * 3. `/store/auth/vk-id/link-conflict-resolve` verifies the password via
 *    the emailpass auth provider and, on success, links the VK identity
 *    from the token to the authenticated customer.
 *
 * The token is HMAC-signed with the same secret chain as the login/link
 * session (`VK_ID_SESSION_SECRET` -> `JWT_SECRET` -> `COOKIE_SECRET`). It is
 * NOT a bearer credential: it can only drive the link flow after the caller
 * also proves knowledge of the customer password.
 */
export type VkIdPendingLinkTokenPayload = {
  vkUserId: string
  vkPeerId: string
  email: string
  firstName: string | null
  lastName: string | null
  mintedAt: string
  expiresAt: string
}

export function createVkIdPendingLinkToken(input: {
  identity: VkResolvedIdentity
  ttlMinutes?: number
  now?: Date
}): { token: string; payload: VkIdPendingLinkTokenPayload } {
  const ttlMinutes =
    typeof input.ttlMinutes === "number" && input.ttlMinutes > 0
      ? Math.floor(input.ttlMinutes)
      : resolveVkIdPendingTokenTtlMinutes(
          process.env.VK_ID_PENDING_TOKEN_TTL_MINUTES
        )
  const now = input.now ?? new Date()
  const mintedAt = now.toISOString()
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000).toISOString()

  if (!input.identity.email) {
    throw new Error(
      "VK ID pending link token requires an email in the VK identity; caller must not mint a conflict token without one."
    )
  }

  const payload: VkIdPendingLinkTokenPayload = {
    vkUserId: input.identity.vkUserId,
    vkPeerId: input.identity.vkPeerId,
    email: normalizeNotificationRecipient(input.identity.email) || input.identity.email,
    firstName: input.identity.firstName,
    lastName: input.identity.lastName,
    mintedAt,
    expiresAt,
  }

  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  const signature = signPayload(encodedPayload)

  return {
    token: `${encodedPayload}.${signature}`,
    payload,
  }
}

export type VkIdPendingLinkTokenVerifyResult =
  | { ok: true; payload: VkIdPendingLinkTokenPayload }
  | {
      ok: false
      code:
        | "pending_token_missing"
        | "pending_token_malformed"
        | "pending_token_invalid_signature"
        | "pending_token_expired"
    }

export function verifyVkIdPendingLinkToken(
  token: string | null | undefined,
  options?: { now?: Date }
): VkIdPendingLinkTokenVerifyResult {
  const trimmed = token?.trim()

  if (!trimmed) {
    return { ok: false, code: "pending_token_missing" }
  }

  const [encodedPayload, providedSignature] = trimmed.split(".")

  if (!encodedPayload || !providedSignature) {
    return { ok: false, code: "pending_token_malformed" }
  }

  let expectedSignature: string

  try {
    expectedSignature = signPayload(encodedPayload)
  } catch {
    // `getVkIdSessionSecret` throws when no secret env is configured. Treat
    // that the same as an invalid signature rather than leaking the error.
    return { ok: false, code: "pending_token_invalid_signature" }
  }

  const expectedBuffer = Buffer.from(expectedSignature)
  const providedBuffer = Buffer.from(providedSignature)

  if (
    expectedBuffer.length !== providedBuffer.length ||
    !timingSafeEqual(expectedBuffer, providedBuffer)
  ) {
    return { ok: false, code: "pending_token_invalid_signature" }
  }

  let payload: VkIdPendingLinkTokenPayload

  try {
    payload = JSON.parse(
      decodeBase64Url(encodedPayload).toString("utf8")
    ) as VkIdPendingLinkTokenPayload
  } catch {
    return { ok: false, code: "pending_token_malformed" }
  }

  if (
    typeof payload?.vkUserId !== "string" ||
    typeof payload?.vkPeerId !== "string" ||
    typeof payload?.email !== "string" ||
    typeof payload?.expiresAt !== "string"
  ) {
    return { ok: false, code: "pending_token_malformed" }
  }

  const expiresAt = Date.parse(payload.expiresAt)
  const nowMs = (options?.now ?? new Date()).getTime()

  if (!Number.isFinite(expiresAt) || expiresAt <= nowMs) {
    return { ok: false, code: "pending_token_expired" }
  }

  return { ok: true, payload }
}

/**
 * Phase 5.3: convert a verified pending-link token back into a
 * `VkResolvedIdentity` shape so existing linking helpers
 * (`persistVkIdCustomerLinkWithOwnershipGuard`) can consume it directly.
 */
export function identityFromPendingLinkTokenPayload(
  payload: VkIdPendingLinkTokenPayload
): VkResolvedIdentity {
  return {
    provider: "vkid",
    vkUserId: payload.vkUserId,
    vkPeerId: payload.vkPeerId,
    email: payload.email || null,
    emailVerified: Boolean(payload.email),
    firstName: payload.firstName,
    lastName: payload.lastName,
  }
}

/**
 * Phase 5.3: build the storefront URL that the VK ID callback redirects to
 * when it detects the `email_exists` conflict. The storefront renders the
 * conflict page and submits the password form that hits
 * `/store/auth/vk-id/link-conflict-resolve`.
 */
export function buildVkIdLinkConflictReturnUrl(input: {
  allowedOrigin: string
  pendingToken: string
  path?: string
}) {
  const path = input.path || DEFAULT_VK_ID_LINK_CONFLICT_PATH
  const url = new URL(path, input.allowedOrigin)
  url.searchParams.set("pending_token", input.pendingToken)
  return url
}

export function createCodeChallenge(codeVerifier: string) {
  return base64UrlEncode(createHash("sha256").update(codeVerifier).digest())
}

export function getVkIdRuntime(): VkIdRuntime {
  const requestedEnabled = normalizeBooleanFlag(process.env.VK_ID_ENABLED)
  const loginRequestedEnabled = normalizeBooleanFlag(
    process.env.VK_ID_LOGIN_ENABLED
  )
  const registerRequestedEnabled = normalizeBooleanFlag(
    process.env.VK_ID_REGISTER_ENABLED
  )
  // Phase 5.3: `VK_ID_REQUIRE_EMAIL` is dead. VK ID always returns an email
  // in the configured `vkid.personal_info` scope, and the `requireEmail=false`
  // branch fell back to `not_linked` anyway. The flag is kept documented in
  // env examples as "removed" so operators upgrading staging see an explicit
  // migration note; reading it here is intentionally skipped.
  const emailTrustPolicy = normalizeVkIdEmailTrustPolicy(
    process.env.VK_ID_EMAIL_TRUST_POLICY
  )
  const clientId = normalizeOptionalString(process.env.VK_ID_CLIENT_ID)
  const clientSecret = normalizeOptionalString(process.env.VK_ID_CLIENT_SECRET)
  const redirectUri = normalizeOptionalString(process.env.VK_ID_REDIRECT_URI)
  const scopes =
    normalizeOptionalString(process.env.VK_ID_SCOPES) || DEFAULT_VK_ID_SCOPES
  const configured = requestedEnabled && Boolean(clientId && redirectUri)
  const loginEnabled = configured && loginRequestedEnabled
  // Register requires the whole chain to be explicitly opted in. This is the
  // safer default: turning on `VK_ID_REGISTER_ENABLED` alone without the
  // preceding flags is almost certainly a misconfiguration, and we do not want
  // to auto-create customers from a half-enabled VK ID stack.
  const registerEnabled = loginEnabled && registerRequestedEnabled

  return {
    requestedEnabled,
    enabled: configured,
    configured,
    loginRequestedEnabled,
    loginEnabled,
    registerRequestedEnabled,
    registerEnabled,
    emailTrustPolicy,
    clientId,
    clientSecret,
    redirectUri,
    scopes,
    authorizeUrl: DEFAULT_VK_ID_AUTHORIZE_URL,
    tokenUrl: DEFAULT_VK_ID_TOKEN_URL,
    userInfoUrl: DEFAULT_VK_ID_USER_INFO_URL,
    allowedStorefrontOrigins: getAllowedStorefrontOrigins(),
  }
}

export function resolveAllowedVkIdReturnUrl(
  requestedUrl?: string | null,
  options?: { defaultPath?: string }
) {
  const allowedOrigins = getAllowedStorefrontOrigins()
  const defaultPath = options?.defaultPath || DEFAULT_VK_ID_PROFILE_PATH

  if (requestedUrl?.trim()) {
    try {
      const parsedUrl = new URL(requestedUrl)

      if (allowedOrigins.includes(parsedUrl.origin)) {
        return parsedUrl
      }
    } catch {
      // ignore invalid requested return url and fall back to configured default
    }
  }

  const defaultOrigin = allowedOrigins[0]

  if (defaultOrigin) {
    return new URL(defaultPath, defaultOrigin)
  }

  if (allowLocalStorefrontFallback()) {
    return new URL(defaultPath, DEFAULT_LOCAL_STOREFRONT_ORIGIN)
  }

  throw new Error(
    "VK ID storefront return origin is not configured. Set VK_ID_STOREFRONT_RETURN_ORIGINS or STORE_CORS."
  )
}

export function resolveAllowedVkIdLoginReturnUrl(requestedUrl?: string | null) {
  return resolveAllowedVkIdReturnUrl(requestedUrl, {
    defaultPath: DEFAULT_VK_ID_LOGIN_RETURN_PATH,
  })
}

function resolveDefaultLinkSourceForIntent(intent: VkIdAuthIntent) {
  return intent === "login"
    ? DEFAULT_VK_ID_LOGIN_SOURCE
    : DEFAULT_VK_ID_LINK_SOURCE
}

export function createVkIdLinkSession(input: {
  customerId: string
  returnUrl: string
  linkSource?: string | null
  ttlSeconds?: number
  intent?: VkIdAuthIntent
}) {
  const intent: VkIdAuthIntent = input.intent === "login" ? "login" : "link"
  const stateId = createRandomToken(18)
  const nonce = createRandomToken(18)
  const codeVerifier = createRandomToken(48)
  const expiresAt = new Date(
    Date.now() +
      (input.ttlSeconds ?? DEFAULT_VK_ID_LINK_SESSION_TTL_SECONDS) * 1000
  ).toISOString()
  const payload: VkIdLinkSessionPayload = {
    stateId,
    nonce,
    customerId: input.customerId,
    returnUrl: input.returnUrl,
    codeVerifier,
    expiresAt,
    linkSource:
      input.linkSource?.trim() || resolveDefaultLinkSourceForIntent(intent),
    intent,
  }

  return {
    ...payload,
    state: buildSignedState(payload),
    codeChallenge: createCodeChallenge(codeVerifier),
  } satisfies VkIdLinkSession
}

/**
 * Public, customer-less variant for the login intent. The caller does not yet
 * have a Medusa customer id – it will be resolved from the VK identity in the
 * callback. The session keeps `customerId` empty by design and pins
 * `intent: "login"` so the callback branch is unambiguous.
 */
export function createVkIdLoginSession(input: {
  returnUrl: string
  loginSource?: string | null
  ttlSeconds?: number
}) {
  return createVkIdLinkSession({
    customerId: "",
    returnUrl: input.returnUrl,
    linkSource: input.loginSource || null,
    ttlSeconds: input.ttlSeconds,
    intent: "login",
  })
}

export function getVkIdSessionIntent(
  session: VkIdLinkSessionPayload | null | undefined
): VkIdAuthIntent {
  return session?.intent === "login" ? "login" : "link"
}

export function readVkIdLinkSession(state?: string | null) {
  if (!state?.trim()) {
    return null
  }

  const parsedPayload = verifySignedState(state)

  if (!parsedPayload) {
    return null
  }

  const expiresAt = Date.parse(parsedPayload.expiresAt)

  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return null
  }

  return parsedPayload
}

export function buildVkIdAuthorizeUrl(input: {
  runtime?: VkIdRuntime
  state: string
  codeChallenge: string
}) {
  const runtime = input.runtime || getVkIdRuntime()

  if (!runtime.clientId || !runtime.redirectUri) {
    throw new Error("VK ID runtime is not configured for authorization")
  }

  const url = new URL(runtime.authorizeUrl)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("client_id", runtime.clientId)
  url.searchParams.set("redirect_uri", runtime.redirectUri)
  url.searchParams.set("state", input.state)
  url.searchParams.set("scope", runtime.scopes)
  url.searchParams.set("code_challenge", input.codeChallenge)
  url.searchParams.set("code_challenge_method", "S256")

  return url
}

async function parseJsonResponse(response: Response) {
  const text = await response.text()

  if (!text) {
    return {}
  }

  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return {
      message: text,
    }
  }
}

function buildProviderErrorMessage(
  payload: Record<string, unknown>,
  fallback: string
) {
  const description =
    typeof payload.error_description === "string"
      ? payload.error_description
      : typeof payload.message === "string"
        ? payload.message
        : fallback

  return description.trim() || fallback
}

export async function exchangeVkIdAuthorizationCode(input: {
  runtime?: VkIdRuntime
  code: string
  state: string
  deviceId: string
  codeVerifier: string
}) {
  const runtime = input.runtime || getVkIdRuntime()

  if (!runtime.clientId || !runtime.redirectUri) {
    throw new Error("VK ID runtime is not configured for token exchange")
  }

  const body = new URLSearchParams()
  body.set("grant_type", "authorization_code")
  body.set("code_verifier", input.codeVerifier)
  body.set("redirect_uri", runtime.redirectUri)
  body.set("code", input.code)
  body.set("client_id", runtime.clientId)
  body.set("device_id", input.deviceId)
  body.set("state", input.state)

  if (runtime.clientSecret) {
    body.set("client_secret", runtime.clientSecret)
  }

  const response = await fetch(runtime.tokenUrl, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  })

  const payload = (await parseJsonResponse(response)) as VkIdTokenExchangeResult &
    Record<string, unknown>

  if (!response.ok) {
    throw new Error(
      buildProviderErrorMessage(payload, "VK ID authorization code exchange failed")
    )
  }

  return payload
}

export async function fetchVkIdUserInfo(input: {
  runtime?: VkIdRuntime
  accessToken: string
}) {
  const runtime = input.runtime || getVkIdRuntime()

  if (!runtime.clientId) {
    throw new Error("VK ID runtime is not configured for user info lookup")
  }

  const body = new URLSearchParams()
  body.set("client_id", runtime.clientId)
  body.set("access_token", input.accessToken)

  const response = await fetch(runtime.userInfoUrl, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  })

  const payload = (await parseJsonResponse(response)) as VkIdUserInfoResult &
    Record<string, unknown>

  if (!response.ok) {
    throw new Error(
      buildProviderErrorMessage(payload, "VK ID user info lookup failed")
    )
  }

  return payload
}

function normalizeIdentityString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()

  return trimmed ? trimmed : null
}

export function resolveVkIdentity(input: {
  tokenResult: VkIdTokenExchangeResult
  userInfo?: VkIdUserInfoResult | null
}) {
  const candidateUserId =
    input.userInfo?.user?.user_id || input.tokenResult.user_id || null
  const vkUserId = normalizeVkPeerId(candidateUserId)
  const vkPeerId = normalizeVkPeerId(candidateUserId)

  if (!vkUserId || !vkPeerId) {
    return null
  }

  const user = input.userInfo?.user ?? null
  const email = normalizeIdentityString(user?.email)
  // VK does not publish a stable `email_verified` claim today. We treat the
  // presence of a VK-released email as verified-enough for the register flow
  // because VK surfaces the primary email only after VK-side confirmation.
  // `user.verified` describes the celebrity-style profile checkmark, not the
  // email — do NOT conflate the two.
  const emailVerified = Boolean(email)

  return {
    provider: "vkid",
    vkUserId,
    vkPeerId,
    email,
    emailVerified,
    firstName: normalizeIdentityString(user?.first_name),
    lastName: normalizeIdentityString(user?.last_name),
  } satisfies VkResolvedIdentity
}

export function readVkLinkMetadata(metadata?: unknown): VkLinkMetadata | null {
  const root = asRecord(metadata)
  const link = asRecord(root.vk_link)

  if (!Object.keys(link).length) {
    return null
  }

  return {
    provider:
      typeof link.provider === "string" && link.provider.trim()
        ? link.provider.trim()
        : null,
    vk_user_id: normalizeVkPeerId(
      typeof link.vk_user_id === "string" || typeof link.vk_user_id === "number"
        ? String(link.vk_user_id)
        : undefined
    ),
    vk_peer_id: normalizeVkPeerId(
      typeof link.vk_peer_id === "string" || typeof link.vk_peer_id === "number"
        ? String(link.vk_peer_id)
        : undefined
    ),
    linked_at: normalizeIsoDate(link.linked_at),
    link_source:
      typeof link.link_source === "string" && link.link_source.trim()
        ? link.link_source.trim()
        : null,
    link_status: normalizeLinkStatus(link.link_status),
    last_verified_at: normalizeIsoDate(link.last_verified_at),
    unlinked_at: normalizeIsoDate(link.unlinked_at),
  }
}

export function resolveVkLinkState(metadata?: unknown): ResolvedVkLinkState {
  const root = asRecord(metadata)
  const structured = readVkLinkMetadata(metadata)
  const legacyVkPeerId = normalizeVkPeerId(
    typeof root.vk_peer_id === "string" || typeof root.vk_peer_id === "number"
      ? String(root.vk_peer_id)
      : undefined
  )
  const vkPeerId = structured?.vk_peer_id || legacyVkPeerId || null
  const explicitlyUnlinked = structured?.link_status === "unlinked"
  const isLinked = explicitlyUnlinked ? Boolean(legacyVkPeerId) : Boolean(vkPeerId)

  return {
    isLinked,
    isLegacyOnly: Boolean(isLinked && legacyVkPeerId && !structured),
    provider: structured?.provider || (legacyVkPeerId ? "vkid-legacy" : null),
    vkUserId: structured?.vk_user_id || null,
    vkPeerId,
    linkedAt: structured?.linked_at || null,
    linkSource: structured?.link_source || null,
    linkStatus:
      isLinked
        ? structured?.link_status || "linked"
        : structured?.link_status || null,
    lastVerifiedAt: structured?.last_verified_at || null,
    unlinkedAt: structured?.unlinked_at || null,
    metadata: structured,
  }
}

function buildLinkedMetadata(input: {
  currentMetadata?: unknown
  currentLink: ResolvedVkLinkState
  identity: VkResolvedIdentity
  verifiedAt: string
  linkSource: string
}) {
  const nextMetadata = asRecord(input.currentMetadata)
  const linkedAt = input.currentLink.linkedAt || input.verifiedAt

  nextMetadata.vk_peer_id = input.identity.vkPeerId
  nextMetadata.vk_link = {
    provider: input.identity.provider,
    vk_user_id: input.identity.vkUserId,
    vk_peer_id: input.identity.vkPeerId,
    linked_at: linkedAt,
    link_source: input.linkSource,
    link_status: "linked",
    last_verified_at: input.verifiedAt,
    unlinked_at: null,
  } satisfies VkLinkMetadata

  return nextMetadata
}

function buildUnlinkedMetadata(input: {
  currentMetadata?: unknown
  currentLink: ResolvedVkLinkState
  unlinkedAt: string
}) {
  const nextMetadata = asRecord(input.currentMetadata)

  delete nextMetadata.vk_peer_id

  nextMetadata.vk_link = {
    provider: input.currentLink.provider || "vkid",
    vk_user_id: input.currentLink.vkUserId,
    vk_peer_id: input.currentLink.vkPeerId,
    linked_at: input.currentLink.linkedAt,
    link_source: input.currentLink.linkSource,
    link_status: "unlinked",
    last_verified_at: input.currentLink.lastVerifiedAt,
    unlinked_at: input.unlinkedAt,
  } satisfies VkLinkMetadata

  return nextMetadata
}

function isSameVkIdentity(
  currentLink: ResolvedVkLinkState,
  identity: VkResolvedIdentity
) {
  return Boolean(
    (currentLink.vkUserId && currentLink.vkUserId === identity.vkUserId) ||
      (currentLink.vkPeerId && currentLink.vkPeerId === identity.vkPeerId)
  )
}

export function findVkIdentityConflict(input: {
  currentCustomerId: string
  customers: VkLinkableCustomerRecord[]
  identity: VkResolvedIdentity
}) {
  for (const customer of input.customers) {
    if (customer.id === input.currentCustomerId) {
      continue
    }

    const linkState = resolveVkLinkState(customer.metadata)

    if (!linkState.isLinked) {
      continue
    }

    if (isSameVkIdentity(linkState, input.identity)) {
      return customer
    }
  }

  return null
}

export function planVkIdLinkMutation(input: {
  currentCustomerId: string
  currentMetadata?: unknown
  customers: VkLinkableCustomerRecord[]
  identity: VkResolvedIdentity
  verifiedAt: string
  linkSource?: string | null
}) {
  const currentLink = resolveVkLinkState(input.currentMetadata)
  const linkSource = input.linkSource?.trim() || DEFAULT_VK_ID_LINK_SOURCE

  if (currentLink.isLinked && !isSameVkIdentity(currentLink, input.identity)) {
    return {
      status: "conflict",
      reason: "customer_linked_to_different_vk_identity",
      metadata: null,
      conflictCustomerId: input.currentCustomerId,
      currentLink,
    } satisfies VkIdLinkMutationResult
  }

  const conflictCustomer = findVkIdentityConflict({
    currentCustomerId: input.currentCustomerId,
    customers: input.customers,
    identity: input.identity,
  })

  if (conflictCustomer) {
    return {
      status: "conflict",
      reason: "vk_identity_linked_to_another_customer",
      metadata: null,
      conflictCustomerId: conflictCustomer.id,
      currentLink,
    } satisfies VkIdLinkMutationResult
  }

  const nextMetadata = buildLinkedMetadata({
    currentMetadata: input.currentMetadata,
    currentLink,
    identity: input.identity,
    verifiedAt: input.verifiedAt,
    linkSource,
  })

  return {
    status: currentLink.isLinked ? "already_linked" : "linked",
    reason: null,
    metadata: nextMetadata,
    conflictCustomerId: null,
    currentLink,
  } satisfies VkIdLinkMutationResult
}

export function planVkIdUnlinkMutation(input: {
  currentMetadata?: unknown
  unlinkedAt: string
}) {
  const currentLink = resolveVkLinkState(input.currentMetadata)

  if (!currentLink.isLinked) {
    return {
      status: "already_unlinked",
      reason: "already_unlinked",
      metadata: null,
      currentLink,
    } satisfies VkIdUnlinkMutationResult
  }

  return {
    status: "unlinked",
    reason: null,
    metadata: buildUnlinkedMetadata({
      currentMetadata: input.currentMetadata,
      currentLink,
      unlinkedAt: input.unlinkedAt,
    }),
    currentLink,
  } satisfies VkIdUnlinkMutationResult
}

export function buildVkIdResultReturnUrl(input: {
  returnUrl: string | URL
  result: string
  reason?: string | null
  customerId?: string | null
}) {
  const url = input.returnUrl instanceof URL ? new URL(input.returnUrl.toString()) : new URL(input.returnUrl)

  url.searchParams.set("vk_id_result", input.result)

  if (input.reason) {
    url.searchParams.set("vk_id_reason", input.reason)
  } else {
    url.searchParams.delete("vk_id_reason")
  }

  if (input.customerId) {
    url.searchParams.set("vk_id_customer_id", input.customerId)
  } else {
    url.searchParams.delete("vk_id_customer_id")
  }

  return url
}

export async function getVkIdCustomerById(
  query: QueryGraphLike,
  customerId: string
) {
  const { data } = await query.graph<VkLinkableCustomerRecord>({
    entity: "customer",
    fields: ["id", "metadata"],
    filters: {
      id: customerId,
    },
  })

  return data[0] || null
}

export async function listVkIdCustomers(
  query: QueryGraphLike,
  take = 100
): Promise<VkLinkableCustomerRecord[]> {
  const customers: VkLinkableCustomerRecord[] = []
  let skip = 0

  while (true) {
    const { data } = await query.graph<VkLinkableCustomerRecord>({
      entity: "customer",
      fields: ["id", "metadata"],
      pagination: {
        take,
        skip,
      },
    })

    if (!data.length) {
      break
    }

    customers.push(...data)

    if (data.length < take) {
      break
    }

    skip += take
  }

  return customers
}

function getRawRows<T>(result: RawSqlRowsResult<T> | null | undefined) {
  return Array.isArray(result?.rows) ? result.rows : []
}

async function acquireVkIdOwnershipLock(
  trx: PgTransactionLike,
  identity: VkResolvedIdentity
) {
  await trx.raw(
    `
      select pg_advisory_xact_lock(hashtext(?), hashtext(?))
    `,
    [identity.provider, identity.vkPeerId]
  )
}

/**
 * Phase 5.4: serialize the VK ID register branch against concurrent callbacks
 * for the same identity/email.
 *
 * Problem
 * -------
 * The register branch runs `lookupCustomerByEmail` followed by
 * `createVkIdCustomer`. Two callbacks for the same `vk_user_id` or email can
 * interleave between the two calls and both reach the `not_found` branch,
 * racing to create the customer. The unique constraint on
 * `provider_identities.entity_id` prevents two auth_identity rows, but the
 * losing request fails with an opaque downstream error and potentially
 * leaves an orphan customer row behind.
 *
 * Fix
 * ---
 * Wrap the lookup + create pair in a PostgreSQL advisory transaction lock
 * keyed by both the VK user id and the normalized email. The key pair maps
 * both colliding scenarios (same VK user, same email) to the same lock, so
 * the second request waits until the first finishes. Once the first request
 * commits, the second sees the created customer through `lookupCustomerByEmail`
 * (or `findVkIdCustomersByIdentity` earlier in the callback) and takes the
 * existing-customer branch.
 *
 * `pg_advisory_xact_lock` is automatically released at transaction end, so
 * we do not need explicit cleanup. The lock scope is a wrapping transaction
 * we open purely to hold it; we do NOT nest `createVkIdCustomer`'s own
 * workflow DB work inside this transaction — that work still goes through
 * the Medusa module stack using its own connection. The lock guarantees
 * serialization between the VK lookup and the subsequent Medusa workflow
 * at the *SQL session* level, which is the level at which the race occurs.
 */
export async function withVkIdRegisterLock<T>(
  pgConnection: PgConnectionLike,
  input: { vkUserId: string; email: string },
  callback: () => Promise<T>
): Promise<T> {
  const keyA = `vk_register:${input.vkUserId}`
  const keyB = `vk_register_email:${(input.email || "").toLowerCase()}`

  return pgConnection.transaction(async (trx) => {
    await trx.raw(
      `
        select pg_advisory_xact_lock(hashtext(?), hashtext(?))
      `,
      [keyA, keyB]
    )

    return callback()
  })
}

async function getVkIdCustomerByIdForUpdate(
  trx: PgTransactionLike,
  customerId: string
) {
  const rows = getRawRows<VkLinkableCustomerRecord>(
    await trx.raw(
      `
        select id, metadata
        from customer
        where id = ?
          and deleted_at is null
        for update
      `,
      [customerId]
    )
  )

  return rows[0] || null
}

async function listPotentialVkIdConflictCustomers(
  trx: PgTransactionLike,
  input: {
    currentCustomerId: string
    identity: VkResolvedIdentity
  }
) {
  return getRawRows<VkLinkableCustomerRecord>(
    await trx.raw(
      `
        select id, metadata
        from customer
        where id <> ?
          and deleted_at is null
          and (
            metadata->>'vk_peer_id' = ?
            or metadata->'vk_link'->>'vk_peer_id' = ?
            or metadata->'vk_link'->>'vk_user_id' = ?
          )
        for update
      `,
      [
        input.currentCustomerId,
        input.identity.vkPeerId,
        input.identity.vkPeerId,
        input.identity.vkUserId,
      ]
    )
  )
}

export async function persistVkIdCustomerLinkWithOwnershipGuard(
  pgConnection: PgConnectionLike,
  input: {
    customerId: string
    identity: VkResolvedIdentity
    verifiedAt: string
    linkSource?: string | null
  }
) {
  return pgConnection.transaction(async (trx) => {
    await acquireVkIdOwnershipLock(trx, input.identity)

    const customer = await getVkIdCustomerByIdForUpdate(trx, input.customerId)

    if (!customer) {
      throw new Error(
        `VK ID customer ${input.customerId} was not found during guarded link persistence`
      )
    }

    const customers = [
      customer,
      ...(await listPotentialVkIdConflictCustomers(trx, {
        currentCustomerId: customer.id,
        identity: input.identity,
      })),
    ]
    const mutation = planVkIdLinkMutation({
      currentCustomerId: customer.id,
      currentMetadata: customer.metadata,
      customers,
      identity: input.identity,
      verifiedAt: input.verifiedAt,
      linkSource: input.linkSource,
    })

    if (!mutation.metadata) {
      return mutation
    }

    await trx.raw(
      `
        update customer
        set metadata = ?::jsonb,
            updated_at = now()
        where id = ?
          and deleted_at is null
      `,
      [JSON.stringify(mutation.metadata), customer.id]
    )

    return mutation
  })
}

export type VkIdentityLookupResult =
  | { status: "not_found"; customer: null }
  | { status: "ok"; customer: VkLinkableCustomerRecord }
  | {
      status: "ambiguous"
      customer: null
      matches: Array<Pick<VkLinkableCustomerRecord, "id">>
    }

/**
 * Finds the customer that already owns the given VK identity. Used by the
 * login intent: we never create a customer here; the caller decides what to do
 * if no match is found.
 *
 * Returns `{ status: "ambiguous" }` when two or more distinct customers appear
 * to own the same VK identity. This is a data-integrity breach (the persist
 * path is guarded by an advisory lock and a conflict check), and the login
 * flow must refuse to pick a customer rather than silently authenticate the
 * first match.
 */
export function findVkIdentityCustomer(input: {
  customers: VkLinkableCustomerRecord[]
  identity: VkResolvedIdentity
}): VkIdentityLookupResult {
  const matches: VkLinkableCustomerRecord[] = []

  for (const customer of input.customers) {
    const linkState = resolveVkLinkState(customer.metadata)

    if (!linkState.isLinked) {
      continue
    }

    if (isSameVkIdentity(linkState, input.identity)) {
      matches.push(customer)
    }
  }

  if (matches.length === 0) {
    return { status: "not_found", customer: null }
  }

  if (matches.length === 1) {
    return { status: "ok", customer: matches[0] }
  }

  return {
    status: "ambiguous",
    customer: null,
    matches: matches.map((c) => ({ id: c.id })),
  }
}

/**
 * SQL-prefiltered lookup for the VK ID login flow. Replaces the previous
 * full-table scan through `listVkIdCustomers` followed by in-memory
 * `findVkIdentityCustomer`.
 *
 * Returns every customer whose metadata references the given VK identity, so
 * that the caller can still detect ambiguity with `findVkIdentityCustomer`
 * semantics on top of a much smaller result set.
 */
export async function findVkIdCustomersByIdentity(
  pgConnection: PgConnectionLike,
  identity: VkResolvedIdentity
): Promise<VkLinkableCustomerRecord[]> {
  return pgConnection.transaction(async (trx) => {
    return getRawRows<VkLinkableCustomerRecord>(
      await trx.raw(
        `
          select id, metadata
          from customer
          where deleted_at is null
            and (
              metadata->>'vk_peer_id' = ?
              or metadata->'vk_link'->>'vk_peer_id' = ?
              or metadata->'vk_link'->>'vk_user_id' = ?
            )
        `,
        [identity.vkPeerId, identity.vkPeerId, identity.vkUserId]
      )
    )
  })
}

export async function getVkIdCustomerByVkIdentity(
  query: QueryGraphLike,
  identity: VkResolvedIdentity
) {
  const customers = await listVkIdCustomers(query)

  return findVkIdentityCustomer({ customers, identity })
}

export function buildVkIdLoginErrorReturnUrl(input: {
  returnUrl: string | URL
  reason: string
}) {
  const url =
    input.returnUrl instanceof URL
      ? new URL(input.returnUrl.toString())
      : new URL(input.returnUrl)
  const sanitized = input.reason
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")

  url.searchParams.set("vk_login_error", sanitized || "vk_login_failed")
  return url
}

/**
 * Phase 5.2: success redirect marker for a fresh VK ID customer. We use a
 * dedicated query key (`vk_registered=success`) instead of overloading
 * `vk_login_error` so the storefront can render a different banner without
 * string-based switch on error codes.
 */
export function buildVkIdRegisteredReturnUrl(input: { returnUrl: string | URL }) {
  const url =
    input.returnUrl instanceof URL
      ? new URL(input.returnUrl.toString())
      : new URL(input.returnUrl)

  url.searchParams.set("vk_registered", "success")
  url.searchParams.delete("vk_login_error")

  return url
}

export async function persistVkIdCustomerMetadata(
  container: any,
  customerId: string,
  metadata: Record<string, unknown>
) {
  const { result } = await updateCustomersWorkflow(container).run({
    input: {
      selector: {
        id: [customerId],
      },
      update: {
        metadata,
      },
    },
  })

  return result
}

/**
 * Phase 5.2: lookup an existing customer by email for the VK ID register
 * branch. Used to detect the "email_exists" conflict before we try to
 * auto-create a customer and before we decide whether auto-linking is safe.
 *
 * Runs through raw SQL because the query module filter for `email` on the
 * `customer` entity is case-sensitive and does not cover soft-deleted rows
 * the way we want for this flow. We explicitly:
 *
 * - lower-case the input email and compare with `lower(email)` for
 *   case-insensitive match (Medusa stores email verbatim);
 * - skip soft-deleted customers (`deleted_at is null`);
 * - only return rows that `has_account = true`, because guest-customer rows
 *   carry the email without an auth identity and should not block VK
 *   registration.
 */
export async function lookupCustomerByEmail(
  pgConnection: PgConnectionLike,
  email: string
): Promise<VkLinkableCustomerRecord | null> {
  const trimmed = email.trim()

  if (!trimmed) {
    return null
  }

  return pgConnection.transaction(async (trx) => {
    const rows = getRawRows<VkLinkableCustomerRecord>(
      await trx.raw(
        `
          select id, metadata
          from customer
          where deleted_at is null
            and has_account = true
            and lower(email) = lower(?)
          limit 1
        `,
        [trimmed]
      )
    )

    return rows[0] || null
  })
}

export type VkIdCustomerCreationResult = {
  customerId: string
  authIdentityId: string
}

export type VkIdCustomerCreationErrorCode =
  | "auth_identity_creation_failed"
  | "customer_account_creation_failed"
  | "email_required"

export class VkIdCustomerCreationError extends Error {
  readonly code: VkIdCustomerCreationErrorCode

  constructor(code: VkIdCustomerCreationErrorCode, message?: string) {
    super(message || code)
    this.name = "VkIdCustomerCreationError"
    this.code = code
  }
}

/**
 * Phase 5.2: the password hash algorithm used by the emailpass auth provider.
 * We mirror the scrypt-kdf hash format (base64-encoded) so a backup emailpass
 * provider_identity created here can be both authenticated against and later
 * overwritten by the standard reset-password flow without triggering a
 * re-hash mismatch. We derive the same default scrypt parameters as
 * `@medusajs/auth-emailpass` to produce byte-identical outputs.
 */
async function hashEmailpassPassword(password: string): Promise<string> {
  const hashConfig = { logN: 15, r: 8, p: 1 }
  const derived = await scryptKdf.kdf(password, hashConfig)
  return derived.toString("base64")
}

/**
 * Phase 5.2 hardening: error details bubbled up from Medusa/auth modules can
 * contain the raw email address or other PII inside their `.message`. We keep
 * only the code channel by default and surface the underlying message solely
 * as an opaque `details_length` hint so operators can still distinguish
 * "empty failure" from "upstream threw". Use `sanitizeLogValue` from the
 * email-verification module for consistency with the rest of the codebase.
 */
function describeVkIdInternalError(error: unknown): {
  length: number
  name: string | null
} {
  if (!error) {
    return { length: 0, name: null }
  }

  if (error instanceof Error) {
    return { length: error.message?.length ?? 0, name: error.name || null }
  }

  const str = String(error)
  return { length: str.length, name: null }
}

/**
 * Phase 5.2: atomically creates the Medusa auth_identity + customer pair for
 * a fresh VK ID registration and persists the `vk_link` metadata.
 *
 * The sequence mirrors the emailpass register → createCustomerAccountWorkflow
 * pipeline but substitutes the provider:
 *
 *   1. AuthModule.createAuthIdentities with BOTH a `vk-id` and an `emailpass`
 *      provider_identity bound to a single auth_identity. The vk-id entry
 *      uses `entity_id = vkid:<vk_user_id>` and the emailpass entry uses the
 *      normalized email, so forgot-password / reset flows can target the
 *      customer the same way as native emailpass registrations.
 *   2. createCustomerAccountWorkflow to spawn the customer and link
 *      app_metadata.customer_id back onto the auth_identity.
 *   3. updateCustomersWorkflow to stamp `metadata.vk_link` +
 *      `metadata.email_verified*` so subsequent lookups find the customer
 *      through the established `findVkIdCustomersByIdentity` path and the
 *      email-verification subscriber recognises the customer as already
 *      verified (their email was vouched for by VK ID).
 *
 * Hardening (Phase 5.2.1):
 * - Normalizes the email in a single place (case-insensitive) so lookup,
 *   emailpass entity_id, metadata, and forgot-password flows agree.
 * - Seeds a random scrypt-hashed emailpass password so the emailpass provider
 *   identity is valid from day one. The customer never learns this password
 *   and must go through forgot-password / set-password to actually use
 *   email/password login.
 * - Runs an orphan-cleanup step if `createCustomerAccountWorkflow` throws,
 *   so retry attempts are not blocked by a unique-constraint violation on
 *   `provider_identities.entity_id`.
 * - Keeps error messages free of PII: we capture `code + length/name` only
 *   when rethrowing, so callers logging `error.message` do not leak emails.
 *
 * Phase 5.3 policy hook (`emailTrustPolicy`):
 * - `any` (default): stamp `email_verified=true` and skip the verification
 *   email — same behaviour as Phase 5.2. This is the MVP default.
 * - `require_verification`: stamp `email_verified=false` and omit the
 *   `email_verification.skipped_reason` marker, so the `customer.created`
 *   subscriber sends the transactional verification email as it would for
 *   any emailpass registration.
 *
 * TODO(Phase 5.4): Concurrent race window. Two VK callbacks for the same
 * `vk_user_id` or the same `email` can, in rare cases, interleave between
 * `lookupCustomerByEmail` and `createAuthIdentities` and both try to create
 * a customer. The unique constraint on `provider_identities.entity_id`
 * prevents two auth identities from being created, so only one request
 * wins the race at the auth layer. However, both can observe a
 * `not_found` branch in the register path and race to `createCustomer`,
 * leaving one of them to fail with a downstream uniqueness violation.
 * Staging traffic is low enough that this is acceptable; for production we
 * need a `pg_advisory_xact_lock(hashtext('vkid-register'), hashtext(email))`
 * or equivalent around the lookup + create pair. Emergency response for
 * duplicates is captured in `Docs/troubleshooting.md`.
 */
export async function createVkIdCustomer(
  container: MedusaContainer,
  input: {
    email: string
    firstName?: string | null
    lastName?: string | null
    identity: VkResolvedIdentity
    verifiedAt: string
    linkSource: string
    emailTrustPolicy?: VkIdEmailTrustPolicy
  }
): Promise<VkIdCustomerCreationResult> {
  // Fix #6: normalize the email exactly once. Medusa stores emails verbatim
  // but our lookups / forgot-password flows all use `lower(email)`, so any
  // mismatch here silently breaks flows for customers registered via VK.
  const normalizedEmail = normalizeNotificationRecipient(input.email)

  if (!normalizedEmail) {
    throw new VkIdCustomerCreationError("email_required")
  }

  const authModule = container.resolve<IAuthModuleService>(Modules.AUTH)
  const entityId = `vkid:${input.identity.vkUserId}`
  let authIdentityId: string

  // Fix #1: seed an emailpass provider_identity alongside the vk-id one so
  // forgot-password → reset-password works for VK-registered customers.
  const randomPassword = randomBytes(32).toString("base64url")
  let emailpassPasswordHash: string
  try {
    emailpassPasswordHash = await hashEmailpassPassword(randomPassword)
  } catch (error) {
    // Fix #9: no raw message — just the opaque details hint.
    const details = describeVkIdInternalError(error)
    throw new VkIdCustomerCreationError(
      "auth_identity_creation_failed",
      `emailpass_hash_failed:len=${details.length}:name=${details.name ?? "n/a"}`
    )
  }

  try {
    const authIdentity = await authModule.createAuthIdentities({
      provider_identities: [
        {
          provider: "vk-id",
          entity_id: entityId,
          user_metadata: {
            vk_user_id: input.identity.vkUserId,
            vk_peer_id: input.identity.vkPeerId,
            email: normalizedEmail,
            first_name: input.firstName || null,
            last_name: input.lastName || null,
          },
        },
        {
          provider: "emailpass",
          entity_id: normalizedEmail,
          provider_metadata: {
            password: emailpassPasswordHash,
          },
        },
      ],
    })

    authIdentityId = authIdentity.id
  } catch (error) {
    // Fix #9: capture length/name only — raw auth module errors occasionally
    // echo the email inside uniqueness-violation messages.
    const details = describeVkIdInternalError(error)
    throw new VkIdCustomerCreationError(
      "auth_identity_creation_failed",
      `auth_module_error:len=${details.length}:name=${details.name ?? "n/a"}`
    )
  }

  let customerId: string

  try {
    const { result: customer } = await createCustomerAccountWorkflow(
      container
    ).run({
      input: {
        authIdentityId,
        customerData: {
          email: normalizedEmail,
          first_name: input.firstName || undefined,
          last_name: input.lastName || undefined,
        },
      },
    })

    customerId = customer.id
  } catch (error) {
    // Fix #3: compensation — remove the orphan auth_identity so a retry is not
    // blocked by unique-constraint on provider_identities.entity_id. We MUST
    // NOT rethrow the inner delete error, since that would mask the original
    // failure; we log it as a structured warning for operators instead.
    try {
      await authModule.deleteAuthIdentities([authIdentityId])
    } catch (cleanupError) {
      const details = describeVkIdInternalError(cleanupError)
      console.error("[vk-id] orphan auth_identity cleanup failed", {
        auth_identity_id: authIdentityId,
        entity_id_prefix: "vkid:",
        error_name: details.name,
        error_length: details.length,
      })
    }

    const details = describeVkIdInternalError(error)
    throw new VkIdCustomerCreationError(
      "customer_account_creation_failed",
      `customer_workflow_error:len=${details.length}:name=${details.name ?? "n/a"}`
    )
  }

  // Stamp the vk_link metadata so `findVkIdCustomersByIdentity` can locate
  // this customer on the next login. We build the metadata via the existing
  // helper to keep the shape identical to the Phase 5.0 linking path.
  //
  // Fix #2: also stamp `email_verified=true` + `email_verified_for` so the
  // `customer.created` subscriber skips the verification email — VK ID
  // already vouched for this email.
  const linkMetadata = buildLinkedMetadata({
    currentMetadata: {},
    currentLink: resolveVkLinkState({}),
    identity: input.identity,
    verifiedAt: input.verifiedAt,
    linkSource: input.linkSource,
  })

  // Phase 5.3: the email trust policy decides whether we mark the email as
  // verified and skip the transactional verification email. `any` keeps the
  // Phase 5.2 shortcut; `require_verification` forces the subscriber to send
  // the verification email so a VK-provided email still has to be confirmed.
  const trustPolicy: VkIdEmailTrustPolicy = input.emailTrustPolicy ?? "any"
  const emailVerifiedFlag = trustPolicy !== "require_verification"

  const verifiedMetadata: Record<string, unknown> = {
    ...linkMetadata,
    [EMAIL_VERIFICATION_FLAG_METADATA_KEY]: emailVerifiedFlag,
    [EMAIL_VERIFICATION_AT_METADATA_KEY]: emailVerifiedFlag
      ? input.verifiedAt
      : null,
    [EMAIL_VERIFICATION_FOR_METADATA_KEY]: emailVerifiedFlag
      ? normalizedEmail
      : null,
    [EMAIL_VERIFICATION_METADATA_KEY]: emailVerifiedFlag
      ? {
          source: "vk_id_register",
          verified_at: input.verifiedAt,
          verified_for: normalizedEmail,
          skipped_reason: "vk_registered",
        }
      : null,
  }

  await persistVkIdCustomerMetadata(container, customerId, verifiedMetadata)

  return {
    customerId,
    authIdentityId,
  }
}
