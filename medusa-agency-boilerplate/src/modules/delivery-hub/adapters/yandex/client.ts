import {
  decryptDeliveryHubCredentials,
  getDeliveryHubEncryptionState,
} from "../../security/encryption"
import { DeliveryHubError } from "../../errors"
import { redactYandexHeaders, redactYandexPayload, redactYandexText } from "./redaction"
import type { DeliveryConnectionRecord } from "../../domain/connection"

const YANDEX_API_BASE_URL = "https://b2b.taxi.yandex.net/b2b/cargo/integration/v2"

export class YandexDeliveryClient {
  constructor(private readonly connection: DeliveryConnectionRecord) {}

  async post<TResponse>(
    path: string,
    payload: Record<string, unknown>,
    correlationId: string
  ): Promise<TResponse> {
    const credentials = decryptDeliveryHubCredentials(
      this.connection.credentials_envelope,
      getDeliveryHubEncryptionState()
    )

    const headers = {
      Authorization: `Bearer ${credentials.token}`,
      "Content-Type": "application/json",
      "X-Request-ID": correlationId,
    }

    let response: Response

    try {
      response = await fetch(`${YANDEX_API_BASE_URL}${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      })
    } catch (error) {
      throw new DeliveryHubError({
        code: "DELIVERY_HUB_PROVIDER_ERROR",
        message: "Yandex Delivery request failed before provider response",
        status: 502,
        details: {
          provider_status: null,
          error_category: "transport",
          correlation_id: correlationId,
          request: {
            path,
            headers: redactYandexHeaders(headers),
            payload: redactYandexPayload(payload),
          },
          response: null,
          cause: error instanceof Error ? redactYandexText(error.message) : "Unknown transport error",
        },
      })
    }

    const text = await response.text()
    const data = text ? safeJsonParse(text) : {}

    if (!response.ok) {
      throw new DeliveryHubError({
        code: response.status === 401 || response.status === 403
          ? "DELIVERY_HUB_CREDENTIALS_INVALID"
          : "DELIVERY_HUB_PROVIDER_ERROR",
        message: `Yandex Delivery request failed with status ${response.status}`,
        status: response.status === 401 || response.status === 403 ? 401 : 502,
        details: {
          provider_status: response.status,
          error_category: normalizeYandexHttpErrorCategory(response.status),
          correlation_id: correlationId,
          request: {
            path,
            headers: redactYandexHeaders(headers),
            payload: redactYandexPayload(payload),
          },
          response: redactYandexPayload(
            typeof data === "object" && data ? (data as Record<string, unknown>) : { body: text }
          ),
        },
      })
    }

    return (typeof data === "object" && data ? data : {}) as TResponse
  }
}

function normalizeYandexHttpErrorCategory(status: number) {
  if (status === 401 || status === 403) {
    return "auth"
  }

  if (status === 408 || status === 429 || status >= 500) {
    return "provider_unavailable"
  }

  if (status >= 400) {
    return "provider_rejected"
  }

  return "provider_error"
}

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value)
  } catch {
    return { body: redactYandexText(value) }
  }
}
