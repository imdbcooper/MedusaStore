/**
 * Unit tests for `GET / PATCH /admin/assistant/settings`
 * ([`settings/route.ts`](medusa-agency-boilerplate/src/api/admin/assistant/settings/route.ts:1)).
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
const mockGetAssistantSetting = jest.fn<any>(async () => ({}))
const mockUpdateAssistantSetting = jest.fn<any>(async () => ({}))

jest.mock("../../../../../modules/assistant-settings", () => {
  const actual = jest.requireActual(
    "../../../../../modules/assistant-settings"
  ) as typeof import("../../../../../modules/assistant-settings")
  return {
    __esModule: true,
    ...actual,
    getAssistantSettingsPgConnection: (...args: any[]) => mockGetPg(...args),
    ensureAssistantSettingsTables: (...args: any[]) => mockEnsureTables(...args),
    getAssistantSetting: (...args: any[]) => mockGetAssistantSetting(...args),
    updateAssistantSetting: (...args: any[]) => mockUpdateAssistantSetting(...args),
  }
})

const { AssistantSettingsError } = jest.requireActual(
  "../../../../../modules/assistant-settings"
) as typeof import("../../../../../modules/assistant-settings")

let GET: typeof import("../route")["GET"]
let PATCH: typeof import("../route")["PATCH"]

beforeAll(() => {
  const mod = require("../route") as typeof import("../route")
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

function buildReq(input: { validatedBody?: any; actorId?: string | null }): any {
  return {
    validatedBody: input.validatedBody,
    auth_context:
      input.actorId === undefined
        ? { actor_id: "usr_admin", actor_type: "user" }
        : input.actorId === null
          ? null
          : { actor_id: input.actorId, actor_type: "user" },
    scope: { resolve: jest.fn() },
  }
}

const settingsRow = {
  id: "singleton",
  system_prompt: "you are an assistant",
  retrieval_mode: "auto" as const,
  retrieval_top_k: 5,
  retrieval_min_score: 0,
  embedding_provider: "hashing",
  embedding_model: null,
  embedding_dimension: 384,
  max_history_messages: 10,
  max_input_chars: 4000,
  max_output_tokens: 1024,
  streaming_enabled: true,
  default_locale: "ru",
  allowed_models: [],
  tools_enabled: {},
  guardrails: {},
  rate_limits: {},
  usage_tracking_enabled: true,
  observability: {},
  version: 1,
  updated_by: null,
  updated_at: "2026-05-15T00:00:00.000Z",
}

beforeEach(() => {
  mockGetPg.mockReset()
  mockGetPg.mockImplementation(() => ({ __pg: true }))
  mockEnsureTables.mockReset()
  mockEnsureTables.mockImplementation(async () => undefined)
  mockGetAssistantSetting.mockReset()
  mockGetAssistantSetting.mockImplementation(async () => settingsRow)
  mockUpdateAssistantSetting.mockReset()
  mockUpdateAssistantSetting.mockImplementation(async () => ({
    ...settingsRow,
    version: 2,
  }))
})

afterEach(() => { jest.restoreAllMocks() })

describe("GET /admin/assistant/settings", () => {
  it("returns the settings row", async () => {
    const { res, recorder } = buildResponse()
    await GET(buildReq({}), res)
    expect(recorder.status).toBe(200)
    expect(recorder.body.settings).toEqual(settingsRow)
    expect(mockGetAssistantSetting).toHaveBeenCalledWith({ __pg: true })
  })

  it("maps not_found to 404", async () => {
    mockGetAssistantSetting.mockImplementation(async () => {
      throw new AssistantSettingsError("not_found", "missing")
    })
    const { res, recorder } = buildResponse()
    await GET(buildReq({}), res)
    expect(recorder.status).toBe(404)
  })
})

describe("PATCH /admin/assistant/settings", () => {
  it("splits expected_version off the body and forwards updatedBy", async () => {
    const { res, recorder } = buildResponse()
    await PATCH(
      buildReq({
        validatedBody: { system_prompt: "new", expected_version: 1 },
      }),
      res
    )
    expect(mockUpdateAssistantSetting).toHaveBeenCalledWith(
      { __pg: true },
      { system_prompt: "new" },
      { expectedVersion: 1, updatedBy: "usr_admin" }
    )
    expect(recorder.status).toBe(200)
    expect(recorder.body.settings.version).toBe(2)
  })

  it("omits updatedBy when actor_id is missing", async () => {
    const { res } = buildResponse()
    await PATCH(
      buildReq({
        validatedBody: { system_prompt: "new" },
        actorId: null,
      }),
      res
    )
    expect(mockUpdateAssistantSetting).toHaveBeenCalledWith(
      { __pg: true },
      { system_prompt: "new" },
      { expectedVersion: undefined }
    )
  })

  it("maps version_mismatch → 409", async () => {
    mockUpdateAssistantSetting.mockImplementation(async () => {
      throw new AssistantSettingsError("version_mismatch", "stale")
    })
    const { res, recorder } = buildResponse()
    await PATCH(
      buildReq({
        validatedBody: { system_prompt: "x", expected_version: 99 },
      }),
      res
    )
    expect(recorder.status).toBe(409)
    expect(recorder.body.error).toBe("version_mismatch")
  })

  it("maps validation → 400", async () => {
    mockUpdateAssistantSetting.mockImplementation(async () => {
      throw new AssistantSettingsError("validation", "bad")
    })
    const { res, recorder } = buildResponse()
    await PATCH(
      buildReq({ validatedBody: { retrieval_mode: "nope" } }),
      res
    )
    expect(recorder.status).toBe(400)
  })
})
