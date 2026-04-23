import crypto from "node:crypto"
import {
  DELIVERY_HUB_CONNECTIONS_TABLE,
  DELIVERY_HUB_CONNECTION_MODE,
  DELIVERY_HUB_CONNECTION_STATUS,
  DELIVERY_HUB_CREDENTIALS_STATE,
  DELIVERY_HUB_DEFAULT_COUNTRY_CODE,
} from "../constants"
import type {
  DeliveryConnectionRecord,
  DeliveryConnectionUpsertInput,
} from "../domain/connection"
import type { DeliveryHubCredentialsEnvelope } from "../domain/credentials"
import { getRawRows, type DeliveryHubPgConnection } from "./pg"
import { parseJsonObject } from "./serializers"

async function hasDeliveryConnectionsTable(pg: DeliveryHubPgConnection) {
  const rows = getRawRows<{ table_name: string | null }>(
    await pg.raw(`
      select to_regclass(?) as table_name
    `, [DELIVERY_HUB_CONNECTIONS_TABLE])
  )

  return !!rows[0]?.table_name
}

export async function ensureDeliveryConnectionsTable(pg: DeliveryHubPgConnection) {
  await pg.raw(`
    create table if not exists ${DELIVERY_HUB_CONNECTIONS_TABLE} (
      id text primary key,
      provider_code text not null,
      name text not null,
      status text not null,
      mode text not null,
      enabled boolean not null default false,
      country_code text not null default 'RU',
      credentials_envelope jsonb null,
      credentials_state text not null default 'empty',
      credentials_fingerprint text null,
      credentials_last_validated_at timestamptz null,
      credentials_last_error_code text null,
      config jsonb not null default '{}'::jsonb,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `)
}

type DeliveryConnectionRow = {
  id: string
  provider_code: string
  name: string
  status: string
  mode: string
  enabled: boolean
  country_code: string
  credentials_envelope: DeliveryHubCredentialsEnvelope | null
  credentials_state: string
  credentials_fingerprint: string | null
  credentials_last_validated_at: string | Date | null
  credentials_last_error_code: string | null
  config: unknown
  metadata: unknown
  created_at: string | Date
  updated_at: string | Date
}

export async function listDeliveryConnections(pg: DeliveryHubPgConnection) {
  await ensureDeliveryConnectionsTable(pg)

  const rows = getRawRows<DeliveryConnectionRow>(
    await pg.raw(`
      select *
      from ${DELIVERY_HUB_CONNECTIONS_TABLE}
      order by created_at desc, id desc
    `)
  )

  return rows.map(normalizeDeliveryConnectionRow)
}

export async function listDeliveryConnectionsReadOnly(pg: DeliveryHubPgConnection) {
  const hasTable = await hasDeliveryConnectionsTable(pg)

  if (!hasTable) {
    return []
  }

  const rows = getRawRows<DeliveryConnectionRow>(
    await pg.raw(`
      select *
      from ${DELIVERY_HUB_CONNECTIONS_TABLE}
      order by created_at desc, id desc
    `)
  )

  return rows.map(normalizeDeliveryConnectionRow)
}

export async function getDeliveryConnectionByIdReadOnly(
  pg: DeliveryHubPgConnection,
  id: string
) {
  const hasTable = await hasDeliveryConnectionsTable(pg)

  if (!hasTable) {
    return null
  }

  const rows = getRawRows<DeliveryConnectionRow>(
    await pg.raw(
      `
        select *
        from ${DELIVERY_HUB_CONNECTIONS_TABLE}
        where id = ?
        limit 1
      `,
      [id]
    )
  )

  return rows[0] ? normalizeDeliveryConnectionRow(rows[0]) : null
}

export async function getDeliveryConnectionById(
  pg: DeliveryHubPgConnection,
  id: string
) {
  await ensureDeliveryConnectionsTable(pg)

  const rows = getRawRows<DeliveryConnectionRow>(
    await pg.raw(
      `
        select *
        from ${DELIVERY_HUB_CONNECTIONS_TABLE}
        where id = ?
        limit 1
      `,
      [id]
    )
  )

  return rows[0] ? normalizeDeliveryConnectionRow(rows[0]) : null
}

export async function upsertDeliveryConnection(
  pg: DeliveryHubPgConnection,
  input: DeliveryConnectionUpsertInput & {
    credentials_envelope?: DeliveryHubCredentialsEnvelope | null
    credentials_state?: string
    credentials_fingerprint?: string | null
    credentials_last_validated_at?: string | null
    credentials_last_error_code?: string | null
  }
) {
  await ensureDeliveryConnectionsTable(pg)

  const id = input.id?.trim() || crypto.randomUUID()
  const rows = getRawRows<DeliveryConnectionRow>(
    await pg.raw(
      `
        insert into ${DELIVERY_HUB_CONNECTIONS_TABLE} (
          id,
          provider_code,
          name,
          status,
          mode,
          enabled,
          country_code,
          credentials_envelope,
          credentials_state,
          credentials_fingerprint,
          credentials_last_validated_at,
          credentials_last_error_code,
          config,
          metadata,
          updated_at
        )
        values (?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?, ?, ?, ?::jsonb, ?::jsonb, now())
        on conflict (id)
        do update set
          provider_code = excluded.provider_code,
          name = excluded.name,
          status = excluded.status,
          mode = excluded.mode,
          enabled = excluded.enabled,
          country_code = excluded.country_code,
          credentials_envelope = coalesce(excluded.credentials_envelope, ${DELIVERY_HUB_CONNECTIONS_TABLE}.credentials_envelope),
          credentials_state = excluded.credentials_state,
          credentials_fingerprint = excluded.credentials_fingerprint,
          credentials_last_validated_at = excluded.credentials_last_validated_at,
          credentials_last_error_code = excluded.credentials_last_error_code,
          config = excluded.config,
          metadata = excluded.metadata,
          updated_at = now()
        returning *
      `,
      [
        id,
        input.provider_code,
        input.name,
        input.status ?? DELIVERY_HUB_CONNECTION_STATUS.draft,
        input.mode ?? DELIVERY_HUB_CONNECTION_MODE.test,
        input.enabled ?? false,
        input.country_code ?? DELIVERY_HUB_DEFAULT_COUNTRY_CODE,
        input.credentials_envelope ? JSON.stringify(input.credentials_envelope) : null,
        input.credentials_state ?? DELIVERY_HUB_CREDENTIALS_STATE.empty,
        input.credentials_fingerprint ?? null,
        input.credentials_last_validated_at ?? null,
        input.credentials_last_error_code ?? null,
        JSON.stringify(input.config ?? {}),
        JSON.stringify(input.metadata ?? {}),
      ]
    )
  )

  return normalizeDeliveryConnectionRow(rows[0])
}

function normalizeDeliveryConnectionRow(row: DeliveryConnectionRow): DeliveryConnectionRecord {
  return {
    id: row.id,
    provider_code: row.provider_code,
    name: row.name,
    status: normalizeText(row.status, DELIVERY_HUB_CONNECTION_STATUS.draft) as DeliveryConnectionRecord["status"],
    mode: normalizeText(row.mode, DELIVERY_HUB_CONNECTION_MODE.test) as DeliveryConnectionRecord["mode"],
    enabled: !!row.enabled,
    country_code: normalizeText(row.country_code, DELIVERY_HUB_DEFAULT_COUNTRY_CODE),
    credentials_envelope: (row.credentials_envelope ?? null) as DeliveryHubCredentialsEnvelope | null,
    credentials_state: normalizeText(
      row.credentials_state,
      DELIVERY_HUB_CREDENTIALS_STATE.empty
    ) as DeliveryConnectionRecord["credentials_state"],
    credentials_fingerprint: normalizeNullableText(row.credentials_fingerprint),
    credentials_last_validated_at: normalizeIsoDate(row.credentials_last_validated_at),
    credentials_last_error_code: normalizeNullableText(row.credentials_last_error_code),
    config: parseJsonObject(row.config),
    metadata: parseJsonObject(row.metadata),
    created_at: normalizeIsoDate(row.created_at) ?? new Date(0).toISOString(),
    updated_at: normalizeIsoDate(row.updated_at) ?? new Date(0).toISOString(),
  }
}

function normalizeIsoDate(value: string | Date | null | undefined) {
  if (!value) {
    return null
  }

  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function normalizeText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback
}

function normalizeNullableText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}
