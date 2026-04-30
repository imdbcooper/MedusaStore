import crypto from "node:crypto"
import {
  DELIVERY_HUB_CONNECTION_STATUS,
  DELIVERY_HUB_CREDENTIALS_STATE,
  DELIVERY_HUB_MODE_CODE,
} from "./constants"
import {
  DELIVERY_HUB_CART_METADATA_NAMESPACE,
  type DeliveryHubCartSelectionPublic,
  type DeliveryHubCartSelectionValidationContext,
  readDeliveryHubCartSelection,
  readDeliveryHubCartSelectionValidationContext,
} from "./cart-selection"
import {
  buildDeliveryHubShippingOptionData,
  buildDeliveryHubShippingOptionId,
  DELIVERY_HUB_FULFILLMENT_PROVIDER_ID,
} from "./shipping-option-contract"
import { parseManagedDeliveryHubShippingOptionSnapshot } from "./shipping-option-reconciliation"

export const DELIVERY_HUB_SELECTION_QUOTE_TTL_MS = 30 * 60 * 1000

export type DeliveryHubStoreSelectionConnectionState =
  | "missing"
  | "not_found"
  | "disabled"
  | "inactive"
  | "credentials_not_ready"
  | "ready"

export type DeliveryHubStoreSelectionConnectionSummary = {
  connection_id: string | null
  state: DeliveryHubStoreSelectionConnectionState
  ready: boolean
}

export type DeliveryHubStoreSelectionReadinessStatus =
  | "missing_selection"
  | "invalid_selection"
  | "not_ready"
  | "ready"

export type DeliveryHubStoreSelectionReadinessIssueCode =
  | "selection_missing"
  | "selection_invalid"
  | "pickup_point_missing"
  | "pickup_window_missing"
  | "connection_missing"
  | "connection_not_found"
  | "connection_disabled"
  | "connection_inactive"
  | "connection_credentials_not_ready"
  | "unsupported_checkout_mode"
  | "customer_price_missing"
  | "quote_expired"
  | "cart_context_missing"
  | "cart_context_mismatch"
  | "address_context_missing"
  | "address_context_mismatch"
  | "pickup_point_mismatch"
  | "shipping_option_missing"
  | "shipping_option_mismatch"

export type DeliveryHubStoreSelectionReadinessIssue = {
  code: DeliveryHubStoreSelectionReadinessIssueCode
  message: string
  field: string | null
}

export type DeliveryHubStoreSelectionQuoteContext = {
  connection: DeliveryHubStoreSelectionConnectionSummary
  quote_type: DeliveryHubCartSelectionPublic["quote_type"]
  quote_reference: DeliveryHubCartSelectionPublic["quote_reference"]
  pickup_point_required: boolean
  pickup_window_required: boolean
  updated_at: string
}

export type DeliveryHubStoreSelectionReadinessResult = {
  status: DeliveryHubStoreSelectionReadinessStatus
  issues: DeliveryHubStoreSelectionReadinessIssue[]
  selection: DeliveryHubCartSelectionPublic | null
  quote_context: DeliveryHubStoreSelectionQuoteContext | null
}

export type DeliveryHubStoreSelectionShippingOptionSnapshot = {
  id?: string | null
  name?: string | null
  provider_id?: string | null
  data?: Record<string, unknown> | null
}

export type DeliveryHubStoreSelectionReadinessCartContext = {
  cart_id: string
  currency_code?: string | null
  subtotal?: number | null
  total?: number | null
  item_subtotal?: number | null
  shipping_address?: unknown
  items?: Array<{
    id?: string | null
    quantity?: number | null
    unit_price?: number | null
    total?: number | null
    subtotal?: number | null
    variant?: {
      id?: string | null
      sku?: string | null
      weight?: number | null
      length?: number | null
      width?: number | null
      height?: number | null
    } | null
  }> | null
}

export function hasDeliveryHubCartSelection(metadata: unknown) {
  const root = asRecord(metadata)
  const namespace = asRecord(root[DELIVERY_HUB_CART_METADATA_NAMESPACE])

  return Object.prototype.hasOwnProperty.call(namespace, "selection")
}

export function createMissingDeliveryHubSelectionConnectionSummary(
  connectionId?: string | null,
  state: Extract<
    DeliveryHubStoreSelectionConnectionState,
    "missing" | "not_found" | "disabled" | "inactive" | "credentials_not_ready"
  > = "missing"
): DeliveryHubStoreSelectionConnectionSummary {
  return {
    connection_id: normalizeText(connectionId),
    state,
    ready: false,
  }
}

export function buildDeliveryHubStoreSelectionConnectionSummary(input: {
  id: string
  enabled: boolean
  status: string
  credentials_state: string
}): DeliveryHubStoreSelectionConnectionSummary {
  const state = resolveConnectionState(input)

  return {
    connection_id: input.id,
    state,
    ready: state === "ready",
  }
}

export function buildDeliveryHubCartSelectionValidationContext(input: {
  cart: DeliveryHubStoreSelectionReadinessCartContext
  quote_expires_at?: string | Date | null
  now?: Date | string | number | null
}): DeliveryHubCartSelectionValidationContext {
  const now = normalizeDate(input.now) ?? new Date()
  const quoteExpiresAt = input.quote_expires_at
    ? normalizeDate(input.quote_expires_at)
    : new Date(now.getTime() + DELIVERY_HUB_SELECTION_QUOTE_TTL_MS)

  if (!quoteExpiresAt) {
    throw new Error("Delivery Hub quote expiration timestamp is invalid")
  }

  return {
    version: 1,
    cart_id: requireNonEmptyString(input.cart.cart_id, "cart.cart_id"),
    cart_fingerprint: createStableFingerprint(buildCartFingerprintPayload(input.cart)),
    address_fingerprint: createStableFingerprint(buildAddressFingerprintPayload(input.cart.shipping_address)),
    quote_expires_at: quoteExpiresAt.toISOString(),
  }
}

export function buildDeliveryHubStoreSelectionReadiness(input: {
  metadata?: unknown
  connection?: DeliveryHubStoreSelectionConnectionSummary | null
  cart?: DeliveryHubStoreSelectionReadinessCartContext | null
  current_shipping_options?: DeliveryHubStoreSelectionShippingOptionSnapshot[] | null
  now?: Date | string | number | null
}): DeliveryHubStoreSelectionReadinessResult {
  const selectionExists = hasDeliveryHubCartSelection(input.metadata)
  const selection = readDeliveryHubCartSelection(input.metadata)

  if (!selectionExists) {
    return {
      status: "missing_selection",
      issues: [
        {
          code: "selection_missing",
          message: "Delivery selection is not saved for this cart",
          field: "selection",
        },
      ],
      selection: null,
      quote_context: null,
    }
  }

  if (!selection) {
    return {
      status: "invalid_selection",
      issues: [
        {
          code: "selection_invalid",
          message: "Persisted delivery selection is structurally invalid",
          field: "selection",
        },
      ],
      selection: null,
      quote_context: null,
    }
  }

  const connection =
    input.connection ??
    createMissingDeliveryHubSelectionConnectionSummary(selection.connection_id, "missing")
  const issues: DeliveryHubStoreSelectionReadinessIssue[] = []
  const validationContext = readDeliveryHubCartSelectionValidationContext(input.metadata)

  if (selection.quote_type !== DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint) {
    issues.push({
      code: "unsupported_checkout_mode",
      message: "Saved delivery mode is not available in buyer checkout",
      field: "quote_type",
    })
  }

  if (!selection.quote.customer_price) {
    issues.push({
      code: "customer_price_missing",
      message: "Customer delivery price is missing for the saved selection",
      field: "quote.customer_price",
    })
  }

  if (selection.quote.pickup_point_required && !selection.pickup_point.provider_point_id) {
    issues.push({
      code: "pickup_point_missing",
      message: "Pickup point is required for the selected delivery quote",
      field: "pickup_point",
    })
  }

  if (
    selection.quote_type === DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint &&
    selection.quote.pickup_window_required &&
    !selection.pickup_window
  ) {
    issues.push({
      code: "pickup_window_missing",
      message: "Pickup window is required for the selected delivery quote",
      field: "pickup_window",
    })
  }

  appendConnectionIssues(issues, connection)
  appendValidationContextIssues(issues, {
    selection,
    validation_context: validationContext,
    cart: input.cart ?? null,
    current_shipping_options: input.current_shipping_options ?? null,
    now: input.now ?? null,
  })

  return {
    status: issues.length ? "not_ready" : "ready",
    issues,
    selection,
    quote_context: {
      connection,
      quote_type: selection.quote_type,
      quote_reference: selection.quote_reference,
      pickup_point_required: selection.quote.pickup_point_required,
      pickup_window_required: selection.quote.pickup_window_required,
      updated_at: selection.updated_at,
    },
  }
}

function appendValidationContextIssues(
  issues: DeliveryHubStoreSelectionReadinessIssue[],
  input: {
    selection: DeliveryHubCartSelectionPublic
    validation_context: DeliveryHubCartSelectionValidationContext | null
    cart: DeliveryHubStoreSelectionReadinessCartContext | null
    current_shipping_options: DeliveryHubStoreSelectionShippingOptionSnapshot[] | null
    now: Date | string | number | null
  }
) {
  if (!input.validation_context) {
    issues.push({
      code: "cart_context_missing",
      message: "Saved delivery selection needs refreshed cart validation context",
      field: "validation_context",
    })
    return
  }

  const quoteExpiresAt = normalizeDate(input.validation_context.quote_expires_at)
  const now = normalizeDate(input.now) ?? new Date()

  if (!quoteExpiresAt || quoteExpiresAt.getTime() <= now.getTime()) {
    issues.push({
      code: "quote_expired",
      message: "Saved delivery price has expired and must be refreshed",
      field: "validation_context.quote_expires_at",
    })
  }

  if (!input.cart) {
    issues.push({
      code: "cart_context_missing",
      message: "Current cart context is required to validate saved delivery",
      field: "cart",
    })
    return
  }

  if (input.validation_context.cart_id !== input.cart.cart_id) {
    issues.push({
      code: "cart_context_mismatch",
      message: "Saved delivery selection belongs to a different cart",
      field: "validation_context.cart_id",
    })
  }

  if (
    input.validation_context.cart_fingerprint !==
    createStableFingerprint(buildCartFingerprintPayload(input.cart))
  ) {
    issues.push({
      code: "cart_context_mismatch",
      message: "Cart contents changed after delivery was saved",
      field: "validation_context.cart_fingerprint",
    })
  }

  if (!input.cart.shipping_address) {
    issues.push({
      code: "address_context_missing",
      message: "Shipping address is required to validate saved delivery",
      field: "shipping_address",
    })
  } else if (
    input.validation_context.address_fingerprint !==
    createStableFingerprint(buildAddressFingerprintPayload(input.cart.shipping_address))
  ) {
    issues.push({
      code: "address_context_mismatch",
      message: "Shipping address changed after delivery was saved",
      field: "validation_context.address_fingerprint",
    })
  }

  if (!input.selection.pickup_point.is_destination_pickup_allowed) {
    issues.push({
      code: "pickup_point_mismatch",
      message: "Saved pickup point is no longer available for receiving orders",
      field: "pickup_point",
    })
  }

  appendShippingOptionIssues(issues, input.selection, input.current_shipping_options)
}

function appendShippingOptionIssues(
  issues: DeliveryHubStoreSelectionReadinessIssue[],
  selection: DeliveryHubCartSelectionPublic,
  shippingOptions: DeliveryHubStoreSelectionShippingOptionSnapshot[] | null
) {
  if (!shippingOptions) {
    issues.push({
      code: "shipping_option_missing",
      message: "Delivery shipping option context is required before payment",
      field: "shipping_option",
    })
    return
  }

  const expectedId = buildDeliveryHubShippingOptionId(selection.quote_type)
  const expectedData = buildDeliveryHubShippingOptionData(selection.quote_type)
  const matchingOption = shippingOptions.find((option) => {
    const managed = parseManagedDeliveryHubShippingOptionSnapshot({
      id: normalizeText(option.id) ?? "",
      name: normalizeText(option.name),
      provider_id: normalizeText(option.provider_id),
      data: option.data ?? null,
    })

    if (managed) {
      return managed.normalized_data.mode_code === selection.quote_type
    }

    return normalizeText(option.id) === expectedId
  })

  if (!matchingOption) {
    issues.push({
      code: "shipping_option_missing",
      message: "Delivery Hub shipping option is not available for the saved selection",
      field: "shipping_option",
    })
    return
  }

  const optionData = matchingOption.data ?? null
  const optionDataId = normalizeText(optionData?.id)
  const providerCode = normalizeText(optionData?.provider_code)
  const providerId = normalizeText(matchingOption.provider_id)
  const optionId = normalizeText(matchingOption.id)
  const modeCode = normalizeText(optionData?.mode_code) ?? optionDataId?.replace(/^deliveryhub:/, "")
  const looksDeliveryHub =
    optionId === expectedId ||
    optionDataId === expectedData.id ||
    providerId === DELIVERY_HUB_FULFILLMENT_PROVIDER_ID ||
    providerCode === expectedData.provider_code

  if (!looksDeliveryHub || modeCode !== selection.quote_type) {
    issues.push({
      code: "shipping_option_mismatch",
      message: "Delivery Hub shipping option does not match the saved selection",
      field: "shipping_option",
    })
  }
}

function appendConnectionIssues(
  issues: DeliveryHubStoreSelectionReadinessIssue[],
  connection: DeliveryHubStoreSelectionConnectionSummary
) {
  switch (connection.state) {
    case "ready":
      return
    case "missing":
      issues.push({
        code: "connection_missing",
        message: "Delivery connection reference is missing for the saved selection",
        field: "connection_id",
      })
      return
    case "not_found":
      issues.push({
        code: "connection_not_found",
        message: "Delivery connection referenced by the saved selection was not found",
        field: "connection_id",
      })
      return
    case "disabled":
      issues.push({
        code: "connection_disabled",
        message: "Delivery connection is disabled for shopper-facing use",
        field: "connection_id",
      })
      return
    case "inactive":
      issues.push({
        code: "connection_inactive",
        message: "Delivery connection is not active for shopper-facing use",
        field: "connection_id",
      })
      return
    case "credentials_not_ready":
      issues.push({
        code: "connection_credentials_not_ready",
        message: "Delivery connection credentials are not ready for shopper-facing use",
        field: "connection_id",
      })
      return
  }
}

function resolveConnectionState(input: {
  enabled: boolean
  status: string
  credentials_state: string
}): DeliveryHubStoreSelectionConnectionState {
  if (!input.enabled) {
    return "disabled"
  }

  if (normalizeText(input.status) !== DELIVERY_HUB_CONNECTION_STATUS.active) {
    return "inactive"
  }

  if (normalizeText(input.credentials_state) !== DELIVERY_HUB_CREDENTIALS_STATE.sealed) {
    return "credentials_not_ready"
  }

  return "ready"
}

function buildCartFingerprintPayload(cart: DeliveryHubStoreSelectionReadinessCartContext) {
  return {
    currency_code: normalizeText(cart.currency_code),
    subtotal: normalizeNumber(cart.subtotal),
    total: normalizeNumber(cart.total),
    item_subtotal: normalizeNumber(cart.item_subtotal),
    items: (cart.items ?? [])
      .map((item) => ({
        id: normalizeText(item.id),
        quantity: normalizeNumber(item.quantity),
        unit_price: normalizeNumber(item.unit_price),
        total: normalizeNumber(item.total),
        subtotal: normalizeNumber(item.subtotal),
        variant_id: normalizeText(item.variant?.id),
        sku: normalizeText(item.variant?.sku),
        weight: normalizeNumber(item.variant?.weight),
        length: normalizeNumber(item.variant?.length),
        width: normalizeNumber(item.variant?.width),
        height: normalizeNumber(item.variant?.height),
      }))
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
  }
}

function buildAddressFingerprintPayload(address: unknown) {
  const record = asRecord(address)

  return {
    country_code: normalizeText(record.country_code)?.toUpperCase() ?? null,
    city: normalizeComparableText(record.city),
    province: normalizeComparableText(record.province),
    postal_code: normalizeComparableText(record.postal_code),
    address_1: normalizeComparableText(record.address_1),
    address_2: normalizeComparableText(record.address_2),
    phone: normalizeComparableText(record.phone),
  }
}

function createStableFingerprint(value: unknown) {
  return crypto
    .createHash("sha256")
    .update(stableStringify(value))
    .digest("hex")
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(",")}}`
  }

  return JSON.stringify(value)
}

function normalizeDate(value: Date | string | number | null | undefined) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }

  return null
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}

function requireNonEmptyString(value: unknown, field: string) {
  const normalized = normalizeText(value)

  if (normalized) {
    return normalized
  }

  throw new Error(`Delivery Hub selection readiness field "${field}" is required`)
}

function normalizeText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function normalizeComparableText(value: unknown) {
  return normalizeText(value)?.toLowerCase().replace(/\s+/g, " ") ?? null
}

function normalizeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}
