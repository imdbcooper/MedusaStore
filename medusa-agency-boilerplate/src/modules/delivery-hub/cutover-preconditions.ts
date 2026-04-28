import { DELIVERY_HUB_LOG_KIND, DELIVERY_HUB_MODE_CODE, DELIVERY_HUB_PROVIDER_YANDEX } from "./constants"
import type { DeliveryConnectionRecord } from "./domain/connection"
import type { DeliveryWarehouseRecord } from "./domain/warehouse"
import type { DeliveryHubFulfillmentBridgePreview } from "./fulfillment-provider-bridge"
import type { DeliveryHubEventLogRecord } from "./storage/event-log-repository"
import {
  planDeliveryHubDesiredShippingOptions,
  type DeliveryHubShippingOptionPlan,
} from "./shipping-option-planner"

export const DELIVERY_HUB_CUTOVER_PRECONDITIONS_VERSION = 1

export const DELIVERY_HUB_CUTOVER_PRECONDITION_CODES = [
  "store_quote_contract_ready",
  "neutral_selection_ready",
  "preview_ui_ready",
  "browser_mock_smoke_ready",
  "rollback_plan_ready",
  "admin_yandex_quote_baseline_recorded",
  "fulfillment_bridge_preview_ready",
  "operator_approval_required",
  "shipment_lifecycle_not_enabled",
  "can_commit_shipping_method",
] as const

export const DELIVERY_HUB_CUTOVER_PRECONDITION_STATUSES = [
  "ready",
  "missing",
  "required",
  "blocked",
  "not_enabled",
] as const

export type DeliveryHubCutoverPreconditionCode =
  (typeof DELIVERY_HUB_CUTOVER_PRECONDITION_CODES)[number]

export type DeliveryHubCutoverPreconditionStatus =
  (typeof DELIVERY_HUB_CUTOVER_PRECONDITION_STATUSES)[number]

export type DeliveryHubCutoverPreconditionEvidence = {
  label: string
  status: DeliveryHubCutoverPreconditionStatus
}

export type DeliveryHubCutoverPrecondition = {
  code: DeliveryHubCutoverPreconditionCode
  label: string
  status: DeliveryHubCutoverPreconditionStatus
  ready: boolean
  detail: string
  evidence: DeliveryHubCutoverPreconditionEvidence[]
}

export type DeliveryHubCutoverPreconditionsSummary = {
  ready_count: number
  missing_count: number
  required_count: number
  blocked_count: number
  not_enabled_count: number
  total_count: number
}

export type DeliveryHubCutoverPreconditionsResponse = {
  ok: true
  version: typeof DELIVERY_HUB_CUTOVER_PRECONDITIONS_VERSION
  posture: "evidence_preflight_only"
  status: "preflight_only"
  can_commit_shipping_method: false
  summary: DeliveryHubCutoverPreconditionsSummary
  preconditions: DeliveryHubCutoverPrecondition[]
  guardrails: {
    checkout_source_of_truth: "unchanged"
    no_network_calls: true
    no_provider_payloads: true
    no_secret_material: true
    shipment_lifecycle_not_enabled: true
    can_commit_shipping_method: false
  }
}

export type DeliveryHubCutoverPreconditionsInput = {
  connections?: DeliveryConnectionRecord[]
  warehouses?: DeliveryWarehouseRecord[]
  shipping_option_plan?: DeliveryHubShippingOptionPlan | null
  fulfillment_bridge_preview?: DeliveryHubFulfillmentBridgePreview | null
  quote_event_logs?: DeliveryHubEventLogRecord[]
}

export function buildDeliveryHubCutoverPreconditions(
  input: DeliveryHubCutoverPreconditionsInput = {}
): DeliveryHubCutoverPreconditionsResponse {
  const connections = input.connections ?? []
  const warehouses = input.warehouses ?? []
  const shippingOptionPlan =
    input.shipping_option_plan ??
    planDeliveryHubDesiredShippingOptions({
      connections,
      warehouses,
    })
  const projectedModeCodes = shippingOptionPlan.desired_options.map((option) => option.mode_code)
  const hasWarehouseQuoteContract = projectedModeCodes.includes(
    DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint
  )
  const hasDropoffQuoteContract = projectedModeCodes.includes(
    DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint
  )
  const readyConnectionCount = new Set(
    shippingOptionPlan.desired_options.flatMap((option) => option.supporting_connection_ids)
  ).size
  const quoteBaseline = resolveAdminYandexQuoteBaseline(input.quote_event_logs ?? [])
  const bridgePreview = input.fulfillment_bridge_preview ?? null
  const bridgeReady = Boolean(
    bridgePreview &&
      bridgePreview.version === 1 &&
      bridgePreview.summary.mode_count >= 2 &&
      bridgePreview.summary.error_mode_count >= 0
  )

  const preconditions: DeliveryHubCutoverPrecondition[] = [
    buildPrecondition({
      code: "store_quote_contract_ready",
      label: "Store quote contract readiness",
      status:
        hasWarehouseQuoteContract && hasDropoffQuoteContract
          ? "ready"
          : projectedModeCodes.length
            ? "missing"
            : "missing",
      ready: hasWarehouseQuoteContract && hasDropoffQuoteContract,
      detail: hasWarehouseQuoteContract && hasDropoffQuoteContract
        ? "Read-only planner projects both first-tranche store quote modes from safe connection/warehouse state."
        : "Read-only planner does not yet project both first-tranche store quote modes from safe connection/warehouse state.",
      evidence: [
        {
          label: `projected_modes=${projectedModeCodes.join(",") || "none"}`,
          status: projectedModeCodes.length ? "ready" : "missing",
        },
        {
          label: `ready_connection_count=${readyConnectionCount}`,
          status: readyConnectionCount > 0 ? "ready" : "missing",
        },
      ],
    }),
    buildPrecondition({
      code: "neutral_selection_ready",
      label: "Neutral selection readiness",
      status: readyConnectionCount > 0 ? "ready" : "missing",
      ready: readyConnectionCount > 0,
      detail: readyConnectionCount > 0
        ? "Neutral selection storage/readiness can reference at least one shopper-visible Delivery Hub connection."
        : "Neutral selection contract exists, but no shopper-visible ready Delivery Hub connection is currently projected.",
      evidence: [
        {
          label: "GET/POST/DELETE /store/delivery/selection stays metadata-only and checkout-source unchanged",
          status: "ready",
        },
        {
          label: `shopper_visible_ready_connections=${readyConnectionCount}`,
          status: readyConnectionCount > 0 ? "ready" : "missing",
        },
      ],
    }),
    buildPrecondition({
      code: "preview_ui_ready",
      label: "Storefront preview/shadow UI readiness",
      status: "ready",
      ready: true,
      detail: "Preview/shadow UI is documented as an operator/dev validation surface and remains checkout-source neutral.",
      evidence: [
        {
          label: "delivery-hub-preview-shadow-block renders preview-only guardrails",
          status: "ready",
        },
      ],
    }),
    buildPrecondition({
      code: "browser_mock_smoke_ready",
      label: "Browser mock smoke readiness",
      status: "ready",
      ready: true,
      detail: "Browser smoke can validate preview quote/save/clear against mocked Store API without live provider calls.",
      evidence: [
        {
          label: "scripts/delivery-hub-preview-browser-smoke.mjs covers preview-only browser path",
          status: "ready",
        },
      ],
    }),
    buildPrecondition({
      code: "rollback_plan_ready",
      label: "Rollback/no-fallback plan readiness",
      status: "ready",
      ready: true,
      detail: "Cutover plan keeps Delivery Hub checkout fail-closed when readiness is blocked and does not require a legacy delivery fallback.",
      evidence: [
        {
          label: "Docs/current_work.md documents default-off/no-fallback fail-closed posture",
          status: "ready",
        },
      ],
    }),
    buildPrecondition({
      code: "admin_yandex_quote_baseline_recorded",
      label: "Admin Yandex quote baseline evidence",
      status: quoteBaseline.ready ? "ready" : "missing",
      ready: quoteBaseline.ready,
      detail: quoteBaseline.ready
        ? "Stored sanitized quote event-log summaries record successful Yandex quote baselines for both first-tranche modes."
        : "Stored sanitized quote event-log summaries do not yet show both first-tranche Yandex quote baselines.",
      evidence: [
        {
          label: `warehouse_to_pickup_point_success=${quoteBaseline.warehouse_to_pickup_point_success}`,
          status: quoteBaseline.warehouse_to_pickup_point_success ? "ready" : "missing",
        },
        {
          label: `dropoff_point_to_pickup_point_success=${quoteBaseline.dropoff_point_to_pickup_point_success}`,
          status: quoteBaseline.dropoff_point_to_pickup_point_success ? "ready" : "missing",
        },
      ],
    }),
    buildPrecondition({
      code: "fulfillment_bridge_preview_ready",
      label: "Fulfillment bridge preview readiness",
      status: bridgeReady ? "ready" : "missing",
      ready: bridgeReady,
      detail: bridgeReady
        ? "Diagnostic-only fulfillment bridge preview is available and remains mutation-free."
        : "Diagnostic-only fulfillment bridge preview was not available from the read-only preflight snapshot.",
      evidence: [
        {
          label: `preview_mode_count=${bridgePreview?.summary.mode_count ?? 0}`,
          status: bridgeReady ? "ready" : "missing",
        },
        {
          label: `projected_mode_count=${bridgePreview?.summary.projected_mode_count ?? 0}`,
          status: (bridgePreview?.summary.projected_mode_count ?? 0) > 0 ? "ready" : "missing",
        },
        {
          label: `deferred_mode_count=${bridgePreview?.summary.deferred_mode_count ?? 0}`,
          status: (bridgePreview?.summary.deferred_mode_count ?? 0) > 0 ? "required" : "ready",
        },
      ],
    }),
    buildPrecondition({
      code: "operator_approval_required",
      label: "Operator approval required",
      status: "required",
      ready: false,
      detail: "A separate approved checkout cutover implementation tranche is still required before commit can be enabled.",
      evidence: [
        {
          label: "approval_gate=required_future_cutover_tranche",
          status: "required",
        },
      ],
    }),
    buildPrecondition({
      code: "shipment_lifecycle_not_enabled",
      label: "Shipment lifecycle remains disabled",
      status: "not_enabled",
      ready: true,
      detail: "Shipment create/cancel/status/retry lifecycle is intentionally not enabled by this verifier.",
      evidence: [
        {
          label: "shipment_lifecycle_not_enabled=true",
          status: "not_enabled",
        },
      ],
    }),
    buildPrecondition({
      code: "can_commit_shipping_method",
      label: "Shipping-method commit remains blocked",
      status: "blocked",
      ready: false,
      detail: "can_commit_shipping_method=false; verifier aggregates evidence only and cannot commit Delivery Hub shipping methods.",
      evidence: [
        {
          label: "can_commit_shipping_method=false",
          status: "blocked",
        },
      ],
    }),
  ]

  return {
    ok: true,
    version: DELIVERY_HUB_CUTOVER_PRECONDITIONS_VERSION,
    posture: "evidence_preflight_only",
    status: "preflight_only",
    can_commit_shipping_method: false,
    summary: buildSummary(preconditions),
    preconditions,
    guardrails: {
      checkout_source_of_truth: "unchanged",
      no_network_calls: true,
      no_provider_payloads: true,
      no_secret_material: true,
      shipment_lifecycle_not_enabled: true,
      can_commit_shipping_method: false,
    },
  }
}

function buildPrecondition(input: DeliveryHubCutoverPrecondition): DeliveryHubCutoverPrecondition {
  return input
}

function buildSummary(
  preconditions: DeliveryHubCutoverPrecondition[]
): DeliveryHubCutoverPreconditionsSummary {
  return {
    ready_count: preconditions.filter((entry) => entry.ready).length,
    missing_count: preconditions.filter((entry) => entry.status === "missing").length,
    required_count: preconditions.filter((entry) => entry.status === "required").length,
    blocked_count: preconditions.filter((entry) => entry.status === "blocked").length,
    not_enabled_count: preconditions.filter((entry) => entry.status === "not_enabled").length,
    total_count: preconditions.length,
  }
}

function resolveAdminYandexQuoteBaseline(logs: DeliveryHubEventLogRecord[]) {
  const successfulYandexQuoteLogs = logs.filter(
    (log) =>
      log.provider_code === DELIVERY_HUB_PROVIDER_YANDEX &&
      log.kind === DELIVERY_HUB_LOG_KIND.quote &&
      log.success
  )
  const successfulModes = new Set(
    successfulYandexQuoteLogs
      .map((log) => readModeCode(log.request_summary?.mode_code))
      .filter((modeCode): modeCode is string => !!modeCode)
  )
  const warehouseSuccess = successfulModes.has(DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint)
  const dropoffSuccess = successfulModes.has(DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint)

  return {
    ready: warehouseSuccess && dropoffSuccess,
    warehouse_to_pickup_point_success: warehouseSuccess,
    dropoff_point_to_pickup_point_success: dropoffSuccess,
  }
}

function readModeCode(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}
