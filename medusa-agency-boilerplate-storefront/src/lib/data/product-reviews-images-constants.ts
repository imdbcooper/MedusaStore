/**
 * Phase 3 / step 5 — pure constants and types for review image attachments.
 *
 * Lives in its OWN file because
 * [`product-reviews.ts`](medusa-agency-boilerplate-storefront/src/lib/data/product-reviews.ts:1)
 * is a `"use server"` module and Next.js only allows `async` exports
 * from such modules. Constants therefore live here and the server
 * module re-exports them through a thin wrapper for places that
 * already import everything from `@lib/data/product-reviews`.
 *
 * The numbers must stay in lockstep with the backend upload route
 * (`MAX_BYTES`, allowed mime types) — see
 * [`upload/route.ts`](medusa-agency-boilerplate/src/api/store/products/[id]/reviews/upload/route.ts:1).
 */

export const PRODUCT_REVIEW_IMAGE_MAX_BYTES = 5 * 1024 * 1024
export const PRODUCT_REVIEW_IMAGE_MAX_COUNT = 5
export const PRODUCT_REVIEW_IMAGE_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const

/**
 * Phase 3 / step 5 — wire shape for an attached image. The storefront
 * uploads images one-by-one via `uploadProductReviewImage` and collects
 * the returned `{id, url}` pairs in form state. On submit the full
 * array is forwarded to `submitProductReview` which posts it to
 * `POST /store/products/:id/reviews` (the backend stores it in the
 * `images` jsonb column).
 */
export type ProductReviewImageRef = {
  id: string
  url: string
}

/**
 * Stable error codes returned by `uploadProductReviewImage`. They are
 * intentionally decoupled from the backend `message` field — the
 * storefront UI maps `code` → `storefrontConfig.copy.reviews.form.images.errors.*`
 * directly to keep the same pattern as `submitProductReview` and to
 * stay independent of any future backend message renames.
 */
export type ProductReviewUploadCode =
  | "ok"
  | "auth_required"
  | "validation_error"
  | "payload_too_large"
  | "rate_limited"
  | "unknown"

export type ProductReviewUploadResult =
  | { ok: true; image: ProductReviewImageRef }
  | {
      ok: false
      code: ProductReviewUploadCode
      status: number
    }
