import { beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals"

const mockBindSession = jest.fn<any>()
const mockChat = jest.fn<any>()
const mockStreamChat = jest.fn<any>()

jest.mock("../../../../../modules/assistant-runtime", () => ({
  requireAssistantBackendClient: () => ({
    bindSession: (...args: any[]) => mockBindSession(...args),
    chat: (...args: any[]) => mockChat(...args),
    streamChat: (...args: any[]) => mockStreamChat(...args),
  }),
}))

const { AssistantClientError } = jest.requireActual(
  "../../../../../lib/assistant-client"
) as typeof import("../../../../../lib/assistant-client")

let POST: typeof import("../route")["POST"]

beforeAll(() => {
  POST = (require("../route") as typeof import("../route")).POST
})

beforeEach(() => {
  mockBindSession.mockReset()
  mockChat.mockReset()
  mockStreamChat.mockReset()
})

describe("store assistant chat route", () => {
  it("defers customer binding until after chat when the session does not exist yet", async () => {
    const sessionId = "11111111-1111-4111-8111-111111111111"
    const responseBody = {
      session_id: sessionId,
      message_id: "msg_123",
      answer: "Здравствуйте!",
      intent: "policy",
      products: [],
      citations: [],
      actions: [],
    }
    const status = jest.fn(() => ({ json }))
    const json = jest.fn()

    mockBindSession
      .mockRejectedValueOnce(
        new AssistantClientError("Assistant session was not found.", {
          status: 404,
          code: "SESSION_NOT_FOUND",
          retryable: false,
        })
      )
      .mockResolvedValueOnce({ ok: true })
    mockChat.mockResolvedValue(responseBody)

    await POST(
      {
        body: {
          message: "Привет",
          session_id: sessionId,
          store_id: "default",
          locale: "ru",
        },
        headers: {},
        auth_context: {
          actor_id: "cus_123",
          actor_type: "customer",
        },
      } as never,
      { status } as never
    )

    expect(mockChat).toHaveBeenCalledTimes(1)
    expect(mockBindSession).toHaveBeenCalledTimes(2)
    expect(mockBindSession).toHaveBeenNthCalledWith(1, {
      session_id: sessionId,
      customer_id: "cus_123",
      store_id: "default",
      locale: "ru",
      customer_context: {
        source: "medusa_store_auth_context",
      },
    })
    expect(mockBindSession).toHaveBeenNthCalledWith(2, {
      session_id: sessionId,
      customer_id: "cus_123",
      store_id: "default",
      locale: "ru",
      customer_context: {
        source: "medusa_store_auth_context",
      },
    })
    expect(status).toHaveBeenCalledWith(200)
    expect(json).toHaveBeenCalledWith(responseBody)
  })
})
