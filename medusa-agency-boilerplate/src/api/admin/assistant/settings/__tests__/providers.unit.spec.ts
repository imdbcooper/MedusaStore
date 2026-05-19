/**
 * Unit tests for `GET / POST /admin/assistant/settings/providers`
 * ([`providers/route.ts`](medusa-agency-boilerplate/src/api/admin/assistant/settings/providers/route.ts:1)).
 *
 * Mocks the entire `assistant-settings` module so the route can be exercised
 * without a real Postgres pool. Verifies:
 *   - GET delegates to `listLlmProviders` and applies `enabled_only`;
 *   - GET maps `AssistantSettingsError` to the right HTTP status;
 *   - POST forwards `validatedBody` to `createLlmProvider`;
 *   - POST returns 201 and DOES NOT serialize the api_key.
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
const mockListLlmProviders = jest.fn<any>(async () => [])
const mockCreateLlmProvider = jest.fn<any>(async () => ({}))

jest.mock("../../../../../modules/assistant-settings", () => {
  const actual = jest.requireActual(
    "../../../../../modules/assistant-settings"
  ) as typeof import("../../../../../modules/assistant-settings")
  return {
    __esModule: true,
    ...actual,
    getAssistantSettingsPgConnection: (...args: any[]) => mockGetPg(...args),
    ensureAssistantSettingsTables: (...args: any[]) => mockEnsureTables(...args),
    listLlmProviders: (...args: any[]) => mockListLlmProviders(...args),
    createLlmProvider: (...args: any[]) => mockCreateLlmProvider(...args),
  }
})

const { AssistantSettingsError } = jest.requireActual(
  "../../../../../modules/assistant-settings"
) as typeof import("../../../../../modules/assistant-settings")

let GET: typeof import("../providers/route")["GET"]
let POST: typeof import("../providers/route")["POST"]

beforeAll(() => {
  const mod = require("../providers/route") as typeof import("../providers/route")
  GET = mod.GET
  POST = mod.POST
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

function buildReq(input: {
  query?: Record<string, unknown>
  validatedBody?: any
}): any {
  return {
    query: input.query ?? {},
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
  mockListLlmProviders.mockReset()
  mockListLlmProviders.mockImplementation(async () => [])
  mockCreateLlmProvider.mockReset()
  mockCreateLlmProvider.mockImplementation(async () => baseRow)
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe("GET /admin/assistant/settings/providers", () => {
  it("delegates to listLlmProviders and serializes via toPublicProvider", async () => {
    mockListLlmProviders.mockImplementation(async () => [baseRow])
    const { res, recorder } = buildResponse()
    await GET(buildReq({}), res)
    expect(mockListLlmProviders).toHaveBeenCalledWith(
      { __pg: true },
      { enabled_only: false }
    )
    expect(recorder.status).toBe(200)
    expect(recorder.body.providers).toHaveLength(1)
    expect(recorder.body.providers[0].api_key_masked).toBe("••••1234")
    expect(recorder.body.providers[0]).not.toHaveProperty("api_key")
  })

  it("forwards enabled_only=true when the query param matches", async () => {
    const { res } = buildResponse()
    await GET(buildReq({ query: { enabled_only: "true" } }), res)
    expect(mockListLlmProviders).toHaveBeenCalledWith(
      { __pg: true },
      { enabled_only: true }
    )
  })

  it("ignores garbage values for enabled_only (defaults to false)", async () => {
    const { res } = buildResponse()
    await GET(buildReq({ query: { enabled_only: "yes-please" } }), res)
    expect(mockListLlmProviders).toHaveBeenCalledWith(
      { __pg: true },
      { enabled_only: false }
    )
  })

  it("maps a module error to its HTTP status", async () => {
    mockListLlmProviders.mockImplementation(async () => {
      throw new AssistantSettingsError(
        "encryption_not_configured",
        "no key"
      )
    })
    const { res, recorder } = buildResponse()
    await GET(buildReq({}), res)
    expect(recorder.status).toBe(503)
    expect(recorder.body).toEqual({
      error: "encryption_not_configured",
      message: "no key",
    })
  })
})

describe("POST /admin/assistant/settings/providers", () => {
  it("creates a provider and returns 201 with masked key", async () => {
    mockCreateLlmProvider.mockImplementation(async () => baseRow)
    const { res, recorder } = buildResponse()
    const body = {
      name: "polza",
      base_url: "https://api.polza.ai/api/v1",
      api_key: "sk-secret",
      model: "qwen2.5-72b-instruct",
    }
    await POST(buildReq({ validatedBody: body }), res)
    expect(mockCreateLlmProvider).toHaveBeenCalledWith({ __pg: true }, body)
    expect(recorder.status).toBe(201)
    expect(recorder.body.provider.api_key_masked).toBe("••••1234")
    expect(recorder.body.provider).not.toHaveProperty("api_key")
    // Make sure the api_key never reaches the response body even via
    // accidental spread.
    expect(JSON.stringify(recorder.body)).not.toMatch(/sk-secret/)
  })

  it("maps validation error to 400", async () => {
    mockCreateLlmProvider.mockImplementation(async () => {
      throw new AssistantSettingsError("validation", "name is required")
    })
    const { res, recorder } = buildResponse()
    await POST(buildReq({ validatedBody: { name: "" } }), res)
    expect(recorder.status).toBe(400)
    expect(recorder.body).toEqual({
      error: "validation",
      message: "name is required",
    })
  })

  it("maps already_exists to 409", async () => {
    mockCreateLlmProvider.mockImplementation(async () => {
      throw new AssistantSettingsError("already_exists", "duplicate")
    })
    const { res, recorder } = buildResponse()
    await POST(buildReq({ validatedBody: { name: "x" } }), res)
    expect(recorder.status).toBe(409)
  })
})
