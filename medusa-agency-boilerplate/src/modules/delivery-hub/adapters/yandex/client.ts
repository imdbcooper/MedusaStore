import {
  decryptDeliveryHubCredentials,
  getDeliveryHubEncryptionState,
} from "../../security/encryption"
import { DeliveryHubError } from "../../errors"
import { redactYandexHeaders, redactYandexPayload } from "./redaction"
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

    const response = await fetch(`${YANDEX_API_BASE_URL}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    })

    const text = await response.text()
    const data = text ? safeJsonParse(text) : {}

    if (!response.ok) {
      throw new DeliveryHubError({
        code: "DELIVERY_HUB_PROVIDER_ERROR",
        message: `Yandex Delivery request failed with status ${response.status}`,
        status: 502,
        details: {
          provider_status: response.status,
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

    return data as TResponse
  }
}

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value)
  } catch {
    return { body: value }
  }
}
