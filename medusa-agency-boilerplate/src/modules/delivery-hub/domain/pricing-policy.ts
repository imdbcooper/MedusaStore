export const DELIVERY_HUB_CUSTOMER_PRICE_SOURCES = [
  "fixed",
  "free_threshold",
  "free",
  "provider_quote",
  "provider_quote_markup",
  "manual",
] as const

export type DeliveryHubCustomerPriceSource =
  (typeof DELIVERY_HUB_CUSTOMER_PRICE_SOURCES)[number]

export type DeliveryHubRoundingMode = "none" | "ceil" | "floor" | "round"

export type DeliveryHubCustomerPrice = {
  amount: number
  currency_code: string
  source: DeliveryHubCustomerPriceSource
  policy_id: string | null
}

export type DeliveryHubProviderQuoteEvidence = {
  amount: number | null
  currency_code: string | null
  carrier_code: string | null
  quote_key_present: boolean
}

export type DeliveryHubPricingPolicyUnavailableResult = {
  available: false
  code: "pricing_policy_unavailable"
  message: string
  policy_id: string | null
}

export type DeliveryHubPricingPolicyAvailableResult = {
  available: true
  customer_price: DeliveryHubCustomerPrice
}

export type DeliveryHubPricingPolicyResult =
  | DeliveryHubPricingPolicyAvailableResult
  | DeliveryHubPricingPolicyUnavailableResult

export type DeliveryHubPricingPolicyEvaluationInput = {
  provider_quote: DeliveryHubProviderQuoteEvidence
  currency_code?: string | null
  cart_subtotal?: number | null
  config?: Record<string, unknown> | null
}

type NormalizedPricingPolicy = {
  id: string | null
  type:
    | "fixed"
    | "free_threshold"
    | "free"
    | "provider_pass_through"
    | "provider_quote_markup"
    | "unavailable"
  amount: number | null
  currency_code: string | null
  threshold_amount: number | null
  below_threshold_amount: number | null
  markup_amount: number
  markup_percent: number
  rounding: {
    mode: DeliveryHubRoundingMode
    increment: number
  }
}

const DEFAULT_POLICY_ID = "delivery_hub_safe_default_provider_pass_through"
const DEFAULT_ROUNDING_INCREMENT = 1

export function evaluateDeliveryHubCustomerPricingPolicy(
  input: DeliveryHubPricingPolicyEvaluationInput
): DeliveryHubPricingPolicyResult {
  const policy = normalizeDeliveryHubPricingPolicy(input.config)
  const currencyCode = normalizeCurrencyCode(
    policy.currency_code ?? input.currency_code ?? input.provider_quote.currency_code
  )
  const providerAmount = normalizeFiniteNumber(input.provider_quote.amount)
  const cartSubtotal = normalizeFiniteNumber(input.cart_subtotal)

  if (policy.type === "unavailable") {
    return unavailable(policy.id, "Delivery Hub customer pricing policy is unavailable.")
  }

  if (!currencyCode) {
    return unavailable(policy.id, "Delivery Hub customer pricing requires a currency code.")
  }

  if (policy.type === "free") {
    return available(0, currencyCode, "free", policy.id, policy.rounding)
  }

  if (policy.type === "fixed") {
    if (policy.amount === null) {
      return unavailable(policy.id, "Delivery Hub fixed pricing policy requires amount.")
    }

    return available(policy.amount, currencyCode, "fixed", policy.id, policy.rounding)
  }

  if (policy.type === "free_threshold") {
    if (policy.threshold_amount === null) {
      return unavailable(policy.id, "Delivery Hub free-threshold pricing policy requires threshold_amount.")
    }

    if (cartSubtotal !== null && cartSubtotal >= policy.threshold_amount) {
      return available(0, currencyCode, "free_threshold", policy.id, policy.rounding)
    }

    if (policy.below_threshold_amount !== null) {
      return available(
        policy.below_threshold_amount,
        currencyCode,
        "fixed",
        policy.id,
        policy.rounding
      )
    }

    if (providerAmount !== null) {
      return available(
        providerAmount,
        currencyCode,
        "provider_quote",
        policy.id,
        policy.rounding
      )
    }

    return unavailable(
      policy.id,
      "Delivery Hub free-threshold pricing policy requires below_threshold_amount or provider quote below threshold."
    )
  }

  if (providerAmount === null) {
    return unavailable(policy.id, "Delivery Hub provider quote is unavailable for customer pricing.")
  }

  if (policy.type === "provider_quote_markup") {
    const markedUpAmount = providerAmount + policy.markup_amount + providerAmount * policy.markup_percent / 100

    return available(
      markedUpAmount,
      currencyCode,
      "provider_quote_markup",
      policy.id,
      policy.rounding
    )
  }

  return available(
    providerAmount,
    currencyCode,
    "provider_quote",
    policy.id,
    policy.rounding
  )
}

function normalizeDeliveryHubPricingPolicy(
  config?: Record<string, unknown> | null
): NormalizedPricingPolicy {
  const rawPolicy = asRecord(
    config?.customer_pricing_policy ??
      config?.pricing_policy ??
      config?.delivery_pricing_policy
  )
  const type = normalizePolicyType(rawPolicy.type ?? rawPolicy.source)

  return {
    id: normalizeText(rawPolicy.id ?? rawPolicy.policy_id) ?? DEFAULT_POLICY_ID,
    type,
    amount: normalizeFiniteNumber(rawPolicy.amount ?? rawPolicy.fixed_amount),
    currency_code: normalizeCurrencyCode(rawPolicy.currency_code),
    threshold_amount: normalizeFiniteNumber(
      rawPolicy.threshold_amount ?? rawPolicy.free_threshold_amount
    ),
    below_threshold_amount: normalizeFiniteNumber(
      rawPolicy.below_threshold_amount ?? rawPolicy.amount_below_threshold
    ),
    markup_amount: normalizeFiniteNumber(rawPolicy.markup_amount) ?? 0,
    markup_percent: normalizeFiniteNumber(rawPolicy.markup_percent) ?? 0,
    rounding: normalizeRounding(rawPolicy.rounding),
  }
}

function normalizePolicyType(value: unknown): NormalizedPricingPolicy["type"] {
  const normalized = normalizeText(value)?.toLowerCase().replaceAll("-", "_") ?? null

  if (!normalized) {
    return "provider_pass_through"
  }

  if (normalized === "fixed") {
    return "fixed"
  }

  if (normalized === "free_threshold") {
    return "free_threshold"
  }

  if (normalized === "free") {
    return "free"
  }

  if (normalized === "provider_pass_through" || normalized === "provider_quote") {
    return "provider_pass_through"
  }

  if (normalized === "provider_quote_markup" || normalized === "markup") {
    return "provider_quote_markup"
  }

  if (normalized === "unavailable" || normalized === "fail_closed") {
    return "unavailable"
  }

  return "unavailable"
}

function normalizeRounding(value: unknown): NormalizedPricingPolicy["rounding"] {
  const record = asRecord(value)
  const mode = normalizeRoundingMode(record.mode)
  const increment = normalizeFiniteNumber(record.increment) ?? DEFAULT_ROUNDING_INCREMENT

  return {
    mode,
    increment: increment > 0 ? increment : DEFAULT_ROUNDING_INCREMENT,
  }
}

function normalizeRoundingMode(value: unknown): DeliveryHubRoundingMode {
  const normalized = normalizeText(value)

  if (
    normalized === "ceil" ||
    normalized === "floor" ||
    normalized === "round" ||
    normalized === "none"
  ) {
    return normalized
  }

  return "round"
}

function applyRounding(amount: number, rounding: NormalizedPricingPolicy["rounding"]) {
  if (rounding.mode === "none") {
    return amount
  }

  const quotient = amount / rounding.increment
  const rounded = rounding.mode === "ceil"
    ? Math.ceil(quotient)
    : rounding.mode === "floor"
      ? Math.floor(quotient)
      : Math.round(quotient)

  return rounded * rounding.increment
}

function available(
  amount: number,
  currencyCode: string,
  source: DeliveryHubCustomerPriceSource,
  policyId: string | null,
  rounding: NormalizedPricingPolicy["rounding"]
): DeliveryHubPricingPolicyAvailableResult {
  return {
    available: true,
    customer_price: {
      amount: Math.max(0, applyRounding(amount, rounding)),
      currency_code: currencyCode,
      source,
      policy_id: policyId,
    },
  }
}

function unavailable(
  policyId: string | null,
  message: string
): DeliveryHubPricingPolicyUnavailableResult {
  return {
    available: false,
    code: "pricing_policy_unavailable",
    message,
    policy_id: policyId,
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function normalizeText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function normalizeCurrencyCode(value: unknown) {
  const normalized = normalizeText(value)

  return normalized ? normalized.toUpperCase() : null
}

function normalizeFiniteNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)

    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}
