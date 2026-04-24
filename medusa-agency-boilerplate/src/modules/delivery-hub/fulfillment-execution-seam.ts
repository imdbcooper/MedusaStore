import {
  DELIVERY_HUB_CREDENTIALS_STATE,
  DELIVERY_HUB_MODE_CODE,
  DELIVERY_HUB_PROVIDER_YANDEX,
} from "./constants"
import {
  buildYandexCreateShipmentDispatchPortContract,
  buildYandexCreateShipmentDispatchRequest,
  executeYandexCreateShipmentDispatch,
  type YandexCreateShipmentDispatchPortSummary,
  type YandexCreateShipmentDispatchResult,
} from "./adapters/yandex/create-shipment-dispatch-port"
import {
  materializeYandexCreateShipmentPayloadPreview,
  type YandexCreateShipmentMaterializerBlockedReasonCode,
} from "./adapters/yandex/create-shipment-materializer"
import type { DeliveryConnectionRecord } from "./domain/connection"
import { YandexDeliveryClient } from "./adapters/yandex/client"
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
import type {
  DeliveryHubProviderExecutionReference,
  DeliveryHubProviderOriginDispatchContext,
} from "./cart-selection"
import type { DeliveryHubFulfillmentModeCode } from "./shipping-option-contract"
import type { DeliveryHubExecutionState } from "./shipment-execution-contract"

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
  | "execution_ledger_replay_blocked"
  | "execution_ledger_failed_blocked"
  | "execution_ledger_duplicate_execution"
  | "execution_ledger_drift_detected"

export type DeliveryHubControlledFulfillmentExecutionResult = {
  version: typeof DELIVERY_HUB_CONTROLLED_FULFILLMENT_EXECUTION_RESULT_VERSION
  provider_code: typeof DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE
  provider_id: typeof DELIVERY_HUB_FULFILLMENT_PROVIDER_ID
  execution_path: "direct_yandex_controlled_handoff"
  status: "blocked" | "dispatch_prepared" | "dispatch_attempted"
  result_decision:
    | "blocked_before_preparation"
    | "dispatch_prepared_but_blocked"
    | "dispatch_attempted_no_persistence"
  blocking_stage:
    | "handoff_preflight"
    | "connection_readiness"
    | "provider_dispatch_contract"
    | "provider_dispatch_execution"
  blocked_reason_code: DeliveryHubControlledFulfillmentExecutionBlockReasonCode | null
  blocked_reason: string | null
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
    provider_origin_dispatch_context_present: boolean
    shipment_execution_enabled: boolean
    live_adapter_call_performed: boolean
    persisted_execution_ledger_write_performed: boolean
  }
  provider_dispatch_port: YandexCreateShipmentDispatchPortSummary
  provider_payload_materialization: {
    provider_code: typeof DELIVERY_HUB_PROVIDER_YANDEX
    operation: "create_shipment"
    mode: "preview_only"
    status: "ready" | "blocked" | "not_attempted"
    attempted: boolean
    ready: boolean
    blocked_reason_code:
      | YandexCreateShipmentMaterializerBlockedReasonCode
      | "not_applicable_before_dispatch_contract"
      | null
    blocked_reason: string | null
    provider_execution_reference_present: boolean
    provider_origin_dispatch_context_present: boolean
    preview_summary: {
      source_type: "warehouse" | "dropoff_point" | null
      destination_pickup_point_present: boolean
      pickup_interval_present: boolean
      recipient_contact_present: boolean
      packages_present: boolean
      package_count: number
      item_count: number
      connection_mode: string | null
      order_reference_present: boolean
      masked_correlation_id_present: boolean
    }
    anti_leak_confirmations: {
      credentials_included: false
      auth_headers_included: false
      raw_execution_token_included: false
      raw_provider_payload_included: false
    }
  }
  execution_identity: {
    provider_operation_reference: string | null
    idempotency_key_preview: string | null
    plan_fingerprint: string | null
    execution_fingerprint: string | null
  }
  provider_dispatch_result: YandexCreateShipmentDispatchResult | null
  dispatch_result: {
    attempted: boolean
    performed: boolean
    outcome: "not_attempted" | "accepted" | "failed"
    redacted: boolean
    persistence_performed: boolean
    execution_ledger_persistence_performed: boolean
    order_mutation_performed: false
    fulfillment_mutation_performed: false
    safe_message: string
  }
  evidence: {
    status: DeliveryHubExecutionLedgerEvidenceArtifactAssemblyResult["status"] | null
    artifact_kind: string | null
    artifact_evidence_status: string | null
  }
  contour: {
    contract_status: DeliveryHubShipmentExecutionPlanPreview["contract_status"]
    readiness_status: DeliveryHubShipmentExecutionPlanPreview["readiness_verdict"]["status"]
    execution_status: "blocked" | "dispatch_attempted"
    live_dispatch_performed: boolean
    ledger_persistence_performed: boolean
  }
  anti_leak_confirmations: {
    credentials_included: false
    raw_provider_payloads_included: false
    raw_offer_ids_included: false
  }
}

export type DeliveryHubControlledFulfillmentExecutionLedgerRuntime = {
  reserveForDispatch(input: {
    execution_reference: string
    idempotency_key: string
  }): Promise<{
    status: "created" | "matched" | "replay_blocked" | "failed_blocked" | "drifted"
    persistence_performed: boolean
    existing_state: DeliveryHubExecutionState | null
  }>
  markDispatchResultReceived(input: {
    execution_reference: string
    outcome: "accepted" | "failed"
  }): Promise<{
    persistence_performed: boolean
  }>
}

export async function buildDeliveryHubControlledFulfillmentExecutionResult(input: {
  execution_plan_preview: DeliveryHubShipmentExecutionPlanPreview
  handoff: DeliveryHubFulfillmentHandoffSnapshot | null
  execution_ledger_evidence: DeliveryHubExecutionLedgerEvidenceArtifactAssemblyResult | null
  connection: DeliveryConnectionRecord | null
  connection_lookup_available: boolean
  persisted_execution_reference: DeliveryHubProviderExecutionReference | null
  provider_origin_dispatch_context: DeliveryHubProviderOriginDispatchContext | null
  fulfillment_data: Record<string, unknown>
  shipment_execution_enabled: boolean
  execution_ledger_runtime?: DeliveryHubControlledFulfillmentExecutionLedgerRuntime | null
}): Promise<DeliveryHubControlledFulfillmentExecutionResult> {
  const modeCode = input.handoff?.quote_type ?? null
  const modeSupported = isDirectYandexModeSupported(modeCode)
  const connection = input.connection
  const providerExecutionReferencePresent = input.persisted_execution_reference !== null
  const providerOriginDispatchContextPresent = isProviderOriginDispatchContextReadyForMode(
    input.provider_origin_dispatch_context,
    modeCode
  )
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
      provider_origin_dispatch_context: input.provider_origin_dispatch_context,
      provider_origin_dispatch_context_present: providerOriginDispatchContextPresent,
      fulfillment_data: input.fulfillment_data,
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
      provider_origin_dispatch_context: input.provider_origin_dispatch_context,
      provider_origin_dispatch_context_present: providerOriginDispatchContextPresent,
      fulfillment_data: input.fulfillment_data,
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
      provider_origin_dispatch_context: input.provider_origin_dispatch_context,
      provider_origin_dispatch_context_present: providerOriginDispatchContextPresent,
      fulfillment_data: input.fulfillment_data,
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
      provider_origin_dispatch_context: input.provider_origin_dispatch_context,
      provider_origin_dispatch_context_present: providerOriginDispatchContextPresent,
      fulfillment_data: input.fulfillment_data,
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
      provider_origin_dispatch_context: input.provider_origin_dispatch_context,
      provider_origin_dispatch_context_present: providerOriginDispatchContextPresent,
      fulfillment_data: input.fulfillment_data,
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
      provider_origin_dispatch_context: input.provider_origin_dispatch_context,
      provider_origin_dispatch_context_present: providerOriginDispatchContextPresent,
      fulfillment_data: input.fulfillment_data,
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
      provider_origin_dispatch_context: input.provider_origin_dispatch_context,
      provider_origin_dispatch_context_present: providerOriginDispatchContextPresent,
      fulfillment_data: input.fulfillment_data,
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
      provider_origin_dispatch_context: input.provider_origin_dispatch_context,
      provider_origin_dispatch_context_present: providerOriginDispatchContextPresent,
      fulfillment_data: input.fulfillment_data,
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
      provider_origin_dispatch_context: input.provider_origin_dispatch_context,
      provider_origin_dispatch_context_present: providerOriginDispatchContextPresent,
      fulfillment_data: input.fulfillment_data,
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

  if (!providerOriginDispatchContextPresent) {
    return buildBlockedResult({
      execution_plan_preview: input.execution_plan_preview,
      handoff: input.handoff,
      execution_ledger_evidence: input.execution_ledger_evidence,
      connection,
      connection_lookup_available: true,
      persisted_execution_reference_present: true,
      provider_origin_dispatch_context: input.provider_origin_dispatch_context,
      provider_origin_dispatch_context_present: false,
      fulfillment_data: input.fulfillment_data,
      shipment_execution_enabled: input.shipment_execution_enabled,
      mode_code: modeCode,
      mode_supported: true,
      runtime_dispatch_implemented: true,
      blocked_reason_code: "provider_dispatch_not_materialized",
      blocked_reason: resolveMissingProviderOriginDispatchContextBoundary(modeCode),
      status: "dispatch_prepared",
      result_decision: "dispatch_prepared_but_blocked",
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
      provider_origin_dispatch_context: input.provider_origin_dispatch_context,
      provider_origin_dispatch_context_present: true,
      fulfillment_data: input.fulfillment_data,
      shipment_execution_enabled: false,
      mode_code: modeCode,
      mode_supported: true,
      runtime_dispatch_implemented: true,
      blocked_reason_code: "provider_dispatch_not_materialized",
      blocked_reason:
        "Direct Yandex create-shipment dispatch remains blocked because DELIVERY_HUB_SHIPMENT_EXECUTION_ENABLED is not enabled, so createFulfillment() must stay on the no-network controlled seam.",
      status: "dispatch_prepared",
      result_decision: "dispatch_prepared_but_blocked",
      blocking_stage: "provider_dispatch_contract",
    })
  }

  const providerPayloadMaterialization = buildProviderPayloadMaterializationSummary({
    execution_plan_preview: input.execution_plan_preview,
    handoff: input.handoff,
    execution_ledger_evidence: input.execution_ledger_evidence,
    connection,
    connection_lookup_available: true,
    persisted_execution_reference_present: true,
    provider_origin_dispatch_context: input.provider_origin_dispatch_context,
    provider_origin_dispatch_context_present: true,
    fulfillment_data: input.fulfillment_data,
    shipment_execution_enabled: true,
    mode_code: modeCode,
    mode_supported: true,
    blocked_reason_code: "provider_dispatch_not_materialized",
    blocked_reason: resolveDirectYandexDispatchMaterializationBoundary(modeCode),
    status: "dispatch_prepared",
    result_decision: "dispatch_prepared_but_blocked",
    blocking_stage: "provider_dispatch_contract",
  })

  if (providerPayloadMaterialization.status !== "ready") {
    return buildBlockedResult({
      execution_plan_preview: input.execution_plan_preview,
      handoff: input.handoff,
      execution_ledger_evidence: input.execution_ledger_evidence,
      connection,
      connection_lookup_available: true,
      persisted_execution_reference_present: true,
      provider_origin_dispatch_context: input.provider_origin_dispatch_context,
      provider_origin_dispatch_context_present: true,
      fulfillment_data: input.fulfillment_data,
      shipment_execution_enabled: true,
      mode_code: modeCode,
      mode_supported: true,
      runtime_dispatch_implemented: true,
      blocked_reason_code: "provider_dispatch_not_materialized",
      blocked_reason:
        providerPayloadMaterialization.blocked_reason ??
        resolveDirectYandexDispatchMaterializationBoundary(modeCode),
      status: "dispatch_prepared",
      result_decision: "dispatch_prepared_but_blocked",
      blocking_stage: "provider_dispatch_contract",
    })
  }

  const dispatchRequest = buildYandexCreateShipmentDispatchRequest(
    buildYandexDispatchRequestInput({
      execution_plan_preview: input.execution_plan_preview,
      handoff: input.handoff,
      connection,
      provider_origin_dispatch_context: input.provider_origin_dispatch_context,
      fulfillment_data: input.fulfillment_data,
    })
  )

  if (dispatchRequest.status !== "ready") {
    return buildBlockedResult({
      execution_plan_preview: input.execution_plan_preview,
      handoff: input.handoff,
      execution_ledger_evidence: input.execution_ledger_evidence,
      connection,
      connection_lookup_available: true,
      persisted_execution_reference_present: true,
      provider_origin_dispatch_context: input.provider_origin_dispatch_context,
      provider_origin_dispatch_context_present: true,
      fulfillment_data: input.fulfillment_data,
      shipment_execution_enabled: true,
      mode_code: modeCode,
      mode_supported: true,
      runtime_dispatch_implemented: true,
      blocked_reason_code: "provider_dispatch_not_materialized",
      blocked_reason:
        dispatchRequest.blocked_reasons[0]?.message ??
        resolveDirectYandexDispatchMaterializationBoundary(modeCode),
      status: "dispatch_prepared",
      result_decision: "dispatch_prepared_but_blocked",
      blocking_stage: "provider_dispatch_contract",
    })
  }

  const executionReference =
    input.execution_plan_preview.execution_identity?.provider_operation_reference ?? null
  const idempotencyKey = input.execution_plan_preview.execution_identity?.idempotency_key_preview ?? null
  let executionLedgerPersistencePerformed = false

  if (input.execution_ledger_runtime && executionReference && idempotencyKey) {
    const reservation = await input.execution_ledger_runtime.reserveForDispatch({
      execution_reference: executionReference,
      idempotency_key: idempotencyKey,
    })

    if (reservation.status === "replay_blocked") {
      return buildBlockedResult({
        execution_plan_preview: input.execution_plan_preview,
        handoff: input.handoff,
        execution_ledger_evidence: input.execution_ledger_evidence,
        connection,
        connection_lookup_available: true,
        persisted_execution_reference_present: true,
        provider_origin_dispatch_context: input.provider_origin_dispatch_context,
        provider_origin_dispatch_context_present: true,
        fulfillment_data: input.fulfillment_data,
        shipment_execution_enabled: true,
        mode_code: modeCode,
        mode_supported: true,
        runtime_dispatch_implemented: true,
        blocked_reason_code: "execution_ledger_replay_blocked",
        blocked_reason:
          "Controlled execution ledger already completed this canonical shipment execution identity, so replay is blocked before provider dispatch to preserve replay-safe single-call semantics.",
        status: "dispatch_prepared",
        result_decision: "dispatch_prepared_but_blocked",
        blocking_stage: "provider_dispatch_execution",
      })
    }

    if (reservation.status === "failed_blocked") {
      return buildBlockedResult({
        execution_plan_preview: input.execution_plan_preview,
        handoff: input.handoff,
        execution_ledger_evidence: input.execution_ledger_evidence,
        connection,
        connection_lookup_available: true,
        persisted_execution_reference_present: true,
        provider_origin_dispatch_context: input.provider_origin_dispatch_context,
        provider_origin_dispatch_context_present: true,
        fulfillment_data: input.fulfillment_data,
        shipment_execution_enabled: true,
        mode_code: modeCode,
        mode_supported: true,
        runtime_dispatch_implemented: true,
        blocked_reason_code: "execution_ledger_failed_blocked",
        blocked_reason:
          "Controlled execution ledger already has this canonical shipment execution identity in failed_blocked state, so replay is blocked without automatic retry, provider re-dispatch, completion, or shipment persistence.",
        status: "dispatch_prepared",
        result_decision: "dispatch_prepared_but_blocked",
        blocking_stage: "provider_dispatch_execution",
      })
    }

    if (reservation.status === "matched") {
      return buildBlockedResult({
        execution_plan_preview: input.execution_plan_preview,
        handoff: input.handoff,
        execution_ledger_evidence: input.execution_ledger_evidence,
        connection,
        connection_lookup_available: true,
        persisted_execution_reference_present: true,
        provider_origin_dispatch_context: input.provider_origin_dispatch_context,
        provider_origin_dispatch_context_present: true,
        fulfillment_data: input.fulfillment_data,
        shipment_execution_enabled: true,
        mode_code: modeCode,
        mode_supported: true,
        runtime_dispatch_implemented: true,
        blocked_reason_code: "execution_ledger_duplicate_execution",
        blocked_reason:
          "Controlled execution ledger already contains this canonical shipment execution identity in an existing non-terminal state, so direct Yandex dispatch is intentionally blocked to preserve durable single-execution authority.",
        status: "dispatch_prepared",
        result_decision: "dispatch_prepared_but_blocked",
        blocking_stage: "provider_dispatch_execution",
      })
    }

    if (reservation.status === "drifted") {
      return buildBlockedResult({
        execution_plan_preview: input.execution_plan_preview,
        handoff: input.handoff,
        execution_ledger_evidence: input.execution_ledger_evidence,
        connection,
        connection_lookup_available: true,
        persisted_execution_reference_present: true,
        provider_origin_dispatch_context: input.provider_origin_dispatch_context,
        provider_origin_dispatch_context_present: true,
        fulfillment_data: input.fulfillment_data,
        shipment_execution_enabled: true,
        mode_code: modeCode,
        mode_supported: true,
        runtime_dispatch_implemented: true,
        blocked_reason_code: "execution_ledger_drift_detected",
        blocked_reason:
          "Controlled execution ledger detected reservation drift for this canonical shipment execution identity, so live direct Yandex dispatch is blocked until the existing durable record is reconciled.",
        status: "dispatch_prepared",
        result_decision: "dispatch_prepared_but_blocked",
        blocking_stage: "provider_dispatch_execution",
      })
    }

    executionLedgerPersistencePerformed = reservation.persistence_performed
  }

  const dispatchResult = await executeYandexCreateShipmentDispatch({
    client: new YandexDeliveryClient(connection),
    request: dispatchRequest.request,
  })

  if (!dispatchResult.succeeded) {
    const ledgerResult =
      input.execution_ledger_runtime && executionReference
        ? await input.execution_ledger_runtime.markDispatchResultReceived({
            execution_reference: executionReference,
            outcome: "failed",
          })
        : { persistence_performed: false }
    executionLedgerPersistencePerformed =
      executionLedgerPersistencePerformed || ledgerResult.persistence_performed

    return buildDispatchAttemptedResult({
      execution_plan_preview: input.execution_plan_preview,
      handoff: input.handoff,
      execution_ledger_evidence: input.execution_ledger_evidence,
      connection,
      connection_lookup_available: true,
      persisted_execution_reference_present: true,
      provider_origin_dispatch_context: input.provider_origin_dispatch_context,
      provider_origin_dispatch_context_present: true,
      fulfillment_data: input.fulfillment_data,
      shipment_execution_enabled: true,
      mode_code: modeCode,
      mode_supported: true,
      provider_payload_materialization: providerPayloadMaterialization,
      provider_dispatch_result: dispatchResult,
      execution_ledger_persistence_performed: executionLedgerPersistencePerformed,
    })
  }

  if (input.execution_ledger_runtime && executionReference) {
    const ledgerResult = await input.execution_ledger_runtime.markDispatchResultReceived({
      execution_reference: executionReference,
      outcome: "accepted",
    })
    executionLedgerPersistencePerformed =
      executionLedgerPersistencePerformed || ledgerResult.persistence_performed
  }
 
  return buildDispatchAttemptedResult({
    execution_plan_preview: input.execution_plan_preview,
    handoff: input.handoff,
    execution_ledger_evidence: input.execution_ledger_evidence,
    connection,
    connection_lookup_available: true,
    persisted_execution_reference_present: true,
    provider_origin_dispatch_context: input.provider_origin_dispatch_context,
    provider_origin_dispatch_context_present: true,
    fulfillment_data: input.fulfillment_data,
    shipment_execution_enabled: true,
    mode_code: modeCode,
    mode_supported: true,
    provider_payload_materialization: providerPayloadMaterialization,
    provider_dispatch_result: dispatchResult,
    execution_ledger_persistence_performed: executionLedgerPersistencePerformed,
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
  provider_origin_dispatch_context: DeliveryHubProviderOriginDispatchContext | null
  provider_origin_dispatch_context_present: boolean
  fulfillment_data: Record<string, unknown>
  shipment_execution_enabled: boolean
  runtime_dispatch_implemented?: boolean
  blocked_reason_code: DeliveryHubControlledFulfillmentExecutionBlockReasonCode
  blocked_reason: string
  status: DeliveryHubControlledFulfillmentExecutionResult["status"]
  result_decision: DeliveryHubControlledFulfillmentExecutionResult["result_decision"]
  blocking_stage: DeliveryHubControlledFulfillmentExecutionResult["blocking_stage"]
}

type DeliveryHubProviderPayloadMaterializationSummary =
  DeliveryHubControlledFulfillmentExecutionResult["provider_payload_materialization"]

function buildBlockedResult(
  input: BuildBlockedResultInput
): DeliveryHubControlledFulfillmentExecutionResult {
  const providerPayloadMaterialization = buildProviderPayloadMaterializationSummary(input)
  const providerDispatchPort = buildProviderDispatchPortSummary(input, providerPayloadMaterialization)

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
      provider_origin_dispatch_context_present: input.provider_origin_dispatch_context_present,
      shipment_execution_enabled: input.shipment_execution_enabled,
      live_adapter_call_performed: false,
      persisted_execution_ledger_write_performed: false,
    },
    provider_payload_materialization: providerPayloadMaterialization,
    provider_dispatch_port: providerDispatchPort,
    execution_identity: {
      provider_operation_reference:
        input.execution_plan_preview.execution_identity?.provider_operation_reference ?? null,
      idempotency_key_preview:
        input.execution_plan_preview.execution_identity?.idempotency_key_preview ?? null,
      plan_fingerprint: input.execution_plan_preview.execution_identity?.plan_fingerprint ?? null,
      execution_fingerprint:
        input.execution_plan_preview.execution_identity?.execution_fingerprint ?? null,
    },
    provider_dispatch_result: null,
    dispatch_result: {
      attempted: false,
      performed: false,
      outcome: "not_attempted",
      redacted: true,
      persistence_performed: false,
      execution_ledger_persistence_performed: false,
      order_mutation_performed: false,
      fulfillment_mutation_performed: false,
      safe_message:
        "Direct Yandex create_shipment was not attempted on this path; no shipment persistence, no execution-ledger persistence, and no order or fulfillment mutation were performed.",
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

function buildDispatchAttemptedResult(input: {
  execution_plan_preview: DeliveryHubShipmentExecutionPlanPreview
  handoff: DeliveryHubFulfillmentHandoffSnapshot
  execution_ledger_evidence: DeliveryHubExecutionLedgerEvidenceArtifactAssemblyResult | null
  connection: DeliveryConnectionRecord
  connection_lookup_available: boolean
  mode_code: DeliveryHubFulfillmentModeCode | null
  mode_supported: boolean
  persisted_execution_reference_present: boolean
  provider_origin_dispatch_context: DeliveryHubProviderOriginDispatchContext | null
  provider_origin_dispatch_context_present: boolean
  fulfillment_data: Record<string, unknown>
  shipment_execution_enabled: boolean
  provider_payload_materialization: DeliveryHubProviderPayloadMaterializationSummary
  provider_dispatch_result: YandexCreateShipmentDispatchResult
  execution_ledger_persistence_performed: boolean
}): DeliveryHubControlledFulfillmentExecutionResult {
  const providerDispatchPort = buildYandexCreateShipmentDispatchPortContract({
    execution_gate_enabled: input.shipment_execution_enabled,
    preview_available: input.provider_payload_materialization.attempted,
    preview_ready: input.provider_payload_materialization.ready,
    mode_code: input.mode_code,
    supported_mode: input.mode_supported,
    provider_supported: input.connection.provider_code === DELIVERY_HUB_PROVIDER_YANDEX,
    runtime_dispatch_implemented: true,
    dispatch_attempted: true,
    dispatch_blocked: false,
  })

  return {
    version: DELIVERY_HUB_CONTROLLED_FULFILLMENT_EXECUTION_RESULT_VERSION,
    provider_code: DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
    provider_id: DELIVERY_HUB_FULFILLMENT_PROVIDER_ID,
    execution_path: "direct_yandex_controlled_handoff",
    status: "dispatch_attempted",
    result_decision: "dispatch_attempted_no_persistence",
    blocking_stage: "provider_dispatch_execution",
    blocked_reason_code: null,
    blocked_reason: null,
    handoff: {
      available: true,
      connection_id: input.handoff.connection_id,
      quote_type: input.handoff.quote_type,
      quote_reference_summary: {
        id: input.handoff.quote_reference.id,
        version: input.handoff.quote_reference.version,
      },
      references: input.handoff.references,
      correlation_id: input.handoff.correlation_id,
    },
    connection: {
      lookup_available: input.connection_lookup_available,
      id: input.connection.id,
      provider_code: input.connection.provider_code,
      mode: input.connection.mode,
      status: input.connection.status,
      enabled: input.connection.enabled,
      credentials_ready: true,
    },
    dispatch_preparation: {
      provider_code: DELIVERY_HUB_PROVIDER_YANDEX,
      operation: "create_shipment",
      mode_code: input.handoff.quote_type,
      mode_supported: input.mode_supported,
      provider_execution_reference_present: input.persisted_execution_reference_present,
      provider_origin_dispatch_context_present: input.provider_origin_dispatch_context_present,
      shipment_execution_enabled: input.shipment_execution_enabled,
      live_adapter_call_performed: true,
      persisted_execution_ledger_write_performed: input.execution_ledger_persistence_performed,
    },
    provider_dispatch_port: providerDispatchPort.summary,
    provider_payload_materialization: input.provider_payload_materialization,
    execution_identity: {
      provider_operation_reference:
        input.execution_plan_preview.execution_identity?.provider_operation_reference ?? null,
      idempotency_key_preview:
        input.execution_plan_preview.execution_identity?.idempotency_key_preview ?? null,
      plan_fingerprint: input.execution_plan_preview.execution_identity?.plan_fingerprint ?? null,
      execution_fingerprint:
        input.execution_plan_preview.execution_identity?.execution_fingerprint ?? null,
    },
    provider_dispatch_result: input.provider_dispatch_result,
    dispatch_result: {
      attempted: true,
      performed: true,
      outcome: input.provider_dispatch_result.succeeded ? "accepted" : "failed",
      redacted: true,
      persistence_performed: false,
      execution_ledger_persistence_performed: input.execution_ledger_persistence_performed,
      order_mutation_performed: false,
      fulfillment_mutation_performed: false,
      safe_message: input.provider_dispatch_result.succeeded
        ? input.execution_ledger_persistence_performed
          ? "Direct Yandex create_shipment was attempted and accepted in runtime, with canonical execution-ledger reservation/result transitions persisted, only a redacted result returned, and no shipment persistence or order or fulfillment mutation performed at this step."
          : "Direct Yandex create_shipment was attempted and accepted in runtime, with only a redacted result returned; no shipment persistence, no execution-ledger persistence, and no order or fulfillment mutation were performed."
        : input.execution_ledger_persistence_performed
          ? `Direct Yandex create_shipment was attempted in runtime and returned a redacted failure category (${input.provider_dispatch_result.status_category}); canonical execution-ledger reservation/result transitions were persisted, while shipment persistence and order or fulfillment mutation were not performed at this step.`
          : `Direct Yandex create_shipment was attempted in runtime and returned a redacted failure category (${input.provider_dispatch_result.status_category}); no shipment persistence, no execution-ledger persistence, and no order or fulfillment mutation were performed.`,
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
      execution_status: "dispatch_attempted",
      live_dispatch_performed: true,
      ledger_persistence_performed: input.execution_ledger_persistence_performed,
    },
    anti_leak_confirmations: {
      credentials_included: false,
      raw_provider_payloads_included: false,
      raw_offer_ids_included: false,
    },
  }
}

function buildYandexDispatchRequestInput(input: {
  execution_plan_preview: DeliveryHubShipmentExecutionPlanPreview
  handoff: DeliveryHubFulfillmentHandoffSnapshot
  connection: DeliveryConnectionRecord
  provider_origin_dispatch_context: DeliveryHubProviderOriginDispatchContext | null
  fulfillment_data: Record<string, unknown>
}) {
  return {
    mode: input.handoff.quote_type,
    provider_origin_dispatch_context: input.provider_origin_dispatch_context,
    destination_pickup_point: {
      provider_point_id:
        input.execution_plan_preview.normalized.delivery?.fulfillment_data.pickup_point.provider_point_id ?? null,
      provider_point_code:
        input.execution_plan_preview.normalized.delivery?.fulfillment_data.pickup_point.provider_point_code ?? null,
      name: input.handoff.pickup_point_summary.name,
      address: input.handoff.pickup_point_summary.address,
      city: input.handoff.pickup_point_summary.city,
    },
    pickup_interval_utc: input.handoff.pickup_window_summary?.interval_utc ?? null,
    order: {
      order_id: input.execution_plan_preview.normalized.order?.id ?? null,
      display_id: input.execution_plan_preview.normalized.order?.display_id ?? null,
      external_order_reference: input.execution_plan_preview.normalized.order?.id ?? null,
      currency_code: input.execution_plan_preview.normalized.order?.currency_code ?? null,
      total: input.handoff.quote_summary.amount,
    },
    recipient: {
      full_name: resolveRecipientName(input.fulfillment_data, input.execution_plan_preview),
      email: resolveFulfillmentEmail(input.fulfillment_data),
      phone: resolveFulfillmentPhone(input.fulfillment_data),
    },
    address: {
      country_code: resolveFulfillmentShippingAddressField(input.fulfillment_data, "country_code"),
      city:
        resolveFulfillmentShippingAddressField(input.fulfillment_data, "city") ??
        input.handoff.pickup_point_summary.city ??
        null,
      region:
        resolveFulfillmentShippingAddressField(input.fulfillment_data, "province") ??
        input.handoff.pickup_point_summary.region ??
        null,
      postal_code:
        resolveFulfillmentShippingAddressField(input.fulfillment_data, "postal_code") ??
        input.handoff.pickup_point_summary.postal_code ??
        null,
      address_line:
        buildFulfillmentShippingAddressLine(input.fulfillment_data) ??
        input.handoff.pickup_point_summary.address ??
        null,
    },
    packages: buildProviderPayloadPreviewPackages(input.execution_plan_preview),
    connection: {
      connection_id: input.connection.id,
      provider_code: input.connection.provider_code,
      mode: input.connection.mode,
      provider_account_reference: null,
    },
    quote_reference: input.handoff.quote_reference,
    correlation_id: input.handoff.correlation_id,
  }
}

function buildProviderPayloadMaterializationSummary(
  input: BuildBlockedResultInput
): DeliveryHubProviderPayloadMaterializationSummary {
  const baseSummary: DeliveryHubProviderPayloadMaterializationSummary = {
    provider_code: DELIVERY_HUB_PROVIDER_YANDEX,
    operation: "create_shipment",
    mode: "preview_only",
    status: "not_attempted",
    attempted: false,
    ready: false,
    blocked_reason_code: "not_applicable_before_dispatch_contract",
    blocked_reason:
      "Yandex create-shipment payload preview is not attempted before the controlled execution seam reaches provider dispatch contract evaluation.",
    provider_execution_reference_present: input.persisted_execution_reference_present,
    provider_origin_dispatch_context_present: input.provider_origin_dispatch_context_present,
    preview_summary: {
      source_type: null,
      destination_pickup_point_present: false,
      pickup_interval_present: false,
      recipient_contact_present: false,
      packages_present: false,
      package_count: 0,
      item_count: 0,
      connection_mode: input.connection?.mode ?? null,
      order_reference_present: false,
      masked_correlation_id_present: false,
    },
    anti_leak_confirmations: {
      credentials_included: false,
      auth_headers_included: false,
      raw_execution_token_included: false,
      raw_provider_payload_included: false,
    },
  }

  const modeCode = input.handoff?.quote_type ?? input.mode_code

  if (
    input.blocking_stage !== "provider_dispatch_contract" ||
    !isDirectYandexModeSupported(modeCode) ||
    input.connection?.provider_code !== DELIVERY_HUB_PROVIDER_YANDEX
  ) {
    return baseSummary
  }

  const result = materializeYandexCreateShipmentPayloadPreview({
    mode: modeCode,
    provider_origin_dispatch_context: input.provider_origin_dispatch_context,
    destination_pickup_point: {
      provider_point_id:
        input.execution_plan_preview.normalized.delivery?.fulfillment_data.pickup_point.provider_point_id ?? null,
      provider_point_code:
        input.execution_plan_preview.normalized.delivery?.fulfillment_data.pickup_point.provider_point_code ?? null,
      name: input.handoff?.pickup_point_summary.name ?? null,
      address: input.handoff?.pickup_point_summary.address ?? null,
      city: input.handoff?.pickup_point_summary.city ?? null,
    },
    pickup_interval_utc: input.handoff?.pickup_window_summary?.interval_utc ?? null,
    order: {
      order_id: input.execution_plan_preview.normalized.order?.id ?? null,
      display_id: input.execution_plan_preview.normalized.order?.display_id ?? null,
      currency_code: input.execution_plan_preview.normalized.order?.currency_code ?? null,
      total: input.handoff?.quote_summary.amount ?? null,
    },
    recipient: {
      full_name: resolveRecipientName(input.fulfillment_data, input.execution_plan_preview),
      email: resolveFulfillmentEmail(input.fulfillment_data),
      phone: resolveFulfillmentPhone(input.fulfillment_data),
    },
    address: {
      country_code: resolveFulfillmentShippingAddressField(input.fulfillment_data, "country_code"),
      city:
        resolveFulfillmentShippingAddressField(input.fulfillment_data, "city") ??
        input.handoff?.pickup_point_summary.city ??
        null,
      region:
        resolveFulfillmentShippingAddressField(input.fulfillment_data, "province") ??
        input.handoff?.pickup_point_summary.region ??
        null,
      postal_code:
        resolveFulfillmentShippingAddressField(input.fulfillment_data, "postal_code") ??
        input.handoff?.pickup_point_summary.postal_code ??
        null,
      address_line:
        buildFulfillmentShippingAddressLine(input.fulfillment_data) ??
        input.handoff?.pickup_point_summary.address ??
        null,
    },
    packages: buildProviderPayloadPreviewPackages(input.execution_plan_preview),
    connection: {
      connection_id: input.connection?.id ?? null,
      provider_code: input.connection?.provider_code ?? null,
      mode: input.connection?.mode ?? null,
      provider_account_reference: null,
    },
    quote_reference: input.handoff?.quote_reference ?? null,
    correlation_id: input.handoff?.correlation_id ?? null,
  })

  if (result.status === "blocked") {
    const firstBlockedReason = result.blocked_reasons[0] ?? null

    return {
      ...baseSummary,
      status: "blocked",
      attempted: true,
      blocked_reason_code: firstBlockedReason?.code ?? null,
      blocked_reason: firstBlockedReason?.message ?? null,
    }
  }

  return {
    ...baseSummary,
    status: "ready",
    attempted: true,
    ready: true,
    blocked_reason_code: null,
    blocked_reason: null,
    preview_summary: {
      source_type: result.preview.payload.source.type,
      destination_pickup_point_present: !!result.preview.payload.destination.pickup_point_id,
      pickup_interval_present: result.preview.payload.pickup_interval_utc !== null,
      recipient_contact_present:
        result.preview.payload.recipient_contact.name_present &&
        (!!result.preview.payload.recipient_contact.email ||
          !!result.preview.payload.recipient_contact.phone),
      packages_present: result.preview.payload.packages.length > 0,
      package_count: result.preview.payload.packages.length,
      item_count: result.preview.payload.packages.reduce((total, pkg) => total + pkg.item_count, 0),
      connection_mode: result.preview.payload.connection.mode,
      order_reference_present: !!result.preview.payload.order.order_reference,
      masked_correlation_id_present: !!result.preview.payload.correlation_id,
    },
  }
}

function buildProviderDispatchPortSummary(
  input: BuildBlockedResultInput,
  providerPayloadMaterialization: DeliveryHubProviderPayloadMaterializationSummary
): YandexCreateShipmentDispatchPortSummary {
  const modeCode = input.handoff?.quote_type ?? input.mode_code
  const providerSupported = input.connection?.provider_code === DELIVERY_HUB_PROVIDER_YANDEX
  const dispatchPort = buildYandexCreateShipmentDispatchPortContract({
    execution_gate_enabled: input.shipment_execution_enabled,
    preview_available: providerPayloadMaterialization.attempted,
    preview_ready: providerPayloadMaterialization.ready,
    mode_code: modeCode,
    supported_mode: isDirectYandexModeSupported(modeCode),
    provider_supported: providerSupported,
    runtime_dispatch_implemented: input.runtime_dispatch_implemented ?? false,
  })

  return dispatchPort.summary
}

function buildProviderPayloadPreviewPackages(
  executionPlanPreview: DeliveryHubShipmentExecutionPlanPreview
) {
  const items = executionPlanPreview.normalized.items ?? []

  if (!items.length) {
    return []
  }

  return [
    {
      package_reference: executionPlanPreview.execution_identity?.provider_operation_reference ?? null,
      items: items.map((item) => ({
        sku: item.line_item_id,
        quantity: item.quantity,
      })),
    },
  ]
}

function resolveRecipientName(
  fulfillmentData: Record<string, unknown>,
  executionPlanPreview: DeliveryHubShipmentExecutionPlanPreview
) {
  const shippingAddress = readFulfillmentShippingAddressRecord(fulfillmentData)
  const firstName = normalizeRecordString(shippingAddress?.first_name)
  const lastName = normalizeRecordString(shippingAddress?.last_name)
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim()

  if (fullName) {
    return fullName
  }

  const order = executionPlanPreview.normalized.order

  if (order?.id) {
    return `Order ${order.id}`
  }

  if (order?.display_id !== null && order?.display_id !== undefined) {
    return `Order ${String(order.display_id)}`
  }

  const email = resolveFulfillmentEmail(fulfillmentData)

  return email ? `Order recipient ${email}` : null
}

function resolveFulfillmentEmail(fulfillmentData: Record<string, unknown>) {
  return normalizeRecordString(fulfillmentData.email)
}

function resolveFulfillmentPhone(fulfillmentData: Record<string, unknown>) {
  const shippingAddress = readFulfillmentShippingAddressRecord(fulfillmentData)

  return normalizeRecordString(shippingAddress?.phone) ?? normalizeRecordString(fulfillmentData.phone)
}

function resolveFulfillmentShippingAddressField(
  fulfillmentData: Record<string, unknown>,
  field: "country_code" | "city" | "province" | "postal_code"
) {
  return normalizeRecordString(readFulfillmentShippingAddressRecord(fulfillmentData)?.[field])
}

function buildFulfillmentShippingAddressLine(fulfillmentData: Record<string, unknown>) {
  const shippingAddress = readFulfillmentShippingAddressRecord(fulfillmentData)

  if (!shippingAddress) {
    return null
  }

  const line1 = normalizeRecordString(shippingAddress.address_1)
  const line2 = normalizeRecordString(shippingAddress.address_2)
  const line3 = normalizeRecordString(shippingAddress.company)
  const value = [line1, line2, line3].filter(Boolean).join(", ").trim()

  return value || null
}

function readFulfillmentShippingAddressRecord(fulfillmentData: Record<string, unknown>) {
  const shippingAddress = fulfillmentData.shipping_address

  return shippingAddress && typeof shippingAddress === "object"
    ? (shippingAddress as Record<string, unknown>)
    : null
}

function normalizeRecordString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null
}

function isDirectYandexModeSupported(modeCode: DeliveryHubFulfillmentModeCode | null) {
  return (
    modeCode === DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint ||
    modeCode === DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint
  )
}

function isProviderOriginDispatchContextReadyForMode(
  context: DeliveryHubProviderOriginDispatchContext | null,
  modeCode: DeliveryHubFulfillmentModeCode | null
) {
  if (modeCode === DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint) {
    return (
      context?.mode_code === DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint &&
      typeof context.origin_point_id === "string" &&
      context.origin_point_id.trim().length > 0
    )
  }

  if (modeCode === DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint) {
    return (
      context?.mode_code === DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint &&
      typeof context.provider_warehouse_id === "string" &&
      context.provider_warehouse_id.trim().length > 0
    )
  }

  return false
}

function resolveMissingProviderOriginDispatchContextBoundary(
  modeCode: DeliveryHubFulfillmentModeCode | null
) {
  if (modeCode === DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint) {
    return "Direct Yandex create-shipment dispatch remains blocked because the committed backend-only handoff does not persist the provider-origin dropoff point reference required to truthfully materialize dropoff-point-to-pickup-point provider dispatch."
  }

  if (modeCode === DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint) {
    return "Direct Yandex create-shipment dispatch remains blocked because the committed backend-only handoff does not resolve the provider-origin warehouse reference required to truthfully materialize warehouse-to-pickup-point provider dispatch."
  }

  return "Direct Yandex create-shipment dispatch remains blocked because the committed backend-only handoff still lacks the provider-origin dispatch context required to truthfully materialize a live adapter call."
}

function resolveDirectYandexDispatchMaterializationBoundary(
  modeCode: DeliveryHubFulfillmentModeCode | null
) {
  if (modeCode === DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint) {
    return "Direct Yandex create-shipment dispatch remains blocked after provider-origin dropoff context became available; the no-network controlled seam still does not materialize a live dropoff-point-to-pickup-point adapter call in createFulfillment()."
  }

  if (modeCode === DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint) {
    return "Direct Yandex create-shipment dispatch remains blocked after provider-origin warehouse context became available; the no-network controlled seam still does not materialize a live warehouse-to-pickup-point adapter call in createFulfillment()."
  }

  return "Direct Yandex create-shipment dispatch remains blocked after provider-origin dispatch context became available because live adapter execution is still intentionally not materialized in createFulfillment()."
}
