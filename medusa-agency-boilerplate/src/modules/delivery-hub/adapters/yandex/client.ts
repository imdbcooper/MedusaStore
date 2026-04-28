import {
  decryptDeliveryHubCredentials,
  getDeliveryHubEncryptionState,
} from "../../security/encryption"
import { DeliveryHubError } from "../../errors"
import { redactYandexHeaders, redactYandexPayload, redactYandexText } from "./redaction"
import type { DeliveryConnectionRecord } from "../../domain/connection"
import { resolveYandexDeliveryApiBaseUrl } from "./base-url"

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
    const baseUrl = resolveYandexDeliveryApiBaseUrl(this.connection)

    const headers = {
      Authorization: `Bearer ${credentials.token}`,
      "Content-Type": "application/json",
      "X-Request-ID": correlationId,
    }

    let response: Response

    try {
      response = await fetch(`${baseUrl.base_url}${path}`, {
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
            base_url: baseUrl.base_url,
            base_url_source: baseUrl.source,
            connection_mode: baseUrl.mode,
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
    const errorCategory = normalizeYandexHttpErrorCategory(response.status, data)

    if (!response.ok) {
      const isAuthFailure = response.status === 401 || response.status === 403

      throw new DeliveryHubError({
        code: isAuthFailure
          ? "DELIVERY_HUB_CREDENTIALS_INVALID"
          : "DELIVERY_HUB_PROVIDER_ERROR",
        message: `Yandex Delivery request failed with status ${response.status}`,
        status: isAuthFailure ? 401 : 502,
        details: {
          provider_status: response.status,
          error_category: errorCategory,
          operator_hint: getYandexHttpErrorOperatorHint(response.status, errorCategory),
          correlation_id: correlationId,
          request: {
            base_url: baseUrl.base_url,
            base_url_source: baseUrl.source,
            connection_mode: baseUrl.mode,
            path,
            headers: redactYandexHeaders(headers),
            payload: redactYandexPayload(payload),
          },
          response: sanitizeYandexErrorResponse(data, text),
        },
      })
    }

    return (typeof data === "object" && data ? data : {}) as TResponse
  }
}

function normalizeYandexHttpErrorCategory(status: number, data?: unknown) {
  if (status === 403 && isYandexAccessBlockResponse(data)) {
    return "provider_access_blocked"
  }

  if (status === 401 || status === 403) {
    return "auth"
  }

  if (status === 404 && isYandexRouteMismatchResponse(data)) {
    return "provider_route_mismatch"
  }

  if (status === 408 || status === 429 || status >= 500) {
    return "provider_unavailable"
  }

  if (status >= 400) {
    return "provider_rejected"
  }

  return "provider_error"
}

function getYandexHttpErrorOperatorHint(status: number, category: string) {
  if (status === 403 && category === "provider_access_blocked") {
    return "Yandex returned an HTML access-block page before a normal API response. Check sandbox/API access, account permissions, and source network/IP reputation. No token or raw provider body is exposed."
  }

  if (status === 401 || status === 403) {
    return "Yandex rejected the credentials or account/API permission for this host and resource. Verify sandbox credentials, cabinet access, and that the token belongs to this API/account."
  }

  if (status === 404 && category === "provider_route_mismatch") {
    return "Yandex reported that the requested API path is unavailable on the selected host. Verify Yandex API host/mode and adapter path."
  }

  return "Yandex rejected or failed the request. Use provider_status, error_category, path, host, and correlation_id for safe diagnostics."
}

function sanitizeYandexErrorResponse(data: unknown, text: string) {
  if (isYandexAccessBlockResponse(data)) {
    return {
      body_type: "html",
      html_title: "403",
      access_block_page: true,
    }
  }

  return redactYandexPayload(
    typeof data === "object" && data ? (data as Record<string, unknown>) : { body: redactYandexText(text) }
  )
}

function isYandexRouteMismatchResponse(data: unknown) {
  if (!data || typeof data !== "object") {
    return false
  }

  const message = (data as Record<string, unknown>).message

  return typeof message === "string" && /no route for url/i.test(message)
}

function isYandexAccessBlockResponse(data: unknown) {
  if (!data || typeof data !== "object") {
    return false
  }

  const body = (data as Record<string, unknown>).body

  return typeof body === "string" &&
    /<html[\s>]/i.test(body) &&
    /<title>\s*403\s*<\/title>/i.test(body) &&
    /access to(?:&nbsp;|\s)+our service has been temporarily blocked/i.test(body)
}

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value)
  } catch {
    return { body: redactYandexText(value) }
  }
}
