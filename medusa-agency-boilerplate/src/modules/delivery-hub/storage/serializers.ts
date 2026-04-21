import type {
  DeliveryConnectionPublic,
  DeliveryConnectionRecord,
} from "../domain/connection"
import type {
  DeliveryWarehousePublic,
  DeliveryWarehouseRecord,
} from "../domain/warehouse"

export function serializeDeliveryConnectionPublic(
  record: DeliveryConnectionRecord,
  warehouses?: Map<string, DeliveryWarehouseRecord>
): DeliveryConnectionPublic {
  const defaultWarehouseId =
    typeof record.config.default_warehouse_id === "string" && record.config.default_warehouse_id.trim()
      ? record.config.default_warehouse_id.trim()
      : null
  const defaultWarehouse = defaultWarehouseId ? warehouses?.get(defaultWarehouseId) ?? null : null

  return {
    id: record.id,
    provider_code: record.provider_code,
    name: record.name,
    status: record.status,
    mode: record.mode,
    enabled: record.enabled,
    country_code: record.country_code,
    credentials_state: record.credentials_state,
    credentials_fingerprint: record.credentials_fingerprint,
    credentials_last_validated_at: record.credentials_last_validated_at,
    credentials_last_error_code: record.credentials_last_error_code,
    credentials_present: !!record.credentials_envelope,
    config: {
      ...record.config,
      ...(defaultWarehouse
        ? {
            default_warehouse: serializeDeliveryWarehousePublic(defaultWarehouse),
          }
        : {}),
    },
    metadata: record.metadata,
    created_at: record.created_at,
    updated_at: record.updated_at,
  }
}

export function serializeDeliveryWarehousePublic(
  record: DeliveryWarehouseRecord
): DeliveryWarehousePublic {
  return {
    id: record.id,
    name: record.name,
    enabled: record.enabled,
    country_code: record.country_code,
    city: record.city,
    address_line_1: record.address_line_1,
    contact_name: record.contact_name,
    contact_phone: record.contact_phone,
    provider_code: record.provider_code,
    provider_warehouse_id: record.provider_warehouse_id,
    metadata: record.metadata,
    created_at: record.created_at,
    updated_at: record.updated_at,
  }
}

export function parseJsonObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}
