import { describe, expect, it } from "@jest/globals"

import {
  APISHIP_SHIPMENT_EXECUTION_ENV,
  assertApishipShipmentExecutionAllowed,
  isApishipShipmentExecutionEnabled,
} from "../../modules/apiship-shipment-execution-guard"

describe("ApiShip shipment execution guard", () => {
  it("blocks ApiShip fulfillment execution when the env flag is missing", () => {
    expect(() =>
      assertApishipShipmentExecutionAllowed({
        provider_id: "apiship_apiship",
        operation: "create_fulfillment",
        env: {},
      })
    ).toThrow(APISHIP_SHIPMENT_EXECUTION_ENV)
  })

  it("blocks ApiShip fulfillment execution when the env flag is false", () => {
    expect(() =>
      assertApishipShipmentExecutionAllowed({
        provider_id: "apiship_apiship",
        operation: "create_fulfillment",
        env: {
          [APISHIP_SHIPMENT_EXECUTION_ENV]: "false",
        },
      })
    ).toThrow("ApiShip shipment execution is disabled by default")
  })

  it("allows ApiShip fulfillment execution only with explicit true opt-in", () => {
    expect(
      isApishipShipmentExecutionEnabled({
        [APISHIP_SHIPMENT_EXECUTION_ENV]: "true",
      })
    ).toBe(true)

    expect(() =>
      assertApishipShipmentExecutionAllowed({
        provider_id: "apiship_apiship",
        operation: "create_fulfillment",
        env: {
          [APISHIP_SHIPMENT_EXECUTION_ENV]: "true",
        },
      })
    ).not.toThrow()
  })

  it("does not block non-ApiShip/manual fulfillment execution", () => {
    expect(() =>
      assertApishipShipmentExecutionAllowed({
        provider_id: "manual_manual",
        operation: "create_fulfillment",
        env: {},
      })
    ).not.toThrow()
  })

  it("fails closed for invalid truthy-looking env values", () => {
    for (const value of ["1", "yes", "TRUE", "enabled"]) {
      expect(
        isApishipShipmentExecutionEnabled({
          [APISHIP_SHIPMENT_EXECUTION_ENV]: value,
        })
      ).toBe(false)

      expect(() =>
        assertApishipShipmentExecutionAllowed({
          provider_id: "apiship_apiship",
          operation: "cancel_fulfillment",
          env: {
            [APISHIP_SHIPMENT_EXECUTION_ENV]: value,
          },
        })
      ).toThrow("ApiShip shipment execution is disabled by default")
    }
  })
})
