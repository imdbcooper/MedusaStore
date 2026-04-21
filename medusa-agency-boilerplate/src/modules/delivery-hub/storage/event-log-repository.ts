import crypto from "node:crypto"
import { DELIVERY_HUB_EVENT_LOGS_TABLE } from "../constants"
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
