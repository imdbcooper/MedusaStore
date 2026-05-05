import { describe, expect, it, jest } from "@jest/globals"

import { GET } from "../../api/admin/apiship/diagnostics/route"
import {
  APISHIP_OPERATOR_DIAGNOSTICS_VERSION,
  assertApishipOperatorDiagnosticsSecretSafe,
  buildApishipOperatorDiagnosticsSnapshot,
} from "../../modules/apiship-operator-diagnostics"
import {
  APISHIP_FULFILLMENT_PROVIDER_CODE,
  APISHIP_FULFILLMENT_PROVIDER_ID,
} from "../../modules/fulfillment-contour-contract"
import { APISHIP_SHIPMENT_EXECUTION_ENV } from "../../modules/apiship-shipment-execution-guard"

const checkedAt = new Date("2026-05-05T10:00:00.000Z")

describe("ApiShip operator diagnostics", () => {
  it("returns a default-off shipment execution snapshot without live execution", () => {
    const snapshot = buildApishipOperatorDiagnosticsSnapshot({}, checkedAt)

    expect(snapshot).toMatchObject({
      ok: true,
      version: APISHIP_OPERATOR_DIAGNOSTICS_VERSION,
      redacted: true,
      checked_at: "2026-05-05T10:00:00.000Z",
      guards: {
        shipment_execution: {
          enabled: false,
          status: "disabled",
          default: "off",
          source: "default",
          env_name: APISHIP_SHIPMENT_EXECUTION_ENV,
          exact_opt_in_required: true,
        },
      },
      limitations: {
        external_apiship_health_call: false,
        live_shipment_execution: false,
        online_auth_validation: false,
        sensitive_values_returned: false,
      },
    })
    expect(snapshot.env[APISHIP_SHIPMENT_EXECUTION_ENV]).toEqual({
      present: false,
      enabled: false,
      source: "default",
      value: "disabled",
    })
  })

  it("reports the canonical ApiShip contour and provider ids", () => {
    const snapshot = buildApishipOperatorDiagnosticsSnapshot({}, checkedAt)

    expect(snapshot.baseline).toMatchObject({
      contour: "apiship_gorgo",
      provider_code: APISHIP_FULFILLMENT_PROVIDER_CODE,
      provider_id: APISHIP_FULFILLMENT_PROVIDER_ID,
      primary_adapter: "gorgo_apiship",
      buyer_facing_mode: "pickup_point_first",
    })
    expect(snapshot.provider_registration).toMatchObject({
      registered: true,
      provider_code: "apiship",
      medusa_fulfillment_provider_id: "apiship_apiship",
      medusa_config_provider_id: "apiship",
      settings_module_expected: true,
      fulfillment_module_provider_expected: true,
    })
    expect(snapshot.option_contracts.pickup_point).toMatchObject({
      expected: true,
      mode: "pickup_point",
      shipping_option_data_id: "apiship_doortopoint",
      provider_id: "apiship_apiship",
      delivery_type: 2,
      pickup_type: 1,
    })
    expect(snapshot.option_contracts.courier).toMatchObject({
      expected: true,
      mode: "courier",
      shipping_option_data_id: "apiship_doortodoor",
      provider_id: "apiship_apiship",
      delivery_type: 1,
      pickup_type: 1,
    })
  })

  it("does not leak secret-looking keys or values", () => {
    const snapshot = buildApishipOperatorDiagnosticsSnapshot(
      {
        [APISHIP_SHIPMENT_EXECUTION_ENV]: "true",
      },
      checkedAt
    )
    const serialized = JSON.stringify(snapshot).toLowerCase()

    expect(assertApishipOperatorDiagnosticsSecretSafe(snapshot)).toBe(true)
    expect(serialized).not.toContain("token")
    expect(serialized).not.toContain("secret")
    expect(serialized).not.toContain("credential")
    expect(serialized).not.toContain("authorization")
    expect(serialized).not.toContain("bearer ")
    expect(serialized).not.toContain("api_key")
    expect(serialized).not.toContain("apikey")
    expect(serialized).not.toContain("password")
  })

  it("includes Delivery Hub previous-baseline quarantine status", () => {
    const snapshot = buildApishipOperatorDiagnosticsSnapshot({}, checkedAt)

    expect(snapshot.delivery_hub_quarantine).toEqual({
      status: "quarantined",
      previous_baseline: "delivery_hub",
      active_baseline: "apiship_gorgo",
      runtime_http_status: 410,
      error_code: "delivery_hub_runtime_quarantined",
      physical_cleanup_performed: false,
      public_store_facade_returned: false,
    })
  })

  it("admin route returns the diagnostics module shape without external calls", async () => {
    const json = jest.fn()
    const status = jest.fn(() => ({ json }))

    await GET({} as never, { status } as never)

    expect(status).toHaveBeenCalledWith(200)
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        redacted: true,
        baseline: expect.objectContaining({
          contour: "apiship_gorgo",
          provider_id: "apiship_apiship",
        }),
        guards: expect.objectContaining({
          checkout_readiness: expect.objectContaining({ enabled: true }),
          shipment_execution: expect.objectContaining({ default: "off" }),
        }),
        limitations: expect.objectContaining({
          external_apiship_health_call: false,
          live_shipment_execution: false,
        }),
      })
    )
    expect(assertApishipOperatorDiagnosticsSecretSafe(json.mock.calls[0][0])).toBe(
      true
    )
  })
})
