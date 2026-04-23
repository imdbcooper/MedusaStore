import type {
  DeliveryHubShippingOptionArchiveOperation,
  DeliveryHubShippingOptionCreateOperation,
  DeliveryHubShippingOptionSyncOperationPlan,
  DeliveryHubShippingOptionUpdateOperation,
} from "./shipping-option-sync-operation-plan"

export type DeliveryHubShippingOptionSyncExecutorErrorMode = "abort" | "continue"

export interface DeliveryHubShippingOptionMutationPort<
  TCreateResult = void,
  TUpdateResult = void,
  TArchiveResult = void,
> {
  createShippingOption(
    operation: DeliveryHubShippingOptionCreateOperation
  ): Promise<TCreateResult> | TCreateResult
  updateShippingOption(
    operation: DeliveryHubShippingOptionUpdateOperation
  ): Promise<TUpdateResult> | TUpdateResult
  archiveShippingOption(
    operation: DeliveryHubShippingOptionArchiveOperation
  ): Promise<TArchiveResult> | TArchiveResult
}

export type DeliveryHubShippingOptionCreateExecutionResult<TCreateResult = void> =
  | {
      type: "create"
      status: "succeeded"
      operation: DeliveryHubShippingOptionCreateOperation
      output: TCreateResult
    }
  | {
      type: "create"
      status: "failed"
      operation: DeliveryHubShippingOptionCreateOperation
      error: unknown
    }

export type DeliveryHubShippingOptionUpdateExecutionResult<TUpdateResult = void> =
  | {
      type: "update"
      status: "succeeded"
      operation: DeliveryHubShippingOptionUpdateOperation
      output: TUpdateResult
    }
  | {
      type: "update"
      status: "failed"
      operation: DeliveryHubShippingOptionUpdateOperation
      error: unknown
    }

export type DeliveryHubShippingOptionArchiveExecutionResult<TArchiveResult = void> =
  | {
      type: "archive"
      status: "succeeded"
      operation: DeliveryHubShippingOptionArchiveOperation
      output: TArchiveResult
    }
  | {
      type: "archive"
      status: "failed"
      operation: DeliveryHubShippingOptionArchiveOperation
      error: unknown
    }

export type DeliveryHubShippingOptionMutationExecutionResult<
  TCreateResult = void,
  TUpdateResult = void,
  TArchiveResult = void,
> =
  | DeliveryHubShippingOptionCreateExecutionResult<TCreateResult>
  | DeliveryHubShippingOptionUpdateExecutionResult<TUpdateResult>
  | DeliveryHubShippingOptionArchiveExecutionResult<TArchiveResult>

export type DeliveryHubShippingOptionSyncExecutionOutcome =
  | "succeeded"
  | "failed"
  | "partial_failure"

export type DeliveryHubShippingOptionSyncExecutionSummary = {
  create_operation_count: number
  update_operation_count: number
  archive_operation_count: number
  mutation_operation_count: number
  noop_count: number
  ignored_foreign_option_count: number
  attempted_operation_count: number
  succeeded_operation_count: number
  failed_operation_count: number
  not_executed_operation_count: number
}

export type DeliveryHubShippingOptionSyncExecutionReport<
  TCreateResult = void,
  TUpdateResult = void,
  TArchiveResult = void,
> = {
  provider_code: DeliveryHubShippingOptionSyncOperationPlan["provider_code"]
  provider_id: DeliveryHubShippingOptionSyncOperationPlan["provider_id"]
  outcome: DeliveryHubShippingOptionSyncExecutionOutcome
  aborted: boolean
  error_mode: DeliveryHubShippingOptionSyncExecutorErrorMode
  summary: DeliveryHubShippingOptionSyncExecutionSummary
  create_results: DeliveryHubShippingOptionCreateExecutionResult<TCreateResult>[]
  update_results: DeliveryHubShippingOptionUpdateExecutionResult<TUpdateResult>[]
  archive_results: DeliveryHubShippingOptionArchiveExecutionResult<TArchiveResult>[]
  executed_operations: DeliveryHubShippingOptionMutationExecutionResult<
    TCreateResult,
    TUpdateResult,
    TArchiveResult
  >[]
}

export async function executeDeliveryHubShippingOptionSyncOperationPlan<
  TCreateResult = void,
  TUpdateResult = void,
  TArchiveResult = void,
>(input: {
  plan: DeliveryHubShippingOptionSyncOperationPlan
  mutation_port: DeliveryHubShippingOptionMutationPort<
    TCreateResult,
    TUpdateResult,
    TArchiveResult
  >
  on_error?: DeliveryHubShippingOptionSyncExecutorErrorMode
}): Promise<
  DeliveryHubShippingOptionSyncExecutionReport<TCreateResult, TUpdateResult, TArchiveResult>
> {
  const errorMode = input.on_error ?? "abort"
  const create_results: DeliveryHubShippingOptionCreateExecutionResult<TCreateResult>[] = []
  const update_results: DeliveryHubShippingOptionUpdateExecutionResult<TUpdateResult>[] = []
  const archive_results: DeliveryHubShippingOptionArchiveExecutionResult<TArchiveResult>[] = []
  const executed_operations: DeliveryHubShippingOptionMutationExecutionResult<
    TCreateResult,
    TUpdateResult,
    TArchiveResult
  >[] = []
  let aborted = false

  for (const operation of input.plan.create_operations) {
    const result = await executeCreateOperation(input.mutation_port, operation)
    create_results.push(result)
    executed_operations.push(result)

    if (result.status === "failed" && errorMode === "abort") {
      aborted = true
      break
    }
  }

  if (!aborted) {
    for (const operation of input.plan.update_operations) {
      const result = await executeUpdateOperation(input.mutation_port, operation)
      update_results.push(result)
      executed_operations.push(result)

      if (result.status === "failed" && errorMode === "abort") {
        aborted = true
        break
      }
    }
  }

  if (!aborted) {
    for (const operation of input.plan.archive_operations) {
      const result = await executeArchiveOperation(input.mutation_port, operation)
      archive_results.push(result)
      executed_operations.push(result)

      if (result.status === "failed" && errorMode === "abort") {
        aborted = true
        break
      }
    }
  }

  const attemptedOperationCount = executed_operations.length
  const failedOperationCount = executed_operations.filter(
    (result) => result.status === "failed"
  ).length
  const succeededOperationCount = attemptedOperationCount - failedOperationCount
  const notExecutedOperationCount =
    input.plan.summary.mutation_operation_count - attemptedOperationCount

  return {
    provider_code: input.plan.provider_code,
    provider_id: input.plan.provider_id,
    outcome: resolveExecutionOutcome({
      attempted_operation_count: attemptedOperationCount,
      succeeded_operation_count: succeededOperationCount,
      failed_operation_count: failedOperationCount,
    }),
    aborted,
    error_mode: errorMode,
    summary: {
      create_operation_count: input.plan.summary.create_operation_count,
      update_operation_count: input.plan.summary.update_operation_count,
      archive_operation_count: input.plan.summary.archive_operation_count,
      mutation_operation_count: input.plan.summary.mutation_operation_count,
      noop_count: input.plan.summary.noop_count,
      ignored_foreign_option_count: input.plan.summary.ignored_foreign_option_count,
      attempted_operation_count: attemptedOperationCount,
      succeeded_operation_count: succeededOperationCount,
      failed_operation_count: failedOperationCount,
      not_executed_operation_count: notExecutedOperationCount,
    },
    create_results,
    update_results,
    archive_results,
    executed_operations,
  }
}

async function executeCreateOperation<TCreateResult>(
  mutationPort: DeliveryHubShippingOptionMutationPort<TCreateResult, unknown, unknown>,
  operation: DeliveryHubShippingOptionCreateOperation
): Promise<DeliveryHubShippingOptionCreateExecutionResult<TCreateResult>> {
  try {
    const output = await mutationPort.createShippingOption(operation)

    return {
      type: "create",
      status: "succeeded",
      operation,
      output,
    }
  } catch (error) {
    return {
      type: "create",
      status: "failed",
      operation,
      error,
    }
  }
}

async function executeUpdateOperation<TUpdateResult>(
  mutationPort: DeliveryHubShippingOptionMutationPort<unknown, TUpdateResult, unknown>,
  operation: DeliveryHubShippingOptionUpdateOperation
): Promise<DeliveryHubShippingOptionUpdateExecutionResult<TUpdateResult>> {
  try {
    const output = await mutationPort.updateShippingOption(operation)

    return {
      type: "update",
      status: "succeeded",
      operation,
      output,
    }
  } catch (error) {
    return {
      type: "update",
      status: "failed",
      operation,
      error,
    }
  }
}

async function executeArchiveOperation<TArchiveResult>(
  mutationPort: DeliveryHubShippingOptionMutationPort<unknown, unknown, TArchiveResult>,
  operation: DeliveryHubShippingOptionArchiveOperation
): Promise<DeliveryHubShippingOptionArchiveExecutionResult<TArchiveResult>> {
  try {
    const output = await mutationPort.archiveShippingOption(operation)

    return {
      type: "archive",
      status: "succeeded",
      operation,
      output,
    }
  } catch (error) {
    return {
      type: "archive",
      status: "failed",
      operation,
      error,
    }
  }
}

function resolveExecutionOutcome(input: {
  attempted_operation_count: number
  succeeded_operation_count: number
  failed_operation_count: number
}): DeliveryHubShippingOptionSyncExecutionOutcome {
  if (input.failed_operation_count === 0) {
    return "succeeded"
  }

  if (input.succeeded_operation_count === 0 && input.attempted_operation_count > 0) {
    return "failed"
  }

  return "partial_failure"
}
