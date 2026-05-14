/**
 * Pure helpers for the storefront VK ID callback proxy.
 *
 * Kept out of the route handler so they can be tested directly with the
 * Node test runner (see `vk-id-callback-proxy.spec.ts`) without spinning up
 * a Next.js runtime, mirroring the existing `delivery-checkout.spec.ts`
 * style in this storefront.
 */

/**
 * Whitelist of VK callback query parameters we forward to the Medusa
 * backend. Anything outside this set is dropped on the storefront edge,
 * which keeps the upstream `/store/vk-id/callback` validator happy and
 * avoids accidentally proxying noise from misbehaving redirectors.
 *
 * `state` and `code` are required for the success path; `error` and
 * `error_description` are returned by VK on user-cancelled or denied
 * authorizations; `device_id` is part of the VK ID OAuth response and is
 * carried through so the backend can diagnose device-bound flows.
 */
export const ALLOWED_VK_PROXY_PARAMS = [
  "state",
  "code",
  "device_id",
  "error",
  "error_description",
] as const

export type AllowedVkProxyParam = (typeof ALLOWED_VK_PROXY_PARAMS)[number]

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, "")
}

/**
 * Build the upstream backend URL we proxy the VK callback to. Only the
 * whitelisted params from `incoming` are carried over; everything else is
 * dropped on the storefront edge.
 */
export function buildVkProxyBackendUrl(input: {
  backendUrl: string
  incoming: URLSearchParams
}): string {
  const base = trimTrailingSlashes(input.backendUrl)
  const url = new URL(`${base}/store/vk-id/callback`)

  for (const key of ALLOWED_VK_PROXY_PARAMS) {
    const value = input.incoming.get(key)
    if (value !== null && value.length > 0) {
      url.searchParams.set(key, value)
    }
  }

  return url.toString()
}

/**
 * Build the storefront error redirect URL used when the proxy itself
 * cannot reach the backend or sees an unexpected response. Mirrors the
 * existing `/ru/account?vk_login_error=...` shape consumed by
 * `account/page.tsx` so users land in a familiar surface.
 *
 * The `STOREFRONT_BASE_URL` may be the bare site origin
 * (e.g. `https://studio.slavx.ru`) or include a path prefix. We normalize
 * trailing slashes and append `/ru/account` only if no path is already
 * present so admins keeping the default behavior do not need to touch env.
 */
export function buildVkProxyErrorRedirectUrl(input: {
  storefrontBaseUrl: string
  reason: string
}): string {
  const base = trimTrailingSlashes(input.storefrontBaseUrl)
  const target = new URL(`${base}/ru/account`)
  target.searchParams.set("vk_login_error", input.reason)
  return target.toString()
}

export type VkProxyOutcome =
  | { kind: "redirect"; location: string; status: 302 | 303 }
  | { kind: "unexpected" }

/**
 * Decide what to do with the upstream Medusa response. Only redirect
 * statuses with a populated `Location` header are considered a success;
 * everything else falls through to a controlled storefront error redirect.
 *
 * Backend currently returns `302` (`res.redirect(302, ...)`), but we accept
 * `303` defensively in case the redirect helper changes.
 */
export function decideVkProxyOutcome(input: {
  status: number
  location: string | null | undefined
}): VkProxyOutcome {
  const isRedirect = input.status === 302 || input.status === 303
  const hasLocation = typeof input.location === "string" && input.location.length > 0
  if (isRedirect && hasLocation) {
    return {
      kind: "redirect",
      location: input.location as string,
      status: input.status === 303 ? 303 : 302,
    }
  }
  return { kind: "unexpected" }
}
