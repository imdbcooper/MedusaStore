import type { ExecArgs } from "@medusajs/framework/types"

const DELIVERY_HUB_STOREFRONT_NEUTRAL_SMOKE_VERSION = 1
const DEFAULT_BACKEND_URL = "http://localhost:9000"
const DEFAULT_CURRENCY_CODE = "RUB"
const DEFAULT_ITEMS = [
  {
    quantity: 1,
    weight_grams: 500,
    price: 2000,
  },
]

const QUOTE_ENDPOINT = "/store/delivery/quotes"
const SELECTION_ENDPOINT = "/store/delivery/selection"

const SUPPORTED_MODE_CODES = [
  "warehouse_to_pickup_point",
  "dropoff_point_to_pickup_point",
] as const

type DeliveryHubStorefrontNeutralSmokeModeCode = (typeof SUPPORTED_MODE_CODES)[number]

type DeliveryHubStorefrontNeutralSmokeItems = Array<{
  quantity?: number
  weight_grams?: number
  price?: number
}>

type DeliveryHubStorefrontNeutralSmokeArgs = {
  backend_url: string
  publishable_api_key: string | null
  connection_id: string | null
  cart_id: string | null
  mode_code: DeliveryHubStorefrontNeutralSmokeModeCode | null
  destination_point_id: string | null
  origin_point_id: string | null
  warehouse_id: string | null
  currency_code: string
  items: DeliveryHubStorefrontNeutralSmokeItems
  pickup_point_name: string | null
  pickup_point_address: string | null
  pickup_point_city: string | null
}

type DeliveryHubStorefrontNeutralSmokeRunResult = {
  generated_at: string
  input: DeliveryHubStorefrontNeutralSmokeArgs
  quote_http_status: number | null
  quote_body: unknown
  selection_http_status: number | null
  selection_body: unknown
  selected_quote: Record<string, unknown> | null
  status:
    | "success"
    | "blocked_missing_input"
    | "failed_quote_request"
    | "failed_no_quotes"
    | "failed_selection_request"
    | "failed_unexpected_error"
  error: {
    stage: "input" | "quote" | "selection" | "unexpected"
    code: string | null
    message: string
  } | null
}

type StringMap = Record<string, string>

export default async function deliveryHubStorefrontNeutralSmoke({ args }: ExecArgs) {
  const parsedArgs = parseDeliveryHubStorefrontNeutralSmokeArgs(args, process.env)
  const missingFields = listMissingDeliveryHubStorefrontNeutralSmokeFields(parsedArgs)

  if (missingFields.length > 0) {
    const blockedResult: DeliveryHubStorefrontNeutralSmokeRunResult = {
      generated_at: new Date().toISOString(),
      input: parsedArgs,
      quote_http_status: null,
      quote_body: null,
      selection_http_status: null,
      selection_body: null,
      selected_quote: null,
      status: "blocked_missing_input",
      error: {
        stage: "input",
        code: "missing_required_input",
        message: `Missing required input: ${missingFields.join(", ")}`,
      },
    }

    console.log(JSON.stringify(buildDeliveryHubStorefrontNeutralSmokeSafeSummary(blockedResult), null, 2))
    process.exitCode = 2
    return
  }

  const result = await runDeliveryHubStorefrontNeutralSmoke(parsedArgs)

  console.log(JSON.stringify(buildDeliveryHubStorefrontNeutralSmokeSafeSummary(result), null, 2))
  process.exitCode = result.status === "success" ? 0 : 1
}

export function parseDeliveryHubStorefrontNeutralSmokeArgs(
  args: string[] | undefined,
  env: NodeJS.ProcessEnv = process.env
): DeliveryHubStorefrontNeutralSmokeArgs {
  const parsed = parseKeyValueArgs(args ?? [])
  const rawModeCode = readArgOrEnv(parsed, env, "mode", "DELIVERY_HUB_STORE_SMOKE_MODE") ??
    readArgOrEnv(parsed, env, "mode-code", "DELIVERY_HUB_STORE_SMOKE_MODE_CODE")
  const modeCode = normalizeModeCode(rawModeCode)

  return {
    backend_url:
      normalizeNullableText(
        readArgOrEnv(parsed, env, "backend-url", "DELIVERY_HUB_STORE_SMOKE_BACKEND_URL")
      ) ?? DEFAULT_BACKEND_URL,
    publishable_api_key: normalizeNullableText(
      readArgOrEnv(parsed, env, "publishable-api-key", "MEDUSA_PUBLISHABLE_KEY") ??
        readArgOrEnv(parsed, env, "publishable-key", "DELIVERY_HUB_STORE_SMOKE_PUBLISHABLE_KEY")
    ),
    connection_id: normalizeNullableText(
      readArgOrEnv(parsed, env, "connection-id", "DELIVERY_HUB_STORE_SMOKE_CONNECTION_ID")
    ),
    cart_id: normalizeNullableText(readArgOrEnv(parsed, env, "cart-id", "DELIVERY_HUB_STORE_SMOKE_CART_ID")),
    mode_code: modeCode,
    destination_point_id: normalizeNullableText(
      readArgOrEnv(parsed, env, "destination-point-id", "DELIVERY_HUB_STORE_SMOKE_DESTINATION_POINT_ID")
    ),
    origin_point_id: normalizeNullableText(
      readArgOrEnv(parsed, env, "origin-point-id", "DELIVERY_HUB_STORE_SMOKE_ORIGIN_POINT_ID")
    ),
    warehouse_id: normalizeNullableText(
      readArgOrEnv(parsed, env, "warehouse-id", "DELIVERY_HUB_STORE_SMOKE_WAREHOUSE_ID")
    ),
    currency_code:
      normalizeNullableText(
        readArgOrEnv(parsed, env, "currency-code", "DELIVERY_HUB_STORE_SMOKE_CURRENCY_CODE")
      ) ?? DEFAULT_CURRENCY_CODE,
    items: parseItemsJson(
      readArgOrEnv(parsed, env, "items-json", "DELIVERY_HUB_STORE_SMOKE_ITEMS_JSON") ??
        readArgOrEnv(parsed, env, "items", "DELIVERY_HUB_STORE_SMOKE_ITEMS")
    ),
    pickup_point_name: normalizeNullableText(
      readArgOrEnv(parsed, env, "pickup-point-name", "DELIVERY_HUB_STORE_SMOKE_PICKUP_POINT_NAME")
    ),
    pickup_point_address: normalizeNullableText(
      readArgOrEnv(parsed, env, "pickup-point-address", "DELIVERY_HUB_STORE_SMOKE_PICKUP_POINT_ADDRESS")
    ),
    pickup_point_city: normalizeNullableText(
      readArgOrEnv(parsed, env, "pickup-point-city", "DELIVERY_HUB_STORE_SMOKE_PICKUP_POINT_CITY")
    ),
  }
}

export function listMissingDeliveryHubStorefrontNeutralSmokeFields(
  input: DeliveryHubStorefrontNeutralSmokeArgs
): string[] {
  const missing: string[] = []

  if (!input.backend_url) {
    missing.push("backend-url")
  }

  if (!input.connection_id) {
    missing.push("connection-id")
  }

  if (!input.cart_id) {
    missing.push("cart-id")
  }

  if (!input.mode_code) {
    missing.push("mode")
  }

  if (!input.destination_point_id) {
    missing.push("destination-point-id")
  }

  if (input.mode_code === "dropoff_point_to_pickup_point" && !input.origin_point_id) {
    missing.push("origin-point-id")
  }

  if (input.mode_code === "warehouse_to_pickup_point" && !input.warehouse_id) {
    missing.push("warehouse-id")
  }

  if (!Array.isArray(input.items) || input.items.length === 0) {
    missing.push("items-json")
  }

  return missing
}

export async function runDeliveryHubStorefrontNeutralSmoke(
  input: DeliveryHubStorefrontNeutralSmokeArgs
): Promise<DeliveryHubStorefrontNeutralSmokeRunResult> {
  const generatedAt = new Date().toISOString()

  try {
    const quoteRequestBody = buildQuoteRequestBody(input)
    const quoteResponse = await postJson(input, QUOTE_ENDPOINT, quoteRequestBody)

    if (!isHttpSuccess(quoteResponse.http_status)) {
      return {
        generated_at: generatedAt,
        input,
        quote_http_status: quoteResponse.http_status,
        quote_body: quoteResponse.body,
        selection_http_status: null,
        selection_body: null,
        selected_quote: null,
        status: "failed_quote_request",
        error: {
          stage: "quote",
          ...extractSafeError(quoteResponse.body, "Store quote request failed"),
        },
      }
    }

    const selectedQuote = getFirstQuote(quoteResponse.body)

    if (!selectedQuote) {
      return {
        generated_at: generatedAt,
        input,
        quote_http_status: quoteResponse.http_status,
        quote_body: quoteResponse.body,
        selection_http_status: null,
        selection_body: null,
        selected_quote: null,
        status: "failed_no_quotes",
        error: {
          stage: "quote",
          code: "no_quotes_returned",
          message: "Store quote endpoint returned no neutral quotes",
        },
      }
    }

    const selectionResponse = await postJson(
      input,
      SELECTION_ENDPOINT,
      buildSelectionRequestBody(input, selectedQuote, quoteResponse.body)
    )

    if (!isHttpSuccess(selectionResponse.http_status)) {
      return {
        generated_at: generatedAt,
        input,
        quote_http_status: quoteResponse.http_status,
        quote_body: quoteResponse.body,
        selection_http_status: selectionResponse.http_status,
        selection_body: selectionResponse.body,
        selected_quote: selectedQuote,
        status: "failed_selection_request",
        error: {
          stage: "selection",
          ...extractSafeError(selectionResponse.body, "Store selection request failed"),
        },
      }
    }

    return {
      generated_at: generatedAt,
      input,
      quote_http_status: quoteResponse.http_status,
      quote_body: quoteResponse.body,
      selection_http_status: selectionResponse.http_status,
      selection_body: selectionResponse.body,
      selected_quote: selectedQuote,
      status: "success",
      error: null,
    }
  } catch (error) {
    return {
      generated_at: generatedAt,
      input,
      quote_http_status: null,
      quote_body: null,
      selection_http_status: null,
      selection_body: null,
      selected_quote: null,
      status: "failed_unexpected_error",
      error: {
        stage: "unexpected",
        code: "unexpected_smoke_harness_error",
        message: sanitizeText(error instanceof Error ? error.message : String(error)),
      },
    }
  }
}

export function buildDeliveryHubStorefrontNeutralSmokeSafeSummary(
  result: DeliveryHubStorefrontNeutralSmokeRunResult
) {
  const quoteBody = asRecord(result.quote_body)
  const selectionBody = asRecord(result.selection_body)
  const selectedQuote = result.selected_quote
  const quoteDiagnostics = asRecord(quoteBody.diagnostics)
  const selectionDiagnostics = asRecord(selectionBody.diagnostics)
  const selectedQuoteReference = asRecord(selectedQuote?.quote_reference)
  const selection = asRecord(selectionBody.selection)
  const savedQuoteReference = asRecord(selection.quote_reference)
  const selectedPickupPointId = result.input.destination_point_id
  const selectionCheckoutSourceOfTruth = safeString(selectionDiagnostics.checkout_source_of_truth)

  return {
    version: DELIVERY_HUB_STOREFRONT_NEUTRAL_SMOKE_VERSION,
    generated_at: result.generated_at,
    harness: {
      kind: "delivery_hub_storefront_neutral_quote_selection_smoke",
      store_facing: true,
      checkout_cutover: false,
      shipment_lifecycle_calls: false,
      api_ship_touched: false,
      safe_summary_only: true,
      canonical_invocation: "env_vars",
    },
    invocation: {
      backend_url: safeString(result.input.backend_url),
      quote_endpoint: `POST ${QUOTE_ENDPOINT}`,
      selection_endpoint: `POST ${SELECTION_ENDPOINT}`,
      connection_id: safeString(result.input.connection_id),
      cart_id: safeString(result.input.cart_id),
      mode_code: safeString(result.input.mode_code),
      destination_point_id: safeString(result.input.destination_point_id),
      origin_point_id_present: Boolean(result.input.origin_point_id),
      warehouse_id: safeString(result.input.warehouse_id),
      currency_code: safeString(result.input.currency_code),
      items_count: result.input.items.length,
      publishable_key_provided: Boolean(result.input.publishable_api_key),
    },
    status: result.status,
    quote: {
      http_status: result.quote_http_status,
      ok: quoteBody.ok === true,
      quotes_count: Array.isArray(quoteBody.quotes) ? quoteBody.quotes.length : 0,
      selected_quote_reference: {
        id: safeString(selectedQuoteReference.id),
        version: safeNumber(selectedQuoteReference.version),
      },
      selected_quote_price: {
        amount: safeNumber(selectedQuote?.amount),
        currency_code: safeString(selectedQuote?.currency_code),
      },
      pickup_point_id: safeString(selectedPickupPointId),
      pickup_point_ids_count: Array.isArray(selectedQuote?.pickup_point_ids)
        ? selectedQuote.pickup_point_ids.length
        : 0,
      correlation_id: safeString(quoteDiagnostics.correlation_id),
    },
    selection: {
      http_status: result.selection_http_status,
      ok: selectionBody.ok === true,
      saved: selectionBody.ok === true && !!selection.quote_reference,
      selected_quote_reference: {
        id: safeString(savedQuoteReference.id ?? selectedQuoteReference.id),
        version: safeNumber(savedQuoteReference.version ?? selectedQuoteReference.version),
      },
      pickup_point_id: safeString(selectedPickupPointId),
      checkout_source_of_truth: selectionCheckoutSourceOfTruth,
      contour: safeString(selectionDiagnostics.contour),
      correlation_id: safeString(selectionDiagnostics.correlation_id),
    },
    diagnostics: {
      quote_correlation_id: safeString(quoteDiagnostics.correlation_id),
      selection_correlation_id: safeString(selectionDiagnostics.correlation_id),
      checkout_source_of_truth: selectionCheckoutSourceOfTruth,
      source_of_truth_unchanged: selectionCheckoutSourceOfTruth === "unchanged",
    },
    error: result.error
      ? {
          stage: result.error.stage,
          code: safeString(result.error.code),
          message: safeString(result.error.message),
        }
      : null,
    safety: {
      safe_summary_only: true,
      raw_provider_body_printed: false,
      credential_values_printed: false,
      request_headers_printed: false,
      ciphertext_printed: false,
      checkout_cutover_performed: false,
      shipment_create_cancel_status_retry_performed: false,
      api_ship_or_legacy_provider_touched: false,
    },
  }
}

function buildQuoteRequestBody(input: DeliveryHubStorefrontNeutralSmokeArgs) {
  return {
    connection_id: input.connection_id,
    mode_code: input.mode_code,
    currency_code: input.currency_code,
    destination_point_id: input.destination_point_id,
    origin_point_id:
      input.mode_code === "dropoff_point_to_pickup_point" ? input.origin_point_id : undefined,
    warehouse_id: input.mode_code === "warehouse_to_pickup_point" ? input.warehouse_id : undefined,
    items: input.items,
  }
}

function buildSelectionRequestBody(
  input: DeliveryHubStorefrontNeutralSmokeArgs,
  selectedQuote: Record<string, unknown>,
  quoteBody: unknown
) {
  const quoteDiagnostics = asRecord(asRecord(quoteBody).diagnostics)
  const carrierCode = safeString(selectedQuote.carrier_code)

  return {
    cart_id: input.cart_id,
    connection_id: input.connection_id,
    provider_code: carrierCode === "yandex" ? "yandex" : undefined,
    quote_type: input.mode_code,
    quote_reference: selectedQuote.quote_reference,
    quote: {
      carrier_code: selectedQuote.carrier_code,
      carrier_label: selectedQuote.carrier_label,
      amount: selectedQuote.amount,
      currency_code: selectedQuote.currency_code,
      delivery_eta_min: selectedQuote.delivery_eta_min ?? null,
      delivery_eta_max: selectedQuote.delivery_eta_max ?? null,
      pickup_point_required: selectedQuote.pickup_point_required,
      pickup_window_required: selectedQuote.pickup_window_required,
    },
    pickup_point: {
      provider_point_id: input.destination_point_id,
      provider_point_code: null,
      name: input.pickup_point_name ?? "Smoke selected pickup point",
      address: input.pickup_point_address ?? "Smoke pickup point address placeholder",
      city: input.pickup_point_city ?? null,
      region: null,
      postal_code: null,
      lat: null,
      lng: null,
      is_origin_dropoff_allowed: false,
      is_destination_pickup_allowed: true,
      payment_methods: [],
    },
    pickup_window: null,
    correlation_id: safeString(quoteDiagnostics.correlation_id),
  }
}

async function postJson(
  input: DeliveryHubStorefrontNeutralSmokeArgs,
  endpoint: string,
  body: Record<string, unknown>
): Promise<{ http_status: number; body: unknown }> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  }

  if (input.publishable_api_key) {
    headers["x-publishable-api-key"] = input.publishable_api_key
  }

  const response = await fetch(new URL(endpoint, input.backend_url), {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })

  return {
    http_status: response.status,
    body: await parseResponseBody(response),
  }
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text()

  if (!text.trim()) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch (_error) {
    return {
      error: {
        code: "non_json_response",
        message: "Backend returned a non-JSON response",
      },
    }
  }
}

function getFirstQuote(body: unknown): Record<string, unknown> | null {
  const quotes = asRecord(body).quotes

  if (!Array.isArray(quotes)) {
    return null
  }

  const firstQuote = quotes[0]
  return firstQuote && typeof firstQuote === "object" ? (firstQuote as Record<string, unknown>) : null
}

function extractSafeError(body: unknown, fallbackMessage: string) {
  const error = asRecord(asRecord(body).error)

  return {
    code: safeString(error.code),
    message: safeString(error.message) ?? fallbackMessage,
  }
}

function parseKeyValueArgs(args: string[]): StringMap {
  return args.reduce<StringMap>((acc, arg) => {
    if (!arg.startsWith("--")) {
      return acc
    }

    const [rawKey, ...rawValueParts] = arg.slice(2).split("=")
    const key = rawKey.trim()
    const value = rawValueParts.length > 0 ? rawValueParts.join("=") : "true"

    if (key) {
      acc[key] = value
    }

    return acc
  }, {})
}

function readArgOrEnv(
  args: StringMap,
  env: NodeJS.ProcessEnv,
  argName: string,
  envName: string
): string | undefined {
  return args[argName] ?? env[envName]
}

function normalizeModeCode(value: string | undefined): DeliveryHubStorefrontNeutralSmokeModeCode | null {
  const normalized = normalizeNullableText(value)

  if (!normalized) {
    return null
  }

  if (SUPPORTED_MODE_CODES.includes(normalized as DeliveryHubStorefrontNeutralSmokeModeCode)) {
    return normalized as DeliveryHubStorefrontNeutralSmokeModeCode
  }

  return null
}

function parseItemsJson(value: string | undefined): DeliveryHubStorefrontNeutralSmokeItems {
  const normalized = normalizeNullableText(value)

  if (!normalized) {
    return DEFAULT_ITEMS
  }

  const parsed = JSON.parse(normalized)

  if (!Array.isArray(parsed)) {
    throw new Error("items-json must be a JSON array")
  }

  return parsed.map((item) => {
    const record = asRecord(item)
    return {
      quantity: safeNumber(record.quantity) ?? undefined,
      weight_grams: safeNumber(record.weight_grams) ?? undefined,
      price: safeNumber(record.price) ?? undefined,
    }
  })
}

function isHttpSuccess(status: number) {
  return status >= 200 && status < 300
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {}
}

function normalizeNullableText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function safeString(value: unknown): string | null {
  const normalized = normalizeNullableText(typeof value === "string" ? value : value == null ? null : String(value))
  return normalized ? sanitizeText(normalized) : null
}

function safeNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function sanitizeText(value: string): string {
  return value
    .replace(/Bearer\s+[^\s"']+/gi, "Bearer ***")
    .replace(/(authorization\s*[:=]\s*)[^\s"']+/gi, "$1***")
    .replace(/(token\s*[:=]\s*)[^\s"']+/gi, "$1***")
    .replace(/(ciphertext\s*[:=]\s*)[^\s"']+/gi, "$1***")
    .slice(0, 240)
}
