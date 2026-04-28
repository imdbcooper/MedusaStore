import {
  DEFAULT_REGION,
  DELIVERY_HUB_PREVIEW_DEFAULT_CONNECTION_ID,
  DELIVERY_HUB_PREVIEW_DEFAULT_DESTINATION_POINT_ID,
  DELIVERY_HUB_PREVIEW_DEFAULT_ORIGIN_POINT_ID,
  DELIVERY_HUB_PREVIEW_DEFAULT_WAREHOUSE_ID,
  DELIVERY_HUB_PREVIEW_DEV_DEFAULTS_ENABLED,
  DELIVERY_HUB_PREVIEW_ENABLED,
  MEDUSA_BACKEND_URL,
  STOREFRONT_BASE_URL,
  STRIPE_COMPAT_ENABLED,
  VK_ID_ENABLED,
  YOOKASSA_ENABLED,
} from "@lib/env"
import { getLocaleHeader } from "@lib/util/get-locale-header"
import Medusa, { FetchArgs, FetchInput } from "@medusajs/js-sdk"

export {
  DEFAULT_REGION,
  DELIVERY_HUB_PREVIEW_DEFAULT_CONNECTION_ID,
  DELIVERY_HUB_PREVIEW_DEFAULT_DESTINATION_POINT_ID,
  DELIVERY_HUB_PREVIEW_DEFAULT_ORIGIN_POINT_ID,
  DELIVERY_HUB_PREVIEW_DEFAULT_WAREHOUSE_ID,
  DELIVERY_HUB_PREVIEW_DEV_DEFAULTS_ENABLED,
  DELIVERY_HUB_PREVIEW_ENABLED,
  MEDUSA_BACKEND_URL,
  STOREFRONT_BASE_URL,
  STRIPE_COMPAT_ENABLED,
  VK_ID_ENABLED,
  YOOKASSA_ENABLED,
}

export const sdk = new Medusa({
  baseUrl: MEDUSA_BACKEND_URL,
  debug: process.env.NODE_ENV === "development",
  publishableKey: process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY,
})

const originalFetch = sdk.client.fetch.bind(sdk.client)

sdk.client.fetch = async <T>(
  input: FetchInput,
  init?: FetchArgs
): Promise<T> => {
  const headers = init?.headers ?? {}
  let localeHeader: Record<string, string | null> | undefined

  try {
    localeHeader = await getLocaleHeader()

    if (localeHeader["x-medusa-locale"]) {
      headers["x-medusa-locale"] ??= localeHeader["x-medusa-locale"]
    }
  } catch {
    localeHeader = undefined
  }

  const newHeaders = {
    ...(localeHeader?.["x-medusa-locale"] ? localeHeader : {}),
    ...headers,
  }

  init = {
    ...init,
    headers: newHeaders,
  }

  return originalFetch(input, init)
}
