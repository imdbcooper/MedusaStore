/**
 * Phase 4 / step 2 — thin per-endpoint helpers for the Medusa product
 * reviews admin API, used by the Medusa Admin Extensions UI.
 *
 * Ported from
 * [`payload-cms/src/lib/product-reviews-admin-client.ts`](payload-cms/src/lib/product-reviews-admin-client.ts:1)
 * but stripped of the Basic-auth / `MEDUSA_ADMIN_SECRET_API_KEY` plumbing:
 * the Medusa Admin UI is same-origin with the API and authenticates
 * through the session cookie set by the regular Medusa login flow.
 *
 * The discriminated-union shape (`{ ok: true, data } | { ok: false, ... }`)
 * is preserved so callers branch on `ok` instead of try/catch — see
 * [`error-mapping.ts`](medusa-agency-boilerplate/src/admin/routes/product-reviews/lib/error-mapping.ts:1)
 * for the user-facing copy mapping.
 *
 * The backend routes live at `/admin/reviews/*`:
 *   - GET    /admin/reviews
 *   - GET    /admin/reviews/:id
 *   - POST   /admin/reviews/:id/approve
 *   - POST   /admin/reviews/:id/reject  body: { reason }
 *   - DELETE /admin/reviews/:id
 *   - POST   /admin/reviews/:id/reply   body: { text }
 *   - DELETE /admin/reviews/:id/reply
 *
 * Wire shapes mirror
 * [`src/api/admin/reviews/route.ts`](medusa-agency-boilerplate/src/api/admin/reviews/route.ts:1)
 * and the underlying
 * [`product-reviews` module](medusa-agency-boilerplate/src/modules/product-reviews.ts:1).
 *
 * NB: this file is part of the Medusa Admin client bundle (Vite). It must
 * NOT import `'server-only'` and must NOT reference `process.env`.
 */

export type AdminReviewStatus = 'pending' | 'approved' | 'rejected'

/**
 * Discriminated-union return type for every helper. `aborted` and
 * `transport_error` use `status: 0` so callers can distinguish wire
 * failures from real HTTP responses.
 */
export type AdminReviewsApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string; message?: string }

/**
 * Wire shape of a single review as returned by Medusa's admin endpoints.
 *
 * Mirrors `ProductReviewRow` in the backend module verbatim with one
 * intentional widening: `images` is `Array<{ id; url }> | string[] | null`
 * because the early Phase 3 dev rows persisted the legacy `string[]`
 * shape — the moderator UI must tolerate both. Use
 * [`normalizeAdminReviewImageUrls`](medusa-agency-boilerplate/src/admin/routes/product-reviews/lib/helpers.ts:1)
 * to flatten the union.
 */
export type AdminReviewListItem = {
  id: string
  product_id: string
  customer_id: string | null
  customer_name: string
  rating: number
  title: string | null
  text: string
  pros: string | null
  cons: string | null
  status: AdminReviewStatus
  rejection_reason: string | null
  verified_purchase: boolean
  helpful_count: number
  images: Array<{ id: string; url: string }> | string[] | null
  merchant_reply_text: string | null
  merchant_reply_by: string | null
  merchant_reply_at: string | null
  order_id: string | null
  moderated_by: string | null
  moderated_at: string | null
  created_at: string
  updated_at: string
}

export type AdminReviewListResult = {
  items: AdminReviewListItem[]
  total: number
  page: number
  pageSize: number
}

export type AdminReviewDetailResult = {
  review: AdminReviewListItem
}

export type AdminReviewModerationResult = {
  review: AdminReviewListItem
  productId: string
  recalculated: boolean
  statusChanged: boolean
}

/**
 * Wire shape returned by `/admin/reviews/:id/reply` (POST + DELETE). The
 * backend deliberately omits the `recalculated` flag here because admin
 * reply never affects the rating summary.
 */
export type AdminReviewReplyResult = {
  review: AdminReviewListItem
  productId: string
}

export type AdminReviewListFilters = {
  status?: AdminReviewStatus
  productId?: string
  /** ISO date string (`YYYY-MM-DD` or full ISO datetime). */
  dateFrom?: string
  dateTo?: string
  page?: number
  pageSize?: number
}

const BASE = '/admin/reviews'

type FetchOptions = {
  method?: 'GET' | 'POST' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
}

/**
 * Build a query string from the filter object using the backend's
 * snake_case wire convention (`product_id`) where required. Unset
 * filters are not emitted, so the resulting URL never contains stray
 * `key=undefined` pairs.
 *
 * Mirrors `buildListQuery` from the Payload client one-to-one — same
 * keys, same trim/clamp logic — to guarantee parity with the existing
 * backend test suite.
 */
function buildListQuery(filters: AdminReviewListFilters): string {
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

/**
 * Core fetch wrapper. Uses `credentials: 'include'` so the Medusa
 * session cookie travels even when the Admin UI and the API end up
 * on different subdomains in staging. Header is only added for POST
 * bodies — empty `Content-Type` keeps GET/DELETE preflight-free.
 *
 * Errors are normalised into `{ ok: false, status, error, message? }`:
 *   - 401/403 → `error: 'unauthorized'`,
 *   - other HTTP errors → backend `code` / `type` if available,
 *     otherwise `http_<status>`,
 *   - thrown `AbortError` → `error: 'aborted', status: 0`,
 *   - any other thrown error → `error: 'transport_error', status: 0`.
 */
async function adminReviewsFetch<T>(
  path: string,
  options: FetchOptions = {},
): Promise<AdminReviewsApiResult<T>> {
  try {
    const headers: Record<string, string> | undefined = options.body
      ? { 'Content-Type': 'application/json' }
      : undefined

    const res = await fetch(`${BASE}${path}`, {
      method: options.method ?? 'GET',
      credentials: 'include',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    })

    if (!res.ok) {
      let errorCode = `http_${res.status}`
      let errorMessage: string | undefined
      try {
        const body = (await res.json()) as unknown
        if (body && typeof body === 'object') {
          const obj = body as { code?: unknown; type?: unknown; message?: unknown }
          if (typeof obj.code === 'string') {
            errorCode = obj.code
          } else if (typeof obj.type === 'string') {
            errorCode = obj.type
          }
          if (typeof obj.message === 'string') {
            errorMessage = obj.message
          }
        }
      } catch {
        // body wasn't JSON — keep the synthetic http_<status> code.
      }

      if (res.status === 401 || res.status === 403) {
        errorCode = 'unauthorized'
      }

      return {
        ok: false,
        status: res.status,
        error: errorCode,
        message: errorMessage,
      }
    }

    // 204 No Content — used by DELETE endpoints.
    if (res.status === 204) {
      return { ok: true, data: undefined as unknown as T }
    }

    const data = (await res.json()) as T
    return { ok: true, data }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, status: 0, error: 'aborted' }
    }
    return {
      ok: false,
      status: 0,
      error: 'transport_error',
      message: err instanceof Error ? err.message : undefined,
    }
  }
}

export function listReviewsAdmin(
  filters: AdminReviewListFilters = {},
  signal?: AbortSignal,
): Promise<AdminReviewsApiResult<AdminReviewListResult>> {
  return adminReviewsFetch<AdminReviewListResult>(`${buildListQuery(filters)}`, {
    method: 'GET',
    signal,
  })
}

export function getReviewAdmin(
  id: string,
  signal?: AbortSignal,
): Promise<AdminReviewsApiResult<AdminReviewDetailResult>> {
  return adminReviewsFetch<AdminReviewDetailResult>(
    `/${encodeURIComponent(id)}`,
    { method: 'GET', signal },
  )
}

export function approveReviewAdmin(
  id: string,
  signal?: AbortSignal,
): Promise<AdminReviewsApiResult<AdminReviewModerationResult>> {
  return adminReviewsFetch<AdminReviewModerationResult>(
    `/${encodeURIComponent(id)}/approve`,
    { method: 'POST', body: {}, signal },
  )
}

export function rejectReviewAdmin(
  id: string,
  reason: string,
  signal?: AbortSignal,
): Promise<AdminReviewsApiResult<AdminReviewModerationResult>> {
  return adminReviewsFetch<AdminReviewModerationResult>(
    `/${encodeURIComponent(id)}/reject`,
    { method: 'POST', body: { reason }, signal },
  )
}

export function deleteReviewAdmin(
  id: string,
  signal?: AbortSignal,
): Promise<AdminReviewsApiResult<undefined>> {
  return adminReviewsFetch<undefined>(`/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    signal,
  })
}

export function setReviewReplyAdmin(
  id: string,
  text: string,
  signal?: AbortSignal,
): Promise<AdminReviewsApiResult<AdminReviewReplyResult>> {
  return adminReviewsFetch<AdminReviewReplyResult>(
    `/${encodeURIComponent(id)}/reply`,
    { method: 'POST', body: { text }, signal },
  )
}

export function clearReviewReplyAdmin(
  id: string,
  signal?: AbortSignal,
): Promise<AdminReviewsApiResult<AdminReviewReplyResult>> {
  return adminReviewsFetch<AdminReviewReplyResult>(
    `/${encodeURIComponent(id)}/reply`,
    { method: 'DELETE', signal },
  )
}
