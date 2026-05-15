import type { ProductReviewAdminItem, ProductReviewStatus } from '../../lib/product-reviews-admin-client.ts'
import { moderationCopy } from './copy.ts'

/**
 * Pure helpers shared between the list and detail server views. Kept in a
 * dedicated file so both server components and client islands can import
 * the same formatters without bundling React server-only code into
 * client components.
 *
 * Plan §10.2: all values returned here are plain strings — never HTML.
 * React's interpolation escapes them automatically.
 */

export function formatStarRating(rating: number): string {
  const clamped = Math.max(0, Math.min(5, Math.trunc(rating)))
  // Filled then empty stars, e.g. "★★★★☆".
  return '★'.repeat(clamped) + '☆'.repeat(5 - clamped)
}

export function truncateText(value: string | null | undefined, max = 80): string {
  if (!value) return ''
  const trimmed = value.trim()
  if (trimmed.length <= max) return trimmed
  // Use a single ellipsis char so widths stay predictable in the table.
  return trimmed.slice(0, max - 1).trimEnd() + '…'
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return moderationCopy.detail.fields.none
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return moderationCopy.detail.fields.none
  // Locale-stable ISO-ish date with no timezone surprises in Russian admin
  // (DD.MM.YYYY HH:mm).
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`
}

export function statusLabel(status: ProductReviewStatus): string {
  return moderationCopy.status[status]
}

export function customerDisplayName(item: Pick<ProductReviewAdminItem, 'customer_name' | 'customer_id'>): string {
  // Plan §10.3: anonymised reviews carry the literal 'Покупатель'; we still
  // render the snapshot value as-is — it is the source of truth for the
  // moderator UI.
  return item.customer_name?.trim() || moderationCopy.detail.fields.anonymous
}

export type AllStatusOption = ProductReviewStatus | 'all'

export const STATUS_OPTIONS: ReadonlyArray<{
  value: AllStatusOption
  label: string
}> = [
  { value: 'pending', label: moderationCopy.list.filters.statusPending },
  { value: 'approved', label: moderationCopy.list.filters.statusApproved },
  { value: 'rejected', label: moderationCopy.list.filters.statusRejected },
  { value: 'all', label: moderationCopy.list.filters.statusAll },
]

export const RATING_OPTIONS: ReadonlyArray<{ value: '' | '1' | '2' | '3' | '4' | '5'; label: string }> = [
  { value: '', label: moderationCopy.list.filters.ratingAny },
  { value: '5', label: '5 ★' },
  { value: '4', label: '4 ★' },
  { value: '3', label: '3 ★' },
  { value: '2', label: '2 ★' },
  { value: '1', label: '1 ★' },
]

/**
 * Status pill background — uses Payload's theme tokens via inline style so
 * the badge integrates with the admin's light/dark themes without bringing
 * in a new SCSS module just for three colour swatches.
 */
export function statusPillStyle(status: ProductReviewStatus): {
  background: string
  color: string
} {
  switch (status) {
    case 'approved':
      return { background: 'var(--theme-success-150)', color: 'var(--theme-success-750)' }
    case 'rejected':
      return { background: 'var(--theme-error-150)', color: 'var(--theme-error-750)' }
    case 'pending':
    default:
      return { background: 'var(--theme-warning-150)', color: 'var(--theme-warning-750)' }
  }
}

export const PAGE_SIZE = 20
