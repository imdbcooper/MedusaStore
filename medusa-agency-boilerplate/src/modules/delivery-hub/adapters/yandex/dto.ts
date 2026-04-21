export type YandexPickupPointDto = {
  id?: string | number
  code?: string | null
  name?: string | null
  address?: {
    full_address?: string | null
    locality?: string | null
    province?: string | null
    zip_code?: string | null
    latitude?: number | string | null
    longitude?: number | string | null
  } | null
  available_for_dropoff?: boolean | null
  payment_methods?: string[] | null
}

export type YandexPickupWindowDto = {
  date?: string | null
  time_from?: string | null
  time_to?: string | null
  interval_utc?: {
    from?: string | null
    to?: string | null
  } | null
}

export type YandexPricingOfferDto = {
  offer_id?: string | null
  price?: {
    amount?: number | string | null
    currency?: string | null
  } | null
  eta?: {
    days_min?: number | null
    days_max?: number | null
  } | null
}
