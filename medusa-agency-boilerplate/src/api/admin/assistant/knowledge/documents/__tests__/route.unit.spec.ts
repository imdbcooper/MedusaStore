import { beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals"

const mockRequireAssistantBackendClient = jest.fn<any>()
const mockCreateKnowledgeDocument = jest.fn<any>()

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

describe("POST /admin/assistant/knowledge/documents", () => {
  beforeEach(() => {
    mockCreateKnowledgeDocument.mockReset()
    mockCreateKnowledgeDocument.mockResolvedValue({
      document: {
        source_id: "default/global/ru/returns-policy.md",
        path: "default/global/ru/returns-policy.md",
        title: "Гарантия и возвраты",
        description: "Памятка по возвратам и гарантийному обслуживанию.",
        file_name: "returns-policy.md",
        store_id: "default",
        locale: "ru",
        source_type: "markdown",
      },
      job: {
        job_id: "job_doc",
        status: "completed",
        source_type: "markdown",
        source_id: "default/global/ru/returns-policy.md",
      },
      chunks: [],
    })
    mockRequireAssistantBackendClient.mockReset()
    mockRequireAssistantBackendClient.mockReturnValue({
      createKnowledgeDocument: (...args: any[]) => mockCreateKnowledgeDocument(...args),
    })
  })

  it("proxies knowledge document creation through the assistant backend client", async () => {
    const { res, recorder } = buildResponse()
    await POST(
      {
        validatedBody: {
          store_id: "default",
          locale: "ru",
          title: "Гарантия и возвраты",
          description: "Памятка по возвратам и гарантийному обслуживанию.",
          content: "# Возвраты\n\nМожно вернуть товар в течение 14 дней.",
          file_name: "returns-policy.md",
        },
        body: {},
      } as any,
      res,
    )

    expect(mockCreateKnowledgeDocument).toHaveBeenCalledWith({
      store_id: "default",
      locale: "ru",
      title: "Гарантия и возвраты",
      description: "Памятка по возвратам и гарантийному обслуживанию.",
      content: "# Возвраты\n\nМожно вернуть товар в течение 14 дней.",
      file_name: "returns-policy.md",
    })
    expect(recorder.status).toBe(200)
    expect(recorder.body).toEqual({
      ok: true,
      result: {
        document: {
          source_id: "default/global/ru/returns-policy.md",
          path: "default/global/ru/returns-policy.md",
          title: "Гарантия и возвраты",
          description: "Памятка по возвратам и гарантийному обслуживанию.",
          file_name: "returns-policy.md",
          store_id: "default",
          locale: "ru",
          source_type: "markdown",
        },
        job: {
          job_id: "job_doc",
          status: "completed",
          source_type: "markdown",
          source_id: "default/global/ru/returns-policy.md",
        },
        chunks: [],
      },
    })
  })
})
