"use server"

import { DEFAULT_REGION, sdk } from "@lib/config"
import medusaError from "@lib/util/medusa-error"
import { HttpTypes } from "@medusajs/types"
import { getCacheOptions } from "./cookies"

export const listRegions = async () => {
  const next = {
    ...(await getCacheOptions("regions")),
  }

  return sdk.client
    .fetch<{ regions: HttpTypes.StoreRegion[] }>(`/store/regions`, {
      method: "GET",
      next,
      cache: "force-cache",
    })
    .then(({ regions }) => regions)
    .catch(medusaError)
}

export const retrieveRegion = async (id: string) => {
  const next = {
    ...(await getCacheOptions(["regions", id].join("-"))),
  }

  return sdk.client
    .fetch<{ region: HttpTypes.StoreRegion }>(`/store/regions/${id}`, {
      method: "GET",
      next,
      cache: "force-cache",
    })
    .then(({ region }) => region)
    .catch(medusaError)
}

const regionMap = new Map<string, HttpTypes.StoreRegion>()

export const getRegion = async (countryCode?: string | null) => {
  try {
    const normalizedCountryCode = countryCode?.toLowerCase() || DEFAULT_REGION

    if (regionMap.has(normalizedCountryCode)) {
      return regionMap.get(normalizedCountryCode)
    }

    const regions = await listRegions()

    if (!regions?.length) {
      return null
    }

    regionMap.clear()

    regions.forEach((region) => {
      region.countries?.forEach((country) => {
        const iso2 = country?.iso_2?.toLowerCase()

        if (iso2) {
          regionMap.set(iso2, region)
        }
      })
    })

    return (
      regionMap.get(normalizedCountryCode) ||
      regionMap.get(DEFAULT_REGION) ||
      regionMap.values().next().value ||
      null
    )
  } catch {
    return null
  }
}
