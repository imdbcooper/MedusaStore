import { updateCustomersWorkflow } from "@medusajs/medusa/core-flows"
import { normalizeNotificationRecipient } from "./notification-email"
import { normalizeSmsPhone } from "./notification-sms"
import { resolveCustomerVkPeerId } from "./notification-vk"

export const MARKETING_PREFERENCES_VERSION = 1 as const
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
      },
      sms: {
        status: resolveDefaultChannelStatus(bindings.sms),
        updated_at: null,
        source: null,
        recipient_snapshot: bindings.sms.recipient_snapshot,
      },
      vk: {
        status: resolveDefaultChannelStatus(bindings.vk),
        updated_at: null,
        source: null,
        recipient_snapshot: bindings.vk.recipient_snapshot,
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
