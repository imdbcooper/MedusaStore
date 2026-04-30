import crypto from "node:crypto"
import {
  DELIVERY_HUB_DEFAULT_COUNTRY_CODE,
  DELIVERY_HUB_SHIPMENTS_TABLE,
} from "../constants"
import { parseJsonObject } from "./serializers"
import { getRawRows, type DeliveryHubPgConnection } from "./pg"

export type DeliveryHubShipmentPersistenceOutcome = "accepted" | "failed"
export type DeliveryHubShipmentPersistenceStatus =
  | "dispatch_accepted"
  | "dispatch_failed"

export type DeliveryHubShipmentStatusRefreshOutcome = "not_refreshed" | "refreshed" | "failed"

export type DeliveryHubShipmentRecord = {
  id: string
  execution_reference: string
  idempotency_key: string | null
  provider_code: string
  connection_id: string | null
  mode_code: string | null
  order_id: string | null
  fulfillment_id: string | null
  cart_id: string | null
  shipping_option_id: string | null
  location_id: string | null
  quote_reference_id: string | null
  quote_reference_version: number | null
  correlation_id: string | null
  outcome: DeliveryHubShipmentPersistenceOutcome
  status: DeliveryHubShipmentPersistenceStatus
  accepted: boolean
  succeeded: boolean
  provider_shipment_reference_present: boolean
  provider_correlation_reference_present: boolean
  label_document_present: boolean
  attachment_document_present: boolean
  provider_status_summary: Record<string, unknown>
  status_refresh_outcome: DeliveryHubShipmentStatusRefreshOutcome
  status_refreshed_at: string | null
  request_summary: Record<string, unknown>
  response_summary: Record<string, unknown>
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type DeliveryHubShipmentUpsertInput = {
  id?: string
  execution_reference: string
  idempotency_key?: string | null
  provider_code: string
  connection_id?: string | null
  mode_code?: string | null
  order_id?: string | null
  fulfillment_id?: string | null
  cart_id?: string | null
  shipping_option_id?: string | null
  location_id?: string | null
  quote_reference_id?: string | null
  quote_reference_version?: number | null
  correlation_id?: string | null
  outcome: DeliveryHubShipmentPersistenceOutcome
  status: DeliveryHubShipmentPersistenceStatus
  accepted: boolean
  succeeded: boolean
  provider_shipment_reference_present: boolean
  provider_correlation_reference_present: boolean
  label_document_present: boolean
  attachment_document_present: boolean
  provider_status_summary?: Record<string, unknown>
  status_refresh_outcome?: DeliveryHubShipmentStatusRefreshOutcome
  status_refreshed_at?: string | null
  request_summary?: Record<string, unknown>
  response_summary?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export type DeliveryHubShipmentStatusUpdateInput = {
  execution_reference: string
  provider_status_summary: Record<string, unknown>
  status_refresh_outcome: DeliveryHubShipmentStatusRefreshOutcome
  status_refreshed_at?: string | null
  metadata_patch?: Record<string, unknown>
}

export async function ensureDeliveryShipmentsTable(pg: DeliveryHubPgConnection) {
  await pg.raw(`
    create table if not exists ${DELIVERY_HUB_SHIPMENTS_TABLE} (
      id text primary key,
      execution_reference text not null unique,
      idempotency_key text null,
      provider_code text not null,
      connection_id text null,
      mode_code text null,
      order_id text null,
      fulfillment_id text null,
      cart_id text null,
      shipping_option_id text null,
      location_id text null,
      quote_reference_id text null,
      quote_reference_version integer null,
      correlation_id text null,
      outcome text not null,
      status text not null,
      accepted boolean not null default false,
      succeeded boolean not null default false,
      provider_shipment_reference_present boolean not null default false,
      provider_correlation_reference_present boolean not null default false,
      label_document_present boolean not null default false,
      attachment_document_present boolean not null default false,
      provider_status_summary jsonb not null default '{}'::jsonb,
      status_refresh_outcome text not null default 'not_refreshed',
      status_refreshed_at timestamptz null,
      request_summary jsonb not null default '{}'::jsonb,
      response_summary jsonb not null default '{}'::jsonb,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `)
  await pg.raw(`
    alter table ${DELIVERY_HUB_SHIPMENTS_TABLE}
      add column if not exists provider_status_summary jsonb not null default '{}'::jsonb,
      add column if not exists status_refresh_outcome text not null default 'not_refreshed',
      add column if not exists status_refreshed_at timestamptz null
  `)
}

type DeliveryHubShipmentRow = {
  id: string
  execution_reference: string
  idempotency_key: string | null
  provider_code: string
  connection_id: string | null
  mode_code: string | null
  order_id: string | null
  fulfillment_id: string | null
  cart_id: string | null
  shipping_option_id: string | null
  location_id: string | null
  quote_reference_id: string | null
  quote_reference_version: number | null
  correlation_id: string | null
  outcome: string
  status: string
  accepted: boolean
  succeeded: boolean
  provider_shipment_reference_present: boolean
  provider_correlation_reference_present: boolean
  label_document_present: boolean
  attachment_document_present: boolean
  provider_status_summary?: unknown
  status_refresh_outcome?: string | null
  status_refreshed_at?: string | Date | null
  request_summary: unknown
  response_summary: unknown
  metadata: unknown
  created_at: string | Date
  updated_at: string | Date
}

export async function getDeliveryShipmentByExecutionReference(
  pg: DeliveryHubPgConnection,
  executionReference: string
) {
  const normalizedReference = normalizeNullableText(executionReference)

  if (!normalizedReference) {
    return null
  }

  await ensureDeliveryShipmentsTable(pg)

  const rows = getRawRows<DeliveryHubShipmentRow>(
    await pg.raw(
      `
        select *
        from ${DELIVERY_HUB_SHIPMENTS_TABLE}
        where execution_reference = ?
        limit 1
      `,
      [normalizedReference]
    )
  )

  return rows[0] ? normalizeDeliveryShipmentRow(rows[0]) : null
}

export async function listDeliveryShipmentsByOrderId(
  pg: DeliveryHubPgConnection,
  orderId: string
) {
  const normalizedOrderId = normalizeNullableText(orderId)

  if (!normalizedOrderId) {
    return []
  }

  await ensureDeliveryShipmentsTable(pg)

  const rows = getRawRows<DeliveryHubShipmentRow>(
    await pg.raw(
      `
        select *
        from ${DELIVERY_HUB_SHIPMENTS_TABLE}
        where order_id = ?
        order by created_at desc, id desc
      `,
      [normalizedOrderId]
    )
  )

  return rows.map(normalizeDeliveryShipmentRow)
}

export async function getDeliveryShipmentByIdForOrder(
  pg: DeliveryHubPgConnection,
  shipmentId: string,
  orderId: string
) {
  const normalizedShipmentId = normalizeNullableText(shipmentId)
  const normalizedOrderId = normalizeNullableText(orderId)

  if (!normalizedShipmentId || !normalizedOrderId) {
    return null
  }

  await ensureDeliveryShipmentsTable(pg)

  const rows = getRawRows<DeliveryHubShipmentRow>(
    await pg.raw(
      `
        select *
        from ${DELIVERY_HUB_SHIPMENTS_TABLE}
        where id = ?
          and order_id = ?
        limit 1
      `,
      [normalizedShipmentId, normalizedOrderId]
    )
  )

  return rows[0] ? normalizeDeliveryShipmentRow(rows[0]) : null
}

export async function upsertDeliveryShipment(
  pg: DeliveryHubPgConnection,
  input: DeliveryHubShipmentUpsertInput
) {
  await ensureDeliveryShipmentsTable(pg)

  const rows = getRawRows<DeliveryHubShipmentRow>(
    await pg.raw(
      `
        insert into ${DELIVERY_HUB_SHIPMENTS_TABLE} (
          id,
          execution_reference,
          idempotency_key,
          provider_code,
          connection_id,
          mode_code,
          order_id,
          fulfillment_id,
          cart_id,
          shipping_option_id,
          location_id,
          quote_reference_id,
          quote_reference_version,
          correlation_id,
          outcome,
          status,
          accepted,
          succeeded,
          provider_shipment_reference_present,
          provider_correlation_reference_present,
          label_document_present,
          attachment_document_present,
          provider_status_summary,
          status_refresh_outcome,
          status_refreshed_at,
          request_summary,
          response_summary,
          metadata,
          updated_at
        )
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?, ?::jsonb, ?::jsonb, ?::jsonb, now())
        on conflict (execution_reference)
        do update set
          idempotency_key = excluded.idempotency_key,
          provider_code = excluded.provider_code,
          connection_id = excluded.connection_id,
          mode_code = excluded.mode_code,
          order_id = excluded.order_id,
          fulfillment_id = excluded.fulfillment_id,
          cart_id = excluded.cart_id,
          shipping_option_id = excluded.shipping_option_id,
          location_id = excluded.location_id,
          quote_reference_id = excluded.quote_reference_id,
          quote_reference_version = excluded.quote_reference_version,
          correlation_id = excluded.correlation_id,
          outcome = excluded.outcome,
          status = excluded.status,
          accepted = excluded.accepted,
          succeeded = excluded.succeeded,
          provider_shipment_reference_present = excluded.provider_shipment_reference_present,
          provider_correlation_reference_present = excluded.provider_correlation_reference_present,
          label_document_present = excluded.label_document_present,
          attachment_document_present = excluded.attachment_document_present,
          provider_status_summary = excluded.provider_status_summary,
          status_refresh_outcome = excluded.status_refresh_outcome,
          status_refreshed_at = excluded.status_refreshed_at,
          request_summary = excluded.request_summary,
          response_summary = excluded.response_summary,
          metadata = excluded.metadata,
          updated_at = now()
        returning *
      `,
      [
        input.id?.trim() || crypto.randomUUID(),
        input.execution_reference.trim(),
        normalizeNullableText(input.idempotency_key),
        normalizeText(input.provider_code, "deliveryhub"),
        normalizeNullableText(input.connection_id),
        normalizeNullableText(input.mode_code),
        normalizeNullableText(input.order_id),
        normalizeNullableText(input.fulfillment_id),
        normalizeNullableText(input.cart_id),
        normalizeNullableText(input.shipping_option_id),
        normalizeNullableText(input.location_id),
        normalizeNullableText(input.quote_reference_id),
        normalizeNullableNumber(input.quote_reference_version),
        normalizeNullableText(input.correlation_id),
        normalizeOutcome(input.outcome),
        normalizeStatus(input.status),
        !!input.accepted,
        !!input.succeeded,
        !!input.provider_shipment_reference_present,
        !!input.provider_correlation_reference_present,
        !!input.label_document_present,
        !!input.attachment_document_present,
        JSON.stringify(input.provider_status_summary ?? {}),
        normalizeStatusRefreshOutcome(input.status_refresh_outcome),
        normalizeNullableText(input.status_refreshed_at),
        JSON.stringify(input.request_summary ?? {}),
        JSON.stringify(input.response_summary ?? {}),
        JSON.stringify(input.metadata ?? {}),
      ]
    )
  )

  return rows[0] ? normalizeDeliveryShipmentRow(rows[0]) : null
}

export async function recordDeliveryShipmentStatusUpdate(
  pg: DeliveryHubPgConnection,
  input: DeliveryHubShipmentStatusUpdateInput
) {
  const executionReference = normalizeNullableText(input.execution_reference)

  if (!executionReference) {
    return null
  }

  await ensureDeliveryShipmentsTable(pg)

  const current = await getDeliveryShipmentByExecutionReference(pg, executionReference)
  if (!isAcceptedShipmentForStatusUpdate(current)) {
    return null
  }

  const metadataPatch = {
    ...(current.metadata ?? {}),
    ...(input.metadata_patch ?? {}),
    redacted: true,
  }

  const rows = getRawRows<DeliveryHubShipmentRow>(
    await pg.raw(
      `
        update ${DELIVERY_HUB_SHIPMENTS_TABLE}
        set
          provider_status_summary = ?::jsonb,
          status_refresh_outcome = ?,
          status_refreshed_at = ?,
          metadata = ?::jsonb,
          updated_at = now()
        where execution_reference = ?
          and outcome = 'accepted'
          and status = 'dispatch_accepted'
          and accepted = true
          and succeeded = true
        returning *
      `,
      [
        JSON.stringify(input.provider_status_summary ?? {}),
        normalizeStatusRefreshOutcome(input.status_refresh_outcome),
        normalizeNullableText(input.status_refreshed_at) ?? new Date().toISOString(),
        JSON.stringify(metadataPatch),
        executionReference,
      ]
    )
  )

  return rows[0] ? normalizeDeliveryShipmentRow(rows[0]) : null
}

function normalizeDeliveryShipmentRow(row: DeliveryHubShipmentRow): DeliveryHubShipmentRecord {
  return {
    id: row.id,
    execution_reference: normalizeText(row.execution_reference, crypto.randomUUID()),
    idempotency_key: normalizeNullableText(row.idempotency_key),
    provider_code: normalizeText(row.provider_code, "deliveryhub"),
    connection_id: normalizeNullableText(row.connection_id),
    mode_code: normalizeNullableText(row.mode_code),
    order_id: normalizeNullableText(row.order_id),
    fulfillment_id: normalizeNullableText(row.fulfillment_id),
    cart_id: normalizeNullableText(row.cart_id),
    shipping_option_id: normalizeNullableText(row.shipping_option_id),
    location_id: normalizeNullableText(row.location_id),
    quote_reference_id: normalizeNullableText(row.quote_reference_id),
    quote_reference_version: normalizeNullableNumber(row.quote_reference_version),
    correlation_id: normalizeNullableText(row.correlation_id),
    outcome: normalizeOutcome(row.outcome),
    status: normalizeStatus(row.status),
    accepted: !!row.accepted,
    succeeded: !!row.succeeded,
    provider_shipment_reference_present: !!row.provider_shipment_reference_present,
    provider_correlation_reference_present: !!row.provider_correlation_reference_present,
    label_document_present: !!row.label_document_present,
    attachment_document_present: !!row.attachment_document_present,
    provider_status_summary: parseJsonObject(row.provider_status_summary),
    status_refresh_outcome: normalizeStatusRefreshOutcome(row.status_refresh_outcome),
    status_refreshed_at: normalizeIsoDate(row.status_refreshed_at),
    request_summary: parseJsonObject(row.request_summary),
    response_summary: parseJsonObject(row.response_summary),
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

function normalizeNullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : null
}

function normalizeOutcome(value: unknown): DeliveryHubShipmentPersistenceOutcome {
  return value === "failed" ? "failed" : "accepted"
}

function normalizeStatus(value: unknown): DeliveryHubShipmentPersistenceStatus {
  return value === "dispatch_failed" ? "dispatch_failed" : "dispatch_accepted"
}

function normalizeStatusRefreshOutcome(value: unknown): DeliveryHubShipmentStatusRefreshOutcome {
  if (value === "refreshed" || value === "failed") {
    return value
  }

  return "not_refreshed"
}

function isAcceptedShipmentForStatusUpdate(
  shipment: DeliveryHubShipmentRecord | null
): shipment is DeliveryHubShipmentRecord {
  return Boolean(
    shipment &&
      shipment.outcome === "accepted" &&
      shipment.status === "dispatch_accepted" &&
      shipment.accepted &&
      shipment.succeeded
  )
}

export function buildDeliveryHubShipmentPersistenceRequestSummary(input: {
  provider_code: string
  operation: "create_shipment"
  execution_reference: string | null
  idempotency_key: string | null
  mode_code: string | null
  order_id: string | null
  fulfillment_id: string | null
  cart_id: string | null
  quote_reference_id: string | null
  quote_reference_version: number | null
  country_code?: string | null
}) {
  return {
    provider_code: normalizeText(input.provider_code, "deliveryhub"),
    operation: input.operation,
    execution_reference_present: !!normalizeNullableText(input.execution_reference),
    idempotency_key_present: !!normalizeNullableText(input.idempotency_key),
    mode_code: normalizeNullableText(input.mode_code),
    order_id_present: !!normalizeNullableText(input.order_id),
    fulfillment_id_present: !!normalizeNullableText(input.fulfillment_id),
    cart_id_present: !!normalizeNullableText(input.cart_id),
    quote_reference_present: !!normalizeNullableText(input.quote_reference_id),
    quote_reference_version: normalizeNullableNumber(input.quote_reference_version),
    country_code: normalizeText(input.country_code, DELIVERY_HUB_DEFAULT_COUNTRY_CODE),
    redacted: true,
  }
}

export function buildDeliveryHubShipmentPersistenceResponseSummary(input: {
  outcome: DeliveryHubShipmentPersistenceOutcome
  status: DeliveryHubShipmentPersistenceStatus
  accepted: boolean
  succeeded: boolean
  status_category: string | null
  provider_shipment_reference_present: boolean
  provider_correlation_reference_present: boolean
  label_document_present: boolean
  attachment_document_present: boolean
  safe_message: string | null
}) {
  return {
    outcome: normalizeOutcome(input.outcome),
    status: normalizeStatus(input.status),
    accepted: !!input.accepted,
    succeeded: !!input.succeeded,
    status_category: normalizeNullableText(input.status_category),
    provider_shipment_reference_present: !!input.provider_shipment_reference_present,
    provider_correlation_reference_present: !!input.provider_correlation_reference_present,
    label_document_present: !!input.label_document_present,
    attachment_document_present: !!input.attachment_document_present,
    safe_message: normalizeNullableText(input.safe_message),
    redacted: true,
  }
}
