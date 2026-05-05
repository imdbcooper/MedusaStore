import { describe, expect, it, jest } from "@jest/globals"

import {
  DELIVERY_HUB_RUNTIME_QUARANTINE_ERROR_CODE,
  DELIVERY_HUB_RUNTIME_QUARANTINE_STATUS,
  buildDeliveryHubRuntimeQuarantineResponse,
  enforceDeliveryHubRuntimeQuarantine,
} from "../../modules/delivery-hub-runtime-quarantine"

describe("Delivery Hub runtime quarantine", () => {
  it("returns a default-off ApiShip baseline quarantine response", () => {
    expect(
      buildDeliveryHubRuntimeQuarantineResponse({
        path: "/store/delivery/quotes",
        method: "POST",
      })
    ).toEqual({
      error: {
        code: DELIVERY_HUB_RUNTIME_QUARANTINE_ERROR_CODE,
        message:
          "Delivery Hub runtime endpoints are quarantined after the ApiShip/Gorgo baseline migration. Use the ApiShip/Gorgo checkout and fulfillment baseline instead.",
        details: {
          baseline: "apiship_gorgo",
          previous_baseline: "delivery_hub",
          path: "/store/delivery/quotes",
          method: "POST",
          live_shipment_execution_enabled: false,
        },
      },
    })
  })

  it("terminates Delivery Hub runtime requests without calling next", () => {
    const json = jest.fn()
    const status = jest.fn(() => ({ json }))
    const next = jest.fn()

    enforceDeliveryHubRuntimeQuarantine(
      {
        path: "/admin/orders/order_1/delivery-hub/shipments",
        method: "POST",
      } as never,
      { status } as never,
      next as never
    )

    expect(status).toHaveBeenCalledWith(DELIVERY_HUB_RUNTIME_QUARANTINE_STATUS)
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: DELIVERY_HUB_RUNTIME_QUARANTINE_ERROR_CODE,
          details: expect.objectContaining({
            baseline: "apiship_gorgo",
            previous_baseline: "delivery_hub",
            live_shipment_execution_enabled: false,
          }),
        }),
      })
    )
    expect(next).not.toHaveBeenCalled()
  })
})
