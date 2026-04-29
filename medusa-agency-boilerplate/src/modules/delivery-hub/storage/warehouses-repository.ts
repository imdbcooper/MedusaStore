import crypto from "node:crypto"
import {
  DELIVERY_HUB_DEFAULT_COUNTRY_CODE,
  DELIVERY_HUB_WAREHOUSES_TABLE,
} from "../constants"
import type {
  DeliveryWarehouseMetadata,
  DeliveryWarehouseRecord,
  DeliveryWarehouseUpsertInput,
} from "../domain/warehouse"
import { getRawRows, type DeliveryHubPgConnection } from "./pg"
import { parseJsonObject } from "./serializers"

async function hasDeliveryWarehousesTable(pg: DeliveryHubPgConnection) {
  const rows = getRawRows<{ table_name: string | null }>(
    await pg.raw(`
      select to_regclass(?) as table_name
    `, [DELIVERY_HUB_WAREHOUSES_TABLE])
  )

  return !!rows[0]?.table_name
}

export async function ensureDeliveryWarehousesTable(pg: DeliveryHubPgConnection) {
  await pg.raw(`
    create table if not exists ${DELIVERY_HUB_WAREHOUSES_TABLE} (
      id text primary key,
      name text not null,
      enabled boolean not null default true,
      country_code text not null default 'RU',
      city text null,
      address_line_1 text null,
      contact_name text null,
      contact_phone text null,
      provider_code text null,
      provider_warehouse_id text null,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `)
}

type DeliveryWarehouseRow = {
  id: string
  name: string
  enabled: boolean
  country_code: string
  city: string | null
  address_line_1: string | null
  contact_name: string | null
  contact_phone: string | null
  provider_code: string | null
  provider_warehouse_id: string | null
  metadata: unknown
  created_at: string | Date
  updated_at: string | Date
}

export async function listDeliveryWarehouses(pg: DeliveryHubPgConnection) {
  await ensureDeliveryWarehousesTable(pg)

  const rows = getRawRows<DeliveryWarehouseRow>(
    await pg.raw(`
      select *
      from ${DELIVERY_HUB_WAREHOUSES_TABLE}
      order by created_at desc, id desc
    `)
  )

  return rows.map(normalizeDeliveryWarehouseRow)
}

export async function listDeliveryWarehousesReadOnly(pg: DeliveryHubPgConnection) {
  const hasTable = await hasDeliveryWarehousesTable(pg)

  if (!hasTable) {
    return []
  }

  const rows = getRawRows<DeliveryWarehouseRow>(
    await pg.raw(`
      select *
      from ${DELIVERY_HUB_WAREHOUSES_TABLE}
      order by created_at desc, id desc
    `)
  )

  return rows.map(normalizeDeliveryWarehouseRow)
}

export async function getDeliveryWarehouseById(pg: DeliveryHubPgConnection, id: string) {
  await ensureDeliveryWarehousesTable(pg)

  const rows = getRawRows<DeliveryWarehouseRow>(
    await pg.raw(
      `
        select *
        from ${DELIVERY_HUB_WAREHOUSES_TABLE}
        where id = ?
        limit 1
      `,
      [id]
    )
  )

  return rows[0] ? normalizeDeliveryWarehouseRow(rows[0]) : null
}

export async function upsertDeliveryWarehouse(
  pg: DeliveryHubPgConnection,
  input: DeliveryWarehouseUpsertInput
) {
  await ensureDeliveryWarehousesTable(pg)

  const id = input.id?.trim() || crypto.randomUUID()
  const rows = getRawRows<DeliveryWarehouseRow>(
    await pg.raw(
      `
        insert into ${DELIVERY_HUB_WAREHOUSES_TABLE} (
          id,
          name,
          enabled,
          country_code,
          city,
          address_line_1,
          contact_name,
          contact_phone,
          provider_code,
          provider_warehouse_id,
          metadata,
          updated_at
        )
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, now())
        on conflict (id)
        do update set
          name = excluded.name,
          enabled = excluded.enabled,
          country_code = excluded.country_code,
          city = excluded.city,
          address_line_1 = excluded.address_line_1,
          contact_name = excluded.contact_name,
          contact_phone = excluded.contact_phone,
          provider_code = excluded.provider_code,
          provider_warehouse_id = excluded.provider_warehouse_id,
          metadata = excluded.metadata,
          updated_at = now()
        returning *
      `,
      [
        id,
        input.name.trim(),
        input.enabled ?? true,
        (input.country_code ?? DELIVERY_HUB_DEFAULT_COUNTRY_CODE).trim().toUpperCase(),
        normalizeNullableText(input.city),
        normalizeNullableText(input.address_line_1),
        normalizeNullableText(input.contact_name),
        normalizeNullableText(input.contact_phone),
        normalizeNullableText(input.provider_code),
        normalizeNullableText(input.provider_warehouse_id),
        JSON.stringify(input.metadata ?? {}),
      ]
    )
  )

  return normalizeDeliveryWarehouseRow(rows[0])
}

function normalizeDeliveryWarehouseRow(row: DeliveryWarehouseRow): DeliveryWarehouseRecord {
  return {
    id: row.id,
    name: normalizeText(row.name, "Warehouse"),
    enabled: !!row.enabled,
    country_code: normalizeText(row.country_code, DELIVERY_HUB_DEFAULT_COUNTRY_CODE),
    city: normalizeNullableText(row.city),
    address_line_1: normalizeNullableText(row.address_line_1),
    contact_name: normalizeNullableText(row.contact_name),
    contact_phone: normalizeNullableText(row.contact_phone),
    provider_code: normalizeNullableText(row.provider_code),
    provider_warehouse_id: normalizeNullableText(row.provider_warehouse_id),
    metadata: normalizeDeliveryWarehouseMetadata(parseJsonObject(row.metadata)),
    created_at: normalizeIsoDate(row.created_at) ?? new Date(0).toISOString(),
    updated_at: normalizeIsoDate(row.updated_at) ?? new Date(0).toISOString(),
  }
}

function normalizeDeliveryWarehouseMetadata(metadata: Record<string, unknown>): DeliveryWarehouseMetadata {
  const normalized: DeliveryWarehouseMetadata = { ...metadata }
  const postalCode = normalizeNullableText(metadata.postal_code)
  const contactEmail = normalizeNullableText(metadata.contact_email)
  const fullname = normalizeNullableText(metadata.fullname)
  const coordinates = normalizeCoordinates(metadata.coordinates)
  const lat = normalizeFiniteNumber(metadata.lat)
  const lng = normalizeFiniteNumber(metadata.lng)

  if (postalCode) {
    normalized.postal_code = postalCode
  } else {
    delete normalized.postal_code
  }

  if (contactEmail) {
    normalized.contact_email = contactEmail
  } else {
    delete normalized.contact_email
  }

  if (fullname) {
    normalized.fullname = fullname
  } else {
    delete normalized.fullname
  }

  if (coordinates) {
    normalized.coordinates = coordinates
  } else if (lng !== null && lat !== null) {
    normalized.coordinates = [lng, lat]
  } else {
    delete normalized.coordinates
  }

  if (lat !== null) {
    normalized.lat = lat
  } else {
    delete normalized.lat
  }

  if (lng !== null) {
    normalized.lng = lng
  } else {
    delete normalized.lng
  }

  return normalized
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

function normalizeCoordinates(value: unknown): [number, number] | null {
  if (!Array.isArray(value) || value.length !== 2) {
    return null
  }

  const lng = normalizeFiniteNumber(value[0])
  const lat = normalizeFiniteNumber(value[1])

  return lng === null || lat === null ? null : [lng, lat]
}

function normalizeFiniteNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim())
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}
