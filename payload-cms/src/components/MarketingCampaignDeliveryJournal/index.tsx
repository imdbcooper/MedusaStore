'use client'

import { Button, useDocumentInfo } from '@payloadcms/ui'
import * as React from 'react'
import styles from './styles.module.css'

/**
 * Read-only delivery journal for a launched marketing campaign.
 *
 * Rendered as a Payload UI-field on the marketing-campaigns edit view —
 * see `plans/marketing-ui-payload-cms.md` §10 and the `admin.condition`
 * on the field in `collections/MarketingCampaigns/index.ts` (only shown
 * once `medusaCampaignId` is set).
 *
 * Data source: Payload's own
 * `GET /api/marketing-campaigns/:id/journal`, which proxies to Medusa
 * (`/admin/marketing/campaigns/:medusaId`) and returns the `journal`
 * array as-is. We never call Medusa from the browser.
 *
 * Behaviour:
 *   - Fetch on mount and on manual refresh.
 *   - Sort entries `sent → skipped → failed`, then by `created_at desc`,
 *     so the operator sees successful sends first.
 *   - Soft pagination: render only the first `PAGE_SIZE` rows; user can
 *     click «Показать ещё». Real server-side pagination is Phase 4.
 */

type JournalEntry = {
  id?: string
  customer_id?: string | null
  channel?: string | null
  recipient?: string | null
  delivery_status?: 'sent' | 'skipped' | 'failed' | string | null
  decision_reason?: string | null
  notification_id?: string | null
  created_at?: string | null
}

type FetchState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; entries: JournalEntry[] }

const PAGE_SIZE = 50

const STATUS_RANK: Record<string, number> = {
  sent: 0,
  skipped: 1,
  failed: 2,
}

function rankEntry(entry: JournalEntry): number {
  const status = (entry.delivery_status ?? '').toString().trim()
  return STATUS_RANK[status] ?? 99
}

function formatDate(value?: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('ru-RU')
}

function statusLabel(status?: string | null): string {
  switch (status) {
    case 'sent':
      return 'Отправлено'
    case 'skipped':
      return 'Пропущено'
    case 'failed':
      return 'Ошибка'
    default:
      return status || '—'
  }
}

function statusClassName(status?: string | null): string {
  switch (status) {
    case 'sent':
      return `${styles.badge} ${styles.badgeSent}`
    case 'skipped':
      return `${styles.badge} ${styles.badgeSkipped}`
    case 'failed':
      return `${styles.badge} ${styles.badgeFailed}`
    default:
      return styles.badge
  }
}

export const MarketingCampaignDeliveryJournal: React.FC = () => {
  const { id, savedDocumentData, data } = useDocumentInfo()
  const [state, setState] = React.useState<FetchState>({ status: 'loading' })
  const [visible, setVisible] = React.useState(PAGE_SIZE)

  const docState = (data ?? savedDocumentData ?? {}) as {
    medusaCampaignId?: string | null
  }

  const load = React.useCallback(async () => {
    if (!id) return
    setState({ status: 'loading' })
    try {
      const response = await fetch(
        `/api/marketing-campaigns/${encodeURIComponent(String(id))}/journal`,
        {
          method: 'GET',
          credentials: 'include',
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        },
      )
      const body = (await response.json().catch(() => null)) as
        | { ok?: boolean; journal?: JournalEntry[]; error?: string; message?: string }
        | null

      if (!response.ok || !body?.ok) {
        const message =
          body?.message || body?.error || `HTTP ${response.status}`
        setState({ status: 'error', message })
        return
      }
      const entries = Array.isArray(body.journal) ? body.journal : []
      const sorted = entries.slice().sort((a, b) => {
        const byStatus = rankEntry(a) - rankEntry(b)
        if (byStatus !== 0) return byStatus
        const at = a.created_at ? Date.parse(a.created_at) : 0
        const bt = b.created_at ? Date.parse(b.created_at) : 0
        return bt - at
      })
      setState({ status: 'ready', entries: sorted })
      setVisible(PAGE_SIZE)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown_error'
      setState({ status: 'error', message })
    }
  }, [id])

  React.useEffect(() => {
    void load()
  }, [load])

  if (!id || !docState.medusaCampaignId) {
    // The collection-level `admin.condition` already hides this field when
    // there is no Medusa campaign. We keep the guard as a safety net.
    return null
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <h3 className={styles.title}>Журнал доставки</h3>
        <Button
          buttonStyle="secondary"
          size="small"
          onClick={() => {
            void load()
          }}
          disabled={state.status === 'loading'}
        >
          {state.status === 'loading' ? 'Загрузка…' : 'Обновить'}
        </Button>
      </div>

      {state.status === 'loading' ? (
        <p className={styles.muted}>Загружаем журнал из Medusa…</p>
      ) : null}

      {state.status === 'error' ? (
        <p className={styles.error}>
          Не удалось загрузить журнал: {state.message}
        </p>
      ) : null}

      {state.status === 'ready' && state.entries.length === 0 ? (
        <p className={styles.muted}>
          Журнал пуст. Возможно, кампания ещё в процессе или ни одно письмо
          не было обработано.
        </p>
      ) : null}

      {state.status === 'ready' && state.entries.length > 0 ? (
        <>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Customer ID</th>
                  <th scope="col">Email / получатель</th>
                  <th scope="col">Канал</th>
                  <th scope="col">Статус</th>
                  <th scope="col">Причина</th>
                  <th scope="col">Notification ID</th>
                  <th scope="col">Создано</th>
                </tr>
              </thead>
              <tbody>
                {state.entries.slice(0, visible).map((entry, idx) => (
                  <tr key={entry.id ?? `${idx}-${entry.customer_id ?? ''}`}>
                    <td className={styles.mono}>{entry.customer_id || '—'}</td>
                    <td>{entry.recipient || '—'}</td>
                    <td>{entry.channel || '—'}</td>
                    <td>
                      <span className={statusClassName(entry.delivery_status)}>
                        {statusLabel(entry.delivery_status)}
                      </span>
                    </td>
                    <td>{entry.decision_reason || '—'}</td>
                    <td className={styles.mono}>
                      {entry.notification_id || '—'}
                    </td>
                    <td>{formatDate(entry.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.footer}>
            <span className={styles.muted}>
              Показано {Math.min(visible, state.entries.length)} из{' '}
              {state.entries.length}
            </span>
            {visible < state.entries.length ? (
              <Button
                buttonStyle="secondary"
                size="small"
                onClick={() => setVisible((v) => v + PAGE_SIZE)}
              >
                Показать ещё
              </Button>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  )
}

export default MarketingCampaignDeliveryJournal
