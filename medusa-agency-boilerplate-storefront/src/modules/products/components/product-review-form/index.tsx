"use client"

import * as React from "react"
import { Button, Heading } from "@medusajs/ui"

import { storefrontConfig } from "@lib/storefront-config"
import {
  submitProductReview,
  uploadProductReviewImage,
  type ProductReviewSubmitCode,
  type ProductReviewSubmitResult,
} from "@lib/data/product-reviews"
import {
  PRODUCT_REVIEW_IMAGE_ALLOWED_MIME_TYPES,
  PRODUCT_REVIEW_IMAGE_MAX_BYTES,
  PRODUCT_REVIEW_IMAGE_MAX_COUNT,
  type ProductReviewImageRef,
  type ProductReviewUploadCode,
} from "@lib/data/product-reviews-images-constants"
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
 * Phase 3 / step 5 — uploaded image previews kept in form state until
 * the customer submits the review. Each entry has the backend-issued
 * `id` / `url` plus a transient `localKey` used only as a stable React
 * key while the file is uploading (the backend `id` is not yet known
 * during the upload promise).
 */
type FormImage = ProductReviewImageRef & { localKey: string }

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

function pickUploadErrorCopy(
  code: ProductReviewUploadCode,
  details?: { sizeMb?: number }
): string {
  const imagesCopy = storefrontConfig.copy.reviews.form.images
  const sizeMb =
    details?.sizeMb ?? Math.round(PRODUCT_REVIEW_IMAGE_MAX_BYTES / (1024 * 1024))
  switch (code) {
    case "auth_required":
      return imagesCopy.errors.authRequired
    case "rate_limited":
      return imagesCopy.errors.rateLimited
    case "payload_too_large":
      return imagesCopy.errors.tooLarge.replace("{size}", String(sizeMb))
    case "validation_error":
      return imagesCopy.errors.invalidType
    case "unknown":
    default:
      return imagesCopy.errors.uploadFailed
  }
}

const ProductReviewForm: React.FC<ProductReviewFormProps> = ({
  productId,
  open,
  onOpenChange,
}) => {
  const formCopy = storefrontConfig.copy.reviews.form

  const imagesCopy = formCopy.images
  const imagesMaxMb = Math.round(
    PRODUCT_REVIEW_IMAGE_MAX_BYTES / (1024 * 1024)
  )

  const [values, setValues] = React.useState<FormValues>(INITIAL_VALUES)
  const [errors, setErrors] = React.useState<FormErrors>({})
  const [submitError, setSubmitError] = React.useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = React.useState<boolean>(false)
  const [isPending, startTransition] = React.useTransition()

  // Phase 3 / step 5 — uploaded image attachments. The form keeps the
  // backend-issued `{id, url}` pairs in state and posts them as part of
  // the review payload. `imagesUploading` is a counter of in-flight
  // uploads so the submit button stays disabled while images are still
  // being sent to S3.
  const [images, setImages] = React.useState<FormImage[]>([])
  const [imagesError, setImagesError] = React.useState<string | null>(null)
  const [imagesUploading, setImagesUploading] = React.useState<number>(0)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)

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
        setImages([])
        setImagesError(null)
        setImagesUploading(0)
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

    // Phase 3 / step 5 — block the submit while uploads are still in
    // flight; the user must either wait or remove the pending image.
    if (imagesUploading > 0) {
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
        images:
          images.length > 0
            ? images.map((image) => ({ id: image.id, url: image.url }))
            : undefined,
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

  // Phase 3 / step 5 — file picker handler. Accepts multiple files in
  // one shot (the input is `multiple`), filters by mime / size on the
  // client, and uploads each through `uploadProductReviewImage`. The
  // upload runs in parallel via `Promise.allSettled` so a single
  // failing file does not block the rest. The form input is reset on
  // entry so the same file can be picked again after removal (the
  // browser reuses the value otherwise).
  const handleFilesChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const fileList = event.target.files
      if (!fileList || fileList.length === 0) {
        return
      }

      setImagesError(null)
      const incoming = Array.from(fileList)
      // Reset the input first thing — even if validation rejects everything,
      // the user can re-pick the same file after a fix.
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }

      const remainingSlots =
        PRODUCT_REVIEW_IMAGE_MAX_COUNT - images.length - imagesUploading
      if (remainingSlots <= 0) {
        setImagesError(
          imagesCopy.errors.tooMany.replace(
            "{max}",
            String(PRODUCT_REVIEW_IMAGE_MAX_COUNT)
          )
        )
        return
      }

      const accepted: File[] = []
      let perFileError: string | null = null
      for (const file of incoming) {
        if (
          !(PRODUCT_REVIEW_IMAGE_ALLOWED_MIME_TYPES as readonly string[]).includes(
            file.type
          )
        ) {
          perFileError = imagesCopy.errors.invalidType
          continue
        }
        if (file.size > PRODUCT_REVIEW_IMAGE_MAX_BYTES) {
          perFileError = imagesCopy.errors.tooLarge.replace(
            "{size}",
            String(imagesMaxMb)
          )
          continue
        }
        if (accepted.length >= remainingSlots) {
          perFileError = imagesCopy.errors.tooMany.replace(
            "{max}",
            String(PRODUCT_REVIEW_IMAGE_MAX_COUNT)
          )
          break
        }
        accepted.push(file)
      }

      if (accepted.length === 0) {
        if (perFileError) setImagesError(perFileError)
        return
      }
      if (perFileError) setImagesError(perFileError)

      setImagesUploading((prev) => prev + accepted.length)

      void Promise.allSettled(
        accepted.map(async (file) => {
          const buffer = await file.arrayBuffer()
          const result = await uploadProductReviewImage({
            productId,
            filename: file.name,
            mimeType: file.type,
            content: buffer,
          })
          return result
        })
      ).then((settled) => {
        setImagesUploading((prev) => Math.max(0, prev - accepted.length))
        const newImages: FormImage[] = []
        let lastError: ProductReviewUploadCode | null = null
        for (const entry of settled) {
          if (entry.status === "fulfilled" && entry.value.ok) {
            newImages.push({
              id: entry.value.image.id,
              url: entry.value.image.url,
              localKey: `${entry.value.image.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            })
          } else if (entry.status === "fulfilled" && !entry.value.ok) {
            lastError = entry.value.code
          } else {
            lastError = "unknown"
          }
        }
        if (newImages.length > 0) {
          setImages((prev) => [...prev, ...newImages])
        }
        if (lastError) {
          setImagesError(pickUploadErrorCopy(lastError, { sizeMb: imagesMaxMb }))
        }
      })
    },
    [images.length, imagesUploading, imagesCopy, imagesMaxMb, productId]
  )

  const removeImage = React.useCallback((localKey: string) => {
    // Phase 3 / step 5 — purely client-side removal: we DO NOT call any
    // server cleanup endpoint here because the file has not yet been
    // attached to a review row. If the customer removes a photo and
    // never submits, the orphaned S3 object stays until a janitorial
    // sweep (out of scope for Phase 3). On submit the customer's
    // remaining images are persisted; on admin DELETE / product cascade
    // we run the file-module cleanup (see backend module).
    setImages((prev) => prev.filter((image) => image.localKey !== localKey))
    setImagesError(null)
  }, [])

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

            {/* Phase 3 / step 5 — Images */}
            <div className="flex flex-col gap-y-2" data-testid="product-review-form-images">
              <div className="flex items-baseline justify-between gap-2">
                <label
                  htmlFor="product-review-images"
                  className="text-sm font-medium text-ui-fg-base"
                >
                  {imagesCopy.label}
                </label>
                <span className="text-xs text-ui-fg-subtle tabular-nums">
                  {imagesCopy.counter
                    .replace("{count}", String(images.length))
                    .replace("{max}", String(PRODUCT_REVIEW_IMAGE_MAX_COUNT))}
                </span>
              </div>
              <p className="text-xs text-ui-fg-subtle">
                {imagesCopy.hint
                  .replace("{max}", String(PRODUCT_REVIEW_IMAGE_MAX_COUNT))
                  .replace("{size}", String(imagesMaxMb))}
              </p>

              {images.length > 0 ? (
                <ul
                  className="grid grid-cols-3 gap-2 sm:grid-cols-5"
                  data-testid="product-review-form-images-grid"
                >
                  {images.map((image) => (
                    <li
                      key={image.localKey}
                      className="group relative aspect-square overflow-hidden rounded-md border border-ui-border-base bg-ui-bg-subtle"
                    >
                      {/*
                        Plain `<img>` (not `next/image`) — the URLs are
                        served from our own CDN and the form is short-
                        lived; introducing `next/image` here would force
                        every reviewer's CDN to be added to the
                        `images.remotePatterns` of `next.config.js`.
                      */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={image.url}
                        alt={imagesCopy.previewAlt}
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(image.localKey)}
                        disabled={isPending || submitSuccess}
                        aria-label={imagesCopy.remove}
                        className="absolute right-1 top-1 rounded-full bg-ui-bg-base/90 px-2 py-0.5 text-xs font-medium text-ui-fg-base shadow-sm hover:bg-ui-bg-base disabled:opacity-60"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  id="product-review-images"
                  type="file"
                  accept={(PRODUCT_REVIEW_IMAGE_ALLOWED_MIME_TYPES as readonly string[]).join(
                    ","
                  )}
                  multiple
                  className="sr-only"
                  onChange={handleFilesChange}
                  disabled={
                    isPending ||
                    submitSuccess ||
                    images.length + imagesUploading >= PRODUCT_REVIEW_IMAGE_MAX_COUNT
                  }
                  data-testid="product-review-form-images-input"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="small"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={
                    isPending ||
                    submitSuccess ||
                    images.length + imagesUploading >= PRODUCT_REVIEW_IMAGE_MAX_COUNT
                  }
                  data-testid="product-review-form-images-add"
                >
                  {imagesUploading > 0 ? imagesCopy.uploading : imagesCopy.add}
                </Button>
              </div>

              {imagesError ? (
                <p
                  className="text-sm text-rose-500"
                  role="alert"
                  data-testid="product-review-form-images-error"
                >
                  {imagesError}
                </p>
              ) : null}
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
              disabled={isPending || submitSuccess || imagesUploading > 0}
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
