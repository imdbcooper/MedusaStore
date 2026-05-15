"use server"

import { revalidateTag } from "next/cache"

import { sdk } from "@lib/config"
import { getAuthHeaders } from "./cookies"
import { retrieveCustomer } from "./customer"

/**
 * Phase 1 / step 6 — storefront data layer for product reviews.
 *
 * Mirrors the backend Store API contracts implemented in
 * [`store/products/[id]/rating/route.ts`](medusa-agency-boilerplate/src/api/store/products/[id]/rating/route.ts:1)
 * and
 * [`store/products/[id]/reviews/route.ts`](medusa-agency-boilerplate/src/api/store/products/[id]/reviews/route.ts:1).
 *
 * Server-only fetches use the Medusa JS SDK (`sdk.client.fetch`) — it already
 * appends the publishable API key, locale header and base URL via
 * [`config.ts`](medusa-agency-boilerplate-storefront/src/lib/config.ts:1).
 *
 * Cache tag contract (plan §6.6):
 *   - `getProductRatingSummary`        → `product-rating-${productId}`
 *   - `listApprovedProductReviews`     → `product-reviews-${productId}`
 *
 * `revalidateTag` is NOT called from the storefront on this step — that path
 * lives in the Medusa admin handlers (plan §9 step 9).
 */

export type ProductReviewSort = "newest" | "helpful" | "rating"

export type ProductReviewSummary = {
  product_id: string
  average_rating: number | null
  total_reviews: number
  rating_1: number
  rating_2: number
  rating_3: number
  rating_4: number
  rating_5: number
  updated_at: string | null
}

/**
 * Hotfix Phase 3 P0: this type mirrors the whitelisted public shape returned
 * by the backend `toPublicReview` mapper (see
 * [`product-reviews.ts`](medusa-agency-boilerplate/src/modules/product-reviews.ts:1)).
 *
 * Fields explicitly NOT in this shape — they would leak through public,
 * unauthenticated Store API endpoints:
 *   - `customer_id`
 *   - `order_id`
 *   - `status`
 *   - `moderated_by`
 *   - `moderated_at`
 *   - `rejection_reason`
 *
 * The customer-only «Мои отзывы» surface uses {@link MyProductReview} below,
 * which adds back `status` + `rejection_reason` (still no `customer_id` /
 * `order_id`).
 */
export type ProductReviewItem = {
  id: string
  product_id: string
  customer_name: string
  rating: number
  title: string | null
  text: string
  pros: string | null
  cons: string | null
  verified_purchase: boolean
  helpful_count: number
  /**
   * Reserved for Phase 3 step 5 (image attachments). The backend currently
   * normalises to `string[]` or `null`; UI consumers should treat `null` as
   * «no images».
   */
  images: string[] | null
  /**
   * Phase 3 / step 4 — admin reply («Ответ магазина»). The backend
   * `toPublicReview` mapper exposes `{ text, created_at }` when the
   * moderator has saved a reply, otherwise `null`. The admin actor id
   * (backend `merchant_reply_by`) is intentionally NOT exposed to the
   * storefront.
   */
  merchant_reply: { text: string; created_at: string } | null
  created_at: string
  updated_at: string
}

export type ProductReviewListResult = {
  items: ProductReviewItem[]
  total: number
  page: number
  pageSize: number
}

const RATING_CACHE_TAG = (productId: string) => `product-rating-${productId}`
const REVIEWS_CACHE_TAG = (productId: string) => `product-reviews-${productId}`
const CUSTOMER_REVIEWS_CACHE_TAG = (customerId: string) =>
  `customer-reviews-${customerId}`
/**
 * Phase 3 / step 3 — homepage «Лучшие отзывы» widget. The widget shares a
 * single, catalog-wide cache, so the tag is a singleton (no per-id suffix).
 * Backend admin routes invalidate it on every approve/reject of an approved
 * row and on admin DELETE of a previously-approved row (plan §9 Phase 3 п.5).
 */
const TOP_REVIEWS_CACHE_TAG = "top-reviews"

/**
 * Fetch the public rating summary for a product. Returns deterministic empty
 * defaults when the backend has no row in `product_rating_summary` yet (the
 * backend route already takes care of that — see route comment).
 */
export async function getProductRatingSummary(
  productId: string
): Promise<ProductReviewSummary | null> {
  if (!productId?.trim()) {
    return null
  }

  try {
    return await sdk.client.fetch<ProductReviewSummary>(
      `/store/products/${encodeURIComponent(productId)}/rating`,
      {
        method: "GET",
        next: {
          tags: [RATING_CACHE_TAG(productId)],
          revalidate: 60,
        },
        cache: "force-cache",
      }
    )
  } catch {
    // Phase 1 contract — empty-state on transport errors so the tab still
    // renders. The backend never returns 5xx for missing rows; a thrown
    // error here is genuinely a transport-level failure.
    return null
  }
}

/**
 * Phase 2 / step 4 — batch helper used by catalog server pages
 * (`paginated-products`, `product-rail`, `related-products`) to pre-fetch
 * rating summaries for every card in one render pass and pass them as a prop
 * into [`ProductRatingBadge`](medusa-agency-boilerplate-storefront/src/modules/products/components/product-rating-badge/index.tsx:1)
 * (`variant="thumbnail"`).
 *
 * Implementation notes:
 *   - Each entry is a separate HTTP request; Next.js cannot dedupe across
 *     different productIds. We parallelise via `Promise.allSettled` so a
 *     single failing fetch does not bring the whole grid down.
 *   - The underlying `getProductRatingSummary` keeps its
 *     `product-rating-${productId}` cache tag (plan §6.6) — so when admin
 *     approves a review, only the affected product's badge re-fetches on the
 *     next visit. We deliberately do NOT add a higher-level cache on top.
 *   - On any per-product transport failure (or empty summary) the productId
 *     is simply omitted from the returned record. Consumers must treat a
 *     missing key as "no rating yet" — the badge then renders `null`
 *     (plan §6.3 empty-state).
 */
export async function getProductRatingSummariesByIds(
  productIds: string[]
): Promise<Record<string, ProductReviewSummary>> {
  if (!Array.isArray(productIds) || productIds.length === 0) {
    return {}
  }

  const uniqueIds = Array.from(
    new Set(
      productIds.filter(
        (id): id is string => typeof id === "string" && id.trim().length > 0
      )
    )
  )

  if (uniqueIds.length === 0) {
    return {}
  }

  const results = await Promise.allSettled(
    uniqueIds.map((id) => getProductRatingSummary(id))
  )

  const record: Record<string, ProductReviewSummary> = {}
  for (let index = 0; index < uniqueIds.length; index += 1) {
    const result = results[index]
    if (result.status === "fulfilled" && result.value !== null) {
      record[uniqueIds[index]] = result.value
    }
  }

  return record
}

/**
 * Optional rating-bound on the public review list (plan §9 Phase 3 п.2).
 * Integer 1..5 — values outside the range are dropped before the request is
 * issued; the same constraint is enforced server-side via Zod.
 */
function clampRatingBound(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined
  }
  const truncated = Math.trunc(value)
  if (truncated < 1 || truncated > 5) {
    return undefined
  }
  return truncated
}

/**
 * Build the query object passed to `sdk.client.fetch`. Filter keys are only
 * included when set — leaving them off so the URL stays compact and the
 * Next.js data cache key matches the unfiltered baseline when the user has
 * not selected any chips.
 */
function buildReviewsListQuery(input: {
  page: number
  pageSize: number
  sort: ProductReviewSort
  minRating?: number | null
  maxRating?: number | null
  verifiedOnly?: boolean | null
}): Record<string, string | number | boolean> {
  const query: Record<string, string | number | boolean> = {
    page: input.page,
    pageSize: input.pageSize,
    sort: input.sort,
  }
  const minRating = clampRatingBound(input.minRating ?? undefined)
  const maxRating = clampRatingBound(input.maxRating ?? undefined)
  if (minRating !== undefined) {
    query.min_rating = minRating
  }
  if (maxRating !== undefined) {
    query.max_rating = maxRating
  }
  if (input.verifiedOnly === true) {
    query.verified_only = true
  }
  return query
}

/**
 * List approved reviews for a product. Server-side fetch with cache tag for
 * `revalidateTag('product-reviews-${productId}')` (plan §6.6).
 *
 * Phase 3 / step 2: optional `minRating` / `maxRating` / `verifiedOnly`
 * filters are forwarded to the backend as `min_rating` / `max_rating` /
 * `verified_only` query parameters. The cache tag stays the same — Next.js
 * already keys its data cache on the full URL (including the query string)
 * so different filter combinations produce distinct cached responses, and a
 * single `revalidateTag('product-reviews-${productId}')` invalidates them
 * all on review approve/reject.
 */
export async function listApprovedProductReviews(input: {
  productId: string
  page?: number
  pageSize?: number
  sort?: ProductReviewSort
  minRating?: number | null
  maxRating?: number | null
  verifiedOnly?: boolean | null
}): Promise<ProductReviewListResult> {
  const productId = input.productId
  const page = input.page && input.page > 0 ? Math.floor(input.page) : 1
  const pageSize =
    input.pageSize && input.pageSize > 0 ? Math.floor(input.pageSize) : 20
  const sort: ProductReviewSort = input.sort ?? "newest"

  const empty: ProductReviewListResult = {
    items: [],
    total: 0,
    page,
    pageSize,
  }

  if (!productId?.trim()) {
    return empty
  }

  try {
    return await sdk.client.fetch<ProductReviewListResult>(
      `/store/products/${encodeURIComponent(productId)}/reviews`,
      {
        method: "GET",
        query: buildReviewsListQuery({
          page,
          pageSize,
          sort,
          minRating: input.minRating,
          maxRating: input.maxRating,
          verifiedOnly: input.verifiedOnly,
        }),
        next: {
          tags: [REVIEWS_CACHE_TAG(productId)],
          revalidate: 60,
        },
        cache: "force-cache",
      }
    )
  } catch {
    return empty
  }
}

// ---------------------------------------------------------------------------
// Phase 3 / step 3 — homepage «Лучшие отзывы» widget data layer
// ---------------------------------------------------------------------------

export type GetTopApprovedProductReviewsArgs = {
  /** Default 8 — fits a 4-col, 2-row grid on desktop. Backend caps at 50. */
  limit?: number
  /** Default 4 — only ★4 and above qualify as «top». Backend caps 1..5. */
  minRating?: number
  /**
   * Optional time window in days. Omitted by default so older approved
   * reviews still surface on a low-traffic catalog. `0` is forwarded
   * verbatim to disable the date filter on the backend.
   */
  daysWindow?: number
}

/**
 * Fetch the top approved reviews across the whole catalog. Used by the
 * homepage `<TopReviewsWidget>` (plan §9 Phase 3 п.5).
 *
 * Cache contract:
 *   - tag `top-reviews` (singleton, catalog-wide). Admin approve/reject/delete
 *     of an approved row triggers `revalidateStorefrontTags(["top-reviews"])`
 *     on the backend.
 *   - `revalidate: 300` (5 minutes) as a safety net so the widget refreshes
 *     even when the webhook misses (env not configured, transport error).
 *
 * Defensive on transport failure — returns an empty array so the widget can
 * decide to render `null` instead of breaking the homepage.
 */
export async function getTopApprovedProductReviews(
  args: GetTopApprovedProductReviewsArgs = {}
): Promise<ProductReviewItem[]> {
  const limit =
    args.limit && args.limit > 0 ? Math.min(50, Math.floor(args.limit)) : 8
  const minRating =
    args.minRating !== undefined &&
    Number.isFinite(args.minRating) &&
    args.minRating >= 1 &&
    args.minRating <= 5
      ? Math.floor(args.minRating)
      : 4

  const query: Record<string, string | number | boolean> = {
    limit,
    min_rating: minRating,
  }
  if (
    args.daysWindow !== undefined &&
    Number.isFinite(args.daysWindow) &&
    args.daysWindow >= 0 &&
    args.daysWindow <= 365
  ) {
    query.days_window = Math.floor(args.daysWindow)
  }

  try {
    const response = await sdk.client.fetch<{ items: ProductReviewItem[] }>(
      `/store/reviews/top`,
      {
        method: "GET",
        query,
        next: {
          tags: [TOP_REVIEWS_CACHE_TAG],
          revalidate: 300,
        },
        cache: "force-cache",
      }
    )
    return Array.isArray(response?.items) ? response.items : []
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(
      "[product-reviews] getTopApprovedProductReviews failed",
      error instanceof Error ? error.message : error
    )
    return []
  }
}

/**
 * Server action consumed by the client pager (`pager.tsx`) to load the next
 * page or switch sorting. Project convention — clients call server actions
 * rather than the Medusa Store API directly (see
 * [`marketing.ts`](medusa-agency-boilerplate-storefront/src/lib/data/marketing.ts:1) /
 * [`customer.ts`](medusa-agency-boilerplate-storefront/src/lib/data/customer.ts:1)).
 *
 * Uses `cache: "no-store"` because clients fetch this on-demand and
 * caching across customer interactions would defeat the «load more»
 * UX (plan §6.6 keeps server-side cache only for the initial render).
 */
export async function fetchApprovedProductReviewsPage(input: {
  productId: string
  page: number
  pageSize?: number
  sort?: ProductReviewSort
  minRating?: number | null
  maxRating?: number | null
  verifiedOnly?: boolean | null
}): Promise<ProductReviewListResult> {
  const productId = input.productId
  const page = input.page > 0 ? Math.floor(input.page) : 1
  const pageSize =
    input.pageSize && input.pageSize > 0 ? Math.floor(input.pageSize) : 20
  const sort: ProductReviewSort = input.sort ?? "newest"

  const empty: ProductReviewListResult = {
    items: [],
    total: 0,
    page,
    pageSize,
  }

  if (!productId?.trim()) {
    return empty
  }

  return await sdk.client.fetch<ProductReviewListResult>(
    `/store/products/${encodeURIComponent(productId)}/reviews`,
    {
      method: "GET",
      query: buildReviewsListQuery({
        page,
        pageSize,
        sort,
        minRating: input.minRating,
        maxRating: input.maxRating,
        verifiedOnly: input.verifiedOnly,
      }),
      cache: "no-store",
    }
  )
}

// ---------------------------------------------------------------------------
// Helpful votes (authenticated)
// ---------------------------------------------------------------------------

export type ProductReviewHelpfulResult = {
  ok: boolean
  /** Returns the updated count when the call succeeded; null on failure. */
  helpful_count: number | null
  /** True when the customer had already voted before this call. */
  already_voted: boolean
  /** Stable code for UI branching: "ok" | "auth_required" | "not_found" | "error". */
  code: "ok" | "auth_required" | "not_found" | "error"
}

/**
 * Server action wrapper for `POST /store/reviews/:id/helpful`.
 *
 * The raw endpoint is customer-only, but the storefront's `_medusa_jwt`
 * cookie is `httpOnly` (see [`cookies.ts`](medusa-agency-boilerplate-storefront/src/lib/data/cookies.ts:1)).
 * Client islands therefore go through this server action so the auth header
 * is attached on the server — the same pattern is used by
 * `unsubscribeFromMarketing` and `updateMarketingPreferences`.
 */
export async function voteHelpfulOnReview(
  reviewId: string
): Promise<ProductReviewHelpfulResult> {
  if (!reviewId?.trim()) {
    return { ok: false, helpful_count: null, already_voted: false, code: "error" }
  }

  const authHeaders = await getAuthHeaders()
  // Empty object means «no `_medusa_jwt` cookie» — short-circuit to a
  // graceful auth_required so the UI can keep its disabled state.
  const hasAuth =
    typeof (authHeaders as { authorization?: string }).authorization === "string"

  if (!hasAuth) {
    return {
      ok: false,
      helpful_count: null,
      already_voted: false,
      code: "auth_required",
    }
  }

  try {
    const response = await sdk.client.fetch<{
      helpful_count: number
      already_voted?: boolean
    }>(`/store/reviews/${encodeURIComponent(reviewId)}/helpful`, {
      method: "POST",
      headers: { ...authHeaders },
      cache: "no-store",
    })
    return {
      ok: true,
      helpful_count:
        typeof response?.helpful_count === "number"
          ? Math.max(0, Math.trunc(response.helpful_count))
          : null,
      already_voted: Boolean(response?.already_voted),
      code: "ok",
    }
  } catch (error) {
    const candidate = error as { status?: number; statusCode?: number }
    const status = candidate?.status ?? candidate?.statusCode ?? 0
    if (status === 404) {
      return {
        ok: false,
        helpful_count: null,
        already_voted: false,
        code: "not_found",
      }
    }
    if (status === 401) {
      return {
        ok: false,
        helpful_count: null,
        already_voted: false,
        code: "auth_required",
      }
    }
    return {
      ok: false,
      helpful_count: null,
      already_voted: false,
      code: "error",
    }
  }
}

// ---------------------------------------------------------------------------
// Submit a new product review (authenticated)
// ---------------------------------------------------------------------------

/**
 * Stable error codes returned by `submitProductReview`. They are intentionally
 * decoupled from the backend `message` field — the backend already returns
 * i18n keys (e.g. `"reviews.form.alreadyExists"`), but the storefront UI maps
 * `code` → `storefrontConfig.copy.reviews.form.*` directly to keep the same
 * pattern as `voteHelpfulOnReview` and to stay independent of any future
 * backend message renames.
 */
export type ProductReviewSubmitCode =
  | "ok"
  | "auth_required"
  | "duplicate_review"
  | "require_purchase"
  | "rate_limited"
  | "validation_error"
  | "unknown"

export type ProductReviewSubmitResult =
  | { ok: true; review?: ProductReviewItem }
  | {
      ok: false
      code: ProductReviewSubmitCode
      status: number
    }

export type SubmitProductReviewInput = {
  productId: string
  rating: number
  text: string
  title?: string
  pros?: string
  cons?: string
  /**
   * Honeypot field — always sent through to the backend (per plan §10.1).
   * Real users leave it empty; bots fill it and the backend silently
   * accepts the request without writing to the DB.
   */
  website?: string
}

/**
 * Server action wrapper for `POST /store/products/:id/reviews`.
 *
 * Mirrors the auth pattern of {@link voteHelpfulOnReview}: the
 * `_medusa_jwt` cookie is read on the server, the request is sent through the
 * Medusa JS SDK and the FetchError thrown for non-2xx responses is mapped to a
 * stable `code` the UI can switch on. On success (HTTP 201) the function
 * revalidates `product-rating-${productId}` and `product-reviews-${productId}`
 * so the rating widget on the same page picks up the (potentially
 * auto-approved) submission once the customer reloads — required by plan
 * §6.6. The same call is safe when `REVIEWS_AUTO_APPROVE=false` (default in
 * Phase 1): the server simply re-fetches the same data and the cards remain
 * unchanged.
 */
export async function submitProductReview(
  input: SubmitProductReviewInput
): Promise<ProductReviewSubmitResult> {
  const productId = input.productId?.trim() ?? ""
  if (!productId) {
    return { ok: false, code: "validation_error", status: 400 }
  }

  const authHeaders = await getAuthHeaders()
  const hasAuth =
    typeof (authHeaders as { authorization?: string }).authorization === "string"
  if (!hasAuth) {
    return { ok: false, code: "auth_required", status: 401 }
  }

  const body: Record<string, unknown> = {
    rating: input.rating,
    text: input.text,
    // Always forward `website` (honeypot) — the backend silently accepts a
    // 201 when it is non-empty (plan §10.1, §6.4).
    website: typeof input.website === "string" ? input.website : "",
  }
  if (typeof input.title === "string" && input.title.trim().length > 0) {
    body.title = input.title.trim()
  }
  if (typeof input.pros === "string" && input.pros.trim().length > 0) {
    body.pros = input.pros.trim()
  }
  if (typeof input.cons === "string" && input.cons.trim().length > 0) {
    body.cons = input.cons.trim()
  }

  try {
    const response = await sdk.client.fetch<{ review?: ProductReviewItem }>(
      `/store/products/${encodeURIComponent(productId)}/reviews`,
      {
        method: "POST",
        headers: { ...authHeaders },
        body,
        cache: "no-store",
      }
    )

    // Successful 201 — invalidate the cache tags so the rating widget and
    // approved-reviews list re-fetch the next time the page is rendered.
    // Safe to call even when `REVIEWS_AUTO_APPROVE=false`: the underlying
    // data has not changed yet, but a future approve from admin will hit
    // the same tag (plan §6.6).
    revalidateTag(RATING_CACHE_TAG(productId))
    revalidateTag(REVIEWS_CACHE_TAG(productId))

    return {
      ok: true,
      review: response?.review,
    }
  } catch (error) {
    const candidate = error as { status?: number; statusCode?: number }
    const status = candidate?.status ?? candidate?.statusCode ?? 0
    if (status === 401) {
      return { ok: false, code: "auth_required", status: 401 }
    }
    if (status === 403) {
      return { ok: false, code: "require_purchase", status: 403 }
    }
    if (status === 409) {
      return { ok: false, code: "duplicate_review", status: 409 }
    }
    if (status === 429) {
      return { ok: false, code: "rate_limited", status: 429 }
    }
    if (status === 400) {
      return { ok: false, code: "validation_error", status: 400 }
    }
    return { ok: false, code: "unknown", status: status || 500 }
  }
}

// ---------------------------------------------------------------------------
// Phase 2 / step 5 — «Мои отзывы» account page
// ---------------------------------------------------------------------------

/**
 * One row of the «Мои отзывы» list. Adds `status` + `rejection_reason` on
 * top of the public {@link ProductReviewItem} shape so the
 * `/account/reviews` page can render «На модерации / Опубликован /
 * Отклонён» (plan §6.5).
 *
 * Customer-only — never use this type for `/store/products/:id/reviews` or
 * `/store/reviews/top` items.
 *
 * Backend mapper: `toMineReview(row)` in
 * [`product-reviews.ts`](medusa-agency-boilerplate/src/modules/product-reviews.ts:1).
 */
export type MyProductReview = ProductReviewItem & {
  status: "pending" | "approved" | "rejected"
  rejection_reason: string | null
}

export type MyProductReviewListResult = {
  items: MyProductReview[]
  total: number
  page: number
  pageSize: number
}

/**
 * Server fetch for the authenticated customer's reviews across all products.
 *
 * Cache contract (plan §6.6):
 *   - tag `customer-reviews-${customerId}` so admin approve/reject and the
 *     customer's own delete can invalidate this surface;
 *   - `revalidate: 60` as a safety net — even if no admin webhook fires
 *     (current Phase 2 backend only tags `product-rating-${id}` and
 *     `product-reviews-${id}` on approve/reject; see plan §9 Phase 2 step 6
 *     — extending `revalidateStorefrontTags` to additionally invalidate
 *     `customer-reviews-${customer_id}` is the next step), the page
 *     refreshes within a minute.
 *
 * The customerId is resolved via {@link retrieveCustomer} on the server. When
 * the customer is not authenticated the function returns an empty result
 * (rather than throwing) so the page-level `redirect()` stays the single
 * source of truth for auth-flow.
 *
 * Non-2xx responses are caught and logged; the UI then renders an empty
 * state — matching the defensive style of {@link listApprovedProductReviews}.
 */
export async function getMyProductReviews({
  page = 1,
  pageSize = 20,
}: { page?: number; pageSize?: number } = {}): Promise<MyProductReviewListResult> {
  const safePage = page > 0 ? Math.floor(page) : 1
  const safePageSize =
    pageSize > 0 && pageSize <= 100 ? Math.floor(pageSize) : 20

  const empty: MyProductReviewListResult = {
    items: [],
    total: 0,
    page: safePage,
    pageSize: safePageSize,
  }

  const authHeaders = await getAuthHeaders()
  const hasAuth =
    typeof (authHeaders as { authorization?: string }).authorization === "string"
  if (!hasAuth) {
    return empty
  }

  // Resolve the customer id so we can scope the cache tag deterministically.
  // `retrieveCustomer()` already swallows transport errors and returns null.
  const customer = await retrieveCustomer()
  if (!customer?.id) {
    return empty
  }

  try {
    const response = await sdk.client.fetch<MyProductReviewListResult>(
      `/store/customers/me/reviews`,
      {
        method: "GET",
        headers: { ...authHeaders },
        query: {
          page: safePage,
          pageSize: safePageSize,
        },
        next: {
          tags: [CUSTOMER_REVIEWS_CACHE_TAG(customer.id)],
          revalidate: 60,
        },
        cache: "force-cache",
      }
    )

    if (!response || !Array.isArray(response.items)) {
      return empty
    }

    return {
      items: response.items,
      total:
        typeof response.total === "number"
          ? Math.max(0, Math.trunc(response.total))
          : 0,
      page:
        typeof response.page === "number" && response.page > 0
          ? Math.floor(response.page)
          : safePage,
      pageSize:
        typeof response.pageSize === "number" && response.pageSize > 0
          ? Math.floor(response.pageSize)
          : safePageSize,
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(
      "[product-reviews] getMyProductReviews failed",
      error instanceof Error ? error.message : error
    )
    return empty
  }
}

/**
 * Stable error codes for {@link deleteMyProductReview}. Decoupled from
 * backend `message`/`code` strings so the UI can map them to copy without
 * coupling to the API surface (plan §6.5).
 *
 * Backend → code map:
 *   - 204 No Content              → `ok: true`
 *   - 404 not_found / not_owner   → `not_found`
 *   - 409 cannot_delete_published → `cannot_delete_published`
 *   - 401                         → `auth_required`
 *   - other / network             → `unknown`
 */
export type DeleteMyProductReviewCode =
  | "auth_required"
  | "not_found"
  | "cannot_delete_published"
  | "unknown"

export type DeleteMyProductReviewResult =
  | { ok: true }
  | { ok: false; code: DeleteMyProductReviewCode; status: number }

/**
 * Server action for `DELETE /store/customers/me/reviews/:id`.
 *
 * Mirrors the auth pattern of {@link voteHelpfulOnReview} and
 * {@link submitProductReview}: `_medusa_jwt` is `httpOnly`, so client islands
 * cannot DELETE directly — they go through this server action.
 *
 * On 204 the function calls `revalidateTag('customer-reviews-${customerId}')`
 * so the «Мои отзывы» page re-fetches without waiting for the 60-second
 * stale-while-revalidate (plan §6.6, §5.7 of step 5).
 */
export async function deleteMyProductReview(
  reviewId: string
): Promise<DeleteMyProductReviewResult> {
  if (!reviewId?.trim()) {
    return { ok: false, code: "unknown", status: 400 }
  }

  const authHeaders = await getAuthHeaders()
  const hasAuth =
    typeof (authHeaders as { authorization?: string }).authorization === "string"
  if (!hasAuth) {
    return { ok: false, code: "auth_required", status: 401 }
  }

  // Resolve the customer id BEFORE calling DELETE — we need it to invalidate
  // the cache tag on success. If the customer cookie is stale and there is
  // no current customer record the backend will reply 401, so it is safe to
  // short-circuit here too.
  const customer = await retrieveCustomer()
  if (!customer?.id) {
    return { ok: false, code: "auth_required", status: 401 }
  }

  try {
    await sdk.client.fetch<unknown>(
      `/store/customers/me/reviews/${encodeURIComponent(reviewId)}`,
      {
        method: "DELETE",
        headers: { ...authHeaders },
        cache: "no-store",
      }
    )

    // 204 No Content — the SDK resolves with `undefined`. Invalidate the
    // customer-scoped tag so the next visit to /account/reviews re-fetches.
    revalidateTag(CUSTOMER_REVIEWS_CACHE_TAG(customer.id))

    return { ok: true }
  } catch (error) {
    const candidate = error as { status?: number; statusCode?: number }
    const status = candidate?.status ?? candidate?.statusCode ?? 0

    if (status === 401) {
      return { ok: false, code: "auth_required", status: 401 }
    }
    if (status === 404) {
      return { ok: false, code: "not_found", status: 404 }
    }
    if (status === 409) {
      return {
        ok: false,
        code: "cannot_delete_published",
        status: 409,
      }
    }

    // eslint-disable-next-line no-console
    console.error(
      "[product-reviews] deleteMyProductReview failed",
      error instanceof Error ? error.message : error
    )
    return { ok: false, code: "unknown", status: status || 500 }
  }
}
