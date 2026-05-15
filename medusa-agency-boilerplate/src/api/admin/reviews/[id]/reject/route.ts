import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import {
  ProductReviewError,
  rejectProductReview,
} from "../../../../../modules/product-reviews"
import { sendReviewModerationEmail } from "../../../../../modules/product-reviews-email"
import { revalidateStorefrontTags } from "../../../../../lib/storefront-revalidate"

/**
 * Phase 1 / step 4: thin admin route over
 * [`rejectProductReview`](medusa-agency-boilerplate/src/modules/product-reviews.ts:899).
 *
 * `POST /admin/reviews/:id/reject` — moderator rejects a review with a
 * required reason.
 *
 * Authentication is wired in
 * [`middlewares.ts`](medusa-agency-boilerplate/src/api/middlewares.ts:1) via
 * `authenticate("user", ["session", "bearer", "api-key"])`.
 *
 * Body validation is wired through `validateAndTransformBody` in
 * `middlewares.ts` (same convention as
 * [`POST /admin/marketing/campaigns`](medusa-agency-boilerplate/src/api/admin/marketing/campaigns/route.ts:85))
 * — the schema is exported from this file and imported there.
 *
 * Error code → HTTP status mapping:
 *   - `not_found` → 404 `{ code: "not_found" }`
 */

// ---------------------------------------------------------------------------
// Zod schema (imported by middlewares.ts)
// ---------------------------------------------------------------------------

/**
 * Strict body schema. `.strict()` guards against typos like `Reason` or
 * extra fields slipping through. Plan §4.2 fixes the contract: a single
 * required `reason` field, 1–500 characters after trim.
 */
export const AdminRejectProductReviewSchema = z
  .object({
    reason: z.string().trim().min(1).max(500),
  })
  .strict()

export type AdminRejectProductReviewBody = z.infer<
  typeof AdminRejectProductReviewSchema
>

// ---------------------------------------------------------------------------
// POST /admin/reviews/:id/reject
// ---------------------------------------------------------------------------

export async function POST(
  req: AuthenticatedMedusaRequest<AdminRejectProductReviewBody>,
  res: MedusaResponse
) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)

  const params = req.params as Record<string, unknown> | undefined
  const reviewId =
    typeof params?.id === "string" ? params.id.trim() : ""

  if (!reviewId) {
    res.status(400).json({
      code: "review_id_required",
      message: "review id is required",
    })
    return
  }

  const moderatedBy = req.auth_context?.actor_id?.trim() || null
  const reason = req.validatedBody.reason

  try {
    const result = await rejectProductReview({
      container: req.scope,
      reviewId,
      moderatedBy,
      reason,
    })

    // Plan §4.3 + §6.6: only invalidate when the previous status was
    // `approved` and the summary was actually recalculated; an idempotent
    // reject (already-rejected row) leaves the aggregates untouched, so
    // there is nothing to invalidate. The «Мои отзывы» surface is also
    // worth invalidating on `pending → rejected` because the row's status
    // visible to the customer changes — that is signalled by
    // `result.statusChanged`, not by `recalculated`. Best-effort — see
    // helper docs.
    if (result.recalculated || result.statusChanged) {
      const tags: string[] = []

      if (result.recalculated) {
        tags.push(
          `product-rating-${result.productId}`,
          `product-reviews-${result.productId}`
        )
        // Plan §9 Phase 3 п.5 — homepage «Лучшие отзывы» widget caches
        // under the singleton tag `top-reviews`. Only invalidate when the
        // summary was actually recalculated (i.e. an `approved` row went
        // away); a `pending → rejected` transition cannot affect the
        // catalog-wide top list because the row was never approved.
        tags.push("top-reviews")
      }

      // Plan §6.6: extra tag for the «Мои отзывы» surface so the customer
      // sees their now-rejected review reflect the new status without the
      // 60s ISR wait. Anonymized rows (`customer_id === null`) cannot be
      // tied back to an account, so the tag is omitted.
      if (result.statusChanged && result.review.customer_id) {
        tags.push(`customer-reviews-${result.review.customer_id}`)
      }

      if (tags.length) {
        await revalidateStorefrontTags(tags, { logger })
      }
    }

    // Plan §1.1 п.9 + §9 Phase 2 шаг 6: send the transactional «Ваш отзыв
    // отклонён» email exactly once per real status transition. The
    // module's `statusChanged` flag is true for `pending → rejected` AND
    // `approved → rejected`; it is false on the idempotent already-
    // rejected path. The helper itself is best-effort and never throws,
    // but we still wrap it as defence-in-depth so any future refactor
    // cannot break the admin 200 response.
    if (result.statusChanged) {
      try {
        await sendReviewModerationEmail(req.scope, {
          review: result.review,
          type: "rejected",
          rejectionReason: result.review.rejection_reason || reason,
        })
      } catch (emailError) {
        logger.error(
          `[product-reviews] reject email best-effort failed review_id=${reviewId} error=${
            emailError instanceof Error ? emailError.message : "unknown_error"
          }`
        )
      }
    }

    res.status(200).json({
      review: result.review,
      productId: result.productId,
      recalculated: result.recalculated,
    })
    return
  } catch (error) {
    if (error instanceof ProductReviewError) {
      switch (error.code) {
        case "not_found":
          res.status(404).json({
            code: "not_found",
            message: "Review not found",
          })
          return
        default:
          break
      }
    }

    logger.error(
      `[product-reviews] admin reject failed review_id=${reviewId} error=${
        error instanceof Error ? error.message : "unknown_error"
      }`
    )
    res.status(500).json({
      code: "internal_error",
      message: "Failed to reject review",
    })
  }
}
