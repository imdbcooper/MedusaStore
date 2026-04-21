import crypto from "node:crypto"
import { DELIVERY_HUB_EVENT_LOGS_TABLE } from "../constants"
import { parseJsonObject } from "./serializers"
import { getRawRows, type DeliveryHubPgConnection } from "./pg"

export type DeliveryHubEventLogRecord = {
  id: string
  connection_id: string | null
  provider_code: string
  kind: string
  correlation_id: string
  success: boolean
  request_summary: Record<string, unknown>
  response_summary: Record<string, unknown>
  error_code: string | null
  created_at: string
}

export type DeliveryHubEventLogListInput = {
  connection_id?: string | null
  provider_code?: string | null
  limit?: number | null
}

type DeliveryHubEventLogRow = {
  id: string
  connection_id: string | null
  provider_code: string
  kind: string
  correlation_id: string
  success: boolean
  request_summary: unknown
  response_summary: unknown
  error_code: string | null
  created_at: string | Date
}

export async function ensureDeliveryEventLogsTable(pg: DeliveryHubPgConnection) {
  await pg.raw(`
    create table if not exists ${DELIVERY_HUB_EVENT_LOGS_TABLE} (
      id text primary key,
      connection_id text null,
      provider_code text not null,
      kind text not null,
      correlation_id text not null,
      success boolean not null default false,
      request_summary jsonb not null default '{}'::jsonb,
      response_summary jsonb not null default '{}'::jsonb,
      error_code text null,
      created_at timestamptz not null default now()
    )
  `)
}

export async function appendDeliveryEventLog(
  pg: DeliveryHubPgConnection,
  input: Omit<DeliveryHubEventLogRecord, "id" | "created_at"> & {
    id?: string
  }
) {
  await ensureDeliveryEventLogsTable(pg)

  const rows = getRawRows<DeliveryHubEventLogRecord>(
    await pg.raw(
      `
        insert into ${DELIVERY_HUB_EVENT_LOGS_TABLE} (
          id,
          connection_id,
          provider_code,
          kind,
          correlation_id,
          success,
          request_summary,
          response_summary,
          error_code
        )
        values (?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?)
        returning id, connection_id, provider_code, kind, correlation_id, success, request_summary, response_summary, error_code, created_at
      `,
      [
        input.id ?? crypto.randomUUID(),
        input.connection_id,
        input.provider_code,
        input.kind,
        input.correlation_id,
        input.success,
        JSON.stringify(input.request_summary ?? {}),
        JSON.stringify(input.response_summary ?? {}),
        input.error_code ?? null,
      ]
    )
  )

  return rows[0] ?? null
}

export async function listDeliveryEventLogs(
  pg: DeliveryHubPgConnection,
  input: DeliveryHubEventLogListInput = {}
) {
  await ensureDeliveryEventLogsTable(pg)

  const filters: string[] = []
  const params: unknown[] = []
  const connectionId = normalizeNullableText(input.connection_id)
  const providerCode = normalizeNullableText(input.provider_code)

  if (connectionId) {
    filters.push("connection_id = ?")
    params.push(connectionId)
  }

  if (providerCode) {
    filters.push("provider_code = ?")
    params.push(providerCode)
  }

  const whereClause = filters.length ? `where ${filters.join(" and ")}` : ""
  const rows = getRawRows<DeliveryHubEventLogRow>(
    await pg.raw(
      `
        select id, connection_id, provider_code, kind, correlation_id, success, request_summary, response_summary, error_code, created_at
        from ${DELIVERY_HUB_EVENT_LOGS_TABLE}
        ${whereClause}
        order by created_at desc, id desc
        limit ?
      `,
      [...params, normalizeLimit(input.limit)]
    )
  )

  return rows.map(normalizeDeliveryEventLogRow)
}

function normalizeDeliveryEventLogRow(row: DeliveryHubEventLogRow): DeliveryHubEventLogRecord {
  return {
    id: row.id,
    connection_id: normalizeNullableText(row.connection_id),
    provider_code: normalizeText(row.provider_code),
    kind: normalizeText(row.kind),
    correlation_id: normalizeText(row.correlation_id),
    success: !!row.success,
    request_summary: parseJsonObject(row.request_summary),
    response_summary: parseJsonObject(row.response_summary),
    error_code: normalizeNullableText(row.error_code),
    created_at: normalizeIsoDate(row.created_at) ?? new Date(0).toISOString(),
  }
}

function normalizeLimit(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 50
  }

  return Math.max(1, Math.min(100, Math.trunc(value)))
}

function normalizeIsoDate(value: string | Date | null | undefined) {
  if (!value) {
    return null
  }

  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function normalizeText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : ""
}

function normalizeNullableText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}
