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
const DEFAULT_LOCAL_STOREFRONT_ORIGIN = "http://localhost:8000"

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
   * Phase 5.2: when `true` (default), refuse to auto-create a customer if
   * VK did not return an email. Falling back to `?vk_login_error=email_required`
   * is the safer default — it avoids synthesizing placeholder emails and
   * keeps password reset / transactional email paths functional.
   */
  requireEmail: boolean
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
 * Default-true boolean env flag. Only an explicit `"false"` disables the
 * feature; unset, empty, or any unknown value is treated as `true`. Used by
 * `VK_ID_REQUIRE_EMAIL` so forgetting to set it does not silently drop the
 * email safety guard.
 */
function normalizeBooleanFlagDefaultTrue(value?: string | null) {
  return value?.trim().toLowerCase() !== "false"
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

function buildSignedState(payload: VkIdLinkSessionPayload) {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  const signature = signPayload(encodedPayload)

  return `${encodedPayload}.${signature}`
}

function verifySignedState(state: string) {
  const [encodedPayload, providedSignature] = state.split(".")

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
  const requireEmail = normalizeBooleanFlagDefaultTrue(
    process.env.VK_ID_REQUIRE_EMAIL
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
    requireEmail,
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

  const verifiedMetadata: Record<string, unknown> = {
    ...linkMetadata,
    [EMAIL_VERIFICATION_FLAG_METADATA_KEY]: true,
    [EMAIL_VERIFICATION_AT_METADATA_KEY]: input.verifiedAt,
    [EMAIL_VERIFICATION_FOR_METADATA_KEY]: normalizedEmail,
    [EMAIL_VERIFICATION_METADATA_KEY]: {
      source: "vk_id_register",
      verified_at: input.verifiedAt,
      verified_for: normalizedEmail,
      skipped_reason: "vk_registered",
    },
  }

  await persistVkIdCustomerMetadata(container, customerId, verifiedMetadata)

  return {
    customerId,
    authIdentityId,
  }
}
