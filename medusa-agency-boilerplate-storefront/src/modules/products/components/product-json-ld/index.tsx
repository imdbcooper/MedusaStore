import { HttpTypes } from "@medusajs/types"

import { STOREFRONT_BASE_URL } from "@lib/env"
import {
  getProductRatingSummary,
  listApprovedProductReviews,
} from "@lib/data/product-reviews"

import { buildProductJsonLd, safeJsonStringify } from "./build"

/**
 * Phase 3 / step 1 — Schema.org `Product` JSON-LD for the product page
 * (plan §9 Phase 3 item 4).
 *
 * Server component (no `"use client"`). Fetches the rating summary and the
 * latest approved reviews via the same cache-tagged data fetchers used by the
 * UI badge / list (plan §6.6):
 *   - `product-rating-${productId}`  (rating summary)
 *   - `product-reviews-${productId}` (reviews list)
 *
 * Both tags are revalidated by the moderation handlers in Phase 1, so the
 * JSON-LD payload is automatically refreshed whenever a review is approved
 * or rejected — no extra wiring required.
 *
 * Empty-state contract (plan §6.2 + §10.2):
 *   - 0 approved reviews → `Product` is rendered without `aggregateRating`
 *     and without `review[]`. This is a valid Schema.org `Product` and Google
 *     simply skips the rich-snippet enrichment.
 *   - `summary.average_rating === null` → no `aggregateRating` (we never emit
 *     a zero-count rating block — Google penalises it).
 *
 * XSS contract (plan §10.2):
 *   - The JSON is built from plain-text columns (the backend rejects HTML
 *     and markdown).
 *   - The serialised string is escaped via {@link safeJsonStringify} so that
 *     `<`, `>`, `&`, U+2028 and U+2029 cannot break out of the `<script>`
 *     element. We then inline it through `dangerouslySetInnerHTML` because
 *     React refuses to render raw text into `<script>` otherwise — this is
 *     the canonical pattern documented by Next.js for inline JSON-LD.
 */
type ProductJsonLdProps = {
  product: HttpTypes.StoreProduct
  countryCode: string
  /**
   * How many approved reviews to inline as `Review` entries. Defaults to 10
   * — large enough to satisfy Google's «sample» policy but small enough to
   * keep the HTML payload predictable. Reviews are sorted newest-first.
   */
  maxReviews?: number
}

const ProductJsonLd = async ({
  product,
  countryCode,
  maxReviews = 10,
}: ProductJsonLdProps) => {
  if (!product?.id || !product.title) {
    return null
  }

  // Both fetches sit on cache tags, so subsequent renders for the same
  // product are served from the Next.js data cache. They are issued in
  // parallel because they hit unrelated endpoints — there is no dependency
  // between the rating summary and the review list.
  const [summary, reviewsResult] = await Promise.all([
    getProductRatingSummary(product.id),
    listApprovedProductReviews({
      productId: product.id,
      page: 1,
      pageSize: maxReviews,
      sort: "newest",
    }),
  ])

  const productLd = buildProductJsonLd({
    product,
    summary,
    reviews: reviewsResult.items,
    siteUrl: STOREFRONT_BASE_URL,
    countryCode,
    maxReviews,
  })

  if (!productLd) {
    return null
  }

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger -- inline JSON-LD requires raw text inside <script>; we escape `<`, `>`, `&`, U+2028 and U+2029 via safeJsonStringify (plan §10.2 XSS contract).
      dangerouslySetInnerHTML={{ __html: safeJsonStringify(productLd) }}
    />
  )
}

export default ProductJsonLd
