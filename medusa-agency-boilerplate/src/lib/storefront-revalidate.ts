/**
 * Phase 1 / step 9 — backend → storefront on-demand cache invalidation
 * helper.
 *
 * Plan reference:
 *   - [`plans/product-reviews-module.md`](plans/product-reviews-module.md) §6.6:
 *     «Medusa-эндпоинты approve/reject/DELETE после коммита транзакции
 *     вызывают revalidateTag сторфронта… через внутренний webhook».
 *
 * Companion to the storefront route
 * [`api/revalidate/route.ts`](medusa-agency-boilerplate-storefront/src/app/api/revalidate/route.ts:1).
 *
 * Design contract:
 *   - **best-effort**. The Medusa admin transaction has already committed
 *     before this is called (plan §4.3 «после коммита»). A failed webhook
 *     must NOT bubble back to the admin response — the storefront tags
 *     also have `revalidate: 60` ISR, so the worst case is a one-minute
 *     stale window.
 *   - **never throws**. All transport / config errors are logged and
 *     returned as `{ ok: false, ... }` so the caller can keep its 200/204
 *     contract intact.
 *   - **5-second timeout** via `AbortSignal.timeout` (Node 18+, available
 *     in the Medusa runtime). A hung storefront cannot stall an admin
 *     request.
 *   - **No retries / no queue**. Phase 1 is intentionally lean — ISR
 *     covers transient misses.
 *
 * Env contract:
 *   - `STOREFRONT_URL` — already used by every transactional-email
 *     workflow (search `process.env.STOREFRONT_URL` in `src/workflows/`).
 *   - `STOREFRONT_REVALIDATE_SECRET` — backend-side mirror of the
 *     storefront's `REVALIDATE_SECRET`. The two MUST match. Kept as a
 *     separate env name on the backend to follow the project convention
 *     of qualifying remote-target secrets with the target's name (see
 *     `MEDUSA_ADMIN_SECRET_API_KEY`, `YOOKASSA_WEBHOOK_SECRET`).
 *
 * Either env missing ⇒ helper returns `{ ok: false, error: 'config_missing' }`
 * after a `logger.warn`. This keeps approve/reject/delete usable in dev
 * before the operator wires the webhook up.
 */

const REVALIDATE_TIMEOUT_MS = 5_000

type RevalidateLogger = {
  warn(msg: string): void
  error(msg: string): void
}

export type RevalidateStorefrontTagsResult =
  | { ok: true; status: number; revalidated: string[] }
  | { ok: false; status?: number; error: string }

function readEnv(name: string): string {
  const raw = process.env[name]
  return typeof raw === "string" ? raw.trim() : ""
}

function buildRevalidateUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "")
  return `${trimmed}/api/revalidate`
}

/**
 * POST `tags` to the storefront's on-demand revalidate webhook. Never
 * throws. Returns a discriminated result the caller can ignore for
 * fire-and-forget UX without losing observability — the helper itself
 * does all the logging.
 */
export async function revalidateStorefrontTags(
  tags: string[],
  options?: { logger?: RevalidateLogger }
): Promise<RevalidateStorefrontTagsResult> {
  const logger = options?.logger
  const cleanTags = Array.from(
    new Set(
      (Array.isArray(tags) ? tags : [])
        .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
        .filter((tag) => tag.length > 0)
    )
  )

  if (cleanTags.length === 0) {
    // Nothing to do — silent success keeps the admin route lean.
    return { ok: true, status: 204, revalidated: [] }
  }

  const baseUrl = readEnv("STOREFRONT_URL")
  const secret = readEnv("STOREFRONT_REVALIDATE_SECRET")

  if (!baseUrl || !secret) {
    logger?.warn(
      `[product-reviews-revalidate] skip: missing env (STOREFRONT_URL=${
        baseUrl ? "set" : "empty"
      }, STOREFRONT_REVALIDATE_SECRET=${secret ? "set" : "empty"}); tags=${cleanTags.join(",")}`
    )
    return { ok: false, error: "config_missing" }
  }

  const url = buildRevalidateUrl(baseUrl)

  let response: Response
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-revalidate-secret": secret,
      },
      body: JSON.stringify({ tags: cleanTags }),
      // AbortSignal.timeout is available in Node 18+, the Medusa runtime
      // baseline. If the storefront process is unresponsive, the admin
      // route still returns within ~5s plus its own work.
      signal: AbortSignal.timeout(REVALIDATE_TIMEOUT_MS),
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "unknown_fetch_error"
    logger?.error(
      `[product-reviews-revalidate] transport error url=${url} tags=${cleanTags.join(
        ","
      )} message=${message}`
    )
    return { ok: false, error: `transport_error:${message}` }
  }

  if (!response.ok) {
    let errorBody = ""
    try {
      errorBody = (await response.text()).slice(0, 512)
    } catch {
      errorBody = "<unreadable>"
    }
    logger?.error(
      `[product-reviews-revalidate] non-2xx url=${url} status=${response.status} tags=${cleanTags.join(
        ","
      )} body=${errorBody}`
    )
    return {
      ok: false,
      status: response.status,
      error: `http_${response.status}`,
    }
  }

  return { ok: true, status: response.status, revalidated: cleanTags }
}
