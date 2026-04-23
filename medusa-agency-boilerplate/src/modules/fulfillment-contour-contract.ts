import { DELIVERY_HUB_PROVIDER_YANDEX } from "./delivery-hub/constants"
import { DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE } from "./delivery-hub/provider-surface"
import { APISHIP_PROVIDER_ID } from "./apiship"

export const FULFILLMENT_CONTOUR_CONTRACT_VERSION = 1

export const DEFAULT_FULFILLMENT_CONTOUR = {
  version: FULFILLMENT_CONTOUR_CONTRACT_VERSION,
  contour: "delivery_hub",
  provider_id: DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
  provider_code: DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
  primary_adapter: DELIVERY_HUB_PROVIDER_YANDEX,
  posture: "default_for_new_templates",
  live_execution_enabled: false,
} as const

export const LEGACY_APISHIP_DEPRECATION_CONTRACT = {
  version: FULFILLMENT_CONTOUR_CONTRACT_VERSION,
  contour: "apiship",
  provider_id: APISHIP_PROVIDER_ID,
  provider_code: "apiship",
  posture: "legacy_compatibility_only",
  deprecated: true,
  scheduled_for_staged_removal: true,
  recommended_for_new_templates: false,
} as const

export function getDefaultFulfillmentContourContract() {
  return DEFAULT_FULFILLMENT_CONTOUR
}

export function getLegacyApiShipDeprecationContract() {
  return LEGACY_APISHIP_DEPRECATION_CONTRACT
}

export function isDeliveryHubDefaultFulfillmentContour(providerCode: string) {
  return providerCode === DEFAULT_FULFILLMENT_CONTOUR.provider_code
}

export function isLegacyApiShipCompatibilityContour(providerCode: string) {
  return providerCode === LEGACY_APISHIP_DEPRECATION_CONTRACT.provider_code
}
