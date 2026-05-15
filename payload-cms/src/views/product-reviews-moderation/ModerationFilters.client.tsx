'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@payloadcms/ui'
import { moderationCopy } from './copy.ts'
import { RATING_OPTIONS, STATUS_OPTIONS, type AllStatusOption } from './helpers.ts'

/**
 * Filter form for the moderation list.
 *
 * Filters live in the URL query string so the server view can read them
 * and re-render the list with fresh data — that's the canonical Next.js
 * App-Router pattern for server-rendered tables.
 *
 * Plan §5.1: default status is `pending` (the moderation queue). The
 * outer server component initialises the form values from the query
 * string, so a missing `status` is rendered as `pending` here.
 */

export type ModerationFiltersInitial = {
  status: AllStatusOption
  rating: '' | '1' | '2' | '3' | '4' | '5'
  productId: string
  dateFrom: string
  dateTo: string
}

type Props = {
  initial: ModerationFiltersInitial
  /** Where the form posts; always points at this view's path. */
  action: string
}

export function ModerationFilters({ initial, action }: Props) {
  const router = useRouter()
  // TODO(Phase 2 next): добавить visual loading indicator поверх таблицы
  // на основе `isPending` — сейчас Submit/Reset просто disabled-ятся (см.
  // ревью M1).
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const params = new URLSearchParams()

    const fields: Array<keyof ModerationFiltersInitial> = [
      'status',
      'rating',
      'productId',
      'dateFrom',
      'dateTo',
    ]
    for (const field of fields) {
      const value = formData.get(field)
      if (typeof value === 'string' && value.trim()) {
        params.set(field, value.trim())
      }
    }

    const qs = params.toString()
    startTransition(() => {
      router.push(qs ? `${action}?${qs}` : action)
    })
  }

  const handleReset = () => {
    startTransition(() => {
      router.push(action)
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 'var(--base, 16px)',
        alignItems: 'end',
        marginBottom: 'calc(var(--base, 16px) * 1.5)',
      }}
    >
      <label style={fieldStyle}>
        <span style={labelStyle}>{moderationCopy.list.filters.status}</span>
        <select name="status" defaultValue={initial.status} style={inputStyle}>
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      <label style={fieldStyle}>
        <span style={labelStyle}>{moderationCopy.list.filters.rating}</span>
        <select name="rating" defaultValue={initial.rating} style={inputStyle}>
          {RATING_OPTIONS.map((opt) => (
            <option key={opt.value || 'any'} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      <label style={fieldStyle}>
        <span style={labelStyle}>{moderationCopy.list.filters.productId}</span>
        <input
          type="text"
          name="productId"
          defaultValue={initial.productId}
          placeholder={moderationCopy.list.filters.productIdPlaceholder}
          style={inputStyle}
          autoComplete="off"
        />
      </label>

      <label style={fieldStyle}>
        <span style={labelStyle}>{moderationCopy.list.filters.dateFrom}</span>
        <input type="date" name="dateFrom" defaultValue={initial.dateFrom} style={inputStyle} />
      </label>

      <label style={fieldStyle}>
        <span style={labelStyle}>{moderationCopy.list.filters.dateTo}</span>
        <input type="date" name="dateTo" defaultValue={initial.dateTo} style={inputStyle} />
      </label>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'end' }}>
        <Button type="submit" buttonStyle="primary" size="small" disabled={isPending}>
          {moderationCopy.list.filters.submit}
        </Button>
        <Button
          type="button"
          buttonStyle="secondary"
          size="small"
          onClick={handleReset}
          disabled={isPending}
        >
          {moderationCopy.list.filters.reset}
        </Button>
      </div>
    </form>
  )
}

const fieldStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
}

const labelStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--theme-elevation-500)',
}

const inputStyle: React.CSSProperties = {
  height: '32px',
  padding: '0 8px',
  borderRadius: 'var(--style-radius-s, 4px)',
  border: '1px solid var(--theme-elevation-150)',
  background: 'var(--theme-input-bg, var(--theme-elevation-50))',
  color: 'var(--theme-elevation-1000)',
  fontSize: '0.875rem',
}
