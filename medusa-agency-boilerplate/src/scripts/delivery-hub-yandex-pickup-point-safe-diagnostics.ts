import type { ExecArgs } from "@medusajs/framework/types"
import { createDeliveryHubService, getDeliveryHubPgConnection } from "../modules/delivery-hub"

const DEFAULT_LIMIT = 10

type Args = {
  connection_id: string | null
  pickup_point_id: string | null
  country_code: string | null
  city: string | null
  geo_id: number | null
  candidate_limit: number
  find_candidate_if_not_available: boolean
}

type SafePointSummary = {
  id: string
  available_for_dropoff: boolean
  station_type: string | null
  operator_id_present: boolean
  network_label_present: boolean
  city_present: boolean
  is_yandex_branded: boolean | null
  is_market_partner: boolean | null
}

export default async function deliveryHubYandexPickupPointSafeDiagnostics({ args, container }: ExecArgs) {
  const parsed = parseArgs(args ?? [], process.env)
  const pg = getDeliveryHubPgConnection(container)
  const service = createDeliveryHubService(pg)
  const missingInputs = listMissingInputs(parsed)
  let target: {
    attempted: boolean
    ok: boolean | null
    status: "not_requested" | "found_available" | "found_not_available" | "not_found" | "failed"
    total_available: number | null
    returned_count: number | null
    point: SafePointSummary | null
    error: SafeErrorSummary | null
  } = {
    attempted: false,
    ok: null,
    status: "not_requested",
    total_available: null,
    returned_count: null,
    point: null,
    error: null,
  }
  let candidates: {
    attempted: boolean
    ok: boolean | null
    total_available: number | null
    returned_count: number | null
    points: SafePointSummary[]
    error: SafeErrorSummary | null
  } = {
    attempted: false,
    ok: null,
    total_available: null,
    returned_count: null,
    points: [],
    error: null,
  }

  if (missingInputs.length === 0) {
    target = await runTargetLookup(service, parsed as Args & { connection_id: string; pickup_point_id: string })
  }

  if (
    missingInputs.length === 0 &&
    parsed.find_candidate_if_not_available &&
    target.status !== "found_available"
  ) {
    candidates = await runCandidateLookup(service, parsed as Args & { connection_id: string })
  }

  console.log(JSON.stringify({
    ok: missingInputs.length === 0 && target.status === "found_available",
    generated_at: new Date().toISOString(),
    safety: {
      safe_summary_only: true,
      credential_values_printed: false,
      ciphertext_printed: false,
      request_headers_printed: false,
      raw_provider_body_printed: false,
      raw_provider_dto_printed: false,
      raw_quote_keys_printed: false,
      raw_offer_ids_printed: false,
      publishable_key_value_printed: false,
    },
    invocation: {
      connection_id: parsed.connection_id,
      pickup_point_id: parsed.pickup_point_id,
      pickup_point_id_present: !!parsed.pickup_point_id,
      country_code: parsed.country_code,
      city_present: !!parsed.city,
      geo_id: parsed.geo_id,
      candidate_limit: parsed.candidate_limit,
      find_candidate_if_not_available: parsed.find_candidate_if_not_available,
    },
    readiness: {
      missing_inputs: missingInputs,
    },
    target,
    candidates,
  }, null, 2))

  process.exitCode = missingInputs.length === 0 && target.status === "found_available" ? 0 : 2
}

async function runTargetLookup(
  service: ReturnType<typeof createDeliveryHubService>,
  input: Args & { connection_id: string; pickup_point_id: string }
) {
  try {
    const result = await service.listAdminPickupPoints({
      connection_id: input.connection_id,
      pickup_point_id: input.pickup_point_id,
      country_code: input.country_code,
      city: input.city,
      geo_id: input.geo_id,
      limit: 1,
    })
    const point = result.points[0] ? toSafePointSummary(result.points[0]) : null

    return {
      attempted: true,
      ok: point?.available_for_dropoff === true,
      status: point
        ? point.available_for_dropoff ? "found_available" as const : "found_not_available" as const
        : "not_found" as const,
      total_available: safeNumber(result.total_available),
      returned_count: safeNumber(result.returned_count),
      point,
      error: null,
    }
  } catch (error) {
    return {
      attempted: true,
      ok: false,
      status: "failed" as const,
      total_available: null,
      returned_count: null,
      point: null,
      error: toSafeErrorSummary(error),
    }
  }
}

async function runCandidateLookup(
  service: ReturnType<typeof createDeliveryHubService>,
  input: Args & { connection_id: string }
) {
  try {
    const result = await service.listAdminPickupPoints({
      connection_id: input.connection_id,
      country_code: input.country_code,
      city: input.city,
      geo_id: input.geo_id,
      available_for_dropoff: true,
      limit: input.candidate_limit,
    })

    return {
      attempted: true,
      ok: true,
      total_available: safeNumber(result.total_available),
      returned_count: safeNumber(result.returned_count),
      points: result.points.map(toSafePointSummary),
      error: null,
    }
  } catch (error) {
    return {
      attempted: true,
      ok: false,
      total_available: null,
      returned_count: null,
      points: [],
      error: toSafeErrorSummary(error),
    }
  }
}

function toSafePointSummary(point: {
  id: string
  available_for_dropoff: boolean
  station_type?: string | null
  operator_id?: string | null
  network_label?: string | null
  city?: string | null
  is_yandex_branded?: boolean | null
  is_market_partner?: boolean | null
}): SafePointSummary {
  return {
    id: safeString(point.id) ?? "",
    available_for_dropoff: point.available_for_dropoff === true,
    station_type: safeString(point.station_type),
    operator_id_present: !!safeString(point.operator_id),
    network_label_present: !!safeString(point.network_label),
    city_present: !!safeString(point.city),
    is_yandex_branded: typeof point.is_yandex_branded === "boolean" ? point.is_yandex_branded : null,
    is_market_partner: typeof point.is_market_partner === "boolean" ? point.is_market_partner : null,
  }
}

type SafeErrorSummary = {
  code: string | null
  status: number | null
  message: string | null
  provider_status: string | number | null
  error_category: string | null
  operator_hint: string | null
  correlation_id: string | null
}

function toSafeErrorSummary(error: unknown): SafeErrorSummary {
  const details = asRecord((error as { details?: unknown }).details)
  const diagnosticsSummary = asRecord(details.diagnostics_summary)

  return {
    code: safeString((error as { code?: unknown }).code),
    status: typeof (error as { status?: unknown }).status === "number" ? (error as { status: number }).status : null,
    message: safeString((error as { message?: unknown }).message),
    provider_status: safeDiagnosticValue(details.provider_status ?? diagnosticsSummary.provider_status),
    error_category: safeString(details.error_category ?? diagnosticsSummary.error_category),
    operator_hint: safeString(details.operator_hint),
    correlation_id: safeString(details.correlation_id ?? diagnosticsSummary.correlation_id),
  }
}

function listMissingInputs(input: Args) {
  const missing: string[] = []

  if (!input.connection_id) {
    missing.push("connection_id")
  }

  if (!input.pickup_point_id) {
    missing.push("pickup_point_id")
  }

  return missing
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

  return {
    connection_id: safeString(readArgOrEnv(map, env, "connection-id", "DELIVERY_HUB_PICKUP_POINT_DIAG_CONNECTION_ID")),
    pickup_point_id: safeString(readArgOrEnv(map, env, "pickup-point-id", "DELIVERY_HUB_PICKUP_POINT_DIAG_PICKUP_POINT_ID")),
    country_code: safeString(readArgOrEnv(map, env, "country-code", "DELIVERY_HUB_PICKUP_POINT_DIAG_COUNTRY_CODE")) ?? "RU",
    city: safeString(readArgOrEnv(map, env, "city", "DELIVERY_HUB_PICKUP_POINT_DIAG_CITY")),
    geo_id: safeInteger(readArgOrEnv(map, env, "geo-id", "DELIVERY_HUB_PICKUP_POINT_DIAG_GEO_ID")),
    candidate_limit: normalizeLimit(readArgOrEnv(map, env, "candidate-limit", "DELIVERY_HUB_PICKUP_POINT_DIAG_CANDIDATE_LIMIT")),
    find_candidate_if_not_available: readBoolean(
      readArgOrEnv(map, env, "find-candidate-if-not-available", "DELIVERY_HUB_PICKUP_POINT_DIAG_FIND_CANDIDATE_IF_NOT_AVAILABLE"),
      true
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
    return DEFAULT_LIMIT
  }

  return Math.max(1, Math.min(50, Math.trunc(numeric as number)))
}

function safeInteger(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return null
  }

  const numeric = Number(value)

  return Number.isInteger(numeric) ? numeric : null
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

function safeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null
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
