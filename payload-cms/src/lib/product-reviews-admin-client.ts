import 'server-only'

import {
  medusaAdminFetch,
  type MedusaAdminFetchResult,
} from './medusa-admin-client.ts'

/**
 * Thin per-endpoint helpers for the Medusa product-reviews admin API,
 * built on top of [`medusaAdminFetch`](payload-cms/src/lib/medusa-admin-client.ts:1).
 *
 * The backend routes live at `/admin/reviews` (see plan §4.2):
 *   - GET    /admin/reviews
 *   - GET    /admin/reviews/:id
 *   - POST   /admin/reviews/:id/approve
 *   - POST   /admin/reviews/:id/reject  body: { reason }
 *   - DELETE /admin/reviews/:id
 *
 * The shapes mirror the wire format from
 * [`medusa-agency-boilerplate/src/api/admin/reviews/route.ts`](medusa-agency-boilerplate/src/api/admin/reviews/route.ts:1)
 * and the underlying
 * [`product-reviews` module](medusa-agency-boilerplate/src/modules/product-reviews.ts:1).
 *
 * All exported helpers return the same discriminated union the underlying
 * `medusaAdminFetch` produces — callers branch on `ok` and never need to
 * try/catch.
 */

export type ProductReviewStatus = 'pending' | 'approved' | 'rejected'

/**
 * Wire shape of a single review as returned by Medusa's admin endpoints.
 *
 * Mirrors `ProductReviewRow` in the backend module verbatim: the admin
 * route returns the row as-is and we want a stable type that survives any
 * future field additions on the backend (extra fields are accepted via
 * the index signature).
 */
export type ProductReviewAdminItem = {
  id: string
  product_id: string
  customer_id: string | null
  order_id: string | null
  rating: number
  title: string | null
  text: string
  pros: string | null
  cons: string | null
  status: ProductReviewStatus
  moderated_by: string | null
  moderated_at: string | null
  rejection_reason: string | null
  verified_purchase: boolean
  helpful_count: number
  images: unknown
  customer_name: string
  created_at: string
  updated_at: string
  /** Be tolerant to additive backend fields. */
  [extra: string]: unknown
}

export type ProductReviewListResult = {
  items: ProductReviewAdminItem[]
  total: number
  page: number
  pageSize: number
}

export type ProductReviewDetailResult = {
  review: ProductReviewAdminItem
}

export type ProductReviewModerationResult = {
  review: ProductReviewAdminItem
  productId: string
  recalculated: boolean
}

export type ProductReviewListFilters = {
  status?: ProductReviewStatus
  productId?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  pageSize?: number
}

/**
 * Build a query string from the filter object, using the backend's
 * snake_case wire convention (`product_id`) where required. Unset
 * filters are not emitted, so the resulting URL never contains stray
 * `key=undefined` pairs.
 */
function buildListQuery(filters: ProductReviewListFilters): string {
  const params = new URLSearchParams()

  if (filters.status) params.set('status', filters.status)
  if (filters.productId && filters.productId.trim()) {
    params.set('product_id', filters.productId.trim())
  }
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
  if (filters.dateTo) params.set('dateTo', filters.dateTo)
  if (typeof filters.page === 'number' && Number.isFinite(filters.page)) {
    params.set('page', String(Math.max(1, Math.trunc(filters.page))))
  }
  if (
    typeof filters.pageSize === 'number' &&
    Number.isFinite(filters.pageSize)
  ) {
    params.set(
      'pageSize',
      String(Math.max(1, Math.min(100, Math.trunc(filters.pageSize)))),
    )
  }

  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export function listProductReviewsAdmin(
  filters: ProductReviewListFilters = {},
  options: { signal?: AbortSignal } = {},
): Promise<MedusaAdminFetchResult<ProductReviewListResult>> {
  return medusaAdminFetch<ProductReviewListResult>(
    `/admin/reviews${buildListQuery(filters)}`,
    { method: 'GET', signal: options.signal },
  )
}

export function getProductReviewAdmin(
  id: string,
  options: { signal?: AbortSignal } = {},
): Promise<MedusaAdminFetchResult<ProductReviewDetailResult>> {
  return medusaAdminFetch<ProductReviewDetailResult>(
    `/admin/reviews/${encodeURIComponent(id)}`,
    { method: 'GET', signal: options.signal },
  )
}

export function approveProductReviewAdmin(
  id: string,
  options: { signal?: AbortSignal } = {},
): Promise<MedusaAdminFetchResult<ProductReviewModerationResult>> {
  return medusaAdminFetch<ProductReviewModerationResult>(
    `/admin/reviews/${encodeURIComponent(id)}/approve`,
    { method: 'POST', body: {}, signal: options.signal },
  )
}

export function rejectProductReviewAdmin(
  id: string,
  reason: string,
  options: { signal?: AbortSignal } = {},
): Promise<MedusaAdminFetchResult<ProductReviewModerationResult>> {
  return medusaAdminFetch<ProductReviewModerationResult>(
    `/admin/reviews/${encodeURIComponent(id)}/reject`,
    { method: 'POST', body: { reason }, signal: options.signal },
  )
}

export function deleteProductReviewAdmin(
  id: string,
  options: { signal?: AbortSignal } = {},
): Promise<MedusaAdminFetchResult<null>> {
  return medusaAdminFetch<null>(
    `/admin/reviews/${encodeURIComponent(id)}`,
    { method: 'DELETE', signal: options.signal },
  )
}

export type { MedusaAdminFetchResult } from './medusa-admin-client.ts'
