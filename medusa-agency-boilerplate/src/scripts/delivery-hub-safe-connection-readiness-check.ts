import type { ExecArgs } from "@medusajs/framework/types"
import {
  createDeliveryHubService,
  getDeliveryHubPgConnection,
} from "../modules/delivery-hub"
import type { DeliveryConnectionRecord } from "../modules/delivery-hub/domain/connection"
import {
  getDeliveryConnectionByIdReadOnly,
  listDeliveryConnectionsReadOnly,
} from "../modules/delivery-hub/storage/connections-repository"

const TARGET_PROVIDER_CODE = "yandex"

type SafeConnectionSummary = {
  id: string
  provider_code: string
  mode: string
  enabled: boolean
  status: string
  credentials_state: string
  credentials_present: boolean
  credentials_last_error_code: string | null
  default_warehouse_id: string | null
}

type SafeRevalidationSummary = {
  attempted: boolean
  ok: boolean | null
  code: string | null
  status: number | null
  message: string | null
  provider_status: string | number | null
  error_category: string | null
  operator_hint: string | null
  correlation_id: string | null
}

export default async function deliveryHubSafeConnectionReadinessCheck({ args, container }: ExecArgs) {
  const options = parseArgs(args ?? [])
  const pg = getDeliveryHubPgConnection(container)
  const service = createDeliveryHubService(pg)

  const connections = (await listDeliveryConnectionsReadOnly(pg)).filter(
    (connection) => connection.provider_code === TARGET_PROVIDER_CODE
  )
  const selected = options.connection_id
    ? await getDeliveryConnectionByIdReadOnly(pg, options.connection_id)
    : connections[0] ?? null

  const before = selected ? toSafeConnectionSummary(selected) : null
  let revalidation: SafeRevalidationSummary = {
    attempted: false,
    ok: null,
    code: null,
    status: null,
    message: null,
    provider_status: null,
    error_category: null,
    operator_hint: null,
    correlation_id: null,
  }

  if (options.revalidate && selected) {
    try {
      const result = await service.testConnection(selected.id, { include_pickup_points: false })
      revalidation = {
        attempted: true,
        ok: result.ok === true,
        code: null,
        status: null,
        message: null,
        provider_status: safeDiagnosticValue(result.diagnostics_summary?.provider_status ?? asRecord(result.diagnostics).provider_status),
        error_category: safeString(result.diagnostics_summary?.error_category),
        operator_hint: null,
        correlation_id: safeString(result.diagnostics_summary?.correlation_id ?? asRecord(result.diagnostics).correlation_id),
      }
    } catch (error) {
      const details = asRecord((error as { details?: unknown }).details)
      const diagnosticsSummary = asRecord(details.diagnostics_summary)
      revalidation = {
        attempted: true,
        ok: false,
        code: safeString((error as { code?: unknown }).code),
        status: typeof (error as { status?: unknown }).status === "number" ? (error as { status: number }).status : null,
        message: safeString((error as { message?: unknown }).message),
        provider_status: safeDiagnosticValue(details.provider_status ?? diagnosticsSummary.provider_status),
        error_category: safeString(details.error_category ?? diagnosticsSummary.error_category),
        operator_hint: safeString(details.operator_hint),
        correlation_id: safeString(details.correlation_id ?? diagnosticsSummary.correlation_id),
      }
    }
  }

  const refreshed = selected ? await getDeliveryConnectionByIdReadOnly(pg, selected.id) : null
  const after = refreshed ? toSafeConnectionSummary(refreshed) : null

  console.log(JSON.stringify({
    ok: true,
    safety: {
      safe_summary_only: true,
      credential_values_printed: false,
      ciphertext_printed: false,
      request_headers_printed: false,
      raw_provider_body_printed: false,
    },
    connection_count: connections.length,
    yandex_connection_ids: connections.map((connection) => connection.id),
    selected_connection_id: selected?.id ?? null,
    before,
    revalidation,
    after,
    ready_connection_ids: connections
      .filter((connection) =>
        connection.enabled &&
        connection.status === "active" &&
        connection.credentials_state === "sealed"
      )
      .map((connection) => connection.id),
  }, null, 2))
}

function toSafeConnectionSummary(connection: DeliveryConnectionRecord): SafeConnectionSummary {
  return {
    id: connection.id,
    provider_code: connection.provider_code,
    mode: connection.mode,
    enabled: connection.enabled,
    status: connection.status,
    credentials_state: connection.credentials_state,
    credentials_present: !!connection.credentials_envelope,
    credentials_last_error_code: connection.credentials_last_error_code,
    default_warehouse_id: safeString(connection.config?.default_warehouse_id),
  }
}

function parseArgs(args: string[]) {
  const map = new Map<string, string>()

  for (const arg of args) {
    if (!arg.startsWith("--")) {
      continue
    }

    const [key, ...valueParts] = arg.slice(2).split("=")
    map.set(key, valueParts.length ? valueParts.join("=") : "true")
  }

  return {
    connection_id: safeString(map.get("connection-id") ?? process.env.DELIVERY_HUB_SAFE_CHECK_CONNECTION_ID),
    revalidate: (map.get("revalidate") ?? process.env.DELIVERY_HUB_SAFE_CHECK_REVALIDATE) === "true",
  }
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
  return trimmed.length ? trimmed.slice(0, 240) : null
}
