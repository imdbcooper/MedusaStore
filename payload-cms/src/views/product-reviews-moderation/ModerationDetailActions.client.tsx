'use client'

import { useTransition, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button, toast } from '@payloadcms/ui'
import {
  approveReviewAction,
  deleteReviewAction,
  rejectReviewAction,
} from './actions.ts'
import { moderationCopy } from './copy.ts'

type Props = {
  reviewId: string
  status: 'pending' | 'approved' | 'rejected'
  /** Where to navigate after a successful delete. */
  backHref: string
}

/**
 * Detail-view action panel: approve / reject (with inline form) / delete
 * (with confirm dialog). Plan §5.1 spells out the exact UX requirements.
 *
 * The reject form is rendered inline (not in a modal) so it never shifts
 * focus out of the document flow; the textarea has the `required`
 * attribute and a max-length cap of 500 chars per plan §4.3.
 */
export function ModerationDetailActions({ reviewId, status, backHref }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [busy, setBusy] = useState<null | 'approve' | 'reject' | 'delete'>(null)

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
    default:
      return moderationCopy.detail.error.generic
  }
}
