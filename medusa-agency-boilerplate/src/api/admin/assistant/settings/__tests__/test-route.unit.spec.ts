/**
 * Unit tests for `POST /admin/assistant/settings/providers/:id/test`
 * ([`providers/[id]/test/route.ts`](medusa-agency-boilerplate/src/api/admin/assistant/settings/providers/[id]/test/route.ts:1)).
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
const mockTestLlmProvider = jest.fn<any>(async () => ({}))

jest.mock("../../../../../modules/assistant-settings", () => {
  const actual = jest.requireActual(
    "../../../../../modules/assistant-settings"
  ) as typeof import("../../../../../modules/assistant-settings")
  return {
    __esModule: true,
    ...actual,
    getAssistantSettingsPgConnection: (...args: any[]) => mockGetPg(...args),
    ensureAssistantSettingsTables: (...args: any[]) => mockEnsureTables(...args),
    testLlmProvider: (...args: any[]) => mockTestLlmProvider(...args),
  }
})

const { AssistantSettingsError } = jest.requireActual(
  "../../../../../modules/assistant-settings"
) as typeof import("../../../../../modules/assistant-settings")

let POST: typeof import("../providers/[id]/test/route")["POST"]

beforeAll(() => {
  POST = (require("../providers/[id]/test/route") as typeof import("../providers/[id]/test/route")).POST
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

function buildReq(id: string, query?: Record<string, unknown>): any {
  return {
    params: { id },
    query: query ?? {},
    auth_context: { actor_id: "usr_admin", actor_type: "user" },
    scope: { resolve: jest.fn() },
  }
}

beforeEach(() => {
  mockGetPg.mockReset()
  mockGetPg.mockImplementation(() => ({ __pg: true }))
  mockEnsureTables.mockReset()
  mockEnsureTables.mockImplementation(async () => undefined)
  mockTestLlmProvider.mockReset()
  mockTestLlmProvider.mockImplementation(async () => ({
    ok: true,
    latency_ms: 42,
    http_status: 200,
    model_available: true,
  }))
})

afterEach(() => { jest.restoreAllMocks() })

describe("POST /admin/assistant/settings/providers/:id/test", () => {
  it("delegates with default prompt (undefined) and returns 200", async () => {
    const { res, recorder } = buildResponse()
    await POST(buildReq("als_abc"), res)
    expect(mockTestLlmProvider).toHaveBeenCalledWith(
      { __pg: true },
      "als_abc",
      { prompt: undefined }
    )
    expect(recorder.status).toBe(200)
    expect(recorder.body.result.ok).toBe(true)
    expect(recorder.body.result.latency_ms).toBe(42)
  })

  it("forwards a valid prompt query", async () => {
    const { res } = buildResponse()
    await POST(buildReq("als_abc", { prompt: "hello" }), res)
    expect(mockTestLlmProvider).toHaveBeenCalledWith(
      { __pg: true },
      "als_abc",
      { prompt: "hello" }
    )
  })

  it("returns 400 when query has unknown keys (strict)", async () => {
    const { res, recorder } = buildResponse()
    await POST(buildReq("als_abc", { promptt: "typo" }), res)
    expect(recorder.status).toBe(400)
    expect(recorder.body.error).toBe("validation")
    expect(mockTestLlmProvider).not.toHaveBeenCalled()
  })

  it("returns 400 when prompt is too long", async () => {
    const { res, recorder } = buildResponse()
    await POST(buildReq("als_abc", { prompt: "x".repeat(501) }), res)
    expect(recorder.status).toBe(400)
    expect(recorder.body.error).toBe("validation")
  })

  it("returns 400 when id is empty", async () => {
    const { res, recorder } = buildResponse()
    await POST(buildReq(""), res)
    expect(recorder.status).toBe(400)
    expect(recorder.body.error).toBe("validation")
    expect(mockTestLlmProvider).not.toHaveBeenCalled()
  })

  it("maps not_found to 404", async () => {
    mockTestLlmProvider.mockImplementation(async () => {
      throw new AssistantSettingsError("not_found", "missing")
    })
    const { res, recorder } = buildResponse()
    await POST(buildReq("als_x"), res)
    expect(recorder.status).toBe(404)
  })

  it("propagates ok=false outcomes via 200 (transport-level)", async () => {
    mockTestLlmProvider.mockImplementation(async () => ({
      ok: false,
      latency_ms: 1500,
      http_status: 401,
      error: "HTTP 401",
    }))
    const { res, recorder } = buildResponse()
    await POST(buildReq("als_x"), res)
    expect(recorder.status).toBe(200)
    expect(recorder.body.result.ok).toBe(false)
    expect(recorder.body.result.error).toBe("HTTP 401")
  })
})
