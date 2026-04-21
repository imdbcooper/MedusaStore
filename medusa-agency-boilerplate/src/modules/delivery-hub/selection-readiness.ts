import {
  DELIVERY_HUB_CONNECTION_STATUS,
  DELIVERY_HUB_CREDENTIALS_STATE,
  DELIVERY_HUB_MODE_CODE,
} from "./constants"
import {
  DELIVERY_HUB_CART_METADATA_NAMESPACE,
  type DeliveryHubCartSelectionPublic,
  readDeliveryHubCartSelection,
} from "./cart-selection"

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

export function buildDeliveryHubStoreSelectionReadiness(input: {
  metadata?: unknown
  connection?: DeliveryHubStoreSelectionConnectionSummary | null
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

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}

function normalizeText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}
