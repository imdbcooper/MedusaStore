import * as React from "react"

import { storefrontConfig } from "@lib/storefront-config"
import type { MyProductReview } from "@lib/data/product-reviews"
import ReviewStars from "@modules/common/components/review-stars"

import DeleteOwnReviewButton from "./delete-own-review-button"

/**
 * Phase 2 / step 5 — server-rendered card for one of the authenticated
 * customer's reviews on the «Мои отзывы» page.
 *
 * Plain-text rendering only (plan §10.2). The single client island is
 * [`DeleteOwnReviewButton`](./delete-own-review-button.tsx:1).
 *
 * Delete-button visibility (plan §6.5):
 *   - `pending`   → button shown.
 *   - `rejected`  → button shown (backend allows deletion of rejected rows
 *                   so the customer can clean up).
 *   - `approved`  → button hidden — the backend would respond 409
 *                   `cannot_delete_published`, and a hidden button keeps the
 *                   surface clean.
 *
 * Product link (Phase 2 backend gap): `ProductReview` does not store the
 * product `handle`, only `product_id`. Storefront product routes are
 * keyed by `handle`, so we cannot build a working link from `product_id`
 * alone without a per-row product fetch. Phase 2 ships the badge as plain
 * text; the link will be added in Phase 3 once the backend either denormalises
 * `product_handle` onto `ProductReview` or exposes a batch lookup.
 */

type MyReviewCardProps = {
  review: MyProductReview
}

const DATE_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "long",
})

function formatDateLong(iso: string): string {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso
  }
  return DATE_FORMATTER.format(date)
}

const STATUS_BADGE_CLASS: Record<MyProductReview["status"], string> = {
  pending:
    "border-amber-300 bg-amber-50 text-amber-800",
  approved:
    "border-emerald-300 bg-emerald-50 text-emerald-800",
  rejected:
    "border-rose-300 bg-rose-50 text-rose-800",
}

const MyReviewCard: React.FC<MyReviewCardProps> = ({ review }) => {
  const reviewsCopy = storefrontConfig.copy.reviews
  const accountCopy = reviewsCopy.account
  const dateLabel = formatDateLong(review.created_at)
  const statusLabel = reviewsCopy.status[review.status] ?? review.status
  const statusBadgeClass =
    STATUS_BADGE_CLASS[review.status] ??
    "border-gray-200 bg-gray-50 text-ui-fg-subtle"

  const showDeleteButton =
    review.status === "pending" || review.status === "rejected"

  return (
    <article
      className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm small:p-6"
      data-testid="my-review-card"
      data-review-id={review.id}
      data-review-status={review.status}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-ui-fg-subtle">
            <span className="font-semibold text-ui-fg-base">
              {accountCopy.productLabel}:
            </span>
            {/* TODO Phase 3: подгрузить product.handle и сделать ссылку
                /[countryCode]/products/${handle}. Пока — plain text id,
                чтобы не делать N+1 фетч на /account/reviews. */}
            <span
              className="font-mono break-all text-[11px] text-ui-fg-muted"
              title={review.product_id}
            >
              {review.product_id}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ReviewStars value={review.rating} size="md" />
            {dateLabel ? (
              <time
                className="text-xs text-ui-fg-subtle"
                dateTime={review.created_at}
              >
                {accountCopy.createdLabel} {dateLabel}
              </time>
            ) : null}
          </div>
        </div>
        <span
          className={
            "inline-flex flex-shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold " +
            statusBadgeClass
          }
        >
          {statusLabel}
        </span>
      </header>

      {review.title ? (
        <h3 className="text-base font-semibold leading-tight text-ui-fg-base">
          {review.title}
        </h3>
      ) : null}

      <p className="whitespace-pre-line text-sm leading-6 text-ui-fg-base">
        {review.text}
      </p>

      {review.pros ? (
        <p className="whitespace-pre-line text-sm leading-6 text-ui-fg-subtle">
          <span className="font-semibold text-ui-fg-base">
            {accountCopy.prosLabel}:{" "}
          </span>
          {review.pros}
        </p>
      ) : null}

      {review.cons ? (
        <p className="whitespace-pre-line text-sm leading-6 text-ui-fg-subtle">
          <span className="font-semibold text-ui-fg-base">
            {accountCopy.consLabel}:{" "}
          </span>
          {review.cons}
        </p>
      ) : null}

      {review.status === "rejected" && review.rejection_reason ? (
        <div className="rounded-md border border-rose-200 bg-rose-50/60 p-3 text-xs text-rose-800">
          <p className="font-semibold">{accountCopy.rejectedReasonLabel}</p>
          <p className="mt-1 whitespace-pre-line">
            {review.rejection_reason}
          </p>
        </div>
      ) : null}

      {showDeleteButton ? (
        <footer className="flex justify-end">
          <DeleteOwnReviewButton reviewId={review.id} />
        </footer>
      ) : null}
    </article>
  )
}

export default MyReviewCard
