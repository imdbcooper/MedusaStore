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
import { buildDeliveryHubControlledFulfillmentExecutionResult } from "./delivery-hub/fulfillment-execution-seam"
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

    const controlledExecution = buildDeliveryHubControlledFulfillmentExecutionResult({
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
          quote_reference_summary: controlledExecution.handoff.quote_reference_summary,
          references: controlledExecution.handoff.references,
          correlation_id: controlledExecution.handoff.correlation_id,
        },
        connection: controlledExecution.connection,
        dispatch_preparation: controlledExecution.dispatch_preparation,
        provider_payload_materialization: controlledExecution.provider_payload_materialization,
        execution_identity: controlledExecution.execution_identity,
        evidence: controlledExecution.evidence,
        contour: controlledExecution.contour,
        anti_leak_confirmations: controlledExecution.anti_leak_confirmations,
      })}`
    )

    return {
      data: {
        provider_code: DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
        controlled_execution: controlledExecution,
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
  protected resolvePgConnection() {
    try {
      return getDeliveryHubPgConnection(this.container_)
    } catch {
      return null
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
