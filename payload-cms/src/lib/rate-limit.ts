import 'server-only'

/**
 * Generic in-memory sliding-window rate limiter.
 *
 * Designed for Payload custom endpoints where a single Payload instance
 * is sufficient — the state lives in a per-process `Map`, so it resets on
 * restart and is **not** shared across replicas. That trade-off is
 * intentional: it keeps Phase 1.1 dependency-free (no Redis), and the
 * Phase 4 async queue will make per-process limits irrelevant anyway.
 *
 * Usage:
 *
 *   const checkLaunch = createRateLimit({ windowMs: 60_000, max: 3 })
 *   const result = checkLaunch(`launch:${userId}`)
 *   if (!result.ok) {
 *     return new Response(JSON.stringify({ error: 'rate_limited' }), {
 *       status: 429,
 *       headers: {
 *         'Content-Type': 'application/json',
 *         'Retry-After': String(Math.ceil(result.retryAfterMs / 1000)),
 *       },
 *     })
 *   }
 *
 * Algorithm: keep a buffer of request timestamps per key. On every check
 * we drop expired entries, accept if `bucket.length < max`, otherwise
 * reject and report when the oldest entry will expire. Empty buckets
 * are reaped opportunistically (1 % of checks) so the Map does not
 * leak across long-running keys.
 */

type Bucket = number[]

export type RateLimitResult = {
  ok: boolean
  /** Milliseconds until the next slot frees up. 0 when `ok === true`. */
  retryAfterMs: number
}

export type RateLimitChecker = (key: string) => RateLimitResult

export type RateLimitOptions = {
  /** Sliding window length, in milliseconds. Must be > 0. */
  windowMs: number
  /** Maximum number of requests per `windowMs` for a given key. Must be a positive integer. */
  max: number
}

export function createRateLimit(options: RateLimitOptions): RateLimitChecker {
  const { windowMs, max } = options

  if (!Number.isFinite(windowMs) || windowMs <= 0) {
    throw new Error('createRateLimit: windowMs must be a positive number of milliseconds')
  }
  if (!Number.isInteger(max) || max <= 0) {
    throw new Error('createRateLimit: max must be a positive integer')
  }

  const store = new Map<string, Bucket>()

  const reapEmpty = (now: number): void => {
    for (const [key, bucket] of store) {
      while (bucket.length > 0 && bucket[0]! <= now - windowMs) {
        bucket.shift()
      }
      if (bucket.length === 0) {
        store.delete(key)
      }
    }
  }

  return function check(key: string): RateLimitResult {
    if (typeof key !== 'string' || key.length === 0) {
      // A missing key would collapse all callers into one bucket — fail
      // closed instead, so an upstream bug becomes visible immediately.
      return { ok: false, retryAfterMs: windowMs }
    }

    const now = Date.now()
    let bucket = store.get(key)
    if (!bucket) {
      bucket = []
      store.set(key, bucket)
    }

    // Drop entries older than the window.
    while (bucket.length > 0 && bucket[0]! <= now - windowMs) {
      bucket.shift()
    }

    if (bucket.length >= max) {
      const earliest = bucket[0]!
      const retryAfterMs = Math.max(earliest + windowMs - now, 0)
      return { ok: false, retryAfterMs }
    }

    bucket.push(now)

    // Opportunistic cleanup of stale keys (every ~1 % of checks). This
    // keeps the Map size bounded without scheduling a background timer
    // (which would keep a Node event loop reference alive in test runs).
    if (Math.random() < 0.01) {
      reapEmpty(now)
    }

    return { ok: true, retryAfterMs: 0 }
  }
}
