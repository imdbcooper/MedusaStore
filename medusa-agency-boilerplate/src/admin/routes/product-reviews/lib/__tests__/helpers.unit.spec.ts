/**
 * Phase 4 / step 2 — unit tests for the Medusa Admin moderation
 * `lib/helpers.ts` module. Mirrors the parity contract from the
 * Payload-side helpers in
 * [`payload-cms/src/views/product-reviews-moderation/helpers.ts`](payload-cms/src/views/product-reviews-moderation/helpers.ts:1)
 * — every behaviour these tests pin is also true on the Payload side,
 * so the eventual deletion of that module (Phase 4 / step 7) cannot
 * silently drift the moderator UX.
 *
 * Picked up by the existing unit-test glob in
 * [`jest.config.js`](medusa-agency-boilerplate/jest.config.js:1):
 * `**\/src/**\/__tests__/**\/*.unit.spec.[jt]s`.
 */

import {
  PAGE_SIZE,
  RATING_OPTIONS,
  STATUS_OPTIONS,
  customerDisplayName,
  formatDate,
  formatStarRating,
  normalizeAdminReviewImageUrls,
  truncateText,
} from '../helpers'

describe('admin product-reviews moderation helpers', () => {
  describe('formatStarRating', () => {
    it('renders five filled stars for the maximum rating', () => {
      expect(formatStarRating(5)).toBe('★★★★★')
    })

    it('mixes filled and empty stars for a partial rating', () => {
      expect(formatStarRating(3)).toBe('★★★☆☆')
    })

    it('clamps out-of-range ratings into [0, 5]', () => {
      expect(formatStarRating(-1)).toBe('☆☆☆☆☆')
      expect(formatStarRating(99)).toBe('★★★★★')
    })
  })

  describe('truncateText', () => {
    it('returns trimmed input when shorter than the cap', () => {
      expect(truncateText('  hi  ', 10)).toBe('hi')
    })

    it('appends a single ellipsis when over the cap', () => {
      // `Hello world` (11 chars) capped at 5 → 4 chars + '…' = 5 visible chars.
      expect(truncateText('Hello world', 5)).toBe('Hell…')
    })

    it('collapses null/undefined to an empty string', () => {
      expect(truncateText(null)).toBe('')
      expect(truncateText(undefined)).toBe('')
    })
  })

  describe('formatDate', () => {
    it('renders a Russian long-date label for a valid ISO timestamp', () => {
      const out = formatDate('2026-05-15T10:00:00.000Z')
      // `Intl.DateTimeFormat('ru-RU', { dateStyle: 'long' })` always
      // contains the four-digit year and the `г.` Russian abbreviation
      // for «года». Asserting on those tokens keeps the test stable
      // across day boundaries (timezone may shift the date by ±1).
      expect(out).toMatch(/2026/)
      expect(out).toMatch(/г\./)
    })

    it('falls back to the «—» placeholder for empty / invalid input', () => {
      expect(formatDate(null)).toBe('—')
      expect(formatDate(undefined)).toBe('—')
      expect(formatDate('not-a-date')).toBe('—')
    })
  })

  describe('customerDisplayName', () => {
    it('returns the snapshot name when present', () => {
      expect(customerDisplayName({ customer_name: 'Иван И.' })).toBe('Иван И.')
    })

    it('trims surrounding whitespace before deciding fallback', () => {
      expect(customerDisplayName({ customer_name: '   ' })).toBe(
        'Анонимизирован',
      )
    })

    it('falls back when the snapshot is empty', () => {
      expect(customerDisplayName({ customer_name: '' })).toBe('Анонимизирован')
    })
  })

  describe('normalizeAdminReviewImageUrls', () => {
    it('extracts urls from the new `{ id, url }[]` shape', () => {
      expect(
        normalizeAdminReviewImageUrls([
          { id: 'a', url: 'https://x' },
          { id: 'b', url: 'https://y' },
        ]),
      ).toEqual(['https://x', 'https://y'])
    })

    it('passes through the legacy `string[]` shape unchanged', () => {
      expect(
        normalizeAdminReviewImageUrls(['https://x', 'https://y']),
      ).toEqual(['https://x', 'https://y'])
    })

    it('returns an empty array for non-array / nullish / malformed input', () => {
      expect(normalizeAdminReviewImageUrls(null)).toEqual([])
      expect(normalizeAdminReviewImageUrls(undefined)).toEqual([])
      expect(normalizeAdminReviewImageUrls('https://x')).toEqual([])
      expect(normalizeAdminReviewImageUrls({})).toEqual([])
      expect(normalizeAdminReviewImageUrls([{ id: 'a' }])).toEqual([])
      expect(normalizeAdminReviewImageUrls([{ url: '' }])).toEqual([])
      expect(normalizeAdminReviewImageUrls([42, true, null])).toEqual([])
    })

    it('drops malformed entries while keeping valid ones (mixed input)', () => {
      expect(
        normalizeAdminReviewImageUrls([
          'https://keep-1',
          { id: 'a', url: 'https://keep-2' },
          { id: 'b' },
          { url: 123 },
          '',
        ]),
      ).toEqual(['https://keep-1', 'https://keep-2'])
    })
  })

  describe('option / constant exports', () => {
    it('exposes the canonical PAGE_SIZE used by the list query', () => {
      expect(PAGE_SIZE).toBe(20)
    })

    it('STATUS_OPTIONS includes pending/approved/rejected/all in that order', () => {
      expect(STATUS_OPTIONS.map((o) => o.value)).toEqual([
        'pending',
        'approved',
        'rejected',
        'all',
      ])
    })

    it('RATING_OPTIONS leads with the «any» placeholder followed by 5..1', () => {
      expect(RATING_OPTIONS.map((o) => o.value)).toEqual([
        '',
        '5',
        '4',
        '3',
        '2',
        '1',
      ])
    })
  })
})
