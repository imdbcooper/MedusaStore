import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import {
  getProductReviewsPgConnection,
  listTopApprovedProductReviewsAcrossCatalog,
} from "../../../../modules/product-reviews"

/**
 * Phase 3 / step 3 — public «Top reviews across the catalog» endpoint, used
 * by the storefront homepage `<TopReviewsWidget>` (plan §9 Phase 3 п.5).
 *
 * Auth: NONE — this is a public widget. The middleware chain only attaches a
 * `publicRateLimit` (60/min/IP) so a runaway client cannot DoS the backend.
 *
 * Strict Zod query schema (matches the contract in plan §9 Phase 3 п.5):
 *   - `limit`        int 1..50, default 10
 *   - `min_rating`   int 1..5,  default 4 (only ★4 and above)
 *   - `days_window`  int 0..365, default 90 (0 ⇒ no date filter)
 *
 * Response shape:
 *   `{ items: ProductReviewItem[] }` — empty array on no rows.
 */

const ListTopReviewsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).default(10),
    min_rating: z.coerce.number().int().min(1).max(5).default(4),
    days_window: z.coerce.number().int().min(0).max(365).default(90),
  })
  .strict()

export type ListTopReviewsQuery = z.infer<typeof ListTopReviewsQuerySchema>

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)

  const queryParse = ListTopReviewsQuerySchema.safeParse(
    (req.query as Record<string, unknown>) ?? {}
  )
  if (!queryParse.success) {
    res.status(400).json({
      code: "invalid_query",
      message: queryParse.error.issues[0]?.message || "Invalid query",
    })
    return
  }

  const { limit, min_rating, days_window } = queryParse.data
  const pgConnection = getProductReviewsPgConnection(req.scope)

  try {
    const items = await listTopApprovedProductReviewsAcrossCatalog({
      pgConnection,
      limit,
      minRating: min_rating,
      daysWindow: days_window,
    })

    res.status(200).json({ items })
    return
  } catch (error) {
    logger.error(
      `[product-reviews] top reviews failed limit=${limit} min_rating=${min_rating} days_window=${days_window} error=${
        error instanceof Error ? error.message : "unknown_error"
      }`
    )
    res.status(500).json({
      code: "internal_error",
      message: "Failed to load top reviews",
    })
  }
}
