"use client"

import * as React from "react"

import { storefrontConfig } from "@lib/storefront-config"
import ProductReviewForm from "@modules/products/components/product-review-form"

/**
 * `<WriteReviewButton>` — Phase 1 / step 8 — wires the «Написать отзыв» CTA
 * to the modal `ProductReviewForm`.
 *
 * Auth-aware contract (plan §6.4 / §10):
 *   - `authRequired` (parent decides via server-fetched `customer === null`)
 *     keeps the button rendered but disabled; hover/focus shows the
 *     `reviews.form.authRequired` hint and click is a no-op. Phase 1 does
 *     not redirect to login — the button stays visible so the user knows
 *     reviews exist for the product.
 *   - `canWrite` is reserved for future verified-purchase enforcement on
 *     the client; in Phase 1 the backend (`require_purchase`) is the single
 *     source of truth and we keep the button enabled for any logged-in
 *     customer (plan §6.4 — «не дублируй verified-purchase логику на
 *     клиенте»).
 *
 * `data-action="open-review-form"` is preserved for analytics / e2e selectors
 * established in step 6.
 */

type WriteReviewButtonProps = {
  productId: string
  /**
   * `true` when the customer is authenticated AND not blocked by any
   * client-known precondition. In Phase 1 this is just `!authRequired`.
   */
  canWrite: boolean
  /**
   * `true` when the customer is not authenticated. Mutually-exclusive with
   * `canWrite` in Phase 1; kept as a separate flag so future phases can add
   * other gating reasons (e.g. blocked customer) without overloading
   * `canWrite`.
   */
  authRequired: boolean
}

const WriteReviewButton: React.FC<WriteReviewButtonProps> = ({
  productId,
  canWrite,
  authRequired,
}) => {
  const reviewsCopy = storefrontConfig.copy.reviews
  const [open, setOpen] = React.useState(false)

  const disabled = authRequired || !canWrite
  const hint = authRequired ? reviewsCopy.form.authRequired : undefined

  const handleClick = () => {
    if (disabled) return
    setOpen(true)
  }

  return (
    <>
      <button
        type="button"
        data-action="open-review-form"
        onClick={handleClick}
        disabled={disabled}
        aria-disabled={disabled || undefined}
        aria-haspopup="dialog"
        aria-expanded={open || undefined}
        title={hint}
        aria-label={hint}
        className="inline-flex items-center justify-center rounded-[var(--theme-radius-pill)] border border-[var(--theme-border)] bg-[var(--theme-canvas)] px-5 py-2.5 text-sm font-semibold text-[var(--theme-foreground)] transition-colors hover:border-[var(--theme-accent)] hover:text-[var(--theme-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-[var(--theme-border)] disabled:hover:text-[var(--theme-foreground)]"
      >
        {reviewsCopy.cta.write}
      </button>

      {/*
        The modal mounts only when needed; rendering it conditionally also
        prevents the disabled (auth-required) variant from instantiating any
        client transitions or pulling auth headers it cannot use.
      */}
      {!disabled ? (
        <ProductReviewForm
          productId={productId}
          open={open}
          onOpenChange={setOpen}
        />
      ) : null}
    </>
  )
}

export default WriteReviewButton
