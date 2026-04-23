import { z } from "@medusajs/framework/zod"
import {
  createShippingOptionsWorkflow,
  deleteShippingOptionsWorkflow,
  updateShippingOptionsWorkflow,
} from "@medusajs/medusa/core-flows"
import type { DeliveryHubService } from "./service"
import { DeliveryHubError } from "./errors"
import type { DeliveryHubShippingOptionManualSyncAuditLogger } from "./shipping-option-manual-sync-audit"
import {
  buildDeliveryHubShippingOptionManualSyncOrchestrator,
  createDeliveryHubShippingOptionMedusaMutationPort,
  createDeliveryHubShippingOptionMedusaMutationServiceFromRunners,
  type DeliveryHubShippingOptionMedusaMutationPortContext,
  type DeliveryHubShippingOptionMedusaMutationService,
} from "./shipping-option-medusa-mutation-port"
import type {
  DeliveryHubShippingOptionSyncExecutionReport,
  DeliveryHubShippingOptionSyncExecutorErrorMode,
} from "./shipping-option-sync-executor"
import { executeDeliveryHubShippingOptionSyncOperationPlan } from "./shipping-option-sync-executor"
import { buildDeliveryHubShippingOptionSyncOperationPlan } from "./shipping-option-sync-operation-plan"
import type { DeliveryHubShippingOptionSnapshot } from "./shipping-option-reconciliation"

export const DELIVERY_HUB_MANUAL_SYNC_EXECUTE_GUARD =
  "deliveryhub:execute_shipping_option_sync"

const AdminDeliveryShippingOptionRuleSchema = z.object({
  attribute: z.string().trim().min(1),
  operator: z.string().trim().min(1),
  value: z.union([z.string(), z.array(z.string())]),
})

const AdminDeliveryShippingOptionTypeSchema = z.object({
  label: z.string().trim().min(1),
  description: z.string().trim().min(1).optional(),
  code: z.string().trim().min(1).optional(),
})

const AdminDeliveryShippingOptionCreateContextSchema = z.object({
  name: z.string().trim().min(1),
  service_zone_id: z.string().trim().min(1),
  shipping_profile_id: z.string().trim().min(1),
  rules: z.array(AdminDeliveryShippingOptionRuleSchema).optional(),
  type: AdminDeliveryShippingOptionTypeSchema.optional(),
})

const AdminDeliveryShippingOptionUpdateContextSchema = z.object({
  name: z.string().trim().min(1).optional(),
  rules: z.array(AdminDeliveryShippingOptionRuleSchema).optional(),
  type: AdminDeliveryShippingOptionTypeSchema.optional(),
})

const AdminDeliveryShippingOptionArchiveContextSchema = z.object({
  hard_delete: z.boolean().optional(),
})

export const AdminDeliveryShippingOptionManualSyncSchema = z.object({
  mode: z.enum(["dry_run", "execute"]).optional().default("dry_run"),
  confirm_execute: z.string().trim().optional(),
  on_error: z.enum(["abort", "continue"]).optional().default("abort"),
  mutation_context: z
    .object({
      create: z.record(AdminDeliveryShippingOptionCreateContextSchema).optional(),
      update: z.record(AdminDeliveryShippingOptionUpdateContextSchema).optional(),
      archive: z.record(AdminDeliveryShippingOptionArchiveContextSchema).optional(),
    })
    .optional(),
})

export type AdminDeliveryShippingOptionManualSyncBody = {
  mode?: "dry_run" | "execute"
  confirm_execute?: string
  on_error?: DeliveryHubShippingOptionSyncExecutorErrorMode
  mutation_context?: DeliveryHubShippingOptionMedusaMutationPortContext
}

export type DeliveryHubShippingOptionManualSyncExecutionMode = {
  requested_mode: "dry_run" | "execute"
  effective_mode: "dry_run" | "execute"
  execute_requested: boolean
  execute_confirmed: boolean
  execute_guard: typeof DELIVERY_HUB_MANUAL_SYNC_EXECUTE_GUARD
  is_dry_run: boolean
}

export type DeliveryHubShippingOptionManualSyncDesiredPlanSummary = {
  desired_option_count: number
  deferred_option_count: number
  deferred_issue_count: number
  connection_plan_count: number
}

export type DeliveryHubShippingOptionManualSyncReconciliationSummary = {
  create_candidate_count: number
  update_candidate_count: number
  unchanged_count: number
  orphaned_managed_option_count: number
  ignored_foreign_option_count: number
}

type DeliveryHubShippingOptionPreview = Awaited<
  ReturnType<DeliveryHubService["buildShippingOptionPreview"]>
>

export type DeliveryHubShippingOptionManualSyncResponse<
  TCreateResult = unknown,
  TUpdateResult = unknown,
  TArchiveResult = unknown,
> = {
  provider_code: string
  provider_id: string
  current_options: DeliveryHubShippingOptionSnapshot[]
  desired_plan: DeliveryHubShippingOptionPreview["plan"]
  desired_plan_summary: DeliveryHubShippingOptionManualSyncDesiredPlanSummary
  reconciliation: DeliveryHubShippingOptionPreview["reconciliation"]
  reconciliation_summary: DeliveryHubShippingOptionManualSyncReconciliationSummary
  operation_plan: ReturnType<typeof buildDeliveryHubShippingOptionSyncOperationPlan>
  execution: {
    mode: DeliveryHubShippingOptionManualSyncExecutionMode
    report: DeliveryHubShippingOptionSyncExecutionReport<
      TCreateResult,
      TUpdateResult,
      TArchiveResult
    > | null
  }
}

export type DeliveryHubShippingOptionManualSyncService = Pick<
  DeliveryHubService,
  "buildShippingOptionPreview"
>

export async function runDeliveryHubShippingOptionManualSync<
  TCreateResult = unknown,
  TUpdateResult = unknown,
  TArchiveResult = unknown,
>(input: {
  service: DeliveryHubShippingOptionManualSyncService
  current_options: DeliveryHubShippingOptionSnapshot[]
  request: AdminDeliveryShippingOptionManualSyncBody
  mutation_service?: DeliveryHubShippingOptionMedusaMutationService<
    TCreateResult,
    TUpdateResult,
    TArchiveResult
  >
  execute?: typeof executeDeliveryHubShippingOptionSyncOperationPlan<
    TCreateResult,
    TUpdateResult,
    TArchiveResult
  >
  audit_log?: DeliveryHubShippingOptionManualSyncAuditLogger<
    TCreateResult,
    TUpdateResult,
    TArchiveResult
  >
}): Promise<
  DeliveryHubShippingOptionManualSyncResponse<TCreateResult, TUpdateResult, TArchiveResult>
> {
  const preview = await input.service.buildShippingOptionPreview(input.current_options)
  const operationPlan = buildDeliveryHubShippingOptionSyncOperationPlan(preview.reconciliation)
  const executionMode = resolveManualSyncExecutionMode(input.request)
  const desiredPlanSummary = {
    desired_option_count: preview.summary.desired_option_count,
    deferred_option_count: preview.summary.deferred_option_count,
    deferred_issue_count: preview.summary.deferred_issue_count,
    connection_plan_count: preview.summary.connection_plan_count,
  }
  const reconciliationSummary = {
    create_candidate_count: preview.summary.create_candidate_count,
    update_candidate_count: preview.summary.update_candidate_count,
    unchanged_count: preview.summary.unchanged_count,
    orphaned_managed_option_count: preview.summary.orphaned_managed_option_count,
    ignored_foreign_option_count: preview.summary.ignored_foreign_option_count,
  }

  try {
    if (executionMode.execute_requested && !executionMode.execute_confirmed) {
      throw new DeliveryHubError({
        code: "DELIVERY_HUB_VALIDATION_ERROR",
        message: "Manual shipping-option sync execute mode requires explicit confirmation.",
        status: 400,
        details: {
          mode: input.request.mode,
          confirm_execute: input.request.confirm_execute ?? null,
          expected_confirm_execute: DELIVERY_HUB_MANUAL_SYNC_EXECUTE_GUARD,
        },
      })
    }

    let report: DeliveryHubShippingOptionSyncExecutionReport<
      TCreateResult,
      TUpdateResult,
      TArchiveResult
    > | null = null

    if (executionMode.effective_mode === "execute") {
      if (!input.mutation_service) {
        throw new DeliveryHubError({
          code: "DELIVERY_HUB_VALIDATION_ERROR",
          message: "Manual shipping-option sync execute mode requires injected mutation service.",
          status: 400,
          details: {
            mode: input.request.mode,
            mutation_service_present: false,
          },
        })
      }

      const mutationContext = requireManualSyncMutationContext(input.request)
      const mutationPort = createDeliveryHubShippingOptionMedusaMutationPort({
        service: input.mutation_service,
        context: mutationContext,
      })
      const orchestrate = buildDeliveryHubShippingOptionManualSyncOrchestrator({
        execute: input.execute ?? executeDeliveryHubShippingOptionSyncOperationPlan,
        mutation_port: mutationPort,
      })

      report = await orchestrate({
        plan: operationPlan,
        on_error: input.request.on_error,
      })
    }

    const result = {
      provider_code: preview.provider_code,
      provider_id: preview.provider_id,
      current_options: preview.current_options,
      desired_plan: preview.plan,
      desired_plan_summary: desiredPlanSummary,
      reconciliation: preview.reconciliation,
      reconciliation_summary: reconciliationSummary,
      operation_plan: operationPlan,
      execution: {
        mode: executionMode,
        report,
      },
    }

    await input.audit_log?.({
      request: input.request,
      current_option_count: input.current_options.length,
      execution_mode: executionMode,
      desired_plan_summary: desiredPlanSummary,
      reconciliation_summary: reconciliationSummary,
      operation_plan: operationPlan,
      execution_report: report,
    })

    return result
  } catch (error) {
    await input.audit_log?.({
      request: input.request,
      current_option_count: input.current_options.length,
      execution_mode: executionMode,
      desired_plan_summary: desiredPlanSummary,
      reconciliation_summary: reconciliationSummary,
      operation_plan: operationPlan,
      error,
    })

    throw error
  }
}

export const deliveryHubShippingOptionManualSyncWorkflowDeps = {
  createShippingOptionsWorkflow,
  updateShippingOptionsWorkflow,
  deleteShippingOptionsWorkflow,
}

export function createDeliveryHubShippingOptionManualSyncMedusaMutationService(scope: any) {
  return createDeliveryHubShippingOptionMedusaMutationServiceFromRunners({
    async createShippingOptions(input) {
      const { result } = await deliveryHubShippingOptionManualSyncWorkflowDeps
        .createShippingOptionsWorkflow(scope)
        .run({
          input: input as any,
        })

      return result
    },
    async updateShippingOptions(input) {
      const { result } = await deliveryHubShippingOptionManualSyncWorkflowDeps
        .updateShippingOptionsWorkflow(scope)
        .run({
          input: input as any,
        })

      return result
    },
    async deleteShippingOptions(input) {
      const { result } = await deliveryHubShippingOptionManualSyncWorkflowDeps
        .deleteShippingOptionsWorkflow(scope)
        .run({
          input,
        })

      return result
    },
  })
}

function resolveManualSyncExecutionMode(
  request: AdminDeliveryShippingOptionManualSyncBody
): DeliveryHubShippingOptionManualSyncExecutionMode {
  const requestedMode = request.mode ?? "dry_run"
  const executeRequested = requestedMode === "execute"
  const executeConfirmed = request.confirm_execute === DELIVERY_HUB_MANUAL_SYNC_EXECUTE_GUARD

  return {
    requested_mode: requestedMode,
    effective_mode: executeRequested && executeConfirmed ? "execute" : "dry_run",
    execute_requested: executeRequested,
    execute_confirmed: executeConfirmed,
    execute_guard: DELIVERY_HUB_MANUAL_SYNC_EXECUTE_GUARD,
    is_dry_run: !(executeRequested && executeConfirmed),
  }
}

function requireManualSyncMutationContext(
  request: AdminDeliveryShippingOptionManualSyncBody
): DeliveryHubShippingOptionMedusaMutationPortContext {
  const mutationContext = request.mutation_context
  const createContext = mutationContext?.create

  if (!createContext || Object.keys(createContext).length === 0) {
    throw new DeliveryHubError({
      code: "DELIVERY_HUB_VALIDATION_ERROR",
      message: "Manual shipping-option sync execute mode requires explicit create mutation context.",
      status: 400,
      details: {
        mode: request.mode,
        has_mutation_context: Boolean(mutationContext),
        has_create_context: Boolean(createContext),
      },
    })
  }

  return {
    create: createContext,
    update: mutationContext?.update,
    archive: mutationContext?.archive,
  }
}

export function buildDeliveryHubShippingOptionManualSyncDryRunRequest(): AdminDeliveryShippingOptionManualSyncBody {
  return {
    mode: "dry_run",
    on_error: "abort",
  }
}

export function buildDeliveryHubShippingOptionManualSyncExecuteRequest(input: {
  mutation_context: DeliveryHubShippingOptionMedusaMutationPortContext
  on_error?: DeliveryHubShippingOptionSyncExecutorErrorMode
}): AdminDeliveryShippingOptionManualSyncBody {
  return {
    mode: "execute",
    confirm_execute: DELIVERY_HUB_MANUAL_SYNC_EXECUTE_GUARD,
    on_error: input.on_error ?? "abort",
    mutation_context: input.mutation_context,
  }
}
