import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  ProductReviewError,
  getProductReviewsPgConnection,
  voteProductReviewHelpful,
} from "../../../../../modules/product-reviews"

/**
 * POST /store/reviews/:id/helpful — atomic «helpful» vote.
 *
 * Customer-only. Body is empty. Errors:
 *   - `not_found_or_not_approved` → 404 `{ code: "not_found" }`.
 *
 * The handler is a thin wrapper around the module's
 * `voteProductReviewHelpful`, which atomically dedupes the vote (PK on
 * `(review_id, customer_id)`) and increments `helpful_count` only when the
 * INSERT actually inserted (plan §4.3 / §10.4).
 */
export async function POST(
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

  const pgConnection = getProductReviewsPgConnection(req.scope)

  try {
    const result = await voteProductReviewHelpful({
      pgConnection,
      reviewId,
      customerId,
    })
    res.status(200).json(result)
    return
  } catch (error) {
    if (error instanceof ProductReviewError) {
      if (error.code === "not_found_or_not_approved") {
        res.status(404).json({
          code: "not_found",
          message: "Review not found",
        })
        return
      }
    }

    logger.error(
      `[product-reviews] helpful vote failed customer_id=${customerId} review_id=${reviewId} error=${
        error instanceof Error ? error.message : "unknown_error"
      }`
    )
    res.status(500).json({
      code: "internal_error",
      message: "Failed to record helpful vote",
    })
  }
}
