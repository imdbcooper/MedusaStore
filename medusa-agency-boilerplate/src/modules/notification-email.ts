export type NotificationEmailProviderId = "local" | "unisender"

export type NotificationEmailRuntime = {
  requestedProviderId: NotificationEmailProviderId
  providerId: NotificationEmailProviderId
  from: string
  unisenderConfigured: boolean
  unisenderApiKey?: string
  unisenderBaseUrl?: string
}

export type NotificationSmokeRequestInput = {
  apiKey: string
  to: string
  subject: string
  message: string
  backendUrl?: string
}

export type NotificationDedupeKeyInput = {
  triggerType: string
  resourceType: string
  resourceId: string
  channel: string
  template: string
  recipient: string
}

export const DEFAULT_NOTIFICATION_EMAIL_PROVIDER: NotificationEmailProviderId =
  "local"
export const DEFAULT_NOTIFICATION_EMAIL_FROM = "notifications@example.com"
export const DEFAULT_NOTIFICATION_SMOKE_SUBJECT = "Notification v1 smoke"
export const DEFAULT_NOTIFICATION_SMOKE_MESSAGE =
  "Notification v1 smoke trigger completed."
export const DEFAULT_NOTIFICATION_SMOKE_TRIGGER_TYPE =
  "admin.notification_smoke.requested"
export const DEFAULT_ORDER_PLACED_NOTIFICATION_TEMPLATE =
  "order-placed-v1"
export const DEFAULT_ORDER_PLACED_NOTIFICATION_TRIGGER_TYPE =
  "order.placed.customer.notification_requested"
export const DEFAULT_ORDER_SHIPPED_NOTIFICATION_TEMPLATE =
  "order-shipped-v1"
export const DEFAULT_ORDER_SHIPPED_NOTIFICATION_TRIGGER_TYPE =
  "shipment.created.customer.notification_requested"
export const DEFAULT_PAYMENT_FAILED_NOTIFICATION_TEMPLATE =
  "payment-failed-v1"
export const DEFAULT_PAYMENT_FAILED_NOTIFICATION_TRIGGER_TYPE =
  "payment_session.failed.customer.notification_requested"
export const DEFAULT_ORDER_CANCELED_NOTIFICATION_TEMPLATE =
  "order-canceled-v1"
export const DEFAULT_ORDER_CANCELED_NOTIFICATION_TRIGGER_TYPE =
  "order.canceled.customer.notification_requested"
export const DEFAULT_LOCAL_MEDUSA_BACKEND_URL = "http://localhost:9000"
export const DEFAULT_UNISENDER_BASE_URL = "https://go1.unisender.ru"
export const NOTIFICATION_DEDUPE_AUTHORITY = "notification_storage" as const
export const NOTIFICATION_DEDUPE_STRATEGY = "query_before_create" as const
export const NOTIFICATION_DEDUPE_RACE_WINDOW =
  "best_effort_query_before_create_race_window_remains" as const
export const NOTIFICATION_DEDUPE_CANONICAL_FIELDS = [
  "trigger_type",
  "resource_type",
  "resource_id",
  "channel",
  "template",
  "normalized_recipient",
] as const

function normalizeNotificationEmailProvider(
  value?: string | null
): NotificationEmailProviderId {
  return value?.trim().toLowerCase() === "unisender" ? "unisender" : "local"
}

function normalizeBaseUrl(value?: string | null) {
  return (
    value?.trim().replace(/\/+$/, "") || DEFAULT_LOCAL_MEDUSA_BACKEND_URL
  )
}

function normalizeUniSenderBaseUrl(value?: string | null) {
  const normalized = value?.trim()

  if (!normalized) {
    return undefined
  }

  return normalized.replace(/\/+$/, "") || undefined
}

function shellEscape(value: string) {
  return `'${value.replace(/'/g, `"'"'`)}'`
}

function sanitizeNotificationDedupeValue(value: string) {
  return value.trim().replace(/\s+/g, " ")
}

export function normalizeNotificationRecipient(value?: string | null) {
  const normalized = value?.trim().toLowerCase() || ""

  return normalized || null
}

export function buildNotificationDedupeKey(
  input: NotificationDedupeKeyInput
) {
  const recipient = normalizeNotificationRecipient(input.recipient)

  return [
    `trigger_type=${sanitizeNotificationDedupeValue(input.triggerType)}`,
    `resource_type=${sanitizeNotificationDedupeValue(input.resourceType)}`,
    `resource_id=${sanitizeNotificationDedupeValue(input.resourceId)}`,
    `channel=${sanitizeNotificationDedupeValue(input.channel).toLowerCase()}`,
    `template=${sanitizeNotificationDedupeValue(input.template)}`,
    `normalized_recipient=${recipient ?? ""}`,
  ].join("|")
}

export function getNotificationEmailRuntime(): NotificationEmailRuntime {
  const requestedProviderId = normalizeNotificationEmailProvider(
    process.env.NOTIFICATION_EMAIL_PROVIDER
  )
  const from =
    process.env.NOTIFICATION_EMAIL_FROM?.trim() || DEFAULT_NOTIFICATION_EMAIL_FROM
  const unisenderApiKey = process.env.UNISENDER_API_KEY?.trim() || undefined
  const unisenderBaseUrl =
    normalizeUniSenderBaseUrl(process.env.UNISENDER_BASE_URL) ||
    DEFAULT_UNISENDER_BASE_URL
  const unisenderConfigured =
    requestedProviderId === "unisender" && !!unisenderApiKey
  const providerId = unisenderConfigured ? "unisender" : "local"

  return {
    requestedProviderId,
    providerId,
    from,
    unisenderConfigured,
    unisenderApiKey,
    unisenderBaseUrl,
  }
}

export function getNotificationEmailProviderDefinition() {
  const runtime = getNotificationEmailRuntime()

  if (runtime.providerId === "unisender") {
    return {
      resolve: "./src/modules/notification-unisender",
      id: "unisender",
      options: {
        channels: ["email"],
        api_key: runtime.unisenderApiKey,
        from: runtime.from,
        base_url: runtime.unisenderBaseUrl,
      },
    }
  }

  return {
    resolve: "@medusajs/medusa/notification-local",
    id: "local",
    options: {
      channels: ["email"],
    },
  }
}

export function encodeAdminApiKeyAsBasicAuth(apiKey: string) {
  return Buffer.from(`${apiKey.trim()}:`).toString("base64")
}

export function getNotificationSmokeUrl(backendUrl?: string) {
  return `${normalizeBaseUrl(backendUrl)}/admin/notifications/smoke`
}

export function getNotificationSmokeCurlCommand(
  input: NotificationSmokeRequestInput
) {
  const authorization = encodeAdminApiKeyAsBasicAuth(input.apiKey)
  const payload = JSON.stringify({
    to: input.to,
    subject: input.subject,
    message: input.message,
  })

  return [
    "curl --fail-with-body",
    `  -X POST ${shellEscape(getNotificationSmokeUrl(input.backendUrl))}`,
    `  -H ${shellEscape(`Authorization: Basic ${authorization}`)}`,
    `  -H ${shellEscape("Content-Type: application/json")}`,
    `  --data ${shellEscape(payload)}`,
  ].join(" \\\n")
}
