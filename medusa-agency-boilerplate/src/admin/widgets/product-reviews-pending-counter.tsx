/**
 * Phase 4 / step 5 — pending-reviews counter widget for the Medusa
 * Admin Extensions surface.
 *
 * Mounted on `product.list.before` because Medusa 2.13.6 ships **no**
 * `dashboard.*` injection-zone — see the full catalogue of supported
 * zones in
 * [`@medusajs/admin-shared`](medusa-agency-boilerplate/node_modules/@medusajs/admin-shared/dist/index.d.ts:63)
 * (`INJECTION_ZONES`). Commerce operators land in `/app/products` at
 * the top of every shift, so surfacing the moderation backlog there
 * keeps it discoverable without forcing them to first navigate to the
 * dedicated `/app/product-reviews` queue.
 *
 * Data layer:
 *   - `useQuery({ queryKey: productReviewQueryKeys.pendingCount(), … })`
 *     calls
 *     [`listReviewsAdmin`](medusa-agency-boilerplate/src/admin/routes/product-reviews/lib/api.ts:1)
 *     with `pageSize: 1` so we read just `total` from the wire response —
 *     the items array is intentionally discarded.
 *   - `staleTime: 30s` keeps the network footprint minimal; the queue
 *     mutation handlers in
 *     [`page.tsx`](medusa-agency-boilerplate/src/admin/routes/product-reviews/page.tsx:1)
 *     and
 *     [`[id]/page.tsx`](medusa-agency-boilerplate/src/admin/routes/product-reviews/[id]/page.tsx:1)
 *     already invalidate `productReviewQueryKeys.all` after every
 *     approve / reject / delete, which automatically refetches this
 *     counter regardless of the stale window.
 *   - Errors raised from `queryFn` are the discriminated-union failure
 *     payloads from `listReviewsAdmin` — `widgetErrorCopy` extracts
 *     the `.error` code and maps it to the dedicated
 *     `dashboardWidget.errors.*` namespace introduced in
 *     [`copy.ts`](medusa-agency-boilerplate/src/admin/routes/product-reviews/lib/copy.ts:1).
 *
 * Plan §10.2: every dynamic value is rendered via React's normal text
 * interpolation, never `dangerouslySetInnerHTML`. The single template
 * literal that carries `{count}` is split with `String.indexOf` and
 * the substituted segment is rendered into a JSX child — no raw HTML.
 */

import { defineWidgetConfig } from '@medusajs/admin-sdk'
import { ArrowRightOnRectangle, ChatBubbleLeftRight } from '@medusajs/icons'
import {
  Badge,
  Button,
  Container,
  Heading,
  Skeleton,
  Text,
} from '@medusajs/ui'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import {
  listReviewsAdmin,
  type AdminReviewListResult,
} from '../routes/product-reviews/lib/api'
import { moderationCopy } from '../routes/product-reviews/lib/copy'
import { productReviewQueryKeys } from '../routes/product-reviews/lib/query-keys'

export const config = defineWidgetConfig({
  zone: 'product.list.before',
})

/**
 * Mirrors `mapErrorToMessage` shape but routes through the widget's
 * own copy block (`dashboardWidget.errors.*`) — the moderation queue
 * already owns the broader `detail.error.*` namespace and we want
 * widget-specific phrasing for these three failure modes.
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

const PENDING_QUEUE_HREF = '/product-reviews?status=pending'
const ALL_REVIEWS_HREF = '/product-reviews'

/**
 * Render the «{count} ждут модерации» line by splitting the copy
 * template around its `{count}` placeholder. This keeps the literal
 * text in
 * [`copy.ts`](medusa-agency-boilerplate/src/admin/routes/product-reviews/lib/copy.ts:1)
 * fully translator-friendly (one string, position-flexible) while still
 * letting the count itself carry the `text-4xl font-bold` emphasis the
 * card design calls for.
 */
const CountSubtitle = ({ total }: { total: number }) => {
  const template = moderationCopy.dashboardWidget.countSubtitle
  const placeholder = '{count}'
  const idx = template.indexOf(placeholder)

  if (idx < 0) {
    return (
      <Text size="small" className="text-ui-fg-subtle">
        {template}
      </Text>
    )
  }

  const before = template.slice(0, idx)
  const after = template.slice(idx + placeholder.length)

  return (
    <div className="flex items-baseline gap-x-2">
      {before ? (
        <Text size="small" className="text-ui-fg-subtle">
          {before}
        </Text>
      ) : null}
      <span className="text-ui-fg-base txt-compact-xlarge text-4xl font-bold leading-none">
        {total}
      </span>
      {after ? (
        <Text size="small" className="text-ui-fg-subtle">
          {after}
        </Text>
      ) : null}
    </div>
  )
}

const ProductReviewsPendingCounter = () => {
  const query = useQuery<AdminReviewListResult>({
    queryKey: productReviewQueryKeys.pendingCount(),
    queryFn: async ({ signal }) => {
      const result = await listReviewsAdmin(
        { status: 'pending', page: 1, pageSize: 1 },
        signal,
      )
      if (!result.ok) {
        // Surface the discriminated-union failure so the query lands
        // in `isError` with a typed payload — `widgetErrorCopy` digs
        // out `.error` to pick the right copy bucket.
        throw result
      }
      return result.data
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })

  const total = query.data?.total ?? 0
  const showCounterBadge = !query.isLoading && !query.isError && total > 0

  return (
    <Container className="mb-2 flex flex-col gap-y-3 p-6">
      <div className="flex items-start justify-between gap-x-4">
        <div className="flex items-center gap-x-3">
          <ChatBubbleLeftRight className="text-ui-fg-subtle" />
          <Heading level="h3">{moderationCopy.dashboardWidget.title}</Heading>
          {showCounterBadge ? (
            <Badge color="orange" size="2xsmall">
              {String(total)}
            </Badge>
          ) : null}
        </div>

        {query.isLoading || query.isError ? null : total > 0 ? (
          <Link to={PENDING_QUEUE_HREF}>
            <Button variant="secondary" size="small">
              {moderationCopy.dashboardWidget.action}
              <ArrowRightOnRectangle />
            </Button>
          </Link>
        ) : (
          <Link to={ALL_REVIEWS_HREF}>
            <Button variant="transparent" size="small">
              {moderationCopy.dashboardWidget.actionAll}
            </Button>
          </Link>
        )}
      </div>

      {query.isLoading ? (
        <Skeleton className="h-10 w-2/3" />
      ) : query.isError ? (
        <Text size="small" className="text-ui-fg-error">
          {widgetErrorCopy(query.error)}
        </Text>
      ) : total > 0 ? (
        <CountSubtitle total={total} />
      ) : (
        <Text size="small" className="text-ui-fg-subtle">
          {moderationCopy.dashboardWidget.empty}
        </Text>
      )}
    </Container>
  )
}

export default ProductReviewsPendingCounter
