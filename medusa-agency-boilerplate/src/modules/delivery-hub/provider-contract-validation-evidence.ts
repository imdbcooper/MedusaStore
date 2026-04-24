import { redactSensitiveText } from "./security/redaction"

export const DELIVERY_HUB_PROVIDER_CONTRACT_EVIDENCE_VERSION = 1

const DELIVERY_HUB_PROVIDER_CONTRACT_HARD_REDACT_KEYS = new Set([
  "request_payload",
  "response_payload",
  "raw_provider_payload",
  "raw_provider_request",
  "raw_provider_response",
  "raw_response_body",
  "raw_body",
  "payload",
  "credentials_envelope",
  "backend_execution_reference",
  "provider_execution_reference",
])

const DELIVERY_HUB_PROVIDER_CONTRACT_SECRET_KEYS = new Set([
  "authorization",
  "proxy_authorization",
  "token",
  "access_token",
  "refresh_token",
  "oauth_token",
  "api_key",
  "x_api_key",
  "secret",
  "client_secret",
  "service_ticket",
  "x_ya_service_ticket",
  "quote_key",
])

const DELIVERY_HUB_PROVIDER_CONTRACT_REFERENCE_KEYS = new Set([
  "provider_shipment_reference",
  "provider_shipment_id",
  "shipment_id",
  "claim_id",
  "execution_reference",
  "idempotency_key",
  "correlation_id",
  "quote_reference",
  "connection_id",
  "order_reference",
  "external_order_id",
])

export type DeliveryHubProviderContractEvidenceSummary = {
  version: typeof DELIVERY_HUB_PROVIDER_CONTRACT_EVIDENCE_VERSION
  generated_at: string
  mode: "plan" | "live"
  operation: string
  status: string
  live_call_attempted: boolean
  live_call_performed: boolean
  gate: {
    status: string
    reason_code: string | null
    reason: string | null
  }
  context: Record<string, unknown>
  result: Record<string, unknown>
  anti_leak_confirmations: {
    raw_provider_payloads_included: false
    raw_provider_request_included: false
    raw_provider_response_included: false
    raw_response_body_included: false
    auth_headers_included: false
    credentials_included: false
    raw_quote_key_included: false
    raw_provider_identifier_included: false
    raw_execution_secret_included: false
  }
}

export function buildDeliveryHubProviderContractEvidenceSummary(input: {
  generated_at: string
  mode: "plan" | "live"
  operation: string
  status: string
  live_call_attempted: boolean
  live_call_performed: boolean
  gate: {
    status: string
    reason_code: string | null
    reason: string | null
  }
  context?: Record<string, unknown>
  result?: Record<string, unknown>
}): DeliveryHubProviderContractEvidenceSummary {
  return {
    version: DELIVERY_HUB_PROVIDER_CONTRACT_EVIDENCE_VERSION,
    generated_at: toIsoTimestamp(input.generated_at),
    mode: input.mode,
    operation: normalizeText(input.operation, "unknown_operation"),
    status: normalizeText(input.status, "unknown"),
    live_call_attempted: !!input.live_call_attempted,
    live_call_performed: !!input.live_call_performed,
    gate: {
      status: normalizeText(input.gate.status, "unknown"),
      reason_code: normalizeNullableText(input.gate.reason_code),
      reason: redactEvidenceText(input.gate.reason),
    },
    context: normalizeDeliveryHubProviderContractEvidenceObject(input.context ?? {}),
    result: normalizeDeliveryHubProviderContractEvidenceObject(input.result ?? {}),
    anti_leak_confirmations: {
      raw_provider_payloads_included: false,
      raw_provider_request_included: false,
      raw_provider_response_included: false,
      raw_response_body_included: false,
      auth_headers_included: false,
      credentials_included: false,
      raw_quote_key_included: false,
      raw_provider_identifier_included: false,
      raw_execution_secret_included: false,
    },
  }
}

export function normalizeDeliveryHubProviderContractEvidenceObject(
  input: Record<string, unknown>
): Record<string, unknown> {
  const output: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(input)) {
    output[key] = normalizeDeliveryHubProviderContractEvidenceValue(key, value)
  }

  return output
}

export function normalizeDeliveryHubProviderContractEvidenceValue(
  key: string,
  value: unknown
): unknown {
  const normalizedKey = normalizeKey(key)

  if (isHardRedactKey(normalizedKey)) {
    return "[REDACTED_PAYLOAD]"
  }

  if (value === null || typeof value === "undefined") {
    return null
  }

  if (typeof value === "string") {
    return normalizeStringValue(normalizedKey, value)
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value
  }

  if (Array.isArray(value)) {
    return value.map((entry) => normalizeDeliveryHubProviderContractEvidenceValue(key, entry))
  }

  if (isRecord(value)) {
    return normalizeDeliveryHubProviderContractEvidenceObject(value)
  }

  return "[REDACTED_UNSUPPORTED_VALUE]"
}

export function maskDeliveryHubProviderContractReference(value: unknown): string | null {
  const normalized = normalizeNullableText(value)

  if (!normalized) {
    return null
  }

  if (normalized.length <= 6) {
    return "***"
  }

  const masked = `${normalized.slice(0, 2)}***${normalized.slice(-2)}`
  return masked === normalized ? "***" : masked
}

function normalizeStringValue(normalizedKey: string, value: string) {
  const redactedText = redactEvidenceText(value)

  if (isSecretLikeKey(normalizedKey)) {
    return "***"
  }

  if (isReferenceLikeKey(normalizedKey)) {
    return maskDeliveryHubProviderContractReference(redactedText)
  }

  return redactedText
}

function redactEvidenceText(value: unknown) {
  const normalized = normalizeNullableText(value)

  if (!normalized) {
    return null
  }

  const redacted = redactSensitiveText(normalized) ?? "***"
  return redacted
}

function isHardRedactKey(normalizedKey: string) {
  if (!normalizedKey) {
    return false
  }

  if (DELIVERY_HUB_PROVIDER_CONTRACT_HARD_REDACT_KEYS.has(normalizedKey)) {
    return true
  }

  return (
    normalizedKey.startsWith("raw_") &&
    (normalizedKey.endsWith("payload") || normalizedKey.endsWith("request") || normalizedKey.endsWith("response"))
  )
}

function isSecretLikeKey(normalizedKey: string) {
  if (!normalizedKey) {
    return false
  }

  if (DELIVERY_HUB_PROVIDER_CONTRACT_SECRET_KEYS.has(normalizedKey)) {
    return true
  }

  return (
    normalizedKey.endsWith("token") ||
    normalizedKey.endsWith("secret") ||
    normalizedKey.endsWith("authorization") ||
    normalizedKey.endsWith("apikey") ||
    normalizedKey === "credentials"
  )
}

function isReferenceLikeKey(normalizedKey: string) {
  if (!normalizedKey) {
    return false
  }

  if (DELIVERY_HUB_PROVIDER_CONTRACT_REFERENCE_KEYS.has(normalizedKey)) {
    return true
  }

  return (
    normalizedKey.endsWith("reference") ||
    normalizedKey.endsWith("referenceid") ||
    normalizedKey.endsWith("shipmentid") ||
    normalizedKey.endsWith("executionreference") ||
    normalizedKey.endsWith("idempotencykey") ||
    normalizedKey.endsWith("correlationid")
  )
}

function normalizeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

function normalizeText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback
}

function normalizeNullableText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function toIsoTimestamp(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}
