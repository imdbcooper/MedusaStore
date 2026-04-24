import crypto from "node:crypto"
import type { ExecArgs } from "@medusajs/framework/types"
import {
  DELIVERY_HUB_PROVIDER_YANDEX,
  DELIVERY_HUB_MODE_CODE,
} from "../modules/delivery-hub/constants"
import { getDeliveryHubPgConnection } from "../modules/delivery-hub/storage/pg"
import {
  getDeliveryConnectionByIdReadOnly,
  listDeliveryConnectionsReadOnly,
} from "../modules/delivery-hub/storage/connections-repository"
import {
  buildDeliveryHubProviderContractEvidenceSummary,
  maskDeliveryHubProviderContractReference,
} from "../modules/delivery-hub/provider-contract-validation-evidence"
import {
  createDeliveryHubProviderExecutionReference,
  createDeliveryHubQuoteReference,
  type DeliveryHubProviderOriginDispatchContext,
} from "../modules/delivery-hub/cart-selection"
import {
  buildYandexCreateShipmentDispatchRequest,
  executeYandexCreateShipmentDispatch,
} from "../modules/delivery-hub/adapters/yandex/create-shipment-dispatch-port"
import {
  buildYandexShipmentStatusRequest,
  executeYandexShipmentStatusRefresh,
} from "../modules/delivery-hub/adapters/yandex/shipment-status"
import {
  buildYandexShipmentCancelRequest,
  executeYandexShipmentCancel,
} from "../modules/delivery-hub/adapters/yandex/shipment-cancel"

const DELIVERY_HUB_PROVIDER_CONTRACT_VALIDATION_HARNESS_VERSION = 1
const DELIVERY_HUB_PROVIDER_CONTRACT_VALIDATION_OPT_IN_ENV =
  "DELIVERY_HUB_YANDEX_PROVIDER_CONTRACT_VALIDATION_LIVE_ENABLED"
const DELIVERY_HUB_PROVIDER_CONTRACT_VALIDATION_ALLOWED_CONFIRM_VALUE = "I_UNDERSTAND_LIVE_PROVIDER_CALLS"

const DELIVERY_HUB_PROVIDER_CONTRACT_VALIDATION_DEFAULT_MODE = "plan"

const SUPPORTED_OPERATIONS = [
  "create_shipment",
  "refresh_status",
  "cancel_shipment",
  "repeated_cancel",
  "missing_provider_shipment_reference",
  "invalid_provider_shipment_reference",
  "sanitized_provider_failure",
  "duplicate_prevention_posture",
] as const

type DeliveryHubProviderContractValidationOperation = (typeof SUPPORTED_OPERATIONS)[number]

type DeliveryHubProviderContractValidationMode = "plan" | "live"

type DeliveryHubProviderContractValidationArgs = {
  mode: DeliveryHubProviderContractValidationMode
  operation: DeliveryHubProviderContractValidationOperation
  connection_id: string | null
  provider_shipment_reference: string | null
  dry_run: boolean
  force_provider_failure: boolean
  skip_db_lookup: boolean
  live_confirm: string | null
}

type DeliveryHubProviderContractValidationGate = {
  status:
    | "allowed"
    | "blocked_default_dry_run"
    | "blocked_live_opt_in_required"
    | "blocked_live_confirm_required"
    | "blocked_missing_connection"
    | "blocked_connection_not_found"
    | "blocked_connection_not_ready"
    | "blocked_provider_not_supported"
    | "blocked_encryption_key_required"
  reason_code: string | null
  reason: string | null
}

type DeliveryHubProviderContractValidationConnectionSnapshot = {
  id: string
  provider_code: string
  status: string
  mode: string
  enabled: boolean
  credentials_state: string
  country_code: string
}

type DeliveryHubProviderContractValidationOutput = {
  version: typeof DELIVERY_HUB_PROVIDER_CONTRACT_VALIDATION_HARNESS_VERSION
  generated_at: string
  harness: {
    kind: "delivery_hub_yandex_provider_contract_validation"
    manual_only: true
    default_mode: "plan"
    live_opt_in_env: typeof DELIVERY_HUB_PROVIDER_CONTRACT_VALIDATION_OPT_IN_ENV
    live_confirm_required_value: typeof DELIVERY_HUB_PROVIDER_CONTRACT_VALIDATION_ALLOWED_CONFIRM_VALUE
  }
  invocation: {
    mode: DeliveryHubProviderContractValidationMode
    operation: DeliveryHubProviderContractValidationOperation
    dry_run: boolean
    live_call_attempted: boolean
    live_call_performed: boolean
    force_provider_failure: boolean
    skip_db_lookup: boolean
  }
  connection: {
    provided_connection_id_masked: string | null
    resolved_connection_id_masked: string | null
    resolved: boolean
    snapshot: DeliveryHubProviderContractValidationConnectionSnapshot | null
  }
  gate: DeliveryHubProviderContractValidationGate
  evidence_bundle_rules: {
    redaction_required: true
    raw_credentials_forbidden: true
    raw_auth_headers_forbidden: true
    raw_request_response_payload_forbidden: true
    raw_quote_keys_forbidden: true
    raw_execution_secrets_forbidden: true
    raw_provider_shipment_ids_forbidden: true
  }
  evidence: {
    primary: ReturnType<typeof buildDeliveryHubProviderContractEvidenceSummary>
    additional: Array<ReturnType<typeof buildDeliveryHubProviderContractEvidenceSummary>>
  }
}

export default async function deliveryHubYandexProviderContractValidation(
  input: ExecArgs
): Promise<void> {
  const args = parseArgs(input.args)
  const pg = getDeliveryHubPgConnection(input.container)
  const generatedAt = new Date().toISOString()
  const liveEnvEnabled = parseBooleanEnv(process.env[DELIVERY_HUB_PROVIDER_CONTRACT_VALIDATION_OPT_IN_ENV])

  const resolvedConnection = await resolveConnection({
    pg,
    connection_id: args.connection_id,
    skip_db_lookup: args.skip_db_lookup,
  })

  const gate = resolveGate({
    mode: args.mode,
    dry_run: args.dry_run,
    live_env_enabled: liveEnvEnabled,
    live_confirm: args.live_confirm,
    connection: resolvedConnection,
    operation: args.operation,
  })

  const liveCallAttempted = args.mode === "live" && !args.dry_run
  const liveCallPerformed = false

  const primaryEvidence = buildDeliveryHubProviderContractEvidenceSummary({
    generated_at: generatedAt,
    mode: gate.status === "allowed" && args.mode === "live" && !args.dry_run ? "live" : "plan",
    operation: args.operation,
    status: gate.status === "allowed" ? "prepared" : "blocked",
    live_call_attempted: liveCallAttempted,
    live_call_performed: false,
    gate: {
      status: gate.status,
      reason_code: gate.reason_code,
      reason: gate.reason,
    },
    context: {
      mode: args.mode,
      dry_run: args.dry_run,
      force_provider_failure: args.force_provider_failure,
      connection_id: resolvedConnection.connection?.id ?? args.connection_id,
      provider_shipment_reference: args.provider_shipment_reference,
    },
    result: gate.status === "allowed"
      ? await buildOperationPreparedResult({
          args,
          connection: resolvedConnection.connection,
        })
      : {
          decision: "blocked_by_gate",
        },
  })

  const additionalEvidence =
    gate.status === "allowed"
      ? await buildAdditionalEvidence({
          args,
          connection: resolvedConnection.connection,
        })
      : []

  const output: DeliveryHubProviderContractValidationOutput = {
    version: DELIVERY_HUB_PROVIDER_CONTRACT_VALIDATION_HARNESS_VERSION,
    generated_at: generatedAt,
    harness: {
      kind: "delivery_hub_yandex_provider_contract_validation",
      manual_only: true,
      default_mode: DELIVERY_HUB_PROVIDER_CONTRACT_VALIDATION_DEFAULT_MODE,
      live_opt_in_env: DELIVERY_HUB_PROVIDER_CONTRACT_VALIDATION_OPT_IN_ENV,
      live_confirm_required_value: DELIVERY_HUB_PROVIDER_CONTRACT_VALIDATION_ALLOWED_CONFIRM_VALUE,
    },
    invocation: {
      mode: args.mode,
      operation: args.operation,
      dry_run: args.dry_run,
      live_call_attempted: liveCallAttempted,
      live_call_performed: liveCallPerformed,
      force_provider_failure: args.force_provider_failure,
      skip_db_lookup: args.skip_db_lookup,
    },
    connection: {
      provided_connection_id_masked: maskDeliveryHubProviderContractReference(args.connection_id),
      resolved_connection_id_masked: maskDeliveryHubProviderContractReference(
        resolvedConnection.connection?.id ?? null
      ),
      resolved: !!resolvedConnection.connection,
      snapshot: resolvedConnection.connection
        ? {
            id: resolvedConnection.connection.id,
            provider_code: resolvedConnection.connection.provider_code,
            status: resolvedConnection.connection.status,
            mode: resolvedConnection.connection.mode,
            enabled: !!resolvedConnection.connection.enabled,
            credentials_state: resolvedConnection.connection.credentials_state,
            country_code: resolvedConnection.connection.country_code,
          }
        : null,
    },
    gate,
    evidence_bundle_rules: {
      redaction_required: true,
      raw_credentials_forbidden: true,
      raw_auth_headers_forbidden: true,
      raw_request_response_payload_forbidden: true,
      raw_quote_keys_forbidden: true,
      raw_execution_secrets_forbidden: true,
      raw_provider_shipment_ids_forbidden: true,
    },
    evidence: {
      primary: primaryEvidence,
      additional: additionalEvidence,
    },
  }

  console.log(JSON.stringify(output, null, 2))
}

function parseArgs(raw: string[] | undefined): DeliveryHubProviderContractValidationArgs {
  const args = raw ?? []
  const map = new Map<string, string>()

  for (const arg of args) {
    if (!arg.startsWith("--")) {
      continue
    }

    const eqIndex = arg.indexOf("=")
    if (eqIndex === -1) {
      map.set(arg.slice(2), "true")
      continue
    }

    const key = arg.slice(2, eqIndex)
    const value = arg.slice(eqIndex + 1)
    map.set(key, value)
  }

  const operation = normalizeOperation(map.get("operation"))
  const mode = normalizeMode(map.get("mode"))
  const dryRun = normalizeBooleanArg(map.get("dry-run"), mode !== "live")

  return {
    mode,
    operation,
    connection_id: normalizeNullableText(map.get("connection-id")),
    provider_shipment_reference: normalizeNullableText(map.get("provider-shipment-reference")),
    dry_run: dryRun,
    force_provider_failure: normalizeBooleanArg(map.get("force-provider-failure"), false),
    skip_db_lookup: normalizeBooleanArg(map.get("skip-db-lookup"), false),
    live_confirm: normalizeNullableText(map.get("live-confirm")),
  }
}

function normalizeOperation(value: string | undefined): DeliveryHubProviderContractValidationOperation {
  const normalized = normalizeNullableText(value)

  if (normalized && SUPPORTED_OPERATIONS.includes(normalized as DeliveryHubProviderContractValidationOperation)) {
    return normalized as DeliveryHubProviderContractValidationOperation
  }

  return "create_shipment"
}

function normalizeMode(value: string | undefined): DeliveryHubProviderContractValidationMode {
  return value === "live" ? "live" : "plan"
}

function normalizeBooleanArg(value: string | undefined, fallback: boolean) {
  if (typeof value !== "string") {
    return fallback
  }

  const normalized = value.trim().toLowerCase()

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false
  }

  return fallback
}

function parseBooleanEnv(value: string | undefined) {
  if (!value) {
    return false
  }

  const normalized = value.trim().toLowerCase()
  return ["1", "true", "yes", "on"].includes(normalized)
}

async function resolveConnection(input: {
  pg: ReturnType<typeof getDeliveryHubPgConnection>
  connection_id: string | null
  skip_db_lookup: boolean
}): Promise<{ connection: DeliveryHubProviderContractValidationConnectionSnapshot | null; reason: string | null }> {
  if (input.skip_db_lookup) {
    return { connection: null, reason: "skip_db_lookup_enabled" }
  }

  const selected = input.connection_id
    ? await getDeliveryConnectionByIdReadOnly(input.pg, input.connection_id)
    : await pickSingleReadyYandexConnection(input.pg)

  if (!selected) {
    return { connection: null, reason: "connection_not_found" }
  }

  return {
    connection: {
      id: selected.id,
      provider_code: selected.provider_code,
      status: selected.status,
      mode: selected.mode,
      enabled: selected.enabled,
      credentials_state: selected.credentials_state,
      country_code: selected.country_code,
    },
    reason: null,
  }
}

async function pickSingleReadyYandexConnection(pg: ReturnType<typeof getDeliveryHubPgConnection>) {
  const list = await listDeliveryConnectionsReadOnly(pg)
  const ready = list.filter((entry) =>
    entry.provider_code === DELIVERY_HUB_PROVIDER_YANDEX &&
    entry.enabled &&
    entry.status === "active" &&
    entry.credentials_state === "sealed"
  )

  return ready.length === 1 ? ready[0] : null
}

function resolveGate(input: {
  mode: DeliveryHubProviderContractValidationMode
  dry_run: boolean
  live_env_enabled: boolean
  live_confirm: string | null
  connection: { connection: DeliveryHubProviderContractValidationConnectionSnapshot | null; reason: string | null }
  operation: DeliveryHubProviderContractValidationOperation
}): DeliveryHubProviderContractValidationGate {
  if (input.mode !== "live" || input.dry_run) {
    return {
      status: "blocked_default_dry_run",
      reason_code: "dry_run_default",
      reason:
        "Harness runs in safe plan/dry-run mode by default; no live provider call is allowed until explicit live mode and gate are enabled.",
    }
  }

  if (!input.live_env_enabled) {
    return {
      status: "blocked_live_opt_in_required",
      reason_code: "live_opt_in_env_required",
      reason: `${DELIVERY_HUB_PROVIDER_CONTRACT_VALIDATION_OPT_IN_ENV}=true is required before any live provider call.`,
    }
  }

  if (input.live_confirm !== DELIVERY_HUB_PROVIDER_CONTRACT_VALIDATION_ALLOWED_CONFIRM_VALUE) {
    return {
      status: "blocked_live_confirm_required",
      reason_code: "live_confirm_required",
      reason: `--live-confirm must equal ${DELIVERY_HUB_PROVIDER_CONTRACT_VALIDATION_ALLOWED_CONFIRM_VALUE}.`,
    }
  }

  if (!process.env.DELIVERY_HUB_ENCRYPTION_KEY?.trim()) {
    return {
      status: "blocked_encryption_key_required",
      reason_code: "encryption_key_required",
      reason: "DELIVERY_HUB_ENCRYPTION_KEY is required to decrypt sealed credentials for live validation.",
    }
  }

  if (!input.connection.connection) {
    return {
      status: input.connection.reason === "connection_not_found"
        ? "blocked_connection_not_found"
        : "blocked_missing_connection",
      reason_code: input.connection.reason,
      reason:
        "No eligible Yandex connection could be resolved. Provide --connection-id for an active, enabled, sealed Yandex connection.",
    }
  }

  if (input.connection.connection.provider_code !== DELIVERY_HUB_PROVIDER_YANDEX) {
    return {
      status: "blocked_provider_not_supported",
      reason_code: "provider_not_supported",
      reason: "Only Yandex provider contract validation is supported by this harness.",
    }
  }

  if (
    !input.connection.connection.enabled ||
    input.connection.connection.status !== "active" ||
    input.connection.connection.credentials_state !== "sealed"
  ) {
    return {
      status: "blocked_connection_not_ready",
      reason_code: "connection_not_ready",
      reason: "Resolved connection must be enabled + active + sealed before live validation.",
    }
  }

  if (input.operation !== "duplicate_prevention_posture") {
    return {
      status: "allowed",
      reason_code: null,
      reason: null,
    }
  }

  return {
    status: "allowed",
    reason_code: null,
    reason: null,
  }
}

async function buildOperationPreparedResult(input: {
  args: DeliveryHubProviderContractValidationArgs
  connection: DeliveryHubProviderContractValidationConnectionSnapshot | null
}): Promise<Record<string, unknown>> {
  if (!input.connection) {
    return {
      prepared: false,
      reason: "connection_unavailable",
    }
  }

  const mode = pickModeByOperation(input.args.operation)
  const originContext = buildOriginContext(mode)
  const quoteReference = createDeliveryHubQuoteReference({
    connection_id: input.connection.id,
    quote_type: mode,
    quote_key: `contract_validation_${input.args.operation}`,
    provider_origin_dispatch_context: originContext,
  })
  const providerExecutionReference = createDeliveryHubProviderExecutionReference({
    connection_id: input.connection.id,
    quote_type: mode,
    quote_key: `contract_validation_${input.args.operation}`,
    provider_origin_dispatch_context: originContext,
  })

  return {
    prepared: true,
    operation: input.args.operation,
    mode_code: mode,
    connection_id: input.connection.id,
    quote_reference: quoteReference,
    provider_execution_reference_present: !!providerExecutionReference,
    provider_shipment_reference_present: !!input.args.provider_shipment_reference,
    duplicate_prevention_posture: {
      status: "manual_only",
      note: "Execution-ledger/idempotency guards are not bypassed by this harness.",
    },
  }
}

async function buildAdditionalEvidence(input: {
  args: DeliveryHubProviderContractValidationArgs
  connection: DeliveryHubProviderContractValidationConnectionSnapshot | null
}): Promise<Array<ReturnType<typeof buildDeliveryHubProviderContractEvidenceSummary>>> {
  const result: Array<ReturnType<typeof buildDeliveryHubProviderContractEvidenceSummary>> = []

  if (!input.connection) {
    return result
  }

  const mode = pickModeByOperation(input.args.operation)
  const originContext = buildOriginContext(mode)

  if (input.args.operation === "create_shipment" || input.args.operation === "sanitized_provider_failure") {
    const requestBuild = buildYandexCreateShipmentDispatchRequest({
      mode,
      provider_origin_dispatch_context: originContext,
      destination_pickup_point: {
        provider_point_id: "pvz_contract_validation_target",
        provider_point_code: "pvz-code",
        name: "Validation PVZ",
        city: "Moscow",
      },
      pickup_interval_utc:
        mode === DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint
          ? {
              from: new Date().toISOString(),
              to: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
            }
          : null,
      order: {
        order_id: `order_${crypto.randomUUID()}`,
        display_id: 1,
        currency_code: "RUB",
        total: 100,
      },
      recipient: {
        full_name: "Contract Validation",
        email: "validation@example.com",
      },
      address: {
        country_code: "RU",
        city: "Moscow",
        address_line: "redacted",
      },
      packages: [
        {
          package_reference: "pkg-1",
          weight_grams: 100,
          items: [
            {
              quantity: 1,
              title: "Validation item",
            },
          ],
        },
      ],
      connection: {
        connection_id: input.connection.id,
        provider_code: input.connection.provider_code,
        mode: input.connection.mode,
      },
      quote_reference: {
        id: `quote_${crypto.randomUUID()}`,
        version: 1,
      },
      correlation_id: `corr_${crypto.randomUUID()}`,
    })

    const simulatedResult =
      input.args.force_provider_failure && requestBuild.status === "ready"
        ? await executeYandexCreateShipmentDispatch({
            client: buildRejectingClientLike(),
            request: requestBuild.request,
          })
        : requestBuild

    result.push(
      buildDeliveryHubProviderContractEvidenceSummary({
        generated_at: new Date().toISOString(),
        mode: "plan",
        operation: "create_shipment_dispatch_contract",
        status: requestBuild.status === "ready" ? "ready" : "blocked",
        live_call_attempted: false,
        live_call_performed: false,
        gate: {
          status: "allowed",
          reason_code: null,
          reason: null,
        },
        context: {
          force_provider_failure: input.args.force_provider_failure,
          connection_id: input.connection.id,
        },
        result: {
          request_build: requestBuild,
          simulated_dispatch: simulatedResult,
        },
      })
    )
  }

  if (input.args.operation === "refresh_status" || input.args.operation === "missing_provider_shipment_reference") {
    const statusRequest = buildYandexShipmentStatusRequest({
      provider_shipment_reference:
        input.args.operation === "missing_provider_shipment_reference"
          ? ""
          : input.args.provider_shipment_reference ?? "provider_shipment_validation_ref",
      correlation_id: `corr_${crypto.randomUUID()}`,
    })

    const simulatedStatus = statusRequest
      ? await executeYandexShipmentStatusRefresh({
          client: buildStaticClientLike({
            status: "in_transit",
            shipment_id: "provider-shipment-id",
          }),
          request: statusRequest,
        })
      : null

    result.push(
      buildDeliveryHubProviderContractEvidenceSummary({
        generated_at: new Date().toISOString(),
        mode: "plan",
        operation: "refresh_status_contract",
        status: statusRequest ? "ready" : "blocked",
        live_call_attempted: false,
        live_call_performed: false,
        gate: {
          status: "allowed",
          reason_code: null,
          reason: null,
        },
        context: {
          operation: input.args.operation,
          provider_shipment_reference: input.args.provider_shipment_reference,
        },
        result: {
          status_request_present: !!statusRequest,
          status_request: statusRequest,
          simulated_status: simulatedStatus,
        },
      })
    )
  }

  if (
    input.args.operation === "cancel_shipment" ||
    input.args.operation === "repeated_cancel" ||
    input.args.operation === "invalid_provider_shipment_reference"
  ) {
    const cancelReference =
      input.args.operation === "invalid_provider_shipment_reference"
        ? "!!"
        : input.args.provider_shipment_reference ?? "provider_cancel_validation_ref"

    const cancelRequest = buildYandexShipmentCancelRequest({
      provider_shipment_reference: cancelReference,
      correlation_id: `corr_${crypto.randomUUID()}`,
    })

    const simulatedCancel = cancelRequest
      ? await executeYandexShipmentCancel({
          client: buildStaticClientLike(
            input.args.operation === "repeated_cancel"
              ? { status: "already_cancelled", shipment_id: cancelReference }
              : { status: "cancelled", shipment_id: cancelReference }
          ),
          request: cancelRequest,
        })
      : null

    result.push(
      buildDeliveryHubProviderContractEvidenceSummary({
        generated_at: new Date().toISOString(),
        mode: "plan",
        operation: "cancel_contract",
        status: cancelRequest ? "ready" : "blocked",
        live_call_attempted: false,
        live_call_performed: false,
        gate: {
          status: "allowed",
          reason_code: null,
          reason: null,
        },
        context: {
          operation: input.args.operation,
        },
        result: {
          cancel_request_present: !!cancelRequest,
          cancel_request: cancelRequest,
          simulated_cancel: simulatedCancel,
        },
      })
    )
  }

  if (input.args.operation === "duplicate_prevention_posture") {
    result.push(
      buildDeliveryHubProviderContractEvidenceSummary({
        generated_at: new Date().toISOString(),
        mode: "plan",
        operation: "duplicate_prevention_posture",
        status: "documented",
        live_call_attempted: false,
        live_call_performed: false,
        gate: {
          status: "allowed",
          reason_code: null,
          reason: null,
        },
        context: {
          posture: "readiness_only",
        },
        result: {
          idempotency_scope: "deliveryhub:create_shipment",
          duplicate_prevention: "execution_ledger_replay_duplicate_drift_blockers",
          live_retry_redispatch_materialized: false,
        },
      })
    )
  }

  return result
}

function pickModeByOperation(
  operation: DeliveryHubProviderContractValidationOperation
): typeof DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint | typeof DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint {
  if (operation === "create_shipment" || operation === "refresh_status") {
    return DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint
  }

  return DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint
}

function buildOriginContext(
  mode: typeof DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint | typeof DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint
): DeliveryHubProviderOriginDispatchContext {
  if (mode === DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint) {
    return {
      mode_code: DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint,
      provider_warehouse_id: "provider_warehouse_validation_ref",
    }
  }

  return {
    mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
    origin_point_id: "origin_point_validation_ref",
  }
}

function buildRejectingClientLike() {
  return {
    post: async () => {
      throw new Error("forced_provider_failure_for_contract_validation")
    },
  }
}

function buildStaticClientLike(response: Record<string, unknown>) {
  return {
    post: async <TResponse>(
      _path: string,
      _payload: Record<string, unknown>,
      _correlationId: string
    ) => response as unknown as TResponse,
  }
}

function normalizeNullableText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}
