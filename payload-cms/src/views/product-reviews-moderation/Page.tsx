import type { AdminViewServerProps } from 'payload'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import {
  getProductReviewAdmin,
  listProductReviewsAdmin,
} from '../../lib/product-reviews-admin-client.ts'
import { ModerationFilters } from './ModerationFilters.client.tsx'
import { ModerationRowActions } from './ModerationRowActions.client.tsx'
import { ModerationDetailActions } from './ModerationDetailActions.client.tsx'
import { StarRating, StatusPill, VerifiedBadge } from './primitives.tsx'
import { moderationCopy } from './copy.ts'
import {
  PAGE_SIZE,
  customerDisplayName,
  formatDate,
  truncateText,
  type AllStatusOption,
} from './helpers.ts'
import type {
  ProductReviewAdminItem,
  ProductReviewStatus,
} from '../../lib/product-reviews-admin-client.ts'

/**
 * Payload custom admin view: «Модерация отзывов» (plan §5.1).
 *
 * One entry component that dispatches between list and detail by reading
 * `params.segments`. We register two `AdminViewConfig` entries pointing
 * at the same Component (see `payload.config.ts`):
 *   - `/product-reviews/moderation`        → list
 *   - `/product-reviews/moderation/:id`    → detail
 *
 * Server-rendered: this is the layer that has access to
 * `MEDUSA_ADMIN_SECRET_API_KEY`, so all Medusa Admin API calls happen
 * here, not in the client. Action islands (approve / reject / delete)
 * proxy through `'use server'` actions in
 * [`actions.ts`](payload-cms/src/views/product-reviews-moderation/actions.ts:1).
 *
 * Plan §10.2: every dynamic value is rendered as text (React escapes
 * everything by default). No `dangerouslySetInnerHTML` is used.
 */

const VIEW_PATH = '/product-reviews/moderation'

export default async function ProductReviewsModerationView(
  props: AdminViewServerProps,
) {
  const { i18n, locale, params, payload, permissions, searchParams, user, visibleEntities } =
    props

  const segments = Array.isArray(params?.segments) ? params!.segments : []
  // `params.segments` includes the full path after `/admin`, e.g.
  // `['product-reviews', 'moderation']` for the list and
  // `['product-reviews', 'moderation', 'rev_…']` for the detail.
  const reviewId = segments.length >= 3 ? String(segments[2]).trim() : ''

  // Plan: Payload's DefaultTemplate provides the sidebar nav, app header,
  // and theming. All custom views in Payload 3 are expected to render
  // inside it; otherwise the page lacks navigation and feels broken.
  const templateProps = {
    i18n,
    locale,
    params,
    payload,
    permissions,
    searchParams,
    user,
    visibleEntities: visibleEntities!,
  }

  return (
    <DefaultTemplate {...templateProps}>
      <Gutter>
        {reviewId
          ? await renderDetail({ adminBase: getAdminBase(payload), reviewId })
          : await renderList({
              adminBase: getAdminBase(payload),
              searchParams: searchParams ?? {},
            })}
      </Gutter>
    </DefaultTemplate>
  )
}

function getAdminBase(payload: AdminViewServerProps['payload']): string {
  // Payload's admin base path defaults to `/admin` but can be overridden
  // via `routes.admin`. Prefix our own view path with it so router pushes
  // hit the right URL regardless of project config.
  const adminRoute = payload?.config?.routes?.admin || '/admin'
  return `${adminRoute}${VIEW_PATH}`
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

type ListSearchParams = AdminViewServerProps['searchParams']

async function renderList({
  adminBase,
  searchParams,
}: {
  adminBase: string
  searchParams: NonNullable<ListSearchParams>
}) {
  const filters = parseListFilters(searchParams)
  // Date inputs (`<input type="date">`) yield `YYYY-MM-DD`. Constructing a
  // `Date` from `YYYY-MM-DDTHH:mm:ss` (no `Z`) lets the browser/server
  // interpret the boundary as the local timezone of the moderator, then
  // `.toISOString()` converts it to UTC for the backend. This honours the
  // moderator's TZ instead of forcing UTC midnight.
  const result = await listProductReviewsAdmin({
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
  })

  return (
    <div>
      <header style={headerStyle}>
        <h1 style={{ margin: 0, fontSize: '1.5rem' }}>
          {moderationCopy.list.heading}
        </h1>
        <p style={{ margin: 0, color: 'var(--theme-elevation-500)' }}>
          {moderationCopy.list.subheading}
        </p>
      </header>

      <ModerationFilters
        action={adminBase}
        initial={{
          status: filters.status,
          rating: filters.rating,
          productId: filters.productId,
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
        }}
      />

      {/*
        TODO(Phase 2 next): добавить loading.tsx или skeleton-overlay
        над списком/таблицей (см. ревью M1) — сейчас server-render блокирует
        до резолва Medusa-запроса, без visual feedback.
      */}
      {result.ok
        ? renderListContent({
            adminBase,
            data: result.data,
            ratingFilter: filters.rating,
            page: filters.page,
            queryString: buildQueryString(filters),
          })
        : renderErrorBanner(result.error)}
    </div>
  )
}

function renderListContent({
  adminBase,
  data,
  ratingFilter,
  page,
  queryString,
}: {
  adminBase: string
  data: { items: ProductReviewAdminItem[]; total: number; page: number; pageSize: number }
  ratingFilter: '' | '1' | '2' | '3' | '4' | '5'
  page: number
  queryString: string
}) {
  // TODO(Phase 2 next): rating-фильтр сейчас клиентский на текущей странице.
  // Когда backend получит rating-filter (см. ревью M3 + рекомендация 1
  // плана), убрать этот блок и пробрасывать rating в backend через
  // `listProductReviewsAdmin`. Сейчас `total` и `Pagination` отражают
  // только серверные фильтры (status / productId / dateFrom / dateTo), а
  // строки-результаты — дополнительно фильтруются здесь, что даёт честное,
  // но локальное по странице поведение.
  const filtered = ratingFilter
    ? data.items.filter((item) => String(item.rating) === ratingFilter)
    : data.items

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize))

  return (
    <>
      {ratingFilter ? <RatingClientFilterNotice /> : null}
      {filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <Table items={filtered} adminBase={adminBase} />
      )}
      <Pagination
        adminBase={adminBase}
        page={page}
        totalPages={totalPages}
        total={data.total}
        baseQuery={queryString}
      />
    </>
  )
}

function RatingClientFilterNotice() {
  return (
    <div
      style={{
        padding: '8px 12px',
        marginBottom: 'var(--base, 16px)',
        background: 'var(--theme-warning-150)',
        color: 'var(--theme-warning-750)',
        border: '1px solid var(--theme-warning-150)',
        borderRadius: 'var(--style-radius-s, 4px)',
        fontSize: '0.8rem',
      }}
      role="status"
    >
      {moderationCopy.list.notes.ratingClientFilter}
    </div>
  )
}

function Table({
  items,
  adminBase,
}: {
  items: ProductReviewAdminItem[]
  adminBase: string
}) {
  return (
    <div style={{ overflowX: 'auto', marginBottom: 'var(--base, 16px)' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '0.875rem',
          background: 'var(--theme-elevation-0)',
          border: '1px solid var(--theme-elevation-100)',
          borderRadius: 'var(--style-radius-s, 4px)',
        }}
      >
        <thead>
          <tr style={{ background: 'var(--theme-elevation-50)' }}>
            <th style={thStyle}>{moderationCopy.list.columns.product}</th>
            <th style={thStyle}>{moderationCopy.list.columns.customer}</th>
            <th style={thStyle}>{moderationCopy.list.columns.rating}</th>
            <th style={thStyle}>{moderationCopy.list.columns.text}</th>
            <th style={thStyle}>{moderationCopy.list.columns.status}</th>
            <th style={thStyle}>{moderationCopy.list.columns.createdAt}</th>
            <th style={thStyle}>{moderationCopy.list.columns.actions}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} style={{ borderTop: '1px solid var(--theme-elevation-100)' }}>
              <td style={tdStyle}>
                <code style={codeStyle}>{item.product_id}</code>
              </td>
              <td style={tdStyle}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span>{customerDisplayName(item)}</span>
                  {item.customer_id ? (
                    <code style={{ ...codeStyle, fontSize: '0.7rem', color: 'var(--theme-elevation-500)' }}>
                      {item.customer_id}
                    </code>
                  ) : null}
                </div>
              </td>
              <td style={tdStyle}>
                <StarRating rating={item.rating} />
              </td>
              <td style={{ ...tdStyle, maxWidth: '320px' }}>
                {item.title ? <strong>{item.title} · </strong> : null}
                {truncateText(item.text)}
              </td>
              <td style={tdStyle}>
                <StatusPill status={item.status} />
              </td>
              <td style={tdStyle}>{formatDate(item.created_at)}</td>
              <td style={tdStyle}>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <a
                    href={`${adminBase}/${encodeURIComponent(item.id)}`}
                    style={linkButtonStyle}
                  >
                    {moderationCopy.list.actions.open}
                  </a>
                  <ModerationRowActions reviewId={item.id} status={item.status} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Pagination({
  adminBase,
  page,
  totalPages,
  total,
  baseQuery,
}: {
  adminBase: string
  page: number
  totalPages: number
  total: number
  baseQuery: string
}) {
  const buildHref = (target: number) => {
    const params = new URLSearchParams(baseQuery)
    // `page=1` is the implicit default; omit it to keep the URL clean
    // (matches Payload's own list-view URL convention).
    if (target > 1) {
      params.set('page', String(target))
    } else {
      params.delete('page')
    }
    const qs = params.toString()
    return qs ? `${adminBase}?${qs}` : adminBase
  }

  const prev = Math.max(1, page - 1)
  const next = Math.min(totalPages, page + 1)
  const canPrev = page > 1
  const canNext = page < totalPages

  return (
    <div
      style={{
        display: 'flex',
        gap: '12px',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ color: 'var(--theme-elevation-500)', fontSize: '0.875rem' }}>
        {moderationCopy.list.pagination.total(total)} ·{' '}
        {moderationCopy.list.pagination.pageOf(page, totalPages)}
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <a
          href={canPrev ? buildHref(prev) : undefined}
          style={{
            ...linkButtonStyle,
            opacity: canPrev ? 1 : 0.5,
            pointerEvents: canPrev ? 'auto' : 'none',
          }}
          aria-disabled={!canPrev}
        >
          ← {moderationCopy.list.pagination.previous}
        </a>
        <a
          href={canNext ? buildHref(next) : undefined}
          style={{
            ...linkButtonStyle,
            opacity: canNext ? 1 : 0.5,
            pointerEvents: canNext ? 'auto' : 'none',
          }}
          aria-disabled={!canNext}
        >
          {moderationCopy.list.pagination.next} →
        </a>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div
      style={{
        padding: '48px 16px',
        textAlign: 'center',
        color: 'var(--theme-elevation-500)',
        background: 'var(--theme-elevation-50)',
        border: '1px dashed var(--theme-elevation-150)',
        borderRadius: 'var(--style-radius-s, 4px)',
      }}
    >
      {moderationCopy.list.empty}
    </div>
  )
}

function renderErrorBanner(errorCode: string) {
  const message =
    errorCode === 'config_missing'
      ? moderationCopy.list.error.configMissing
      : errorCode === 'transport_error'
        ? moderationCopy.list.error.transport
        : errorCode === 'unauthorized'
          ? moderationCopy.list.error.unauthorized
          : moderationCopy.list.error.generic

  return (
    <div
      style={{
        padding: '16px',
        background: 'var(--theme-error-150)',
        color: 'var(--theme-error-750)',
        borderRadius: 'var(--style-radius-s, 4px)',
        marginBottom: 'var(--base, 16px)',
      }}
      role="alert"
    >
      {message}
    </div>
  )
}

function parseListFilters(searchParams: NonNullable<ListSearchParams>): {
  status: AllStatusOption
  rating: '' | '1' | '2' | '3' | '4' | '5'
  productId: string
  dateFrom: string
  dateTo: string
  page: number
} {
  const get = (key: string) => {
    const v = searchParams[key]
    if (Array.isArray(v)) return typeof v[0] === 'string' ? v[0] : ''
    return typeof v === 'string' ? v : ''
  }

  const statusRaw = get('status').trim().toLowerCase()
  const status: AllStatusOption = ['pending', 'approved', 'rejected', 'all'].includes(statusRaw)
    ? (statusRaw as AllStatusOption)
    : 'pending'

  const ratingRaw = get('rating').trim()
  const rating: '' | '1' | '2' | '3' | '4' | '5' = ['1', '2', '3', '4', '5'].includes(ratingRaw)
    ? (ratingRaw as '1' | '2' | '3' | '4' | '5')
    : ''

  const pageRaw = parseInt(get('page'), 10)
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1

  return {
    status,
    rating,
    productId: get('productId').trim(),
    dateFrom: get('dateFrom').trim(),
    dateTo: get('dateTo').trim(),
    page,
  }
}

function buildQueryString(filters: {
  status: AllStatusOption
  rating: '' | '1' | '2' | '3' | '4' | '5'
  productId: string
  dateFrom: string
  dateTo: string
}): string {
  const params = new URLSearchParams()
  if (filters.status && filters.status !== 'pending') params.set('status', filters.status)
  if (filters.rating) params.set('rating', filters.rating)
  if (filters.productId) params.set('productId', filters.productId)
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
  if (filters.dateTo) params.set('dateTo', filters.dateTo)
  return params.toString()
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

async function renderDetail({
  adminBase,
  reviewId,
}: {
  adminBase: string
  reviewId: string
}) {
  const result = await getProductReviewAdmin(reviewId)

  if (!result.ok) {
    if (result.status === 404 || result.error === 'not_found') {
      return <DetailNotFound adminBase={adminBase} />
    }
    return (
      <div>
        <BackLink adminBase={adminBase} />
        {renderErrorBanner(result.error)}
      </div>
    )
  }

  const review = result.data.review

  return (
    <div>
      <BackLink adminBase={adminBase} />
      <header style={{ ...headerStyle, marginBottom: 'var(--base, 16px)' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem' }}>
          {moderationCopy.detail.heading}
        </h1>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <StatusPill status={review.status} />
          {review.verified_purchase ? <VerifiedBadge /> : null}
          <StarRating rating={review.rating} />
        </div>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
          gap: 'var(--base, 16px)',
        }}
      >
        <ReviewBody review={review} />
        <ReviewSidebar adminBase={adminBase} review={review} />
      </div>
    </div>
  )
}

function DetailNotFound({ adminBase }: { adminBase: string }) {
  return (
    <div>
      <BackLink adminBase={adminBase} />
      <div
        style={{
          padding: '32px',
          textAlign: 'center',
          background: 'var(--theme-elevation-50)',
          borderRadius: 'var(--style-radius-s, 4px)',
        }}
      >
        <h2 style={{ marginTop: 0 }}>{moderationCopy.detail.notFoundView.heading}</h2>
        <p style={{ color: 'var(--theme-elevation-500)' }}>
          {moderationCopy.detail.notFoundView.body}
        </p>
      </div>
    </div>
  )
}

function BackLink({ adminBase }: { adminBase: string }) {
  return (
    <a
      href={adminBase}
      style={{
        ...linkButtonStyle,
        marginBottom: 'var(--base, 16px)',
        display: 'inline-flex',
      }}
    >
      ← {moderationCopy.detail.backToList}
    </a>
  )
}

function ReviewBody({ review }: { review: ProductReviewAdminItem }) {
  return (
    <article
      style={{
        background: 'var(--theme-elevation-0)',
        border: '1px solid var(--theme-elevation-100)',
        borderRadius: 'var(--style-radius-s, 4px)',
        padding: 'var(--base, 16px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--base, 16px)',
      }}
    >
      <h2 style={{ margin: 0 }}>{moderationCopy.detail.sections.review}</h2>

      {review.title ? (
        <Field label={moderationCopy.detail.fields.title}>
          <strong>{review.title}</strong>
        </Field>
      ) : null}

      <Field label={moderationCopy.detail.fields.text}>
        <p style={paragraphStyle}>{review.text}</p>
      </Field>

      {review.pros ? (
        <Field label={moderationCopy.detail.fields.pros}>
          <p style={paragraphStyle}>{review.pros}</p>
        </Field>
      ) : null}

      {review.cons ? (
        <Field label={moderationCopy.detail.fields.cons}>
          <p style={paragraphStyle}>{review.cons}</p>
        </Field>
      ) : null}

      {review.status === 'rejected' && review.rejection_reason ? (
        <Field label={moderationCopy.detail.fields.rejectionReason}>
          <p
            style={{
              ...paragraphStyle,
              background: 'var(--theme-error-150)',
              color: 'var(--theme-error-750)',
              padding: '8px 12px',
              borderRadius: 'var(--style-radius-s, 4px)',
            }}
          >
            {review.rejection_reason}
          </p>
        </Field>
      ) : null}
    </article>
  )
}

function ReviewSidebar({
  adminBase,
  review,
}: {
  adminBase: string
  review: ProductReviewAdminItem
}) {
  return (
    <aside
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--base, 16px)',
      }}
    >
      <div
        style={{
          background: 'var(--theme-elevation-0)',
          border: '1px solid var(--theme-elevation-100)',
          borderRadius: 'var(--style-radius-s, 4px)',
          padding: 'var(--base, 16px)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <h2 style={{ margin: 0 }}>{moderationCopy.detail.sections.meta}</h2>
        <Field label={moderationCopy.detail.fields.product}>
          <code style={codeStyle}>{review.product_id}</code>
        </Field>
        <Field label={moderationCopy.detail.fields.status}>
          <StatusPill status={review.status} />
        </Field>
        <Field label={moderationCopy.detail.fields.rating}>
          <StarRating rating={review.rating} />
        </Field>
        <Field label={moderationCopy.detail.fields.createdAt}>
          {formatDate(review.created_at)}
        </Field>
        {review.moderated_by ? (
          <Field label={moderationCopy.detail.fields.moderatedBy}>
            <code style={codeStyle}>{review.moderated_by}</code>
          </Field>
        ) : null}
        {review.moderated_at ? (
          <Field label={moderationCopy.detail.fields.moderatedAt}>
            {formatDate(review.moderated_at)}
          </Field>
        ) : null}
        <Field label={moderationCopy.detail.fields.verifiedPurchase}>
          {review.verified_purchase ? moderationCopy.detail.fields.yes : moderationCopy.detail.fields.no}
        </Field>
        {review.order_id ? (
          <Field label={moderationCopy.detail.fields.orderId}>
            <code style={codeStyle}>{review.order_id}</code>
          </Field>
        ) : null}
      </div>

      <div
        style={{
          background: 'var(--theme-elevation-0)',
          border: '1px solid var(--theme-elevation-100)',
          borderRadius: 'var(--style-radius-s, 4px)',
          padding: 'var(--base, 16px)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <h2 style={{ margin: 0 }}>{moderationCopy.detail.sections.customer}</h2>
        <Field label={moderationCopy.detail.fields.customerName}>
          {customerDisplayName(review)}
        </Field>
        {review.customer_id ? (
          <Field label={moderationCopy.detail.fields.customerId}>
            <code style={codeStyle}>{review.customer_id}</code>
          </Field>
        ) : (
          <Field label={moderationCopy.detail.fields.customerId}>
            {moderationCopy.detail.fields.anonymous}
          </Field>
        )}
        {/*
          TODO(Phase 2 next): customer email — backend gap.
          Требует расширения `ProductReviewRow` LEFT JOIN на `customer.email`
          (см. ревью M5 и план §5.1). После доработки backend сюда добавится
          `<Field label={...customerEmail}>{review.customer_email}</Field>`.
        */}
      </div>

      <ModerationDetailActions
        reviewId={review.id}
        status={review.status as ProductReviewStatus}
        backHref={adminBase}
      />
    </aside>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      <span
        style={{
          fontSize: '0.7rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--theme-elevation-500)',
        }}
      >
        {label}
      </span>
      <div style={{ fontSize: '0.875rem' }}>{children}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Inline styles (kept here so the view ships as a single self-contained
// module — Payload custom views typically don't bundle their own SCSS).
// ---------------------------------------------------------------------------

const headerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  marginBottom: 'calc(var(--base, 16px) * 1.5)',
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '12px 16px',
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--theme-elevation-500)',
  fontWeight: 600,
  borderBottom: '1px solid var(--theme-elevation-100)',
}

const tdStyle: React.CSSProperties = {
  padding: '12px 16px',
  verticalAlign: 'top',
}

const codeStyle: React.CSSProperties = {
  fontFamily:
    'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
  fontSize: '0.75rem',
  background: 'var(--theme-elevation-50)',
  padding: '2px 6px',
  borderRadius: 'var(--style-radius-s, 4px)',
  wordBreak: 'break-all',
}

const linkButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '4px 10px',
  borderRadius: 'var(--style-radius-s, 4px)',
  border: '1px solid var(--theme-elevation-150)',
  background: 'var(--theme-elevation-50)',
  color: 'var(--theme-elevation-1000)',
  textDecoration: 'none',
  fontSize: '0.75rem',
}

const paragraphStyle: React.CSSProperties = {
  margin: 0,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
}
