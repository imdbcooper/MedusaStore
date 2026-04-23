import crypto from "node:crypto"
import { DELIVERY_HUB_LOG_KIND } from "./constants"
import { DeliveryHubError } from "./errors"
import type {
  DeliveryHubShippingOptionMedusaMutationPortContext,
} from "./shipping-option-medusa-mutation-port"
import type {
  AdminDeliveryShippingOptionManualSyncBody,
  DeliveryHubShippingOptionManualSyncDesiredPlanSummary,
  DeliveryHubShippingOptionManualSyncExecutionMode,
  DeliveryHubShippingOptionManualSyncReconciliationSummary,
} from "./shipping-option-manual-sync"
import { DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE } from "./shipping-option-contract"
import type { DeliveryHubShippingOptionSyncExecutionReport } from "./shipping-option-sync-executor"
import type {
  DeliveryHubShippingOptionArchiveOperation,
  DeliveryHubShippingOptionCreateOperation,
  DeliveryHubShippingOptionSyncOperationPlan,
  DeliveryHubShippingOptionUpdateOperation,
} from "./shipping-option-sync-operation-plan"
import {
  redactRecord,
  redactSensitiveText,
} from "./security/redaction"
import { appendDeliveryEventLog } from "./storage/event-log-repository"
import type { DeliveryHubPgConnection } from "./storage/pg"

export type DeliveryHubShippingOptionManualSyncAuditLogInput<
  TCreateResult = unknown,
  TUpdateResult = unknown,
  TArchiveResult = unknown,
> = {
  request: AdminDeliveryShippingOptionManualSyncBody
  current_option_count: number
  execution_mode?: DeliveryHubShippingOptionManualSyncExecutionMode | null
  desired_plan_summary?: DeliveryHubShippingOptionManualSyncDesiredPlanSummary | null
  reconciliation_summary?: DeliveryHubShippingOptionManualSyncReconciliationSummary | null
  operation_plan?: DeliveryHubShippingOptionSyncOperationPlan | null
  execution_report?: DeliveryHubShippingOptionSyncExecutionReport<
    TCreateResult,
    TUpdateResult,
    TArchiveResult
  > | null
  error?: unknown
}

export type DeliveryHubShippingOptionManualSyncAuditLogger<
  TCreateResult = unknown,
  TUpdateResult = unknown,
  TArchiveResult = unknown,
> = (
  input: DeliveryHubShippingOptionManualSyncAuditLogInput<
    TCreateResult,
    TUpdateResult,
    TArchiveResult
  >
) => Promise<void>

export function createDeliveryHubShippingOptionManualSyncAuditLogger(
  pg: DeliveryHubPgConnection
): DeliveryHubShippingOptionManualSyncAuditLogger {
  return async function appendDeliveryHubShippingOptionManualSyncAuditLog(input) {
    await appendDeliveryEventLog(pg, {
      connection_id: null,
      provider_code: DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
      kind: DELIVERY_HUB_LOG_KIND.shippingOptionManualSync,
      correlation_id: crypto.randomUUID(),
      success: resolveAuditSuccess(input),
      request_summary: redactRecord(buildRequestSummary(input)),
      response_summary: redactRecord(buildResponseSummary(input)),
      error_code: resolveAuditErrorCode(input.error),
    })
  }
}

function buildRequestSummary(
  input: DeliveryHubShippingOptionManualSyncAuditLogInput
) {
  return {
    requested_mode: input.request.mode ?? "dry_run",
    requested_on_error: input.request.on_error ?? "abort",
    current_option_count: input.current_option_count,
    confirm_execute_provided: Boolean(input.request.confirm_execute?.trim()),
    mutation_context_summary: summarizeMutationContext(input.request.mutation_context),
  }
}

function buildResponseSummary(
  input: DeliveryHubShippingOptionManualSyncAuditLogInput
) {
  const baseSummary = {
    execution_mode: input.execution_mode
      ? {
          requested_mode: input.execution_mode.requested_mode,
          effective_mode: input.execution_mode.effective_mode,
          execute_requested: input.execution_mode.execute_requested,
          execute_confirmed: input.execution_mode.execute_confirmed,
          is_dry_run: input.execution_mode.is_dry_run,
        }
      : null,
    desired_plan_summary: input.desired_plan_summary ?? null,
    reconciliation_summary: input.reconciliation_summary ?? null,
    operation_plan_summary: input.operation_plan?.summary ?? null,
    planned_changes: input.operation_plan ? summarizeOperationPlan(input.operation_plan) : null,
  }

  return {
    ...baseSummary,
    outcome: input.error ? "failed" : input.execution_report?.outcome ?? "dry_run",
    aborted: input.execution_report?.aborted ?? false,
    execution_summary: input.execution_report?.summary ?? null,
    failed_operations: input.execution_report
      ? summarizeFailedOperations(input.execution_report)
      : [],
    error: input.error ? normalizeAuditError(input.error) : null,
  }
}

function resolveAuditSuccess(
  input: DeliveryHubShippingOptionManualSyncAuditLogInput
) {
  if (input.error) {
    return false
  }

  if (!input.execution_report) {
    return true
  }

  return input.execution_report.outcome === "succeeded"
}

function summarizeMutationContext(
  mutationContext?: DeliveryHubShippingOptionMedusaMutationPortContext
) {
  const createEntries = Object.entries(mutationContext?.create ?? {})
  const updateEntries = Object.entries(mutationContext?.update ?? {})
  const archiveEntries = Object.entries(mutationContext?.archive ?? {})

  return {
    create_modes: createEntries.map(([mode_code, context]) => ({
      mode_code,
      service_zone_id: context.service_zone_id,
      shipping_profile_id: context.shipping_profile_id,
    })),
    update_modes: updateEntries.map(([mode_code, context]) => ({
      mode_code,
      name_override_present: Boolean(context.name?.trim()),
      rules_count: Array.isArray(context.rules) ? context.rules.length : 0,
      type_code: context.type?.code?.trim() || null,
    })),
    archive_modes: archiveEntries.map(([mode_code, context]) => ({
      mode_code,
      hard_delete: Boolean(context.hard_delete),
    })),
  }
}

function summarizeOperationPlan(plan: DeliveryHubShippingOptionSyncOperationPlan) {
  return {
    create: plan.create_operations.map((operation) => summarizeCreateOperation(operation)),
    update: plan.update_operations.map((operation) => summarizeUpdateOperation(operation)),
    archive: plan.archive_operations.map((operation) => summarizeArchiveOperation(operation)),
    noop: plan.noops.map((operation) => ({
      mode_code: operation.mode_code,
      shipping_option_id: operation.current.id,
    })),
    ignored_foreign_option_ids: plan.ignored_foreign_options.map((option) => option.current.id),
  }
}

function summarizeCreateOperation(operation: DeliveryHubShippingOptionCreateOperation) {
  return {
    mode_code: operation.mode_code,
    shipping_option_key: operation.target_data.id,
    supporting_connection_ids: [...operation.supporting_connection_ids],
  }
}

function summarizeUpdateOperation(operation: DeliveryHubShippingOptionUpdateOperation) {
  return {
    mode_code: operation.mode_code,
    shipping_option_id: operation.current.id,
    shipping_option_key: operation.target_data.id,
    reasons: [...operation.reasons],
    supporting_connection_ids: [...operation.supporting_connection_ids],
  }
}

function summarizeArchiveOperation(operation: DeliveryHubShippingOptionArchiveOperation) {
  return {
    mode_code: operation.mode_code,
    shipping_option_id: operation.current.id,
    reason: operation.reason,
  }
}

function summarizeFailedOperations(
  report: DeliveryHubShippingOptionSyncExecutionReport<unknown, unknown, unknown>
) {
  return report.executed_operations
    .filter((operation) => operation.status === "failed")
    .map((operation) => ({
      type: operation.type,
      mode_code: operation.operation.mode_code,
      shipping_option_id: getOperationShippingOptionId(operation.operation),
      error: normalizeAuditError(operation.error),
    }))
}

function getOperationShippingOptionId(
  operation:
    | DeliveryHubShippingOptionCreateOperation
    | DeliveryHubShippingOptionUpdateOperation
    | DeliveryHubShippingOptionArchiveOperation
) {
  return operation.type === "create" ? null : operation.current.id
}

function normalizeAuditError(error: unknown) {
  if (error instanceof DeliveryHubError) {
    return {
      name: error.name,
      code: error.code,
      status: error.status,
      message: redactSensitiveText(error.message),
      details: error.details ? redactRecord(error.details) : null,
    }
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      code: resolveAuditErrorCode(error),
      status: null,
      message: redactSensitiveText(error.message),
      details: normalizeAuditErrorDetails(error),
    }
  }

  return {
    name: typeof error,
    code: resolveAuditErrorCode(error),
    status: null,
    message: redactSensitiveText(String(error)),
    details: null,
  }
}

function normalizeAuditErrorDetails(error: Error) {
  const maybeDetails = (error as { details?: unknown }).details

  if (!maybeDetails || typeof maybeDetails !== "object" || Array.isArray(maybeDetails)) {
    return null
  }

  return redactRecord(maybeDetails as Record<string, unknown>)
}

function resolveAuditErrorCode(error: unknown) {
  if (!error) {
    return null
  }

  if (error instanceof DeliveryHubError) {
    return error.code
  }

  const maybeCode = (error as { code?: unknown }).code
  return typeof maybeCode === "string" && maybeCode.trim()
    ? maybeCode.trim()
    : "DELIVERY_HUB_UNEXPECTED_ERROR"
}
