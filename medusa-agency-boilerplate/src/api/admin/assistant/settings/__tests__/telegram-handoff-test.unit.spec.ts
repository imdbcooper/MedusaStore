/**
 * Unit tests for `POST /admin/assistant/settings/telegram-handoff/test`
 * ([`telegram-handoff/test/route.ts`](medusa-agency-boilerplate/src/api/admin/assistant/settings/telegram-handoff/test/route.ts:1)).
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
const mockRequireAssistantBackendClient = jest.fn<any>()
const mockTestTelegramConnection = jest.fn<any>(async () => ({}))
const mockRecordTelegramTestResult = jest.fn<any>(async () => undefined)

jest.mock("../../../../../modules/assistant-settings", () => {
  const actual = jest.requireActual(
    "../../../../../modules/assistant-settings"
  ) as typeof import("../../../../../modules/assistant-settings")
  return {
    __esModule: true,
    ...actual,
    getAssistantSettingsPgConnection: (...args: any[]) => mockGetPg(...args),
    recordAssistantTelegramHandoffTestResult: (...args: any[]) =>
      mockRecordTelegramTestResult(...args),
  }
})

jest.mock("../../../../../modules/assistant-runtime", () => ({
  __esModule: true,
  requireAssistantBackendClient: (...args: any[]) =>
    mockRequireAssistantBackendClient(...args),
}))

const { AssistantSettingsError } = jest.requireActual(
  "../../../../../modules/assistant-settings"
) as typeof import("../../../../../modules/assistant-settings")

let POST: typeof import("../telegram-handoff/test/route")["POST"]

beforeAll(() => {
  POST = (require("../telegram-handoff/test/route") as typeof import("../telegram-handoff/test/route")).POST
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

function buildReq(validatedBody?: any): any {
  return {
    validatedBody,
    auth_context: { actor_id: "usr_admin", actor_type: "user" },
    scope: { resolve: jest.fn() },
  }
}

beforeEach(() => {
  mockGetPg.mockReset()
  mockGetPg.mockImplementation(() => ({ __pg: true }))
  mockTestTelegramConnection.mockReset()
  mockTestTelegramConnection.mockImplementation(async () => ({
    ok: true,
    status: "connection_ok",
    message: "Telegram connection test passed.",
    missing_fields: [],
    tested_at: "2026-05-15T00:00:00.000Z",
    diagnostics: {
      status: "ready_for_connection_test",
      missing_fields: [],
      can_test: true,
    },
    webhook: {
      configured_url: "https://example.com/api/telegram/webhook",
      actual_url: "https://example.com/api/telegram/webhook",
      pending_update_count: 0,
    },
  }))
  mockRequireAssistantBackendClient.mockReset()
  mockRequireAssistantBackendClient.mockReturnValue({
    testTelegramHandoffConnection: (...args: any[]) =>
      mockTestTelegramConnection(...args),
  })
  mockRecordTelegramTestResult.mockReset()
  mockRecordTelegramTestResult.mockImplementation(async () => undefined)
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe("POST /admin/assistant/settings/telegram-handoff/test", () => {
  it("runs the live connection test against the saved config and persists it", async () => {
    const { res, recorder } = buildResponse()
    await POST(buildReq({}), res)
    expect(mockTestTelegramConnection).toHaveBeenCalledWith()
    expect(mockRecordTelegramTestResult).toHaveBeenCalledWith(
      { __pg: true },
      expect.objectContaining({
        ok: true,
        status: "connection_ok",
      })
    )
    expect(recorder.status).toBe(200)
    expect(recorder.body.result.status).toBe("connection_ok")
  })

  it("uses an empty object when the body is missing", async () => {
    const { res } = buildResponse()
    await POST(buildReq(undefined), res)
    expect(mockTestTelegramConnection).toHaveBeenCalledWith()
  })

  it("rejects unsaved config overrides and asks the caller to save first", async () => {
    const { res, recorder } = buildResponse()
    await POST(
      buildReq({
        enabled: true,
      }),
      res
    )
    expect(recorder.status).toBe(400)
    expect(recorder.body.error).toBe("validation")
    expect(mockTestTelegramConnection).not.toHaveBeenCalled()
  })

  it("maps not_found to 404", async () => {
    mockRecordTelegramTestResult.mockImplementation(async () => {
      throw new AssistantSettingsError("not_found", "missing")
    })
    const { res, recorder } = buildResponse()
    await POST(buildReq({}), res)
    expect(recorder.status).toBe(404)
    expect(recorder.body.error).toBe("not_found")
  })

  it("maps assistant backend auth failures away from browser unauthorized handling", async () => {
    const error = Object.assign(new Error("Valid assistant API token is required."), {
      status: 401,
      code: "AUTH_REQUIRED",
      retryable: false,
    })
    mockTestTelegramConnection.mockImplementation(async () => {
      throw error
    })
    const { res, recorder } = buildResponse()
    await POST(buildReq({}), res)
    expect(recorder.status).toBe(502)
    expect(recorder.body.error).toBe("AUTH_REQUIRED")
  })
})
