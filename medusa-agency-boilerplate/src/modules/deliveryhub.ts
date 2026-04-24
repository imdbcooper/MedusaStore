import type {
  CalculateShippingOptionPriceDTO,
  CreateFulfillmentResult,
  FulfillmentDTO,
  FulfillmentItemDTO,
  FulfillmentOption,
  FulfillmentOrderDTO,
  Logger,
} from "@medusajs/framework/types"
import {
  AbstractFulfillmentProviderService,
  MedusaError,
  ModuleProvider,
  Modules,
} from "@medusajs/framework/utils"
import {
  buildDeliveryHubExecutionLedgerEvidenceArtifactAssembly,
  buildDeliveryHubFulfillmentContractVerdict,
  buildDeliveryHubFulfillmentBridgePayload,
  buildDeliveryHubFulfillmentHandoffSnapshot,
  buildDeliveryHubShipmentExecutionPlanPreview,
} from "./delivery-hub/fulfillment-provider-bridge"
import {
  buildDeliveryHubControlledFulfillmentExecutionResult,
  type DeliveryHubControlledFulfillmentExecutionLedgerRuntime,
} from "./delivery-hub/fulfillment-execution-seam"
import {
  getDeliveryHubCartById,
  getDeliveryHubQuery,
  readDeliveryHubCartSelection,
  readDeliveryHubCartSelectionBackendExecutionReference,
  readDeliveryHubProviderExecutionReferenceOriginContext,
  validateDeliveryHubProviderExecutionReference,
} from "./delivery-hub/cart-selection"
import {
  DELIVERY_HUB_FULFILLMENT_OPTION_DEFINITIONS,
  DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
  normalizeDeliveryHubFulfillmentOptionData,
} from "./delivery-hub/provider-surface"
import { getDeliveryConnectionByIdReadOnly } from "./delivery-hub/storage/connections-repository"
import { getDeliveryHubPgConnection } from "./delivery-hub/storage/pg"
import {
  buildDeliveryHubShipmentPersistenceRequestSummary,
  buildDeliveryHubShipmentPersistenceResponseSummary,
  upsertDeliveryShipment,
} from "./delivery-hub/storage/shipments-repository"
import { DeliveryHubExecutionLedgerPgRepository } from "./delivery-hub/storage/execution-ledger-pg-repository"
import {
  DELIVERY_HUB_EXECUTION_STATE,
  buildDeliveryHubControlledExecutionAuditDraft,
  buildDeliveryHubControlledExecutionRecordDraft,
  buildDeliveryHubControlledExecutionReservationDraft,
  canDispatchDeliveryHubControlledExecution,
  canFailBlockedDeliveryHubControlledExecution,
} from "./delivery-hub/shipment-execution-contract"

type InjectedDependencies = {
  logger: Logger
  [key: string]: unknown
}

export class DeliveryHubFulfillmentProvider extends AbstractFulfillmentProviderService {
  static identifier = DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE

  protected readonly logger_: Logger
  protected readonly container_: Record<string, unknown>

  constructor({ logger, ...container }: InjectedDependencies) {
    super()

    this.logger_ = logger
    this.container_ = container as Record<string, unknown>
  }

  static validateOptions() {
    return
  }

  async getFulfillmentOptions(): Promise<FulfillmentOption[]> {
    return DELIVERY_HUB_FULFILLMENT_OPTION_DEFINITIONS.map((definition) => ({
      id: definition.id,
      name: formatDeliveryHubFulfillmentOptionName(definition.mode_code),
      mode_code: definition.mode_code,
    }))
  }

  async validateOption(data: Record<string, unknown>): Promise<boolean> {
    try {
      normalizeDeliveryHubFulfillmentOptionData(data)
      return true
    } catch {
      return false
    }
  }

  async validateFulfillmentData(
    optionData: Record<string, unknown>,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const defaultModeCode =
      typeof optionData.mode_code === "string" && optionData.mode_code.trim()
        ? optionData.mode_code
        : null
    const verdict = buildDeliveryHubFulfillmentContractVerdict({
      option_data: optionData,
      fulfillment_data: data,
      default_mode_code: defaultModeCode,
    })

    if (verdict.contract_status !== "ready" || !verdict.normalized.delivery) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Delivery Hub fulfillment data is blocked: ${verdict.blocked_reasons.join("; ")}`
      )
    }

    return verdict.normalized.delivery.fulfillment_data
  }

  async canCalculate(): Promise<boolean> {
    return true
  }

  async calculatePrice(
    optionData: CalculateShippingOptionPriceDTO["optionData"],
    data: CalculateShippingOptionPriceDTO["data"]
  ) {
    const normalizedOption = normalizeDeliveryHubFulfillmentOptionData(optionData)
    const bridge = buildDeliveryHubFulfillmentBridgePayload({
      option_data: normalizedOption,
      fulfillment_data: data,
      default_mode_code: normalizedOption.mode_code,
    })

    this.logger_.info(
      `Delivery Hub calculated price materialized: ${JSON.stringify({
        connection_id: bridge.fulfillment_data.connection_id,
        mode_code: bridge.fulfillment_data.mode_code,
        quote_reference: bridge.fulfillment_data.quote_reference,
        amount: bridge.fulfillment_data.quote.amount,
        currency_code: bridge.fulfillment_data.quote.currency_code,
      })}`
    )

    return {
      calculated_amount: bridge.fulfillment_data.quote.amount,
      is_calculated_price_tax_inclusive: true,
      data: bridge.calculated_price_data,
    }
  }

  async createFulfillment(
    data: Record<string, unknown>,
    items: Partial<Omit<FulfillmentItemDTO, "fulfillment">>[],
    order: Partial<FulfillmentOrderDTO> | undefined,
    fulfillment: Partial<Omit<FulfillmentDTO, "provider_id" | "data" | "items">>
  ): Promise<CreateFulfillmentResult> {
    const orderRecord = order as Record<string, unknown> | undefined
    const fulfillmentRecord = fulfillment as Record<string, unknown>
    const executionPlanPreview = buildDeliveryHubShipmentExecutionPlanPreview({
      fulfillment_data: data,
      items: items.map((item) => item as Record<string, unknown>),
      order: orderRecord,
      fulfillment: fulfillmentRecord,
    })
    const handoffInput = data as Record<string, unknown>
    const fulfillmentHandoff =
      executionPlanPreview.contract_status === "ready" &&
      typeof handoffInput.shipping_option_id === "string" &&
      handoffInput.shipping_option_id.trim()
        ? buildDeliveryHubFulfillmentHandoffSnapshot({
            fulfillment_data: data,
            order: orderRecord,
            fulfillment: fulfillmentRecord,
          })
        : null
    const executionLedgerEvidence =
      executionPlanPreview.contract_status === "ready" && fulfillmentHandoff !== null
        ? buildDeliveryHubExecutionLedgerEvidenceArtifactAssembly({
            fulfillment_data: data,
            order: orderRecord,
            fulfillment: fulfillmentRecord,
          })
        : null
 
    this.logger_.info(
      `Delivery Hub createFulfillment execution-plan preview seam evaluated: ${JSON.stringify({
        contract_status: executionPlanPreview.contract_status,
        execution_status: executionPlanPreview.execution_status,
        readiness_status: executionPlanPreview.readiness_verdict.status,
        blocked_reasons: executionPlanPreview.blocked_reasons,
        connection_id:
          executionPlanPreview.normalized.delivery?.fulfillment_data.connection_id ?? null,
        mode_code: executionPlanPreview.normalized.delivery?.fulfillment_data.mode_code ?? null,
        quote_reference:
          executionPlanPreview.normalized.provider_execution_plan?.quote_reference ?? null,
        item_count: executionPlanPreview.normalized.items?.length ?? 0,
        order_id: executionPlanPreview.normalized.order?.id ?? null,
        handoff_ready: fulfillmentHandoff !== null,
        handoff_reference: fulfillmentHandoff?.references ?? null,
        handoff_contour: fulfillmentHandoff?.contour ?? null,
        execution_ledger_evidence_status: executionLedgerEvidence?.status ?? null,
        execution_ledger_evidence_preview:
          executionLedgerEvidence?.artifact
            ? {
                artifact_kind: executionLedgerEvidence.artifact.artifact_kind,
                evidence_status: executionLedgerEvidence.artifact.evidence_status,
                quote_reference_summary:
                  executionLedgerEvidence.artifact.quote_reference_summary,
                references: executionLedgerEvidence.artifact.references,
                contour: executionLedgerEvidence.artifact.contour,
              }
            : null,
        outbound_preview_redacted: executionPlanPreview.outbound_payload_preview.redacted,
      })}`
    )

    if (executionPlanPreview.contract_status !== "ready") {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Delivery Hub createFulfillment input is blocked: ${executionPlanPreview.blocked_reasons.join("; ")}`
      )
    }

    const pgConnection = this.resolvePgConnection()
    const committedConnectionId = fulfillmentHandoff?.connection_id ?? null
    const committedCartId =
      fulfillmentHandoff?.references.cart_id ??
      (typeof handoffInput.cart_id === "string" && handoffInput.cart_id.trim()
        ? handoffInput.cart_id.trim()
        : null)
    let committedConnection: Awaited<ReturnType<typeof getDeliveryConnectionByIdReadOnly>> = null
    let connectionLookupAvailable = pgConnection !== null
    const persistedExecutionReference = await this.resolvePersistedExecutionReference({
      cart_id: committedCartId,
      connection_id: fulfillmentHandoff?.connection_id ?? null,
      quote_type: fulfillmentHandoff?.quote_type ?? null,
      quote_reference: fulfillmentHandoff?.quote_reference ?? null,
    })

    if (pgConnection && committedConnectionId) {
      try {
        committedConnection = await getDeliveryConnectionByIdReadOnly(
          pgConnection,
          committedConnectionId
        )
      } catch {
        connectionLookupAvailable = false
      }
    }

    const executionLedgerRuntime = this.buildControlledExecutionLedgerRuntime({
      execution_plan_preview: executionPlanPreview,
      pg_connection: pgConnection,
    })
    const controlledExecution = await buildDeliveryHubControlledFulfillmentExecutionResult({
      execution_plan_preview: executionPlanPreview,
      handoff: fulfillmentHandoff,
      execution_ledger_evidence: executionLedgerEvidence,
      connection: committedConnection,
      connection_lookup_available: connectionLookupAvailable,
      persisted_execution_reference: persistedExecutionReference,
      provider_origin_dispatch_context: persistedExecutionReference
        ? readDeliveryHubProviderExecutionReferenceOriginContext(persistedExecutionReference)
        : null,
      fulfillment_data: handoffInput,
      shipment_execution_enabled: isDeliveryHubShipmentExecutionEnabled(),
      execution_ledger_runtime: executionLedgerRuntime,
    })
    const persistedShipment = await this.persistControlledExecutionShipment({
      controlled_execution: controlledExecution,
      execution_plan_preview: executionPlanPreview,
      handoff: fulfillmentHandoff,
      fulfillment: fulfillmentRecord,
      order: orderRecord,
      pg_connection: pgConnection,
    })

    this.logger_.info(
      `Delivery Hub createFulfillment controlled execution seam evaluated: ${JSON.stringify({
        status: controlledExecution.status,
        result_decision: controlledExecution.result_decision,
        blocking_stage: controlledExecution.blocking_stage,
        blocked_reason_code: controlledExecution.blocked_reason_code,
        handoff: {
          available: controlledExecution.handoff.available,
          connection_id: controlledExecution.handoff.connection_id,
          quote_type: controlledExecution.handoff.quote_type,
          quote_reference_summary: {
            present: !!controlledExecution.handoff.quote_reference_summary.id,
            version: controlledExecution.handoff.quote_reference_summary.version,
          },
          references: controlledExecution.handoff.references,
          correlation_id_present: !!controlledExecution.handoff.correlation_id,
        },
        connection: {
          lookup_available: controlledExecution.connection.lookup_available,
          id: controlledExecution.connection.id,
          provider_code: controlledExecution.connection.provider_code,
          mode: controlledExecution.connection.mode,
          status: controlledExecution.connection.status,
          enabled: controlledExecution.connection.enabled,
          credentials_ready: controlledExecution.connection.credentials_ready,
        },
        dispatch_preparation: controlledExecution.dispatch_preparation,
        provider_dispatch_port: controlledExecution.provider_dispatch_port,
        provider_payload_materialization: controlledExecution.provider_payload_materialization,
        provider_dispatch_result: controlledExecution.provider_dispatch_result,
        dispatch_result: controlledExecution.dispatch_result,
        execution_identity: controlledExecution.execution_identity,
        shipment_persistence: persistedShipment
          ? {
              id: persistedShipment.id,
              execution_reference: persistedShipment.execution_reference,
              outcome: persistedShipment.outcome,
              status: persistedShipment.status,
              accepted: persistedShipment.accepted,
              succeeded: persistedShipment.succeeded,
              provider_shipment_reference_present:
                persistedShipment.provider_shipment_reference_present,
              provider_correlation_reference_present:
                persistedShipment.provider_correlation_reference_present,
              label_document_present: persistedShipment.label_document_present,
              attachment_document_present: persistedShipment.attachment_document_present,
            }
          : null,
        evidence: controlledExecution.evidence,
        contour: controlledExecution.contour,
        anti_leak_confirmations: controlledExecution.anti_leak_confirmations,
      })}`
    )

    return {
      data: {
        provider_code: DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
        controlled_execution: controlledExecution,
        shipment_persistence: persistedShipment
          ? {
              id: persistedShipment.id,
              execution_reference: persistedShipment.execution_reference,
              outcome: persistedShipment.outcome,
              status: persistedShipment.status,
              accepted: persistedShipment.accepted,
              succeeded: persistedShipment.succeeded,
              provider_shipment_reference_present:
                persistedShipment.provider_shipment_reference_present,
              provider_correlation_reference_present:
                persistedShipment.provider_correlation_reference_present,
              label_document_present: persistedShipment.label_document_present,
              attachment_document_present: persistedShipment.attachment_document_present,
              created_at: persistedShipment.created_at,
              updated_at: persistedShipment.updated_at,
            }
          : null,
      },
      labels: [],
    }
  }

  async cancelFulfillment(): Promise<Record<string, never>> {
    return {}
  }

  async getFulfillmentDocuments(): Promise<never[]> {
    return []
  }

  async createReturnFulfillment(_: Record<string, unknown>): Promise<CreateFulfillmentResult> {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Delivery Hub return shipment automation is not materialized in the current provider scaffold."
    )
  }

  async getReturnDocuments(): Promise<never[]> {
    return []
  }

  async getShipmentDocuments(): Promise<never[]> {
    return []
  }

  async retrieveDocuments(): Promise<void> {
    return
  }
  protected async persistControlledExecutionShipment(input: {
    controlled_execution: Awaited<ReturnType<typeof buildDeliveryHubControlledFulfillmentExecutionResult>>
    execution_plan_preview: ReturnType<typeof buildDeliveryHubShipmentExecutionPlanPreview>
    handoff: ReturnType<typeof buildDeliveryHubFulfillmentHandoffSnapshot> | null
    order: Record<string, unknown> | undefined
    fulfillment: Record<string, unknown>
    pg_connection: ReturnType<typeof getDeliveryHubPgConnection> | null
  }) {
    if (
      !input.pg_connection ||
      input.controlled_execution.status !== "dispatch_attempted" ||
      input.controlled_execution.dispatch_result.outcome !== "accepted"
    ) {
      return null
    }

    const executionReference = input.controlled_execution.execution_identity.provider_operation_reference
    if (!executionReference) {
      return null
    }

    const requestSummary = buildDeliveryHubShipmentPersistenceRequestSummary({
      provider_code: input.controlled_execution.provider_code,
      operation: "create_shipment",
      execution_reference: executionReference,
      idempotency_key: input.controlled_execution.execution_identity.idempotency_key_preview,
      mode_code: input.handoff?.quote_type ?? null,
      order_id: input.execution_plan_preview.normalized.order?.id ?? null,
      fulfillment_id:
        typeof input.fulfillment.id === "string" && input.fulfillment.id.trim()
          ? input.fulfillment.id.trim()
          : null,
      cart_id: input.handoff?.references.cart_id ?? null,
      quote_reference_id: input.handoff?.quote_reference.id ?? null,
      quote_reference_version: input.handoff?.quote_reference.version ?? null,
      country_code: null,
    })
    const responseSummary = buildDeliveryHubShipmentPersistenceResponseSummary({
      outcome: input.controlled_execution.provider_dispatch_result?.succeeded ? "accepted" : "failed",
      status: input.controlled_execution.provider_dispatch_result?.succeeded
        ? "dispatch_accepted"
        : "dispatch_failed",
      accepted: input.controlled_execution.provider_dispatch_result?.accepted ?? false,
      succeeded: input.controlled_execution.provider_dispatch_result?.succeeded ?? false,
      status_category: input.controlled_execution.provider_dispatch_result?.status_category ?? null,
      provider_shipment_reference_present:
        input.controlled_execution.provider_dispatch_result?.provider_shipment_reference_present ?? false,
      provider_correlation_reference_present:
        !!input.controlled_execution.provider_dispatch_result?.correlation_id_masked,
      label_document_present: input.controlled_execution.provider_dispatch_result?.label_available ?? false,
      attachment_document_present:
        input.controlled_execution.provider_dispatch_result?.documents_available ?? false,
      safe_message: input.controlled_execution.dispatch_result.safe_message,
    })

    const persistedShipment = await upsertDeliveryShipment(input.pg_connection, {
      execution_reference: executionReference,
      idempotency_key: input.controlled_execution.execution_identity.idempotency_key_preview,
      provider_code: input.controlled_execution.provider_code,
      connection_id: input.handoff?.connection_id ?? null,
      mode_code: input.handoff?.quote_type ?? null,
      order_id: input.execution_plan_preview.normalized.order?.id ?? null,
      fulfillment_id:
        typeof input.fulfillment.id === "string" && input.fulfillment.id.trim()
          ? input.fulfillment.id.trim()
          : null,
      cart_id: input.handoff?.references.cart_id ?? null,
      shipping_option_id: input.handoff?.references.shipping_option_id ?? null,
      location_id: input.handoff?.references.location_id ?? null,
      quote_reference_id: input.handoff?.quote_reference.id ?? null,
      quote_reference_version: input.handoff?.quote_reference.version ?? null,
      correlation_id: input.handoff?.correlation_id ?? null,
      outcome: input.controlled_execution.provider_dispatch_result?.succeeded ? "accepted" : "failed",
      status: input.controlled_execution.provider_dispatch_result?.succeeded
        ? "dispatch_accepted"
        : "dispatch_failed",
      accepted: input.controlled_execution.provider_dispatch_result?.accepted ?? false,
      succeeded: input.controlled_execution.provider_dispatch_result?.succeeded ?? false,
      provider_shipment_reference_present:
        input.controlled_execution.provider_dispatch_result?.provider_shipment_reference_present ?? false,
      provider_correlation_reference_present:
        !!input.controlled_execution.provider_dispatch_result?.correlation_id_masked,
      label_document_present: input.controlled_execution.provider_dispatch_result?.label_available ?? false,
      attachment_document_present:
        input.controlled_execution.provider_dispatch_result?.documents_available ?? false,
      request_summary: requestSummary,
      response_summary: responseSummary,
      metadata: {
        provider_code: input.controlled_execution.provider_code,
        execution_path: input.controlled_execution.execution_path,
        ledger_execution_reference:
          input.controlled_execution.execution_identity.provider_operation_reference,
        ledger_idempotency_key_preview:
          input.controlled_execution.execution_identity.idempotency_key_preview,
        ledger_persistence_performed:
          input.controlled_execution.dispatch_result.execution_ledger_persistence_performed,
        redacted: true,
      },
    })

    input.controlled_execution.dispatch_result.persistence_performed = persistedShipment !== null
    input.controlled_execution.dispatch_result.safe_message = persistedShipment
      ? input.controlled_execution.dispatch_result.execution_ledger_persistence_performed
        ? "Direct Yandex create_shipment was attempted and accepted in runtime, canonical execution-ledger reservation/result transitions were persisted, and shipment persistence was materialized with ledger linkage; no order or fulfillment mutation was performed."
        : "Direct Yandex create_shipment was attempted and accepted in runtime, with a redacted result returned and shipment persistence materialized; no execution-ledger persistence and no order or fulfillment mutation were performed."
      : input.controlled_execution.dispatch_result.safe_message

    if (persistedShipment !== null) {
      this.logger_.info(
        `Delivery Hub shipment persistence materialized: ${JSON.stringify({
          id: persistedShipment.id,
          execution_reference: persistedShipment.execution_reference,
          outcome: persistedShipment.outcome,
          status: persistedShipment.status,
          accepted: persistedShipment.accepted,
          succeeded: persistedShipment.succeeded,
          provider_shipment_reference_present:
            persistedShipment.provider_shipment_reference_present,
          provider_correlation_reference_present:
            persistedShipment.provider_correlation_reference_present,
          label_document_present: persistedShipment.label_document_present,
          attachment_document_present: persistedShipment.attachment_document_present,
        })}`
      )
    }

    return persistedShipment
  }

  protected resolvePgConnection() {
    try {
      return getDeliveryHubPgConnection(this.container_)
    } catch {
      return null
    }
  }

  protected buildControlledExecutionLedgerRuntime(input: {
    execution_plan_preview: ReturnType<typeof buildDeliveryHubShipmentExecutionPlanPreview>
    pg_connection: ReturnType<typeof getDeliveryHubPgConnection> | null
  }): DeliveryHubControlledFulfillmentExecutionLedgerRuntime | null {
    const executionPlan = input.execution_plan_preview.normalized.provider_execution_plan
    if (!input.pg_connection || !executionPlan) {
      return null
    }

    const repository = new DeliveryHubExecutionLedgerPgRepository({
      connection: input.pg_connection,
      now: () => new Date().toISOString(),
    })
    const executionIdentity = input.execution_plan_preview.execution_identity

    if (!executionIdentity?.provider_operation_reference || !executionIdentity.idempotency_key_preview) {
      return null
    }

    const reservationDraft = buildDeliveryHubControlledExecutionReservationDraft({
      execution_plan: executionPlan,
    })
    const executionRecordDraft = buildDeliveryHubControlledExecutionRecordDraft({
      execution_plan: executionPlan,
    })

    return {
      reserveForDispatch: async ({ execution_reference, idempotency_key }) => {
        if (
          execution_reference !== executionIdentity.provider_operation_reference ||
          idempotency_key !== executionIdentity.idempotency_key_preview
        ) {
          return {
            status: "drifted",
            persistence_performed: false,
            existing_state: null,
          }
        }

        const reserveResult = await repository.reserveExecution({
          execution_record: executionRecordDraft,
          reservation_draft: reservationDraft,
          audit_event: buildDeliveryHubControlledExecutionAuditDraft({
            execution_plan: executionPlan,
            current_state: DELIVERY_HUB_EXECUTION_STATE.planned,
            event_type: "deliveryhub.execution.planned",
          }),
        })

        if (reserveResult.status !== "created") {
          const existingState = reserveResult.record.execution.current_state

          if (reserveResult.status === "drifted") {
            return {
              status: "drifted",
              persistence_performed: false,
              existing_state: existingState,
            }
          }

          if (existingState === DELIVERY_HUB_EXECUTION_STATE.completed) {
            return {
              status: "replay_blocked",
              persistence_performed: false,
              existing_state: existingState,
            }
          }

          if (existingState === DELIVERY_HUB_EXECUTION_STATE.failedBlocked) {
            return {
              status: "failed_blocked",
              persistence_performed: false,
              existing_state: existingState,
            }
          }

          if (!canDispatchDeliveryHubControlledExecution(existingState)) {
            return {
              status: "matched",
              persistence_performed: false,
              existing_state: existingState,
            }
          }

          return {
            status: "matched",
            persistence_performed: false,
            existing_state: existingState,
          }
        }

        await repository.recordTransition({
          execution_reference,
          from: DELIVERY_HUB_EXECUTION_STATE.planned,
          to: DELIVERY_HUB_EXECUTION_STATE.reserved,
          audit_event: buildDeliveryHubControlledExecutionAuditDraft({
            execution_plan: executionPlan,
            current_state: DELIVERY_HUB_EXECUTION_STATE.reserved,
            event_type: "deliveryhub.execution.reserved",
          }),
        })
        await repository.recordTransition({
          execution_reference,
          from: DELIVERY_HUB_EXECUTION_STATE.reserved,
          to: DELIVERY_HUB_EXECUTION_STATE.dispatchReady,
          audit_event: buildDeliveryHubControlledExecutionAuditDraft({
            execution_plan: executionPlan,
            current_state: DELIVERY_HUB_EXECUTION_STATE.dispatchReady,
            event_type: "deliveryhub.execution.dispatch_ready",
          }),
        })
        await repository.recordTransition({
          execution_reference,
          from: DELIVERY_HUB_EXECUTION_STATE.dispatchReady,
          to: DELIVERY_HUB_EXECUTION_STATE.dispatchInflight,
        })

        return {
          status: "created",
          persistence_performed: true,
          existing_state: DELIVERY_HUB_EXECUTION_STATE.dispatchInflight,
        }
      },
      markDispatchResultReceived: async ({ execution_reference, outcome }) => {
        const existingRecord = await repository.getExecutionByReference(execution_reference)

        if (!existingRecord) {
          return {
            persistence_performed: false,
          }
        }

        if (existingRecord.execution.current_state !== DELIVERY_HUB_EXECUTION_STATE.dispatchInflight) {
          if (outcome === "failed" && canFailBlockedDeliveryHubControlledExecution(existingRecord.execution.current_state)) {
            const failedBlocked = await repository.recordTransition({
              execution_reference,
              from: existingRecord.execution.current_state,
              to: DELIVERY_HUB_EXECUTION_STATE.failedBlocked,
            })

            return {
              persistence_performed: failedBlocked.status === "recorded",
            }
          }

          return {
            persistence_performed: false,
          }
        }

        const resultReceived = await repository.recordTransition({
          execution_reference,
          from: DELIVERY_HUB_EXECUTION_STATE.dispatchInflight,
          to: DELIVERY_HUB_EXECUTION_STATE.resultReceived,
        })

        if (resultReceived.status !== "recorded") {
          return {
            persistence_performed: false,
          }
        }

        if (outcome === "failed") {
          const failedBlocked = await repository.recordTransition({
            execution_reference,
            from: DELIVERY_HUB_EXECUTION_STATE.resultReceived,
            to: DELIVERY_HUB_EXECUTION_STATE.failedBlocked,
          })

          return {
            persistence_performed: failedBlocked.status === "recorded" || resultReceived.status === "recorded",
          }
        }

        const applicationReady = await repository.recordTransition({
          execution_reference,
          from: DELIVERY_HUB_EXECUTION_STATE.resultReceived,
          to: DELIVERY_HUB_EXECUTION_STATE.applicationReady,
        })

        if (applicationReady.status !== "recorded") {
          return {
            persistence_performed: true,
          }
        }

        const terminal = await repository.recordTransition({
          execution_reference,
          from: DELIVERY_HUB_EXECUTION_STATE.applicationReady,
          to: DELIVERY_HUB_EXECUTION_STATE.completed,
        })

        return {
          persistence_performed:
            terminal.status === "recorded" || applicationReady.status === "recorded",
        }
      },
    }
  }

  protected async resolvePersistedExecutionReference(input: {
    cart_id: string | null
    connection_id: string | null
    quote_type: string | null
    quote_reference: { id: string; version: number } | null
  }) {
    if (
      !input.cart_id ||
      !input.connection_id ||
      !input.quote_type ||
      !input.quote_reference
    ) {
      return null
    }

    try {
      const query = getDeliveryHubQuery(this.container_)
      const cart = await getDeliveryHubCartById(query, input.cart_id)

      if (!cart) {
        return null
      }

      const selection = readDeliveryHubCartSelection(cart.metadata)
      const reference = readDeliveryHubCartSelectionBackendExecutionReference(cart.metadata)

      if (!selection || !reference) {
        return null
      }

      if (
        selection.connection_id !== input.connection_id ||
        selection.quote_type !== input.quote_type
      ) {
        return null
      }

      return validateDeliveryHubProviderExecutionReference(reference, {
        connection_id: input.connection_id,
        quote_type: input.quote_type as any,
        quote_reference: selection.quote_reference,
      })
    } catch {
      return null
    }
  }
}

export default ModuleProvider(Modules.FULFILLMENT, {
  services: [DeliveryHubFulfillmentProvider],
})

function formatDeliveryHubFulfillmentOptionName(modeCode: string) {
  switch (modeCode) {
    case "warehouse_to_pickup_point":
      return "Delivery Hub warehouse to pickup point"
    case "dropoff_point_to_pickup_point":
      return "Delivery Hub dropoff point to pickup point"
    default:
      return `Delivery Hub ${modeCode}`
  }
}

function isDeliveryHubShipmentExecutionEnabled() {
  return process.env.DELIVERY_HUB_SHIPMENT_EXECUTION_ENABLED?.trim().toLowerCase() === "true"
}
