/**
 * Phase 4 / step 3 — Medusa Admin moderation list route.
 *
 * Replaces the Payload-side
 * [`Page.tsx`](payload-cms/src/views/product-reviews-moderation/Page.tsx:1)
 * list view with an in-domain Medusa Admin Extensions route. The default
 * export is rendered by the Medusa dashboard at `/app/product-reviews`;
 * the `config` named export adds the sidebar entry via
 * `defineRouteConfig` (plan §6.3, §3.1.b).
 *
 * Rendering contract:
 *   - URL-driven state: filters live in `?status=…&rating=…&productId=…
 *     &dateFrom=…&dateTo=…&page=…`. Reads/writes through
 *     `useSearchParams` from `react-router-dom`, which the Medusa
 *     dashboard already wraps in its router.
 *   - Server state: `useQuery({ queryKey: productReviewQueryKeys.list(filters) })`
 *     calls
 *     [`listReviewsAdmin`](medusa-agency-boilerplate/src/admin/routes/product-reviews/lib/api.ts:1).
 *     Mutations (`approveReviewAdmin`, `rejectReviewAdmin`) invalidate
 *     `productReviewQueryKeys.all` so detail / counter / list all refetch.
 *   - The dashboard ships a single global `QueryClientProvider` (see
 *     `node_modules/@medusajs/dashboard/dist/app.js`); `useQueryClient`
 *     here taps into that same client without spawning a duplicate.
 *
 * Quick actions:
 *   - `usePrompt` from `@medusajs/ui` is a confirm-only boolean prompt
 *     (no text input), so the reject flow falls back to `window.prompt`
 *     for the reason — see `handleReject` below. Length is clamped to
 *     500 chars client-side; backend Zod still validates.
 *
 * Plan §10.2: every dynamic value is rendered via React text
 * interpolation; nothing uses `dangerouslySetInnerHTML`. Inputs that
 * could collapse to whitespace (`productId`) are trimmed before being
 * forwarded to the backend.
 */

import { defineRouteConfig } from '@medusajs/admin-sdk'
import {
  ChatBubbleLeftRight,
  CheckCircle,
  Eye,
  Funnel,
  XCircle,
} from '@medusajs/icons'
import {
  Button,
  Container,
  Heading,
  IconButton,
  Input,
  Select,
  Skeleton,
  StatusBadge,
  Table,
  Toaster,
  toast,
} from '@medusajs/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import {
  approveReviewAdmin,
  listReviewsAdmin,
  rejectReviewAdmin,
  type AdminReviewListFilters,
  type AdminReviewListItem,
  type AdminReviewStatus,
} from './lib/api'
import { moderationCopy } from './lib/copy'
import { mapErrorToMessage } from './lib/error-mapping'
import {
  customerDisplayName,
  formatDate,
  formatStarRating,
  PAGE_SIZE,
  RATING_OPTIONS,
  STATUS_OPTIONS,
  truncateText,
  type AllStatusOption,
} from './lib/helpers'
import { productReviewQueryKeys } from './lib/query-keys'

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export const config = defineRouteConfig({
  label: moderationCopy.nav.label,
  icon: ChatBubbleLeftRight,
})

// ---------------------------------------------------------------------------
// URL state
// ---------------------------------------------------------------------------

type ParsedFilters = {
  status: AllStatusOption
  rating: '' | '1' | '2' | '3' | '4' | '5'
  productId: string
  dateFrom: string
  dateTo: string
  page: number
}

const STATUS_VALUES: ReadonlyArray<AllStatusOption> = [
  'pending',
  'approved',
  'rejected',
  'all',
]

/**
 * Parse the URL `URLSearchParams` into a strongly-typed filter object,
 * applying the same defaults as the Payload version: `status=pending`
 * when missing or invalid, `page>=1`. Whitespace-only values fall back
 * to empty so the table never renders with `?productId=%20`.
 */
function parseFilters(params: URLSearchParams): ParsedFilters {
  const get = (key: string) => params.get(key)?.trim() ?? ''

  const statusRaw = get('status').toLowerCase()
  const status: AllStatusOption = STATUS_VALUES.includes(
    statusRaw as AllStatusOption,
  )
    ? (statusRaw as AllStatusOption)
    : 'pending'

  const ratingRaw = get('rating')
  const rating: ParsedFilters['rating'] = ['1', '2', '3', '4', '5'].includes(
    ratingRaw,
  )
    ? (ratingRaw as ParsedFilters['rating'])
    : ''

  const pageRaw = parseInt(get('page'), 10)
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1

  return {
    status,
    rating,
    productId: get('productId'),
    dateFrom: get('dateFrom'),
    dateTo: get('dateTo'),
    page,
  }
}

/**
 * Map parsed filters → backend wire shape. `status: 'all'` collapses to
 * `undefined` (backend returns every status). `dateFrom`/`dateTo` come
 * from `<input type="date">` as `YYYY-MM-DD`; we promote them to ISO so
 * the backend honours moderator-local boundaries the same way the
 * Payload version does.
 */
function toApiFilters(filters: ParsedFilters): AdminReviewListFilters {
  return {
    status: filters.status === 'all' ? undefined : filters.status,
    productId: filters.productId || undefined,
    dateFrom: filters.dateFrom
      ? new Date(`${filters.dateFrom}T00:00:00`).toISOString()
      : undefined,
    dateTo: filters.dateTo
      ? new Date(`${filters.dateTo}T23:59:59.999`).toISOString()
      : undefined,
    page: filters.page,
    pageSize: PAGE_SIZE,
  }
}

/**
 * Serialise filters back into URL search-params, dropping anything that
 * matches the implicit defaults (`status=pending`, `page=1`) so the URL
 * stays clean.
 */
function serializeFilters(filters: Partial<ParsedFilters>): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.status && filters.status !== 'pending') {
    params.set('status', filters.status)
  }
  if (filters.rating) params.set('rating', filters.rating)
  if (filters.productId && filters.productId.trim()) {
    params.set('productId', filters.productId.trim())
  }
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
  if (filters.dateTo) params.set('dateTo', filters.dateTo)
  if (filters.page && filters.page > 1) {
    params.set('page', String(filters.page))
  }
  return params
}

const STATUS_BADGE_COLOR: Record<
  AdminReviewStatus,
  'orange' | 'green' | 'red'
> = {
  pending: 'orange',
  approved: 'green',
  rejected: 'red',
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const ProductReviewsListPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = useMemo(() => parseFilters(searchParams), [searchParams])
  const apiFilters = useMemo(() => toApiFilters(filters), [filters])

  const queryClient = useQueryClient()

  const listQuery = useQuery({
    queryKey: productReviewQueryKeys.list(apiFilters),
    queryFn: async () => {
      const result = await listReviewsAdmin(apiFilters)
      if (!result.ok) {
        // Surface the discriminated-union error as a thrown value so
        // `useQuery` lands in the `isError` branch with a typed payload.
        throw result
      }
      return result.data
    },
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  })

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await approveReviewAdmin(id)
      if (!result.ok) throw result
      return result.data
    },
    onSuccess: () => {
      toast.success(moderationCopy.detail.success.approved)
      queryClient.invalidateQueries({
        queryKey: productReviewQueryKeys.all,
      })
    },
    onError: (err: unknown) => {
      const errorCode =
        err && typeof err === 'object' && 'error' in err
          ? String((err as { error: unknown }).error)
          : 'transport_error'
      toast.error(mapErrorToMessage(errorCode))
    },
  })

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const result = await rejectReviewAdmin(id, reason)
      if (!result.ok) throw result
      return result.data
    },
    onSuccess: () => {
      toast.success(moderationCopy.detail.success.rejected)
      queryClient.invalidateQueries({
        queryKey: productReviewQueryKeys.all,
      })
    },
    onError: (err: unknown) => {
      const errorCode =
        err && typeof err === 'object' && 'error' in err
          ? String((err as { error: unknown }).error)
          : 'transport_error'
      toast.error(mapErrorToMessage(errorCode))
    },
  })

  const updateFilters = (next: Partial<ParsedFilters>) => {
    const merged: ParsedFilters = {
      ...filters,
      ...next,
      // Filter changes always reset to page 1 unless the caller
      // explicitly set `page` (e.g. pagination buttons).
      page: typeof next.page === 'number' ? next.page : 1,
    }
    setSearchParams(serializeFilters(merged), { replace: false })
  }

  const resetFilters = () => {
    // Reset clears every filter except the implicit `status='pending'`
    // default, which produces an empty query string.
    setSearchParams(new URLSearchParams(), { replace: false })
  }

  const handleApprove = (id: string) => {
    approveMutation.mutate(id)
  }

  const handleReject = (id: string) => {
    // `usePrompt` from `@medusajs/ui` is a confirm-only boolean prompt
    // (returns `Promise<boolean>`); for a free-form reason we fall back
    // to the native `window.prompt` and clamp the length client-side.
    const reasonRaw = window.prompt(
      `${moderationCopy.detail.reject.heading}\n\n${moderationCopy.detail.reject.placeholder}`,
      '',
    )
    if (reasonRaw === null) return // user cancelled
    const reason = reasonRaw.trim()
    if (!reason) {
      toast.error(moderationCopy.detail.reject.reasonRequired)
      return
    }
    if (reason.length > 500) {
      toast.error(moderationCopy.detail.reject.reasonTooLong)
      return
    }
    rejectMutation.mutate({ id, reason })
  }

  // Client-side rating slice over the current page — same UX limitation
  // as the Payload version (backend doesn't accept `rating` filter
  // yet). Pagination + total still reflect the server-side filters.
  const items = listQuery.data?.items ?? []
  const filteredItems = filters.rating
    ? items.filter((item) => String(item.rating) === filters.rating)
    : items

  const total = listQuery.data?.total ?? 0
  const pageSize = listQuery.data?.pageSize ?? PAGE_SIZE
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = listQuery.data?.page ?? filters.page

  return (
    <Container className="divide-y p-0">
      <Toaster />

      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h1">{moderationCopy.list.heading}</Heading>
          <p className="text-ui-fg-subtle txt-small mt-1">
            {moderationCopy.list.subheading}
          </p>
        </div>
      </div>

      <FiltersPanel
        filters={filters}
        onChange={updateFilters}
        onReset={resetFilters}
      />

      <div className="px-6 py-4">
        {listQuery.isLoading ? (
          <SkeletonRows />
        ) : listQuery.isError ? (
          <ErrorBanner
            error={listQuery.error}
            onRetry={() => listQuery.refetch()}
          />
        ) : filteredItems.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {filters.rating ? <RatingClientFilterNotice /> : null}
            <ReviewsTable
              items={filteredItems}
              isMutating={
                approveMutation.isPending || rejectMutation.isPending
              }
              onApprove={handleApprove}
              onReject={handleReject}
            />
          </>
        )}
      </div>

      <Pagination
        page={currentPage}
        totalPages={totalPages}
        total={total}
        pageSize={pageSize}
        itemsOnPage={items.length}
        onChange={(nextPage) => updateFilters({ page: nextPage })}
      />
    </Container>
  )
}

export default ProductReviewsListPage

// ---------------------------------------------------------------------------
// Filters panel
// ---------------------------------------------------------------------------

type FiltersPanelProps = {
  filters: ParsedFilters
  onChange: (next: Partial<ParsedFilters>) => void
  onReset: () => void
}

const FiltersPanel = ({ filters, onChange, onReset }: FiltersPanelProps) => {
  return (
    <div className="bg-ui-bg-subtle flex flex-wrap items-end gap-3 px-6 py-4">
      <Funnel className="text-ui-fg-muted mb-2" />

      <div className="flex flex-col gap-1">
        <label className="txt-compact-xsmall text-ui-fg-subtle">
          {moderationCopy.list.filters.status}
        </label>
        <Select
          size="small"
          value={filters.status}
          onValueChange={(value) =>
            onChange({ status: value as AllStatusOption })
          }
        >
          <Select.Trigger className="min-w-[160px]">
            <Select.Value />
          </Select.Trigger>
          <Select.Content>
            {STATUS_OPTIONS.map((option) => (
              <Select.Item key={option.value} value={option.value}>
                {option.label}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="txt-compact-xsmall text-ui-fg-subtle">
          {moderationCopy.list.filters.rating}
        </label>
        <Select
          size="small"
          value={filters.rating || '__any'}
          onValueChange={(value) =>
            onChange({
              rating:
                value === '__any'
                  ? ''
                  : (value as ParsedFilters['rating']),
            })
          }
        >
          <Select.Trigger className="min-w-[120px]">
            <Select.Value />
          </Select.Trigger>
          <Select.Content>
            {RATING_OPTIONS.map((option) => (
              <Select.Item
                key={option.value || '__any'}
                value={option.value || '__any'}
              >
                {option.label}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="txt-compact-xsmall text-ui-fg-subtle">
          {moderationCopy.list.filters.productId}
        </label>
        <Input
          size="small"
          placeholder={moderationCopy.list.filters.productIdPlaceholder}
          defaultValue={filters.productId}
          onBlur={(event) => {
            const next = event.currentTarget.value.trim()
            if (next !== filters.productId) {
              onChange({ productId: next })
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              const next = event.currentTarget.value.trim()
              if (next !== filters.productId) {
                onChange({ productId: next })
              }
            }
          }}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="txt-compact-xsmall text-ui-fg-subtle">
          {moderationCopy.list.filters.dateFrom}
        </label>
        <Input
          size="small"
          type="date"
          value={filters.dateFrom}
          onChange={(event) =>
            onChange({ dateFrom: event.currentTarget.value })
          }
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="txt-compact-xsmall text-ui-fg-subtle">
          {moderationCopy.list.filters.dateTo}
        </label>
        <Input
          size="small"
          type="date"
          value={filters.dateTo}
          onChange={(event) =>
            onChange({ dateTo: event.currentTarget.value })
          }
        />
      </div>

      <Button
        size="small"
        variant="secondary"
        onClick={onReset}
        type="button"
      >
        {moderationCopy.list.filters.reset}
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Rating-filter notice
// ---------------------------------------------------------------------------

const RatingClientFilterNotice = () => {
  return (
    <div
      role="status"
      className="bg-ui-tag-orange-bg text-ui-tag-orange-text mb-4 rounded-md px-3 py-2 text-xs"
    >
      {moderationCopy.list.notes.ratingClientFilter}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

type ReviewsTableProps = {
  items: AdminReviewListItem[]
  isMutating: boolean
  onApprove: (id: string) => void
  onReject: (id: string) => void
}

const ReviewsTable = ({
  items,
  isMutating,
  onApprove,
  onReject,
}: ReviewsTableProps) => {
  return (
    <div className="overflow-x-auto">
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>
              {moderationCopy.list.columns.createdAt}
            </Table.HeaderCell>
            <Table.HeaderCell>
              {moderationCopy.list.columns.product}
            </Table.HeaderCell>
            <Table.HeaderCell>
              {moderationCopy.list.columns.customer}
            </Table.HeaderCell>
            <Table.HeaderCell>
              {moderationCopy.list.columns.rating}
            </Table.HeaderCell>
            <Table.HeaderCell>
              {moderationCopy.list.columns.text}
            </Table.HeaderCell>
            <Table.HeaderCell>
              {moderationCopy.list.columns.status}
            </Table.HeaderCell>
            <Table.HeaderCell>
              {moderationCopy.detail.fields.verifiedPurchase}
            </Table.HeaderCell>
            <Table.HeaderCell className="text-right">
              {moderationCopy.list.columns.actions}
            </Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {items.map((item) => {
            const truncated = truncateText(item.text, 80)
            return (
              <Table.Row key={item.id}>
                <Table.Cell className="whitespace-nowrap">
                  {formatDate(item.created_at)}
                </Table.Cell>
                <Table.Cell>
                  <code className="txt-compact-xsmall text-ui-fg-subtle">
                    {item.product_id}
                  </code>
                </Table.Cell>
                <Table.Cell>
                  <div className="flex flex-col">
                    <span>{customerDisplayName(item)}</span>
                    {item.customer_id ? (
                      <code className="txt-compact-xsmall text-ui-fg-muted">
                        {item.customer_id}
                      </code>
                    ) : null}
                  </div>
                </Table.Cell>
                <Table.Cell
                  aria-label={moderationCopy.rating.starsAria(item.rating)}
                >
                  <span className="text-ui-tag-orange-icon">
                    {formatStarRating(item.rating)}
                  </span>
                </Table.Cell>
                <Table.Cell className="max-w-[320px]" title={item.text}>
                  {item.title ? (
                    <strong className="mr-1">{item.title} ·</strong>
                  ) : null}
                  <span>{truncated}</span>
                </Table.Cell>
                <Table.Cell>
                  <StatusBadge color={STATUS_BADGE_COLOR[item.status]}>
                    {moderationCopy.status[item.status]}
                  </StatusBadge>
                </Table.Cell>
                <Table.Cell>
                  {item.verified_purchase ? (
                    <span className="bg-ui-tag-green-bg text-ui-tag-green-text rounded-md px-2 py-0.5 text-xs">
                      ✓ {moderationCopy.detail.fields.verifiedPurchase}
                    </span>
                  ) : null}
                </Table.Cell>
                <Table.Cell>
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      to={`/product-reviews/${encodeURIComponent(item.id)}`}
                    >
                      <IconButton
                        size="small"
                        variant="transparent"
                        aria-label={moderationCopy.list.actions.open}
                      >
                        <Eye />
                      </IconButton>
                    </Link>
                    {item.status === 'pending' ? (
                      <>
                        <IconButton
                          size="small"
                          variant="transparent"
                          aria-label={moderationCopy.list.actions.approve}
                          disabled={isMutating}
                          onClick={() => onApprove(item.id)}
                        >
                          <CheckCircle className="text-ui-tag-green-icon" />
                        </IconButton>
                        <IconButton
                          size="small"
                          variant="transparent"
                          aria-label={moderationCopy.list.actions.reject}
                          disabled={isMutating}
                          onClick={() => onReject(item.id)}
                        >
                          <XCircle className="text-ui-tag-red-icon" />
                        </IconButton>
                      </>
                    ) : null}
                  </div>
                </Table.Cell>
              </Table.Row>
            )
          })}
        </Table.Body>
      </Table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Loading / empty / error states
// ---------------------------------------------------------------------------

const SkeletonRows = () => {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 10 }).map((_, idx) => (
        <Skeleton key={idx} className="h-10 w-full" />
      ))}
    </div>
  )
}

const EmptyState = () => {
  return (
    <div className="border-ui-border-base text-ui-fg-subtle flex items-center justify-center rounded-md border border-dashed px-6 py-12">
      {moderationCopy.list.empty}
    </div>
  )
}

type ErrorBannerProps = {
  error: unknown
  onRetry: () => void
}

const ErrorBanner = ({ error, onRetry }: ErrorBannerProps) => {
  const errorCode =
    error && typeof error === 'object' && 'error' in error
      ? String((error as { error: unknown }).error)
      : 'transport_error'
  const message = mapErrorToMessage(errorCode)

  return (
    <div
      role="alert"
      className="bg-ui-tag-red-bg text-ui-tag-red-text flex items-center justify-between gap-4 rounded-md px-4 py-3"
    >
      <span>{message}</span>
      <Button size="small" variant="secondary" onClick={onRetry}>
        {moderationCopy.list.error.retry}
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

type PaginationProps = {
  page: number
  totalPages: number
  total: number
  pageSize: number
  itemsOnPage: number
  onChange: (page: number) => void
}

const Pagination = ({
  page,
  totalPages,
  total,
  pageSize,
  itemsOnPage,
  onChange,
}: PaginationProps) => {
  const canPrev = page > 1
  // Trust the server: when the current page is full, assume there is at
  // least one more page even if `total` is stale; otherwise compare
  // against `totalPages`.
  const canNext = page < totalPages && itemsOnPage > 0

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = Math.min(total, (page - 1) * pageSize + itemsOnPage)

  return (
    <div className="border-ui-border-base flex flex-wrap items-center justify-between gap-4 border-t px-6 py-3">
      <div className="text-ui-fg-subtle txt-compact-small">
        {total === 0
          ? moderationCopy.list.pagination.total(0)
          : `${rangeStart}–${rangeEnd} ${moderationCopy.list.pagination.total(total).toLowerCase()}`}
        {' · '}
        {moderationCopy.list.pagination.pageOf(page, totalPages)}
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="small"
          variant="secondary"
          disabled={!canPrev}
          onClick={() => onChange(Math.max(1, page - 1))}
          type="button"
        >
          ← {moderationCopy.list.pagination.previous}
        </Button>
        <Button
          size="small"
          variant="secondary"
          disabled={!canNext}
          onClick={() => onChange(page + 1)}
          type="button"
        >
          {moderationCopy.list.pagination.next} →
        </Button>
      </div>
    </div>
  )
}
