export const DELIVERY_HUB_PREVIEW_QUOTE_TYPES = [
  "warehouse_to_pickup_point",
  "dropoff_point_to_pickup_point",
] as const

export const DELIVERY_HUB_PREVIEW_CONNECTION_STATES = [
  "missing",
  "not_found",
  "disabled",
  "inactive",
  "credentials_not_ready",
  "ready",
] as const

export const DELIVERY_HUB_PREVIEW_SELECTION_READINESS_STATUSES = [
  "missing_selection",
  "invalid_selection",
  "not_ready",
  "ready",
] as const

export const DELIVERY_HUB_PREVIEW_SELECTION_READINESS_ISSUE_CODES = [
  "selection_missing",
  "selection_invalid",
  "pickup_point_missing",
  "pickup_window_missing",
  "connection_missing",
  "connection_not_found",
  "connection_disabled",
  "connection_inactive",
  "connection_credentials_not_ready",
] as const

export type DeliveryHubPreviewQuoteType =
  (typeof DELIVERY_HUB_PREVIEW_QUOTE_TYPES)[number]

export type DeliveryHubPreviewConnectionState =
  (typeof DELIVERY_HUB_PREVIEW_CONNECTION_STATES)[number]

export type DeliveryHubPreviewSelectionReadinessStatus =
  (typeof DELIVERY_HUB_PREVIEW_SELECTION_READINESS_STATUSES)[number]

export type DeliveryHubPreviewSelectionReadinessIssueCode =
  (typeof DELIVERY_HUB_PREVIEW_SELECTION_READINESS_ISSUE_CODES)[number]

export type DeliveryHubPreviewQuoteReference = {
  id: string
  version: number
}

export type DeliveryHubPreviewCustomerPrice = {
  amount: number
  currency_code: string
  source: "fixed" | "free_threshold" | "free" | "provider_quote" | "provider_quote_markup" | "manual"
  policy_id: string | null
}

export type DeliveryHubPreviewSelectionQuoteSummary = {
  carrier_code: string
  carrier_label: string
  amount: number
  currency_code: string
  customer_price?: DeliveryHubPreviewCustomerPrice
  delivery_eta_min: number | null
  delivery_eta_max: number | null
  pickup_point_required: boolean
  pickup_window_required: boolean
}

export type DeliveryHubPreviewPickupPoint = {
  provider_point_id: string
  provider_point_code: string | null
  name: string
  address: string
  city: string | null
  region: string | null
  postal_code: string | null
  lat: number | null
  lng: number | null
  is_origin_dropoff_allowed: boolean
  is_destination_pickup_allowed: boolean
  payment_methods: string[]
}

export type DeliveryHubPreviewIntervalUtc = {
  from: string
  to: string
}

export type DeliveryHubPreviewPickupWindow = {
  date: string
  time_from: string | null
  time_to: string | null
  interval_utc: DeliveryHubPreviewIntervalUtc
  label: string
}

export type DeliveryHubPreviewSelection = {
  version: number
  connection_id: string
  quote_type: DeliveryHubPreviewQuoteType
  quote_reference: DeliveryHubPreviewQuoteReference
  quote: DeliveryHubPreviewSelectionQuoteSummary
  pickup_point: DeliveryHubPreviewPickupPoint
  pickup_window: DeliveryHubPreviewPickupWindow | null
  updated_at: string
}

export type DeliveryHubPreviewSelectionConnectionSummary = {
  connection_id: string | null
  state: DeliveryHubPreviewConnectionState
  ready: boolean
}

export type DeliveryHubPreviewSelectionReadinessIssue = {
  code: DeliveryHubPreviewSelectionReadinessIssueCode
  message: string
  field: string | null
}

export type DeliveryHubPreviewSelectionQuoteContext = {
  connection: DeliveryHubPreviewSelectionConnectionSummary
  quote_type: DeliveryHubPreviewQuoteType
  quote_reference: DeliveryHubPreviewQuoteReference
  pickup_point_required: boolean
  pickup_window_required: boolean
  updated_at: string
}

export type DeliveryHubReadinessResponse = {
  ok: true
  cart_id: string
  status: DeliveryHubPreviewSelectionReadinessStatus
  issues: DeliveryHubPreviewSelectionReadinessIssue[]
  selection: DeliveryHubPreviewSelection | null
  quote_context: DeliveryHubPreviewSelectionQuoteContext | null
}

export type DeliveryHubReadinessPreviewModel = {
  tone: "neutral" | "positive" | "warning"
  status_label: string
  connection_label: string | null
  quote_type_label: string | null
  issue_messages: string[]
  updated_at: string | null
}

export type DeliveryHubSummaryPreviewModel = {
  tone: "neutral" | "positive" | "warning"
  status_label: string
  modality_label: string | null
  issue_messages: string[]
  updated_at: string | null
}

export function isDeliveryHubSelectionReady(
  readiness: Pick<DeliveryHubReadinessResponse, "status"> | null | undefined
) {
  return readiness?.status === "ready"
}

export function hasDeliveryHubSelectionIssues(
  readiness: Pick<DeliveryHubReadinessResponse, "issues"> | null | undefined
) {
  return !!readiness?.issues?.length
}

export function getDeliveryHubReadinessStatusLabel(
  status: DeliveryHubPreviewSelectionReadinessStatus
) {
  switch (status) {
    case "missing_selection":
      return "Selection missing"
    case "invalid_selection":
      return "Selection invalid"
    case "not_ready":
      return "Selection not ready"
    case "ready":
      return "Selection ready"
  }
}

export function getDeliveryHubQuoteTypeLabel(
  quoteType: DeliveryHubPreviewQuoteType | null | undefined
) {
  switch (quoteType) {
    case "warehouse_to_pickup_point":
      return "Warehouse → pickup point"
    case "dropoff_point_to_pickup_point":
      return "Dropoff point → pickup point"
    default:
      return null
  }
}

export function buildDeliveryHubReadinessPreviewModel(
  readiness: DeliveryHubReadinessResponse | null | undefined
): DeliveryHubReadinessPreviewModel {
  if (!readiness) {
    return {
      tone: "neutral",
      status_label: "Readiness unavailable",
      connection_label: null,
      quote_type_label: null,
      issue_messages: [],
      updated_at: null,
    }
  }

  return {
    tone:
      readiness.status === "ready"
        ? "positive"
        : readiness.issues.length > 0 || readiness.status !== "missing_selection"
          ? "warning"
          : "neutral",
    status_label: getDeliveryHubReadinessStatusLabel(readiness.status),
    connection_label:
      readiness.quote_context?.connection.connection_id ??
      readiness.selection?.connection_id ??
      null,
    quote_type_label: getDeliveryHubQuoteTypeLabel(
      readiness.selection?.quote_type ?? readiness.quote_context?.quote_type ?? null
    ),
    issue_messages: readiness.issues.map((issue) => issue.message),
    updated_at: readiness.selection?.updated_at ?? readiness.quote_context?.updated_at ?? null,
  }
}

export function buildDeliveryHubSummaryPreviewModel(
  readiness: DeliveryHubReadinessResponse | null | undefined
): DeliveryHubSummaryPreviewModel {
  const preview = buildDeliveryHubReadinessPreviewModel(readiness)

  return {
    tone: preview.tone,
    status_label: preview.status_label,
    modality_label: preview.quote_type_label,
    issue_messages: preview.issue_messages,
    updated_at: preview.updated_at,
  }
}
