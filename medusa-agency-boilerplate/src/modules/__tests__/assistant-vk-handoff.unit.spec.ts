import { afterEach, beforeEach, describe, expect, it } from "@jest/globals"
import { randomBytes } from "node:crypto"

import {
  ensureAssistantSettingsTables,
  getAssistantVkHandoffConfig,
  getAssistantVkHandoffRuntimeConfig,
  recordAssistantVkHandoffTestResult,
  testAssistantVkHandoffConfig,
  updateAssistantVkHandoffConfig,
  type PgConnectionLike,
} from "../assistant-settings"
import { resetEncryptionKeyCacheForTests } from "../../lib/crypto/secret-cipher"

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
  settingSeeded: boolean
  vk: VkState | null
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

function projectVk(state: VkState): Record<string, unknown> {
  return {
    id: "singleton",
    enabled: state.enabled,
    environment_mode: state.environment_mode,
    group_id: state.group_id,
    support_peer_id: state.support_peer_id,
    webhook_url: state.webhook_url,
    community_access_token_last4: state.community_access_token_last4,
    secret_key_last4: state.secret_key_last4,
    confirmation_code_last4: state.confirmation_code_last4,
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

function projectVkRuntime(state: VkState): Record<string, unknown> {
  return {
    ...projectVk(state),
    community_access_token_ciphertext: state.community_access_token_ciphertext,
    community_access_token_iv: state.community_access_token_iv,
    community_access_token_tag: state.community_access_token_tag,
    secret_key_ciphertext: state.secret_key_ciphertext,
    secret_key_iv: state.secret_key_iv,
    secret_key_tag: state.secret_key_tag,
    confirmation_code_ciphertext: state.confirmation_code_ciphertext,
    confirmation_code_iv: state.confirmation_code_iv,
    confirmation_code_tag: state.confirmation_code_tag,
  }
}

function applyVkColumn(
  vk: VkState,
  column: string,
  value: unknown
): void {
  switch (column) {
    case "enabled":
      ;(vk as any)[column] = Boolean(value)
      break
    case "environment_mode":
    case "operator_reply_mode":
      ;(vk as any)[column] = String(value)
      break
    case "group_id":
    case "support_peer_id":
    case "webhook_url":
    case "fallback_message":
      ;(vk as any)[column] =
        value === null || value === undefined ? null : String(value)
      break
    case "allowed_operator_ids":
    case "allowed_admin_ids":
      ;(vk as any)[column] =
        typeof value === "string" ? JSON.parse(value) : value
      break
    case "community_access_token_ciphertext":
    case "community_access_token_iv":
    case "community_access_token_tag":
    case "secret_key_ciphertext":
    case "secret_key_iv":
    case "secret_key_tag":
    case "confirmation_code_ciphertext":
    case "confirmation_code_iv":
    case "confirmation_code_tag":
      ;(vk as any)[column] = value as Buffer
      break
    case "community_access_token_last4":
    case "secret_key_last4":
    case "confirmation_code_last4":
    case "last_test_status":
    case "last_test_error":
      ;(vk as any)[column] =
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
      case "add-column-setting-active-handoff-channel":
      case "create-table-telegram-handoff":
      case "create-table-vk-handoff":
        return { rows: [], rowCount: 0 }

      case "seed-singleton":
        if (state.settingSeeded) {
          return { rows: [], rowCount: 0 }
        }
        state.settingSeeded = true
        return { rows: [], rowCount: 1 }

      case "seed-telegram-handoff-singleton":
        return { rows: [], rowCount: 1 }

      case "seed-vk-handoff-singleton": {
        if (state.vk) {
          return { rows: [], rowCount: 0 }
        }
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

      case "get-vk-handoff":
      case "lock-vk-handoff":
        return {
          rows: state.vk ? ([projectVk(state.vk)] as unknown as T[]) : [],
        }

      case "get-vk-handoff-runtime":
        return {
          rows: state.vk
            ? ([projectVkRuntime(state.vk)] as unknown as T[])
            : [],
        }

      case "update-vk-handoff": {
        if (!state.vk) {
          return { rows: [], rowCount: 0 }
        }
        const cols = extractSetColumns(sql)
        for (let index = 0; index < cols.length; index += 1) {
          applyVkColumn(state.vk, cols[index], bindings[index])
        }
        state.vk.version += 1
        state.vk.updated_at = nextNow(state)
        return {
          rows: [projectVk(state.vk)] as unknown as T[],
          rowCount: 1,
        }
      }

      case "update-vk-handoff-test-result": {
        if (!state.vk) {
          return { rows: [], rowCount: 0 }
        }
        const [last_test_status, last_test_error, last_test_at] = bindings as [
          string,
          string | null,
          string,
        ]
        state.vk.last_test_status = last_test_status
        state.vk.last_test_error = last_test_error
        state.vk.last_test_at = new Date(last_test_at)
        state.vk.updated_at = nextNow(state)
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
    vk: null,
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

describe("VK handoff config storage", () => {
  it("seeds the singleton row exactly once with disabled defaults", async () => {
    const state = buildState()
    const pg = buildMockPg(state)

    await ensureAssistantSettingsTables(pg)
    await ensureAssistantSettingsTables(pg)

    const config = await getAssistantVkHandoffConfig(pg)
    expect(config.enabled).toBe(false)
    expect(config.environment_mode).toBe("test")
    expect(config.operator_reply_mode).toBe("explicit_ticket_command")
    expect(config.allowed_operator_ids).toEqual([])
    expect(config.allowed_admin_ids).toEqual([])
    expect(config.community_access_token.is_configured).toBe(false)
    expect(config.secret_key.is_configured).toBe(false)
    expect(config.confirmation_code.is_configured).toBe(false)
    expect(config.diagnostics.status).toBe("disabled")
  })

  it("stores secrets encrypted and only returns masked metadata", async () => {
    const state = buildState()
    const pg = buildMockPg(state)

    const updated = await updateAssistantVkHandoffConfig(pg, {
      enabled: false,
      community_access_token: "vk-community-access-token-1234",
      secret_key: "vk-secret-key-5678",
      confirmation_code: "vk-confirmation-code-9012",
    })

    expect(updated.community_access_token.is_configured).toBe(true)
    expect(updated.community_access_token.last4).toBe("1234")
    expect(updated.secret_key.last4).toBe("5678")
    expect(updated.confirmation_code.last4).toBe("9012")
    expect(JSON.stringify(updated)).not.toContain("vk-community-access-token-1234")
    expect(JSON.stringify(updated)).not.toContain("vk-secret-key-5678")
    expect(JSON.stringify(updated)).not.toContain("vk-confirmation-code-9012")
    expect(state.vk?.community_access_token_ciphertext).toBeInstanceOf(Buffer)
    expect(state.vk?.secret_key_ciphertext).toBeInstanceOf(Buffer)
    expect(state.vk?.confirmation_code_ciphertext).toBeInstanceOf(Buffer)
  })

  it("returns raw secrets only through the internal runtime config helper", async () => {
    const state = buildState()
    const pg = buildMockPg(state)

    await updateAssistantVkHandoffConfig(pg, {
      enabled: true,
      environment_mode: "test",
      group_id: "123456789",
      support_peer_id: "2000000001",
      webhook_url: "https://example.com/vk/webhook",
      community_access_token: "vk-community-access-token-1234",
      secret_key: "vk-secret-key-5678",
      confirmation_code: "vk-confirmation-code-9012",
    })

    const publicConfig = await getAssistantVkHandoffConfig(pg)
    const runtimeConfig = await getAssistantVkHandoffRuntimeConfig(pg)

    expect(publicConfig.community_access_token).toEqual({
      is_configured: true,
      last4: "1234",
      masked: "••••1234",
    })
    expect(publicConfig.secret_key).toEqual({
      is_configured: true,
      last4: "5678",
      masked: "••••5678",
    })
    expect(publicConfig.confirmation_code).toEqual({
      is_configured: true,
      last4: "9012",
      masked: "••••9012",
    })
    expect(runtimeConfig.community_access_token).toBe(
      "vk-community-access-token-1234"
    )
    expect(runtimeConfig.secret_key).toBe("vk-secret-key-5678")
    expect(runtimeConfig.confirmation_code).toBe("vk-confirmation-code-9012")
    expect(runtimeConfig.diagnostics.status).toBe("ready_for_connection_test")
  })

  it("does not overwrite stored secrets when PATCH omits new secret values", async () => {
    const state = buildState()
    const pg = buildMockPg(state)

    await updateAssistantVkHandoffConfig(pg, {
      community_access_token: "vk-community-access-token-1234",
      secret_key: "vk-secret-key-5678",
      confirmation_code: "vk-confirmation-code-9012",
    })

    const accessCipherBefore = Buffer.from(
      state.vk!.community_access_token_ciphertext!
    )
    const secretCipherBefore = Buffer.from(state.vk!.secret_key_ciphertext!)
    const confirmationCipherBefore = Buffer.from(
      state.vk!.confirmation_code_ciphertext!
    )

    const updated = await updateAssistantVkHandoffConfig(pg, {
      group_id: "123456789",
      support_peer_id: "2000000001",
      webhook_url: "https://example.com/vk/webhook",
    })

    expect(updated.group_id).toBe("123456789")
    expect(
      state.vk!.community_access_token_ciphertext!.equals(accessCipherBefore)
    ).toBe(true)
    expect(state.vk!.secret_key_ciphertext!.equals(secretCipherBefore)).toBe(
      true
    )
    expect(
      state.vk!.confirmation_code_ciphertext!.equals(confirmationCipherBefore)
    ).toBe(true)
  })

  it("allows enabling when secrets are already stored and PATCH omits new values", async () => {
    const state = buildState()
    const pg = buildMockPg(state)

    await updateAssistantVkHandoffConfig(pg, {
      community_access_token: "vk-community-access-token-1234",
      secret_key: "vk-secret-key-5678",
      confirmation_code: "vk-confirmation-code-9012",
    })

    const updated = await updateAssistantVkHandoffConfig(pg, {
      enabled: true,
      environment_mode: "test",
      group_id: "123456789",
      support_peer_id: "2000000001",
      webhook_url: "https://example.com/vk/webhook",
      allowed_operator_ids: [],
      allowed_admin_ids: [],
    })

    expect(updated.enabled).toBe(true)
    expect(updated.confirmation_code.is_configured).toBe(true)
    expect(updated.diagnostics.status).toBe("ready_for_connection_test")
  })

  it("allows saving an incomplete disabled config", async () => {
    const state = buildState()
    const pg = buildMockPg(state)

    const updated = await updateAssistantVkHandoffConfig(pg, {
      enabled: false,
      group_id: null,
      support_peer_id: null,
      webhook_url: null,
      allowed_operator_ids: [],
      allowed_admin_ids: [],
    })

    expect(updated.enabled).toBe(false)
    expect(updated.group_id).toBeNull()
    expect(updated.support_peer_id).toBeNull()
    expect(updated.webhook_url).toBeNull()
    expect(updated.diagnostics.status).toBe("disabled")
  })

  it("rejects enabling the config without a group_id", async () => {
    const state = buildState()
    const pg = buildMockPg(state)

    await expect(
      updateAssistantVkHandoffConfig(pg, {
        enabled: true,
        support_peer_id: "2000000001",
        webhook_url: "https://example.com/vk/webhook",
        community_access_token: "vk-community-access-token-1234",
        secret_key: "vk-secret-key-5678",
        confirmation_code: "vk-confirmation-code-9012",
      })
    ).rejects.toMatchObject({
      name: "AssistantSettingsError",
      code: "validation",
      message: "group_id is required when VK handoff is enabled",
    })
  })

  it("rejects enabling the config without a secret key", async () => {
    const state = buildState()
    const pg = buildMockPg(state)

    await expect(
      updateAssistantVkHandoffConfig(pg, {
        enabled: true,
        group_id: "123456789",
        support_peer_id: "2000000001",
        webhook_url: "https://example.com/vk/webhook",
        community_access_token: "vk-community-access-token-1234",
        confirmation_code: "vk-confirmation-code-9012",
      })
    ).rejects.toMatchObject({
      name: "AssistantSettingsError",
      code: "validation",
      message: "secret_key is required when VK handoff is enabled",
    })
  })

  it("allows test mode without operator/admin ids once core credentials exist", async () => {
    const state = buildState()
    const pg = buildMockPg(state)

    const updated = await updateAssistantVkHandoffConfig(pg, {
      enabled: true,
      environment_mode: "test",
      group_id: "123456789",
      support_peer_id: "2000000001",
      webhook_url: "https://example.com/vk/webhook",
      community_access_token: "vk-community-access-token-1234",
      secret_key: "vk-secret-key-5678",
      confirmation_code: "vk-confirmation-code-9012",
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
      updateAssistantVkHandoffConfig(pg, {
        enabled: true,
        environment_mode: "production",
        group_id: "123456789",
        support_peer_id: "2000000001",
        webhook_url: "https://example.com/vk/webhook",
        community_access_token: "vk-community-access-token-1234",
        secret_key: "vk-secret-key-5678",
        confirmation_code: "vk-confirmation-code-9012",
        allowed_operator_ids: [],
        allowed_admin_ids: [],
      })
    ).rejects.toMatchObject({
      name: "AssistantSettingsError",
      code: "validation",
    })
  })
})

describe("VK handoff local validation diagnostics", () => {
  it("returns missing_credentials and persists last_test_status for incomplete config", async () => {
    const state = buildState()
    const pg = buildMockPg(state)

    const result = await testAssistantVkHandoffConfig(pg, {
      enabled: true,
    })

    expect(result.ok).toBe(false)
    expect(result.status).toBe("missing_credentials")
    expect(result.missing_fields).toContain("group_id")
    expect(result.missing_fields).toContain("support_peer_id")
    expect(result.missing_fields).toContain("community_access_token")
    expect(result.missing_fields).toContain("secret_key")
    expect(result.missing_fields).toContain("confirmation_code")
    expect(state.vk?.last_test_status).toBe("missing_credentials")
    expect(state.vk?.last_test_error).toContain("Missing required")
    expect(state.vk?.last_test_at).not.toBeNull()
  })

  it("returns dry_run_passed for local validation when required VK fields are present", async () => {
    const state = buildState()
    const pg = buildMockPg(state)

    const result = await testAssistantVkHandoffConfig(pg, {
      enabled: true,
      environment_mode: "test",
      group_id: "123456789",
      support_peer_id: "2000000001",
      webhook_url: "https://example.com/vk/webhook",
      community_access_token: "vk-community-access-token-1234",
      secret_key: "vk-secret-key-5678",
      confirmation_code: "vk-confirmation-code-9012",
    })

    expect(result.ok).toBe(true)
    expect(result.status).toBe("dry_run_passed")
    expect(result.message).toContain("Local VK handoff validation passed")
    expect(state.vk?.last_test_status).toBe("dry_run_passed")
    expect(state.vk?.last_test_error).toBeNull()
  })

  it("persists externally supplied live test results", async () => {
    const state = buildState()
    const pg = buildMockPg(state)

    await recordAssistantVkHandoffTestResult(pg, {
      ok: false,
      status: "connection_failed",
      message: "VK webhook secret does not match the saved secret_key.",
      missing_fields: [],
      tested_at: "2026-05-22T12:01:00.000Z",
      diagnostics: {
        status: "ready_for_connection_test",
        missing_fields: [],
        can_test: true,
      },
    })

    expect(state.vk?.last_test_status).toBe("connection_failed")
    expect(state.vk?.last_test_error).toBe(
      "VK webhook secret does not match the saved secret_key."
    )
    expect(state.vk?.last_test_at?.toISOString()).toBe(
      "2026-05-22T12:01:00.000Z"
    )
  })
})
