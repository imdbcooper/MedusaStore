import { describe, expect, it } from "@jest/globals"
import { DELIVERY_HUB_PROVIDER_YANDEX } from "../../modules/delivery-hub/constants"
import { DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE } from "../../modules/delivery-hub/provider-surface"
import {
  getDefaultFulfillmentContourContract,
  isDeliveryHubDefaultFulfillmentContour,
} from "../../modules/fulfillment-contour-contract"

describe("fulfillment contour contract", () => {
  it("sets Delivery Hub/direct Yandex as the only default contour for fresh templates", () => {
    const contract = getDefaultFulfillmentContourContract()

    expect(contract).toMatchObject({
      contour: "delivery_hub",
      provider_id: DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
      provider_code: DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
      primary_adapter: DELIVERY_HUB_PROVIDER_YANDEX,
      posture: "default_for_new_templates",
      live_execution_enabled: false,
    })
    expect(contract).not.toHaveProperty("deprecated")
    expect(isDeliveryHubDefaultFulfillmentContour(DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE)).toBe(true)
    expect(isDeliveryHubDefaultFulfillmentContour("manual")).toBe(false)
  })
})
