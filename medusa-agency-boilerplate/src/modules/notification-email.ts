export type NotificationEmailProviderId = "local" | "sendgrid"

export type NotificationEmailRuntime = {
  requestedProviderId: NotificationEmailProviderId
  providerId: NotificationEmailProviderId
  from: string
  sendgridConfigured: boolean
  sendgridApiKey?: string
}

export type NotificationSmokeRequestInput = {
  apiKey: string
  to: string
  subject: string
  message: string
  backendUrl?: string
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
export const DEFAULT_LOCAL_MEDUSA_BACKEND_URL = "http://localhost:9000"

function normalizeNotificationEmailProvider(
  value?: string | null
): NotificationEmailProviderId {
  return value?.trim().toLowerCase() === "sendgrid" ? "sendgrid" : "local"
}

function normalizeBaseUrl(value?: string | null) {
  return (
    value?.trim().replace(/\/+$/, "") || DEFAULT_LOCAL_MEDUSA_BACKEND_URL
  )
}

function shellEscape(value: string) {
  return `'${value.replace(/'/g, `'"'"'`)}'`
}

export function getNotificationEmailRuntime(): NotificationEmailRuntime {
  const requestedProviderId = normalizeNotificationEmailProvider(
    process.env.NOTIFICATION_EMAIL_PROVIDER
  )
  const from =
    process.env.NOTIFICATION_EMAIL_FROM?.trim() || DEFAULT_NOTIFICATION_EMAIL_FROM
  const sendgridApiKey = process.env.SENDGRID_API_KEY?.trim() || undefined
  const sendgridConfigured = requestedProviderId === "sendgrid" && !!sendgridApiKey
  const providerId = sendgridConfigured ? "sendgrid" : "local"

  return {
    requestedProviderId,
    providerId,
    from,
    sendgridConfigured,
    sendgridApiKey,
  }
}

export function getNotificationEmailProviderDefinition() {
  const runtime = getNotificationEmailRuntime()

  if (runtime.providerId === "sendgrid") {
    return {
      resolve: "@medusajs/medusa/notification-sendgrid",
      id: "sendgrid",
      options: {
        channels: ["email"],
        api_key: runtime.sendgridApiKey,
        from: runtime.from,
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
