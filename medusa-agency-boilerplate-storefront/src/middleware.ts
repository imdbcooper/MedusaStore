import { HttpTypes } from "@medusajs/types"
import { NextRequest, NextResponse } from "next/server"

import { DEFAULT_REGION, MEDUSA_BACKEND_URL } from "@lib/env"

const PUBLISHABLE_API_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
const ONBOARDING_COOKIE_NAME = "_medusa_onboarding"

function shouldClearOnboardingCookie(request: NextRequest) {
  if (request.cookies.get(ONBOARDING_COOKIE_NAME)?.value !== "true") {
    return false
  }

  const [, countryCode, routeSegment] = request.nextUrl.pathname.split("/")

  return Boolean(countryCode && routeSegment === "products")
}

const regionMapCache = {
  regionMap: new Map<string, HttpTypes.StoreRegion>(),
  regionMapUpdated: Date.now(),
}

async function getRegionMap(cacheId: string) {
  const { regionMap, regionMapUpdated } = regionMapCache

  if (!PUBLISHABLE_API_KEY) {
    throw new Error(
      "Storefront middleware requires NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY to resolve regions."
    )
  }

  if (
    !regionMap.keys().next().value ||
    regionMapUpdated < Date.now() - 3600 * 1000
  ) {
    const { regions } = await fetch(`${MEDUSA_BACKEND_URL}/store/regions`, {
      headers: {
        "x-publishable-api-key": PUBLISHABLE_API_KEY,
      },
      next: {
        revalidate: 3600,
        tags: [`regions-${cacheId}`],
      },
      cache: "force-cache",
    }).then(async (response) => {
      const json = await response.json()

      if (!response.ok) {
        throw new Error(json.message || "Failed to load regions.")
      }

      return json
    })

    if (!regions?.length) {
      throw new Error(
        "No storefront regions are available. Configure at least one backend region with countries."
      )
    }

    regionMapCache.regionMap.clear()

    regions.forEach((region: HttpTypes.StoreRegion) => {
      region.countries?.forEach((country) => {
        const iso2 = country.iso_2?.toLowerCase()

        if (iso2) {
          regionMapCache.regionMap.set(iso2, region)
        }
      })
    })

    regionMapCache.regionMapUpdated = Date.now()
  }

  return regionMapCache.regionMap
}

async function getCountryCode(
  request: NextRequest,
  regionMap: Map<string, HttpTypes.StoreRegion | number>
) {
  try {
    let countryCode

    const vercelCountryCode = request.headers
      .get("x-vercel-ip-country")
      ?.toLowerCase()

    const urlCountryCode = request.nextUrl.pathname.split("/")[1]?.toLowerCase()

    if (urlCountryCode && regionMap.has(urlCountryCode)) {
      countryCode = urlCountryCode
    } else if (vercelCountryCode && regionMap.has(vercelCountryCode)) {
      countryCode = vercelCountryCode
    } else if (regionMap.has(DEFAULT_REGION)) {
      countryCode = DEFAULT_REGION
    } else if (regionMap.keys().next().value) {
      countryCode = regionMap.keys().next().value
    }

    return countryCode
  } catch {
    if (process.env.NODE_ENV === "development") {
      console.error(
        "Storefront middleware could not resolve a region-specific country code."
      )
    }
  }
}

export async function middleware(request: NextRequest) {
  let redirectUrl = request.nextUrl.href

  const cacheIdCookie = request.cookies.get("_medusa_cache_id")
  const cacheId = cacheIdCookie?.value || crypto.randomUUID()

  const regionMap = await getRegionMap(cacheId)
  const countryCode = regionMap && (await getCountryCode(request, regionMap))

  const requestCountryCode = request.nextUrl.pathname.split("/")[1]?.toLowerCase()
  const urlHasCountryCode = Boolean(
    countryCode && requestCountryCode === countryCode
  )

  if (urlHasCountryCode && cacheIdCookie) {
    const response = NextResponse.next()

    if (shouldClearOnboardingCookie(request)) {
      response.cookies.set(ONBOARDING_COOKIE_NAME, "false", {
        maxAge: -1,
      })
    }

    return response
  }

  if (urlHasCountryCode && !cacheIdCookie) {
    const response = NextResponse.next()

    response.cookies.set("_medusa_cache_id", cacheId, {
      maxAge: 60 * 60 * 24,
    })

    if (shouldClearOnboardingCookie(request)) {
      response.cookies.set(ONBOARDING_COOKIE_NAME, "false", {
        maxAge: -1,
      })
    }

    return response
  }

  if (request.nextUrl.pathname.includes(".")) {
    return NextResponse.next()
  }

  const redirectPath =
    request.nextUrl.pathname === "/" ? "" : request.nextUrl.pathname

  const queryString = request.nextUrl.search ? request.nextUrl.search : ""

  let response = NextResponse.redirect(redirectUrl, 307)

  if (!urlHasCountryCode && countryCode) {
    redirectUrl = `${request.nextUrl.origin}/${countryCode}${redirectPath}${queryString}`
    response = NextResponse.redirect(redirectUrl, 307)
  } else if (!urlHasCountryCode && !countryCode) {
    return new NextResponse(
      "No valid storefront regions are configured. Add a backend region with at least one country.",
      { status: 500 }
    )
  }

  return response
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|images|assets|png|svg|jpg|jpeg|gif|webp).*)",
  ],
}
