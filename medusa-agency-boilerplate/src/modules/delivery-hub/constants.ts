export const DELIVERY_HUB_MODULE_KEY = "deliveryHub"
export const DELIVERY_HUB_CONNECTIONS_TABLE = "delivery_connections"
export const DELIVERY_HUB_WAREHOUSES_TABLE = "delivery_warehouses"
export const DELIVERY_HUB_EVENT_LOGS_TABLE = "delivery_event_logs"
export const DELIVERY_HUB_DEFAULT_COUNTRY_CODE = "RU"
export const DELIVERY_HUB_PROVIDER_YANDEX = "yandex"
export const DELIVERY_HUB_SUPPORTED_PUBLIC_PROVIDER_CODES = [DELIVERY_HUB_PROVIDER_YANDEX] as const
export const DELIVERY_HUB_QUOTE_REFERENCE_ID_PATTERN = /^dhsel_(?:[a-f0-9]{32}|t1_[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/

export const DELIVERY_HUB_CONNECTION_STATUS = {
  draft: "draft",
  active: "active",
  error: "error",
  disabled: "disabled",
} as const

export const DELIVERY_HUB_CONNECTION_MODE = {
  test: "test",
  live: "live",
} as const

export const DELIVERY_HUB_CREDENTIALS_STATE = {
  empty: "empty",
  sealed: "sealed",
  disabled: "disabled",
  invalid: "invalid",
} as const

export const DELIVERY_HUB_MODE_CODE = {
  warehouseToPickupPoint: "warehouse_to_pickup_point",
  dropoffPointToPickupPoint: "dropoff_point_to_pickup_point",
} as const

export const DELIVERY_HUB_LOG_KIND = {
  connectionTest: "connection_test",
  pickupPoints: "pickup_points",
  pickupWindows: "pickup_windows",
  quote: "quote",
  credentials: "credentials",
  shippingOptionManualSync: "shipping_option_manual_sync",
} as const
