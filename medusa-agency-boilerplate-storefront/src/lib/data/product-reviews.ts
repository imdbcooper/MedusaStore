"use server"

import { revalidateTag } from "next/cache"

import { sdk } from "@lib/config"
import { getAuthHeaders } from "./cookies"

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

export type ProductReviewItem = {
  id: string
  product_id: string
  customer_id: string | null
  order_id: string | null
  rating: number
  title: string | null
  text: string
  pros: string | null
  cons: string | null
  status: "pending" | "approved" | "rejected"
  moderated_by: string | null
  moderated_at: string | null
  rejection_reason: string | null
  verified_purchase: boolean
  helpful_count: number
  images: unknown
  customer_name: string
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
 * List approved reviews for a product. Server-side fetch with cache tag for
 * `revalidateTag('product-reviews-${productId}')` (plan §6.6).
 */
export async function listApprovedProductReviews(input: {
  productId: string
  page?: number
  pageSize?: number
  sort?: ProductReviewSort
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
        query: {
          page,
          pageSize,
          sort,
        },
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
      query: {
        page,
        pageSize,
        sort,
      },
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
