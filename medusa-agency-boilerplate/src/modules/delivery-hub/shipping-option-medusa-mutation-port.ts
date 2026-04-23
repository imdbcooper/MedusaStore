import type { FulfillmentWorkflow } from "@medusajs/framework/types"
import type {
  DeliveryHubShippingOptionMutationPort,
  DeliveryHubShippingOptionSyncExecutionReport,
  DeliveryHubShippingOptionSyncExecutorErrorMode,
} from "./shipping-option-sync-executor"
import type {
  DeliveryHubShippingOptionArchiveOperation,
  DeliveryHubShippingOptionCreateOperation,
  DeliveryHubShippingOptionSyncOperationPlan,
  DeliveryHubShippingOptionUpdateOperation,
} from "./shipping-option-sync-operation-plan"

export type DeliveryHubCreateShippingOptionMedusaInput = Pick<
  FulfillmentWorkflow.CreateShippingOptionsWorkflowInput,
  "name" | "price_type" | "provider_id" | "service_zone_id" | "shipping_profile_id" | "type"
> & {
  data: Record<string, unknown>
  rules: FulfillmentWorkflow.CreateShippingOptionsWorkflowInput["rules"]
}

export type DeliveryHubUpdateShippingOptionMedusaInput = Pick<
  FulfillmentWorkflow.UpdateShippingOptionsWorkflowInput,
  "id" | "name" | "price_type" | "provider_id" | "type"
> & {
  data: Record<string, unknown>
  rules: FulfillmentWorkflow.UpdateShippingOptionsWorkflowInput["rules"]
}

export type DeliveryHubDeleteShippingOptionMedusaInput = {
  ids: string[]
}

export interface DeliveryHubShippingOptionMedusaMutationService<
  TCreateResult = unknown,
  TUpdateResult = unknown,
  TArchiveResult = unknown,
> {
  createShippingOptions(
    input: DeliveryHubCreateShippingOptionMedusaInput[]
  ): Promise<TCreateResult> | TCreateResult
  updateShippingOptions(
    input: DeliveryHubUpdateShippingOptionMedusaInput[]
  ): Promise<TUpdateResult> | TUpdateResult
  deleteShippingOptions(
    input: DeliveryHubDeleteShippingOptionMedusaInput
  ): Promise<TArchiveResult> | TArchiveResult
}

export type DeliveryHubShippingOptionMedusaWorkflowRunners<
  TCreateResult = unknown,
  TUpdateResult = unknown,
  TArchiveResult = unknown,
> = {
  createShippingOptions(
    input: DeliveryHubCreateShippingOptionMedusaInput[]
  ): Promise<TCreateResult> | TCreateResult
  updateShippingOptions(
    input: DeliveryHubUpdateShippingOptionMedusaInput[]
  ): Promise<TUpdateResult> | TUpdateResult
  deleteShippingOptions(
    input: DeliveryHubDeleteShippingOptionMedusaInput
  ): Promise<TArchiveResult> | TArchiveResult
}

export function createDeliveryHubShippingOptionMedusaMutationServiceFromRunners<
  TCreateResult = unknown,
  TUpdateResult = unknown,
  TArchiveResult = unknown,
>(
  runners: DeliveryHubShippingOptionMedusaWorkflowRunners<
    TCreateResult,
    TUpdateResult,
    TArchiveResult
  >
): DeliveryHubShippingOptionMedusaMutationService<
  TCreateResult,
  TUpdateResult,
  TArchiveResult
> {
  return {
    createShippingOptions(input) {
      return runners.createShippingOptions(input)
    },
    updateShippingOptions(input) {
      return runners.updateShippingOptions(input)
    },
    deleteShippingOptions(input) {
      return runners.deleteShippingOptions(input)
    },
  }
}

export type DeliveryHubShippingOptionMedusaCreateContext = {
  name: string
  service_zone_id: string
  shipping_profile_id: string
  rules?: FulfillmentWorkflow.CreateShippingOptionsWorkflowInput["rules"]
  type?: FulfillmentWorkflow.CreateShippingOptionsWorkflowInput["type"]
}

export type DeliveryHubShippingOptionMedusaUpdateContext = {
  name?: string
  rules?: FulfillmentWorkflow.UpdateShippingOptionsWorkflowInput["rules"]
  type?: FulfillmentWorkflow.UpdateShippingOptionsWorkflowInput["type"]
}

export type DeliveryHubShippingOptionMedusaArchiveContext = {
  hard_delete?: boolean
}

export type DeliveryHubShippingOptionMedusaMutationPortContext = {
  create: Record<string, DeliveryHubShippingOptionMedusaCreateContext>
  update?: Record<string, DeliveryHubShippingOptionMedusaUpdateContext>
  archive?: Record<string, DeliveryHubShippingOptionMedusaArchiveContext>
}

export function createDeliveryHubShippingOptionMedusaMutationPort<
  TCreateResult = unknown,
  TUpdateResult = unknown,
  TArchiveResult = unknown,
>(input: {
  service: DeliveryHubShippingOptionMedusaMutationService<
    TCreateResult,
    TUpdateResult,
    TArchiveResult
  >
  context: DeliveryHubShippingOptionMedusaMutationPortContext
}): DeliveryHubShippingOptionMutationPort<TCreateResult, TUpdateResult, TArchiveResult> {
  return {
    createShippingOption(operation) {
      return input.service.createShippingOptions([mapCreateOperationToMedusaInput(operation, input.context)])
    },
    updateShippingOption(operation) {
      return input.service.updateShippingOptions([mapUpdateOperationToMedusaInput(operation, input.context)])
    },
    archiveShippingOption(operation) {
      return input.service.deleteShippingOptions(
        mapArchiveOperationToMedusaInput(operation, input.context)
      )
    },
  }
}

export function mapCreateOperationToMedusaInput(
  operation: DeliveryHubShippingOptionCreateOperation,
  context: DeliveryHubShippingOptionMedusaMutationPortContext
): DeliveryHubCreateShippingOptionMedusaInput {
  const modeContext = requireCreateContext(operation, context)

  return {
    name: modeContext.name,
    price_type: "calculated",
    provider_id: operation.provider_id,
    service_zone_id: modeContext.service_zone_id,
    shipping_profile_id: modeContext.shipping_profile_id,
    type: modeContext.type ?? buildDeliveryHubShippingOptionType(operation),
    data: {
      ...operation.target_data,
    },
    rules: cloneRules(modeContext.rules),
  }
}

export function mapUpdateOperationToMedusaInput(
  operation: DeliveryHubShippingOptionUpdateOperation,
  context: DeliveryHubShippingOptionMedusaMutationPortContext
): DeliveryHubUpdateShippingOptionMedusaInput {
  const updateContext = context.update?.[operation.mode_code]

  return {
    id: operation.current.id,
    name: updateContext?.name ?? operation.current.name?.trim() ?? buildDeliveryHubShippingOptionName(operation),
    price_type: "calculated",
    provider_id: operation.provider_id,
    type: updateContext?.type ?? buildDeliveryHubShippingOptionType(operation),
    data: {
      ...operation.target_data,
    },
    rules: cloneRules(updateContext?.rules),
  }
}

export function mapArchiveOperationToMedusaInput(
  operation: DeliveryHubShippingOptionArchiveOperation,
  _context: DeliveryHubShippingOptionMedusaMutationPortContext
): DeliveryHubDeleteShippingOptionMedusaInput {
  return {
    ids: [operation.current.id],
  }
}

export function buildDeliveryHubShippingOptionManualSyncOrchestrator<
  TCreateResult = unknown,
  TUpdateResult = unknown,
  TArchiveResult = unknown,
>(input: {
  execute: (params: {
    plan: DeliveryHubShippingOptionSyncOperationPlan
    mutation_port: DeliveryHubShippingOptionMutationPort<
      TCreateResult,
      TUpdateResult,
      TArchiveResult
    >
    on_error?: DeliveryHubShippingOptionSyncExecutorErrorMode
  }) => Promise<
    DeliveryHubShippingOptionSyncExecutionReport<
      TCreateResult,
      TUpdateResult,
      TArchiveResult
    >
  >
  mutation_port: DeliveryHubShippingOptionMutationPort<TCreateResult, TUpdateResult, TArchiveResult>
}) {
  return async function orchestrateManualDeliveryHubShippingOptionSync(inputParams: {
    plan: DeliveryHubShippingOptionSyncOperationPlan
    on_error?: DeliveryHubShippingOptionSyncExecutorErrorMode
  }) {
    return input.execute({
      plan: inputParams.plan,
      mutation_port: input.mutation_port,
      on_error: inputParams.on_error,
    })
  }
}

function requireCreateContext(
  operation: DeliveryHubShippingOptionCreateOperation,
  context: DeliveryHubShippingOptionMedusaMutationPortContext
) {
  const modeContext = context.create[operation.mode_code]

  if (modeContext) {
    return modeContext
  }

  throw new Error(
    `Missing Medusa create context for deliveryhub shipping option mode "${operation.mode_code}".`
  )
}

function buildDeliveryHubShippingOptionName(
  operation:
    | DeliveryHubShippingOptionCreateOperation
    | DeliveryHubShippingOptionUpdateOperation
) {
  return operation.mode_code === "warehouse_to_pickup_point"
    ? "Delivery Hub — Со склада в пункт выдачи"
    : "Delivery Hub — Из дроп-офф пункта в пункт выдачи"
}

function buildDeliveryHubShippingOptionType(
  operation:
    | DeliveryHubShippingOptionCreateOperation
    | DeliveryHubShippingOptionUpdateOperation
): NonNullable<FulfillmentWorkflow.CreateShippingOptionsWorkflowInput["type"]> {
  return operation.mode_code === "warehouse_to_pickup_point"
    ? {
        label: "Пункт выдачи",
        description: "Delivery Hub warehouse to pickup-point shipping option.",
        code: "deliveryhub-warehouse-to-pickup-point",
      }
    : {
        label: "Пункт выдачи",
        description: "Delivery Hub dropoff to pickup-point shipping option.",
        code: "deliveryhub-dropoff-to-pickup-point",
      }
}

function cloneRules<T>(rules: T): T {
  if (!Array.isArray(rules)) {
    return ([] as unknown) as T
  }

  return rules.map((rule) => ({ ...(rule as Record<string, unknown>) })) as T
}
