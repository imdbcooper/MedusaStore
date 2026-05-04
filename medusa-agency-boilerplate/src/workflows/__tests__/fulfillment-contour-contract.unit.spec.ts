import { describe, expect, it } from "@jest/globals"
import {
  APISHIP_FULFILLMENT_PROVIDER_CODE,
  APISHIP_FULFILLMENT_PROVIDER_ID,
  APISHIP_PRIMARY_ADAPTER,
  getDefaultFulfillmentContourContract,
  isApiShipDefaultFulfillmentContour,
} from "../../modules/fulfillment-contour-contract"

describe("fulfillment contour contract", () => {
  it("sets ApiShip/Gorgo pickup-point first as the default contour for fresh templates", () => {
    const contract = getDefaultFulfillmentContourContract()

    expect(contract).toMatchObject({
      contour: "apiship_gorgo",
      provider_id: APISHIP_FULFILLMENT_PROVIDER_ID,
      provider_code: APISHIP_FULFILLMENT_PROVIDER_CODE,
      primary_adapter: APISHIP_PRIMARY_ADAPTER,
      buyer_facing_mode: "pickup_point_first",
      courier_delivery: "optional_later",
      posture: "default_for_new_templates",
      live_execution_enabled: false,
    })
    expect(contract.provider_id).toBe("apiship_apiship")
    expect(contract).not.toHaveProperty("deprecated")
    expect(isApiShipDefaultFulfillmentContour(APISHIP_FULFILLMENT_PROVIDER_CODE)).toBe(true)
    expect(isApiShipDefaultFulfillmentContour("manual")).toBe(false)
    expect(isApiShipDefaultFulfillmentContour("deliveryhub")).toBe(false)
  })
})
