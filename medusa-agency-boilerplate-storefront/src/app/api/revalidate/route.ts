import { revalidateTag } from "next/cache"
import { NextRequest, NextResponse } from "next/server"

import { REVALIDATE_SECRET } from "@lib/env"

/**
 * Phase 1 / step 9 — generic on-demand cache-tag invalidation webhook
 * called by the Medusa admin from a separate process.
 *
 * Plan reference:
 *   - [`plans/product-reviews-module.md`](plans/product-reviews-module.md) §6.6
 *     («Medusa-эндпоинты approve/reject/DELETE после коммита транзакции
 *     вызывают revalidateTag сторфронта… через внутренний webhook»).
 *
 * Companion to the existing payload-content webhook
 * [`api/content/revalidate/route.ts`](medusa-agency-boilerplate-storefront/src/app/api/content/revalidate/route.ts:1).
 * It is deliberately a separate route because:
 *   - the Payload webhook contract is `{ collection, slug, path }` and is
 *     specific to the CMS surface;
 *   - sharing one secret across two unrelated trust boundaries (Payload
 *     content moderation and Medusa product-reviews moderation) would
 *     couple unrelated systems;
 *   - the prefix whitelist below caps the blast radius — this endpoint can
 *     never invalidate Payload content tags, and vice versa.
 *
 * Contract:
 *   POST /api/revalidate
 *   Headers:  X-Revalidate-Secret: <REVALIDATE_SECRET>
 *   Body   :  { "tags": ["product-rating-<id>", "product-reviews-<id>", ...] }
 *             or         { "tag" : "product-rating-<id>" }
 *
 * Allowed tag prefixes (defense-in-depth — even with the right secret a
 * caller cannot purge unrelated cache surfaces):
 *   - `product-rating-`
 *   - `product-reviews-`
 *   - `customer-reviews-` (reserved for Phase 2 «Мои отзывы»)
 *
 * Allowed exact tags:
 *   - `top-reviews` (Phase 3 / step 3 — homepage «Лучшие отзывы» widget)
 *
 * Responses:
 *   - 200 `{ revalidated: string[] }` — all whitelisted tags were invalidated.
 *   - 400 `{ message }` — body shape invalid or no whitelisted tags.
 *   - 401 `{ message }` — missing or wrong secret.
 *   - 500 `{ message }` — `REVALIDATE_SECRET` is not configured. Fail closed
 *         rather than silently disabling auth — an open `revalidateTag`
 *         endpoint is a DoS vector.
 *
 * Force dynamic so Next never tries to statically pre-render this route.
 */
export const dynamic = "force-dynamic"

const ALLOWED_TAG_PREFIXES = [
  "product-rating-",
  "product-reviews-",
  "customer-reviews-",
] as const

/**
 * Singleton tags allowed in addition to the prefixed ones above. Phase 3 /
 * step 3 — the homepage «Лучшие отзывы» widget shares a single, catalog-wide
 * cache, so the tag is a single word without a per-id suffix. Kept as a
 * separate allowlist (not a prefix) to make sure a caller cannot smuggle
 * arbitrary `top-reviews-anything` strings through.
 */
const ALLOWED_EXACT_TAGS = ["top-reviews"] as const

const TAG_MAX_LENGTH = 256
const TAG_MAX_COUNT = 32

function isAllowedTag(tag: unknown): tag is string {
  if (typeof tag !== "string") {
    return false
  }
  if (tag.length === 0 || tag.length > TAG_MAX_LENGTH) {
    return false
  }
  if ((ALLOWED_EXACT_TAGS as readonly string[]).includes(tag)) {
    return true
  }
  return ALLOWED_TAG_PREFIXES.some((prefix) => tag.startsWith(prefix))
}

export async function POST(request: NextRequest) {
  if (!REVALIDATE_SECRET) {
    // Misconfiguration — surface explicitly so ops notices in logs and the
    // backend helper records the failure. Never silently 200 without auth.
    return NextResponse.json(
      {
        message: "Revalidate webhook disabled: REVALIDATE_SECRET is not set.",
      },
      { status: 500 }
    )
  }

  const provided = request.headers.get("x-revalidate-secret")
  if (!provided || provided !== REVALIDATE_SECRET) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 })
  }

  let parsed: unknown = {}
  try {
    parsed = await request.json()
  } catch {
    return NextResponse.json(
      { message: "Body must be valid JSON." },
      { status: 400 }
    )
  }

  const body = (parsed && typeof parsed === "object" ? parsed : {}) as {
    tag?: unknown
    tags?: unknown
  }

  // Accept both `tag: string` and `tags: string[]` for ergonomics.
  const candidates: unknown[] = Array.isArray(body.tags)
    ? body.tags
    : typeof body.tag === "string"
      ? [body.tag]
      : []

  if (candidates.length === 0) {
    return NextResponse.json(
      { message: "Provide `tag: string` or `tags: string[]`." },
      { status: 400 }
    )
  }

  if (candidates.length > TAG_MAX_COUNT) {
    return NextResponse.json(
      { message: `Too many tags (max ${TAG_MAX_COUNT}).` },
      { status: 400 }
    )
  }

  const accepted: string[] = []
  for (const candidate of candidates) {
    if (isAllowedTag(candidate)) {
      accepted.push(candidate)
    }
  }

  if (accepted.length === 0) {
    return NextResponse.json(
      {
        message:
          "No tag matches an allowed prefix (product-rating-, product-reviews-, customer-reviews-) or exact tag (top-reviews).",
      },
      { status: 400 }
    )
  }

  // De-duplicate to keep `revalidated` deterministic on the wire.
  const unique = Array.from(new Set(accepted))
  for (const tag of unique) {
    revalidateTag(tag)
  }

  return NextResponse.json({ revalidated: unique })
}
