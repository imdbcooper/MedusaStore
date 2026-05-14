import * as React from "react"

import { storefrontConfig } from "@lib/storefront-config"
import { getProductRatingSummary } from "@lib/data/product-reviews"
import { pluralizeRu } from "@lib/util/pluralize-ru"
import ReviewStars from "@modules/common/components/review-stars"
import { HttpTypes } from "@medusajs/types"

import WriteReviewButton from "./write-review-button"

/**
 * Phase 1 / step 6 — server component: rating summary card on the product
 * «Отзывы» tab.
 *
 * Server component (no `"use client"`). Fetches summary via
 * [`getProductRatingSummary`](medusa-agency-boilerplate-storefront/src/lib/data/product-reviews.ts:1)
 * which already attaches the `product-rating-${productId}` cache tag (plan
 * §6.6). All texts come from `storefrontConfig.copy.reviews.*` — no inline
 * literals (plan §6.7).
 *
 * Empty-state contract (plan §6.2):
 *   - `total_reviews === 0` OR `average_rating === null` → render
 *     `copy.reviews.summary.empty` and the «Написать отзыв» CTA stub.
 */

type ProductReviewsSummaryProps = {
  productId: string
  /**
   * The currently authenticated customer (or `null` when the visitor is
   * anonymous). Phase 1 / step 8 — the parent `ProductTemplate` fetches it
   * once via [`retrieveCustomer`](medusa-agency-boilerplate-storefront/src/lib/data/customer.ts:18)
   * and passes it down so the «Написать отзыв» CTA can decide whether to
   * disable itself with the `reviews.form.authRequired` hint (plan §6.4).
   */
  customer: HttpTypes.StoreCustomer | null
}

const RATING_FORMATTER = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

const COUNT_FORMATTER = new Intl.NumberFormat("ru-RU")

const ProductReviewsSummary = async ({
  productId,
  customer,
}: ProductReviewsSummaryProps) => {
  const reviewsCopy = storefrontConfig.copy.reviews
  const summary = await getProductRatingSummary(productId)

  const total = summary?.total_reviews ?? 0
  const average = summary?.average_rating ?? null
  const isEmpty = !summary || total === 0 || average === null

  const reviewWord = pluralizeRu(
    total,
    reviewsCopy.reviewWordForms as readonly [string, string, string]
  )

  const distribution: { rating: number; count: number }[] = [
    { rating: 5, count: summary?.rating_5 ?? 0 },
    { rating: 4, count: summary?.rating_4 ?? 0 },
    { rating: 3, count: summary?.rating_3 ?? 0 },
    { rating: 2, count: summary?.rating_2 ?? 0 },
    { rating: 1, count: summary?.rating_1 ?? 0 },
  ]

  const summaryAverageLine = reviewsCopy.summary.average
    .replace("{rating}", average !== null ? RATING_FORMATTER.format(average) : "–")
    .replace("{count}", COUNT_FORMATTER.format(total))
    .replace("{countPlural}", reviewWord)

  return (
    <section
      className="rounded-[var(--theme-radius-card)] border border-[var(--theme-border)] bg-[var(--theme-surface)] p-6 small:p-8"
      aria-labelledby="product-reviews-summary-heading"
    >
      <h3 id="product-reviews-summary-heading" className="sr-only">
        {reviewsCopy.tabTitle}
      </h3>
      <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
        {/* Left column — average + stars */}
        <div className="flex flex-col items-start gap-3">
          {isEmpty ? (
            <>
              <span className="text-base font-medium text-[var(--theme-foreground)]">
                {reviewsCopy.summary.empty}
              </span>
              <ReviewStars value={0} size="lg" />
            </>
          ) : (
            <>
              <span className="text-5xl font-semibold leading-none tracking-[-0.02em] text-[var(--theme-foreground)]">
                {RATING_FORMATTER.format(average!)}
              </span>
              <ReviewStars value={average!} size="lg" />
              <span className="text-sm text-[var(--theme-muted)]">
                {summaryAverageLine}
              </span>
            </>
          )}
        </div>

        {/* Middle column — distribution bars */}
        <div className="flex w-full max-w-md flex-col gap-2">
          {distribution.map(({ rating, count }) => {
            const ratio =
              total > 0 ? Math.max(0, Math.min(1, count / total)) : 0
            const widthPercent = Math.round(ratio * 100)

            return (
              <div
                key={rating}
                className="flex items-center gap-3 text-sm text-[var(--theme-muted)]"
              >
                <span
                  className="inline-flex w-12 shrink-0 items-center gap-1 font-medium text-[var(--theme-foreground)]"
                  aria-label={`${rating} из 5`}
                >
                  {rating}
                  <span aria-hidden="true">★</span>
                </span>
                <span
                  className="relative h-2 flex-1 overflow-hidden rounded-full bg-[var(--theme-surface-muted,rgba(0,0,0,0.06))]"
                  role="progressbar"
                  aria-valuenow={count}
                  aria-valuemin={0}
                  aria-valuemax={total}
                >
                  <span
                    className="absolute inset-y-0 left-0 rounded-full bg-[var(--theme-accent,#f5a524)]"
                    style={{ width: `${widthPercent}%` }}
                  />
                </span>
                <span className="w-10 shrink-0 text-right tabular-nums">
                  {COUNT_FORMATTER.format(count)}
                </span>
              </div>
            )
          })}
        </div>

        {/*
          Right column — CTA. The button decides itself whether the click
          opens the modal or stays disabled with the `authRequired` hint
          (plan §6.4). `canWrite` is `true` for any logged-in customer in
          Phase 1; verified-purchase enforcement runs on the backend
          (`require_purchase` code → form error message).
        */}
        <div className="flex shrink-0 items-start">
          <WriteReviewButton
            productId={productId}
            canWrite={customer !== null}
            authRequired={customer === null}
          />
        </div>
      </div>
    </section>
  )
}

export default ProductReviewsSummary
