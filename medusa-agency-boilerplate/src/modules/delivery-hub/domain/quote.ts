export type DeliveryQuote = {
  carrier_code: string
  carrier_label: string
  mode_code: string
  quote_key: string
  amount: number
  currency_code: string
  delivery_eta_min: number | null
  delivery_eta_max: number | null
  pickup_point_required: boolean
  pickup_point_ids: string[]
  pickup_points_embedded: unknown[]
  pickup_window_required: boolean
  pickup_window_options: unknown[]
  raw_reference: Record<string, unknown>
}
