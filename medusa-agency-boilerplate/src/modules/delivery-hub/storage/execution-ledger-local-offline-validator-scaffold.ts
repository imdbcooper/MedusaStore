import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import {
  buildDeliveryHubExecutionLedgerSchemaCheckPlan,
  DELIVERY_HUB_EXECUTION_LEDGER_SCHEMA_CHECK_PLAN_MODE,
  DELIVERY_HUB_EXECUTION_LEDGER_SCHEMA_CHECK_PLAN_SOURCE,
  validateDeliveryHubExecutionLedgerSuppliedSchemaSnapshotFixtureContract,
  type DeliveryHubExecutionLedgerExternallySuppliedPlainSchemaSnapshot,
} from "./execution-ledger-schema-check-plan-scaffold"
import { DELIVERY_HUB_EXECUTION_LEDGER_SCHEMA_VERIFICATION_MODE } from "./execution-ledger-schema-verification-scaffold"

export const DELIVERY_HUB_EXECUTION_LEDGER_LOCAL_OFFLINE_VALIDATOR_MODE =
  "local_offline_supplied_snapshot_validator"

export const DELIVERY_HUB_EXECUTION_LEDGER_LOCAL_OFFLINE_VALIDATOR_ENVELOPE_VERSION = 2

export const DELIVERY_HUB_EXECUTION_LEDGER_LOCAL_OFFLINE_VALIDATOR_ARTIFACT_IDENTITY =
  "delivery_hub.execution_ledger.local_offline_validator"

export type DeliveryHubExecutionLedgerLocalOfflineValidatorInput = {
  snapshot_file_path: string
  table_name?: string
}

export type DeliveryHubExecutionLedgerLocalOfflineValidatorOutput = {
  envelope_version: typeof DELIVERY_HUB_EXECUTION_LEDGER_LOCAL_OFFLINE_VALIDATOR_ENVELOPE_VERSION
  artifact: {
    identity: typeof DELIVERY_HUB_EXECUTION_LEDGER_LOCAL_OFFLINE_VALIDATOR_ARTIFACT_IDENTITY
    mode: typeof DELIVERY_HUB_EXECUTION_LEDGER_LOCAL_OFFLINE_VALIDATOR_MODE
    posture: "local_offline_evidence_only"
  }
  invocation: {
    identity: string
    source: "manual_cli_snapshot_review"
    syntactically_valid_run: true
    table_name_override_applied: boolean
  }
  input: {
    snapshot_file_path: string
    resolved_snapshot_file_path: string
    snapshot_identity: string
    supplied_table_name_override: string | null
  }
  resolved: {
    table_name: string
  }
  summary: {
    final_verdict: "compatible" | "incompatible"
    mismatch_count: number
    posture: "activation_blocked"
    verification_scope: "local_offline_supplied_snapshot_only"
  }
  verification: {
    check_plan: {
      mode: typeof DELIVERY_HUB_EXECUTION_LEDGER_SCHEMA_CHECK_PLAN_MODE
      source: typeof DELIVERY_HUB_EXECUTION_LEDGER_SCHEMA_CHECK_PLAN_SOURCE
      verifier_mode: typeof DELIVERY_HUB_EXECUTION_LEDGER_SCHEMA_VERIFICATION_MODE
    }
    result: {
      verdict: "compatible" | "incompatible"
      resolved_table_name: string
      mismatch_count: number
      mismatches: Array<{
        code: string
        table: string
        role?: string
        column?: string
        columns?: string[]
        constraint?: string
        expected?: string | string[]
        actual?: string | string[] | null
        source: string
        message: string
      }>
    }
  }
  disabled_confirmations: {
    local_offline_only: true
    runtime_feature: false
    runtime_capability_enabled: false
    activation_enabled: false
    db_connection: false
    db_introspection: false
    repository_required: false
    db_adapter_required: false
    sql_execution: false
    migration_application: false
    runtime_table_creation: false
    runtime_wiring: false
    transaction_runner: false
    admin_exposure: false
    app_runtime_execution_path: false
    provider_dispatch: false
    shipment_creation: false
    order_or_fulfillment_mutation: false
  }
}

export async function runDeliveryHubExecutionLedgerLocalOfflineValidator(
  input: DeliveryHubExecutionLedgerLocalOfflineValidatorInput
): Promise<DeliveryHubExecutionLedgerLocalOfflineValidatorOutput> {
  const resolvedSnapshotFilePath = resolve(input.snapshot_file_path)
  const fileContents = await readFile(resolvedSnapshotFilePath, "utf8")
  const parsedSnapshot = parseDeliveryHubExecutionLedgerSuppliedSnapshotJson({
    file_path: resolvedSnapshotFilePath,
    file_contents: fileContents,
  })
  const plan = buildDeliveryHubExecutionLedgerSchemaCheckPlan({
    table_name: input.table_name,
    snapshot: parsedSnapshot,
  })
  const mismatchCount = plan.verification_result.mismatches.length
  const suppliedTableNameOverride = input.table_name?.trim() || null

  return {
    envelope_version: DELIVERY_HUB_EXECUTION_LEDGER_LOCAL_OFFLINE_VALIDATOR_ENVELOPE_VERSION,
    artifact: {
      identity: DELIVERY_HUB_EXECUTION_LEDGER_LOCAL_OFFLINE_VALIDATOR_ARTIFACT_IDENTITY,
      mode: DELIVERY_HUB_EXECUTION_LEDGER_LOCAL_OFFLINE_VALIDATOR_MODE,
      posture: "local_offline_evidence_only",
    },
    invocation: {
      identity: buildDeliveryHubExecutionLedgerLocalOfflineValidatorInvocationIdentity({
        resolved_snapshot_file_path: resolvedSnapshotFilePath,
        supplied_table_name_override: suppliedTableNameOverride,
      }),
      source: "manual_cli_snapshot_review",
      syntactically_valid_run: true,
      table_name_override_applied: suppliedTableNameOverride !== null,
    },
    input: {
      snapshot_file_path: input.snapshot_file_path,
      resolved_snapshot_file_path: resolvedSnapshotFilePath,
      snapshot_identity: resolvedSnapshotFilePath,
      supplied_table_name_override: suppliedTableNameOverride,
    },
    resolved: {
      table_name: plan.table_name,
    },
    summary: {
      final_verdict: plan.verification_result.verdict,
      mismatch_count: mismatchCount,
      posture: "activation_blocked",
      verification_scope: "local_offline_supplied_snapshot_only",
    },
    verification: {
      check_plan: {
        mode: DELIVERY_HUB_EXECUTION_LEDGER_SCHEMA_CHECK_PLAN_MODE,
        source: DELIVERY_HUB_EXECUTION_LEDGER_SCHEMA_CHECK_PLAN_SOURCE,
        verifier_mode: DELIVERY_HUB_EXECUTION_LEDGER_SCHEMA_VERIFICATION_MODE,
      },
      result: {
        verdict: plan.verification_result.verdict,
        resolved_table_name: plan.table_name,
        mismatch_count: mismatchCount,
        mismatches: plan.verification_result.mismatches.map((mismatch) => ({
          code: mismatch.code,
          table: mismatch.table,
          role: mismatch.role,
          column: mismatch.column,
          columns: mismatch.columns ? [...mismatch.columns] : undefined,
          constraint: mismatch.constraint,
          expected: Array.isArray(mismatch.expected)
            ? [...mismatch.expected]
            : mismatch.expected,
          actual: Array.isArray(mismatch.actual) ? [...mismatch.actual] : mismatch.actual,
          source: mismatch.source,
          message: mismatch.message,
        })),
      },
    },
    disabled_confirmations: {
      local_offline_only: true,
      runtime_feature: false,
      runtime_capability_enabled: false,
      activation_enabled: false,
      db_connection: false,
      db_introspection: false,
      repository_required: false,
      db_adapter_required: false,
      sql_execution: false,
      migration_application: false,
      runtime_table_creation: false,
      runtime_wiring: false,
      transaction_runner: false,
      admin_exposure: false,
      app_runtime_execution_path: false,
      provider_dispatch: false,
      shipment_creation: false,
      order_or_fulfillment_mutation: false,
    },
  }
}

export function buildDeliveryHubExecutionLedgerLocalOfflineValidatorInvocationIdentity(input: {
  resolved_snapshot_file_path: string
  supplied_table_name_override: string | null
}): string {
  return [
    DELIVERY_HUB_EXECUTION_LEDGER_LOCAL_OFFLINE_VALIDATOR_MODE,
    input.resolved_snapshot_file_path,
    input.supplied_table_name_override ?? "<default_table_name>",
  ].join("::")
}

export function parseDeliveryHubExecutionLedgerSuppliedSnapshotJson(input: {
  file_path: string
  file_contents: string
}): DeliveryHubExecutionLedgerExternallySuppliedPlainSchemaSnapshot {
  let parsed: unknown

  try {
    parsed = JSON.parse(input.file_contents)
  } catch (error) {
    throw new Error(
      `Delivery Hub execution ledger local offline validator could not parse JSON snapshot at ${input.file_path}: ${getErrorMessage(error)}`
    )
  }

  return validateDeliveryHubExecutionLedgerSuppliedSnapshotShape({
    file_path: input.file_path,
    value: parsed,
  })
}

function validateDeliveryHubExecutionLedgerSuppliedSnapshotShape(input: {
  file_path: string
  value: unknown
}): DeliveryHubExecutionLedgerExternallySuppliedPlainSchemaSnapshot {
  try {
    return validateDeliveryHubExecutionLedgerSuppliedSchemaSnapshotFixtureContract({
      value: input.value,
      source_label: input.file_path,
    })
  } catch (error) {
    throw new Error(
      String(getErrorMessage(error)).replace(
        "Delivery Hub execution ledger supplied schema snapshot fixture contract",
        "Delivery Hub execution ledger local offline validator"
      )
    )
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return "Unknown JSON parse failure"
}
