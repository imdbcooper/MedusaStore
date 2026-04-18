import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { YOOKASSA_PROVIDER_KEY } from "../../../../../modules/yookassa"

const DEFAULT_LOCAL_STOREFRONT_ORIGIN = "http://localhost:8000"
const COUNTRY_CODE_REGEX = /^[a-z]{2}$/i

export const StoreYooKassaReturnSchema = z.object({
  cart_id: z.string().trim().min(1),
  payment_id: z.string().trim().min(1).optional(),
  country_code: z.string().trim().regex(COUNTRY_CODE_REGEX).optional(),
  storefront_origin: z.string().trim().url().optional(),
})

type StoreYooKassaReturnRequest = z.infer<typeof StoreYooKassaReturnSchema>

type BuildStorefrontCheckoutReturnUrlInput = {
  cartId: string
  countryCode?: string
  paymentId?: string | null
  storefrontOrigin?: string
}

export async function GET(
  req: MedusaRequest<StoreYooKassaReturnRequest>,
  res: MedusaResponse
) {
  const validatedQuery = req.validatedQuery as StoreYooKassaReturnRequest
  const countryCode = normalizeCountryCode(validatedQuery.country_code)
  const paymentId = validatedQuery.payment_id?.trim() || null
  const redirectUrl = buildStorefrontCheckoutReturnUrl({
    cartId: validatedQuery.cart_id,
    countryCode,
    paymentId,
    storefrontOrigin: validatedQuery.storefront_origin,
  })

  if (!paymentId) {
    console.warn("[YooKassa return] Missing payment_id in return query", {
      cart_id: validatedQuery.cart_id,
      country_code: countryCode,
    })
  }

  res.redirect(302, redirectUrl.toString())
}

export function buildStorefrontCheckoutReturnUrl(
  input: BuildStorefrontCheckoutReturnUrlInput
) {
  const redirectBaseUrl = resolveAllowedStorefrontOrigin(input.storefrontOrigin)
  const redirectUrl = new URL(
    `/${normalizeCountryCode(input.countryCode)}/checkout`,
    redirectBaseUrl
  )

  redirectUrl.searchParams.set("step", "review")
  redirectUrl.searchParams.set("yookassa", "return")
  redirectUrl.searchParams.set("provider_id", YOOKASSA_PROVIDER_KEY)
  redirectUrl.searchParams.set("cart_id", input.cartId)

  if (input.paymentId) {
    redirectUrl.searchParams.set("payment_id", input.paymentId)
  }

  return redirectUrl
}

function resolveAllowedStorefrontOrigin(requestedOrigin?: string) {
  const allowedOrigins = getAllowedStorefrontOrigins()
  const normalizedRequestedOrigin = normalizeOrigin(requestedOrigin)

  if (
    normalizedRequestedOrigin &&
    allowedOrigins.includes(normalizedRequestedOrigin)
  ) {
    return new URL(normalizedRequestedOrigin)
  }

  if (normalizedRequestedOrigin) {
    console.warn("[YooKassa return] Ignoring untrusted storefront_origin", {
      storefront_origin: normalizedRequestedOrigin,
      allowed_origins: allowedOrigins,
    })
  }

  if (allowedOrigins[0]) {
    return new URL(allowedOrigins[0])
  }

  if (allowLocalStorefrontFallback()) {
    console.warn(
      "[YooKassa return] No storefront return origins configured; using localhost fallback for controlled local development."
    )

    return new URL(DEFAULT_LOCAL_STOREFRONT_ORIGIN)
  }

  throw new MedusaError(
    MedusaError.Types.INVALID_DATA,
    "YooKassa storefront return origin is not configured. Set YOOKASSA_STOREFRONT_RETURN_ORIGINS or STORE_CORS."
  )
}

function getAllowedStorefrontOrigins() {
  const configuredOrigins = parseOriginList(
    process.env.YOOKASSA_STOREFRONT_RETURN_ORIGINS
  )

  if (configuredOrigins.length) {
    return configuredOrigins
  }

  const storeCorsFallback = normalizeOrigin(
    process.env.STORE_CORS?.split(",")?.[0]?.trim()
  )

  return storeCorsFallback ? [storeCorsFallback] : []
}

function parseOriginList(value?: string) {
  if (!value?.trim()) {
    return []
  }

  return Array.from(
    new Set(
      value
        .split(",")
        .map((origin) => normalizeOrigin(origin))
        .filter((origin): origin is string => Boolean(origin))
    )
  )
}

function normalizeOrigin(value?: string) {
  if (!value?.trim()) {
    return null
  }

  try {
    const url = new URL(value)

    return url.protocol === "http:" || url.protocol === "https:"
      ? url.origin
      : null
  } catch {
    return null
  }
}

function normalizeCountryCode(value?: string) {
  return COUNTRY_CODE_REGEX.test(value ?? "") ? value!.toLowerCase() : "ru"
}

function allowLocalStorefrontFallback() {
  const nodeEnv = process.env.NODE_ENV?.trim().toLowerCase()

  return !nodeEnv || nodeEnv === "development" || nodeEnv === "test"
}
