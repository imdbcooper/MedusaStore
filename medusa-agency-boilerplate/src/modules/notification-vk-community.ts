import type { Logger, NotificationTypes } from "@medusajs/framework/types"
import {
  AbstractNotificationProviderService,
  MedusaError,
} from "@medusajs/framework/utils"
import { normalizeVkPeerId } from "./notification-vk"

type InjectedDependencies = {
  logger: Logger
}

type VkCommunityNotificationServiceOptions = {
  access_token?: string
  group_id?: string
  api_version?: string
}

type VkCommunityServiceConfig = {
  accessToken: string
  groupId: string
  apiVersion: string
}

const VK_API_BASE_URL = "https://api.vk.com"
const VK_MESSAGES_SEND_PATH = "/method/messages.send"
const DEFAULT_VK_MESSAGE = "Notification"

class VkCommunityNotificationService extends AbstractNotificationProviderService {
  static identifier = "notification-vk-community"

  protected config_: VkCommunityServiceConfig
  protected logger_: Logger

  constructor(
    { logger }: InjectedDependencies,
    options: VkCommunityNotificationServiceOptions
  ) {
    super()

    this.logger_ = logger
    this.config_ = {
      accessToken: options.access_token?.trim() || "",
      groupId: options.group_id?.trim() || "",
      apiVersion: options.api_version?.trim() || "5.199",
    }
  }

  static validateOptions(options: Record<string, unknown>) {
    const accessToken = String(options.access_token ?? "").trim()
    const groupId = String(options.group_id ?? "").trim()

    if (!accessToken) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "VK_COMMUNITY_ACCESS_TOKEN is required for the VK Community Messaging notification provider."
      )
    }

    if (!groupId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "VK_COMMUNITY_GROUP_ID is required for the VK Community Messaging notification provider."
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

    const peerId = normalizeVkPeerId(notification.to)

    if (!peerId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "A normalized VK peer id is required to send a VK notification."
      )
    }

    const message = buildNotificationMessage(notification)
    const randomId = resolveRandomId(notification)
    const body = new URLSearchParams({
      access_token: this.config_.accessToken,
      group_id: this.config_.groupId,
      peer_id: peerId,
      random_id: randomId,
      message,
      v: this.config_.apiVersion,
    })

    const response = await fetch(`${VK_API_BASE_URL}${VK_MESSAGES_SEND_PATH}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body: body.toString(),
    })

    if (!response.ok) {
      const responseBody = await readResponseBody(response)

      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Failed to send VK message: ${response.status} ${response.statusText}${responseBody ? ` - ${responseBody}` : ""}`
      )
    }

    const payload = (await response.json()) as {
      response?: number | string
      error?: {
        error_code?: number
        error_msg?: string
      }
    }

    if (payload.error) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Failed to send VK message: ${payload.error.error_code ?? "unknown"} ${payload.error.error_msg ?? "Unknown VK API error"}`
      )
    }

    if (payload.response === null || payload.response === undefined) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "Failed to send VK message: VK API response did not include a response id."
      )
    }

    return {
      id: String(payload.response),
    }
  }
}

function buildNotificationMessage(
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
    DEFAULT_VK_MESSAGE
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

function resolveRandomId(
  notification: NotificationTypes.ProviderSendNotificationDTO
) {
  const rawValue = notification.data?.random_id

  if (
    typeof rawValue === "number" ||
    (typeof rawValue === "string" && rawValue.trim() !== "")
  ) {
    return String(rawValue).trim()
  }

  return `${Date.now()}${Math.floor(Math.random() * 1000)}`
}

async function readResponseBody(response: Response) {
  try {
    const body = await response.text()
    return body.trim()
  } catch {
    return ""
  }
}

export default VkCommunityNotificationService
