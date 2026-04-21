export const DELIVERY_HUB_MODULE_KEY = "deliveryHub"
export const DELIVERY_HUB_CONNECTIONS_TABLE = "delivery_connections"
export const DELIVERY_HUB_WAREHOUSES_TABLE = "delivery_warehouses"
export const DELIVERY_HUB_EVENT_LOGS_TABLE = "delivery_event_logs"
export const DELIVERY_HUB_DEFAULT_COUNTRY_CODE = "RU"
export const DELIVERY_HUB_PROVIDER_YANDEX = "yandex"

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
} as const
