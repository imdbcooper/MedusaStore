import type {
  DeliveryConnectionPublic,
  DeliveryConnectionRecord,
} from "../domain/connection"

export function serializeDeliveryConnectionPublic(
  record: DeliveryConnectionRecord
): DeliveryConnectionPublic {
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
    config: record.config,
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
