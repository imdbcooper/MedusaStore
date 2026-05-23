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
// Telegram handoff
// ---------------------------------------------------------------------------

export type AssistantSecretMetadata = {
  is_configured: boolean
  last4: string | null
  masked: string | null
}

export type AssistantTelegramHandoffEnvironmentMode = "test" | "production"

export type AssistantTelegramHandoffOperatorReplyMode =
  | "explicit_reply_command"
  | "all_topic_messages"

export type AssistantTelegramHandoffDiagnosticsStatus =
  | "disabled"
  | "not_configured"
  | "partially_configured"
  | "ready_for_connection_test"

export type AssistantTelegramHandoffLastTestStatus =
  | "disabled"
  | "missing_credentials"
  | "dry_run_passed"
  | "connection_ok"
  | "connection_failed"
  | "not_implemented"

export type AssistantTelegramHandoffDiagnostics = {
  status: AssistantTelegramHandoffDiagnosticsStatus
  missing_fields: string[]
  can_test: boolean
}

export type AssistantTelegramHandoffConfigRow = {
  id: "singleton"
  enabled: boolean
  environment_mode: AssistantTelegramHandoffEnvironmentMode
  bot_username: string | null
  bot_token: AssistantSecretMetadata
  support_chat_id: string | null
  topics_required: boolean
  webhook_url: string | null
  webhook_secret: AssistantSecretMetadata
  allowed_operator_ids: string[]
  allowed_admin_ids: string[]
  operator_reply_mode: AssistantTelegramHandoffOperatorReplyMode
  fallback_message: string | null
  last_test_status: AssistantTelegramHandoffLastTestStatus | null
  last_test_error: string | null
  last_test_at: string | null
  created_at: string
  updated_at: string
  version: number
  diagnostics: AssistantTelegramHandoffDiagnostics
}

export type AssistantTelegramHandoffUpdateInput = Partial<
  Omit<
    AssistantTelegramHandoffConfigRow,
    | "id"
    | "bot_token"
    | "webhook_secret"
    | "last_test_status"
    | "last_test_error"
    | "last_test_at"
    | "created_at"
    | "updated_at"
    | "version"
    | "diagnostics"
  >
> & {
  bot_token?: string
  webhook_secret?: string
  expected_version?: number
}

export type AssistantTelegramHandoffTestInput = Omit<
  AssistantTelegramHandoffUpdateInput,
  "expected_version"
>

export type AssistantTelegramHandoffTestResult = {
  ok: boolean
  status: AssistantTelegramHandoffLastTestStatus
  message: string
  warnings: string[]
  missing_fields: string[]
  tested_at: string
  diagnostics: AssistantTelegramHandoffDiagnostics
  bot?: {
    id?: number | null
    username?: string | null
    first_name?: string | null
  } | null
  support_chat?: {
    id?: string | null
    type?: string | null
    title?: string | null
    username?: string | null
    is_forum?: boolean
  } | null
  bot_membership?: {
    status?: string | null
    can_manage_topics?: boolean
    can_delete_messages?: boolean
  } | null
  webhook?: {
    configured_url?: string | null
    actual_url?: string | null
    pending_update_count?: number
    last_error_message?: string | null
  } | null
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
export type SingleTelegramHandoffResponse = {
  config: AssistantTelegramHandoffConfigRow
}
export type TestTelegramHandoffResponse = {
  result: AssistantTelegramHandoffTestResult
}

export type AssistantRuntimeStatus = {
  adapter: {
    enabled: boolean
    base_url_configured: boolean
    server_token_configured: boolean
    timeout_ms: number
    missing: string[]
  }
  secrets: {
    assistant_settings_encryption_key_configured: boolean
  }
  capabilities: {
    provider_secrets_write: boolean
    assistant_backend_proxy: boolean
    catalog_reindex: boolean
    queue_processing: boolean
    markdown_sync: boolean
    vector_reindex: boolean
  }
}

export type AssistantRuntimeResponse = {
  ok: true
  runtime: AssistantRuntimeStatus
}

export type AssistantComponentStatus = Record<string, unknown>

export type AssistantBackendStats = {
  status: string
  retrieval_mode: string
  stats: Record<string, number>
  components: Record<string, AssistantComponentStatus>
}

export type AssistantStatsResponse = {
  ok: true
  stats: AssistantBackendStats
}

export type AssistantReindexIntent = {
  id: string
  store_id: string
  tenant_id: string | null
  locale: string
  event_name: string
  event_id: string | null
  action: string
  scope: string
  product_ids: string[]
  reason: string | null
  coalescing_key: string | null
  status: string
  attempts: number
  max_attempts: number
  next_attempt_at: string | null
  last_error: string | null
  assistant_job_id: string | null
  metadata: Record<string, unknown>
  created_at: string | null
  updated_at: string | null
  started_at: string | null
  finished_at: string | null
}

export type AssistantReindexIntentStats = Record<string, number>

export type AssistantReindexIntentsPayload = {
  intents: AssistantReindexIntent[]
  stats: AssistantReindexIntentStats
}

export type AssistantReindexIntentsResponse = {
  ok: true
  result: AssistantReindexIntentsPayload
}

export type AssistantIngestionJob = {
  job_id: string
  status: string
  source_type?: string | null
  source_id?: string | null
  result?: Record<string, unknown>
  error?: string | null
  created_at?: string | null
}

export type AssistantQueuedReindexResponse = {
  ok: true
  queued: boolean
  result: Record<string, unknown>
}

export type AssistantProcessQueueResult = {
  claimed: number
  processed: Array<Record<string, unknown>>
  stats: AssistantReindexIntentStats
}

export type AssistantProcessQueueResponse = {
  ok: true
  result: AssistantProcessQueueResult
}

export type AssistantJobResponse = {
  ok: true
  job: Record<string, unknown>
}

export type AssistantMarkdownSyncPayload = {
  job: AssistantIngestionJob
  chunks?: unknown[]
}

export type AssistantMarkdownSyncResponse = {
  ok: true
  result: AssistantMarkdownSyncPayload
}

export type AssistantKnowledgeDocument = {
  source_id: string
  path: string
  title: string
  description: string
  file_name: string
  store_id: string
  tenant_id?: string | null
  locale: string
  source_type?: string
}

export type AssistantKnowledgeDocumentPayload = {
  document: AssistantKnowledgeDocument
  job: AssistantIngestionJob
  chunks?: unknown[]
}

export type AssistantKnowledgeDocumentResponse = {
  ok: true
  result: AssistantKnowledgeDocumentPayload
}

export type AssistantVectorIndexResponse = {
  ok: true
  result: AssistantIngestionJob
}
