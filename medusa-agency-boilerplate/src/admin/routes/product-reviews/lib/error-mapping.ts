/**
 * Phase 4 / step 2 — error-code → user-facing copy mapper for the
 * Medusa Admin moderation surface. Consumed by all mutation handlers
 * (approve / reject / delete / reply CRUD) and the list/detail
 * fetchers — they branch on `result.ok === false` and pass
 * `result.error` through this helper to produce a `toast.error(...)`
 * message.
 *
 * Codes covered here are the union of:
 *   - synthetic codes emitted by
 *     [`api.ts`](medusa-agency-boilerplate/src/admin/routes/product-reviews/lib/api.ts:1)
 *     (`unauthorized`, `transport_error`, `aborted`, `http_<n>`);
 *   - backend Zod / business codes returned by the `/admin/reviews/*`
 *     handlers (`not_found`, `reason_required`, `reason_too_long`,
 *     `reply_text_required`, `reply_text_too_long`).
 *
 * Anything not enumerated falls through to the generic «Не удалось
 * выполнить действие» copy.
 */

import { moderationCopy } from './copy'

export function mapErrorToMessage(error: string, _status?: number): string {
  switch (error) {
    case 'not_found':
      return moderationCopy.detail.error.notFound
    case 'reason_required':
      return moderationCopy.detail.reject.reasonRequired
    case 'reason_too_long':
      return moderationCopy.detail.reject.reasonTooLong
    case 'reply_text_required':
    case 'reply_required':
      return moderationCopy.detail.reply.errors.required
    case 'reply_text_too_long':
    case 'reply_too_long':
      return moderationCopy.detail.reply.errors.tooLong
    case 'unauthorized':
      return moderationCopy.detail.error.unauthorized
    case 'transport_error':
    case 'aborted':
      return moderationCopy.detail.error.transport
    default:
      return moderationCopy.detail.error.generic
  }
}
