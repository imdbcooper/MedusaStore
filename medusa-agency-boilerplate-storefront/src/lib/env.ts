const DEFAULT_MEDUSA_BACKEND_PORT = process.env.MEDUSA_BACKEND_PORT || "9000"
const STOREFRONT_PRESET_CANDIDATES = ["atelier", "market"] as const

export const MEDUSA_BACKEND_URL =
  process.env.MEDUSA_BACKEND_URL ||
  `http://localhost:${DEFAULT_MEDUSA_BACKEND_PORT}`

export const STOREFRONT_BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:8000"

export const DEFAULT_REGION =
  process.env.NEXT_PUBLIC_DEFAULT_REGION?.toLowerCase() || "ru"

export const STOREFRONT_PRESET_RAW =
  process.env.NEXT_PUBLIC_STOREFRONT_PRESET?.trim().toLowerCase() || ""

export const STOREFRONT_PRESET_IS_VALID = STOREFRONT_PRESET_CANDIDATES.includes(
  STOREFRONT_PRESET_RAW as (typeof STOREFRONT_PRESET_CANDIDATES)[number]
)

export const STOREFRONT_PRESET = STOREFRONT_PRESET_IS_VALID
  ? (STOREFRONT_PRESET_RAW as (typeof STOREFRONT_PRESET_CANDIDATES)[number])
  : "atelier"

export const YOOKASSA_ENABLED =
  process.env.NEXT_PUBLIC_YOOKASSA_ENABLED === "true"

export const VK_ID_ENABLED =
  process.env.NEXT_PUBLIC_VK_ID_ENABLED === "true"

export const STRIPE_COMPAT_ENABLED = Boolean(
  process.env.NEXT_PUBLIC_STRIPE_KEY ||
    process.env.NEXT_PUBLIC_MEDUSA_PAYMENTS_PUBLISHABLE_KEY
)

export const PAYLOAD_ENABLED = process.env.PAYLOAD_ENABLED === "true"

export const PAYLOAD_CMS_URL =
  process.env.PAYLOAD_CMS_URL?.replace(/\/$/, "") || ""

export const PAYLOAD_CONTENT_PREVIEW_TOKEN =
  process.env.PAYLOAD_CONTENT_PREVIEW_TOKEN || ""

export const PAYLOAD_PREVIEW_SECRET =
  process.env.PAYLOAD_PREVIEW_SECRET || process.env.PAYLOAD_SECRET || ""

export const PAYLOAD_REVALIDATE_SECRET =
  process.env.PAYLOAD_REVALIDATE_SECRET || ""
