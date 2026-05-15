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
 * Per plan §6.6 + §9 Phase 2 шаг 6, the admin DELETE route should also
 * invalidate the customer's `«Мои отзывы»` surface when an approved row
 * is removed. We therefore need the deleted row's `customer_id` —
 * `deleteProductReviewAsAdmin` did not surface it before, but it has the
 * row locked and known internally; the public result type
 * [`ProductReviewAdminDeleteResult`](medusa-agency-boilerplate/src/modules/product-reviews.ts:983)
 * was extended in this step to include `customerId: string | null`.
 */

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

    // Plan §6.6 + §9 Phase 2 шаг 6: invalidate only when the deleted row
    // was previously `approved` and the summary was actually rebuilt.
    // Deleting a pending/rejected review does not touch the aggregates,
    // so there is nothing to invalidate on the storefront. The
    // `customer-reviews-${id}` tag is added under the SAME guard
    // (`recalculated === true`) — the plan ties the «Мои отзывы»
    // invalidation on DELETE to the approved-cleanup case only, because
    // a customer with a pending/rejected row that is hard-deleted by an
    // admin is an edge case where the storefront cannot link it back to
    // them anyway. Best-effort — see helper docs.
    //
    // Email: NOT sent on admin DELETE (plan §6.3 explicitly: «admin-
    // decision, не feedback покупателю»).
    if (result.recalculated) {
      const tags = [
        `product-rating-${result.productId}`,
        `product-reviews-${result.productId}`,
      ]

      if (result.customerId) {
        tags.push(`customer-reviews-${result.customerId}`)
      }

      // Plan §9 Phase 3 п.5 — invalidate the homepage «Лучшие отзывы»
      // widget too. We only enter this branch when an approved row was
      // hard-deleted (`recalculated === true`); a deleted approved review
      // can be visible in the top widget cache and must be flushed.
      tags.push("top-reviews")

      await revalidateStorefrontTags(tags, { logger })
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
