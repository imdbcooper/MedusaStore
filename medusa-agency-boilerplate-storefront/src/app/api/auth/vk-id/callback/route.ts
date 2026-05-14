/**
 * Storefront proxy for the VK ID OAuth callback.
 *
 * Why this exists:
 *   - Medusa's framework router applies `ensurePublishableApiKeyMiddleware`
 *     to the entire `/store/*` namespace. There is no per-route exemption,
 *     so any request to `/store/vk-id/callback` from a browser without the
 *     `x-publishable-api-key` header (which VK cannot inject) responds with
 *     `not_allowed`. See `node_modules/@medusajs/framework/dist/http/router.js`
 *     and `medusa-agency-boilerplate/src/api/store/vk-id/callback/route.ts`.
 *   - Moving the public VK redirect URI to a storefront route handler lets
 *     us forward to the backend with the publishable key attached on the
 *     server side, while still preserving the existing backend logic that
 *     mints the `_medusa_jwt` cookie and the `Location` redirect.
 *
 * Contract:
 *   - VK is configured to redirect to `<storefront origin>/api/auth/vk-id/callback`.
 *   - This handler forwards `code`, `state`, and any `error*` params to the
 *     backend `/store/vk-id/callback` over the internal Medusa URL,
 *     including the publishable API key header.
 *   - The backend responds with a 302/303 + `Set-Cookie: _medusa_jwt=...`
 *     and a `Location` pointing at the final storefront return URL. Both
 *     are forwarded verbatim to the browser, so the JWT cookie is observed
 *     by the storefront on the same public origin.
 *
 * Security:
 *   - The handler only ever forwards from a fixed allowlist of upstream
 *     query params (`code`, `state`, `device_id`, `error`,
 *     `error_description`). Anything else from VK is dropped.
 *   - The publishable key is read from the server-only env (`NEXT_PUBLIC_*`
 *     is OK for read here because the value is non-secret by design).
 *   - The backend continues to validate the signed `state`, so this proxy
 *     adds no new CSRF surface beyond what existed at `/store/vk-id/callback`.
 */

import { NextRequest, NextResponse } from "next/server"

import {
  buildVkProxyBackendUrl,
  buildVkProxyErrorRedirectUrl,
  decideVkProxyOutcome,
  ALLOWED_VK_PROXY_PARAMS,
} from "@lib/util/vk-id-callback-proxy"

export const dynamic = "force-dynamic"
export const revalidate = 0

const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
const BACKEND_URL =
  process.env.MEDUSA_BACKEND_URL ||
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
  ""
const STOREFRONT_BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:8000"

function logProxyError(label: string, fields: Record<string, unknown>) {
  // We deliberately keep server-side logs cheap and structured. The handler
  // is on the public ingress path, so noisy stack traces would invite log
  // pollution from abusive crawlers replaying VK callbacks.
  console.error(`[vk-id-proxy] ${label}`, fields)
}

function errorRedirect(reason: string) {
  const url = buildVkProxyErrorRedirectUrl({
    storefrontBaseUrl: STOREFRONT_BASE_URL,
    reason,
  })
  return NextResponse.redirect(url, 302)
}

export async function GET(request: NextRequest) {
  if (!BACKEND_URL) {
    logProxyError("missing_backend_url", {})
    return errorRedirect("vk_id_proxy_misconfigured")
  }

  if (!PUBLISHABLE_KEY) {
    logProxyError("missing_publishable_key", {})
    return errorRedirect("vk_id_proxy_misconfigured")
  }

  const incoming = request.nextUrl.searchParams
  const state = incoming.get("state")
  const code = incoming.get("code")
  const error = incoming.get("error")

  if (!state) {
    // VK never returns a callback without `state`. Treat it as a tampered
    // request and short-circuit before contacting the backend.
    logProxyError("missing_state", { has_code: Boolean(code), has_error: Boolean(error) })
    return errorRedirect("vk_id_callback_invalid")
  }

  if (!code && !error) {
    // VK returns either `code` (success) or `error` (denied/abort). Neither
    // means something unrelated proxied to this URL.
    logProxyError("missing_code_and_error", {})
    return errorRedirect("vk_id_callback_invalid")
  }

  const upstreamUrl = buildVkProxyBackendUrl({
    backendUrl: BACKEND_URL,
    incoming,
  })

  let upstream: Response
  try {
    upstream = await fetch(upstreamUrl, {
      method: "GET",
      headers: {
        "x-publishable-api-key": PUBLISHABLE_KEY,
        accept: "application/json, text/html",
      },
      redirect: "manual",
      cache: "no-store",
    })
  } catch (cause) {
    logProxyError("upstream_fetch_failed", {
      error: cause instanceof Error ? cause.message : String(cause),
    })
    return errorRedirect("vk_id_callback_upstream_failed")
  }

  const decision = decideVkProxyOutcome({
    status: upstream.status,
    location: upstream.headers.get("location"),
  })

  if (decision.kind === "redirect") {
    const response = NextResponse.redirect(decision.location, decision.status)

    // `getSetCookie()` returns each Set-Cookie header separately. Older
    // runtimes lacking the helper fall back to the combined header, which
    // browsers still parse correctly for a single cookie (the only one we
    // expect: `_medusa_jwt`).
    type SetCookieAware = Headers & { getSetCookie?: () => string[] }
    const headers = upstream.headers as SetCookieAware
    const setCookies =
      typeof headers.getSetCookie === "function"
        ? headers.getSetCookie()
        : headers.get("set-cookie")
        ? [headers.get("set-cookie") as string]
        : []

    for (const cookie of setCookies) {
      response.headers.append("set-cookie", cookie)
    }

    return response
  }

  let bodyExcerpt = ""
  try {
    const text = await upstream.text()
    bodyExcerpt = text.slice(0, 300)
  } catch {
    // Best-effort body capture only; ignore failures.
  }

  logProxyError("unexpected_upstream_response", {
    status: upstream.status,
    body_excerpt: bodyExcerpt,
  })

  return errorRedirect("vk_id_callback_failed")
}

export const __VK_PROXY_TEST_ONLY = {
  ALLOWED_VK_PROXY_PARAMS,
}
