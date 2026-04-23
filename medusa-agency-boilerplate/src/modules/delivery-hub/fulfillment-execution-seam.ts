import {
  DELIVERY_HUB_CREDENTIALS_STATE,
  DELIVERY_HUB_MODE_CODE,
  DELIVERY_HUB_PROVIDER_YANDEX,
} from "./constants"
import type { DeliveryConnectionRecord } from "./domain/connection"
import type {
  DeliveryHubExecutionIdentityPreview,
  DeliveryHubExecutionLedgerEvidenceArtifactAssemblyResult,
  DeliveryHubFulfillmentHandoffSnapshot,
  DeliveryHubShipmentExecutionPlanPreview,
} from "./fulfillment-provider-bridge"
import {
  DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
  DELIVERY_HUB_FULFILLMENT_PROVIDER_ID,
} from "./provider-surface"
import type { DeliveryHubProviderExecutionReference } from "./cart-selection"
import type { DeliveryHubFulfillmentModeCode } from "./shipping-option-contract"

export const DELIVERY_HUB_CONTROLLED_FULFILLMENT_EXECUTION_RESULT_VERSION = 1

export type DeliveryHubControlledFulfillmentExecutionBlockReasonCode =
  | "delivery_hub_handoff_missing"
  | "delivery_connection_lookup_unavailable"
  | "delivery_connection_missing"
  | "delivery_connection_disabled"
  | "delivery_connection_not_active"
  | "delivery_connection_credentials_not_ready"
  | "delivery_connection_provider_not_supported"
  | "delivery_mode_not_supported"
  | "provider_execution_reference_unavailable"
  | "provider_dispatch_not_materialized"

export type DeliveryHubControlledFulfillmentExecutionResult = {
  version: typeof DELIVERY_HUB_CONTROLLED_FULFILLMENT_EXECUTION_RESULT_VERSION
  provider_code: typeof DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE
  provider_id: typeof DELIVERY_HUB_FULFILLMENT_PROVIDER_ID
  execution_path: "direct_yandex_controlled_handoff"
  status: "blocked" | "dispatch_prepared"
  result_decision: "blocked_before_preparation" | "dispatch_prepared_but_blocked"
  blocking_stage: "handoff_preflight" | "connection_readiness" | "provider_dispatch_contract"
  blocked_reason_code: DeliveryHubControlledFulfillmentExecutionBlockReasonCode
  blocked_reason: string
  handoff: {
    available: boolean
    connection_id: string | null
    quote_type: DeliveryHubFulfillmentModeCode | null
    quote_reference_summary: {
      id: string | null
      version: number | null
    }
    references: DeliveryHubFulfillmentHandoffSnapshot["references"] | null
    correlation_id: string | null
  }
  connection: {
    lookup_available: boolean
    id: string | null
    provider_code: string | null
    mode: DeliveryConnectionRecord["mode"] | null
    status: DeliveryConnectionRecord["status"] | null
    enabled: boolean | null
    credentials_ready: boolean
  }
  dispatch_preparation: {
    provider_code: typeof DELIVERY_HUB_PROVIDER_YANDEX
    operation: "create_shipment"
    mode_code: DeliveryHubFulfillmentModeCode | null
    mode_supported: boolean
    provider_execution_reference_present: boolean
    shipment_execution_enabled: boolean
    live_adapter_call_performed: false
    persisted_execution_ledger_write_performed: false
  }
  execution_identity: {
    provider_operation_reference: string | null
    idempotency_key_preview: string | null
    plan_fingerprint: string | null
    execution_fingerprint: string | null
  }
  evidence: {
    status: DeliveryHubExecutionLedgerEvidenceArtifactAssemblyResult["status"] | null
    artifact_kind: string | null
    artifact_evidence_status: string | null
  }
  contour: {
    contract_status: DeliveryHubShipmentExecutionPlanPreview["contract_status"]
    readiness_status: DeliveryHubShipmentExecutionPlanPreview["readiness_verdict"]["status"]
    execution_status: "blocked"
    live_dispatch_performed: false
    ledger_persistence_performed: false
  }
  anti_leak_confirmations: {
    credentials_included: false
    raw_provider_payloads_included: false
    raw_offer_ids_included: false
  }
}

export function buildDeliveryHubControlledFulfillmentExecutionResult(input: {
  execution_plan_preview: DeliveryHubShipmentExecutionPlanPreview
  handoff: DeliveryHubFulfillmentHandoffSnapshot | null
  execution_ledger_evidence: DeliveryHubExecutionLedgerEvidenceArtifactAssemblyResult | null
  connection: DeliveryConnectionRecord | null
  connection_lookup_available: boolean
  persisted_execution_reference: DeliveryHubProviderExecutionReference | null
  shipment_execution_enabled: boolean
}): DeliveryHubControlledFulfillmentExecutionResult {
  const modeCode = input.handoff?.quote_type ?? null
  const modeSupported = isDirectYandexModeSupported(modeCode)
  const connection = input.connection
  const providerExecutionReferencePresent = input.persisted_execution_reference !== null
  const connectionReady =
    connection !== null &&
    connection.enabled &&
    connection.status === "active" &&
    connection.credentials_state === DELIVERY_HUB_CREDENTIALS_STATE.sealed

  if (!input.handoff) {
    return buildBlockedResult({
      execution_plan_preview: input.execution_plan_preview,
      handoff: null,
      execution_ledger_evidence: input.execution_ledger_evidence,
      connection: input.connection,
      connection_lookup_available: input.connection_lookup_available,
      persisted_execution_reference_present: providerExecutionReferencePresent,
      shipment_execution_enabled: input.shipment_execution_enabled,
      mode_code: modeCode,
      mode_supported: modeSupported,
      blocked_reason_code: "delivery_hub_handoff_missing",
      blocked_reason:
        "Controlled Delivery Hub fulfillment execution requires a committed Delivery Hub handoff assembled from the saved neutral selection and committed shipping option.",
      status: "blocked",
      result_decision: "blocked_before_preparation",
      blocking_stage: "handoff_preflight",
    })
  }

  if (!input.connection_lookup_available) {
    return buildBlockedResult({
      execution_plan_preview: input.execution_plan_preview,
      handoff: input.handoff,
      execution_ledger_evidence: input.execution_ledger_evidence,
      connection: null,
      connection_lookup_available: false,
      persisted_execution_reference_present: providerExecutionReferencePresent,
      shipment_execution_enabled: input.shipment_execution_enabled,
      mode_code: modeCode,
      mode_supported: modeSupported,
      blocked_reason_code: "delivery_connection_lookup_unavailable",
      blocked_reason:
        "Controlled Delivery Hub fulfillment execution cannot resolve Delivery Hub connection readiness because the runtime PG connection seam is unavailable.",
      status: "blocked",
      result_decision: "blocked_before_preparation",
      blocking_stage: "connection_readiness",
    })
  }

  if (!connection) {
    return buildBlockedResult({
      execution_plan_preview: input.execution_plan_preview,
      handoff: input.handoff,
      execution_ledger_evidence: input.execution_ledger_evidence,
      connection,
      connection_lookup_available: true,
      persisted_execution_reference_present: providerExecutionReferencePresent,
      shipment_execution_enabled: input.shipment_execution_enabled,
      mode_code: modeCode,
      mode_supported: modeSupported,
      blocked_reason_code: "delivery_connection_missing",
      blocked_reason:
        "Controlled Delivery Hub fulfillment execution cannot continue because the committed Delivery Hub connection no longer exists.",
      status: "blocked",
      result_decision: "blocked_before_preparation",
      blocking_stage: "connection_readiness",
    })
  }

  if (!connection.enabled) {
    return buildBlockedResult({
      execution_plan_preview: input.execution_plan_preview,
      handoff: input.handoff,
      execution_ledger_evidence: input.execution_ledger_evidence,
      connection,
      connection_lookup_available: true,
      persisted_execution_reference_present: providerExecutionReferencePresent,
      shipment_execution_enabled: input.shipment_execution_enabled,
      mode_code: modeCode,
      mode_supported: modeSupported,
      blocked_reason_code: "delivery_connection_disabled",
      blocked_reason:
        "Controlled Delivery Hub fulfillment execution is blocked because the committed Delivery Hub connection is disabled.",
      status: "blocked",
      result_decision: "blocked_before_preparation",
      blocking_stage: "connection_readiness",
    })
  }

  if (connection.status !== "active") {
    return buildBlockedResult({
      execution_plan_preview: input.execution_plan_preview,
      handoff: input.handoff,
      execution_ledger_evidence: input.execution_ledger_evidence,
      connection,
      connection_lookup_available: true,
      persisted_execution_reference_present: providerExecutionReferencePresent,
      shipment_execution_enabled: input.shipment_execution_enabled,
      mode_code: modeCode,
      mode_supported: modeSupported,
      blocked_reason_code: "delivery_connection_not_active",
      blocked_reason:
        "Controlled Delivery Hub fulfillment execution is blocked because the committed Delivery Hub connection is not active.",
      status: "blocked",
      result_decision: "blocked_before_preparation",
      blocking_stage: "connection_readiness",
    })
  }

  if (connection.credentials_state !== DELIVERY_HUB_CREDENTIALS_STATE.sealed) {
    return buildBlockedResult({
      execution_plan_preview: input.execution_plan_preview,
      handoff: input.handoff,
      execution_ledger_evidence: input.execution_ledger_evidence,
      connection,
      connection_lookup_available: true,
      persisted_execution_reference_present: providerExecutionReferencePresent,
      shipment_execution_enabled: input.shipment_execution_enabled,
      mode_code: modeCode,
      mode_supported: modeSupported,
      blocked_reason_code: "delivery_connection_credentials_not_ready",
      blocked_reason:
        "Controlled Delivery Hub fulfillment execution is blocked because the committed Delivery Hub connection credentials are not ready.",
      status: "blocked",
      result_decision: "blocked_before_preparation",
      blocking_stage: "connection_readiness",
    })
  }

  if (connection.provider_code !== DELIVERY_HUB_PROVIDER_YANDEX) {
    return buildBlockedResult({
      execution_plan_preview: input.execution_plan_preview,
      handoff: input.handoff,
      execution_ledger_evidence: input.execution_ledger_evidence,
      connection,
      connection_lookup_available: true,
      persisted_execution_reference_present: providerExecutionReferencePresent,
      shipment_execution_enabled: input.shipment_execution_enabled,
      mode_code: modeCode,
      mode_supported: modeSupported,
      blocked_reason_code: "delivery_connection_provider_not_supported",
      blocked_reason:
        "Controlled Delivery Hub fulfillment execution currently supports only the direct Yandex adapter for committed Delivery Hub handoff dispatch.",
      status: "blocked",
      result_decision: "blocked_before_preparation",
      blocking_stage: "connection_readiness",
    })
  }

  if (!modeSupported) {
    return buildBlockedResult({
      execution_plan_preview: input.execution_plan_preview,
      handoff: input.handoff,
      execution_ledger_evidence: input.execution_ledger_evidence,
      connection,
      connection_lookup_available: true,
      persisted_execution_reference_present: providerExecutionReferencePresent,
      shipment_execution_enabled: input.shipment_execution_enabled,
      mode_code: modeCode,
      mode_supported: false,
      blocked_reason_code: "delivery_mode_not_supported",
      blocked_reason:
        "Controlled Delivery Hub fulfillment execution is blocked because the committed Delivery Hub mode is not supported by the direct Yandex execution seam.",
      status: "blocked",
      result_decision: "blocked_before_preparation",
      blocking_stage: "provider_dispatch_contract",
    })
  }

  if (!providerExecutionReferencePresent) {
    return buildBlockedResult({
      execution_plan_preview: input.execution_plan_preview,
      handoff: input.handoff,
      execution_ledger_evidence: input.execution_ledger_evidence,
      connection,
      connection_lookup_available: true,
      persisted_execution_reference_present: false,
      shipment_execution_enabled: input.shipment_execution_enabled,
      mode_code: modeCode,
      mode_supported: true,
      blocked_reason_code: "provider_execution_reference_unavailable",
      blocked_reason:
        "Direct Yandex create-shipment dispatch remains blocked because the committed Delivery Hub cart no longer yields a valid backend-only persisted execution reference for provider dispatch preparation.",
      status: connectionReady ? "dispatch_prepared" : "blocked",
      result_decision: connectionReady
        ? "dispatch_prepared_but_blocked"
        : "blocked_before_preparation",
      blocking_stage: "provider_dispatch_contract",
    })
  }

  if (!input.shipment_execution_enabled) {
    return buildBlockedResult({
      execution_plan_preview: input.execution_plan_preview,
      handoff: input.handoff,
      execution_ledger_evidence: input.execution_ledger_evidence,
      connection,
      connection_lookup_available: true,
      persisted_execution_reference_present: true,
      shipment_execution_enabled: false,
      mode_code: modeCode,
      mode_supported: true,
      blocked_reason_code: "provider_dispatch_not_materialized",
      blocked_reason:
        "Direct Yandex create-shipment dispatch remains blocked because DELIVERY_HUB_SHIPMENT_EXECUTION_ENABLED is not enabled, so createFulfillment() must stay on the no-network controlled seam.",
      status: "dispatch_prepared",
      result_decision: "dispatch_prepared_but_blocked",
      blocking_stage: "provider_dispatch_contract",
    })
  }

  return buildBlockedResult({
    execution_plan_preview: input.execution_plan_preview,
    handoff: input.handoff,
    execution_ledger_evidence: input.execution_ledger_evidence,
    connection,
    connection_lookup_available: true,
    persisted_execution_reference_present: true,
    shipment_execution_enabled: true,
    mode_code: modeCode,
    mode_supported: true,
    blocked_reason_code: "provider_dispatch_not_materialized",
    blocked_reason: resolveDirectYandexDispatchMaterializationBoundary(modeCode),
    status: "dispatch_prepared",
    result_decision: "dispatch_prepared_but_blocked",
    blocking_stage: "provider_dispatch_contract",
  })
}

type BuildBlockedResultInput = {
  execution_plan_preview: DeliveryHubShipmentExecutionPlanPreview
  handoff: DeliveryHubFulfillmentHandoffSnapshot | null
  execution_ledger_evidence: DeliveryHubExecutionLedgerEvidenceArtifactAssemblyResult | null
  connection: DeliveryConnectionRecord | null
  connection_lookup_available: boolean
  mode_code: DeliveryHubFulfillmentModeCode | null
  mode_supported: boolean
  persisted_execution_reference_present: boolean
  shipment_execution_enabled: boolean
  blocked_reason_code: DeliveryHubControlledFulfillmentExecutionBlockReasonCode
  blocked_reason: string
  status: DeliveryHubControlledFulfillmentExecutionResult["status"]
  result_decision: DeliveryHubControlledFulfillmentExecutionResult["result_decision"]
  blocking_stage: DeliveryHubControlledFulfillmentExecutionResult["blocking_stage"]
}

function buildBlockedResult(
  input: BuildBlockedResultInput
): DeliveryHubControlledFulfillmentExecutionResult {
  return {
    version: DELIVERY_HUB_CONTROLLED_FULFILLMENT_EXECUTION_RESULT_VERSION,
    provider_code: DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
    provider_id: DELIVERY_HUB_FULFILLMENT_PROVIDER_ID,
    execution_path: "direct_yandex_controlled_handoff",
    status: input.status,
    result_decision: input.result_decision,
    blocking_stage: input.blocking_stage,
    blocked_reason_code: input.blocked_reason_code,
    blocked_reason: input.blocked_reason,
    handoff: {
      available: input.handoff !== null,
      connection_id: input.handoff?.connection_id ?? null,
      quote_type: input.handoff?.quote_type ?? input.mode_code,
      quote_reference_summary: {
        id: input.handoff?.quote_reference.id ?? null,
        version: input.handoff?.quote_reference.version ?? null,
      },
      references: input.handoff?.references ?? null,
      correlation_id: input.handoff?.correlation_id ?? null,
    },
    connection: {
      lookup_available: input.connection_lookup_available,
      id: input.connection?.id ?? null,
      provider_code: input.connection?.provider_code ?? null,
      mode: input.connection?.mode ?? null,
      status: input.connection?.status ?? null,
      enabled: input.connection?.enabled ?? null,
      credentials_ready:
        input.connection?.credentials_state === DELIVERY_HUB_CREDENTIALS_STATE.sealed,
    },
    dispatch_preparation: {
      provider_code: DELIVERY_HUB_PROVIDER_YANDEX,
      operation: "create_shipment",
      mode_code: input.handoff?.quote_type ?? input.mode_code,
      mode_supported: input.mode_supported,
      provider_execution_reference_present: input.persisted_execution_reference_present,
      shipment_execution_enabled: input.shipment_execution_enabled,
      live_adapter_call_performed: false,
      persisted_execution_ledger_write_performed: false,
    },
    execution_identity: {
      provider_operation_reference:
        input.execution_plan_preview.execution_identity?.provider_operation_reference ?? null,
      idempotency_key_preview:
        input.execution_plan_preview.execution_identity?.idempotency_key_preview ?? null,
      plan_fingerprint: input.execution_plan_preview.execution_identity?.plan_fingerprint ?? null,
      execution_fingerprint:
        input.execution_plan_preview.execution_identity?.execution_fingerprint ?? null,
    },
    evidence: {
      status: input.execution_ledger_evidence?.status ?? null,
      artifact_kind: input.execution_ledger_evidence?.artifact?.artifact_kind ?? null,
      artifact_evidence_status:
        input.execution_ledger_evidence?.artifact?.evidence_status ?? null,
    },
    contour: {
      contract_status: input.execution_plan_preview.contract_status,
      readiness_status: input.execution_plan_preview.readiness_verdict.status,
      execution_status: "blocked",
      live_dispatch_performed: false,
      ledger_persistence_performed: false,
    },
    anti_leak_confirmations: {
      credentials_included: false,
      raw_provider_payloads_included: false,
      raw_offer_ids_included: false,
    },
  }
}

function isDirectYandexModeSupported(modeCode: DeliveryHubFulfillmentModeCode | null) {
  return (
    modeCode === DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint ||
    modeCode === DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint
  )
}

function resolveDirectYandexDispatchMaterializationBoundary(
  modeCode: DeliveryHubFulfillmentModeCode | null
) {
  if (modeCode === DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint) {
    return "Direct Yandex create-shipment dispatch remains blocked because the committed backend-only handoff does not persist the origin_point_id required to truthfully materialize dropoff-point-to-pickup-point provider dispatch."
  }

  if (modeCode === DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint) {
    return "Direct Yandex create-shipment dispatch remains blocked because the committed backend-only handoff does not resolve the provider warehouse reference required to truthfully materialize warehouse-to-pickup-point provider dispatch."
  }

  return "Direct Yandex create-shipment dispatch remains blocked because the committed backend-only handoff still lacks the provider-origin dispatch context required to truthfully materialize a live adapter call."
}
