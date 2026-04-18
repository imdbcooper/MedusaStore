import type { NotificationDTO } from "@medusajs/framework/types"
import { normalizeSmsPhone } from "../modules/notification-sms"

export type SmsPhoneOwner = {
  shipping_address?: {
    phone?: string | null
  } | null
  billing_address?: {
    phone?: string | null
  } | null
  customer?: {
    phone?: string | null
  } | null
}

export type ExistingSmsNotificationRecord = {
  id: string
  to: string
  status: NotificationDTO["status"]
  created_at: Date | string
}

export type ResolvedSmsRecipient = {
  recipient: string | null
  recipientNormalized: string | null
  recipientSource:
    | "shipping_address.phone"
    | "billing_address.phone"
    | "customer.phone"
    | null
}

export function toNotificationTimestamp(value?: Date | string | null): string | null {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toISOString()
}

export function selectDuplicateSmsNotification(
  notifications: ExistingSmsNotificationRecord[],
  normalizedRecipient: string
): ExistingSmsNotificationRecord | undefined {
  return notifications
    .filter((notification) => {
      return normalizeSmsPhone(notification.to) === normalizedRecipient
    })
    .sort((left, right) => {
      const leftTimestamp = toNotificationTimestamp(left.created_at) || ""
      const rightTimestamp = toNotificationTimestamp(right.created_at) || ""

      if (leftTimestamp === rightTimestamp) {
        return left.id.localeCompare(right.id)
      }

      return leftTimestamp.localeCompare(rightTimestamp)
    })[0]
}

export function resolveOrderLikeSmsRecipient(
  value?: SmsPhoneOwner | null
): ResolvedSmsRecipient {
  const candidates: Array<{
    source: NonNullable<ResolvedSmsRecipient["recipientSource"]>
    recipient: string | null | undefined
  }> = [
    {
      source: "shipping_address.phone",
      recipient: value?.shipping_address?.phone,
    },
    {
      source: "billing_address.phone",
      recipient: value?.billing_address?.phone,
    },
    {
      source: "customer.phone",
      recipient: value?.customer?.phone,
    },
  ]

  for (const candidate of candidates) {
    const recipient = candidate.recipient?.trim() || null

    if (!recipient) {
      continue
    }

    return {
      recipient,
      recipientNormalized: normalizeSmsPhone(recipient),
      recipientSource: candidate.source,
    }
  }

  return {
    recipient: null,
    recipientNormalized: null,
    recipientSource: null,
  }
}

export function isTerminalFailedPaymentStatus(status?: string | null) {
  return status === "canceled"
}

export function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}
