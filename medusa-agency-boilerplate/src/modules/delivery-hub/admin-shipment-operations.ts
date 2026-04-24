import { DELIVERY_HUB_PROVIDER_YANDEX } from "./constants"
import type { DeliveryConnectionRecord } from "./domain/connection"
import type {
  DeliveryHubAcceptedShipmentLifecycleSnapshot,
  DeliveryHubAcceptedShipmentLifecycleClassification,
} from "./shipment-lifecycle-read-model"
import type {
  DeliveryHubShipmentRecord,
  DeliveryHubShipmentStatusRefreshOutcome,
} from "./storage/shipments-repository"

export const DELIVERY_HUB_ADMIN_SHIPMENT_OPERATIONS_VIEW_VERSION = 1

export type DeliveryHubAdminShipmentOperationsBlockedReasonCode =
  | "accepted_shipment_required"
  | "accepted_shipment_snapshot_required"
  | "provider_not_supported"
  | "connection_required"
  | "connection_not_ready"
  | "provider_shipment_reference_required"

export type DeliveryHubAdminShipmentOperationsViewModel = {
  version: typeof DELIVERY_HUB_ADMIN_SHIPMENT_OPERATIONS_VIEW_VERSION
  safe: true
  reference: {
    lookup_kind: "execution_reference"
    execution_reference_preview: string | null
  }
  lifecycle: {
    classification: DeliveryHubAcceptedShipmentLifecycleClassification
    accepted: boolean
    blocked_reason_code: string | null
  }
  provider: {
    provider_code: string | null
    mode_code: string | null
    dispatch_status: string | null
    dispatch_outcome: string | null
    provider_shipment_reference_present: boolean
    provider_correlation_reference_present: boolean
  }
  status: {
    current: DeliveryHubAdminShipmentOperationsStatusSummary | null
    refresh: {
      available: boolean
      blocked_reason_code: DeliveryHubAdminShipmentOperationsBlockedReasonCode | null
      blocked_reason: string | null
      last_outcome: DeliveryHubShipmentStatusRefreshOutcome | null
      status_refreshed_at: string | null
    }
  }
  ledger: {
    linked: boolean
    state: string | null
    terminal_completed: boolean
    terminal_blocked: boolean
    execution_reference_preview: string | null
    idempotency_key_preview: string | null
    transition_count: number
    audit_event_count: number
  }
  shipment: {
    id: string | null
    accepted: boolean
    status: "dispatch_accepted" | null
    label_document_present: boolean
    attachment_document_present: boolean
  }
  context: {
    connection_id: string | null
    order_id: string | null
    fulfillment_id: string | null
    cart_id: string | null
    shipping_option_id: string | null
    location_id: string | null
    quote_reference: {
      id: string | null
      version: number | null
    }
    correlation_id_present: boolean
  }
  timestamps: {
    created_at: string | null
    updated_at: string | null
    status_refreshed_at: string | null
  }
  action_posture: {
    refresh_status: "available" | "blocked"
    cancel: "not_materialized"
    retry: "not_materialized"
    webhooks: "not_materialized"
    scheduler: "not_materialized"
  }
  anti_leak_confirmations: {
    raw_provider_payloads_included: false
    raw_provider_request_included: false
    raw_provider_response_included: false
    auth_headers_included: false
    credentials_included: false
    raw_quote_key_included: false
    raw_provider_identifier_included: false
    raw_execution_secret_included: false
  }
}

export type DeliveryHubAdminShipmentOperationsStatusSummary = {
  provider_code: typeof DELIVERY_HUB_PROVIDER_YANDEX | null
  operation: "get_shipment_status" | null
  attempted: boolean
  succeeded: boolean
  status_category: string | null
  neutral_status:
    | "accepted"
    | "in_transit"
    | "ready_for_pickup"
    | "delivered"
    | "cancelled"
    | "failed"
    | "returned"
    | "unknown"
    | null
  provider_status_known: boolean
  provider_status_present: boolean
  provider_status_normalized: string | null
  provider_status_code: number | null
  correlation_id_present: boolean
  provider_shipment_reference_present: boolean
  safe_message: string | null
  redacted: true
}

export function buildDeliveryHubAdminShipmentOperationsViewModel(input: {
  lifecycle: DeliveryHubAcceptedShipmentLifecycleSnapshot
  shipment: DeliveryHubShipmentRecord | null
  connection?: DeliveryConnectionRecord | null
}): DeliveryHubAdminShipmentOperationsViewModel {
  const shipment = input.shipment ?? null
  const lifecycle = input.lifecycle
  const refreshBlock = resolveStatusRefreshBlock({
    lifecycle,
    shipment,
    connection: input.connection ?? null,
  })
  const refreshAvailable = refreshBlock === null
  const statusSummary = buildSafeStatusSummary(shipment?.provider_status_summary ?? null)
  const statusRefreshedAt = shipment?.status_refreshed_at ?? null

  return {
    version: DELIVERY_HUB_ADMIN_SHIPMENT_OPERATIONS_VIEW_VERSION,
    safe: true,
    reference: {
      lookup_kind: "execution_reference",
      execution_reference_preview:
        lifecycle.ledger.execution_reference_preview ??
        (shipment ? maskReference(shipment.execution_reference) : null),
    },
    lifecycle: {
      classification: lifecycle.classification,
      accepted: lifecycle.accepted,
      blocked_reason_code: lifecycle.dispatch.blocked_reason_code,
    },
    provider: {
      provider_code: lifecycle.provider.provider_code,
      mode_code: lifecycle.provider.mode_code,
      dispatch_status: lifecycle.provider.dispatch_status,
      dispatch_outcome: lifecycle.provider.dispatch_outcome,
      provider_shipment_reference_present:
        lifecycle.provider.provider_shipment_reference_present,
      provider_correlation_reference_present:
        lifecycle.provider.provider_correlation_reference_present,
    },
    status: {
      current: statusSummary,
      refresh: {
        available: refreshAvailable,
        blocked_reason_code: refreshBlock?.code ?? null,
        blocked_reason: refreshBlock?.message ?? null,
        last_outcome: shipment?.status_refresh_outcome ?? null,
        status_refreshed_at: statusRefreshedAt,
      },
    },
    ledger: {
      linked: lifecycle.ledger.linked,
      state: lifecycle.ledger.state,
      terminal_completed: lifecycle.ledger.terminal_completed,
      terminal_blocked: lifecycle.ledger.terminal_blocked,
      execution_reference_preview: lifecycle.ledger.execution_reference_preview,
      idempotency_key_preview: lifecycle.ledger.idempotency_key_preview,
      transition_count: lifecycle.ledger.transition_count,
      audit_event_count: lifecycle.ledger.audit_event_count,
    },
    shipment: {
      id: lifecycle.shipment?.id ?? null,
      accepted: lifecycle.accepted,
      status: lifecycle.accepted ? "dispatch_accepted" : null,
      label_document_present: lifecycle.shipment?.label_document_present ?? false,
      attachment_document_present: lifecycle.shipment?.attachment_document_present ?? false,
    },
    context: lifecycle.context,
    timestamps: {
      created_at: lifecycle.timestamps.created_at,
      updated_at: lifecycle.timestamps.updated_at,
      status_refreshed_at: statusRefreshedAt,
    },
    action_posture: {
      refresh_status: refreshAvailable ? "available" : "blocked",
      cancel: "not_materialized",
      retry: "not_materialized",
      webhooks: "not_materialized",
      scheduler: "not_materialized",
    },
    anti_leak_confirmations: buildAntiLeakConfirmations(),
  }
}

function resolveStatusRefreshBlock(input: {
  lifecycle: DeliveryHubAcceptedShipmentLifecycleSnapshot
  shipment: DeliveryHubShipmentRecord | null
  connection: DeliveryConnectionRecord | null
}): { code: DeliveryHubAdminShipmentOperationsBlockedReasonCode; message: string } | null {
  if (!input.lifecycle.accepted || input.lifecycle.classification !== "accepted_shipment") {
    return {
      code: "accepted_shipment_required",
      message: "Status refresh is available only for accepted shipment lifecycle snapshots.",
    }
  }

  if (!isAcceptedShipment(input.shipment)) {
    return {
      code: "accepted_shipment_snapshot_required",
      message: "Status refresh requires a persisted accepted delivery_shipments record.",
    }
  }

  if (!input.connection) {
    return {
      code: "connection_required",
      message: "Status refresh requires the accepted shipment connection to be resolved.",
    }
  }

  if (input.connection.provider_code !== DELIVERY_HUB_PROVIDER_YANDEX) {
    return {
      code: "provider_not_supported",
      message: "Status refresh is currently available only for accepted Yandex Delivery shipments.",
    }
  }

  if (
    !input.connection.enabled ||
    input.connection.status !== "active" ||
    input.connection.credentials_state !== "sealed"
  ) {
    return {
      code: "connection_not_ready",
      message: "Status refresh is blocked because the accepted shipment connection is not active, enabled, and sealed.",
    }
  }

  if (!readProviderShipmentReference(input.shipment)) {
    return {
      code: "provider_shipment_reference_required",
      message: "Status refresh is blocked because no backend-only provider shipment reference is stored for polling.",
    }
  }

  return null
}

function buildSafeStatusSummary(
  value: Record<string, unknown> | null
): DeliveryHubAdminShipmentOperationsStatusSummary | null {
  if (!value || !Object.keys(value).length) {
    return null
  }

  return {
    provider_code: value.provider_code === DELIVERY_HUB_PROVIDER_YANDEX ? DELIVERY_HUB_PROVIDER_YANDEX : null,
    operation: value.operation === "get_shipment_status" ? "get_shipment_status" : null,
    attempted: value.attempted === true,
    succeeded: value.succeeded === true,
    status_category: normalizeNullableText(value.status_category),
    neutral_status: normalizeNeutralStatus(value.neutral_status),
    provider_status_known: value.provider_status_known === true,
    provider_status_present: value.provider_status_present === true,
    provider_status_normalized: normalizeNullableText(value.provider_status_normalized),
    provider_status_code:
      typeof value.provider_status_code === "number" && Number.isFinite(value.provider_status_code)
        ? Math.trunc(value.provider_status_code)
        : null,
    correlation_id_present: value.correlation_id_present === true,
    provider_shipment_reference_present: value.provider_shipment_reference_present === true,
    safe_message: normalizeNullableText(value.safe_message),
    redacted: true as const,
  }
}

function normalizeNeutralStatus(value: unknown): DeliveryHubAdminShipmentOperationsStatusSummary["neutral_status"] {
  switch (value) {
    case "accepted":
    case "in_transit":
    case "ready_for_pickup":
    case "delivered":
    case "cancelled":
    case "failed":
    case "returned":
    case "unknown":
      return value
    default:
      return null
  }
}

function readProviderShipmentReference(shipment: DeliveryHubShipmentRecord | null) {
  return (
    normalizeNullableText(shipment?.metadata.provider_shipment_reference) ??
    normalizeNullableText(shipment?.response_summary.provider_shipment_reference)
  )
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

function buildAntiLeakConfirmations() {
  return {
    raw_provider_payloads_included: false,
    raw_provider_request_included: false,
    raw_provider_response_included: false,
    auth_headers_included: false,
    credentials_included: false,
    raw_quote_key_included: false,
    raw_provider_identifier_included: false,
    raw_execution_secret_included: false,
  } as const
}

function normalizeNullableText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function maskReference(value: string | null | undefined) {
  const normalized = normalizeNullableText(value)

  if (!normalized) {
    return null
  }

  if (normalized.length <= 6) {
    return "***"
  }

  const masked = `${normalized.slice(0, 2)}***${normalized.slice(-2)}`
  return masked === normalized ? "***" : masked
}
