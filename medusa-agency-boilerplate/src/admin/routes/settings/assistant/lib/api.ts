/**
 * PR 4 — fetch-обёртки над admin-API AI-ассистента.
 *
 * Этот файл часть admin-bundle (Vite) и грузится в браузер. Поэтому:
 *   - НИКАКОГО `'use server'` / `server-only`;
 *   - никаких ссылок на `process.env` / `node:*`;
 *   - аутентификация — через session-cookie (`credentials: 'include'`),
 *     админ-UI и API на одном origin.
 *
 * Все функции возвращают `AssistantApiResult<T>` — discriminated union
 * `{ ok: true, data } | { ok: false, status, error, message? }`. Вызывающий
 * код ветвится на `result.ok` и пропускает `result.error` через
 * [`mapAssistantError`](medusa-agency-boilerplate/src/admin/routes/settings/assistant/lib/error-mapping.ts:1)
 * для toast-копирайта.
 *
 * Endpoint-конвенция повторяет
 * [`product-reviews/lib/api.ts`](medusa-agency-boilerplate/src/admin/routes/product-reviews/lib/api.ts:1):
 * 401/403 → `error: "unauthorized"`, network/abort → `status: 0, error: "network"`,
 * любые другие HTTP-ошибки → `error` из тела ответа (`code`/`type`)
 * либо синтетический `http_<status>`.
 */

import type {
  AssistantApiResult,
  AssistantSettingRow,
  AssistantSettingUpdateInput,
  ListProvidersResponse,
  LlmProviderCreateInput,
  LlmProviderRow,
  LlmProviderTestResult,
  LlmProviderUpdateInput,
  SingleProviderResponse,
  SingleSettingsResponse,
  TestProviderResponse,
} from "./types"

const BASE = "/admin/assistant/settings"

type FetchOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE"
  body?: unknown
  signal?: AbortSignal
  /** При `true` ответ парсится как `void` (для DELETE 204). */
  expectEmpty?: boolean
}

/**
 * Базовый low-level helper. Преобразует:
 *   - 401/403 → `error: "unauthorized"`;
 *   - другие 4xx/5xx → `error: body.code | body.type | "http_<status>"`;
 *   - AbortError → `error: "network", status: 0`;
 *   - любую другую транспортную ошибку → `error: "network", status: 0`.
 *
 * Для 204 No Content возвращает `{ ok: true, data: undefined }`.
 */
async function call<T>(
  path: string,
  options: FetchOptions = {},
): Promise<AssistantApiResult<T>> {
  try {
    const headers: Record<string, string> = {}
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json"
    }

    const res = await fetch(`${BASE}${path}`, {
      method: options.method ?? "GET",
      credentials: "include",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    })

    if (!res.ok) {
      let errorCode = `http_${res.status}`
      let errorMessage: string | undefined
      try {
        const text = await res.text()
        if (text) {
          const body = JSON.parse(text) as {
            code?: unknown
            type?: unknown
            error?: unknown
            message?: unknown
          }
          if (typeof body.code === "string" && body.code) {
            errorCode = body.code
          } else if (typeof body.error === "string" && body.error) {
            errorCode = body.error
          } else if (typeof body.type === "string" && body.type) {
            errorCode = body.type
          }
          if (typeof body.message === "string") {
            errorMessage = body.message
          }
        }
      } catch {
        // тело не было JSON — оставляем синтетический http_<status>
      }
      if (res.status === 401 || res.status === 403) {
        errorCode = "unauthorized"
      }
      return {
        ok: false,
        status: res.status,
        error: errorCode,
        message: errorMessage,
      }
    }

    if (options.expectEmpty || res.status === 204) {
      return { ok: true, data: undefined as unknown as T }
    }

    const text = await res.text()
    const data = (text ? JSON.parse(text) : null) as T
    return { ok: true, data }
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: "network",
      message: err instanceof Error ? err.message : undefined,
    }
  }
}

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

/**
 * GET /admin/assistant/settings/providers
 */
export function listProviders(opts?: {
  enabledOnly?: boolean
  signal?: AbortSignal
}): Promise<AssistantApiResult<ListProvidersResponse>> {
  const qs = opts?.enabledOnly ? "?enabled_only=true" : ""
  return call<ListProvidersResponse>(`/providers${qs}`, {
    method: "GET",
    signal: opts?.signal,
  })
}

/**
 * POST /admin/assistant/settings/providers
 */
export function createProvider(
  input: LlmProviderCreateInput,
  signal?: AbortSignal,
): Promise<AssistantApiResult<SingleProviderResponse>> {
  return call<SingleProviderResponse>("/providers", {
    method: "POST",
    body: input,
    signal,
  })
}

/**
 * GET /admin/assistant/settings/providers/:id
 */
export function getProvider(
  id: string,
  signal?: AbortSignal,
): Promise<AssistantApiResult<SingleProviderResponse>> {
  return call<SingleProviderResponse>(
    `/providers/${encodeURIComponent(id)}`,
    { method: "GET", signal },
  )
}

/**
 * PATCH /admin/assistant/settings/providers/:id
 */
export function updateProvider(
  id: string,
  patch: LlmProviderUpdateInput,
  signal?: AbortSignal,
): Promise<AssistantApiResult<SingleProviderResponse>> {
  return call<SingleProviderResponse>(
    `/providers/${encodeURIComponent(id)}`,
    { method: "PATCH", body: patch, signal },
  )
}

/**
 * DELETE /admin/assistant/settings/providers/:id → 204.
 */
export function deleteProvider(
  id: string,
  signal?: AbortSignal,
): Promise<AssistantApiResult<void>> {
  return call<void>(`/providers/${encodeURIComponent(id)}`, {
    method: "DELETE",
    signal,
    expectEmpty: true,
  })
}

/**
 * POST /admin/assistant/settings/providers/:id/activate
 */
export function activateProvider(
  id: string,
  signal?: AbortSignal,
): Promise<AssistantApiResult<SingleProviderResponse>> {
  return call<SingleProviderResponse>(
    `/providers/${encodeURIComponent(id)}/activate`,
    { method: "POST", body: {}, signal },
  )
}

/**
 * POST /admin/assistant/settings/providers/:id/test?prompt=…
 */
export function testProvider(
  id: string,
  opts?: { prompt?: string; signal?: AbortSignal },
): Promise<AssistantApiResult<TestProviderResponse>> {
  const qs =
    opts?.prompt && opts.prompt.trim()
      ? `?prompt=${encodeURIComponent(opts.prompt.trim())}`
      : ""
  return call<TestProviderResponse>(
    `/providers/${encodeURIComponent(id)}/test${qs}`,
    { method: "POST", body: {}, signal: opts?.signal },
  )
}

/**
 * POST /admin/assistant/settings/providers/reorder-fallback
 */
export function reorderFallback(
  orderedIds: string[],
  signal?: AbortSignal,
): Promise<AssistantApiResult<ListProvidersResponse>> {
  return call<ListProvidersResponse>("/providers/reorder-fallback", {
    method: "POST",
    body: { ordered_ids: orderedIds },
    signal,
  })
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

/**
 * GET /admin/assistant/settings
 */
export function getSettings(
  signal?: AbortSignal,
): Promise<AssistantApiResult<SingleSettingsResponse>> {
  return call<SingleSettingsResponse>("", { method: "GET", signal })
}

/**
 * PATCH /admin/assistant/settings
 *
 * Принимает любые поля настройки + `expected_version` (optimistic lock).
 * При несовпадении версии backend возвращает 409 + `code: "version_mismatch"`.
 */
export function updateSettings(
  patch: AssistantSettingUpdateInput,
  signal?: AbortSignal,
): Promise<AssistantApiResult<SingleSettingsResponse>> {
  return call<SingleSettingsResponse>("", {
    method: "PATCH",
    body: patch,
    signal,
  })
}

// ---------------------------------------------------------------------------
// Re-exports for convenience
// ---------------------------------------------------------------------------

export type {
  AssistantApiResult,
  AssistantSettingRow,
  AssistantSettingUpdateInput,
  ListProvidersResponse,
  LlmProviderCreateInput,
  LlmProviderRow,
  LlmProviderTestResult,
  LlmProviderUpdateInput,
  SingleProviderResponse,
  SingleSettingsResponse,
  TestProviderResponse,
}
