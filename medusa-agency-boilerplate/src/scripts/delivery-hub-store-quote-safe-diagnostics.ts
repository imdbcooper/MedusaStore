import type { ExecArgs } from "@medusajs/framework/types"
import { createDeliveryHubService, getDeliveryHubPgConnection } from "../modules/delivery-hub"
import { listDeliveryConnectionsReadOnly } from "../modules/delivery-hub/storage/connections-repository"
import { listDeliveryEventLogsReadOnly } from "../modules/delivery-hub/storage/event-log-repository"
import { listDeliveryWarehousesReadOnly } from "../modules/delivery-hub/storage/warehouses-repository"

const DEFAULT_CURRENCY_CODE = "RUB"
const DEFAULT_ITEMS = [
  {
    quantity: 1,
    weight_grams: 500,
    price: 2000,
  },
]

const SUPPORTED_MODE_CODES = [
  "warehouse_to_pickup_point",
  "dropoff_point_to_pickup_point",
] as const

type ModeCode = (typeof SUPPORTED_MODE_CODES)[number]

type Args = {
  connection_id: string | null
  mode_code: ModeCode | null
  destination_point_id: string | null
  origin_point_id: string | null
  warehouse_id: string | null
  currency_code: string
  items: Array<{
    quantity?: number
    weight_grams?: number
    price?: number
  }>
  execute_quote: boolean
  recent_log_limit: number
}

type SafeQuoteAttempt = {
  attempted: boolean
  ok: boolean | null
  status: number | null
  code: string | null
  message: string | null
  provider_status: string | number | null
  error_category: string | null
  provider_path: string | null
  provider_code: string | null
  provider_message: string | null
  operator_hint: string | null
  correlation_id: string | null
  quotes_count: number | null
}

export default async function deliveryHubStoreQuoteSafeDiagnostics({ args, container }: ExecArgs) {
  const parsed = parseArgs(args ?? [], process.env)
  const pg = getDeliveryHubPgConnection(container)
  const service = createDeliveryHubService(pg)
  const [connections, warehouses, recentLogsBefore] = await Promise.all([
    listDeliveryConnectionsReadOnly(pg),
    listDeliveryWarehousesReadOnly(pg),
    listDeliveryEventLogsReadOnly(pg, {
      provider_code: "yandex",
      limit: parsed.recent_log_limit,
    }),
  ])
  const selectedConnection = parsed.connection_id
    ? connections.find((connection) => connection.id === parsed.connection_id) ?? null
    : connections.find((connection) =>
      connection.provider_code === "yandex" &&
      connection.enabled &&
      connection.status === "active" &&
      connection.credentials_state === "sealed"
    ) ?? connections.find((connection) => connection.provider_code === "yandex") ?? null
  const missingInputs = listMissingInputs(parsed, selectedConnection?.id ?? null)
  let quoteAttempt: SafeQuoteAttempt = buildSkippedQuoteAttempt()

  if (parsed.execute_quote && missingInputs.length === 0 && selectedConnection) {
    quoteAttempt = await runSafeQuoteAttempt(service, {
      ...parsed,
      connection_id: selectedConnection.id,
    })
  }

  const recentLogsAfter = await listDeliveryEventLogsReadOnly(pg, {
    provider_code: "yandex",
    limit: parsed.recent_log_limit,
  })

  console.log(JSON.stringify({
    ok: true,
    generated_at: new Date().toISOString(),
    safety: {
      safe_summary_only: true,
      credential_values_printed: false,
      ciphertext_printed: false,
      request_headers_printed: false,
      raw_provider_body_printed: false,
      raw_quote_keys_printed: false,
      raw_offer_ids_printed: false,
      checkout_cutover_performed: false,
      shipment_lifecycle_calls: false,
    },
    invocation: {
      execute_quote: parsed.execute_quote,
      mode_code: parsed.mode_code,
      connection_id: selectedConnection?.id ?? parsed.connection_id,
      destination_point_id_present: !!parsed.destination_point_id,
      origin_point_id_present: !!parsed.origin_point_id,
      warehouse_id: parsed.warehouse_id,
      currency_code: parsed.currency_code,
      items_count: parsed.items.length,
    },
    readiness: {
      missing_inputs: missingInputs,
      connection_count: connections.length,
      yandex_connection_count: connections.filter((connection) => connection.provider_code === "yandex").length,
      selected_connection: selectedConnection ? {
        id: selectedConnection.id,
        provider_code: selectedConnection.provider_code,
        mode: selectedConnection.mode,
        enabled: selectedConnection.enabled,
        status: selectedConnection.status,
        credentials_state: selectedConnection.credentials_state,
        credentials_present: !!selectedConnection.credentials_envelope,
        credentials_last_error_code: selectedConnection.credentials_last_error_code,
        default_warehouse_id: safeString(selectedConnection.config?.default_warehouse_id),
      } : null,
      warehouse_count: warehouses.length,
      matching_warehouse: parsed.warehouse_id
        ? summarizeWarehouse(warehouses.find((warehouse) => warehouse.id === parsed.warehouse_id) ?? null)
        : null,
      default_warehouse: selectedConnection?.config?.default_warehouse_id
        ? summarizeWarehouse(warehouses.find((warehouse) => warehouse.id === selectedConnection.config.default_warehouse_id) ?? null)
        : null,
    },
    quote_attempt: quoteAttempt,
    recent_quote_logs: summarizeQuoteLogs(recentLogsAfter.length ? recentLogsAfter : recentLogsBefore),
  }, null, 2))
}

async function runSafeQuoteAttempt(
  service: ReturnType<typeof createDeliveryHubService>,
  input: Args & { connection_id: string }
): Promise<SafeQuoteAttempt> {
  try {
    const result = await service.listStoreQuotes({
      connection_id: input.connection_id,
      mode_code: input.mode_code as ModeCode,
      currency_code: input.currency_code,
      destination_point_id: input.destination_point_id as string,
      origin_point_id: input.origin_point_id,
      warehouse_id: input.warehouse_id,
      items: input.items,
    })
    const diagnostics = asRecord(result.diagnostics)

    return {
      attempted: true,
      ok: true,
      status: 200,
      code: null,
      message: null,
      provider_status: null,
      error_category: null,
      provider_path: null,
      provider_code: null,
      provider_message: null,
      operator_hint: null,
      correlation_id: safeString(diagnostics.correlation_id),
      quotes_count: Array.isArray(result.quotes) ? result.quotes.length : null,
    }
  } catch (error) {
    const details = asRecord((error as { details?: unknown }).details)
    const request = asRecord(details.request)
    const response = asRecord(details.response)
    const diagnosticsSummary = asRecord(details.diagnostics_summary)

    return {
      attempted: true,
      ok: false,
      status: typeof (error as { status?: unknown }).status === "number"
        ? (error as { status: number }).status
        : null,
      code: safeString((error as { code?: unknown }).code),
      message: safeString((error as { message?: unknown }).message),
      provider_status: safeDiagnosticValue(details.provider_status ?? diagnosticsSummary.provider_status),
      error_category: safeString(details.error_category ?? diagnosticsSummary.error_category),
      provider_path: safeString(request.path),
      provider_code: safeString(response.code ?? response.error_code),
      provider_message: safeString(response.message ?? response.error_message),
      operator_hint: safeString(details.operator_hint),
      correlation_id: safeString(details.correlation_id ?? diagnosticsSummary.correlation_id),
      quotes_count: null,
    }
  }
}

function listMissingInputs(input: Args, resolvedConnectionId: string | null) {
  const missing: string[] = []

  if (!resolvedConnectionId) {
    missing.push("connection_id")
  }

  if (!input.mode_code) {
    missing.push("mode_code")
  }

  if (!input.destination_point_id) {
    missing.push("destination_point_id")
  }

  if (input.mode_code === "dropoff_point_to_pickup_point" && !input.origin_point_id) {
    missing.push("origin_point_id")
  }

  if (input.mode_code === "warehouse_to_pickup_point" && !input.warehouse_id) {
    missing.push("warehouse_id")
  }

  if (!Array.isArray(input.items) || input.items.length === 0) {
    missing.push("items")
  }

  return missing
}

function summarizeWarehouse(warehouse: any) {
  if (!warehouse) {
    return null
  }

  return {
    id: warehouse.id,
    enabled: !!warehouse.enabled,
    provider_code: safeString(warehouse.provider_code),
    provider_warehouse_id_present: !!warehouse.provider_warehouse_id,
  }
}

function summarizeQuoteLogs(logs: any[]) {
  return logs
    .filter((log) => log.kind === "quote")
    .slice(0, 5)
    .map((log) => {
      const request = asRecord(log.request_summary)
      const response = asRecord(log.response_summary)
      const details = asRecord(response.details)
      const providerRequest = asRecord(details.request)
      const providerResponse = asRecord(details.response)

      return {
        created_at: safeString(log.created_at),
        success: !!log.success,
        error_code: safeString(log.error_code),
        correlation_id: safeString(log.correlation_id),
        mode_code: safeString(request.mode_code),
        destination_point_id_present: !!request.destination_point_id,
        origin_point_id_present: !!request.origin_point_id,
        warehouse_id: safeString(request.warehouse_id),
        provider_warehouse_id_present: !!request.provider_warehouse_id,
        provider_status: safeDiagnosticValue(details.provider_status),
        error_category: safeString(details.error_category),
        provider_path: safeString(providerRequest.path),
        provider_code: safeString(providerResponse.code ?? providerResponse.error_code),
        provider_message: safeString(providerResponse.message ?? providerResponse.error_message),
        operator_hint: safeString(details.operator_hint),
        quotes_count: typeof response.quotes_count === "number" ? response.quotes_count : null,
      }
    })
}

function parseArgs(rawArgs: string[], env: NodeJS.ProcessEnv): Args {
  const map = new Map<string, string>()

  for (const arg of rawArgs) {
    if (!arg.startsWith("--")) {
      continue
    }

    const [key, ...valueParts] = arg.slice(2).split("=")
    map.set(key, valueParts.length ? valueParts.join("=") : "true")
  }

  const rawMode = readArgOrEnv(map, env, "mode", "DELIVERY_HUB_STORE_DIAG_MODE") ??
    readArgOrEnv(map, env, "mode-code", "DELIVERY_HUB_STORE_DIAG_MODE_CODE")

  return {
    connection_id: safeString(
      readArgOrEnv(map, env, "connection-id", "DELIVERY_HUB_STORE_DIAG_CONNECTION_ID") ??
      env.DELIVERY_HUB_STORE_SMOKE_CONNECTION_ID
    ),
    mode_code: normalizeModeCode(rawMode),
    destination_point_id: safeString(
      readArgOrEnv(map, env, "destination-point-id", "DELIVERY_HUB_STORE_DIAG_DESTINATION_POINT_ID") ??
      env.DELIVERY_HUB_STORE_SMOKE_DESTINATION_POINT_ID
    ),
    origin_point_id: safeString(
      readArgOrEnv(map, env, "origin-point-id", "DELIVERY_HUB_STORE_DIAG_ORIGIN_POINT_ID") ??
      env.DELIVERY_HUB_STORE_SMOKE_ORIGIN_POINT_ID
    ),
    warehouse_id: safeString(
      readArgOrEnv(map, env, "warehouse-id", "DELIVERY_HUB_STORE_DIAG_WAREHOUSE_ID") ??
      env.DELIVERY_HUB_STORE_SMOKE_WAREHOUSE_ID
    ),
    currency_code: safeString(
      readArgOrEnv(map, env, "currency-code", "DELIVERY_HUB_STORE_DIAG_CURRENCY_CODE") ??
      env.DELIVERY_HUB_STORE_SMOKE_CURRENCY_CODE
    ) ?? DEFAULT_CURRENCY_CODE,
    items: parseItemsJson(
      readArgOrEnv(map, env, "items-json", "DELIVERY_HUB_STORE_DIAG_ITEMS_JSON") ??
      env.DELIVERY_HUB_STORE_SMOKE_ITEMS_JSON
    ),
    execute_quote: readBoolean(
      readArgOrEnv(map, env, "execute-quote", "DELIVERY_HUB_STORE_DIAG_EXECUTE_QUOTE"),
      false
    ),
    recent_log_limit: normalizeLimit(
      readArgOrEnv(map, env, "recent-log-limit", "DELIVERY_HUB_STORE_DIAG_RECENT_LOG_LIMIT")
    ),
  }
}

function readArgOrEnv(
  args: Map<string, string>,
  env: NodeJS.ProcessEnv,
  argName: string,
  envName: string
) {
  return args.get(argName) ?? env[envName]
}

function normalizeModeCode(value: unknown): ModeCode | null {
  const normalized = safeString(value)

  return SUPPORTED_MODE_CODES.includes(normalized as ModeCode)
    ? normalized as ModeCode
    : null
}

function parseItemsJson(value: string | undefined) {
  const normalized = safeString(value)

  if (!normalized) {
    return DEFAULT_ITEMS
  }

  const parsed = JSON.parse(normalized)

  if (!Array.isArray(parsed)) {
    return DEFAULT_ITEMS
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

function buildSkippedQuoteAttempt(): SafeQuoteAttempt {
  return {
    attempted: false,
    ok: null,
    status: null,
    code: null,
    message: null,
    provider_status: null,
    error_category: null,
    provider_path: null,
    provider_code: null,
    provider_message: null,
    operator_hint: null,
    correlation_id: null,
    quotes_count: null,
  }
}

function readBoolean(value: unknown, fallback: boolean) {
  if (value === "true") {
    return true
  }

  if (value === "false") {
    return false
  }

  return fallback
}

function normalizeLimit(value: unknown) {
  const numeric = typeof value === "string" ? Number(value) : null

  if (!Number.isFinite(numeric)) {
    return 20
  }

  return Math.max(1, Math.min(100, Math.trunc(numeric as number)))
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {}
}

function safeDiagnosticValue(value: unknown): string | number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  return safeString(value)
}

function safeString(value: unknown): string | null {
  if (typeof value !== "string") {
    return value == null ? null : String(value).slice(0, 240)
  }

  const trimmed = value.trim()
  return trimmed.length ? sanitizeText(trimmed).slice(0, 240) : null
}

function safeNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function sanitizeText(value: string) {
  return value
    .replace(/Bearer\s+[^\s"']+/gi, "Bearer ***")
    .replace(/(authorization\s*[:=]\s*)[^\s"']+/gi, "$1***")
    .replace(/(token\s*[:=]\s*)[^\s"']+/gi, "$1***")
    .replace(/(ciphertext\s*[:=]\s*)[^\s"']+/gi, "$1***")
}
