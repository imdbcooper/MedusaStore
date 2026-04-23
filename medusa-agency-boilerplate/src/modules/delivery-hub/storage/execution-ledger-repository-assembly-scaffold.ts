import type { DeliveryHubPgConnection } from "./pg"
import type { DeliveryHubExecutionLedgerRepository } from "./execution-ledger-repository"
import { DeliveryHubExecutionLedgerPgRepository } from "./execution-ledger-pg-repository"
import type { DeliveryHubExecutionLedgerPgRepositoryOptions } from "./execution-ledger-pg-repository"
import {
  DeliveryHubExecutionLedgerStorageAdapterScaffold,
  normalizeDeliveryHubExecutionLedgerStorageTableName,
  type DeliveryHubExecutionLedgerStorageAdapterScaffoldOptions,
} from "./execution-ledger-storage-adapter-scaffold"
import {
  DELIVERY_HUB_EXECUTION_LEDGER_DESCRIPTOR_VERSION,
  listDeliveryHubExecutionLedgerStorageEntityDescriptors,
  type DeliveryHubExecutionLedgerStorageEntityDescriptor,
  type DeliveryHubExecutionLedgerStorageQueryDescriptor,
} from "./execution-ledger-storage-descriptor-scaffold"
import {
  buildDeliveryHubExecutionLedgerPgMigrationArtifact,
  type DeliveryHubExecutionLedgerPgMigrationArtifact,
} from "./execution-ledger-pg-migration-artifact"
import {
  DELIVERY_HUB_EXECUTION_LEDGER_QUERY_PLAN_MODE,
  DELIVERY_HUB_EXECUTION_LEDGER_QUERY_PLAN_VERSION,
  type DeliveryHubExecutionLedgerPlanOperation,
} from "./execution-ledger-query-plan-scaffold"
import {
  DELIVERY_HUB_EXECUTION_LEDGER_TRANSACTION_PLAN_MODE,
  DELIVERY_HUB_EXECUTION_LEDGER_TRANSACTION_PLAN_VERSION,
  type DeliveryHubExecutionLedgerTransactionPlanOperation,
} from "./execution-ledger-transaction-plan-scaffold"
import {
  DELIVERY_HUB_EXECUTION_LEDGER_SCHEMA_VERIFICATION_MODE,
} from "./execution-ledger-schema-verification-scaffold"
import {
  DELIVERY_HUB_EXECUTION_LEDGER_SCHEMA_CHECK_PLAN_MODE,
  DELIVERY_HUB_EXECUTION_LEDGER_SCHEMA_CHECK_PLAN_SOURCE,
} from "./execution-ledger-schema-check-plan-scaffold"

export const DELIVERY_HUB_EXECUTION_LEDGER_REPOSITORY_ASSEMBLY_VERSION = 1
export const DELIVERY_HUB_EXECUTION_LEDGER_REPOSITORY_ASSEMBLY_MODE = "assembly_plan_only"

export const DELIVERY_HUB_EXECUTION_LEDGER_REPOSITORY_PORT_OPERATIONS = [
  "getExecutionByReference",
  "getExecutionByIdempotencyKey",
  "reserveExecution",
  "recordTransition",
  "appendAuditEvent",
] as const satisfies readonly DeliveryHubExecutionLedgerPlanOperation[]

export type DeliveryHubExecutionLedgerRepositoryPortOperation =
  (typeof DELIVERY_HUB_EXECUTION_LEDGER_REPOSITORY_PORT_OPERATIONS)[number]

export type DeliveryHubExecutionLedgerRepositoryAssemblyStatus =
  | "not_configured"
  | "inert_scaffold_available"
  | "pg_repository_implementation_available"

export type DeliveryHubExecutionLedgerRepositoryAssemblyComponentStatus =
  | "available"
  | "inert"
  | "plan_only"
  | "not_configured"

export type DeliveryHubExecutionLedgerRepositoryAssemblyComponent = {
  component:
    | "repository_port"
    | "storage_adapter_scaffold"
    | "pg_repository_implementation"
    | "descriptor_layer"
    | "query_plan_layer"
    | "transaction_plan_layer"
    | "schema_migration_artifact"
    | "schema_verification_layer"
    | "schema_check_plan_layer"
  status: DeliveryHubExecutionLedgerRepositoryAssemblyComponentStatus
  source: string
  runtime_wiring: "disabled"
  execution_enabled: false
}

export type DeliveryHubExecutionLedgerRepositoryAssemblyOperationReadiness = {
  operation: DeliveryHubExecutionLedgerRepositoryPortOperation
  plan_available: true
  execution_enabled: false
  runtime_wiring: "disabled"
  repository_status: DeliveryHubExecutionLedgerRepositoryAssemblyStatus
  query_plan_mode: typeof DELIVERY_HUB_EXECUTION_LEDGER_QUERY_PLAN_MODE
  query_plan_builder: string
  descriptor_operations: DeliveryHubExecutionLedgerStorageQueryDescriptor["operation"][]
  transaction_plan_available: boolean
  transaction_plan_mode?: typeof DELIVERY_HUB_EXECUTION_LEDGER_TRANSACTION_PLAN_MODE
  transaction_plan_builder?: string
  allowed_action: "plan_only"
}

export type DeliveryHubExecutionLedgerRepositoryAssemblyDescriptorLayer = {
  version: typeof DELIVERY_HUB_EXECUTION_LEDGER_DESCRIPTOR_VERSION
  table_name: string
  entity_descriptors: DeliveryHubExecutionLedgerStorageEntityDescriptor[]
  descriptor_bundle_builder: "buildDeliveryHubExecutionLedgerStorageDescriptorBundle"
  descriptor_bundle_execution: "not_invoked_without_controlled_execution_drafts"
  query_descriptors_inert: true
}

export type DeliveryHubExecutionLedgerRepositoryAssemblyPlanLayer = {
  query_plan_version: typeof DELIVERY_HUB_EXECUTION_LEDGER_QUERY_PLAN_VERSION
  query_plan_mode: typeof DELIVERY_HUB_EXECUTION_LEDGER_QUERY_PLAN_MODE
  transaction_plan_version: typeof DELIVERY_HUB_EXECUTION_LEDGER_TRANSACTION_PLAN_VERSION
  transaction_plan_mode: typeof DELIVERY_HUB_EXECUTION_LEDGER_TRANSACTION_PLAN_MODE
  builders_are_referenced_only: true
  query_execution_enabled: false
  transaction_execution_enabled: false
}

export type DeliveryHubExecutionLedgerRepositoryAssemblyMigrationLayer = {
  schema_migration_artifact_available: true
  artifact: DeliveryHubExecutionLedgerPgMigrationArtifact
  artifact_review_ready: true
  artifact_application_mode: "manual_external_only"
  automatic_application_enabled: false
  table_creation_at_runtime_enabled: false
}

export type DeliveryHubExecutionLedgerRepositoryAssemblySchemaVerificationLayer = {
  verifier_available: true
  check_plan_available: true
  verifier_mode: typeof DELIVERY_HUB_EXECUTION_LEDGER_SCHEMA_VERIFICATION_MODE
  verifier_source: "supplied_snapshot_only"
  check_plan_mode: typeof DELIVERY_HUB_EXECUTION_LEDGER_SCHEMA_CHECK_PLAN_MODE
  check_plan_source: typeof DELIVERY_HUB_EXECUTION_LEDGER_SCHEMA_CHECK_PLAN_SOURCE
  db_connection_required: false
  db_introspection_required: false
  repository_required: false
  db_adapter_required: false
  sql_execution_required: false
  migration_application_enabled: false
  runtime_table_creation_enabled: false
  runtime_wiring_enabled: false
  transaction_runner_required: false
  transaction_runner_enabled: false
  admin_exposure_enabled: false
  disabled_confirmations: {
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
  }
}

export type DeliveryHubExecutionLedgerRepositoryAssemblyPersistenceReadinessContourStage =
  | "artifact_defined"
  | "manual_application_external"
  | "snapshot_verification_available"
  | "activation_blocked"

export type DeliveryHubExecutionLedgerRepositoryAssemblyPersistenceReadinessContour = {
  stages: DeliveryHubExecutionLedgerRepositoryAssemblyPersistenceReadinessContourStage[]
  current_stage: "activation_blocked"
  review_preparation_available_now: Array<
    | "descriptor_bundle_defined"
    | "migration_artifact_reviewable"
    | "snapshot_schema_verifier_available"
    | "snapshot_schema_check_plan_available"
  >
  external_manual_application_remaining: Array<
    | "manual_migration_review"
    | "manual_table_creation_or_migration_execution"
    | "manual_schema_snapshot_capture"
  >
  activation_blocked_until: DeliveryHubExecutionLedgerRepositoryAssemblyActivationPrerequisite[]
}

export type DeliveryHubExecutionLedgerRepositoryAssemblyDisabledConfirmations = {
  query_execution: false
  transaction_execution: false
  transaction_open: false
  transaction_commit: false
  transaction_rollback: false
  production_writes: false
  runtime_wiring: false
  live_execution: false
  provider_dispatch: false
  shipment_creation: false
  label_or_document_generation: false
  order_or_fulfillment_mutation: false
  retry_scheduling: false
  compensation_or_rollback_writes: false
  checkout_or_storefront_cutover: false
  connection_factory_invocation: false
  migration_or_table_creation: false
}

export type DeliveryHubExecutionLedgerRepositoryAssemblyActivationPrerequisite =
  | "real_repository_implementation"
  | "migration_or_table_creation"
  | "transaction_runner"
  | "explicit_runtime_wiring"
  | "operational_runbook"
  | "safety_review"

export type DeliveryHubExecutionLedgerRepositoryAssemblyReadiness = {
  version: typeof DELIVERY_HUB_EXECUTION_LEDGER_REPOSITORY_ASSEMBLY_VERSION
  mode: typeof DELIVERY_HUB_EXECUTION_LEDGER_REPOSITORY_ASSEMBLY_MODE
  repository_status: DeliveryHubExecutionLedgerRepositoryAssemblyStatus
  table_name: string
  component_inventory: DeliveryHubExecutionLedgerRepositoryAssemblyComponent[]
  port_operations: readonly DeliveryHubExecutionLedgerRepositoryPortOperation[]
  operation_readiness: DeliveryHubExecutionLedgerRepositoryAssemblyOperationReadiness[]
  descriptor_layer: DeliveryHubExecutionLedgerRepositoryAssemblyDescriptorLayer
  plan_layer: DeliveryHubExecutionLedgerRepositoryAssemblyPlanLayer
  migration_layer: DeliveryHubExecutionLedgerRepositoryAssemblyMigrationLayer
  schema_verification_layer: DeliveryHubExecutionLedgerRepositoryAssemblySchemaVerificationLayer
  persistence_readiness_contour: DeliveryHubExecutionLedgerRepositoryAssemblyPersistenceReadinessContour
  missing_activation_prerequisites: DeliveryHubExecutionLedgerRepositoryAssemblyActivationPrerequisite[]
  disabled_confirmations: DeliveryHubExecutionLedgerRepositoryAssemblyDisabledConfirmations
}

export type DeliveryHubExecutionLedgerRepositoryAssemblyReadinessSummary = Readonly<{
  version: DeliveryHubExecutionLedgerRepositoryAssemblyReadiness["version"]
  mode: DeliveryHubExecutionLedgerRepositoryAssemblyReadiness["mode"]
  repository_status: DeliveryHubExecutionLedgerRepositoryAssemblyReadiness["repository_status"]
  table_name: DeliveryHubExecutionLedgerRepositoryAssemblyReadiness["table_name"]
  persistence_readiness_contour: DeliveryHubExecutionLedgerRepositoryAssemblyReadiness["persistence_readiness_contour"]
  missing_activation_prerequisites: DeliveryHubExecutionLedgerRepositoryAssemblyReadiness["missing_activation_prerequisites"]
  disabled_confirmations: DeliveryHubExecutionLedgerRepositoryAssemblyReadiness["disabled_confirmations"]
}>

export type DeliveryHubExecutionLedgerRepositoryAssemblyOptions = {
  table_name?: string
  adapter_scaffold_available?: boolean
  pg_repository_implementation_available?: boolean
}

export function buildDeliveryHubExecutionLedgerRepositoryAssemblyReadiness(
  options?: DeliveryHubExecutionLedgerRepositoryAssemblyOptions
): DeliveryHubExecutionLedgerRepositoryAssemblyReadiness {
  const tableName = normalizeDeliveryHubExecutionLedgerStorageTableName(options?.table_name)
  const adapterScaffoldAvailable = options?.adapter_scaffold_available ?? true
  const pgRepositoryImplementationAvailable =
    options?.pg_repository_implementation_available ?? true
  const repositoryStatus: DeliveryHubExecutionLedgerRepositoryAssemblyStatus =
    pgRepositoryImplementationAvailable
      ? "pg_repository_implementation_available"
      : adapterScaffoldAvailable
        ? "inert_scaffold_available"
        : "not_configured"

  const migrationArtifact = buildDeliveryHubExecutionLedgerPgMigrationArtifact({
    table_name: tableName,
  })

  return {
    version: DELIVERY_HUB_EXECUTION_LEDGER_REPOSITORY_ASSEMBLY_VERSION,
    mode: DELIVERY_HUB_EXECUTION_LEDGER_REPOSITORY_ASSEMBLY_MODE,
    repository_status: repositoryStatus,
    table_name: tableName,
    component_inventory: buildDeliveryHubExecutionLedgerRepositoryAssemblyComponentInventory(
      repositoryStatus
    ),
    port_operations: DELIVERY_HUB_EXECUTION_LEDGER_REPOSITORY_PORT_OPERATIONS,
    operation_readiness: buildDeliveryHubExecutionLedgerRepositoryAssemblyOperationReadiness(
      repositoryStatus
    ),
    descriptor_layer: {
      version: DELIVERY_HUB_EXECUTION_LEDGER_DESCRIPTOR_VERSION,
      table_name: tableName,
      entity_descriptors: listDeliveryHubExecutionLedgerStorageEntityDescriptors({
        table_name: tableName,
      }),
      descriptor_bundle_builder: "buildDeliveryHubExecutionLedgerStorageDescriptorBundle",
      descriptor_bundle_execution: "not_invoked_without_controlled_execution_drafts",
      query_descriptors_inert: true,
    },
    plan_layer: {
      query_plan_version: DELIVERY_HUB_EXECUTION_LEDGER_QUERY_PLAN_VERSION,
      query_plan_mode: DELIVERY_HUB_EXECUTION_LEDGER_QUERY_PLAN_MODE,
      transaction_plan_version: DELIVERY_HUB_EXECUTION_LEDGER_TRANSACTION_PLAN_VERSION,
      transaction_plan_mode: DELIVERY_HUB_EXECUTION_LEDGER_TRANSACTION_PLAN_MODE,
      builders_are_referenced_only: true,
      query_execution_enabled: false,
      transaction_execution_enabled: false,
    },
    migration_layer: {
      schema_migration_artifact_available: true,
      artifact: migrationArtifact,
      artifact_review_ready: true,
      artifact_application_mode: "manual_external_only",
      automatic_application_enabled: false,
      table_creation_at_runtime_enabled: false,
    },
    schema_verification_layer: buildDeliveryHubExecutionLedgerRepositoryAssemblySchemaVerificationLayer(),
    persistence_readiness_contour: buildDeliveryHubExecutionLedgerRepositoryAssemblyPersistenceReadinessContour(),
    missing_activation_prerequisites: [
      "migration_or_table_creation",
      "transaction_runner",
      "explicit_runtime_wiring",
      "operational_runbook",
      "safety_review",
    ],
    disabled_confirmations: buildDeliveryHubExecutionLedgerRepositoryAssemblyDisabledConfirmations(),
  }
}

export function buildDeliveryHubExecutionLedgerRepositoryAssemblyReadinessSummary(
  options?: DeliveryHubExecutionLedgerRepositoryAssemblyOptions
): DeliveryHubExecutionLedgerRepositoryAssemblyReadinessSummary {
  const readiness = buildDeliveryHubExecutionLedgerRepositoryAssemblyReadiness(options)

  return {
    version: readiness.version,
    mode: readiness.mode,
    repository_status: readiness.repository_status,
    table_name: readiness.table_name,
    persistence_readiness_contour: readiness.persistence_readiness_contour,
    missing_activation_prerequisites: readiness.missing_activation_prerequisites,
    disabled_confirmations: readiness.disabled_confirmations,
  }
}

export function createDeliveryHubExecutionLedgerInertStorageAdapterScaffold(
  options?: DeliveryHubExecutionLedgerStorageAdapterScaffoldOptions
): DeliveryHubExecutionLedgerRepository {
  return new DeliveryHubExecutionLedgerStorageAdapterScaffold(options)
}

export function createDeliveryHubExecutionLedgerRepositoryAssemblyWithInertAdapter(input?: {
  table_name?: string
  connection?: DeliveryHubPgConnection | (() => DeliveryHubPgConnection | Promise<DeliveryHubPgConnection>)
}): {
  readiness: DeliveryHubExecutionLedgerRepositoryAssemblyReadiness
  repository: DeliveryHubExecutionLedgerRepository
} {
  return {
    readiness: buildDeliveryHubExecutionLedgerRepositoryAssemblyReadiness({
      table_name: input?.table_name,
      adapter_scaffold_available: true,
    }),
    repository: createDeliveryHubExecutionLedgerInertStorageAdapterScaffold({
      table_name: input?.table_name,
      connection: input?.connection,
    }),
  }
}

export function createDeliveryHubExecutionLedgerPgRepository(
  options: DeliveryHubExecutionLedgerPgRepositoryOptions
): DeliveryHubExecutionLedgerRepository {
  return new DeliveryHubExecutionLedgerPgRepository(options)
}

function buildDeliveryHubExecutionLedgerRepositoryAssemblyComponentInventory(
  repositoryStatus: DeliveryHubExecutionLedgerRepositoryAssemblyStatus
): DeliveryHubExecutionLedgerRepositoryAssemblyComponent[] {
  return [
    {
      component: "repository_port",
      status: "available",
      source: "execution-ledger-repository.ts#DeliveryHubExecutionLedgerRepository",
      runtime_wiring: "disabled",
      execution_enabled: false,
    },
    {
      component: "storage_adapter_scaffold",
      status: repositoryStatus === "not_configured" ? "not_configured" : "inert",
      source: "execution-ledger-storage-adapter-scaffold.ts#DeliveryHubExecutionLedgerStorageAdapterScaffold",
      runtime_wiring: "disabled",
      execution_enabled: false,
    },
    {
      component: "pg_repository_implementation",
      status:
        repositoryStatus === "pg_repository_implementation_available"
          ? "available"
          : "not_configured",
      source: "execution-ledger-pg-repository.ts#DeliveryHubExecutionLedgerPgRepository",
      runtime_wiring: "disabled",
      execution_enabled: false,
    },
    {
      component: "descriptor_layer",
      status: "plan_only",
      source: "execution-ledger-storage-descriptor-scaffold.ts",
      runtime_wiring: "disabled",
      execution_enabled: false,
    },
    {
      component: "query_plan_layer",
      status: "plan_only",
      source: "execution-ledger-query-plan-scaffold.ts",
      runtime_wiring: "disabled",
      execution_enabled: false,
    },
    {
      component: "transaction_plan_layer",
      status: "plan_only",
      source: "execution-ledger-transaction-plan-scaffold.ts",
      runtime_wiring: "disabled",
      execution_enabled: false,
    },
    {
      component: "schema_migration_artifact",
      status: "available",
      source: "execution-ledger-pg-migration-artifact.ts",
      runtime_wiring: "disabled",
      execution_enabled: false,
    },
    {
      component: "schema_verification_layer",
      status: "plan_only",
      source: "execution-ledger-schema-verification-scaffold.ts#verifyDeliveryHubExecutionLedgerSchemaSnapshot",
      runtime_wiring: "disabled",
      execution_enabled: false,
    },
    {
      component: "schema_check_plan_layer",
      status: "plan_only",
      source: "execution-ledger-schema-check-plan-scaffold.ts#buildDeliveryHubExecutionLedgerSchemaCheckPlan",
      runtime_wiring: "disabled",
      execution_enabled: false,
    },
  ]
}

function buildDeliveryHubExecutionLedgerRepositoryAssemblyOperationReadiness(
  repositoryStatus: DeliveryHubExecutionLedgerRepositoryAssemblyStatus
): DeliveryHubExecutionLedgerRepositoryAssemblyOperationReadiness[] {
  return DELIVERY_HUB_EXECUTION_LEDGER_REPOSITORY_PORT_OPERATIONS.map((operation) => ({
    operation,
    plan_available: true,
    execution_enabled: false,
    runtime_wiring: "disabled",
    repository_status: repositoryStatus,
    query_plan_mode: DELIVERY_HUB_EXECUTION_LEDGER_QUERY_PLAN_MODE,
    query_plan_builder: mapDeliveryHubExecutionLedgerOperationToQueryPlanBuilder(operation),
    descriptor_operations: mapDeliveryHubExecutionLedgerOperationToDescriptorOperations(operation),
    transaction_plan_available: mapDeliveryHubExecutionLedgerOperationToTransactionPlanBuilder(operation) !== undefined,
    transaction_plan_mode: mapDeliveryHubExecutionLedgerOperationToTransactionPlanBuilder(operation)
      ? DELIVERY_HUB_EXECUTION_LEDGER_TRANSACTION_PLAN_MODE
      : undefined,
    transaction_plan_builder: mapDeliveryHubExecutionLedgerOperationToTransactionPlanBuilder(operation),
    allowed_action: "plan_only",
  }))
}

function mapDeliveryHubExecutionLedgerOperationToQueryPlanBuilder(
  operation: DeliveryHubExecutionLedgerRepositoryPortOperation
): string {
  switch (operation) {
    case "getExecutionByReference":
      return "buildDeliveryHubExecutionLedgerGetByReferencePlan"
    case "getExecutionByIdempotencyKey":
      return "buildDeliveryHubExecutionLedgerGetByIdempotencyKeyPlan"
    case "reserveExecution":
      return "buildDeliveryHubExecutionLedgerReserveExecutionPlan"
    case "recordTransition":
      return "buildDeliveryHubExecutionLedgerRecordTransitionPlan"
    case "appendAuditEvent":
      return "buildDeliveryHubExecutionLedgerAppendAuditEventPlan"
  }
}

function mapDeliveryHubExecutionLedgerOperationToTransactionPlanBuilder(
  operation: DeliveryHubExecutionLedgerRepositoryPortOperation
): string | undefined {
  switch (operation) {
    case "reserveExecution":
      return "buildDeliveryHubExecutionLedgerReserveTransactionPlan"
    case "recordTransition":
      return "buildDeliveryHubExecutionLedgerTransitionTransactionPlan"
    case "appendAuditEvent":
      return "buildDeliveryHubExecutionLedgerAppendAuditTransactionPlan"
    case "getExecutionByReference":
    case "getExecutionByIdempotencyKey":
      return undefined
  }
}

function mapDeliveryHubExecutionLedgerOperationToDescriptorOperations(
  operation: DeliveryHubExecutionLedgerRepositoryPortOperation
): DeliveryHubExecutionLedgerStorageQueryDescriptor["operation"][] {
  switch (operation) {
    case "getExecutionByReference":
      return ["select_execution_by_reference"]
    case "getExecutionByIdempotencyKey":
      return ["select_execution_by_idempotency_key"]
    case "reserveExecution":
      return ["select_execution_by_reservation_key", "insert_execution_reservation"]
    case "recordTransition":
      return ["select_execution_by_reference", "insert_execution_transition"]
    case "appendAuditEvent":
      return ["select_execution_by_reference", "insert_execution_audit_event"]
  }
}

function buildDeliveryHubExecutionLedgerRepositoryAssemblyDisabledConfirmations(): DeliveryHubExecutionLedgerRepositoryAssemblyDisabledConfirmations {
  return {
    query_execution: false,
    transaction_execution: false,
    transaction_open: false,
    transaction_commit: false,
    transaction_rollback: false,
    production_writes: false,
    runtime_wiring: false,
    live_execution: false,
    provider_dispatch: false,
    shipment_creation: false,
    label_or_document_generation: false,
    order_or_fulfillment_mutation: false,
    retry_scheduling: false,
    compensation_or_rollback_writes: false,
    checkout_or_storefront_cutover: false,
    connection_factory_invocation: false,
    migration_or_table_creation: false,
  }
}

function buildDeliveryHubExecutionLedgerRepositoryAssemblySchemaVerificationLayer(): DeliveryHubExecutionLedgerRepositoryAssemblySchemaVerificationLayer {
  return {
    verifier_available: true,
    check_plan_available: true,
    verifier_mode: DELIVERY_HUB_EXECUTION_LEDGER_SCHEMA_VERIFICATION_MODE,
    verifier_source: "supplied_snapshot_only",
    check_plan_mode: DELIVERY_HUB_EXECUTION_LEDGER_SCHEMA_CHECK_PLAN_MODE,
    check_plan_source: DELIVERY_HUB_EXECUTION_LEDGER_SCHEMA_CHECK_PLAN_SOURCE,
    db_connection_required: false,
    db_introspection_required: false,
    repository_required: false,
    db_adapter_required: false,
    sql_execution_required: false,
    migration_application_enabled: false,
    runtime_table_creation_enabled: false,
    runtime_wiring_enabled: false,
    transaction_runner_required: false,
    transaction_runner_enabled: false,
    admin_exposure_enabled: false,
    disabled_confirmations: {
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
    },
  }
}

function buildDeliveryHubExecutionLedgerRepositoryAssemblyPersistenceReadinessContour(): DeliveryHubExecutionLedgerRepositoryAssemblyPersistenceReadinessContour {
  const activationBlockedUntil: DeliveryHubExecutionLedgerRepositoryAssemblyActivationPrerequisite[] = [
    "migration_or_table_creation",
    "transaction_runner",
    "explicit_runtime_wiring",
    "operational_runbook",
    "safety_review",
  ]

  return {
    stages: [
      "artifact_defined",
      "manual_application_external",
      "snapshot_verification_available",
      "activation_blocked",
    ],
    current_stage: "activation_blocked",
    review_preparation_available_now: [
      "descriptor_bundle_defined",
      "migration_artifact_reviewable",
      "snapshot_schema_verifier_available",
      "snapshot_schema_check_plan_available",
    ],
    external_manual_application_remaining: [
      "manual_migration_review",
      "manual_table_creation_or_migration_execution",
      "manual_schema_snapshot_capture",
    ],
    activation_blocked_until: activationBlockedUntil,
  }
}
