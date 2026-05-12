import { createHash, randomBytes, timingSafeEqual } from "crypto"
import { updateCustomersWorkflow } from "@medusajs/medusa/core-flows"
import { normalizeNotificationRecipient } from "./notification-email"
import { normalizeSmsPhone } from "./notification-sms"
import { resolveCustomerVkPeerId } from "./notification-vk"

export const MARKETING_PREFERENCES_VERSION = 1 as const
export const DEFAULT_MARKETING_DOUBLE_OPTIN_TOKEN_TTL_DAYS = 7
export const MARKETING_CHANNEL_CONFIRMATION_FAILURE_REASONS = [
  "invalid_token_format",
  "customer_not_found",
  "token_mismatch",
  "token_expired",
  "token_already_consumed",
  "token_missing",
  "channel_not_pending",
] as const

export type MarketingChannelConfirmationFailureReason =
  (typeof MARKETING_CHANNEL_CONFIRMATION_FAILURE_REASONS)[number]

export type MarketingDoubleOptinRuntime = {
  tokenTtlDays: number
}
export const MARKETING_GLOBAL_STATUS_VALUES = [
  "subscribed",
  "unsubscribed",
] as const
export const MARKETING_CHANNELS = ["email", "sms", "vk"] as const
export const MARKETING_CHANNEL_STATUS_VALUES = [
  "subscribed",
  "unsubscribed",
  "pending",
  "unavailable",
] as const
export const MARKETING_MUTABLE_CHANNEL_STATUS_VALUES = [
  "subscribed",
  "unsubscribed",
] as const
export const DEFAULT_MARKETING_SOURCE = "system"
export const STOREFRONT_MARKETING_SOURCE = "storefront"
export const ADMIN_MARKETING_SOURCE = "admin"

export type MarketingGlobalStatus =
  (typeof MARKETING_GLOBAL_STATUS_VALUES)[number]
export type MarketingChannel = (typeof MARKETING_CHANNELS)[number]
export type MarketingChannelStatus =
  (typeof MARKETING_CHANNEL_STATUS_VALUES)[number]
export type MutableMarketingChannelStatus =
  (typeof MARKETING_MUTABLE_CHANNEL_STATUS_VALUES)[number]

export type MarketingRecipientSnapshot = Record<string, unknown> | null

export type MarketingChannelPreferences = {
  status: MarketingChannelStatus
  updated_at: string | null
  source: string | null
  recipient_snapshot: MarketingRecipientSnapshot
  requested_at: string | null
  confirmed_at: string | null
  unsubscribed_at: string | null
  confirmation_token_hash: string | null
  confirmation_expires_at: string | null
}

export type MarketingPreferences = {
  version: typeof MARKETING_PREFERENCES_VERSION
  global_status: MarketingGlobalStatus
  channels: Record<MarketingChannel, MarketingChannelPreferences>
  segments: string[]
  suppressed_until: string | null
  last_marketing_sent_at: string | null
}

export type MarketingChannelBinding = {
  available: boolean
  recipient: string | null
  recipient_snapshot: MarketingRecipientSnapshot
}

export type MarketingBindings = Record<MarketingChannel, MarketingChannelBinding>

export type MarketingCustomerRecord = {
  id: string
  email?: string | null
  phone?: string | null
  metadata?: unknown
}

export type MarketingPreferencesResolution = {
  preferences: MarketingPreferences
  bindings: MarketingBindings
}

export type MarketingPreferencesUpdateInput = {
  global_status?: MarketingGlobalStatus | null
  channels?: Partial<
    Record<
      MarketingChannel,
      {
        status?: MarketingChannelStatus | null
      }
    >
  >
  source?: string | null
  updated_at?: string | null
}

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

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {}
}

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function normalizeIsoDate(value: unknown) {
  const normalized = normalizeString(value)

  if (!normalized) {
    return null
  }

  const date = new Date(normalized)

  return Number.isNaN(date.getTime()) ? normalized : date.toISOString()
}

function isMarketingGlobalStatus(value: unknown): value is MarketingGlobalStatus {
  return (
    typeof value === "string" &&
    (MARKETING_GLOBAL_STATUS_VALUES as readonly string[]).includes(value.trim())
  )
}

function normalizeMarketingGlobalStatus(
  value: unknown
): MarketingGlobalStatus | null {
  return isMarketingGlobalStatus(value) ? (value.trim() as MarketingGlobalStatus) : null
}

function isMarketingChannelStatus(
  value: unknown
): value is MarketingChannelStatus {
  return (
    typeof value === "string" &&
    (MARKETING_CHANNEL_STATUS_VALUES as readonly string[]).includes(value.trim())
  )
}

function normalizeMarketingChannelStatus(
  value: unknown
): MarketingChannelStatus | null {
  return isMarketingChannelStatus(value)
    ? (value.trim() as MarketingChannelStatus)
    : null
}

function isMutableMarketingChannelStatus(
  value: unknown
): value is MutableMarketingChannelStatus {
  return (
    typeof value === "string" &&
    (MARKETING_MUTABLE_CHANNEL_STATUS_VALUES as readonly string[]).includes(
      value.trim()
    )
  )
}

function normalizeMutableMarketingChannelStatus(
  value: unknown
): MutableMarketingChannelStatus | null {
  return isMutableMarketingChannelStatus(value)
    ? (value.trim() as MutableMarketingChannelStatus)
    : null
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return Array.from(
    new Set(
      value
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter(Boolean)
    )
  )
}

function normalizeSource(value: unknown) {
  return normalizeString(value)
}

function createRecipientSnapshot(
  channel: MarketingChannel,
  recipient: string | null
): MarketingRecipientSnapshot {
  if (!recipient) {
    return null
  }

  if (channel === "email") {
    return { email: recipient }
  }

  if (channel === "sms") {
    return { phone: recipient }
  }

  return {
    vk_peer_id: recipient,
    linked: true,
  }
}

function isSameSnapshot(
  left: MarketingRecipientSnapshot,
  right: MarketingRecipientSnapshot
) {
  return JSON.stringify(left || null) === JSON.stringify(right || null)
}

export function resolveMarketingBindings(
  customer?: Pick<MarketingCustomerRecord, "email" | "phone" | "metadata"> | null
): MarketingBindings {
  const metadata = customer?.metadata
  const emailRecipient = normalizeNotificationRecipient(customer?.email)
  const smsRecipient = normalizeSmsPhone(customer?.phone)
  const vkRecipient = resolveCustomerVkPeerId(metadata)

  return {
    email: {
      available: Boolean(emailRecipient),
      recipient: emailRecipient,
      recipient_snapshot: createRecipientSnapshot("email", emailRecipient),
    },
    sms: {
      available: Boolean(smsRecipient),
      recipient: smsRecipient,
      recipient_snapshot: createRecipientSnapshot("sms", smsRecipient),
    },
    vk: {
      available: Boolean(vkRecipient),
      recipient: vkRecipient,
      recipient_snapshot: createRecipientSnapshot("vk", vkRecipient),
    },
  }
}

function resolveDefaultChannelStatus(binding: MarketingChannelBinding) {
  return binding.available ? "subscribed" : "unavailable"
}

function resolveNextChannelStatus(args: {
  currentStatus: MarketingChannelStatus | null
  requestedStatus?: MarketingChannelStatus | null
  binding: MarketingChannelBinding
}): MarketingChannelStatus {
  const { currentStatus, requestedStatus, binding } = args

  if (requestedStatus) {
    if (requestedStatus === "subscribed" && !binding.available) {
      return "unavailable"
    }

    return requestedStatus
  }

  if (!binding.available) {
    if (currentStatus === "unsubscribed" || currentStatus === "pending") {
      return currentStatus
    }

    return "unavailable"
  }

  if (!currentStatus || currentStatus === "unavailable") {
    return "subscribed"
  }

  return currentStatus
}

export function resolveMarketingPreferences(
  metadata?: unknown,
  customer?: Pick<MarketingCustomerRecord, "email" | "phone" | "metadata"> | null
): MarketingPreferencesResolution {
  const rootMetadata = asRecord(metadata)
  const marketing = asRecord(rootMetadata.marketing)
  const channels = asRecord(marketing.channels)
  const bindings = resolveMarketingBindings(customer || { metadata })

  const preferences: MarketingPreferences = {
    version: MARKETING_PREFERENCES_VERSION,
    global_status:
      normalizeMarketingGlobalStatus(marketing.global_status) || "subscribed",
    channels: {
      email: {
        status: resolveDefaultChannelStatus(bindings.email),
        updated_at: null,
        source: null,
        recipient_snapshot: bindings.email.recipient_snapshot,
        requested_at: null,
        confirmed_at: null,
        unsubscribed_at: null,
        confirmation_token_hash: null,
        confirmation_expires_at: null,
      },
      sms: {
        status: resolveDefaultChannelStatus(bindings.sms),
        updated_at: null,
        source: null,
        recipient_snapshot: bindings.sms.recipient_snapshot,
        requested_at: null,
        confirmed_at: null,
        unsubscribed_at: null,
        confirmation_token_hash: null,
        confirmation_expires_at: null,
      },
      vk: {
        status: resolveDefaultChannelStatus(bindings.vk),
        updated_at: null,
        source: null,
        recipient_snapshot: bindings.vk.recipient_snapshot,
        requested_at: null,
        confirmed_at: null,
        unsubscribed_at: null,
        confirmation_token_hash: null,
        confirmation_expires_at: null,
      },
    },
    segments: normalizeStringArray(marketing.segments),
    suppressed_until: normalizeIsoDate(marketing.suppressed_until),
    last_marketing_sent_at: normalizeIsoDate(marketing.last_marketing_sent_at),
  }

  for (const channel of MARKETING_CHANNELS) {
    const currentChannel = asRecord(channels[channel])
    const currentStatus = normalizeMarketingChannelStatus(currentChannel.status)

    preferences.channels[channel] = {
      status: resolveNextChannelStatus({
        currentStatus,
        binding: bindings[channel],
      }),
      updated_at: normalizeIsoDate(currentChannel.updated_at),
      source: normalizeSource(currentChannel.source),
      recipient_snapshot:
        asRecord(currentChannel.recipient_snapshot) &&
        Object.keys(asRecord(currentChannel.recipient_snapshot)).length
          ? asRecord(currentChannel.recipient_snapshot)
          : bindings[channel].recipient_snapshot,
      requested_at: normalizeIsoDate(currentChannel.requested_at),
      confirmed_at: normalizeIsoDate(currentChannel.confirmed_at),
      unsubscribed_at: normalizeIsoDate(currentChannel.unsubscribed_at),
      confirmation_token_hash: normalizeString(
        currentChannel.confirmation_token_hash
      ),
      confirmation_expires_at: normalizeIsoDate(
        currentChannel.confirmation_expires_at
      ),
    }
  }

  return {
    preferences,
    bindings,
  }
}

export function buildCustomerMarketingMetadata(
  customer: MarketingCustomerRecord,
  input: MarketingPreferencesUpdateInput
): Record<string, unknown> {
  const currentMetadata = asRecord(customer.metadata)
  const currentResolution = resolveMarketingPreferences(customer.metadata, customer)
  const currentMarketing = currentResolution.preferences
  const bindings = currentResolution.bindings
  const source = input.source?.trim() || DEFAULT_MARKETING_SOURCE
  const updatedAt = normalizeIsoDate(input.updated_at) || new Date().toISOString()

  const nextMarketing: MarketingPreferences = {
    ...currentMarketing,
    global_status:
      input.global_status && isMarketingGlobalStatus(input.global_status)
        ? input.global_status
        : currentMarketing.global_status,
    channels: {
      email: { ...currentMarketing.channels.email },
      sms: { ...currentMarketing.channels.sms },
      vk: { ...currentMarketing.channels.vk },
    },
  }

  for (const channel of MARKETING_CHANNELS) {
    const currentChannel = currentMarketing.channels[channel]
    const requestedStatus = input.channels?.[channel]?.status
    const binding = bindings[channel]
    const mutableRequestedStatus = normalizeMutableMarketingChannelStatus(
      requestedStatus
    )
    const nextStatus = resolveNextChannelStatus({
      currentStatus: currentChannel.status,
      requestedStatus: mutableRequestedStatus,
      binding,
    })
    const nextSnapshot = binding.recipient_snapshot
    const statusChanged = currentChannel.status !== nextStatus
    const snapshotChanged = !isSameSnapshot(
      currentChannel.recipient_snapshot,
      nextSnapshot
    )

    // Double opt-in bookkeeping:
    // - transitioning a channel to "subscribed" via this helper bypasses
    //   double opt-in (admin override / explicit confirmation already
    //   happened elsewhere); clears confirmation token state.
    // - transitioning to "pending" preserves existing requested_at/token.
    // - transitioning to "unsubscribed" stamps unsubscribed_at and clears
    //   confirmation token state.
    let nextRequestedAt = currentChannel.requested_at
    let nextConfirmedAt = currentChannel.confirmed_at
    let nextUnsubscribedAt = currentChannel.unsubscribed_at
    let nextConfirmationTokenHash = currentChannel.confirmation_token_hash
    let nextConfirmationExpiresAt = currentChannel.confirmation_expires_at

    if (statusChanged) {
      if (nextStatus === "subscribed") {
        nextConfirmedAt = updatedAt
        nextConfirmationTokenHash = null
        nextConfirmationExpiresAt = null
      } else if (nextStatus === "unsubscribed") {
        nextUnsubscribedAt = updatedAt
        nextConfirmationTokenHash = null
        nextConfirmationExpiresAt = null
      } else if (nextStatus === "unavailable") {
        nextConfirmationTokenHash = null
        nextConfirmationExpiresAt = null
      }
    }

    nextMarketing.channels[channel] = {
      status: nextStatus,
      updated_at:
        statusChanged || snapshotChanged
          ? updatedAt
          : currentChannel.updated_at,
      source:
        statusChanged || snapshotChanged
          ? source
          : currentChannel.source,
      recipient_snapshot: nextSnapshot,
      requested_at: nextRequestedAt,
      confirmed_at: nextConfirmedAt,
      unsubscribed_at: nextUnsubscribedAt,
      confirmation_token_hash: nextConfirmationTokenHash,
      confirmation_expires_at: nextConfirmationExpiresAt,
    }
  }

  return {
    ...currentMetadata,
    marketing: nextMarketing,
  }
}

export function applyMarketingSendMetadataUpdate(
  customer: MarketingCustomerRecord,
  sentAt: string
): Record<string, unknown> {
  const currentMetadata = asRecord(customer.metadata)
  const currentResolution = resolveMarketingPreferences(customer.metadata, customer)

  return {
    ...currentMetadata,
    marketing: {
      ...currentResolution.preferences,
      last_marketing_sent_at: normalizeIsoDate(sentAt) || sentAt,
    },
  }
}

export async function persistCustomerMarketingMetadata(
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

export async function getMarketingCustomerById(
  query: QueryGraphLike,
  customerId: string
) {
  const { data } = await query.graph<MarketingCustomerRecord>({
    entity: "customer",
    fields: ["id", "email", "phone", "metadata"],
    filters: {
      id: customerId,
    },
  })

  return data[0] || null
}

export async function listMarketingCustomers(
  query: QueryGraphLike,
  pagination?: { take?: number; skip?: number }
) {
  return await query.graph<MarketingCustomerRecord>({
    entity: "customer",
    fields: ["id", "email", "phone", "metadata"],
    pagination: {
      take: pagination?.take || 100,
      skip: pagination?.skip || 0,
    },
  })
}

export function isCustomerGloballySubscribed(preferences: MarketingPreferences) {
  return preferences.global_status !== "unsubscribed"
}

export function isCustomerChannelSubscribed(
  preferences: MarketingPreferences,
  channel: MarketingChannel
) {
  return preferences.channels[channel].status === "subscribed"
}

export function isMarketingSuppressedNow(
  preferences: MarketingPreferences,
  now = new Date()
) {
  if (!preferences.suppressed_until) {
    return false
  }

  const suppressedUntil = new Date(preferences.suppressed_until)

  return !Number.isNaN(suppressedUntil.getTime()) && suppressedUntil > now
}

export function getMarketingDoubleOptinRuntime(): MarketingDoubleOptinRuntime {
  const raw = process.env.MARKETING_DOUBLE_OPTIN_TOKEN_TTL_DAYS
  const fallback = DEFAULT_MARKETING_DOUBLE_OPTIN_TOKEN_TTL_DAYS

  if (typeof raw === "string" && raw.trim()) {
    const parsed = Number(raw.trim())

    if (Number.isFinite(parsed) && parsed > 0) {
      return { tokenTtlDays: Math.floor(parsed) }
    }
  }

  return { tokenTtlDays: fallback }
}

function base64UrlEncode(value: Buffer): string {
  return value
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")
}

export function generateConfirmationToken(byteLength = 32): string {
  if (!Number.isInteger(byteLength) || byteLength < 16) {
    throw new Error(
      "Confirmation token byte length must be an integer >= 16"
    )
  }

  return base64UrlEncode(randomBytes(byteLength))
}

export function hashConfirmationToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex")
}

export function buildPublicConfirmationToken(
  customerId: string,
  channel: MarketingChannel,
  rawToken: string
): string {
  const normalizedId = customerId.trim()

  if (!normalizedId) {
    throw new Error("Customer id is required to build a confirmation token")
  }

  if (!rawToken) {
    throw new Error("Raw token is required to build a confirmation token")
  }

  if (normalizedId.includes(".")) {
    throw new Error(
      "Customer id must not contain '.' character for confirmation token encoding"
    )
  }

  if (channel.includes(".")) {
    throw new Error(
      "Channel must not contain '.' character for confirmation token encoding"
    )
  }

  return `${normalizedId}.${channel}.${rawToken}`
}

export type ConfirmationTokenParseResult =
  | {
      ok: true
      customerId: string
      channel: MarketingChannel
      rawToken: string
    }
  | { ok: false; reason: "invalid_token_format" }

export function parsePublicConfirmationToken(
  token: string | null | undefined
): ConfirmationTokenParseResult {
  if (typeof token !== "string") {
    return { ok: false, reason: "invalid_token_format" }
  }

  const trimmed = token.trim()

  if (!trimmed) {
    return { ok: false, reason: "invalid_token_format" }
  }

  const firstSeparator = trimmed.indexOf(".")

  if (firstSeparator <= 0 || firstSeparator === trimmed.length - 1) {
    return { ok: false, reason: "invalid_token_format" }
  }

  const customerId = trimmed.slice(0, firstSeparator)
  const rest = trimmed.slice(firstSeparator + 1)
  const secondSeparator = rest.indexOf(".")

  if (secondSeparator <= 0 || secondSeparator === rest.length - 1) {
    return { ok: false, reason: "invalid_token_format" }
  }

  const channelRaw = rest.slice(0, secondSeparator).trim().toLowerCase()
  const rawToken = rest.slice(secondSeparator + 1)

  if (!customerId || !rawToken || !channelRaw) {
    return { ok: false, reason: "invalid_token_format" }
  }

  if (!(MARKETING_CHANNELS as readonly string[]).includes(channelRaw)) {
    return { ok: false, reason: "invalid_token_format" }
  }

  return {
    ok: true,
    customerId,
    channel: channelRaw as MarketingChannel,
    rawToken,
  }
}

export function secureConfirmationHashEquals(
  left: string,
  right: string
): boolean {
  if (left.length !== right.length) {
    return false
  }

  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }

  try {
    return timingSafeEqual(leftBuffer, rightBuffer)
  } catch {
    return false
  }
}

export type VerifyConfirmationTokenResult =
  | {
      ok: true
      customerId: string
      channel: MarketingChannel
    }
  | {
      ok: false
      reason: MarketingChannelConfirmationFailureReason
      customerId?: string
      channel?: MarketingChannel
    }

export function verifyConfirmationToken(input: {
  customer: MarketingCustomerRecord
  channel: MarketingChannel
  rawToken: string
  now?: Date
}): VerifyConfirmationTokenResult {
  const { customer, channel, rawToken } = input
  const now = input.now ? new Date(input.now) : new Date()
  const resolution = resolveMarketingPreferences(customer.metadata, customer)
  const channelState = resolution.preferences.channels[channel]

  if (!channelState.confirmation_token_hash) {
    return {
      ok: false,
      reason: "token_missing",
      customerId: customer.id,
      channel,
    }
  }

  if (channelState.status !== "pending") {
    return {
      ok: false,
      reason: "channel_not_pending",
      customerId: customer.id,
      channel,
    }
  }

  if (channelState.confirmation_expires_at) {
    const expiresAt = new Date(channelState.confirmation_expires_at)

    if (
      !Number.isNaN(expiresAt.getTime()) &&
      expiresAt.getTime() <= now.getTime()
    ) {
      return {
        ok: false,
        reason: "token_expired",
        customerId: customer.id,
        channel,
      }
    }
  }

  const providedHash = hashConfirmationToken(rawToken)

  if (!secureConfirmationHashEquals(providedHash, channelState.confirmation_token_hash)) {
    return {
      ok: false,
      reason: "token_mismatch",
      customerId: customer.id,
      channel,
    }
  }

  return {
    ok: true,
    customerId: customer.id,
    channel,
  }
}

/**
 * Build customer.metadata with a given channel transitioned to state
 * `pending` and a fresh confirmation token hash stored. Used by the
 * sendMarketingConfirmation workflow.
 */
export function buildChannelPendingMetadata(input: {
  customer: MarketingCustomerRecord
  channel: MarketingChannel
  tokenHash: string
  now?: Date
  ttlDays?: number
  source?: string | null
}): Record<string, unknown> {
  const currentMetadata = asRecord(input.customer.metadata)
  const currentResolution = resolveMarketingPreferences(
    input.customer.metadata,
    input.customer
  )
  const bindings = currentResolution.bindings
  const now = input.now ? new Date(input.now) : new Date()
  const nowIso = now.toISOString()
  const ttlDays =
    typeof input.ttlDays === "number" && input.ttlDays > 0
      ? Math.floor(input.ttlDays)
      : DEFAULT_MARKETING_DOUBLE_OPTIN_TOKEN_TTL_DAYS
  const expiresAt = new Date(
    now.getTime() + ttlDays * 24 * 60 * 60 * 1000
  ).toISOString()
  const source = input.source?.trim() || DEFAULT_MARKETING_SOURCE

  const nextMarketing: MarketingPreferences = {
    ...currentResolution.preferences,
    channels: {
      email: { ...currentResolution.preferences.channels.email },
      sms: { ...currentResolution.preferences.channels.sms },
      vk: { ...currentResolution.preferences.channels.vk },
    },
  }

  const previousChannel = nextMarketing.channels[input.channel]
  const binding = bindings[input.channel]

  nextMarketing.channels[input.channel] = {
    ...previousChannel,
    status: binding.available ? "pending" : "unavailable",
    updated_at: nowIso,
    source,
    recipient_snapshot: binding.recipient_snapshot,
    requested_at: nowIso,
    confirmation_token_hash: input.tokenHash.trim(),
    confirmation_expires_at: expiresAt,
  }

  return {
    ...currentMetadata,
    marketing: nextMarketing,
  }
}

/**
 * Build customer.metadata with a given channel confirmed. Clears
 * confirmation token state and sets confirmed_at.
 */
export function buildChannelConfirmedMetadata(input: {
  customer: MarketingCustomerRecord
  channel: MarketingChannel
  now?: Date
  source?: string | null
}): Record<string, unknown> {
  const currentMetadata = asRecord(input.customer.metadata)
  const currentResolution = resolveMarketingPreferences(
    input.customer.metadata,
    input.customer
  )
  const now = input.now ? new Date(input.now) : new Date()
  const nowIso = now.toISOString()
  const source = input.source?.trim() || DEFAULT_MARKETING_SOURCE

  const nextMarketing: MarketingPreferences = {
    ...currentResolution.preferences,
    channels: {
      email: { ...currentResolution.preferences.channels.email },
      sms: { ...currentResolution.preferences.channels.sms },
      vk: { ...currentResolution.preferences.channels.vk },
    },
  }

  const previousChannel = nextMarketing.channels[input.channel]

  nextMarketing.channels[input.channel] = {
    ...previousChannel,
    status: "subscribed",
    updated_at: nowIso,
    source,
    confirmed_at: nowIso,
    unsubscribed_at: null,
    confirmation_token_hash: null,
    confirmation_expires_at: null,
  }

  return {
    ...currentMetadata,
    marketing: nextMarketing,
  }
}

/**
 * Build customer.metadata with a given channel unsubscribed. Clears
 * confirmation token state and sets unsubscribed_at.
 */
export function buildChannelUnsubscribedMetadata(input: {
  customer: MarketingCustomerRecord
  channel: MarketingChannel
  now?: Date
  source?: string | null
}): Record<string, unknown> {
  const currentMetadata = asRecord(input.customer.metadata)
  const currentResolution = resolveMarketingPreferences(
    input.customer.metadata,
    input.customer
  )
  const now = input.now ? new Date(input.now) : new Date()
  const nowIso = now.toISOString()
  const source = input.source?.trim() || DEFAULT_MARKETING_SOURCE

  const nextMarketing: MarketingPreferences = {
    ...currentResolution.preferences,
    channels: {
      email: { ...currentResolution.preferences.channels.email },
      sms: { ...currentResolution.preferences.channels.sms },
      vk: { ...currentResolution.preferences.channels.vk },
    },
  }

  const previousChannel = nextMarketing.channels[input.channel]

  nextMarketing.channels[input.channel] = {
    ...previousChannel,
    status: "unsubscribed",
    updated_at: nowIso,
    source,
    unsubscribed_at: nowIso,
    confirmation_token_hash: null,
    confirmation_expires_at: null,
  }

  return {
    ...currentMetadata,
    marketing: nextMarketing,
  }
}

export function sanitizeMarketingLogValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "n/a"
  }

  const normalized = String(value).trim()

  if (!normalized) {
    return "n/a"
  }

  return normalized.replace(/[\r\n]+/g, " ").slice(0, 120)
}
