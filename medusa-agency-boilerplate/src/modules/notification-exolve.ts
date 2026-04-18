import type { Logger, NotificationTypes } from "@medusajs/framework/types"
import {
  AbstractNotificationProviderService,
  MedusaError,
} from "@medusajs/framework/utils"
import {
  DEFAULT_MTS_EXOLVE_BASE_URL,
  normalizeSmsPhone,
} from "./notification-sms"

type InjectedDependencies = {
  logger: Logger
}

type ExolveNotificationServiceOptions = {
  api_key?: string
  sender?: string
  base_url?: string
}

type ExolveServiceConfig = {
  apiKey: string
  sender: string
  baseUrl: string
}

const DEFAULT_EXOLVE_MESSAGE = "Notification"

class ExolveNotificationService extends AbstractNotificationProviderService {
  static identifier = "notification-exolve"

  protected config_: ExolveServiceConfig
  protected logger_: Logger

  constructor(
    { logger }: InjectedDependencies,
    options: ExolveNotificationServiceOptions
  ) {
    super()

    this.logger_ = logger
    this.config_ = {
      apiKey: options.api_key?.trim() || "",
      sender: options.sender?.trim() || "",
      baseUrl: normalizeExolveBaseUrl(options.base_url),
    }
  }

  static validateOptions(options: Record<string, unknown>) {
    const apiKey = String(options.api_key ?? "").trim()
    const sender = String(options.sender ?? "").trim()

    if (!apiKey) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "MTS_EXOLVE_API_KEY is required for the MTS Exolve SMS notification provider."
      )
    }

    if (!sender) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "MTS_EXOLVE_SENDER is required for the MTS Exolve SMS notification provider."
      )
    }
  }

  async send(
    notification: NotificationTypes.ProviderSendNotificationDTO
  ): Promise<NotificationTypes.ProviderSendNotificationResultsDTO> {
    if (!notification) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "No notification information provided"
      )
    }

    const recipient = normalizeSmsPhone(notification.to)

    if (!recipient) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "A normalized SMS phone number is required to send an SMS notification."
      )
    }

    const message = buildNotificationSmsMessage(notification)

    if (!message) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "SMS notification content is required."
      )
    }

    const sender = notification.from?.trim() || this.config_.sender
    const payload = {
      sender,
      destination: recipient,
      text: message,
    }

    const response = await fetch(this.config_.baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config_.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    const responseBody = await readResponseBody(response)

    if (!response.ok) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Failed to send SMS via MTS Exolve: ${response.status} ${response.statusText}${responseBody ? ` - ${responseBody}` : ""}`
      )
    }

    const id = resolveExolveMessageId(parseJson(responseBody))

    return id
      ? {
          id,
        }
      : {}
  }
}

function normalizeExolveBaseUrl(value?: string | null) {
  return value?.trim().replace(/\/+$/, "") || DEFAULT_MTS_EXOLVE_BASE_URL
}

function buildNotificationSmsMessage(
  notification: NotificationTypes.ProviderSendNotificationDTO
) {
  const text = notification.content?.text?.trim()
  const html = notification.content?.html?.trim()
  const subject = notification.content?.subject?.trim()
  const dataMessage =
    typeof notification.data?.message === "string"
      ? notification.data.message.trim()
      : ""

  return (
    text ||
    htmlToPlainText(html || "") ||
    dataMessage ||
    subject ||
    DEFAULT_EXOLVE_MESSAGE
  )
}

function htmlToPlainText(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/'/g, "'")
    .replace(/\s+/g, " ")
    .trim()
}

function parseJson(value: string): unknown {
  if (!value.trim()) {
    return null
  }

  try {
    return JSON.parse(value) as unknown
  } catch {
    return null
  }
}

function resolveExolveMessageId(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined
  }

  const record = payload as Record<string, unknown>
  const directCandidate =
    record.message_id ??
    record.messageId ??
    record.id ??
    record.request_id ??
    record.requestId

  if (
    typeof directCandidate === "string" ||
    typeof directCandidate === "number"
  ) {
    const normalized = String(directCandidate).trim()

    if (normalized) {
      return normalized
    }
  }

  return (
    resolveExolveMessageId(record.result) ||
    resolveExolveMessageId(record.data) ||
    undefined
  )
}

async function readResponseBody(response: Response) {
  try {
    const body = await response.text()
    return body.trim()
  } catch {
    return ""
  }
}

export default ExolveNotificationService
