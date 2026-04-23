export type DeliveryHubDiagnosticsSummary = {
  status: "ok" | "error"
  provider_status: string | null
  error_category: string | null
  message: string | null
  correlation_id: string | null
  checked_at: string
  redacted: true
}

export type DeliveryConnectionTestResult = {
  ok: boolean
  provider_code: string
  diagnostics: Record<string, unknown>
  diagnostics_summary?: DeliveryHubDiagnosticsSummary
}

export type DeliveryTestQuoteEcho = {
  connection_id: string
  mode_code: DeliveryTestQuoteInput["mode_code"]
  destination_point_id: string
  origin_point_id: string | null
  warehouse_id: string | null
  interval_utc: DeliveryTestQuoteInput["interval_utc"]
  currency_code: string | null
  item_count: number
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
