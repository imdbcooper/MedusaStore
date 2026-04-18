const DEFAULT_MEDUSA_BACKEND_PORT = process.env.MEDUSA_BACKEND_PORT || "9000"

export const MEDUSA_BACKEND_URL =
  process.env.MEDUSA_BACKEND_URL ||
  `http://localhost:${DEFAULT_MEDUSA_BACKEND_PORT}`

export const STOREFRONT_BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:8000"

export const DEFAULT_REGION =
  process.env.NEXT_PUBLIC_DEFAULT_REGION?.toLowerCase() || "ru"

export const YOOKASSA_ENABLED =
  process.env.NEXT_PUBLIC_YOOKASSA_ENABLED === "true"

export const STRIPE_COMPAT_ENABLED = Boolean(
  process.env.NEXT_PUBLIC_STRIPE_KEY ||
    process.env.NEXT_PUBLIC_MEDUSA_PAYMENTS_PUBLISHABLE_KEY
)
