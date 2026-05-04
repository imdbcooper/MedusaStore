import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals"

import {
  APISHIP_SHIPMENT_EXECUTION_ENV,
  assertApishipShipmentExecutionAllowed,
  enforceApishipOrderFulfillmentCreateExecutionGuard,
  isApishipShipmentExecutionEnabled,
} from "../../modules/apiship-shipment-execution-guard"

describe("ApiShip shipment execution guard", () => {
  const originalExecutionEnv = process.env[APISHIP_SHIPMENT_EXECUTION_ENV]

  beforeEach(() => {
    delete process.env[APISHIP_SHIPMENT_EXECUTION_ENV]
  })

  afterEach(() => {
    if (originalExecutionEnv === undefined) {
      delete process.env[APISHIP_SHIPMENT_EXECUTION_ENV]
      return
    }

    process.env[APISHIP_SHIPMENT_EXECUTION_ENV] = originalExecutionEnv
  })

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
  it("fails closed for order fulfillment creation without explicit shipping_option_id when any order shipping method is ApiShip", async () => {
    const harness = buildOrderFulfillmentCreateHarness({
      orderShippingOptionIds: ["so_manual", "so_apiship"],
      shippingOptionProviders: {
        so_manual: "manual_manual",
        so_apiship: "apiship_apiship",
      },
    })

    await expect(
      enforceApishipOrderFulfillmentCreateExecutionGuard(
        harness.req,
        {} as never,
        harness.next
      )
    ).rejects.toThrow("omitted explicit shipping_option_id")

    expect(harness.query.graph).toHaveBeenCalledWith({
      entity: "order",
      fields: ["id", "shipping_methods.shipping_option_id"],
      filters: {
        id: "order_1",
      },
    })
    expect(
      harness.fulfillmentModuleService.retrieveShippingOption
    ).toHaveBeenCalledWith("so_manual")
    expect(
      harness.fulfillmentModuleService.retrieveShippingOption
    ).toHaveBeenCalledWith("so_apiship")
    expect(harness.next).not.toHaveBeenCalled()
  })

  it("does not block order fulfillment creation without explicit shipping_option_id when order methods are non-ApiShip only", async () => {
    const harness = buildOrderFulfillmentCreateHarness({
      orderShippingOptionIds: ["so_manual", "so_manual_secondary"],
      shippingOptionProviders: {
        so_manual: "manual_manual",
        so_manual_secondary: "manual_secondary",
      },
    })

    await expect(
      enforceApishipOrderFulfillmentCreateExecutionGuard(
        harness.req,
        {} as never,
        harness.next
      )
    ).resolves.toBeUndefined()

    expect(harness.next).toHaveBeenCalledTimes(1)
  })

  it("allows ambiguous ApiShip-risk order fulfillment creation only with exact true opt-in", async () => {
    process.env[APISHIP_SHIPMENT_EXECUTION_ENV] = "true"
    const harness = buildOrderFulfillmentCreateHarness({
      orderShippingOptionIds: ["so_manual", "so_apiship"],
      shippingOptionProviders: {
        so_manual: "manual_manual",
        so_apiship: "apiship_apiship",
      },
    })

    await expect(
      enforceApishipOrderFulfillmentCreateExecutionGuard(
        harness.req,
        {} as never,
        harness.next
      )
    ).resolves.toBeUndefined()

    expect(harness.next).toHaveBeenCalledTimes(1)
  })
})

function buildOrderFulfillmentCreateHarness(input: {
  orderShippingOptionIds: string[]
  shippingOptionProviders: Record<string, string>
}) {
  const query = {
    graph: jest.fn(async () => ({
      data: [
        {
          id: "order_1",
          shipping_methods: input.orderShippingOptionIds.map(
            (shipping_option_id) => ({ shipping_option_id })
          ),
        },
      ],
    })),
  }
  const fulfillmentModuleService = {
    retrieveShippingOption: jest.fn(async (shippingOptionId: string) => ({
      id: shippingOptionId,
      provider_id: input.shippingOptionProviders[shippingOptionId] ?? null,
    })),
  }
  const req = {
    params: {
      id: "order_1",
    },
    validatedBody: {},
    scope: {
      resolve: jest.fn((key: string | symbol) => {
        if (key === ContainerRegistrationKeys.QUERY) {
          return query
        }

        if (key === Modules.FULFILLMENT) {
          return fulfillmentModuleService
        }

        throw new Error(`Unexpected dependency resolved: ${String(key)}`)
      }),
    },
  } as never
  const next = jest.fn()

  return {
    fulfillmentModuleService,
    next,
    query,
    req,
  }
}
