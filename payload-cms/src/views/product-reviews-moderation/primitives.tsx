import type { CSSProperties } from 'react'
import {
  formatStarRating,
  statusPillStyle,
} from './helpers.ts'
import type { ProductReviewStatus } from '../../lib/product-reviews-admin-client.ts'
import { moderationCopy } from './copy.ts'

/**
 * Tiny server-only presentational primitives.
 *
 * Plan §10.2: every value is rendered as plain text — React handles the
 * escaping, so XSS-via-review-content is structurally impossible without
 * an explicit `dangerouslySetInnerHTML`.
 */

export function StarRating({ rating }: { rating: number }) {
  return (
    <span aria-label={moderationCopy.rating.starsAria(rating)} style={{ letterSpacing: '0.1em' }}>
      {formatStarRating(rating)}
    </span>
  )
}

export function StatusPill({ status }: { status: ProductReviewStatus }) {
  const style = statusPillStyle(status)
  const pillStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 10px',
    borderRadius: '999px',
    fontSize: '0.75rem',
    fontWeight: 600,
    textTransform: 'none',
    background: style.background,
    color: style.color,
    whiteSpace: 'nowrap',
  }

  return <span style={pillStyle}>{moderationCopy.status[status]}</span>
}

export function VerifiedBadge() {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 'var(--style-radius-s, 4px)',
        fontSize: '0.75rem',
        fontWeight: 500,
        background: 'var(--theme-success-100)',
        color: 'var(--theme-success-700)',
      }}
    >
      ✓ {moderationCopy.detail.fields.verifiedPurchase}
    </span>
  )
}
