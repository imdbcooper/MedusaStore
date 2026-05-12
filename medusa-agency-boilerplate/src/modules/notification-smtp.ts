import type { Logger, NotificationTypes } from "@medusajs/framework/types"
import {
  AbstractNotificationProviderService,
  MedusaError,
  ModuleProvider,
  Modules,
} from "@medusajs/framework/utils"
import nodemailer from "nodemailer"
import type SMTPTransport from "nodemailer/lib/smtp-transport"

export type SmtpTransportFactory = (
  options: SMTPTransport.Options
) => nodemailer.Transporter<SMTPTransport.SentMessageInfo>

export let smtpTransportFactory: SmtpTransportFactory = (options) =>
  nodemailer.createTransport(options)

export function setSmtpTransportFactoryForTests(factory: SmtpTransportFactory) {
  smtpTransportFactory = factory
}

export function resetSmtpTransportFactoryForTests() {
  smtpTransportFactory = (options) => nodemailer.createTransport(options)
}


type InjectedDependencies = {
  logger: Logger
}

type SmtpNotificationServiceOptions = {
  host?: string
  port?: number | string
  secure?: boolean | string
  user?: string
  password?: string
  from?: string
  from_name?: string
  reply_to?: string
  tls_reject_unauthorized?: boolean | string
}

type SmtpServiceConfig = {
  host: string
  port: number
  secure: boolean
  user: string
  password: string
  from: string
  fromName?: string
  replyTo?: string
  tlsRejectUnauthorized?: boolean
}

type SmtpAttachment = {
  filename: string
  content: string
  contentType?: string
}

type SmtpCustomHeaders = Record<string, string>

const DEFAULT_SMTP_SUBJECT = "Notification"

/**
 * Allow list for custom headers that notification data may request the
 * SMTP provider to set on the outgoing message. Names are canonicalized
 * to lowercase before comparison. Values are sanitized (trimmed, control
 * characters stripped) and truncated to avoid header smuggling.
 */
const SMTP_ALLOWED_CUSTOM_HEADERS: ReadonlySet<string> = new Set([
  "list-unsubscribe",
  "list-unsubscribe-post",
  "list-id",
  "list-help",
  "x-campaign-id",
  "precedence",
])

const SMTP_HEADER_VALUE_MAX_LENGTH = 1024

export class SmtpNotificationService extends AbstractNotificationProviderService {
  static identifier = "notification-smtp"

  protected config_: SmtpServiceConfig
  protected logger_: Logger
  protected transporter_: nodemailer.Transporter<SMTPTransport.SentMessageInfo>

  constructor(
    { logger }: InjectedDependencies,
    options: SmtpNotificationServiceOptions
  ) {
    super()

    this.logger_ = logger
    this.config_ = {
      host: options.host?.trim() || "",
      port: parseSmtpPort(options.port),
      secure: parseBoolean(options.secure, false),
      user: options.user?.trim() || "",
      password: options.password?.trim() || "",
      from: options.from?.trim() || "",
      fromName: options.from_name?.trim() || undefined,
      replyTo: options.reply_to?.trim() || undefined,
      tlsRejectUnauthorized:
        options.tls_reject_unauthorized === undefined
          ? undefined
          : parseBoolean(options.tls_reject_unauthorized, true),
    }
    this.transporter_ = smtpTransportFactory({
      host: this.config_.host,
      port: this.config_.port,
      secure: this.config_.secure,
      requireTLS: !this.config_.secure,
      auth: {
        user: this.config_.user,
        pass: this.config_.password,
      },
      tls: {
        servername: this.config_.host,
        ...(this.config_.tlsRejectUnauthorized === undefined
          ? {}
          : { rejectUnauthorized: this.config_.tlsRejectUnauthorized }),
      },
    })
  }

  static validateOptions(options: Record<string, unknown>) {
    const host = String(options.host ?? "").trim()
    const port = parseSmtpPort(options.port as string | number | undefined)
    const user = String(options.user ?? "").trim()
    const password = String(options.password ?? "").trim()
    const from = String(options.from ?? "").trim()

    if (!host) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "SMTP_HOST is required for the SMTP notification provider."
      )
    }

    if (!port) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "SMTP_PORT must be a valid TCP port for the SMTP notification provider."
      )
    }

    if (!user) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "SMTP_USER is required for the SMTP notification provider."
      )
    }

    if (!password) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "SMTP_PASSWORD is required for the SMTP notification provider."
      )
    }

    if (!from) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "SMTP_FROM is required for the SMTP notification provider."
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

    const recipients = normalizeRecipients(notification.to)

    if (!recipients.length) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "At least one email recipient is required to send an SMTP notification."
      )
    }

    const content = buildNotificationContent(notification)
    const from = formatSender(
      notification.from?.trim() || this.config_.from,
      this.config_.fromName
    )
    const attachments = buildSmtpAttachments(notification.attachments)
    const customHeaders = extractSmtpCustomHeaders(notification)

    const info = await this.transporter_.sendMail({
      from,
      to: recipients,
      ...(this.config_.replyTo ? { replyTo: this.config_.replyTo } : {}),
      subject: content.subject,
      text: content.text,
      html: content.html,
      ...(attachments.length ? { attachments } : {}),
      ...(Object.keys(customHeaders).length
        ? { headers: customHeaders }
        : {}),
    })

    const messageId = typeof info?.messageId === "string" ? info.messageId : ""

    this.logger_.info(
      `[notification-smtp] sent status=sent recipients_count=${recipients.length} message_id=${messageId || "n/a"}`
    )

    return messageId ? { id: messageId } : {}
  }
}

function parseSmtpPort(value?: string | number | null) {
  const normalized = String(value ?? "").trim()

  if (!normalized) {
    return 0
  }

  const port = Number(normalized)

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return 0
  }

  return port
}

function parseBoolean(value?: string | boolean | null, defaultValue = false) {
  if (typeof value === "boolean") {
    return value
  }

  const normalized = value?.trim().toLowerCase()

  if (normalized === "true" || normalized === "1" || normalized === "yes") {
    return true
  }

  if (normalized === "false" || normalized === "0" || normalized === "no") {
    return false
  }

  return defaultValue
}

function normalizeRecipients(value?: string | string[] | null) {
  const rawRecipients = Array.isArray(value)
    ? value
    : String(value ?? "").split(/[;,]/g)

  return rawRecipients
    .map((recipient) => recipient.trim().toLowerCase())
    .filter(Boolean)
}

function formatSender(email: string, name?: string) {
  const normalizedEmail = email.trim()

  if (!name?.trim()) {
    return normalizedEmail
  }

  return `${escapeHeaderValue(name.trim())} <${normalizedEmail}>`
}

function escapeHeaderValue(value: string) {
  return value.replace(/[\r\n<>]/g, " ").replace(/\s+/g, " ").trim()
}

function buildNotificationContent(
  notification: NotificationTypes.ProviderSendNotificationDTO
) {
  const subject = notification.content?.subject?.trim() || DEFAULT_SMTP_SUBJECT
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

function buildSmtpAttachments(
  attachments?: NotificationTypes.ProviderSendNotificationDTO["attachments"]
): SmtpAttachment[] {
  if (!Array.isArray(attachments)) {
    return []
  }

  return attachments.map((attachment) => ({
    filename: attachment.filename,
    content: attachment.content,
    contentType: attachment.content_type || undefined,
  }))
}

/**
 * Collect custom headers from the notification payload.
 *
 * Two sources are accepted:
 * - `notification.data.headers` (preferred; workflows set this);
 * - `notification.data._smtp_headers` (alternate key for clarity).
 *
 * Only a small allow-list of header names is honoured; all values are
 * sanitized and truncated.
 */
export function extractSmtpCustomHeaders(
  notification: NotificationTypes.ProviderSendNotificationDTO
): SmtpCustomHeaders {
  const result: SmtpCustomHeaders = {}
  const dataRecord =
    notification.data && typeof notification.data === "object"
      ? (notification.data as Record<string, unknown>)
      : {}

  const headerBag =
    (dataRecord["headers"] && typeof dataRecord["headers"] === "object"
      ? dataRecord["headers"]
      : null) ||
    (dataRecord["_smtp_headers"] &&
    typeof dataRecord["_smtp_headers"] === "object"
      ? dataRecord["_smtp_headers"]
      : null)

  if (!headerBag || typeof headerBag !== "object") {
    return result
  }

  for (const [rawKey, rawValue] of Object.entries(
    headerBag as Record<string, unknown>
  )) {
    if (typeof rawKey !== "string" || typeof rawValue !== "string") {
      continue
    }

    const normalizedKey = rawKey.trim().toLowerCase()

    if (!SMTP_ALLOWED_CUSTOM_HEADERS.has(normalizedKey)) {
      continue
    }

    const sanitizedValue = rawValue
      .replace(/[\r\n]+/g, " ")
      .trim()
      .slice(0, SMTP_HEADER_VALUE_MAX_LENGTH)

    if (!sanitizedValue) {
      continue
    }

    // Preserve canonical header casing for common names.
    const canonicalKey = canonicalizeSmtpHeaderName(normalizedKey)

    result[canonicalKey] = sanitizedValue
  }

  return result
}

function canonicalizeSmtpHeaderName(lowerName: string): string {
  const overrides: Record<string, string> = {
    "list-unsubscribe": "List-Unsubscribe",
    "list-unsubscribe-post": "List-Unsubscribe-Post",
    "list-id": "List-Id",
    "list-help": "List-Help",
    "x-campaign-id": "X-Campaign-Id",
    precedence: "Precedence",
  }

  return overrides[lowerName] || lowerName
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

export default ModuleProvider(Modules.NOTIFICATION, {
  services: [SmtpNotificationService],
})
