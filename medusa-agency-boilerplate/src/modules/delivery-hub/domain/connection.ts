import type {
  DeliveryHubCredentialsEnvelope,
  DeliveryHubCredentialsState,
} from "./credentials"

export type DeliveryConnectionStatus = "draft" | "active" | "error" | "disabled"
export type DeliveryConnectionMode = "test" | "live"

export type DeliveryConnectionRecord = {
  id: string
  provider_code: string
  name: string
  status: DeliveryConnectionStatus
  mode: DeliveryConnectionMode
  enabled: boolean
  country_code: string
  credentials_envelope: DeliveryHubCredentialsEnvelope | null
  credentials_state: DeliveryHubCredentialsState
  credentials_fingerprint: string | null
  credentials_last_validated_at: string | null
  credentials_last_error_code: string | null
  config: Record<string, unknown>
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type DeliveryConnectionUpsertInput = {
  id?: string
  provider_code: string
  name: string
  status?: DeliveryConnectionStatus
  mode: DeliveryConnectionMode
  enabled?: boolean
  country_code?: string
  credentials?: {
    token: string
  } | null
  config?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export type DeliveryConnectionPublic = {
  id: string
  provider_code: string
  name: string
  status: DeliveryConnectionStatus
  mode: DeliveryConnectionMode
  enabled: boolean
  country_code: string
  credentials_state: DeliveryHubCredentialsState
  credentials_fingerprint: string | null
  credentials_last_validated_at: string | null
  credentials_last_error_code: string | null
  credentials_present: boolean
  config: Record<string, unknown>
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}
