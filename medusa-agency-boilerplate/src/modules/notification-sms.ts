export type NotificationSmsProviderId = "disabled" | "exolve"

export type NotificationSmsRuntime = {
  requestedProviderId: NotificationSmsProviderId
  providerId: NotificationSmsProviderId
  providerLabel: string
  exolveConfigured: boolean
  apiKey?: string
  sender?: string
  baseUrl: string
}

export const DEFAULT_NOTIFICATION_SMS_PROVIDER: NotificationSmsProviderId =
  "disabled"
export const DEFAULT_NOTIFICATION_SMS_CHANNEL = "sms"
export const DEFAULT_NOTIFICATION_SMS_SMOKE_MESSAGE =
  "SMS v1 smoke trigger completed."
export const DEFAULT_NOTIFICATION_SMS_SMOKE_TRIGGER_TYPE =
  "admin.notification_smoke.sms.requested"
export const DEFAULT_NOTIFICATION_SMS_SMOKE_TEMPLATE =
  "notification-sms-v1-smoke"
export const DEFAULT_ORDER_PLACED_SMS_NOTIFICATION_TEMPLATE =
  "order-placed-sms-v1"
export const DEFAULT_ORDER_PLACED_SMS_NOTIFICATION_TRIGGER_TYPE =
  "order.placed.customer.notification_requested"
export const DEFAULT_ORDER_SHIPPED_SMS_NOTIFICATION_TEMPLATE =
  "order-shipped-sms-v1"
export const DEFAULT_ORDER_SHIPPED_SMS_NOTIFICATION_TRIGGER_TYPE =
  "shipment.created.customer.notification_requested"
export const DEFAULT_PAYMENT_FAILED_SMS_NOTIFICATION_TEMPLATE =
  "payment-failed-sms-v1"
export const DEFAULT_PAYMENT_FAILED_SMS_NOTIFICATION_TRIGGER_TYPE =
  "payment_session.failed.customer.notification_requested"
export const DEFAULT_ORDER_CANCELED_SMS_NOTIFICATION_TEMPLATE =
  "order-canceled-sms-v1"
export const DEFAULT_ORDER_CANCELED_SMS_NOTIFICATION_TRIGGER_TYPE =
  "order.canceled.customer.notification_requested"
export const DEFAULT_MTS_EXOLVE_BASE_URL =
  "https://api.exolve.ru/messaging/v1/SendSMS"

function normalizeNotificationSmsProvider(
  value?: string | null
): NotificationSmsProviderId {
  return value?.trim().toLowerCase() === "exolve" ? "exolve" : "disabled"
}

function normalizeExolveBaseUrl(value?: string | null) {
  return value?.trim().replace(/\/+$/, "") || DEFAULT_MTS_EXOLVE_BASE_URL
}

export function getNotificationSmsProviderLabel(
  providerId: NotificationSmsProviderId
) {
  return providerId === "exolve" ? "MTS Exolve SMS" : "disabled"
}

export function normalizeSmsPhone(value?: string | null) {
  const rawValue = value?.trim() || ""

  if (!rawValue) {
    return null
  }

  const compact = rawValue.replace(/[^\d+]/g, "")

  if (!compact) {
    return null
  }

  if (compact.startsWith("00")) {
    const internationalDigits = compact.slice(2)

    if (/^\d{10,15}$/.test(internationalDigits)) {
      return `+${internationalDigits}`
    }

    return null
  }

  if (compact.startsWith("+")) {
    const internationalDigits = compact.slice(1)

    if (/^\d{10,15}$/.test(internationalDigits)) {
      return `+${internationalDigits}`
    }

    return null
  }

  const digits = compact.replace(/\D/g, "")

  if (digits.length === 11 && digits.startsWith("8")) {
    return `+7${digits.slice(1)}`
  }

  if (digits.length === 11 && digits.startsWith("7")) {
    return `+${digits}`
  }

  if (digits.length === 10 && digits.startsWith("9")) {
    return `+7${digits}`
  }

  return null
}

export function getNotificationSmsRuntime(): NotificationSmsRuntime {
  const requestedProviderId = normalizeNotificationSmsProvider(
    process.env.NOTIFICATION_SMS_PROVIDER
  )
  const apiKey = process.env.MTS_EXOLVE_API_KEY?.trim() || undefined
  const sender = process.env.MTS_EXOLVE_SENDER?.trim() || undefined
  const baseUrl = normalizeExolveBaseUrl(process.env.MTS_EXOLVE_BASE_URL)
  const exolveConfigured = requestedProviderId === "exolve" && !!apiKey && !!sender
  const providerId = exolveConfigured ? "exolve" : "disabled"

  return {
    requestedProviderId,
    providerId,
    providerLabel: getNotificationSmsProviderLabel(providerId),
    exolveConfigured,
    apiKey,
    sender,
    baseUrl,
  }
}

export function getNotificationSmsProviderDefinition() {
  const runtime = getNotificationSmsRuntime()

  if (runtime.providerId !== "exolve") {
    return null
  }

  return {
    resolve: "./src/modules/notification-exolve",
    id: "exolve",
    options: {
      channels: [DEFAULT_NOTIFICATION_SMS_CHANNEL],
      api_key: runtime.apiKey,
      sender: runtime.sender,
      base_url: runtime.baseUrl,
    },
  }
}
