/**
 * Phase 5.4: shared in-memory rate-limit middleware for public, unauthenticated
 * Store endpoints.
 *
 * Scope/assumptions
 * -----------------
 * - Targets unauthenticated "public" surfaces: VK ID login start,
 *   link-conflict-resolve, and other public POST endpoints that can be farmed
 *   by anonymous callers (state-token flooding, password brute force).
 * - In-memory token-bucket keyed by caller IP. Single-replica design: staging
 *   runs one Medusa container behind Caddy, and the Phase 5.x scale target is
 *   the same. When we introduce a horizontally-scaled replica set, this
 *   helper will need a Redis backend — the public API stays compatible so
 *   that swap is local.
 * - No dependency on external libraries (`express-rate-limit`, `rate-limiter-flexible`,
 *   Redis). Pulling a new dep for a single-replica guardrail is a bigger
 *   infra change than the Phase 5.4 follow-up calls for.
 *
 * IP extraction
 * -------------
 * Staging ingress is Caddy → Medusa on `studio.slavx.ru`. Caddy sets the
 * `X-Forwarded-For` header with the original client IP. We accept the first
 * entry from the header because:
 *   1. All public traffic enters through Caddy, which is the only trusted
 *      proxy in the deployment.
 *   2. Medusa/Express does NOT parse `X-Forwarded-For` by default because
 *      `trust proxy` is not configured in our codebase.
 *   3. We deliberately skip a full "list of trusted proxies" scheme: there is
 *      exactly one trusted proxy and the limiter's blast radius is rejecting
 *      a request, not authentication. Treat the extracted IP as advisory.
 *
 * `req.ip`/`req.socket.remoteAddress` is used as a fallback when the header
 * is absent (tests, curl, local dev without Caddy).
 *
 * Response shape
 * --------------
 * When limited we send `HTTP 429` with JSON `{ ok: false, code: "rate_limited",
 * retry_after_seconds }` plus the RFC-6585 `Retry-After` header. The code
 * string matches the storefront's error-code convention (see
 * `vk-id/start/origin-guard.ts`), so storefront translations can reuse the
 * same i18n key.
 *
 * Tests
 * -----
 * See [`route.unit.spec`](medusa-agency-boilerplate/src/modules/__tests__/public-rate-limit.unit.spec.ts:1).
 */

import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

/**
 * Allowance for a single limiter instance.
 *
 * - `limit`: max number of allowed requests per `windowMs` from the same key.
 * - `windowMs`: rolling window size in milliseconds.
 * - `bucketKey`: identifier used to keep multiple limiters independent inside
 *   the single in-memory store (e.g. `vk-id-start`, `vk-id-link-conflict`).
 */
export type PublicRateLimitOptions = {
  limit: number
  windowMs: number
  bucketKey: string
}

type Hit = {
  count: number
  resetAt: number
}

const hitStore = new Map<string, Hit>()

/**
 * Upper bound on the in-memory store. Each limiter bucket contributes at most
 * `O(unique_ips_in_window)` entries. We cap the total size to keep memory
 * usage bounded for an attacker who rotates source IPs.
 *
 * Eviction strategy: when the cap is reached we drop the oldest entries
 * (Map preserves insertion order). This is a conservative LRU approximation
 * and is intentionally simple — the store is a best-effort guardrail, not
 * a security-critical cache.
 */
const MAX_STORE_ENTRIES = 10_000

function pickFirstHeader(
  value: string | string[] | undefined
): string | undefined {
  if (Array.isArray(value)) {
    return value[0]
  }

  return value
}

/**
 * Extract the real client IP. Exported for unit tests.
 */
export function extractClientIp(req: MedusaRequest): string {
  const forwardedForHeader = pickFirstHeader(
    req.headers?.["x-forwarded-for"] as string | string[] | undefined
  )

  if (forwardedForHeader) {
    // `X-Forwarded-For` is a comma-separated list: "client, proxy1, proxy2".
    // The first entry is the original client IP as seen by the edge proxy.
    const first = forwardedForHeader.split(",")[0]?.trim()
    if (first) {
      return first
    }
  }

  const realIpHeader = pickFirstHeader(
    req.headers?.["x-real-ip"] as string | string[] | undefined
  )

  if (realIpHeader?.trim()) {
    return realIpHeader.trim()
  }

  // Fallback: Express `req.ip` or raw socket address.
  const expressIp = (req as unknown as { ip?: string }).ip
  if (expressIp?.trim()) {
    return expressIp.trim()
  }

  const remote = (req as unknown as {
    socket?: { remoteAddress?: string | null }
  }).socket?.remoteAddress
  if (remote?.trim()) {
    return remote.trim()
  }

  // Last-resort bucket so a missing IP does not bypass the limit entirely.
  // All anonymous callers with an unknown IP end up in the same bucket.
  return "unknown"
}

function normalizeIpForBucket(ip: string): string {
  // IPv6-mapped IPv4 addresses (e.g. `::ffff:1.2.3.4`) and their plain form
  // must land in the same bucket. Strip the prefix.
  if (ip.startsWith("::ffff:")) {
    return ip.slice("::ffff:".length)
  }
  return ip
}

/**
 * Evaluate the limiter against a given (bucket, ip, now) triple. Exposed for
 * unit tests so we can drive the store deterministically without sleeping.
 *
 * Returns the updated hit and whether the call is allowed or limited.
 */
export function evaluatePublicRateLimit(input: {
  bucketKey: string
  clientIp: string
  now: number
  limit: number
  windowMs: number
  store?: Map<string, Hit>
}):
  | { status: "allowed"; remaining: number; resetAt: number }
  | { status: "limited"; retryAfterSeconds: number; resetAt: number } {
  const store = input.store ?? hitStore
  const key = `${input.bucketKey}::${normalizeIpForBucket(input.clientIp)}`
  const existing = store.get(key)

  if (!existing || existing.resetAt <= input.now) {
    // Start a fresh window for this caller.
    const resetAt = input.now + input.windowMs
    const hit: Hit = { count: 1, resetAt }
    store.set(key, hit)
    enforceStoreCap(store)
    return {
      status: "allowed",
      remaining: Math.max(0, input.limit - 1),
      resetAt,
    }
  }

  if (existing.count >= input.limit) {
    const retryAfterMs = existing.resetAt - input.now
    return {
      status: "limited",
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
      resetAt: existing.resetAt,
    }
  }

  existing.count += 1
  // Re-insert to refresh insertion order used by the eviction heuristic.
  store.delete(key)
  store.set(key, existing)
  return {
    status: "allowed",
    remaining: Math.max(0, input.limit - existing.count),
    resetAt: existing.resetAt,
  }
}

function enforceStoreCap(store: Map<string, Hit>) {
  if (store.size <= MAX_STORE_ENTRIES) {
    return
  }

  const overflow = store.size - MAX_STORE_ENTRIES
  let removed = 0
  for (const key of store.keys()) {
    if (removed >= overflow) {
      break
    }
    store.delete(key)
    removed += 1
  }
}

/**
 * Clear the in-memory store. Exported for unit tests so each test case can
 * start from a deterministic baseline without waiting for windows to elapse.
 */
export function __resetPublicRateLimitStoreForTests(): void {
  hitStore.clear()
}

/**
 * Factory that returns a Medusa-compatible express-style middleware enforcing
 * the given options. The returned function is stateless from the caller's
 * perspective — the counter lives in module-level state so multiple route
 * registrations using the same `bucketKey` share a limit, and registrations
 * with distinct keys stay independent.
 */
export function publicRateLimit(
  options: PublicRateLimitOptions
): (
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) => void | Promise<void> {
  if (!Number.isFinite(options.limit) || options.limit < 1) {
    throw new Error(
      `[public-rate-limit] invalid limit for bucket ${options.bucketKey}: ${options.limit}`
    )
  }
  if (!Number.isFinite(options.windowMs) || options.windowMs < 1000) {
    throw new Error(
      `[public-rate-limit] invalid windowMs for bucket ${options.bucketKey}: ${options.windowMs}`
    )
  }
  if (!options.bucketKey?.trim()) {
    throw new Error("[public-rate-limit] bucketKey is required")
  }

  return function publicRateLimitMiddleware(req, res, next) {
    const clientIp = extractClientIp(req)
    const result = evaluatePublicRateLimit({
      bucketKey: options.bucketKey,
      clientIp,
      now: Date.now(),
      limit: options.limit,
      windowMs: options.windowMs,
    })

    if (result.status === "allowed") {
      return next()
    }

    res.setHeader("Retry-After", String(result.retryAfterSeconds))
    res.status(429).json({
      ok: false,
      code: "rate_limited",
      retry_after_seconds: result.retryAfterSeconds,
    })
  }
}

/**
 * Shared defaults for VK ID public endpoints. 10 requests per minute is
 * enough for a legitimate storefront user who reloads the conflict page or
 * triggers the VK ID button a couple of times while debugging their auth
 * flow, while still shutting down flood attempts and password brute force.
 */
export const VK_ID_PUBLIC_RATE_LIMIT: Omit<PublicRateLimitOptions, "bucketKey"> =
  {
    limit: 10,
    windowMs: 60_000,
  }
