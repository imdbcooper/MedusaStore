/**
 * Unit tests for `POST /admin/assistant/settings/providers/reorder-fallback`
 * ([`providers/reorder-fallback/route.ts`](medusa-agency-boilerplate/src/api/admin/assistant/settings/providers/reorder-fallback/route.ts:1)).
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
const mockReorderFallbackChain = jest.fn<any>(async () => [])

jest.mock("../../../../../modules/assistant-settings", () => {
  const actual = jest.requireActual(
    "../../../../../modules/assistant-settings"
  ) as typeof import("../../../../../modules/assistant-settings")
  return {
    __esModule: true,
    ...actual,
    getAssistantSettingsPgConnection: (...args: any[]) => mockGetPg(...args),
    ensureAssistantSettingsTables: (...args: any[]) => mockEnsureTables(...args),
    reorderFallbackChain: (...args: any[]) => mockReorderFallbackChain(...args),
  }
})

const { AssistantSettingsError } = jest.requireActual(
  "../../../../../modules/assistant-settings"
) as typeof import("../../../../../modules/assistant-settings")

let POST: typeof import("../providers/reorder-fallback/route")["POST"]

beforeAll(() => {
  POST = (require("../providers/reorder-fallback/route") as typeof import("../providers/reorder-fallback/route")).POST
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

function buildReq(orderedIds: string[]): any {
  return {
    validatedBody: { ordered_ids: orderedIds },
    auth_context: { actor_id: "usr_admin", actor_type: "user" },
    scope: { resolve: jest.fn() },
  }
}

const rowFixture = (id: string, priority: number) => ({
  id,
  name: `provider-${id}`,
  base_url: "https://example.com/v1",
  api_key_last4: "0000",
  model: "x",
  temperature: 0.2,
  max_tokens: 1024,
  top_p: null,
  timeout_ms: 30000,
  request_headers: {},
  is_enabled: true,
  is_active: false,
  fallback_priority: priority,
  last_test_at: null,
  last_test_ok: null,
  last_test_latency_ms: null,
  last_test_error: null,
  created_at: "2026-05-15T00:00:00.000Z",
  updated_at: "2026-05-15T00:00:00.000Z",
})

beforeEach(() => {
  mockGetPg.mockReset()
  mockGetPg.mockImplementation(() => ({ __pg: true }))
  mockEnsureTables.mockReset()
  mockEnsureTables.mockImplementation(async () => undefined)
  mockReorderFallbackChain.mockReset()
  mockReorderFallbackChain.mockImplementation(async () => [
    rowFixture("a", 1),
    rowFixture("b", 2),
  ])
})

afterEach(() => { jest.restoreAllMocks() })

describe("POST /admin/assistant/settings/providers/reorder-fallback", () => {
  it("delegates and returns the new chain as masked DTOs", async () => {
    const { res, recorder } = buildResponse()
    await POST(buildReq(["a", "b"]), res)
    expect(mockReorderFallbackChain).toHaveBeenCalledWith(
      { __pg: true },
      ["a", "b"]
    )
    expect(recorder.status).toBe(200)
    expect(recorder.body.providers).toHaveLength(2)
    expect(recorder.body.providers[0].api_key_masked).toBe("••••0000")
  })

  it("maps validation error from module to 400", async () => {
    mockReorderFallbackChain.mockImplementation(async () => {
      throw new AssistantSettingsError("validation", "duplicate id")
    })
    const { res, recorder } = buildResponse()
    await POST(buildReq(["a", "a"]), res)
    expect(recorder.status).toBe(400)
    expect(recorder.body.error).toBe("validation")
  })

  it("maps not_found to 404", async () => {
    mockReorderFallbackChain.mockImplementation(async () => {
      throw new AssistantSettingsError("not_found", "missing")
    })
    const { res, recorder } = buildResponse()
    await POST(buildReq(["a"]), res)
    expect(recorder.status).toBe(404)
  })

  it("maps provider_disabled to 409", async () => {
    mockReorderFallbackChain.mockImplementation(async () => {
      throw new AssistantSettingsError("provider_disabled", "off")
    })
    const { res, recorder } = buildResponse()
    await POST(buildReq(["a"]), res)
    expect(recorder.status).toBe(409)
  })
})
