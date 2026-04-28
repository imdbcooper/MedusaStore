export type DeliveryPickupPoint = {
  provider_point_id: string
  provider_point_code: string | null
  provider_operator_id?: string | null
  network_label?: string | null
  is_yandex_branded?: boolean | null
  is_market_partner?: boolean | null
  station_type?: string | null
  name: string
  address: string
  city: string | null
  region: string | null
  postal_code: string | null
  lat: number | null
  lng: number | null
  is_origin_dropoff_allowed: boolean
  is_destination_pickup_allowed: boolean
  payment_methods: string[]
  metadata: Record<string, unknown>
}
