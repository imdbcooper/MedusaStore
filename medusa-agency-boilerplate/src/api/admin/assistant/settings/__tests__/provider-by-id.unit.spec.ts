/**
 * Unit tests for
 * `GET / PATCH / DELETE /admin/assistant/settings/providers/:id`
 * ([`providers/[id]/route.ts`](medusa-agency-boilerplate/src/api/admin/assistant/settings/providers/[id]/route.ts:1)).
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
const mockGetLlmProvider = jest.fn<any>(async () => null)
const mockUpdateLlmProvider = jest.fn<any>(async () => ({}))
const mockDeleteLlmProvider = jest.fn<any>(async () => ({
  deleted: true,
  was_active: false,
}))

jest.mock("../../../../../modules/assistant-settings", () => {
  const actual = jest.requireActual(
    "../../../../../modules/assistant-settings"
  ) as typeof import("../../../../../modules/assistant-settings")
  return {
    __esModule: true,
    ...actual,
    getAssistantSettingsPgConnection: (...args: any[]) => mockGetPg(...args),
    ensureAssistantSettingsTables: (...args: any[]) => mockEnsureTables(...args),
    getLlmProvider: (...args: any[]) => mockGetLlmProvider(...args),
    updateLlmProvider: (...args: any[]) => mockUpdateLlmProvider(...args),
    deleteLlmProvider: (...args: any[]) => mockDeleteLlmProvider(...args),
  }
})

const { AssistantSettingsError } = jest.requireActual(
  "../../../../../modules/assistant-settings"
) as typeof import("../../../../../modules/assistant-settings")

let GET: typeof import("../providers/[id]/route")["GET"]
let PATCH: typeof import("../providers/[id]/route")["PATCH"]
let DELETE: typeof import("../providers/[id]/route")["DELETE"]

beforeAll(() => {
  const mod = require("../providers/[id]/route") as typeof import("../providers/[id]/route")
  GET = mod.GET
  PATCH = mod.PATCH
  DELETE = mod.DELETE
})

type ResRecorder = { status?: number; body?: any; headers: Record<string, string>; ended?: boolean }

function buildResponse(): { res: any; recorder: ResRecorder } {
  const recorder: ResRecorder = { headers: {} }
  const res: any = {
    status(code: number) {
      recorder.status = code
      return this
    },
    json(payload: unknown) {
      recorder.body = payload
      return this
    },
    setHeader(name: string, value: string) {
      recorder.headers[name] = value
    },
    end() {
      recorder.ended = true
    },
  }
  return { res, recorder }
}

function buildReq(input: { id?: string; validatedBody?: any }): any {
  return {
    params: input.id !== undefined ? { id: input.id } : {},
    validatedBody: input.validatedBody,
    auth_context: { actor_id: "usr_admin", actor_type: "user" },
    scope: { resolve: jest.fn() },
  }
}

const baseRow = {
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
  is_active: false,
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
  mockGetLlmProvider.mockReset()
  mockGetLlmProvider.mockImplementation(async () => null)
  mockUpdateLlmProvider.mockReset()
  mockUpdateLlmProvider.mockImplementation(async () => baseRow)
  mockDeleteLlmProvider.mockReset()
  mockDeleteLlmProvider.mockImplementation(async () => ({
    deleted: true,
    was_active: false,
  }))
})

afterEach(() => { jest.restoreAllMocks() })

describe("GET /admin/assistant/settings/providers/:id", () => {
  it("returns 200 with masked provider", async () => {
    mockGetLlmProvider.mockImplementation(async () => baseRow)
    const { res, recorder } = buildResponse()
    await GET(buildReq({ id: "als_abc" }), res)
    expect(mockGetLlmProvider).toHaveBeenCalledWith({ __pg: true }, "als_abc")
    expect(recorder.status).toBe(200)
    expect(recorder.body.provider.api_key_masked).toBe("••••1234")
    expect(recorder.body.provider).not.toHaveProperty("api_key")
  })

  it("returns 404 when not found", async () => {
    const { res, recorder } = buildResponse()
    await GET(buildReq({ id: "als_missing" }), res)
    expect(recorder.status).toBe(404)
    expect(recorder.body).toEqual(
      expect.objectContaining({ error: "not_found" })
    )
  })

  it("returns 400 when id is empty", async () => {
    const { res, recorder } = buildResponse()
    await GET(buildReq({ id: "" }), res)
    expect(recorder.status).toBe(400)
    expect(recorder.body.error).toBe("validation")
  })
})

describe("PATCH /admin/assistant/settings/providers/:id", () => {
  it("forwards body to updateLlmProvider and returns masked DTO", async () => {
    const updated = { ...baseRow, model: "gpt-4o-mini", api_key_last4: "9999" }
    mockUpdateLlmProvider.mockImplementation(async () => updated)
    const body = { model: "gpt-4o-mini", api_key: "sk-NEW" }
    const { res, recorder } = buildResponse()
    await PATCH(buildReq({ id: "als_abc", validatedBody: body }), res)
    expect(mockUpdateLlmProvider).toHaveBeenCalledWith(
      { __pg: true },
      "als_abc",
      body
    )
    expect(recorder.status).toBe(200)
    expect(recorder.body.provider.model).toBe("gpt-4o-mini")
    expect(recorder.body.provider.api_key_masked).toBe("••••9999")
    expect(JSON.stringify(recorder.body)).not.toMatch(/sk-NEW/)
  })

  it("maps version_mismatch to 409", async () => {
    mockUpdateLlmProvider.mockImplementation(async () => {
      throw new AssistantSettingsError("version_mismatch", "stale")
    })
    const { res, recorder } = buildResponse()
    await PATCH(buildReq({ id: "als_abc", validatedBody: { model: "x" } }), res)
    expect(recorder.status).toBe(409)
    expect(recorder.body.error).toBe("version_mismatch")
  })

  it("maps not_found to 404", async () => {
    mockUpdateLlmProvider.mockImplementation(async () => {
      throw new AssistantSettingsError("not_found", "missing")
    })
    const { res, recorder } = buildResponse()
    await PATCH(buildReq({ id: "als_abc", validatedBody: { model: "x" } }), res)
    expect(recorder.status).toBe(404)
  })
})

describe("DELETE /admin/assistant/settings/providers/:id", () => {
  it("204 + X-Was-Active=false on regular delete", async () => {
    const { res, recorder } = buildResponse()
    await DELETE(buildReq({ id: "als_abc" }), res)
    expect(mockDeleteLlmProvider).toHaveBeenCalledWith(
      { __pg: true },
      "als_abc"
    )
    expect(recorder.status).toBe(204)
    expect(recorder.headers["X-Was-Active"]).toBe("false")
    expect(recorder.ended).toBe(true)
  })

  it("204 + X-Was-Active=true when deleted row was active", async () => {
    mockDeleteLlmProvider.mockImplementation(async () => ({
      deleted: true,
      was_active: true,
    }))
    const { res, recorder } = buildResponse()
    await DELETE(buildReq({ id: "als_abc" }), res)
    expect(recorder.status).toBe(204)
    expect(recorder.headers["X-Was-Active"]).toBe("true")
  })

  it("404 when nothing was deleted", async () => {
    mockDeleteLlmProvider.mockImplementation(async () => ({
      deleted: false,
      was_active: false,
    }))
    const { res, recorder } = buildResponse()
    await DELETE(buildReq({ id: "als_abc" }), res)
    expect(recorder.status).toBe(404)
    expect(recorder.body.error).toBe("not_found")
  })

  it("active_required → 409", async () => {
    mockDeleteLlmProvider.mockImplementation(async () => {
      throw new AssistantSettingsError(
        "active_required",
        "cannot delete the last active"
      )
    })
    const { res, recorder } = buildResponse()
    await DELETE(buildReq({ id: "als_abc" }), res)
    expect(recorder.status).toBe(409)
    expect(recorder.body.error).toBe("active_required")
  })
})
