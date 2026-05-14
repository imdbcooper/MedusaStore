"use client"

import * as React from "react"

import { voteHelpfulOnReview } from "@lib/data/product-reviews"
import { storefrontConfig } from "@lib/storefront-config"

/**
 * `<HelpfulButton>` — Phase 1 client island inside `ProductReviewCard`.
 *
 * Delegates to the `voteHelpfulOnReview` server action which attaches the
 * customer's `_medusa_jwt` cookie auth header (the cookie is `httpOnly`, so
 * a direct `sdk.client.fetch` from the browser cannot send it). Backend
 * dedupes votes via the `(review_id, customer_id)` PK and returns the new
 * `helpful_count` plus `already_voted` (plan §4.3 / §10.4).
 *
 * The button stays disabled while the request is in flight; on success the
 * label switches to `copy.reviews.cta.helpfulVoted`. Errors are swallowed
 * and forwarded to `console.error` per Phase 1 (step 6 — toast infra is
 * intentionally out of scope).
 */

type HelpfulButtonProps = {
  reviewId: string
  initialCount: number
  initialVoted?: boolean
}

const HelpfulButton: React.FC<HelpfulButtonProps> = ({
  reviewId,
  initialCount,
  initialVoted = false,
}) => {
  const reviewsCopy = storefrontConfig.copy.reviews
  const [count, setCount] = React.useState<number>(
    Number.isFinite(initialCount) ? Math.max(0, Math.trunc(initialCount)) : 0
  )
  const [voted, setVoted] = React.useState<boolean>(initialVoted)
  const [pending, setPending] = React.useState<boolean>(false)

  const handleClick = React.useCallback(async () => {
    if (pending || voted) return
    setPending(true)
    try {
      const result = await voteHelpfulOnReview(reviewId)
      if (result.ok) {
        if (typeof result.helpful_count === "number") {
          setCount(result.helpful_count)
        }
        setVoted(true)
      } else if (result.code === "auth_required") {
        // Phase 1: silently no-op; an authenticated UX comes with the
        // form work in step 8. The button keeps its idle label.
      } else {
        // eslint-disable-next-line no-console
        console.error(
          `[product-reviews] helpful vote failed code=${result.code} review_id=${reviewId}`
        )
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[product-reviews] helpful vote failed", error)
    } finally {
      setPending(false)
    }
  }, [pending, voted, reviewId])

  const label = voted ? reviewsCopy.cta.helpfulVoted : reviewsCopy.cta.helpful

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending || voted}
      aria-pressed={voted}
      className="inline-flex items-center gap-2 rounded-[var(--theme-radius-pill)] border border-[var(--theme-border)] bg-[var(--theme-canvas)] px-3 py-1.5 text-xs font-semibold text-[var(--theme-muted)] transition-colors hover:border-[var(--theme-accent)] hover:text-[var(--theme-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent)] disabled:cursor-not-allowed disabled:opacity-70"
    >
      <span aria-hidden="true">👍</span>
      <span>{label}</span>
      <span className="tabular-nums" aria-label={`${count}`}>
        {count}
      </span>
    </button>
  )
}

export default HelpfulButton
