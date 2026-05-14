import * as React from "react"

import { storefrontConfig } from "@lib/storefront-config"
import { getProductRatingSummary } from "@lib/data/product-reviews"
import { pluralizeRu } from "@lib/util/pluralize-ru"

/**
 * Phase 1 / step 7 — compact rating badge rendered next to the product
 * title in `ProductInfo` (plan §6.2, §7).
 *
 * Server component (no `"use client"`). Re-uses
 * [`getProductRatingSummary`](medusa-agency-boilerplate-storefront/src/lib/data/product-reviews.ts:77)
 * which is already keyed by the `product-rating-${productId}` cache tag
 * (plan §6.6). Calling the function twice on the same render — once here
 * and once from
 * [`ProductReviewsSummary`](medusa-agency-boilerplate-storefront/src/modules/products/components/product-reviews-summary/index.tsx:1)
 * — is safe: Next.js dedupes identical `fetch` requests within a single
 * render lifecycle.
 *
 * Empty-state contract (plan §6.2):
 *   - `total_reviews === 0` OR `average_rating === null`
 *   - `variant === "product-info"` → render `copy.reviews.empty.shortLabel`
 *     as muted inline text (no border, no button — fits between title and
 *     description without adding visual weight).
 *   - `variant === "thumbnail"` → render `null` (Phase 2 will render a
 *     compact star count; for now the variant only guards the type
 *     surface — see plan §6.3, §13).
 *
 * All copy comes from `storefrontConfig.copy.reviews.*` (plan §6.7).
 *
 * Anchor scroll: the badge links to `#reviews` which is anchored on the
 * `ProductTabs` accordion item wrapper. Phase 1 only scrolls the page;
 * automatic accordion expansion is deferred to Phase 2.
 */

export type ProductRatingBadgeVariant = "product-info" | "thumbnail"

type ProductRatingBadgeProps = {
  productId: string
  variant?: ProductRatingBadgeVariant
}

const RATING_FORMATTER = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

const COUNT_FORMATTER = new Intl.NumberFormat("ru-RU")

const ProductRatingBadge = async ({
  productId,
  variant = "product-info",
}: ProductRatingBadgeProps) => {
  const reviewsCopy = storefrontConfig.copy.reviews
  const summary = await getProductRatingSummary(productId)

  const total = summary?.total_reviews ?? 0
  const average = summary?.average_rating ?? null
  const isEmpty = !summary || total === 0 || average === null

  if (isEmpty) {
    if (variant === "thumbnail") {
      // Catalog thumbnails stay clean when there is no rating yet (plan §6.3).
      return null
    }

    return (
      <span
        className="inline-flex items-center text-sm font-medium text-[var(--theme-muted)]"
        data-testid="product-rating-badge-empty"
      >
        {reviewsCopy.empty.shortLabel}
      </span>
    )
  }

  const reviewWord = pluralizeRu(
    total,
    reviewsCopy.reviewWordForms as readonly [string, string, string]
  )
  const formattedAverage = RATING_FORMATTER.format(average!)
  const formattedCount = COUNT_FORMATTER.format(total)

  const ariaLabel = reviewsCopy.badge.ariaLabel
    .replace("{rating}", formattedAverage)
    .replace("{count}", formattedCount)
    .replace("{countPlural}", reviewWord)

  if (variant === "thumbnail") {
    // Reserved for Phase 2 (plan §6.3, §13). Render a minimal, non-linked
    // pill so callers that opt-in early get a sensible default without us
    // wiring it into the catalog `Thumbnail` here.
    return (
      <span
        aria-label={ariaLabel}
        className="inline-flex items-center gap-1 rounded-full bg-[var(--theme-surface)] px-2 py-0.5 text-xs font-semibold text-[var(--theme-foreground)]"
        data-testid="product-rating-badge-thumbnail"
      >
        <span aria-hidden="true" className="text-[var(--theme-accent,#f5a524)]">
          ★
        </span>
        {formattedAverage}
      </span>
    )
  }

  const shortCount = reviewsCopy.summary.shortCountTemplate
    .replace("{count}", formattedCount)
    .replace("{countPlural}", reviewWord)

  return (
    <a
      href="#reviews"
      aria-label={ariaLabel}
      data-testid="product-rating-badge"
      className="inline-flex items-center gap-1.5 text-sm text-[var(--theme-muted)] transition-colors hover:text-[var(--theme-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--theme-canvas)] rounded-sm"
    >
      <span aria-hidden="true" className="text-[var(--theme-accent,#f5a524)]">
        ★
      </span>
      <span className="font-semibold text-[var(--theme-foreground)] tabular-nums">
        {formattedAverage}
      </span>
      <span className="text-[var(--theme-muted)] tabular-nums">
        {shortCount}
      </span>
    </a>
  )
}

export default ProductRatingBadge
