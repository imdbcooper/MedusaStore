import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  ProductReviewError,
  deleteProductReviewAsAdmin,
  getProductReviewById,
  getProductReviewsPgConnection,
} from "../../../../modules/product-reviews"
import { revalidateStorefrontTags } from "../../../../lib/storefront-revalidate"

/**
 * Phase 1 / step 4: thin admin routes for a single review.
 *
 * - `GET    /admin/reviews/:id` — fetch review by id (or 404).
 * - `DELETE /admin/reviews/:id` — admin-side delete; module triggers atomic
 *   recalc of `product_rating_summary` when the deleted review was approved
 *   (plan §4.3).
 *
 * Authentication for both methods is wired in
 * [`middlewares.ts`](medusa-agency-boilerplate/src/api/middlewares.ts:1) via
 * `authenticate("user", ["session", "bearer", "api-key"])`.
 *
 * Error code → HTTP status mapping for module errors:
 *   - `not_found` → 404 `{ code: "not_found" }`
 */

function getReviewId(req: AuthenticatedMedusaRequest): string {
  const params = req.params as Record<string, unknown> | undefined
  return typeof params?.id === "string" ? params.id.trim() : ""
}

// ---------------------------------------------------------------------------
// GET /admin/reviews/:id — single review detail
// ---------------------------------------------------------------------------

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const reviewId = getReviewId(req)
  if (!reviewId) {
    res.status(400).json({
      code: "review_id_required",
      message: "review id is required",
    })
    return
  }

  const pgConnection = getProductReviewsPgConnection(req.scope)
  const review = await getProductReviewById({ pgConnection, reviewId })

  if (!review) {
    res.status(404).json({
      code: "not_found",
      message: "Review not found",
    })
    return
  }

  res.status(200).json({ review })
}

// ---------------------------------------------------------------------------
// DELETE /admin/reviews/:id — admin delete
// ---------------------------------------------------------------------------

/**
 * Returns `204 No Content` on success — the row no longer exists, so there
 * is no useful body, and this matches the existing customer-facing
 * [`DELETE /store/customers/me/reviews/:id`](medusa-agency-boilerplate/src/api/store/customers/me/reviews/[id]/route.ts:30)
 * which the project already ships. No other admin DELETE endpoint exists in
 * the project today, so we adopt the same convention as the only sibling
 * DELETE route.
 *
 * The module returns `{ productId, recalculated }`; we drop them on the
 * wire because:
 *   - `productId` is already known to Payload (it triggered the call from
 *     the moderation row);
 *   - `recalculated` is an internal hint used only by the cache-invalidation
 *     subscriber (step 5/9).
 */
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
    const result = await deleteProductReviewAsAdmin({
      container: req.scope,
      reviewId,
    })

    // Plan §6.6: invalidate only when the deleted row was previously
    // `approved` and the summary was actually rebuilt. Deleting a
    // pending/rejected review does not touch the aggregates, so there is
    // nothing to invalidate on the storefront. Best-effort — see helper
    // docs.
    if (result.recalculated) {
      await revalidateStorefrontTags(
        [
          `product-rating-${result.productId}`,
          `product-reviews-${result.productId}`,
        ],
        { logger }
      )
    }

    res.status(204).end()
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
      `[product-reviews] admin delete failed review_id=${reviewId} error=${
        error instanceof Error ? error.message : "unknown_error"
      }`
    )
    res.status(500).json({
      code: "internal_error",
      message: "Failed to delete review",
    })
  }
}
