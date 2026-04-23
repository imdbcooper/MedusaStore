import { isDeepStrictEqual } from "node:util"
import type { DeliveryHubProjectedShippingOption } from "./shipping-option-planner"
import {
  DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
  DELIVERY_HUB_FULFILLMENT_PROVIDER_ID,
  normalizeDeliveryHubShippingOptionData,
  type DeliveryHubShippingOptionData,
  type DeliveryHubShippingOptionId,
} from "./shipping-option-contract"

export type DeliveryHubShippingOptionSnapshot = {
  id: string
  name?: string | null
  provider_id?: string | null
  data?: Record<string, unknown> | null
}

export type DeliveryHubManagedShippingOptionSnapshot = {
  shipping_option: DeliveryHubShippingOptionSnapshot
  normalized_data: DeliveryHubShippingOptionData
}

export type DeliveryHubShippingOptionUpdateCandidateReason =
  | "provider_id_mismatch"
  | "metadata_mismatch"
  | "duplicate_managed_option"

export type DeliveryHubOrphanedManagedOptionReason =
  | "missing_desired_projection"
  | "duplicate_managed_option"

export type DeliveryHubShippingOptionCreateCandidate = {
  desired: DeliveryHubProjectedShippingOption
}

export type DeliveryHubShippingOptionUpdateCandidate = {
  desired: DeliveryHubProjectedShippingOption
  current: DeliveryHubShippingOptionSnapshot
  normalized_current_data: DeliveryHubShippingOptionData
  reasons: DeliveryHubShippingOptionUpdateCandidateReason[]
}

export type DeliveryHubShippingOptionUnchanged = {
  desired: DeliveryHubProjectedShippingOption
  current: DeliveryHubShippingOptionSnapshot
  normalized_current_data: DeliveryHubShippingOptionData
}

export type DeliveryHubOrphanedManagedOption = {
  current: DeliveryHubShippingOptionSnapshot
  normalized_current_data: DeliveryHubShippingOptionData
  reason: DeliveryHubOrphanedManagedOptionReason
}

export type DeliveryHubIgnoredForeignOption = {
  current: DeliveryHubShippingOptionSnapshot
}

export type DeliveryHubShippingOptionReconciliation = {
  provider_code: typeof DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE
  provider_id: typeof DELIVERY_HUB_FULFILLMENT_PROVIDER_ID
  create_candidates: DeliveryHubShippingOptionCreateCandidate[]
  update_candidates: DeliveryHubShippingOptionUpdateCandidate[]
  unchanged: DeliveryHubShippingOptionUnchanged[]
  orphaned_managed_options: DeliveryHubOrphanedManagedOption[]
  ignored_foreign_options: DeliveryHubIgnoredForeignOption[]
}

export function reconcileDeliveryHubShippingOptions(input: {
  desired_options: readonly DeliveryHubProjectedShippingOption[]
  current_options: readonly DeliveryHubShippingOptionSnapshot[]
}): DeliveryHubShippingOptionReconciliation {
  const managedByDesiredId = new Map<
    DeliveryHubShippingOptionId,
    DeliveryHubManagedShippingOptionSnapshot[]
  >()
  const ignored_foreign_options: DeliveryHubIgnoredForeignOption[] = []

  for (const shippingOption of input.current_options) {
    const managed = parseManagedDeliveryHubShippingOptionSnapshot(shippingOption)

    if (!managed) {
      ignored_foreign_options.push({
        current: shippingOption,
      })
      continue
    }

    const matches = managedByDesiredId.get(managed.normalized_data.id) ?? []
    matches.push(managed)
    managedByDesiredId.set(managed.normalized_data.id, matches)
  }

  const consumedCurrentOptionIds = new Set<string>()
  const create_candidates: DeliveryHubShippingOptionCreateCandidate[] = []
  const update_candidates: DeliveryHubShippingOptionUpdateCandidate[] = []
  const unchanged: DeliveryHubShippingOptionUnchanged[] = []
  const orphaned_managed_options: DeliveryHubOrphanedManagedOption[] = []

  for (const desired of input.desired_options) {
    const matches = managedByDesiredId.get(desired.data.id) ?? []

    if (!matches.length) {
      create_candidates.push({ desired })
      continue
    }

    const primaryMatch = selectPrimaryManagedOption(desired, matches)
    const duplicateMatches = matches.filter(
      (candidate) => candidate.shipping_option.id !== primaryMatch.shipping_option.id
    )

    consumedCurrentOptionIds.add(primaryMatch.shipping_option.id)

    for (const duplicate of duplicateMatches) {
      consumedCurrentOptionIds.add(duplicate.shipping_option.id)
      orphaned_managed_options.push({
        current: duplicate.shipping_option,
        normalized_current_data: duplicate.normalized_data,
        reason: "duplicate_managed_option",
      })
    }

    const reasons: DeliveryHubShippingOptionUpdateCandidateReason[] = []

    if (normalizeNullableText(primaryMatch.shipping_option.provider_id) !== DELIVERY_HUB_FULFILLMENT_PROVIDER_ID) {
      reasons.push("provider_id_mismatch")
    }

    if (!isCanonicalManagedShippingOptionMetadata(primaryMatch.shipping_option, desired.data)) {
      reasons.push("metadata_mismatch")
    }

    if (duplicateMatches.length) {
      reasons.push("duplicate_managed_option")
    }

    if (reasons.length) {
      update_candidates.push({
        desired,
        current: primaryMatch.shipping_option,
        normalized_current_data: primaryMatch.normalized_data,
        reasons,
      })
      continue
    }

    unchanged.push({
      desired,
      current: primaryMatch.shipping_option,
      normalized_current_data: primaryMatch.normalized_data,
    })
  }

  for (const matches of managedByDesiredId.values()) {
    for (const managed of matches) {
      if (consumedCurrentOptionIds.has(managed.shipping_option.id)) {
        continue
      }

      orphaned_managed_options.push({
        current: managed.shipping_option,
        normalized_current_data: managed.normalized_data,
        reason: "missing_desired_projection",
      })
    }
  }

  return {
    provider_code: DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
    provider_id: DELIVERY_HUB_FULFILLMENT_PROVIDER_ID,
    create_candidates,
    update_candidates,
    unchanged,
    orphaned_managed_options,
    ignored_foreign_options,
  }
}

export function parseManagedDeliveryHubShippingOptionSnapshot(
  shippingOption: DeliveryHubShippingOptionSnapshot
): DeliveryHubManagedShippingOptionSnapshot | null {
  try {
    return {
      shipping_option: shippingOption,
      normalized_data: normalizeDeliveryHubShippingOptionData(shippingOption.data ?? undefined),
    }
  } catch {
    return null
  }
}

export function isManagedDeliveryHubShippingOptionSnapshot(
  shippingOption: DeliveryHubShippingOptionSnapshot
) {
  return !!parseManagedDeliveryHubShippingOptionSnapshot(shippingOption)
}

function selectPrimaryManagedOption(
  desired: DeliveryHubProjectedShippingOption,
  candidates: readonly DeliveryHubManagedShippingOptionSnapshot[]
) {
  const ranked = [...candidates].sort((left, right) => {
    return scoreManagedOptionCandidate(right, desired) - scoreManagedOptionCandidate(left, desired)
  })

  return ranked[0]
}

function scoreManagedOptionCandidate(
  candidate: DeliveryHubManagedShippingOptionSnapshot,
  desired: DeliveryHubProjectedShippingOption
) {
  let score = 0

  if (normalizeNullableText(candidate.shipping_option.provider_id) === DELIVERY_HUB_FULFILLMENT_PROVIDER_ID) {
    score += 2
  }

  if (isCanonicalManagedShippingOptionMetadata(candidate.shipping_option, desired.data)) {
    score += 1
  }

  return score
}

function isCanonicalManagedShippingOptionMetadata(
  shippingOption: DeliveryHubShippingOptionSnapshot,
  desiredData: DeliveryHubShippingOptionData
) {
  return isDeepStrictEqual(asRecord(shippingOption.data), desiredData)
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}

function normalizeNullableText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}
