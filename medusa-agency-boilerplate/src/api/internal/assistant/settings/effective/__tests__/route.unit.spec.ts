/**
 * Unit tests for `GET /internal/assistant/settings/effective`
 * ([`effective/route.ts`](medusa-agency-boilerplate/src/api/internal/assistant/settings/effective/route.ts:1)).
 *
 * Verifies the timing-safe token comparison and that decryption only happens
 * after auth passes.
 */

import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals"

const mockGetPg = jest.fn<any>(() => ({ __pg: true }))
const mockEnsureTables = jest.fn<any>(async () => undefined)
const mockGetEffective = jest.fn<any>(async () => ({}))

jest.mock("../../../../../../modules/assistant-settings", () => {
  const actual = jest.requireActual(
    "../../../../../../modules/assistant-settings"
  ) as typeof import("../../../../../../modules/assistant-settings")
  return {
    __esModule: true,
    ...actual,
    getAssistantSettingsPgConnection: (...args: any[]) => mockGetPg(...args),
    ensureAssistantSettingsTables: (...args: any[]) => mockEnsureTables(...args),
    getEffectiveAssistantConfig: (...args: any[]) => mockGetEffective(...args),
  }
})

let GET: typeof import("../route")["GET"]

beforeAll(() => {
  GET = (require("../route") as typeof import("../route")).GET
})

type ResRecorder = {
  status?: number
  body?: any
  headers: Record<string, string>
}

function expectNoCacheHeaders(recorder: ResRecorder) {
  expect(recorder.headers["Cache-Control"]).toBe(
    "no-store, no-cache, must-revalidate, private"
  )
  expect(recorder.headers.Pragma).toBe("no-cache")
  expect(recorder.headers.Expires).toBe("0")
}

function buildResponse(): { res: any; recorder: ResRecorder } {
  const recorder: ResRecorder = { headers: {} }
  const res: any = {
    setHeader(name: string, value: string) {
      recorder.headers[name] = value
      return this
    },
    status(code: number) {
      recorder.status = code
      return this
    },
    json(payload: unknown) {
      recorder.body = payload
      return this
    },
  }
  return { res, recorder }
}

function buildReq(headers?: Record<string, string | string[] | undefined>): any {
  return {
    headers: headers ?? {},
    scope: { resolve: jest.fn() },
  }
}

const vkHandoff = {
  id: "singleton",
  enabled: false,
  environment_mode: "test",
  group_id: null,
  support_peer_id: null,
  webhook_url: null,
  community_access_token: null,
  secret_key: null,
  confirmation_code: null,
  allowed_operator_ids: [],
  allowed_admin_ids: [],
  operator_reply_mode: "explicit_ticket_command",
  fallback_message: "fallback",
  last_test_status: null,
  last_test_error: null,
  last_test_at: null,
  created_at: "2026-05-15T00:00:00.000Z",
  updated_at: "2026-05-15T00:00:00.000Z",
  version: 1,
  diagnostics: {
    status: "disabled",
    missing_fields: [],
    can_test: false,
  },
}

const ORIGINAL_TOKEN = process.env.AI_ASSISTANT_SERVER_TOKEN

beforeEach(() => {
  mockGetPg.mockReset()
  mockGetPg.mockImplementation(() => ({ __pg: true }))
  mockEnsureTables.mockReset()
  mockEnsureTables.mockImplementation(async () => undefined)
  mockGetEffective.mockReset()
  mockGetEffective.mockImplementation(async () => ({
    version: "2026-05-15T00:00:00.000Z",
    active: null,
    fallback: [],
    global: { id: "singleton", active_handoff_channel: "telegram" },
    active_handoff_channel: "telegram",
    telegram_handoff: {
      id: "singleton",
      enabled: false,
      environment_mode: "test",
      bot_username: null,
      bot_token: null,
      support_chat_id: null,
      topics_required: true,
      webhook_url: null,
      webhook_secret: null,
      allowed_operator_ids: [],
      allowed_admin_ids: [],
      operator_reply_mode: "explicit_reply_command",
      fallback_message: "fallback",
      last_test_status: null,
      last_test_error: null,
      last_test_at: null,
      created_at: "2026-05-15T00:00:00.000Z",
      updated_at: "2026-05-15T00:00:00.000Z",
      version: 1,
      diagnostics: {
        status: "disabled",
        missing_fields: [],
        can_test: false,
      },
    },
    vk_handoff: vkHandoff,
  }))
})

afterEach(() => {
  if (ORIGINAL_TOKEN === undefined) {
    delete process.env.AI_ASSISTANT_SERVER_TOKEN
  } else {
    process.env.AI_ASSISTANT_SERVER_TOKEN = ORIGINAL_TOKEN
  }
  jest.restoreAllMocks()
})

describe("GET /internal/assistant/settings/effective", () => {
  it("returns 503 when AI_ASSISTANT_SERVER_TOKEN is not configured", async () => {
    delete process.env.AI_ASSISTANT_SERVER_TOKEN
    const { res, recorder } = buildResponse()
    await GET(buildReq({ "x-assistant-server-token": "anything" }), res)
    expect(recorder.status).toBe(503)
    expect(recorder.body.error).toBe("encryption_not_configured")
    expectNoCacheHeaders(recorder)
    expect(mockGetEffective).not.toHaveBeenCalled()
  })

  it("returns 503 when token env is whitespace only", async () => {
    process.env.AI_ASSISTANT_SERVER_TOKEN = "   "
    const { res, recorder } = buildResponse()
    await GET(buildReq({ "x-assistant-server-token": "x" }), res)
    expect(recorder.status).toBe(503)
  })

  it("returns 401 when header is missing", async () => {
    process.env.AI_ASSISTANT_SERVER_TOKEN = "good-token"
    const { res, recorder } = buildResponse()
    await GET(buildReq({}), res)
    expect(recorder.status).toBe(401)
    expect(recorder.body.error).toBe("unauthorized")
    expectNoCacheHeaders(recorder)
    expect(mockGetEffective).not.toHaveBeenCalled()
  })

  it("returns 401 when token does NOT match", async () => {
    process.env.AI_ASSISTANT_SERVER_TOKEN = "good-token"
    const { res, recorder } = buildResponse()
    await GET(
      buildReq({ "x-assistant-server-token": "bad-token-different" }),
      res
    )
    expect(recorder.status).toBe(401)
    expect(mockGetEffective).not.toHaveBeenCalled()
  })

  it("returns 401 when length mismatches WITHOUT throwing", async () => {
    process.env.AI_ASSISTANT_SERVER_TOKEN = "good-token-32-bytes-aaaaaaaaaaaa"
    const { res, recorder } = buildResponse()
    await expect(
      GET(buildReq({ "x-assistant-server-token": "short" }), res)
    ).resolves.toBeUndefined()
    expect(recorder.status).toBe(401)
    expect(mockGetEffective).not.toHaveBeenCalled()
  })

  it("returns 401 when token is empty string", async () => {
    process.env.AI_ASSISTANT_SERVER_TOKEN = "good-token"
    const { res, recorder } = buildResponse()
    await GET(buildReq({ "x-assistant-server-token": "" }), res)
    expect(recorder.status).toBe(401)
  })

  it("returns 200 with effective config when token matches", async () => {
    process.env.AI_ASSISTANT_SERVER_TOKEN = "good-token"
    const { res, recorder } = buildResponse()
    await GET(buildReq({ "x-assistant-server-token": "good-token" }), res)
    expect(recorder.status).toBe(200)
    expectNoCacheHeaders(recorder)
    expect(recorder.body.effective.version).toBe("2026-05-15T00:00:00.000Z")
    expect(recorder.body.effective.active_handoff_channel).toBe("telegram")
    expect(recorder.body.effective.telegram_handoff.enabled).toBe(false)
    expect(recorder.body.effective.vk_handoff.enabled).toBe(false)
    expect(mockGetEffective).toHaveBeenCalledWith({ __pg: true })
  })

  it("returns internal-only Telegram secrets on the authenticated runtime path", async () => {
    process.env.AI_ASSISTANT_SERVER_TOKEN = "good-token"
    mockGetEffective.mockImplementation(async () => ({
      version: "2026-05-15T00:00:00.000Z",
      active: null,
      fallback: [],
      global: { id: "singleton", active_handoff_channel: "telegram" },
      active_handoff_channel: "telegram",
      telegram_handoff: {
        id: "singleton",
        enabled: true,
        environment_mode: "test",
        bot_username: "shop_support_bot",
        bot_token: "123456:telegram-token",
        support_chat_id: "-1001234567890",
        topics_required: true,
        webhook_url: "https://example.com/telegram/webhook",
        webhook_secret: "runtime-webhook-secret",
        allowed_operator_ids: [],
        allowed_admin_ids: [],
        operator_reply_mode: "explicit_reply_command",
        fallback_message: "fallback",
        last_test_status: "dry_run_passed",
        last_test_error: null,
        last_test_at: "2026-05-15T00:00:00.000Z",
        created_at: "2026-05-15T00:00:00.000Z",
        updated_at: "2026-05-15T00:00:00.000Z",
        version: 3,
        diagnostics: {
          status: "ready_for_connection_test",
          missing_fields: [],
          can_test: true,
        },
      },
      vk_handoff: vkHandoff,
    }))

    const { res, recorder } = buildResponse()
    await GET(buildReq({ "x-assistant-server-token": "good-token" }), res)

    expect(recorder.status).toBe(200)
    expect(recorder.body.effective.telegram_handoff.bot_token).toBe(
      "123456:telegram-token"
    )
    expect(recorder.body.effective.telegram_handoff.webhook_secret).toBe(
      "runtime-webhook-secret"
    )
  })

  it("returns incomplete Telegram runtime config without failing the endpoint", async () => {
    process.env.AI_ASSISTANT_SERVER_TOKEN = "good-token"
    mockGetEffective.mockImplementation(async () => ({
      version: "2026-05-15T00:00:00.000Z",
      active: null,
      fallback: [],
      global: { id: "singleton", active_handoff_channel: "telegram" },
      active_handoff_channel: "telegram",
      telegram_handoff: {
        id: "singleton",
        enabled: true,
        environment_mode: "production",
        bot_username: null,
        bot_token: null,
        support_chat_id: null,
        topics_required: true,
        webhook_url: null,
        webhook_secret: null,
        allowed_operator_ids: [],
        allowed_admin_ids: [],
        operator_reply_mode: "explicit_reply_command",
        fallback_message: "fallback",
        last_test_status: "missing_credentials",
        last_test_error: "Missing required Telegram handoff configuration",
        last_test_at: "2026-05-15T00:00:00.000Z",
        created_at: "2026-05-15T00:00:00.000Z",
        updated_at: "2026-05-15T00:00:00.000Z",
        version: 3,
        diagnostics: {
          status: "partially_configured",
          missing_fields: [
            "bot_token",
            "support_chat_id",
            "webhook_url",
            "allowed_operator_ids_or_allowed_admin_ids",
          ],
          can_test: false,
        },
      },
      vk_handoff: vkHandoff,
    }))

    const { res, recorder } = buildResponse()
    await GET(buildReq({ "x-assistant-server-token": "good-token" }), res)

    expect(recorder.status).toBe(200)
    expect(recorder.body.effective.telegram_handoff.enabled).toBe(true)
    expect(recorder.body.effective.telegram_handoff.bot_token).toBeNull()
    expect(recorder.body.effective.telegram_handoff.diagnostics.status).toBe(
      "partially_configured"
    )
  })

  it("handles array-typed header value (takes first entry)", async () => {
    process.env.AI_ASSISTANT_SERVER_TOKEN = "good-token"
    const { res, recorder } = buildResponse()
    await GET(
      buildReq({
        "x-assistant-server-token": ["good-token", "ignored"],
      }),
      res
    )
    expect(recorder.status).toBe(200)
  })

  it("returns 500 when downstream effective lookup throws", async () => {
    process.env.AI_ASSISTANT_SERVER_TOKEN = "good-token"
    mockGetEffective.mockImplementation(async () => {
      throw new Error("db down")
    })
    const { res, recorder } = buildResponse()
    await GET(buildReq({ "x-assistant-server-token": "good-token" }), res)
    expect(recorder.status).toBe(500)
    expect(recorder.body.error).toBe("internal_error")
    expectNoCacheHeaders(recorder)
  })
})
