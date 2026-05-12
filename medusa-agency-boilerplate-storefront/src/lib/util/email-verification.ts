import { HttpTypes } from "@medusajs/types"

type CustomerLike = Pick<HttpTypes.StoreCustomer, "email" | "metadata">

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim().toLowerCase()

  return normalized || null
}

export function isCustomerEmailVerified(
  customer: CustomerLike | null | undefined
): boolean {
  if (!customer) {
    return false
  }

  const metadata = asRecord(customer.metadata)

  if (metadata.email_verified !== true) {
    return false
  }

  const verifiedFor = normalizeEmail(metadata.email_verified_for)

  if (!verifiedFor) {
    return false
  }

  const currentEmail = normalizeEmail(customer.email)

  if (!currentEmail) {
    return false
  }

  return verifiedFor === currentEmail
}
