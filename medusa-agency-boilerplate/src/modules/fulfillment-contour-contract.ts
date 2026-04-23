import { DELIVERY_HUB_PROVIDER_YANDEX } from "./delivery-hub/constants"
import { DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE } from "./delivery-hub/provider-surface"

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

export function getDefaultFulfillmentContourContract() {
  return DEFAULT_FULFILLMENT_CONTOUR
}


export function isDeliveryHubDefaultFulfillmentContour(providerCode: string) {
  return providerCode === DEFAULT_FULFILLMENT_CONTOUR.provider_code
}
