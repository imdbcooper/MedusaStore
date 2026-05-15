'use client'

import { useTransition, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button, toast } from '@payloadcms/ui'
import {
  approveReviewAction,
  clearReviewReplyAction,
  deleteReviewAction,
  rejectReviewAction,
  setReviewReplyAction,
} from './actions.ts'
import { moderationCopy } from './copy.ts'

const REPLY_MAX_LENGTH = 1000

type ReplySnapshot = {
  text: string | null
  by: string | null
  at: string | null
}

type Props = {
  reviewId: string
  status: 'pending' | 'approved' | 'rejected'
  /** Where to navigate after a successful delete. */
  backHref: string
  /**
   * Phase 3 / step 4 — current state of the merchant reply on the row.
   * Driven by the server component (`Page.tsx`) so the initial render
   * reflects the persisted data without needing a client-side fetch.
   * After save/clear we still call `router.refresh()` so the server
   * component re-resolves and feeds the next snapshot back in.
   */
  reply?: ReplySnapshot
}

const RU_DATE_FORMATTER = new Intl.DateTimeFormat('ru-RU', {
  dateStyle: 'long',
  timeStyle: 'short',
})

function formatReplyDate(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return RU_DATE_FORMATTER.format(date)
}

/**
 * Detail-view action panel: approve / reject (with inline form) / delete
 * (with confirm dialog). Plan §5.1 spells out the exact UX requirements.
 *
 * The reject form is rendered inline (not in a modal) so it never shifts
 * focus out of the document flow; the textarea has the `required`
 * attribute and a max-length cap of 500 chars per plan §4.3.
 */
export function ModerationDetailActions({
  reviewId,
  status,
  backHref,
  reply,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [showReplyForm, setShowReplyForm] = useState(false)
  const [replyText, setReplyText] = useState(() => reply?.text ?? '')
  const [busy, setBusy] = useState<
    | null
    | 'approve'
    | 'reject'
    | 'delete'
    | 'reply-save'
    | 'reply-remove'
  >(null)

  const hasReply = Boolean(reply?.text)

  const handleApprove = useCallback(() => {
    setBusy('approve')
    startTransition(async () => {
      const result = await approveReviewAction(reviewId)
      setBusy(null)
      if (result.ok) {
        toast.success(moderationCopy.detail.success.approved)
        router.refresh()
      } else {
        toast.error(mapErrorToCopy(result.error))
      }
    })
  }, [reviewId, router])

  const handleRejectSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const trimmed = rejectReason.trim()
      if (!trimmed) {
        toast.error(moderationCopy.detail.rejectForm.validationRequired)
        return
      }
      if (trimmed.length > 500) {
        toast.error(moderationCopy.detail.rejectForm.validationLength)
        return
      }
      setBusy('reject')
      startTransition(async () => {
        const result = await rejectReviewAction(reviewId, trimmed)
        setBusy(null)
        if (result.ok) {
          toast.success(moderationCopy.detail.success.rejected)
          setShowRejectForm(false)
          setRejectReason('')
          router.refresh()
        } else {
          toast.error(mapErrorToCopy(result.error))
        }
      })
    },
    [reviewId, rejectReason, router],
  )

  const handleDelete = useCallback(() => {
    if (typeof window === 'undefined') return
    const confirmed = window.confirm(
      `${moderationCopy.detail.deleteConfirm.heading}\n\n${moderationCopy.detail.deleteConfirm.body}`,
    )
    if (!confirmed) return
    setBusy('delete')
    startTransition(async () => {
      const result = await deleteReviewAction(reviewId)
      setBusy(null)
      if (result.ok) {
        toast.success(moderationCopy.detail.success.deleted)
        router.push(backHref)
      } else {
        toast.error(mapErrorToCopy(result.error))
      }
    })
  }, [reviewId, router, backHref])

  const handleReplySubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
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
      setBusy('reply-save')
      startTransition(async () => {
        const result = await setReviewReplyAction(reviewId, trimmed)
        setBusy(null)
        if (result.ok) {
          toast.success(moderationCopy.detail.success.replySaved)
          setShowReplyForm(false)
          router.refresh()
        } else {
          toast.error(mapErrorToCopy(result.error))
        }
      })
    },
    [replyText, reviewId, router],
  )

  const handleReplyRemove = useCallback(() => {
    if (typeof window === 'undefined') return
    const confirmed = window.confirm(
      moderationCopy.detail.reply.removeConfirm,
    )
    if (!confirmed) return
    setBusy('reply-remove')
    startTransition(async () => {
      const result = await clearReviewReplyAction(reviewId)
      setBusy(null)
      if (result.ok) {
        toast.success(moderationCopy.detail.success.replyRemoved)
        setShowReplyForm(false)
        setReplyText('')
        router.refresh()
      } else {
        toast.error(mapErrorToCopy(result.error))
      }
    })
  }, [reviewId, router])

  const openReplyEditor = useCallback(() => {
    setReplyText(reply?.text ?? '')
    setShowReplyForm(true)
  }, [reply?.text])

  const closeReplyEditor = useCallback(() => {
    setReplyText(reply?.text ?? '')
    setShowReplyForm(false)
  }, [reply?.text])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--base, 16px)',
      }}
    >
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {status !== 'approved' ? (
          <Button
            buttonStyle="primary"
            size="medium"
            onClick={handleApprove}
            disabled={isPending}
          >
            {busy === 'approve' ? '…' : moderationCopy.detail.actions.approve}
          </Button>
        ) : null}

        {status !== 'rejected' ? (
          <Button
            buttonStyle="secondary"
            size="medium"
            onClick={() => setShowRejectForm((prev) => !prev)}
            disabled={isPending}
          >
            {moderationCopy.detail.actions.reject}
          </Button>
        ) : null}

        <Button
          buttonStyle="error"
          size="medium"
          onClick={handleDelete}
          disabled={isPending}
        >
          {busy === 'delete' ? '…' : moderationCopy.detail.actions.delete}
        </Button>
      </div>

      {showRejectForm ? (
        <form
          onSubmit={handleRejectSubmit}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            padding: 'var(--base, 16px)',
            border: '1px solid var(--theme-elevation-150)',
            borderRadius: 'var(--style-radius-s, 4px)',
            background: 'var(--theme-elevation-50)',
          }}
        >
          <label
            htmlFor="reject-reason"
            style={{ fontWeight: 600, fontSize: '0.875rem' }}
          >
            {moderationCopy.detail.rejectForm.heading}
          </label>
          <textarea
            id="reject-reason"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder={moderationCopy.detail.rejectForm.placeholder}
            maxLength={500}
            required
            rows={4}
            style={{
              padding: '8px',
              borderRadius: 'var(--style-radius-s, 4px)',
              border: '1px solid var(--theme-elevation-150)',
              background: 'var(--theme-input-bg, var(--theme-elevation-50))',
              color: 'var(--theme-elevation-1000)',
              fontFamily: 'inherit',
              fontSize: '0.875rem',
              resize: 'vertical',
            }}
          />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.75rem',
              color: 'var(--theme-elevation-500)',
            }}
          >
            <span>{moderationCopy.detail.rejectForm.hint}</span>
            <span>{rejectReason.length} / 500</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button type="submit" buttonStyle="primary" size="small" disabled={isPending}>
              {busy === 'reject' ? '…' : moderationCopy.detail.rejectForm.submit}
            </Button>
            <Button
              type="button"
              buttonStyle="secondary"
              size="small"
              onClick={() => {
                setShowRejectForm(false)
                setRejectReason('')
              }}
              disabled={isPending}
            >
              {moderationCopy.detail.rejectForm.cancel}
            </Button>
          </div>
        </form>
      ) : null}

      {/* ----------------------------------------------------------------
          Phase 3 / step 4 — «Ответ магазина» section.
          ---------------------------------------------------------------- */}
      <section
        aria-labelledby="merchant-reply-heading"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          padding: 'var(--base, 16px)',
          border: '1px solid var(--theme-elevation-150)',
          borderRadius: 'var(--style-radius-s, 4px)',
          background: 'var(--theme-elevation-0)',
        }}
      >
        <h3
          id="merchant-reply-heading"
          style={{ margin: 0, fontSize: '0.95rem' }}
        >
          {moderationCopy.detail.reply.title}
        </h3>

        {hasReply && !showReplyForm ? (
          <ReplyDisplay
            text={reply!.text!}
            by={reply?.by ?? null}
            at={reply?.at ?? null}
          />
        ) : null}

        {!hasReply && !showReplyForm ? (
          <p
            style={{
              margin: 0,
              fontSize: '0.85rem',
              color: 'var(--theme-elevation-500)',
            }}
          >
            {moderationCopy.detail.reply.empty}
          </p>
        ) : null}

        {showReplyForm ? (
          <form
            onSubmit={handleReplySubmit}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <textarea
              id="merchant-reply-text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={moderationCopy.detail.reply.placeholder}
              maxLength={REPLY_MAX_LENGTH}
              required
              rows={4}
              style={{
                padding: '8px',
                borderRadius: 'var(--style-radius-s, 4px)',
                border: '1px solid var(--theme-elevation-150)',
                background: 'var(--theme-input-bg, var(--theme-elevation-50))',
                color: 'var(--theme-elevation-1000)',
                fontFamily: 'inherit',
                fontSize: '0.875rem',
                resize: 'vertical',
              }}
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '0.75rem',
                color: 'var(--theme-elevation-500)',
              }}
            >
              <span>{moderationCopy.detail.reply.hint}</span>
              <span>
                {moderationCopy.detail.reply.charCounter
                  .replace('{current}', String(replyText.length))
                  .replace('{max}', String(REPLY_MAX_LENGTH))}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <Button
                type="submit"
                buttonStyle="primary"
                size="small"
                disabled={isPending}
              >
                {busy === 'reply-save'
                  ? '…'
                  : moderationCopy.detail.reply.submit}
              </Button>
              <Button
                type="button"
                buttonStyle="secondary"
                size="small"
                onClick={closeReplyEditor}
                disabled={isPending}
              >
                {moderationCopy.detail.reply.cancel}
              </Button>
            </div>
          </form>
        ) : (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Button
              type="button"
              buttonStyle="secondary"
              size="small"
              onClick={openReplyEditor}
              disabled={isPending}
            >
              {hasReply
                ? moderationCopy.detail.reply.editCta
                : moderationCopy.detail.reply.addCta}
            </Button>
            {hasReply ? (
              <Button
                type="button"
                buttonStyle="error"
                size="small"
                onClick={handleReplyRemove}
                disabled={isPending}
              >
                {busy === 'reply-remove'
                  ? '…'
                  : moderationCopy.detail.reply.removeCta}
              </Button>
            ) : null}
          </div>
        )}
      </section>
    </div>
  )
}

function ReplyDisplay({
  text,
  by,
  at,
}: {
  text: string
  by: string | null
  at: string | null
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <p
        style={{
          margin: 0,
          fontSize: '0.875rem',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {text}
      </p>
      <div
        style={{
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
          fontSize: '0.7rem',
          color: 'var(--theme-elevation-500)',
        }}
      >
        {at ? (
          <span>
            {moderationCopy.detail.reply.datePrefix} {formatReplyDate(at)}
          </span>
        ) : null}
        {by ? (
          <span>
            {moderationCopy.detail.reply.authorPrefix}{' '}
            <code
              style={{
                fontFamily:
                  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
                fontSize: '0.7rem',
                background: 'var(--theme-elevation-50)',
                padding: '1px 4px',
                borderRadius: 'var(--style-radius-s, 4px)',
              }}
            >
              {by}
            </code>
          </span>
        ) : null}
      </div>
    </div>
  )
}

function mapErrorToCopy(error: string): string {
  switch (error) {
    case 'config_missing':
      return moderationCopy.detail.error.configMissing
    case 'transport_error':
      return moderationCopy.detail.error.transport
    case 'unauthorized':
      return moderationCopy.detail.error.unauthorized
    case 'not_found':
      return moderationCopy.detail.error.notFound
    case 'reason_required':
      return moderationCopy.detail.rejectForm.validationRequired
    case 'reason_too_long':
      return moderationCopy.detail.rejectForm.validationLength
    case 'reply_required':
    case 'reply_text_required':
      return moderationCopy.detail.reply.errors.required
    case 'reply_too_long':
    case 'reply_text_too_long':
      return moderationCopy.detail.reply.errors.tooLong
    default:
      return moderationCopy.detail.error.generic
  }
}
