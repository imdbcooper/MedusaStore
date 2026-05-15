import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  ProductReviewError,
  deleteOwnPendingProductReview,
} from "../../../../../../modules/product-reviews"

/**
 * DELETE /store/customers/me/reviews/:id — delete one of the customer's own
 * reviews.
 *
 * Customer-only. Allowed only for `pending` / `rejected` reviews; deleting an
 * `approved` review returns 409 — the rule is enforced by the module's
 * `deleteOwnPendingProductReview` (plan §4.3, §6.5).
 *
 * Error code → HTTP status mapping:
 *   - `not_found`              → 404 `{ code: "not_found" }`
 *   - `not_owner`              → 404 `{ code: "not_found" }` (deliberate; we
 *                                  do not leak existence of other customers'
 *                                  reviews)
 *   - `cannot_delete_published`→ 409 `{ code: "cannot_delete_published" }`
 *
 * On success returns `204 No Content` — there is no useful body (the row no
 * longer exists), and this matches the existing DELETE-style endpoints in the
 * project (e.g. `/store/delivery/selection`, plan §3.6).
 */
export async function DELETE(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)

  const reviewId =
    typeof (req.params as Record<string, unknown> | undefined)?.id === "string"
      ? ((req.params as Record<string, string>).id || "").trim()
      : ""

  if (!reviewId) {
    res.status(400).json({
      code: "review_id_required",
      message: "review id is required",
    })
    return
  }

  const customerId = req.auth_context?.actor_id?.trim()
  if (!customerId) {
    res.status(401).json({
      code: "customer_auth_required",
      message: "Authentication required",
    })
    return
  }

  try {
    await deleteOwnPendingProductReview({
      container: req.scope,
      reviewId,
      customerId,
    })

    res.status(204).end()
    return
  } catch (error) {
    if (error instanceof ProductReviewError) {
      switch (error.code) {
        case "not_found":
        case "not_owner":
          // Map both to 404 so the API does not disclose whether a review
          // with the given id exists but belongs to another customer.
          res.status(404).json({
            code: "not_found",
            message: "Review not found",
          })
          return
        case "cannot_delete_published":
          res.status(409).json({
            code: "cannot_delete_published",
            message: "reviews.account.cannotDeletePublished",
          })
          return
        default:
          break
      }
    }

    logger.error(
      `[product-reviews] delete own failed customer_id=${customerId} review_id=${reviewId} error=${
        error instanceof Error ? error.message : "unknown_error"
      }`
    )
    res.status(500).json({
      code: "internal_error",
      message: "Failed to delete review",
    })
  }
}
