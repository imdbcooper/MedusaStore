import type { Logger, NotificationTypes } from "@medusajs/framework/types"
import {
  AbstractNotificationProviderService,
  MedusaError,
} from "@medusajs/framework/utils"

type InjectedDependencies = {
  logger: Logger
}

type UniSenderNotificationServiceOptions = {
  api_key?: string
  from?: string
  base_url?: string
}

type UniSenderServiceConfig = {
  apiKey: string
  from: string
  baseUrl: string
}

type UniSenderAttachment = {
  type: string
  name: string
  content: string
}

const DEFAULT_UNISENDER_BASE_URL = "https://go1.unisender.ru"
const UNISENDER_SEND_EMAIL_PATH = "/ru/transactional/api/v1/email/send.json"
const DEFAULT_UNISENDER_SUBJECT = "Notification"

class UniSenderNotificationService extends AbstractNotificationProviderService {
  static identifier = "notification-unisender"

  protected config_: UniSenderServiceConfig
  protected logger_: Logger

  constructor(
    { logger }: InjectedDependencies,
    options: UniSenderNotificationServiceOptions
  ) {
    super()

    this.logger_ = logger
    this.config_ = {
      apiKey: options.api_key?.trim() || "",
      from: options.from?.trim() || "",
      baseUrl: normalizeUniSenderBaseUrl(options.base_url),
    }
  }

  static validateOptions(options: Record<string, unknown>) {
    const apiKey = String(options.api_key ?? "").trim()
    const from = String(options.from ?? "").trim()

    if (!apiKey) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "UNISENDER_API_KEY is required for the UniSender notification provider."
      )
    }

    if (!from) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "NOTIFICATION_EMAIL_FROM is required for the UniSender notification provider."
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

    const content = buildNotificationContent(notification)
    const sender = parseSender(notification.from?.trim() || this.config_.from)
    const attachments = buildUniSenderAttachments(notification.attachments)
    const payload = {
      api_key: this.config_.apiKey,
      message: {
        recipients: [{ email: notification.to }],
        subject: content.subject,
        body: {
          html: content.html,
          plaintext: content.text,
        },
        from_email: sender.email,
        ...(sender.name ? { from_name: sender.name } : {}),
        ...(attachments.length ? { attachments } : {}),
      },
    }

    const response = await fetch(`${this.config_.baseUrl}${UNISENDER_SEND_EMAIL_PATH}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const body = await readResponseBody(response)

      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Failed to send email via UniSender: ${response.status} ${response.statusText}${body ? ` - ${body}` : ""}`
      )
    }

    return {}
  }
}

function normalizeUniSenderBaseUrl(value?: string | null) {
  return value?.trim().replace(/\/+$/, "") || DEFAULT_UNISENDER_BASE_URL
}

function parseSender(value: string) {
  const trimmed = value.trim()
  const namedSenderMatch = trimmed.match(/^(.*?)\s*<([^>]+)>$/)

  if (namedSenderMatch) {
    return {
      name: namedSenderMatch[1]?.trim() || undefined,
      email: namedSenderMatch[2].trim(),
    }
  }

  return {
    name: undefined,
    email: trimmed,
  }
}

function buildNotificationContent(
  notification: NotificationTypes.ProviderSendNotificationDTO
) {
  const subject = notification.content?.subject?.trim() || DEFAULT_UNISENDER_SUBJECT
  const text =
    notification.content?.text?.trim() ||
    htmlToPlainText(notification.content?.html || "") ||
    subject
  const html =
    notification.content?.html?.trim() ||
    textToHtml(notification.content?.text || "") ||
    `<p>${escapeHtml(subject)}</p>`

  return {
    subject,
    text,
    html,
  }
}

function buildUniSenderAttachments(
  attachments?: NotificationTypes.ProviderSendNotificationDTO["attachments"]
): UniSenderAttachment[] {
  if (!Array.isArray(attachments)) {
    return []
  }

  return attachments.map((attachment) => ({
    type: attachment.content_type || "application/octet-stream",
    name: attachment.filename,
    content: attachment.content,
  }))
}

function htmlToPlainText(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
}

function textToHtml(value: string) {
  const trimmed = value.trim()

  if (!trimmed) {
    return ""
  }

  return `<p>${escapeHtml(trimmed).replace(/\n/g, "<br />")}</p>`
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

async function readResponseBody(response: Response) {
  try {
    const body = await response.text()
    return body.trim()
  } catch {
    return ""
  }
}

export default UniSenderNotificationService
