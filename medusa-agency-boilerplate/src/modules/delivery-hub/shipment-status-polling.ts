import { DELIVERY_HUB_PROVIDER_YANDEX } from "./constants"
import type { DeliveryConnectionRecord } from "./domain/connection"
import { YandexDeliveryClient } from "./adapters/yandex/client"
import {
  buildYandexShipmentStatusRequest,
  executeYandexShipmentStatusRefresh,
  type YandexShipmentStatusRefreshResult,
} from "./adapters/yandex/shipment-status"
import type { DeliveryHubAcceptedShipmentLifecycleSnapshot } from "./shipment-lifecycle-read-model"
import {
  recordDeliveryShipmentStatusUpdate,
  type DeliveryHubShipmentRecord,
} from "./storage/shipments-repository"
import type { DeliveryHubPgConnection } from "./storage/pg"

export const DELIVERY_HUB_SHIPMENT_STATUS_REFRESH_VERSION = 1

export type DeliveryHubShipmentStatusRefreshBlockedReasonCode =
  | "accepted_lifecycle_required"
  | "accepted_shipment_snapshot_required"
  | "provider_not_supported"
  | "connection_required"
  | "connection_not_ready"
  | "provider_shipment_reference_required"
  | "status_request_unavailable"
  | "pg_connection_required"

export type DeliveryHubShipmentStatusRefreshResult =
  | {
      version: typeof DELIVERY_HUB_SHIPMENT_STATUS_REFRESH_VERSION
      status: "blocked"
      provider_call_attempted: false
      blocked_reason_code: DeliveryHubShipmentStatusRefreshBlockedReasonCode
      blocked_reason: string
      lifecycle_classification: string | null
      accepted: false
      shipment: null
      provider_status: null
      persistence: {
        attempted: false
        performed: false
        outcome: "not_refreshed"
      }
      anti_leak_confirmations: DeliveryHubShipmentStatusRefreshAntiLeakConfirmations
    }
  | {
      version: typeof DELIVERY_HUB_SHIPMENT_STATUS_REFRESH_VERSION
      status: "refreshed"
      provider_call_attempted: true
      blocked_reason_code: null
      blocked_reason: null
      lifecycle_classification: "accepted_shipment"
      accepted: true
      shipment: DeliveryHubShipmentStatusRefreshShipmentSummary
      provider_status: DeliveryHubShipmentStatusRefreshProviderSummary
      persistence: {
        attempted: true
        performed: boolean
        outcome: "refreshed" | "failed"
        status_refreshed_at: string
      }
      anti_leak_confirmations: DeliveryHubShipmentStatusRefreshAntiLeakConfirmations
    }

export type DeliveryHubShipmentStatusRefreshShipmentSummary = {
  id: string
  execution_reference_preview: string | null
  connection_id: string | null
  mode_code: string | null
  accepted: true
  dispatch_status: "dispatch_accepted"
}

export type DeliveryHubShipmentStatusRefreshProviderSummary = {
  provider_code: typeof DELIVERY_HUB_PROVIDER_YANDEX
  operation: "get_shipment_status"
  attempted: boolean
  succeeded: boolean
  status_category: YandexShipmentStatusRefreshResult["status_category"]
  neutral_status: YandexShipmentStatusRefreshResult["neutral_status"]
  provider_status_known: boolean
  provider_status_present: boolean
  provider_status_normalized: string | null
  provider_status_code: number | null
  correlation_id_present: boolean
  provider_shipment_reference_present: boolean
  safe_message: string
  redacted: true
}

export type DeliveryHubShipmentStatusRefreshAntiLeakConfirmations = {
  raw_provider_payloads_included: false
  raw_provider_request_included: false
  raw_provider_response_included: false
  raw_yandex_response_body_included: false
  auth_headers_included: false
  credentials_included: false
  raw_quote_key_included: false
  raw_provider_identifier_included: false
}

export async function refreshDeliveryHubAcceptedShipmentStatus(input: {
  lifecycle: DeliveryHubAcceptedShipmentLifecycleSnapshot
  shipment: DeliveryHubShipmentRecord | null
  connection: DeliveryConnectionRecord | null
  pg_connection: DeliveryHubPgConnection | null
  correlation_id: string
  now?: () => string
  client?: Pick<YandexDeliveryClient, "post">
}): Promise<DeliveryHubShipmentStatusRefreshResult> {
  const blocked = validateAcceptedStatusRefreshInput(input)

  if (blocked) {
    return buildBlockedResult({
      lifecycle_classification: input.lifecycle?.classification ?? null,
      blocked_reason_code: blocked.code,
      blocked_reason: blocked.message,
    })
  }

  const shipment = input.shipment as DeliveryHubShipmentRecord
  const connection = input.connection as DeliveryConnectionRecord
  const providerShipmentReference = readProviderShipmentReference(shipment)
  const request = buildYandexShipmentStatusRequest({
    provider_shipment_reference: providerShipmentReference as string,
    correlation_id: input.correlation_id,
  })

  if (!request) {
    return buildBlockedResult({
      lifecycle_classification: input.lifecycle.classification,
      blocked_reason_code: "status_request_unavailable",
      blocked_reason: "Accepted shipment status polling is blocked because the Yandex status request could not be safely materialized.",
    })
  }

  const statusRefresh = await executeYandexShipmentStatusRefresh({
    client: input.client ?? new YandexDeliveryClient(connection),
    request,
  })
  const refreshedAt = normalizeTimestamp(input.now?.() ?? new Date().toISOString())
  const statusSummary = buildProviderStatusSummary(statusRefresh)
  const persistedShipment = input.pg_connection
    ? await recordDeliveryShipmentStatusUpdate(input.pg_connection, {
        execution_reference: shipment.execution_reference,
        provider_status_summary: statusSummary,
        status_refresh_outcome: statusRefresh.succeeded ? "refreshed" : "failed",
        status_refreshed_at: refreshedAt,
        metadata_patch: {
          last_status_refresh: {
            outcome: statusRefresh.succeeded ? "refreshed" : "failed",
            status_category: statusRefresh.status_category,
            neutral_status: statusRefresh.neutral_status,
            provider_status_known: statusRefresh.provider_status_known,
            provider_status_present: statusRefresh.provider_status_present,
            redacted: true,
          },
        },
      })
    : null

  return {
    version: DELIVERY_HUB_SHIPMENT_STATUS_REFRESH_VERSION,
    status: "refreshed",
    provider_call_attempted: true,
    blocked_reason_code: null,
    blocked_reason: null,
    lifecycle_classification: "accepted_shipment",
    accepted: true,
    shipment: {
      id: shipment.id,
      execution_reference_preview: maskReference(shipment.execution_reference),
      connection_id: shipment.connection_id,
      mode_code: shipment.mode_code,
      accepted: true,
      dispatch_status: "dispatch_accepted",
    },
    provider_status: statusSummary,
    persistence: {
      attempted: true,
      performed: persistedShipment !== null,
      outcome: statusRefresh.succeeded ? "refreshed" : "failed",
      status_refreshed_at: refreshedAt,
    },
    anti_leak_confirmations: buildAntiLeakConfirmations(),
  }
}

function validateAcceptedStatusRefreshInput(input: {
  lifecycle: DeliveryHubAcceptedShipmentLifecycleSnapshot
  shipment: DeliveryHubShipmentRecord | null
  connection: DeliveryConnectionRecord | null
  pg_connection: DeliveryHubPgConnection | null
}) {
  if (!input.lifecycle || input.lifecycle.classification !== "accepted_shipment" || !input.lifecycle.accepted) {
    return {
      code: "accepted_lifecycle_required" as const,
      message: "Yandex status polling is allowed only for accepted shipment lifecycle snapshots.",
    }
  }

  if (!isAcceptedShipment(input.shipment)) {
    return {
      code: "accepted_shipment_snapshot_required" as const,
      message: "Yandex status polling is allowed only for persisted accepted delivery_shipments records.",
    }
  }

  if (!input.pg_connection) {
    return {
      code: "pg_connection_required" as const,
      message: "Yandex status polling requires a shipment storage connection so the redacted status marker can be persisted.",
    }
  }

  if (!input.connection) {
    return {
      code: "connection_required" as const,
      message: "Yandex status polling requires the accepted shipment connection to be resolved before any provider call.",
    }
  }

  if (input.connection.provider_code !== DELIVERY_HUB_PROVIDER_YANDEX) {
    return {
      code: "provider_not_supported" as const,
      message: "Yandex status polling is available only for accepted shipments attached to a Yandex Delivery connection.",
    }
  }

  if (
    !input.connection.enabled ||
    input.connection.status !== "active" ||
    input.connection.credentials_state !== "sealed"
  ) {
    return {
      code: "connection_not_ready" as const,
      message: "Yandex status polling is blocked because the accepted shipment connection is not active, enabled, and sealed.",
    }
  }

  if (!readProviderShipmentReference(input.shipment)) {
    return {
      code: "provider_shipment_reference_required" as const,
      message: "Yandex status polling is blocked because the accepted shipment stores no backend-only provider shipment reference for polling.",
    }
  }

  return null
}

function buildProviderStatusSummary(
  statusRefresh: YandexShipmentStatusRefreshResult
): DeliveryHubShipmentStatusRefreshProviderSummary {
  return {
    provider_code: DELIVERY_HUB_PROVIDER_YANDEX,
    operation: "get_shipment_status",
    attempted: statusRefresh.attempted,
    succeeded: statusRefresh.succeeded,
    status_category: statusRefresh.status_category,
    neutral_status: statusRefresh.neutral_status,
    provider_status_known: statusRefresh.provider_status_known,
    provider_status_present: statusRefresh.provider_status_present,
    provider_status_normalized: statusRefresh.provider_status_normalized,
    provider_status_code: statusRefresh.provider_status_code,
    correlation_id_present: statusRefresh.correlation_id_present,
    provider_shipment_reference_present: statusRefresh.provider_shipment_reference_present,
    safe_message: statusRefresh.safe_message,
    redacted: true,
  }
}

function buildBlockedResult(input: {
  lifecycle_classification: string | null
  blocked_reason_code: DeliveryHubShipmentStatusRefreshBlockedReasonCode
  blocked_reason: string
}): DeliveryHubShipmentStatusRefreshResult {
  return {
    version: DELIVERY_HUB_SHIPMENT_STATUS_REFRESH_VERSION,
    status: "blocked",
    provider_call_attempted: false,
    blocked_reason_code: input.blocked_reason_code,
    blocked_reason: input.blocked_reason,
    lifecycle_classification: input.lifecycle_classification,
    accepted: false,
    shipment: null,
    provider_status: null,
    persistence: {
      attempted: false,
      performed: false,
      outcome: "not_refreshed",
    },
    anti_leak_confirmations: buildAntiLeakConfirmations(),
  }
}

function readProviderShipmentReference(shipment: DeliveryHubShipmentRecord | null) {
  const metadataReference = normalizeString(shipment?.metadata.provider_shipment_reference)
  const responseReference = normalizeString(shipment?.response_summary.provider_shipment_reference)

  return metadataReference ?? responseReference
}

function isAcceptedShipment(shipment: DeliveryHubShipmentRecord | null): shipment is DeliveryHubShipmentRecord {
  return Boolean(
    shipment &&
      shipment.outcome === "accepted" &&
      shipment.status === "dispatch_accepted" &&
      shipment.accepted &&
      shipment.succeeded
  )
}

function buildAntiLeakConfirmations(): DeliveryHubShipmentStatusRefreshAntiLeakConfirmations {
  return {
    raw_provider_payloads_included: false,
    raw_provider_request_included: false,
    raw_provider_response_included: false,
    raw_yandex_response_body_included: false,
    auth_headers_included: false,
    credentials_included: false,
    raw_quote_key_included: false,
    raw_provider_identifier_included: false,
  }
}

function normalizeTimestamp(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString()
}

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function maskReference(value: string | null | undefined) {
  const normalized = normalizeString(value)

  if (!normalized) {
    return null
  }

  if (normalized.length <= 6) {
    return "***"
  }

  const masked = `${normalized.slice(0, 2)}***${normalized.slice(-2)}`
  return masked === normalized ? "***" : masked
}
