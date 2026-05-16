/**
 * Phase 4 / step 2 — pure helpers shared between the Medusa Admin
 * moderation list and detail views. Ported from
 * [`payload-cms/src/views/product-reviews-moderation/helpers.ts`](payload-cms/src/views/product-reviews-moderation/helpers.ts:1)
 * with two intentional changes for the new UI:
 *
 *   - `formatDate` now uses `Intl.DateTimeFormat('ru-RU', { dateStyle: 'long' })`
 *     instead of the manual `DD.MM.YYYY HH:mm` formatter — Medusa Admin
 *     already exposes locale-correct dates and we want consistency with
 *     the surrounding chrome rather than the Payload theme;
 *   - the Payload-only `statusPillStyle` (CSS-var swatches) is dropped —
 *     `@medusajs/ui` `StatusBadge` will own the colour mapping.
 *
 * Plan §10.2: all values returned here are plain strings — never HTML.
 * React's interpolation escapes them automatically.
 */

import type { AdminReviewListItem, AdminReviewStatus } from './api'
import { moderationCopy } from './copy'

/**
 * Render the rating as a 5-glyph string, e.g. `★★★★☆`. Values outside
 * the `[0, 5]` range are clamped, non-integer ratings are truncated.
 */
export function formatStarRating(rating: number): string {
  const clamped = Math.max(0, Math.min(5, Math.trunc(rating)))
  return '★'.repeat(clamped) + '☆'.repeat(5 - clamped)
}

/**
 * Trim and truncate `value` to at most `max` characters. The result is
 * suffixed with a single ellipsis char so widths stay predictable in
 * the moderation table. `null` / `undefined` collapse to the empty
 * string so callers can render `truncateText(...)` directly.
 */
export function truncateText(
  value: string | null | undefined,
  max = 80,
): string {
  if (!value) return ''
  const trimmed = value.trim()
  if (trimmed.length <= max) return trimmed
  return trimmed.slice(0, max - 1).trimEnd() + '…'
}

const RU_LONG_DATE_FORMATTER = new Intl.DateTimeFormat('ru-RU', {
  dateStyle: 'long',
})

/**
 * Format an ISO timestamp into a Russian long-date string, e.g.
 * `15 мая 2026 г.`. Falls back to `moderationCopy.detail.fields.none`
 * (the em-dash placeholder) for empty / invalid input — keeping the
 * detail meta panel visually consistent when a column is null.
 */
export function formatDate(value: string | null | undefined): string {
  if (!value) return moderationCopy.detail.fields.none
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return moderationCopy.detail.fields.none
  return RU_LONG_DATE_FORMATTER.format(date)
}

export function statusLabel(status: AdminReviewStatus): string {
  return moderationCopy.status[status]
}

/**
 * Anonymised reviews carry the literal 'Покупатель' as `customer_name`
 * (plan §10.3); we still render the snapshot value as-is — it is the
 * source of truth for the moderator UI. Empty / whitespace falls back
 * to the «Анонимизирован» label so the column never renders blank.
 */
export function customerDisplayName(
  item: Pick<AdminReviewListItem, 'customer_name'>,
): string {
  return item.customer_name?.trim() || moderationCopy.detail.fields.anonymous
}

export type AllStatusOption = AdminReviewStatus | 'all'

export const STATUS_OPTIONS: ReadonlyArray<{
  value: AllStatusOption
  label: string
}> = [
  { value: 'pending', label: moderationCopy.list.filters.statusPending },
  { value: 'approved', label: moderationCopy.list.filters.statusApproved },
  { value: 'rejected', label: moderationCopy.list.filters.statusRejected },
  { value: 'all', label: moderationCopy.list.filters.statusAll },
]

export const RATING_OPTIONS: ReadonlyArray<{
  value: '' | '1' | '2' | '3' | '4' | '5'
  label: string
}> = [
  { value: '', label: moderationCopy.list.filters.ratingAny },
  { value: '5', label: '5 ★' },
  { value: '4', label: '4 ★' },
  { value: '3', label: '3 ★' },
  { value: '2', label: '2 ★' },
  { value: '1', label: '1 ★' },
]

/**
 * The `images` jsonb column may carry either the new
 * `Array<{ id, url }>` shape (preferred) or a legacy plain `string[]`
 * (early Phase 3 dev rows). The moderator UI only needs URLs to render
 * thumbnails and never deletes individual files, so this helper
 * collapses both shapes into a clean `string[]` of URLs and drops
 * malformed entries. Returns `[]` when the column is `null`,
 * non-array, or every entry is invalid.
 */
export function normalizeAdminReviewImageUrls(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  const urls: string[] = []
  for (const entry of value) {
    if (typeof entry === 'string' && entry.length > 0) {
      urls.push(entry)
      continue
    }
    if (entry && typeof entry === 'object') {
      const candidate = entry as { url?: unknown }
      if (typeof candidate.url === 'string' && candidate.url.length > 0) {
        urls.push(candidate.url)
      }
    }
  }
  return urls
}

export const PAGE_SIZE = 20
