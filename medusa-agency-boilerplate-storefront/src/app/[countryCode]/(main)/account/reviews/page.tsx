import { Metadata } from "next"
import { redirect } from "next/navigation"

import MyReviews from "@modules/account/components/my-reviews"
import { retrieveCustomer } from "@lib/data/customer"
import { getMyProductReviews } from "@lib/data/product-reviews"
import { getMetadataTitle, storefrontConfig } from "@lib/storefront-config"

/**
 * Phase 2 / step 5 — «Мои отзывы» account page (`/[countryCode]/account/reviews`).
 *
 * Plan: §6.5 (UI), §6.6 (cache contract), §9 Phase 2 step 5.
 *
 * Auth flow mirrors the rest of the account section: when the customer
 * cookie is missing or stale, `retrieveCustomer()` returns `null` and we
 * redirect to `/[countryCode]/account` — the existing route renders the
 * login template (see `account/page.tsx`). We deliberately do not render an
 * inline login form here; that keeps the auth UX consistent with
 * `/orders`, `/profile`, `/addresses`.
 *
 * Cache contract: {@link getMyProductReviews} attaches the
 * `customer-reviews-${customerId}` cache tag with `revalidate: 60` (plan
 * §6.6). The server action `deleteMyProductReview` invalidates the same tag
 * after a successful 204; admin approve/reject does NOT yet invalidate it —
 * this is left as TODO for Phase 2 step 6 (extending
 * `revalidateStorefrontTags(...)` in admin approve/reject routes to also
 * tag `customer-reviews-${review.customer_id}` when non-null). Until then
 * the 60-second stale-while-revalidate keeps the page reasonably fresh.
 *
 * The page is dynamic by design (`retrieveCustomer()` reads the cookie and
 * `searchParams` is awaited), so Next.js will mark it ƒ Dynamic — that is
 * correct for an authenticated surface and matches `/account/orders`.
 */
export const metadata: Metadata = {
  title: getMetadataTitle(storefrontConfig.copy.reviews.account.title),
  description: storefrontConfig.copy.reviews.account.description,
}

type ReviewsPageProps = {
  params?: Promise<{ countryCode: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function readSearchParam(
  value: string | string[] | undefined
): string | null {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : null
  }
  return typeof value === "string" ? value : null
}

function parsePage(value: string | null): number {
  if (!value) return 1
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1
  }
  return parsed
}

export default async function ReviewsPage(props: ReviewsPageProps) {
  const customer = await retrieveCustomer().catch(() => null)
  const params = props.params ? await props.params : undefined
  const searchParams = props.searchParams ? await props.searchParams : {}

  if (!customer) {
    const countryCode = params?.countryCode || ""
    // Same convention as the rest of the account section: bounce back to
    // `/account` which renders the login template for unauthenticated
    // visitors. Including `countryCode` keeps the locale prefix intact.
    redirect(countryCode ? `/${countryCode}/account` : "/account")
  }

  const page = parsePage(readSearchParam(searchParams.page))
  const result = await getMyProductReviews({ page })

  const accountCopy = storefrontConfig.copy.reviews.account

  return (
    <div className="w-full" data-testid="my-reviews-page-wrapper">
      <div className="mb-8 flex flex-col gap-y-4">
        <h1 className="text-2xl-semi">{accountCopy.title}</h1>
        <p className="text-base-regular">{accountCopy.description}</p>
      </div>
      <MyReviews result={result} />
    </div>
  )
}
