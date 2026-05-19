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

function buildReq(headers?: Record<string, string | string[] | undefined>): any {
  return {
    headers: headers ?? {},
    scope: { resolve: jest.fn() },
  }
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
    global: { id: "singleton" },
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
    expect(recorder.body.effective.version).toBe("2026-05-15T00:00:00.000Z")
    expect(mockGetEffective).toHaveBeenCalledWith({ __pg: true })
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
  })
})
