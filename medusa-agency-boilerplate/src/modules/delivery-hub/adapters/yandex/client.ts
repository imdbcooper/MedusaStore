import {
  decryptDeliveryHubCredentials,
  getDeliveryHubEncryptionState,
} from "../../security/encryption"
import { DeliveryHubError } from "../../errors"
import { redactYandexHeaders, redactYandexPayload, redactYandexText } from "./redaction"
import type { DeliveryConnectionRecord } from "../../domain/connection"
import {
  resolveYandexDeliveryApiBaseUrl,
  resolveYandexDeliveryLegacyApiBaseUrl,
} from "./base-url"

export class YandexDeliveryClient {
  constructor(private readonly connection: DeliveryConnectionRecord) {}

  async post<TResponse>(
    path: string,
    payload: Record<string, unknown>,
    correlationId: string
  ): Promise<TResponse> {
    return this.postToResolvedBaseUrl<TResponse>({
      path,
      payload,
      correlationId,
      baseUrl: resolveYandexDeliveryApiBaseUrl(this.connection),
      headers: {},
    })
  }

  async postLegacy<TResponse>(
    path: string,
    payload: Record<string, unknown>,
    correlationId: string
  ): Promise<TResponse> {
    return this.postToResolvedBaseUrl<TResponse>({
      path,
      payload,
      correlationId,
      baseUrl: resolveYandexDeliveryLegacyApiBaseUrl(this.connection),
      headers: {
        Accept: "application/json",
        "Accept-Language": "ru",
      },
    })
  }

  private async postToResolvedBaseUrl<TResponse>(input: {
    path: string
    payload: Record<string, unknown>
    correlationId: string
    baseUrl: ReturnType<typeof resolveYandexDeliveryApiBaseUrl>
    headers: Record<string, string>
  }): Promise<TResponse> {
    const credentials = decryptDeliveryHubCredentials(
      this.connection.credentials_envelope,
      getDeliveryHubEncryptionState()
    )

    const headers = {
      Authorization: `Bearer ${credentials.token}`,
      "Content-Type": "application/json",
      "X-Request-ID": input.correlationId,
      ...input.headers,
    }

    let response: Response

    try {
      response = await fetch(`${input.baseUrl.base_url}${input.path}`, {
        method: "POST",
        headers,
        body: JSON.stringify(input.payload),
      })
    } catch (error) {
      throw new DeliveryHubError({
        code: "DELIVERY_HUB_PROVIDER_ERROR",
        message: "Yandex Delivery request failed before provider response",
        status: 502,
        details: {
          provider_status: null,
          error_category: "transport",
          correlation_id: input.correlationId,
          request: {
            base_url: input.baseUrl.base_url,
            base_url_source: input.baseUrl.source,
            connection_mode: input.baseUrl.mode,
            path: input.path,
            headers: redactYandexHeaders(headers),
            payload: redactYandexPayload(input.payload),
          },
          response: null,
          cause: error instanceof Error ? redactYandexText(error.message) : "Unknown transport error",
        },
      })
    }

    const text = await response.text()
    const data = text ? safeJsonParse(text) : {}
    const providerSafeCode = extractYandexSafeProviderCode(data)
    const errorCategory = normalizeYandexHttpErrorCategory(response.status, input.path, data, providerSafeCode)

    if (!response.ok) {
      const isAuthFailure = response.status === 401
      const isSafeProviderRejection = isYandexSafeProviderRejection(response.status, errorCategory, providerSafeCode)

      throw new DeliveryHubError({
        code: isAuthFailure
          ? "DELIVERY_HUB_CREDENTIALS_INVALID"
          : "DELIVERY_HUB_PROVIDER_ERROR",
        message: `Yandex Delivery request failed with status ${response.status}`,
        status: isAuthFailure ? 401 : isSafeProviderRejection ? 409 : 502,
        details: {
          provider_status: response.status,
          error_category: errorCategory,
          provider_code: providerSafeCode,
          customer_safe: isSafeProviderRejection,
          operator_hint: getYandexHttpErrorOperatorHint(response.status, errorCategory, providerSafeCode),
          correlation_id: input.correlationId,
          request: {
            base_url: input.baseUrl.base_url,
            base_url_source: input.baseUrl.source,
            connection_mode: input.baseUrl.mode,
            path: input.path,
            headers: redactYandexHeaders(headers),
            payload: redactYandexPayload(input.payload),
          },
          response: sanitizeYandexErrorResponse(data, text),
        },
      })
    }

    return (typeof data === "object" && data ? data : {}) as TResponse
  }
}

function normalizeYandexHttpErrorCategory(
  status: number,
  path: string,
  data?: unknown,
  providerSafeCode?: string | null
) {
  if (status === 403 && isYandexAccessBlockResponse(data)) {
    return "provider_access_blocked"
  }

  if (status === 401) {
    return "auth"
  }

  if (status === 403) {
    return "provider_permission_denied"
  }

  if (status === 404 && isYandexRouteMismatchResponse(data)) {
    return "provider_route_mismatch"
  }

  if (isYandexNoZoneOrNoOfferCode(providerSafeCode)) {
    return "provider_route_unavailable"
  }

  if (status === 400 && isYandexSafeCalculateRouteRejection(path, data)) {
    return "provider_route_unavailable"
  }

  if (status === 408 || status === 429 || status >= 500) {
    return "provider_unavailable"
  }

  if (status >= 400) {
    return "provider_rejected"
  }

  return "provider_error"
}

function getYandexHttpErrorOperatorHint(
  status: number,
  category: string,
  providerSafeCode?: string | null
) {
  if (status === 403 && category === "provider_access_blocked") {
    return "Yandex returned an HTML access-block page before a normal API response. Check sandbox/API access, account permissions, and source network/IP reputation. No token or raw provider body is exposed."
  }

  if (status === 403) {
    return "Yandex denied this API resource for the current account, sandbox/live mode, host, or network. Verify cabinet/API access, account permissions, selected host/mode, and source IP reputation. No token or raw provider body is exposed."
  }

  if (status === 401) {
    return "Yandex rejected the credentials for this host and resource. Verify sandbox credentials, cabinet access, and that the token belongs to this API/account."
  }

  if (status === 404 && category === "provider_route_mismatch") {
    return "Yandex reported that the requested API path is unavailable on the selected host. Verify Yandex API host/mode and adapter path."
  }

  if (category === "provider_route_unavailable") {
    return "Yandex could not price this origin→PVZ route. Verify warehouse city is a city (for example Москва, not Russia), origin and destination coordinates match their addresses, and the selected PVZ is serviceable. No raw provider body is exposed."
  }

  if (providerSafeCode && /permission|access|forbidden|denied/i.test(providerSafeCode)) {
    return "Yandex rejected access to this resource for the current account/mode/host. Verify cabinet/API permissions and sandbox/live mode. No token or raw provider body is exposed."
  }

  return "Yandex rejected or failed the request. Use provider_status, error_category, provider_code, path, host, and correlation_id for safe diagnostics."
}

function sanitizeYandexErrorResponse(data: unknown, text: string) {
  if (isYandexAccessBlockResponse(data)) {
    return {
      body_type: "html",
      html_title: "403",
      access_block_page: true,
    }
  }

  const providerSafeCode = extractYandexSafeProviderCode(data)

  return {
    body_type: typeof data === "object" && data ? "json" : "text",
    provider_code: providerSafeCode,
    redacted: true,
    summary: providerSafeCode
      ? "Provider rejected request with a safe diagnostic code. Raw provider body is not exposed."
      : "Provider rejected request. Raw provider body is not exposed.",
    body: typeof data === "object" && data
      ? undefined
      : redactYandexText(text),
  }
}

function isYandexRouteMismatchResponse(data: unknown) {
  if (!data || typeof data !== "object") {
    return false
  }

  const message = (data as Record<string, unknown>).message

  return typeof message === "string" && /no route for url/i.test(message)
}

function isYandexSafeProviderRejection(
  status: number,
  category: string,
  providerSafeCode?: string | null
) {
  if (category === "provider_route_unavailable" && status >= 400 && status < 500) {
    return true
  }

  if (status === 403 && providerSafeCode && /permission|access|forbidden|denied/i.test(providerSafeCode)) {
    return true
  }

  return false
}

function extractYandexSafeProviderCode(data: unknown) {
  const values = collectProviderSafeCodeCandidates(data)

  for (const value of values) {
    const safeCode = normalizeYandexSafeProviderCode(value)

    if (safeCode) {
      return safeCode
    }
  }

  return null
}

function collectProviderSafeCodeCandidates(data: unknown, depth = 0): string[] {
  if (depth > 4 || data == null) {
    return []
  }

  if (typeof data === "string") {
    return [data]
  }

  if (Array.isArray(data)) {
    return data.flatMap((value) => collectProviderSafeCodeCandidates(value, depth + 1))
  }

  if (typeof data !== "object") {
    return []
  }

  const record = data as Record<string, unknown>
  const directKeys = [
    "code",
    "error_code",
    "errorCode",
    "type",
    "reason",
    "message",
    "description",
    "details",
  ]
  const directValues = directKeys.flatMap((key) => collectProviderSafeCodeCandidates(record[key], depth + 1))
  const nestedValues = ["error", "errors", "data", "response", "body"].flatMap((key) => {
    if (!Object.prototype.hasOwnProperty.call(record, key)) {
      return []
    }

    return collectProviderSafeCodeCandidates(record[key], depth + 1)
  })

  return [...directValues, ...nestedValues]
}

function normalizeYandexSafeProviderCode(value: string) {
  const normalized = value
    .trim()
    .replace(/["'`]/g, "")
    .replace(/\s+/g, " ")

  if (!normalized || normalized.length > 160) {
    return null
  }

  if (/estimating\.claim\.no_zone_id/i.test(normalized)) {
    return "estimating.claim.no_zone_id"
  }

  if (/errors\.suitable_offer_not_found/i.test(normalized)) {
    return "errors.suitable_offer_not_found"
  }

  if (/no[_ -]?zone/i.test(normalized)) {
    return "no_zone_id"
  }

  if (/suitable[_ -]?offer[_ -]?not[_ -]?found|offer[_ -]?not[_ -]?found/i.test(normalized)) {
    return "suitable_offer_not_found"
  }

  if (/permission|access|forbidden|denied/i.test(normalized)) {
    return "provider_access_or_permission_denied"
  }

  return null
}

function isYandexNoZoneOrNoOfferCode(providerSafeCode?: string | null) {
  return Boolean(providerSafeCode && /no_zone|suitable_offer_not_found|offer_not_found/i.test(providerSafeCode))
}

function isYandexSafeCalculateRouteRejection(path: string, _data: unknown) {
  return path === "/offers/calculate" || path === "/check-price"
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
