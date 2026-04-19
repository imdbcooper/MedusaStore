import { randomUUID } from "crypto"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  MARKETING_CHANNELS,
  type MarketingChannel,
  type MarketingCustomerRecord,
  type MarketingPreferencesResolution,
  resolveMarketingPreferences,
} from "./marketing-preferences"

export const MARKETING_CAMPAIGN_AUDIENCE_TYPES = [
  "all",
  "email_consent",
  "sms_consent",
  "vk_consent",
  "vk_linked",
  "manual",
] as const
export const MARKETING_CAMPAIGN_STATUSES = [
  "draft",
  "running",
  "completed",
  "failed",
] as const
export const MARKETING_DELIVERY_STATUSES = [
  "sent",
  "skipped",
  "failed",
] as const
export const DEFAULT_MARKETING_FREQUENCY_CAP_WINDOW_HOURS = 24
export const DEFAULT_MARKETING_FREQUENCY_CAP_COUNT = 1
export const DEFAULT_MARKETING_TRIGGER_TYPE =
  "marketing.campaign.manual_send_requested"
export const DEFAULT_MARKETING_RESOURCE_TYPE = "marketing_campaign"

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
  raw: <T = unknown>(sql: string, bindings?: unknown[]) => Promise<RawSqlRowsResult<T>>
}

export type MarketingCampaignAudienceType =
  (typeof MARKETING_CAMPAIGN_AUDIENCE_TYPES)[number]
export type MarketingCampaignStatus =
  (typeof MARKETING_CAMPAIGN_STATUSES)[number]
export type MarketingDeliveryStatus =
  (typeof MARKETING_DELIVERY_STATUSES)[number]

export type MarketingCampaignRecord = {
  id: string
  name: string
  description: string | null
  channel: MarketingChannel
  audience_type: MarketingCampaignAudienceType
  audience_filters: Record<string, unknown>
  template: string
  subject: string | null
  content: Record<string, unknown>
  status: MarketingCampaignStatus
  created_by: string | null
  launched_at: string | null
  completed_at: string | null
  last_error: string | null
  frequency_cap_window_hours: number
  frequency_cap_count: number
  total_selected: number
  total_sent: number
  total_skipped: number
  total_failed: number
  created_at: string
  updated_at: string
}

export type MarketingDeliveryJournalRecord = {
  id: string
  campaign_id: string
  customer_id: string | null
  channel: MarketingChannel
  recipient: string | null
  recipient_snapshot: Record<string, unknown> | null
  delivery_status: MarketingDeliveryStatus
  decision_reason: string | null
  notification_id: string | null
  template: string
  payload: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type MarketingCampaignCreateInput = {
  name: string
  description?: string | null
  channel: MarketingChannel
  audience_type: MarketingCampaignAudienceType
  audience_filters?: Record<string, unknown> | null
  template: string
  subject?: string | null
  content: Record<string, unknown>
  created_by?: string | null
  frequency_cap_window_hours?: number | null
  frequency_cap_count?: number | null
}

export type MarketingCampaignAudienceFilters = {
  customer_ids: string[]
}

export type MarketingAudienceEntry = {
  customer: MarketingCustomerRecord
  preferences: MarketingPreferencesResolution["preferences"]
  bindings: MarketingPreferencesResolution["bindings"]
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {}
}

function getRawRows<T>(result: RawSqlRowsResult<T>) {
  return Array.isArray(result?.rows) ? result.rows : []
}

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function normalizeIsoDate(value: unknown) {
  const normalized = normalizeString(value)

  if (!normalized) {
    return null
  }

  const parsed = new Date(normalized)

  return Number.isNaN(parsed.getTime()) ? normalized : parsed.toISOString()
}

function normalizePositiveInteger(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value.trim(), 10)

    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed
    }
  }

  return fallback
}

function isMarketingCampaignAudienceType(
  value: unknown
): value is MarketingCampaignAudienceType {
  return (
    typeof value === "string" &&
    (MARKETING_CAMPAIGN_AUDIENCE_TYPES as readonly string[]).includes(value.trim())
  )
}

function isMarketingCampaignStatus(value: unknown): value is MarketingCampaignStatus {
  return (
    typeof value === "string" &&
    (MARKETING_CAMPAIGN_STATUSES as readonly string[]).includes(value.trim())
  )
}

function isMarketingChannel(value: unknown): value is MarketingChannel {
  return (
    typeof value === "string" &&
    (MARKETING_CHANNELS as readonly string[]).includes(value.trim())
  )
}

function parseJsonObject(value: unknown) {
  if (typeof value === "string") {
    try {
      return asRecord(JSON.parse(value))
    } catch {
      return {}
    }
  }

  return asRecord(value)
}

export function normalizeMarketingAudienceFilters(
  value: unknown
): MarketingCampaignAudienceFilters {
  const record = parseJsonObject(value)
  const customerIds = Array.isArray(record.customer_ids)
    ? Array.from(
        new Set(
          record.customer_ids
            .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
            .filter(Boolean)
        )
      )
    : []

  return {
    customer_ids: customerIds,
  }
}

function normalizeCampaignRecord(value: Record<string, unknown>): MarketingCampaignRecord {
  return {
    id: normalizeString(value.id) || "",
    name: normalizeString(value.name) || "",
    description: normalizeString(value.description),
    channel: isMarketingChannel(value.channel)
      ? (value.channel.trim() as MarketingChannel)
      : "email",
    audience_type: isMarketingCampaignAudienceType(value.audience_type)
      ? (value.audience_type.trim() as MarketingCampaignAudienceType)
      : "all",
    audience_filters: normalizeMarketingAudienceFilters(value.audience_filters),
    template: normalizeString(value.template) || "marketing-v1",
    subject: normalizeString(value.subject),
    content: parseJsonObject(value.content),
    status: isMarketingCampaignStatus(value.status)
      ? (value.status.trim() as MarketingCampaignStatus)
      : "draft",
    created_by: normalizeString(value.created_by),
    launched_at: normalizeIsoDate(value.launched_at),
    completed_at: normalizeIsoDate(value.completed_at),
    last_error: normalizeString(value.last_error),
    frequency_cap_window_hours: normalizePositiveInteger(
      value.frequency_cap_window_hours,
      DEFAULT_MARKETING_FREQUENCY_CAP_WINDOW_HOURS
    ),
    frequency_cap_count: normalizePositiveInteger(
      value.frequency_cap_count,
      DEFAULT_MARKETING_FREQUENCY_CAP_COUNT
    ),
    total_selected: normalizePositiveInteger(value.total_selected, 0),
    total_sent: normalizePositiveInteger(value.total_sent, 0),
    total_skipped: normalizePositiveInteger(value.total_skipped, 0),
    total_failed: normalizePositiveInteger(value.total_failed, 0),
    created_at: normalizeIsoDate(value.created_at) || new Date(0).toISOString(),
    updated_at: normalizeIsoDate(value.updated_at) || new Date(0).toISOString(),
  }
}

function normalizeJournalRecord(
  value: Record<string, unknown>
): MarketingDeliveryJournalRecord {
  return {
    id: normalizeString(value.id) || "",
    campaign_id: normalizeString(value.campaign_id) || "",
    customer_id: normalizeString(value.customer_id),
    channel: isMarketingChannel(value.channel)
      ? (value.channel.trim() as MarketingChannel)
      : "email",
    recipient: normalizeString(value.recipient),
    recipient_snapshot: parseJsonObject(value.recipient_snapshot),
    delivery_status:
      typeof value.delivery_status === "string" &&
      (MARKETING_DELIVERY_STATUSES as readonly string[]).includes(
        value.delivery_status.trim()
      )
        ? (value.delivery_status.trim() as MarketingDeliveryStatus)
        : "skipped",
    decision_reason: normalizeString(value.decision_reason),
    notification_id: normalizeString(value.notification_id),
    template: normalizeString(value.template) || "marketing-v1",
    payload: parseJsonObject(value.payload),
    created_at: normalizeIsoDate(value.created_at) || new Date(0).toISOString(),
    updated_at: normalizeIsoDate(value.updated_at) || new Date(0).toISOString(),
  }
}

export async function ensureMarketingLayerTables(pgConnection: PgConnectionLike) {
  await pgConnection.raw(`
    create table if not exists marketing_campaign (
      id text primary key,
      name text not null,
      description text null,
      channel text not null,
      audience_type text not null,
      audience_filters jsonb not null default '{}'::jsonb,
      template text not null,
      subject text null,
      content jsonb not null default '{}'::jsonb,
      status text not null default 'draft',
      created_by text null,
      launched_at timestamptz null,
      completed_at timestamptz null,
      last_error text null,
      frequency_cap_window_hours integer not null default 24,
      frequency_cap_count integer not null default 1,
      total_selected integer not null default 0,
      total_sent integer not null default 0,
      total_skipped integer not null default 0,
      total_failed integer not null default 0,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `)

  await pgConnection.raw(`
    alter table marketing_campaign
    add column if not exists total_failed integer not null default 0
  `)

  await pgConnection.raw(`
    create table if not exists marketing_delivery_journal (
      id text primary key,
      campaign_id text not null references marketing_campaign(id) on delete cascade,
      customer_id text null,
      channel text not null,
      recipient text null,
      recipient_snapshot jsonb null,
      delivery_status text not null,
      decision_reason text null,
      notification_id text null,
      template text not null,
      payload jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `)

  await pgConnection.raw(`
    create index if not exists idx_marketing_campaign_status_created_at
      on marketing_campaign (status, created_at desc)
  `)
  await pgConnection.raw(`
    create index if not exists idx_marketing_delivery_journal_campaign_id_created_at
      on marketing_delivery_journal (campaign_id, created_at desc)
  `)
  await pgConnection.raw(`
    create index if not exists idx_marketing_delivery_journal_customer_channel_created_at
      on marketing_delivery_journal (customer_id, channel, created_at desc)
  `)
}

export async function createMarketingCampaign(
  pgConnection: PgConnectionLike,
  input: MarketingCampaignCreateInput
) {
  await ensureMarketingLayerTables(pgConnection)

  const id = `mc_${randomUUID().replace(/-/g, "")}`
  const audienceFilters = normalizeMarketingAudienceFilters(input.audience_filters)

  const rows = getRawRows<Record<string, unknown>>(
    await pgConnection.raw(
      `
        insert into marketing_campaign (
          id,
          name,
          description,
          channel,
          audience_type,
          audience_filters,
          template,
          subject,
          content,
          status,
          created_by,
          frequency_cap_window_hours,
          frequency_cap_count
        )
        values (?, ?, ?, ?, ?, ?::jsonb, ?, ?, ?::jsonb, 'draft', ?, ?, ?)
        returning *
      `,
      [
        id,
        input.name.trim(),
        input.description?.trim() || null,
        input.channel,
        input.audience_type,
        JSON.stringify(audienceFilters),
        input.template.trim(),
        input.subject?.trim() || null,
        JSON.stringify(input.content || {}),
        input.created_by?.trim() || null,
        normalizePositiveInteger(
          input.frequency_cap_window_hours,
          DEFAULT_MARKETING_FREQUENCY_CAP_WINDOW_HOURS
        ),
        normalizePositiveInteger(
          input.frequency_cap_count,
          DEFAULT_MARKETING_FREQUENCY_CAP_COUNT
        ),
      ]
    )
  )

  return normalizeCampaignRecord(rows[0] || {})
}

export async function listMarketingCampaigns(pgConnection: PgConnectionLike) {
  await ensureMarketingLayerTables(pgConnection)

  const rows = getRawRows<Record<string, unknown>>(
    await pgConnection.raw(`
      select *
      from marketing_campaign
      order by created_at desc, id desc
    `)
  )

  return rows.map((row) => normalizeCampaignRecord(row))
}

export async function getMarketingCampaignById(
  pgConnection: PgConnectionLike,
  campaignId: string
) {
  await ensureMarketingLayerTables(pgConnection)

  const rows = getRawRows<Record<string, unknown>>(
    await pgConnection.raw(
      `
        select *
        from marketing_campaign
        where id = ?
        limit 1
      `,
      [campaignId]
    )
  )

  return rows[0] ? normalizeCampaignRecord(rows[0]) : null
}

export async function updateMarketingCampaignStatus(
  pgConnection: PgConnectionLike,
  input: {
    campaignId: string
    status: MarketingCampaignStatus
    launchedAt?: string | null
    completedAt?: string | null
    lastError?: string | null
    totalSelected?: number
    totalSent?: number
    totalSkipped?: number
    totalFailed?: number
  }
) {
  const rows = getRawRows<Record<string, unknown>>(
    await pgConnection.raw(
      `
        update marketing_campaign
        set status = ?,
            launched_at = coalesce(?::timestamptz, launched_at),
            completed_at = ?,
            last_error = ?,
            total_selected = coalesce(?, total_selected),
            total_sent = coalesce(?, total_sent),
            total_skipped = coalesce(?, total_skipped),
            total_failed = coalesce(?, total_failed),
            updated_at = now()
        where id = ?
        returning *
      `,
      [
        input.status,
        input.launchedAt || null,
        input.completedAt || null,
        input.lastError || null,
        typeof input.totalSelected === "number" ? input.totalSelected : null,
        typeof input.totalSent === "number" ? input.totalSent : null,
        typeof input.totalSkipped === "number" ? input.totalSkipped : null,
        typeof input.totalFailed === "number" ? input.totalFailed : null,
        input.campaignId,
      ]
    )
  )

  return rows[0] ? normalizeCampaignRecord(rows[0]) : null
}

export async function claimMarketingCampaignForLaunch(
  pgConnection: PgConnectionLike,
  input: {
    campaignId: string
    launchedAt: string
  }
) {
  await ensureMarketingLayerTables(pgConnection)

  const rows = getRawRows<Record<string, unknown>>(
    await pgConnection.raw(
      `
        update marketing_campaign
        set status = 'running',
            launched_at = ?::timestamptz,
            completed_at = null,
            last_error = null,
            total_selected = 0,
            total_sent = 0,
            total_skipped = 0,
            total_failed = 0,
            updated_at = now()
        where id = ?
          and status = 'draft'
        returning *
      `,
      [input.launchedAt, input.campaignId]
    )
  )

  return rows[0] ? normalizeCampaignRecord(rows[0]) : null
}

export async function insertMarketingDeliveryJournal(
  pgConnection: PgConnectionLike,
  input: {
    campaignId: string
    customerId: string | null
    channel: MarketingChannel
    recipient: string | null
    recipientSnapshot?: Record<string, unknown> | null
    deliveryStatus: MarketingDeliveryStatus
    decisionReason?: string | null
    notificationId?: string | null
    template: string
    payload?: Record<string, unknown>
  }
) {
  const id = `mdj_${randomUUID().replace(/-/g, "")}`
  const rows = getRawRows<Record<string, unknown>>(
    await pgConnection.raw(
      `
        insert into marketing_delivery_journal (
          id,
          campaign_id,
          customer_id,
          channel,
          recipient,
          recipient_snapshot,
          delivery_status,
          decision_reason,
          notification_id,
          template,
          payload
        )
        values (?, ?, ?, ?, ?, ?::jsonb, ?, ?, ?, ?, ?::jsonb)
        returning *
      `,
      [
        id,
        input.campaignId,
        input.customerId,
        input.channel,
        input.recipient,
        JSON.stringify(input.recipientSnapshot || null),
        input.deliveryStatus,
        input.decisionReason || null,
        input.notificationId || null,
        input.template,
        JSON.stringify(input.payload || {}),
      ]
    )
  )

  return normalizeJournalRecord(rows[0] || {})
}

export async function listMarketingDeliveryJournalByCampaignId(
  pgConnection: PgConnectionLike,
  campaignId: string
) {
  await ensureMarketingLayerTables(pgConnection)

  const rows = getRawRows<Record<string, unknown>>(
    await pgConnection.raw(
      `
        select *
        from marketing_delivery_journal
        where campaign_id = ?
        order by created_at desc, id desc
      `,
      [campaignId]
    )
  )

  return rows.map((row) => normalizeJournalRecord(row))
}

export async function countRecentMarketingDeliveries(
  pgConnection: PgConnectionLike,
  input: {
    customerId: string
    channel: MarketingChannel
    since: string
  }
) {
  await ensureMarketingLayerTables(pgConnection)

  const rows = getRawRows<{ count?: string | number }>(
    await pgConnection.raw(
      `
        select count(*)::int as count
        from marketing_delivery_journal
        where customer_id = ?
          and channel = ?
          and delivery_status = 'sent'
          and created_at >= ?::timestamptz
      `,
      [input.customerId, input.channel, input.since]
    )
  )

  const countValue = rows[0]?.count

  return typeof countValue === "number"
    ? countValue
    : Number.parseInt(String(countValue || 0), 10) || 0
}

async function listAllMarketingCustomers(query: QueryGraphLike) {
  const customers: MarketingCustomerRecord[] = []
  const pageSize = 100
  let skip = 0

  while (true) {
    const response = await query.graph<MarketingCustomerRecord>({
      entity: "customer",
      fields: ["id", "email", "phone", "metadata"],
      pagination: {
        take: pageSize,
        skip,
      },
    })

    const page = response.data || []

    customers.push(...page)

    if (page.length < pageSize) {
      break
    }

    skip += pageSize
  }

  return customers
}

export async function resolveMarketingAudience(
  query: QueryGraphLike,
  campaign: Pick<
    MarketingCampaignRecord,
    "audience_type" | "audience_filters" | "channel"
  >
) {
  const customers = await listAllMarketingCustomers(query)
  const audienceFilters = normalizeMarketingAudienceFilters(
    campaign.audience_filters || {}
  )
  const manualCustomerIds = new Set(audienceFilters.customer_ids)
  const entries: MarketingAudienceEntry[] = []

  for (const customer of customers) {
    const resolution = resolveMarketingPreferences(customer.metadata, customer)

    if (campaign.audience_type === "manual") {
      if (!manualCustomerIds.has(customer.id)) {
        continue
      }
    } else if (campaign.audience_type === "email_consent") {
      if (resolution.preferences.channels.email.status !== "subscribed") {
        continue
      }
    } else if (campaign.audience_type === "sms_consent") {
      if (resolution.preferences.channels.sms.status !== "subscribed") {
        continue
      }
    } else if (campaign.audience_type === "vk_consent") {
      if (resolution.preferences.channels.vk.status !== "subscribed") {
        continue
      }
    } else if (campaign.audience_type === "vk_linked") {
      if (!resolution.bindings.vk.available) {
        continue
      }
    }

    entries.push({
      customer,
      preferences: resolution.preferences,
      bindings: resolution.bindings,
    })
  }

  return entries
}

export function getMarketingPgConnection(container: any) {
  return container.resolve(
    ContainerRegistrationKeys.PG_CONNECTION
  ) as PgConnectionLike
}
