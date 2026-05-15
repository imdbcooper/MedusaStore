import * as React from "react"

import { storefrontConfig } from "@lib/storefront-config"
import type { ProductReviewItem } from "@lib/data/product-reviews"
import ReviewStars from "@modules/common/components/review-stars"

import HelpfulButton from "./helpful-button"

/**
 * Phase 1 / step 6 — server component: a single review card.
 *
 * Server-rendered (no `"use client"`). The «Полезно» button is a client
 * island ([`./helpful-button.tsx`](medusa-agency-boilerplate-storefront/src/modules/products/components/product-review-card/helpful-button.tsx:1))
 * — that is the entire interactive surface in this card.
 *
 * Plain-text rendering only (plan §10.2). React escapes JSX text by default,
 * `whitespace-pre-line` preserves manual line breaks the customer typed in
 * `text`. No HTML parsing, no Markdown, no `dangerouslySetInnerHTML`.
 */

type ProductReviewCardProps = {
  review: ProductReviewItem
}

const DATE_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "long",
})

const formatDateLong = (iso: string): string => {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso
  }
  return DATE_FORMATTER.format(date)
}

const ProductReviewCard: React.FC<ProductReviewCardProps> = ({ review }) => {
  const reviewsCopy = storefrontConfig.copy.reviews
  const dateLabel = formatDateLong(review.created_at)

  return (
    <article
      className="flex flex-col gap-4 rounded-[var(--theme-radius-card)] border border-[var(--theme-border)] bg-[var(--theme-surface)] p-6"
      data-testid="product-review-card"
      data-review-id={review.id}
    >
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-base font-semibold text-[var(--theme-foreground)]">
            {review.customer_name}
          </span>
          {review.verified_purchase ? (
            <span
              className="inline-flex items-center gap-1 rounded-[var(--theme-radius-pill)] bg-[var(--theme-accent-soft,rgba(31,95,174,0.12))] px-2.5 py-0.5 text-xs font-semibold text-[var(--theme-accent,#1f5fae)]"
              aria-label={reviewsCopy.verified}
            >
              <span aria-hidden="true">✓</span>
              <span>{reviewsCopy.verified}</span>
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ReviewStars value={review.rating} size="md" />
          {dateLabel ? (
            <time
              className="text-xs text-[var(--theme-muted)]"
              dateTime={review.created_at}
            >
              {dateLabel}
            </time>
          ) : null}
        </div>
      </header>

      {review.title ? (
        <h4 className="text-lg font-semibold leading-tight text-[var(--theme-foreground)]">
          {review.title}
        </h4>
      ) : null}

      <p className="whitespace-pre-line text-sm leading-6 text-[var(--theme-foreground)]">
        {review.text}
      </p>

      {review.pros ? (
        <p className="whitespace-pre-line text-sm leading-6 text-[var(--theme-muted)]">
          <span className="font-semibold text-[var(--theme-foreground)]">
            Достоинства:{" "}
          </span>
          {review.pros}
        </p>
      ) : null}

      {review.cons ? (
        <p className="whitespace-pre-line text-sm leading-6 text-[var(--theme-muted)]">
          <span className="font-semibold text-[var(--theme-foreground)]">
            Недостатки:{" "}
          </span>
          {review.cons}
        </p>
      ) : null}

      {/* ----------------------------------------------------------------
          Phase 3 / step 4 — «Ответ магазина».
          Rendered immediately after the customer's text/pros/cons but
          before the helpful-button footer so the reply is visually
          attached to the review it answers. Quote-style left border via
          existing theme tokens; date format reuses the same `ru-RU`
          DateTimeFormat as the review header (consistency).
          ---------------------------------------------------------------- */}
      {review.merchant_reply ? (
        <aside
          className="rounded-[var(--theme-radius-card)] border-l-2 border-[var(--theme-accent,#1f5fae)] bg-[var(--theme-accent-soft,rgba(31,95,174,0.06))] px-4 py-3"
          data-testid="product-review-card-merchant-reply"
        >
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--theme-accent,#1f5fae)]">
            {reviewsCopy.merchantReplyLabel}
          </div>
          <p className="mt-1 whitespace-pre-line text-sm leading-6 text-[var(--theme-foreground)]">
            {review.merchant_reply.text}
          </p>
          {review.merchant_reply.created_at ? (
            <time
              className="mt-1 block text-xs text-[var(--theme-muted)]"
              dateTime={review.merchant_reply.created_at}
            >
              {formatDateLong(review.merchant_reply.created_at)}
            </time>
          ) : null}
        </aside>
      ) : null}

      <footer className="flex justify-end">
        <HelpfulButton
          reviewId={review.id}
          initialCount={review.helpful_count}
        />
      </footer>
    </article>
  )
}

export default ProductReviewCard
