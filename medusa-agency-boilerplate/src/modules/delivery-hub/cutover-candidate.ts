import type { DeliveryHubCartSelectionPublic } from "./cart-selection"
import { readDeliveryHubCartSelection } from "./cart-selection"
import {
  buildDeliveryHubShippingOptionData,
  buildDeliveryHubShippingOptionId,
  DELIVERY_HUB_FULFILLMENT_PROVIDER_ID,
  type DeliveryHubFulfillmentModeCode,
} from "./shipping-option-contract"
import {
  parseManagedDeliveryHubShippingOptionSnapshot,
  type DeliveryHubShippingOptionSnapshot,
} from "./shipping-option-reconciliation"

export const DELIVERY_HUB_CUTOVER_CANDIDATE_VERSION = 1

export const DELIVERY_HUB_CUTOVER_CANDIDATE_STATUSES = [
  "ready_for_review",
  "blocked",
  "selection_missing",
  "shipping_option_missing",
] as const

export type DeliveryHubCutoverCandidateStatus =
  (typeof DELIVERY_HUB_CUTOVER_CANDIDATE_STATUSES)[number]

export type DeliveryHubCutoverCandidateResponse = {
  ok: true
  version: typeof DELIVERY_HUB_CUTOVER_CANDIDATE_VERSION
  cart_id: string
  selection_present: boolean
  selection_reference_id: string | null
  candidate_status: DeliveryHubCutoverCandidateStatus
  candidate_shipping_option_id: string | null
  candidate_shipping_option_name: string | null
  candidate_amount: number | null
  currency_code: string | null
  candidate_pickup_point_id: string | null
  required_preconditions: string[]
  blocked_reasons: string[]
  can_commit_shipping_method: false
  checkout_source_of_truth: "unchanged"
  guardrails: {
    no_network_calls: true
    no_provider_payloads: true
    no_secret_material: true
    shipment_lifecycle_not_enabled: true
    can_commit_shipping_method: false
  }
}

export type DeliveryHubCutoverCandidateInput = {
  cart_id: string
  metadata?: unknown
  current_shipping_options?: DeliveryHubShippingOptionSnapshot[] | null
}

export function buildDeliveryHubCutoverCandidate(
  input: DeliveryHubCutoverCandidateInput
): DeliveryHubCutoverCandidateResponse {
  const cartId = requireNonEmptyString(input.cart_id, "cart_id")
  const selection = readDeliveryHubCartSelection(input.metadata)
  const requiredPreconditions = [
    "neutral_selection_ready",
    "matching_delivery_hub_shipping_option_present",
    "operator_approval_required",
    "can_commit_shipping_method_false",
  ]

  if (!selection) {
    return buildResponse({
      cart_id: cartId,
      selection: null,
      candidate_status: "selection_missing",
      candidate_shipping_option: null,
      blocked_reasons: [
        "selection_missing",
        "operator_approval_required",
        "can_commit_shipping_method_false",
      ],
      required_preconditions: requiredPreconditions,
    })
  }

  const matchingOption = findMatchingShippingOption(
    input.current_shipping_options ?? [],
    selection.quote_type
  )

  if (!matchingOption) {
    return buildResponse({
      cart_id: cartId,
      selection,
      candidate_status: "shipping_option_missing",
      candidate_shipping_option: null,
      blocked_reasons: [
        "matching_delivery_hub_shipping_option_missing",
        "operator_approval_required",
        "can_commit_shipping_method_false",
      ],
      required_preconditions: requiredPreconditions,
    })
  }

  return buildResponse({
    cart_id: cartId,
    selection,
    candidate_status: "ready_for_review",
    candidate_shipping_option: matchingOption,
    blocked_reasons: [
      "operator_approval_required",
      "can_commit_shipping_method_false",
    ],
    required_preconditions: requiredPreconditions,
  })
}

function buildResponse(input: {
  cart_id: string
  selection: DeliveryHubCartSelectionPublic | null
  candidate_status: DeliveryHubCutoverCandidateStatus
  candidate_shipping_option: DeliveryHubShippingOptionSnapshot | null
  required_preconditions: string[]
  blocked_reasons: string[]
}): DeliveryHubCutoverCandidateResponse {
  return {
    ok: true,
    version: DELIVERY_HUB_CUTOVER_CANDIDATE_VERSION,
    cart_id: input.cart_id,
    selection_present: !!input.selection,
    selection_reference_id: input.selection?.quote_reference.id ?? null,
    candidate_status: input.candidate_status,
    candidate_shipping_option_id: input.candidate_shipping_option?.id ?? null,
    candidate_shipping_option_name: normalizeNullableText(input.candidate_shipping_option?.name),
    candidate_amount: input.selection?.quote.customer_price?.amount ?? input.selection?.quote.amount ?? null,
    currency_code: input.selection?.quote.customer_price?.currency_code ?? input.selection?.quote.currency_code ?? null,
    candidate_pickup_point_id: input.selection?.pickup_point.provider_point_id ?? null,
    required_preconditions: [...input.required_preconditions],
    blocked_reasons: [...input.blocked_reasons],
    can_commit_shipping_method: false,
    checkout_source_of_truth: "unchanged",
    guardrails: {
      no_network_calls: true,
      no_provider_payloads: true,
      no_secret_material: true,
      shipment_lifecycle_not_enabled: true,
      can_commit_shipping_method: false,
    },
  }
}

function findMatchingShippingOption(
  shippingOptions: DeliveryHubShippingOptionSnapshot[],
  modeCode: DeliveryHubFulfillmentModeCode
) {
  const expectedData = buildDeliveryHubShippingOptionData(modeCode)
  const expectedId = buildDeliveryHubShippingOptionId(modeCode)
  const matches = shippingOptions.filter((option) => {
    const managed = parseManagedDeliveryHubShippingOptionSnapshot(option)

    if (managed) {
      return managed.normalized_data.mode_code === modeCode
    }

    return normalizeNullableText(option.id) === expectedId
  })

  return matches.sort((left, right) => {
    return scoreShippingOption(right, expectedData.id) - scoreShippingOption(left, expectedData.id)
  })[0] ?? null
}

function scoreShippingOption(option: DeliveryHubShippingOptionSnapshot, expectedId: string) {
  const managed = parseManagedDeliveryHubShippingOptionSnapshot(option)
  let score = 0

  if (normalizeNullableText(option.id) === expectedId) {
    score += 4
  }

  if (normalizeNullableText(option.provider_id) === DELIVERY_HUB_FULFILLMENT_PROVIDER_ID) {
    score += 2
  }

  if (managed?.normalized_data.id === expectedId) {
    score += 1
  }

  return score
}

function requireNonEmptyString(value: unknown, field: string) {
  if (typeof value === "string" && value.trim()) {
    return value.trim()
  }

  throw new Error(`Delivery Hub cutover candidate field "${field}" is required`)
}

function normalizeNullableText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}
