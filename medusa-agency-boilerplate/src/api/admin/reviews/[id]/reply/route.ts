import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import {
  PRODUCT_REVIEW_MERCHANT_REPLY_MAX,
  ProductReviewError,
  clearProductReviewMerchantReply,
  setProductReviewMerchantReply,
} from "../../../../../modules/product-reviews"
import { revalidateStorefrontTags } from "../../../../../lib/storefront-revalidate"

/**
 * Phase 3 / step 4 — admin reply («Ответ магазина»).
 *
 * Two thin admin routes over the module:
 *   - `POST   /admin/reviews/:id/reply`  body: { text }
 *   - `DELETE /admin/reviews/:id/reply`
 *
 * Authentication is wired in
 * [`middlewares.ts`](medusa-agency-boilerplate/src/api/middlewares.ts:1) via
 * `authenticate("user", ["session", "bearer", "api-key"])` — same as
 * approve/reject/delete. Body validation for POST goes through
 * `validateAndTransformBody` and the schema exported below.
 *
 * Error code → HTTP status mapping:
 *   - `not_found`           → 404 `{ code: "not_found" }`
 *   - `reply_text_required` → 400 `{ code: "reply_text_required" }`
 *   - `reply_text_too_long` → 400 `{ code: "reply_text_too_long" }`
 *
 * Cache invalidation (plan §6.6 + §9 Phase 3 п.5):
 *   - `product-reviews-${productId}` — the storefront product detail page
 *     re-renders the merchant reply block on the affected card.
 *   - `top-reviews` — homepage «Лучшие отзывы» widget shares a singleton
 *     cache; if the replied-to review is in the top list its body changes,
 *     so the widget must re-fetch.
 *
 * `customer-reviews-${customer_id}` is intentionally NOT invalidated:
 *   - the «Мои отзывы» surface (`my-review-card`) does NOT render the
 *     merchant reply block (see plan §9 Phase 3 п.3 — surface is the
 *     public product detail), and adding the tag would force the page to
 *     re-fetch on every reply edit without a visible delta.
 *
 * `product-rating-${productId}` is also NOT invalidated — admin reply does
 * not change `helpful_count` / `rating` / `status`, so the rating summary
 * cache is intact.
 */

// ---------------------------------------------------------------------------
// Zod schema (imported by middlewares.ts)
// ---------------------------------------------------------------------------

/**
 * Strict body schema. `.strict()` rejects typos like `Text` or any extra
 * keys, mirroring
 * [`AdminRejectProductReviewSchema`](medusa-agency-boilerplate/src/api/admin/reviews/[id]/reject/route.ts:43).
 *
 * Length bound 1..1000 lives BOTH here (route layer) and inside the module
 * function as defence-in-depth — direct module callers (subscribers /
 * scripts) get the same protection without going through Zod.
 */
export const AdminProductReviewReplySchema = z
  .object({
    text: z
      .string()
      .trim()
      .min(1)
      .max(PRODUCT_REVIEW_MERCHANT_REPLY_MAX),
  })
  .strict()

export type AdminProductReviewReplyBody = z.infer<
  typeof AdminProductReviewReplySchema
>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getReviewId(req: AuthenticatedMedusaRequest): string {
  const params = req.params as Record<string, unknown> | undefined
  return typeof params?.id === "string" ? params.id.trim() : ""
}

function buildInvalidationTags(productId: string): string[] {
  return [`product-reviews-${productId}`, "top-reviews"]
}

function mapModuleErrorToResponse(
  res: MedusaResponse,
  error: unknown
): boolean {
  if (!(error instanceof ProductReviewError)) {
    return false
  }
  switch (error.code) {
    case "not_found":
      res.status(404).json({
        code: "not_found",
        message: "Review not found",
      })
      return true
    case "reply_text_required":
      res.status(400).json({
        code: "reply_text_required",
        message: "merchant reply text is required",
      })
      return true
    case "reply_text_too_long":
      res.status(400).json({
        code: "reply_text_too_long",
        message: `merchant reply text must be at most ${PRODUCT_REVIEW_MERCHANT_REPLY_MAX} chars`,
      })
      return true
    default:
      return false
  }
}

// ---------------------------------------------------------------------------
// POST /admin/reviews/:id/reply
// ---------------------------------------------------------------------------

export async function POST(
  req: AuthenticatedMedusaRequest<AdminProductReviewReplyBody>,
  res: MedusaResponse
) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const reviewId = getReviewId(req)

  if (!reviewId) {
    res.status(400).json({
      code: "review_id_required",
      message: "review id is required",
    })
    return
  }

  const authorId = req.auth_context?.actor_id?.trim() || null
  const text = req.validatedBody.text

  try {
    const result = await setProductReviewMerchantReply({
      container: req.scope,
      reviewId,
      text,
      authorId,
    })

    // Best-effort revalidation — see helper docs and module file header
    // comment. Plan §6.6 + §9 Phase 3 п.5.
    await revalidateStorefrontTags(
      buildInvalidationTags(result.productId),
      { logger }
    )

    res.status(200).json({
      review: result.review,
      productId: result.productId,
    })
    return
  } catch (error) {
    if (mapModuleErrorToResponse(res, error)) {
      return
    }

    logger.error(
      `[product-reviews] admin reply set failed review_id=${reviewId} error=${
        error instanceof Error ? error.message : "unknown_error"
      }`
    )
    res.status(500).json({
      code: "internal_error",
      message: "Failed to save merchant reply",
    })
  }
}

// ---------------------------------------------------------------------------
// DELETE /admin/reviews/:id/reply
// ---------------------------------------------------------------------------

export async function DELETE(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const reviewId = getReviewId(req)

  if (!reviewId) {
    res.status(400).json({
      code: "review_id_required",
      message: "review id is required",
    })
    return
  }

  try {
    const result = await clearProductReviewMerchantReply({
      container: req.scope,
      reviewId,
    })

    await revalidateStorefrontTags(
      buildInvalidationTags(result.productId),
      { logger }
    )

    res.status(200).json({
      review: result.review,
      productId: result.productId,
    })
    return
  } catch (error) {
    if (mapModuleErrorToResponse(res, error)) {
      return
    }

    logger.error(
      `[product-reviews] admin reply clear failed review_id=${reviewId} error=${
        error instanceof Error ? error.message : "unknown_error"
      }`
    )
    res.status(500).json({
      code: "internal_error",
      message: "Failed to clear merchant reply",
    })
  }
}
