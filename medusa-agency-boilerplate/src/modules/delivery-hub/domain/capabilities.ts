export type DeliveryHubProviderCapability =
  | "test_connection"
  | "list_pickup_points"
  | "list_pickup_windows"
  | "quote_warehouse_to_pickup_point"
  | "quote_dropoff_point_to_pickup_point"

export type DeliveryHubProviderDefinition = {
  code: string
  label: string
  capabilities: readonly DeliveryHubProviderCapability[]
  supported_mode_codes: readonly string[]
}
