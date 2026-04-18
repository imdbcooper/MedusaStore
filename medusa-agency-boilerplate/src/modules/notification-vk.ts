export type NotificationVkProviderId = "disabled" | "community"

export type NotificationVkRuntime = {
  requestedProviderId: NotificationVkProviderId
  providerId: NotificationVkProviderId
  communityConfigured: boolean
  accessToken?: string
  groupId?: string
  apiVersion: string
}

export const DEFAULT_NOTIFICATION_VK_PROVIDER: NotificationVkProviderId =
  "disabled"
export const DEFAULT_VK_API_VERSION = "5.199"
export const DEFAULT_NOTIFICATION_VK_SMOKE_MESSAGE =
  "VK Community Messaging v1 smoke trigger completed."
export const DEFAULT_NOTIFICATION_VK_SMOKE_TRIGGER_TYPE =
  "admin.notification_smoke.vk.requested"
export const DEFAULT_NOTIFICATION_VK_SMOKE_TEMPLATE =
  "notification-vk-v1-smoke"
export const DEFAULT_ORDER_PLACED_VK_NOTIFICATION_TEMPLATE =
  "order-placed-vk-v1"
export const DEFAULT_ORDER_PLACED_VK_NOTIFICATION_TRIGGER_TYPE =
  "order.placed.customer.notification_requested"
export const DEFAULT_ORDER_SHIPPED_VK_NOTIFICATION_TEMPLATE =
  "order-shipped-vk-v1"
export const DEFAULT_ORDER_SHIPPED_VK_NOTIFICATION_TRIGGER_TYPE =
  "shipment.created.customer.notification_requested"
export const DEFAULT_ORDER_CANCELED_VK_NOTIFICATION_TEMPLATE =
  "order-canceled-vk-v1"
export const DEFAULT_ORDER_CANCELED_VK_NOTIFICATION_TRIGGER_TYPE =
  "order.canceled.customer.notification_requested"

function normalizeNotificationVkProvider(
  value?: string | null
): NotificationVkProviderId {
  return value?.trim().toLowerCase() === "community" ? "community" : "disabled"
}

function normalizeVkApiVersion(value?: string | null) {
  return value?.trim() || DEFAULT_VK_API_VERSION
}

export function normalizeVkPeerId(value?: string | null) {
  const normalized = value?.trim() || ""

  if (!normalized || !/^-?\d+$/.test(normalized)) {
    return null
  }

  return BigInt(normalized).toString()
}

export function resolveCustomerVkPeerId(metadata?: unknown) {
  if (!metadata || typeof metadata !== "object") {
    return null
  }

  const vkPeerId = (metadata as Record<string, unknown>).vk_peer_id

  if (vkPeerId === null || vkPeerId === undefined) {
    return null
  }

  return normalizeVkPeerId(String(vkPeerId))
}

export function getNotificationVkRuntime(): NotificationVkRuntime {
  const requestedProviderId = normalizeNotificationVkProvider(
    process.env.NOTIFICATION_VK_PROVIDER
  )
  const accessToken = process.env.VK_COMMUNITY_ACCESS_TOKEN?.trim() || undefined
  const groupId = normalizeVkPeerId(process.env.VK_COMMUNITY_GROUP_ID)
  const apiVersion = normalizeVkApiVersion(process.env.VK_API_VERSION)
  const communityConfigured =
    requestedProviderId === "community" && !!accessToken && !!groupId
  const providerId = communityConfigured ? "community" : "disabled"

  return {
    requestedProviderId,
    providerId,
    communityConfigured,
    accessToken,
    groupId: groupId || undefined,
    apiVersion,
  }
}

export function getNotificationVkProviderDefinition() {
  const runtime = getNotificationVkRuntime()

  if (runtime.providerId !== "community") {
    return null
  }

  return {
    resolve: "./src/modules/notification-vk-community",
    id: "vk-community",
    options: {
      channels: ["vk"],
      access_token: runtime.accessToken,
      group_id: runtime.groupId,
      api_version: runtime.apiVersion,
    },
  }
}
