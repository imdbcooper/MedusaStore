import { updateCustomersWorkflow } from "@medusajs/medusa/core-flows"
import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto"
import { normalizeVkPeerId } from "./notification-vk"

export const DEFAULT_VK_ID_SCOPES = "vkid.personal_info"
export const DEFAULT_VK_ID_AUTHORIZE_URL = "https://id.vk.ru/authorize"
export const DEFAULT_VK_ID_TOKEN_URL = "https://id.vk.ru/oauth2/auth"
export const DEFAULT_VK_ID_USER_INFO_URL = "https://id.vk.ru/oauth2/user_info"
export const DEFAULT_VK_ID_LINK_SOURCE = "storefront.account.profile"
export const DEFAULT_VK_ID_LINK_SESSION_TTL_SECONDS = 10 * 60
export const DEFAULT_VK_ID_PROFILE_PATH = "/ru/account/profile"
const DEFAULT_LOCAL_STOREFRONT_ORIGIN = "http://localhost:8000"

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
}

export type VkIdLinkSession = VkIdLinkSessionPayload & {
  state: string
  codeChallenge: string
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

function getVkIdSessionSecret() {
  return (
    normalizeOptionalString(process.env.VK_ID_SESSION_SECRET) ||
    normalizeOptionalString(process.env.JWT_SECRET) ||
    normalizeOptionalString(process.env.COOKIE_SECRET) ||
    "supersecret"
  )
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
  const clientId = normalizeOptionalString(process.env.VK_ID_CLIENT_ID)
  const clientSecret = normalizeOptionalString(process.env.VK_ID_CLIENT_SECRET)
  const redirectUri = normalizeOptionalString(process.env.VK_ID_REDIRECT_URI)
  const scopes =
    normalizeOptionalString(process.env.VK_ID_SCOPES) || DEFAULT_VK_ID_SCOPES
  const configured = requestedEnabled && Boolean(clientId && redirectUri)

  return {
    requestedEnabled,
    enabled: configured,
    configured,
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

export function resolveAllowedVkIdReturnUrl(requestedUrl?: string | null) {
  const allowedOrigins = getAllowedStorefrontOrigins()

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
    return new URL(DEFAULT_VK_ID_PROFILE_PATH, defaultOrigin)
  }

  if (allowLocalStorefrontFallback()) {
    return new URL(DEFAULT_VK_ID_PROFILE_PATH, DEFAULT_LOCAL_STOREFRONT_ORIGIN)
  }

  throw new Error(
    "VK ID storefront return origin is not configured. Set VK_ID_STOREFRONT_RETURN_ORIGINS or STORE_CORS."
  )
}

export function createVkIdLinkSession(input: {
  customerId: string
  returnUrl: string
  linkSource?: string | null
  ttlSeconds?: number
}) {
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
      input.linkSource?.trim() ||
      DEFAULT_VK_ID_LINK_SOURCE,
  }

  return {
    ...payload,
    state: buildSignedState(payload),
    codeChallenge: createCodeChallenge(codeVerifier),
  } satisfies VkIdLinkSession
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

  return {
    provider: "vkid",
    vkUserId,
    vkPeerId,
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
