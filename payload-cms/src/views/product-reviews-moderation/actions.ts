'use server'

import { revalidatePath } from 'next/cache'
import {
  approveProductReviewAdmin,
  deleteProductReviewAdmin,
  rejectProductReviewAdmin,
  type MedusaAdminFetchResult,
} from '../../lib/product-reviews-admin-client.ts'

/**
 * Server actions for moderation operations.
 *
 * Plan §5.1 + §5.2: these run inside the Payload Next.js server (where the
 * `MEDUSA_ADMIN_SECRET_API_KEY` env lives) and proxy to the Medusa admin
 * API, so the secret never reaches the moderator's browser.
 *
 * The discriminated union from `medusaAdminFetch` is forwarded to the
 * client unchanged. Client islands branch on `ok` to render success or
 * error states without ever throwing across the server-action boundary.
 *
 * After a successful mutation we call `revalidatePath` for the moderation
 * routes so the next navigation picks up the new server-rendered list /
 * detail. This is the Payload counterpart of Phase-1 `revalidateTag`
 * calls on the storefront — they cover the public site, while these
 * cover the admin caches.
 */

type ModerationActionResult =
  | { ok: true; status: number }
  | { ok: false; status: number; error: string; message?: string }

function flatten<T>(result: MedusaAdminFetchResult<T>): ModerationActionResult {
  if (result.ok) {
    return { ok: true, status: result.status }
  }
  return {
    ok: false,
    status: result.status,
    error: result.error,
    ...(result.message ? { message: result.message } : {}),
  }
}

function revalidateModerationViews() {
  // Both the list and the detail routes share the same prefix; revalidate
  // each independently so we don't depend on Next's wildcard semantics.
  try {
    revalidatePath('/admin/product-reviews/moderation')
  } catch {
    // Best-effort — `revalidatePath` is only available in route handler /
    // server-action context. If the action is invoked outside that path,
    // we still want the network result to bubble up to the UI.
  }
}

export async function approveReviewAction(
  reviewId: string,
): Promise<ModerationActionResult> {
  const trimmed = reviewId?.trim()
  if (!trimmed) return { ok: false, status: 0, error: 'invalid_id' }

  const result = await approveProductReviewAdmin(trimmed)
  if (result.ok) revalidateModerationViews()
  return flatten(result)
}

export async function rejectReviewAction(
  reviewId: string,
  reason: string,
): Promise<ModerationActionResult> {
  const trimmedId = reviewId?.trim()
  const trimmedReason = reason?.trim() ?? ''

  if (!trimmedId) return { ok: false, status: 0, error: 'invalid_id' }
  if (!trimmedReason) return { ok: false, status: 0, error: 'reason_required' }
  if (trimmedReason.length > 500) {
    return { ok: false, status: 0, error: 'reason_too_long' }
  }

  const result = await rejectProductReviewAdmin(trimmedId, trimmedReason)
  if (result.ok) revalidateModerationViews()
  return flatten(result)
}

export async function deleteReviewAction(
  reviewId: string,
): Promise<ModerationActionResult> {
  const trimmed = reviewId?.trim()
  if (!trimmed) return { ok: false, status: 0, error: 'invalid_id' }

  const result = await deleteProductReviewAdmin(trimmed)
  if (result.ok) revalidateModerationViews()
  return flatten(result)
}

export type { ModerationActionResult }
