import * as React from "react"

import {
  getTopApprovedProductReviews,
  type ProductReviewItem,
} from "@lib/data/product-reviews"
import { storefrontConfig } from "@lib/storefront-config"
import ProductReviewCard from "@modules/products/components/product-review-card"

/**
 * Phase 3 / step 3 — homepage «Лучшие отзывы» widget (plan §9 Phase 3 п.5).
 *
 * Server component, async. Fetches `getTopApprovedProductReviews()` itself
 * — Next.js parallelises sibling server components on the home page, so no
 * page-level `Promise.all` is required (plan §9 Phase 3 п.5 / 3.7).
 *
 * Empty-state policy: when there are no qualifying reviews the entire
 * section is hidden (`return null`). Showing «пока никто не оставил отзыв»
 * on a homepage rail above the fold would dilute conversion; the spec
 * explicitly opts for the silent-hide behaviour.
 *
 * Layout: a responsive 1/2/4-column grid that mirrors the visual rhythm of
 * the existing [`ProductRail`](medusa-agency-boilerplate-storefront/src/modules/home/components/featured-products/product-rail/index.tsx:1)
 * (also a `grid` of card-like ⟨article⟩ surfaces). Re-uses
 * [`ProductReviewCard`](medusa-agency-boilerplate-storefront/src/modules/products/components/product-review-card/index.tsx:1)
 * verbatim — the helpful-button remains a client island, behaviour unchanged
 * from Phase 1.
 *
 * Cache: the underlying data layer fetches with the singleton tag
 * `top-reviews` and `revalidate: 300` (plan §9 Phase 3 п.5 / 3.4 / 3.8).
 */

const DEFAULT_LIMIT = 8
const DEFAULT_MIN_RATING = 4

export default async function TopReviewsWidget(): Promise<React.ReactElement | null> {
  const items: ProductReviewItem[] = await getTopApprovedProductReviews({
    limit: DEFAULT_LIMIT,
    minRating: DEFAULT_MIN_RATING,
  })

  if (!items.length) {
    return null
  }

  const copy = storefrontConfig.copy.reviews.topWidget

  return (
    <section
      className="bg-[var(--theme-canvas)] py-16 small:py-24"
      data-testid="top-reviews-widget"
    >
      <div className="content-container">
        <div className="mx-auto flex max-w-3xl flex-col gap-4 text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-[var(--theme-foreground)] small:text-4xl">
            {copy.title}
          </h2>
          {copy.subtitle ? (
            <p className="text-base leading-7 text-[var(--theme-muted)]">
              {copy.subtitle}
            </p>
          ) : null}
        </div>

        <ul className="grid gap-6 pt-12 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          {items.map((review) => (
            <li key={review.id} className="h-full">
              <ProductReviewCard review={review} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
