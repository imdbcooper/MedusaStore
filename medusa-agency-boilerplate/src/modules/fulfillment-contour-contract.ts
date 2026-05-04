export const FULFILLMENT_CONTOUR_CONTRACT_VERSION = 1

export const APISHIP_FULFILLMENT_PROVIDER_CODE = "apiship"
export const APISHIP_FULFILLMENT_PROVIDER_ID =
  `${APISHIP_FULFILLMENT_PROVIDER_CODE}_${APISHIP_FULFILLMENT_PROVIDER_CODE}`
export const APISHIP_PRIMARY_ADAPTER = "gorgo_apiship"

export const DEFAULT_FULFILLMENT_CONTOUR = {
  version: FULFILLMENT_CONTOUR_CONTRACT_VERSION,
  contour: "apiship_gorgo",
  provider_id: APISHIP_FULFILLMENT_PROVIDER_ID,
  provider_code: APISHIP_FULFILLMENT_PROVIDER_CODE,
  primary_adapter: APISHIP_PRIMARY_ADAPTER,
  buyer_facing_mode: "pickup_point_first",
  courier_delivery: "optional_later",
  posture: "default_for_new_templates",
  live_execution_enabled: false,
} as const

export function getDefaultFulfillmentContourContract() {
  return DEFAULT_FULFILLMENT_CONTOUR
}

export function isApiShipDefaultFulfillmentContour(providerCode: string) {
  return providerCode === DEFAULT_FULFILLMENT_CONTOUR.provider_code
}
