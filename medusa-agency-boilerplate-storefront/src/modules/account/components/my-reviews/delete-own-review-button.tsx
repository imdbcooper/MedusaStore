"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { deleteMyProductReview } from "@lib/data/product-reviews"
import { storefrontConfig } from "@lib/storefront-config"

/**
 * Phase 2 / step 5 — client island used inside server-rendered
 * [`MyReviewCard`](./my-review-card.tsx:1).
 *
 * The `_medusa_jwt` cookie is `httpOnly`, so a direct `DELETE` from the
 * browser cannot send the auth header. The button delegates to the
 * `deleteMyProductReview` server action which:
 *   - reads the cookie on the server,
 *   - calls `DELETE /store/customers/me/reviews/:id`,
 *   - on 204, invalidates `customer-reviews-${customerId}`.
 *
 * UX:
 *   - `window.confirm` (no toast / modal infra wired in; the project pattern
 *     for one-shot destructive ops is the same — see `signout` and the
 *     transfer-request flows).
 *   - inline status banner replaces the button while a request is in flight
 *     and on terminal failure (`cannot_delete_published` etc).
 *   - on success the row stays mounted briefly, then the page is refreshed
 *     via `router.refresh()` so the server re-fetches with the now-stale
 *     `customer-reviews-${id}` tag (plan §6.5/§6.6).
 */

type DeleteOwnReviewButtonProps = {
  reviewId: string
}

type Banner = { tone: "error" | "success"; message: string } | null

const DeleteOwnReviewButton: React.FC<DeleteOwnReviewButtonProps> = ({
  reviewId,
}) => {
  const router = useRouter()
  const accountCopy = storefrontConfig.copy.reviews.account
  const deleteCopy = accountCopy.delete

  const [pending, startTransition] = React.useTransition()
  const [banner, setBanner] = React.useState<Banner>(null)

  const handleClick = React.useCallback(() => {
    if (pending) return
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(deleteCopy.confirm)
      if (!confirmed) return
    }

    setBanner(null)

    startTransition(async () => {
      try {
        const result = await deleteMyProductReview(reviewId)

        if (result.ok) {
          setBanner({ tone: "success", message: deleteCopy.success })
          // The tag has just been invalidated server-side; `router.refresh()`
          // re-renders the server tree so the deleted row drops out of the
          // list without a full navigation.
          router.refresh()
          return
        }

        const message =
          result.code === "cannot_delete_published"
            ? deleteCopy.cannotDeletePublished
            : result.code === "not_found"
              ? deleteCopy.notFound
              : result.code === "auth_required"
                ? deleteCopy.authRequired
                : deleteCopy.error
        setBanner({ tone: "error", message })
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(
          "[MyReviews] delete failed:",
          error instanceof Error ? error.message : error
        )
        setBanner({ tone: "error", message: deleteCopy.error })
      }
    })
  }, [pending, reviewId, router, deleteCopy])

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        aria-busy={pending}
        className="inline-flex items-center gap-2 rounded-md border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 transition-colors hover:border-rose-300 hover:bg-rose-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 disabled:cursor-not-allowed disabled:opacity-70"
        data-testid={`delete-review-${reviewId}`}
      >
        <span aria-hidden="true">🗑</span>
        <span>{pending ? deleteCopy.submitting : deleteCopy.cta}</span>
      </button>
      {banner ? (
        <p
          role="status"
          className={
            "max-w-[18rem] text-right text-xs " +
            (banner.tone === "error"
              ? "text-rose-700"
              : "text-emerald-700")
          }
        >
          {banner.message}
        </p>
      ) : null}
    </div>
  )
}

export default DeleteOwnReviewButton
