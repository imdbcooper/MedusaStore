/**
 * Phase 4 / step 6 (optional) — product-detail side widget for the
 * Medusa Admin Extensions surface.
 *
 * Mounted on `product.details.side.after` (right column under the
 * product detail card). The zone is part of the official Medusa 2.13.6
 * `INJECTION_ZONES` catalogue — see
 * [`@medusajs/admin-shared`](medusa-agency-boilerplate/node_modules/@medusajs/admin-shared/dist/index.d.ts:63).
 * Surfacing the latest reviews next to the product the moderator is
 * already inspecting saves a context switch into the dedicated
 * [`/app/product-reviews`](medusa-agency-boilerplate/src/admin/routes/product-reviews/page.tsx:1)
 * queue when a quick glance is enough — they still have one-click
 * deep-links into the full moderation views via the action buttons.
 *
 * Data layer
 * ----------
 * One `useQuery` with `pageSize: 5`, **no status filter** — gives us:
 *   - `total` for the «Всего отзывов» counter (accurate, comes from
 *     the wire response top-level field, see `AdminReviewListResult`
 *     in [`lib/api.ts`](medusa-agency-boilerplate/src/admin/routes/product-reviews/lib/api.ts:1));
 *   - `items[0..5]` for the preview cards (mixed statuses);
 *   - an *approximate* pending count via
 *     `items.filter(i => i.status === 'pending').length`. The field is
 *     intentionally approximate — when a product has more than 5
 *     pending reviews the badge under-reports. The plan §6.6 explicitly
 *     accepts this trade-off for the optional widget; the authoritative
 *     pending count lives in
 *     [`product-reviews-pending-counter.tsx`](medusa-agency-boilerplate/src/admin/widgets/product-reviews-pending-counter.tsx:1)
 *     and the moderation queue itself.
 *
 * One query (vs three parallel queries with explicit pending/approved
 * filters) keeps the widget tight on render budget — products with
 * thousands of reviews would otherwise trigger three round-trips on
 * every detail-page load. The approximate pending count is the price.
 *
 * `staleTime: 30_000` mirrors the counter widget. Mutation handlers in
 * the moderation queue invalidate `productReviewQueryKeys.all`, which
 * matches this widget's key prefix and triggers an automatic refetch
 * regardless of the stale window — the badge stays consistent with
 * approve/reject actions.
 *
 * Plan §10.2: every dynamic value is rendered through React's normal
 * text interpolation; no `dangerouslySetInnerHTML` anywhere — review
 * text is fed to `truncateText` first, then rendered as a plain JSX
 * child, so React's automatic escaping is enforced.
 */

import { defineWidgetConfig } from '@medusajs/admin-sdk'
import { ChatBubbleLeftRight } from '@medusajs/icons'
import {
  Badge,
  Container,
  Heading,
  Skeleton,
  StatusBadge,
  Text,
} from '@medusajs/ui'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import {
  listReviewsAdmin,
  type AdminReviewListItem,
  type AdminReviewListResult,
  type AdminReviewStatus,
} from '../routes/product-reviews/lib/api'
import { moderationCopy } from '../routes/product-reviews/lib/copy'
import {
  customerDisplayName,
  formatStarRating,
  truncateText,
} from '../routes/product-reviews/lib/helpers'
import { productReviewQueryKeys } from '../routes/product-reviews/lib/query-keys'

export const config = defineWidgetConfig({
  zone: 'product.details.side.after',
})

/**
 * Mirrors `widgetErrorCopy` in
 * [`product-reviews-pending-counter.tsx`](medusa-agency-boilerplate/src/admin/widgets/product-reviews-pending-counter.tsx:70):
 * routes failure codes through the same `dashboardWidget.errors.*`
 * namespace because the error surface (unauthorized session, transport
 * failure, generic) is identical for both widgets.
 */
function widgetErrorCopy(error: unknown): string {
  const code =
    error && typeof error === 'object' && 'error' in error
      ? String((error as { error: unknown }).error)
      : 'transport_error'
  switch (code) {
    case 'unauthorized':
      return moderationCopy.dashboardWidget.errors.unauthorized
    case 'transport_error':
    case 'aborted':
      return moderationCopy.dashboardWidget.errors.transport
    default:
      return moderationCopy.dashboardWidget.errors.generic
  }
}

/**
 * Same colour mapping as
 * [`page.tsx`](medusa-agency-boilerplate/src/admin/routes/product-reviews/page.tsx:193)
 * and
 * [`[id]/page.tsx`](medusa-agency-boilerplate/src/admin/routes/product-reviews/[id]/page.tsx:96).
 * Duplicated here intentionally — the constant is small enough that
 * adding a shared module would cost more than copy-paste, and keeping
 * widget independence aids tree-shaking when this optional widget is
 * removed.
 */
const STATUS_BADGE_COLOR: Record<
  AdminReviewStatus,
  'orange' | 'green' | 'red'
> = {
  pending: 'orange',
  approved: 'green',
  rejected: 'red',
}

const PREVIEW_PAGE_SIZE = 5
const PREVIEW_TEXT_LIMIT = 80

type ProductDetailWidgetProps = {
  /**
   * Medusa passes the full `AdminProduct` shape here, but this widget
   * only needs the id to scope reviews — the narrow inline type avoids
   * importing `HttpTypes` and pulling unrelated fields into the
   * extension's tree-shaking surface.
   */
  data: { id: string }
}

const PreviewCard = ({ item }: { item: AdminReviewListItem }) => (
  <Link
    to={`/product-reviews/${encodeURIComponent(item.id)}`}
    className="block focus:outline-none"
  >
    <Container className="hover:bg-ui-bg-base-hover flex flex-col gap-y-1 p-3">
      <div className="flex items-center justify-between gap-x-2">
        <Text size="small" weight="plus" className="truncate">
          {customerDisplayName(item)}
        </Text>
        <StatusBadge color={STATUS_BADGE_COLOR[item.status]}>
          {moderationCopy.status[item.status]}
        </StatusBadge>
      </div>
      <Text
        size="small"
        className="text-ui-fg-muted"
        aria-label={moderationCopy.rating.starsAria(item.rating)}
      >
        {formatStarRating(item.rating)}
      </Text>
      {item.text ? (
        <Text size="small" className="text-ui-fg-subtle line-clamp-2">
          {truncateText(item.text, PREVIEW_TEXT_LIMIT)}
        </Text>
      ) : null}
    </Container>
  </Link>
)

const ProductReviewsOnProductDetailWidget = ({
  data: product,
}: ProductDetailWidgetProps) => {
  const query = useQuery<AdminReviewListResult>({
    queryKey: productReviewQueryKeys.list({
      productId: product.id,
      pageSize: PREVIEW_PAGE_SIZE,
    }),
    queryFn: async ({ signal }) => {
      const result = await listReviewsAdmin(
        { productId: product.id, page: 1, pageSize: PREVIEW_PAGE_SIZE },
        signal,
      )
      if (!result.ok) {
        // Surface the discriminated-union failure so `widgetErrorCopy`
        // can pick the right copy bucket from the `.error` code.
        throw result
      }
      return result.data
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })

  const items = query.data?.items ?? []
  const total = query.data?.total ?? 0
  // Approximate — see header comment. When `total > PREVIEW_PAGE_SIZE`
  // and >5 of those are pending, this under-reports; the moderation
  // queue itself is the source of truth.
  const pendingApprox = items.filter((i) => i.status === 'pending').length

  const queueHref = `/product-reviews?status=pending&productId=${encodeURIComponent(
    product.id,
  )}`
  const allReviewsHref = `/product-reviews?productId=${encodeURIComponent(
    product.id,
  )}`

  return (
    <Container className="flex flex-col gap-y-4 p-6">
      <div className="flex items-center gap-x-3">
        <ChatBubbleLeftRight className="text-ui-fg-subtle" />
        <Heading level="h3">{moderationCopy.productDetailWidget.title}</Heading>
      </div>

      {query.isLoading ? (
        <div className="flex flex-col gap-y-2">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : query.isError ? (
        <Text size="small" className="text-ui-fg-error">
          {widgetErrorCopy(query.error)}
        </Text>
      ) : total === 0 ? (
        <Text size="small" className="text-ui-fg-subtle">
          {moderationCopy.productDetailWidget.empty}
        </Text>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Text size="small" className="text-ui-fg-subtle">
              {moderationCopy.productDetailWidget.total}
              {': '}
              <span className="text-ui-fg-base font-medium">{total}</span>
            </Text>
            {pendingApprox > 0 ? (
              <Badge color="orange" size="2xsmall">
                {moderationCopy.productDetailWidget.pending}
                {': '}
                {pendingApprox}
              </Badge>
            ) : null}
          </div>

          <div className="flex flex-col gap-y-2">
            {items.map((item) => (
              <PreviewCard key={item.id} item={item} />
            ))}
          </div>

          <div className="flex flex-col gap-y-2">
            {pendingApprox > 0 ? (
              <Link to={queueHref} className="block">
                <Text size="small" weight="plus" className="text-ui-fg-interactive">
                  {moderationCopy.productDetailWidget.actionQueue}
                </Text>
              </Link>
            ) : null}
            <Link to={allReviewsHref} className="block">
              <Text size="small" weight="plus" className="text-ui-fg-interactive">
                {moderationCopy.productDetailWidget.actionAll}
              </Text>
            </Link>
          </div>
        </>
      )}
    </Container>
  )
}

export default ProductReviewsOnProductDetailWidget
