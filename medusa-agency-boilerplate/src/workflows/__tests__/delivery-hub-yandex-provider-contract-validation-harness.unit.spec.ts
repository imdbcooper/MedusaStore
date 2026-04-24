import { afterEach, describe, expect, it, jest } from "@jest/globals"
import deliveryHubYandexProviderContractValidation from "../../scripts/delivery-hub-yandex-provider-contract-validation"

const originalEncryptionKey = process.env.DELIVERY_HUB_ENCRYPTION_KEY
const originalLiveOptIn = process.env.DELIVERY_HUB_YANDEX_PROVIDER_CONTRACT_VALIDATION_LIVE_ENABLED

describe("Delivery Hub Yandex provider-contract validation harness", () => {
  afterEach(() => {
    jest.restoreAllMocks()
    process.env.DELIVERY_HUB_ENCRYPTION_KEY = originalEncryptionKey
    process.env.DELIVERY_HUB_YANDEX_PROVIDER_CONTRACT_VALIDATION_LIVE_ENABLED = originalLiveOptIn
  })

  it("defaults to dry-run plan mode and blocks live execution", async () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => undefined)
    const args = ["--operation=create_shipment"]

    await deliveryHubYandexProviderContractValidation(
      buildExecArgs({
        args,
        queryRows: [buildReadyConnectionRow("conn_default")],
      }) as never
    )

    const output = parseLogOutput(logSpy)
    expect(output.invocation.mode).toBe("plan")
    expect(output.invocation.dry_run).toBe(true)
    expect(output.invocation.live_call_attempted).toBe(false)
    expect(output.invocation.live_call_performed).toBe(false)
    expect(output.gate.status).toBe("blocked_default_dry_run")
    expect(output.evidence.primary.live_call_performed).toBe(false)
  })

  it("requires explicit live opt-in env before any live provider call", async () => {
    process.env.DELIVERY_HUB_ENCRYPTION_KEY = "test-encryption-key"
    delete process.env.DELIVERY_HUB_YANDEX_PROVIDER_CONTRACT_VALIDATION_LIVE_ENABLED

    const logSpy = jest.spyOn(console, "log").mockImplementation(() => undefined)

    await deliveryHubYandexProviderContractValidation(
      buildExecArgs({
        args: [
          "--mode=live",
          "--dry-run=false",
          "--operation=refresh_status",
          "--connection-id=conn_live",
          "--provider-shipment-reference=provider-shipment-reference-raw",
          "--live-confirm=I_UNDERSTAND_LIVE_PROVIDER_CALLS",
        ],
        queryRows: [buildReadyConnectionRow("conn_live")],
      }) as never
    )

    const output = parseLogOutput(logSpy)
    expect(output.invocation.mode).toBe("live")
    expect(output.invocation.dry_run).toBe(false)
    expect(output.invocation.live_call_attempted).toBe(true)
    expect(output.invocation.live_call_performed).toBe(false)
    expect(output.gate.status).toBe("blocked_live_opt_in_required")
    expect(output.gate.reason_code).toBe("live_opt_in_env_required")
    expect(output.evidence.primary.live_call_performed).toBe(false)
  })

  it("fails closed when encryption key is missing in live mode", async () => {
    delete process.env.DELIVERY_HUB_ENCRYPTION_KEY
    process.env.DELIVERY_HUB_YANDEX_PROVIDER_CONTRACT_VALIDATION_LIVE_ENABLED = "true"

    const logSpy = jest.spyOn(console, "log").mockImplementation(() => undefined)

    await deliveryHubYandexProviderContractValidation(
      buildExecArgs({
        args: [
          "--mode=live",
          "--dry-run=false",
          "--operation=cancel_shipment",
          "--connection-id=conn_live",
          "--provider-shipment-reference=provider-shipment-reference-raw",
          "--live-confirm=I_UNDERSTAND_LIVE_PROVIDER_CALLS",
        ],
        queryRows: [buildReadyConnectionRow("conn_live")],
      }) as never
    )

    const output = parseLogOutput(logSpy)
    expect(output.gate.status).toBe("blocked_encryption_key_required")
    expect(output.gate.reason_code).toBe("encryption_key_required")
    expect(output.invocation.live_call_performed).toBe(false)
  })

  it("keeps evidence summary redacted and without raw payload/secrets", async () => {
    process.env.DELIVERY_HUB_ENCRYPTION_KEY = "test-encryption-key"

    const logSpy = jest.spyOn(console, "log").mockImplementation(() => undefined)

    await deliveryHubYandexProviderContractValidation(
      buildExecArgs({
        args: [
          "--operation=sanitized_provider_failure",
          "--connection-id=conn_ready",
          "--provider-shipment-reference=provider-shipment-reference-raw",
          "--force-provider-failure=true",
        ],
        queryRows: [buildReadyConnectionRow("conn_ready")],
      }) as never
    )

    const output = parseLogOutput(logSpy)

    expect(output.evidence.primary).toEqual(
      expect.objectContaining({
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
      })
    )

    const json = JSON.stringify(output)
    expect(json).not.toContain("provider-shipment-reference-raw")
    expect(json).not.toContain("Authorization")
    expect(json).not.toContain("Bearer ")
    expect(json).not.toContain('"request_payload":{')
    expect(json).not.toContain('"response_payload":{')
    expect(json).not.toContain('"quote_key":"')
  })

  it("keeps duplicate-prevention posture as plan-only and no live dispatch", async () => {
    process.env.DELIVERY_HUB_ENCRYPTION_KEY = "test-encryption-key"
    process.env.DELIVERY_HUB_YANDEX_PROVIDER_CONTRACT_VALIDATION_LIVE_ENABLED = "true"

    const logSpy = jest.spyOn(console, "log").mockImplementation(() => undefined)

    await deliveryHubYandexProviderContractValidation(
      buildExecArgs({
        args: [
          "--mode=live",
          "--dry-run=false",
          "--operation=duplicate_prevention_posture",
          "--connection-id=conn_ready",
          "--live-confirm=I_UNDERSTAND_LIVE_PROVIDER_CALLS",
        ],
        queryRows: [buildReadyConnectionRow("conn_ready")],
      }) as never
    )

    const output = parseLogOutput(logSpy)

    expect(output.gate.status).toBe("allowed")
    expect(output.invocation.live_call_attempted).toBe(true)
    expect(output.invocation.live_call_performed).toBe(false)

    const duplicateEvidence = output.evidence.additional.find(
      (entry: any) => entry.operation === "duplicate_prevention_posture"
    )
    expect(duplicateEvidence).toBeDefined()
    expect(duplicateEvidence.result).toEqual(
      expect.objectContaining({
        idempotency_scope: "deliveryhub:create_shipment",
        duplicate_prevention: "execution_ledger_replay_duplicate_drift_blockers",
        live_retry_redispatch_materialized: false,
      })
    )
  })
})

function parseLogOutput(logSpy: ReturnType<typeof jest.spyOn>) {
  expect(logSpy).toHaveBeenCalledTimes(1)
  const payload = String(logSpy.mock.calls[0]?.[0] ?? "{}")
  return JSON.parse(payload)
}

function buildExecArgs(input: { args: string[]; queryRows: Array<Record<string, unknown>> }) {
  const graph = jest.fn(async () => ({ data: [] }))

  const raw = jest.fn(async (sql: string, bindings?: unknown[]) => {
    if (/from\s+delivery_connections/i.test(sql) && /where id = \?/i.test(sql)) {
      const id = typeof bindings?.[0] === "string" ? bindings[0] : null
      const row = input.queryRows.find((entry) => entry.id === id)
      return { rows: row ? [row] : [] }
    }

    if (/from\s+delivery_connections/i.test(sql)) {
      return { rows: input.queryRows }
    }

    if (/to_regclass/i.test(sql)) {
      return { rows: [{ table_name: "delivery_connections" }] }
    }

    return { rows: [] }
  })

  const container = {
    resolve: (key: string) => {
      if (key === "query") {
        return { graph }
      }

      if (key === "pgConnection" || key === "__pg_connection__") {
        return { raw }
      }

      throw new Error(`Unexpected container key: ${key}`)
    },
  }

  return {
    args: input.args,
    container,
  }
}

function buildReadyConnectionRow(id: string) {
  return {
    id,
    provider_code: "yandex",
    name: "Yandex",
    status: "active",
    mode: "live",
    enabled: true,
    country_code: "RU",
    credentials_envelope: { ciphertext: "sealed" },
    credentials_state: "sealed",
    credentials_fingerprint: "fp",
    credentials_last_validated_at: null,
    credentials_last_error_code: null,
    config: {},
    metadata: {},
    created_at: "2026-04-24T00:00:00.000Z",
    updated_at: "2026-04-24T00:00:00.000Z",
  }
}
