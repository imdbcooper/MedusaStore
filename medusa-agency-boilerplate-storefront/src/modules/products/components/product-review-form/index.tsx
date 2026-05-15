"use client"

import * as React from "react"
import { Button, Heading } from "@medusajs/ui"

import { storefrontConfig } from "@lib/storefront-config"
import {
  submitProductReview,
  type ProductReviewSubmitCode,
  type ProductReviewSubmitResult,
} from "@lib/data/product-reviews"
import Modal from "@modules/common/components/modal"
import ReviewStarsInput from "@modules/common/components/review-stars/input"

/**
 * Phase 1 / step 8 — `<ProductReviewForm>`.
 *
 * Customer-facing modal that creates a review through the
 * [`submitProductReview`](medusa-agency-boilerplate-storefront/src/lib/data/product-reviews.ts:1)
 * server action. The form mirrors the strict backend Zod schema
 * (`/store/products/:id/reviews`):
 *
 *   - `rating`        — required integer 1..5;
 *   - `text`          — required string trimmed length 10..2000;
 *   - `title`         — optional string max 120;
 *   - `pros` / `cons` — optional strings max 1000 each;
 *   - `website`       — honeypot (plan §10.1, §6.4) — visually hidden field
 *                       that is always sent to the server. Real users leave
 *                       it empty; bots fill it and the backend silently
 *                       returns a 201 without writing anything.
 *
 * `images` is intentionally NOT exposed in Phase 1 (plan §13). The backend
 * `.strict()` Zod schema would reject it with HTTP 400.
 *
 * All visible text comes from `storefrontConfig.copy.reviews.form.*` —
 * no inline literals (plan §6.7). Backend error responses are mapped by
 * `code`, not by `message`, so renames on the backend do not break the UI
 * contract (the same convention as `voteHelpfulOnReview`).
 *
 * The Modal primitive is the project-wide
 * [`@modules/common/components/modal`](medusa-agency-boilerplate-storefront/src/modules/common/components/modal/index.tsx:1)
 * built on top of `@headlessui/react` Dialog — same one as
 * `AddAddress` / `EditAddress`. No new primitive is introduced.
 */

// Validation limits — kept in sync with the backend strict Zod schema in
// [`route.ts`](medusa-agency-boilerplate/src/api/store/products/[id]/reviews/route.ts:124).
// If the env-driven backend defaults change, these numbers must be updated
// together. (Phase 1 plan §6.4 / §10.2.)
export const REVIEW_FORM_LIMITS = {
  textMin: 10,
  textMax: 2000,
  titleMax: 120,
  prosMax: 1000,
  consMax: 1000,
} as const

type ProductReviewFormProps = {
  productId: string
  open: boolean
  onOpenChange: (next: boolean) => void
}

type FormValues = {
  rating: number
  title: string
  text: string
  pros: string
  cons: string
  website: string
}

type FormErrors = Partial<Record<"rating" | "title" | "text" | "pros" | "cons", string>>

const INITIAL_VALUES: FormValues = {
  rating: 0,
  title: "",
  text: "",
  pros: "",
  cons: "",
  website: "",
}

/**
 * Maps a `submitProductReview` server-action error code to the right copy
 * key under `reviews.form.*`. The fallthrough is `form.error` so an
 * unexpected backend status never leaves the user without feedback.
 */
function pickErrorCopy(code: ProductReviewSubmitCode): string {
  const formCopy = storefrontConfig.copy.reviews.form
  switch (code) {
    case "auth_required":
      return formCopy.authRequired
    case "duplicate_review":
      return formCopy.alreadyExists
    case "require_purchase":
      return formCopy.requirePurchase
    case "rate_limited":
      return formCopy.rateLimited
    case "validation_error":
    case "unknown":
    default:
      return formCopy.error
  }
}

const ProductReviewForm: React.FC<ProductReviewFormProps> = ({
  productId,
  open,
  onOpenChange,
}) => {
  const formCopy = storefrontConfig.copy.reviews.form

  const [values, setValues] = React.useState<FormValues>(INITIAL_VALUES)
  const [errors, setErrors] = React.useState<FormErrors>({})
  const [submitError, setSubmitError] = React.useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = React.useState<boolean>(false)
  const [isPending, startTransition] = React.useTransition()

  // Reset form whenever the modal closes — opens with a clean slate next
  // time. The reset is delayed slightly so the success message stays
  // visible during the fade-out.
  React.useEffect(() => {
    if (!open) {
      const id = window.setTimeout(() => {
        setValues(INITIAL_VALUES)
        setErrors({})
        setSubmitError(null)
        setSubmitSuccess(false)
      }, 200)
      return () => window.clearTimeout(id)
    }
  }, [open])

  const close = React.useCallback(() => {
    if (isPending) return
    onOpenChange(false)
  }, [isPending, onOpenChange])

  const validate = React.useCallback((next: FormValues): FormErrors => {
    const nextErrors: FormErrors = {}

    if (!Number.isInteger(next.rating) || next.rating < 1 || next.rating > 5) {
      nextErrors.rating = formCopy.errors.ratingRequired
    }

    const trimmedText = next.text.trim()
    if (trimmedText.length < REVIEW_FORM_LIMITS.textMin) {
      nextErrors.text = formCopy.errors.textTooShort.replace(
        "{min}",
        String(REVIEW_FORM_LIMITS.textMin)
      )
    } else if (trimmedText.length > REVIEW_FORM_LIMITS.textMax) {
      nextErrors.text = formCopy.errors.textTooLong.replace(
        "{max}",
        String(REVIEW_FORM_LIMITS.textMax)
      )
    }

    if (next.title.trim().length > REVIEW_FORM_LIMITS.titleMax) {
      nextErrors.title = formCopy.errors.titleTooLong.replace(
        "{max}",
        String(REVIEW_FORM_LIMITS.titleMax)
      )
    }

    if (next.pros.trim().length > REVIEW_FORM_LIMITS.prosMax) {
      nextErrors.pros = formCopy.errors.prosTooLong.replace(
        "{max}",
        String(REVIEW_FORM_LIMITS.prosMax)
      )
    }

    if (next.cons.trim().length > REVIEW_FORM_LIMITS.consMax) {
      nextErrors.cons = formCopy.errors.consTooLong.replace(
        "{max}",
        String(REVIEW_FORM_LIMITS.consMax)
      )
    }

    return nextErrors
  }, [formCopy.errors])

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isPending || submitSuccess) return

    setSubmitError(null)
    const nextErrors = validate(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      return
    }

    startTransition(async () => {
      const result: ProductReviewSubmitResult = await submitProductReview({
        productId,
        rating: values.rating,
        text: values.text.trim(),
        title: values.title.trim() || undefined,
        pros: values.pros.trim() || undefined,
        cons: values.cons.trim() || undefined,
        website: values.website,
      })

      if (result.ok) {
        setSubmitSuccess(true)
        // Auto-close after a short delay so the user sees the confirmation
        // banner. Project has no toast infra wired into modals, so we keep
        // the success message inside the modal until it dismisses itself.
        window.setTimeout(() => {
          onOpenChange(false)
        }, 1500)
        return
      }

      setSubmitError(pickErrorCopy(result.code))
    })
  }

  const update = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }))
    if (key !== "website" && errors[key as keyof FormErrors]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[key as keyof FormErrors]
        return next
      })
    }
  }

  const charCounter = (current: number, max: number) =>
    formCopy.fields.charCounter
      .replace("{current}", String(current))
      .replace("{max}", String(max))

  const submitLabel = isPending ? formCopy.actions.submitting : formCopy.actions.submit

  return (
    <Modal isOpen={open} close={close} data-testid="product-review-form-modal">
      <Modal.Title>
        <Heading className="mb-2">{formCopy.title}</Heading>
      </Modal.Title>

      <form onSubmit={handleSubmit} noValidate>
        {/*
          Honeypot — visually hidden but reachable in the DOM so naive bots
          fill it. Real users do not see it (off-screen + aria-hidden +
          tabIndex=-1). Backend silently 201s when non-empty (plan §10.1).
        */}
        <div
          aria-hidden="true"
          className="absolute left-[-10000px] top-auto h-px w-px overflow-hidden"
        >
          <label htmlFor="product-review-website">Website</label>
          <input
            id="product-review-website"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={values.website}
            onChange={(e) => update("website", e.target.value)}
          />
        </div>

        <Modal.Body>
          <div className="flex w-full flex-col gap-y-5">
            {/* Rating */}
            <div className="flex flex-col gap-y-2">
              <label
                htmlFor="product-review-rating"
                className="text-sm font-medium text-ui-fg-base"
              >
                {formCopy.fields.rating}
              </label>
              <div id="product-review-rating">
                <ReviewStarsInput
                  value={values.rating}
                  onChange={(next) => update("rating", next)}
                  size="lg"
                  disabled={isPending || submitSuccess}
                />
              </div>
              {errors.rating ? (
                <p
                  id="product-review-rating-error"
                  className="text-sm text-rose-500"
                  role="alert"
                >
                  {errors.rating}
                </p>
              ) : null}
            </div>

            {/* Title */}
            <div className="flex flex-col gap-y-1.5">
              <label
                htmlFor="product-review-title"
                className="text-sm font-medium text-ui-fg-base"
              >
                {formCopy.fields.title}
              </label>
              <input
                id="product-review-title"
                name="title"
                type="text"
                maxLength={REVIEW_FORM_LIMITS.titleMax}
                value={values.title}
                onChange={(e) => update("title", e.target.value)}
                disabled={isPending || submitSuccess}
                aria-invalid={errors.title ? true : undefined}
                aria-describedby={errors.title ? "product-review-title-error" : undefined}
                className="w-full rounded-md border border-ui-border-base bg-ui-bg-field px-3 py-2 text-sm text-ui-fg-base outline-none focus:border-ui-border-interactive disabled:opacity-60"
              />
              <div className="flex items-center justify-between gap-2">
                {errors.title ? (
                  <p
                    id="product-review-title-error"
                    className="text-sm text-rose-500"
                    role="alert"
                  >
                    {errors.title}
                  </p>
                ) : (
                  <span aria-hidden="true" />
                )}
                <span className="text-xs text-ui-fg-subtle tabular-nums">
                  {charCounter(values.title.length, REVIEW_FORM_LIMITS.titleMax)}
                </span>
              </div>
            </div>

            {/* Text */}
            <div className="flex flex-col gap-y-1.5">
              <label
                htmlFor="product-review-text"
                className="text-sm font-medium text-ui-fg-base"
              >
                {formCopy.fields.text}
              </label>
              <textarea
                id="product-review-text"
                name="text"
                rows={5}
                maxLength={REVIEW_FORM_LIMITS.textMax}
                value={values.text}
                onChange={(e) => update("text", e.target.value)}
                disabled={isPending || submitSuccess}
                aria-invalid={errors.text ? true : undefined}
                aria-describedby={errors.text ? "product-review-text-error" : undefined}
                required
                className="w-full resize-y rounded-md border border-ui-border-base bg-ui-bg-field px-3 py-2 text-sm text-ui-fg-base outline-none focus:border-ui-border-interactive disabled:opacity-60"
              />
              <div className="flex items-center justify-between gap-2">
                {errors.text ? (
                  <p
                    id="product-review-text-error"
                    className="text-sm text-rose-500"
                    role="alert"
                  >
                    {errors.text}
                  </p>
                ) : (
                  <span aria-hidden="true" />
                )}
                <span className="text-xs text-ui-fg-subtle tabular-nums">
                  {charCounter(values.text.length, REVIEW_FORM_LIMITS.textMax)}
                </span>
              </div>
            </div>

            {/* Pros */}
            <div className="flex flex-col gap-y-1.5">
              <label
                htmlFor="product-review-pros"
                className="text-sm font-medium text-ui-fg-base"
              >
                {formCopy.fields.pros}
              </label>
              <textarea
                id="product-review-pros"
                name="pros"
                rows={2}
                maxLength={REVIEW_FORM_LIMITS.prosMax}
                value={values.pros}
                onChange={(e) => update("pros", e.target.value)}
                disabled={isPending || submitSuccess}
                aria-invalid={errors.pros ? true : undefined}
                aria-describedby={errors.pros ? "product-review-pros-error" : undefined}
                className="w-full resize-y rounded-md border border-ui-border-base bg-ui-bg-field px-3 py-2 text-sm text-ui-fg-base outline-none focus:border-ui-border-interactive disabled:opacity-60"
              />
              <div className="flex items-center justify-between gap-2">
                {errors.pros ? (
                  <p
                    id="product-review-pros-error"
                    className="text-sm text-rose-500"
                    role="alert"
                  >
                    {errors.pros}
                  </p>
                ) : (
                  <span aria-hidden="true" />
                )}
                <span className="text-xs text-ui-fg-subtle tabular-nums">
                  {charCounter(values.pros.length, REVIEW_FORM_LIMITS.prosMax)}
                </span>
              </div>
            </div>

            {/* Cons */}
            <div className="flex flex-col gap-y-1.5">
              <label
                htmlFor="product-review-cons"
                className="text-sm font-medium text-ui-fg-base"
              >
                {formCopy.fields.cons}
              </label>
              <textarea
                id="product-review-cons"
                name="cons"
                rows={2}
                maxLength={REVIEW_FORM_LIMITS.consMax}
                value={values.cons}
                onChange={(e) => update("cons", e.target.value)}
                disabled={isPending || submitSuccess}
                aria-invalid={errors.cons ? true : undefined}
                aria-describedby={errors.cons ? "product-review-cons-error" : undefined}
                className="w-full resize-y rounded-md border border-ui-border-base bg-ui-bg-field px-3 py-2 text-sm text-ui-fg-base outline-none focus:border-ui-border-interactive disabled:opacity-60"
              />
              <div className="flex items-center justify-between gap-2">
                {errors.cons ? (
                  <p
                    id="product-review-cons-error"
                    className="text-sm text-rose-500"
                    role="alert"
                  >
                    {errors.cons}
                  </p>
                ) : (
                  <span aria-hidden="true" />
                )}
                <span className="text-xs text-ui-fg-subtle tabular-nums">
                  {charCounter(values.cons.length, REVIEW_FORM_LIMITS.consMax)}
                </span>
              </div>
            </div>

            {/* Submit feedback (server-side) */}
            {submitSuccess ? (
              <div
                role="status"
                className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
                data-testid="product-review-form-success"
              >
                {formCopy.submitSuccess}
              </div>
            ) : null}
            {submitError ? (
              <div
                role="alert"
                className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
                data-testid="product-review-form-error"
              >
                {submitError}
              </div>
            ) : null}
          </div>
        </Modal.Body>

        <Modal.Footer>
          <div className="mt-6 flex gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={close}
              className="h-10"
              disabled={isPending}
              data-testid="product-review-form-cancel"
            >
              {formCopy.actions.cancel}
            </Button>
            <Button
              type="submit"
              size="large"
              isLoading={isPending}
              disabled={isPending || submitSuccess}
              data-testid="product-review-form-submit"
            >
              {submitLabel}
            </Button>
          </div>
        </Modal.Footer>
      </form>
    </Modal>
  )
}

export default ProductReviewForm
