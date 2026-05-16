/**
 * Phase 4 / step 4 — Medusa Admin moderation detail route.
 *
 * Replaces the detail-mode branch of the Payload-side
 * [`Page.tsx`](payload-cms/src/views/product-reviews-moderation/Page.tsx:1)
 * + [`ModerationDetailActions.client.tsx`](payload-cms/src/views/product-reviews-moderation/ModerationDetailActions.client.tsx:1).
 * Mounted by Medusa Admin Extensions at `/app/product-reviews/:id` thanks
 * to the `[id]` segment convention. **No** `defineRouteConfig` export here —
 * a detail page is a child route and must not appear in the sidebar.
 *
 * Layout (plan §6 step 4):
 *   - 2-column grid: `<ReviewBody>` (left) + `<ReviewSidebar>` +
 *     `<ReviewDetailActions>` (right). On mobile both columns collapse
 *     to a single stack.
 *   - Header has a «Back to list» link plus the review headline; status,
 *     verified-purchase badge and rating live next to it.
 *
 * Data layer:
 *   - `useQuery({ queryKey: productReviewQueryKeys.detail(id) })` calls
 *     [`getReviewAdmin`](medusa-agency-boilerplate/src/admin/routes/product-reviews/lib/api.ts:1).
 *   - All mutations (`approve`, `reject`, `delete`, `setReply`, `clearReply`)
 *     `invalidateQueries({ queryKey: productReviewQueryKeys.all })` so the
 *     list view, the detail itself, and the future pending-counter widget
 *     all refetch in lockstep.
 *
 * UX choices vs spec:
 *   - **Reject form**: rendered inline (collapsible section), not in a
 *     `FocusModal`. Two reasons: (1) one-to-one parity with the Payload
 *     baseline keeps muscle memory; (2) inline form keeps the textarea
 *     in the document flow which means the moderator can still see the
 *     review text while writing the reason. Cost: a tiny bit more vertical
 *     scroll on small screens — acceptable for an admin tool.
 *   - **Delete confirm**: `usePrompt` from `@medusajs/ui` (boolean prompt).
 *     The body string is composed from
 *     `moderationCopy.detail.deleteConfirm.body` + the
 *     `bodyWithImages` warning when `images.length > 0`.
 *   - **Reply CRUD**: single section that toggles between display-mode
 *     and edit-mode, identical to the Payload version.
 *
 * Plan §10.2: every dynamic value is rendered through React's text
 * interpolation; no `dangerouslySetInnerHTML`.
 */

import {
  ArrowUturnLeft,
  CheckCircle,
  PencilSquare,
  Trash,
  XCircle,
} from '@medusajs/icons'
import {
  Badge,
  Button,
  Container,
  Heading,
  Skeleton,
  StatusBadge,
  Text,
  Textarea,
  Toaster,
  toast,
  usePrompt,
} from '@medusajs/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import {
  approveReviewAdmin,
  clearReviewReplyAdmin,
  deleteReviewAdmin,
  getReviewAdmin,
  rejectReviewAdmin,
  setReviewReplyAdmin,
  type AdminReviewListItem,
  type AdminReviewStatus,
  type AdminReviewsApiResult,
} from '../lib/api'
import { moderationCopy } from '../lib/copy'
import { mapErrorToMessage } from '../lib/error-mapping'
import {
  customerDisplayName,
  formatDate,
  formatStarRating,
  normalizeAdminReviewImageUrls,
} from '../lib/helpers'
import { productReviewQueryKeys } from '../lib/query-keys'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REJECT_MAX_LENGTH = 500
const REPLY_MAX_LENGTH = 1000

const STATUS_BADGE_COLOR: Record<AdminReviewStatus, 'orange' | 'green' | 'red'> = {
  pending: 'orange',
  approved: 'green',
  rejected: 'red',
}

const LIST_HREF = '/product-reviews'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Pull a stable error code out of a thrown `AdminReviewsApiResult` failure
 * (we re-throw `result` from the mutation/query closures so React Query
 * lands in the error branch with the discriminated-union payload). Falls
 * back to `transport_error` for unknown shapes — `mapErrorToMessage`
 * collapses both into the same generic copy.
 */
function errorCodeOf(err: unknown): string {
  if (err && typeof err === 'object' && 'error' in err) {
    return String((err as { error: unknown }).error)
  }
  return 'transport_error'
}

/**
 * The detail query helper unwraps the discriminated union into the bare
 * `AdminReviewListItem`. Failure cases are re-thrown so React Query sets
 * `isError` and the page-level `<DetailErrorState>` can branch on the
 * code (`not_found`, `unauthorized`, …).
 */
async function fetchReview(
  id: string,
  signal?: AbortSignal,
): Promise<AdminReviewListItem> {
  const result = await getReviewAdmin(id, signal)
  if (!result.ok) {
    throw result
  }
  return result.data.review
}

// ---------------------------------------------------------------------------
// Page entry
// ---------------------------------------------------------------------------

const ProductReviewDetailPage = () => {
  const { id } = useParams<{ id: string }>()
  const reviewId = id ?? ''

  const queryClient = useQueryClient()

  const detailQuery = useQuery({
    queryKey: productReviewQueryKeys.detail(reviewId),
    queryFn: ({ signal }) => fetchReview(reviewId, signal),
    enabled: reviewId.length > 0,
    staleTime: 5_000,
    refetchOnWindowFocus: false,
  })

  const review = detailQuery.data ?? null

  return (
    <Container className="divide-y p-0">
      <Toaster />

      <Header review={review} />

      <div className="px-6 py-4">
        {!reviewId ? (
          <DetailNotFound />
        ) : detailQuery.isLoading ? (
          <DetailSkeleton />
        ) : detailQuery.isError ? (
          <DetailErrorState
            error={detailQuery.error}
            onRetry={() => detailQuery.refetch()}
          />
        ) : review ? (
          <DetailGrid
            review={review}
            queryClient={queryClient}
          />
        ) : (
          <DetailNotFound />
        )}
      </div>
    </Container>
  )
}

export default ProductReviewDetailPage

// ---------------------------------------------------------------------------
// Header / breadcrumb
// ---------------------------------------------------------------------------

type HeaderProps = {
  review: AdminReviewListItem | null
}

const Header = ({ review }: HeaderProps) => {
  return (
    <div className="flex flex-col gap-3 px-6 py-4">
      <BackLink />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Heading level="h1">
            {review?.title?.trim()
              ? review.title
              : moderationCopy.detail.heading}
          </Heading>
          {review?.id ? (
            <Text size="small" className="text-ui-fg-muted font-mono">
              {review.id}
            </Text>
          ) : null}
        </div>
        {review ? (
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge color={STATUS_BADGE_COLOR[review.status]}>
              {moderationCopy.status[review.status]}
            </StatusBadge>
            {review.verified_purchase ? (
              <Badge color="green" size="small">
                ✓ {moderationCopy.detail.fields.verifiedPurchase}
              </Badge>
            ) : null}
            <span
              aria-label={moderationCopy.rating.starsAria(review.rating)}
              className="text-ui-tag-orange-icon"
            >
              {formatStarRating(review.rating)}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  )
}

const BackLink = () => {
  return (
    <Link
      to={LIST_HREF}
      className="text-ui-fg-subtle hover:text-ui-fg-base inline-flex items-center gap-1 text-sm"
    >
      <ArrowUturnLeft />
      <span>{moderationCopy.detail.backToList}</span>
    </Link>
  )
}

// ---------------------------------------------------------------------------
// Loading / not-found / error
// ---------------------------------------------------------------------------

const DetailSkeleton = () => {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="mt-4 h-32 w-full" />
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="mt-2 h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  )
}

const DetailNotFound = () => {
  return (
    <div className="border-ui-border-base text-ui-fg-subtle flex flex-col items-center justify-center gap-3 rounded-md border border-dashed px-6 py-16 text-center">
      <Heading level="h2">{moderationCopy.detail.notFoundView.heading}</Heading>
      <Text className="text-ui-fg-muted">
        {moderationCopy.detail.notFoundView.body}
      </Text>
      <Link to={LIST_HREF}>
        <Button size="small" variant="secondary">
          ← {moderationCopy.detail.backToList}
        </Button>
      </Link>
    </div>
  )
}

type DetailErrorStateProps = {
  error: unknown
  onRetry: () => void
}

const DetailErrorState = ({ error, onRetry }: DetailErrorStateProps) => {
  const code = errorCodeOf(error)
  const status =
    error && typeof error === 'object' && 'status' in error
      ? Number((error as { status: unknown }).status)
      : 0

  // 404 / not_found → render full-page «not found», skipping the red banner.
  if (code === 'not_found' || status === 404) {
    return <DetailNotFound />
  }

  const message = mapErrorToMessage(code, status)
  const isUnauthorized = code === 'unauthorized'

  return (
    <div
      role="alert"
      className="bg-ui-tag-red-bg text-ui-tag-red-text flex flex-col gap-3 rounded-md px-4 py-3"
    >
      <Text className="text-ui-tag-red-text">{message}</Text>
      <div className="flex gap-2">
        {!isUnauthorized ? (
          <Button size="small" variant="secondary" onClick={onRetry}>
            {moderationCopy.list.error.retry}
          </Button>
        ) : null}
        <Link to={LIST_HREF}>
          <Button size="small" variant="secondary">
            ← {moderationCopy.detail.backToList}
          </Button>
        </Link>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Detail grid (body + sidebar)
// ---------------------------------------------------------------------------

type DetailGridProps = {
  review: AdminReviewListItem
  queryClient: ReturnType<typeof useQueryClient>
}

const DetailGrid = ({ review, queryClient: _queryClient }: DetailGridProps) => {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <ReviewBody review={review} />
      <div className="flex flex-col gap-4">
        <ReviewSidebar review={review} />
        <ReviewDetailActions review={review} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ReviewBody — text fields + photo grid + read-only reply preview
// ---------------------------------------------------------------------------

type ReviewBodyProps = {
  review: AdminReviewListItem
}

const ReviewBody = ({ review }: ReviewBodyProps) => {
  const imageUrls = normalizeAdminReviewImageUrls(review.images)

  return (
    <article className="border-ui-border-base bg-ui-bg-base flex flex-col gap-4 rounded-lg border p-5">
      <Heading level="h2">{moderationCopy.detail.sections.review}</Heading>

      {review.title ? (
        <Field label={moderationCopy.detail.fields.title}>
          <strong>{review.title}</strong>
        </Field>
      ) : null}

      <Field label={moderationCopy.detail.fields.text}>
        <p className="whitespace-pre-line break-words text-sm">{review.text}</p>
      </Field>

      {review.pros ? (
        <Field label={moderationCopy.detail.fields.pros}>
          <p className="whitespace-pre-line break-words text-sm">
            {review.pros}
          </p>
        </Field>
      ) : null}

      {review.cons ? (
        <Field label={moderationCopy.detail.fields.cons}>
          <p className="whitespace-pre-line break-words text-sm">
            {review.cons}
          </p>
        </Field>
      ) : null}

      {review.status === 'rejected' && review.rejection_reason ? (
        <Field label={moderationCopy.detail.fields.rejectionReason}>
          <p className="bg-ui-tag-red-bg text-ui-tag-red-text whitespace-pre-line break-words rounded-md px-3 py-2 text-sm">
            {review.rejection_reason}
          </p>
        </Field>
      ) : null}

      {imageUrls.length > 0 ? (
        <section
          className="flex flex-col gap-2"
          data-testid="moderation-detail-images"
        >
          <Heading level="h3">
            {moderationCopy.detail.sections.images}
          </Heading>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {imageUrls.map((url, index) => (
              <a
                // eslint-disable-next-line react/no-array-index-key
                key={`${review.id}-image-${index}`}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={moderationCopy.detail.fields.imageOpenLabel}
                className="border-ui-border-base bg-ui-bg-subtle block aspect-square overflow-hidden rounded-md border"
              >
                <img
                  src={url}
                  alt={moderationCopy.detail.fields.imageAltLabel.replace(
                    '{index}',
                    String(index + 1),
                  )}
                  loading="lazy"
                  className="block h-full w-full object-cover"
                />
              </a>
            ))}
          </div>
        </section>
      ) : null}

      {review.merchant_reply_text ? (
        <ReplyPreview review={review} />
      ) : null}
    </article>
  )
}

const ReplyPreview = ({ review }: { review: AdminReviewListItem }) => {
  return (
    <section
      aria-labelledby="merchant-reply-preview"
      className="border-ui-border-base bg-ui-bg-subtle flex flex-col gap-2 rounded-md border p-3"
    >
      <Heading level="h3" id="merchant-reply-preview">
        {moderationCopy.detail.reply.title}
      </Heading>
      <p className="whitespace-pre-line break-words text-sm">
        {review.merchant_reply_text}
      </p>
      <div className="text-ui-fg-muted flex flex-wrap gap-3 text-xs">
        {review.merchant_reply_at ? (
          <span>
            {moderationCopy.detail.reply.datePrefix}{' '}
            {formatDate(review.merchant_reply_at)}
          </span>
        ) : null}
        {review.merchant_reply_by ? (
          <span>
            {moderationCopy.detail.reply.authorPrefix}{' '}
            <code className="bg-ui-bg-base rounded px-1 py-0.5 font-mono text-[0.7rem]">
              {review.merchant_reply_by}
            </code>
          </span>
        ) : null}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// ReviewSidebar — meta fields
// ---------------------------------------------------------------------------

type ReviewSidebarProps = {
  review: AdminReviewListItem
}

const ReviewSidebar = ({ review }: ReviewSidebarProps) => {
  return (
    <aside className="border-ui-border-base bg-ui-bg-base flex flex-col gap-4 rounded-lg border p-5">
      <section className="flex flex-col gap-3">
        <Heading level="h2">{moderationCopy.detail.sections.meta}</Heading>
        <Field label={moderationCopy.detail.fields.product}>
          <code className="bg-ui-bg-subtle break-all rounded px-1.5 py-0.5 font-mono text-xs">
            {review.product_id}
          </code>
        </Field>
        <Field label={moderationCopy.detail.fields.status}>
          <StatusBadge color={STATUS_BADGE_COLOR[review.status]}>
            {moderationCopy.status[review.status]}
          </StatusBadge>
        </Field>
        <Field label={moderationCopy.detail.fields.rating}>
          <span
            aria-label={moderationCopy.rating.starsAria(review.rating)}
            className="text-ui-tag-orange-icon"
          >
            {formatStarRating(review.rating)}
          </span>
        </Field>
        <Field label={moderationCopy.detail.fields.createdAt}>
          {formatDate(review.created_at)}
        </Field>
        <Field label={moderationCopy.detail.fields.moderatedBy}>
          {review.moderated_by ? (
            <code className="bg-ui-bg-subtle break-all rounded px-1.5 py-0.5 font-mono text-xs">
              {review.moderated_by}
            </code>
          ) : (
            moderationCopy.detail.fields.none
          )}
        </Field>
        <Field label={moderationCopy.detail.fields.moderatedAt}>
          {formatDate(review.moderated_at)}
        </Field>
        <Field label={moderationCopy.detail.fields.verifiedPurchase}>
          {review.verified_purchase
            ? moderationCopy.detail.fields.yes
            : moderationCopy.detail.fields.no}
        </Field>
        <Field label={moderationCopy.detail.fields.orderId}>
          {review.order_id ? (
            <code className="bg-ui-bg-subtle break-all rounded px-1.5 py-0.5 font-mono text-xs">
              {review.order_id}
            </code>
          ) : (
            moderationCopy.detail.fields.none
          )}
        </Field>
      </section>

      <section className="border-ui-border-base flex flex-col gap-3 border-t pt-4">
        <Heading level="h2">
          {moderationCopy.detail.sections.customer}
        </Heading>
        <Field label={moderationCopy.detail.fields.customerName}>
          {customerDisplayName(review)}
        </Field>
        <Field label={moderationCopy.detail.fields.customerId}>
          {review.customer_id ? (
            <code className="bg-ui-bg-subtle break-all rounded px-1.5 py-0.5 font-mono text-xs">
              {review.customer_id}
            </code>
          ) : (
            moderationCopy.detail.fields.anonymous
          )}
        </Field>
      </section>
    </aside>
  )
}

const Field = ({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) => {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-ui-fg-muted text-[0.7rem] uppercase tracking-wider">
        {label}
      </span>
      <div className="text-sm">{children}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ReviewDetailActions — approve / reject / delete / reply CRUD
// ---------------------------------------------------------------------------

type ReviewDetailActionsProps = {
  review: AdminReviewListItem
}

const ReviewDetailActions = ({ review }: ReviewDetailActionsProps) => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const prompt = usePrompt()

  const [showRejectForm, setShowRejectForm] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const [showReplyForm, setShowReplyForm] = useState(false)
  const [replyText, setReplyText] = useState(review.merchant_reply_text ?? '')

  // Re-sync local state when the underlying review (from the server) changes —
  // e.g. after a successful save the query cache delivers the new
  // `merchant_reply_text` and we want the editor to reflect it without
  // forcing a parent remount.
  useEffect(() => {
    setReplyText(review.merchant_reply_text ?? '')
  }, [review.merchant_reply_text])

  const invalidateAll = () =>
    queryClient.invalidateQueries({ queryKey: productReviewQueryKeys.all })

  const approveMutation = useMutation({
    mutationFn: async () => {
      const result = await approveReviewAdmin(review.id)
      if (!result.ok) throw result
      return result.data
    },
    onSuccess: () => {
      toast.success(moderationCopy.detail.success.approved)
      invalidateAll()
    },
    onError: (err) => toast.error(mapErrorToMessage(errorCodeOf(err))),
  })

  const rejectMutation = useMutation({
    mutationFn: async (reason: string) => {
      const result = await rejectReviewAdmin(review.id, reason)
      if (!result.ok) throw result
      return result.data
    },
    onSuccess: () => {
      toast.success(moderationCopy.detail.success.rejected)
      setShowRejectForm(false)
      setRejectReason('')
      invalidateAll()
    },
    onError: (err) => toast.error(mapErrorToMessage(errorCodeOf(err))),
  })

  const deleteMutation = useMutation({
    mutationFn: async (): Promise<AdminReviewsApiResult<undefined>> => {
      const result = await deleteReviewAdmin(review.id)
      if (!result.ok) throw result
      return result
    },
    onSuccess: () => {
      toast.success(moderationCopy.detail.success.deleted)
      invalidateAll()
      navigate(LIST_HREF)
    },
    onError: (err) => toast.error(mapErrorToMessage(errorCodeOf(err))),
  })

  const replySaveMutation = useMutation({
    mutationFn: async (text: string) => {
      const result = await setReviewReplyAdmin(review.id, text)
      if (!result.ok) throw result
      return result.data
    },
    onSuccess: () => {
      toast.success(moderationCopy.detail.success.replySaved)
      setShowReplyForm(false)
      invalidateAll()
    },
    onError: (err) => toast.error(mapErrorToMessage(errorCodeOf(err))),
  })

  const replyClearMutation = useMutation({
    mutationFn: async () => {
      const result = await clearReviewReplyAdmin(review.id)
      if (!result.ok) throw result
      return result.data
    },
    onSuccess: () => {
      toast.success(moderationCopy.detail.success.replyRemoved)
      setShowReplyForm(false)
      setReplyText('')
      invalidateAll()
    },
    onError: (err) => toast.error(mapErrorToMessage(errorCodeOf(err))),
  })

  const isMutating =
    approveMutation.isPending ||
    rejectMutation.isPending ||
    deleteMutation.isPending ||
    replySaveMutation.isPending ||
    replyClearMutation.isPending

  const hasReply = Boolean(review.merchant_reply_text?.trim())
  const hasImages = normalizeAdminReviewImageUrls(review.images).length > 0

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleApprove = () => approveMutation.mutate()

  const handleRejectSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = rejectReason.trim()
    if (!trimmed) {
      toast.error(moderationCopy.detail.reject.reasonRequired)
      return
    }
    if (trimmed.length > REJECT_MAX_LENGTH) {
      toast.error(moderationCopy.detail.reject.reasonTooLong)
      return
    }
    rejectMutation.mutate(trimmed)
  }

  const handleDelete = async () => {
    const description = hasImages
      ? `${moderationCopy.detail.deleteConfirm.body}\n\n${moderationCopy.detail.deleteConfirm.bodyWithImages}`
      : moderationCopy.detail.deleteConfirm.body
    const confirmed = await prompt({
      title: moderationCopy.detail.deleteConfirm.heading,
      description,
      confirmText: moderationCopy.detail.deleteConfirm.confirm,
      cancelText: moderationCopy.detail.deleteConfirm.cancel,
      variant: 'danger',
    })
    if (!confirmed) return
    deleteMutation.mutate()
  }

  const handleReplySubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = replyText.trim()
    if (!trimmed) {
      toast.error(moderationCopy.detail.reply.errors.required)
      return
    }
    if (trimmed.length > REPLY_MAX_LENGTH) {
      toast.error(moderationCopy.detail.reply.errors.tooLong)
      return
    }
    replySaveMutation.mutate(trimmed)
  }

  const handleReplyRemove = async () => {
    const confirmed = await prompt({
      title: moderationCopy.detail.reply.title,
      description: moderationCopy.detail.reply.removeConfirm,
      confirmText: moderationCopy.detail.reply.removeCta,
      cancelText: moderationCopy.detail.reply.cancel,
      variant: 'danger',
    })
    if (!confirmed) return
    replyClearMutation.mutate()
  }

  const openReplyEditor = () => {
    setReplyText(review.merchant_reply_text ?? '')
    setShowReplyForm(true)
  }

  const closeReplyEditor = () => {
    setReplyText(review.merchant_reply_text ?? '')
    setShowReplyForm(false)
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <aside className="border-ui-border-base bg-ui-bg-base flex flex-col gap-4 rounded-lg border p-5">
      <Heading level="h2">{moderationCopy.detail.heading}</Heading>

      <div className="flex flex-wrap gap-2">
        {review.status !== 'approved' ? (
          <Button
            variant="primary"
            size="small"
            onClick={handleApprove}
            disabled={isMutating}
            isLoading={approveMutation.isPending}
            type="button"
          >
            <CheckCircle />
            <span>{moderationCopy.detail.actions.approve}</span>
          </Button>
        ) : null}

        {review.status !== 'rejected' ? (
          <Button
            variant="secondary"
            size="small"
            onClick={() => setShowRejectForm((prev) => !prev)}
            disabled={isMutating}
            type="button"
          >
            <XCircle />
            <span>{moderationCopy.detail.actions.reject}</span>
          </Button>
        ) : null}

        <Button
          variant="danger"
          size="small"
          onClick={handleDelete}
          disabled={isMutating}
          isLoading={deleteMutation.isPending}
          type="button"
        >
          <Trash />
          <span>{moderationCopy.detail.actions.delete}</span>
        </Button>
      </div>

      {showRejectForm ? (
        <form
          onSubmit={handleRejectSubmit}
          className="border-ui-border-base bg-ui-bg-subtle flex flex-col gap-2 rounded-md border p-3"
        >
          <label
            htmlFor="reject-reason"
            className="text-ui-fg-base text-sm font-semibold"
          >
            {moderationCopy.detail.reject.heading}
          </label>
          <Textarea
            id="reject-reason"
            value={rejectReason}
            onChange={(event) => setRejectReason(event.currentTarget.value)}
            placeholder={moderationCopy.detail.reject.placeholder}
            maxLength={REJECT_MAX_LENGTH}
            rows={4}
            required
          />
          <div className="text-ui-fg-muted flex items-center justify-between text-xs">
            <span>{moderationCopy.detail.reject.hint}</span>
            <span>
              {rejectReason.length} / {REJECT_MAX_LENGTH}
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              type="submit"
              variant="primary"
              size="small"
              disabled={isMutating}
              isLoading={rejectMutation.isPending}
            >
              {moderationCopy.detail.reject.submit}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="small"
              onClick={() => {
                setShowRejectForm(false)
                setRejectReason('')
              }}
              disabled={isMutating}
            >
              {moderationCopy.detail.reject.cancel}
            </Button>
          </div>
        </form>
      ) : null}

      {/* ---------------------------------------------------------------- *
        Reply CRUD section — display / edit-mode toggle, identical to the
        Payload baseline (one section that flips between view and editor).
       * ---------------------------------------------------------------- */}
      <section
        aria-labelledby="merchant-reply-actions"
        className="border-ui-border-base flex flex-col gap-2 border-t pt-4"
      >
        <Heading level="h3" id="merchant-reply-actions">
          {moderationCopy.detail.reply.title}
        </Heading>

        {hasReply && !showReplyForm ? (
          <ReplyDisplay
            text={review.merchant_reply_text ?? ''}
            by={review.merchant_reply_by}
            at={review.merchant_reply_at}
          />
        ) : null}

        {!hasReply && !showReplyForm ? (
          <Text size="small" className="text-ui-fg-muted">
            {moderationCopy.detail.reply.empty}
          </Text>
        ) : null}

        {showReplyForm ? (
          <form
            onSubmit={handleReplySubmit}
            className="flex flex-col gap-2"
          >
            <Textarea
              id="merchant-reply-text"
              value={replyText}
              onChange={(event) => setReplyText(event.currentTarget.value)}
              placeholder={moderationCopy.detail.reply.placeholder}
              maxLength={REPLY_MAX_LENGTH}
              rows={4}
              required
            />
            <div className="text-ui-fg-muted flex items-center justify-between text-xs">
              <span>{moderationCopy.detail.reply.hint}</span>
              <span>
                {moderationCopy.detail.reply.charCounter
                  .replace('{current}', String(replyText.length))
                  .replace('{max}', String(REPLY_MAX_LENGTH))}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="submit"
                variant="primary"
                size="small"
                disabled={isMutating}
                isLoading={replySaveMutation.isPending}
              >
                {moderationCopy.detail.reply.submit}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="small"
                onClick={closeReplyEditor}
                disabled={isMutating}
              >
                {moderationCopy.detail.reply.cancel}
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="small"
              onClick={openReplyEditor}
              disabled={isMutating}
            >
              <PencilSquare />
              <span>
                {hasReply
                  ? moderationCopy.detail.reply.editCta
                  : moderationCopy.detail.reply.addCta}
              </span>
            </Button>
            {hasReply ? (
              <Button
                type="button"
                variant="danger"
                size="small"
                onClick={handleReplyRemove}
                disabled={isMutating}
                isLoading={replyClearMutation.isPending}
              >
                <Trash />
                <span>{moderationCopy.detail.reply.removeCta}</span>
              </Button>
            ) : null}
          </div>
        )}
      </section>
    </aside>
  )
}

const ReplyDisplay = ({
  text,
  by,
  at,
}: {
  text: string
  by: string | null
  at: string | null
}) => {
  return (
    <div className="border-ui-border-base bg-ui-bg-subtle flex flex-col gap-2 rounded-md border p-3">
      <p className="whitespace-pre-line break-words text-sm">{text}</p>
      <div className="text-ui-fg-muted flex flex-wrap gap-3 text-xs">
        {at ? (
          <span>
            {moderationCopy.detail.reply.datePrefix} {formatDate(at)}
          </span>
        ) : null}
        {by ? (
          <span>
            {moderationCopy.detail.reply.authorPrefix}{' '}
            <code className="bg-ui-bg-base rounded px-1 py-0.5 font-mono text-[0.7rem]">
              {by}
            </code>
          </span>
        ) : null}
      </div>
    </div>
  )
}
