import 'server-only'

/**
 * Generic server-to-server fetch helper from Payload to Medusa Admin API.
 *
 * History / status:
 *   - Phase 2 — was used by product-reviews moderation UI (Payload custom
 *     views). Phase 4 step 7 moved moderation to Medusa Admin
 *     (`/app/product-reviews`), so the only previous consumer
 *     (`product-reviews-admin-client.ts`) is gone.
 *   - Phase 5+ (planned) — marketing UI in Payload will reuse this helper
 *     for Payload → Medusa Admin API calls; see
 *     `plans/marketing-ui-payload-cms.md` §9.
 *
 * The helper currently has no runtime callers. It is intentionally kept
 * (along with `MEDUSA_ADMIN_SECRET_API_KEY` env and the
 * docker-compose.prod.yml `MEDUSA_BACKEND_URL` override hotfix) so the
 * marketing-UI plan can adopt it without re-introducing the same
 * boilerplate. Do not delete until that plan is migrated or an
 * alternative implementation lands.
 *
 * Auth contract (plan §5.2):
 *   Authorization: Basic <base64(MEDUSA_ADMIN_SECRET_API_KEY + ':')>
 * The trailing colon is mandatory — Medusa v2 secret admin API keys use
 * Basic auth with an empty password.
 *
 * Env contract (plan §11):
 *   - MEDUSA_BACKEND_URL          base URL of Medusa backend
 *   - MEDUSA_ADMIN_SECRET_API_KEY sk_* token from createSecretAdminApiKey
 *
 * Behaviour:
 *   - Never throws. Returns a discriminated union; callers branch on `ok`.
 *   - Missing env → `{ ok: false, status: 0, error: 'config_missing' }`.
 *   - Network failures / abort → `{ ok: false, status: 0, error: 'transport_error' }`.
 *   - Non-2xx → `{ ok: false, status, error }` with backend `code`/`message`
 *     extracted when the body parses as JSON.
 *   - 204 No Content → `{ ok: true, data: null as T }` (callers expecting a
 *     body should use a `T` that includes `null`).
 *   - 8s default timeout via `AbortSignal.timeout`. Optional `signal` from
 *     the caller is honoured alongside the timeout.
 */

export type MedusaAdminFetchOptions = {
  method?: 'GET' | 'POST' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
  /** Override the default 8s timeout. Use sparingly. */
  timeoutMs?: number
}

export type MedusaAdminFetchSuccess<T> = {
  ok: true
  status: number
  data: T
}

export type MedusaAdminFetchFailure = {
  ok: false
  status: number
  error: string
  /** Raw error message from Medusa, if the body parsed as JSON. */
  message?: string
}

export type MedusaAdminFetchResult<T> =
  | MedusaAdminFetchSuccess<T>
  | MedusaAdminFetchFailure

const DEFAULT_TIMEOUT_MS = 8_000

/**
 * Read and normalise `MEDUSA_BACKEND_URL`. Strips a trailing slash so
 * callers can always use absolute paths starting with `/admin/...`.
 * Returns `null` if the env is not set.
 */
export function medusaAdminBaseUrl(): string | null {
  const raw = process.env.MEDUSA_BACKEND_URL?.trim()
  if (!raw) return null
  return raw.replace(/\/+$/, '')
}

/**
 * Build the `Authorization` header value, or `null` if the secret env is
 * missing. The trailing colon (empty password) is required by Medusa v2.
 */
export function medusaAdminAuthHeader(): string | null {
  const secret = process.env.MEDUSA_ADMIN_SECRET_API_KEY?.trim()
  if (!secret) return null
  // Buffer is available in the Node.js runtime that Payload uses for both
  // server components and route handlers, so this never executes in a
  // browser bundle.
  const encoded = Buffer.from(`${secret}:`, 'utf-8').toString('base64')
  return `Basic ${encoded}`
}

/**
 * Strict join: only paths starting with `/` are accepted. We refuse
 * absolute URLs (and any other shape) so callers cannot accidentally
 * — or maliciously — point this helper at an unrelated host. Any
 * deviation surfaces as a typed `invalid_path` error in
 * `medusaAdminFetch` rather than silently issuing a request.
 */
function joinUrl(base: string, path: string): string {
  return `${base}${path}`
}

function combineSignals(
  external: AbortSignal | undefined,
  timeoutMs: number,
): AbortSignal {
  // Native AbortSignal.timeout is available in Node 20+ and modern browsers,
  // which are the runtimes Payload 3 / Next 15 target.
  const timeoutSignal = AbortSignal.timeout(timeoutMs)
  if (!external) return timeoutSignal

  // Polyfill-free combination via AbortController; AbortSignal.any exists
  // in Node 20.5+, but we keep this manual combination for older runtimes.
  const controller = new AbortController()
  const onAbort = (reason: unknown) => {
    if (!controller.signal.aborted) controller.abort(reason)
  }
  if (external.aborted) onAbort(external.reason)
  else external.addEventListener('abort', () => onAbort(external.reason), { once: true })
  if (timeoutSignal.aborted) onAbort(timeoutSignal.reason)
  else timeoutSignal.addEventListener('abort', () => onAbort(timeoutSignal.reason), { once: true })

  return controller.signal
}

async function safeJsonParse(response: Response): Promise<unknown | null> {
  try {
    const text = await response.text()
    if (!text) return null
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

function extractErrorFromBody(body: unknown, fallback: string): {
  error: string
  message?: string
} {
  if (body && typeof body === 'object') {
    const obj = body as Record<string, unknown>
    const code = typeof obj.code === 'string' ? obj.code : undefined
    const type = typeof obj.type === 'string' ? obj.type : undefined
    const message = typeof obj.message === 'string' ? obj.message : undefined
    return {
      error: code || type || fallback,
      ...(message ? { message } : {}),
    }
  }
  return { error: fallback }
}

export async function medusaAdminFetch<T>(
  path: string,
  options: MedusaAdminFetchOptions = {},
): Promise<MedusaAdminFetchResult<T>> {
  const baseUrl = medusaAdminBaseUrl()
  const authHeader = medusaAdminAuthHeader()

  if (!baseUrl || !authHeader) {
    return { ok: false, status: 0, error: 'config_missing' }
  }

  // Per-endpoint helpers always pass a path that starts with `/admin/...`.
  // Reject anything else so an absolute URL or a typo cannot redirect the
  // helper at a different host. This makes the contract explicit instead
  // of silently coercing the value.
  if (typeof path !== 'string' || !path.startsWith('/')) {
    return { ok: false, status: 0, error: 'invalid_path' }
  }

  const method = options.method ?? 'GET'
  const headers: Record<string, string> = {
    Authorization: authHeader,
    Accept: 'application/json',
  }

  let bodyInit: BodyInit | undefined
  if (options.body !== undefined && method !== 'GET') {
    headers['Content-Type'] = 'application/json'
    bodyInit = JSON.stringify(options.body)
  }

  const signal = combineSignals(
    options.signal,
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  )

  let response: Response
  try {
    response = await fetch(joinUrl(baseUrl, path), {
      method,
      headers,
      body: bodyInit,
      signal,
      // Payload Admin views must always see fresh data — moderation reads
      // do not benefit from any HTTP cache layer on top of Medusa.
      cache: 'no-store',
    })
  } catch {
    return { ok: false, status: 0, error: 'transport_error' }
  }

  if (response.status === 204) {
    return { ok: true, status: 204, data: null as T }
  }

  const body = await safeJsonParse(response)

  if (!response.ok) {
    // 401/403 always collapse to a single `unauthorized` code regardless
    // of body shape — Medusa returns either `{ type: 'unauthorized' }`,
    // a generic `not_allowed`, or sometimes plain HTML for 401, and the
    // moderator UI must show one stable copy in all of those cases.
    if (response.status === 401 || response.status === 403) {
      const { message } = extractErrorFromBody(body, 'unauthorized')
      return {
        ok: false,
        status: response.status,
        error: 'unauthorized',
        ...(message ? { message } : {}),
      }
    }
    const fallback = response.status === 404 ? 'not_found' : 'request_failed'
    const { error, message } = extractErrorFromBody(body, fallback)
    return {
      ok: false,
      status: response.status,
      error,
      ...(message ? { message } : {}),
    }
  }

  return { ok: true, status: response.status, data: (body as T) }
}
