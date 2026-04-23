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
  buildDeliveryHubFulfillmentContractVerdict,
  buildDeliveryHubFulfillmentBridgePayload,
  buildDeliveryHubShipmentExecutionPlanPreview,
} from "./delivery-hub/fulfillment-provider-bridge"
import {
  DELIVERY_HUB_FULFILLMENT_OPTION_DEFINITIONS,
  DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
  normalizeDeliveryHubFulfillmentOptionData,
} from "./delivery-hub/provider-surface"

type InjectedDependencies = {
  logger: Logger
}

export class DeliveryHubFulfillmentProvider extends AbstractFulfillmentProviderService {
  static identifier = DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE

  protected readonly logger_: Logger

  constructor({ logger }: InjectedDependencies) {
    super()

    this.logger_ = logger
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
    const executionPlanPreview = buildDeliveryHubShipmentExecutionPlanPreview({
      fulfillment_data: data,
      items: items.map((item) => item as Record<string, unknown>),
      order: order as Record<string, unknown> | undefined,
      fulfillment: fulfillment as Record<string, unknown>,
    })

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
        outbound_preview_redacted: executionPlanPreview.outbound_payload_preview.redacted,
      })}`
    )

    if (executionPlanPreview.contract_status !== "ready") {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Delivery Hub createFulfillment input is blocked: ${executionPlanPreview.blocked_reasons.join("; ")}`
      )
    }

    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Delivery Hub shipment automation is not materialized in the current provider scaffold; order-side diagnostics validate backend bridge input only."
    )
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
