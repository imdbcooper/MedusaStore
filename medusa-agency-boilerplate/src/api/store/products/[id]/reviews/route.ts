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
  toPublicReview,
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

/**
 * Strict query schema for the public review list (plan §9 Phase 3 п.2).
 *
 * - `min_rating` / `max_rating` are integer 1..5; both optional. When the
 *   client sends only one bound, the SQL substitutes `null` for the other so
 *   the parameterized plan stays stable (see
 *   [`listApprovedProductReviews`](medusa-agency-boilerplate/src/modules/product-reviews.ts:1)).
 *   `min_rating === max_rating === X` is the «exactly ★X» preset used by the
 *   storefront chip filters.
 * - `verified_only` accepts the typical query-string shapes (`"true"`,
 *   `"false"`, `"1"`, `"0"`, plus real booleans). Anything else fails the
 *   inner `z.boolean()` and yields HTTP 400 — required by the contract for
 *   strings like `"yes"` or `"verified_only=invalid_string"`.
 * - `.refine(min<=max)` rejects ranges where the client has them inverted
 *   (e.g. `?min_rating=5&max_rating=3`).
 */
const VerifiedOnlySchema = z
  .preprocess((value) => {
    if (typeof value === "boolean") {
      return value
    }
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase()
      if (normalized === "true" || normalized === "1") {
        return true
      }
      if (normalized === "false" || normalized === "0") {
        return false
      }
    }
    // Fall through to z.boolean() which will reject everything else.
    return value
  }, z.boolean())
  .optional()

const ListReviewsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    sort: z.enum(PRODUCT_REVIEW_LIST_SORT_VALUES).default("newest"),
    min_rating: z.coerce.number().int().min(1).max(5).optional(),
    max_rating: z.coerce.number().int().min(1).max(5).optional(),
    verified_only: VerifiedOnlySchema,
  })
  .strict()
  .refine(
    (data) =>
      data.min_rating === undefined ||
      data.max_rating === undefined ||
      data.min_rating <= data.max_rating,
    {
      message: "invalid_rating_range",
      path: ["min_rating"],
    }
  )

/**
 * Phase 3 / step 5 — strict subschema for image attachments uploaded earlier
 * via `POST /store/products/:id/reviews/upload`. Each entry must be a
 * `{ id, url }` object echoed back by that route. The route also validates
 * `url` is `https://`-only — `http://` is rejected with HTTP 400 because
 * the storefront contract guarantees CDN-delivered, transport-secure
 * thumbnails (plan §10.2).
 *
 * The cap of 5 attachments mirrors the upload UI in
 * [`product-review-form/index.tsx`](medusa-agency-boilerplate-storefront/src/modules/products/components/product-review-form/index.tsx:1).
 */
const PRODUCT_REVIEW_IMAGES_MAX = 5

const ProductReviewImageSchema = z
  .object({
    id: z.string().trim().min(1).max(512),
    url: z
      .string()
      .trim()
      .url()
      .max(2048)
      .regex(/^https:\/\//i, "must be https"),
  })
  .strict()

/**
 * Strict Zod schema for review creation (plan §10.2).
 *
 * - `.strict()` rejects unknown fields with HTTP 400.
 * - `website` is the honeypot (plan §10.1 / §6.4). It is accepted as
 *   `optional()` so legitimate clients (which do not send it) pass; if it is
 *   present and non-empty the handler silently drops the submission.
 * - `images` (Phase 3 / step 5): optional `Array<{id,url}>`, max 5, https
 *   urls only. Empty array is treated as "no images" by the create
 *   handler. The Phase 1 contract that *unknown keys* (e.g. `foo: 1`) are
 *   still rejected is preserved by `.strict()`.
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
    images: z.array(ProductReviewImageSchema).max(PRODUCT_REVIEW_IMAGES_MAX).optional(),
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

  const { page, pageSize, sort, min_rating, max_rating, verified_only } =
    queryParse.data

  const pgConnection = getProductReviewsPgConnection(req.scope)
  const result = await listApprovedProductReviews({
    pgConnection,
    productId,
    page,
    pageSize,
    sort,
    minRating: min_rating,
    maxRating: max_rating,
    verifiedOnly: verified_only,
  })

  // Hotfix Phase 3 P0: whitelist items through `toPublicReview` so internal
  // ids (`customer_id`, `order_id`) and moderation metadata never leak from
  // this PUBLIC endpoint.
  res.status(200).json({
    items: result.items.map((row) => toPublicReview(row)),
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
        // Phase 3 / step 5 — `images` is optional at the wire layer
        // (legacy clients still POST without it). When present, the
        // route forwards the validated `Array<{id,url}>` straight to
        // the module; the module's `sanitizeReviewImagesForInsert` is
        // a defence-in-depth normaliser, not a primary validator.
        images: body.images ?? null,
      },
      autoApprove: isAutoApproveEnabled(),
    })

    // Hotfix Phase 3 P0: even though the customer creating the review knows
    // their own `customer_id`, the response shape is the single source of
    // truth for every public/customer-facing endpoint. Whitelist through
    // `toPublicReview` so the contract stays consistent.
    res.status(201).json({ review: toPublicReview(review) })
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
