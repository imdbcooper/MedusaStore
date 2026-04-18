"use server"

import { MEDUSA_BACKEND_URL, sdk } from "@lib/config"
import medusaError from "@lib/util/medusa-error"
import { revalidateTag } from "next/cache"
import { getAuthHeaders, getCacheTag } from "./cookies"

export type MarketingChannel = "email" | "sms" | "vk"
export type MarketingGlobalStatus = "subscribed" | "unsubscribed"
export type MarketingChannelStatus =
  | "subscribed"
  | "unsubscribed"
  | "pending"
  | "unavailable"

export type StoreMarketingPreferences = {
  version: 1
  global_status: MarketingGlobalStatus
  channels: Record<
    MarketingChannel,
    {
      status: MarketingChannelStatus
      updated_at: string | null
      source: string | null
      recipient_snapshot: Record<string, unknown> | null
    }
  >
  segments: string[]
  suppressed_until: string | null
  last_marketing_sent_at: string | null
}

export type StoreMarketingBindings = Record<
  MarketingChannel,
  {
    available: boolean
    recipient: string | null
    recipient_snapshot: Record<string, unknown> | null
  }
>

export type StoreMarketingPreferencesResponse = {
  customer_id: string
  marketing: StoreMarketingPreferences
  bindings: StoreMarketingBindings
}

async function getMarketingHeaders() {
  const authHeaders = await getAuthHeaders()

  if (!authHeaders) {
    return null
  }

  return {
    ...authHeaders,
    "content-type": "application/json",
  }
}

export async function retrieveMarketingPreferences() {
  const headers = await getMarketingHeaders()

  if (!headers) {
    return null
  }

  return await sdk.client
    .fetch<StoreMarketingPreferencesResponse>(
      `${MEDUSA_BACKEND_URL}/store/customers/me/marketing-preferences`,
      {
        method: "GET",
        headers,
        cache: "no-store",
      }
    )
    .catch(() => null)
}

export async function updateMarketingPreferences(input: {
  global_status?: MarketingGlobalStatus
  channels?: Partial<
    Record<
      MarketingChannel,
      {
        status?: MarketingChannelStatus
      }
    >
  >
}) {
  const headers = await getMarketingHeaders()

  if (!headers) {
    throw new Error("Customer auth required")
  }

  const response = await sdk.client
    .fetch<StoreMarketingPreferencesResponse>(
      `${MEDUSA_BACKEND_URL}/store/customers/me/marketing-preferences`,
      {
        method: "POST",
        headers,
        body: input,
        cache: "no-store",
      }
    )
    .catch(medusaError)

  const customerCacheTag = await getCacheTag("customers")
  revalidateTag(customerCacheTag)

  return response
}
