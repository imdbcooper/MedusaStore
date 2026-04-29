import type { DeliveryConnectionRecord } from "../../domain/connection"
import {
  YANDEX_DELIVERY_ALLOWED_API_BASE_URLS,
  YANDEX_DELIVERY_API_BASE_URL_MIGRATIONS,
  YANDEX_DELIVERY_LEGACY_PRODUCTION_API_BASE_URL,
  YANDEX_DELIVERY_LEGACY_SANDBOX_API_BASE_URL,
  YANDEX_DELIVERY_PRODUCTION_API_BASE_URL,
  YANDEX_DELIVERY_SANDBOX_API_BASE_URL,
} from "./endpoints"

export {
  YANDEX_DELIVERY_LEGACY_PRODUCTION_API_BASE_URL,
  YANDEX_DELIVERY_LEGACY_SANDBOX_API_BASE_URL,
  YANDEX_DELIVERY_PRODUCTION_API_BASE_URL,
  YANDEX_DELIVERY_SANDBOX_API_BASE_URL,
}

export type YandexDeliveryResolvedApiBaseUrl = {
  base_url: string
  source: "connection_mode" | "connection_config"
  mode: DeliveryConnectionRecord["mode"]
}

export type YandexDeliveryLegacyResolvedApiBaseUrl = YandexDeliveryResolvedApiBaseUrl

export function resolveYandexDeliveryApiBaseUrl(
  connection: DeliveryConnectionRecord
): YandexDeliveryResolvedApiBaseUrl {
  const configured = normalizeYandexDeliveryApiBaseUrl(connection.config?.api_base_url)

  if (configured) {
    return {
      base_url: configured,
      source: "connection_config",
      mode: connection.mode,
    }
  }

  return {
    base_url: connection.mode === "test"
      ? YANDEX_DELIVERY_SANDBOX_API_BASE_URL
      : YANDEX_DELIVERY_PRODUCTION_API_BASE_URL,
    source: "connection_mode",
    mode: connection.mode,
  }
}

export function resolveYandexDeliveryLegacyApiBaseUrl(
  connection: DeliveryConnectionRecord
): YandexDeliveryLegacyResolvedApiBaseUrl {
  const configured = normalizeYandexDeliveryLegacyApiBaseUrl(connection.config?.api_base_url)

  if (configured) {
    return {
      base_url: configured,
      source: "connection_config",
      mode: connection.mode,
    }
  }

  return {
    base_url: connection.mode === "test"
      ? YANDEX_DELIVERY_LEGACY_SANDBOX_API_BASE_URL
      : YANDEX_DELIVERY_LEGACY_PRODUCTION_API_BASE_URL,
    source: "connection_mode",
    mode: connection.mode,
  }
}

export function normalizeYandexDeliveryApiBaseUrl(value: unknown) {
  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim().replace(/\/+$/, "")

  if (!normalized) {
    return null
  }

  return YANDEX_DELIVERY_API_BASE_URL_MIGRATIONS.get(normalized) ??
    (YANDEX_DELIVERY_ALLOWED_API_BASE_URLS.has(normalized) ? normalized : null)
}

export function normalizeYandexDeliveryLegacyApiBaseUrl(value: unknown) {
  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim().replace(/\/+$/, "")

  if (!normalized) {
    return null
  }

  if (normalized === YANDEX_DELIVERY_PRODUCTION_API_BASE_URL) {
    return YANDEX_DELIVERY_LEGACY_PRODUCTION_API_BASE_URL
  }

  if (normalized === YANDEX_DELIVERY_SANDBOX_API_BASE_URL) {
    return YANDEX_DELIVERY_LEGACY_SANDBOX_API_BASE_URL
  }

  if (
    normalized === YANDEX_DELIVERY_LEGACY_PRODUCTION_API_BASE_URL ||
    normalized === YANDEX_DELIVERY_LEGACY_SANDBOX_API_BASE_URL
  ) {
    return normalized
  }

  return null
}
