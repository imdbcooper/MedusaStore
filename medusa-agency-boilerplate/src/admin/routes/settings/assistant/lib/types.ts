/**
 * PR 4 — типы Admin UI вкладки «AI Ассистент».
 *
 * Эти типы повторяют публичную часть
 * [`assistant-settings`](medusa-agency-boilerplate/src/modules/assistant-settings.ts:1)
 * (`LlmProviderRow`, `AssistantSettingRow`, `LlmProviderTestResult`)
 * **без** plain-text `api_key` — backend никогда не отдаёт расшифрованный
 * ключ через admin-роуты, в строке остаётся только `api_key_last4`.
 *
 * Скопированы вручную, а не импортированы из `src/modules/...`, потому что
 * этот файл живёт в admin-bundle (Vite) и не должен тянуть серверные
 * зависимости (`pg`, `node:crypto`, и т. п.).
 *
 * Соответствие wire-shape гарантируется тестами роутов
 * (`src/api/admin/assistant/settings/__tests__/*.unit.spec.ts`) — они
 * валидируют JSON-ответы по тем же ключам.
 */

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/**
 * Публичная wire-форма провайдера. Полностью совпадает с тем, что
 * backend возвращает из `PROVIDER_PUBLIC_COLUMNS` в
 * [`assistant-settings.ts`](medusa-agency-boilerplate/src/modules/assistant-settings.ts:721).
 */
export type LlmProviderRow = {
  id: string
  name: string
  base_url: string
  api_key_last4: string
  model: string
  temperature: number
  max_tokens: number
  top_p: number | null
  timeout_ms: number
  request_headers: Record<string, string>
  is_enabled: boolean
  is_active: boolean
  fallback_priority: number | null
  last_test_at: string | null
  last_test_ok: boolean | null
  last_test_latency_ms: number | null
  last_test_error: string | null
  created_at: string
  updated_at: string
}

/**
 * `LlmProviderRow` плюс маска-плейсхолдер `••••<last4>` для отображения
 * в форме. Маска вычисляется на клиенте — backend никогда не возвращает
 * расшифрованный ключ. Используется только в `ProviderFormDrawer`.
 */
export type LlmProviderPublic = LlmProviderRow & {
  api_key_masked: string
}

// ---------------------------------------------------------------------------
// Provider — input shapes для create/update
// ---------------------------------------------------------------------------

export type LlmProviderCreateInput = {
  name: string
  base_url: string
  api_key: string
  model: string
  temperature?: number
  max_tokens?: number
  top_p?: number | null
  timeout_ms?: number
  request_headers?: Record<string, string>
  is_enabled?: boolean
  fallback_priority?: number | null
}

/**
 * Для PATCH `api_key` не передаётся, если пользователь не вводил новое
 * значение (см. `provider-form-drawer.tsx`). На бэкенде отсутствие
 * ключа в патче эквивалентно «не менять».
 */
export type LlmProviderUpdateInput = Partial<
  Omit<LlmProviderCreateInput, "name">
> & {
  name?: string
  api_key?: string
}

// ---------------------------------------------------------------------------
// Result of test probe
// ---------------------------------------------------------------------------

export type LlmProviderTestResult = {
  ok: boolean
  latency_ms: number
  http_status?: number
  error?: string
  model_available?: boolean
}

// ---------------------------------------------------------------------------
// Global setting
// ---------------------------------------------------------------------------

export type AssistantRetrievalMode = "markdown" | "vector" | "lightrag" | "auto"

export type AssistantSettingRow = {
  id: "singleton"
  system_prompt: string
  retrieval_mode: AssistantRetrievalMode
  retrieval_top_k: number
  retrieval_min_score: number
  embedding_provider: string
  embedding_model: string | null
  embedding_dimension: number
  max_history_messages: number
  max_input_chars: number
  max_output_tokens: number
  streaming_enabled: boolean
  default_locale: string
  allowed_models: string[]
  tools_enabled: Record<string, boolean>
  guardrails: Record<string, boolean>
  rate_limits: Record<string, number>
  usage_tracking_enabled: boolean
  observability: Record<string, boolean>
  version: number
  updated_by: string | null
  updated_at: string
}

/** Patch-форма для PATCH /admin/assistant/settings — все поля + `expected_version`. */
export type AssistantSettingUpdateInput = Partial<
  Omit<AssistantSettingRow, "id" | "version" | "updated_at" | "updated_by">
> & {
  expected_version?: number
  updated_by?: string | null
}

// ---------------------------------------------------------------------------
// API result wrapper
// ---------------------------------------------------------------------------

/**
 * Discriminated union для всех api-вызовов.
 * `status: 0` означает сетевую/abort-ошибку без HTTP-ответа.
 */
export type AssistantApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string; message?: string }

// ---------------------------------------------------------------------------
// Wire-envelopes (ответы конкретных эндпоинтов)
// ---------------------------------------------------------------------------

export type ListProvidersResponse = { providers: LlmProviderRow[] }
export type SingleProviderResponse = { provider: LlmProviderRow }
export type TestProviderResponse = { result: LlmProviderTestResult }
export type SingleSettingsResponse = { settings: AssistantSettingRow }
