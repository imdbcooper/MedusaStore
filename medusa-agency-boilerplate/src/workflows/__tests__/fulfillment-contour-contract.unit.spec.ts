import { describe, expect, it } from "@jest/globals"
import { DELIVERY_HUB_PROVIDER_YANDEX } from "../../modules/delivery-hub/constants"
import { DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE } from "../../modules/delivery-hub/provider-surface"
import {
  getDefaultFulfillmentContourContract,
  getLegacyApiShipDeprecationContract,
  isDeliveryHubDefaultFulfillmentContour,
  isLegacyApiShipCompatibilityContour,
} from "../../modules/fulfillment-contour-contract"
import { APISHIP_LEGACY_DEPRECATION_NOTICE, APISHIP_PROVIDER_ID } from "../../modules/apiship"
import { APISHIP_SETTINGS_DEPRECATION_NOTICE, getDefaultApiShipSettings } from "../../modules/apiship-settings"

describe("fulfillment contour contract", () => {
  it("sets Delivery Hub/direct Yandex as the default contour for fresh templates", () => {
    const contract = getDefaultFulfillmentContourContract()

    expect(contract).toMatchObject({
      contour: "delivery_hub",
      provider_id: DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
      provider_code: DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
      primary_adapter: DELIVERY_HUB_PROVIDER_YANDEX,
      posture: "default_for_new_templates",
      live_execution_enabled: false,
    })
    expect(isDeliveryHubDefaultFulfillmentContour(DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE)).toBe(true)
    expect(isDeliveryHubDefaultFulfillmentContour("apiship")).toBe(false)
  })

  it("keeps ApiShip explicit as deprecated legacy compatibility only", () => {
    const contract = getLegacyApiShipDeprecationContract()

    expect(contract).toMatchObject({
      contour: "apiship",
      provider_id: APISHIP_PROVIDER_ID,
      provider_code: "apiship",
      posture: "legacy_compatibility_only",
      deprecated: true,
      scheduled_for_staged_removal: true,
      recommended_for_new_templates: false,
    })
    expect(isLegacyApiShipCompatibilityContour("apiship")).toBe(true)
    expect(isLegacyApiShipCompatibilityContour(DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE)).toBe(false)
    expect(APISHIP_LEGACY_DEPRECATION_NOTICE).toContain("Delivery Hub/direct Yandex")
    expect(APISHIP_SETTINGS_DEPRECATION_NOTICE).toContain("deprecated legacy compatibility")
  })

  it("keeps legacy ApiShip settings disabled by default", () => {
    expect(getDefaultApiShipSettings().enabled).toBe(false)
  })
})
