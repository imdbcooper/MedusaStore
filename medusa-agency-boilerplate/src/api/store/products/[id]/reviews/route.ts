import type {
  AuthenticatedMedusaRequest,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import {
  PRODUCT_REVIEW_LIST_SORTS,
  ProductReviewError,
  countCustomerReviewsInLastDay,
  createProductReview,
  getProductReviewsPgConnection,
  listApprovedProductReviews,
  verifyCustomerPurchasedProduct,
  type ProductReviewListSort,
} from "../../../../../modules/product-reviews"

/**
 * Phase 1 / step 3: thin route handlers over the product-reviews module.
 *
 * The handlers in this file:
 *   - validate input with Zod (strict mode for POST — `images` and any other
 *     unknown field is rejected with HTTP 400);
 *   - delegate to the module functions in
 *     [`product-reviews.ts`](medusa-agency-boilerplate/src/modules/product-reviews.ts:1);
 *   - map `ProductReviewError.code` to HTTP statuses;
 *   - never return localized strings — the storefront looks copy up via
 *     `storefrontConfig.copy.reviews.*` from the returned `code`.
 *
 * Honeypot, customer auth and rate-limit are wired in
 * [`middlewares.ts`](medusa-agency-boilerplate/src/api/middlewares.ts:1)
 * (per plan §10.1).
 */

// ---------------------------------------------------------------------------
// Env helpers (plan §11)
// ---------------------------------------------------------------------------

function readPositiveInt(name: string, fallback: number): number {
  const raw = process.env[name]
  if (typeof raw !== "string" || !raw.trim()) {
    return fallback
  }
  const parsed = Number.parseInt(raw.trim(), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function readBooleanFlag(name: string, fallback: boolean): boolean {
  const raw = process.env[name]
  if (typeof raw !== "string") {
    return fallback
  }
  const normalized = raw.trim().toLowerCase()
  if (
    normalized === "1" ||
    normalized === "true" ||
    normalized === "yes" ||
    normalized === "on"
  ) {
    return true
  }
  if (
    normalized === "0" ||
    normalized === "false" ||
    normalized === "no" ||
    normalized === "off" ||
    normalized === ""
  ) {
    return false
  }
  return fallback
}

// `REVIEWS_MIN_TEXT_LENGTH` / `REVIEWS_MAX_TEXT_LENGTH` are read once when the
// module loads — Medusa loads `.env` before requiring routes. The values are
// embedded into the strict Zod schema below; per plan §11 the defaults are
// 10 / 2000.
const REVIEWS_MIN_TEXT_LENGTH = readPositiveInt("REVIEWS_MIN_TEXT_LENGTH", 10)
const REVIEWS_MAX_TEXT_LENGTH = readPositiveInt("REVIEWS_MAX_TEXT_LENGTH", 2000)

// `REVIEWS_AUTO_APPROVE` / `REVIEWS_REQUIRE_PURCHASE` are read per-request
// via these helpers because tests and staging may flip them at runtime.
function isAutoApproveEnabled(): boolean {
  return readBooleanFlag("REVIEWS_AUTO_APPROVE", false)
}

function isRequirePurchaseEnabled(): boolean {
  return readBooleanFlag("REVIEWS_REQUIRE_PURCHASE", false)
}

// Plan §10.1 — bizness-level cap «10 reviews per day per customer» is enforced
// here in addition to the IP-keyed `publicRateLimit` middleware in
// `middlewares.ts`. The SQL counter lives in the module
// (`countCustomerReviewsInLastDay`) so route stays free of inline SQL.
const REVIEWS_PER_DAY_PER_CUSTOMER_LIMIT = 10

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const PRODUCT_REVIEW_LIST_SORT_VALUES = PRODUCT_REVIEW_LIST_SORTS as readonly [
  ProductReviewListSort,
  ...ProductReviewListSort[]
]

const ListReviewsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    sort: z.enum(PRODUCT_REVIEW_LIST_SORT_VALUES).default("newest"),
  })
  .strict()

/**
 * Strict Zod schema for review creation (plan §10.2).
 *
 * - `.strict()` rejects unknown fields with HTTP 400 — this is how Phase 1
 *   gets rid of `images`: it is intentionally NOT in the schema.
 * - `website` is the honeypot (plan §10.1 / §6.4). It is accepted as
 *   `optional()` so legitimate clients (which do not send it) pass; if it is
 *   present and non-empty the handler silently drops the submission.
 */
export const StoreCreateProductReviewSchema = z
  .object({
    rating: z.number().int().min(1).max(5),
    text: z
      .string()
      .trim()
      .min(REVIEWS_MIN_TEXT_LENGTH)
      .max(REVIEWS_MAX_TEXT_LENGTH),
    title: z.string().trim().max(120).optional(),
    pros: z.string().trim().max(1000).optional(),
    cons: z.string().trim().max(1000).optional(),
    website: z.string().max(2000).optional(),
  })
  .strict()

export type StoreCreateProductReviewBody = z.infer<
  typeof StoreCreateProductReviewSchema
>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getProductIdFromRequest(
  req: MedusaRequest | AuthenticatedMedusaRequest
): string {
  const fromParams =
    typeof (req.params as Record<string, unknown> | undefined)?.id === "string"
      ? ((req.params as Record<string, string>).id || "").trim()
      : ""
  return fromParams
}

// ---------------------------------------------------------------------------
// GET /store/products/:id/reviews — public list of approved reviews
// ---------------------------------------------------------------------------

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const productId = getProductIdFromRequest(req)
  if (!productId) {
    res.status(400).json({
      code: "product_id_required",
      message: "product id is required",
    })
    return
  }

  const queryParse = ListReviewsQuerySchema.safeParse(
    (req.query as Record<string, unknown>) ?? {}
  )
  if (!queryParse.success) {
    res.status(400).json({
      code: "invalid_query",
      message: queryParse.error.issues[0]?.message || "Invalid query",
    })
    return
  }

  const { page, pageSize, sort } = queryParse.data

  const pgConnection = getProductReviewsPgConnection(req.scope)
  const result = await listApprovedProductReviews({
    pgConnection,
    productId,
    page,
    pageSize,
    sort,
  })

  res.status(200).json({
    items: result.items,
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  })
}

// ---------------------------------------------------------------------------
// POST /store/products/:id/reviews — create a review (customer-only)
// ---------------------------------------------------------------------------

export async function POST(
  req: AuthenticatedMedusaRequest<StoreCreateProductReviewBody>,
  res: MedusaResponse
) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)

  const productId = getProductIdFromRequest(req)
  if (!productId) {
    res.status(400).json({
      code: "product_id_required",
      message: "product id is required",
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

  const body = (req.validatedBody || {}) as StoreCreateProductReviewBody

  // Honeypot guard (plan §10.1, §6.4): if the bot filled in `website`, return a
  // shape-compatible 201 without writing anything to the database. Logging is
  // intentionally INFO-only — we do not want to give the bot operator any
  // diagnostic feedback in higher levels.
  if (typeof body.website === "string" && body.website.trim().length > 0) {
    logger.info(
      `[product-reviews] honeypot triggered customer_id=${customerId} product_id=${productId}`
    )
    res.status(201).json({ ok: true })
    return
  }

  const pgConnection = getProductReviewsPgConnection(req.scope)

  // Bizness-level cap «10 reviews per day per customer» (plan §10.1).
  try {
    const reviewsInLastDay = await countCustomerReviewsInLastDay({
      pgConnection,
      customerId,
    })
    if (reviewsInLastDay >= REVIEWS_PER_DAY_PER_CUSTOMER_LIMIT) {
      res.status(429).json({
        code: "rate_limited",
        message: "reviews.form.rateLimited",
      })
      return
    }
  } catch (error) {
    logger.error(
      `[product-reviews] daily counter failed customer_id=${customerId} error=${
        error instanceof Error ? error.message : "unknown_error"
      }`
    )
    res.status(500).json({
      code: "internal_error",
      message: "Failed to verify daily review quota",
    })
    return
  }

  // verified-purchase enforcement (plan §4.3 step 5).
  if (isRequirePurchaseEnabled()) {
    try {
      const { verified } = await verifyCustomerPurchasedProduct({
        container: req.scope,
        customerId,
        productId,
      })
      if (!verified) {
        res.status(403).json({
          code: "require_purchase",
          message: "reviews.form.requirePurchase",
        })
        return
      }
    } catch (error) {
      logger.error(
        `[product-reviews] verified-purchase check failed customer_id=${customerId} product_id=${productId} error=${
          error instanceof Error ? error.message : "unknown_error"
        }`
      )
      res.status(500).json({
        code: "internal_error",
        message: "Failed to verify purchase",
      })
      return
    }
  }

  try {
    const review = await createProductReview({
      container: req.scope,
      productId,
      customerId,
      payload: {
        rating: body.rating,
        text: body.text,
        title: body.title ?? null,
        pros: body.pros ?? null,
        cons: body.cons ?? null,
      },
      autoApprove: isAutoApproveEnabled(),
    })

    res.status(201).json({ review })
    return
  } catch (error) {
    if (error instanceof ProductReviewError) {
      switch (error.code) {
        case "duplicate_review":
          res.status(409).json({
            code: "duplicate_review",
            message: "reviews.form.alreadyExists",
          })
          return
        case "customer_not_found":
          // Customer was authenticated but disappeared between auth and
          // create — surface as 401 so storefront re-runs the auth flow.
          res.status(401).json({
            code: "customer_not_found",
            message: "Authentication required",
          })
          return
        case "not_found":
          res.status(400).json({
            code: "invalid_request",
            message: error.message,
          })
          return
        default:
          break
      }
    }

    logger.error(
      `[product-reviews] create failed customer_id=${customerId} product_id=${productId} error=${
        error instanceof Error ? error.message : "unknown_error"
      }`
    )
    res.status(500).json({
      code: "internal_error",
      message: "Failed to create review",
    })
  }
}
