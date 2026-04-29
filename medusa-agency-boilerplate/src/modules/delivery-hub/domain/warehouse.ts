export type DeliveryWarehouseMetadata = Record<string, unknown> & {
  postal_code?: string
  contact_email?: string
  coordinates?: [number, number] | null
  lat?: number
  lng?: number
  fullname?: string
}

export type DeliveryWarehouseRecord = {
  id: string
  name: string
  enabled: boolean
  country_code: string
  city: string | null
  address_line_1: string | null
  contact_name: string | null
  contact_phone: string | null
  provider_code: string | null
  provider_warehouse_id: string | null
  metadata: DeliveryWarehouseMetadata
  created_at: string
  updated_at: string
}

export type DeliveryWarehouseUpsertInput = {
  id?: string
  name: string
  enabled?: boolean
  country_code?: string
  city?: string | null
  address_line_1?: string | null
  contact_name?: string | null
  contact_phone?: string | null
  provider_code?: string | null
  provider_warehouse_id?: string | null
  metadata?: DeliveryWarehouseMetadata
}

export type DeliveryWarehousePublic = {
  id: string
  name: string
  enabled: boolean
  country_code: string
  city: string | null
  address_line_1: string | null
  contact_name: string | null
  contact_phone: string | null
  provider_code: string | null
  provider_warehouse_id: string | null
  metadata: DeliveryWarehouseMetadata
  created_at: string
  updated_at: string
}
