'use client'

import { Button, toast, useDocumentInfo } from '@payloadcms/ui'
import { useRouter } from 'next/navigation.js'
import * as React from 'react'

/**
 * Launch button rendered as a Payload UI-field on the marketing-campaigns
 * edit view (see `plans/marketing-ui-payload-cms.md` §10).
 *
 * The button only appears for drafts that have never been launched. After a
 * successful launch the document refreshes and the button hides because
 * `status` becomes `completed`/`failed` and `medusaCampaignId` is populated.
 *
 * The actual sync→Medusa flow lives on the server in
 * `src/collections/MarketingCampaigns/launch-endpoint.ts`. This component
 * just calls it and reports the outcome to the operator.
 */

type LaunchResponse = {
  ok?: boolean
  status?: 'completed' | 'failed'
  totals?: {
    totalSelected?: number
    totalSent?: number
    totalSkipped?: number
    totalFailed?: number
  }
  error?: string
  message?: string
}

export const MarketingCampaignLaunchButton: React.FC = () => {
  const router = useRouter()
  const { id, savedDocumentData, data } = useDocumentInfo()
  const [pending, setPending] = React.useState(false)

  // One Idempotency-Key per mount. Reused across retries of the same
  // button so a double click + slow first request cannot create two
  // Medusa campaigns. Lazy-initialised so SSR does not run randomUUID.
  const idempotencyKeyRef = React.useRef<string | null>(null)
  if (idempotencyKeyRef.current === null && typeof crypto !== 'undefined') {
    idempotencyKeyRef.current =
      typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `mc-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
  }

  const docState = (data ?? savedDocumentData ?? {}) as {
    status?: string
    medusaCampaignId?: string | null
  }

  // IMPORTANT: all hooks (including useCallback) must run on every render to
  // satisfy the Rules of Hooks. Earlier versions short-circuited with `return
  // null` _before_ the useCallback, so once router.refresh() populated
  // medusaCampaignId React saw the hook count drop and threw the minified
  // production error #300/#310, crashing the whole admin view even though
  // the backend launch succeeded. Visibility is now controlled inside the
  // JSX return below.
  const handleClick = React.useCallback(async () => {
    if (!id || pending) return

    const confirmed = window.confirm(
      'Отправка кампании необратима — backend сразу разошлёт письма выбранной аудитории. Продолжить?',
    )
    if (!confirmed) return

    setPending(true)
    try {
      const headers: Record<string, string> = { Accept: 'application/json' }
      if (idempotencyKeyRef.current) {
        headers['Idempotency-Key'] = idempotencyKeyRef.current
      }

      const response = await fetch(
        `/api/marketing-campaigns/${encodeURIComponent(String(id))}/launch`,
        {
          method: 'POST',
          credentials: 'include',
          headers,
        },
      )

      let body: LaunchResponse | null = null
      try {
        body = (await response.json()) as LaunchResponse
      } catch {
        body = null
      }

      if (!response.ok || !body?.ok) {
        // Friendly toasts for the new Phase 1.1 error codes.
        if (response.status === 429) {
          const retryHeader = response.headers.get('Retry-After')
          const retrySec = retryHeader ? Number.parseInt(retryHeader, 10) : NaN
          const suffix = Number.isFinite(retrySec) && retrySec > 0
            ? ` Повторите через ${retrySec} сек.`
            : ''
          toast.error(`Слишком много запросов.${suffix}`)
          return
        }
        if (body?.error === 'campaign_in_progress') {
          toast.warning('Кампания уже отправляется, дождитесь завершения.')
          return
        }
        if (body?.error === 'idempotency_key_mismatch') {
          toast.error(
            'Кампания уже запускается с другим ключом. Обновите страницу.',
          )
          return
        }
        const message =
          body?.message ||
          body?.error ||
          `Запрос завершился со статусом ${response.status}`
        toast.error(`Не удалось запустить кампанию: ${message}`)
        return
      }

      const totals = body.totals
      const summary = totals
        ? `selected=${totals.totalSelected ?? 0}, sent=${totals.totalSent ?? 0}, skipped=${totals.totalSkipped ?? 0}, failed=${totals.totalFailed ?? 0}`
        : ''

      if (body.status === 'completed') {
        toast.success(
          summary
            ? `Кампания отправлена. ${summary}`
            : 'Кампания отправлена.',
        )
      } else {
        toast.warning(
          summary
            ? `Кампания завершилась со статусом ${body.status}. ${summary}`
            : `Кампания завершилась со статусом ${body.status}.`,
        )
      }

      router.refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown_error'
      toast.error(`Ошибка отправки: ${message}`)
    } finally {
      setPending(false)
    }
  }, [id, pending, router])

  // Visibility check is performed AFTER all hooks have run. This is the
  // crucial difference from the previous implementation.
  const shouldRender =
    Boolean(id) &&
    !docState.medusaCampaignId &&
    (!docState.status || docState.status === 'draft')

  if (!shouldRender) return null

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <Button
        buttonStyle="primary"
        size="medium"
        disabled={pending}
        onClick={handleClick}
      >
        {pending ? 'Отправка…' : 'Отправить кампанию'}
      </Button>
      <p
        style={{
          marginTop: '0.5rem',
          fontSize: '0.85rem',
          opacity: 0.7,
        }}
      >
        Backend синхронно создаст кампанию в Medusa и разошлёт письма.
        Действие необратимо.
      </p>
    </div>
  )
}

export default MarketingCampaignLaunchButton
