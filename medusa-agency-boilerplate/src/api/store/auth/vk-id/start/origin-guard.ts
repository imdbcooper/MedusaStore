/**
 * Origin/Referer allowlist guard for the public VK ID login start endpoint.
 *
 * The endpoint is intentionally unauthenticated (the whole point is to let a
 * storefront visitor who does not yet have a Medusa session kick off a VK ID
 * login). That makes it the only VK ID route that an anonymous attacker can
 * hit directly. Without any check, a third-party site could issue
 * cross-origin POSTs (CSRF-style) to mint signed state on behalf of our users
 * or to farm our `VK_ID_CLIENT_ID` rate limits.
 *
 * Phase 5.1 follow-up scope:
 *   - Reject requests whose `Origin` and `Referer` headers are both missing
 *     or both point to a host outside `VK_ID_STOREFRONT_RETURN_ORIGINS`.
 *   - `STORE_CORS`'s first entry is accepted as a fallback, mirroring the
 *     existing `getAllowedStorefrontOrigins()` logic in vk-id.ts.
 *   - Local development is allowed (`http://localhost:8000`) when NODE_ENV is
 *     `development` or `test`, same rule used by the return-URL resolver.
 *
 * Rate limiting is NOT implemented here. The repository does not ship a
 * shared rate-limit middleware; introducing one is out of scope for this
 * follow-up and is tracked as a Phase 5.4 item. Origin allowlisting closes
 * the blatant CSRF/cross-site abuse vector without pulling in new infra.
 */

import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

const DEFAULT_LOCAL_STOREFRONT_ORIGIN = "http://localhost:8000"

function normalizeOrigin(value?: string | null): string | null {
  if (!value?.trim()) {
    return null
  }
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.origin
      : null
  } catch {
    return null
  }
}

function parseOriginList(value?: string | null): string[] {
  if (!value?.trim()) {
    return []
  }
  return Array.from(
    new Set(
      value
        .split(",")
        .map((origin) => normalizeOrigin(origin))
        .filter((origin): origin is string => Boolean(origin))
    )
  )
}

function allowLocalStorefrontFallback(): boolean {
  const nodeEnv = process.env.NODE_ENV?.trim().toLowerCase()
  return !nodeEnv || nodeEnv === "development" || nodeEnv === "test"
}

/**
 * Builds the allowlist exposed to the middleware. Kept separate from
 * `getAllowedStorefrontOrigins` in `vk-id.ts` so this module stays a pure HTTP
 * boundary helper with no module-graph coupling to that file's exported
 * runtime shape (avoids circular-ish imports when the middleware is
 * registered at startup).
 */
export function getVkIdAllowedRequestOrigins(): string[] {
  const configuredOrigins = parseOriginList(
    process.env.VK_ID_STOREFRONT_RETURN_ORIGINS
  )
  if (configuredOrigins.length) {
    return configuredOrigins
  }
  const storeCorsFallback = normalizeOrigin(
    process.env.STORE_CORS?.split(",")?.[0]?.trim()
  )
  if (storeCorsFallback) {
    return [storeCorsFallback]
  }
  if (allowLocalStorefrontFallback()) {
    return [DEFAULT_LOCAL_STOREFRONT_ORIGIN]
  }
  return []
}

function pickFirstHeaderValue(
  value: string | string[] | undefined
): string | undefined {
  if (Array.isArray(value)) {
    return value[0]
  }
  return value
}

export type VkIdOriginCheckResult =
  | { status: "allowed"; origin: string; source: "origin" | "referer" }
  | { status: "unknown_origin"; attempted: string | null }
  | { status: "no_allowlist" }
  | { status: "missing_origin" }

export function evaluateVkIdRequestOrigin(input: {
  originHeader?: string | null
  refererHeader?: string | null
  allowlist: string[]
}): VkIdOriginCheckResult {
  if (input.allowlist.length === 0) {
    return { status: "no_allowlist" }
  }

  const originCandidate = normalizeOrigin(input.originHeader)
  if (originCandidate) {
    if (input.allowlist.includes(originCandidate)) {
      return { status: "allowed", origin: originCandidate, source: "origin" }
    }
    return { status: "unknown_origin", attempted: originCandidate }
  }

  const refererCandidate = normalizeOrigin(input.refererHeader)
  if (refererCandidate) {
    if (input.allowlist.includes(refererCandidate)) {
      return { status: "allowed", origin: refererCandidate, source: "referer" }
    }
    return { status: "unknown_origin", attempted: refererCandidate }
  }

  return { status: "missing_origin" }
}

/**
 * Express-style middleware enforcing the allowlist.
 *
 * Failure responses intentionally use 403 (not 401) because the caller is not
 * authenticated on purpose — we are rejecting the *origin*, not the lack of
 * credentials.
 */
export async function enforceVkIdStartOriginAllowlist(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  const allowlist = getVkIdAllowedRequestOrigins()
  const originHeader = pickFirstHeaderValue(req.headers?.origin)
  const refererHeader = pickFirstHeaderValue(req.headers?.referer)
  const check = evaluateVkIdRequestOrigin({
    originHeader: originHeader ?? null,
    refererHeader: refererHeader ?? null,
    allowlist,
  })

  if (check.status === "allowed") {
    return next()
  }

  // Mapping to a stable, user-facing reason code that the storefront can
  // translate into a message without leaking server-side details.
  const reasonCode =
    check.status === "no_allowlist"
      ? "vk_id_return_origin_unconfigured"
      : "vk_id_origin_not_allowed"

  res.status(403).json({
    ok: false,
    code: reasonCode,
  })
}
