"use server"

import { DEFAULT_REGION } from "@lib/config"

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
 * Returns configured locale data without calling a non-existent Store API endpoint.
 * Optional backend-driven locales can be added later when the backend exposes
 * a supported API contract for them.
 */
export const listLocales = async (): Promise<Locale[] | null> => {
  return fallbackLocales
}
