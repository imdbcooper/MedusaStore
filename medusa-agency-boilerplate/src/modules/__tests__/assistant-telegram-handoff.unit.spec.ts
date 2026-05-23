/**
 * Unit tests for the Telegram handoff part of
 * [`assistant-settings.ts`](medusa-agency-boilerplate/src/modules/assistant-settings.ts:1).
 *
 * The mock Postgres dispatcher follows the same tagged-SQL convention as the
 * main assistant-settings test suite, but only implements the subset required
 * for the Telegram handoff singleton table.
 */

import { afterEach, beforeEach, describe, expect, it } from "@jest/globals"
import { randomBytes } from "node:crypto"

import {
  ensureAssistantSettingsTables,
  getAssistantTelegramHandoffConfig,
  getAssistantTelegramHandoffRuntimeConfig,
  recordAssistantTelegramHandoffTestResult,
  testAssistantTelegramHandoffConfig,
  updateAssistantTelegramHandoffConfig,
  type PgConnectionLike,
} from "../assistant-settings"
import { resetEncryptionKeyCacheForTests } from "../../lib/crypto/secret-cipher"

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

type DbState = {
  settingSeeded: boolean
  telegram: TelegramState | null
  clock: number
}

function getTag(sql: string): string {
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

function nextNow(state: DbState): Date {
  state.clock += 1
  return new Date(1_700_000_000_000 + state.clock)
}

function extractSetColumns(sql: string): string[] {
  const match = sql.match(/set\s+([\s\S]+?)\s+where/i)
  if (!match) return []
  return match[1]
    .split(",")
    .map((piece) => piece.trim().match(/^(\w+)\s*=\s*\?(?:::\w+)?$/))
    .filter((piece): piece is RegExpMatchArray => Boolean(piece))
    .map((piece) => piece[1])
}

function projectTelegram(state: TelegramState): Record<string, unknown> {
  return {
    id: "singleton",
    enabled: state.enabled,
    environment_mode: state.environment_mode,
    bot_username: state.bot_username,
    bot_token_last4: state.bot_token_last4,
    support_chat_id: state.support_chat_id,
    topics_required: state.topics_required,
    webhook_url: state.webhook_url,
    webhook_secret_last4: state.webhook_secret_last4,
    allowed_operator_ids: state.allowed_operator_ids,
    allowed_admin_ids: state.allowed_admin_ids,
    operator_reply_mode: state.operator_reply_mode,
    fallback_message: state.fallback_message,
    last_test_status: state.last_test_status,
    last_test_error: state.last_test_error,
    last_test_at: state.last_test_at,
    created_at: state.created_at,
    updated_at: state.updated_at,
    version: state.version,
  }
}

function projectTelegramRuntime(state: TelegramState): Record<string, unknown> {
  return {
    ...projectTelegram(state),
    bot_token_ciphertext: state.bot_token_ciphertext,
    bot_token_iv: state.bot_token_iv,
    bot_token_tag: state.bot_token_tag,
    webhook_secret_ciphertext: state.webhook_secret_ciphertext,
    webhook_secret_iv: state.webhook_secret_iv,
    webhook_secret_tag: state.webhook_secret_tag,
  }
}

function applyTelegramColumn(
  telegram: TelegramState,
  column: string,
  value: unknown
): void {
  switch (column) {
    case "enabled":
    case "topics_required":
      ;(telegram as any)[column] = Boolean(value)
      break
    case "environment_mode":
    case "operator_reply_mode":
      ;(telegram as any)[column] = String(value)
      break
    case "bot_username":
    case "support_chat_id":
    case "webhook_url":
    case "fallback_message":
      ;(telegram as any)[column] =
        value === null || value === undefined ? null : String(value)
      break
    case "allowed_operator_ids":
    case "allowed_admin_ids":
      ;(telegram as any)[column] =
        typeof value === "string" ? JSON.parse(value) : value
      break
    case "bot_token_ciphertext":
    case "bot_token_iv":
    case "bot_token_tag":
    case "webhook_secret_ciphertext":
    case "webhook_secret_iv":
    case "webhook_secret_tag":
      ;(telegram as any)[column] = value as Buffer
      break
    case "bot_token_last4":
    case "webhook_secret_last4":
    case "last_test_status":
    case "last_test_error":
      ;(telegram as any)[column] =
        value === null || value === undefined ? null : String(value)
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
      case "create-table-telegram-handoff":
        return { rows: [], rowCount: 0 }

      case "seed-singleton":
        if (state.settingSeeded) {
          return { rows: [], rowCount: 0 }
        }
        state.settingSeeded = true
        return { rows: [], rowCount: 1 }

      case "seed-telegram-handoff-singleton": {
        if (state.telegram) {
          return { rows: [], rowCount: 0 }
        }
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

      case "get-telegram-handoff":
      case "lock-telegram-handoff":
        return {
          rows: state.telegram
            ? ([projectTelegram(state.telegram)] as unknown as T[])
            : [],
        }

      case "get-telegram-handoff-runtime":
        return {
          rows: state.telegram
            ? ([projectTelegramRuntime(state.telegram)] as unknown as T[])
            : [],
        }

      case "update-telegram-handoff": {
        if (!state.telegram) {
          return { rows: [], rowCount: 0 }
        }
        const cols = extractSetColumns(sql)
        for (let index = 0; index < cols.length; index += 1) {
          applyTelegramColumn(state.telegram, cols[index], bindings[index])
        }
        state.telegram.version += 1
        state.telegram.updated_at = nextNow(state)
        return {
          rows: [projectTelegram(state.telegram)] as unknown as T[],
          rowCount: 1,
        }
      }

      case "update-telegram-handoff-test-result": {
        if (!state.telegram) {
          return { rows: [], rowCount: 0 }
        }
        const [last_test_status, last_test_error, last_test_at] = bindings as [
          string,
          string | null,
          string,
        ]
        state.telegram.last_test_status = last_test_status
        state.telegram.last_test_error = last_test_error
        state.telegram.last_test_at = new Date(last_test_at)
        state.telegram.updated_at = nextNow(state)
        return { rows: [], rowCount: 1 }
      }

      default:
        return { rows: [], rowCount: 0 }
    }
  }

  return {
    raw,
    transaction: async <T>(callback: (trx: { raw: typeof raw }) => Promise<T>) =>
      callback({ raw }),
  }
}

function buildState(): DbState {
  return {
    settingSeeded: false,
    telegram: null,
    clock: 0,
  }
}

const ORIGINAL_KEY = process.env.ASSISTANT_SETTINGS_ENCRYPTION_KEY

function setValidEncryptionKey() {
  process.env.ASSISTANT_SETTINGS_ENCRYPTION_KEY = randomBytes(32).toString(
    "base64"
  )
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
  resetEncryptionKeyCacheForTests()
})

describe("Telegram handoff config storage", () => {
  it("seeds the singleton row exactly once with disabled defaults", async () => {
    const state = buildState()
    const pg = buildMockPg(state)

    await ensureAssistantSettingsTables(pg)
    await ensureAssistantSettingsTables(pg)

    const config = await getAssistantTelegramHandoffConfig(pg)
    expect(config.enabled).toBe(false)
    expect(config.environment_mode).toBe("test")
    expect(config.topics_required).toBe(true)
    expect(config.allowed_operator_ids).toEqual([])
    expect(config.allowed_admin_ids).toEqual([])
    expect(config.bot_token.is_configured).toBe(false)
    expect(config.webhook_secret.is_configured).toBe(false)
    expect(config.diagnostics.status).toBe("disabled")
  })

  it("stores secrets encrypted and only returns masked metadata", async () => {
    const state = buildState()
    const pg = buildMockPg(state)

    const updated = await updateAssistantTelegramHandoffConfig(pg, {
      enabled: false,
      bot_token: "123456:telegram-bot-1234",
      webhook_secret: "webhook-secret-5678",
    })

    expect(updated.bot_token.is_configured).toBe(true)
    expect(updated.bot_token.last4).toBe("1234")
    expect(updated.bot_token.masked).toBe("••••1234")
    expect(updated.webhook_secret.last4).toBe("5678")
    expect(JSON.stringify(updated)).not.toContain("123456:telegram-bot-1234")
    expect(JSON.stringify(updated)).not.toContain("webhook-secret-5678")
    expect(state.telegram?.bot_token_ciphertext).toBeInstanceOf(Buffer)
    expect(state.telegram?.webhook_secret_ciphertext).toBeInstanceOf(Buffer)
  })

  it("returns raw secrets only through the internal runtime config helper", async () => {
    const state = buildState()
    const pg = buildMockPg(state)

    await updateAssistantTelegramHandoffConfig(pg, {
      enabled: true,
      environment_mode: "test",
      bot_token: "123456:telegram-bot-1234",
      support_chat_id: "-1001234567890",
      webhook_url: "https://example.com/telegram/webhook",
      webhook_secret: "webhook-secret-5678",
      topics_required: true,
    })

    const publicConfig = await getAssistantTelegramHandoffConfig(pg)
    const runtimeConfig = await getAssistantTelegramHandoffRuntimeConfig(pg)

    expect(publicConfig.bot_token).toEqual({
      is_configured: true,
      last4: "1234",
      masked: "••••1234",
    })
    expect(publicConfig.webhook_secret).toEqual({
      is_configured: true,
      last4: "5678",
      masked: "••••5678",
    })
    expect(runtimeConfig.bot_token).toBe("123456:telegram-bot-1234")
    expect(runtimeConfig.webhook_secret).toBe("webhook-secret-5678")
    expect(runtimeConfig.diagnostics.status).toBe("ready_for_connection_test")
  })

  it("does not overwrite stored secrets when PATCH omits new secret values", async () => {
    const state = buildState()
    const pg = buildMockPg(state)

    await updateAssistantTelegramHandoffConfig(pg, {
      bot_token: "123456:telegram-bot-1234",
      webhook_secret: "webhook-secret-5678",
    })

    const botCipherBefore = Buffer.from(state.telegram!.bot_token_ciphertext!)
    const secretCipherBefore = Buffer.from(
      state.telegram!.webhook_secret_ciphertext!
    )

    const updated = await updateAssistantTelegramHandoffConfig(pg, {
      support_chat_id: "-1001234567890",
      webhook_url: "https://example.com/telegram/webhook",
    })

    expect(updated.support_chat_id).toBe("-1001234567890")
    expect(state.telegram!.bot_token_ciphertext!.equals(botCipherBefore)).toBe(
      true
    )
    expect(
      state.telegram!.webhook_secret_ciphertext!.equals(secretCipherBefore)
    ).toBe(true)
  })

  it("allows enabling when the webhook secret is already stored and PATCH omits a new value", async () => {
    const state = buildState()
    const pg = buildMockPg(state)

    await updateAssistantTelegramHandoffConfig(pg, {
      bot_token: "123456:telegram-bot-1234",
      webhook_secret: "webhook-secret-5678",
    })

    const updated = await updateAssistantTelegramHandoffConfig(pg, {
      enabled: true,
      environment_mode: "test",
      support_chat_id: "-1001234567890",
      webhook_url: "https://example.com/telegram/webhook",
      topics_required: true,
      allowed_operator_ids: [],
      allowed_admin_ids: [],
    })

    expect(updated.enabled).toBe(true)
    expect(updated.webhook_secret.is_configured).toBe(true)
    expect(updated.webhook_secret.last4).toBe("5678")
    expect(updated.diagnostics.status).toBe("ready_for_connection_test")
  })

  it("allows saving an incomplete disabled config", async () => {
    const state = buildState()
    const pg = buildMockPg(state)

    const updated = await updateAssistantTelegramHandoffConfig(pg, {
      enabled: false,
      support_chat_id: null,
      webhook_url: null,
      topics_required: false,
      allowed_operator_ids: [],
      allowed_admin_ids: [],
    })

    expect(updated.enabled).toBe(false)
    expect(updated.support_chat_id).toBeNull()
    expect(updated.webhook_url).toBeNull()
    expect(updated.topics_required).toBe(false)
    expect(updated.diagnostics.status).toBe("disabled")
  })

  it("rejects enabling the config without a bot token", async () => {
    const state = buildState()
    const pg = buildMockPg(state)

    await expect(
      updateAssistantTelegramHandoffConfig(pg, {
        enabled: true,
        support_chat_id: "-1001234567890",
        webhook_url: "https://example.com/telegram/webhook",
      })
    ).rejects.toMatchObject({
      name: "AssistantSettingsError",
      code: "validation",
      message: "bot_token is required when Telegram handoff is enabled",
    })
  })

  it("rejects enabling the config without a webhook secret", async () => {
    const state = buildState()
    const pg = buildMockPg(state)

    await expect(
      updateAssistantTelegramHandoffConfig(pg, {
        enabled: true,
        bot_token: "123456:telegram-bot-1234",
        support_chat_id: "-1001234567890",
        webhook_url: "https://example.com/telegram/webhook",
        topics_required: true,
      })
    ).rejects.toMatchObject({
      name: "AssistantSettingsError",
      code: "validation",
      message: "webhook_secret is required when Telegram handoff is enabled",
    })
  })

  it("allows test mode without operator/admin ids once core credentials exist", async () => {
    const state = buildState()
    const pg = buildMockPg(state)

    const updated = await updateAssistantTelegramHandoffConfig(pg, {
      enabled: true,
      environment_mode: "test",
      bot_token: "123456:telegram-bot-1234",
      support_chat_id: "-1001234567890",
      webhook_url: "https://example.com/telegram/webhook",
      webhook_secret: "webhook-secret-5678",
      topics_required: true,
      allowed_operator_ids: [],
      allowed_admin_ids: [],
    })

    expect(updated.enabled).toBe(true)
    expect(updated.environment_mode).toBe("test")
    expect(updated.diagnostics.status).toBe("ready_for_connection_test")
    expect(updated.diagnostics.can_test).toBe(true)
  })

  it("requires operator or admin ids in production mode", async () => {
    const state = buildState()
    const pg = buildMockPg(state)

    await expect(
      updateAssistantTelegramHandoffConfig(pg, {
        enabled: true,
        environment_mode: "production",
        bot_token: "123456:telegram-bot-1234",
        support_chat_id: "-1001234567890",
        webhook_url: "https://example.com/telegram/webhook",
        webhook_secret: "webhook-secret-5678",
        topics_required: true,
        allowed_operator_ids: [],
        allowed_admin_ids: [],
      })
    ).rejects.toMatchObject({
      name: "AssistantSettingsError",
      code: "validation",
    })
  })
})

describe("Telegram handoff local validation diagnostics", () => {
  it("returns missing_credentials and persists last_test_status for incomplete config", async () => {
    const state = buildState()
    const pg = buildMockPg(state)

    const result = await testAssistantTelegramHandoffConfig(pg, {
      enabled: true,
    })

    expect(result.ok).toBe(false)
    expect(result.status).toBe("missing_credentials")
    expect(result.missing_fields).toContain("bot_token")
    expect(result.missing_fields).toContain("support_chat_id")
    expect(result.missing_fields).toContain("webhook_secret")
    expect(state.telegram?.last_test_status).toBe("missing_credentials")
    expect(state.telegram?.last_test_error).toContain("Missing required")
    expect(state.telegram?.last_test_at).not.toBeNull()
  })

  it("returns dry_run_passed for local validation when required Telegram fields are present", async () => {
    const state = buildState()
    const pg = buildMockPg(state)

    const result = await testAssistantTelegramHandoffConfig(pg, {
      enabled: true,
      environment_mode: "test",
      bot_token: "123456:telegram-bot-1234",
      support_chat_id: "-1001234567890",
      webhook_url: "https://example.com/telegram/webhook",
      webhook_secret: "webhook-secret-5678",
      topics_required: true,
    })

    expect(result.ok).toBe(true)
    expect(result.status).toBe("dry_run_passed")
    expect(result.message).toContain("Local Telegram handoff validation passed")
    expect(state.telegram?.last_test_status).toBe("dry_run_passed")
    expect(state.telegram?.last_test_error).toBeNull()
  })

  it("persists externally supplied live test results", async () => {
    const state = buildState()
    const pg = buildMockPg(state)

    await recordAssistantTelegramHandoffTestResult(pg, {
      ok: false,
      status: "connection_failed",
      message: "Telegram webhook URL does not match the saved webhook_url.",
      missing_fields: [],
      tested_at: "2026-05-22T12:01:00.000Z",
      diagnostics: {
        status: "ready_for_connection_test",
        missing_fields: [],
        can_test: true,
      },
    })

    expect(state.telegram?.last_test_status).toBe("connection_failed")
    expect(state.telegram?.last_test_error).toBe(
      "Telegram webhook URL does not match the saved webhook_url."
    )
    expect(state.telegram?.last_test_at?.toISOString()).toBe(
      "2026-05-22T12:01:00.000Z"
    )
  })
})
