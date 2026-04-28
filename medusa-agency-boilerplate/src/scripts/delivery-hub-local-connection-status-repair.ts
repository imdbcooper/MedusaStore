import type { ExecArgs } from "@medusajs/framework/types"
import {
  DELIVERY_HUB_CONNECTION_STATUS,
  DELIVERY_HUB_CREDENTIALS_STATE,
  DELIVERY_HUB_PROVIDER_YANDEX,
} from "../modules/delivery-hub/constants"
import { getDeliveryHubPgConnection } from "../modules/delivery-hub/storage/pg"
import {
  getDeliveryConnectionByIdReadOnly,
  listDeliveryConnectionsReadOnly,
  upsertDeliveryConnection,
} from "../modules/delivery-hub/storage/connections-repository"
import { listDeliveryEventLogsReadOnly } from "../modules/delivery-hub/storage/event-log-repository"
import type { DeliveryConnectionRecord } from "../modules/delivery-hub/domain/connection"

const DEFAULT_RECENT_LOG_LIMIT = 20
const DEFAULT_SUCCESS_MAX_AGE_MINUTES = 120
const DEFAULT_REPAIR_REASON = "manual_local_status_repair_after_safe_success_evidence"

type RepairArgs = {
  connection_id: string | null
  apply: boolean
  success_max_age_minutes: number
  recent_log_limit: number
}

type SafeConnectionSummary = {
  id: string
  provider_code: string
  mode: string
  enabled: boolean
  status: string
  credentials_state: string
  credentials_present: boolean
  credentials_last_validated_at: string | null
  credentials_last_error_code: string | null
  default_warehouse_id: string | null
}

type EvidenceSummary = {
  connection_id: string
  latest_success_at: string | null
  latest_failure_at: string | null
  latest_failure_error_code: string | null
  latest_failure_provider_status: string | number | null
  latest_failure_error_category: string | null
  success_after_failure: boolean
  recent_success_count: number
  recent_failure_count: number
  eligible_for_status_repair: boolean
  repair_blocker: string | null
}

export default async function deliveryHubLocalConnectionStatusRepair({ args, container }: ExecArgs) {
  const parsed = parseArgs(args ?? [], process.env)
  const pg = getDeliveryHubPgConnection(container)
  const connections = (await listDeliveryConnectionsReadOnly(pg)).filter(
    (connection) => connection.provider_code === DELIVERY_HUB_PROVIDER_YANDEX
  )
  const selected = parsed.connection_id
    ? await getDeliveryConnectionByIdReadOnly(pg, parsed.connection_id)
    : connections.find((connection) =>
      connection.enabled &&
      !!connection.credentials_envelope &&
      connection.status === DELIVERY_HUB_CONNECTION_STATUS.error &&
      connection.credentials_state === DELIVERY_HUB_CREDENTIALS_STATE.invalid
    ) ?? connections[0] ?? null
  const before = selected ? toSafeConnectionSummary(selected) : null
  const evidence = selected
    ? await buildEvidenceSummary(pg, selected, parsed)
    : null
  const applied = parsed.apply && !!selected && !!evidence?.eligible_for_status_repair
  const repaired = applied
    ? await upsertDeliveryConnection(pg, {
        id: selected.id,
        provider_code: selected.provider_code,
        name: selected.name,
        status: DELIVERY_HUB_CONNECTION_STATUS.active,
        mode: selected.mode,
        enabled: selected.enabled,
        country_code: selected.country_code,
        config: {
          ...selected.config,
          local_status_repair: {
            reason: DEFAULT_REPAIR_REASON,
            repaired_at: new Date().toISOString(),
            latest_success_at: evidence.latest_success_at,
            latest_failure_at: evidence.latest_failure_at,
            safe_summary_only: true,
          },
        },
        metadata: selected.metadata,
        credentials_envelope: selected.credentials_envelope,
        credentials_state: DELIVERY_HUB_CREDENTIALS_STATE.sealed,
        credentials_fingerprint: selected.credentials_fingerprint,
        credentials_last_validated_at: evidence.latest_success_at ?? new Date().toISOString(),
        credentials_last_error_code: null,
      })
    : null
  const after = selected
    ? toSafeConnectionSummary(
        repaired ?? (await getDeliveryConnectionByIdReadOnly(pg, selected.id)) ?? selected
      )
    : null

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
      connection_id: selected?.id ?? parsed.connection_id,
      apply: parsed.apply,
      success_max_age_minutes: parsed.success_max_age_minutes,
      recent_log_limit: parsed.recent_log_limit,
    },
    before,
    evidence,
    repair: {
      attempted: parsed.apply,
      applied,
      reason: applied ? DEFAULT_REPAIR_REASON : evidence?.repair_blocker ?? "not_applied",
    },
    after,
  }, null, 2))
}

async function buildEvidenceSummary(
  pg: ReturnType<typeof getDeliveryHubPgConnection>,
  connection: DeliveryConnectionRecord,
  args: RepairArgs
): Promise<EvidenceSummary> {
  const logs = await listDeliveryEventLogsReadOnly(pg, {
    connection_id: connection.id,
    provider_code: DELIVERY_HUB_PROVIDER_YANDEX,
    limit: args.recent_log_limit,
  })
  const quoteLogs = logs.filter((log) => log.kind === "quote")
  const successes = quoteLogs.filter((log) => log.success)
  const failures = quoteLogs.filter((log) => !log.success)
  const latestSuccess = successes[0] ?? null
  const latestFailure = failures[0] ?? null
  const latestFailureResponse = asRecord(latestFailure?.response_summary)
  const latestFailureDetails = asRecord(latestFailureResponse.details)
  const latestFailureDiagnostics = asRecord(latestFailureResponse.diagnostics_summary)
  const latestSuccessAtMs = latestSuccess ? Date.parse(latestSuccess.created_at) : NaN
  const latestFailureAtMs = latestFailure ? Date.parse(latestFailure.created_at) : NaN
  const maxAgeMs = args.success_max_age_minutes * 60 * 1000
  const successFreshEnough = Number.isFinite(latestSuccessAtMs) && Date.now() - latestSuccessAtMs <= maxAgeMs
  const successAfterFailure = Number.isFinite(latestSuccessAtMs) &&
    (!Number.isFinite(latestFailureAtMs) || latestSuccessAtMs > latestFailureAtMs)

  const baseEligible = connection.enabled &&
    !!connection.credentials_envelope &&
    latestSuccess?.success === true &&
    successFreshEnough &&
    successAfterFailure
  const repairBlocker = !connection.enabled
    ? "connection_disabled"
    : !connection.credentials_envelope
      ? "credentials_absent"
      : !latestSuccess
        ? "no_recent_quote_success_evidence"
        : !successFreshEnough
          ? "quote_success_evidence_too_old"
          : !successAfterFailure
            ? "newer_provider_failure_after_success"
            : null

  return {
    connection_id: connection.id,
    latest_success_at: latestSuccess?.created_at ?? null,
    latest_failure_at: latestFailure?.created_at ?? null,
    latest_failure_error_code: latestFailure?.error_code ?? null,
    latest_failure_provider_status: safeDiagnosticValue(latestFailureDetails.provider_status ?? latestFailureDiagnostics.provider_status),
    latest_failure_error_category: safeString(latestFailureDetails.error_category ?? latestFailureDiagnostics.error_category),
    success_after_failure: successAfterFailure,
    recent_success_count: successes.length,
    recent_failure_count: failures.length,
    eligible_for_status_repair: baseEligible,
    repair_blocker: repairBlocker,
  }
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
    credentials_last_validated_at: connection.credentials_last_validated_at,
    credentials_last_error_code: connection.credentials_last_error_code,
    default_warehouse_id: safeString(connection.config?.default_warehouse_id),
  }
}

function parseArgs(rawArgs: string[], env: NodeJS.ProcessEnv): RepairArgs {
  const map = new Map<string, string>()

  for (const arg of rawArgs) {
    if (!arg.startsWith("--")) {
      continue
    }

    const [key, ...valueParts] = arg.slice(2).split("=")
    map.set(key, valueParts.length ? valueParts.join("=") : "true")
  }

  return {
    connection_id: safeString(map.get("connection-id") ?? env.DELIVERY_HUB_LOCAL_STATUS_REPAIR_CONNECTION_ID),
    apply: readBoolean(map.get("apply") ?? env.DELIVERY_HUB_LOCAL_STATUS_REPAIR_APPLY, false),
    success_max_age_minutes: normalizePositiveInteger(
      map.get("success-max-age-minutes") ?? env.DELIVERY_HUB_LOCAL_STATUS_REPAIR_SUCCESS_MAX_AGE_MINUTES,
      DEFAULT_SUCCESS_MAX_AGE_MINUTES
    ),
    recent_log_limit: Math.min(100, normalizePositiveInteger(
      map.get("recent-log-limit") ?? env.DELIVERY_HUB_LOCAL_STATUS_REPAIR_RECENT_LOG_LIMIT,
      DEFAULT_RECENT_LOG_LIMIT
    )),
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

function normalizePositiveInteger(value: unknown, fallback: number) {
  const numeric = typeof value === "string" ? Number(value) : NaN

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return fallback
  }

  return Math.trunc(numeric)
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

function sanitizeText(value: string) {
  return value
    .replace(/Bearer\s+[^\s"']+/gi, "Bearer ***")
    .replace(/(authorization\s*[:=]\s*)[^\s"']+/gi, "$1***")
    .replace(/(token\s*[:=]\s*)[^\s"']+/gi, "$1***")
    .replace(/(ciphertext\s*[:=]\s*)[^\s"']+/gi, "$1***")
}
