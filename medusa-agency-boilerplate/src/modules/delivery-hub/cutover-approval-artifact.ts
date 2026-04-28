import type { DeliveryHubCutoverCandidateResponse } from "./cutover-candidate"
import type { DeliveryHubCutoverPreconditionsResponse } from "./cutover-preconditions"

export const DELIVERY_HUB_CUTOVER_APPROVAL_ARTIFACT_VERSION = 1

export const DELIVERY_HUB_CUTOVER_DECISION_STATUSES = [
  "not_requested",
  "go_requested",
  "no_go",
  "approved_but_commit_disabled",
] as const

export type DeliveryHubCutoverDecisionStatus =
  (typeof DELIVERY_HUB_CUTOVER_DECISION_STATUSES)[number]

export type DeliveryHubCutoverApprovalPreconditionsSummary = {
  posture: "evidence_preflight_only"
  status: "preflight_only"
  ready_count: number
  missing_count: number
  required_count: number
  blocked_count: number
  not_enabled_count: number
  total_count: number
  required_codes: string[]
  blocked_codes: string[]
  missing_codes: string[]
  guardrails: {
    checkout_source_of_truth: "unchanged"
    no_network_calls: true
    no_provider_payloads: true
    no_secret_material: true
    shipment_lifecycle_not_enabled: true
    can_commit_shipping_method: false
  }
}

export type DeliveryHubCutoverApprovalCandidateSummary = {
  available: boolean
  candidate_status: DeliveryHubCutoverCandidateResponse["candidate_status"] | "not_requested"
  selection_present: boolean
  selection_reference_id: string | null
  candidate_shipping_option_id: string | null
  candidate_shipping_option_name: string | null
  candidate_amount: number | null
  currency_code: string | null
  candidate_pickup_point_id: string | null
  required_preconditions: string[]
  blocked_reasons: string[]
  checkout_source_of_truth: "unchanged"
  can_commit_shipping_method: false
  guardrails: {
    no_network_calls: true
    no_provider_payloads: true
    no_secret_material: true
    shipment_lifecycle_not_enabled: true
    can_commit_shipping_method: false
  }
}

export type DeliveryHubCutoverApprovalArtifact = {
  ok: true
  version: typeof DELIVERY_HUB_CUTOVER_APPROVAL_ARTIFACT_VERSION
  artifact_type: "delivery_hub_checkout_cutover_decision"
  decision_status: DeliveryHubCutoverDecisionStatus
  cart_id: string | null
  generated_at: string
  reviewer_identity_placeholder: string
  operator_identity_placeholder: string
  technical_owner_identity_placeholder: string
  preconditions_summary: DeliveryHubCutoverApprovalPreconditionsSummary
  candidate_summary: DeliveryHubCutoverApprovalCandidateSummary
  required_acknowledgements: {
    rollback_reviewed: false
    apiship_fallback_available: false
    no_secrets_logged: false
    shipment_lifecycle_not_enabled: false
    approval_does_not_enable_commit: false
  }
  required_signoffs: {
    operator: "pending"
    reviewer: "pending"
    technical_owner: "pending"
  }
  rollback_acknowledgement: {
    required: true
    statement: string
  }
  commit_controls: {
    can_commit_shipping_method: false
    requires_separate_implementation: true
    requires_feature_flag: true
    approval_is_executable: false
  }
  non_executable_notice: string
}

export type DeliveryHubCutoverApprovalArtifactInput = {
  cart_id?: string | null
  preconditions: DeliveryHubCutoverPreconditionsResponse
  candidate?: DeliveryHubCutoverCandidateResponse | null
  generated_at?: string | Date | null
  decision_status?: DeliveryHubCutoverDecisionStatus | null
}

export function buildDeliveryHubCutoverApprovalArtifact(
  input: DeliveryHubCutoverApprovalArtifactInput
): DeliveryHubCutoverApprovalArtifact {
  const preconditions = requireSafePreconditions(input.preconditions)
  const candidate = input.candidate ? requireSafeCandidate(input.candidate) : null
  const decisionStatus = input.decision_status ?? "not_requested"

  if (!DELIVERY_HUB_CUTOVER_DECISION_STATUSES.includes(decisionStatus)) {
    throw new Error("Delivery Hub cutover approval artifact decision_status is not supported")
  }

  return {
    ok: true,
    version: DELIVERY_HUB_CUTOVER_APPROVAL_ARTIFACT_VERSION,
    artifact_type: "delivery_hub_checkout_cutover_decision",
    decision_status: decisionStatus,
    cart_id: normalizeNullableText(input.cart_id),
    generated_at: normalizeGeneratedAt(input.generated_at),
    reviewer_identity_placeholder: "reviewer_identity_required_before_future_cutover",
    operator_identity_placeholder: "operator_identity_required_before_future_cutover",
    technical_owner_identity_placeholder: "technical_owner_identity_required_before_future_cutover",
    preconditions_summary: buildPreconditionsSummary(preconditions),
    candidate_summary: buildCandidateSummary(candidate),
    required_acknowledgements: {
      rollback_reviewed: false,
      apiship_fallback_available: false,
      no_secrets_logged: false,
      shipment_lifecycle_not_enabled: false,
      approval_does_not_enable_commit: false,
    },
    required_signoffs: {
      operator: "pending",
      reviewer: "pending",
      technical_owner: "pending",
    },
    rollback_acknowledgement: {
      required: true,
      statement:
        "Operator must confirm rollback/fallback keeps existing ApiShip/Medusa checkout source-of-truth available before any future executable cutover implementation.",
    },
    commit_controls: {
      can_commit_shipping_method: false,
      requires_separate_implementation: true,
      requires_feature_flag: true,
      approval_is_executable: false,
    },
    non_executable_notice:
      "Decision artifact only / no approval execution. This template records review evidence and cannot enable Delivery Hub shipping-method commit.",
  }
}

function buildPreconditionsSummary(
  preconditions: DeliveryHubCutoverPreconditionsResponse
): DeliveryHubCutoverApprovalPreconditionsSummary {
  const requiredCodes = preconditions.preconditions
    .filter((entry) => entry.status === "required")
    .map((entry) => entry.code)
  const blockedCodes = preconditions.preconditions
    .filter((entry) => entry.status === "blocked")
    .map((entry) => entry.code)
  const missingCodes = preconditions.preconditions
    .filter((entry) => entry.status === "missing")
    .map((entry) => entry.code)

  return {
    posture: "evidence_preflight_only",
    status: "preflight_only",
    ready_count: preconditions.summary.ready_count,
    missing_count: preconditions.summary.missing_count,
    required_count: preconditions.summary.required_count,
    blocked_count: preconditions.summary.blocked_count,
    not_enabled_count: preconditions.summary.not_enabled_count,
    total_count: preconditions.summary.total_count,
    required_codes: requiredCodes,
    blocked_codes: blockedCodes,
    missing_codes: missingCodes,
    guardrails: {
      checkout_source_of_truth: "unchanged",
      no_network_calls: true,
      no_provider_payloads: true,
      no_secret_material: true,
      shipment_lifecycle_not_enabled: true,
      can_commit_shipping_method: false,
    },
  }
}

function buildCandidateSummary(
  candidate: DeliveryHubCutoverCandidateResponse | null
): DeliveryHubCutoverApprovalCandidateSummary {
  if (!candidate) {
    return {
      available: false,
      candidate_status: "not_requested",
      selection_present: false,
      selection_reference_id: null,
      candidate_shipping_option_id: null,
      candidate_shipping_option_name: null,
      candidate_amount: null,
      currency_code: null,
      candidate_pickup_point_id: null,
      required_preconditions: [
        "neutral_selection_ready",
        "matching_delivery_hub_shipping_option_present",
        "operator_approval_required",
        "can_commit_shipping_method_false",
      ],
      blocked_reasons: [
        "candidate_not_requested",
        "operator_approval_required",
        "can_commit_shipping_method_false",
      ],
      checkout_source_of_truth: "unchanged",
      can_commit_shipping_method: false,
      guardrails: {
        no_network_calls: true,
        no_provider_payloads: true,
        no_secret_material: true,
        shipment_lifecycle_not_enabled: true,
        can_commit_shipping_method: false,
      },
    }
  }

  return {
    available: true,
    candidate_status: candidate.candidate_status,
    selection_present: candidate.selection_present,
    selection_reference_id: normalizeNullableText(candidate.selection_reference_id),
    candidate_shipping_option_id: normalizeNullableText(candidate.candidate_shipping_option_id),
    candidate_shipping_option_name: normalizeNullableSafeText(candidate.candidate_shipping_option_name),
    candidate_amount: candidate.candidate_amount,
    currency_code: normalizeNullableText(candidate.currency_code),
    candidate_pickup_point_id: normalizeNullableText(candidate.candidate_pickup_point_id),
    required_preconditions: [...candidate.required_preconditions],
    blocked_reasons: [...candidate.blocked_reasons],
    checkout_source_of_truth: "unchanged",
    can_commit_shipping_method: false,
    guardrails: {
      no_network_calls: true,
      no_provider_payloads: true,
      no_secret_material: true,
      shipment_lifecycle_not_enabled: true,
      can_commit_shipping_method: false,
    },
  }
}

function requireSafePreconditions(
  preconditions: DeliveryHubCutoverPreconditionsResponse
): DeliveryHubCutoverPreconditionsResponse {
  if (
    preconditions.can_commit_shipping_method ||
    preconditions.guardrails.can_commit_shipping_method ||
    preconditions.posture !== "evidence_preflight_only" ||
    preconditions.status !== "preflight_only" ||
    preconditions.guardrails.checkout_source_of_truth !== "unchanged" ||
    !preconditions.guardrails.no_network_calls ||
    !preconditions.guardrails.no_provider_payloads ||
    !preconditions.guardrails.no_secret_material ||
    !preconditions.guardrails.shipment_lifecycle_not_enabled
  ) {
    throw new Error("Delivery Hub cutover approval artifact requires safe preconditions")
  }

  return preconditions
}

function requireSafeCandidate(
  candidate: DeliveryHubCutoverCandidateResponse
): DeliveryHubCutoverCandidateResponse {
  if (
    candidate.can_commit_shipping_method ||
    candidate.guardrails.can_commit_shipping_method ||
    candidate.checkout_source_of_truth !== "unchanged" ||
    !candidate.guardrails.no_network_calls ||
    !candidate.guardrails.no_provider_payloads ||
    !candidate.guardrails.no_secret_material ||
    !candidate.guardrails.shipment_lifecycle_not_enabled
  ) {
    throw new Error("Delivery Hub cutover approval artifact requires a safe candidate")
  }

  return candidate
}

function normalizeGeneratedAt(value: string | Date | null | undefined) {
  if (value instanceof Date) {
    return value.toISOString()
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString()
    }
  }

  return new Date().toISOString()
}

function normalizeNullableText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function normalizeNullableSafeText(value: unknown) {
  const normalized = normalizeNullableText(value)
  if (!normalized) {
    return null
  }

  const lowered = normalized.toLowerCase()
  const unsafeNeedles = [
    "authorization",
    "bearer ",
    "ciphertext",
    "token=",
    "x-publishable-api-key",
    "quote_key",
    "offer_id",
    "raw provider",
  ]

  if (unsafeNeedles.some((needle) => lowered.includes(needle))) {
    throw new Error("Delivery Hub cutover approval artifact must not expose provider internals")
  }

  return normalized
}
