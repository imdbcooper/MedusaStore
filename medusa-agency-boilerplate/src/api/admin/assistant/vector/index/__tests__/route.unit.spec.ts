import { beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals"

const mockRequireAssistantBackendClient = jest.fn<any>()
const mockIndexVectors = jest.fn<any>()

jest.mock("../../../../../../modules/assistant-runtime", () => ({
  __esModule: true,
  requireAssistantBackendClient: (...args: any[]) =>
    mockRequireAssistantBackendClient(...args),
}))

let POST: typeof import("../route")["POST"]

beforeAll(() => {
  const mod = require("../route") as typeof import("../route")
  POST = mod.POST
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

describe("POST /admin/assistant/vector/index", () => {
  beforeEach(() => {
    mockIndexVectors.mockReset()
    mockIndexVectors.mockResolvedValue({
      job_id: "job_vec",
      status: "completed",
      source_type: "markdown",
      result: { source_count: 2, chunk_count: 5 },
    })
    mockRequireAssistantBackendClient.mockReset()
    mockRequireAssistantBackendClient.mockReturnValue({
      indexVectors: (...args: any[]) => mockIndexVectors(...args),
    })
  })

  it("proxies vector indexing through the assistant backend client", async () => {
    const { res, recorder } = buildResponse()
    await POST(
      {
        validatedBody: {
          store_id: "default",
          locale: "ru",
          source_type: "markdown",
        },
        body: {},
      } as any,
      res,
    )

    expect(mockIndexVectors).toHaveBeenCalledWith({
      store_id: "default",
      locale: "ru",
      source_type: "markdown",
    })
    expect(recorder.status).toBe(200)
    expect(recorder.body).toEqual({
      ok: true,
      result: {
        job_id: "job_vec",
        status: "completed",
        source_type: "markdown",
        result: { source_count: 2, chunk_count: 5 },
      },
    })
  })
})
