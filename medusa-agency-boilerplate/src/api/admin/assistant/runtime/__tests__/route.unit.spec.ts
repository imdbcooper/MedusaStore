import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals"

const mockResolveAssistantAdapterConfig = jest.fn<any>()
const mockIsEncryptionConfigured = jest.fn<any>()

jest.mock("../../../../../lib/config", () => ({
  __esModule: true,
  resolveAssistantAdapterConfig: (...args: any[]) =>
    mockResolveAssistantAdapterConfig(...args),
}))

jest.mock("../../../../../lib/crypto/secret-cipher", () => ({
  __esModule: true,
  isEncryptionConfigured: (...args: any[]) =>
    mockIsEncryptionConfigured(...args),
}))

let GET: typeof import("../route")["GET"]

beforeAll(() => {
  const mod = require("../route") as typeof import("../route")
  GET = mod.GET
})

function buildResponse() {
  const recorder: { status?: number; body?: any } = {}
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

describe("GET /admin/assistant/runtime", () => {
  const envBackup = { ...process.env }

  beforeEach(() => {
    process.env = { ...envBackup }
    mockResolveAssistantAdapterConfig.mockReset()
    mockIsEncryptionConfigured.mockReset()
    mockResolveAssistantAdapterConfig.mockReturnValue({
      enabled: true,
      baseUrl: "http://assistant:8000/api/v1",
      serverToken: "configured",
      timeoutMs: 60000,
    })
    mockIsEncryptionConfigured.mockReturnValue(true)
  })

  afterAll(() => {
    process.env = envBackup
  })

  it("returns configured runtime capabilities without exposing secret values", async () => {
    process.env.AI_ASSISTANT_ENABLED = "true"
    const { res, recorder } = buildResponse()

    await GET({} as any, res)

    expect(recorder.status).toBe(200)
    expect(recorder.body).toEqual({
      ok: true,
      runtime: {
        adapter: {
          enabled: true,
          base_url_configured: true,
          server_token_configured: true,
          timeout_ms: 60000,
          missing: [],
        },
        secrets: {
          assistant_settings_encryption_key_configured: true,
        },
        capabilities: {
          provider_secrets_write: true,
          assistant_backend_proxy: true,
          catalog_reindex: true,
          queue_processing: true,
          markdown_sync: true,
          vector_reindex: true,
        },
      },
    })
    expect(JSON.stringify(recorder.body)).not.toContain("http://assistant:8000/api/v1")
    expect(JSON.stringify(recorder.body)).not.toContain("\"serverToken\"")
  })

  it("reports missing adapter env and encryption key readiness", async () => {
    process.env.AI_ASSISTANT_ENABLED = "false"
    mockResolveAssistantAdapterConfig.mockReturnValue({
      enabled: false,
      baseUrl: "",
      serverToken: "",
      timeoutMs: 45000,
    })
    mockIsEncryptionConfigured.mockReturnValue(false)

    const { res, recorder } = buildResponse()
    await GET({} as any, res)

    expect(recorder.status).toBe(200)
    expect(recorder.body.runtime.adapter).toEqual({
      enabled: false,
      base_url_configured: false,
      server_token_configured: false,
      timeout_ms: 45000,
      missing: [
        "AI_ASSISTANT_ENABLED=true",
        "AI_ASSISTANT_BASE_URL",
        "AI_ASSISTANT_SERVER_TOKEN",
      ],
    })
    expect(
      recorder.body.runtime.secrets.assistant_settings_encryption_key_configured,
    ).toBe(false)
  })
})
