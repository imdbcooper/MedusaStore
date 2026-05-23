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
const mockGetVkConfig = jest.fn<any>(async () => ({}))
const mockUpdateVkConfig = jest.fn<any>(async () => ({}))

jest.mock("../../../../../modules/assistant-settings", () => {
  const actual = jest.requireActual(
    "../../../../../modules/assistant-settings"
  ) as typeof import("../../../../../modules/assistant-settings")
  return {
    __esModule: true,
    ...actual,
    getAssistantSettingsPgConnection: (...args: any[]) => mockGetPg(...args),
    ensureAssistantSettingsTables: (...args: any[]) => mockEnsureTables(...args),
    getAssistantVkHandoffConfig: (...args: any[]) => mockGetVkConfig(...args),
    updateAssistantVkHandoffConfig: (...args: any[]) =>
      mockUpdateVkConfig(...args),
  }
})

const { AssistantSettingsError } = jest.requireActual(
  "../../../../../modules/assistant-settings"
) as typeof import("../../../../../modules/assistant-settings")

let GET: typeof import("../vk-handoff/route")["GET"]
let PATCH: typeof import("../vk-handoff/route")["PATCH"]

beforeAll(() => {
  const mod = require("../vk-handoff/route") as typeof import("../vk-handoff/route")
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
  group_id: null,
  support_peer_id: null,
  webhook_url: null,
  community_access_token: {
    is_configured: true,
    last4: "1234",
    masked: "••••1234",
  },
  secret_key: {
    is_configured: true,
    last4: "5678",
    masked: "••••5678",
  },
  confirmation_code: {
    is_configured: true,
    last4: "9012",
    masked: "••••9012",
  },
  allowed_operator_ids: [],
  allowed_admin_ids: [],
  operator_reply_mode: "explicit_ticket_command" as const,
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
  mockGetVkConfig.mockReset()
  mockGetVkConfig.mockImplementation(async () => configRow)
  mockUpdateVkConfig.mockReset()
  mockUpdateVkConfig.mockImplementation(async () => ({
    ...configRow,
    enabled: true,
    version: 2,
    diagnostics: {
      status: "partially_configured",
      missing_fields: ["support_peer_id"],
      can_test: false,
    },
  }))
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe("GET /admin/assistant/settings/vk-handoff", () => {
  it("returns the sanitized VK handoff config", async () => {
    const { res, recorder } = buildResponse()
    await GET(buildReq({}), res)
    expect(recorder.status).toBe(200)
    expect(recorder.body.config).toEqual(configRow)
    expect(JSON.stringify(recorder.body)).not.toContain(
      "vk-community-access-token"
    )
  })

  it("maps not_found to 404", async () => {
    mockGetVkConfig.mockImplementation(async () => {
      throw new AssistantSettingsError("not_found", "missing")
    })
    const { res, recorder } = buildResponse()
    await GET(buildReq({}), res)
    expect(recorder.status).toBe(404)
    expect(recorder.body.error).toBe("not_found")
  })
})

describe("PATCH /admin/assistant/settings/vk-handoff", () => {
  it("splits expected_version and forwards the update payload", async () => {
    const { res, recorder } = buildResponse()
    await PATCH(
      buildReq({
        validatedBody: {
          enabled: true,
          group_id: "123456789",
          expected_version: 1,
        },
      }),
      res
    )
    expect(mockUpdateVkConfig).toHaveBeenCalledWith(
      { __pg: true },
      {
        enabled: true,
        group_id: "123456789",
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
          community_access_token: "vk-community-access-token-1234",
          secret_key: "vk-secret-key-5678",
          confirmation_code: "vk-confirmation-code-9012",
          expected_version: 1,
        },
      }),
      res
    )
    expect(JSON.stringify(recorder.body)).not.toContain(
      "vk-community-access-token-1234"
    )
    expect(JSON.stringify(recorder.body)).not.toContain("vk-secret-key-5678")
    expect(JSON.stringify(recorder.body)).not.toContain(
      "vk-confirmation-code-9012"
    )
  })

  it("maps validation to 400", async () => {
    mockUpdateVkConfig.mockImplementation(async () => {
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
    mockUpdateVkConfig.mockImplementation(async () => {
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
