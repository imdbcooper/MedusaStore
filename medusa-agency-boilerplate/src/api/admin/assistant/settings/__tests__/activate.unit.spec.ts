/**
 * Unit tests for `POST /admin/assistant/settings/providers/:id/activate`
 * ([`providers/[id]/activate/route.ts`](medusa-agency-boilerplate/src/api/admin/assistant/settings/providers/[id]/activate/route.ts:1)).
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
const mockSetActiveLlmProvider = jest.fn<any>(async () => ({}))

jest.mock("../../../../../modules/assistant-settings", () => {
  const actual = jest.requireActual(
    "../../../../../modules/assistant-settings"
  ) as typeof import("../../../../../modules/assistant-settings")
  return {
    __esModule: true,
    ...actual,
    getAssistantSettingsPgConnection: (...args: any[]) => mockGetPg(...args),
    ensureAssistantSettingsTables: (...args: any[]) => mockEnsureTables(...args),
    setActiveLlmProvider: (...args: any[]) => mockSetActiveLlmProvider(...args),
  }
})

const { AssistantSettingsError } = jest.requireActual(
  "../../../../../modules/assistant-settings"
) as typeof import("../../../../../modules/assistant-settings")

let POST: typeof import("../providers/[id]/activate/route")["POST"]

beforeAll(() => {
  POST = (require("../providers/[id]/activate/route") as typeof import("../providers/[id]/activate/route")).POST
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

function buildReq(id: string): any {
  return {
    params: { id },
    auth_context: { actor_id: "usr_admin", actor_type: "user" },
    scope: { resolve: jest.fn() },
  }
}

const activatedRow = {
  id: "als_abc",
  name: "polza",
  base_url: "https://api.polza.ai/api/v1",
  api_key_last4: "1234",
  model: "qwen2.5-72b-instruct",
  temperature: 0.2,
  max_tokens: 1024,
  top_p: null,
  timeout_ms: 30000,
  request_headers: {},
  is_enabled: true,
  is_active: true,
  fallback_priority: null,
  last_test_at: null,
  last_test_ok: null,
  last_test_latency_ms: null,
  last_test_error: null,
  created_at: "2026-05-15T00:00:00.000Z",
  updated_at: "2026-05-15T00:00:00.000Z",
}

beforeEach(() => {
  mockGetPg.mockReset()
  mockGetPg.mockImplementation(() => ({ __pg: true }))
  mockEnsureTables.mockReset()
  mockEnsureTables.mockImplementation(async () => undefined)
  mockSetActiveLlmProvider.mockReset()
  mockSetActiveLlmProvider.mockImplementation(async () => activatedRow)
})

afterEach(() => { jest.restoreAllMocks() })

describe("POST /admin/assistant/settings/providers/:id/activate", () => {
  it("activates and returns 200 with masked DTO", async () => {
    const { res, recorder } = buildResponse()
    await POST(buildReq("als_abc"), res)
    expect(mockSetActiveLlmProvider).toHaveBeenCalledWith(
      { __pg: true },
      "als_abc"
    )
    expect(recorder.status).toBe(200)
    expect(recorder.body.provider.is_active).toBe(true)
    expect(recorder.body.provider.api_key_masked).toBe("••••1234")
    expect(recorder.body.provider).not.toHaveProperty("api_key")
  })

  it("400 when id is empty (no params)", async () => {
    const { res, recorder } = buildResponse()
    await POST(buildReq(""), res)
    expect(recorder.status).toBe(400)
    expect(recorder.body.error).toBe("validation")
    expect(mockSetActiveLlmProvider).not.toHaveBeenCalled()
  })

  it("404 when provider missing", async () => {
    mockSetActiveLlmProvider.mockImplementation(async () => {
      throw new AssistantSettingsError("not_found", "missing")
    })
    const { res, recorder } = buildResponse()
    await POST(buildReq("als_missing"), res)
    expect(recorder.status).toBe(404)
    expect(recorder.body.error).toBe("not_found")
  })

  it("409 when provider disabled", async () => {
    mockSetActiveLlmProvider.mockImplementation(async () => {
      throw new AssistantSettingsError("provider_disabled", "disabled")
    })
    const { res, recorder } = buildResponse()
    await POST(buildReq("als_off"), res)
    expect(recorder.status).toBe(409)
    expect(recorder.body.error).toBe("provider_disabled")
  })
})
