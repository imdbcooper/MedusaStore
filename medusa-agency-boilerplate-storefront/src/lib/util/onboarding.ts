import { HttpTypes } from "@medusajs/types"

/**
 * Onboarding metadata shape stored in customer.metadata.onboarding
 */
export type OnboardingMetadata = {
  status: "pending" | "completed"
  missing_fields: string[]
  placeholder_email: boolean
  created_at?: string
}

/**
 * Check if an email is a VK placeholder email (not a real email).
 */
export function isPlaceholderEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return email.endsWith("@placeholder.internal")
}

/**
 * Extract onboarding metadata from customer object.
 * Returns null if no onboarding metadata exists.
 */
export function getOnboardingMetadata(
  customer: HttpTypes.StoreCustomer | null | undefined
): OnboardingMetadata | null {
  if (!customer) return null

  const metadata = customer.metadata as Record<string, unknown> | null | undefined
  if (!metadata) return null

  const onboarding = metadata.onboarding as OnboardingMetadata | undefined
  if (!onboarding) return null

  return onboarding
}

/**
 * Check if customer has pending onboarding (needs to fill profile data).
 */
export function isOnboardingPending(
  customer: HttpTypes.StoreCustomer | null | undefined
): boolean {
  const onboarding = getOnboardingMetadata(customer)
  if (!onboarding) return false
  return onboarding.status === "pending"
}

/**
 * Check if customer's email is a placeholder and needs to be replaced.
 */
export function needsEmailOnboarding(
  customer: HttpTypes.StoreCustomer | null | undefined
): boolean {
  const onboarding = getOnboardingMetadata(customer)
  if (!onboarding) return false
  return (
    onboarding.status === "pending" &&
    onboarding.missing_fields.includes("email")
  )
}

/**
 * Check if customer needs phone onboarding.
 */
export function needsPhoneOnboarding(
  customer: HttpTypes.StoreCustomer | null | undefined
): boolean {
  const onboarding = getOnboardingMetadata(customer)
  if (!onboarding) return false
  return (
    onboarding.status === "pending" &&
    onboarding.missing_fields.includes("phone")
  )
}

/**
 * Check if checkout should be blocked for this customer.
 * Checkout is blocked only if email is a placeholder.
 */
export function isCheckoutBlocked(
  customer: HttpTypes.StoreCustomer | null | undefined
): boolean {
  if (!customer) return false
  return isPlaceholderEmail(customer.email)
}
