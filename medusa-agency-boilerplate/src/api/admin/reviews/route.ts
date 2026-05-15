import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import {
  PRODUCT_REVIEW_STATUSES,
  getProductReviewsPgConnection,
  listProductReviewsForAdmin,
  type ProductReviewAdminFilters,
} from "../../../modules/product-reviews"

/**
 * Phase 1 / step 4: thin admin route over the product-reviews module.
 *
 * Handler responsibilities:
 *   - validate the query string with Zod (`.strict()` rejects unknown keys
 *     with HTTP 400, per plan §4.2);
 *   - map the wire field `product_id` (snake_case query convention) to the
 *     module's `productId` filter argument;
 *   - delegate to
 *     [`listProductReviewsForAdmin`](medusa-agency-boilerplate/src/modules/product-reviews.ts:1318);
 *   - never localize copy — Payload's UI looks up labels from its own i18n.
 *
 * Authentication is wired in
 * [`middlewares.ts`](medusa-agency-boilerplate/src/api/middlewares.ts:1) via
 * `authenticate("user", ["session", "bearer", "api-key"])`. The `api-key`
 * branch covers the Basic-auth call from Payload (plan §5.2).
 */

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const PRODUCT_REVIEW_STATUS_VALUES = PRODUCT_REVIEW_STATUSES as readonly [
  (typeof PRODUCT_REVIEW_STATUSES)[number],
  ...(typeof PRODUCT_REVIEW_STATUSES)[number][]
]

/**
 * Query schema for `GET /admin/reviews`.
 *
 * `.strict()` ensures any typo from Payload (e.g. `state` instead of
 * `status`) surfaces as HTTP 400 instead of being silently dropped.
 *
 * `dateFrom` / `dateTo` accept ISO 8601 strings; the module casts them via
 * `?::timestamptz` so timezone-aware values work without further parsing.
 */
const ListAdminReviewsQuerySchema = z
  .object({
    status: z.enum(PRODUCT_REVIEW_STATUS_VALUES).optional(),
    product_id: z.string().trim().min(1).optional(),
    dateFrom: z.string().datetime({ offset: true }).optional(),
    dateTo: z.string().datetime({ offset: true }).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict()

// ---------------------------------------------------------------------------
// GET /admin/reviews — list reviews for the moderation queue
// ---------------------------------------------------------------------------

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const queryParse = ListAdminReviewsQuerySchema.safeParse(
    (req.query as Record<string, unknown>) ?? {}
  )

  if (!queryParse.success) {
    res.status(400).json({
      code: "invalid_query",
      message: queryParse.error.issues[0]?.message || "Invalid query",
    })
    return
  }

  const { status, product_id, dateFrom, dateTo, page, pageSize } =
    queryParse.data

  const filters: ProductReviewAdminFilters = {
    status,
    productId: product_id,
    dateFrom,
    dateTo,
  }

  const pgConnection = getProductReviewsPgConnection(req.scope)
  const result = await listProductReviewsForAdmin({
    pgConnection,
    filters,
    page,
    pageSize,
  })

  res.status(200).json({
    items: result.items,
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  })
}
