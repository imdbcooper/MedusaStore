import * as React from "react"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { storefrontConfig } from "@lib/storefront-config"
import type { MyProductReviewListResult } from "@lib/data/product-reviews"

import MyReviewCard from "./my-review-card"

/**
 * Phase 2 / step 5 — server-rendered «Мои отзывы» list.
 *
 * Receives the result of {@link getMyProductReviews} as props and renders:
 *   - empty-state when `total === 0`;
 *   - one [`MyReviewCard`](./my-review-card.tsx:1) per item;
 *   - server-rendered pagination links (`?page=N`).
 *
 * Pagination link generation: `?page=N`-style links are intentionally
 * generated via `URLSearchParams` rather than `LocalizedClientLink` because
 * we want a plain anchor that hits the same route — the client islands
 * inside cards remain isolated.
 */

type MyReviewsProps = {
  result: MyProductReviewListResult
}

function buildPageHref(page: number): string {
  const params = new URLSearchParams()
  if (page > 1) {
    params.set("page", String(page))
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ""
}

const MyReviews: React.FC<MyReviewsProps> = ({ result }) => {
  const accountCopy = storefrontConfig.copy.reviews.account
  const { items, total, page, pageSize } = result

  if (total === 0 || items.length === 0) {
    return (
      <div
        className="flex w-full flex-col items-center gap-y-3 rounded-xl border border-dashed border-gray-300 bg-gray-50/60 px-6 py-10 text-center"
        data-testid="my-reviews-empty"
      >
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-ui-fg-subtle">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 2.25l2.92 6.18 6.83.79-5.05 4.66 1.39 6.62L12 17.27l-6.09 3.23 1.39-6.62L2.25 9.22l6.83-.79L12 2.25z" />
          </svg>
        </div>
        <h2 className="text-large-semi">{accountCopy.empty}</h2>
        <p className="text-small-regular text-ui-fg-subtle max-w-prose">
          {accountCopy.emptyHint}
        </p>
        <div className="mt-2">
          <LocalizedClientLink
            href={accountCopy.emptyCTAHref}
            className="inline-flex items-center gap-x-2 rounded-md bg-ui-button-inverted px-4 py-2 text-small-semi text-ui-fg-on-color transition-colors hover:bg-ui-button-inverted-hover"
            data-testid="my-reviews-empty-cta"
          >
            {accountCopy.emptyCTA}
          </LocalizedClientLink>
        </div>
      </div>
    )
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const hasPrev = page > 1
  const hasNext = page < totalPages
  const pageOfLabel = accountCopy.pagination.pageOf
    .replace("{current}", String(page))
    .replace("{total}", String(totalPages))

  return (
    <div className="flex flex-col gap-6 w-full" data-testid="my-reviews-list">
      <ul className="flex flex-col gap-4">
        {items.map((item) => (
          <li key={item.id}>
            <MyReviewCard review={item} />
          </li>
        ))}
      </ul>

      {totalPages > 1 ? (
        <nav
          className="flex items-center justify-between gap-3 border-t border-gray-200 pt-4"
          aria-label={accountCopy.title}
          data-testid="my-reviews-pagination"
        >
          <div>
            {hasPrev ? (
              <a
                href={buildPageHref(page - 1)}
                className="inline-flex items-center gap-x-1 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-small-semi text-ui-fg-base transition-colors hover:bg-gray-50"
                data-testid="my-reviews-pagination-prev"
              >
                ← {accountCopy.pagination.prev}
              </a>
            ) : (
              <span aria-hidden="true" />
            )}
          </div>
          <span className="text-xs text-ui-fg-subtle">{pageOfLabel}</span>
          <div>
            {hasNext ? (
              <a
                href={buildPageHref(page + 1)}
                className="inline-flex items-center gap-x-1 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-small-semi text-ui-fg-base transition-colors hover:bg-gray-50"
                data-testid="my-reviews-pagination-next"
              >
                {accountCopy.pagination.next} →
              </a>
            ) : (
              <span aria-hidden="true" />
            )}
          </div>
        </nav>
      ) : null}
    </div>
  )
}

export default MyReviews
