"use server"

import { DEFAULT_REGION, sdk } from "@lib/config"
import { getCacheOptions } from "./cookies"

export type Locale = {
  code: string
  name: string
}

const fallbackLocales: Locale[] = [
  {
    code: `${DEFAULT_REGION.toLowerCase()}-${DEFAULT_REGION.toUpperCase()}`,
    name: "Русский",
  },
]

/**
 * Fetches available locales from the backend.
 * Returns fallback locale data when locales are not configured,
 * so optional locale support never breaks storefront runtime.
 */
export const listLocales = async (): Promise<Locale[] | null> => {
  const next = {
    ...(await getCacheOptions("locales")),
  }

  return sdk.client
    .fetch<{ locales: Locale[] }>(`/store/locales`, {
      method: "GET",
      next,
      cache: "force-cache",
    })
    .then(({ locales }) => {
      if (!locales?.length) {
        return fallbackLocales
      }

      return locales
    })
    .catch(() => fallbackLocales)
}
