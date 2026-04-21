export type DeliveryConnectionTestResult = {
  ok: boolean
  provider_code: string
  diagnostics: Record<string, unknown>
}

export type DeliveryTestQuoteInput = {
  connection_id: string
  mode_code: "warehouse_to_pickup_point" | "dropoff_point_to_pickup_point"
  currency_code?: string
  destination_point_id: string
  origin_point_id?: string | null
  warehouse_id?: string | null
  interval_utc?: {
    from: string
    to: string
  } | null
  items?: Array<{
    quantity?: number
    weight_grams?: number
    price?: number
  }>
}
