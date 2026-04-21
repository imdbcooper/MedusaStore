import { DELIVERY_HUB_MODE_CODE, DELIVERY_HUB_PROVIDER_YANDEX } from "../../constants"

export const yandexAdapterDefinition = {
  code: DELIVERY_HUB_PROVIDER_YANDEX,
  label: "Yandex Delivery",
  capabilities: [
    "test_connection",
    "list_pickup_points",
    "list_pickup_windows",
    "quote_warehouse_to_pickup_point",
    "quote_dropoff_point_to_pickup_point",
  ],
  supported_mode_codes: [
    DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint,
    DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
  ],
} as const
