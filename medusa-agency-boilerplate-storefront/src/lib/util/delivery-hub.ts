export const DELIVERY_HUB_QUOTE_TYPES = [
  "warehouse_to_pickup_point",
  "dropoff_point_to_pickup_point",
] as const

export const DELIVERY_HUB_CONNECTION_STATES = [
  "missing",
  "not_found",
  "disabled",
  "inactive",
  "credentials_not_ready",
  "ready",
] as const

export const DELIVERY_HUB_SELECTION_READINESS_STATUSES = [
  "missing_selection",
  "invalid_selection",
  "not_ready",
  "ready",
] as const

export const DELIVERY_HUB_SELECTION_READINESS_ISSUE_CODES = [
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

export type DeliveryHubQuoteType = (typeof DELIVERY_HUB_QUOTE_TYPES)[number]

export type DeliveryHubConnectionState =
  | "missing"
  | "not_found"
  | "disabled"
  | "inactive"
  | "credentials_not_ready"
  | "ready"

export type DeliveryHubSelectionReadinessStatus =
  | "missing_selection"
  | "invalid_selection"
  | "not_ready"
  | "ready"

export type DeliveryHubSelectionReadinessIssueCode =
  | "selection_missing"
  | "selection_invalid"
  | "pickup_point_missing"
  | "pickup_window_missing"
  | "connection_missing"
  | "connection_not_found"
  | "connection_disabled"
  | "connection_inactive"
  | "connection_credentials_not_ready"

export type DeliveryHubIntervalUtc = {
  from: string
  to: string
}

export type DeliveryHubQuoteRequestItem = {
  quantity?: number
  weight_grams?: number
  price?: number
}

export type DeliveryHubCatalogConnection = {
  connection_id: string
  label: string
  state: DeliveryHubConnectionState
  ready: boolean
  quote_types: DeliveryHubQuoteType[]
  supports_pickup_points: boolean
  supports_pickup_windows: boolean
  supports_dropoff: boolean
}

export type DeliveryHubCatalogResponse = {
  ok: true
  default_connection_id: string | null
  connections: DeliveryHubCatalogConnection[]
}

export type DeliveryHubStoreSettingsStatus =
  | "unavailable"
  | "informational_only"
  | "available"

export type DeliveryHubStoreSettingsPreviewVisibility = {
  shadow_settings: boolean
  readiness: boolean
  persisted_selection: boolean
  shadow_catalog: boolean
  shadow_pickup_points: boolean
  shadow_quotes: boolean
  shadow_pickup_windows: boolean
}

export type DeliveryHubStoreSettingsResponse = {
  ok: true
  settings: {
    enabled: boolean
    status: DeliveryHubStoreSettingsStatus
    summary: {
      enabled_connection_count: number
      ready_connection_count: number
      default_connection_label: string | null
      modality_codes: DeliveryHubQuoteType[]
      supports_pickup_points: boolean
      supports_pickup_windows: boolean
      supports_dropoff: boolean
    }
    preview_visibility: DeliveryHubStoreSettingsPreviewVisibility
    hints: string[]
  }
}

export type DeliveryHubQuoteReference = {
  id: string
  version: number
}

export type DeliveryHubQuote = {
  carrier_code: string
  carrier_label: string
  mode_code: DeliveryHubQuoteType
  quote_reference: DeliveryHubQuoteReference
  amount: number
  currency_code: string
  delivery_eta_min: number | null
  delivery_eta_max: number | null
  pickup_point_required: boolean
  pickup_point_ids: string[]
  pickup_window_required: boolean
}

export type DeliveryHubQuotesResponse = {
  ok: true
  quotes: DeliveryHubQuote[]
}

export type DeliveryHubPickupPoint = {
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

export type DeliveryHubPickupPointsResponse = {
  ok: true
  points: DeliveryHubPickupPoint[]
}

export type DeliveryHubPickupWindow = {
  date: string
  time_from: string | null
  time_to: string | null
  interval_utc: DeliveryHubIntervalUtc
  label: string
}

export type DeliveryHubPickupWindowsResponse = {
  ok: true
  pickup_windows: DeliveryHubPickupWindow[]
}

export type DeliveryHubSelectionQuoteSummary = {
  carrier_code: string
  carrier_label: string
  amount: number
  currency_code: string
  delivery_eta_min: number | null
  delivery_eta_max: number | null
  pickup_point_required: boolean
  pickup_window_required: boolean
}

export type DeliveryHubSelectionPickupPoint = DeliveryHubPickupPoint

export type DeliveryHubSelectionPickupWindow = DeliveryHubPickupWindow

export type DeliveryHubSelection = {
  version: number
  provider_code?: string | null
  connection_id: string
  quote_type: DeliveryHubQuoteType
  quote_reference: DeliveryHubQuoteReference
  quote: DeliveryHubSelectionQuoteSummary
  pickup_point: DeliveryHubSelectionPickupPoint
  pickup_window: DeliveryHubSelectionPickupWindow | null
  correlation_id?: string | null
  updated_at: string
}

export type DeliveryHubSelectionResponse = {
  ok: true
  cart_id: string
  selection: DeliveryHubSelection | null
}

export type DeliveryHubSelectionConnectionSummary = {
  connection_id: string | null
  state: DeliveryHubConnectionState
  ready: boolean
}

export type DeliveryHubSelectionReadinessIssue = {
  code: DeliveryHubSelectionReadinessIssueCode
  message: string
  field: string | null
}

export type DeliveryHubSelectionQuoteContext = {
  connection: DeliveryHubSelectionConnectionSummary
  quote_type: DeliveryHubQuoteType
  quote_reference: DeliveryHubQuoteReference
  pickup_point_required: boolean
  pickup_window_required: boolean
  updated_at: string
}

export type DeliveryHubReadinessResponse = {
  ok: true
  cart_id: string
  status: DeliveryHubSelectionReadinessStatus
  issues: DeliveryHubSelectionReadinessIssue[]
  selection: DeliveryHubSelection | null
  quote_context: DeliveryHubSelectionQuoteContext | null
}

export type DeliveryHubListQuotesInput = {
  connection_id?: string | null
  mode_code: DeliveryHubQuoteType
  currency_code?: string | null
  destination_point_id: string
  origin_point_id?: string | null
  warehouse_id?: string | null
  interval_utc?: DeliveryHubIntervalUtc | null
  items?: DeliveryHubQuoteRequestItem[] | null
}

export type DeliveryHubListPickupPointsInput = {
  connection_id?: string | null
  city?: string | null
  country_code?: string | null
}

export type DeliveryHubListPickupWindowsInput = {
  connection_id?: string | null
  warehouse_id?: string | null
}

export type DeliveryHubSaveSelectionInput = {
  cart_id: string
  provider_code?: string | null
  connection_id: string
  quote_type: DeliveryHubQuoteType
  quote_reference: DeliveryHubQuoteReference
  quote: DeliveryHubSelectionQuoteSummary
  pickup_point: DeliveryHubSelectionPickupPoint
  pickup_window?: DeliveryHubSelectionPickupWindow | null
  correlation_id?: string | null
}

export type DeliveryHubClearSelectionInput = {
  cart_id: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function requireRecord(value: unknown, field: string) {
  if (!isRecord(value)) {
    throw new Error(`Delivery Hub payload field \"${field}\" must be an object`)
  }

  return value
}

function readRequiredString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Delivery Hub payload field \"${field}\" must be a non-empty string`)
  }

  return value.trim()
}

function readOptionalString(value: unknown) {
  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim()
  return normalized || null
}

function readBoolean(value: unknown, field: string) {
  if (typeof value !== "boolean") {
    throw new Error(`Delivery Hub payload field \"${field}\" must be a boolean`)
  }

  return value
}

function readFiniteNumber(value: unknown, field: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Delivery Hub payload field \"${field}\" must be a finite number`)
  }

  return value
}

function readNullableFiniteNumber(value: unknown, field: string) {
  if (value === null || value === undefined) {
    return null
  }

  return readFiniteNumber(value, field)
}

function readPositiveInteger(value: unknown, field: string) {
  const parsed = readFiniteNumber(value, field)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Delivery Hub payload field \"${field}\" must be a positive integer`)
  }

  return parsed
}

function readOptionalPositiveInteger(value: unknown, field: string) {
  if (value === null || value === undefined) {
    return undefined
  }

  return readPositiveInteger(value, field)
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((entry) => readOptionalString(entry))
    .filter((entry): entry is string => !!entry)
}

export function isDeliveryHubQuoteType(value: unknown): value is DeliveryHubQuoteType {
  return typeof value === "string" && DELIVERY_HUB_QUOTE_TYPES.includes(value as DeliveryHubQuoteType)
}

function readQuoteType(value: unknown, field: string) {
  if (!isDeliveryHubQuoteType(value)) {
    throw new Error(`Delivery Hub payload field \"${field}\" must be a supported quote type`)
  }

  return value
}

function readConnectionState(value: unknown, field: string) {
  if (
    typeof value !== "string" ||
    !DELIVERY_HUB_CONNECTION_STATES.includes(value as DeliveryHubConnectionState)
  ) {
    throw new Error(`Delivery Hub payload field \"${field}\" must be a supported connection state`)
  }

  return value as DeliveryHubConnectionState
}

function readReadinessStatus(value: unknown, field: string) {
  if (
    typeof value !== "string" ||
    !DELIVERY_HUB_SELECTION_READINESS_STATUSES.includes(
      value as DeliveryHubSelectionReadinessStatus
    )
  ) {
    throw new Error(`Delivery Hub payload field \"${field}\" must be a supported readiness status`)
  }

  return value as DeliveryHubSelectionReadinessStatus
}

function readReadinessIssueCode(value: unknown, field: string) {
  if (
    typeof value !== "string" ||
    !DELIVERY_HUB_SELECTION_READINESS_ISSUE_CODES.includes(
      value as DeliveryHubSelectionReadinessIssueCode
    )
  ) {
    throw new Error(`Delivery Hub payload field \"${field}\" must be a supported readiness issue code`)
  }

  return value as DeliveryHubSelectionReadinessIssueCode
}

function normalizeDeliveryHubIntervalUtc(
  value: unknown,
  field: string
): DeliveryHubIntervalUtc {
  const record = requireRecord(value, field)

  return {
    from: readRequiredString(record.from, `${field}.from`),
    to: readRequiredString(record.to, `${field}.to`),
  }
}

function normalizeDeliveryHubQuoteReference(
  value: unknown,
  field: string
): DeliveryHubQuoteReference {
  const record = requireRecord(value, field)

  return {
    id: readRequiredString(record.id, `${field}.id`),
    version: readPositiveInteger(record.version, `${field}.version`),
  }
}

function normalizeDeliveryHubSelectionQuoteSummary(
  value: unknown,
  field: string
): DeliveryHubSelectionQuoteSummary {
  const record = requireRecord(value, field)

  return {
    carrier_code: readRequiredString(record.carrier_code, `${field}.carrier_code`),
    carrier_label: readRequiredString(record.carrier_label, `${field}.carrier_label`),
    amount: readFiniteNumber(record.amount, `${field}.amount`),
    currency_code: readRequiredString(record.currency_code, `${field}.currency_code`),
    delivery_eta_min: readNullableFiniteNumber(
      record.delivery_eta_min,
      `${field}.delivery_eta_min`
    ),
    delivery_eta_max: readNullableFiniteNumber(
      record.delivery_eta_max,
      `${field}.delivery_eta_max`
    ),
    pickup_point_required: readBoolean(
      record.pickup_point_required,
      `${field}.pickup_point_required`
    ),
    pickup_window_required: readBoolean(
      record.pickup_window_required,
      `${field}.pickup_window_required`
    ),
  }
}

function normalizeDeliveryHubPickupPoint(
  value: unknown,
  field: string
): DeliveryHubPickupPoint {
  const record = requireRecord(value, field)

  return {
    provider_point_id: readRequiredString(
      record.provider_point_id,
      `${field}.provider_point_id`
    ),
    provider_point_code: readOptionalString(record.provider_point_code),
    name: readRequiredString(record.name, `${field}.name`),
    address: readRequiredString(record.address, `${field}.address`),
    city: readOptionalString(record.city),
    region: readOptionalString(record.region),
    postal_code: readOptionalString(record.postal_code),
    lat: readNullableFiniteNumber(record.lat, `${field}.lat`),
    lng: readNullableFiniteNumber(record.lng, `${field}.lng`),
    is_origin_dropoff_allowed: readBoolean(
      record.is_origin_dropoff_allowed,
      `${field}.is_origin_dropoff_allowed`
    ),
    is_destination_pickup_allowed: readBoolean(
      record.is_destination_pickup_allowed,
      `${field}.is_destination_pickup_allowed`
    ),
    payment_methods: readStringArray(record.payment_methods),
  }
}

function normalizeDeliveryHubPickupWindow(
  value: unknown,
  field: string
): DeliveryHubPickupWindow {
  const record = requireRecord(value, field)

  return {
    date: readRequiredString(record.date, `${field}.date`),
    time_from: readOptionalString(record.time_from),
    time_to: readOptionalString(record.time_to),
    interval_utc: normalizeDeliveryHubIntervalUtc(
      record.interval_utc,
      `${field}.interval_utc`
    ),
    label: readRequiredString(record.label, `${field}.label`),
  }
}

function normalizeDeliveryHubSelection(
  value: unknown,
  field: string
): DeliveryHubSelection {
  const record = requireRecord(value, field)

  return {
    version: readPositiveInteger(record.version, `${field}.version`),
    provider_code: readRequiredString(record.provider_code, `${field}.provider_code`),
    connection_id: readRequiredString(record.connection_id, `${field}.connection_id`),
    quote_type: readQuoteType(record.quote_type, `${field}.quote_type`),
    quote_reference: normalizeDeliveryHubQuoteReference(
      record.quote_reference,
      `${field}.quote_reference`
    ),
    quote: normalizeDeliveryHubSelectionQuoteSummary(record.quote, `${field}.quote`),
    pickup_point: normalizeDeliveryHubPickupPoint(
      record.pickup_point,
      `${field}.pickup_point`
    ),
    pickup_window:
      record.pickup_window === null || record.pickup_window === undefined
        ? null
        : normalizeDeliveryHubPickupWindow(
            record.pickup_window,
            `${field}.pickup_window`
          ),
    correlation_id: readOptionalString(record.correlation_id),
    updated_at: readRequiredString(record.updated_at, `${field}.updated_at`),
  }
}

function normalizeDeliveryHubCatalogConnection(
  value: unknown,
  field: string
): DeliveryHubCatalogConnection {
  const record = requireRecord(value, field)
  const rawQuoteTypes = Array.isArray(record.quote_types) ? record.quote_types : []

  return {
    connection_id: readRequiredString(record.connection_id, `${field}.connection_id`),
    label: readRequiredString(record.label, `${field}.label`),
    state: readConnectionState(record.state, `${field}.state`),
    ready: readBoolean(record.ready, `${field}.ready`),
    quote_types: rawQuoteTypes.map((entry, index) =>
      readQuoteType(entry, `${field}.quote_types.${index}`)
    ),
    supports_pickup_points: readBoolean(
      record.supports_pickup_points,
      `${field}.supports_pickup_points`
    ),
    supports_pickup_windows: readBoolean(
      record.supports_pickup_windows,
      `${field}.supports_pickup_windows`
    ),
    supports_dropoff: readBoolean(
      record.supports_dropoff,
      `${field}.supports_dropoff`
    ),
  }
}

function normalizeDeliveryHubQuote(value: unknown, field: string): DeliveryHubQuote {
  const record = requireRecord(value, field)

  return {
    carrier_code: readRequiredString(record.carrier_code, `${field}.carrier_code`),
    carrier_label: readRequiredString(record.carrier_label, `${field}.carrier_label`),
    mode_code: readQuoteType(record.mode_code, `${field}.mode_code`),
    quote_reference: normalizeDeliveryHubQuoteReference(
      record.quote_reference,
      `${field}.quote_reference`
    ),
    amount: readFiniteNumber(record.amount, `${field}.amount`),
    currency_code: readRequiredString(record.currency_code, `${field}.currency_code`),
    delivery_eta_min: readNullableFiniteNumber(
      record.delivery_eta_min,
      `${field}.delivery_eta_min`
    ),
    delivery_eta_max: readNullableFiniteNumber(
      record.delivery_eta_max,
      `${field}.delivery_eta_max`
    ),
    pickup_point_required: readBoolean(
      record.pickup_point_required,
      `${field}.pickup_point_required`
    ),
    pickup_point_ids: readStringArray(record.pickup_point_ids),
    pickup_window_required: readBoolean(
      record.pickup_window_required,
      `${field}.pickup_window_required`
    ),
  }
}

function normalizeDeliveryHubSelectionConnectionSummary(
  value: unknown,
  field: string
): DeliveryHubSelectionConnectionSummary {
  const record = requireRecord(value, field)

  return {
    connection_id: readOptionalString(record.connection_id),
    state: readConnectionState(record.state, `${field}.state`),
    ready: readBoolean(record.ready, `${field}.ready`),
  }
}

function normalizeDeliveryHubSelectionReadinessIssue(
  value: unknown,
  field: string
): DeliveryHubSelectionReadinessIssue {
  const record = requireRecord(value, field)

  return {
    code: readReadinessIssueCode(record.code, `${field}.code`),
    message: readRequiredString(record.message, `${field}.message`),
    field: readOptionalString(record.field),
  }
}

function normalizeDeliveryHubSelectionQuoteContext(
  value: unknown,
  field: string
): DeliveryHubSelectionQuoteContext {
  const record = requireRecord(value, field)

  return {
    connection: normalizeDeliveryHubSelectionConnectionSummary(
      record.connection,
      `${field}.connection`
    ),
    quote_type: readQuoteType(record.quote_type, `${field}.quote_type`),
    quote_reference: normalizeDeliveryHubQuoteReference(
      record.quote_reference,
      `${field}.quote_reference`
    ),
    pickup_point_required: readBoolean(
      record.pickup_point_required,
      `${field}.pickup_point_required`
    ),
    pickup_window_required: readBoolean(
      record.pickup_window_required,
      `${field}.pickup_window_required`
    ),
    updated_at: readRequiredString(record.updated_at, `${field}.updated_at`),
  }
}

function buildOptionalQueryField(
  query: Record<string, string>,
  key: string,
  value: string | null | undefined
) {
  if (!value) {
    return query
  }

  query[key] = value
  return query
}

function normalizeDeliveryHubStoreSettingsStatus(
  value: unknown,
  field: string
): DeliveryHubStoreSettingsStatus {
  if (
    value !== "unavailable" &&
    value !== "informational_only" &&
    value !== "available"
  ) {
    throw new Error(
      `Delivery Hub payload field \"${field}\" must be one of unavailable, informational_only, available`
    )
  }

  return value
}

function normalizeDeliveryHubStoreSettingsPreviewVisibility(
  value: unknown,
  field: string
): DeliveryHubStoreSettingsPreviewVisibility {
  const record = requireRecord(value, field)

  return {
    shadow_settings: readBoolean(record.shadow_settings, `${field}.shadow_settings`),
    readiness: readBoolean(record.readiness, `${field}.readiness`),
    persisted_selection: readBoolean(record.persisted_selection, `${field}.persisted_selection`),
    shadow_catalog: readBoolean(record.shadow_catalog, `${field}.shadow_catalog`),
    shadow_pickup_points: readBoolean(record.shadow_pickup_points, `${field}.shadow_pickup_points`),
    shadow_quotes: readBoolean(record.shadow_quotes, `${field}.shadow_quotes`),
    shadow_pickup_windows: readBoolean(
      record.shadow_pickup_windows,
      `${field}.shadow_pickup_windows`
    ),
  }
}

function normalizeDeliveryHubStoreSettingsResponseSettings(
  value: unknown,
  field: string
): DeliveryHubStoreSettingsResponse["settings"] {
  const record = requireRecord(value, field)
  const summary = requireRecord(record.summary, `${field}.summary`)

  return {
    enabled: readBoolean(record.enabled, `${field}.enabled`),
    status: normalizeDeliveryHubStoreSettingsStatus(record.status, `${field}.status`),
    summary: {
      enabled_connection_count: readFiniteNumber(
        summary.enabled_connection_count,
        `${field}.summary.enabled_connection_count`
      ),
      ready_connection_count: readFiniteNumber(
        summary.ready_connection_count,
        `${field}.summary.ready_connection_count`
      ),
      default_connection_label: readOptionalString(summary.default_connection_label),
      modality_codes: readStringArray(summary.modality_codes).map((quoteType, index) =>
        readQuoteType(quoteType, `${field}.summary.modality_codes.${index}`)
      ),
      supports_pickup_points: readBoolean(
        summary.supports_pickup_points,
        `${field}.summary.supports_pickup_points`
      ),
      supports_pickup_windows: readBoolean(
        summary.supports_pickup_windows,
        `${field}.summary.supports_pickup_windows`
      ),
      supports_dropoff: readBoolean(summary.supports_dropoff, `${field}.summary.supports_dropoff`),
    },
    preview_visibility: normalizeDeliveryHubStoreSettingsPreviewVisibility(
      record.preview_visibility,
      `${field}.preview_visibility`
    ),
    hints: readStringArray(record.hints),
  }
}

export function normalizeDeliveryHubCatalogResponse(
  payload: unknown
): DeliveryHubCatalogResponse {
  const record = requireRecord(payload, "catalog")
  const connections = Array.isArray(record.connections) ? record.connections : []

  return {
    ok: true,
    default_connection_id: readOptionalString(record.default_connection_id),
    connections: connections.map((connection, index) =>
      normalizeDeliveryHubCatalogConnection(connection, `connections.${index}`)
    ),
  }
}

export function normalizeDeliveryHubSettingsResponse(
  payload: unknown
): DeliveryHubStoreSettingsResponse {
  const record = requireRecord(payload, "settings")

  return {
    ok: true,
    settings: normalizeDeliveryHubStoreSettingsResponseSettings(record.settings, "settings"),
  }
}

export function normalizeDeliveryHubQuotesResponse(
  payload: unknown
): DeliveryHubQuotesResponse {
  const record = requireRecord(payload, "quotes")
  const quotes = Array.isArray(record.quotes) ? record.quotes : []

  return {
    ok: true,
    quotes: quotes.map((quote, index) => normalizeDeliveryHubQuote(quote, `quotes.${index}`)),
  }
}

export function normalizeDeliveryHubPickupPointsResponse(
  payload: unknown
): DeliveryHubPickupPointsResponse {
  const record = requireRecord(payload, "pickup-points")
  const points = Array.isArray(record.points) ? record.points : []

  return {
    ok: true,
    points: points.map((point, index) =>
      normalizeDeliveryHubPickupPoint(point, `points.${index}`)
    ),
  }
}

export function normalizeDeliveryHubPickupWindowsResponse(
  payload: unknown
): DeliveryHubPickupWindowsResponse {
  const record = requireRecord(payload, "pickup-windows")
  const pickupWindows = Array.isArray(record.pickup_windows) ? record.pickup_windows : []

  return {
    ok: true,
    pickup_windows: pickupWindows.map((window, index) =>
      normalizeDeliveryHubPickupWindow(window, `pickup_windows.${index}`)
    ),
  }
}

export function normalizeDeliveryHubSelectionResponse(
  payload: unknown
): DeliveryHubSelectionResponse {
  const record = requireRecord(payload, "selection")

  return {
    ok: true,
    cart_id: readRequiredString(record.cart_id, "cart_id"),
    selection:
      record.selection === null || record.selection === undefined
        ? null
        : normalizeDeliveryHubSelection(record.selection, "selection"),
  }
}

export function normalizeDeliveryHubReadinessResponse(
  payload: unknown
): DeliveryHubReadinessResponse {
  const record = requireRecord(payload, "readiness")
  const issues = Array.isArray(record.issues) ? record.issues : []

  return {
    ok: true,
    cart_id: readRequiredString(record.cart_id, "cart_id"),
    status: readReadinessStatus(record.status, "status"),
    issues: issues.map((issue, index) =>
      normalizeDeliveryHubSelectionReadinessIssue(issue, `issues.${index}`)
    ),
    selection:
      record.selection === null || record.selection === undefined
        ? null
        : normalizeDeliveryHubSelection(record.selection, "selection"),
    quote_context:
      record.quote_context === null || record.quote_context === undefined
        ? null
        : normalizeDeliveryHubSelectionQuoteContext(record.quote_context, "quote_context"),
  }
}

export function shapeDeliveryHubQuotesQuery(
  input: DeliveryHubListQuotesInput
): Record<string, string> {
  const query: Record<string, string> = {
    mode_code: readQuoteType(input.mode_code, "mode_code"),
    destination_point_id: readRequiredString(
      input.destination_point_id,
      "destination_point_id"
    ),
  }

  buildOptionalQueryField(query, "connection_id", readOptionalString(input.connection_id))
  buildOptionalQueryField(query, "currency_code", readOptionalString(input.currency_code))
  buildOptionalQueryField(query, "origin_point_id", readOptionalString(input.origin_point_id))
  buildOptionalQueryField(query, "warehouse_id", readOptionalString(input.warehouse_id))

  if (input.interval_utc) {
    query.interval_utc = JSON.stringify(
      normalizeDeliveryHubIntervalUtc(input.interval_utc, "interval_utc")
    )
  }

  if (input.items?.length) {
    query.items = JSON.stringify(
      input.items.map((item, index) => shapeDeliveryHubQuoteRequestItem(item, `items.${index}`))
    )
  }

  return query
}

function shapeDeliveryHubQuoteRequestItem(
  item: DeliveryHubQuoteRequestItem,
  field: string
): DeliveryHubQuoteRequestItem {
  const record = requireRecord(item, field)
  const shaped: DeliveryHubQuoteRequestItem = {}

  const quantity = readOptionalPositiveInteger(record.quantity, `${field}.quantity`)
  if (quantity !== undefined) {
    shaped.quantity = quantity
  }

  const weight = readOptionalPositiveInteger(record.weight_grams, `${field}.weight_grams`)
  if (weight !== undefined) {
    shaped.weight_grams = weight
  }

  if (record.price !== null && record.price !== undefined) {
    shaped.price = readFiniteNumber(record.price, `${field}.price`)
  }

  return shaped
}

export function shapeDeliveryHubPickupPointsQuery(
  input: DeliveryHubListPickupPointsInput = {}
): Record<string, string> {
  const query: Record<string, string> = {}

  buildOptionalQueryField(query, "connection_id", readOptionalString(input.connection_id))
  buildOptionalQueryField(query, "city", readOptionalString(input.city))
  buildOptionalQueryField(query, "country_code", readOptionalString(input.country_code))

  return query
}

export function shapeDeliveryHubPickupWindowsQuery(
  input: DeliveryHubListPickupWindowsInput = {}
): Record<string, string> {
  const query: Record<string, string> = {}

  buildOptionalQueryField(query, "connection_id", readOptionalString(input.connection_id))
  buildOptionalQueryField(query, "warehouse_id", readOptionalString(input.warehouse_id))

  return query
}

export function shapeDeliveryHubSaveSelectionPayload(
  input: DeliveryHubSaveSelectionInput
): DeliveryHubSaveSelectionInput {
  const record = requireRecord(input, "selection")

  return {
    cart_id: readRequiredString(record.cart_id, "cart_id"),
    provider_code: readOptionalString(record.provider_code),
    connection_id: readRequiredString(record.connection_id, "connection_id"),
    quote_type: readQuoteType(record.quote_type, "quote_type"),
    quote_reference: normalizeDeliveryHubQuoteReference(
      record.quote_reference,
      "quote_reference"
    ),
    quote: normalizeDeliveryHubSelectionQuoteSummary(record.quote, "quote"),
    pickup_point: normalizeDeliveryHubPickupPoint(record.pickup_point, "pickup_point"),
    pickup_window:
      record.pickup_window === null || record.pickup_window === undefined
        ? null
        : normalizeDeliveryHubPickupWindow(record.pickup_window, "pickup_window"),
    correlation_id: readOptionalString(record.correlation_id),
  }
}

export function shapeDeliveryHubClearSelectionPayload(
  input: DeliveryHubClearSelectionInput
): DeliveryHubClearSelectionInput {
  const record = requireRecord(input, "clear-selection")

  return {
    cart_id: readRequiredString(record.cart_id, "cart_id"),
  }
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

export type DeliveryHubPersistedSelectionPreviewModel = {
  tone: "neutral" | "positive" | "warning"
  status_label: string
  modality_label: string | null
  quote_amount: number | null
  currency_code: string | null
  quote_eta_label: string | null
  pickup_point_label: string | null
  pickup_window_label: string | null
  readiness_label: string | null
  hint_messages: string[]
  updated_at: string | null
}

export type DeliveryHubShadowCatalogPreviewState = {
  status: "idle" | "loading" | "ready" | "error"
  default_connection_label: string | null
  connection_count: number
  ready_connection_count: number
  modality_labels: string[]
  supports_pickup_points: boolean
  supports_pickup_windows: boolean
  supports_dropoff: boolean
  issue_message: string | null
}

export type DeliveryHubShadowCatalogPreviewModel = {
  tone: "neutral" | "positive" | "warning"
  status_label: string
  default_connection_label: string | null
  availability_label: string | null
  modality_label: string | null
  hint_messages: string[]
}

export type DeliveryHubShadowSettingsPreviewState = {
  status: "idle" | "loading" | "ready" | "error"
  enabled: boolean
  settings_status: DeliveryHubStoreSettingsStatus | null
  enabled_connection_count: number
  ready_connection_count: number
  default_connection_label: string | null
  modality_labels: string[]
  supports_pickup_points: boolean
  supports_pickup_windows: boolean
  supports_dropoff: boolean
  preview_visibility_labels: string[]
  hint_messages: string[]
  issue_message: string | null
}

export type DeliveryHubShadowSettingsPreviewModel = {
  tone: "neutral" | "positive" | "warning"
  status_label: string
  default_connection_label: string | null
  availability_label: string | null
  modality_label: string | null
  visibility_label: string | null
  hint_messages: string[]
}

export type DeliveryHubShadowQuotePreviewState = {
  status: "idle" | "loading" | "ready" | "error"
  connection_label: string | null
  quote_type: DeliveryHubQuoteType | null
  quote_count: number
  pickup_point_count: number
  issue_message: string | null
}

export type DeliveryHubShadowQuotePreviewModel = {
  tone: "neutral" | "positive" | "warning"
  status_label: string
  connection_label: string | null
  modality_label: string | null
  availability_label: string | null
  hint_messages: string[]
}

export type DeliveryHubShadowPickupPointPreviewState = {
  status: "idle" | "loading" | "ready" | "error"
  connection_label: string | null
  quote_type: DeliveryHubQuoteType | null
  pickup_point_count: number
  destination_pickup_point_count: number
  issue_message: string | null
}

export type DeliveryHubShadowPickupPointPreviewModel = {
  tone: "neutral" | "positive" | "warning"
  status_label: string
  connection_label: string | null
  modality_label: string | null
  availability_label: string | null
  hint_messages: string[]
}

export type DeliveryHubShadowPickupWindowPreviewState = {
  status: "idle" | "loading" | "ready" | "error"
  connection_label: string | null
  quote_type: DeliveryHubQuoteType | null
  quote_count: number
  pickup_window_required_quote_count: number
  pickup_window_count: number
  issue_message: string | null
}

export type DeliveryHubShadowPickupWindowPreviewModel = {
  tone: "neutral" | "positive" | "warning"
  status_label: string
  connection_label: string | null
  modality_label: string | null
  availability_label: string | null
  hint_messages: string[]
}

export type DeliveryHubShadowSelectionActionabilityStatus =
  | "ready"
  | "needs_quote"
  | "needs_pickup_point"
  | "needs_pickup_window"
  | "stale"
  | "blocked_by_readiness"
  | "incomplete"

export type DeliveryHubShadowSelectionActionabilityPreviewState = {
  readiness: DeliveryHubReadinessResponse | null | undefined
  selection_response: DeliveryHubSelectionResponse | null | undefined
  settings_status: "idle" | "loading" | "ready" | "error"
  settings_enabled: boolean
  settings_surface_status: DeliveryHubStoreSettingsStatus | null
  ready_connection_count: number
  settings_issue_message: string | null
  quote_preview_status: "idle" | "loading" | "ready" | "error"
  quote_count: number
  quote_issue_message: string | null
  pickup_point_preview_status: "idle" | "loading" | "ready" | "error"
  destination_pickup_point_count: number
  pickup_point_issue_message: string | null
  pickup_window_preview_status: "idle" | "loading" | "ready" | "error"
  pickup_window_required_quote_count: number
  pickup_window_count: number
  pickup_window_issue_message: string | null
}

export type DeliveryHubShadowSelectionActionabilityPreviewModel = {
  tone: "neutral" | "positive" | "warning"
  actionability_status: DeliveryHubShadowSelectionActionabilityStatus
  status_label: string
  connection_label: string | null
  modality_label: string | null
  readiness_label: string | null
  hint_messages: string[]
}

export type DeliveryHubShadowShippingOptionParityState =
  | "aligned"
  | "divergent"
  | "insufficient_context"
  | "not_applicable"

export type DeliveryHubShadowShippingOptionParityPreviewState = {
  legacy_is_committed: boolean
  legacy_flow_kind: "pickup_point" | "door_delivery" | null
  legacy_method_label: string | null
  legacy_selection_fresh: boolean
  shadow_quote_type: DeliveryHubQuoteType | null
  shadow_settings_status: "idle" | "loading" | "ready" | "error"
  shadow_settings_enabled: boolean
  shadow_settings_surface_status: DeliveryHubStoreSettingsStatus | null
  shadow_ready_connection_count: number
  shadow_quote_preview_status: "idle" | "loading" | "ready" | "error"
  shadow_quote_count: number
  shadow_pickup_point_preview_status: "idle" | "loading" | "ready" | "error"
  shadow_destination_pickup_point_count: number
  issue_messages: string[]
}

export type DeliveryHubShadowShippingOptionParityPreviewModel = {
  tone: "neutral" | "positive" | "warning"
  parity_state: DeliveryHubShadowShippingOptionParityState
  status_label: string
  legacy_method_label: string | null
  shadow_modality_label: string | null
  detail_label: string | null
  hint_messages: string[]
}

export type DeliveryHubShadowSelectionParityStatus =
  | "aligned"
  | "missing_legacy_method"
  | "missing_neutral_selection"
  | "modality_mismatch"
  | "reference_mismatch"
  | "insufficient_data"

export type DeliveryHubShadowSelectionParityPreviewState = {
  legacy_is_committed: boolean
  legacy_method_label: string | null
  legacy_flow_kind: "pickup_point" | "door_delivery" | null
  legacy_selection_fresh: boolean
  legacy_reference_label: string | null
  legacy_reference_detail_label: string | null
  neutral_selection_status: "idle" | "loading" | "ready" | "error"
  neutral_selection: DeliveryHubSelection | null
  readiness_status: DeliveryHubSelectionReadinessStatus | null
  issue_messages: string[]
}

export type DeliveryHubShadowSelectionParityPreviewModel = {
  tone: "neutral" | "positive" | "warning"
  parity_status: DeliveryHubShadowSelectionParityStatus
  status_label: string
  legacy_method_label: string | null
  legacy_modality_label: string | null
  neutral_modality_label: string | null
  legacy_reference_label: string | null
  neutral_reference_label: string | null
  readiness_label: string | null
  hint_messages: string[]
}

export type DeliveryHubShadowOrchestrationVerdict =
  | "aligned"
  | "degraded"
  | "blocked"
  | "insufficient_data"

export type DeliveryHubShadowOrchestrationVerdictPreviewState = {
  readiness_preview: DeliveryHubReadinessPreviewModel
  persisted_selection_preview: DeliveryHubPersistedSelectionPreviewModel
  shadow_catalog_preview: DeliveryHubShadowCatalogPreviewModel
  shadow_settings_preview: DeliveryHubShadowSettingsPreviewModel
  shadow_quote_preview: DeliveryHubShadowQuotePreviewModel
  shadow_pickup_point_preview: DeliveryHubShadowPickupPointPreviewModel
  shadow_pickup_window_preview: DeliveryHubShadowPickupWindowPreviewModel
  shadow_selection_actionability_preview: DeliveryHubShadowSelectionActionabilityPreviewModel
  shadow_shipping_option_parity_preview: DeliveryHubShadowShippingOptionParityPreviewModel
  shadow_selection_parity_preview: DeliveryHubShadowSelectionParityPreviewModel
}

export type DeliveryHubShadowOrchestrationVerdictPreviewModel = {
  tone: "neutral" | "positive" | "warning"
  verdict_code: DeliveryHubShadowOrchestrationVerdict
  status_label: string
  signal_summary_label: string | null
  actionability_label: string
  shipping_option_parity_label: string
  selection_parity_label: string
  hint_messages: string[]
}

export type DeliveryHubShadowOrchestrationRecommendationStatus =
  | "recommended"
  | "unavailable"
  | "insufficient_data"

export type DeliveryHubShadowOrchestrationRecommendationPreviewState = {
  readiness_preview: DeliveryHubReadinessPreviewModel
  persisted_selection_preview: DeliveryHubPersistedSelectionPreviewModel
  shadow_selection_actionability_preview: DeliveryHubShadowSelectionActionabilityPreviewModel
  shadow_shipping_option_parity_preview: DeliveryHubShadowShippingOptionParityPreviewModel
  shadow_selection_parity_preview: DeliveryHubShadowSelectionParityPreviewModel
  shadow_orchestration_verdict_preview: DeliveryHubShadowOrchestrationVerdictPreviewModel
}

export type DeliveryHubShadowOrchestrationRecommendationPreviewModel = {
  tone: "neutral" | "positive" | "warning"
  recommendation_status: DeliveryHubShadowOrchestrationRecommendationStatus
  status_label: string
  recommended_modality_label: string | null
  recommended_pickup_point_label: string | null
  recommended_pickup_window_label: string | null
  recommended_quote_amount: number | null
  currency_code: string | null
  recommended_quote_eta_label: string | null
  readiness_label: string | null
  detail_label: string | null
  hint_messages: string[]
}

export type DeliveryHubShadowCutoverReadinessStatus =
  | "ready"
  | "not_ready"
  | "insufficient_data"

export type DeliveryHubShadowCutoverReadinessPreviewState = {
  readiness_preview: DeliveryHubReadinessPreviewModel
  persisted_selection_preview: DeliveryHubPersistedSelectionPreviewModel
  shadow_selection_actionability_preview: DeliveryHubShadowSelectionActionabilityPreviewModel
  shadow_shipping_option_parity_preview: DeliveryHubShadowShippingOptionParityPreviewModel
  shadow_selection_parity_preview: DeliveryHubShadowSelectionParityPreviewModel
  shadow_orchestration_verdict_preview: DeliveryHubShadowOrchestrationVerdictPreviewModel
  shadow_orchestration_recommendation_preview: DeliveryHubShadowOrchestrationRecommendationPreviewModel
}

export type DeliveryHubShadowCutoverReadinessPreviewModel = {
  tone: "neutral" | "positive" | "warning"
  cutover_readiness_status: DeliveryHubShadowCutoverReadinessStatus
  status_label: string
  readiness_label: string | null
  recommendation_label: string | null
  modality_label: string | null
  detail_label: string | null
  hint_messages: string[]
}

export type DeliveryHubShadowCutoverBlockersStatus =
  | "known_blockers"
  | "no_known_blockers"
  | "insufficient_data"

export type DeliveryHubShadowCutoverBlockerCode =
  | "blocked_by_readiness"
  | "needs_quote"
  | "needs_pickup_point"
  | "needs_pickup_window"
  | "stale_shadow_context"
  | "shipping_option_parity_divergent"
  | "missing_neutral_selection"
  | "selection_modality_mismatch"
  | "selection_reference_mismatch"

export type DeliveryHubShadowCutoverBlockerItem = {
  code: DeliveryHubShadowCutoverBlockerCode
  label: string
  detail_label: string | null
}

export type DeliveryHubShadowCutoverBlockersPreviewState = {
  readiness_preview: DeliveryHubReadinessPreviewModel
  persisted_selection_preview: DeliveryHubPersistedSelectionPreviewModel
  shadow_selection_actionability_preview: DeliveryHubShadowSelectionActionabilityPreviewModel
  shadow_shipping_option_parity_preview: DeliveryHubShadowShippingOptionParityPreviewModel
  shadow_selection_parity_preview: DeliveryHubShadowSelectionParityPreviewModel
  shadow_orchestration_verdict_preview: DeliveryHubShadowOrchestrationVerdictPreviewModel
  shadow_orchestration_recommendation_preview: DeliveryHubShadowOrchestrationRecommendationPreviewModel
  shadow_cutover_readiness_preview: DeliveryHubShadowCutoverReadinessPreviewModel
}

export type DeliveryHubShadowCutoverBlockersPreviewModel = {
  tone: "neutral" | "positive" | "warning"
  blockers_status: DeliveryHubShadowCutoverBlockersStatus
  status_label: string
  readiness_label: string | null
  verdict_label: string | null
  recommendation_label: string | null
  blocker_count_label: string | null
  blockers: DeliveryHubShadowCutoverBlockerItem[]
  hint_messages: string[]
}

export type DeliveryHubShadowCutoverNextStepsStatus =
  | "known_next_steps"
  | "no_clear_next_steps"
  | "insufficient_data"

export type DeliveryHubShadowCutoverNextStepCode =
  | "review_readiness_constraints"
  | "observe_shadow_quote_context"
  | "observe_shadow_pickup_point_context"
  | "observe_shadow_pickup_window_context"
  | "refresh_shadow_context"
  | "investigate_shipping_option_parity"
  | "observe_neutral_selection"
  | "resolve_selection_modality_mismatch"
  | "resolve_selection_reference_mismatch"

export type DeliveryHubShadowCutoverNextStepItem = {
  code: DeliveryHubShadowCutoverNextStepCode
  label: string
  detail_label: string | null
}

export type DeliveryHubShadowCutoverNextStepsPreviewState = {
  readiness_preview: DeliveryHubReadinessPreviewModel
  persisted_selection_preview: DeliveryHubPersistedSelectionPreviewModel
  shadow_selection_actionability_preview: DeliveryHubShadowSelectionActionabilityPreviewModel
  shadow_shipping_option_parity_preview: DeliveryHubShadowShippingOptionParityPreviewModel
  shadow_selection_parity_preview: DeliveryHubShadowSelectionParityPreviewModel
  shadow_orchestration_recommendation_preview: DeliveryHubShadowOrchestrationRecommendationPreviewModel
  shadow_cutover_readiness_preview: DeliveryHubShadowCutoverReadinessPreviewModel
  shadow_cutover_blockers_preview: DeliveryHubShadowCutoverBlockersPreviewModel
}

export type DeliveryHubShadowCutoverNextStepsPreviewModel = {
  tone: "neutral" | "positive" | "warning"
  next_steps_status: DeliveryHubShadowCutoverNextStepsStatus
  status_label: string
  readiness_label: string | null
  blocker_status_label: string | null
  recommendation_label: string | null
  next_step_count_label: string | null
  next_steps: DeliveryHubShadowCutoverNextStepItem[]
  hint_messages: string[]
}

export type DeliveryHubShadowCutoverSummaryStatus =
  | "ready_shadow_contour"
  | "attention_required"
  | "insufficient_data"

export type DeliveryHubShadowCutoverSummaryPreviewState = {
  shadow_orchestration_recommendation_preview: DeliveryHubShadowOrchestrationRecommendationPreviewModel
  shadow_cutover_readiness_preview: DeliveryHubShadowCutoverReadinessPreviewModel
  shadow_cutover_blockers_preview: DeliveryHubShadowCutoverBlockersPreviewModel
  shadow_cutover_next_steps_preview: DeliveryHubShadowCutoverNextStepsPreviewModel
}

export type DeliveryHubShadowCutoverSummaryPreviewModel = {
  tone: "neutral" | "positive" | "warning"
  summary_status: DeliveryHubShadowCutoverSummaryStatus
  status_label: string
  readiness_label: string | null
  modality_label: string | null
  recommendation_label: string | null
  blocker_count_label: string | null
  next_step_count_label: string | null
  detail_label: string | null
  headline_messages: string[]
  hint_messages: string[]
}

export type DeliveryHubShadowCutoverEvidenceStatus =
  | "evidence_available"
  | "insufficient_data"

export type DeliveryHubShadowCutoverEvidenceItemCode =
  | "summary_signal"
  | "readiness_signal"
  | "blocker_signal"
  | "next_step_signal"
  | "recommendation_signal"

export type DeliveryHubShadowCutoverEvidenceItem = {
  code: DeliveryHubShadowCutoverEvidenceItemCode
  label: string
  detail_label: string | null
}

export type DeliveryHubShadowCutoverEvidencePreviewState = {
  shadow_orchestration_recommendation_preview: DeliveryHubShadowOrchestrationRecommendationPreviewModel
  shadow_cutover_readiness_preview: DeliveryHubShadowCutoverReadinessPreviewModel
  shadow_cutover_blockers_preview: DeliveryHubShadowCutoverBlockersPreviewModel
  shadow_cutover_next_steps_preview: DeliveryHubShadowCutoverNextStepsPreviewModel
  shadow_cutover_summary_preview: DeliveryHubShadowCutoverSummaryPreviewModel
}

export type DeliveryHubShadowCutoverEvidencePreviewModel = {
  tone: "neutral" | "positive" | "warning"
  evidence_status: DeliveryHubShadowCutoverEvidenceStatus
  status_label: string
  readiness_label: string | null
  summary_label: string | null
  recommendation_label: string | null
  evidence_count_label: string | null
  detail_label: string | null
  evidence_items: DeliveryHubShadowCutoverEvidenceItem[]
  hint_messages: string[]
}

export type DeliveryHubShadowCutoverRolloutStatus =
  | "observe_only"
  | "not_advised"
  | "insufficient_data"

export type DeliveryHubShadowCutoverRolloutPreviewState = {
  shadow_orchestration_recommendation_preview: DeliveryHubShadowOrchestrationRecommendationPreviewModel
  shadow_cutover_readiness_preview: DeliveryHubShadowCutoverReadinessPreviewModel
  shadow_cutover_blockers_preview: DeliveryHubShadowCutoverBlockersPreviewModel
  shadow_cutover_next_steps_preview: DeliveryHubShadowCutoverNextStepsPreviewModel
  shadow_cutover_summary_preview: DeliveryHubShadowCutoverSummaryPreviewModel
  shadow_cutover_evidence_preview: DeliveryHubShadowCutoverEvidencePreviewModel
}

export type DeliveryHubShadowCutoverRolloutPreviewModel = {
  tone: "neutral" | "warning"
  rollout_status: DeliveryHubShadowCutoverRolloutStatus
  status_label: string
  readiness_label: string | null
  summary_label: string | null
  evidence_label: string | null
  recommendation_label: string | null
  rollout_reason_label: string | null
  detail_label: string | null
  headline_messages: string[]
  hint_messages: string[]
}

export type DeliveryHubShadowCutoverGatePreviewStatus =
  | "aligned"
  | "blocked"
  | "insufficient_data"

export type DeliveryHubShadowCutoverGateCode =
  | "shipping_option_parity"
  | "selection_parity"
  | "readiness_contour"
  | "known_blockers"
  | "recommendation_signal"
  | "supporting_evidence"
  | "rollout_picture"

export type DeliveryHubShadowCutoverGateItem = {
  code: DeliveryHubShadowCutoverGateCode
  gate_status: DeliveryHubShadowCutoverGatePreviewStatus
  label: string
  detail_label: string | null
}

export type DeliveryHubShadowCutoverGatePreviewState = {
  shadow_shipping_option_parity_preview: DeliveryHubShadowShippingOptionParityPreviewModel
  shadow_selection_parity_preview: DeliveryHubShadowSelectionParityPreviewModel
  shadow_orchestration_recommendation_preview: DeliveryHubShadowOrchestrationRecommendationPreviewModel
  shadow_cutover_readiness_preview: DeliveryHubShadowCutoverReadinessPreviewModel
  shadow_cutover_blockers_preview: DeliveryHubShadowCutoverBlockersPreviewModel
  shadow_cutover_summary_preview: DeliveryHubShadowCutoverSummaryPreviewModel
  shadow_cutover_evidence_preview: DeliveryHubShadowCutoverEvidencePreviewModel
  shadow_cutover_rollout_preview: DeliveryHubShadowCutoverRolloutPreviewModel
}

export type DeliveryHubShadowCutoverGatePreviewModel = {
  tone: "neutral" | "positive" | "warning"
  gate_preview_status: DeliveryHubShadowCutoverGatePreviewStatus
  status_label: string
  readiness_label: string | null
  summary_label: string | null
  rollout_label: string | null
  aligned_gate_count_label: string | null
  blocked_gate_count_label: string | null
  insufficient_gate_count_label: string | null
  gate_items: DeliveryHubShadowCutoverGateItem[]
  headline_messages: string[]
  hint_messages: string[]
}

export type DeliveryHubShadowCutoverDecisionPreviewStatus =
  | "hold"
  | "observe_only"
  | "insufficient_data"

export type DeliveryHubShadowCutoverDecisionPreviewState = {
  shadow_orchestration_recommendation_preview: DeliveryHubShadowOrchestrationRecommendationPreviewModel
  shadow_cutover_readiness_preview: DeliveryHubShadowCutoverReadinessPreviewModel
  shadow_cutover_blockers_preview: DeliveryHubShadowCutoverBlockersPreviewModel
  shadow_cutover_summary_preview: DeliveryHubShadowCutoverSummaryPreviewModel
  shadow_cutover_evidence_preview: DeliveryHubShadowCutoverEvidencePreviewModel
  shadow_cutover_rollout_preview: DeliveryHubShadowCutoverRolloutPreviewModel
  shadow_cutover_gate_preview: DeliveryHubShadowCutoverGatePreviewModel
}

export type DeliveryHubShadowCutoverDecisionPreviewModel = {
  tone: "neutral" | "warning"
  decision_status: DeliveryHubShadowCutoverDecisionPreviewStatus
  status_label: string
  readiness_label: string | null
  summary_label: string | null
  evidence_label: string | null
  rollout_label: string | null
  gate_label: string | null
  decision_reason_label: string | null
  detail_label: string | null
  headline_messages: string[]
  hint_messages: string[]
}

export type DeliveryHubShadowCutoverChecklistItemStatus =
  | "ready"
  | "pending"
  | "blocked"
  | "insufficient_data"

export type DeliveryHubShadowCutoverChecklistItemCode =
  | "readiness_contour"
  | "known_blockers"
  | "shadow_summary"
  | "supporting_evidence"
  | "rollout_picture"
  | "gate_alignment"
  | "decision_signal"

export type DeliveryHubShadowCutoverChecklistItem = {
  code: DeliveryHubShadowCutoverChecklistItemCode
  item_status: DeliveryHubShadowCutoverChecklistItemStatus
  label: string
  detail_label: string | null
}

export type DeliveryHubShadowCutoverChecklistPreviewState = {
  shadow_cutover_readiness_preview: DeliveryHubShadowCutoverReadinessPreviewModel
  shadow_cutover_blockers_preview: DeliveryHubShadowCutoverBlockersPreviewModel
  shadow_cutover_summary_preview: DeliveryHubShadowCutoverSummaryPreviewModel
  shadow_cutover_evidence_preview: DeliveryHubShadowCutoverEvidencePreviewModel
  shadow_cutover_rollout_preview: DeliveryHubShadowCutoverRolloutPreviewModel
  shadow_cutover_gate_preview: DeliveryHubShadowCutoverGatePreviewModel
  shadow_cutover_decision_preview: DeliveryHubShadowCutoverDecisionPreviewModel
}

export type DeliveryHubShadowCutoverChecklistPreviewModel = {
  tone: "neutral" | "positive" | "warning"
  checklist_status: DeliveryHubShadowCutoverChecklistItemStatus
  status_label: string
  readiness_label: string | null
  summary_label: string | null
  decision_label: string | null
  ready_item_count_label: string | null
  pending_item_count_label: string | null
  blocked_item_count_label: string | null
  insufficient_item_count_label: string | null
  checklist_items: DeliveryHubShadowCutoverChecklistItem[]
  hint_messages: string[]
}

export type DeliveryHubNeutralSelectionRehearsalStatus =
  | "candidate_available"
  | "blocked"
  | "insufficient_data"
  | "legacy_only"

export type DeliveryHubNeutralSelectionRehearsalBlockerCode =
  | "settings_unavailable"
  | "readiness_blocked"
  | "missing_quote_reference"
  | "missing_quote"
  | "missing_pickup_point"
  | "missing_pickup_window"
  | "legacy_parity_mismatch"
  | "legacy_context_missing"

export type DeliveryHubNeutralSelectionLegacyContext = {
  active_commit_path: "legacy_apiship" | "other_legacy" | null
  legacy_is_committed: boolean
  legacy_flow_kind: "pickup_point" | "door_delivery" | null
  legacy_selection_fresh: boolean
  legacy_method_label: string | null
}

export type DeliveryHubNeutralSelectionRehearsalInput = {
  cart_id?: string | null
  settings?: DeliveryHubStoreSettingsResponse | null
  catalog?: DeliveryHubCatalogResponse | null
  quotes?: DeliveryHubQuotesResponse | null
  pickup_points?: DeliveryHubPickupPointsResponse | null
  pickup_windows?: DeliveryHubPickupWindowsResponse | null
  persisted_selection?: DeliveryHubSelectionResponse | null
  readiness?: DeliveryHubReadinessResponse | null
  shipping_option_parity?: DeliveryHubShadowShippingOptionParityPreviewModel | null
  selection_parity?: DeliveryHubShadowSelectionParityPreviewModel | null
  legacy_context?: DeliveryHubNeutralSelectionLegacyContext | null
}

export type DeliveryHubNeutralSelectionRehearsalModel = {
  tone: "neutral" | "positive" | "warning"
  status: DeliveryHubNeutralSelectionRehearsalStatus
  status_label: string
  active_commit_path_label: string
  rehearsal_label: string
  modality_label: string | null
  quote_amount: number | null
  currency_code: string | null
  quote_eta_label: string | null
  quote_reference: DeliveryHubQuoteReference | null
  quote_reference_label: string | null
  pickup_point_label: string | null
  pickup_point_address_label: string | null
  pickup_window_label: string | null
  readiness_label: string | null
  legacy_method_label: string | null
  blocker_codes: DeliveryHubNeutralSelectionRehearsalBlockerCode[]
  hint_messages: string[]
}

export type DeliveryHubNeutralSelectionRehearsalActionabilityVerdict =
  | "dry_run_shape_available"
  | "dry_run_blocked"
  | "dry_run_insufficient_data"
  | "dry_run_legacy_only"

export type DeliveryHubNeutralSelectionRehearsalActionabilityModel = {
  verdict: DeliveryHubNeutralSelectionRehearsalActionabilityVerdict
  can_shape_future_selection_body: boolean
  dry_run_only: true
  mutation_intent: false
  blocker_codes: DeliveryHubNeutralSelectionRehearsalBlockerCode[]
  hint_messages: string[]
}

export type DeliveryHubHandoffPreviewVerdict =
  | "ready_for_handoff_preview"
  | "missing_required_fragment"
  | "blocked"

export type DeliveryHubHandoffPreviewBlockerCode =
  | "connection_not_ready"
  | "missing_connection_id"
  | "missing_mode_code"
  | "missing_quote_reference"
  | "missing_pickup_point"
  | "missing_pickup_window"
  | "missing_quote"
  | "legacy_parity_mismatch"

export type DeliveryHubHandoffPreviewModel = {
  tone: "neutral" | "positive" | "warning"
  verdict: DeliveryHubHandoffPreviewVerdict
  verdict_label: string
  readiness_summary_label: string
  connection_id: string | null
  mode_code: DeliveryHubQuoteType | null
  mode_label: string | null
  quote_reference_present: boolean
  pickup_point_required: boolean
  pickup_point_present: boolean
  pickup_window_required: boolean
  pickup_window_present: boolean
  blocker_codes: DeliveryHubHandoffPreviewBlockerCode[]
  hint_messages: string[]
  dry_run_only: true
  mutation_intent: false
}

export type DeliveryHubPersistedSelectionContractParityPreviewVerdict =
  | "informational_only"
  | "contract_matched"
  | "contract_mismatched"
  | "blocked"

export type DeliveryHubPersistedSelectionContractParityPreviewFieldKey =
  | "connection_id"
  | "mode_code"
  | "quote_reference"
  | "pickup_point"
  | "pickup_window"

export type DeliveryHubPersistedSelectionContractParityPreviewFieldStatus =
  | "matched"
  | "mismatched"
  | "blocked"
  | "informational_only"
  | "not_required"

export type DeliveryHubPersistedSelectionContractParityPreviewField = {
  key: DeliveryHubPersistedSelectionContractParityPreviewFieldKey
  label: string
  status: DeliveryHubPersistedSelectionContractParityPreviewFieldStatus
  detail_label: string
}

export type DeliveryHubPersistedSelectionContractParityPreviewReadinessBlocker =
  | "selection_unavailable"
  | "connection_unavailable"

export type DeliveryHubPersistedSelectionContractParityPreviewParityBlocker =
  | "delivery_option_unavailable"
  | "selection_alignment_unavailable"

export type DeliveryHubPersistedSelectionContractParityPreviewModel = {
  tone: "neutral" | "positive" | "warning"
  verdict: DeliveryHubPersistedSelectionContractParityPreviewVerdict
  verdict_label: string
  summary_label: string
  projected_contract_label: string
  connection_id: string | null
  mode_code: DeliveryHubQuoteType | null
  mode_label: string | null
  quote_reference_present: boolean
  pickup_point_required: boolean
  pickup_point_present: boolean
  pickup_window_required: boolean
  pickup_window_present: boolean
  matched_field_count: number
  mismatched_field_count: number
  fields: DeliveryHubPersistedSelectionContractParityPreviewField[]
  mismatch_reasons: string[]
  blocked_readiness_codes: DeliveryHubPersistedSelectionContractParityPreviewReadinessBlocker[]
  blocked_parity_codes: DeliveryHubPersistedSelectionContractParityPreviewParityBlocker[]
  dry_run_only: true
  mutation_intent: false
}

export type DeliveryHubProjectedCommitParityPreviewVerdict =
  | "informational_only"
  | "projected_commit_matched"
  | "projected_commit_mismatched"
  | "blocked"

export type DeliveryHubProjectedCommitParityPreviewFieldKey =
  | "connection_id"
  | "mode_code"
  | "quote_reference"
  | "pickup_point"
  | "pickup_window"
  | "commit_payload_readiness"

export type DeliveryHubProjectedCommitParityPreviewFieldStatus =
  | "matched"
  | "mismatched"
  | "blocked"
  | "informational_only"
  | "not_required"

export type DeliveryHubProjectedCommitParityPreviewField = {
  key: DeliveryHubProjectedCommitParityPreviewFieldKey
  label: string
  status: DeliveryHubProjectedCommitParityPreviewFieldStatus
  detail_label: string
}

export type DeliveryHubProjectedCommitParityPreviewReadinessBlocker =
  | "selection_unavailable"
  | "connection_unavailable"

export type DeliveryHubProjectedCommitParityPreviewParityBlocker =
  | "delivery_option_unavailable"
  | "selection_alignment_unavailable"

export type DeliveryHubProjectedCommitParityPreviewModel = {
  tone: "neutral" | "positive" | "warning"
  verdict: DeliveryHubProjectedCommitParityPreviewVerdict
  verdict_label: string
  summary_label: string
  projected_commit_label: string
  connection_id: string | null
  mode_code: DeliveryHubQuoteType | null
  mode_label: string | null
  quote_reference_present: boolean
  pickup_point_required: boolean
  pickup_point_present: boolean
  pickup_window_required: boolean
  pickup_window_present: boolean
  commit_payload_readiness: "informational_only" | "partial" | "matched" | "blocked"
  matched_field_count: number
  mismatched_field_count: number
  fields: DeliveryHubProjectedCommitParityPreviewField[]
  mismatch_reasons: string[]
  blocked_readiness_codes: DeliveryHubProjectedCommitParityPreviewReadinessBlocker[]
  blocked_parity_codes: DeliveryHubProjectedCommitParityPreviewParityBlocker[]
  dry_run_only: true
  mutation_intent: false
}

export type DeliveryHubSelectionWriteSeamPreviewVerdict =
  | "informational_only"
  | "write_shape_preview_available"
  | "write_shape_preview_incomplete"
  | "blocked"

export type DeliveryHubSelectionWriteSeamPreviewFieldKey =
  | "cart_id"
  | "connection_id"
  | "quote_type"
  | "quote_reference"
  | "quote"
  | "pickup_point"
  | "pickup_window"
  | "selection_version"
  | "shape_completeness"

export type DeliveryHubSelectionWriteSeamPreviewFieldStatus =
  | "projected"
  | "missing"
  | "blocked"
  | "informational_only"
  | "not_required"

export type DeliveryHubSelectionWriteSeamPreviewField = {
  key: DeliveryHubSelectionWriteSeamPreviewFieldKey
  label: string
  status: DeliveryHubSelectionWriteSeamPreviewFieldStatus
  detail_label: string
}

export type DeliveryHubSelectionWriteSeamPreviewBlocker =
  | "selection_unavailable"
  | "connection_unavailable"
  | "delivery_option_unavailable"
  | "selection_alignment_unavailable"

export type DeliveryHubSelectionWriteSeamPreviewProjectedPayload = {
  cart_id: string | null
  connection_id: string | null
  quote_type: DeliveryHubQuoteType | null
  quote_reference: DeliveryHubQuoteReference | null
  quote: DeliveryHubSelectionQuoteSummary | null
  pickup_point: DeliveryHubSelectionPickupPoint | null
  pickup_window: DeliveryHubSelectionPickupWindow | null
}

export type DeliveryHubSelectionWriteSeamPreviewModel = {
  tone: "neutral" | "positive" | "warning"
  verdict: DeliveryHubSelectionWriteSeamPreviewVerdict
  verdict_label: string
  summary_label: string
  projected_request_label: string
  cart_id: string | null
  connection_id: string | null
  quote_type: DeliveryHubQuoteType | null
  quote_type_label: string | null
  quote_reference_present: boolean
  quote_present: boolean
  pickup_point_required: boolean
  pickup_point_present: boolean
  pickup_window_required: boolean
  pickup_window_present: boolean
  selection_version: number | null
  shape_completeness: "informational_only" | "partial" | "complete" | "blocked"
  projected_payload: DeliveryHubSelectionWriteSeamPreviewProjectedPayload | null
  fields: DeliveryHubSelectionWriteSeamPreviewField[]
  projected_field_count: number
  missing_field_count: number
  blocked_codes: DeliveryHubSelectionWriteSeamPreviewBlocker[]
  mismatch_reasons: string[]
  dry_run_only: true
  mutation_intent: false
}

export type DeliveryHubWriteIntentContractPreviewStatus =
  | "informational_only"
  | "intent_shape_available"
  | "intent_incomplete"
  | "blocked"

export type DeliveryHubWriteIntentContractPreviewPrerequisiteKey =
  | "cart_id"
  | "connection_id"
  | "quote_type"
  | "quote_reference"
  | "quote"
  | "pickup_point"
  | "pickup_window"
  | "selection_version"
  | "shipping_option_parity"
  | "projected_commit_parity"
  | "selection_write_seam"

export type DeliveryHubWriteIntentContractPreviewPrerequisiteStatus =
  | "satisfied"
  | "missing"
  | "blocked"
  | "informational_only"
  | "not_required"

export type DeliveryHubWriteIntentContractPreviewPrerequisite = {
  key: DeliveryHubWriteIntentContractPreviewPrerequisiteKey
  label: string
  status: DeliveryHubWriteIntentContractPreviewPrerequisiteStatus
  detail_label: string
}

export type DeliveryHubWriteIntentContractPreviewDisabledAction =
  | "selection_action"
  | "persist_selection"
  | "clear_selection"
  | "set_shipping_method"
  | "network_request"

export type DeliveryHubWriteIntentContractPreviewBlockedReason =
  | DeliveryHubSelectionWriteSeamPreviewBlocker
  | "quote_reference_missing"
  | "pickup_point_missing"
  | "pickup_window_missing"

export type DeliveryHubWriteIntentContractPreviewModel = {
  tone: "neutral" | "positive" | "warning"
  status: DeliveryHubWriteIntentContractPreviewStatus
  status_label: string
  summary_label: string
  intent_target_label: string
  preview_label: string
  shopper_safe_intent_target: "POST /store/delivery/selection"
  required_prerequisite_count: number
  satisfied_prerequisite_count: number
  missing_prerequisite_count: number
  blocked_prerequisite_count: number
  prerequisites: DeliveryHubWriteIntentContractPreviewPrerequisite[]
  blocked_reasons: DeliveryHubWriteIntentContractPreviewBlockedReason[]
  disabled_actions: DeliveryHubWriteIntentContractPreviewDisabledAction[]
  hint_messages: string[]
  mutation_intent: false
  submit_enabled: false
  network_required_now: false
  dry_run_only: true
}

export type DeliveryHubSelectionPayloadParityPreviewVerdict =
  | "informational_only"
  | "matched"
  | "incomplete"
  | "blocked"

export type DeliveryHubSelectionPayloadParityPreviewFieldKey =
  | "connection_id"
  | "quote_type"
  | "quote_reference"
  | "pickup_point"
  | "pickup_window"
  | "selection_version"
  | "shape_completeness"
  | "blocked_reasons"

export type DeliveryHubSelectionPayloadParityPreviewFieldStatus =
  | "matched"
  | "incomplete"
  | "blocked"
  | "informational_only"
  | "not_required"

export type DeliveryHubSelectionPayloadParityPreviewField = {
  key: DeliveryHubSelectionPayloadParityPreviewFieldKey
  label: string
  status: DeliveryHubSelectionPayloadParityPreviewFieldStatus
  detail_label: string
}

export type DeliveryHubSelectionPayloadParityPreviewBlockedReason =
  | DeliveryHubSelectionWriteSeamPreviewBlocker
  | "quote_reference_missing"
  | "pickup_point_missing"
  | "pickup_window_missing"
  | "selection_version_missing"

export type DeliveryHubSelectionPayloadParityPreviewModel = {
  tone: "neutral" | "positive" | "warning"
  verdict: DeliveryHubSelectionPayloadParityPreviewVerdict
  verdict_label: string
  summary_label: string
  projected_payload_label: string
  expected_contract_label: string
  payload_target_label: string
  shopper_safe_payload_target: "POST /store/delivery/selection"
  connection_id: string | null
  quote_type: DeliveryHubQuoteType | null
  quote_type_label: string | null
  quote_reference_present: boolean
  pickup_point_required: boolean
  pickup_point_present: boolean
  pickup_window_required: boolean
  pickup_window_present: boolean
  selection_version: number | null
  shape_completeness: DeliveryHubSelectionWriteSeamPreviewModel["shape_completeness"]
  matched_field_count: number
  incomplete_field_count: number
  blocked_field_count: number
  fields: DeliveryHubSelectionPayloadParityPreviewField[]
  blocked_reasons: DeliveryHubSelectionPayloadParityPreviewBlockedReason[]
  hint_messages: string[]
  dry_run_only: true
  mutation_intent: false
  network_required_now: false
}

export type DeliveryHubShippingOptionParityPreviewVerdict =
  | "informational_only"
  | "parity_partial"
  | "parity_aligned"
  | "blocked"

export type DeliveryHubShippingOptionParityPreviewGapCode =
  | "missing_candidate"
  | "legacy_context_missing"
  | "legacy_context_stale"
  | "connection_not_ready"
  | "missing_connection_id"
  | "missing_mode_code"
  | "mode_mismatch"
  | "missing_quote_reference"
  | "missing_pickup_point"
  | "missing_pickup_window"

export type DeliveryHubShippingOptionParityPreviewSignalStatus =
  | "aligned"
  | "missing"
  | "mismatch"
  | "blocked"
  | "informational_only"
  | "not_applicable"

export type DeliveryHubShippingOptionParityPreviewSignal = {
  label: string
  status: DeliveryHubShippingOptionParityPreviewSignalStatus
  detail_label: string
}

export type DeliveryHubShippingOptionParityPreviewModel = {
  tone: "neutral" | "positive" | "warning"
  verdict: DeliveryHubShippingOptionParityPreviewVerdict
  verdict_label: string
  summary_label: string
  candidate_present: boolean
  connection_id: string | null
  mode_code: DeliveryHubQuoteType | null
  mode_label: string | null
  quote_reference_present: boolean
  pickup_point_required: boolean
  pickup_point_present: boolean
  pickup_window_required: boolean
  pickup_window_present: boolean
  connection_id_signal: DeliveryHubShippingOptionParityPreviewSignal
  mode_code_signal: DeliveryHubShippingOptionParityPreviewSignal
  quote_reference_signal: DeliveryHubShippingOptionParityPreviewSignal
  pickup_point_signal: DeliveryHubShippingOptionParityPreviewSignal
  pickup_window_signal: DeliveryHubShippingOptionParityPreviewSignal
  gap_codes: DeliveryHubShippingOptionParityPreviewGapCode[]
  hint_messages: string[]
  dry_run_only: true
  mutation_intent: false
}

export type DeliveryHubHandoffContractMatrixPreviewFragmentKey =
  | "connection"
  | "mode"
  | "quote"
  | "quote_reference"
  | "pickup_point"
  | "pickup_window"
  | "readiness_gate"
  | "parity_gate"

export type DeliveryHubHandoffContractMatrixPreviewFragmentStatus =
  | "present"
  | "missing"
  | "required_missing"
  | "blocked_by_readiness"
  | "blocked_by_parity"
  | "informational_only"

export type DeliveryHubHandoffContractMatrixPreviewVerdict =
  | "contract_complete"
  | "contract_incomplete"
  | "contract_blocked"
  | "informational_only"

export type DeliveryHubHandoffContractMatrixPreviewFragment = {
  key: DeliveryHubHandoffContractMatrixPreviewFragmentKey
  label: string
  status: DeliveryHubHandoffContractMatrixPreviewFragmentStatus
  detail_label: string
}

export type DeliveryHubHandoffContractMatrixPreviewModel = {
  tone: "neutral" | "positive" | "warning"
  verdict: DeliveryHubHandoffContractMatrixPreviewVerdict
  verdict_label: string
  completeness_label: string
  fragments: DeliveryHubHandoffContractMatrixPreviewFragment[]
  blocked_readiness_codes: DeliveryHubSelectionReadinessIssueCode[]
  blocked_parity_codes: DeliveryHubShippingOptionParityPreviewGapCode[]
  missing_fragment_keys: DeliveryHubHandoffContractMatrixPreviewFragmentKey[]
  hint_messages: string[]
  dry_run_only: true
  mutation_intent: false
}

export function getDeliveryHubReadinessStatusLabel(
  status: DeliveryHubSelectionReadinessStatus
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
  quoteType: DeliveryHubQuoteType | null | undefined
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

function getDeliveryHubShadowSelectionActionabilityLabel(
  status: DeliveryHubShadowSelectionActionabilityStatus
) {
  switch (status) {
    case "ready":
      return "action-ready"
    case "needs_quote":
      return "needs quote context"
    case "needs_pickup_point":
      return "needs pickup-point context"
    case "needs_pickup_window":
      return "needs pickup-window context"
    case "stale":
      return "stale sampled context"
    case "blocked_by_readiness":
      return "blocked by readiness"
    case "incomplete":
      return "incomplete"
  }
}

function getDeliveryHubShadowShippingOptionParityLabel(
  state: DeliveryHubShadowShippingOptionParityState
) {
  switch (state) {
    case "aligned":
      return "aligned"
    case "divergent":
      return "degraded"
    case "insufficient_context":
      return "insufficient context"
    case "not_applicable":
      return "not applicable"
  }
}

function getDeliveryHubShadowSelectionParityLabel(
  status: DeliveryHubShadowSelectionParityStatus
) {
  switch (status) {
    case "aligned":
      return "aligned"
    case "missing_legacy_method":
      return "missing legacy method"
    case "missing_neutral_selection":
      return "missing neutral selection"
    case "modality_mismatch":
      return "modality mismatch"
    case "reference_mismatch":
      return "reference mismatch"
    case "insufficient_data":
      return "insufficient data"
  }
}

function formatDeliveryHubCountLabel(
  count: number,
  singular: string,
  plural: string
) {
  return `${count} ${count === 1 ? singular : plural}`
}

function formatDeliveryHubPreviewCodeLabel(value: string) {
  return value.replace(/_/g, " ")
}

function getDeliveryHubPersistedSelectionReadinessBlockerLabel(
  blocker: DeliveryHubPersistedSelectionContractParityPreviewReadinessBlocker
) {
  switch (blocker) {
    case "selection_unavailable":
      return "selection unavailable"
    case "connection_unavailable":
      return "connection unavailable"
  }
}

function getDeliveryHubPersistedSelectionParityBlockerLabel(
  blocker: DeliveryHubPersistedSelectionContractParityPreviewParityBlocker
) {
  switch (blocker) {
    case "delivery_option_unavailable":
      return "delivery option unavailable"
    case "selection_alignment_unavailable":
      return "selection alignment unavailable"
  }
}

function sanitizeDeliveryHubPersistedSelectionReadinessBlockers(
  blockers: DeliveryHubSelectionReadinessIssueCode[]
): DeliveryHubPersistedSelectionContractParityPreviewReadinessBlocker[] {
  return Array.from(
    new Set(
      blockers.flatMap((blocker) => {
        switch (blocker) {
          case "selection_invalid":
            return ["selection_unavailable"]
          case "connection_missing":
          case "connection_not_found":
          case "connection_disabled":
          case "connection_inactive":
          case "connection_credentials_not_ready":
            return ["connection_unavailable"]
          default:
            return []
        }
      })
    )
  )
}

function sanitizeDeliveryHubPersistedSelectionParityBlockers(
  blockers: DeliveryHubShippingOptionParityPreviewGapCode[]
): DeliveryHubPersistedSelectionContractParityPreviewParityBlocker[] {
  return Array.from(
    new Set(
      blockers.flatMap((blocker) => {
        switch (blocker) {
          case "connection_not_ready":
            return ["delivery_option_unavailable"]
          case "mode_mismatch":
          case "legacy_context_stale":
            return ["selection_alignment_unavailable"]
          default:
            return []
        }
      })
    )
  )
}

function sanitizeDeliveryHubProjectedCommitReadinessBlockers(
  blockers: DeliveryHubSelectionReadinessIssueCode[]
): DeliveryHubProjectedCommitParityPreviewReadinessBlocker[] {
  return Array.from(
    new Set(
      blockers.flatMap((blocker) => {
        switch (blocker) {
          case "selection_invalid":
            return ["selection_unavailable"]
          case "connection_missing":
          case "connection_not_found":
          case "connection_disabled":
          case "connection_inactive":
          case "connection_credentials_not_ready":
            return ["connection_unavailable"]
          default:
            return []
        }
      })
    )
  )
}

function sanitizeDeliveryHubProjectedCommitParityBlockers(
  blockers: DeliveryHubShippingOptionParityPreviewGapCode[]
): DeliveryHubProjectedCommitParityPreviewParityBlocker[] {
  return Array.from(
    new Set(
      blockers.flatMap((blocker) => {
        switch (blocker) {
          case "connection_not_ready":
            return ["delivery_option_unavailable"]
          case "mode_mismatch":
          case "legacy_context_stale":
            return ["selection_alignment_unavailable"]
          default:
            return []
        }
      })
    )
  )
}

function formatDeliveryHubEtaLabel(
  minDays: number | null,
  maxDays: number | null
) {
  if (minDays === null && maxDays === null) {
    return null
  }

  if (minDays !== null && maxDays !== null) {
    if (minDays === maxDays) {
      return `ETA ${minDays} day${minDays === 1 ? "" : "s"}`
    }

    return `ETA ${minDays}–${maxDays} days`
  }

  if (minDays !== null) {
    return `ETA from ${minDays} day${minDays === 1 ? "" : "s"}`
  }

  return `ETA up to ${maxDays} day${maxDays === 1 ? "" : "s"}`
}

function buildDeliveryHubPersistedSelectionRelationHints(
  selection: DeliveryHubSelection | null,
  readiness: DeliveryHubReadinessResponse | null | undefined
) {
  const hints: string[] = []

  if (!selection) {
    if (readiness?.status === "missing_selection") {
      hints.push(
        "Readiness currently agrees that no neutral persisted selection is stored for this cart."
      )
    }

    return hints
  }

  if (!readiness) {
    hints.push(
      "Readiness summary is unavailable, so this block only reflects the last persisted neutral selection snapshot."
    )

    return hints
  }

  switch (readiness.status) {
    case "ready":
      hints.push("Persisted selection currently passes readiness checks.")
      break
    case "not_ready":
      hints.push(
        "Persisted selection is stored but still needs additional checkout context before it can become ready."
      )
      break
    case "invalid_selection":
      hints.push(
        "Persisted selection is stored but backend now marks it invalid for the current cart context."
      )
      break
    case "missing_selection":
      hints.push(
        "Readiness does not currently resolve this persisted selection, so checkout remains on the legacy flow."
      )
      break
  }

  hints.push(...readiness.issues.map((issue) => issue.message))

  return Array.from(new Set(hints.filter((message) => !!message)))
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
      readiness.quote_context?.connection.connection_id ?? readiness.selection?.connection_id ?? null,
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

export function buildDeliveryHubPersistedSelectionPreviewModel(
  selectionResponse: DeliveryHubSelectionResponse | null | undefined,
  readiness: DeliveryHubReadinessResponse | null | undefined
): DeliveryHubPersistedSelectionPreviewModel {
  if (!selectionResponse?.selection) {
    return {
      tone: "neutral",
      status_label: "Persisted selection missing",
      modality_label: null,
      quote_amount: null,
      currency_code: null,
      quote_eta_label: null,
      pickup_point_label: null,
      pickup_window_label: null,
      readiness_label: readiness ? getDeliveryHubReadinessStatusLabel(readiness.status) : null,
      hint_messages: buildDeliveryHubPersistedSelectionRelationHints(null, readiness),
      updated_at: null,
    }
  }

  const selection = selectionResponse.selection

  return {
    tone:
      readiness?.status === "ready"
        ? "positive"
        : readiness && readiness.status !== "missing_selection"
          ? "warning"
          : "neutral",
    status_label:
      readiness && readiness.status !== "ready"
        ? "Persisted selection requires attention"
        : "Persisted selection available",
    modality_label: getDeliveryHubQuoteTypeLabel(selection.quote_type),
    quote_amount: selection.quote.amount,
    currency_code: selection.quote.currency_code,
    quote_eta_label: formatDeliveryHubEtaLabel(
      selection.quote.delivery_eta_min,
      selection.quote.delivery_eta_max
    ),
    pickup_point_label: selection.pickup_point.name || selection.pickup_point.address,
    pickup_window_label: selection.pickup_window?.label ?? null,
    readiness_label: readiness ? getDeliveryHubReadinessStatusLabel(readiness.status) : null,
    hint_messages: buildDeliveryHubPersistedSelectionRelationHints(selection, readiness),
    updated_at: selection.updated_at,
  }
}

export function buildDeliveryHubShadowCatalogPreviewModel(
  preview: DeliveryHubShadowCatalogPreviewState
): DeliveryHubShadowCatalogPreviewModel {
  const availabilityLabel =
    preview.connection_count > 0
      ? `${formatDeliveryHubCountLabel(
          preview.connection_count,
          "connection",
          "connections"
        )} returned`
      : null
  const modalityLabel = preview.modality_labels.length
    ? preview.modality_labels.join(" · ")
    : null
  const capabilityHints = [
    preview.supports_pickup_points
      ? "Catalog indicates pickup-point support in the returned neutral connection set."
      : null,
    preview.supports_pickup_windows
      ? "Catalog indicates pickup-window support in the returned neutral connection set."
      : null,
    preview.supports_dropoff
      ? "Catalog indicates dropoff-origin support in the returned neutral connection set."
      : null,
  ].filter((message): message is string => !!message)

  if (preview.status === "idle") {
    return {
      tone: "neutral",
      status_label: "Shadow catalog not requested",
      default_connection_label: preview.default_connection_label,
      availability_label: availabilityLabel,
      modality_label: modalityLabel,
      hint_messages: [preview.issue_message, ...capabilityHints].filter(
        (message): message is string => !!message
      ),
    }
  }

  if (preview.status === "loading") {
    return {
      tone: "neutral",
      status_label: "Shadow catalog preview loading",
      default_connection_label: preview.default_connection_label,
      availability_label: null,
      modality_label: modalityLabel,
      hint_messages: [
        "Checking neutral catalog availability for the current checkout context.",
      ],
    }
  }

  if (preview.status === "error") {
    return {
      tone: "warning",
      status_label: "Shadow catalog preview unavailable",
      default_connection_label: preview.default_connection_label,
      availability_label: null,
      modality_label: modalityLabel,
      hint_messages: [
        preview.issue_message ??
          "Read-only shadow catalog preview is currently unavailable.",
      ],
    }
  }

  if (preview.connection_count === 0) {
    return {
      tone: "warning",
      status_label: "Shadow catalog unavailable",
      default_connection_label: preview.default_connection_label,
      availability_label: "0 connections returned",
      modality_label: modalityLabel,
      hint_messages: [
        preview.issue_message ??
          "No neutral catalog connections were returned for the current checkout context.",
      ],
    }
  }

  return {
    tone: preview.ready_connection_count > 0 ? "positive" : "neutral",
    status_label:
      preview.ready_connection_count > 0
        ? "Shadow catalog available"
        : "Shadow catalog returned without ready connections",
    default_connection_label: preview.default_connection_label,
    availability_label:
      preview.ready_connection_count > 0
        ? `${formatDeliveryHubCountLabel(
            preview.ready_connection_count,
            "ready connection",
            "ready connections"
          )} of ${formatDeliveryHubCountLabel(
            preview.connection_count,
            "connection",
            "connections"
          )} available`
        : `${formatDeliveryHubCountLabel(
            preview.connection_count,
            "connection",
            "connections"
          )} available · 0 ready`,
    modality_label: modalityLabel,
    hint_messages: [
      preview.default_connection_label
        ? `Default neutral catalog connection is ${preview.default_connection_label}.`
        : "Catalog did not nominate a default neutral connection.",
      ...capabilityHints,
      preview.ready_connection_count === 0
        ? "Returned catalog is informational only and does not currently expose a ready neutral connection."
        : null,
    ].filter((message): message is string => !!message),
  }
}

export function buildDeliveryHubShadowSettingsPreviewModel(
  preview: DeliveryHubShadowSettingsPreviewState
): DeliveryHubShadowSettingsPreviewModel {
  const modalityLabel = preview.modality_labels.length
    ? preview.modality_labels.join(" · ")
    : null
  const visibilityLabel = preview.preview_visibility_labels.length
    ? preview.preview_visibility_labels.join(" · ")
    : null
  const capabilityHints = [
    preview.supports_pickup_points
      ? "Settings indicate pickup-point preview visibility is enabled."
      : null,
    preview.supports_pickup_windows
      ? "Settings indicate pickup-window preview visibility is enabled."
      : null,
    preview.supports_dropoff
      ? "Settings indicate dropoff-origin modality visibility is enabled."
      : null,
  ].filter((message): message is string => !!message)

  if (preview.status === "idle") {
    return {
      tone: "neutral",
      status_label: "Shadow settings not requested",
      default_connection_label: preview.default_connection_label,
      availability_label: null,
      modality_label: modalityLabel,
      visibility_label: visibilityLabel,
      hint_messages: [preview.issue_message, ...preview.hint_messages, ...capabilityHints].filter(
        (message): message is string => !!message
      ),
    }
  }

  if (preview.status === "loading") {
    return {
      tone: "neutral",
      status_label: "Shadow settings preview loading",
      default_connection_label: preview.default_connection_label,
      availability_label: null,
      modality_label: modalityLabel,
      visibility_label: visibilityLabel,
      hint_messages: [
        "Checking neutral settings visibility for the current checkout context.",
      ],
    }
  }

  if (preview.status === "error") {
    return {
      tone: "warning",
      status_label: "Shadow settings preview unavailable",
      default_connection_label: preview.default_connection_label,
      availability_label: null,
      modality_label: modalityLabel,
      visibility_label: visibilityLabel,
      hint_messages: [
        preview.issue_message ??
          "Read-only shadow settings preview is currently unavailable.",
      ],
    }
  }

  if (!preview.enabled || preview.enabled_connection_count === 0) {
    return {
      tone: "warning",
      status_label: "Shadow settings unavailable",
      default_connection_label: preview.default_connection_label,
      availability_label: "0 connections visible",
      modality_label: modalityLabel,
      visibility_label: visibilityLabel,
      hint_messages: [
        preview.issue_message ??
          "Neutral storefront settings do not currently expose a shopper-visible delivery connection.",
        ...preview.hint_messages,
      ].filter((message): message is string => !!message),
    }
  }

  return {
    tone:
      preview.settings_status === "available"
        ? "positive"
        : preview.settings_status === "informational_only"
          ? "neutral"
          : "warning",
    status_label:
      preview.settings_status === "available"
        ? "Shadow settings available"
        : preview.settings_status === "informational_only"
          ? "Shadow settings informational only"
          : "Shadow settings unavailable",
    default_connection_label: preview.default_connection_label,
    availability_label:
      preview.ready_connection_count > 0
        ? `${formatDeliveryHubCountLabel(
            preview.ready_connection_count,
            "ready connection",
            "ready connections"
          )} of ${formatDeliveryHubCountLabel(
            preview.enabled_connection_count,
            "visible connection",
            "visible connections"
          )} visible`
        : `${formatDeliveryHubCountLabel(
            preview.enabled_connection_count,
            "visible connection",
            "visible connections"
          )} visible · 0 ready`,
    modality_label: modalityLabel,
    visibility_label: visibilityLabel,
    hint_messages: [
      preview.default_connection_label
        ? `Default neutral settings connection is ${preview.default_connection_label}.`
        : "Settings did not nominate a default neutral connection.",
      ...capabilityHints,
      ...preview.hint_messages,
      preview.settings_status === "informational_only"
        ? "Returned settings are currently informational only and do not claim a ready neutral checkout path."
        : null,
    ].filter((message): message is string => !!message),
  }
}

export function buildDeliveryHubShadowQuotePreviewModel(
  preview: DeliveryHubShadowQuotePreviewState
): DeliveryHubShadowQuotePreviewModel {
  const modalityLabel = getDeliveryHubQuoteTypeLabel(preview.quote_type)
  const representativePointHint =
    preview.pickup_point_count > 0
      ? `Preview is sampled against 1 of ${formatDeliveryHubCountLabel(
          preview.pickup_point_count,
          "pickup point",
          "pickup points"
        )} available for the current city.`
      : null

  if (preview.status === "idle") {
    return {
      tone: "neutral",
      status_label: "Shadow quotes not requested",
      connection_label: preview.connection_label,
      modality_label: modalityLabel,
      availability_label: null,
      hint_messages: preview.issue_message ? [preview.issue_message] : [],
    }
  }

  if (preview.status === "loading") {
    return {
      tone: "neutral",
      status_label: "Shadow quote preview loading",
      connection_label: preview.connection_label,
      modality_label: modalityLabel,
      availability_label: null,
      hint_messages: [
        "Checking neutral quote availability for the current checkout context.",
      ],
    }
  }

  if (preview.status === "error") {
    return {
      tone: "warning",
      status_label: "Shadow quote preview unavailable",
      connection_label: preview.connection_label,
      modality_label: modalityLabel,
      availability_label: null,
      hint_messages: [
        preview.issue_message ??
          "Read-only shadow quote preview is currently unavailable.",
      ],
    }
  }

  if (preview.quote_count > 0) {
    return {
      tone: "positive",
      status_label: "Shadow quotes available",
      connection_label: preview.connection_label,
      modality_label: modalityLabel,
      availability_label: `${formatDeliveryHubCountLabel(preview.quote_count, "quote", "quotes")} available`,
      hint_messages: [representativePointHint].filter(
        (message): message is string => !!message
      ),
    }
  }

  return {
    tone: "warning",
    status_label: "Shadow quotes unavailable",
    connection_label: preview.connection_label,
    modality_label: modalityLabel,
    availability_label: "0 quotes available",
    hint_messages: [
      preview.issue_message ??
        "No neutral shadow quotes were returned for the sampled checkout context.",
      representativePointHint,
    ].filter((message): message is string => !!message),
  }
}

export function buildDeliveryHubShadowPickupPointPreviewModel(
  preview: DeliveryHubShadowPickupPointPreviewState
): DeliveryHubShadowPickupPointPreviewModel {
  const modalityLabel = getDeliveryHubQuoteTypeLabel(preview.quote_type)
  const destinationPickupPointHint =
    preview.destination_pickup_point_count > 0
      ? `${formatDeliveryHubCountLabel(
          preview.destination_pickup_point_count,
          "pickup point matches",
          "pickup point matches"
        )} current destination pickup flow expectations.`
      : preview.pickup_point_count > 0
        ? "Current pickup-point sample is informational only and does not confirm destination-pickup eligibility."
        : null

  if (preview.status === "idle") {
    return {
      tone: "neutral",
      status_label: "Shadow pickup points not requested",
      connection_label: preview.connection_label,
      modality_label: modalityLabel,
      availability_label: null,
      hint_messages: [preview.issue_message].filter((message): message is string => !!message),
    }
  }

  if (preview.status === "loading") {
    return {
      tone: "neutral",
      status_label: "Shadow pickup-point preview loading",
      connection_label: preview.connection_label,
      modality_label: modalityLabel,
      availability_label: null,
      hint_messages: [
        "Checking neutral pickup-point availability for the current checkout context.",
      ],
    }
  }

  if (preview.status === "error") {
    return {
      tone: "warning",
      status_label: "Shadow pickup-point preview unavailable",
      connection_label: preview.connection_label,
      modality_label: modalityLabel,
      availability_label: null,
      hint_messages: [
        preview.issue_message ??
          "Read-only shadow pickup-point preview is currently unavailable.",
      ],
    }
  }

  if (preview.pickup_point_count > 0) {
    return {
      tone: preview.destination_pickup_point_count > 0 ? "positive" : "neutral",
      status_label: "Shadow pickup points available",
      connection_label: preview.connection_label,
      modality_label: modalityLabel,
      availability_label: `${formatDeliveryHubCountLabel(
        preview.pickup_point_count,
        "pickup point",
        "pickup points"
      )} available`,
      hint_messages: [destinationPickupPointHint].filter(
        (message): message is string => !!message
      ),
    }
  }

  return {
    tone: "warning",
    status_label: "Shadow pickup points unavailable",
    connection_label: preview.connection_label,
    modality_label: modalityLabel,
    availability_label: "0 pickup points available",
    hint_messages: [
      preview.issue_message ??
        "No neutral pickup points were returned for the current checkout context.",
      destinationPickupPointHint,
    ].filter((message): message is string => !!message),
  }
}

export function buildDeliveryHubShadowPickupWindowPreviewModel(
  preview: DeliveryHubShadowPickupWindowPreviewState
): DeliveryHubShadowPickupWindowPreviewModel {
  const modalityLabel = getDeliveryHubQuoteTypeLabel(preview.quote_type)
  const pickupWindowRequiredHint =
    preview.pickup_window_required_quote_count > 0
      ? `${formatDeliveryHubCountLabel(
          preview.pickup_window_required_quote_count,
          "sampled quote requires",
          "sampled quotes require"
        )} pickup-window context before a neutral selection can become ready.`
      : preview.quote_count > 0
        ? "Sampled neutral quotes currently do not indicate pickup-window requirement."
        : null

  if (preview.status === "idle") {
    return {
      tone: "neutral",
      status_label: "Shadow pickup windows not requested",
      connection_label: preview.connection_label,
      modality_label: modalityLabel,
      availability_label: null,
      hint_messages: [preview.issue_message, pickupWindowRequiredHint].filter(
        (message): message is string => !!message
      ),
    }
  }

  if (preview.status === "loading") {
    return {
      tone: "neutral",
      status_label: "Shadow pickup-window preview loading",
      connection_label: preview.connection_label,
      modality_label: modalityLabel,
      availability_label: null,
      hint_messages: [
        "Checking neutral pickup-window availability for the current checkout context.",
      ],
    }
  }

  if (preview.status === "error") {
    return {
      tone: "warning",
      status_label: "Shadow pickup-window preview unavailable",
      connection_label: preview.connection_label,
      modality_label: modalityLabel,
      availability_label: null,
      hint_messages: [
        preview.issue_message ??
          "Read-only shadow pickup-window preview is currently unavailable.",
      ],
    }
  }

  if (preview.pickup_window_count > 0) {
    return {
      tone: preview.pickup_window_required_quote_count > 0 ? "positive" : "neutral",
      status_label: "Shadow pickup windows available",
      connection_label: preview.connection_label,
      modality_label: modalityLabel,
      availability_label: `${formatDeliveryHubCountLabel(
        preview.pickup_window_count,
        "pickup window",
        "pickup windows"
      )} available`,
      hint_messages: [pickupWindowRequiredHint].filter(
        (message): message is string => !!message
      ),
    }
  }

  return {
    tone: preview.pickup_window_required_quote_count > 0 ? "warning" : "neutral",
    status_label: "Shadow pickup windows unavailable",
    connection_label: preview.connection_label,
    modality_label: modalityLabel,
    availability_label: "0 pickup windows available",
    hint_messages: [
      preview.issue_message ??
        "No neutral pickup windows were returned for the sampled checkout context.",
      pickupWindowRequiredHint,
    ].filter((message): message is string => !!message),
  }
}

function hasDeliveryHubReadinessIssue(
  readiness: DeliveryHubReadinessResponse | null | undefined,
  codes: DeliveryHubSelectionReadinessIssueCode[]
) {
  return (
    readiness?.issues.some((issue) =>
      codes.includes(issue.code as DeliveryHubSelectionReadinessIssueCode)
    ) ?? false
  )
}

function uniqueDeliveryHubMessages(messages: Array<string | null | undefined>) {
  return Array.from(new Set(messages.filter((message): message is string => !!message)))
}

function getDeliveryHubSelectionParityModalityLabel(
  flowKind: "pickup_point" | "door_delivery" | null
) {
  switch (flowKind) {
    case "pickup_point":
      return "Pickup point"
    case "door_delivery":
      return "Door delivery"
    default:
      return null
  }
}

function getDeliveryHubSelectionParityFlowKind(
  selection: DeliveryHubSelection | null | undefined
): "pickup_point" | "door_delivery" | null {
  if (!selection) {
    return null
  }

  switch (selection.quote_type) {
    case "warehouse_to_pickup_point":
    case "dropoff_point_to_pickup_point":
      return "pickup_point"
    default:
      return selection.quote.pickup_point_required ? "pickup_point" : null
  }
}

function normalizeDeliveryHubComparableText(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase().replace(/\s+/g, " ") ?? ""

  return normalized || null
}

export function buildDeliveryHubShadowShippingOptionParityPreviewModel(
  preview: DeliveryHubShadowShippingOptionParityPreviewState
): DeliveryHubShadowShippingOptionParityPreviewModel {
  const shadowModalityLabel = getDeliveryHubQuoteTypeLabel(preview.shadow_quote_type)
  const detailLabel = [
    preview.shadow_quote_preview_status === "ready"
      ? formatDeliveryHubCountLabel(preview.shadow_quote_count, "sampled quote", "sampled quotes")
      : null,
    preview.shadow_pickup_point_preview_status === "ready"
      ? formatDeliveryHubCountLabel(
          preview.shadow_destination_pickup_point_count,
          "destination-compatible pickup point",
          "destination-compatible pickup points"
        )
      : null,
  ].filter((message): message is string => !!message)

  if (!preview.legacy_is_committed) {
    return {
      tone: "neutral",
      parity_state: "not_applicable",
      status_label: "No committed legacy method to compare",
      legacy_method_label: preview.legacy_method_label,
      shadow_modality_label: shadowModalityLabel,
      detail_label: detailLabel.join(" · ") || null,
      hint_messages: uniqueDeliveryHubMessages([
        "Parity preview activates only when checkout already has a committed legacy shipping method.",
        ...preview.issue_messages,
      ]),
    }
  }

  if (!preview.legacy_flow_kind) {
    return {
      tone: "warning",
      parity_state: "insufficient_context",
      status_label: "Committed legacy method lacks parity context",
      legacy_method_label: preview.legacy_method_label,
      shadow_modality_label: shadowModalityLabel,
      detail_label: detailLabel.join(" · ") || null,
      hint_messages: uniqueDeliveryHubMessages([
        "Checkout has a committed legacy method, but its shopper-visible delivery shape could not be classified for neutral parity comparison.",
        ...preview.issue_messages,
      ]),
    }
  }

  if (preview.legacy_flow_kind === "door_delivery") {
    return {
      tone: "neutral",
      parity_state: "not_applicable",
      status_label: "Current legacy method is outside sampled shadow scope",
      legacy_method_label: preview.legacy_method_label,
      shadow_modality_label: shadowModalityLabel,
      detail_label: detailLabel.join(" · ") || null,
      hint_messages: uniqueDeliveryHubMessages([
        "Current committed legacy method is door delivery, while the sampled neutral shadow context only covers pickup-point delivery parity.",
        ...preview.issue_messages,
      ]),
    }
  }

  if (!preview.legacy_selection_fresh) {
    return {
      tone: "warning",
      parity_state: "insufficient_context",
      status_label: "Committed legacy context changed since commit",
      legacy_method_label: preview.legacy_method_label,
      shadow_modality_label: shadowModalityLabel,
      detail_label: detailLabel.join(" · ") || null,
      hint_messages: uniqueDeliveryHubMessages([
        "Legacy committed shipping data no longer matches the current address fingerprint, so parity remains informational until the legacy flow is recommitted.",
        ...preview.issue_messages,
      ]),
    }
  }

  const loading =
    preview.shadow_settings_status === "loading" ||
    preview.shadow_quote_preview_status === "loading" ||
    preview.shadow_pickup_point_preview_status === "loading"

  if (loading) {
    return {
      tone: "neutral",
      parity_state: "insufficient_context",
      status_label: "Shadow parity sampling in progress",
      legacy_method_label: preview.legacy_method_label,
      shadow_modality_label: shadowModalityLabel,
      detail_label: detailLabel.join(" · ") || null,
      hint_messages: [
        "Shadow settings, quote, and pickup-point previews are still loading for the current checkout context.",
      ],
    }
  }

  if (preview.shadow_settings_surface_status === "informational_only") {
    return {
      tone: "neutral",
      parity_state: "insufficient_context",
      status_label: "Shadow parity remains informational only",
      legacy_method_label: preview.legacy_method_label,
      shadow_modality_label: shadowModalityLabel,
      detail_label: detailLabel.join(" · ") || null,
      hint_messages: uniqueDeliveryHubMessages([
        "Neutral settings are currently informational only, so this preview does not claim shipping-option parity or mismatch against the committed legacy method.",
        ...preview.issue_messages,
      ]),
    }
  }

  const failed =
    preview.shadow_settings_status === "error" ||
    preview.shadow_quote_preview_status === "error" ||
    preview.shadow_pickup_point_preview_status === "error"
  const incomplete =
    preview.shadow_settings_status !== "ready" ||
    preview.shadow_quote_preview_status !== "ready" ||
    preview.shadow_pickup_point_preview_status !== "ready" ||
    !preview.shadow_settings_surface_status

  if (failed || incomplete) {
    return {
      tone: failed ? "warning" : "neutral",
      parity_state: "insufficient_context",
      status_label: failed
        ? "Shadow parity context unavailable"
        : "Shadow parity context incomplete",
      legacy_method_label: preview.legacy_method_label,
      shadow_modality_label: shadowModalityLabel,
      detail_label: detailLabel.join(" · ") || null,
      hint_messages: uniqueDeliveryHubMessages([
        failed
          ? "One or more read-only shadow previews are currently unavailable, so parity cannot be compared for the current checkout context."
          : "Shadow parity needs the already loaded settings, quote, and pickup-point previews before it can compare the committed legacy method.",
        ...preview.issue_messages,
      ]),
    }
  }

  if (
    !preview.shadow_settings_enabled ||
    preview.shadow_settings_surface_status === "unavailable" ||
    preview.shadow_ready_connection_count === 0
  ) {
    return {
      tone: "warning",
      parity_state: "divergent",
      status_label: "Sampled shadow surface diverges from committed legacy method",
      legacy_method_label: preview.legacy_method_label,
      shadow_modality_label: shadowModalityLabel,
      detail_label: detailLabel.join(" · ") || null,
      hint_messages: uniqueDeliveryHubMessages([
        "Legacy checkout currently has a committed pickup-point method, but the sampled neutral shadow surface does not expose a ready pickup-point delivery path.",
        ...preview.issue_messages,
      ]),
    }
  }

  if (preview.shadow_quote_count === 0) {
    return {
      tone: "warning",
      parity_state: "divergent",
      status_label: "Sampled quote parity diverges",
      legacy_method_label: preview.legacy_method_label,
      shadow_modality_label: shadowModalityLabel,
      detail_label: detailLabel.join(" · ") || null,
      hint_messages: uniqueDeliveryHubMessages([
        "Legacy checkout currently has a committed pickup-point method, but sampled neutral quotes are not currently returned for the same checkout context.",
        ...preview.issue_messages,
      ]),
    }
  }

  if (preview.shadow_destination_pickup_point_count === 0) {
    return {
      tone: "warning",
      parity_state: "divergent",
      status_label: "Sampled pickup-point parity diverges",
      legacy_method_label: preview.legacy_method_label,
      shadow_modality_label: shadowModalityLabel,
      detail_label: detailLabel.join(" · ") || null,
      hint_messages: uniqueDeliveryHubMessages([
        "Legacy checkout currently has a committed pickup-point method, but sampled neutral pickup-point availability is not currently returned for the same checkout context.",
        ...preview.issue_messages,
      ]),
    }
  }

  return {
    tone: "positive",
    parity_state: "aligned",
    status_label: "Sampled shadow parity aligns",
    legacy_method_label: preview.legacy_method_label,
    shadow_modality_label: shadowModalityLabel,
    detail_label: detailLabel.join(" · ") || null,
    hint_messages: [
      "Legacy checkout currently has a committed pickup-point method, and the sampled neutral shadow context also returns pickup-point availability plus sampled quotes for the same checkout context.",
    ],
  }
}

export function buildDeliveryHubShadowSelectionParityPreviewModel(
  preview: DeliveryHubShadowSelectionParityPreviewState
): DeliveryHubShadowSelectionParityPreviewModel {
  const readinessLabel = preview.readiness_status
    ? getDeliveryHubReadinessStatusLabel(preview.readiness_status)
    : null
  const legacyModalityLabel = getDeliveryHubSelectionParityModalityLabel(
    preview.legacy_flow_kind
  )
  const neutralSelection = preview.neutral_selection
  const neutralFlowKind = getDeliveryHubSelectionParityFlowKind(neutralSelection)
  const neutralModalityLabel = neutralSelection
    ? getDeliveryHubSelectionParityModalityLabel(neutralFlowKind) ??
      getDeliveryHubQuoteTypeLabel(neutralSelection.quote_type)
    : null
  const legacyReferenceLabel = preview.legacy_reference_label
  const neutralReferenceLabel =
    neutralSelection?.pickup_point.name?.trim() ||
    neutralSelection?.pickup_point.address?.trim() ||
    null
  const comparableLegacyReference = normalizeDeliveryHubComparableText(
    preview.legacy_reference_detail_label ?? legacyReferenceLabel
  )
  const comparableNeutralReference = normalizeDeliveryHubComparableText(
    neutralSelection?.pickup_point.address?.trim() ?? neutralReferenceLabel
  )
  const hasComparableAddressReference =
    !!normalizeDeliveryHubComparableText(preview.legacy_reference_detail_label) &&
    !!normalizeDeliveryHubComparableText(
      neutralSelection?.pickup_point.address?.trim() ?? null
    )

  if (!preview.legacy_is_committed) {
    return {
      tone: "neutral",
      parity_status: "missing_legacy_method",
      status_label: "No committed legacy method to compare",
      legacy_method_label: preview.legacy_method_label,
      legacy_modality_label: legacyModalityLabel,
      neutral_modality_label: neutralModalityLabel,
      legacy_reference_label: legacyReferenceLabel,
      neutral_reference_label: neutralReferenceLabel,
      readiness_label: readinessLabel,
      hint_messages: uniqueDeliveryHubMessages([
        "Selection parity preview activates only when checkout already has a committed legacy shipping method.",
        ...preview.issue_messages,
      ]),
    }
  }

  if (preview.neutral_selection_status === "loading") {
    return {
      tone: "neutral",
      parity_status: "insufficient_data",
      status_label: "Persisted neutral selection preview loading",
      legacy_method_label: preview.legacy_method_label,
      legacy_modality_label: legacyModalityLabel,
      neutral_modality_label: neutralModalityLabel,
      legacy_reference_label: legacyReferenceLabel,
      neutral_reference_label: neutralReferenceLabel,
      readiness_label: readinessLabel,
      hint_messages: [
        "Persisted neutral selection is still loading, so checkout currently shows informational parity sampling only.",
      ],
    }
  }

  if (
    preview.neutral_selection_status === "idle" ||
    preview.neutral_selection_status === "error"
  ) {
    return {
      tone: preview.neutral_selection_status === "error" ? "warning" : "neutral",
      parity_status: "insufficient_data",
      status_label:
        preview.neutral_selection_status === "error"
          ? "Persisted neutral selection preview unavailable"
          : "Persisted neutral selection preview not requested",
      legacy_method_label: preview.legacy_method_label,
      legacy_modality_label: legacyModalityLabel,
      neutral_modality_label: neutralModalityLabel,
      legacy_reference_label: legacyReferenceLabel,
      neutral_reference_label: neutralReferenceLabel,
      readiness_label: readinessLabel,
      hint_messages: uniqueDeliveryHubMessages([
        "Persisted neutral selection preview is unavailable, so this comparison remains informational only.",
        ...preview.issue_messages,
      ]),
    }
  }

  if (!neutralSelection) {
    return {
      tone: "warning",
      parity_status: "missing_neutral_selection",
      status_label: "Neutral persisted selection missing",
      legacy_method_label: preview.legacy_method_label,
      legacy_modality_label: legacyModalityLabel,
      neutral_modality_label: null,
      legacy_reference_label: legacyReferenceLabel,
      neutral_reference_label: null,
      readiness_label: readinessLabel,
      hint_messages: uniqueDeliveryHubMessages([
        "Legacy checkout currently has a committed shipping method, but no neutral persisted selection is stored for this cart.",
        ...preview.issue_messages,
      ]),
    }
  }

  if (!preview.legacy_flow_kind) {
    return {
      tone: "warning",
      parity_status: "insufficient_data",
      status_label: "Committed legacy method lacks comparison context",
      legacy_method_label: preview.legacy_method_label,
      legacy_modality_label: legacyModalityLabel,
      neutral_modality_label: neutralModalityLabel,
      legacy_reference_label: legacyReferenceLabel,
      neutral_reference_label: neutralReferenceLabel,
      readiness_label: readinessLabel,
      hint_messages: uniqueDeliveryHubMessages([
        "Checkout has a committed legacy method, but its shopper-visible delivery shape could not be classified for neutral selection parity comparison.",
        ...preview.issue_messages,
      ]),
    }
  }

  if (!preview.legacy_selection_fresh) {
    return {
      tone: "warning",
      parity_status: "insufficient_data",
      status_label: "Committed legacy context changed since commit",
      legacy_method_label: preview.legacy_method_label,
      legacy_modality_label: legacyModalityLabel,
      neutral_modality_label: neutralModalityLabel,
      legacy_reference_label: legacyReferenceLabel,
      neutral_reference_label: neutralReferenceLabel,
      readiness_label: readinessLabel,
      hint_messages: uniqueDeliveryHubMessages([
        "Legacy committed shipping data no longer matches the current address fingerprint, so parity remains informational until the legacy flow is recommitted.",
        ...preview.issue_messages,
      ]),
    }
  }

  if (!neutralFlowKind) {
    return {
      tone: "warning",
      parity_status: "insufficient_data",
      status_label: "Neutral selection lacks comparison context",
      legacy_method_label: preview.legacy_method_label,
      legacy_modality_label: legacyModalityLabel,
      neutral_modality_label: neutralModalityLabel,
      legacy_reference_label: legacyReferenceLabel,
      neutral_reference_label: neutralReferenceLabel,
      readiness_label: readinessLabel,
      hint_messages: uniqueDeliveryHubMessages([
        "Persisted neutral selection currently lacks enough shopper-safe modality context for parity comparison.",
        ...preview.issue_messages,
      ]),
    }
  }

  if (preview.legacy_flow_kind !== neutralFlowKind) {
    return {
      tone: "warning",
      parity_status: "modality_mismatch",
      status_label: "Committed legacy modality differs from neutral selection",
      legacy_method_label: preview.legacy_method_label,
      legacy_modality_label: legacyModalityLabel,
      neutral_modality_label: neutralModalityLabel,
      legacy_reference_label: legacyReferenceLabel,
      neutral_reference_label: neutralReferenceLabel,
      readiness_label: readinessLabel,
      hint_messages: uniqueDeliveryHubMessages([
        "Committed legacy delivery shape and persisted neutral selection currently point to different shopper-visible modalities.",
        ...preview.issue_messages,
      ]),
    }
  }

  if (!comparableLegacyReference || !comparableNeutralReference) {
    return {
      tone: "neutral",
      parity_status: "insufficient_data",
      status_label: "Pickup reference comparison needs more context",
      legacy_method_label: preview.legacy_method_label,
      legacy_modality_label: legacyModalityLabel,
      neutral_modality_label: neutralModalityLabel,
      legacy_reference_label: legacyReferenceLabel,
      neutral_reference_label: neutralReferenceLabel,
      readiness_label: readinessLabel,
      hint_messages: uniqueDeliveryHubMessages([
        "Legacy and neutral selection previews agree on shopper-visible modality, but pickup reference comparison is still incomplete.",
        ...preview.issue_messages,
      ]),
    }
  }

  if (comparableLegacyReference !== comparableNeutralReference) {
    if (!hasComparableAddressReference) {
      return {
        tone: "neutral",
        parity_status: "insufficient_data",
        status_label: "Pickup reference comparison remains approximate",
        legacy_method_label: preview.legacy_method_label,
        legacy_modality_label: legacyModalityLabel,
        neutral_modality_label: neutralModalityLabel,
        legacy_reference_label: legacyReferenceLabel,
        neutral_reference_label: neutralReferenceLabel,
        readiness_label: readinessLabel,
        hint_messages: uniqueDeliveryHubMessages([
          "Legacy and neutral selection previews both point to pickup delivery, but current shopper-safe reference labels are not strong enough to claim alignment or mismatch.",
          ...preview.issue_messages,
        ]),
      }
    }

    return {
      tone: "warning",
      parity_status: "reference_mismatch",
      status_label: "Committed legacy pickup reference differs from neutral selection",
      legacy_method_label: preview.legacy_method_label,
      legacy_modality_label: legacyModalityLabel,
      neutral_modality_label: neutralModalityLabel,
      legacy_reference_label: legacyReferenceLabel,
      neutral_reference_label: neutralReferenceLabel,
      readiness_label: readinessLabel,
      hint_messages: uniqueDeliveryHubMessages([
        "Committed legacy pickup-point context and persisted neutral selection currently reference different shopper-visible pickup locations.",
        ...preview.issue_messages,
      ]),
    }
  }

  return {
    tone: "positive",
    parity_status: "aligned",
    status_label: "Committed legacy selection aligns with neutral selection preview",
    legacy_method_label: preview.legacy_method_label,
    legacy_modality_label: legacyModalityLabel,
    neutral_modality_label: neutralModalityLabel,
    legacy_reference_label: legacyReferenceLabel,
    neutral_reference_label: neutralReferenceLabel,
    readiness_label: readinessLabel,
    hint_messages: uniqueDeliveryHubMessages([
      "Committed legacy shipping context and persisted neutral selection currently align on shopper-visible modality and pickup reference.",
      ...preview.issue_messages,
    ]),
  }
}

export function buildDeliveryHubShadowSelectionActionabilityPreviewModel(
  preview: DeliveryHubShadowSelectionActionabilityPreviewState
): DeliveryHubShadowSelectionActionabilityPreviewModel {
  const readiness = preview.readiness ?? null
  const selection = preview.selection_response?.selection ?? readiness?.selection ?? null
  const readinessLabel = readiness ? getDeliveryHubReadinessStatusLabel(readiness.status) : null
  const connectionLabel =
    readiness?.quote_context?.connection.connection_id ?? selection?.connection_id ?? null
  const modalityLabel = getDeliveryHubQuoteTypeLabel(
    selection?.quote_type ?? readiness?.quote_context?.quote_type ?? null
  )
  const loading =
    preview.settings_status === "loading" ||
    preview.quote_preview_status === "loading" ||
    preview.pickup_point_preview_status === "loading" ||
    (preview.pickup_window_required_quote_count > 0 &&
      preview.pickup_window_preview_status === "loading")
  const blockedBySettings =
    preview.settings_status === "ready" &&
    (!preview.settings_enabled ||
      preview.settings_surface_status === "unavailable" ||
      preview.ready_connection_count === 0)
  const blockedByReadiness =
    readiness?.status === "invalid_selection" ||
    hasDeliveryHubReadinessIssue(readiness, [
      "selection_invalid",
      "connection_missing",
      "connection_not_found",
      "connection_disabled",
      "connection_inactive",
      "connection_credentials_not_ready",
    ])
  const quoteMissingInSample =
    preview.quote_preview_status === "ready" && preview.quote_count === 0
  const pickupPointMissingInSample =
    preview.pickup_point_preview_status === "ready" &&
    preview.destination_pickup_point_count === 0
  const pickupWindowMissingInSample =
    preview.pickup_window_preview_status === "ready" &&
    preview.pickup_window_required_quote_count > 0 &&
    preview.pickup_window_count === 0
  const staleSelection =
    !!selection &&
    (quoteMissingInSample ||
      (selection.quote.pickup_point_required && pickupPointMissingInSample) ||
      (selection.quote.pickup_window_required && pickupWindowMissingInSample))
  const needsPickupPoint = hasDeliveryHubReadinessIssue(readiness, ["pickup_point_missing"])
  const needsPickupWindow = hasDeliveryHubReadinessIssue(readiness, ["pickup_window_missing"])
  const incomplete =
    preview.quote_preview_status === "idle" ||
    preview.pickup_point_preview_status === "idle" ||
    (preview.pickup_window_required_quote_count > 0 &&
      preview.pickup_window_preview_status === "idle") ||
    preview.quote_preview_status === "error"

  if (loading) {
    return {
      tone: "neutral",
      actionability_status: "incomplete",
      status_label: "Shadow selection actionability loading",
      connection_label: connectionLabel,
      modality_label: modalityLabel,
      readiness_label: readinessLabel,
      hint_messages: [
        "Checking whether the current neutral selection and sampled preview constellation looks action-ready.",
      ],
    }
  }

  if (blockedBySettings || blockedByReadiness) {
    return {
      tone: "warning",
      actionability_status: "blocked_by_readiness",
      status_label: "Blocked by readiness",
      connection_label: connectionLabel,
      modality_label: modalityLabel,
      readiness_label: readinessLabel,
      hint_messages: uniqueDeliveryHubMessages([
        blockedBySettings
          ? preview.settings_surface_status === "informational_only"
            ? "Neutral settings are currently informational only, so this preview does not claim an action-ready checkout path."
            : "Neutral storefront settings do not currently expose a ready delivery connection."
          : null,
        preview.settings_issue_message,
        ...((readiness?.issues ?? []).map((issue) => issue.message) ?? []),
      ]),
    }
  }

  if (staleSelection) {
    return {
      tone: "warning",
      actionability_status: "stale",
      status_label: "Sampled context looks stale",
      connection_label: connectionLabel,
      modality_label: modalityLabel,
      readiness_label: readinessLabel,
      hint_messages: uniqueDeliveryHubMessages([
        quoteMissingInSample
          ? "Persisted neutral selection exists, but sampled shadow quotes are no longer returned for the current checkout context."
          : null,
        selection?.quote.pickup_point_required && pickupPointMissingInSample
          ? "Persisted neutral selection still expects pickup-point support, but the sampled pickup-point preview no longer returns destination-compatible points."
          : null,
        selection?.quote.pickup_window_required && pickupWindowMissingInSample
          ? "Persisted neutral selection still expects pickup-window support, but the sampled pickup-window preview no longer returns available windows."
          : null,
        preview.quote_issue_message,
        preview.pickup_point_issue_message,
        preview.pickup_window_issue_message,
      ]),
    }
  }

  if (needsPickupWindow) {
    return {
      tone: "warning",
      actionability_status: "needs_pickup_window",
      status_label: "Pickup-window context still needed",
      connection_label: connectionLabel,
      modality_label: modalityLabel,
      readiness_label: readinessLabel,
      hint_messages: uniqueDeliveryHubMessages([
        ...((readiness?.issues ?? []).map((issue) => issue.message) ?? []),
        preview.pickup_window_required_quote_count > 0 && preview.pickup_window_count > 0
          ? "Sampled pickup-window preview indicates that neutral pickup-window options are available."
          : null,
        preview.pickup_window_required_quote_count > 0 && preview.pickup_window_count === 0
          ? "Sampled quote context indicates pickup-window requirement, but no pickup windows are currently returned."
          : null,
        preview.pickup_window_issue_message,
      ]),
    }
  }

  if (needsPickupPoint) {
    return {
      tone: "warning",
      actionability_status: "needs_pickup_point",
      status_label: "Pickup-point context still needed",
      connection_label: connectionLabel,
      modality_label: modalityLabel,
      readiness_label: readinessLabel,
      hint_messages: uniqueDeliveryHubMessages([
        ...((readiness?.issues ?? []).map((issue) => issue.message) ?? []),
        preview.destination_pickup_point_count > 0
          ? "Sampled pickup-point preview indicates destination-compatible pickup points are available."
          : "Sampled pickup-point preview does not currently return destination-compatible points.",
        preview.pickup_point_issue_message,
      ]),
    }
  }

  if (readiness?.status === "ready") {
    return {
      tone: "positive",
      actionability_status: "ready",
      status_label: "Action-ready preview",
      connection_label: connectionLabel,
      modality_label: modalityLabel,
      readiness_label: readinessLabel,
      hint_messages: uniqueDeliveryHubMessages([
        "Persisted neutral selection currently passes readiness checks and sampled shadow data does not signal a stale checkout constellation.",
        preview.pickup_window_required_quote_count > 0 && preview.pickup_window_count > 0
          ? "Sampled pickup-window preview remains available for the current checkout context."
          : null,
      ]),
    }
  }

  if (!selection) {
    return {
      tone: preview.quote_count > 0 ? "neutral" : "warning",
      actionability_status: "needs_quote",
      status_label: "Quote context still needed",
      connection_label: connectionLabel,
      modality_label: modalityLabel,
      readiness_label: readinessLabel,
      hint_messages: uniqueDeliveryHubMessages([
        preview.quote_count > 0
          ? "Sampled neutral quotes are available, but no neutral selection is currently persisted for this cart."
          : "No neutral selection is currently persisted, and the sampled quote preview did not return available quotes for the current checkout context."
            ,
        preview.quote_issue_message,
      ]),
    }
  }

  if (incomplete) {
    return {
      tone: "neutral",
      actionability_status: "incomplete",
      status_label: "Neutral preview context incomplete",
      connection_label: connectionLabel,
      modality_label: modalityLabel,
      readiness_label: readinessLabel,
      hint_messages: uniqueDeliveryHubMessages([
        preview.quote_issue_message,
        preview.pickup_point_issue_message,
        preview.pickup_window_issue_message,
        "Current shadow selection actionability remains informational because sampled preview context is incomplete.",
      ]),
    }
  }

  return {
    tone: "neutral",
    actionability_status: "needs_quote",
    status_label: "Quote context still needed",
    connection_label: connectionLabel,
    modality_label: modalityLabel,
    readiness_label: readinessLabel,
    hint_messages: uniqueDeliveryHubMessages([
      "Current neutral preview constellation is informational only and does not yet imply a committed checkout selection.",
      preview.quote_issue_message,
    ]),
  }
}

function getDeliveryHubNeutralQuoteReference(
  input: DeliveryHubNeutralSelectionRehearsalInput,
  quote: DeliveryHubQuote | null,
  selection: DeliveryHubSelection | null
) {
  return (
    selection?.quote_reference ??
    quote?.quote_reference ??
    input.readiness?.quote_context?.quote_reference ??
    null
  )
}

function getDeliveryHubNeutralCandidateConnectionSummary(
  input: DeliveryHubNeutralSelectionRehearsalInput,
  selection: DeliveryHubSelection | null
) {
  const readinessConnection = input.readiness?.quote_context?.connection ?? null

  if (readinessConnection) {
    return readinessConnection
  }

  if (selection?.connection_id) {
    return {
      connection_id: selection.connection_id,
      state: "ready" as DeliveryHubConnectionState,
      ready: true,
    }
  }

  return {
    connection_id: null,
    state: "missing" as DeliveryHubConnectionState,
    ready: false,
  }
}

function getDeliveryHubNeutralRehearsalCandidate(
  input: DeliveryHubNeutralSelectionRehearsalInput
) {
  const selection =
    input.persisted_selection?.selection ?? input.readiness?.selection ?? null
  const quote = input.quotes?.quotes[0] ?? null
  const pickupPoint =
    selection?.pickup_point ??
    input.pickup_points?.points.find((point) => point.is_destination_pickup_allowed) ??
    input.pickup_points?.points[0] ??
    null
  const pickupWindow = selection?.pickup_window ?? input.pickup_windows?.pickup_windows[0] ?? null
  const quoteReference = getDeliveryHubNeutralQuoteReference(input, quote, selection)
  const quoteType =
    selection?.quote_type ?? quote?.mode_code ?? input.readiness?.quote_context?.quote_type ?? null
  const quoteSummary = selection?.quote ?? quote ?? null
  const pickupPointRequired =
    selection?.quote.pickup_point_required ??
    quote?.pickup_point_required ??
    input.readiness?.quote_context?.pickup_point_required ??
    false
  const pickupWindowRequired =
    selection?.quote.pickup_window_required ??
    quote?.pickup_window_required ??
    input.readiness?.quote_context?.pickup_window_required ??
    false

  return {
    selection,
    quote,
    pickupPoint,
    pickupWindow,
    quoteReference,
    quoteType,
    quoteSummary,
    pickupPointRequired,
    pickupWindowRequired,
    connection: getDeliveryHubNeutralCandidateConnectionSummary(input, selection),
  }
}

function getDeliveryHubNeutralRehearsalBlockers(
  input: DeliveryHubNeutralSelectionRehearsalInput
) {
  const candidate = getDeliveryHubNeutralRehearsalCandidate(input)
  const blockers: DeliveryHubNeutralSelectionRehearsalBlockerCode[] = []
  const readiness = input.readiness ?? null
  const settings = input.settings ?? null
  const legacyContext = input.legacy_context ?? null
  const parityMismatch =
    input.shipping_option_parity?.parity_state === "divergent" ||
    input.selection_parity?.parity_status === "modality_mismatch" ||
    input.selection_parity?.parity_status === "reference_mismatch"

  const pushBlocker = (code: DeliveryHubNeutralSelectionRehearsalBlockerCode) => {
    if (!blockers.includes(code)) {
      blockers.push(code)
    }
  }

  if (
    settings &&
    (!settings.settings.enabled ||
      settings.settings.status === "unavailable" ||
      settings.settings.summary.ready_connection_count === 0)
  ) {
    pushBlocker("settings_unavailable")
  }

  if (
    readiness &&
    readiness.status !== "ready" &&
    readiness.status !== "missing_selection"
  ) {
    pushBlocker("readiness_blocked")
  }

  if (!candidate.quoteSummary) {
    pushBlocker("missing_quote")
  }

  if (!candidate.quoteReference) {
    pushBlocker("missing_quote_reference")
  }

  if (candidate.pickupPointRequired && !candidate.pickupPoint) {
    pushBlocker("missing_pickup_point")
  }

  if (candidate.pickupWindowRequired && !candidate.pickupWindow) {
    pushBlocker("missing_pickup_window")
  }

  if (parityMismatch) {
    pushBlocker("legacy_parity_mismatch")
  }

  if (
    legacyContext &&
    legacyContext.legacy_is_committed &&
    !legacyContext.legacy_selection_fresh
  ) {
    pushBlocker("legacy_parity_mismatch")
  }

  return blockers
}

function getDeliveryHubNeutralRehearsalBlockerLabel(
  code: DeliveryHubNeutralSelectionRehearsalBlockerCode
) {
  switch (code) {
    case "settings_unavailable":
      return "Neutral Delivery Hub settings do not expose a ready shopper path."
    case "readiness_blocked":
      return "Readiness currently blocks the neutral selection candidate."
    case "missing_quote_reference":
      return "Backend-issued quote reference is missing, so a future selection body cannot be shaped."
    case "missing_quote":
      return "Neutral quote preview is missing."
    case "missing_pickup_point":
      return "Pickup point is required but missing from the read-only preview context."
    case "missing_pickup_window":
      return "Pickup window is required but missing from the read-only preview context."
    case "legacy_parity_mismatch":
      return "Legacy checkout parity does not currently align with the neutral preview."
    case "legacy_context_missing":
      return "Legacy checkout context is missing, so rehearsal stays informational."
  }
}

export function buildDeliveryHubNeutralSelectionRehearsalModel(
  input: DeliveryHubNeutralSelectionRehearsalInput = {}
): DeliveryHubNeutralSelectionRehearsalModel {
  const candidate = getDeliveryHubNeutralRehearsalCandidate(input)
  const blockers = getDeliveryHubNeutralRehearsalBlockers(input)
  const readinessLabel = input.readiness
    ? getDeliveryHubReadinessStatusLabel(input.readiness.status)
    : null
  const hasAnyNeutralInput = Boolean(
    input.settings ||
      input.catalog ||
      input.quotes ||
      input.pickup_points ||
      input.pickup_windows ||
      input.persisted_selection ||
      input.readiness
  )
  const legacyOnly = !hasAnyNeutralInput
  const insufficient =
    !legacyOnly &&
    (!candidate.quoteSummary ||
      !candidate.quoteReference ||
      blockers.includes("missing_pickup_point") ||
      blockers.includes("missing_pickup_window"))
  const blocked =
    !legacyOnly &&
    (blockers.includes("settings_unavailable") ||
      blockers.includes("readiness_blocked") ||
      blockers.includes("legacy_parity_mismatch"))
  const status: DeliveryHubNeutralSelectionRehearsalStatus = legacyOnly
    ? "legacy_only"
    : blocked
      ? "blocked"
      : insufficient
        ? "insufficient_data"
        : "candidate_available"
  const statusLabel =
    status === "candidate_available"
      ? "Pre-cutin neutral selection candidate available"
      : status === "blocked"
        ? "Pre-cutin neutral selection rehearsal blocked"
        : status === "legacy_only"
          ? "Legacy ApiShip remains the only active checkout path"
          : "Pre-cutin neutral selection rehearsal needs more data"
  const quoteSummary = candidate.quoteSummary
  const pickupPointLabel = candidate.pickupPoint
    ? candidate.pickupPoint.name || candidate.pickupPoint.address
    : null
  const hintMessages = uniqueDeliveryHubMessages([
    "Pre-cutin rehearsal/read-only only: this model does not save, clear, submit, or switch checkout state.",
    "The active checkout commit path remains legacy ApiShip.",
    candidate.quoteReference
      ? "Only backend-issued quote_reference is used; no provider-specific reference is computed in storefront."
      : null,
    ...blockers.map(getDeliveryHubNeutralRehearsalBlockerLabel),
    ...(input.readiness?.issues.map((issue) => issue.message) ?? []),
  ]).slice(0, 6)

  return {
    tone:
      status === "candidate_available"
        ? "positive"
        : status === "blocked"
          ? "warning"
          : "neutral",
    status,
    status_label: statusLabel,
    active_commit_path_label: "Active checkout commit path: legacy ApiShip",
    rehearsal_label: "Delivery Hub pre-cutin rehearsal · read-only · no shopper action",
    modality_label: getDeliveryHubQuoteTypeLabel(candidate.quoteType),
    quote_amount: quoteSummary?.amount ?? null,
    currency_code: quoteSummary?.currency_code ?? null,
    quote_eta_label: quoteSummary
      ? formatDeliveryHubEtaLabel(
          quoteSummary.delivery_eta_min,
          quoteSummary.delivery_eta_max
        )
      : null,
    quote_reference: candidate.quoteReference,
    quote_reference_label: candidate.quoteReference
      ? `backend quote reference v${candidate.quoteReference.version}`
      : null,
    pickup_point_label: pickupPointLabel,
    pickup_point_address_label: candidate.pickupPoint?.address ?? null,
    pickup_window_label: candidate.pickupWindow?.label ?? null,
    readiness_label: readinessLabel,
    legacy_method_label: input.legacy_context?.legacy_method_label ?? null,
    blocker_codes: blockers,
    hint_messages: hintMessages,
  }
}

export function evaluateDeliveryHubNeutralSelectionRehearsalActionability(
  modelOrInput:
    | DeliveryHubNeutralSelectionRehearsalModel
    | DeliveryHubNeutralSelectionRehearsalInput = {}
): DeliveryHubNeutralSelectionRehearsalActionabilityModel {
  const model =
    "status" in modelOrInput && "rehearsal_label" in modelOrInput
      ? modelOrInput
      : buildDeliveryHubNeutralSelectionRehearsalModel(modelOrInput)
  const requiredBlockers = model.blocker_codes.filter((code) =>
    [
      "settings_unavailable",
      "readiness_blocked",
      "missing_quote_reference",
      "missing_quote",
      "missing_pickup_point",
      "missing_pickup_window",
      "legacy_parity_mismatch",
    ].includes(code)
  )
  const canShape = model.status === "candidate_available" && requiredBlockers.length === 0
  const verdict: DeliveryHubNeutralSelectionRehearsalActionabilityVerdict = canShape
    ? "dry_run_shape_available"
    : model.status === "legacy_only"
      ? "dry_run_legacy_only"
      : model.status === "insufficient_data"
        ? "dry_run_insufficient_data"
        : "dry_run_blocked"

  return {
    verdict,
    can_shape_future_selection_body: canShape,
    dry_run_only: true,
    mutation_intent: false,
    blocker_codes: requiredBlockers,
    hint_messages: uniqueDeliveryHubMessages([
      canShape
        ? "Dry-run verdict only: a future neutral selection body appears technically shapeable from shopper-safe preview fields."
        : "Dry-run verdict only: future neutral selection body shaping is blocked or lacks required preview context.",
      "No mutation helper is called or implied by this guard.",
      ...requiredBlockers.map(getDeliveryHubNeutralRehearsalBlockerLabel),
    ]),
  }
}

function getDeliveryHubHandoffPreviewBlockerLabel(
  code: DeliveryHubHandoffPreviewBlockerCode
) {
  switch (code) {
    case "connection_not_ready":
      return "Neutral connection readiness is not yet ready for backend handoff preview."
    case "missing_connection_id":
      return "Connection id is missing from the shopper-safe handoff preview shape."
    case "missing_mode_code":
      return "Mode code is missing from the shopper-safe handoff preview shape."
    case "missing_quote_reference":
      return "Quote reference is missing from the shopper-safe handoff preview shape."
    case "missing_pickup_point":
      return "Pickup point is required but missing from the shopper-safe handoff preview shape."
    case "missing_pickup_window":
      return "Pickup window is required but missing from the shopper-safe handoff preview shape."
    case "missing_quote":
      return "Quote summary is missing from the shopper-safe handoff preview shape."
    case "legacy_parity_mismatch":
      return "Legacy checkout parity does not currently align with the handoff preview seam."
  }
}

function getDeliveryHubShippingOptionParityGapLabel(
  code: DeliveryHubShippingOptionParityPreviewGapCode
) {
  switch (code) {
    case "missing_candidate":
      return "Neutral delivery candidate is not available in the current preview stack."
    case "legacy_context_missing":
      return "Legacy checkout context is missing, so parity remains informational only."
    case "legacy_context_stale":
      return "Legacy checkout context is stale for the current address fingerprint."
    case "connection_not_ready":
      return "Neutral connection readiness is not yet ready."
    case "missing_connection_id":
      return "Neutral candidate does not expose connection_id yet."
    case "missing_mode_code":
      return "Neutral candidate does not expose mode_code yet."
    case "mode_mismatch":
      return "Neutral mode_code does not align with the committed legacy delivery shape."
    case "missing_quote_reference":
      return "Neutral candidate does not expose quote_reference yet."
    case "missing_pickup_point":
      return "Neutral candidate still lacks a required pickup point."
    case "missing_pickup_window":
      return "Neutral candidate still lacks a required pickup window."
  }
}

function getDeliveryHubLegacyModeAlignment(
  legacyFlowKind: "pickup_point" | "door_delivery" | null,
  modeCode: DeliveryHubQuoteType | null
) {
  if (!legacyFlowKind) {
    return "informational_only" as const
  }

  if (!modeCode) {
    return "missing" as const
  }

  if (legacyFlowKind === "pickup_point") {
    return ["warehouse_to_pickup_point", "dropoff_point_to_pickup_point"].includes(modeCode)
      ? ("aligned" as const)
      : ("mismatch" as const)
  }

  return "mismatch" as const
}

function buildDeliveryHubShippingOptionParitySignal(input: {
  label: string
  status: DeliveryHubShippingOptionParityPreviewSignalStatus
  detail_label: string
}): DeliveryHubShippingOptionParityPreviewSignal {
  return input
}

export function buildDeliveryHubHandoffPreviewModel(
  input: DeliveryHubNeutralSelectionRehearsalInput = {}
): DeliveryHubHandoffPreviewModel {
  const candidate = getDeliveryHubNeutralRehearsalCandidate(input)
  const blockerCodes: DeliveryHubHandoffPreviewBlockerCode[] = []

  const pushBlocker = (code: DeliveryHubHandoffPreviewBlockerCode) => {
    if (!blockerCodes.includes(code)) {
      blockerCodes.push(code)
    }
  }

  if (!candidate.connection.connection_id) {
    pushBlocker("missing_connection_id")
  }

  if (!candidate.connection.ready || candidate.connection.state !== "ready") {
    pushBlocker("connection_not_ready")
  }

  if (!candidate.quoteType) {
    pushBlocker("missing_mode_code")
  }

  if (!candidate.quoteSummary) {
    pushBlocker("missing_quote")
  }

  if (!candidate.quoteReference) {
    pushBlocker("missing_quote_reference")
  }

  if (candidate.pickupPointRequired && !candidate.pickupPoint) {
    pushBlocker("missing_pickup_point")
  }

  if (candidate.pickupWindowRequired && !candidate.pickupWindow) {
    pushBlocker("missing_pickup_window")
  }

  if (
    input.shipping_option_parity?.parity_state === "divergent" ||
    input.selection_parity?.parity_status === "modality_mismatch" ||
    input.selection_parity?.parity_status === "reference_mismatch" ||
    (input.legacy_context?.legacy_is_committed &&
      input.legacy_context.legacy_selection_fresh === false)
  ) {
    pushBlocker("legacy_parity_mismatch")
  }

  const hasBlockedReason = blockerCodes.some((code) =>
    ["connection_not_ready", "legacy_parity_mismatch"].includes(code)
  )
  const verdict: DeliveryHubHandoffPreviewVerdict = hasBlockedReason
    ? "blocked"
    : blockerCodes.length > 0
      ? "missing_required_fragment"
      : "ready_for_handoff_preview"

  return {
    tone:
      verdict === "ready_for_handoff_preview"
        ? "positive"
        : verdict === "blocked"
          ? "warning"
          : "neutral",
    verdict,
    verdict_label:
      verdict === "ready_for_handoff_preview"
        ? "Ready for backend handoff preview"
        : verdict === "blocked"
          ? "Backend handoff preview blocked"
          : "Backend handoff preview missing required fragments",
    readiness_summary_label:
      verdict === "ready_for_handoff_preview"
        ? "Shopper-safe handoff preview shape is structurally complete for candidate backend validation."
        : verdict === "blocked"
          ? "Shopper-safe handoff preview seam remains blocked before candidate backend validation."
          : "Shopper-safe handoff preview seam still lacks required structural fragments.",
    connection_id: candidate.connection.connection_id,
    mode_code: candidate.quoteType,
    mode_label: getDeliveryHubQuoteTypeLabel(candidate.quoteType),
    quote_reference_present: Boolean(candidate.quoteReference),
    pickup_point_required: candidate.pickupPointRequired,
    pickup_point_present: Boolean(candidate.pickupPoint),
    pickup_window_required: candidate.pickupWindowRequired,
    pickup_window_present: Boolean(candidate.pickupWindow),
    blocker_codes: blockerCodes,
    hint_messages: uniqueDeliveryHubMessages([
      "Pre-cutin read-only handoff preview seam only: no save, clear, submit, or shipping-method mutation is performed here.",
      "The active checkout commit path remains legacy ApiShip.",
      ...blockerCodes.map(getDeliveryHubHandoffPreviewBlockerLabel),
      ...(input.readiness?.issues.map((issue) => issue.message) ?? []),
    ]).slice(0, 6),
    dry_run_only: true,
    mutation_intent: false,
  }
}

export function buildDeliveryHubShippingOptionParityPreviewModel(
  input: DeliveryHubNeutralSelectionRehearsalInput = {}
): DeliveryHubShippingOptionParityPreviewModel {
  const candidate = getDeliveryHubNeutralRehearsalCandidate(input)
  const gapCodes: DeliveryHubShippingOptionParityPreviewGapCode[] = []
  const legacyContext = input.legacy_context ?? null

  const pushGap = (code: DeliveryHubShippingOptionParityPreviewGapCode) => {
    if (!gapCodes.includes(code)) {
      gapCodes.push(code)
    }
  }

  const candidatePresent = Boolean(candidate.quoteSummary || candidate.quoteReference || candidate.quoteType)
  const modeAlignment = getDeliveryHubLegacyModeAlignment(
    legacyContext?.legacy_flow_kind ?? null,
    candidate.quoteType
  )

  if (!candidatePresent) {
    pushGap("missing_candidate")
  }

  if (!legacyContext?.legacy_is_committed || !legacyContext.legacy_flow_kind) {
    pushGap("legacy_context_missing")
  }

  if (legacyContext?.legacy_is_committed && legacyContext.legacy_selection_fresh === false) {
    pushGap("legacy_context_stale")
  }

  if (candidatePresent && !candidate.connection.connection_id) {
    pushGap("missing_connection_id")
  }

  if (
    candidatePresent &&
    (!candidate.connection.ready || candidate.connection.state !== "ready")
  ) {
    pushGap("connection_not_ready")
  }

  if (!candidate.quoteType) {
    pushGap("missing_mode_code")
  }

  if (modeAlignment === "mismatch") {
    pushGap("mode_mismatch")
  }

  if (!candidate.quoteReference) {
    pushGap("missing_quote_reference")
  }

  if (candidate.pickupPointRequired && !candidate.pickupPoint) {
    pushGap("missing_pickup_point")
  }

  if (candidate.pickupWindowRequired && !candidate.pickupWindow) {
    pushGap("missing_pickup_window")
  }

  const blocked = gapCodes.some((code) =>
    ["connection_not_ready", "mode_mismatch", "legacy_context_stale"].includes(code)
  )
  const aligned =
    candidatePresent &&
    legacyContext?.legacy_is_committed &&
    legacyContext.legacy_selection_fresh &&
    modeAlignment === "aligned" &&
    candidate.connection.ready &&
    candidate.connection.state === "ready" &&
    !!candidate.connection.connection_id &&
    !!candidate.quoteType &&
    !!candidate.quoteReference &&
    (!candidate.pickupPointRequired || !!candidate.pickupPoint) &&
    (!candidate.pickupWindowRequired || !!candidate.pickupWindow)
  const verdict: DeliveryHubShippingOptionParityPreviewVerdict = blocked
    ? "blocked"
    : aligned
      ? "parity_aligned"
      : gapCodes.length > 0
        ? candidatePresent
          ? "parity_partial"
          : "informational_only"
        : "informational_only"

  const summaryLabel =
    verdict === "parity_aligned"
      ? "Neutral candidate structurally aligns with the current legacy shipping-option semantics."
      : verdict === "blocked"
        ? "Neutral candidate cannot be treated as structurally aligned because readiness or mode alignment is blocked."
        : verdict === "parity_partial"
          ? "Neutral candidate is available, but structural parity still has shopper-safe gaps."
          : "Parity preview remains informational only until enough legacy and neutral preview context is present."

  return {
    tone:
      verdict === "parity_aligned"
        ? "positive"
        : verdict === "blocked"
          ? "warning"
          : "neutral",
    verdict,
    verdict_label:
      verdict === "parity_aligned"
        ? "Neutral shipping-option parity aligned"
        : verdict === "blocked"
          ? "Neutral shipping-option parity blocked"
          : verdict === "parity_partial"
            ? "Neutral shipping-option parity is partial"
            : "Neutral shipping-option parity is informational only",
    summary_label: summaryLabel,
    candidate_present: candidatePresent,
    connection_id: candidate.connection.connection_id,
    mode_code: candidate.quoteType,
    mode_label: getDeliveryHubQuoteTypeLabel(candidate.quoteType),
    quote_reference_present: Boolean(candidate.quoteReference),
    pickup_point_required: candidate.pickupPointRequired,
    pickup_point_present: Boolean(candidate.pickupPoint),
    pickup_window_required: candidate.pickupWindowRequired,
    pickup_window_present: Boolean(candidate.pickupWindow),
    connection_id_signal: buildDeliveryHubShippingOptionParitySignal({
      label: "connection_id parity",
      status: !candidatePresent
        ? "informational_only"
        : !candidate.connection.connection_id
          ? "missing"
          : !candidate.connection.ready || candidate.connection.state !== "ready"
            ? "blocked"
            : "aligned",
      detail_label: !candidatePresent
        ? "No neutral candidate yet."
        : !candidate.connection.connection_id
          ? "Neutral candidate is missing connection_id."
          : !candidate.connection.ready || candidate.connection.state !== "ready"
            ? `Neutral connection is ${candidate.connection.state}.`
            : `Neutral candidate exposes ready connection_id ${candidate.connection.connection_id}.`,
    }),
    mode_code_signal: buildDeliveryHubShippingOptionParitySignal({
      label: "mode_code parity",
      status: modeAlignment,
      detail_label:
        modeAlignment === "aligned"
          ? "Neutral mode_code matches the committed legacy delivery shape."
          : modeAlignment === "mismatch"
            ? "Neutral mode_code differs from the committed legacy delivery shape."
            : modeAlignment === "missing"
              ? "Neutral candidate is missing mode_code."
              : "Legacy modality context is not committed yet, so mode parity stays informational only.",
    }),
    quote_reference_signal: buildDeliveryHubShippingOptionParitySignal({
      label: "quote_reference presence",
      status: !candidatePresent
        ? "informational_only"
        : candidate.quoteReference
          ? "aligned"
          : "missing",
      detail_label: !candidatePresent
        ? "No neutral candidate yet."
        : candidate.quoteReference
          ? "Neutral candidate exposes backend-issued quote_reference."
          : "Neutral candidate is missing backend-issued quote_reference.",
    }),
    pickup_point_signal: buildDeliveryHubShippingOptionParitySignal({
      label: "pickup point expectation",
      status: !candidatePresent
        ? "informational_only"
        : candidate.pickupPointRequired
          ? candidate.pickupPoint
            ? "aligned"
            : "missing"
          : "not_applicable",
      detail_label: !candidatePresent
        ? "No neutral candidate yet."
        : candidate.pickupPointRequired
          ? candidate.pickupPoint
            ? "Required pickup point is present in the neutral candidate."
            : "Neutral candidate still lacks a required pickup point."
          : "Current neutral candidate does not require a pickup point.",
    }),
    pickup_window_signal: buildDeliveryHubShippingOptionParitySignal({
      label: "pickup window expectation",
      status: !candidatePresent
        ? "informational_only"
        : candidate.pickupWindowRequired
          ? candidate.pickupWindow
            ? "aligned"
            : "missing"
          : "not_applicable",
      detail_label: !candidatePresent
        ? "No neutral candidate yet."
        : candidate.pickupWindowRequired
          ? candidate.pickupWindow
            ? "Required pickup window is present in the neutral candidate."
            : "Neutral candidate still lacks a required pickup window."
          : "Current neutral candidate does not require a pickup window.",
    }),
    gap_codes: gapCodes,
    hint_messages: uniqueDeliveryHubMessages([
      "Preview-only parity seam: no save, clear, submit, or shipping-method mutation is performed here.",
      "The active checkout commit path remains legacy ApiShip.",
      ...gapCodes.map(getDeliveryHubShippingOptionParityGapLabel),
    ]).slice(0, 6),
    dry_run_only: true,
    mutation_intent: false,
  }
}

function buildDeliveryHubContractMatrixFragment(input: {
  key: DeliveryHubHandoffContractMatrixPreviewFragmentKey
  label: string
  status: DeliveryHubHandoffContractMatrixPreviewFragmentStatus
  detail_label: string
}): DeliveryHubHandoffContractMatrixPreviewFragment {
  return input
}

function getDeliveryHubContractMatrixFragmentStatusLabel(
  status: DeliveryHubHandoffContractMatrixPreviewFragmentStatus
) {
  switch (status) {
    case "present":
      return "present"
    case "missing":
      return "missing"
    case "required_missing":
      return "required missing"
    case "blocked_by_readiness":
      return "blocked by readiness"
    case "blocked_by_parity":
      return "blocked by parity"
    case "informational_only":
      return "informational only"
  }
}

export function buildDeliveryHubHandoffContractMatrixPreviewModel(
  input: DeliveryHubNeutralSelectionRehearsalInput = {}
): DeliveryHubHandoffContractMatrixPreviewModel {
  const candidate = getDeliveryHubNeutralRehearsalCandidate(input)
  const legacyContext = input.legacy_context ?? null
  const readiness = input.readiness ?? null
  const parityPreview = buildDeliveryHubShippingOptionParityPreviewModel(input)
  const readinessBlockedCodes = (readiness?.issues ?? [])
    .map((issue) => issue.code)
    .filter((code) =>
      [
        "selection_invalid",
        "connection_missing",
        "connection_not_found",
        "connection_disabled",
        "connection_inactive",
        "connection_credentials_not_ready",
      ].includes(code)
    )
  const parityBlockedCodes = parityPreview.gap_codes.filter((code) =>
    ["connection_not_ready", "mode_mismatch", "legacy_context_stale"].includes(code)
  )
  const readinessBlocked = readinessBlockedCodes.length > 0
  const parityBlocked = parityBlockedCodes.length > 0
  const candidatePresent = Boolean(
    candidate.quoteSummary || candidate.quoteReference || candidate.quoteType || candidate.connection.connection_id
  )

  const fragments: DeliveryHubHandoffContractMatrixPreviewFragment[] = [
    buildDeliveryHubContractMatrixFragment({
      key: "connection",
      label: "Connection fragment",
      status: readinessBlocked
        ? "blocked_by_readiness"
        : parityBlocked
          ? "blocked_by_parity"
          : candidate.connection.connection_id
            ? "present"
            : candidatePresent
              ? "missing"
              : "informational_only",
      detail_label: readinessBlocked
        ? `Connection fragment is blocked while readiness reports ${readiness?.quote_context?.connection.state ?? "an unavailable state"}.`
        : parityBlocked
          ? "Connection fragment remains preview-only while parity conditions are blocked."
          : candidate.connection.connection_id
            ? `Neutral candidate exposes connection_id ${candidate.connection.connection_id}.`
            : candidatePresent
              ? "Neutral candidate does not expose connection_id yet."
              : "No neutral candidate connection fragment is currently available.",
    }),
    buildDeliveryHubContractMatrixFragment({
      key: "mode",
      label: "Mode fragment",
      status: parityBlocked
        ? "blocked_by_parity"
        : candidate.quoteType
          ? "present"
          : candidatePresent
            ? "missing"
            : "informational_only",
      detail_label: parityBlocked
        ? "Mode fragment remains preview-only while parity conditions are blocked."
        : candidate.quoteType
          ? `Neutral candidate exposes mode ${candidate.quoteType}.`
          : candidatePresent
            ? "Neutral candidate does not expose mode_code yet."
            : "No neutral candidate mode fragment is currently available.",
    }),
    buildDeliveryHubContractMatrixFragment({
      key: "quote",
      label: "Quote fragment",
      status: candidate.quoteSummary
        ? "present"
        : candidatePresent
          ? "required_missing"
          : "informational_only",
      detail_label: candidate.quoteSummary
        ? "Neutral candidate exposes shopper-safe quote summary fields."
        : candidatePresent
          ? "Neutral candidate still lacks shopper-safe quote summary fields."
          : "No neutral quote fragment is currently available.",
    }),
    buildDeliveryHubContractMatrixFragment({
      key: "quote_reference",
      label: "Quote reference fragment",
      status: candidate.quoteReference
        ? "present"
        : candidatePresent
          ? "required_missing"
          : "informational_only",
      detail_label: candidate.quoteReference
        ? "Neutral candidate exposes backend-issued quote_reference."
        : candidatePresent
          ? "Neutral candidate still lacks backend-issued quote_reference."
          : "No neutral quote-reference fragment is currently available.",
    }),
    buildDeliveryHubContractMatrixFragment({
      key: "pickup_point",
      label: "Pickup-point fragment",
      status: candidate.pickupPointRequired
        ? candidate.pickupPoint
          ? "present"
          : candidatePresent
            ? "required_missing"
            : "informational_only"
        : candidate.pickupPoint
          ? "present"
          : "informational_only",
      detail_label: candidate.pickupPointRequired
        ? candidate.pickupPoint
          ? "Required pickup point is present in the neutral candidate."
          : candidatePresent
            ? "Required pickup point is still missing from the neutral candidate."
            : "Pickup-point requirement cannot be satisfied until a neutral candidate is available."
        : candidate.pickupPoint
          ? "Optional pickup point is already present in the neutral candidate."
          : "Current neutral candidate does not require a pickup point.",
    }),
    buildDeliveryHubContractMatrixFragment({
      key: "pickup_window",
      label: "Pickup-window fragment",
      status: candidate.pickupWindowRequired
        ? candidate.pickupWindow
          ? "present"
          : candidatePresent
            ? "required_missing"
            : "informational_only"
        : candidate.pickupWindow
          ? "present"
          : "informational_only",
      detail_label: candidate.pickupWindowRequired
        ? candidate.pickupWindow
          ? "Required pickup window is present in the neutral candidate."
          : candidatePresent
            ? "Required pickup window is still missing from the neutral candidate."
            : "Pickup-window requirement cannot be satisfied until a neutral candidate is available."
        : candidate.pickupWindow
          ? "Optional pickup window is already present in the neutral candidate."
          : "Current neutral candidate does not require a pickup window.",
    }),
    buildDeliveryHubContractMatrixFragment({
      key: "readiness_gate",
      label: "Readiness gate",
      status: !readiness
        ? "informational_only"
        : readinessBlocked
          ? "blocked_by_readiness"
          : readiness.status === "ready" || readiness.status === "missing_selection"
            ? "present"
            : "informational_only",
      detail_label: !readiness
        ? "Readiness gate is unavailable, so the matrix stays informational only."
        : readinessBlocked
          ? `Readiness gate is blocked by ${formatDeliveryHubCountLabel(readinessBlockedCodes.length, "issue", "issues")}.`
          : `Readiness currently reports ${getDeliveryHubReadinessStatusLabel(readiness.status)}.`,
    }),
    buildDeliveryHubContractMatrixFragment({
      key: "parity_gate",
      label: "Parity gate",
      status: !legacyContext?.legacy_is_committed
        ? "informational_only"
        : parityBlocked
          ? "blocked_by_parity"
          : parityPreview.verdict === "parity_aligned" || parityPreview.verdict === "parity_partial"
            ? "present"
            : "informational_only",
      detail_label: !legacyContext?.legacy_is_committed
        ? "Legacy checkout context is not committed, so parity stays informational only."
        : parityBlocked
          ? `Parity gate is blocked by ${formatDeliveryHubCountLabel(parityBlockedCodes.length, "condition", "conditions")}.`
          : `Parity preview currently reports ${parityPreview.verdict_label.toLowerCase()}.`,
    }),
  ]

  const missingFragmentKeys = fragments
    .filter((fragment) => ["missing", "required_missing"].includes(fragment.status))
    .map((fragment) => fragment.key)

  const verdict: DeliveryHubHandoffContractMatrixPreviewVerdict = !candidatePresent
    ? "informational_only"
    : readinessBlocked || parityBlocked
      ? "contract_blocked"
      : missingFragmentKeys.length > 0
        ? "contract_incomplete"
        : "contract_complete"

  return {
    tone:
      verdict === "contract_complete"
        ? "positive"
        : verdict === "contract_blocked"
          ? "warning"
          : "neutral",
    verdict,
    verdict_label:
      verdict === "contract_complete"
        ? "Neutral handoff contract matrix is structurally complete"
        : verdict === "contract_blocked"
          ? "Neutral handoff contract matrix is blocked"
          : verdict === "contract_incomplete"
            ? "Neutral handoff contract matrix is incomplete"
            : "Neutral handoff contract matrix is informational only",
    completeness_label:
      verdict === "contract_complete"
        ? "All shopper-safe handoff fragments are present in preview-only form."
        : verdict === "contract_blocked"
          ? "Contract completeness remains blocked by readiness or parity conditions."
          : verdict === "contract_incomplete"
            ? "Contract completeness still has required shopper-safe fragments missing."
            : "Contract completeness remains informational until enough shopper-safe preview context exists.",
    fragments: fragments.map((fragment) => ({
      ...fragment,
      detail_label: `${getDeliveryHubContractMatrixFragmentStatusLabel(fragment.status)} · ${fragment.detail_label}`,
    })),
    blocked_readiness_codes: readinessBlockedCodes,
    blocked_parity_codes: parityBlockedCodes,
    missing_fragment_keys: missingFragmentKeys,
    hint_messages: uniqueDeliveryHubMessages([
      "Preview-only contract matrix seam: no checkout state change or shipping-method mutation is performed here.",
      "The active checkout commit path remains legacy ApiShip.",
      readinessBlocked
        ? `Readiness blocked: ${readinessBlockedCodes.map(formatDeliveryHubPreviewCodeLabel).join(", ")}.`
        : null,
      parityBlocked
        ? `Parity blocked: ${parityBlockedCodes.map(formatDeliveryHubPreviewCodeLabel).join(", ")}.`
        : null,
      missingFragmentKeys.length > 0
        ? `Missing fragments: ${missingFragmentKeys.map(formatDeliveryHubPreviewCodeLabel).join(", ")}.`
        : null,
    ]).slice(0, 6),
    dry_run_only: true,
    mutation_intent: false,
  }
}

function buildDeliveryHubPersistedSelectionContractParityPreviewField(input: {
  key: DeliveryHubPersistedSelectionContractParityPreviewFieldKey
  label: string
  status: DeliveryHubPersistedSelectionContractParityPreviewFieldStatus
  detail_label: string
}): DeliveryHubPersistedSelectionContractParityPreviewField {
  return input
}

export function buildDeliveryHubPersistedSelectionContractParityPreviewModel(
  input: DeliveryHubNeutralSelectionRehearsalInput = {}
): DeliveryHubPersistedSelectionContractParityPreviewModel {
  const candidate = getDeliveryHubNeutralRehearsalCandidate(input)
  const readiness = input.readiness ?? null
  const parityPreview = buildDeliveryHubShippingOptionParityPreviewModel(input)
  const readinessBlockedCodes = sanitizeDeliveryHubPersistedSelectionReadinessBlockers(
    (readiness?.issues ?? [])
      .map((issue) => issue.code)
      .filter((code) =>
        [
          "selection_invalid",
          "connection_missing",
          "connection_not_found",
          "connection_disabled",
          "connection_inactive",
          "connection_credentials_not_ready",
        ].includes(code)
      )
  )
  const parityBlockedCodes = sanitizeDeliveryHubPersistedSelectionParityBlockers(
    parityPreview.gap_codes.filter((code) =>
      ["connection_not_ready", "mode_mismatch", "legacy_context_stale"].includes(code)
    )
  )
  const candidatePresent = Boolean(
    candidate.quoteSummary ||
      candidate.quoteReference ||
      candidate.quoteType ||
      candidate.connection.connection_id
  )
  const blocked = readinessBlockedCodes.length > 0 || parityBlockedCodes.length > 0

  const fields: DeliveryHubPersistedSelectionContractParityPreviewField[] = [
    buildDeliveryHubPersistedSelectionContractParityPreviewField({
      key: "connection_id",
      label: "connection_id",
      status: !candidatePresent
        ? "informational_only"
        : blocked
          ? candidate.connection.connection_id
            ? "blocked"
            : "mismatched"
          : candidate.connection.connection_id
            ? "matched"
            : "mismatched",
      detail_label: !candidatePresent
        ? "Projected persisted contract stays informational until a neutral candidate is visible."
        : candidate.connection.connection_id
          ? `Projected persisted contract would currently carry connection_id ${candidate.connection.connection_id}.`
          : "Projected persisted contract still lacks connection_id.",
    }),
    buildDeliveryHubPersistedSelectionContractParityPreviewField({
      key: "mode_code",
      label: "mode_code",
      status: !candidatePresent
        ? "informational_only"
        : parityBlockedCodes.includes("selection_alignment_unavailable")
          ? "blocked"
          : candidate.quoteType
            ? "matched"
            : "mismatched",
      detail_label: !candidatePresent
        ? "Projected persisted contract stays informational until a neutral candidate is visible."
        : parityBlockedCodes.includes("selection_alignment_unavailable")
          ? "Projected persisted contract mode_code remains preview-only while selection alignment is unavailable."
          : candidate.quoteType
            ? `Projected persisted contract would currently carry mode_code ${candidate.quoteType}.`
            : "Projected persisted contract still lacks mode_code.",
    }),
    buildDeliveryHubPersistedSelectionContractParityPreviewField({
      key: "quote_reference",
      label: "quote_reference",
      status: !candidatePresent
        ? "informational_only"
        : candidate.quoteReference
          ? "matched"
          : "mismatched",
      detail_label: !candidatePresent
        ? "Projected persisted contract stays informational until a neutral candidate is visible."
        : candidate.quoteReference
          ? "Projected persisted contract would currently carry a backend-issued quote_reference."
          : "Projected persisted contract still lacks a backend-issued quote_reference.",
    }),
    buildDeliveryHubPersistedSelectionContractParityPreviewField({
      key: "pickup_point",
      label: "pickup_point",
      status: !candidatePresent
        ? "informational_only"
        : candidate.pickupPointRequired
          ? candidate.pickupPoint
            ? "matched"
            : "mismatched"
          : candidate.pickupPoint
            ? "matched"
            : "not_required",
      detail_label: !candidatePresent
        ? "Projected persisted contract stays informational until a neutral candidate is visible."
        : candidate.pickupPointRequired
          ? candidate.pickupPoint
            ? "Projected persisted contract currently has the required pickup_point fragment."
            : "Projected persisted contract still lacks a required pickup_point fragment."
          : candidate.pickupPoint
            ? "Projected persisted contract already includes an optional pickup_point fragment."
            : "Projected persisted contract does not currently require pickup_point.",
    }),
    buildDeliveryHubPersistedSelectionContractParityPreviewField({
      key: "pickup_window",
      label: "pickup_window",
      status: !candidatePresent
        ? "informational_only"
        : candidate.pickupWindowRequired
          ? candidate.pickupWindow
            ? "matched"
            : "mismatched"
          : candidate.pickupWindow
            ? "matched"
            : "not_required",
      detail_label: !candidatePresent
        ? "Projected persisted contract stays informational until a neutral candidate is visible."
        : candidate.pickupWindowRequired
          ? candidate.pickupWindow
            ? "Projected persisted contract currently has the required pickup_window fragment."
            : "Projected persisted contract still lacks a required pickup_window fragment."
          : candidate.pickupWindow
            ? "Projected persisted contract already includes an optional pickup_window fragment."
            : "Projected persisted contract does not currently require pickup_window.",
    }),
  ]

  const mismatchedFieldCount = fields.filter((field) => field.status === "mismatched").length
  const matchedFieldCount = fields.filter((field) =>
    ["matched", "not_required"].includes(field.status)
  ).length
  const mismatchReasons = uniqueDeliveryHubMessages([
    ...fields
      .filter((field) => field.status === "mismatched")
      .map((field) => field.detail_label),
    blocked
      ? `Preview blockers remain visible from readiness/parity surfaces: ${[
          ...readinessBlockedCodes.map(getDeliveryHubPersistedSelectionReadinessBlockerLabel),
          ...parityBlockedCodes.map(getDeliveryHubPersistedSelectionParityBlockerLabel),
        ].join(", ")}.`
      : null,
  ])
  const verdict: DeliveryHubPersistedSelectionContractParityPreviewVerdict = !candidatePresent
    ? "informational_only"
    : blocked
      ? "blocked"
      : mismatchedFieldCount > 0
        ? "contract_mismatched"
        : "contract_matched"

  return {
    tone:
      verdict === "contract_matched"
        ? "positive"
        : verdict === "blocked"
          ? "warning"
          : "neutral",
    verdict,
    verdict_label:
      verdict === "contract_matched"
        ? "Projected persisted contract parity looks structurally matched"
        : verdict === "blocked"
          ? "Projected persisted contract parity is blocked"
          : verdict === "contract_mismatched"
            ? "Projected persisted contract parity still has shopper-safe mismatches"
            : "Projected persisted contract parity is informational only",
    summary_label:
      verdict === "contract_matched"
        ? "Current neutral preview already resembles the future persisted contract artifact on shopper-safe fields."
        : verdict === "blocked"
          ? "Projected persisted contract parity remains diagnostic-only because readiness or parity blockers are still visible."
          : verdict === "contract_mismatched"
            ? "Current neutral preview exposes comparable shopper-safe structure, but some persisted-contract fragments are still missing."
            : "Projected persisted contract parity remains diagnostic-only until enough neutral preview context is available.",
    projected_contract_label:
      "Future persisted contract artifact preview · shopper-safe only · no write path · no network path",
    connection_id: candidate.connection.connection_id,
    mode_code: candidate.quoteType,
    mode_label: getDeliveryHubQuoteTypeLabel(candidate.quoteType),
    quote_reference_present: Boolean(candidate.quoteReference),
    pickup_point_required: candidate.pickupPointRequired,
    pickup_point_present: Boolean(candidate.pickupPoint),
    pickup_window_required: candidate.pickupWindowRequired,
    pickup_window_present: Boolean(candidate.pickupWindow),
    matched_field_count: matchedFieldCount,
    mismatched_field_count: mismatchedFieldCount,
    fields,
    mismatch_reasons: mismatchReasons,
    blocked_readiness_codes: readinessBlockedCodes,
    blocked_parity_codes: parityBlockedCodes,
    dry_run_only: true,
    mutation_intent: false,
  }
}

function buildDeliveryHubProjectedCommitParityPreviewField(input: {
  key: DeliveryHubProjectedCommitParityPreviewFieldKey
  label: string
  status: DeliveryHubProjectedCommitParityPreviewFieldStatus
  detail_label: string
}): DeliveryHubProjectedCommitParityPreviewField {
  return input
}

export function buildDeliveryHubProjectedCommitParityPreviewModel(
  input: DeliveryHubNeutralSelectionRehearsalInput = {}
): DeliveryHubProjectedCommitParityPreviewModel {
  const candidate = getDeliveryHubNeutralRehearsalCandidate(input)
  const readiness = input.readiness ?? null
  const parityPreview = buildDeliveryHubShippingOptionParityPreviewModel(input)
  const readinessBlockedCodes = sanitizeDeliveryHubProjectedCommitReadinessBlockers(
    (readiness?.issues ?? [])
      .map((issue) => issue.code)
      .filter((code) =>
        [
          "selection_invalid",
          "connection_missing",
          "connection_not_found",
          "connection_disabled",
          "connection_inactive",
          "connection_credentials_not_ready",
        ].includes(code)
      )
  )
  const parityBlockedCodes = sanitizeDeliveryHubProjectedCommitParityBlockers(
    parityPreview.gap_codes.filter((code) =>
      ["connection_not_ready", "mode_mismatch", "legacy_context_stale"].includes(code)
    )
  )
  const candidatePresent = Boolean(
    candidate.quoteSummary ||
      candidate.quoteReference ||
      candidate.quoteType ||
      candidate.connection.connection_id
  )
  const blocked = readinessBlockedCodes.length > 0 || parityBlockedCodes.length > 0
  const commitPayloadReadiness: DeliveryHubProjectedCommitParityPreviewModel["commit_payload_readiness"] =
    !candidatePresent
      ? "informational_only"
      : blocked
        ? "blocked"
        : [
              Boolean(candidate.connection.connection_id),
              Boolean(candidate.quoteType),
              Boolean(candidate.quoteReference),
              !candidate.pickupPointRequired || Boolean(candidate.pickupPoint),
              !candidate.pickupWindowRequired || Boolean(candidate.pickupWindow),
            ].every(Boolean)
          ? "matched"
          : "partial"

  const fields: DeliveryHubProjectedCommitParityPreviewField[] = [
    buildDeliveryHubProjectedCommitParityPreviewField({
      key: "connection_id",
      label: "connection_id",
      status: !candidatePresent
        ? "informational_only"
        : blocked
          ? candidate.connection.connection_id
            ? "blocked"
            : "mismatched"
          : candidate.connection.connection_id
            ? "matched"
            : "mismatched",
      detail_label: !candidatePresent
        ? "Projected commit preview stays informational until a neutral candidate is visible."
        : candidate.connection.connection_id
          ? `Projected commit preview would currently carry connection_id ${candidate.connection.connection_id}.`
          : "Projected commit preview still lacks connection_id.",
    }),
    buildDeliveryHubProjectedCommitParityPreviewField({
      key: "mode_code",
      label: "mode_code",
      status: !candidatePresent
        ? "informational_only"
        : parityBlockedCodes.includes("selection_alignment_unavailable")
          ? "blocked"
          : candidate.quoteType
            ? "matched"
            : "mismatched",
      detail_label: !candidatePresent
        ? "Projected commit preview stays informational until a neutral candidate is visible."
        : parityBlockedCodes.includes("selection_alignment_unavailable")
          ? "Projected commit preview mode_code remains shopper-safe only while selection alignment is unavailable."
          : candidate.quoteType
            ? `Projected commit preview would currently carry mode_code ${candidate.quoteType}.`
            : "Projected commit preview still lacks mode_code.",
    }),
    buildDeliveryHubProjectedCommitParityPreviewField({
      key: "quote_reference",
      label: "quote_reference",
      status: !candidatePresent
        ? "informational_only"
        : candidate.quoteReference
          ? "matched"
          : "mismatched",
      detail_label: !candidatePresent
        ? "Projected commit preview stays informational until a neutral candidate is visible."
        : candidate.quoteReference
          ? "Projected commit preview would currently carry a backend-issued quote_reference."
          : "Projected commit preview still lacks a backend-issued quote_reference.",
    }),
    buildDeliveryHubProjectedCommitParityPreviewField({
      key: "pickup_point",
      label: "pickup_point",
      status: !candidatePresent
        ? "informational_only"
        : candidate.pickupPointRequired
          ? candidate.pickupPoint
            ? blocked
              ? "blocked"
              : "matched"
            : "mismatched"
          : candidate.pickupPoint
            ? blocked
              ? "blocked"
              : "matched"
            : "not_required",
      detail_label: !candidatePresent
        ? "Projected commit preview stays informational until a neutral candidate is visible."
        : candidate.pickupPointRequired
          ? candidate.pickupPoint
            ? "Projected commit preview currently has the required pickup_point fragment."
            : "Projected commit preview still lacks a required pickup_point fragment."
          : candidate.pickupPoint
            ? "Projected commit preview already includes an optional pickup_point fragment."
            : "Projected commit preview does not currently require pickup_point.",
    }),
    buildDeliveryHubProjectedCommitParityPreviewField({
      key: "pickup_window",
      label: "pickup_window",
      status: !candidatePresent
        ? "informational_only"
        : candidate.pickupWindowRequired
          ? candidate.pickupWindow
            ? blocked
              ? "blocked"
              : "matched"
            : "mismatched"
          : candidate.pickupWindow
            ? blocked
              ? "blocked"
              : "matched"
            : "not_required",
      detail_label: !candidatePresent
        ? "Projected commit preview stays informational until a neutral candidate is visible."
        : candidate.pickupWindowRequired
          ? candidate.pickupWindow
            ? "Projected commit preview currently has the required pickup_window fragment."
            : "Projected commit preview still lacks a required pickup_window fragment."
          : candidate.pickupWindow
            ? "Projected commit preview already includes an optional pickup_window fragment."
            : "Projected commit preview does not currently require pickup_window.",
    }),
    buildDeliveryHubProjectedCommitParityPreviewField({
      key: "commit_payload_readiness",
      label: "commit_payload_readiness",
      status:
        commitPayloadReadiness === "matched"
          ? "matched"
          : commitPayloadReadiness === "blocked"
            ? "blocked"
            : commitPayloadReadiness === "partial"
              ? "mismatched"
              : "informational_only",
      detail_label:
        commitPayloadReadiness === "matched"
          ? "Projected commit payload preview currently exposes the shopper-safe fragments expected by the future commit contract shape."
          : commitPayloadReadiness === "blocked"
            ? "Projected commit payload preview remains blocked by readiness or parity blockers already visible in preview surfaces."
            : commitPayloadReadiness === "partial"
              ? "Projected commit payload preview is still missing one or more shopper-safe fragments for the future commit contract shape."
              : "Projected commit payload readiness stays informational until a neutral candidate is visible.",
    }),
  ]

  const mismatchedFieldCount = fields.filter((field) => field.status === "mismatched").length
  const matchedFieldCount = fields.filter((field) =>
    ["matched", "not_required"].includes(field.status)
  ).length
  const mismatchReasons = uniqueDeliveryHubMessages([
    ...fields
      .filter((field) => field.status === "mismatched")
      .map((field) => field.detail_label),
    blocked
      ? `Projected commit preview blockers remain visible from readiness/parity surfaces: ${[
          ...readinessBlockedCodes.map((code) =>
            code === "selection_unavailable"
              ? "selection context unavailable"
              : "connection context unavailable"
          ),
          ...parityBlockedCodes.map((code) =>
            code === "delivery_option_unavailable"
              ? "delivery option unavailable"
              : "selection alignment unavailable"
          ),
        ].join(", ")}.`
      : null,
  ])
  const verdict: DeliveryHubProjectedCommitParityPreviewVerdict = !candidatePresent
    ? "informational_only"
    : blocked
      ? "blocked"
      : mismatchedFieldCount > 0
        ? "projected_commit_mismatched"
        : "projected_commit_matched"

  return {
    tone:
      verdict === "projected_commit_matched"
        ? "positive"
        : verdict === "blocked"
          ? "warning"
          : "neutral",
    verdict,
    verdict_label:
      verdict === "projected_commit_matched"
        ? "Projected commit parity preview looks structurally matched"
        : verdict === "blocked"
          ? "Projected commit parity preview is blocked"
          : verdict === "projected_commit_mismatched"
            ? "Projected commit parity preview still has shopper-safe mismatches"
            : "Projected commit parity preview is informational only",
    summary_label:
      verdict === "projected_commit_matched"
        ? "Current neutral selection preview already resembles the future shipping-option commit contract shape on shopper-safe fields."
        : verdict === "blocked"
          ? "Projected commit parity remains diagnostic-only because readiness or parity blockers are still visible."
          : verdict === "projected_commit_mismatched"
            ? "Current neutral selection preview exposes comparable shopper-safe structure, but projected commit fragments are still missing or incomplete."
            : "Projected commit parity remains diagnostic-only until enough neutral preview context is available.",
    projected_commit_label:
      "Future shipping-option commit contract preview · shopper-safe only · no write path · no network path",
    connection_id: candidate.connection.connection_id,
    mode_code: candidate.quoteType,
    mode_label: getDeliveryHubQuoteTypeLabel(candidate.quoteType),
    quote_reference_present: Boolean(candidate.quoteReference),
    pickup_point_required: candidate.pickupPointRequired,
    pickup_point_present: Boolean(candidate.pickupPoint),
    pickup_window_required: candidate.pickupWindowRequired,
    pickup_window_present: Boolean(candidate.pickupWindow),
    commit_payload_readiness: commitPayloadReadiness,
    matched_field_count: matchedFieldCount,
    mismatched_field_count: mismatchedFieldCount,
    fields,
    mismatch_reasons: mismatchReasons,
    blocked_readiness_codes: readinessBlockedCodes,
    blocked_parity_codes: parityBlockedCodes,
    dry_run_only: true,
    mutation_intent: false,
  }
}

function buildDeliveryHubSelectionWriteSeamPreviewField(input: {
  key: DeliveryHubSelectionWriteSeamPreviewFieldKey
  label: string
  status: DeliveryHubSelectionWriteSeamPreviewFieldStatus
  detail_label: string
}): DeliveryHubSelectionWriteSeamPreviewField {
  return input
}

function buildDeliveryHubWriteIntentContractPreviewPrerequisite(input: {
  key: DeliveryHubWriteIntentContractPreviewPrerequisiteKey
  label: string
  status: DeliveryHubWriteIntentContractPreviewPrerequisiteStatus
  detail_label: string
}): DeliveryHubWriteIntentContractPreviewPrerequisite {
  return input
}

function buildDeliveryHubSelectionPayloadParityPreviewField(input: {
  key: DeliveryHubSelectionPayloadParityPreviewFieldKey
  label: string
  status: DeliveryHubSelectionPayloadParityPreviewFieldStatus
  detail_label: string
}): DeliveryHubSelectionPayloadParityPreviewField {
  return input
}

export function buildDeliveryHubSelectionWriteSeamPreviewModel(
  input: DeliveryHubNeutralSelectionRehearsalInput = {}
): DeliveryHubSelectionWriteSeamPreviewModel {
  const candidate = getDeliveryHubNeutralRehearsalCandidate(input)
  const readiness = input.readiness ?? null
  const parityPreview = buildDeliveryHubShippingOptionParityPreviewModel(input)
  const blockedCodes = Array.from(
    new Set<DeliveryHubSelectionWriteSeamPreviewBlocker>([
      ...sanitizeDeliveryHubProjectedCommitReadinessBlockers(
        (readiness?.issues ?? [])
          .map((issue) => issue.code)
          .filter((code) =>
            [
              "selection_invalid",
              "connection_missing",
              "connection_not_found",
              "connection_disabled",
              "connection_inactive",
              "connection_credentials_not_ready",
            ].includes(code)
          )
      ),
      ...sanitizeDeliveryHubProjectedCommitParityBlockers(
        parityPreview.gap_codes.filter((code) =>
          ["connection_not_ready", "mode_mismatch", "legacy_context_stale"].includes(code)
        )
      ),
    ])
  )
  const candidatePresent = Boolean(
    input.cart_id ||
      candidate.quoteSummary ||
      candidate.quoteReference ||
      candidate.quoteType ||
      candidate.connection.connection_id
  )
  const blocked = blockedCodes.length > 0
  const projectedPayload = candidatePresent
    ? {
        cart_id: input.cart_id?.trim() || null,
        connection_id: candidate.connection.connection_id,
        quote_type: candidate.quoteType,
        quote_reference: candidate.quoteReference,
        quote: candidate.quoteSummary,
        pickup_point: candidate.pickupPoint,
        pickup_window:
          candidate.pickupWindowRequired || candidate.pickupWindow ? candidate.pickupWindow : null,
      }
    : null
  const selectionVersion = candidate.selection?.version ?? null
  const shapeCompleteness: DeliveryHubSelectionWriteSeamPreviewModel["shape_completeness"] =
    !candidatePresent
      ? "informational_only"
      : blocked
        ? "blocked"
        : [
              Boolean(input.cart_id?.trim()),
              Boolean(candidate.connection.connection_id),
              Boolean(candidate.quoteType),
              Boolean(candidate.quoteReference),
              Boolean(candidate.quoteSummary),
              !candidate.pickupPointRequired || Boolean(candidate.pickupPoint),
              !candidate.pickupWindowRequired || Boolean(candidate.pickupWindow),
              selectionVersion !== null,
            ].every(Boolean)
          ? "complete"
          : "partial"

  const fields: DeliveryHubSelectionWriteSeamPreviewField[] = [
    buildDeliveryHubSelectionWriteSeamPreviewField({
      key: "cart_id",
      label: "cart_id",
      status: !candidatePresent
        ? "informational_only"
        : input.cart_id?.trim()
          ? blocked
            ? "blocked"
            : "projected"
          : "missing",
      detail_label: !candidatePresent
        ? "Selection write seam preview stays informational until shopper-safe neutral context is visible."
        : input.cart_id?.trim()
          ? `Projected request preview would scope to cart_id ${input.cart_id.trim()}.`
          : "Projected request preview still lacks cart_id context.",
    }),
    buildDeliveryHubSelectionWriteSeamPreviewField({
      key: "connection_id",
      label: "connection_id",
      status: !candidatePresent
        ? "informational_only"
        : candidate.connection.connection_id
          ? blocked
            ? "blocked"
            : "projected"
          : "missing",
      detail_label: !candidatePresent
        ? "Selection write seam preview stays informational until shopper-safe neutral context is visible."
        : candidate.connection.connection_id
          ? `Projected request preview would currently carry connection_id ${candidate.connection.connection_id}.`
          : "Projected request preview still lacks connection_id.",
    }),
    buildDeliveryHubSelectionWriteSeamPreviewField({
      key: "quote_type",
      label: "quote_type",
      status: !candidatePresent
        ? "informational_only"
        : candidate.quoteType
          ? blocked
            ? "blocked"
            : "projected"
          : "missing",
      detail_label: !candidatePresent
        ? "Selection write seam preview stays informational until shopper-safe neutral context is visible."
        : candidate.quoteType
          ? `Projected request preview would currently carry quote_type ${candidate.quoteType}.`
          : "Projected request preview still lacks quote_type.",
    }),
    buildDeliveryHubSelectionWriteSeamPreviewField({
      key: "quote_reference",
      label: "quote_reference",
      status: !candidatePresent
        ? "informational_only"
        : candidate.quoteReference
          ? blocked
            ? "blocked"
            : "projected"
          : "missing",
      detail_label: !candidatePresent
        ? "Selection write seam preview stays informational until shopper-safe neutral context is visible."
        : candidate.quoteReference
          ? "Projected request preview would currently carry a backend-issued quote_reference."
          : "Projected request preview still lacks a backend-issued quote_reference.",
    }),
    buildDeliveryHubSelectionWriteSeamPreviewField({
      key: "quote",
      label: "quote",
      status: !candidatePresent
        ? "informational_only"
        : candidate.quoteSummary
          ? blocked
            ? "blocked"
            : "projected"
          : "missing",
      detail_label: !candidatePresent
        ? "Selection write seam preview stays informational until shopper-safe neutral context is visible."
        : candidate.quoteSummary
          ? "Projected request preview would currently carry shopper-safe quote summary fields."
          : "Projected request preview still lacks shopper-safe quote summary fields.",
    }),
    buildDeliveryHubSelectionWriteSeamPreviewField({
      key: "pickup_point",
      label: "pickup_point",
      status: !candidatePresent
        ? "informational_only"
        : candidate.pickupPointRequired
          ? candidate.pickupPoint
            ? blocked
              ? "blocked"
              : "projected"
            : "missing"
          : candidate.pickupPoint
            ? blocked
              ? "blocked"
              : "projected"
            : "not_required",
      detail_label: !candidatePresent
        ? "Selection write seam preview stays informational until shopper-safe neutral context is visible."
        : candidate.pickupPointRequired
          ? candidate.pickupPoint
            ? "Projected request preview currently has the required pickup_point fragment."
            : "Projected request preview still lacks a required pickup_point fragment."
          : candidate.pickupPoint
            ? "Projected request preview already includes an optional pickup_point fragment."
            : "Projected request preview does not currently require pickup_point.",
    }),
    buildDeliveryHubSelectionWriteSeamPreviewField({
      key: "pickup_window",
      label: "pickup_window",
      status: !candidatePresent
        ? "informational_only"
        : candidate.pickupWindowRequired
          ? candidate.pickupWindow
            ? blocked
              ? "blocked"
              : "projected"
            : "missing"
          : candidate.pickupWindow
            ? blocked
              ? "blocked"
              : "projected"
            : "not_required",
      detail_label: !candidatePresent
        ? "Selection write seam preview stays informational until shopper-safe neutral context is visible."
        : candidate.pickupWindowRequired
          ? candidate.pickupWindow
            ? "Projected request preview currently has the required pickup_window fragment."
            : "Projected request preview still lacks a required pickup_window fragment."
          : candidate.pickupWindow
            ? "Projected request preview already includes an optional pickup_window fragment."
            : "Projected request preview does not currently require pickup_window.",
    }),
    buildDeliveryHubSelectionWriteSeamPreviewField({
      key: "selection_version",
      label: "selection_version",
      status: !candidatePresent
        ? "informational_only"
        : selectionVersion !== null
          ? blocked
            ? "blocked"
            : "projected"
          : "missing",
      detail_label: !candidatePresent
        ? "Selection write seam preview stays informational until shopper-safe neutral context is visible."
        : selectionVersion !== null
          ? `Projected request preview is currently derived from neutral selection version ${selectionVersion}.`
          : "Projected request preview still lacks a stable neutral selection version anchor.",
    }),
    buildDeliveryHubSelectionWriteSeamPreviewField({
      key: "shape_completeness",
      label: "shape_completeness",
      status:
        shapeCompleteness === "complete"
          ? "projected"
          : shapeCompleteness === "blocked"
            ? "blocked"
            : shapeCompleteness === "partial"
              ? "missing"
              : "informational_only",
      detail_label:
        shapeCompleteness === "complete"
          ? "Projected request preview currently exposes a complete shopper-safe request shape for the future selection write seam."
          : shapeCompleteness === "blocked"
            ? "Projected request preview remains blocked by readiness or parity blockers already visible in preview surfaces."
            : shapeCompleteness === "partial"
              ? "Projected request preview is still missing one or more shopper-safe fragments for a complete future selection write seam shape."
              : "Projected request shape completeness stays informational until shopper-safe neutral context is visible.",
    }),
  ]

  const missingFieldCount = fields.filter((field) => field.status === "missing").length
  const projectedFieldCount = fields.filter((field) =>
    ["projected", "not_required"].includes(field.status)
  ).length
  const mismatchReasons = uniqueDeliveryHubMessages([
    ...fields.filter((field) => field.status === "missing").map((field) => field.detail_label),
    blocked
      ? `Selection write seam preview blockers remain visible from existing preview surfaces: ${blockedCodes
          .map((code) => code.replace(/_/g, " "))
          .join(", ")}.`
      : null,
  ])
  const verdict: DeliveryHubSelectionWriteSeamPreviewVerdict = !candidatePresent
    ? "informational_only"
    : blocked
      ? "blocked"
      : missingFieldCount > 0
        ? "write_shape_preview_incomplete"
        : "write_shape_preview_available"

  return {
    tone:
      verdict === "write_shape_preview_available"
        ? "positive"
        : verdict === "blocked"
          ? "warning"
          : "neutral",
    verdict,
    verdict_label:
      verdict === "write_shape_preview_available"
        ? "Selection write seam preview looks structurally derivable"
        : verdict === "blocked"
          ? "Selection write seam preview is blocked"
          : verdict === "write_shape_preview_incomplete"
            ? "Selection write seam preview is still incomplete"
            : "Selection write seam preview is informational only",
    summary_label:
      verdict === "write_shape_preview_available"
        ? "Current neutral preview already exposes a shopper-safe request shape that could be prepared for a future selection write seam."
        : verdict === "blocked"
          ? "Selection write seam preview remains diagnostic-only because readiness or parity blockers are still visible."
          : verdict === "write_shape_preview_incomplete"
            ? "Current neutral preview exposes a partial shopper-safe request shape, but one or more write-seam fragments are still missing."
            : "Selection write seam preview remains diagnostic-only until enough shopper-safe neutral context is available.",
    projected_request_label:
      "Future POST /store/delivery/selection request preview · shopper-safe only · no write path · no network path",
    cart_id: input.cart_id?.trim() || null,
    connection_id: candidate.connection.connection_id,
    quote_type: candidate.quoteType,
    quote_type_label: getDeliveryHubQuoteTypeLabel(candidate.quoteType),
    quote_reference_present: Boolean(candidate.quoteReference),
    quote_present: Boolean(candidate.quoteSummary),
    pickup_point_required: candidate.pickupPointRequired,
    pickup_point_present: Boolean(candidate.pickupPoint),
    pickup_window_required: candidate.pickupWindowRequired,
    pickup_window_present: Boolean(candidate.pickupWindow),
    selection_version: selectionVersion,
    shape_completeness: shapeCompleteness,
    projected_payload: projectedPayload,
    fields,
    projected_field_count: projectedFieldCount,
    missing_field_count: missingFieldCount,
    blocked_codes: blockedCodes,
    mismatch_reasons: mismatchReasons,
    dry_run_only: true,
    mutation_intent: false,
  }
}

export function buildDeliveryHubWriteIntentContractPreviewModel(
  input: DeliveryHubNeutralSelectionRehearsalInput = {}
): DeliveryHubWriteIntentContractPreviewModel {
  const candidate = getDeliveryHubNeutralRehearsalCandidate(input)
  const shippingOptionParity = buildDeliveryHubShippingOptionParityPreviewModel(input)
  const projectedCommitParity = buildDeliveryHubProjectedCommitParityPreviewModel(input)
  const selectionWriteSeam = buildDeliveryHubSelectionWriteSeamPreviewModel(input)
  const candidatePresent = Boolean(
    input.cart_id ||
      candidate.quoteSummary ||
      candidate.quoteReference ||
      candidate.quoteType ||
      candidate.connection.connection_id
  )
  const blockedReasons = Array.from(
    new Set<DeliveryHubWriteIntentContractPreviewBlockedReason>([
      ...selectionWriteSeam.blocked_codes,
      ...(candidate.quoteReference ? [] : (["quote_reference_missing"] as const)),
      ...(candidate.pickupPointRequired && !candidate.pickupPoint
        ? (["pickup_point_missing"] as const)
        : []),
      ...(candidate.pickupWindowRequired && !candidate.pickupWindow
        ? (["pickup_window_missing"] as const)
        : []),
    ])
  )
  const blocked = selectionWriteSeam.verdict === "blocked"
  const prerequisites: DeliveryHubWriteIntentContractPreviewPrerequisite[] = [
    buildDeliveryHubWriteIntentContractPreviewPrerequisite({
      key: "cart_id",
      label: "cart_id",
      status: !candidatePresent
        ? "informational_only"
        : input.cart_id?.trim()
          ? blocked
            ? "blocked"
            : "satisfied"
          : "missing",
      detail_label: !candidatePresent
        ? "Write-intent contract preview stays informational until shopper-safe neutral context is visible."
        : input.cart_id?.trim()
          ? `Intent preview can scope to cart_id ${input.cart_id.trim()} from the existing preview stack.`
          : "Intent preview still lacks cart_id context.",
    }),
    buildDeliveryHubWriteIntentContractPreviewPrerequisite({
      key: "connection_id",
      label: "connection_id",
      status: !candidatePresent
        ? "informational_only"
        : candidate.connection.connection_id
          ? blocked
            ? "blocked"
            : "satisfied"
          : "missing",
      detail_label: !candidatePresent
        ? "Write-intent contract preview stays informational until shopper-safe neutral context is visible."
        : candidate.connection.connection_id
          ? `Intent preview can derive connection_id ${candidate.connection.connection_id} from existing neutral surfaces.`
          : "Intent preview still lacks connection_id.",
    }),
    buildDeliveryHubWriteIntentContractPreviewPrerequisite({
      key: "quote_type",
      label: "quote_type",
      status: !candidatePresent
        ? "informational_only"
        : candidate.quoteType
          ? blocked
            ? "blocked"
            : "satisfied"
          : "missing",
      detail_label: !candidatePresent
        ? "Write-intent contract preview stays informational until shopper-safe neutral context is visible."
        : candidate.quoteType
          ? `Intent preview can derive quote_type ${candidate.quoteType} from existing neutral surfaces.`
          : "Intent preview still lacks quote_type.",
    }),
    buildDeliveryHubWriteIntentContractPreviewPrerequisite({
      key: "quote_reference",
      label: "quote_reference",
      status: !candidatePresent
        ? "informational_only"
        : candidate.quoteReference
          ? blocked
            ? "blocked"
            : "satisfied"
          : "missing",
      detail_label: !candidatePresent
        ? "Write-intent contract preview stays informational until shopper-safe neutral context is visible."
        : candidate.quoteReference
          ? "Intent preview can reuse the backend-issued quote_reference already visible in neutral preview surfaces."
          : "Intent preview still lacks a backend-issued quote_reference.",
    }),
    buildDeliveryHubWriteIntentContractPreviewPrerequisite({
      key: "quote",
      label: "quote",
      status: !candidatePresent
        ? "informational_only"
        : candidate.quoteSummary
          ? blocked
            ? "blocked"
            : "satisfied"
          : "missing",
      detail_label: !candidatePresent
        ? "Write-intent contract preview stays informational until shopper-safe neutral context is visible."
        : candidate.quoteSummary
          ? "Intent preview can reuse shopper-safe quote summary fields already visible in neutral preview surfaces."
          : "Intent preview still lacks shopper-safe quote summary fields.",
    }),
    buildDeliveryHubWriteIntentContractPreviewPrerequisite({
      key: "pickup_point",
      label: "pickup_point",
      status: !candidatePresent
        ? "informational_only"
        : candidate.pickupPointRequired
          ? candidate.pickupPoint
            ? blocked
              ? "blocked"
              : "satisfied"
            : "missing"
          : candidate.pickupPoint
            ? blocked
              ? "blocked"
              : "satisfied"
            : "not_required",
      detail_label: !candidatePresent
        ? "Write-intent contract preview stays informational until shopper-safe neutral context is visible."
        : candidate.pickupPointRequired
          ? candidate.pickupPoint
            ? "Intent preview already has the required pickup_point fragment."
            : "Intent preview still lacks a required pickup_point fragment."
          : candidate.pickupPoint
            ? "Intent preview already includes an optional pickup_point fragment."
            : "Intent preview does not currently require pickup_point.",
    }),
    buildDeliveryHubWriteIntentContractPreviewPrerequisite({
      key: "pickup_window",
      label: "pickup_window",
      status: !candidatePresent
        ? "informational_only"
        : candidate.pickupWindowRequired
          ? candidate.pickupWindow
            ? blocked
              ? "blocked"
              : "satisfied"
            : "missing"
          : candidate.pickupWindow
            ? blocked
              ? "blocked"
              : "satisfied"
            : "not_required",
      detail_label: !candidatePresent
        ? "Write-intent contract preview stays informational until shopper-safe neutral context is visible."
        : candidate.pickupWindowRequired
          ? candidate.pickupWindow
            ? "Intent preview already has the required pickup_window fragment."
            : "Intent preview still lacks a required pickup_window fragment."
          : candidate.pickupWindow
            ? "Intent preview already includes an optional pickup_window fragment."
            : "Intent preview does not currently require pickup_window.",
    }),
    buildDeliveryHubWriteIntentContractPreviewPrerequisite({
      key: "selection_version",
      label: "selection_version",
      status: !candidatePresent
        ? "informational_only"
        : selectionWriteSeam.selection_version !== null
          ? blocked
            ? "blocked"
            : "satisfied"
          : "missing",
      detail_label: !candidatePresent
        ? "Write-intent contract preview stays informational until shopper-safe neutral context is visible."
        : selectionWriteSeam.selection_version !== null
          ? `Intent preview can anchor to neutral selection version ${selectionWriteSeam.selection_version}.`
          : "Intent preview still lacks a stable neutral selection version anchor.",
    }),
    buildDeliveryHubWriteIntentContractPreviewPrerequisite({
      key: "shipping_option_parity",
      label: "shipping_option_parity",
      status: !candidatePresent
        ? "informational_only"
        : shippingOptionParity.verdict === "blocked"
          ? "blocked"
          : shippingOptionParity.verdict === "parity_aligned"
            ? "satisfied"
            : "informational_only",
      detail_label: !candidatePresent
        ? "Write-intent contract preview stays informational until shopper-safe neutral context is visible."
        : shippingOptionParity.verdict === "blocked"
          ? "Shipping-option parity preview currently exposes a blocker for future write-intent shaping."
          : shippingOptionParity.verdict === "parity_aligned"
            ? "Shipping-option parity preview is structurally aligned on shopper-safe fields."
            : "Shipping-option parity preview remains informational but still useful as a diagnostic prerequisite surface.",
    }),
    buildDeliveryHubWriteIntentContractPreviewPrerequisite({
      key: "projected_commit_parity",
      label: "projected_commit_parity",
      status: !candidatePresent
        ? "informational_only"
        : projectedCommitParity.verdict === "blocked"
          ? "blocked"
          : projectedCommitParity.commit_payload_readiness === "matched"
            ? "satisfied"
            : projectedCommitParity.commit_payload_readiness === "partial"
              ? "missing"
              : "informational_only",
      detail_label: !candidatePresent
        ? "Write-intent contract preview stays informational until shopper-safe neutral context is visible."
        : projectedCommitParity.verdict === "blocked"
          ? "Projected commit parity preview currently exposes a blocker for future write-intent shaping."
          : projectedCommitParity.commit_payload_readiness === "matched"
            ? "Projected commit parity preview already matches the shopper-safe commit payload shape."
            : projectedCommitParity.commit_payload_readiness === "partial"
              ? "Projected commit parity preview still lacks one or more shopper-safe fragments."
              : "Projected commit parity preview remains informational only.",
    }),
    buildDeliveryHubWriteIntentContractPreviewPrerequisite({
      key: "selection_write_seam",
      label: "selection_write_seam",
      status: !candidatePresent
        ? "informational_only"
        : selectionWriteSeam.verdict === "blocked"
          ? "blocked"
          : selectionWriteSeam.verdict === "write_shape_preview_available"
            ? "satisfied"
            : selectionWriteSeam.verdict === "write_shape_preview_incomplete"
              ? "missing"
              : "informational_only",
      detail_label: !candidatePresent
        ? "Write-intent contract preview stays informational until shopper-safe neutral context is visible."
        : selectionWriteSeam.verdict === "blocked"
          ? "Selection write seam preview is blocked by existing readiness or parity blockers."
          : selectionWriteSeam.verdict === "write_shape_preview_available"
            ? "Selection write seam preview already exposes a structurally derivable shopper-safe request shape."
            : selectionWriteSeam.verdict === "write_shape_preview_incomplete"
              ? "Selection write seam preview remains incomplete because one or more shopper-safe fragments are still missing."
              : "Selection write seam preview remains informational only.",
    }),
  ]
  const requiredPrerequisites = prerequisites.filter(
    (prerequisite) => prerequisite.status !== "informational_only"
  )
  const satisfiedPrerequisiteCount = prerequisites.filter(
    (prerequisite) =>
      prerequisite.status === "satisfied" || prerequisite.status === "not_required"
  ).length
  const missingPrerequisiteCount = prerequisites.filter(
    (prerequisite) => prerequisite.status === "missing"
  ).length
  const blockedPrerequisiteCount = prerequisites.filter(
    (prerequisite) => prerequisite.status === "blocked"
  ).length
  const status: DeliveryHubWriteIntentContractPreviewStatus = !candidatePresent
    ? "informational_only"
    : blockedPrerequisiteCount > 0
      ? "blocked"
      : missingPrerequisiteCount > 0
        ? "intent_incomplete"
        : "intent_shape_available"

  return {
    tone:
      status === "intent_shape_available"
        ? "positive"
        : status === "blocked"
          ? "warning"
          : "neutral",
    status,
    status_label:
      status === "intent_shape_available"
        ? "Write-intent contract preview looks structurally available"
        : status === "blocked"
          ? "Write-intent contract preview is blocked"
          : status === "intent_incomplete"
            ? "Write-intent contract preview is still incomplete"
            : "Write-intent contract preview is informational only",
    summary_label:
      status === "intent_shape_available"
        ? "Existing preview-only surfaces already expose a shopper-safe future write-intent contract shape for diagnostics only."
        : status === "blocked"
          ? "Existing preview-only surfaces still expose readiness or parity blockers, so write-intent contract preview remains diagnostic-only."
          : status === "intent_incomplete"
            ? "Existing preview-only surfaces expose part of the future write-intent contract shape, but one or more required shopper-safe fragments are still missing."
            : "Write-intent contract preview remains informational until enough shopper-safe neutral context is available.",
    intent_target_label:
      "Future write-intent target preview: POST /store/delivery/selection",
    preview_label:
      "Delivery Hub write-intent contract preview · diagnostic only · no shopper action path · no network path",
    shopper_safe_intent_target: "POST /store/delivery/selection",
    required_prerequisite_count: requiredPrerequisites.length,
    satisfied_prerequisite_count: satisfiedPrerequisiteCount,
    missing_prerequisite_count: missingPrerequisiteCount,
    blocked_prerequisite_count: blockedPrerequisiteCount,
    prerequisites,
    blocked_reasons: blockedReasons,
    disabled_actions: [
      "selection_action",
      "persist_selection",
      "clear_selection",
      "set_shipping_method",
      "network_request",
    ],
    hint_messages: uniqueDeliveryHubMessages([
      "Preview-only write-intent contract layer only: no persistence, clearing, checkout action, or shipping-method mutation is performed here.",
      "This contract preview is diagnostic only and does not create network intent for POST /store/delivery/selection.",
      "The active checkout commit path remains legacy ApiShip.",
      blockedReasons.includes("quote_reference_missing")
        ? "Backend-issued quote_reference is still required before a future shopper-safe write-intent shape can be considered available."
        : null,
      blockedReasons.includes("pickup_point_missing")
        ? "Required pickup_point fragment is still missing from the shopper-safe preview stack."
        : null,
      blockedReasons.includes("pickup_window_missing")
        ? "Required pickup_window fragment is still missing from the shopper-safe preview stack."
        : null,
      ...selectionWriteSeam.mismatch_reasons,
    ]).slice(0, 6),
    mutation_intent: false,
    submit_enabled: false,
    network_required_now: false,
    dry_run_only: true,
  }
}

export function buildDeliveryHubSelectionPayloadParityPreviewModel(
  input: DeliveryHubNeutralSelectionRehearsalInput = {}
): DeliveryHubSelectionPayloadParityPreviewModel {
  const candidate = getDeliveryHubNeutralRehearsalCandidate(input)
  const selectionWriteSeam = buildDeliveryHubSelectionWriteSeamPreviewModel(input)
  const candidatePresent = Boolean(
    input.cart_id ||
      candidate.quoteSummary ||
      candidate.quoteReference ||
      candidate.quoteType ||
      candidate.connection.connection_id
  )
  const blockedReasons = Array.from(
    new Set<DeliveryHubSelectionPayloadParityPreviewBlockedReason>([
      ...selectionWriteSeam.blocked_codes,
      ...(candidate.quoteReference ? [] : (["quote_reference_missing"] as const)),
      ...(candidate.pickupPointRequired && !candidate.pickupPoint
        ? (["pickup_point_missing"] as const)
        : []),
      ...(candidate.pickupWindowRequired && !candidate.pickupWindow
        ? (["pickup_window_missing"] as const)
        : []),
      ...(selectionWriteSeam.selection_version !== null
        ? []
        : (["selection_version_missing"] as const)),
    ])
  )
  const blocked = selectionWriteSeam.verdict === "blocked"

  const fields: DeliveryHubSelectionPayloadParityPreviewField[] = [
    buildDeliveryHubSelectionPayloadParityPreviewField({
      key: "connection_id",
      label: "connection_id",
      status: !candidatePresent
        ? "informational_only"
        : candidate.connection.connection_id
          ? blocked
            ? "blocked"
            : "matched"
          : "incomplete",
      detail_label: !candidatePresent
        ? "Payload parity preview stays informational until shopper-safe neutral context is visible."
        : candidate.connection.connection_id
          ? `Projected payload preview currently matches expected connection_id ${candidate.connection.connection_id}.`
          : "Projected payload preview still lacks expected connection_id.",
    }),
    buildDeliveryHubSelectionPayloadParityPreviewField({
      key: "quote_type",
      label: "quote_type",
      status: !candidatePresent
        ? "informational_only"
        : candidate.quoteType
          ? blocked
            ? "blocked"
            : "matched"
          : "incomplete",
      detail_label: !candidatePresent
        ? "Payload parity preview stays informational until shopper-safe neutral context is visible."
        : candidate.quoteType
          ? `Projected payload preview currently matches expected quote_type ${candidate.quoteType}.`
          : "Projected payload preview still lacks expected quote_type.",
    }),
    buildDeliveryHubSelectionPayloadParityPreviewField({
      key: "quote_reference",
      label: "quote_reference",
      status: !candidatePresent
        ? "informational_only"
        : candidate.quoteReference
          ? blocked
            ? "blocked"
            : "matched"
          : "incomplete",
      detail_label: !candidatePresent
        ? "Payload parity preview stays informational until shopper-safe neutral context is visible."
        : candidate.quoteReference
          ? "Projected payload preview currently matches the expected backend-issued quote_reference fragment."
          : "Projected payload preview still lacks the expected backend-issued quote_reference fragment.",
    }),
    buildDeliveryHubSelectionPayloadParityPreviewField({
      key: "pickup_point",
      label: "pickup_point",
      status: !candidatePresent
        ? "informational_only"
        : candidate.pickupPointRequired
          ? candidate.pickupPoint
            ? blocked
              ? "blocked"
              : "matched"
            : "incomplete"
          : candidate.pickupPoint
            ? blocked
              ? "blocked"
              : "matched"
            : "not_required",
      detail_label: !candidatePresent
        ? "Payload parity preview stays informational until shopper-safe neutral context is visible."
        : candidate.pickupPointRequired
          ? candidate.pickupPoint
            ? "Projected payload preview currently matches the expected required pickup_point fragment."
            : "Projected payload preview still lacks the expected required pickup_point fragment."
          : candidate.pickupPoint
            ? "Projected payload preview already includes an optional pickup_point fragment."
            : "Projected payload preview does not currently require pickup_point.",
    }),
    buildDeliveryHubSelectionPayloadParityPreviewField({
      key: "pickup_window",
      label: "pickup_window",
      status: !candidatePresent
        ? "informational_only"
        : candidate.pickupWindowRequired
          ? candidate.pickupWindow
            ? blocked
              ? "blocked"
              : "matched"
            : "incomplete"
          : candidate.pickupWindow
            ? blocked
              ? "blocked"
              : "matched"
            : "not_required",
      detail_label: !candidatePresent
        ? "Payload parity preview stays informational until shopper-safe neutral context is visible."
        : candidate.pickupWindowRequired
          ? candidate.pickupWindow
            ? "Projected payload preview currently matches the expected required pickup_window fragment."
            : "Projected payload preview still lacks the expected required pickup_window fragment."
          : candidate.pickupWindow
            ? "Projected payload preview already includes an optional pickup_window fragment."
            : "Projected payload preview does not currently require pickup_window.",
    }),
    buildDeliveryHubSelectionPayloadParityPreviewField({
      key: "selection_version",
      label: "selection_version",
      status: !candidatePresent
        ? "informational_only"
        : selectionWriteSeam.selection_version !== null
          ? blocked
            ? "blocked"
            : "matched"
          : "incomplete",
      detail_label: !candidatePresent
        ? "Payload parity preview stays informational until shopper-safe neutral context is visible."
        : selectionWriteSeam.selection_version !== null
          ? `Projected payload preview is anchored to neutral selection version ${selectionWriteSeam.selection_version}.`
          : "Projected payload preview still lacks a stable neutral selection version anchor.",
    }),
    buildDeliveryHubSelectionPayloadParityPreviewField({
      key: "shape_completeness",
      label: "shape_completeness",
      status:
        selectionWriteSeam.shape_completeness === "complete"
          ? "matched"
          : selectionWriteSeam.shape_completeness === "blocked"
            ? "blocked"
            : selectionWriteSeam.shape_completeness === "partial"
              ? "incomplete"
              : "informational_only",
      detail_label:
        selectionWriteSeam.shape_completeness === "complete"
          ? "Projected payload preview currently matches the expected shopper-safe save-contract shape."
          : selectionWriteSeam.shape_completeness === "blocked"
            ? "Projected payload preview remains blocked by readiness or parity blockers already visible in preview surfaces."
            : selectionWriteSeam.shape_completeness === "partial"
              ? "Projected payload preview still lacks one or more shopper-safe fragments for expected save-contract parity."
              : "Projected payload preview completeness stays informational until shopper-safe neutral context is visible.",
    }),
    buildDeliveryHubSelectionPayloadParityPreviewField({
      key: "blocked_reasons",
      label: "blocked_reasons",
      status: !candidatePresent
        ? "informational_only"
        : blocked
          ? "blocked"
          : blockedReasons.length > 0
            ? "incomplete"
            : "matched",
      detail_label: !candidatePresent
        ? "Payload parity preview stays informational until shopper-safe neutral context is visible."
        : blocked
          ? `Projected payload parity remains blocked by preview blockers: ${blockedReasons.join(", ")}.`
          : blockedReasons.length > 0
            ? `Projected payload parity still has shopper-safe parity gaps: ${blockedReasons.join(", ")}.`
            : "Projected payload parity currently has no shopper-safe blocked reasons.",
    }),
  ]

  const matchedFieldCount = fields.filter((field) =>
    ["matched", "not_required"].includes(field.status)
  ).length
  const incompleteFieldCount = fields.filter((field) => field.status === "incomplete").length
  const blockedFieldCount = fields.filter((field) => field.status === "blocked").length
  const verdict: DeliveryHubSelectionPayloadParityPreviewVerdict = !candidatePresent
    ? "informational_only"
    : blocked
      ? "blocked"
      : incompleteFieldCount > 0
        ? "incomplete"
        : "matched"

  return {
    tone:
      verdict === "matched"
        ? "positive"
        : verdict === "blocked"
          ? "warning"
          : "neutral",
    verdict,
    verdict_label:
      verdict === "matched"
        ? "Selection payload parity preview looks structurally matched"
        : verdict === "blocked"
          ? "Selection payload parity preview is blocked"
          : verdict === "incomplete"
            ? "Selection payload parity preview is still incomplete"
            : "Selection payload parity preview is informational only",
    summary_label:
      verdict === "matched"
        ? "Existing read-only preview surfaces already project a shopper-safe payload shape that matches the expected neutral selection contract fields."
        : verdict === "blocked"
          ? "Selection payload parity remains diagnostic-only because readiness or parity blockers are still visible in the current preview stack."
          : verdict === "incomplete"
            ? "Existing read-only preview surfaces expose part of the expected neutral selection contract payload shape, but one or more shopper-safe fields are still incomplete."
            : "Selection payload parity preview remains diagnostic-only until enough shopper-safe neutral context is available.",
    projected_payload_label:
      "Projected storefront payload preview · shopper-safe only · no write path · no network path",
    expected_contract_label:
      "Expected neutral selection contract preview · shopper-safe only · preview vocabulary preserved",
    payload_target_label:
      "Future payload target preview: POST /store/delivery/selection",
    shopper_safe_payload_target: "POST /store/delivery/selection",
    connection_id: candidate.connection.connection_id,
    quote_type: candidate.quoteType,
    quote_type_label: getDeliveryHubQuoteTypeLabel(candidate.quoteType),
    quote_reference_present: Boolean(candidate.quoteReference),
    pickup_point_required: candidate.pickupPointRequired,
    pickup_point_present: Boolean(candidate.pickupPoint),
    pickup_window_required: candidate.pickupWindowRequired,
    pickup_window_present: Boolean(candidate.pickupWindow),
    selection_version: selectionWriteSeam.selection_version,
    shape_completeness: selectionWriteSeam.shape_completeness,
    matched_field_count: matchedFieldCount,
    incomplete_field_count: incompleteFieldCount,
    blocked_field_count: blockedFieldCount,
    fields,
    blocked_reasons: blockedReasons,
    hint_messages: uniqueDeliveryHubMessages([
      "Preview-only selection payload parity layer: no persistence, clearing, checkout action, or shipping-method mutation is performed here.",
      "This parity preview is diagnostic only and does not create network intent for POST /store/delivery/selection.",
      "The active checkout commit path remains legacy ApiShip.",
      ...selectionWriteSeam.mismatch_reasons,
      blockedReasons.includes("quote_reference_missing")
        ? "Backend-issued quote_reference is still required for shopper-safe payload parity."
        : null,
      blockedReasons.includes("pickup_point_missing")
        ? "Required pickup_point fragment is still missing from the shopper-safe payload preview."
        : null,
      blockedReasons.includes("pickup_window_missing")
        ? "Required pickup_window fragment is still missing from the shopper-safe payload preview."
        : null,
      blockedReasons.includes("selection_version_missing")
        ? "Neutral selection_version anchor is still missing from the shopper-safe payload parity layer."
        : null,
    ]).slice(0, 6),
    dry_run_only: true,
    mutation_intent: false,
    network_required_now: false,
  }
}

function getDeliveryHubPreviewToneSummary(
  previews: Array<{ tone: "neutral" | "positive" | "warning" }>
) {
  const positiveCount = previews.filter((preview) => preview.tone === "positive").length
  const warningCount = previews.filter((preview) => preview.tone === "warning").length
  const neutralCount = previews.length - positiveCount - warningCount

  return `${positiveCount} positive · ${warningCount} attention · ${neutralCount} informational`
}

function getDeliveryHubPreviewPrimaryHint(preview: { hint_messages: string[] }) {
  return preview.hint_messages[0] ?? null
}

export function buildDeliveryHubShadowOrchestrationVerdictPreviewModel(
  preview: DeliveryHubShadowOrchestrationVerdictPreviewState
): DeliveryHubShadowOrchestrationVerdictPreviewModel {
  const actionabilityStatus =
    preview.shadow_selection_actionability_preview.actionability_status
  const shippingOptionParityState =
    preview.shadow_shipping_option_parity_preview.parity_state
  const selectionParityStatus = preview.shadow_selection_parity_preview.parity_status
  const blocked = actionabilityStatus === "blocked_by_readiness"
  const degraded =
    !blocked &&
    (actionabilityStatus === "stale" ||
      actionabilityStatus === "needs_quote" ||
      actionabilityStatus === "needs_pickup_point" ||
      actionabilityStatus === "needs_pickup_window" ||
      shippingOptionParityState === "divergent" ||
      selectionParityStatus === "missing_neutral_selection" ||
      selectionParityStatus === "modality_mismatch" ||
      selectionParityStatus === "reference_mismatch")
  const aligned =
    !blocked &&
    !degraded &&
    actionabilityStatus === "ready" &&
    shippingOptionParityState === "aligned" &&
    selectionParityStatus === "aligned"
  const verdictCode: DeliveryHubShadowOrchestrationVerdict = aligned
    ? "aligned"
    : blocked
      ? "blocked"
      : degraded
        ? "degraded"
        : "insufficient_data"
  const signalSummaryLabel = getDeliveryHubPreviewToneSummary([
    preview.readiness_preview,
    preview.persisted_selection_preview,
    preview.shadow_catalog_preview,
    preview.shadow_settings_preview,
    preview.shadow_quote_preview,
    preview.shadow_pickup_point_preview,
    preview.shadow_pickup_window_preview,
    preview.shadow_selection_actionability_preview,
    preview.shadow_shipping_option_parity_preview,
    preview.shadow_selection_parity_preview,
  ])

  return {
    tone:
      verdictCode === "aligned"
        ? "positive"
        : verdictCode === "blocked" || verdictCode === "degraded"
          ? "warning"
          : "neutral",
    verdict_code: verdictCode,
    status_label:
      verdictCode === "aligned"
        ? "Shadow orchestration verdict aligned"
        : verdictCode === "blocked"
          ? "Shadow orchestration verdict blocked"
          : verdictCode === "degraded"
            ? "Shadow orchestration verdict degraded"
            : "Shadow orchestration verdict informational only",
    signal_summary_label: signalSummaryLabel,
    actionability_label: getDeliveryHubShadowSelectionActionabilityLabel(
      actionabilityStatus
    ),
    shipping_option_parity_label: getDeliveryHubShadowShippingOptionParityLabel(
      shippingOptionParityState
    ),
    selection_parity_label: getDeliveryHubShadowSelectionParityLabel(
      selectionParityStatus
    ),
    hint_messages: uniqueDeliveryHubMessages([
      verdictCode === "aligned"
        ? "Current read-only shadow constellation agrees across readiness, actionability, and parity previews for the sampled legacy checkout context."
        : verdictCode === "blocked"
          ? "Current read-only shadow constellation indicates the neutral checkout path is blocked by readiness or settings constraints for this cart context."
          : verdictCode === "degraded"
            ? "Current read-only shadow constellation shows degradation or parity drift, so rollout observability remains watch-only."
            : "Current read-only shadow constellation is still informational and does not yet provide enough comparable context for a stronger rollout verdict."
      ,
      getDeliveryHubPreviewPrimaryHint(preview.shadow_selection_actionability_preview),
      getDeliveryHubPreviewPrimaryHint(preview.shadow_shipping_option_parity_preview),
      getDeliveryHubPreviewPrimaryHint(preview.shadow_selection_parity_preview),
      preview.shadow_settings_preview.tone === "warning"
        ? getDeliveryHubPreviewPrimaryHint(preview.shadow_settings_preview)
        : null,
      preview.shadow_catalog_preview.tone === "warning"
        ? getDeliveryHubPreviewPrimaryHint(preview.shadow_catalog_preview)
        : null,
      preview.shadow_quote_preview.tone === "warning"
        ? getDeliveryHubPreviewPrimaryHint(preview.shadow_quote_preview)
        : null,
      preview.shadow_pickup_point_preview.tone === "warning"
        ? getDeliveryHubPreviewPrimaryHint(preview.shadow_pickup_point_preview)
        : null,
      preview.shadow_pickup_window_preview.tone === "warning"
        ? getDeliveryHubPreviewPrimaryHint(preview.shadow_pickup_window_preview)
        : null,
      preview.readiness_preview.tone === "warning"
        ? preview.readiness_preview.issue_messages[0] ?? null
        : null,
      preview.persisted_selection_preview.tone === "warning"
        ? getDeliveryHubPreviewPrimaryHint(preview.persisted_selection_preview)
        : null,
    ]).slice(0, 4),
  }
}

export function buildDeliveryHubShadowOrchestrationRecommendationPreviewModel(
  preview: DeliveryHubShadowOrchestrationRecommendationPreviewState
): DeliveryHubShadowOrchestrationRecommendationPreviewModel {
  const actionabilityStatus =
    preview.shadow_selection_actionability_preview.actionability_status
  const shippingOptionParityState =
    preview.shadow_shipping_option_parity_preview.parity_state
  const selectionParityStatus = preview.shadow_selection_parity_preview.parity_status
  const verdictCode = preview.shadow_orchestration_verdict_preview.verdict_code
  const persistedSelectionPreview = preview.persisted_selection_preview
  const hasPersistedSelection = persistedSelectionPreview.updated_at !== null
  const readinessLabel =
    persistedSelectionPreview.readiness_label ?? preview.readiness_preview.status_label
  const detailLabel = [
    preview.shadow_orchestration_verdict_preview.actionability_label,
    preview.shadow_orchestration_verdict_preview.shipping_option_parity_label,
    preview.shadow_orchestration_verdict_preview.selection_parity_label,
  ].join(" · ")
  const insufficientData =
    verdictCode === "insufficient_data" ||
    actionabilityStatus === "incomplete" ||
    shippingOptionParityState === "insufficient_context" ||
    shippingOptionParityState === "not_applicable" ||
    selectionParityStatus === "insufficient_data" ||
    selectionParityStatus === "missing_legacy_method"
  const unavailable =
    !insufficientData &&
    (verdictCode === "blocked" ||
      verdictCode === "degraded" ||
      actionabilityStatus === "blocked_by_readiness" ||
      actionabilityStatus === "stale" ||
      actionabilityStatus === "needs_quote" ||
      actionabilityStatus === "needs_pickup_point" ||
      actionabilityStatus === "needs_pickup_window" ||
      shippingOptionParityState === "divergent" ||
      selectionParityStatus === "missing_neutral_selection" ||
      selectionParityStatus === "modality_mismatch" ||
      selectionParityStatus === "reference_mismatch")
  const recommended =
    !insufficientData &&
    !unavailable &&
    verdictCode === "aligned" &&
    actionabilityStatus === "ready" &&
    shippingOptionParityState === "aligned" &&
    selectionParityStatus === "aligned" &&
    hasPersistedSelection

  if (recommended) {
    return {
      tone: "positive",
      recommendation_status: "recommended",
      status_label: "Shadow recommendation preview available",
      recommended_modality_label: persistedSelectionPreview.modality_label,
      recommended_pickup_point_label: persistedSelectionPreview.pickup_point_label,
      recommended_pickup_window_label: persistedSelectionPreview.pickup_window_label,
      recommended_quote_amount: persistedSelectionPreview.quote_amount,
      currency_code: persistedSelectionPreview.currency_code,
      recommended_quote_eta_label: persistedSelectionPreview.quote_eta_label,
      readiness_label: readinessLabel,
      detail_label: detailLabel,
      hint_messages: uniqueDeliveryHubMessages([
        "Read-only shadow recommendation only. Current checkout keeps the committed legacy shipping flow and does not switch shipping method or save any neutral selection from this preview.",
        "If shadow orchestration were active for the current cart context, it would currently favor the persisted neutral selection summary shown below.",
        getDeliveryHubPreviewPrimaryHint(preview.shadow_orchestration_verdict_preview),
        getDeliveryHubPreviewPrimaryHint(persistedSelectionPreview),
      ]).slice(0, 4),
    }
  }

  if (unavailable) {
    return {
      tone: "warning",
      recommendation_status: "unavailable",
      status_label: "Shadow recommendation preview unavailable",
      recommended_modality_label: null,
      recommended_pickup_point_label: null,
      recommended_pickup_window_label: null,
      recommended_quote_amount: null,
      currency_code: null,
      recommended_quote_eta_label: null,
      readiness_label: readinessLabel,
      detail_label: detailLabel,
      hint_messages: uniqueDeliveryHubMessages([
        "Current shadow constellation does not support a shopper-safe recommendation for this cart context, so this block remains informational only.",
        "The active checkout commit path remains the legacy ApiShip flow; this preview does not change the committed shipping method.",
        getDeliveryHubPreviewPrimaryHint(preview.shadow_orchestration_verdict_preview),
        getDeliveryHubPreviewPrimaryHint(preview.shadow_selection_actionability_preview),
        getDeliveryHubPreviewPrimaryHint(preview.shadow_shipping_option_parity_preview),
        getDeliveryHubPreviewPrimaryHint(preview.shadow_selection_parity_preview),
      ]).slice(0, 4),
    }
  }

  return {
    tone: "neutral",
    recommendation_status: "insufficient_data",
    status_label: "Shadow recommendation preview needs more context",
    recommended_modality_label: null,
    recommended_pickup_point_label: null,
    recommended_pickup_window_label: null,
    recommended_quote_amount: null,
    currency_code: null,
    recommended_quote_eta_label: null,
    readiness_label: readinessLabel,
    detail_label: detailLabel,
    hint_messages: uniqueDeliveryHubMessages([
      "Current shadow constellation is still informational only and does not yet have enough shopper-safe context to describe a recommendation.",
      "The active checkout commit path remains the legacy ApiShip flow; this preview does not save, clear, or commit anything.",
      getDeliveryHubPreviewPrimaryHint(preview.shadow_orchestration_verdict_preview),
      getDeliveryHubPreviewPrimaryHint(preview.shadow_selection_actionability_preview),
      getDeliveryHubPreviewPrimaryHint(preview.shadow_shipping_option_parity_preview),
      getDeliveryHubPreviewPrimaryHint(preview.shadow_selection_parity_preview),
    ]).slice(0, 4),
  }
}

export function buildDeliveryHubShadowCutoverBlockersPreviewModel(
  preview: DeliveryHubShadowCutoverBlockersPreviewState
): DeliveryHubShadowCutoverBlockersPreviewModel {
  const actionabilityStatus =
    preview.shadow_selection_actionability_preview.actionability_status
  const shippingOptionParityState =
    preview.shadow_shipping_option_parity_preview.parity_state
  const selectionParityStatus = preview.shadow_selection_parity_preview.parity_status
  const verdictCode = preview.shadow_orchestration_verdict_preview.verdict_code
  const recommendationStatus =
    preview.shadow_orchestration_recommendation_preview.recommendation_status
  const cutoverReadinessStatus =
    preview.shadow_cutover_readiness_preview.cutover_readiness_status
  const readinessLabel =
    preview.shadow_cutover_readiness_preview.readiness_label ??
    preview.shadow_orchestration_recommendation_preview.readiness_label ??
    preview.persisted_selection_preview.readiness_label ??
    preview.readiness_preview.status_label
  const verdictLabel = `shadow verdict ${formatDeliveryHubPreviewCodeLabel(verdictCode)}`
  const recommendationLabel =
    preview.shadow_cutover_readiness_preview.recommendation_label ??
    `shadow recommendation ${formatDeliveryHubPreviewCodeLabel(recommendationStatus)}`
  const blockers: DeliveryHubShadowCutoverBlockerItem[] = []

  const pushBlocker = (
    code: DeliveryHubShadowCutoverBlockerCode,
    label: string,
    detailLabel: string | null
  ) => {
    if (blockers.some((blocker) => blocker.code === code)) {
      return
    }

    blockers.push({
      code,
      label,
      detail_label: detailLabel,
    })
  }

  switch (actionabilityStatus) {
    case "blocked_by_readiness":
      pushBlocker(
        "blocked_by_readiness",
        "Readiness or settings still block the neutral path",
        getDeliveryHubPreviewPrimaryHint(preview.shadow_selection_actionability_preview) ??
          preview.readiness_preview.issue_messages[0] ??
          null
      )
      break
    case "needs_quote":
      pushBlocker(
        "needs_quote",
        "Neutral quote context is still missing",
        getDeliveryHubPreviewPrimaryHint(preview.shadow_selection_actionability_preview)
      )
      break
    case "needs_pickup_point":
      pushBlocker(
        "needs_pickup_point",
        "Neutral pickup-point context is still missing",
        getDeliveryHubPreviewPrimaryHint(preview.shadow_selection_actionability_preview)
      )
      break
    case "needs_pickup_window":
      pushBlocker(
        "needs_pickup_window",
        "Neutral pickup-window context is still missing",
        getDeliveryHubPreviewPrimaryHint(preview.shadow_selection_actionability_preview)
      )
      break
    case "stale":
      pushBlocker(
        "stale_shadow_context",
        "Sampled shadow context looks stale",
        getDeliveryHubPreviewPrimaryHint(preview.shadow_selection_actionability_preview)
      )
      break
  }

  if (shippingOptionParityState === "divergent") {
    pushBlocker(
      "shipping_option_parity_divergent",
      "Committed legacy shipping option diverges from sampled shadow parity",
      getDeliveryHubPreviewPrimaryHint(preview.shadow_shipping_option_parity_preview)
    )
  }

  switch (selectionParityStatus) {
    case "missing_neutral_selection":
      pushBlocker(
        "missing_neutral_selection",
        "Neutral persisted selection is missing",
        getDeliveryHubPreviewPrimaryHint(preview.shadow_selection_parity_preview)
      )
      break
    case "modality_mismatch":
      pushBlocker(
        "selection_modality_mismatch",
        "Legacy and neutral delivery modalities differ",
        getDeliveryHubPreviewPrimaryHint(preview.shadow_selection_parity_preview)
      )
      break
    case "reference_mismatch":
      pushBlocker(
        "selection_reference_mismatch",
        "Legacy and neutral pickup references differ",
        getDeliveryHubPreviewPrimaryHint(preview.shadow_selection_parity_preview)
      )
      break
  }

  const insufficientData =
    blockers.length === 0 &&
    (cutoverReadinessStatus === "insufficient_data" ||
      verdictCode === "insufficient_data" ||
      recommendationStatus === "insufficient_data" ||
      actionabilityStatus === "incomplete" ||
      shippingOptionParityState === "insufficient_context" ||
      shippingOptionParityState === "not_applicable" ||
      selectionParityStatus === "insufficient_data" ||
      selectionParityStatus === "missing_legacy_method")

  if (blockers.length > 0) {
    return {
      tone: "warning",
      blockers_status: "known_blockers",
      status_label: "Known shadow cutover blockers visible",
      readiness_label: readinessLabel,
      verdict_label: verdictLabel,
      recommendation_label: recommendationLabel,
      blocker_count_label: `${formatDeliveryHubCountLabel(
        blockers.length,
        "known blocker",
        "known blockers"
      )} visible`,
      blockers,
      hint_messages: uniqueDeliveryHubMessages([
        "Read-only shadow cutover blockers preview only. Known blocker points below are derived from existing shadow previews for the current checkout context and do not change shopper state.",
        "Current checkout still commits through the active legacy ApiShip flow. This block does not save, clear, or switch anything.",
        cutoverReadinessStatus === "insufficient_data"
          ? "Some shadow signals remain informational only, so this list reflects only blockers already visible in current read-only previews."
          : null,
        getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_readiness_preview),
      ]).slice(0, 4),
    }
  }

  if (insufficientData) {
    return {
      tone: "neutral",
      blockers_status: "insufficient_data",
      status_label: "Shadow cutover blockers preview needs more context",
      readiness_label: readinessLabel,
      verdict_label: verdictLabel,
      recommendation_label: recommendationLabel,
      blocker_count_label: null,
      blockers: [],
      hint_messages: uniqueDeliveryHubMessages([
        "Read-only shadow cutover blockers preview does not yet have enough comparable context to list blocker points for the current checkout.",
        "Current checkout still commits through the active legacy ApiShip flow. This block does not save, clear, or switch anything.",
        getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_readiness_preview),
        getDeliveryHubPreviewPrimaryHint(preview.shadow_orchestration_recommendation_preview),
      ]).slice(0, 4),
    }
  }

  return {
    tone: "neutral",
    blockers_status: "no_known_blockers",
    status_label: "No known shadow cutover blockers visible",
    readiness_label: readinessLabel,
    verdict_label: verdictLabel,
    recommendation_label: recommendationLabel,
    blocker_count_label: null,
    blockers: [],
    hint_messages: uniqueDeliveryHubMessages([
      "Read-only shadow cutover blockers preview only. No known blocker points are currently visible in existing shadow previews for this checkout context.",
      "This neutral result does not claim that checkout is already cut over or that the active shipping commit path has changed.",
      "Current checkout still commits through the active legacy ApiShip flow. This block does not save, clear, or switch anything.",
    ]).slice(0, 4),
  }
}

export function buildDeliveryHubShadowCutoverReadinessPreviewModel(
  preview: DeliveryHubShadowCutoverReadinessPreviewState
): DeliveryHubShadowCutoverReadinessPreviewModel {
  const actionabilityStatus =
    preview.shadow_selection_actionability_preview.actionability_status
  const shippingOptionParityState =
    preview.shadow_shipping_option_parity_preview.parity_state
  const selectionParityStatus = preview.shadow_selection_parity_preview.parity_status
  const verdictCode = preview.shadow_orchestration_verdict_preview.verdict_code
  const recommendationStatus =
    preview.shadow_orchestration_recommendation_preview.recommendation_status
  const readinessLabel =
    preview.shadow_orchestration_recommendation_preview.readiness_label ??
    preview.persisted_selection_preview.readiness_label ??
    preview.readiness_preview.status_label
  const recommendationLabel = `shadow recommendation ${formatDeliveryHubPreviewCodeLabel(
    recommendationStatus
  )}`
  const modalityLabel =
    preview.shadow_orchestration_recommendation_preview.recommended_modality_label ??
    preview.persisted_selection_preview.modality_label ??
    preview.readiness_preview.quote_type_label
  const detailLabel = [
    `verdict ${formatDeliveryHubPreviewCodeLabel(verdictCode)}`,
    recommendationLabel,
    getDeliveryHubShadowSelectionActionabilityLabel(actionabilityStatus),
    getDeliveryHubShadowShippingOptionParityLabel(shippingOptionParityState),
    getDeliveryHubShadowSelectionParityLabel(selectionParityStatus),
  ].join(" · ")
  const insufficientData =
    verdictCode === "insufficient_data" ||
    recommendationStatus === "insufficient_data" ||
    actionabilityStatus === "incomplete" ||
    shippingOptionParityState === "insufficient_context" ||
    shippingOptionParityState === "not_applicable" ||
    selectionParityStatus === "insufficient_data" ||
    selectionParityStatus === "missing_legacy_method"
  const ready =
    !insufficientData &&
    verdictCode === "aligned" &&
    recommendationStatus === "recommended" &&
    actionabilityStatus === "ready" &&
    shippingOptionParityState === "aligned" &&
    selectionParityStatus === "aligned"

  if (ready) {
    return {
      tone: "positive",
      cutover_readiness_status: "ready",
      status_label: "Shadow cutover readiness preview indicates ready contour",
      readiness_label: readinessLabel,
      recommendation_label: recommendationLabel,
      modality_label: modalityLabel,
      detail_label: detailLabel,
      hint_messages: uniqueDeliveryHubMessages([
        "Shadow-only cutover readiness preview indicates that the current checkout contour looks internally aligned for a future Delivery Hub cutover.",
        "Current checkout still commits through the active legacy ApiShip flow. This block does not save, clear, or switch anything.",
        getDeliveryHubPreviewPrimaryHint(preview.shadow_orchestration_verdict_preview),
        getDeliveryHubPreviewPrimaryHint(
          preview.shadow_orchestration_recommendation_preview
        ),
      ]).slice(0, 4),
    }
  }

  if (insufficientData) {
    return {
      tone: "neutral",
      cutover_readiness_status: "insufficient_data",
      status_label: "Shadow cutover readiness preview needs more context",
      readiness_label: readinessLabel,
      recommendation_label: recommendationLabel,
      modality_label: modalityLabel,
      detail_label: detailLabel,
      hint_messages: uniqueDeliveryHubMessages([
        "Shadow-only cutover readiness preview does not yet have enough comparable context to claim future cutover readiness for this checkout.",
        "Current checkout still commits through the active legacy ApiShip flow. This block does not save, clear, or switch anything.",
        getDeliveryHubPreviewPrimaryHint(preview.shadow_orchestration_verdict_preview),
        getDeliveryHubPreviewPrimaryHint(
          preview.shadow_orchestration_recommendation_preview
        ),
        getDeliveryHubPreviewPrimaryHint(
          preview.shadow_selection_actionability_preview
        ),
      ]).slice(0, 4),
    }
  }

  return {
    tone: "warning",
    cutover_readiness_status: "not_ready",
    status_label: "Shadow cutover readiness preview indicates not-ready contour",
    readiness_label: readinessLabel,
    recommendation_label: recommendationLabel,
    modality_label: modalityLabel,
    detail_label: detailLabel,
    hint_messages: uniqueDeliveryHubMessages([
      "Shadow-only cutover readiness preview currently indicates that the checkout contour is not ready for a future Delivery Hub cutover.",
      "Current checkout still commits through the active legacy ApiShip flow. This block does not save, clear, or switch anything.",
      getDeliveryHubPreviewPrimaryHint(preview.shadow_orchestration_verdict_preview),
      getDeliveryHubPreviewPrimaryHint(
        preview.shadow_orchestration_recommendation_preview
      ),
      getDeliveryHubPreviewPrimaryHint(preview.shadow_shipping_option_parity_preview),
      getDeliveryHubPreviewPrimaryHint(preview.shadow_selection_parity_preview),
    ]).slice(0, 4),
  }
}

function getDeliveryHubShadowCutoverNextStepFromBlocker(
  blocker: DeliveryHubShadowCutoverBlockerItem
): DeliveryHubShadowCutoverNextStepItem {
  switch (blocker.code) {
    case "blocked_by_readiness":
      return {
        code: "review_readiness_constraints",
        label: "Review the readiness or settings constraints already visible in shadow previews",
        detail_label: blocker.detail_label,
      }
    case "needs_quote":
      return {
        code: "observe_shadow_quote_context",
        label: "Wait for comparable shadow quote context before planning any future cutover step",
        detail_label: blocker.detail_label,
      }
    case "needs_pickup_point":
      return {
        code: "observe_shadow_pickup_point_context",
        label: "Wait for comparable shadow pickup-point context before planning any future cutover step",
        detail_label: blocker.detail_label,
      }
    case "needs_pickup_window":
      return {
        code: "observe_shadow_pickup_window_context",
        label: "Wait for comparable shadow pickup-window context before planning any future cutover step",
        detail_label: blocker.detail_label,
      }
    case "stale_shadow_context":
      return {
        code: "refresh_shadow_context",
        label: "Refresh the sampled shadow context before reassessing future cutover signals",
        detail_label: blocker.detail_label,
      }
    case "shipping_option_parity_divergent":
      return {
        code: "investigate_shipping_option_parity",
        label: "Investigate the shipping-option parity drift already visible in shadow previews",
        detail_label: blocker.detail_label,
      }
    case "missing_neutral_selection":
      return {
        code: "observe_neutral_selection",
        label: "Observe a persisted neutral selection in shadow before planning any future cutover step",
        detail_label: blocker.detail_label,
      }
    case "selection_modality_mismatch":
      return {
        code: "resolve_selection_modality_mismatch",
        label: "Resolve the modality mismatch already visible between legacy and neutral selections",
        detail_label: blocker.detail_label,
      }
    case "selection_reference_mismatch":
      return {
        code: "resolve_selection_reference_mismatch",
        label: "Resolve the pickup reference mismatch already visible between legacy and neutral selections",
        detail_label: blocker.detail_label,
      }
  }
}

export function buildDeliveryHubShadowCutoverNextStepsPreviewModel(
  preview: DeliveryHubShadowCutoverNextStepsPreviewState
): DeliveryHubShadowCutoverNextStepsPreviewModel {
  const blockersStatus = preview.shadow_cutover_blockers_preview.blockers_status
  const cutoverReadinessStatus =
    preview.shadow_cutover_readiness_preview.cutover_readiness_status
  const recommendationStatus =
    preview.shadow_orchestration_recommendation_preview.recommendation_status
  const actionabilityStatus =
    preview.shadow_selection_actionability_preview.actionability_status
  const shippingOptionParityState =
    preview.shadow_shipping_option_parity_preview.parity_state
  const selectionParityStatus = preview.shadow_selection_parity_preview.parity_status
  const readinessLabel =
    preview.shadow_cutover_readiness_preview.readiness_label ??
    preview.shadow_orchestration_recommendation_preview.readiness_label ??
    preview.persisted_selection_preview.readiness_label ??
    preview.readiness_preview.status_label
  const blockerStatusLabel = `blockers ${formatDeliveryHubPreviewCodeLabel(blockersStatus)}`
  const recommendationLabel = `shadow recommendation ${formatDeliveryHubPreviewCodeLabel(
    recommendationStatus
  )}`
  const nextSteps =
    blockersStatus === "known_blockers"
      ? preview.shadow_cutover_blockers_preview.blockers.map(
          getDeliveryHubShadowCutoverNextStepFromBlocker
        )
      : []
  const insufficientData =
    blockersStatus === "insufficient_data" ||
    cutoverReadinessStatus === "insufficient_data" ||
    recommendationStatus === "insufficient_data" ||
    actionabilityStatus === "incomplete" ||
    shippingOptionParityState === "insufficient_context" ||
    shippingOptionParityState === "not_applicable" ||
    selectionParityStatus === "insufficient_data" ||
    selectionParityStatus === "missing_legacy_method"

  if (nextSteps.length > 0) {
    return {
      tone: "warning",
      next_steps_status: "known_next_steps",
      status_label: "Known shadow cutover next steps visible",
      readiness_label: readinessLabel,
      blocker_status_label: blockerStatusLabel,
      recommendation_label: recommendationLabel,
      next_step_count_label: `${formatDeliveryHubCountLabel(nextSteps.length, "next step", "next steps")} visible`,
      next_steps: nextSteps,
      hint_messages: uniqueDeliveryHubMessages([
        "Read-only shadow cutover next-steps preview only. Suggested next steps below simply restate issues already visible in existing shadow previews for the current checkout context.",
        "Current checkout still commits through the active legacy ApiShip flow. This block does not save, clear, or switch anything.",
        getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_blockers_preview),
        getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_readiness_preview),
      ]).slice(0, 4),
    }
  }

  if (insufficientData) {
    return {
      tone: "neutral",
      next_steps_status: "insufficient_data",
      status_label: "Shadow cutover next-steps preview needs more context",
      readiness_label: readinessLabel,
      blocker_status_label: blockerStatusLabel,
      recommendation_label: recommendationLabel,
      next_step_count_label: null,
      next_steps: [],
      hint_messages: uniqueDeliveryHubMessages([
        "Read-only shadow cutover next-steps preview does not yet have enough comparable context to suggest meaningful next steps for the current checkout.",
        "Current checkout still commits through the active legacy ApiShip flow. This block does not save, clear, or switch anything.",
        getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_readiness_preview),
        getDeliveryHubPreviewPrimaryHint(preview.shadow_orchestration_recommendation_preview),
      ]).slice(0, 4),
    }
  }

  return {
    tone: "neutral",
    next_steps_status: "no_clear_next_steps",
    status_label: "No clear shadow cutover next steps visible",
    readiness_label: readinessLabel,
    blocker_status_label: blockerStatusLabel,
    recommendation_label: recommendationLabel,
    next_step_count_label: null,
    next_steps: [],
    hint_messages: uniqueDeliveryHubMessages([
      "Read-only shadow cutover next-steps preview only. Existing shadow previews do not currently point to a single clear next step for this checkout context.",
      "This neutral result does not claim that checkout is already cut over or that the active shipping commit path has changed.",
      "Current checkout still commits through the active legacy ApiShip flow. This block does not save, clear, or switch anything.",
    ]).slice(0, 4),
  }
}

export function buildDeliveryHubShadowCutoverSummaryPreviewModel(
  preview: DeliveryHubShadowCutoverSummaryPreviewState
): DeliveryHubShadowCutoverSummaryPreviewModel {
  const cutoverReadinessStatus =
    preview.shadow_cutover_readiness_preview.cutover_readiness_status
  const blockersStatus = preview.shadow_cutover_blockers_preview.blockers_status
  const nextStepsStatus = preview.shadow_cutover_next_steps_preview.next_steps_status
  const recommendationStatus =
    preview.shadow_orchestration_recommendation_preview.recommendation_status
  const readinessLabel = preview.shadow_cutover_readiness_preview.readiness_label
  const modalityLabel =
    preview.shadow_cutover_readiness_preview.modality_label ??
    preview.shadow_orchestration_recommendation_preview.recommended_modality_label ??
    null
  const recommendationLabel =
    preview.shadow_cutover_readiness_preview.recommendation_label ??
    `shadow recommendation ${formatDeliveryHubPreviewCodeLabel(recommendationStatus)}`
  const blockerCountLabel =
    preview.shadow_cutover_blockers_preview.blocker_count_label
  const nextStepCountLabel =
    preview.shadow_cutover_next_steps_preview.next_step_count_label
  const detailLabel = [
    `readiness ${formatDeliveryHubPreviewCodeLabel(cutoverReadinessStatus)}`,
    `blockers ${formatDeliveryHubPreviewCodeLabel(blockersStatus)}`,
    `next steps ${formatDeliveryHubPreviewCodeLabel(nextStepsStatus)}`,
  ].join(" · ")
  const headlineMessages = uniqueDeliveryHubMessages([
    cutoverReadinessStatus === "ready"
      ? "Readiness preview currently shows an aligned shadow contour."
      : cutoverReadinessStatus === "not_ready"
        ? "Readiness preview still shows a not-ready shadow contour."
        : "Readiness preview still needs more comparable shadow context.",
    blockersStatus === "known_blockers"
      ? blockerCountLabel ?? "Known shadow blockers are currently visible."
      : blockersStatus === "no_known_blockers"
        ? "No known shadow blockers are currently visible."
        : "Blocker visibility still needs more comparable shadow context.",
    nextStepsStatus === "known_next_steps"
      ? nextStepCountLabel ?? "Known shadow next steps are currently visible."
      : nextStepsStatus === "no_clear_next_steps"
        ? "No clear shadow next step is currently visible."
        : "Next-step visibility still needs more comparable shadow context.",
  ]).slice(0, 3)
  const insufficientData =
    cutoverReadinessStatus === "insufficient_data" ||
    blockersStatus === "insufficient_data" ||
    nextStepsStatus === "insufficient_data" ||
    recommendationStatus === "insufficient_data"
  const readyShadowContour =
    !insufficientData &&
    cutoverReadinessStatus === "ready" &&
    blockersStatus === "no_known_blockers" &&
    nextStepsStatus === "no_clear_next_steps" &&
    recommendationStatus === "recommended"

  if (readyShadowContour) {
    return {
      tone: "positive",
      summary_status: "ready_shadow_contour",
      status_label: "Shadow cutover summary preview indicates aligned shadow contour",
      readiness_label: readinessLabel,
      modality_label: modalityLabel,
      recommendation_label: recommendationLabel,
      blocker_count_label: blockerCountLabel,
      next_step_count_label: nextStepCountLabel,
      detail_label: detailLabel,
      headline_messages: headlineMessages,
      hint_messages: uniqueDeliveryHubMessages([
        "Read-only shadow cutover summary preview only. This compact block aggregates already visible shadow readiness, blockers, and next-step previews for future Delivery Hub cutover planning only.",
        "Aligned shadow contour here means that the currently materialized shadow previews do not show readiness drift, known blockers, or a clear follow-up step for this checkout context; it does not mean checkout is already cut over.",
        "Current checkout still commits through the active legacy ApiShip flow. This block does not save, clear, switch, or commit anything.",
        getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_readiness_preview),
        getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_blockers_preview),
      ]).slice(0, 4),
    }
  }

  if (insufficientData) {
    return {
      tone: "neutral",
      summary_status: "insufficient_data",
      status_label: "Shadow cutover summary preview needs more context",
      readiness_label: readinessLabel,
      modality_label: modalityLabel,
      recommendation_label: recommendationLabel,
      blocker_count_label: blockerCountLabel,
      next_step_count_label: nextStepCountLabel,
      detail_label: detailLabel,
      headline_messages: headlineMessages,
      hint_messages: uniqueDeliveryHubMessages([
        "Read-only shadow cutover summary preview does not yet have enough comparable context to describe a future cutover summary for this checkout.",
        "Current checkout still commits through the active legacy ApiShip flow. This block does not save, clear, switch, or commit anything.",
        getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_readiness_preview),
        getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_blockers_preview),
        getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_next_steps_preview),
      ]).slice(0, 4),
    }
  }

  return {
    tone: "warning",
    summary_status: "attention_required",
    status_label: "Shadow cutover summary preview shows attention points",
    readiness_label: readinessLabel,
    modality_label: modalityLabel,
    recommendation_label: recommendationLabel,
    blocker_count_label: blockerCountLabel,
    next_step_count_label: nextStepCountLabel,
    detail_label: detailLabel,
    headline_messages: headlineMessages,
    hint_messages: uniqueDeliveryHubMessages([
      "Read-only shadow cutover summary preview only. This compact block highlights attention points already visible across existing shadow readiness, blockers, and next-step previews.",
      "Current checkout still commits through the active legacy ApiShip flow. This block does not save, clear, switch, or commit anything.",
      "This summary does not claim that Delivery Hub checkout cutover has started; it only restates currently visible shadow signals for future planning.",
      getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_readiness_preview),
      getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_blockers_preview),
      getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_next_steps_preview),
    ]).slice(0, 4),
  }
}

export function buildDeliveryHubShadowCutoverEvidencePreviewModel(
  preview: DeliveryHubShadowCutoverEvidencePreviewState
): DeliveryHubShadowCutoverEvidencePreviewModel {
  const summaryStatus = preview.shadow_cutover_summary_preview.summary_status
  const cutoverReadinessStatus =
    preview.shadow_cutover_readiness_preview.cutover_readiness_status
  const blockersStatus = preview.shadow_cutover_blockers_preview.blockers_status
  const nextStepsStatus = preview.shadow_cutover_next_steps_preview.next_steps_status
  const recommendationStatus =
    preview.shadow_orchestration_recommendation_preview.recommendation_status
  const readinessLabel =
    preview.shadow_cutover_summary_preview.readiness_label ??
    preview.shadow_cutover_readiness_preview.readiness_label
  const summaryLabel = preview.shadow_cutover_summary_preview.status_label
  const recommendationLabel =
    preview.shadow_cutover_summary_preview.recommendation_label ??
    `shadow recommendation ${formatDeliveryHubPreviewCodeLabel(recommendationStatus)}`
  const detailLabel = [
    `summary ${formatDeliveryHubPreviewCodeLabel(summaryStatus)}`,
    `readiness ${formatDeliveryHubPreviewCodeLabel(cutoverReadinessStatus)}`,
    `blockers ${formatDeliveryHubPreviewCodeLabel(blockersStatus)}`,
    `next steps ${formatDeliveryHubPreviewCodeLabel(nextStepsStatus)}`,
  ].join(" · ")
  const insufficientData =
    summaryStatus === "insufficient_data" ||
    cutoverReadinessStatus === "insufficient_data" ||
    blockersStatus === "insufficient_data" ||
    nextStepsStatus === "insufficient_data" ||
    recommendationStatus === "insufficient_data"

  if (insufficientData) {
    return {
      tone: "neutral",
      evidence_status: "insufficient_data",
      status_label: "Shadow cutover evidence preview needs more context",
      readiness_label: readinessLabel,
      summary_label: summaryLabel,
      recommendation_label: recommendationLabel,
      evidence_count_label: null,
      detail_label: detailLabel,
      evidence_items: [],
      hint_messages: uniqueDeliveryHubMessages([
        "Read-only shadow cutover evidence preview does not yet have enough comparable context to compact supporting signals for the current checkout.",
        "Current checkout still commits through the active legacy ApiShip flow. This block does not save, clear, switch, or commit anything.",
        getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_summary_preview),
        getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_readiness_preview),
      ]).slice(0, 4),
    }
  }

  const blockerDetailLabel = [
    preview.shadow_cutover_blockers_preview.verdict_label,
    preview.shadow_cutover_blockers_preview.recommendation_label,
  ]
    .filter((value): value is string => !!value)
    .join(" · ")
  const nextStepDetailLabel = [
    preview.shadow_cutover_next_steps_preview.blocker_status_label,
    preview.shadow_cutover_next_steps_preview.recommendation_label,
  ]
    .filter((value): value is string => !!value)
    .join(" · ")
  const evidenceItems: DeliveryHubShadowCutoverEvidenceItem[] = [
    {
      code: "summary_signal",
      label:
        summaryStatus === "ready_shadow_contour"
          ? "Shadow summary currently shows an aligned contour"
          : "Shadow summary currently highlights attention points",
      detail_label:
        preview.shadow_cutover_summary_preview.headline_messages[0] ??
        preview.shadow_cutover_summary_preview.detail_label,
    },
    {
      code: "readiness_signal",
      label:
        cutoverReadinessStatus === "ready"
          ? "Readiness preview shows a ready shadow contour"
          : "Readiness preview shows a not-ready shadow contour",
      detail_label: preview.shadow_cutover_readiness_preview.detail_label,
    },
    {
      code: "blocker_signal",
      label:
        blockersStatus === "known_blockers"
          ? preview.shadow_cutover_blockers_preview.blocker_count_label ??
            "Known shadow blockers are visible"
          : "No known shadow blockers are visible",
      detail_label: blockerDetailLabel || null,
    },
    {
      code: "next_step_signal",
      label:
        nextStepsStatus === "known_next_steps"
          ? preview.shadow_cutover_next_steps_preview.next_step_count_label ??
            "Known shadow next steps are visible"
          : "No clear shadow next step is visible",
      detail_label: nextStepDetailLabel || null,
    },
    {
      code: "recommendation_signal",
      label:
        recommendationStatus === "recommended"
          ? "Shadow recommendation preview is available"
          : "Shadow recommendation preview is unavailable",
      detail_label:
        preview.shadow_orchestration_recommendation_preview.detail_label,
    },
  ]
  const evidenceCountLabel = `${formatDeliveryHubCountLabel(
    evidenceItems.length,
    "supporting signal",
    "supporting signals"
  )} visible`

  return {
    tone:
      preview.shadow_cutover_summary_preview.tone === "positive"
        ? "positive"
        : "warning",
    evidence_status: "evidence_available",
    status_label: "Shadow cutover evidence preview compacts current supporting signals",
    readiness_label: readinessLabel,
    summary_label: summaryLabel,
    recommendation_label: recommendationLabel,
    evidence_count_label: evidenceCountLabel,
    detail_label: detailLabel,
    evidence_items: evidenceItems,
    hint_messages: uniqueDeliveryHubMessages([
      "Read-only shadow cutover evidence preview only. This compact block aggregates already visible shadow cutover summary, readiness, blockers, next-step, and recommendation previews as supporting evidence for the current shadow picture only.",
      summaryStatus === "ready_shadow_contour"
        ? "Supporting signals currently reinforce an aligned shadow cutover picture, but this still does not mean checkout is already cut over."
        : "Supporting signals currently reinforce attention points already visible in the shadow cutover picture; this still does not start any checkout cutover.",
      "Current checkout still commits through the active legacy ApiShip flow. This block does not save, clear, switch, or commit anything.",
      getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_summary_preview),
    ]).slice(0, 4),
  }
}

export function buildDeliveryHubShadowCutoverRolloutPreviewModel(
  preview: DeliveryHubShadowCutoverRolloutPreviewState
): DeliveryHubShadowCutoverRolloutPreviewModel {
  const summaryStatus = preview.shadow_cutover_summary_preview.summary_status
  const evidenceStatus = preview.shadow_cutover_evidence_preview.evidence_status
  const cutoverReadinessStatus =
    preview.shadow_cutover_readiness_preview.cutover_readiness_status
  const blockersStatus = preview.shadow_cutover_blockers_preview.blockers_status
  const nextStepsStatus = preview.shadow_cutover_next_steps_preview.next_steps_status
  const recommendationStatus =
    preview.shadow_orchestration_recommendation_preview.recommendation_status
  const readinessLabel =
    preview.shadow_cutover_evidence_preview.readiness_label ??
    preview.shadow_cutover_summary_preview.readiness_label ??
    preview.shadow_cutover_readiness_preview.readiness_label
  const summaryLabel = preview.shadow_cutover_summary_preview.status_label
  const evidenceLabel = preview.shadow_cutover_evidence_preview.status_label
  const recommendationLabel =
    preview.shadow_cutover_evidence_preview.recommendation_label ??
    preview.shadow_cutover_summary_preview.recommendation_label ??
    `shadow recommendation ${formatDeliveryHubPreviewCodeLabel(recommendationStatus)}`
  const detailLabel = [
    `summary ${formatDeliveryHubPreviewCodeLabel(summaryStatus)}`,
    `evidence ${formatDeliveryHubPreviewCodeLabel(evidenceStatus)}`,
    `readiness ${formatDeliveryHubPreviewCodeLabel(cutoverReadinessStatus)}`,
    `blockers ${formatDeliveryHubPreviewCodeLabel(blockersStatus)}`,
    `next steps ${formatDeliveryHubPreviewCodeLabel(nextStepsStatus)}`,
    `recommendation ${formatDeliveryHubPreviewCodeLabel(recommendationStatus)}`,
  ].join(" · ")
  const insufficientData =
    summaryStatus === "insufficient_data" ||
    evidenceStatus === "insufficient_data" ||
    cutoverReadinessStatus === "insufficient_data" ||
    blockersStatus === "insufficient_data" ||
    nextStepsStatus === "insufficient_data" ||
    recommendationStatus === "insufficient_data"

  if (insufficientData) {
    return {
      tone: "neutral",
      rollout_status: "insufficient_data",
      status_label: "Shadow cutover rollout preview needs more context",
      readiness_label: readinessLabel,
      summary_label: summaryLabel,
      evidence_label: evidenceLabel,
      recommendation_label: recommendationLabel,
      rollout_reason_label:
        "Comparable shadow rollout context is still incomplete",
      detail_label: detailLabel,
      headline_messages: uniqueDeliveryHubMessages([
        "Rollout remains preview-only because the current shadow cutover picture still lacks enough comparable context.",
        preview.shadow_cutover_summary_preview.headline_messages[0] ?? null,
        preview.shadow_cutover_evidence_preview.evidence_count_label
          ? `${preview.shadow_cutover_evidence_preview.evidence_count_label} are already visible, but the rollout picture is still incomplete.`
          : null,
      ]).slice(0, 3),
      hint_messages: uniqueDeliveryHubMessages([
        "Read-only shadow cutover rollout preview only. This compact block aggregates already materialized summary, evidence, readiness, blockers, next-step, and recommendation previews into a rollout-oriented picture for observation only.",
        "Current checkout still commits through the active legacy ApiShip flow. This block does not save, clear, switch, or commit anything.",
        "This preview does not claim that checkout cutover has started or that rollout is already underway.",
        getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_summary_preview),
        getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_evidence_preview),
      ]).slice(0, 4),
    }
  }

  const notAdvised =
    summaryStatus === "attention_required" ||
    cutoverReadinessStatus === "not_ready" ||
    blockersStatus === "known_blockers" ||
    nextStepsStatus === "known_next_steps" ||
    recommendationStatus === "unavailable"

  if (notAdvised) {
    const rolloutReasonLabel =
      blockersStatus === "known_blockers"
        ? preview.shadow_cutover_blockers_preview.blocker_count_label ??
          "Known shadow blockers are visible"
        : cutoverReadinessStatus === "not_ready"
          ? "Shadow readiness still shows a not-ready contour"
          : recommendationStatus === "unavailable"
            ? "Shadow recommendation is not currently available"
            : nextStepsStatus === "known_next_steps"
              ? preview.shadow_cutover_next_steps_preview.next_step_count_label ??
                "Known shadow next steps are visible"
              : "Shadow summary still highlights attention points"

    return {
      tone: "warning",
      rollout_status: "not_advised",
      status_label: "Shadow cutover rollout preview does not advise rollout",
      readiness_label: readinessLabel,
      summary_label: summaryLabel,
      evidence_label: evidenceLabel,
      recommendation_label: recommendationLabel,
      rollout_reason_label: rolloutReasonLabel,
      detail_label: detailLabel,
      headline_messages: uniqueDeliveryHubMessages([
        "Current shadow signals still point to an observe-only and not-advised rollout picture.",
        blockersStatus === "known_blockers"
          ? preview.shadow_cutover_blockers_preview.blocker_count_label ??
            "Known shadow blockers are currently visible."
          : null,
        cutoverReadinessStatus === "not_ready"
          ? "Readiness preview still shows a not-ready shadow contour."
          : null,
        nextStepsStatus === "known_next_steps"
          ? preview.shadow_cutover_next_steps_preview.next_step_count_label ??
            "Known shadow next steps are currently visible."
          : null,
      ]).slice(0, 3),
      hint_messages: uniqueDeliveryHubMessages([
        "Read-only shadow cutover rollout preview only. Current shadow signals suggest that rollout should remain observational and should not be treated as an active checkout cutover.",
        "Current checkout still commits through the active legacy ApiShip flow. This block does not save, clear, switch, or commit anything.",
        "This preview does not change shipping method selection or claim that the shopper path has moved away from legacy ApiShip.",
        getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_summary_preview),
        getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_blockers_preview),
        getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_next_steps_preview),
      ]).slice(0, 4),
    }
  }

  return {
    tone: "neutral",
    rollout_status: "observe_only",
    status_label: "Shadow cutover rollout preview remains observe-only",
    readiness_label: readinessLabel,
    summary_label: summaryLabel,
    evidence_label: evidenceLabel,
    recommendation_label: recommendationLabel,
    rollout_reason_label:
      preview.shadow_cutover_evidence_preview.evidence_count_label ??
      "Supporting shadow rollout signals are visible",
    detail_label: detailLabel,
    headline_messages: uniqueDeliveryHubMessages([
      "Current shadow signals can be observed as a compact rollout picture only.",
      preview.shadow_cutover_summary_preview.headline_messages[0] ?? null,
      preview.shadow_cutover_evidence_preview.evidence_count_label ?? null,
    ]).slice(0, 3),
    hint_messages: uniqueDeliveryHubMessages([
      "Read-only shadow cutover rollout preview only. Even when the current shadow contour looks aligned, this block remains observational and does not indicate that checkout cutover has occurred.",
      "Current checkout still commits through the active legacy ApiShip flow. This block does not save, clear, switch, or commit anything.",
      "This observe-only result simply compacts already visible shadow rollout signals for future planning and does not start rollout in checkout.",
      getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_summary_preview),
      getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_evidence_preview),
    ]).slice(0, 4),
  }
}

export function buildDeliveryHubShadowCutoverGatePreviewModel(
  preview: DeliveryHubShadowCutoverGatePreviewState
): DeliveryHubShadowCutoverGatePreviewModel {
  const summaryStatus = preview.shadow_cutover_summary_preview.summary_status
  const evidenceStatus = preview.shadow_cutover_evidence_preview.evidence_status
  const rolloutStatus = preview.shadow_cutover_rollout_preview.rollout_status
  const readinessLabel =
    preview.shadow_cutover_rollout_preview.readiness_label ??
    preview.shadow_cutover_summary_preview.readiness_label ??
    preview.shadow_cutover_readiness_preview.readiness_label ??
    preview.shadow_orchestration_recommendation_preview.readiness_label
  const summaryLabel = preview.shadow_cutover_summary_preview.status_label
  const rolloutLabel = preview.shadow_cutover_rollout_preview.status_label
  const gateItems: DeliveryHubShadowCutoverGateItem[] = []

  const pushGate = (
    code: DeliveryHubShadowCutoverGateCode,
    gateStatus: DeliveryHubShadowCutoverGatePreviewStatus,
    label: string,
    detailLabel: string | null
  ) => {
    gateItems.push({
      code,
      gate_status: gateStatus,
      label,
      detail_label: detailLabel,
    })
  }

  switch (preview.shadow_shipping_option_parity_preview.parity_state) {
    case "aligned":
      pushGate(
        "shipping_option_parity",
        "aligned",
        "Shipping-option parity looks aligned",
        preview.shadow_shipping_option_parity_preview.detail_label ??
          preview.shadow_shipping_option_parity_preview.status_label
      )
      break
    case "divergent":
      pushGate(
        "shipping_option_parity",
        "blocked",
        "Shipping-option parity still shows drift",
        getDeliveryHubPreviewPrimaryHint(preview.shadow_shipping_option_parity_preview) ??
          preview.shadow_shipping_option_parity_preview.detail_label ??
          preview.shadow_shipping_option_parity_preview.status_label
      )
      break
    default:
      pushGate(
        "shipping_option_parity",
        "insufficient_data",
        "Shipping-option parity still needs comparable context",
        getDeliveryHubPreviewPrimaryHint(preview.shadow_shipping_option_parity_preview) ??
          preview.shadow_shipping_option_parity_preview.status_label
      )
      break
  }

  switch (preview.shadow_selection_parity_preview.parity_status) {
    case "aligned":
      pushGate(
        "selection_parity",
        "aligned",
        "Selection parity looks aligned",
        preview.shadow_selection_parity_preview.status_label
      )
      break
    case "missing_neutral_selection":
    case "modality_mismatch":
    case "reference_mismatch":
      pushGate(
        "selection_parity",
        "blocked",
        "Selection parity still shows visible drift",
        getDeliveryHubPreviewPrimaryHint(preview.shadow_selection_parity_preview) ??
          preview.shadow_selection_parity_preview.status_label
      )
      break
    default:
      pushGate(
        "selection_parity",
        "insufficient_data",
        "Selection parity still needs comparable context",
        getDeliveryHubPreviewPrimaryHint(preview.shadow_selection_parity_preview) ??
          preview.shadow_selection_parity_preview.status_label
      )
      break
  }

  switch (preview.shadow_cutover_readiness_preview.cutover_readiness_status) {
    case "ready":
      pushGate(
        "readiness_contour",
        "aligned",
        "Readiness contour looks aligned",
        preview.shadow_cutover_readiness_preview.detail_label ??
          preview.shadow_cutover_readiness_preview.status_label
      )
      break
    case "not_ready":
      pushGate(
        "readiness_contour",
        "blocked",
        "Readiness contour is still not ready",
        getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_readiness_preview) ??
          preview.shadow_cutover_readiness_preview.detail_label ??
          preview.shadow_cutover_readiness_preview.status_label
      )
      break
    default:
      pushGate(
        "readiness_contour",
        "insufficient_data",
        "Readiness contour still needs more context",
        getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_readiness_preview) ??
          preview.shadow_cutover_readiness_preview.status_label
      )
      break
  }

  switch (preview.shadow_cutover_blockers_preview.blockers_status) {
    case "no_known_blockers":
      pushGate(
        "known_blockers",
        "aligned",
        "No known blockers are currently visible",
        preview.shadow_cutover_blockers_preview.verdict_label ??
          preview.shadow_cutover_blockers_preview.recommendation_label ??
          preview.shadow_cutover_blockers_preview.status_label
      )
      break
    case "known_blockers":
      pushGate(
        "known_blockers",
        "blocked",
        "Known blockers are currently visible",
        preview.shadow_cutover_blockers_preview.blocker_count_label ??
          getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_blockers_preview) ??
          preview.shadow_cutover_blockers_preview.status_label
      )
      break
    default:
      pushGate(
        "known_blockers",
        "insufficient_data",
        "Blocker visibility still needs more context",
        getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_blockers_preview) ??
          preview.shadow_cutover_blockers_preview.status_label
      )
      break
  }

  switch (preview.shadow_orchestration_recommendation_preview.recommendation_status) {
    case "recommended":
      pushGate(
        "recommendation_signal",
        "aligned",
        "Recommendation signal is available",
        preview.shadow_orchestration_recommendation_preview.detail_label ??
          preview.shadow_orchestration_recommendation_preview.status_label
      )
      break
    case "unavailable":
      pushGate(
        "recommendation_signal",
        "blocked",
        "Recommendation signal is currently unavailable",
        getDeliveryHubPreviewPrimaryHint(
          preview.shadow_orchestration_recommendation_preview
        ) ?? preview.shadow_orchestration_recommendation_preview.status_label
      )
      break
    default:
      pushGate(
        "recommendation_signal",
        "insufficient_data",
        "Recommendation signal still needs more context",
        getDeliveryHubPreviewPrimaryHint(
          preview.shadow_orchestration_recommendation_preview
        ) ?? preview.shadow_orchestration_recommendation_preview.status_label
      )
      break
  }

  if (evidenceStatus === "insufficient_data") {
    pushGate(
      "supporting_evidence",
      "insufficient_data",
      "Supporting evidence still needs more context",
      getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_evidence_preview) ??
        preview.shadow_cutover_evidence_preview.status_label
    )
  } else if (
    summaryStatus === "attention_required" ||
    rolloutStatus === "not_advised"
  ) {
    pushGate(
      "supporting_evidence",
      "blocked",
      "Supporting evidence still reinforces attention points",
      preview.shadow_cutover_evidence_preview.evidence_count_label ??
        preview.shadow_cutover_evidence_preview.detail_label ??
        preview.shadow_cutover_evidence_preview.status_label
    )
  } else {
    pushGate(
      "supporting_evidence",
      "aligned",
      "Supporting evidence reinforces the aligned shadow picture",
      preview.shadow_cutover_evidence_preview.evidence_count_label ??
        preview.shadow_cutover_evidence_preview.detail_label ??
        preview.shadow_cutover_evidence_preview.status_label
    )
  }

  switch (rolloutStatus) {
    case "observe_only":
      pushGate(
        "rollout_picture",
        "aligned",
        "Rollout picture remains observe-only and internally aligned",
        preview.shadow_cutover_rollout_preview.rollout_reason_label ??
          preview.shadow_cutover_rollout_preview.status_label
      )
      break
    case "not_advised":
      pushGate(
        "rollout_picture",
        "blocked",
        "Rollout picture is currently not advised",
        preview.shadow_cutover_rollout_preview.rollout_reason_label ??
          getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_rollout_preview) ??
          preview.shadow_cutover_rollout_preview.status_label
      )
      break
    default:
      pushGate(
        "rollout_picture",
        "insufficient_data",
        "Rollout picture still needs more context",
        preview.shadow_cutover_rollout_preview.rollout_reason_label ??
          getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_rollout_preview) ??
          preview.shadow_cutover_rollout_preview.status_label
      )
      break
  }

  const alignedGateCount = gateItems.filter(
    (gate) => gate.gate_status === "aligned"
  ).length
  const blockedGateCount = gateItems.filter(
    (gate) => gate.gate_status === "blocked"
  ).length
  const insufficientGateCount = gateItems.filter(
    (gate) => gate.gate_status === "insufficient_data"
  ).length
  const alignedGateCountLabel = alignedGateCount
    ? `${formatDeliveryHubCountLabel(alignedGateCount, "aligned gate", "aligned gates")} visible`
    : null
  const blockedGateCountLabel = blockedGateCount
    ? `${formatDeliveryHubCountLabel(blockedGateCount, "blocked gate", "blocked gates")} visible`
    : null
  const insufficientGateCountLabel = insufficientGateCount
    ? `${formatDeliveryHubCountLabel(
        insufficientGateCount,
        "insufficient gate",
        "insufficient gates"
      )} visible`
    : null

  if (blockedGateCount > 0) {
    return {
      tone: "warning",
      gate_preview_status: "blocked",
      status_label: "Shadow cutover gate preview shows blocked gates",
      readiness_label: readinessLabel,
      summary_label: summaryLabel,
      rollout_label: rolloutLabel,
      aligned_gate_count_label: alignedGateCountLabel,
      blocked_gate_count_label: blockedGateCountLabel,
      insufficient_gate_count_label: insufficientGateCountLabel,
      gate_items: gateItems,
      headline_messages: uniqueDeliveryHubMessages([
        blockedGateCountLabel,
        alignedGateCountLabel,
        insufficientGateCountLabel,
      ]).slice(0, 3),
      hint_messages: uniqueDeliveryHubMessages([
        "Read-only shadow cutover gate preview only. Each gate below simply restates already materialized parity, readiness, blocker, recommendation, evidence, and rollout previews for future cutover decision-making only.",
        "Current checkout still commits through the active legacy ApiShip flow. This block does not save, clear, switch, or commit anything.",
        "Blocked gates below simply highlight attention points already visible in current shadow previews and do not start any checkout cutover.",
        getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_rollout_preview),
        getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_blockers_preview),
      ]).slice(0, 4),
    }
  }

  if (insufficientGateCount > 0) {
    return {
      tone: "neutral",
      gate_preview_status: "insufficient_data",
      status_label: "Shadow cutover gate preview needs more context",
      readiness_label: readinessLabel,
      summary_label: summaryLabel,
      rollout_label: rolloutLabel,
      aligned_gate_count_label: alignedGateCountLabel,
      blocked_gate_count_label: blockedGateCountLabel,
      insufficient_gate_count_label: insufficientGateCountLabel,
      gate_items: gateItems,
      headline_messages: uniqueDeliveryHubMessages([
        insufficientGateCountLabel,
        alignedGateCountLabel,
        preview.shadow_cutover_summary_preview.headline_messages[0] ?? null,
      ]).slice(0, 3),
      hint_messages: uniqueDeliveryHubMessages([
        "Read-only shadow cutover gate preview only. Each gate below simply restates already materialized parity, readiness, blocker, recommendation, evidence, and rollout previews for future cutover decision-making only.",
        "Current checkout still commits through the active legacy ApiShip flow. This block does not save, clear, switch, or commit anything.",
        "Some gates remain informational only because current shadow previews still lack enough comparable context for a fuller future cutover picture.",
        getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_rollout_preview),
        getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_evidence_preview),
      ]).slice(0, 4),
    }
  }

  return {
    tone: "positive",
    gate_preview_status: "aligned",
    status_label: "Shadow cutover gate preview shows aligned gates only",
    readiness_label: readinessLabel,
    summary_label: summaryLabel,
    rollout_label: rolloutLabel,
    aligned_gate_count_label: alignedGateCountLabel,
    blocked_gate_count_label: blockedGateCountLabel,
    insufficient_gate_count_label: insufficientGateCountLabel,
    gate_items: gateItems,
    headline_messages: uniqueDeliveryHubMessages([
      alignedGateCountLabel,
      preview.shadow_cutover_summary_preview.headline_messages[0] ?? null,
      preview.shadow_cutover_rollout_preview.headline_messages[0] ?? null,
    ]).slice(0, 3),
    hint_messages: uniqueDeliveryHubMessages([
      "Read-only shadow cutover gate preview only. Each gate below simply restates already materialized parity, readiness, blocker, recommendation, evidence, and rollout previews for future cutover decision-making only.",
      "Aligned gates here mean that the currently materialized shadow previews look internally consistent for observation; this does not mean checkout is already cut over.",
      "Current checkout still commits through the active legacy ApiShip flow. This block does not save, clear, switch, or commit anything.",
      getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_rollout_preview),
      getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_summary_preview),
    ]).slice(0, 4),
  }
}

export function buildDeliveryHubShadowCutoverDecisionPreviewModel(
  preview: DeliveryHubShadowCutoverDecisionPreviewState
): DeliveryHubShadowCutoverDecisionPreviewModel {
  const summaryStatus = preview.shadow_cutover_summary_preview.summary_status
  const evidenceStatus = preview.shadow_cutover_evidence_preview.evidence_status
  const rolloutStatus = preview.shadow_cutover_rollout_preview.rollout_status
  const gateStatus = preview.shadow_cutover_gate_preview.gate_preview_status
  const readinessStatus =
    preview.shadow_cutover_readiness_preview.cutover_readiness_status
  const blockersStatus = preview.shadow_cutover_blockers_preview.blockers_status
  const recommendationStatus =
    preview.shadow_orchestration_recommendation_preview.recommendation_status
  const readinessLabel =
    preview.shadow_cutover_gate_preview.readiness_label ??
    preview.shadow_cutover_rollout_preview.readiness_label ??
    preview.shadow_cutover_summary_preview.readiness_label ??
    preview.shadow_cutover_readiness_preview.readiness_label ??
    preview.shadow_orchestration_recommendation_preview.readiness_label
  const summaryLabel = preview.shadow_cutover_summary_preview.status_label
  const evidenceLabel = preview.shadow_cutover_evidence_preview.status_label
  const rolloutLabel = preview.shadow_cutover_rollout_preview.status_label
  const gateLabel = preview.shadow_cutover_gate_preview.status_label
  const formatDecisionToken = (value: string) => value.replace(/_/g, " ")
  const detailLabel = [
    `gate ${formatDecisionToken(gateStatus)}`,
    `summary ${formatDecisionToken(summaryStatus)}`,
    `evidence ${formatDecisionToken(evidenceStatus)}`,
    `rollout ${formatDecisionToken(rolloutStatus)}`,
    `readiness ${formatDecisionToken(readinessStatus)}`,
    `blockers ${formatDecisionToken(blockersStatus)}`,
    `recommendation ${formatDecisionToken(recommendationStatus)}`,
  ].join(" · ")

  if (
    gateStatus === "blocked" ||
    summaryStatus === "attention_required" ||
    rolloutStatus === "not_advised" ||
    readinessStatus === "not_ready" ||
    blockersStatus === "known_blockers" ||
    recommendationStatus === "unavailable"
  ) {
    return {
      tone: "warning",
      decision_status: "hold",
      status_label: "Shadow cutover decision preview indicates hold",
      readiness_label: readinessLabel,
      summary_label: summaryLabel,
      evidence_label: evidenceLabel,
      rollout_label: rolloutLabel,
      gate_label: gateLabel,
      decision_reason_label:
        preview.shadow_cutover_gate_preview.blocked_gate_count_label ??
        preview.shadow_cutover_blockers_preview.blocker_count_label ??
        preview.shadow_cutover_rollout_preview.rollout_reason_label ??
        getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_summary_preview) ??
        "Current shadow cutover picture still shows visible hold signals",
      detail_label: detailLabel,
      headline_messages: uniqueDeliveryHubMessages([
        "Current shadow cutover picture still points to hold for future decision planning.",
        preview.shadow_cutover_gate_preview.blocked_gate_count_label,
        preview.shadow_cutover_summary_preview.headline_messages[0] ?? null,
        preview.shadow_cutover_rollout_preview.headline_messages[0] ?? null,
      ]).slice(0, 3),
      hint_messages: uniqueDeliveryHubMessages([
        "Read-only shadow cutover decision preview only. This compact block aggregates already materialized shadow summary, evidence, rollout, and gate previews into a pre-cutover decision verdict for planning only.",
        "Current checkout still commits through the active legacy ApiShip flow. This block does not save, clear, switch, or commit anything.",
        "A hold verdict here only restates attention points already visible in current shadow previews and does not mean that checkout cutover has started or that any shipping method will be switched.",
        getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_gate_preview),
        getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_rollout_preview),
        getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_blockers_preview),
      ]).slice(0, 4),
    }
  }

  if (
    gateStatus === "insufficient_data" ||
    summaryStatus === "insufficient_data" ||
    evidenceStatus === "insufficient_data" ||
    rolloutStatus === "insufficient_data" ||
    readinessStatus === "insufficient_data" ||
    blockersStatus === "insufficient_data" ||
    recommendationStatus === "insufficient_data"
  ) {
    return {
      tone: "neutral",
      decision_status: "insufficient_data",
      status_label: "Shadow cutover decision preview needs more context",
      readiness_label: readinessLabel,
      summary_label: summaryLabel,
      evidence_label: evidenceLabel,
      rollout_label: rolloutLabel,
      gate_label: gateLabel,
      decision_reason_label:
        preview.shadow_cutover_gate_preview.insufficient_gate_count_label ??
        preview.shadow_cutover_rollout_preview.rollout_reason_label ??
        getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_evidence_preview) ??
        "Comparable shadow cutover context is still incomplete",
      detail_label: detailLabel,
      headline_messages: uniqueDeliveryHubMessages([
        "Current shadow cutover picture still lacks enough context for a fuller decision preview.",
        preview.shadow_cutover_gate_preview.insufficient_gate_count_label,
        preview.shadow_cutover_summary_preview.headline_messages[0] ?? null,
      ]).slice(0, 3),
      hint_messages: uniqueDeliveryHubMessages([
        "Read-only shadow cutover decision preview only. This compact block aggregates already materialized shadow summary, evidence, rollout, and gate previews into a pre-cutover decision verdict for planning only.",
        "Current checkout still commits through the active legacy ApiShip flow. This block does not save, clear, switch, or commit anything.",
        "When this decision preview says insufficient data, it means the current shadow previews still lack enough shopper-safe context to describe even an observe-only pre-cutover decision picture.",
        getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_gate_preview),
        getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_evidence_preview),
      ]).slice(0, 4),
    }
  }

  return {
    tone: "neutral",
    decision_status: "observe_only",
    status_label: "Shadow cutover decision preview remains observe-only",
    readiness_label: readinessLabel,
    summary_label: summaryLabel,
    evidence_label: evidenceLabel,
    rollout_label: rolloutLabel,
    gate_label: gateLabel,
    decision_reason_label:
      preview.shadow_cutover_gate_preview.aligned_gate_count_label ??
      preview.shadow_cutover_evidence_preview.evidence_count_label ??
      "Current shadow cutover picture remains available for observation only",
    detail_label: detailLabel,
    headline_messages: uniqueDeliveryHubMessages([
      "Current shadow cutover picture can be observed from checkout without changing the active commit path.",
      preview.shadow_cutover_gate_preview.aligned_gate_count_label,
      preview.shadow_cutover_rollout_preview.headline_messages[0] ?? null,
    ]).slice(0, 3),
    hint_messages: uniqueDeliveryHubMessages([
      "Read-only shadow cutover decision preview only. This compact block aggregates already materialized shadow summary, evidence, rollout, and gate previews into a pre-cutover decision verdict for planning only.",
      "Current checkout still commits through the active legacy ApiShip flow. This block does not save, clear, switch, or commit anything.",
      "An observe-only verdict here means the currently materialized shadow previews look internally consistent enough to monitor, but checkout is not cut over and no shipping method will be switched.",
      getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_gate_preview),
      getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_rollout_preview),
    ]).slice(0, 4),
  }
}

export function buildDeliveryHubShadowCutoverChecklistPreviewModel(
  preview: DeliveryHubShadowCutoverChecklistPreviewState
): DeliveryHubShadowCutoverChecklistPreviewModel {
  const readinessLabel =
    preview.shadow_cutover_decision_preview.readiness_label ??
    preview.shadow_cutover_gate_preview.readiness_label ??
    preview.shadow_cutover_rollout_preview.readiness_label ??
    preview.shadow_cutover_summary_preview.readiness_label ??
    preview.shadow_cutover_readiness_preview.readiness_label
  const summaryLabel = preview.shadow_cutover_summary_preview.status_label
  const decisionLabel = preview.shadow_cutover_decision_preview.status_label
  const checklistItems: DeliveryHubShadowCutoverChecklistItem[] = []

  const pushChecklistItem = (
    code: DeliveryHubShadowCutoverChecklistItemCode,
    itemStatus: DeliveryHubShadowCutoverChecklistItemStatus,
    label: string,
    detailLabel: string | null
  ) => {
    checklistItems.push({
      code,
      item_status: itemStatus,
      label,
      detail_label: detailLabel,
    })
  }

  switch (preview.shadow_cutover_readiness_preview.cutover_readiness_status) {
    case "ready":
      pushChecklistItem(
        "readiness_contour",
        "ready",
        "Readiness contour currently looks ready",
        preview.shadow_cutover_readiness_preview.detail_label ??
          preview.shadow_cutover_readiness_preview.status_label
      )
      break
    case "not_ready":
      pushChecklistItem(
        "readiness_contour",
        "pending",
        "Readiness contour still needs follow-up",
        getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_readiness_preview) ??
          preview.shadow_cutover_readiness_preview.detail_label ??
          preview.shadow_cutover_readiness_preview.status_label
      )
      break
    default:
      pushChecklistItem(
        "readiness_contour",
        "insufficient_data",
        "Readiness contour still lacks enough context",
        getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_readiness_preview) ??
          preview.shadow_cutover_readiness_preview.status_label
      )
      break
  }

  switch (preview.shadow_cutover_blockers_preview.blockers_status) {
    case "no_known_blockers":
      pushChecklistItem(
        "known_blockers",
        "ready",
        "No known blockers are currently visible",
        preview.shadow_cutover_blockers_preview.verdict_label ??
          preview.shadow_cutover_blockers_preview.recommendation_label ??
          preview.shadow_cutover_blockers_preview.status_label
      )
      break
    case "known_blockers":
      pushChecklistItem(
        "known_blockers",
        "blocked",
        "Known blockers are currently visible",
        preview.shadow_cutover_blockers_preview.blocker_count_label ??
          getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_blockers_preview) ??
          preview.shadow_cutover_blockers_preview.status_label
      )
      break
    default:
      pushChecklistItem(
        "known_blockers",
        "insufficient_data",
        "Blocker picture still lacks enough context",
        getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_blockers_preview) ??
          preview.shadow_cutover_blockers_preview.status_label
      )
      break
  }

  switch (preview.shadow_cutover_summary_preview.summary_status) {
    case "ready_shadow_contour":
      pushChecklistItem(
        "shadow_summary",
        "ready",
        "Shadow summary currently looks aligned",
        preview.shadow_cutover_summary_preview.detail_label ??
          preview.shadow_cutover_summary_preview.headline_messages[0] ??
          preview.shadow_cutover_summary_preview.status_label
      )
      break
    case "attention_required":
      pushChecklistItem(
        "shadow_summary",
        "pending",
        "Shadow summary still shows attention points",
        preview.shadow_cutover_summary_preview.headline_messages[0] ??
          preview.shadow_cutover_summary_preview.detail_label ??
          preview.shadow_cutover_summary_preview.status_label
      )
      break
    default:
      pushChecklistItem(
        "shadow_summary",
        "insufficient_data",
        "Shadow summary still lacks enough context",
        getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_summary_preview) ??
          preview.shadow_cutover_summary_preview.status_label
      )
      break
  }

  switch (preview.shadow_cutover_evidence_preview.evidence_status) {
    case "evidence_available":
      pushChecklistItem(
        "supporting_evidence",
        "ready",
        "Supporting evidence is currently available",
        preview.shadow_cutover_evidence_preview.evidence_count_label ??
          preview.shadow_cutover_evidence_preview.detail_label ??
          preview.shadow_cutover_evidence_preview.status_label
      )
      break
    default:
      pushChecklistItem(
        "supporting_evidence",
        "insufficient_data",
        "Supporting evidence still lacks enough context",
        getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_evidence_preview) ??
          preview.shadow_cutover_evidence_preview.status_label
      )
      break
  }

  switch (preview.shadow_cutover_rollout_preview.rollout_status) {
    case "observe_only":
      pushChecklistItem(
        "rollout_picture",
        "ready",
        "Rollout picture remains observe-only",
        preview.shadow_cutover_rollout_preview.rollout_reason_label ??
          preview.shadow_cutover_rollout_preview.status_label
      )
      break
    case "not_advised":
      pushChecklistItem(
        "rollout_picture",
        "blocked",
        "Rollout picture is not currently advised",
        preview.shadow_cutover_rollout_preview.rollout_reason_label ??
          getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_rollout_preview) ??
          preview.shadow_cutover_rollout_preview.status_label
      )
      break
    default:
      pushChecklistItem(
        "rollout_picture",
        "insufficient_data",
        "Rollout picture still lacks enough context",
        preview.shadow_cutover_rollout_preview.rollout_reason_label ??
          getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_rollout_preview) ??
          preview.shadow_cutover_rollout_preview.status_label
      )
      break
  }

  switch (preview.shadow_cutover_gate_preview.gate_preview_status) {
    case "aligned":
      pushChecklistItem(
        "gate_alignment",
        "ready",
        "Gate alignment currently looks consistent",
        preview.shadow_cutover_gate_preview.aligned_gate_count_label ??
          preview.shadow_cutover_gate_preview.status_label
      )
      break
    case "blocked":
      pushChecklistItem(
        "gate_alignment",
        "blocked",
        "Gate alignment currently shows blocked checks",
        preview.shadow_cutover_gate_preview.blocked_gate_count_label ??
          getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_gate_preview) ??
          preview.shadow_cutover_gate_preview.status_label
      )
      break
    default:
      pushChecklistItem(
        "gate_alignment",
        "insufficient_data",
        "Gate alignment still lacks enough context",
        preview.shadow_cutover_gate_preview.insufficient_gate_count_label ??
          getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_gate_preview) ??
          preview.shadow_cutover_gate_preview.status_label
      )
      break
  }

  switch (preview.shadow_cutover_decision_preview.decision_status) {
    case "observe_only":
      pushChecklistItem(
        "decision_signal",
        "ready",
        "Decision picture remains observe-only",
        preview.shadow_cutover_decision_preview.decision_reason_label ??
          preview.shadow_cutover_decision_preview.status_label
      )
      break
    case "hold":
      pushChecklistItem(
        "decision_signal",
        "blocked",
        "Decision picture currently remains on hold",
        preview.shadow_cutover_decision_preview.decision_reason_label ??
          getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_decision_preview) ??
          preview.shadow_cutover_decision_preview.status_label
      )
      break
    default:
      pushChecklistItem(
        "decision_signal",
        "insufficient_data",
        "Decision picture still lacks enough context",
        preview.shadow_cutover_decision_preview.decision_reason_label ??
          getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_decision_preview) ??
          preview.shadow_cutover_decision_preview.status_label
      )
      break
  }

  const readyCount = checklistItems.filter(
    (item) => item.item_status === "ready"
  ).length
  const pendingCount = checklistItems.filter(
    (item) => item.item_status === "pending"
  ).length
  const blockedCount = checklistItems.filter(
    (item) => item.item_status === "blocked"
  ).length
  const insufficientCount = checklistItems.filter(
    (item) => item.item_status === "insufficient_data"
  ).length
  const readyItemCountLabel = readyCount
    ? `${formatDeliveryHubCountLabel(readyCount, "ready check", "ready checks")} visible`
    : null
  const pendingItemCountLabel = pendingCount
    ? `${formatDeliveryHubCountLabel(pendingCount, "pending check", "pending checks")} visible`
    : null
  const blockedItemCountLabel = blockedCount
    ? `${formatDeliveryHubCountLabel(blockedCount, "blocked check", "blocked checks")} visible`
    : null
  const insufficientItemCountLabel = insufficientCount
    ? `${formatDeliveryHubCountLabel(
        insufficientCount,
        "insufficient check",
        "insufficient checks"
      )} visible`
    : null

  if (blockedCount > 0) {
    return {
      tone: "warning",
      checklist_status: "blocked",
      status_label: "Shadow cutover checklist preview shows blocked checks",
      readiness_label: readinessLabel,
      summary_label: summaryLabel,
      decision_label: decisionLabel,
      ready_item_count_label: readyItemCountLabel,
      pending_item_count_label: pendingItemCountLabel,
      blocked_item_count_label: blockedItemCountLabel,
      insufficient_item_count_label: insufficientItemCountLabel,
      checklist_items: checklistItems,
      hint_messages: uniqueDeliveryHubMessages([
        "Read-only shadow cutover checklist preview only. Each checklist item below simply restates already materialized cutover-related shadow previews for pre-cutover observation only.",
        "Current checkout still commits through the active legacy ApiShip flow. This block does not save, clear, switch, or commit anything.",
        "Blocked checklist items below only highlight already visible cutover blockers or hold signals and do not mean checkout cutover has started.",
        getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_blockers_preview),
        getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_decision_preview),
      ]).slice(0, 4),
    }
  }

  if (pendingCount > 0) {
    return {
      tone: "neutral",
      checklist_status: "pending",
      status_label: "Shadow cutover checklist preview shows pending checks",
      readiness_label: readinessLabel,
      summary_label: summaryLabel,
      decision_label: decisionLabel,
      ready_item_count_label: readyItemCountLabel,
      pending_item_count_label: pendingItemCountLabel,
      blocked_item_count_label: blockedItemCountLabel,
      insufficient_item_count_label: insufficientItemCountLabel,
      checklist_items: checklistItems,
      hint_messages: uniqueDeliveryHubMessages([
        "Read-only shadow cutover checklist preview only. Pending checklist items simply show where the current shadow cutover picture still needs follow-up before any future checkout cutover planning could mature.",
        "Current checkout still commits through the active legacy ApiShip flow. This block does not save, clear, switch, or commit anything.",
        "Pending checks here do not claim that checkout has already switched away from legacy ApiShip; they only restate shopper-safe shadow signals.",
        getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_readiness_preview),
        getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_summary_preview),
      ]).slice(0, 4),
    }
  }

  if (insufficientCount > 0) {
    return {
      tone: "neutral",
      checklist_status: "insufficient_data",
      status_label: "Shadow cutover checklist preview needs more context",
      readiness_label: readinessLabel,
      summary_label: summaryLabel,
      decision_label: decisionLabel,
      ready_item_count_label: readyItemCountLabel,
      pending_item_count_label: pendingItemCountLabel,
      blocked_item_count_label: blockedItemCountLabel,
      insufficient_item_count_label: insufficientItemCountLabel,
      checklist_items: checklistItems,
      hint_messages: uniqueDeliveryHubMessages([
        "Read-only shadow cutover checklist preview does not yet have enough comparable context to classify all pre-cutover checks for the current checkout.",
        "Current checkout still commits through the active legacy ApiShip flow. This block does not save, clear, switch, or commit anything.",
        "When checklist items say insufficient data, they simply reflect that already materialized shopper-safe shadow previews still lack comparable context.",
        getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_gate_preview),
        getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_evidence_preview),
      ]).slice(0, 4),
    }
  }

  return {
    tone: "positive",
    checklist_status: "ready",
    status_label: "Shadow cutover checklist preview shows ready checks only",
    readiness_label: readinessLabel,
    summary_label: summaryLabel,
    decision_label: decisionLabel,
    ready_item_count_label: readyItemCountLabel,
    pending_item_count_label: pendingItemCountLabel,
    blocked_item_count_label: blockedItemCountLabel,
    insufficient_item_count_label: insufficientItemCountLabel,
    checklist_items: checklistItems,
    hint_messages: uniqueDeliveryHubMessages([
      "Read-only shadow cutover checklist preview only. Ready checklist items simply indicate that the currently materialized pre-cutover shadow checks look internally consistent for observation.",
      "Current checkout still commits through the active legacy ApiShip flow. This block does not save, clear, switch, or commit anything.",
      "Ready checks here do not mean checkout is already cut over; they only show that current shopper-safe shadow checks have enough aligned context to observe as a checklist.",
      getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_decision_preview),
      getDeliveryHubPreviewPrimaryHint(preview.shadow_cutover_gate_preview),
    ]).slice(0, 4),
  }
}
