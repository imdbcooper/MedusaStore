import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  ProductReviewError,
  approveProductReview,
} from "../../../../../modules/product-reviews"
import { sendReviewModerationEmail } from "../../../../../modules/product-reviews-email"
import { revalidateStorefrontTags } from "../../../../../lib/storefront-revalidate"

/**
 * Phase 1 / step 4: thin admin route over
 * [`approveProductReview`](medusa-agency-boilerplate/src/modules/product-reviews.ts:824).
 *
 * `POST /admin/reviews/:id/approve` — moderator approves a review.
 *
 * Authentication is wired in
 * [`middlewares.ts`](medusa-agency-boilerplate/src/api/middlewares.ts:1) via
 * `authenticate("user", ["session", "bearer", "api-key"])`. The `api-key`
 * branch covers the Basic-auth call from Payload (plan §5.2).
 *
 * `moderatedBy` is taken from `req.auth_context.actor_id` — same pattern as
 * existing admin routes such as
 * [`POST /admin/marketing/campaigns`](medusa-agency-boilerplate/src/api/admin/marketing/campaigns/route.ts:99)
 * (plan §4.3). For Basic-auth calls Medusa puts the API-key actor id there
 * too, so Payload-originated approvals are attributed correctly.
 *
 * Error code → HTTP status mapping:
 *   - `not_found` → 404 `{ code: "not_found" }`
 */
export async function POST(
  req: AuthenticatedMedusaRequest,
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

  try {
    const result = await approveProductReview({
      container: req.scope,
      reviewId,
      moderatedBy,
    })

    // Plan §4.3 + §6.6: after the transaction commits and the rating
    // summary actually changed, invalidate the storefront's cached tags.
    // Best-effort — `revalidateStorefrontTags` never throws and the
    // storefront also has 60s ISR fallback, so a transient webhook
    // failure must not break this 200.
    //
    // For approve `statusChanged === recalculated` (any pending→approved
    // transition recalculates the summary). We use `statusChanged` for
    // symmetry with the reject route, where pending→rejected changes status
    // without touching the summary.
    if (result.statusChanged) {
      const tags = [
        `product-rating-${result.productId}`,
        `product-reviews-${result.productId}`,
      ]

      // Plan §6.6: «Мои отзывы» surface caches under
      // `customer-reviews-${customer_id}`; invalidate it so the customer
      // sees their freshly-approved review without waiting for the 60s
      // ISR fallback. Anonymized rows (`customer_id === null`) cannot be
      // tied back to an account, so the tag is omitted.
      if (result.review.customer_id) {
        tags.push(`customer-reviews-${result.review.customer_id}`)
      }

      await revalidateStorefrontTags(tags, { logger })
    }

    // Plan §1.1 п.9 + §9 Phase 2 шаг 6: send the transactional «Ваш отзыв
    // опубликован» email. Best-effort — the helper never throws, but we
    // still wrap in try/catch as a defence-in-depth measure so any future
    // refactor cannot break the admin 200 response. We send only when the
    // status actually changed; idempotent re-approvals leave the row alone,
    // so the customer was already notified by the first approval.
    if (result.statusChanged) {
      try {
        await sendReviewModerationEmail(req.scope, {
          review: result.review,
          type: "approved",
        })
      } catch (emailError) {
        logger.error(
          `[product-reviews] approve email best-effort failed review_id=${reviewId} error=${
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
      `[product-reviews] admin approve failed review_id=${reviewId} error=${
        error instanceof Error ? error.message : "unknown_error"
      }`
    )
    res.status(500).json({
      code: "internal_error",
      message: "Failed to approve review",
    })
  }
}
