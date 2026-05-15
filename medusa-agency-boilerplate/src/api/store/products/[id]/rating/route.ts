import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  getProductRatingSummary,
  getProductReviewsPgConnection,
} from "../../../../../modules/product-reviews"

/**
 * GET /store/products/:id/rating — public rating summary.
 *
 * Returns the row from `product_rating_summary` for the given product, or a
 * deterministic empty default when there is no row yet (the storefront
 * renders an empty-state on `average_rating === null`; see plan §3.2 / §6.2).
 *
 * Public, no auth, no rate-limit (cacheable on CDN/Next.js layer per plan
 * §10.1).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const productId =
    typeof (req.params as Record<string, unknown> | undefined)?.id === "string"
      ? ((req.params as Record<string, string>).id || "").trim()
      : ""

  if (!productId) {
    res.status(400).json({
      code: "product_id_required",
      message: "product id is required",
    })
    return
  }

  const pgConnection = getProductReviewsPgConnection(req.scope)
  const summary = await getProductRatingSummary({
    pgConnection,
    productId,
  })

  res.status(200).json(summary)
}
