import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import {
  getProductReviewsPgConnection,
  listProductReviewsForCustomer,
} from "../../../../../modules/product-reviews"

/**
 * GET /store/customers/me/reviews — list of the authenticated customer's
 * reviews across all products.
 *
 * Response items include `status` and `rejection_reason` so the storefront
 * can render the «На модерации / Опубликован / Отклонён» state on the
 * `/account/reviews` page (plan §6.5).
 *
 * Customer-only. No rate-limit (GET; plan §10.1).
 */
const ListMyReviewsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict()

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const customerId = req.auth_context?.actor_id?.trim()
  if (!customerId) {
    res.status(401).json({
      code: "customer_auth_required",
      message: "Authentication required",
    })
    return
  }

  const queryParse = ListMyReviewsQuerySchema.safeParse(
    (req.query as Record<string, unknown>) ?? {}
  )
  if (!queryParse.success) {
    res.status(400).json({
      code: "invalid_query",
      message: queryParse.error.issues[0]?.message || "Invalid query",
    })
    return
  }

  const { page, pageSize } = queryParse.data

  const pgConnection = getProductReviewsPgConnection(req.scope)
  const result = await listProductReviewsForCustomer({
    pgConnection,
    customerId,
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
