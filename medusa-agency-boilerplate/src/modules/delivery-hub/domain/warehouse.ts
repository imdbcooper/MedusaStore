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
  metadata: Record<string, unknown>
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
  metadata?: Record<string, unknown>
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
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}
