import { stdin as input } from "node:process"
import type { ExecArgs } from "@medusajs/framework/types"
import {
  DELIVERY_HUB_CONNECTION_STATUS,
  DELIVERY_HUB_CREDENTIALS_STATE,
  DELIVERY_HUB_PROVIDER_YANDEX,
  createDeliveryHubService,
  getDeliveryHubPgConnection,
} from "../modules/delivery-hub"
import type { DeliveryConnectionRecord } from "../modules/delivery-hub/domain/connection"
import {
  getDeliveryConnectionByIdReadOnly,
  listDeliveryConnectionsReadOnly,
} from "../modules/delivery-hub/storage/connections-repository"

const TOKEN_STDIN_SENTINEL = "__stdin__"

type SafeConnectionSummary = {
  id: string
  provider_code: string
  mode: string
  enabled: boolean
  status: string
  credentials_state: string
  credentials_present: boolean
  credentials_fingerprint_present: boolean
  credentials_last_validated_at: string | null
  credentials_last_error_code: string | null
  default_warehouse_id: string | null
}

type ApplyArgs = {
  connection_id: string | null
  token_source: "stdin" | "env" | "missing"
  token: string | null
  revalidate: boolean
  include_pickup_points: boolean
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

export default async function deliveryHubYandexCredentialsApply({ args, container }: ExecArgs) {
  const parsed = await parseArgs(args ?? [], process.env)
  const pg = getDeliveryHubPgConnection(container)
  const service = createDeliveryHubService(pg)
  const connections = (await listDeliveryConnectionsReadOnly(pg)).filter(
    (connection) => connection.provider_code === DELIVERY_HUB_PROVIDER_YANDEX
  )
  const selected = parsed.connection_id
    ? await getDeliveryConnectionByIdReadOnly(pg, parsed.connection_id)
    : pickYandexConnection(connections)
  const before = selected ? toSafeConnectionSummary(selected) : null

  if (!selected) {
    console.log(JSON.stringify({
      ok: false,
      status: "blocked_connection_not_found",
      safety: buildSafetySummary(),
      token_input: buildTokenInputSummary(parsed),
      connection_count: connections.length,
      yandex_connection_ids: connections.map((connection) => connection.id),
      selected_connection_id: parsed.connection_id,
      before,
      applied: false,
      revalidation: buildEmptyRevalidation(),
      after: null,
      ready_connection_ids: listReadyConnectionIds(connections),
      error: {
        code: "connection_not_found",
        message: parsed.connection_id
          ? "Requested Yandex Delivery connection was not found."
          : "No Yandex Delivery connection was found to update.",
      },
    }, null, 2))
    process.exitCode = 2
    return
  }

  if (!parsed.token) {
    console.log(JSON.stringify({
      ok: false,
      status: "blocked_missing_token",
      safety: buildSafetySummary(),
      token_input: buildTokenInputSummary(parsed),
      connection_count: connections.length,
      yandex_connection_ids: connections.map((connection) => connection.id),
      selected_connection_id: selected.id,
      before,
      applied: false,
      revalidation: buildEmptyRevalidation(),
      after: before,
      ready_connection_ids: listReadyConnectionIds(connections),
      error: {
        code: "missing_token",
        message: "A token must be provided through stdin or DELIVERY_HUB_YANDEX_TOKEN.",
      },
    }, null, 2))
    process.exitCode = 2
    return
  }

  let applied = false
  let applyError: { code: string | null; status: number | null; message: string | null } | null = null

  try {
    await service.updateConnection(selected.id, {
      provider_code: selected.provider_code,
      name: selected.name,
      mode: selected.mode,
      enabled: true,
      country_code: selected.country_code,
      status: DELIVERY_HUB_CONNECTION_STATUS.draft,
      credentials: {
        token: parsed.token,
      },
      config: selected.config,
      metadata: selected.metadata,
    })
    applied = true
  } catch (error) {
    applyError = {
      code: safeString((error as { code?: unknown }).code),
      status: typeof (error as { status?: unknown }).status === "number"
        ? (error as { status: number }).status
        : null,
      message: safeString((error as { message?: unknown }).message),
    }
  }

  let revalidation = buildEmptyRevalidation()
  let refreshed = await getDeliveryConnectionByIdReadOnly(pg, selected.id)

  if (applied && parsed.revalidate) {
    revalidation = await revalidateConnection(service, selected.id, parsed.include_pickup_points)
    refreshed = await getDeliveryConnectionByIdReadOnly(pg, selected.id)
  }

  const allAfterConnections = (await listDeliveryConnectionsReadOnly(pg)).filter(
    (connection) => connection.provider_code === DELIVERY_HUB_PROVIDER_YANDEX
  )
  const after = refreshed ? toSafeConnectionSummary(refreshed) : null
  const ok = applied && (!parsed.revalidate || revalidation.ok === true)

  console.log(JSON.stringify({
    ok,
    status: ok
      ? "credentials_applied_and_ready"
      : applied
        ? "credentials_applied_but_revalidation_failed"
        : "credentials_apply_failed",
    safety: buildSafetySummary(),
    token_input: buildTokenInputSummary(parsed),
    connection_count: connections.length,
    yandex_connection_ids: connections.map((connection) => connection.id),
    selected_connection_id: selected.id,
    before,
    applied,
    apply_error: applyError,
    revalidation,
    after,
    ready_connection_ids: listReadyConnectionIds(allAfterConnections),
  }, null, 2))

  process.exitCode = ok ? 0 : 1
}

function pickYandexConnection(connections: DeliveryConnectionRecord[]) {
  return connections.find((connection) =>
    connection.enabled &&
    connection.credentials_state === DELIVERY_HUB_CREDENTIALS_STATE.invalid
  ) ?? connections.find((connection) => connection.enabled) ?? connections[0] ?? null
}

async function revalidateConnection(
  service: ReturnType<typeof createDeliveryHubService>,
  connectionId: string,
  includePickupPoints: boolean
): Promise<SafeRevalidationSummary> {
  try {
    const result = await service.testConnection(connectionId, { include_pickup_points: includePickupPoints })
    const diagnostics = asRecord(result.diagnostics)
    return {
      attempted: true,
      ok: result.ok === true,
      code: null,
      status: null,
      message: null,
      provider_status: safeDiagnosticValue(result.diagnostics_summary?.provider_status ?? diagnostics.provider_status),
      error_category: safeString(result.diagnostics_summary?.error_category),
      operator_hint: null,
      correlation_id: safeString(result.diagnostics_summary?.correlation_id ?? diagnostics.correlation_id),
    }
  } catch (error) {
    const details = asRecord((error as { details?: unknown }).details)
    const diagnosticsSummary = asRecord(details.diagnostics_summary)
    return {
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

async function parseArgs(args: string[], env: NodeJS.ProcessEnv): Promise<ApplyArgs> {
  const map = new Map<string, string>()

  for (const arg of args) {
    if (!arg.startsWith("--")) {
      continue
    }

    const [key, ...valueParts] = arg.slice(2).split("=")
    map.set(key, valueParts.length ? valueParts.join("=") : "true")
  }

  const rawToken = map.get("token") ?? env.DELIVERY_HUB_YANDEX_TOKEN ?? null
  const tokenFromStdin = rawToken === TOKEN_STDIN_SENTINEL
    ? await readStdinToken()
    : null
  const token = safeString(tokenFromStdin ?? rawToken)

  return {
    connection_id: safeString(map.get("connection-id") ?? env.DELIVERY_HUB_YANDEX_CONNECTION_ID),
    token_source: rawToken === TOKEN_STDIN_SENTINEL ? "stdin" : token ? "env" : "missing",
    token,
    revalidate: readBoolean(map.get("revalidate") ?? env.DELIVERY_HUB_YANDEX_APPLY_REVALIDATE, true),
    include_pickup_points: readBoolean(
      map.get("include-pickup-points") ?? env.DELIVERY_HUB_YANDEX_APPLY_INCLUDE_PICKUP_POINTS,
      false
    ),
  }
}

async function readStdinToken() {
  const chunks: Buffer[] = []
  for await (const chunk of input) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  return Buffer.concat(chunks).toString("utf8")
}

function buildTokenInputSummary(parsed: ApplyArgs) {
  return {
    source: parsed.token_source,
    token_provided: Boolean(parsed.token),
    token_value_printed: false,
    token_length_printed: false,
    token_fingerprint_printed: false,
  }
}

function buildSafetySummary() {
  return {
    safe_summary_only: true,
    credential_values_printed: false,
    credential_lengths_printed: false,
    credential_fingerprints_printed: false,
    ciphertext_printed: false,
    request_headers_printed: false,
    raw_provider_body_printed: false,
  }
}

function buildEmptyRevalidation(): SafeRevalidationSummary {
  return {
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
}

function listReadyConnectionIds(connections: DeliveryConnectionRecord[]) {
  return connections
    .filter((connection) =>
      connection.enabled &&
      connection.status === DELIVERY_HUB_CONNECTION_STATUS.active &&
      connection.credentials_state === DELIVERY_HUB_CREDENTIALS_STATE.sealed
    )
    .map((connection) => connection.id)
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
    credentials_fingerprint_present: !!connection.credentials_fingerprint,
    credentials_last_validated_at: connection.credentials_last_validated_at,
    credentials_last_error_code: connection.credentials_last_error_code,
    default_warehouse_id: safeString(connection.config?.default_warehouse_id),
  }
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {}
}

function readBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined) {
    return fallback
  }

  return value === "true"
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
