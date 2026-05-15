'use client'

import { useTransition, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button, toast } from '@payloadcms/ui'
import { approveReviewAction, rejectReviewAction } from './actions.ts'
import { moderationCopy } from './copy.ts'

/**
 * Inline row actions: approve / reject (quick reject with prompt for the
 * reason). The detail view has the richer reject form with textarea and
 * validation; this component is for fast pending-queue triage.
 */

type Props = {
  reviewId: string
  status: 'pending' | 'approved' | 'rejected'
}

export function ModerationRowActions({ reviewId, status }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [busy, setBusy] = useState<null | 'approve' | 'reject'>(null)

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

  const handleReject = useCallback(() => {
    if (typeof window === 'undefined') return
    const reason = window.prompt(
      moderationCopy.detail.rejectForm.heading +
        '\n\n' +
        moderationCopy.detail.rejectForm.hint +
        '\n(до 500 символов)',
      '',
    )
    if (reason === null) return
    const trimmed = reason.trim()
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
        router.refresh()
      } else {
        toast.error(mapErrorToCopy(result.error))
      }
    })
  }, [reviewId, router])

  // Plan §5.1: quick approve/reject only make sense for pending rows.
  // Approved/rejected rows surface the detailed view button instead.
  const showQuick = status === 'pending'

  return (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
      {showQuick ? (
        <>
          <Button
            buttonStyle="primary"
            size="small"
            onClick={handleApprove}
            disabled={isPending}
            aria-label={moderationCopy.list.actions.approve}
          >
            {busy === 'approve' ? '…' : moderationCopy.list.actions.approve}
          </Button>
          <Button
            buttonStyle="secondary"
            size="small"
            onClick={handleReject}
            disabled={isPending}
            aria-label={moderationCopy.list.actions.reject}
          >
            {busy === 'reject' ? '…' : moderationCopy.list.actions.reject}
          </Button>
        </>
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
