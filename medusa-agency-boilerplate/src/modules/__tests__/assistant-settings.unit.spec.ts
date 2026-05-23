/**
 * Unit tests for [`assistant-settings.ts`](medusa-agency-boilerplate/src/modules/assistant-settings.ts:1).
 *
 * Pattern: hand-rolled in-memory `pg.raw` dispatcher keyed off the
 * `-- @assistant:<op>` tag we emit on the first non-empty SQL line.
 * No real Postgres, no MikroORM, no Medusa container — same convention as
 * [`product-reviews-delete-all-transaction.unit.spec.ts`](medusa-agency-boilerplate/src/modules/__tests__/product-reviews-delete-all-transaction.unit.spec.ts:1).
 *
 * The mock is structurally faithful enough that:
 *  - every CRUD/transaction path the module exercises is observable,
 *  - encryption goes through the real
 *    [`secret-cipher.ts`](medusa-agency-boilerplate/src/lib/crypto/secret-cipher.ts:1)
 *    so we exercise the actual AES-256-GCM round-trip on every test.
 */

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals"
import { randomBytes } from "node:crypto"

import {
  AssistantSettingsError,
  createLlmProvider,
  deleteLlmProvider,
  ensureAssistantSettingsTables,
  getAssistantSetting,
  getEffectiveAssistantConfig,
  getLlmProvider,
  listLlmProviders,
  reorderFallbackChain,
  seedFromEnvIfEmpty,
  setActiveLlmProvider,
  testLlmProvider,
  updateAssistantSetting,
  updateLlmProvider,
  type LlmProviderRow,
  type PgConnectionLike,
} from "../assistant-settings"
import { resetEncryptionKeyCacheForTests } from "../../lib/crypto/secret-cipher"

// ---------------------------------------------------------------------------
// In-memory pg mock
// ---------------------------------------------------------------------------

type ProviderState = {
  id: string
  name: string
  base_url: string
  api_key_ciphertext: Buffer
  api_key_iv: Buffer
  api_key_tag: Buffer
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
  last_test_at: Date | null
  last_test_ok: boolean | null
  last_test_latency_ms: number | null
  last_test_error: string | null
  created_at: Date
  updated_at: Date
}

type SettingState = {
  system_prompt: string
  retrieval_mode: string
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
  active_handoff_channel: string
  version: number
  updated_by: string | null
  updated_at: Date
}

type TelegramState = {
  enabled: boolean
  environment_mode: string
  bot_username: string | null
  bot_token_ciphertext: Buffer | null
  bot_token_iv: Buffer | null
  bot_token_tag: Buffer | null
  bot_token_last4: string | null
  support_chat_id: string | null
  topics_required: boolean
  webhook_url: string | null
  webhook_secret_ciphertext: Buffer | null
  webhook_secret_iv: Buffer | null
  webhook_secret_tag: Buffer | null
  webhook_secret_last4: string | null
  allowed_operator_ids: string[]
  allowed_admin_ids: string[]
  operator_reply_mode: string
  fallback_message: string | null
  last_test_status: string | null
  last_test_error: string | null
  last_test_at: Date | null
  created_at: Date
  updated_at: Date
  version: number
}

type VkState = {
  enabled: boolean
  environment_mode: string
  group_id: string | null
  support_peer_id: string | null
  webhook_url: string | null
  community_access_token_ciphertext: Buffer | null
  community_access_token_iv: Buffer | null
  community_access_token_tag: Buffer | null
  community_access_token_last4: string | null
  secret_key_ciphertext: Buffer | null
  secret_key_iv: Buffer | null
  secret_key_tag: Buffer | null
  secret_key_last4: string | null
  confirmation_code_ciphertext: Buffer | null
  confirmation_code_iv: Buffer | null
  confirmation_code_tag: Buffer | null
  confirmation_code_last4: string | null
  allowed_operator_ids: string[]
  allowed_admin_ids: string[]
  operator_reply_mode: string
  fallback_message: string | null
  last_test_status: string | null
  last_test_error: string | null
  last_test_at: Date | null
  created_at: Date
  updated_at: Date
  version: number
}

type DbState = {
  providers: Map<string, ProviderState>
  setting: SettingState | null
  telegram: TelegramState | null
  vk: VkState | null
  /** Monotonic clock for `now()` so ordering by created_at/updated_at is
   *  stable inside a single test run. */
  clock: number
}

class UniqueViolationError extends Error {
  public readonly code = "23505"
  constructor(message: string) {
    super(message)
    this.name = "UniqueViolationError"
  }
}

function getTag(sql: string): string {
  // Tag lives on the first non-empty line and looks like
  //   `-- @assistant:<tag>`.
  const lines = sql.split("\n")
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const match = trimmed.match(/^--\s*@assistant:([\w-]+)/)
    if (match) return match[1]
    return ""
  }
  return ""
}

function projectPublicProvider(p: ProviderState): Record<string, unknown> {
  return {
    id: p.id,
    name: p.name,
    base_url: p.base_url,
    api_key_last4: p.api_key_last4,
    model: p.model,
    temperature: p.temperature,
    max_tokens: p.max_tokens,
    top_p: p.top_p,
    timeout_ms: p.timeout_ms,
    request_headers: p.request_headers,
    is_enabled: p.is_enabled,
    is_active: p.is_active,
    fallback_priority: p.fallback_priority,
    last_test_at: p.last_test_at,
    last_test_ok: p.last_test_ok,
    last_test_latency_ms: p.last_test_latency_ms,
    last_test_error: p.last_test_error,
    created_at: p.created_at,
    updated_at: p.updated_at,
  }
}

function projectRuntimeProvider(p: ProviderState): Record<string, unknown> {
  return {
    ...projectPublicProvider(p),
    api_key_ciphertext: p.api_key_ciphertext,
    api_key_iv: p.api_key_iv,
    api_key_tag: p.api_key_tag,
  }
}

function projectSetting(s: SettingState): Record<string, unknown> {
  return {
    id: "singleton",
    system_prompt: s.system_prompt,
    retrieval_mode: s.retrieval_mode,
    retrieval_top_k: s.retrieval_top_k,
    retrieval_min_score: s.retrieval_min_score,
    embedding_provider: s.embedding_provider,
    embedding_model: s.embedding_model,
    embedding_dimension: s.embedding_dimension,
    max_history_messages: s.max_history_messages,
    max_input_chars: s.max_input_chars,
    max_output_tokens: s.max_output_tokens,
    streaming_enabled: s.streaming_enabled,
    default_locale: s.default_locale,
    allowed_models: s.allowed_models,
    tools_enabled: s.tools_enabled,
    guardrails: s.guardrails,
    rate_limits: s.rate_limits,
    usage_tracking_enabled: s.usage_tracking_enabled,
    observability: s.observability,
    active_handoff_channel: s.active_handoff_channel,
    version: s.version,
    updated_by: s.updated_by,
    updated_at: s.updated_at,
  }
}

function projectTelegramRuntime(t: TelegramState): Record<string, unknown> {
  return {
    id: "singleton",
    enabled: t.enabled,
    environment_mode: t.environment_mode,
    bot_username: t.bot_username,
    bot_token_last4: t.bot_token_last4,
    support_chat_id: t.support_chat_id,
    topics_required: t.topics_required,
    webhook_url: t.webhook_url,
    webhook_secret_last4: t.webhook_secret_last4,
    allowed_operator_ids: t.allowed_operator_ids,
    allowed_admin_ids: t.allowed_admin_ids,
    operator_reply_mode: t.operator_reply_mode,
    fallback_message: t.fallback_message,
    last_test_status: t.last_test_status,
    last_test_error: t.last_test_error,
    last_test_at: t.last_test_at,
    created_at: t.created_at,
    updated_at: t.updated_at,
    version: t.version,
    bot_token_ciphertext: t.bot_token_ciphertext,
    bot_token_iv: t.bot_token_iv,
    bot_token_tag: t.bot_token_tag,
    webhook_secret_ciphertext: t.webhook_secret_ciphertext,
    webhook_secret_iv: t.webhook_secret_iv,
    webhook_secret_tag: t.webhook_secret_tag,
  }
}

function projectVkRuntime(v: VkState): Record<string, unknown> {
  return {
    id: "singleton",
    enabled: v.enabled,
    environment_mode: v.environment_mode,
    group_id: v.group_id,
    support_peer_id: v.support_peer_id,
    webhook_url: v.webhook_url,
    community_access_token_last4: v.community_access_token_last4,
    secret_key_last4: v.secret_key_last4,
    confirmation_code_last4: v.confirmation_code_last4,
    allowed_operator_ids: v.allowed_operator_ids,
    allowed_admin_ids: v.allowed_admin_ids,
    operator_reply_mode: v.operator_reply_mode,
    fallback_message: v.fallback_message,
    last_test_status: v.last_test_status,
    last_test_error: v.last_test_error,
    last_test_at: v.last_test_at,
    created_at: v.created_at,
    updated_at: v.updated_at,
    version: v.version,
    community_access_token_ciphertext: v.community_access_token_ciphertext,
    community_access_token_iv: v.community_access_token_iv,
    community_access_token_tag: v.community_access_token_tag,
    secret_key_ciphertext: v.secret_key_ciphertext,
    secret_key_iv: v.secret_key_iv,
    secret_key_tag: v.secret_key_tag,
    confirmation_code_ciphertext: v.confirmation_code_ciphertext,
    confirmation_code_iv: v.confirmation_code_iv,
    confirmation_code_tag: v.confirmation_code_tag,
  }
}

function nextNow(state: DbState): Date {
  state.clock += 1
  // A base epoch in 2024 + monotonic ms increment.
  return new Date(1_700_000_000_000 + state.clock)
}

/** Parse the `set ${cols} where …` clause and extract column names that are
 *  bound to a `?` placeholder (in order).  Skips literal expressions like
 *  `version = version + 1` and `updated_at = now()`. */
function extractSetColumns(sql: string): string[] {
  const match = sql.match(/set\s+([\s\S]+?)\s+where/i)
  if (!match) return []
  const body = match[1]
  const cols: string[] = []
  // Split on commas at the top level — neither column name nor cast contains
  // a comma, so a naive split is safe for this module's SQL.
  for (const piece of body.split(",")) {
    const m = piece.trim().match(/^(\w+)\s*=\s*\?(?:::\w+)?\s*$/)
    if (m) cols.push(m[1])
  }
  return cols
}

function applyProviderColumn(
  p: ProviderState,
  column: string,
  value: unknown
): void {
  switch (column) {
    case "name":
      p.name = String(value)
      break
    case "base_url":
      p.base_url = String(value)
      break
    case "model":
      p.model = String(value)
      break
    case "temperature":
      p.temperature = Number(value)
      break
    case "max_tokens":
      p.max_tokens = Number(value)
      break
    case "top_p":
      p.top_p = value === null || value === undefined ? null : Number(value)
      break
    case "timeout_ms":
      p.timeout_ms = Number(value)
      break
    case "request_headers":
      p.request_headers =
        typeof value === "string" ? JSON.parse(value) : (value as Record<string, string>) ?? {}
      break
    case "is_enabled":
      p.is_enabled = Boolean(value)
      break
    case "is_active":
      p.is_active = Boolean(value)
      break
    case "fallback_priority":
      p.fallback_priority =
        value === null || value === undefined ? null : Number(value)
      break
    case "api_key_ciphertext":
      p.api_key_ciphertext = value as Buffer
      break
    case "api_key_iv":
      p.api_key_iv = value as Buffer
      break
    case "api_key_tag":
      p.api_key_tag = value as Buffer
      break
    case "api_key_last4":
      p.api_key_last4 = String(value)
      break
    case "last_test_at":
      p.last_test_at = (value as Date | null) ?? null
      break
    case "last_test_ok":
      p.last_test_ok = value === null || value === undefined ? null : Boolean(value)
      break
    case "last_test_latency_ms":
      p.last_test_latency_ms =
        value === null || value === undefined ? null : Number(value)
      break
    case "last_test_error":
      p.last_test_error =
        value === null || value === undefined ? null : String(value)
      break
    default:
      // Unknown columns are silently ignored — assert noise lives in the
      // module's column lists, which we do not want to duplicate here.
      break
  }
}

function applySettingColumn(
  s: SettingState,
  column: string,
  value: unknown
): void {
  switch (column) {
    case "system_prompt":
    case "retrieval_mode":
    case "embedding_provider":
    case "embedding_model":
    case "default_locale":
      ;(s as any)[column] = value === null || value === undefined ? null : String(value)
      break
    case "retrieval_top_k":
    case "retrieval_min_score":
    case "embedding_dimension":
    case "max_history_messages":
    case "max_input_chars":
    case "max_output_tokens":
      ;(s as any)[column] = Number(value)
      break
    case "streaming_enabled":
    case "usage_tracking_enabled":
      ;(s as any)[column] = Boolean(value)
      break
    case "allowed_models":
    case "tools_enabled":
    case "guardrails":
    case "rate_limits":
    case "observability":
      ;(s as any)[column] =
        typeof value === "string" ? JSON.parse(value) : value
      break
    case "updated_by":
      s.updated_by =
        value === null || value === undefined ? null : String(value)
      break
    case "active_handoff_channel":
      s.active_handoff_channel = String(value)
      break
    default:
      break
  }
}

function buildMockPg(state: DbState): PgConnectionLike {
  const raw = async <T = unknown>(
    sql: string,
    bindings: unknown[] = []
  ): Promise<{ rows?: T[]; rowCount?: number }> => {
    const tag = getTag(sql)
    switch (tag) {
      case "create-table-llm-provider":
      case "create-index-llm-active-one":
      case "create-index-llm-fallback-priority":
      case "create-index-llm-enabled-priority":
      case "create-table-setting":
      case "add-column-setting-active-handoff-channel":
      case "create-table-telegram-handoff":
      case "create-table-vk-handoff":
        return { rows: [], rowCount: 0 }

      case "seed-singleton": {
        if (state.setting) return { rows: [], rowCount: 0 }
        const [
          system_prompt,
          tools_enabled_json,
          guardrails_json,
          rate_limits_json,
          observability_json,
        ] = bindings as string[]
        state.setting = {
          system_prompt,
          retrieval_mode: "auto",
          retrieval_top_k: 5,
          retrieval_min_score: 0,
          embedding_provider: "hashing",
          embedding_model: null,
          embedding_dimension: 384,
          max_history_messages: 10,
          max_input_chars: 4000,
          max_output_tokens: 1024,
          streaming_enabled: true,
          default_locale: "ru",
          allowed_models: [],
          tools_enabled: JSON.parse(tools_enabled_json),
          guardrails: JSON.parse(guardrails_json),
          rate_limits: JSON.parse(rate_limits_json),
          usage_tracking_enabled: true,
          observability: JSON.parse(observability_json),
          active_handoff_channel: "telegram",
          version: 1,
          updated_by: null,
          updated_at: nextNow(state),
        }
        return { rows: [], rowCount: 1 }
      }

      case "seed-telegram-handoff-singleton": {
        if (state.telegram) return { rows: [], rowCount: 0 }
        const [fallback_message] = bindings as [string]
        const now = nextNow(state)
        state.telegram = {
          enabled: false,
          environment_mode: "test",
          bot_username: null,
          bot_token_ciphertext: null,
          bot_token_iv: null,
          bot_token_tag: null,
          bot_token_last4: null,
          support_chat_id: null,
          topics_required: true,
          webhook_url: null,
          webhook_secret_ciphertext: null,
          webhook_secret_iv: null,
          webhook_secret_tag: null,
          webhook_secret_last4: null,
          allowed_operator_ids: [],
          allowed_admin_ids: [],
          operator_reply_mode: "explicit_reply_command",
          fallback_message,
          last_test_status: null,
          last_test_error: null,
          last_test_at: null,
          created_at: now,
          updated_at: now,
          version: 1,
        }
        return { rows: [], rowCount: 1 }
      }

      case "seed-vk-handoff-singleton": {
        if (state.vk) return { rows: [], rowCount: 0 }
        const [fallback_message] = bindings as [string]
        const now = nextNow(state)
        state.vk = {
          enabled: false,
          environment_mode: "test",
          group_id: null,
          support_peer_id: null,
          webhook_url: null,
          community_access_token_ciphertext: null,
          community_access_token_iv: null,
          community_access_token_tag: null,
          community_access_token_last4: null,
          secret_key_ciphertext: null,
          secret_key_iv: null,
          secret_key_tag: null,
          secret_key_last4: null,
          confirmation_code_ciphertext: null,
          confirmation_code_iv: null,
          confirmation_code_tag: null,
          confirmation_code_last4: null,
          allowed_operator_ids: [],
          allowed_admin_ids: [],
          operator_reply_mode: "explicit_ticket_command",
          fallback_message,
          last_test_status: null,
          last_test_error: null,
          last_test_at: null,
          created_at: now,
          updated_at: now,
          version: 1,
        }
        return { rows: [], rowCount: 1 }
      }

      case "list-providers": {
        const rows = [...state.providers.values()]
          .sort(
            (a, b) => a.created_at.getTime() - b.created_at.getTime()
          )
          .map(projectPublicProvider) as unknown as T[]
        return { rows }
      }
      case "list-providers-enabled": {
        const rows = [...state.providers.values()]
          .filter((p) => p.is_enabled)
          .sort(
            (a, b) => a.created_at.getTime() - b.created_at.getTime()
          )
          .map(projectPublicProvider) as unknown as T[]
        return { rows }
      }

      case "get-provider":
      case "lock-provider": {
        const id = bindings[0] as string
        const p = state.providers.get(id)
        return {
          rows: p ? ([projectPublicProvider(p)] as unknown as T[]) : [],
        }
      }

      case "get-provider-runtime": {
        const id = bindings[0] as string
        const p = state.providers.get(id)
        return {
          rows: p ? ([projectRuntimeProvider(p)] as unknown as T[]) : [],
        }
      }

      case "insert-provider": {
        const [
          id,
          name,
          base_url,
          ciphertext,
          iv,
          tag2,
          last4,
          model,
          temperature,
          max_tokens,
          top_p,
          timeout_ms,
          request_headers_json,
          is_enabled,
          fallback_priority,
        ] = bindings as [
          string,
          string,
          string,
          Buffer,
          Buffer,
          Buffer,
          string,
          string,
          number,
          number,
          number | null,
          number,
          string,
          boolean,
          number | null,
        ]
        for (const existing of state.providers.values()) {
          if (existing.name === name) {
            throw new UniqueViolationError(
              `duplicate name: ${name}`
            )
          }
        }
        const now = nextNow(state)
        const provider: ProviderState = {
          id,
          name,
          base_url,
          api_key_ciphertext: ciphertext,
          api_key_iv: iv,
          api_key_tag: tag2,
          api_key_last4: last4,
          model,
          temperature,
          max_tokens,
          top_p,
          timeout_ms,
          request_headers: JSON.parse(request_headers_json),
          is_enabled,
          is_active: false,
          fallback_priority,
          last_test_at: null,
          last_test_ok: null,
          last_test_latency_ms: null,
          last_test_error: null,
          created_at: now,
          updated_at: now,
        }
        state.providers.set(id, provider)
        return {
          rows: [projectPublicProvider(provider)] as unknown as T[],
          rowCount: 1,
        }
      }

      case "update-provider": {
        const cols = extractSetColumns(sql)
        const id = bindings[bindings.length - 1] as string
        const provider = state.providers.get(id)
        if (!provider) {
          return { rows: [], rowCount: 0 }
        }
        // Apply each column's binding in order.
        for (let i = 0; i < cols.length; i++) {
          if (cols[i] === "name") {
            const newName = String(bindings[i])
            for (const other of state.providers.values()) {
              if (other.id !== id && other.name === newName) {
                throw new UniqueViolationError(`duplicate name: ${newName}`)
              }
            }
          }
          applyProviderColumn(provider, cols[i], bindings[i])
        }
        provider.updated_at = nextNow(state)
        return {
          rows: [projectPublicProvider(provider)] as unknown as T[],
          rowCount: 1,
        }
      }

      case "delete-provider": {
        const id = bindings[0] as string
        const had = state.providers.delete(id)
        return { rows: [], rowCount: had ? 1 : 0 }
      }

      case "count-other-enabled": {
        const id = bindings[0] as string
        let count = 0
        for (const p of state.providers.values()) {
          if (p.id !== id && p.is_enabled) count += 1
        }
        return { rows: [{ count }] as unknown as T[] }
      }

      case "get-active-provider": {
        for (const p of state.providers.values()) {
          if (p.is_active) {
            return {
              rows: [projectPublicProvider(p)] as unknown as T[],
            }
          }
        }
        return { rows: [] }
      }

      case "get-active-provider-runtime": {
        for (const p of state.providers.values()) {
          if (p.is_active) {
            return {
              rows: [projectRuntimeProvider(p)] as unknown as T[],
            }
          }
        }
        return { rows: [] }
      }

      case "get-fallback-chain": {
        const rows = [...state.providers.values()]
          .filter((p) => p.is_enabled && p.fallback_priority !== null)
          .sort(
            (a, b) =>
              (a.fallback_priority ?? 0) - (b.fallback_priority ?? 0)
          )
          .map(projectPublicProvider) as unknown as T[]
        return { rows }
      }

      case "get-fallback-chain-runtime": {
        const rows = [...state.providers.values()]
          .filter((p) => p.is_enabled && p.fallback_priority !== null)
          .sort(
            (a, b) =>
              (a.fallback_priority ?? 0) - (b.fallback_priority ?? 0)
          )
          .map(projectRuntimeProvider) as unknown as T[]
        return { rows }
      }

      case "clear-active": {
        for (const p of state.providers.values()) {
          if (p.is_active) {
            p.is_active = false
            p.updated_at = nextNow(state)
          }
        }
        return { rows: [], rowCount: 0 }
      }

      case "set-active": {
        const id = bindings[0] as string
        const p = state.providers.get(id)
        if (!p) return { rows: [], rowCount: 0 }
        p.is_active = true
        p.updated_at = nextNow(state)
        return {
          rows: [projectPublicProvider(p)] as unknown as T[],
          rowCount: 1,
        }
      }

      case "clear-fallback-priority": {
        const ids = bindings[0] as string[]
        for (const id of ids) {
          const p = state.providers.get(id)
          if (p) {
            p.fallback_priority = null
            p.updated_at = nextNow(state)
          }
        }
        return { rows: [], rowCount: ids.length }
      }

      case "set-fallback-priority": {
        const [priority, id] = bindings as [number, string]
        const p = state.providers.get(id)
        if (!p) return { rows: [], rowCount: 0 }
        p.fallback_priority = priority
        p.updated_at = nextNow(state)
        return {
          rows: [projectPublicProvider(p)] as unknown as T[],
          rowCount: 1,
        }
      }

      case "update-provider-test-result": {
        const [ok, latency_ms, error, id] = bindings as [
          boolean,
          number,
          string | null,
          string,
        ]
        const p = state.providers.get(id)
        if (!p) return { rows: [], rowCount: 0 }
        p.last_test_at = nextNow(state)
        p.last_test_ok = ok
        p.last_test_latency_ms = latency_ms
        p.last_test_error = error
        p.updated_at = nextNow(state)
        return { rows: [], rowCount: 1 }
      }

      case "get-setting":
      case "lock-setting": {
        if (!state.setting) return { rows: [] }
        return {
          rows: [projectSetting(state.setting)] as unknown as T[],
        }
      }

      case "update-setting": {
        if (!state.setting) {
          return { rows: [], rowCount: 0 }
        }
        const cols = extractSetColumns(sql)
        for (let i = 0; i < cols.length; i++) {
          applySettingColumn(state.setting, cols[i], bindings[i])
        }
        state.setting.version += 1
        state.setting.updated_at = nextNow(state)
        return {
          rows: [projectSetting(state.setting)] as unknown as T[],
          rowCount: 1,
        }
      }

      case "get-telegram-handoff-runtime": {
        if (!state.telegram) return { rows: [] }
        return {
          rows: [projectTelegramRuntime(state.telegram)] as unknown as T[],
        }
      }

      case "get-vk-handoff-runtime": {
        if (!state.vk) return { rows: [] }
        return {
          rows: [projectVkRuntime(state.vk)] as unknown as T[],
        }
      }

      default:
        // Unknown SQL — return empty so we surface "rows missing" errors
        // from the module instead of silent test passes.
        return { rows: [], rowCount: 0 }
    }
  }

  const transaction = async <T>(
    cb: (trx: { raw: typeof raw }) => Promise<T>
  ): Promise<T> => cb({ raw })

  return { raw, transaction }
}

function buildState(): DbState {
  return {
    providers: new Map(),
    setting: null,
    telegram: null,
    vk: null,
    clock: 0,
  }
}

// ---------------------------------------------------------------------------
// Common test setup
// ---------------------------------------------------------------------------

const ORIGINAL_KEY = process.env.ASSISTANT_SETTINGS_ENCRYPTION_KEY
const ORIGINAL_LLM_PROVIDER = process.env.LLM_PROVIDER
const ORIGINAL_OPENAI_KEY = process.env.OPENAI_API_KEY
const ORIGINAL_OPENAI_MODEL = process.env.OPENAI_MODEL
const ORIGINAL_OPENAI_BASE = process.env.OPENAI_BASE_URL
const ORIGINAL_ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
const ORIGINAL_GOOGLE_KEY = process.env.GOOGLE_API_KEY
const ORIGINAL_POLZA_KEY = process.env.POLZA_API_KEY

function setValidEncryptionKey() {
  process.env.ASSISTANT_SETTINGS_ENCRYPTION_KEY = randomBytes(32).toString(
    "base64"
  )
  resetEncryptionKeyCacheForTests()
}

function clearEncryptionKey() {
  delete process.env.ASSISTANT_SETTINGS_ENCRYPTION_KEY
  resetEncryptionKeyCacheForTests()
}

beforeEach(() => {
  setValidEncryptionKey()
})

afterEach(() => {
  if (ORIGINAL_KEY === undefined) {
    delete process.env.ASSISTANT_SETTINGS_ENCRYPTION_KEY
  } else {
    process.env.ASSISTANT_SETTINGS_ENCRYPTION_KEY = ORIGINAL_KEY
  }
  if (ORIGINAL_LLM_PROVIDER === undefined) {
    delete process.env.LLM_PROVIDER
  } else {
    process.env.LLM_PROVIDER = ORIGINAL_LLM_PROVIDER
  }
  if (ORIGINAL_OPENAI_KEY === undefined) {
    delete process.env.OPENAI_API_KEY
  } else {
    process.env.OPENAI_API_KEY = ORIGINAL_OPENAI_KEY
  }
  if (ORIGINAL_OPENAI_MODEL === undefined) {
    delete process.env.OPENAI_MODEL
  } else {
    process.env.OPENAI_MODEL = ORIGINAL_OPENAI_MODEL
  }
  if (ORIGINAL_OPENAI_BASE === undefined) {
    delete process.env.OPENAI_BASE_URL
  } else {
    process.env.OPENAI_BASE_URL = ORIGINAL_OPENAI_BASE
  }
  if (ORIGINAL_ANTHROPIC_KEY === undefined) {
    delete process.env.ANTHROPIC_API_KEY
  } else {
    process.env.ANTHROPIC_API_KEY = ORIGINAL_ANTHROPIC_KEY
  }
  if (ORIGINAL_GOOGLE_KEY === undefined) {
    delete process.env.GOOGLE_API_KEY
  } else {
    process.env.GOOGLE_API_KEY = ORIGINAL_GOOGLE_KEY
  }
  if (ORIGINAL_POLZA_KEY === undefined) {
    delete process.env.POLZA_API_KEY
  } else {
    process.env.POLZA_API_KEY = ORIGINAL_POLZA_KEY
  }
  resetEncryptionKeyCacheForTests()
})

const MIN_INPUT = {
  name: "openai-prod",
  base_url: "https://api.openai.com/v1",
  api_key: "sk-test-abcd",
  model: "gpt-4o-mini",
}

async function seedSimpleProvider(
  pg: PgConnectionLike,
  overrides: Partial<typeof MIN_INPUT> & {
    is_enabled?: boolean
    fallback_priority?: number | null
  } = {}
): Promise<LlmProviderRow> {
  return await createLlmProvider(pg, { ...MIN_INPUT, ...overrides })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ensureAssistantSettingsTables", () => {
  it("is idempotent and seeds the singleton row exactly once", async () => {
    const state = buildState()
    const pg = buildMockPg(state)

    await ensureAssistantSettingsTables(pg)
    await ensureAssistantSettingsTables(pg)

    expect(state.setting).not.toBeNull()
    expect(state.setting!.version).toBe(1)
    expect(state.setting!.system_prompt.length).toBeGreaterThan(0)
    // No providers were created by the bootstrap.
    expect(state.providers.size).toBe(0)
  })
})

describe("createLlmProvider", () => {
  it("creates a provider with the minimal input", async () => {
    const state = buildState()
    const pg = buildMockPg(state)

    const created = await createLlmProvider(pg, MIN_INPUT)

    expect(created.id).toMatch(/^als_[0-9a-f]{32}$/)
    expect(created.name).toBe(MIN_INPUT.name)
    expect(created.base_url).toBe(MIN_INPUT.base_url)
    expect(created.model).toBe(MIN_INPUT.model)
    expect(created.api_key_last4).toBe("abcd")
    expect((created as Record<string, unknown>).api_key).toBeUndefined()
    expect(state.providers.size).toBe(1)
  })

  it("applies sensible defaults for the optional fields", async () => {
    const state = buildState()
    const pg = buildMockPg(state)

    const created = await createLlmProvider(pg, MIN_INPUT)

    expect(created.temperature).toBe(0.2)
    expect(created.max_tokens).toBe(1024)
    expect(created.top_p).toBeNull()
    expect(created.timeout_ms).toBe(30000)
    expect(created.request_headers).toEqual({})
    expect(created.is_enabled).toBe(true)
    expect(created.is_active).toBe(false)
    expect(created.fallback_priority).toBeNull()
  })

  it("rejects a non-http base_url with a `validation` error", async () => {
    const state = buildState()
    const pg = buildMockPg(state)

    await expect(
      createLlmProvider(pg, { ...MIN_INPUT, base_url: "ftp://nope" })
    ).rejects.toMatchObject({
      name: "AssistantSettingsError",
      code: "validation",
    })
  })

  it("rejects out-of-range temperature / max_tokens / top_p / timeout_ms / fallback_priority", async () => {
    const state = buildState()
    const pg = buildMockPg(state)

    const cases: Array<Partial<typeof MIN_INPUT> & Record<string, unknown>> = [
      { temperature: 3 },
      { temperature: -0.1 },
      { max_tokens: 0 },
      { max_tokens: 99999 },
      { top_p: 2 },
      { top_p: -0.5 },
      { timeout_ms: 500 },
      { timeout_ms: 200000 },
      { fallback_priority: 0 },
      { fallback_priority: 99 },
    ]

    for (const overrides of cases) {
      await expect(
        createLlmProvider(pg, { ...MIN_INPUT, ...(overrides as object) })
      ).rejects.toMatchObject({
        name: "AssistantSettingsError",
        code: "validation",
      })
    }
  })

  it("translates a Postgres unique-violation on `name` into `already_exists`", async () => {
    const state = buildState()
    const pg = buildMockPg(state)

    await createLlmProvider(pg, MIN_INPUT)
    await expect(createLlmProvider(pg, MIN_INPUT)).rejects.toMatchObject({
      name: "AssistantSettingsError",
      code: "already_exists",
    })
  })

  it("throws `encryption_not_configured` when the env key is missing", async () => {
    clearEncryptionKey()
    const state = buildState()
    const pg = buildMockPg(state)

    await expect(createLlmProvider(pg, MIN_INPUT)).rejects.toMatchObject({
      name: "AssistantSettingsError",
      code: "encryption_not_configured",
    })
    expect(state.providers.size).toBe(0)
  })

  it("never returns the plain api_key on the public row", async () => {
    const state = buildState()
    const pg = buildMockPg(state)

    const created = await createLlmProvider(pg, {
      ...MIN_INPUT,
      api_key: "sk-secret-1234",
    })

    expect(JSON.stringify(created)).not.toContain("sk-secret-1234")
    expect(created.api_key_last4).toBe("1234")
  })
})

describe("updateLlmProvider", () => {
  it("supports a partial update (temperature only) without touching other columns", async () => {
    const state = buildState()
    const pg = buildMockPg(state)
    const created = await seedSimpleProvider(pg)
    const stored = state.providers.get(created.id)!
    const cipherBefore = Buffer.from(stored.api_key_ciphertext)

    const updated = await updateLlmProvider(pg, created.id, {
      temperature: 0.7,
    })

    expect(updated.temperature).toBe(0.7)
    expect(updated.model).toBe(created.model)
    expect(updated.api_key_last4).toBe(created.api_key_last4)
    expect(state.providers.get(created.id)!.api_key_ciphertext.equals(cipherBefore)).toBe(true)
  })

  it("rotates api_key — last4 changes and ciphertext is overwritten", async () => {
    const state = buildState()
    const pg = buildMockPg(state)
    const created = await seedSimpleProvider(pg, { api_key: "sk-aaaa-OLD1" })
    const cipherBefore = Buffer.from(state.providers.get(created.id)!.api_key_ciphertext)

    const updated = await updateLlmProvider(pg, created.id, {
      api_key: "sk-bbbb-NEW2",
    })

    expect(updated.api_key_last4).toBe("NEW2")
    const cipherAfter = state.providers.get(created.id)!.api_key_ciphertext
    expect(cipherAfter.equals(cipherBefore)).toBe(false)
  })

  it("does not touch the api_key when input.api_key is undefined", async () => {
    const state = buildState()
    const pg = buildMockPg(state)
    const created = await seedSimpleProvider(pg, { api_key: "sk-keep-9999" })
    const cipherBefore = Buffer.from(state.providers.get(created.id)!.api_key_ciphertext)
    const last4Before = created.api_key_last4

    const updated = await updateLlmProvider(pg, created.id, {
      max_tokens: 256,
    })

    expect(updated.api_key_last4).toBe(last4Before)
    expect(updated.max_tokens).toBe(256)
    const cipherAfter = state.providers.get(created.id)!.api_key_ciphertext
    expect(cipherAfter.equals(cipherBefore)).toBe(true)
  })

  it("throws `not_found` when the provider id does not exist", async () => {
    const state = buildState()
    const pg = buildMockPg(state)

    await expect(
      updateLlmProvider(pg, "als_missing", { temperature: 0.4 })
    ).rejects.toMatchObject({
      name: "AssistantSettingsError",
      code: "not_found",
    })
  })
})

describe("deleteLlmProvider", () => {
  it("deletes a non-active provider and reports `was_active=false`", async () => {
    const state = buildState()
    const pg = buildMockPg(state)
    const a = await seedSimpleProvider(pg, { name: "a" })
    await seedSimpleProvider(pg, { name: "b" })

    const result = await deleteLlmProvider(pg, a.id)

    expect(result).toEqual({ deleted: true, was_active: false })
    expect(state.providers.has(a.id)).toBe(false)
  })

  it("refuses to delete the only enabled active provider with `active_required`", async () => {
    const state = buildState()
    const pg = buildMockPg(state)
    const a = await seedSimpleProvider(pg, { name: "only" })
    await setActiveLlmProvider(pg, a.id)

    await expect(deleteLlmProvider(pg, a.id)).rejects.toMatchObject({
      name: "AssistantSettingsError",
      code: "active_required",
    })
    expect(state.providers.has(a.id)).toBe(true)
  })

  it("deletes an active provider when at least one other enabled provider remains", async () => {
    const state = buildState()
    const pg = buildMockPg(state)
    const a = await seedSimpleProvider(pg, { name: "a" })
    await seedSimpleProvider(pg, { name: "b" })
    await setActiveLlmProvider(pg, a.id)

    const result = await deleteLlmProvider(pg, a.id)

    expect(result).toEqual({ deleted: true, was_active: true })
    expect(state.providers.has(a.id)).toBe(false)
  })
})

describe("setActiveLlmProvider", () => {
  it("switches `is_active` from A to B in a single transaction", async () => {
    const state = buildState()
    const pg = buildMockPg(state)
    const a = await seedSimpleProvider(pg, { name: "a" })
    const b = await seedSimpleProvider(pg, { name: "b" })

    await setActiveLlmProvider(pg, a.id)
    const switched = await setActiveLlmProvider(pg, b.id)

    expect(switched.is_active).toBe(true)
    expect(state.providers.get(a.id)!.is_active).toBe(false)
    expect(state.providers.get(b.id)!.is_active).toBe(true)
  })

  it("rejects activation of a disabled provider with `provider_disabled`", async () => {
    const state = buildState()
    const pg = buildMockPg(state)
    const created = await seedSimpleProvider(pg, { is_enabled: false })

    await expect(setActiveLlmProvider(pg, created.id)).rejects.toMatchObject({
      name: "AssistantSettingsError",
      code: "provider_disabled",
    })
  })

  it("returns `not_found` for a missing id", async () => {
    const state = buildState()
    const pg = buildMockPg(state)

    await expect(setActiveLlmProvider(pg, "als_missing")).rejects.toMatchObject(
      {
        name: "AssistantSettingsError",
        code: "not_found",
      }
    )
  })
})

describe("reorderFallbackChain", () => {
  it("assigns 1-based positions in the requested order", async () => {
    const state = buildState()
    const pg = buildMockPg(state)
    const a = await seedSimpleProvider(pg, { name: "a" })
    const b = await seedSimpleProvider(pg, { name: "b" })
    const c = await seedSimpleProvider(pg, { name: "c" })

    const updated = await reorderFallbackChain(pg, [c.id, a.id, b.id])

    expect(updated.map((p) => p.id)).toEqual([c.id, a.id, b.id])
    expect(updated.map((p) => p.fallback_priority)).toEqual([1, 2, 3])
  })

  it("rejects duplicate ids in the request with `validation`", async () => {
    const state = buildState()
    const pg = buildMockPg(state)
    const a = await seedSimpleProvider(pg, { name: "a" })

    await expect(
      reorderFallbackChain(pg, [a.id, a.id])
    ).rejects.toMatchObject({
      name: "AssistantSettingsError",
      code: "validation",
    })
  })

  it("returns `not_found` if any id in the chain does not exist", async () => {
    const state = buildState()
    const pg = buildMockPg(state)
    const a = await seedSimpleProvider(pg, { name: "a" })

    await expect(
      reorderFallbackChain(pg, [a.id, "als_missing"])
    ).rejects.toMatchObject({
      name: "AssistantSettingsError",
      code: "not_found",
    })
  })

  it("rejects a chain that contains a disabled provider with `validation`", async () => {
    const state = buildState()
    const pg = buildMockPg(state)
    const a = await seedSimpleProvider(pg, { name: "a" })
    const b = await seedSimpleProvider(pg, { name: "b", is_enabled: false })

    await expect(
      reorderFallbackChain(pg, [a.id, b.id])
    ).rejects.toMatchObject({
      name: "AssistantSettingsError",
      code: "validation",
    })
  })
})

describe("getEffectiveAssistantConfig", () => {
  it("returns active + sorted fallback with decrypted api_keys and a freshness version", async () => {
    const state = buildState()
    const pg = buildMockPg(state)

    const a = await seedSimpleProvider(pg, {
      name: "primary",
      api_key: "sk-primary-1234",
    })
    const b = await seedSimpleProvider(pg, {
      name: "second",
      api_key: "sk-second-5678",
    })
    const c = await seedSimpleProvider(pg, {
      name: "third",
      api_key: "sk-third-9012",
    })

    await setActiveLlmProvider(pg, a.id)
    await reorderFallbackChain(pg, [c.id, b.id])

    const config = await getEffectiveAssistantConfig(pg)

    expect(config.active?.id).toBe(a.id)
    expect(config.active?.api_key).toBe("sk-primary-1234")
    expect(config.fallback.map((p) => p.id)).toEqual([c.id, b.id])
    expect(config.fallback.map((p) => p.api_key)).toEqual([
      "sk-third-9012",
      "sk-second-5678",
    ])
    expect(config.global.id).toBe("singleton")
    expect(config.global.active_handoff_channel).toBe("telegram")
    expect(config.active_handoff_channel).toBe("telegram")
    expect(config.telegram_handoff.enabled).toBe(false)
    expect(config.telegram_handoff.bot_token).toBeNull()
    expect(config.telegram_handoff.webhook_secret).toBeNull()
    expect(config.telegram_handoff.diagnostics.status).toBe("disabled")
    expect(config.vk_handoff.enabled).toBe(false)
    expect(config.vk_handoff.community_access_token).toBeNull()
    expect(config.vk_handoff.secret_key).toBeNull()
    expect(config.vk_handoff.confirmation_code).toBeNull()
    expect(config.vk_handoff.diagnostics.status).toBe("disabled")

    const allTimes = [
      config.active!.updated_at,
      ...config.fallback.map((f) => f.updated_at),
      config.global.updated_at,
      config.telegram_handoff.updated_at,
      config.vk_handoff.updated_at,
    ]
    const max = allTimes.reduce((acc, cur) => (cur > acc ? cur : acc))
    expect(config.version).toBe(max)
  })
})

describe("testLlmProvider", () => {
  it("records ok=true and persists the latency on a 200 response", async () => {
    const state = buildState()
    const pg = buildMockPg(state)
    const created = await seedSimpleProvider(pg)

    const fetchImpl = jest.fn(async (_url: any, _init: any) => {
      return new Response(
        JSON.stringify({ choices: [{ message: { content: "ok" } }] }),
        { status: 200, headers: { "content-type": "application/json" } }
      ) as any
    }) as unknown as typeof fetch

    const result = await testLlmProvider(pg, created.id, { fetchImpl })

    expect(result.ok).toBe(true)
    expect(result.http_status).toBe(200)
    expect(result.model_available).toBe(true)
    expect(typeof result.latency_ms).toBe("number")

    const reread = await getLlmProvider(pg, created.id)
    expect(reread!.last_test_ok).toBe(true)
    expect(reread!.last_test_at).not.toBeNull()
    expect(reread!.last_test_error).toBeNull()
  })

  it("records ok=false with http_status on a 401 response", async () => {
    const state = buildState()
    const pg = buildMockPg(state)
    const created = await seedSimpleProvider(pg)

    const fetchImpl = jest.fn(async () => {
      return new Response("invalid api key", { status: 401 }) as any
    }) as unknown as typeof fetch

    const result = await testLlmProvider(pg, created.id, { fetchImpl })

    expect(result.ok).toBe(false)
    expect(result.http_status).toBe(401)
    expect(result.error).toMatch(/HTTP 401/)

    const reread = await getLlmProvider(pg, created.id)
    expect(reread!.last_test_ok).toBe(false)
    expect(reread!.last_test_error).toMatch(/HTTP 401/)
  })

  it("returns ok=false with an abort/timeout error when the signal fires", async () => {
    const state = buildState()
    const pg = buildMockPg(state)
    const created = await seedSimpleProvider(pg)

    const externalController = new AbortController()
    externalController.abort()

    const fetchImpl = jest.fn((_url: any, init: any) => {
      return new Promise((_, reject) => {
        if (init.signal?.aborted) {
          const err: any = new Error("aborted")
          err.name = "AbortError"
          reject(err)
          return
        }
        init.signal?.addEventListener("abort", () => {
          const err: any = new Error("aborted")
          err.name = "AbortError"
          reject(err)
        })
      })
    }) as unknown as typeof fetch

    const result = await testLlmProvider(pg, created.id, {
      fetchImpl,
      signal: externalController.signal,
    })

    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/timeout|abort/i)
  })

  it("issues the expected POST body and headers to the chat/completions endpoint", async () => {
    const state = buildState()
    const pg = buildMockPg(state)
    const created = await seedSimpleProvider(pg, {
      api_key: "sk-test-PROBE",
    })

    let capturedUrl: string | null = null
    let capturedInit: RequestInit | null = null
    const fetchImpl = jest.fn(async (url: any, init: any) => {
      capturedUrl = String(url)
      capturedInit = init as RequestInit
      return new Response("{}", { status: 200 }) as any
    }) as unknown as typeof fetch

    await testLlmProvider(pg, created.id, {
      fetchImpl,
      prompt: "hello",
    })

    expect(capturedUrl).toBe(`${MIN_INPUT.base_url}/chat/completions`)
    expect(capturedInit!.method).toBe("POST")
    const headers = capturedInit!.headers as Record<string, string>
    expect(headers["Content-Type"]).toBe("application/json")
    expect(headers["Authorization"]).toBe("Bearer sk-test-PROBE")

    const body = JSON.parse(capturedInit!.body as string)
    expect(body.model).toBe(MIN_INPUT.model)
    expect(body.max_tokens).toBe(8)
    expect(body.temperature).toBe(0)
    expect(body.messages).toEqual([{ role: "user", content: "hello" }])
  })
})

describe("getAssistantSetting / updateAssistantSetting", () => {
  it("exposes default values after bootstrap", async () => {
    const state = buildState()
    const pg = buildMockPg(state)

    const setting = await getAssistantSetting(pg)

    expect(setting.id).toBe("singleton")
    expect(setting.version).toBe(1)
    expect(setting.retrieval_mode).toBe("auto")
    expect(setting.retrieval_top_k).toBe(5)
    expect(setting.embedding_provider).toBe("hashing")
    expect(setting.embedding_dimension).toBe(384)
    expect(setting.streaming_enabled).toBe(true)
    expect(setting.default_locale).toBe("ru")
    expect(setting.active_handoff_channel).toBe("telegram")
    expect(setting.tools_enabled.price_lookup).toBe(true)
    expect(setting.guardrails.prompt_injection).toBe(true)
    expect(setting.rate_limits.chat_per_minute).toBe(60)
    expect(setting.observability.sentry).toBe(false)
    expect(setting.system_prompt.length).toBeGreaterThan(50)
  })

  it("bumps version on a matching expectedVersion update", async () => {
    const state = buildState()
    const pg = buildMockPg(state)

    const before = await getAssistantSetting(pg)
    const updated = await updateAssistantSetting(
      pg,
      { retrieval_top_k: 8, default_locale: "en" },
      { expectedVersion: before.version, updatedBy: "user_admin" }
    )

    expect(updated.version).toBe(before.version + 1)
    expect(updated.retrieval_top_k).toBe(8)
    expect(updated.default_locale).toBe("en")
    expect(updated.active_handoff_channel).toBe("telegram")
    expect(updated.updated_by).toBe("user_admin")
  })

  it("updates active_handoff_channel through the singleton settings row", async () => {
    const state = buildState()
    const pg = buildMockPg(state)
    const before = await getAssistantSetting(pg)

    const updated = await updateAssistantSetting(
      pg,
      { active_handoff_channel: "vk" },
      { expectedVersion: before.version }
    )

    expect(updated.active_handoff_channel).toBe("vk")
    expect(updated.version).toBe(before.version + 1)
  })

  it("throws `version_mismatch` when the expected version is stale", async () => {
    const state = buildState()
    const pg = buildMockPg(state)
    const before = await getAssistantSetting(pg)

    await expect(
      updateAssistantSetting(
        pg,
        { retrieval_top_k: 9 },
        { expectedVersion: before.version + 99 }
      )
    ).rejects.toMatchObject({
      name: "AssistantSettingsError",
      code: "version_mismatch",
    })
    // The row must remain at the original version.
    const after = await getAssistantSetting(pg)
    expect(after.version).toBe(before.version)
  })
})

describe("seedFromEnvIfEmpty", () => {
  it("creates a provider and activates it from LLM_PROVIDER + OPENAI_API_KEY", async () => {
    const state = buildState()
    const pg = buildMockPg(state)
    process.env.LLM_PROVIDER = "openai"
    process.env.OPENAI_API_KEY = "sk-env-OPEN"
    process.env.OPENAI_MODEL = "gpt-4o-mini"

    const result = await seedFromEnvIfEmpty(pg, process.env)

    expect(result.seeded).toBe(true)
    expect(result.provider_id).toMatch(/^als_/)
    const created = state.providers.get(result.provider_id!)
    expect(created).toBeDefined()
    expect(created!.is_active).toBe(true)
    expect(created!.name).toBe("openai-from-env")
    expect(created!.model).toBe("gpt-4o-mini")
  })

  it("returns reason `no_api_key_in_env` when no group has an api key", async () => {
    const state = buildState()
    const pg = buildMockPg(state)
    delete process.env.LLM_PROVIDER
    delete process.env.OPENAI_API_KEY
    delete process.env.ANTHROPIC_API_KEY
    delete process.env.GOOGLE_API_KEY
    delete process.env.POLZA_API_KEY

    const result = await seedFromEnvIfEmpty(pg, process.env)

    expect(result.seeded).toBe(false)
    expect(result.reason).toBe("no_api_key_in_env")
    expect(state.providers.size).toBe(0)
  })

  it("returns reason `providers_exist` when a provider already exists", async () => {
    const state = buildState()
    const pg = buildMockPg(state)
    await seedSimpleProvider(pg)
    process.env.LLM_PROVIDER = "openai"
    process.env.OPENAI_API_KEY = "sk-env-XYZ"

    const result = await seedFromEnvIfEmpty(pg, process.env)

    expect(result.seeded).toBe(false)
    expect(result.reason).toBe("providers_exist")
  })

  it("returns reason `encryption_not_configured` when no encryption key is present", async () => {
    clearEncryptionKey()
    const state = buildState()
    // ensure tables exist with a different mock first so listLlmProviders
    // can run before the encryption check.
    const pg = buildMockPg(state)
    process.env.LLM_PROVIDER = "openai"
    process.env.OPENAI_API_KEY = "sk-env-NOKEY"

    const result = await seedFromEnvIfEmpty(pg, process.env)

    expect(result.seeded).toBe(false)
    expect(result.reason).toBe("encryption_not_configured")
    expect(state.providers.size).toBe(0)
  })
})

describe("AssistantSettingsError", () => {
  it("preserves `code` and `name` for instanceof checks", () => {
    const err = new AssistantSettingsError("validation", "boom")
    expect(err).toBeInstanceOf(AssistantSettingsError)
    expect(err.code).toBe("validation")
    expect(err.name).toBe("AssistantSettingsError")
    expect(err.message).toBe("boom")
  })
})
