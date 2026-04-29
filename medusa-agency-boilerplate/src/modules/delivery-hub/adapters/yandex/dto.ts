export type YandexPickupPointDto = {
  id?: string | number
  code?: string | null
  operator_id?: string | null
  operator_station_id?: string | null
  type?: string | null
  name?: string | null
  address?: {
    full_address?: string | null
    locality?: string | null
    province?: string | null
    zip_code?: string | null
    latitude?: number | string | null
    longitude?: number | string | null
  } | null
  position?: {
    latitude?: number | string | null
    longitude?: number | string | null
  } | null
  available_for_dropoff?: boolean | null
  is_yandex_branded?: boolean | null
  is_market_partner?: boolean | null
  payment_methods?: string[] | null
}

export type YandexPickupWindowDto = {
  from?: string | null
  to?: string | null
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
  offer_details?: {
    delivery_interval?: {
      min?: string | null
      max?: string | null
      policy?: string | null
    } | null
    pickup_interval?: {
      min?: string | null
      max?: string | null
    } | null
    pricing?: string | null
    pricing_total?: string | null
  } | null
  pricing?: string | null
  pricing_total?: string | null
  delivery_interval?: {
    min?: string | null
    max?: string | null
    policy?: string | null
  } | null
  pickup_interval?: {
    min?: string | null
    max?: string | null
  } | null
  currency?: string | null
}

export type YandexCalculateOffersDto = {
  offers?: YandexPricingOfferDto[] | null
  data?: {
    offers?: YandexPricingOfferDto[] | null
  } | null
}

export type YandexCheckPriceDto = {
  price?: string | number | null
  currency?: string | null
  currency_rules?: {
    code?: string | null
    text?: string | null
    template?: string | null
    sign?: string | null
  } | null
  requirements?: {
    taxi_class?: string | null
  } | null
  distance_meters?: number | string | null
  eta?: number | string | null
  zone_id?: string | null
}
