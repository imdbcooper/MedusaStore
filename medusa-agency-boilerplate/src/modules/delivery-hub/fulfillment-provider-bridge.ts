import { MedusaError } from "@medusajs/framework/utils"
import {
  buildDeliveryHubExecutionLedgerRepositoryAssemblyReadinessSummary,
  type DeliveryHubExecutionLedgerRepositoryAssemblyReadinessSummary,
} from "./storage/execution-ledger-repository-assembly-scaffold"
import {
  createDeliveryHubQuoteReference,
  type DeliveryHubCartSelectionPublic,
} from "./cart-selection"
import { redactRecord } from "./security/redaction"
import {
  buildDeliveryHubCalculatedPriceData,
  normalizeDeliveryHubFulfillmentData,
  normalizeDeliveryHubFulfillmentOptionData,
  parseDeliveryHubFulfillmentData,
  type DeliveryHubFulfillmentOptionData,
  type DeliveryHubFulfillmentSelectionData,
} from "./provider-surface"
import {
  buildDeliveryHubShippingOptionData,
  DELIVERY_HUB_FULFILLMENT_OPTION_DEFINITIONS,
  DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
  DELIVERY_HUB_FULFILLMENT_PROVIDER_ID,
  type DeliveryHubFulfillmentModeCode,
} from "./shipping-option-contract"
import {
  DELIVERY_HUB_CONTROLLED_EXECUTION_CONTRACT_VERSION,
  DELIVERY_HUB_EXECUTION_STATE,
  buildDeliveryHubControlledExecutionAuditDraft,
  buildDeliveryHubControlledExecutionIdentity,
  buildDeliveryHubControlledExecutionRecordDraft,
  buildDeliveryHubControlledExecutionReservationDraft,
  type DeliveryHubControlledExecutionIdentity,
  type DeliveryHubControlledExecutionRecordDraft,
  type DeliveryHubExecutionAuditDraft,
  type DeliveryHubExecutionReservationDraft,
} from "./shipment-execution-contract"

export const DELIVERY_HUB_FULFILLMENT_BRIDGE_VERSION = 1
export const DELIVERY_HUB_FULFILLMENT_BRIDGE_PREVIEW_VERSION = 1
export const DELIVERY_HUB_CREATE_FULFILLMENT_DIAGNOSTIC_VERSION = 1
export const DELIVERY_HUB_FULFILLMENT_CONTRACT_VERDICT_VERSION = 1
export const DELIVERY_HUB_PROVIDER_EXECUTION_PLAN_VERSION = 1
export const DELIVERY_HUB_EXECUTION_PLAN_PREVIEW_VERSION = 1
export const DELIVERY_HUB_EXECUTION_IDENTITY_PREVIEW_VERSION =
  DELIVERY_HUB_CONTROLLED_EXECUTION_CONTRACT_VERSION
export const DELIVERY_HUB_EXECUTION_PERSISTENCE_AUDIT_PREVIEW_VERSION = 1
export const DELIVERY_HUB_EXECUTION_PREFLIGHT_ELIGIBILITY_PREVIEW_VERSION = 1
export const DELIVERY_HUB_EXECUTION_PLAN_OBSERVABILITY_PREVIEW_VERSION = 1
export const DELIVERY_HUB_PROVIDER_DISPATCH_PREVIEW_VERSION = 1
export const DELIVERY_HUB_SHIPMENT_RESULT_PREVIEW_VERSION = 1
export const DELIVERY_HUB_FAILURE_HANDLING_PREVIEW_VERSION = 1
export const DELIVERY_HUB_FULFILLMENT_APPLICATION_PREVIEW_VERSION = 1

export type DeliveryHubFulfillmentBridgePayload = {
  version: typeof DELIVERY_HUB_FULFILLMENT_BRIDGE_VERSION
  option: DeliveryHubFulfillmentOptionData
  fulfillment_data: DeliveryHubFulfillmentSelectionData
  calculated_price_data: ReturnType<typeof buildDeliveryHubCalculatedPriceData>
}

export type DeliveryHubCreateFulfillmentBridgeItem = {
  line_item_id: string | null
  quantity: number
}

export type DeliveryHubCreateFulfillmentBridgeOrder = {
  id: string | null
  display_id: string | number | null
  currency_code: string | null
}

export type DeliveryHubCreateFulfillmentBridgeFulfillment = {
  id: string | null
  location_id: string | null
}

export type DeliveryHubCreateFulfillmentBridgePayload = {
  version: typeof DELIVERY_HUB_FULFILLMENT_BRIDGE_VERSION
  delivery: DeliveryHubFulfillmentBridgePayload
  order: DeliveryHubCreateFulfillmentBridgeOrder
  fulfillment: DeliveryHubCreateFulfillmentBridgeFulfillment
  items: DeliveryHubCreateFulfillmentBridgeItem[]
}

export type DeliveryHubCreateFulfillmentBridgeDiagnosticIssue = {
  code:
    | "DELIVERY_HUB_MISSING_FULFILLMENT_DATA"
    | "DELIVERY_HUB_INVALID_FULFILLMENT_DATA"
    | "DELIVERY_HUB_INVALID_ITEMS"
    | "DELIVERY_HUB_PROVIDER_DRIFT"
    | "DELIVERY_HUB_SHAPE_DRIFT"
  message: string
  field_path: string | null
}

export type DeliveryHubCreateFulfillmentBridgeDiagnosticStep = {
  key:
    | "delivery_payload"
    | "order_context"
    | "fulfillment_context"
    | "items"
    | "create_fulfillment_payload"
    | "shipment_execution"
  ready: boolean
  message: string
}

export type DeliveryHubFulfillmentContractVerdict = {
  version: typeof DELIVERY_HUB_FULFILLMENT_CONTRACT_VERDICT_VERSION
  contract_status: "ready" | "blocked"
  blocked_reasons: string[]
  issues: DeliveryHubCreateFulfillmentBridgeDiagnosticIssue[]
  normalized: {
    delivery: DeliveryHubFulfillmentBridgePayload | null
  }
}

export type DeliveryHubCreateFulfillmentBridgeDiagnostic = {
  version: typeof DELIVERY_HUB_CREATE_FULFILLMENT_DIAGNOSTIC_VERSION
  contract_status: "ready" | "blocked"
  execution_status: "blocked"
  blocked_reasons: string[]
  issues: DeliveryHubCreateFulfillmentBridgeDiagnosticIssue[]
  steps: DeliveryHubCreateFulfillmentBridgeDiagnosticStep[]
  normalized: {
    delivery: DeliveryHubFulfillmentBridgePayload | null
    order: DeliveryHubCreateFulfillmentBridgeOrder | null
    fulfillment: DeliveryHubCreateFulfillmentBridgeFulfillment | null
    items: DeliveryHubCreateFulfillmentBridgeItem[] | null
    create_fulfillment_payload: DeliveryHubCreateFulfillmentBridgePayload | null
  }
  shipment_execution: {
    materialized: false
    reason: string
  }
}

export type DeliveryHubProviderExecutionPlan = {
  version: typeof DELIVERY_HUB_PROVIDER_EXECUTION_PLAN_VERSION
  provider_code: typeof DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE
  provider_id: typeof DELIVERY_HUB_FULFILLMENT_PROVIDER_ID
  operation: "create_shipment"
  connection_id: string
  mode_code: DeliveryHubFulfillmentModeCode
  quote_reference: DeliveryHubFulfillmentSelectionData["quote_reference"]
  order: DeliveryHubCreateFulfillmentBridgeOrder
  fulfillment: DeliveryHubCreateFulfillmentBridgeFulfillment
  items: DeliveryHubCreateFulfillmentBridgeItem[]
  outbound_request: {
    method: "POST"
    path: "/shipments"
    headers: {
      authorization: string
      "content-type": "application/json"
    }
    body: {
      provider_code: typeof DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE
      provider_id: typeof DELIVERY_HUB_FULFILLMENT_PROVIDER_ID
      connection_id: string
      mode_code: DeliveryHubFulfillmentModeCode
      quote_reference: DeliveryHubFulfillmentSelectionData["quote_reference"]
      order: DeliveryHubCreateFulfillmentBridgeOrder
      fulfillment: DeliveryHubCreateFulfillmentBridgeFulfillment
      items: DeliveryHubCreateFulfillmentBridgeItem[]
      quote: DeliveryHubFulfillmentSelectionData["quote"]
      pickup_point: DeliveryHubFulfillmentSelectionData["pickup_point"]
      pickup_window: DeliveryHubFulfillmentSelectionData["pickup_window"]
    }
  }
}

export type DeliveryHubShipmentExecutionPlanPreviewStep = {
  key:
    | "delivery_payload"
    | "order_context"
    | "fulfillment_context"
    | "items"
    | "provider_execution_plan"
    | "execution_identity"
    | "outbound_payload_preview"
    | "persistence_audit_preview"
    | "preflight_eligibility"
    | "provider_dispatch_preview"
    | "shipment_result_preview"
    | "failure_handling_preview"
    | "fulfillment_application_preview"
    | "shipment_execution"
  ready: boolean
  message: string
}

export type DeliveryHubShipmentResultPreview = {
  version: typeof DELIVERY_HUB_SHIPMENT_RESULT_PREVIEW_VERSION
  redacted: true
  current_mode: "preview_only"
  result_decision: "projected_for_future_execution" | "not_materialized"
  projected_result_status: "projected_for_future_execution" | "not_materialized"
  result_kind: "shipment_result"
  normalization_target: "deliveryhub_shipment_result"
  provider_normalization_target: "create_shipment_response"
  identity_linkage: {
    provider_operation_reference: string | null
    idempotency_key_preview: string | null
    plan_fingerprint: string | null
    execution_fingerprint: string | null
  }
  artifact_summary: {
    external_shipment_reference_present: boolean
    tracking_reference_present: boolean
    label_document_present: boolean
    pickup_booking_present: boolean
    pickup_interval_present: boolean
    status_timeline_present: boolean
    failure_placeholder_present: boolean
    rollback_placeholder_present: boolean
  }
  blocked_materialization_actions: Array<{
    code: string
    label: string
    reason: string
    blocked: true
  }>
  confirmations: {
    provider_response_fetch_disabled: true
    adapter_invocation_disabled: true
    shipment_creation_disabled: true
    label_persistence_disabled: true
    order_mutation_disabled: true
    fulfillment_persistence_disabled: true
    checkout_cutover_disabled: true
  }
}

export type DeliveryHubFailureHandlingPreview = {
  version: typeof DELIVERY_HUB_FAILURE_HANDLING_PREVIEW_VERSION
  redacted: true
  current_mode: "preview_only"
  failure_path_decision: "projected_retry_policy" | "no_live_failure_path"
  projected_failure_status: "manual_intervention_required_when_enabled" | "not_applicable_in_preview"
  failure_classes: Array<{
    code:
      | "provider_dispatch_failure"
      | "provider_timeout"
      | "provider_response_invalid"
      | "shipment_result_rejected"
      | "application_projection_blocked"
    retry_eligibility: "eligible_when_enabled" | "blocked"
    compensation_requirement: "required_when_enabled" | "not_required"
    manual_intervention: "required_when_enabled" | "not_required"
    reason_bucket:
      | "dispatch_transport"
      | "provider_timeout"
      | "response_normalization"
      | "result_semantics"
      | "application_projection"
  }>
  identity_linkage: {
    provider_operation_reference: string | null
    idempotency_key_preview: string | null
    plan_fingerprint: string | null
    execution_fingerprint: string | null
  }
  retry_projection: {
    eligibility: "eligible_when_enabled" | "blocked"
    policy: "deterministic_preview_only"
    retry_block_reasons: string[]
    scheduling_status: "disabled"
  }
  compensation_projection: {
    requirement: "required_when_enabled" | "not_required"
    write_plan_status: "disabled"
    rollback_status: "disabled"
    blocked_actions: string[]
  }
  manual_intervention_projection: {
    status: "required_when_enabled" | "not_required"
    reason_markers: string[]
  }
  blocked_failure_actions: Array<{
    code: string
    label: string
    reason: string
    blocked: true
  }>
  confirmations: {
    retry_scheduling_disabled: true
    rollback_disabled: true
    compensation_writes_disabled: true
    order_mutation_disabled: true
    fulfillment_mutation_disabled: true
    event_persistence_disabled: true
    provider_redispatch_disabled: true
    checkout_cutover_disabled: true
  }
}

export type DeliveryHubFulfillmentApplicationPreview = {
  version: typeof DELIVERY_HUB_FULFILLMENT_APPLICATION_PREVIEW_VERSION
  redacted: true
  current_mode: "preview_only"
  application_decision: "projected_for_future_application" | "not_applied"
  projected_application_status: "projected_for_future_application" | "not_applied"
  application_target: "medusa_fulfillment_mutation_plan"
  application_scope: "backend_admin_only"
  mutation_semantics: {
    fulfillment_data_patch_present: boolean
    shipment_reference_linkage_present: boolean
    tracking_projection_present: boolean
    label_document_reference_linkage_present: boolean
    status_transition_application_present: boolean
    audit_linkage_present: boolean
  }
  identity_linkage: {
    provider_operation_reference: string | null
    idempotency_key_preview: string | null
    plan_fingerprint: string | null
    execution_fingerprint: string | null
  }
  persistence_linkage: {
    execution_reference_present: boolean
    idempotency_reservation_present: boolean
    audit_log_reference_present: boolean
  }
  blocked_application_actions: Array<{
    code: string
    label: string
    reason: string
    blocked: true
  }>
  confirmations: {
    order_mutation_disabled: true
    fulfillment_persistence_disabled: true
    shipment_persistence_disabled: true
    label_persistence_disabled: true
    event_persistence_disabled: true
    checkout_cutover_disabled: true
  }
}

export type DeliveryHubExecutionLifecyclePhaseCode =
  | "preflight_eligibility"
  | "provider_dispatch"
  | "shipment_result_normalization"
  | "fulfillment_application"
  | "failure_handling"

export type DeliveryHubExecutionLifecyclePreview = {
  version: 1
  redacted: true
  current_mode: "preview_only"
  lifecycle_status: "projected_for_future_execution" | "blocked_in_preview"
  readiness_posture: "ready_when_enabled" | "blocked_in_preview"
  phase_sequence: DeliveryHubExecutionLifecyclePhaseCode[]
  identity_correlation: {
    provider_operation_reference: string | null
    idempotency_key_preview: string | null
    plan_fingerprint: string | null
    execution_fingerprint: string | null
  }
  phases: Array<{
    code: DeliveryHubExecutionLifecyclePhaseCode
    order: number
    status: "projected_for_future_execution" | "blocked_in_preview"
    readiness_posture: "ready_when_enabled" | "blocked_in_preview"
    block_reasons: string[]
    disabled_live_actions: string[]
    linked_preview_artifacts: string[]
  }>
  confirmations: {
    preview_only: true
    orchestration_scheduling_disabled: true
    shipment_execution_disabled: true
    provider_calls_disabled: true
    persistence_writes_disabled: true
    retry_scheduling_disabled: true
    compensation_writes_disabled: true
    order_mutation_disabled: true
    fulfillment_mutation_disabled: true
    checkout_cutover_disabled: true
  }
}

export type DeliveryHubExecutionPreflightEligibilityPreview = {
  version: typeof DELIVERY_HUB_EXECUTION_PREFLIGHT_ELIGIBILITY_PREVIEW_VERSION
  redacted: true
  current_mode: "preview_only"
  decision: "eligible_when_enabled" | "not_ready"
  real_execution_enabled: false
  future_execution_flag: {
    name: "DELIVERY_HUB_SHIPMENT_EXECUTION_ENABLED"
    status: "future_inert_not_read"
    description: string
  }
  reasons: Array<{
    code: string
    message: string
  }>
  required_prerequisites: Array<{
    code: string
    label: string
    status: "required_future_work"
  }>
  confirmations: {
    shipment_execution_disabled: true
    provider_calls_disabled: true
    persistence_writes_disabled: true
    checkout_cutover_disabled: true
  }
  blocked_live_actions: Array<{
    code: string
    label: string
    blocked: true
  }>
}

export type DeliveryHubExecutionIdentityPreview = {
  version: typeof DELIVERY_HUB_EXECUTION_IDENTITY_PREVIEW_VERSION
  redacted: true
  operation: "create_shipment"
  provider_operation_label: string
  provider_operation_reference: string
  plan_fingerprint: string
  execution_fingerprint: string
  idempotency_key_preview: string
}

export type DeliveryHubProviderDispatchPreview = {
  version: typeof DELIVERY_HUB_PROVIDER_DISPATCH_PREVIEW_VERSION
  redacted: true
  current_mode: "preview_only"
  dispatch_decision: "ready_for_future_dispatch" | "not_dispatched"
  provider: {
    provider_code: typeof DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE
    provider_id: typeof DELIVERY_HUB_FULFILLMENT_PROVIDER_ID
    provider_key: typeof DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE
    adapter_operation: "create_shipment"
    adapter_operation_label: string
  }
  command_identity: {
    provider_operation_reference: string | null
    idempotency_key_preview: string | null
    plan_fingerprint: string | null
    execution_fingerprint: string | null
  }
  command_envelope_summary: {
    connection_id_present: boolean
    mode_code: DeliveryHubFulfillmentModeCode | null
    origin_kind: "fulfillment_location" | "dropoff_point" | "unknown"
    destination_kind: "pickup_point" | "unknown"
    quote_reference_present: boolean
    offer_reference_present: boolean
    package_reference_present: boolean
    order_reference_present: boolean
    fulfillment_reference_present: boolean
    pickup_scheduling_reference_present: boolean
    dropoff_scheduling_reference_present: boolean
    item_count: number
  }
  blocked_dispatch_actions: Array<{
    code: string
    label: string
    reason: string
    blocked: true
  }>
  confirmations: {
    adapter_invocation_disabled: true
    provider_network_calls_disabled: true
    shipment_creation_disabled: true
    label_creation_disabled: true
    order_mutation_disabled: true
    persistence_writes_disabled: true
    checkout_cutover_disabled: true
  }
}

export type DeliveryHubExecutionPersistenceAuditPreview = {
  version: typeof DELIVERY_HUB_EXECUTION_PERSISTENCE_AUDIT_PREVIEW_VERSION
  redacted: true
  status: "ready" | "blocked"
  metadata_patch: {
    target: "fulfillment_execution_shadow"
    action: "merge"
    fields: Array<{
      field: string
      value_preview: string
    }>
  }
  execution_record: {
    ready: boolean
    draft: DeliveryHubControlledExecutionRecordDraft | null
    record_type: "deliveryhub_shipment_execution"
    operation: "create_shipment"
    provider_code: typeof DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE
    provider_id: typeof DELIVERY_HUB_FULFILLMENT_PROVIDER_ID
    connection_id: string | null
    mode_code: DeliveryHubFulfillmentModeCode | null
    execution_reference: string | null
    idempotency_key_preview: string | null
    initial_status: string | null
  }
  idempotency_reservation: {
    ready: boolean
    draft: DeliveryHubExecutionReservationDraft | null
    dedupe_scope: "deliveryhub:create_shipment"
    reservation_key_preview: string | null
    reservation_fingerprint: string | null
    matched_fields: Array<{
      field: string
      value_preview: string
    }>
  }
  status_transitions: Array<{
    from: string
    to: string
    reason: string
  }>
  audit_log_entries: DeliveryHubExecutionAuditDraft[]
  blocked: Array<{
    key: string
    reason: string
  }>
  deferred: Array<{
    key: string
    reason: string
  }>
}

export type DeliveryHubShipmentExecutionPlanPreview = {
  version: typeof DELIVERY_HUB_EXECUTION_PLAN_PREVIEW_VERSION
  contract_status: "ready" | "blocked"
  execution_status: "blocked"
  readiness_verdict: {
    status: "ready" | "blocked"
    blocked_reasons: string[]
  }
  repository_assembly_summary: DeliveryHubExecutionLedgerRepositoryAssemblyReadinessSummary
  blocked_reasons: string[]
  issues: DeliveryHubCreateFulfillmentBridgeDiagnosticIssue[]
  steps: DeliveryHubShipmentExecutionPlanPreviewStep[]
  normalized: {
    delivery: DeliveryHubFulfillmentBridgePayload | null
    order: DeliveryHubCreateFulfillmentBridgeOrder | null
    fulfillment: DeliveryHubCreateFulfillmentBridgeFulfillment | null
    items: DeliveryHubCreateFulfillmentBridgeItem[] | null
    create_fulfillment_payload: DeliveryHubCreateFulfillmentBridgePayload | null
    provider_execution_plan: DeliveryHubProviderExecutionPlan | null
  }
  execution_identity: DeliveryHubExecutionIdentityPreview | null
  outbound_payload_preview: {
    redacted: true
    request: Record<string, unknown> | null
  }
  persistence_audit_preview: DeliveryHubExecutionPersistenceAuditPreview
  preflight_eligibility: DeliveryHubExecutionPreflightEligibilityPreview
  provider_dispatch_preview: DeliveryHubProviderDispatchPreview
  shipment_result_preview: DeliveryHubShipmentResultPreview
  failure_handling_preview: DeliveryHubFailureHandlingPreview
  fulfillment_application_preview: DeliveryHubFulfillmentApplicationPreview
  execution_lifecycle_preview: DeliveryHubExecutionLifecyclePreview
  shipment_execution: {
    materialized: false
    reason: string
  }
}

export type DeliveryHubExecutionPlanObservabilityPlan = {
  version: typeof DELIVERY_HUB_PROVIDER_EXECUTION_PLAN_VERSION
  operation: "create_shipment"
  connection_id: string
  mode_code: DeliveryHubFulfillmentModeCode
  quote_reference: DeliveryHubFulfillmentSelectionData["quote_reference"]
  order: DeliveryHubCreateFulfillmentBridgeOrder
  fulfillment: DeliveryHubCreateFulfillmentBridgeFulfillment
  items: DeliveryHubCreateFulfillmentBridgeItem[]
  outbound_request: {
    method: "POST"
    path: "/shipments"
    headers: {
      authorization: string
      "content-type": "application/json"
    }
  }
}

export type DeliveryHubExecutionPlanObservabilityModePreview = {
  mode_code: DeliveryHubFulfillmentModeCode
  status: "ready" | "blocked"
  rollout_status: "projected" | "deferred" | "unconfigured"
  supporting_connection_ids: string[]
  blocking_issues: DeliveryHubFulfillmentBridgePlannerIssue[]
  readiness_verdict: {
    status: "ready" | "blocked"
    blocked_reasons: string[]
  }
  blocked_reasons: string[]
  issues: DeliveryHubCreateFulfillmentBridgeDiagnosticIssue[]
  repository_assembly_summary: DeliveryHubExecutionLedgerRepositoryAssemblyReadinessSummary
  steps: DeliveryHubShipmentExecutionPlanPreviewStep[]
  execution_plan: DeliveryHubExecutionPlanObservabilityPlan | null
  execution_identity: DeliveryHubExecutionIdentityPreview | null
  outbound_payload_preview: {
    redacted: true
    request: Record<string, unknown> | null
  }
  persistence_audit_preview: DeliveryHubExecutionPersistenceAuditPreview
  preflight_eligibility: DeliveryHubExecutionPreflightEligibilityPreview
  provider_dispatch_preview: DeliveryHubProviderDispatchPreview
  shipment_result_preview: DeliveryHubShipmentResultPreview
  failure_handling_preview: DeliveryHubFailureHandlingPreview
  fulfillment_application_preview: DeliveryHubFulfillmentApplicationPreview
  execution_lifecycle_preview: DeliveryHubExecutionLifecyclePreview
  shipment_execution: {
    materialized: false
    reason: string
  }
}

export type DeliveryHubExecutionPlanObservabilityPreview = {
  version: typeof DELIVERY_HUB_EXECUTION_PLAN_OBSERVABILITY_PREVIEW_VERSION
  provider_code: typeof DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE
  provider_id: typeof DELIVERY_HUB_FULFILLMENT_PROVIDER_ID
  mode_previews: DeliveryHubExecutionPlanObservabilityModePreview[]
  summary: {
    mode_count: number
    ready_mode_count: number
    blocked_mode_count: number
    projected_mode_count: number
    deferred_mode_count: number
    unconfigured_mode_count: number
  }
}

export type DeliveryHubFulfillmentBridgePlannerIssue = {
  connection_id: string
  provider_code: string
  code: string
  message: string
  mode_code: string | null
}

export type DeliveryHubFulfillmentBridgePreviewStep = {
  key:
    | "shipping_option_contract"
    | "fulfillment_payload"
    | "calculated_price_data"
    | "create_fulfillment_payload"
  ready: boolean
  message: string
}

export type DeliveryHubFulfillmentBridgePreviewMode = {
  mode_code: DeliveryHubFulfillmentModeCode
  status: "ready" | "error"
  rollout_status: "projected" | "deferred" | "unconfigured"
  supporting_connection_ids: string[]
  blocking_issues: DeliveryHubFulfillmentBridgePlannerIssue[]
  steps: DeliveryHubFulfillmentBridgePreviewStep[]
  selection: DeliveryHubCartSelectionPublic | null
  shipping_option_data: DeliveryHubFulfillmentOptionData | null
  fulfillment_payload: DeliveryHubFulfillmentBridgePayload | null
  create_fulfillment_payload: DeliveryHubCreateFulfillmentBridgePayload | null
  shipment_execution: {
    materialized: false
    reason: string
  }
  error: {
    message: string
  } | null
}

export type DeliveryHubFulfillmentBridgePreview = {
  version: typeof DELIVERY_HUB_FULFILLMENT_BRIDGE_PREVIEW_VERSION
  provider_code: typeof DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE
  provider_id: typeof DELIVERY_HUB_FULFILLMENT_PROVIDER_ID
  mode_previews: DeliveryHubFulfillmentBridgePreviewMode[]
  summary: {
    mode_count: number
    ready_mode_count: number
    error_mode_count: number
    projected_mode_count: number
    deferred_mode_count: number
  }
}

export function buildDeliveryHubFulfillmentDataFromCartSelection(
  selection: DeliveryHubCartSelectionPublic
): DeliveryHubFulfillmentSelectionData {
  return normalizeDeliveryHubFulfillmentData(
    {
      version: selection.version,
      connection_id: selection.connection_id,
      mode_code: selection.quote_type,
      quote_type: selection.quote_type,
      quote_reference: selection.quote_reference,
      quote: selection.quote,
      pickup_point: selection.pickup_point,
      pickup_window: selection.pickup_window,
    },
    {
      default_mode_code: selection.quote_type,
    }
  ) as DeliveryHubFulfillmentSelectionData
}

export function buildDeliveryHubFulfillmentBridgePayload(input: {
  option_data?: Record<string, unknown>
  fulfillment_data?: Record<string, unknown>
  default_mode_code?: string | null
}): DeliveryHubFulfillmentBridgePayload {
  const fulfillmentData = parseDeliveryHubFulfillmentData(input.fulfillment_data, {
    default_mode_code: input.default_mode_code,
  })

  if (!fulfillmentData) {
    throw buildMissingSelectionError()
  }

  const option = input.option_data
    ? normalizeDeliveryHubFulfillmentOptionData(input.option_data)
    : buildDeliveryHubShippingOptionData(fulfillmentData.mode_code)

  assertCompatibleMode(option.mode_code, fulfillmentData.mode_code)

  return {
    version: DELIVERY_HUB_FULFILLMENT_BRIDGE_VERSION,
    option,
    fulfillment_data: fulfillmentData,
    calculated_price_data: buildDeliveryHubCalculatedPriceData(fulfillmentData),
  }
}

export function buildDeliveryHubFulfillmentBridgePayloadFromCartSelection(input: {
  selection: DeliveryHubCartSelectionPublic
  option_data?: Record<string, unknown>
}): DeliveryHubFulfillmentBridgePayload {
  const fulfillmentData = buildDeliveryHubFulfillmentDataFromCartSelection(input.selection)

  return buildDeliveryHubFulfillmentBridgePayload({
    option_data: input.option_data,
    fulfillment_data: fulfillmentData,
    default_mode_code: fulfillmentData.mode_code,
  })
}

export function buildDeliveryHubCreateFulfillmentBridgePayload(input: {
  option_data?: Record<string, unknown>
  fulfillment_data?: Record<string, unknown>
  default_mode_code?: string | null
  items?: Array<Record<string, unknown>>
  order?: Record<string, unknown> | null
  fulfillment?: Record<string, unknown> | null
}): DeliveryHubCreateFulfillmentBridgePayload {
  return {
    version: DELIVERY_HUB_FULFILLMENT_BRIDGE_VERSION,
    delivery: buildDeliveryHubFulfillmentBridgePayload({
      option_data: input.option_data,
      fulfillment_data: input.fulfillment_data,
      default_mode_code: input.default_mode_code,
    }),
    order: normalizeOrder(input.order),
    fulfillment: normalizeFulfillment(input.fulfillment),
    items: normalizeItems(input.items),
  }
}

export function buildDeliveryHubFulfillmentContractVerdict(input: {
  option_data?: Record<string, unknown>
  fulfillment_data?: Record<string, unknown>
  default_mode_code?: string | null
}): DeliveryHubFulfillmentContractVerdict {
  const issues = collectFulfillmentContractIssues(input)
  let delivery: DeliveryHubFulfillmentBridgePayload | null = null

  try {
    delivery = buildDeliveryHubFulfillmentBridgePayload({
      option_data: input.option_data,
      fulfillment_data: input.fulfillment_data,
      default_mode_code: input.default_mode_code,
    })
  } catch (error) {
    appendDiagnosticIssue(issues, buildFulfillmentDiagnosticIssue(error, "fulfillment_data"))
  }

  return {
    version: DELIVERY_HUB_FULFILLMENT_CONTRACT_VERDICT_VERSION,
    contract_status: !issues.length && delivery !== null ? "ready" : "blocked",
    blocked_reasons: [...new Set(issues.map((issue) => issue.message))],
    issues,
    normalized: {
      delivery,
    },
  }
}

export function buildDeliveryHubCreateFulfillmentBridgeDiagnostic(input: {
  option_data?: Record<string, unknown>
  fulfillment_data?: Record<string, unknown>
  default_mode_code?: string | null
  items?: Array<Record<string, unknown>>
  order?: Record<string, unknown> | null
  fulfillment?: Record<string, unknown> | null
}): DeliveryHubCreateFulfillmentBridgeDiagnostic {
  const deliveryVerdict = buildDeliveryHubFulfillmentContractVerdict({
    option_data: input.option_data,
    fulfillment_data: input.fulfillment_data,
    default_mode_code: input.default_mode_code,
  })
  const issues = [...deliveryVerdict.issues]
  const delivery = deliveryVerdict.normalized.delivery
  const order = normalizeOrder(input.order)
  const fulfillment = normalizeFulfillment(input.fulfillment)
  let items: DeliveryHubCreateFulfillmentBridgeItem[] | null = null

  try {
    items = normalizeItems(input.items)
  } catch (error) {
    appendDiagnosticIssue(issues, {
      code: "DELIVERY_HUB_INVALID_ITEMS",
      message: getBridgePreviewErrorMessage(error),
      field_path: "items",
    })
  }

  const contractReady = deliveryVerdict.contract_status === "ready" && items !== null
  const shipmentExecutionReason = getShipmentExecutionUnavailableReason()
  const blockedReasons = contractReady
    ? [shipmentExecutionReason]
    : [...new Set([...deliveryVerdict.blocked_reasons, ...issues.map((issue) => issue.message), shipmentExecutionReason])]

  return {
    version: DELIVERY_HUB_CREATE_FULFILLMENT_DIAGNOSTIC_VERSION,
    contract_status: contractReady ? "ready" : "blocked",
    execution_status: "blocked",
    blocked_reasons: blockedReasons,
    issues,
    steps: [
      {
        key: "delivery_payload",
        ready: delivery !== null,
        message:
          delivery !== null
            ? "Order-side fulfillment payload normalized from persisted deliveryhub data."
            : "Order-side fulfillment payload is blocked by missing or invalid deliveryhub data.",
      },
      {
        key: "order_context",
        ready: order !== null,
        message: "Order scaffold normalized for backend-only create-fulfillment diagnostics.",
      },
      {
        key: "fulfillment_context",
        ready: fulfillment !== null,
        message: "Fulfillment scaffold normalized for backend-only create-fulfillment diagnostics.",
      },
      {
        key: "items",
        ready: items !== null,
        message:
          items !== null
            ? "Fulfillment items normalized for backend-only diagnostics."
            : "Fulfillment items are blocked by invalid quantity or shape.",
      },
      {
        key: "create_fulfillment_payload",
        ready: contractReady,
        message: contractReady
          ? "Create-fulfillment bridge input contract materialized for diagnostic-only execution gating."
          : "Create-fulfillment bridge payload remains blocked until order-side contract issues are resolved.",
      },
      {
        key: "shipment_execution",
        ready: false,
        message: shipmentExecutionReason,
      },
    ],
    normalized: {
      delivery,
      order,
      fulfillment,
      items,
      create_fulfillment_payload: contractReady
        ? {
            version: DELIVERY_HUB_FULFILLMENT_BRIDGE_VERSION,
            delivery: delivery!,
            order,
            fulfillment,
            items: items!,
          }
        : null,
    },
    shipment_execution: {
      materialized: false,
      reason: shipmentExecutionReason,
    },
  }
}

export function buildDeliveryHubShipmentExecutionPlanPreview(input: {
  option_data?: Record<string, unknown>
  fulfillment_data?: Record<string, unknown>
  default_mode_code?: string | null
  items?: Array<Record<string, unknown>>
  order?: Record<string, unknown> | null
  fulfillment?: Record<string, unknown> | null
}): DeliveryHubShipmentExecutionPlanPreview {
  const diagnostic = buildDeliveryHubCreateFulfillmentBridgeDiagnostic(input)
  const providerExecutionPlan = diagnostic.normalized.create_fulfillment_payload
    ? buildDeliveryHubProviderExecutionPlan(diagnostic.normalized.create_fulfillment_payload)
    : null
  const executionIdentityPreview = providerExecutionPlan
    ? buildDeliveryHubShipmentExecutionIdentityPreview(providerExecutionPlan)
    : null
  const outboundPayloadPreview = providerExecutionPlan
    ? buildDeliveryHubProviderExecutionPlanOutboundPayloadPreview(providerExecutionPlan)
    : null
  const persistenceAuditPreview = buildDeliveryHubExecutionPersistenceAuditPreview({
    execution_plan: providerExecutionPlan,
    execution_identity: executionIdentityPreview,
    shipment_execution_reason: diagnostic.shipment_execution.reason,
  })
  const preflightEligibility = buildDeliveryHubExecutionPreflightEligibilityPreview({
    execution_plan: providerExecutionPlan,
    execution_identity: executionIdentityPreview,
    persistence_audit_preview: persistenceAuditPreview,
    readiness_blocked_reasons: diagnostic.blocked_reasons,
  })
  const providerDispatchPreview = buildDeliveryHubProviderDispatchPreview({
    execution_plan: providerExecutionPlan,
    execution_identity: executionIdentityPreview,
    preflight_eligibility: preflightEligibility,
    shipment_execution_reason: diagnostic.shipment_execution.reason,
  })
  const shipmentResultPreview = buildDeliveryHubShipmentResultPreview({
    execution_plan: providerExecutionPlan,
    execution_identity: executionIdentityPreview,
    provider_dispatch_preview: providerDispatchPreview,
    shipment_execution_reason: diagnostic.shipment_execution.reason,
  })
  const fulfillmentApplicationPreview = buildDeliveryHubFulfillmentApplicationPreview({
    execution_identity: executionIdentityPreview,
    persistence_audit_preview: persistenceAuditPreview,
    shipment_result_preview: shipmentResultPreview,
    shipment_execution_reason: diagnostic.shipment_execution.reason,
  })
  const finalizedFailureHandlingPreview = buildDeliveryHubFailureHandlingPreview({
    execution_identity: executionIdentityPreview,
    preflight_eligibility: preflightEligibility,
    provider_dispatch_preview: providerDispatchPreview,
    shipment_result_preview: shipmentResultPreview,
    fulfillment_application_preview_status: fulfillmentApplicationPreview.application_decision,
    shipment_execution_reason: diagnostic.shipment_execution.reason,
  })
  const readinessBlockedReasons = diagnostic.blocked_reasons.filter(
    (reason) => reason !== diagnostic.shipment_execution.reason
  )
  const repositoryAssemblySummary =
    buildDeliveryHubExecutionLedgerRepositoryAssemblyReadinessSummary()
 
  return {
    version: DELIVERY_HUB_EXECUTION_PLAN_PREVIEW_VERSION,
    contract_status: diagnostic.contract_status,
    execution_status: diagnostic.execution_status,
    readiness_verdict: {
      status: diagnostic.contract_status,
      blocked_reasons: readinessBlockedReasons,
    },
    repository_assembly_summary: repositoryAssemblySummary,
    blocked_reasons: diagnostic.blocked_reasons,
    issues: diagnostic.issues,
    steps: [
      {
        key: "delivery_payload",
        ready: diagnostic.normalized.delivery !== null,
        message:
          diagnostic.normalized.delivery !== null
            ? "Order-side fulfillment payload normalized for future shipment planning."
            : "Order-side fulfillment payload is blocked by missing or invalid deliveryhub data.",
      },
      {
        key: "order_context",
        ready: diagnostic.normalized.order !== null,
        message: "Order scaffold normalized for backend-only execution planning.",
      },
      {
        key: "fulfillment_context",
        ready: diagnostic.normalized.fulfillment !== null,
        message: "Fulfillment scaffold normalized for backend-only execution planning.",
      },
      {
        key: "items",
        ready: diagnostic.normalized.items !== null,
        message:
          diagnostic.normalized.items !== null
            ? "Fulfillment items normalized for shipment execution planning."
            : "Fulfillment items are blocked by invalid quantity or shape.",
      },
      {
        key: "provider_execution_plan",
        ready: providerExecutionPlan !== null,
        message:
          providerExecutionPlan !== null
            ? "Normalized provider execution plan materialized for future shipment/create orchestration."
            : "Provider execution plan remains blocked until create-fulfillment bridge issues are resolved.",
      },
      {
        key: "execution_identity",
        ready: executionIdentityPreview !== null,
        message:
          executionIdentityPreview !== null
            ? "Deterministic execution identity preview materialized from normalized execution planning without live provider execution."
            : "Deterministic execution identity preview is unavailable because provider execution planning is blocked.",
      },
      {
        key: "outbound_payload_preview",
        ready: outboundPayloadPreview !== null,
        message:
          outboundPayloadPreview !== null
            ? "Redacted outbound request preview materialized without live provider execution."
            : "Outbound request preview is unavailable because provider execution planning is blocked.",
      },
      {
        key: "persistence_audit_preview",
        ready: persistenceAuditPreview.status === "ready",
        message:
          persistenceAuditPreview.status === "ready"
            ? "Preview-only persistence and audit plan materialized from normalized execution identity without database writes."
            : "Persistence and audit preview is unavailable because provider execution planning is blocked.",
      },
      {
        key: "preflight_eligibility",
        ready: preflightEligibility.decision === "eligible_when_enabled",
        message:
          preflightEligibility.decision === "eligible_when_enabled"
            ? "Dry-run execution gate reports future eligibility only after explicit non-live prerequisites are implemented; real execution remains disabled."
            : "Dry-run execution gate keeps live shipment execution not ready until preview prerequisites and future enablement controls exist.",
      },
      {
        key: "provider_dispatch_preview",
        ready: providerDispatchPreview.dispatch_decision === "ready_for_future_dispatch",
        message:
          providerDispatchPreview.dispatch_decision === "ready_for_future_dispatch"
            ? "Dry-run provider dispatch command envelope materialized for future adapter handoff; no adapter invocation occurs."
            : "Provider dispatch command preview remains not dispatched while execution planning prerequisites are blocked.",
      },
      {
        key: "shipment_result_preview",
        ready: shipmentResultPreview.result_decision === "projected_for_future_execution",
        message:
          shipmentResultPreview.result_decision === "projected_for_future_execution"
            ? "Neutral shipment-result normalization preview materialized as a deterministic dry-run projection; no provider response is fetched or normalized live."
            : "Shipment-result normalization preview remains not materialized while execution planning prerequisites are blocked.",
      },
      {
        key: "failure_handling_preview",
        ready:
          finalizedFailureHandlingPreview.failure_path_decision === "projected_retry_policy",
        message:
          finalizedFailureHandlingPreview.failure_path_decision === "projected_retry_policy"
            ? "Failure handling and compensation preview materialized as a deterministic dry-run policy projection without retry scheduling, compensation writes, rollback, provider re-dispatch or event persistence."
            : "Failure handling preview remains on a no-live-failure-path projection while upstream execution planning contours stay blocked.",
      },
      {
        key: "fulfillment_application_preview",
        ready:
          fulfillmentApplicationPreview.application_decision ===
          "projected_for_future_application",
        message:
          fulfillmentApplicationPreview.application_decision ===
          "projected_for_future_application"
            ? "Backend/admin-only fulfillment application preview materialized as a deterministic mutation-plan projection without order, fulfillment, shipment or event writes."
            : "Fulfillment application preview remains not applied while upstream execution planning and shipment-result prerequisites are blocked.",
      },
      {
        key: "shipment_execution",
        ready: false,
        message: diagnostic.shipment_execution.reason,
      },
    ],
    normalized: {
      ...diagnostic.normalized,
      provider_execution_plan: providerExecutionPlan,
    },
    execution_identity: executionIdentityPreview,
    outbound_payload_preview: {
      redacted: true,
      request: outboundPayloadPreview,
    },
    persistence_audit_preview: persistenceAuditPreview,
    preflight_eligibility: preflightEligibility,
    provider_dispatch_preview: providerDispatchPreview,
    shipment_result_preview: shipmentResultPreview,
    failure_handling_preview: finalizedFailureHandlingPreview,
    fulfillment_application_preview: fulfillmentApplicationPreview,
    execution_lifecycle_preview: buildDeliveryHubExecutionLifecyclePreview({
      execution_identity: executionIdentityPreview,
      preflight_eligibility: preflightEligibility,
      provider_dispatch_preview: providerDispatchPreview,
      shipment_result_preview: shipmentResultPreview,
      fulfillment_application_preview: fulfillmentApplicationPreview,
      failure_handling_preview: finalizedFailureHandlingPreview,
    }),
    shipment_execution: diagnostic.shipment_execution,
  }
}

export function buildDeliveryHubExecutionPlanObservabilityPreview(input?: {
  projected_modes?: Array<{
    mode_code: DeliveryHubFulfillmentModeCode
    supporting_connection_ids: string[]
  }>
  deferred_modes?: Array<{
    mode_code: DeliveryHubFulfillmentModeCode
    issues: DeliveryHubFulfillmentBridgePlannerIssue[]
  }>
}): DeliveryHubExecutionPlanObservabilityPreview {
  const projectedModes = new Map<DeliveryHubFulfillmentModeCode, string[]>(
    (input?.projected_modes ?? []).map((entry) => [entry.mode_code, entry.supporting_connection_ids])
  )
  const deferredModes = new Map<
    DeliveryHubFulfillmentModeCode,
    DeliveryHubFulfillmentBridgePlannerIssue[]
  >((input?.deferred_modes ?? []).map((entry) => [entry.mode_code, entry.issues]))

  const modePreviews = DELIVERY_HUB_FULFILLMENT_OPTION_DEFINITIONS.map((definition) => {
    const rolloutStatus = projectedModes.has(definition.mode_code)
      ? "projected"
      : deferredModes.has(definition.mode_code)
        ? "deferred"
        : "unconfigured"
    const supportingConnectionIds = projectedModes.get(definition.mode_code) ?? []
    const blockingIssues = deferredModes.get(definition.mode_code) ?? []

    if (rolloutStatus === "projected") {
      return buildExecutionPlanObservabilityModePreview({
        mode_code: definition.mode_code,
        rollout_status: rolloutStatus,
        supporting_connection_ids: supportingConnectionIds,
        blocking_issues: blockingIssues,
      })
    }

    return buildBlockedExecutionPlanObservabilityModePreview({
      mode_code: definition.mode_code,
      rollout_status: rolloutStatus,
      supporting_connection_ids: supportingConnectionIds,
      blocking_issues: blockingIssues,
    })
  })

  return {
    version: DELIVERY_HUB_EXECUTION_PLAN_OBSERVABILITY_PREVIEW_VERSION,
    provider_code: DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
    provider_id: DELIVERY_HUB_FULFILLMENT_PROVIDER_ID,
    mode_previews: modePreviews,
    summary: {
      mode_count: modePreviews.length,
      ready_mode_count: modePreviews.filter((entry) => entry.status === "ready").length,
      blocked_mode_count: modePreviews.filter((entry) => entry.status === "blocked").length,
      projected_mode_count: modePreviews.filter((entry) => entry.rollout_status === "projected").length,
      deferred_mode_count: modePreviews.filter((entry) => entry.rollout_status === "deferred").length,
      unconfigured_mode_count: modePreviews.filter((entry) => entry.rollout_status === "unconfigured")
        .length,
    },
  }
}

export function buildDeliveryHubFulfillmentBridgePreview(input?: {
  projected_modes?: Array<{
    mode_code: DeliveryHubFulfillmentModeCode
    supporting_connection_ids: string[]
  }>
  deferred_modes?: Array<{
    mode_code: DeliveryHubFulfillmentModeCode
    issues: DeliveryHubFulfillmentBridgePlannerIssue[]
  }>
}): DeliveryHubFulfillmentBridgePreview {
  const projectedModes = new Map<DeliveryHubFulfillmentModeCode, string[]>(
    (input?.projected_modes ?? []).map((entry) => [entry.mode_code, entry.supporting_connection_ids])
  )
  const deferredModes = new Map<
    DeliveryHubFulfillmentModeCode,
    DeliveryHubFulfillmentBridgePlannerIssue[]
  >((input?.deferred_modes ?? []).map((entry) => [entry.mode_code, entry.issues]))

  const modePreviews = DELIVERY_HUB_FULFILLMENT_OPTION_DEFINITIONS.map((definition) =>
    buildModePreview({
      mode_code: definition.mode_code,
      supporting_connection_ids: projectedModes.get(definition.mode_code) ?? [],
      blocking_issues: deferredModes.get(definition.mode_code) ?? [],
      rollout_status: projectedModes.has(definition.mode_code)
        ? "projected"
        : deferredModes.has(definition.mode_code)
          ? "deferred"
          : "unconfigured",
    })
  )

  return {
    version: DELIVERY_HUB_FULFILLMENT_BRIDGE_PREVIEW_VERSION,
    provider_code: DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
    provider_id: DELIVERY_HUB_FULFILLMENT_PROVIDER_ID,
    mode_previews: modePreviews,
    summary: {
      mode_count: modePreviews.length,
      ready_mode_count: modePreviews.filter((entry) => entry.status === "ready").length,
      error_mode_count: modePreviews.filter((entry) => entry.status === "error").length,
      projected_mode_count: modePreviews.filter((entry) => entry.rollout_status === "projected").length,
      deferred_mode_count: modePreviews.filter((entry) => entry.rollout_status === "deferred").length,
    },
  }
}

function buildModePreview(input: {
  mode_code: DeliveryHubFulfillmentModeCode
  rollout_status: DeliveryHubFulfillmentBridgePreviewMode["rollout_status"]
  supporting_connection_ids: string[]
  blocking_issues: DeliveryHubFulfillmentBridgePlannerIssue[]
}): DeliveryHubFulfillmentBridgePreviewMode {
  try {
    const selection = buildNeutralDeliveryHubCartSelection(input.mode_code)
    const shippingOptionData = buildDeliveryHubShippingOptionData(input.mode_code)
    const fulfillmentPayload = buildDeliveryHubFulfillmentBridgePayloadFromCartSelection({
      selection,
      option_data: shippingOptionData,
    })
    const createFulfillmentPayload = buildDeliveryHubCreateFulfillmentBridgePayload({
      option_data: shippingOptionData,
      fulfillment_data: fulfillmentPayload.fulfillment_data,
      default_mode_code: input.mode_code,
      order: {
        id: null,
        display_id: null,
        currency_code: selection.quote.currency_code,
      },
      fulfillment: {
        id: null,
        location_id: null,
      },
      items: [
        {
          line_item_id: `preview_${input.mode_code}_item`,
          quantity: 1,
        },
      ],
    })

    return {
      mode_code: input.mode_code,
      status: "ready",
      rollout_status: input.rollout_status,
      supporting_connection_ids: input.supporting_connection_ids,
      blocking_issues: input.blocking_issues,
      steps: [
        {
          key: "shipping_option_contract",
          ready: true,
          message: "Canonical deliveryhub shipping option contract materialized.",
        },
        {
          key: "fulfillment_payload",
          ready: true,
          message: "Fulfillment payload normalized from neutral selection.",
        },
        {
          key: "calculated_price_data",
          ready: true,
          message: "Calculated price data derived without checkout mutation.",
        },
        {
          key: "create_fulfillment_payload",
          ready: true,
          message: "Create-fulfillment bridge payload validates in preview-only scaffold mode.",
        },
      ],
      selection,
      shipping_option_data: shippingOptionData,
      fulfillment_payload: fulfillmentPayload,
      create_fulfillment_payload: createFulfillmentPayload,
      shipment_execution: {
        materialized: false,
        reason: getShipmentExecutionUnavailableReason(),
      },
      error: null,
    }
  } catch (error) {
    const message = getBridgePreviewErrorMessage(error)

    return {
      mode_code: input.mode_code,
      status: "error",
      rollout_status: input.rollout_status,
      supporting_connection_ids: input.supporting_connection_ids,
      blocking_issues: input.blocking_issues,
      steps: [
        {
          key: "shipping_option_contract",
          ready: false,
          message,
        },
        {
          key: "fulfillment_payload",
          ready: false,
          message: "Fulfillment payload preview could not be materialized.",
        },
        {
          key: "calculated_price_data",
          ready: false,
          message: "Calculated price data preview is unavailable because bridge validation failed.",
        },
        {
          key: "create_fulfillment_payload",
          ready: false,
          message: "Create-fulfillment preview is unavailable because bridge validation failed.",
        },
      ],
      selection: null,
      shipping_option_data: null,
      fulfillment_payload: null,
      create_fulfillment_payload: null,
      shipment_execution: {
        materialized: false,
        reason: getShipmentExecutionUnavailableReason(),
      },
      error: {
        message,
      },
    }
  }
}

function buildExecutionPlanObservabilityModePreview(input: {
  mode_code: DeliveryHubFulfillmentModeCode
  rollout_status: DeliveryHubExecutionPlanObservabilityModePreview["rollout_status"]
  supporting_connection_ids: string[]
  blocking_issues: DeliveryHubFulfillmentBridgePlannerIssue[]
}): DeliveryHubExecutionPlanObservabilityModePreview {
  const selection = buildNeutralDeliveryHubCartSelection(input.mode_code)
  const shippingOptionData = buildDeliveryHubShippingOptionData(input.mode_code)
  const preview = buildDeliveryHubShipmentExecutionPlanPreview({
    option_data: shippingOptionData,
    fulfillment_data: buildDeliveryHubFulfillmentDataFromCartSelection(selection),
    default_mode_code: input.mode_code,
    order: {
      id: null,
      display_id: null,
      currency_code: selection.quote.currency_code,
    },
    fulfillment: {
      id: null,
      location_id: null,
    },
    items: [
      {
        line_item_id: `preview_${input.mode_code}_item`,
        quantity: 1,
      },
    ],
  })

  return {
    mode_code: input.mode_code,
    status: preview.readiness_verdict.status,
    rollout_status: input.rollout_status,
    supporting_connection_ids: input.supporting_connection_ids,
    blocking_issues: input.blocking_issues,
    readiness_verdict: preview.readiness_verdict,
    blocked_reasons: preview.blocked_reasons,
    issues: preview.issues,
    repository_assembly_summary: preview.repository_assembly_summary,
    steps: preview.steps,
    execution_plan: preview.normalized.provider_execution_plan
      ? buildDeliveryHubProviderExecutionPlanObservabilityPlan(
          preview.normalized.provider_execution_plan
        )
      : null,
    execution_identity: preview.execution_identity,
    outbound_payload_preview: preview.outbound_payload_preview,
    persistence_audit_preview: preview.persistence_audit_preview,
    preflight_eligibility: preview.preflight_eligibility,
    provider_dispatch_preview: preview.provider_dispatch_preview,
    shipment_result_preview: preview.shipment_result_preview,
    failure_handling_preview: preview.failure_handling_preview,
    fulfillment_application_preview: preview.fulfillment_application_preview,
    execution_lifecycle_preview: preview.execution_lifecycle_preview,
    shipment_execution: preview.shipment_execution,
  }
}

function buildBlockedExecutionPlanObservabilityModePreview(input: {
  mode_code: DeliveryHubFulfillmentModeCode
  rollout_status: DeliveryHubExecutionPlanObservabilityModePreview["rollout_status"]
  supporting_connection_ids: string[]
  blocking_issues: DeliveryHubFulfillmentBridgePlannerIssue[]
}): DeliveryHubExecutionPlanObservabilityModePreview {
  const rolloutBlockedReasons = input.blocking_issues.length
    ? input.blocking_issues.map((issue) => issue.message)
    : [
        input.rollout_status === "deferred"
          ? "Execution-plan preview remains blocked until planner-reported deliveryhub issues are resolved."
          : "Execution-plan preview remains unavailable until at least one deliveryhub connection projects this mode.",
      ]
  const shipmentExecutionReason = getShipmentExecutionUnavailableReason()
  const persistenceAuditPreview = buildDeliveryHubExecutionPersistenceAuditPreview({
    execution_plan: null,
    execution_identity: null,
    shipment_execution_reason: shipmentExecutionReason,
  })
  const preflightEligibility = buildDeliveryHubExecutionPreflightEligibilityPreview({
    execution_plan: null,
    execution_identity: null,
    persistence_audit_preview: persistenceAuditPreview,
    readiness_blocked_reasons: rolloutBlockedReasons,
  })

  return {
    mode_code: input.mode_code,
    status: "blocked",
    rollout_status: input.rollout_status,
    supporting_connection_ids: input.supporting_connection_ids,
    blocking_issues: input.blocking_issues,
    readiness_verdict: {
      status: "blocked",
      blocked_reasons: rolloutBlockedReasons,
    },
    blocked_reasons: [...rolloutBlockedReasons, shipmentExecutionReason],
    issues: [],
    repository_assembly_summary:
      buildDeliveryHubExecutionLedgerRepositoryAssemblyReadinessSummary(),
    steps: [
      {
        key: "delivery_payload",
        ready: false,
        message:
          "Execution-plan preview remains blocked before neutral delivery payload materialization can be trusted for this mode.",
      },
      {
        key: "order_context",
        ready: false,
        message: "Order scaffold preview is intentionally withheld while planner rollout is blocked.",
      },
      {
        key: "fulfillment_context",
        ready: false,
        message:
          "Fulfillment scaffold preview is intentionally withheld while planner rollout is blocked.",
      },
      {
        key: "items",
        ready: false,
        message: "Fulfillment items preview is intentionally withheld while planner rollout is blocked.",
      },
      {
        key: "provider_execution_plan",
        ready: false,
        message:
          "Provider execution plan preview is unavailable until rollout blockers are cleared for this mode.",
      },
      {
        key: "execution_identity",
        ready: false,
        message:
          "Deterministic execution identity preview stays unavailable while planner rollout blockers prevent execution planning.",
      },
      {
        key: "outbound_payload_preview",
        ready: false,
        message:
          "Redacted outbound payload preview stays unavailable while planner rollout blockers prevent execution planning.",
      },
      {
        key: "persistence_audit_preview",
        ready: false,
        message:
          "Persistence and audit preview stays unavailable while planner rollout blockers prevent execution planning.",
      },
      {
        key: "preflight_eligibility",
        ready: false,
        message:
          "Dry-run execution gate keeps live shipment execution not ready until preview prerequisites and future enablement controls exist.",
      },
      {
        key: "provider_dispatch_preview",
        ready: false,
        message:
          "Provider dispatch command preview remains not dispatched while planner rollout blockers prevent execution planning.",
      },
      {
        key: "shipment_result_preview",
        ready: false,
        message:
          "Shipment-result normalization preview remains not materialized while planner rollout blockers prevent execution planning.",
      },
      {
        key: "failure_handling_preview",
        ready: false,
        message:
          "Failure handling preview remains on a no-live-failure-path projection while planner rollout blockers prevent deterministic retry and compensation posture planning.",
      },
      {
        key: "fulfillment_application_preview",
        ready: false,
        message:
          "Fulfillment application preview remains not applied while planner rollout blockers prevent shipment-result and mutation-plan projection readiness.",
      },
      {
        key: "shipment_execution",
        ready: false,
        message: shipmentExecutionReason,
      },
    ],
    execution_plan: null,
    execution_identity: null,
    outbound_payload_preview: {
      redacted: true,
      request: null,
    },
    persistence_audit_preview: persistenceAuditPreview,
    preflight_eligibility: preflightEligibility,
    provider_dispatch_preview: buildDeliveryHubProviderDispatchPreview({
      execution_plan: null,
      execution_identity: null,
      preflight_eligibility: preflightEligibility,
      shipment_execution_reason: shipmentExecutionReason,
    }),
    shipment_result_preview: buildDeliveryHubShipmentResultPreview({
      execution_plan: null,
      execution_identity: null,
      provider_dispatch_preview: buildDeliveryHubProviderDispatchPreview({
        execution_plan: null,
        execution_identity: null,
        preflight_eligibility: preflightEligibility,
        shipment_execution_reason: shipmentExecutionReason,
      }),
      shipment_execution_reason: shipmentExecutionReason,
    }),
    failure_handling_preview: buildDeliveryHubFailureHandlingPreview({
      execution_identity: null,
      preflight_eligibility: preflightEligibility,
      provider_dispatch_preview: buildDeliveryHubProviderDispatchPreview({
        execution_plan: null,
        execution_identity: null,
        preflight_eligibility: preflightEligibility,
        shipment_execution_reason: shipmentExecutionReason,
      }),
      shipment_result_preview: buildDeliveryHubShipmentResultPreview({
        execution_plan: null,
        execution_identity: null,
        provider_dispatch_preview: buildDeliveryHubProviderDispatchPreview({
          execution_plan: null,
          execution_identity: null,
          preflight_eligibility: preflightEligibility,
          shipment_execution_reason: shipmentExecutionReason,
        }),
        shipment_execution_reason: shipmentExecutionReason,
      }),
      fulfillment_application_preview_status: "not_applied",
      shipment_execution_reason: shipmentExecutionReason,
    }),
    fulfillment_application_preview: buildDeliveryHubFulfillmentApplicationPreview({
      execution_identity: null,
      persistence_audit_preview: persistenceAuditPreview,
      shipment_result_preview: buildDeliveryHubShipmentResultPreview({
        execution_plan: null,
        execution_identity: null,
        provider_dispatch_preview: buildDeliveryHubProviderDispatchPreview({
          execution_plan: null,
          execution_identity: null,
          preflight_eligibility: preflightEligibility,
          shipment_execution_reason: shipmentExecutionReason,
        }),
        shipment_execution_reason: shipmentExecutionReason,
      }),
      shipment_execution_reason: shipmentExecutionReason,
    }),
    execution_lifecycle_preview: buildDeliveryHubExecutionLifecyclePreview({
      execution_identity: null,
      preflight_eligibility: preflightEligibility,
      provider_dispatch_preview: buildDeliveryHubProviderDispatchPreview({
        execution_plan: null,
        execution_identity: null,
        preflight_eligibility: preflightEligibility,
        shipment_execution_reason: shipmentExecutionReason,
      }),
      shipment_result_preview: buildDeliveryHubShipmentResultPreview({
        execution_plan: null,
        execution_identity: null,
        provider_dispatch_preview: buildDeliveryHubProviderDispatchPreview({
          execution_plan: null,
          execution_identity: null,
          preflight_eligibility: preflightEligibility,
          shipment_execution_reason: shipmentExecutionReason,
        }),
        shipment_execution_reason: shipmentExecutionReason,
      }),
      fulfillment_application_preview: buildDeliveryHubFulfillmentApplicationPreview({
        execution_identity: null,
        persistence_audit_preview: persistenceAuditPreview,
        shipment_result_preview: buildDeliveryHubShipmentResultPreview({
          execution_plan: null,
          execution_identity: null,
          provider_dispatch_preview: buildDeliveryHubProviderDispatchPreview({
            execution_plan: null,
            execution_identity: null,
            preflight_eligibility: preflightEligibility,
            shipment_execution_reason: shipmentExecutionReason,
          }),
          shipment_execution_reason: shipmentExecutionReason,
        }),
        shipment_execution_reason: shipmentExecutionReason,
      }),
      failure_handling_preview: buildDeliveryHubFailureHandlingPreview({
        execution_identity: null,
        preflight_eligibility: preflightEligibility,
        provider_dispatch_preview: buildDeliveryHubProviderDispatchPreview({
          execution_plan: null,
          execution_identity: null,
          preflight_eligibility: preflightEligibility,
          shipment_execution_reason: shipmentExecutionReason,
        }),
        shipment_result_preview: buildDeliveryHubShipmentResultPreview({
          execution_plan: null,
          execution_identity: null,
          provider_dispatch_preview: buildDeliveryHubProviderDispatchPreview({
            execution_plan: null,
            execution_identity: null,
            preflight_eligibility: preflightEligibility,
            shipment_execution_reason: shipmentExecutionReason,
          }),
          shipment_execution_reason: shipmentExecutionReason,
        }),
        fulfillment_application_preview_status: "not_applied",
        shipment_execution_reason: shipmentExecutionReason,
      }),
    }),
    shipment_execution: {
      materialized: false,
      reason: shipmentExecutionReason,
    },
  }
}

function buildDeliveryHubProviderExecutionPlanObservabilityPlan(
  executionPlan: DeliveryHubProviderExecutionPlan
): DeliveryHubExecutionPlanObservabilityPlan {
  return {
    version: executionPlan.version,
    operation: executionPlan.operation,
    connection_id: executionPlan.connection_id,
    mode_code: executionPlan.mode_code,
    quote_reference: executionPlan.quote_reference,
    order: executionPlan.order,
    fulfillment: executionPlan.fulfillment,
    items: executionPlan.items,
    outbound_request: {
      method: executionPlan.outbound_request.method,
      path: executionPlan.outbound_request.path,
      headers: redactRecord(executionPlan.outbound_request.headers) as DeliveryHubExecutionPlanObservabilityPlan["outbound_request"]["headers"],
    },
  }
}

function buildDeliveryHubShipmentExecutionIdentityPreview(
  executionPlan: DeliveryHubProviderExecutionPlan
): DeliveryHubExecutionIdentityPreview {
  const identity = buildDeliveryHubControlledExecutionIdentity(executionPlan)

  return {
    version: DELIVERY_HUB_EXECUTION_IDENTITY_PREVIEW_VERSION,
    redacted: true,
    operation: identity.operation,
    provider_operation_label: identity.provider_operation_label,
    provider_operation_reference: identity.execution_reference,
    plan_fingerprint: identity.plan_fingerprint,
    execution_fingerprint: identity.execution_fingerprint,
    idempotency_key_preview: identity.idempotency_key,
  }
}

function buildDeliveryHubProviderDispatchPreview(input: {
  execution_plan: DeliveryHubProviderExecutionPlan | null
  execution_identity: DeliveryHubExecutionIdentityPreview | null
  preflight_eligibility: DeliveryHubExecutionPreflightEligibilityPreview
  shipment_execution_reason: string
}): DeliveryHubProviderDispatchPreview {
  const readyForFutureDispatch = Boolean(
    input.execution_plan &&
      input.execution_identity &&
      input.preflight_eligibility.decision === "eligible_when_enabled"
  )
  const modeCode = input.execution_plan?.mode_code ?? null

  return {
    version: DELIVERY_HUB_PROVIDER_DISPATCH_PREVIEW_VERSION,
    redacted: true,
    current_mode: "preview_only",
    dispatch_decision: readyForFutureDispatch ? "ready_for_future_dispatch" : "not_dispatched",
    provider: {
      provider_code: DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
      provider_id: DELIVERY_HUB_FULFILLMENT_PROVIDER_ID,
      provider_key: DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
      adapter_operation: "create_shipment",
      adapter_operation_label: input.execution_identity?.provider_operation_label ?? "create_shipment",
    },
    command_identity: {
      provider_operation_reference: input.execution_identity?.provider_operation_reference ?? null,
      idempotency_key_preview: input.execution_identity?.idempotency_key_preview ?? null,
      plan_fingerprint: input.execution_identity?.plan_fingerprint ?? null,
      execution_fingerprint: input.execution_identity?.execution_fingerprint ?? null,
    },
    command_envelope_summary: {
      connection_id_present: Boolean(input.execution_plan?.connection_id),
      mode_code: modeCode,
      origin_kind:
        modeCode === "dropoff_point_to_pickup_point"
          ? "dropoff_point"
          : modeCode
            ? "fulfillment_location"
            : "unknown",
      destination_kind: input.execution_plan?.outbound_request.body.pickup_point
        ? "pickup_point"
        : "unknown",
      quote_reference_present: Boolean(input.execution_plan?.quote_reference?.id),
      offer_reference_present: Boolean(input.execution_plan?.outbound_request.body.quote),
      package_reference_present: Boolean(input.execution_plan?.items?.length),
      order_reference_present: Boolean(
        input.execution_plan?.order?.id || input.execution_plan?.order?.display_id
      ),
      fulfillment_reference_present: Boolean(
        input.execution_plan?.fulfillment?.id || input.execution_plan?.fulfillment?.location_id
      ),
      pickup_scheduling_reference_present: Boolean(
        input.execution_plan?.outbound_request.body.pickup_window
      ),
      dropoff_scheduling_reference_present: modeCode === "dropoff_point_to_pickup_point",
      item_count: input.execution_plan?.items.length ?? 0,
    },
    blocked_dispatch_actions: [
      {
        code: "adapter_invocation",
        label: "Invoke provider create-shipment adapter",
        reason: "Adapter invocation is disabled in this preview-only tranche.",
        blocked: true,
      },
      {
        code: "provider_network_call",
        label: "Send provider shipment-create network request",
        reason:
          "Provider network calls are not reachable from the dry-run dispatch preview.",
        blocked: true,
      },
      {
        code: "shipment_creation",
        label: "Create provider shipment",
        reason: input.shipment_execution_reason,
        blocked: true,
      },
      {
        code: "label_creation",
        label: "Create or purchase provider label",
        reason: "Label creation remains disabled until a future live execution layer exists.",
        blocked: true,
      },
      {
        code: "order_mutation",
        label: "Mutate order or fulfillment records",
        reason: "Order and fulfillment mutations remain disabled in the preview seam.",
        blocked: true,
      },
      {
        code: "persistence_write",
        label: "Persist execution, idempotency or audit records",
        reason:
          "Persistence writes remain disabled; only redacted summaries are materialized.",
        blocked: true,
      },
      {
        code: "checkout_cutover",
        label: "Switch checkout/storefront write path",
        reason:
          "Checkout cutover remains out of scope for this backend/admin-only preview.",
        blocked: true,
      },
    ],
    confirmations: {
      adapter_invocation_disabled: true,
      provider_network_calls_disabled: true,
      shipment_creation_disabled: true,
      label_creation_disabled: true,
      order_mutation_disabled: true,
      persistence_writes_disabled: true,
      checkout_cutover_disabled: true,
    },
  }
}

function buildDeliveryHubShipmentResultPreview(input: {
  execution_plan: DeliveryHubProviderExecutionPlan | null
  execution_identity: DeliveryHubExecutionIdentityPreview | null
  provider_dispatch_preview: DeliveryHubProviderDispatchPreview
  shipment_execution_reason: string
}): DeliveryHubShipmentResultPreview {
  const projectedForFutureExecution = Boolean(
    input.execution_plan &&
      input.execution_identity &&
      input.provider_dispatch_preview.dispatch_decision === "ready_for_future_dispatch"
  )

  return {
    version: DELIVERY_HUB_SHIPMENT_RESULT_PREVIEW_VERSION,
    redacted: true,
    current_mode: "preview_only",
    result_decision: projectedForFutureExecution
      ? "projected_for_future_execution"
      : "not_materialized",
    projected_result_status: projectedForFutureExecution
      ? "projected_for_future_execution"
      : "not_materialized",
    result_kind: "shipment_result",
    normalization_target: "deliveryhub_shipment_result",
    provider_normalization_target: "create_shipment_response",
    identity_linkage: {
      provider_operation_reference:
        input.execution_identity?.provider_operation_reference ?? null,
      idempotency_key_preview: input.execution_identity?.idempotency_key_preview ?? null,
      plan_fingerprint: input.execution_identity?.plan_fingerprint ?? null,
      execution_fingerprint: input.execution_identity?.execution_fingerprint ?? null,
    },
    artifact_summary: {
      external_shipment_reference_present: projectedForFutureExecution,
      tracking_reference_present: projectedForFutureExecution,
      label_document_present: projectedForFutureExecution,
      pickup_booking_present: Boolean(input.execution_plan?.outbound_request.body.pickup_window),
      pickup_interval_present: Boolean(input.execution_plan?.outbound_request.body.pickup_window),
      status_timeline_present: projectedForFutureExecution,
      failure_placeholder_present: true,
      rollback_placeholder_present: true,
    },
    blocked_materialization_actions: [
      {
        code: "provider_response_fetch",
        label: "Fetch provider shipment-create response",
        reason:
          "Provider response fetch remains disabled in this deterministic preview-only normalization seam.",
        blocked: true,
      },
      {
        code: "adapter_result_normalization",
        label: "Invoke provider adapter result normalization",
        reason:
          "Adapter result normalization stays projected only; no provider adapter is invoked in dry-run mode.",
        blocked: true,
      },
      {
        code: "shipment_creation",
        label: "Create or materialize shipment result records",
        reason: input.shipment_execution_reason,
        blocked: true,
      },
      {
        code: "label_persistence",
        label: "Persist label or document artifacts",
        reason:
          "Label and document persistence remain disabled until a future live execution layer exists.",
        blocked: true,
      },
      {
        code: "order_mutation",
        label: "Mutate order or fulfillment state from normalized result",
        reason:
          "Order and fulfillment mutations remain disabled in this backend/admin-only preview seam.",
        blocked: true,
      },
      {
        code: "fulfillment_persistence",
        label: "Persist fulfillment execution result state",
        reason:
          "Fulfillment persistence remains disabled; only redacted deterministic projections are exposed.",
        blocked: true,
      },
      {
        code: "checkout_cutover",
        label: "Switch checkout/storefront flow to normalized shipment result",
        reason:
          "Checkout cutover remains out of scope for this backend/admin-only preview seam.",
        blocked: true,
      },
    ],
    confirmations: {
      provider_response_fetch_disabled: true,
      adapter_invocation_disabled: true,
      shipment_creation_disabled: true,
      label_persistence_disabled: true,
      order_mutation_disabled: true,
      fulfillment_persistence_disabled: true,
      checkout_cutover_disabled: true,
    },
  }
}

function buildDeliveryHubFailureHandlingPreview(input: {
  execution_identity: DeliveryHubExecutionIdentityPreview | null
  preflight_eligibility: DeliveryHubExecutionPreflightEligibilityPreview
  provider_dispatch_preview: DeliveryHubProviderDispatchPreview
  shipment_result_preview: DeliveryHubShipmentResultPreview
  fulfillment_application_preview_status:
    | DeliveryHubFulfillmentApplicationPreview["application_decision"]
    | null
  shipment_execution_reason: string
}): DeliveryHubFailureHandlingPreview {
  const projectedRetryPolicy =
    input.preflight_eligibility.decision === "eligible_when_enabled" &&
    input.provider_dispatch_preview.dispatch_decision === "ready_for_future_dispatch" &&
    input.shipment_result_preview.result_decision === "projected_for_future_execution"

  const retryBlockReasons = projectedRetryPolicy
    ? [
        "Retry scheduling remains disabled in preview-only mode until a future live execution layer exists.",
        "Provider re-dispatch remains blocked even when deterministic retry eligibility is projected.",
      ]
    : [
        "Retry projection is blocked until execution planning, dispatch preview and shipment-result preview are all rollout-ready.",
        input.shipment_execution_reason,
      ]

  const manualInterventionMarkers = projectedRetryPolicy
    ? [
        "manual_review_after_retry_budget_when_enabled",
        "operator_confirmation_required_before_compensation_when_enabled",
      ]
    : ["preview_only_execution_block"]

  return {
    version: DELIVERY_HUB_FAILURE_HANDLING_PREVIEW_VERSION,
    redacted: true,
    current_mode: "preview_only",
    failure_path_decision: projectedRetryPolicy ? "projected_retry_policy" : "no_live_failure_path",
    projected_failure_status: projectedRetryPolicy
      ? "manual_intervention_required_when_enabled"
      : "not_applicable_in_preview",
    failure_classes: [
      {
        code: "provider_dispatch_failure",
        retry_eligibility: projectedRetryPolicy ? "eligible_when_enabled" : "blocked",
        compensation_requirement: "not_required",
        manual_intervention: projectedRetryPolicy ? "required_when_enabled" : "not_required",
        reason_bucket: "dispatch_transport",
      },
      {
        code: "provider_timeout",
        retry_eligibility: projectedRetryPolicy ? "eligible_when_enabled" : "blocked",
        compensation_requirement: "not_required",
        manual_intervention: projectedRetryPolicy ? "required_when_enabled" : "not_required",
        reason_bucket: "provider_timeout",
      },
      {
        code: "provider_response_invalid",
        retry_eligibility: "blocked",
        compensation_requirement: "not_required",
        manual_intervention: "required_when_enabled",
        reason_bucket: "response_normalization",
      },
      {
        code: "shipment_result_rejected",
        retry_eligibility: "blocked",
        compensation_requirement: "required_when_enabled",
        manual_intervention: "required_when_enabled",
        reason_bucket: "result_semantics",
      },
      {
        code: "application_projection_blocked",
        retry_eligibility: "blocked",
        compensation_requirement:
          input.fulfillment_application_preview_status === "projected_for_future_application"
            ? "required_when_enabled"
            : "not_required",
        manual_intervention: "required_when_enabled",
        reason_bucket: "application_projection",
      },
    ],
    identity_linkage: {
      provider_operation_reference: input.execution_identity?.provider_operation_reference ?? null,
      idempotency_key_preview: input.execution_identity?.idempotency_key_preview ?? null,
      plan_fingerprint: input.execution_identity?.plan_fingerprint ?? null,
      execution_fingerprint: input.execution_identity?.execution_fingerprint ?? null,
    },
    retry_projection: {
      eligibility: projectedRetryPolicy ? "eligible_when_enabled" : "blocked",
      policy: "deterministic_preview_only",
      retry_block_reasons: retryBlockReasons,
      scheduling_status: "disabled",
    },
    compensation_projection: {
      requirement:
        input.fulfillment_application_preview_status === "projected_for_future_application"
          ? "required_when_enabled"
          : "not_required",
      write_plan_status: "disabled",
      rollback_status: "disabled",
      blocked_actions: [
        "rollback_execution_state",
        "compensation_write",
        "shipment_result_reversal",
      ],
    },
    manual_intervention_projection: {
      status: projectedRetryPolicy ? "required_when_enabled" : "not_required",
      reason_markers: manualInterventionMarkers,
    },
    blocked_failure_actions: [
      {
        code: "retry_scheduling",
        label: "Schedule shipment retry attempt",
        reason:
          "Retry scheduling remains disabled in this deterministic preview seam; only projected policy vocabulary is exposed.",
        blocked: true,
      },
      {
        code: "provider_redispatch",
        label: "Re-dispatch provider create-shipment command",
        reason:
          "Provider re-dispatch remains disabled; no live provider command can be retried from this dry-run preview.",
        blocked: true,
      },
      {
        code: "rollback_execution_state",
        label: "Rollback execution or fulfillment state",
        reason:
          "Rollback logic remains disabled until a future live execution and persistence layer exists.",
        blocked: true,
      },
      {
        code: "compensation_write",
        label: "Persist compensation or remediation records",
        reason:
          "Compensation persistence remains disabled; only deterministic preview-only posture is materialized.",
        blocked: true,
      },
      {
        code: "event_persistence",
        label: "Persist failure or recovery events",
        reason:
          "Failure and recovery event persistence remain disabled in the backend/admin-only preview seam.",
        blocked: true,
      },
      {
        code: "order_mutation",
        label: "Mutate order or fulfillment during failure handling",
        reason:
          "Order and fulfillment mutations remain disabled in projected retry and compensation handling.",
        blocked: true,
      },
      {
        code: "checkout_cutover",
        label: "Switch checkout/storefront flow after failure handling",
        reason:
          "Checkout/storefront cutover remains out of scope for this backend/admin-only preview seam.",
        blocked: true,
      },
    ],
    confirmations: {
      retry_scheduling_disabled: true,
      rollback_disabled: true,
      compensation_writes_disabled: true,
      order_mutation_disabled: true,
      fulfillment_mutation_disabled: true,
      event_persistence_disabled: true,
      provider_redispatch_disabled: true,
      checkout_cutover_disabled: true,
    },
  }
}

function buildDeliveryHubFulfillmentApplicationPreview(input: {
  execution_identity: DeliveryHubExecutionIdentityPreview | null
  persistence_audit_preview: DeliveryHubExecutionPersistenceAuditPreview
  shipment_result_preview: DeliveryHubShipmentResultPreview
  shipment_execution_reason: string
}): DeliveryHubFulfillmentApplicationPreview {
  const projectedForFutureApplication = Boolean(
    input.execution_identity &&
      input.persistence_audit_preview.status === "ready" &&
      input.shipment_result_preview.result_decision === "projected_for_future_execution"
  )

  return {
    version: DELIVERY_HUB_FULFILLMENT_APPLICATION_PREVIEW_VERSION,
    redacted: true,
    current_mode: "preview_only",
    application_decision: projectedForFutureApplication
      ? "projected_for_future_application"
      : "not_applied",
    projected_application_status: projectedForFutureApplication
      ? "projected_for_future_application"
      : "not_applied",
    application_target: "medusa_fulfillment_mutation_plan",
    application_scope: "backend_admin_only",
    mutation_semantics: {
      fulfillment_data_patch_present: projectedForFutureApplication,
      shipment_reference_linkage_present: projectedForFutureApplication,
      tracking_projection_present: projectedForFutureApplication,
      label_document_reference_linkage_present: projectedForFutureApplication,
      status_transition_application_present: projectedForFutureApplication,
      audit_linkage_present: projectedForFutureApplication,
    },
    identity_linkage: {
      provider_operation_reference:
        input.execution_identity?.provider_operation_reference ?? null,
      idempotency_key_preview: input.execution_identity?.idempotency_key_preview ?? null,
      plan_fingerprint: input.execution_identity?.plan_fingerprint ?? null,
      execution_fingerprint: input.execution_identity?.execution_fingerprint ?? null,
    },
    persistence_linkage: {
      execution_reference_present: Boolean(
        input.persistence_audit_preview.execution_record.execution_reference
      ),
      idempotency_reservation_present: Boolean(
        input.persistence_audit_preview.idempotency_reservation.reservation_key_preview
      ),
      audit_log_reference_present: Boolean(input.persistence_audit_preview.audit_log_entries.length),
    },
    blocked_application_actions: [
      {
        code: "order_mutation",
        label: "Apply normalized result to order state",
        reason: "Order mutation remains disabled in this deterministic admin-only preview seam.",
        blocked: true,
      },
      {
        code: "fulfillment_persistence",
        label: "Persist fulfillment mutation plan",
        reason:
          "Fulfillment persistence remains disabled; only a read-only mutation-plan projection is exposed.",
        blocked: true,
      },
      {
        code: "shipment_persistence",
        label: "Persist shipment reference linkage",
        reason: input.shipment_execution_reason,
        blocked: true,
      },
      {
        code: "label_persistence",
        label: "Persist label or document linkage",
        reason:
          "Label/document persistence remains disabled until a future live application layer exists.",
        blocked: true,
      },
      {
        code: "event_persistence",
        label: "Persist application audit or domain events",
        reason:
          "Audit/event persistence writes remain disabled; only preview-only linkage summaries are materialized.",
        blocked: true,
      },
      {
        code: "checkout_cutover",
        label: "Switch checkout/storefront flow to application layer",
        reason:
          "Checkout/storefront cutover remains out of scope for this backend/admin-only preview seam.",
        blocked: true,
      },
    ],
    confirmations: {
      order_mutation_disabled: true,
      fulfillment_persistence_disabled: true,
      shipment_persistence_disabled: true,
      label_persistence_disabled: true,
      event_persistence_disabled: true,
      checkout_cutover_disabled: true,
    },
  }
}

function buildDeliveryHubExecutionLifecyclePreview(input: {
  execution_identity: DeliveryHubExecutionIdentityPreview | null
  preflight_eligibility: DeliveryHubExecutionPreflightEligibilityPreview
  provider_dispatch_preview: DeliveryHubProviderDispatchPreview
  shipment_result_preview: DeliveryHubShipmentResultPreview
  fulfillment_application_preview: DeliveryHubFulfillmentApplicationPreview
  failure_handling_preview: DeliveryHubFailureHandlingPreview
}): DeliveryHubExecutionLifecyclePreview {
  const phaseSequence: DeliveryHubExecutionLifecyclePhaseCode[] = [
    "preflight_eligibility",
    "provider_dispatch",
    "shipment_result_normalization",
    "fulfillment_application",
    "failure_handling",
  ]
  const lifecycleReady =
    input.preflight_eligibility.decision === "eligible_when_enabled" &&
    input.provider_dispatch_preview.dispatch_decision === "ready_for_future_dispatch" &&
    input.shipment_result_preview.result_decision === "projected_for_future_execution" &&
    input.fulfillment_application_preview.application_decision ===
      "projected_for_future_application" &&
    input.failure_handling_preview.failure_path_decision === "projected_retry_policy"

  return {
    version: 1,
    redacted: true,
    current_mode: "preview_only",
    lifecycle_status: lifecycleReady ? "projected_for_future_execution" : "blocked_in_preview",
    readiness_posture: lifecycleReady ? "ready_when_enabled" : "blocked_in_preview",
    phase_sequence: phaseSequence,
    identity_correlation: {
      provider_operation_reference: input.execution_identity?.provider_operation_reference ?? null,
      idempotency_key_preview: input.execution_identity?.idempotency_key_preview ?? null,
      plan_fingerprint: input.execution_identity?.plan_fingerprint ?? null,
      execution_fingerprint: input.execution_identity?.execution_fingerprint ?? null,
    },
    phases: [
      {
        code: "preflight_eligibility",
        order: 1,
        status:
          input.preflight_eligibility.decision === "eligible_when_enabled"
            ? "projected_for_future_execution"
            : "blocked_in_preview",
        readiness_posture:
          input.preflight_eligibility.decision === "eligible_when_enabled"
            ? "ready_when_enabled"
            : "blocked_in_preview",
        block_reasons: input.preflight_eligibility.reasons.map((reason) => reason.code),
        disabled_live_actions: input.preflight_eligibility.blocked_live_actions.map(
          (action) => action.code
        ),
        linked_preview_artifacts: ["preflight_eligibility", "execution_identity", "persistence_audit_preview"],
      },
      {
        code: "provider_dispatch",
        order: 2,
        status:
          input.provider_dispatch_preview.dispatch_decision === "ready_for_future_dispatch"
            ? "projected_for_future_execution"
            : "blocked_in_preview",
        readiness_posture:
          input.provider_dispatch_preview.dispatch_decision === "ready_for_future_dispatch"
            ? "ready_when_enabled"
            : "blocked_in_preview",
        block_reasons: input.provider_dispatch_preview.blocked_dispatch_actions.map(
          (action) => action.reason
        ),
        disabled_live_actions: input.provider_dispatch_preview.blocked_dispatch_actions.map(
          (action) => action.code
        ),
        linked_preview_artifacts: ["provider_dispatch_preview", "execution_identity"],
      },
      {
        code: "shipment_result_normalization",
        order: 3,
        status:
          input.shipment_result_preview.result_decision === "projected_for_future_execution"
            ? "projected_for_future_execution"
            : "blocked_in_preview",
        readiness_posture:
          input.shipment_result_preview.result_decision === "projected_for_future_execution"
            ? "ready_when_enabled"
            : "blocked_in_preview",
        block_reasons: input.shipment_result_preview.blocked_materialization_actions.map(
          (action) => action.reason
        ),
        disabled_live_actions: input.shipment_result_preview.blocked_materialization_actions.map(
          (action) => action.code
        ),
        linked_preview_artifacts: ["shipment_result_preview", "provider_dispatch_preview", "execution_identity"],
      },
      {
        code: "fulfillment_application",
        order: 4,
        status:
          input.fulfillment_application_preview.application_decision ===
          "projected_for_future_application"
            ? "projected_for_future_execution"
            : "blocked_in_preview",
        readiness_posture:
          input.fulfillment_application_preview.application_decision ===
          "projected_for_future_application"
            ? "ready_when_enabled"
            : "blocked_in_preview",
        block_reasons: input.fulfillment_application_preview.blocked_application_actions.map(
          (action) => action.reason
        ),
        disabled_live_actions: input.fulfillment_application_preview.blocked_application_actions.map(
          (action) => action.code
        ),
        linked_preview_artifacts: [
          "fulfillment_application_preview",
          "shipment_result_preview",
          "persistence_audit_preview",
          "execution_identity",
        ],
      },
      {
        code: "failure_handling",
        order: 5,
        status:
          input.failure_handling_preview.failure_path_decision === "projected_retry_policy"
            ? "projected_for_future_execution"
            : "blocked_in_preview",
        readiness_posture:
          input.failure_handling_preview.failure_path_decision === "projected_retry_policy"
            ? "ready_when_enabled"
            : "blocked_in_preview",
        block_reasons: [
          ...input.failure_handling_preview.retry_projection.retry_block_reasons,
          ...input.failure_handling_preview.blocked_failure_actions.map((action) => action.reason),
        ],
        disabled_live_actions: input.failure_handling_preview.blocked_failure_actions.map(
          (action) => action.code
        ),
        linked_preview_artifacts: [
          "failure_handling_preview",
          "provider_dispatch_preview",
          "shipment_result_preview",
          "fulfillment_application_preview",
          "execution_identity",
        ],
      },
    ],
    confirmations: {
      preview_only: true,
      orchestration_scheduling_disabled: true,
      shipment_execution_disabled: true,
      provider_calls_disabled: true,
      persistence_writes_disabled: true,
      retry_scheduling_disabled: true,
      compensation_writes_disabled: true,
      order_mutation_disabled: true,
      fulfillment_mutation_disabled: true,
      checkout_cutover_disabled: true,
    },
  }
}

function buildDeliveryHubExecutionPreflightEligibilityPreview(input: {
  execution_plan: DeliveryHubProviderExecutionPlan | null
  execution_identity: DeliveryHubExecutionIdentityPreview | null
  persistence_audit_preview: DeliveryHubExecutionPersistenceAuditPreview
  readiness_blocked_reasons: string[]
}): DeliveryHubExecutionPreflightEligibilityPreview {
  const previewPrerequisitesReady = Boolean(
    input.execution_plan && input.execution_identity && input.persistence_audit_preview.status === "ready"
  )
  const reasons: DeliveryHubExecutionPreflightEligibilityPreview["reasons"] = [
    {
      code: "EXECUTION_PREVIEW_ONLY",
      message:
        "Shipment execution policy is evaluated in dry-run preview-only mode; no live execution switch is read in this tranche.",
    },
    {
      code: "FUTURE_EXECUTION_FLAG_INERT",
      message:
        "DELIVERY_HUB_SHIPMENT_EXECUTION_ENABLED is documented only as a future inert prerequisite name and is not read as an enablement switch.",
    },
  ]

  if (!input.execution_plan) {
    reasons.push({
      code: "EXECUTION_PLAN_NOT_READY",
      message:
        input.readiness_blocked_reasons[0] ??
        "Provider execution plan preview must be ready before future shipment execution can be considered.",
    })
  }

  if (!input.execution_identity) {
    reasons.push({
      code: "EXECUTION_IDENTITY_NOT_READY",
      message:
        "Deterministic execution identity and idempotency key preview must exist before future shipment execution can be considered.",
    })
  }

  if (input.persistence_audit_preview.status !== "ready") {
    reasons.push({
      code: "PERSISTENCE_AUDIT_NOT_READY",
      message:
        "Persistence and audit preview must be ready before future shipment execution can be considered.",
    })
  }

  if (previewPrerequisitesReady) {
    reasons.push(
      {
        code: "LIVE_EXECUTION_DISABLED",
        message:
          "Dry-run policy allows only future eligibility observation; real shipment execution remains disabled.",
      },
      {
        code: "PROVIDER_EXECUTION_ADAPTER_DISABLED",
        message:
          "Provider create-shipment adapter dispatch is not implemented or callable from this preview contour.",
      }
    )
  }

  return {
    version: DELIVERY_HUB_EXECUTION_PREFLIGHT_ELIGIBILITY_PREVIEW_VERSION,
    redacted: true,
    current_mode: "preview_only",
    decision: previewPrerequisitesReady ? "eligible_when_enabled" : "not_ready",
    real_execution_enabled: false,
    future_execution_flag: {
      name: "DELIVERY_HUB_SHIPMENT_EXECUTION_ENABLED",
      status: "future_inert_not_read",
      description:
        "Future-only prerequisite name for operator documentation; this tranche never reads it and cannot enable live execution.",
    },
    reasons,
    required_prerequisites: [
      {
        code: "explicit_future_feature_flag",
        label: "Implement an explicit future execution feature flag that is disabled by default.",
        status: "required_future_work",
      },
      {
        code: "operator_approval",
        label: "Require explicit operator approval for live shipment execution rollout.",
        status: "required_future_work",
      },
      {
        code: "persistence_repository_readiness",
        label: "Provide durable shipment execution repositories and transaction boundaries.",
        status: "required_future_work",
      },
      {
        code: "idempotency_reservation_storage",
        label: "Persist idempotency reservations before any provider dispatch can run.",
        status: "required_future_work",
      },
      {
        code: "provider_execution_adapter_readiness",
        label: "Implement provider create-shipment adapter with no-secret audit-safe request handling.",
        status: "required_future_work",
      },
      {
        code: "shipment_audit_sink_readiness",
        label: "Commit shipment execution audit events and terminal status transitions durably.",
        status: "required_future_work",
      },
    ],
    confirmations: {
      shipment_execution_disabled: true,
      provider_calls_disabled: true,
      persistence_writes_disabled: true,
      checkout_cutover_disabled: true,
    },
    blocked_live_actions: [
      {
        code: "provider_create_shipment_call",
        label: "Call provider create-shipment endpoint",
        blocked: true,
      },
      {
        code: "provider_label_purchase",
        label: "Purchase or request provider shipment labels",
        blocked: true,
      },
      {
        code: "fulfillment_metadata_write",
        label: "Write execution metadata onto fulfillment records",
        blocked: true,
      },
      {
        code: "execution_record_insert",
        label: "Insert durable shipment execution records",
        blocked: true,
      },
      {
        code: "idempotency_reservation_commit",
        label: "Commit idempotency reservation storage",
        blocked: true,
      },
      {
        code: "shipment_audit_log_commit",
        label: "Commit shipment audit log entries",
        blocked: true,
      },
      {
        code: "checkout_cutover",
        label: "Switch checkout/storefront write path to deliveryhub execution",
        blocked: true,
      },
    ],
  }
}

function buildDeliveryHubExecutionPersistenceAuditPreview(input: {
  execution_plan: DeliveryHubProviderExecutionPlan | null
  execution_identity: DeliveryHubExecutionIdentityPreview | null
  shipment_execution_reason: string
}): DeliveryHubExecutionPersistenceAuditPreview {
  const dryRunPersistenceReason =
    "Persistence preview remains dry-run only; execution metadata, dedupe reservations and audit entries are not committed."

  if (!input.execution_plan || !input.execution_identity) {
    return {
      version: DELIVERY_HUB_EXECUTION_PERSISTENCE_AUDIT_PREVIEW_VERSION,
      redacted: true,
      status: "blocked",
      metadata_patch: {
        target: "fulfillment_execution_shadow",
        action: "merge",
        fields: [],
      },
      execution_record: {
        ready: false,
        draft: null,
        record_type: "deliveryhub_shipment_execution",
        operation: "create_shipment",
        provider_code: DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
        provider_id: DELIVERY_HUB_FULFILLMENT_PROVIDER_ID,
        connection_id: input.execution_plan?.connection_id ?? null,
        mode_code: input.execution_plan?.mode_code ?? null,
        execution_reference: input.execution_identity?.provider_operation_reference ?? null,
        idempotency_key_preview: input.execution_identity?.idempotency_key_preview ?? null,
        initial_status: null,
      },
      idempotency_reservation: {
        ready: false,
        draft: null,
        dedupe_scope: "deliveryhub:create_shipment",
        reservation_key_preview: input.execution_identity?.idempotency_key_preview ?? null,
        reservation_fingerprint: null,
        matched_fields: [],
      },
      status_transitions: [],
      audit_log_entries: [
        {
          version: DELIVERY_HUB_CONTROLLED_EXECUTION_CONTRACT_VERSION,
          event_type: "deliveryhub.execution.planned",
          execution_reference: input.execution_identity?.provider_operation_reference ?? "unavailable",
          current_state: DELIVERY_HUB_EXECUTION_STATE.planned,
          summary:
            "Controlled execution persistence preview stays blocked until both normalized planning and deterministic identity are available.",
          correlation: {
            connection_id: input.execution_plan?.connection_id ?? "unavailable",
            mode_code: input.execution_plan?.mode_code ?? "dropoff_point_to_pickup_point",
            quote_reference_id: input.execution_plan?.quote_reference.id ?? "unavailable",
            order_id: input.execution_plan?.order.id ?? null,
            fulfillment_id: input.execution_plan?.fulfillment.id ?? null,
          },
          identity: {
            idempotency_key: input.execution_identity?.idempotency_key_preview ?? "unavailable",
            plan_fingerprint: input.execution_identity?.plan_fingerprint ?? "unavailable",
            execution_fingerprint: input.execution_identity?.execution_fingerprint ?? "unavailable",
            reservation_fingerprint: "unavailable",
          },
        },
      ],
      blocked: [
        {
          key: "execution_plan_prerequisite",
          reason:
            "Persistence and audit preview remains blocked until provider execution planning and deterministic identity preview are both available.",
        },
        {
          key: "persistence_commit",
          reason: dryRunPersistenceReason,
        },
      ],
      deferred: [
        {
          key: "provider_response_capture",
          reason:
            "Provider response capture is deferred until a future execute path exists beyond preview-only planning.",
        },
        {
          key: "terminal_status_resolution",
          reason:
            "Terminal execution status remains deferred until provider dispatch and persistence commit exist.",
        },
      ],
    }
  }

  const controlledExecutionIdentity = buildDeliveryHubControlledExecutionIdentity(input.execution_plan)
  const reservationDraft = buildDeliveryHubControlledExecutionReservationDraft({
    execution_plan: input.execution_plan,
    execution_identity: controlledExecutionIdentity,
  })
  const executionRecordDraft = buildDeliveryHubControlledExecutionRecordDraft({
    execution_plan: input.execution_plan,
    execution_identity: controlledExecutionIdentity,
    reservation_draft: reservationDraft,
  })
  const auditDrafts = [
    buildDeliveryHubControlledExecutionAuditDraft({
      execution_plan: input.execution_plan,
      execution_identity: controlledExecutionIdentity,
      current_state: DELIVERY_HUB_EXECUTION_STATE.planned,
      event_type: "deliveryhub.execution.planned",
    }),
    buildDeliveryHubControlledExecutionAuditDraft({
      execution_plan: input.execution_plan,
      execution_identity: controlledExecutionIdentity,
      current_state: DELIVERY_HUB_EXECUTION_STATE.reserved,
      event_type: "deliveryhub.execution.reserved",
    }),
    buildDeliveryHubControlledExecutionAuditDraft({
      execution_plan: input.execution_plan,
      execution_identity: controlledExecutionIdentity,
      current_state: DELIVERY_HUB_EXECUTION_STATE.dispatchReady,
      event_type: "deliveryhub.execution.dispatch_ready",
    }),
  ]

  return {
    version: DELIVERY_HUB_EXECUTION_PERSISTENCE_AUDIT_PREVIEW_VERSION,
    redacted: true,
    status: "ready",
    metadata_patch: {
      target: "fulfillment_execution_shadow",
      action: "merge",
      fields: [
        {
          field: "execution_reference",
          value_preview: input.execution_identity.provider_operation_reference,
        },
        {
          field: "idempotency_key_preview",
          value_preview: input.execution_identity.idempotency_key_preview,
        },
        {
          field: "plan_fingerprint",
          value_preview: input.execution_identity.plan_fingerprint,
        },
        {
          field: "reservation_fingerprint",
          value_preview: controlledExecutionIdentity.reservation_fingerprint,
        },
        {
          field: "status_snapshot",
          value_preview: DELIVERY_HUB_EXECUTION_STATE.planned,
        },
      ],
    },
    execution_record: {
      ready: true,
      draft: executionRecordDraft,
      record_type: "deliveryhub_shipment_execution",
      operation: input.execution_plan.operation,
      provider_code: input.execution_plan.provider_code,
      provider_id: input.execution_plan.provider_id,
      connection_id: input.execution_plan.connection_id,
      mode_code: input.execution_plan.mode_code,
      execution_reference: input.execution_identity.provider_operation_reference,
      idempotency_key_preview: input.execution_identity.idempotency_key_preview,
      initial_status: DELIVERY_HUB_EXECUTION_STATE.planned,
    },
    idempotency_reservation: {
      ready: true,
      draft: reservationDraft,
      dedupe_scope: reservationDraft.dedupe_scope,
      reservation_key_preview: input.execution_identity.idempotency_key_preview,
      reservation_fingerprint: controlledExecutionIdentity.reservation_fingerprint,
      matched_fields: reservationDraft.matched_identity_fields,
    },
    status_transitions: executionRecordDraft.allowed_transitions
      .filter(
        (transition) =>
          transition.from === DELIVERY_HUB_EXECUTION_STATE.planned ||
          transition.from === DELIVERY_HUB_EXECUTION_STATE.reserved ||
          transition.from === DELIVERY_HUB_EXECUTION_STATE.dispatchReady
      )
      .map((transition) => ({
        from: transition.from,
        to: transition.to,
        reason: transition.reason_code,
      })),
    audit_log_entries: auditDrafts,
    blocked: [
      {
        key: "metadata_commit",
        reason: dryRunPersistenceReason,
      },
      {
        key: "execution_record_commit",
        reason: dryRunPersistenceReason,
      },
      {
        key: "idempotency_reservation_commit",
        reason: dryRunPersistenceReason,
      },
      {
        key: "provider_dispatch",
        reason: input.shipment_execution_reason,
      },
    ],
    deferred: [
      {
        key: "provider_response_capture",
        reason:
          "Provider response payload capture stays deferred until live execution exists and no-network preview restrictions are lifted in a future tranche.",
      },
      {
        key: "terminal_status_resolution",
        reason:
          "Terminal execution status persistence stays deferred until provider dispatch actually resolves.",
      },
      {
        key: "audit_log_commit",
        reason:
          "Audit entries are previewed only; durable event-log append remains deferred until a future execution path exists.",
      },
    ],
  }
}


function buildDeliveryHubProviderExecutionPlan(
  payload: DeliveryHubCreateFulfillmentBridgePayload
): DeliveryHubProviderExecutionPlan {
  const { delivery } = payload

  return {
    version: DELIVERY_HUB_PROVIDER_EXECUTION_PLAN_VERSION,
    provider_code: DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
    provider_id: DELIVERY_HUB_FULFILLMENT_PROVIDER_ID,
    operation: "create_shipment",
    connection_id: delivery.fulfillment_data.connection_id,
    mode_code: delivery.fulfillment_data.mode_code,
    quote_reference: delivery.fulfillment_data.quote_reference,
    order: payload.order,
    fulfillment: payload.fulfillment,
    items: payload.items,
    outbound_request: {
      method: "POST",
      path: "/shipments",
      headers: {
        authorization: "Bearer delivery-hub-provider-credential",
        "content-type": "application/json",
      },
      body: {
        provider_code: DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
        provider_id: DELIVERY_HUB_FULFILLMENT_PROVIDER_ID,
        connection_id: delivery.fulfillment_data.connection_id,
        mode_code: delivery.fulfillment_data.mode_code,
        quote_reference: delivery.fulfillment_data.quote_reference,
        order: payload.order,
        fulfillment: payload.fulfillment,
        items: payload.items,
        quote: delivery.fulfillment_data.quote,
        pickup_point: delivery.fulfillment_data.pickup_point,
        pickup_window: delivery.fulfillment_data.pickup_window,
      },
    },
  }
}

function buildDeliveryHubProviderExecutionPlanOutboundPayloadPreview(
  executionPlan: DeliveryHubProviderExecutionPlan
) {
  return redactRecord({
    method: executionPlan.outbound_request.method,
    path: executionPlan.outbound_request.path,
    headers: executionPlan.outbound_request.headers,
    body: executionPlan.outbound_request.body,
  })
}

function normalizeItems(items?: Array<Record<string, unknown>>): DeliveryHubCreateFulfillmentBridgeItem[] {
  return (items ?? []).map((item, index) => normalizeItem(item, index))
}

function normalizeItem(item: Record<string, unknown>, index: number): DeliveryHubCreateFulfillmentBridgeItem {
  const quantity = readPositiveInteger(item.quantity)

  if (quantity === null) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Delivery Hub fulfillment bridge item at index ${index} must include a positive integer quantity.`
    )
  }

  return {
    line_item_id: normalizeNullableText(item.line_item_id) ?? normalizeNullableText(item.id),
    quantity,
  }
}

function normalizeOrder(order?: Record<string, unknown> | null): DeliveryHubCreateFulfillmentBridgeOrder {
  const record = asRecord(order)

  return {
    id: normalizeNullableText(record.id),
    display_id: normalizeDisplayId(record.display_id),
    currency_code: normalizeNullableText(record.currency_code),
  }
}

function normalizeFulfillment(
  fulfillment?: Record<string, unknown> | null
): DeliveryHubCreateFulfillmentBridgeFulfillment {
  const record = asRecord(fulfillment)

  return {
    id: normalizeNullableText(record.id),
    location_id: normalizeNullableText(record.location_id),
  }
}

function collectFulfillmentContractIssues(input: {
  option_data?: Record<string, unknown>
  fulfillment_data?: Record<string, unknown>
}) {
  const issues: DeliveryHubCreateFulfillmentBridgeDiagnosticIssue[] = []
  const optionData = asRecord(input.option_data)
  const fulfillmentData = asRecord(input.fulfillment_data)

  appendProviderDriftIssue({
    issues,
    value: optionData.provider_code,
    expected: DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
    field_path: "option_data.provider_code",
  })
  appendProviderDriftIssue({
    issues,
    value: optionData.provider_id,
    expected: DELIVERY_HUB_FULFILLMENT_PROVIDER_ID,
    field_path: "option_data.provider_id",
  })
  appendProviderDriftIssue({
    issues,
    value: fulfillmentData.provider_code,
    expected: DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
    field_path: "fulfillment_data.provider_code",
  })
  appendProviderDriftIssue({
    issues,
    value: fulfillmentData.provider_id,
    expected: DELIVERY_HUB_FULFILLMENT_PROVIDER_ID,
    field_path: "fulfillment_data.provider_id",
  })

  const optionId = normalizeNullableText(optionData.id)

  if (optionId && !optionId.startsWith(`${DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE}:`)) {
    appendDiagnosticIssue(issues, {
      code: "DELIVERY_HUB_PROVIDER_DRIFT",
      message: `Delivery Hub option_data.id must be namespaced under "${DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE}:".` ,
      field_path: "option_data.id",
    })
  }

  if (
    Object.keys(asRecord(fulfillmentData.delivery)).length ||
    Object.keys(asRecord(fulfillmentData.fulfillment_data)).length ||
    Object.keys(asRecord(fulfillmentData.calculated_price_data)).length ||
    Object.keys(asRecord(fulfillmentData.option)).length
  ) {
    appendDiagnosticIssue(issues, {
      code: "DELIVERY_HUB_SHAPE_DRIFT",
      message:
        "Delivery Hub order-side diagnostics expect persisted fulfillment selection data, not nested bridge payload fragments.",
      field_path: "fulfillment_data",
    })
  }

  return issues
}

function appendProviderDriftIssue(input: {
  issues: DeliveryHubCreateFulfillmentBridgeDiagnosticIssue[]
  value: unknown
  expected: string
  field_path: string
}) {
  const actual = normalizeNullableText(input.value)

  if (!actual || actual === input.expected) {
    return
  }

  appendDiagnosticIssue(input.issues, {
    code: "DELIVERY_HUB_PROVIDER_DRIFT",
    message: `Delivery Hub ${input.field_path} expected "${input.expected}" but received "${actual}".`,
    field_path: input.field_path,
  })
}

function buildFulfillmentDiagnosticIssue(
  error: unknown,
  fieldPath: string
): DeliveryHubCreateFulfillmentBridgeDiagnosticIssue {
  const message = getBridgePreviewErrorMessage(error)

  return {
    code:
      message === buildMissingSelectionError().message
        ? "DELIVERY_HUB_MISSING_FULFILLMENT_DATA"
        : "DELIVERY_HUB_INVALID_FULFILLMENT_DATA",
    message,
    field_path: fieldPath,
  }
}

function appendDiagnosticIssue(
  issues: DeliveryHubCreateFulfillmentBridgeDiagnosticIssue[],
  issue: DeliveryHubCreateFulfillmentBridgeDiagnosticIssue
) {
  const duplicate = issues.some(
    (entry) =>
      entry.code === issue.code &&
      entry.field_path === issue.field_path &&
      entry.message === issue.message
  )

  if (!duplicate) {
    issues.push(issue)
  }
}

function assertCompatibleMode(
  expectedModeCode: DeliveryHubFulfillmentModeCode,
  actualModeCode: DeliveryHubFulfillmentModeCode
) {
  if (expectedModeCode === actualModeCode) {
    return
  }

  throw new MedusaError(
    MedusaError.Types.INVALID_DATA,
    "Delivery Hub shipping selection mode does not match the shipping option mode."
  )
}

function buildMissingSelectionError() {
  return new MedusaError(
    MedusaError.Types.INVALID_DATA,
    "Delivery Hub shipping selection must be persisted before price calculation."
  )
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}

function normalizeNullableText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function normalizeDisplayId(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  return normalizeNullableText(value)
}

function readPositiveInteger(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    return null
  }

  return value
}

function buildNeutralDeliveryHubCartSelection(
  modeCode: DeliveryHubFulfillmentModeCode
): DeliveryHubCartSelectionPublic {
  const connectionId = `preview_${modeCode}`
  const warehouseFlow = modeCode === "warehouse_to_pickup_point"

  return {
    version: DELIVERY_HUB_FULFILLMENT_BRIDGE_VERSION,
    connection_id: connectionId,
    quote_type: modeCode,
    quote_reference: createDeliveryHubQuoteReference({
      connection_id: connectionId,
      quote_type: modeCode,
      quote_key: `bridge_preview_${modeCode}`,
    }),
    quote: {
      carrier_code: "deliveryhub_preview",
      carrier_label: "Delivery Hub Preview",
      amount: warehouseFlow ? 499 : 299,
      currency_code: "RUB",
      delivery_eta_min: 1,
      delivery_eta_max: warehouseFlow ? 2 : 1,
      pickup_point_required: true,
      pickup_window_required: warehouseFlow,
    },
    pickup_point: {
      provider_point_id: `preview_point_${modeCode}`,
      provider_point_code: `preview_code_${modeCode}`,
      name: warehouseFlow ? "Preview Pickup Point" : "Preview Dropoff Point",
      address: "Preview street 1",
      city: "Moscow",
      region: "Moscow",
      postal_code: "101000",
      lat: 55.75,
      lng: 37.61,
      is_origin_dropoff_allowed: !warehouseFlow,
      is_destination_pickup_allowed: true,
      payment_methods: ["card"],
    },
    pickup_window: warehouseFlow
      ? {
          date: "2026-01-02",
          time_from: "10:00",
          time_to: "14:00",
          interval_utc: {
            from: "2026-01-02T07:00:00.000Z",
            to: "2026-01-02T11:00:00.000Z",
          },
          label: "2 Jan, 10:00-14:00",
        }
      : null,
    updated_at: "2026-01-01T00:00:00.000Z",
  }
}

function getBridgePreviewErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Delivery Hub bridge preview failed"
}

function getShipmentExecutionUnavailableReason() {
  return "Shipment execution remains intentionally unavailable; diagnostics validate payload assembly and block live shipment automation."
}
