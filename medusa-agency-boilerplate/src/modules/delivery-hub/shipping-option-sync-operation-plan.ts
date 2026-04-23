import {
  DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
  DELIVERY_HUB_FULFILLMENT_PROVIDER_ID,
  type DeliveryHubFulfillmentModeCode,
  type DeliveryHubShippingOptionData,
} from "./shipping-option-contract"
import type {
  DeliveryHubIgnoredForeignOption,
  DeliveryHubOrphanedManagedOption,
  DeliveryHubShippingOptionCreateCandidate,
  DeliveryHubShippingOptionReconciliation,
  DeliveryHubShippingOptionUnchanged,
  DeliveryHubShippingOptionUpdateCandidate,
} from "./shipping-option-reconciliation"

export type DeliveryHubShippingOptionCreateOperation = {
  type: "create"
  provider_code: typeof DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE
  provider_id: typeof DELIVERY_HUB_FULFILLMENT_PROVIDER_ID
  mode_code: DeliveryHubFulfillmentModeCode
  desired: DeliveryHubShippingOptionCreateCandidate["desired"]
  target_data: DeliveryHubShippingOptionData
  supporting_connection_ids: string[]
}

export type DeliveryHubShippingOptionUpdateOperation = {
  type: "update"
  provider_code: typeof DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE
  provider_id: typeof DELIVERY_HUB_FULFILLMENT_PROVIDER_ID
  mode_code: DeliveryHubFulfillmentModeCode
  desired: DeliveryHubShippingOptionUpdateCandidate["desired"]
  current: DeliveryHubShippingOptionUpdateCandidate["current"]
  normalized_current_data: DeliveryHubShippingOptionUpdateCandidate["normalized_current_data"]
  target_data: DeliveryHubShippingOptionData
  supporting_connection_ids: string[]
  reasons: DeliveryHubShippingOptionUpdateCandidate["reasons"]
}

export type DeliveryHubShippingOptionArchiveOperation = {
  type: "archive"
  provider_code: typeof DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE
  provider_id: typeof DELIVERY_HUB_FULFILLMENT_PROVIDER_ID
  mode_code: DeliveryHubFulfillmentModeCode
  current: DeliveryHubOrphanedManagedOption["current"]
  normalized_current_data: DeliveryHubOrphanedManagedOption["normalized_current_data"]
  reason: DeliveryHubOrphanedManagedOption["reason"]
}

export type DeliveryHubShippingOptionNoop = {
  type: "noop"
  provider_code: typeof DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE
  provider_id: typeof DELIVERY_HUB_FULFILLMENT_PROVIDER_ID
  mode_code: DeliveryHubFulfillmentModeCode
  desired: DeliveryHubShippingOptionUnchanged["desired"]
  current: DeliveryHubShippingOptionUnchanged["current"]
  normalized_current_data: DeliveryHubShippingOptionUnchanged["normalized_current_data"]
  target_data: DeliveryHubShippingOptionData
  supporting_connection_ids: string[]
}

export type DeliveryHubShippingOptionSyncOperationPlanSummary = {
  create_operation_count: number
  update_operation_count: number
  archive_operation_count: number
  noop_count: number
  mutation_operation_count: number
  ignored_foreign_option_count: number
  managed_option_count: number
}

export type DeliveryHubShippingOptionSyncOperationPlan = {
  provider_code: typeof DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE
  provider_id: typeof DELIVERY_HUB_FULFILLMENT_PROVIDER_ID
  create_operations: DeliveryHubShippingOptionCreateOperation[]
  update_operations: DeliveryHubShippingOptionUpdateOperation[]
  archive_operations: DeliveryHubShippingOptionArchiveOperation[]
  noops: DeliveryHubShippingOptionNoop[]
  ignored_foreign_options: DeliveryHubIgnoredForeignOption[]
  summary: DeliveryHubShippingOptionSyncOperationPlanSummary
}

export function buildDeliveryHubShippingOptionSyncOperationPlan(
  reconciliation: DeliveryHubShippingOptionReconciliation
): DeliveryHubShippingOptionSyncOperationPlan {
  const create_operations = reconciliation.create_candidates.map((candidate) =>
    buildCreateOperation(candidate)
  )
  const update_operations = reconciliation.update_candidates.map((candidate) =>
    buildUpdateOperation(candidate)
  )
  const archive_operations = reconciliation.orphaned_managed_options.map((candidate) =>
    buildArchiveOperation(candidate)
  )
  const noops = reconciliation.unchanged.map((candidate) => buildNoop(candidate))
  const ignored_foreign_options = reconciliation.ignored_foreign_options.map((candidate) => ({
    current: candidate.current,
  }))

  return {
    provider_code: reconciliation.provider_code,
    provider_id: reconciliation.provider_id,
    create_operations,
    update_operations,
    archive_operations,
    noops,
    ignored_foreign_options,
    summary: {
      create_operation_count: create_operations.length,
      update_operation_count: update_operations.length,
      archive_operation_count: archive_operations.length,
      noop_count: noops.length,
      mutation_operation_count:
        create_operations.length + update_operations.length + archive_operations.length,
      ignored_foreign_option_count: ignored_foreign_options.length,
      managed_option_count:
        create_operations.length + update_operations.length + archive_operations.length + noops.length,
    },
  }
}

function buildCreateOperation(
  candidate: DeliveryHubShippingOptionCreateCandidate
): DeliveryHubShippingOptionCreateOperation {
  return {
    type: "create",
    provider_code: DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
    provider_id: DELIVERY_HUB_FULFILLMENT_PROVIDER_ID,
    mode_code: candidate.desired.mode_code,
    desired: candidate.desired,
    target_data: candidate.desired.data,
    supporting_connection_ids: [...candidate.desired.supporting_connection_ids],
  }
}

function buildUpdateOperation(
  candidate: DeliveryHubShippingOptionUpdateCandidate
): DeliveryHubShippingOptionUpdateOperation {
  return {
    type: "update",
    provider_code: DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
    provider_id: DELIVERY_HUB_FULFILLMENT_PROVIDER_ID,
    mode_code: candidate.desired.mode_code,
    desired: candidate.desired,
    current: candidate.current,
    normalized_current_data: candidate.normalized_current_data,
    target_data: candidate.desired.data,
    supporting_connection_ids: [...candidate.desired.supporting_connection_ids],
    reasons: [...candidate.reasons],
  }
}

function buildArchiveOperation(
  candidate: DeliveryHubOrphanedManagedOption
): DeliveryHubShippingOptionArchiveOperation {
  return {
    type: "archive",
    provider_code: DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
    provider_id: DELIVERY_HUB_FULFILLMENT_PROVIDER_ID,
    mode_code: candidate.normalized_current_data.mode_code,
    current: candidate.current,
    normalized_current_data: candidate.normalized_current_data,
    reason: candidate.reason,
  }
}

function buildNoop(candidate: DeliveryHubShippingOptionUnchanged): DeliveryHubShippingOptionNoop {
  return {
    type: "noop",
    provider_code: DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
    provider_id: DELIVERY_HUB_FULFILLMENT_PROVIDER_ID,
    mode_code: candidate.desired.mode_code,
    desired: candidate.desired,
    current: candidate.current,
    normalized_current_data: candidate.normalized_current_data,
    target_data: candidate.desired.data,
    supporting_connection_ids: [...candidate.desired.supporting_connection_ids],
  }
}
