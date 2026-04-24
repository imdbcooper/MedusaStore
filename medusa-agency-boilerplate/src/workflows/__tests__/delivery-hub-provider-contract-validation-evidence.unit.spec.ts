import { describe, expect, it } from "@jest/globals"
import {
  buildDeliveryHubProviderContractEvidenceSummary,
  maskDeliveryHubProviderContractReference,
  normalizeDeliveryHubProviderContractEvidenceObject,
  normalizeDeliveryHubProviderContractEvidenceValue,
} from "../../modules/delivery-hub/provider-contract-validation-evidence"

describe("Delivery Hub provider-contract evidence redaction", () => {
  it("masks credential-like and provider-reference-like values", () => {
    const normalized = normalizeDeliveryHubProviderContractEvidenceObject({
      token: "secret-token-raw",
      authorization: "Bearer test-secret-token",
      provider_shipment_reference: "provider-shipment-reference-raw",
      quote_reference: "quote-reference-raw",
      correlation_id: "correlation-raw-value",
      nested: {
        shipment_id: "nested-shipment-raw",
        execution_reference: "nested-exec-raw",
      },
    })

    expect(normalized).toEqual({
      token: "***",
      authorization: "***",
      provider_shipment_reference: "pr***aw",
      quote_reference: "qu***aw",
      correlation_id: "co***ue",
      nested: {
        shipment_id: "ne***aw",
        execution_reference: "ne***aw",
      },
    })
  })

  it("hard-redacts payload-like fields and does not keep raw nested payloads", () => {
    const normalized = normalizeDeliveryHubProviderContractEvidenceObject({
      request_payload: {
        shipment_id: "raw-should-not-leak",
      },
      response_payload: {
        status: "accepted",
      },
      raw_provider_response: {
        body: "raw-body-should-not-leak",
      },
      payload: {
        anything: "raw",
      },
    })

    expect(normalized).toEqual({
      request_payload: "[REDACTED_PAYLOAD]",
      response_payload: "[REDACTED_PAYLOAD]",
      raw_provider_response: "[REDACTED_PAYLOAD]",
      payload: "[REDACTED_PAYLOAD]",
    })
  })

  it("normalizes summary without raw payloads or secret-bearing values", () => {
    const summary = buildDeliveryHubProviderContractEvidenceSummary({
      generated_at: "2026-04-24T00:00:00.000Z",
      mode: "plan",
      operation: "cancel_shipment",
      status: "prepared",
      live_call_attempted: false,
      live_call_performed: false,
      gate: {
        status: "blocked_default_dry_run",
        reason_code: "dry_run_default",
        reason: "Authorization=Bearer secret-token",
      },
      context: {
        provider_shipment_reference: "provider-shipment-raw-1",
        quote_key: "quote-key-raw",
      },
      result: {
        response_payload: {
          status: "accepted",
          shipment_id: "provider-shipment-raw-2",
        },
      },
    })

    expect(summary).toEqual(
      expect.objectContaining({
        version: 1,
        mode: "plan",
        operation: "cancel_shipment",
        live_call_attempted: false,
        live_call_performed: false,
        gate: {
          status: "blocked_default_dry_run",
          reason_code: "dry_run_default",
          reason: "Authorization=Bearer ***",
        },
        context: {
          provider_shipment_reference: "pr***-1",
          quote_key: "***",
        },
        result: {
          response_payload: "[REDACTED_PAYLOAD]",
        },
      })
    )

    const json = JSON.stringify(summary)
    expect(json).not.toContain("secret-token")
    expect(json).not.toContain("provider-shipment-raw-1")
    expect(json).not.toContain("provider-shipment-raw-2")
    expect(json).not.toContain("quote-key-raw")
    expect(json).not.toContain('"payload":{')
  })

  it("keeps unknown unsupported value types redacted", () => {
    const symbolValue = Symbol("secret")
    const normalized = normalizeDeliveryHubProviderContractEvidenceValue("weird", symbolValue)

    expect(normalized).toBe("[REDACTED_UNSUPPORTED_VALUE]")
  })

  it("masks short and long references safely", () => {
    expect(maskDeliveryHubProviderContractReference("abc")).toBe("***")
    expect(maskDeliveryHubProviderContractReference("shipment-reference-raw")).toBe("sh***aw")
    expect(maskDeliveryHubProviderContractReference("")).toBeNull()
  })
})
