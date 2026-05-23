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
const mockTestVkConnection = jest.fn<any>(async () => ({}))
const mockRecordVkTestResult = jest.fn<any>(async () => undefined)

jest.mock("../../../../../modules/assistant-settings", () => {
  const actual = jest.requireActual(
    "../../../../../modules/assistant-settings"
  ) as typeof import("../../../../../modules/assistant-settings")
  return {
    __esModule: true,
    ...actual,
    getAssistantSettingsPgConnection: (...args: any[]) => mockGetPg(...args),
    recordAssistantVkHandoffTestResult: (...args: any[]) =>
      mockRecordVkTestResult(...args),
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

let POST: typeof import("../vk-handoff/test/route")["POST"]

beforeAll(() => {
  POST = (require("../vk-handoff/test/route") as typeof import("../vk-handoff/test/route")).POST
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
  mockTestVkConnection.mockReset()
  mockTestVkConnection.mockImplementation(async () => ({
    ok: true,
    status: "connection_ok",
    message: "VK connection test passed.",
    missing_fields: [],
    warnings: [],
    tested_at: "2026-05-15T00:00:00.000Z",
    diagnostics: {
      status: "ready_for_connection_test",
      missing_fields: [],
      can_test: true,
    },
    group: {
      id: "123456789",
      name: "Support Group",
    },
    webhook: {
      configured_url: "https://example.com/api/vk/webhook",
      actual_url: "https://example.com/api/vk/webhook",
    },
  }))
  mockRequireAssistantBackendClient.mockReset()
  mockRequireAssistantBackendClient.mockReturnValue({
    testVkHandoffConnection: (...args: any[]) => mockTestVkConnection(...args),
  })
  mockRecordVkTestResult.mockReset()
  mockRecordVkTestResult.mockImplementation(async () => undefined)
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe("POST /admin/assistant/settings/vk-handoff/test", () => {
  it("runs the live connection test against the saved config and persists it", async () => {
    const { res, recorder } = buildResponse()
    await POST(buildReq({}), res)
    expect(mockTestVkConnection).toHaveBeenCalledWith()
    expect(mockRecordVkTestResult).toHaveBeenCalledWith(
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
    expect(mockTestVkConnection).toHaveBeenCalledWith()
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
    expect(mockTestVkConnection).not.toHaveBeenCalled()
  })

  it("maps not_found to 404", async () => {
    mockRecordVkTestResult.mockImplementation(async () => {
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
    mockTestVkConnection.mockImplementation(async () => {
      throw error
    })
    const { res, recorder } = buildResponse()
    await POST(buildReq({}), res)
    expect(recorder.status).toBe(502)
    expect(recorder.body.error).toBe("AUTH_REQUIRED")
  })
})
