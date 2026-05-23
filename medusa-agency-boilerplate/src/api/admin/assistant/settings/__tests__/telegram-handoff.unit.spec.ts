/**
 * Unit tests for `GET / PATCH /admin/assistant/settings/telegram-handoff`
 * ([`telegram-handoff/route.ts`](medusa-agency-boilerplate/src/api/admin/assistant/settings/telegram-handoff/route.ts:1)).
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
const mockGetTelegramConfig = jest.fn<any>(async () => ({}))
const mockUpdateTelegramConfig = jest.fn<any>(async () => ({}))

jest.mock("../../../../../modules/assistant-settings", () => {
  const actual = jest.requireActual(
    "../../../../../modules/assistant-settings"
  ) as typeof import("../../../../../modules/assistant-settings")
  return {
    __esModule: true,
    ...actual,
    getAssistantSettingsPgConnection: (...args: any[]) => mockGetPg(...args),
    ensureAssistantSettingsTables: (...args: any[]) => mockEnsureTables(...args),
    getAssistantTelegramHandoffConfig: (...args: any[]) =>
      mockGetTelegramConfig(...args),
    updateAssistantTelegramHandoffConfig: (...args: any[]) =>
      mockUpdateTelegramConfig(...args),
  }
})

const { AssistantSettingsError } = jest.requireActual(
  "../../../../../modules/assistant-settings"
) as typeof import("../../../../../modules/assistant-settings")

let GET: typeof import("../telegram-handoff/route")["GET"]
let PATCH: typeof import("../telegram-handoff/route")["PATCH"]

beforeAll(() => {
  const mod = require("../telegram-handoff/route") as typeof import("../telegram-handoff/route")
  GET = mod.GET
  PATCH = mod.PATCH
})

type ResRecorder = { status?: number; body?: any }

function buildResponse(): { res: any; recorder: ResRecorder } {
  const recorder: ResRecorder = {}
  const res: any = {
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

function buildReq(input: { validatedBody?: any }): any {
  return {
    validatedBody: input.validatedBody,
    auth_context: { actor_id: "usr_admin", actor_type: "user" },
    scope: { resolve: jest.fn() },
  }
}

const configRow = {
  id: "singleton" as const,
  enabled: false,
  environment_mode: "test" as const,
  bot_username: null,
  bot_token: {
    is_configured: true,
    last4: "1234",
    masked: "••••1234",
  },
  support_chat_id: null,
  topics_required: true,
  webhook_url: null,
  webhook_secret: {
    is_configured: true,
    last4: "5678",
    masked: "••••5678",
  },
  allowed_operator_ids: [],
  allowed_admin_ids: [],
  operator_reply_mode: "explicit_reply_command" as const,
  fallback_message: "fallback",
  last_test_status: null,
  last_test_error: null,
  last_test_at: null,
  created_at: "2026-05-15T00:00:00.000Z",
  updated_at: "2026-05-15T00:00:00.000Z",
  version: 1,
  diagnostics: {
    status: "disabled" as const,
    missing_fields: [],
    can_test: false,
  },
}

beforeEach(() => {
  mockGetPg.mockReset()
  mockGetPg.mockImplementation(() => ({ __pg: true }))
  mockEnsureTables.mockReset()
  mockEnsureTables.mockImplementation(async () => undefined)
  mockGetTelegramConfig.mockReset()
  mockGetTelegramConfig.mockImplementation(async () => configRow)
  mockUpdateTelegramConfig.mockReset()
  mockUpdateTelegramConfig.mockImplementation(async () => ({
    ...configRow,
    enabled: true,
    version: 2,
    diagnostics: {
      status: "partially_configured",
      missing_fields: ["support_chat_id"],
      can_test: false,
    },
  }))
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe("GET /admin/assistant/settings/telegram-handoff", () => {
  it("returns the sanitized Telegram handoff config", async () => {
    const { res, recorder } = buildResponse()
    await GET(buildReq({}), res)
    expect(recorder.status).toBe(200)
    expect(recorder.body.config).toEqual(configRow)
    expect(JSON.stringify(recorder.body)).not.toContain("123456:telegram-token")
  })

  it("maps not_found to 404", async () => {
    mockGetTelegramConfig.mockImplementation(async () => {
      throw new AssistantSettingsError("not_found", "missing")
    })
    const { res, recorder } = buildResponse()
    await GET(buildReq({}), res)
    expect(recorder.status).toBe(404)
    expect(recorder.body.error).toBe("not_found")
  })
})

describe("PATCH /admin/assistant/settings/telegram-handoff", () => {
  it("splits expected_version and forwards the update payload", async () => {
    const { res, recorder } = buildResponse()
    await PATCH(
      buildReq({
        validatedBody: {
          enabled: true,
          support_chat_id: "-100123",
          expected_version: 1,
        },
      }),
      res
    )
    expect(mockUpdateTelegramConfig).toHaveBeenCalledWith(
      { __pg: true },
      {
        enabled: true,
        support_chat_id: "-100123",
      },
      { expectedVersion: 1 }
    )
    expect(recorder.status).toBe(200)
    expect(recorder.body.config.version).toBe(2)
  })

  it("never returns plain secrets in the response body", async () => {
    const { res, recorder } = buildResponse()
    await PATCH(
      buildReq({
        validatedBody: {
          bot_token: "123456:telegram-token",
          webhook_secret: "super-secret-webhook",
          expected_version: 1,
        },
      }),
      res
    )
    expect(JSON.stringify(recorder.body)).not.toContain("123456:telegram-token")
    expect(JSON.stringify(recorder.body)).not.toContain("super-secret-webhook")
  })

  it("maps validation to 400", async () => {
    mockUpdateTelegramConfig.mockImplementation(async () => {
      throw new AssistantSettingsError("validation", "bad payload")
    })
    const { res, recorder } = buildResponse()
    await PATCH(
      buildReq({ validatedBody: { enabled: true, expected_version: 1 } }),
      res
    )
    expect(recorder.status).toBe(400)
    expect(recorder.body.error).toBe("validation")
  })

  it("maps version_mismatch to 409", async () => {
    mockUpdateTelegramConfig.mockImplementation(async () => {
      throw new AssistantSettingsError("version_mismatch", "stale row")
    })
    const { res, recorder } = buildResponse()
    await PATCH(
      buildReq({ validatedBody: { enabled: false, expected_version: 99 } }),
      res
    )
    expect(recorder.status).toBe(409)
    expect(recorder.body.error).toBe("version_mismatch")
  })
})
