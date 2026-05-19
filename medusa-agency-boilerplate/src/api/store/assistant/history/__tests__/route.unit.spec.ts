import { beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals"

const mockScopedHistory = jest.fn<any>()

jest.mock("../../../../../modules/assistant-runtime", () => ({
  requireAssistantBackendClient: () => ({
    scopedHistory: (...args: any[]) => mockScopedHistory(...args),
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
  mockScopedHistory.mockReset()
})

describe("store assistant history route", () => {
  it("rejects malformed session ids before calling assistant backend", async () => {
    const status = jest.fn(() => ({ json }))
    const json = jest.fn()

    await POST(
      {
        body: {
          session_id: "not-a-uuid",
          store_id: "default",
          locale: "ru",
        },
      } as never,
      { status } as never
    )

    expect(status).toHaveBeenCalledWith(400)
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: "INVALID_ASSISTANT_SESSION_ID" }),
      })
    )
  })

  it("returns empty history when the scoped session does not exist yet", async () => {
    const json = jest.fn()
    const status = jest.fn(() => ({ json }))

    mockScopedHistory.mockRejectedValue(
      new AssistantClientError("Assistant session history is not available for this scope.", {
        status: 404,
        code: "SESSION_HISTORY_NOT_FOUND",
        retryable: false,
      })
    )

    await POST(
      {
        body: {
          session_id: "11111111-1111-4111-8111-111111111111",
          store_id: "default",
          locale: "ru",
        },
      } as never,
      { status } as never
    )

    expect(status).toHaveBeenCalledWith(200)
    expect(json).toHaveBeenCalledWith({
      session_id: "11111111-1111-4111-8111-111111111111",
      messages: [],
    })
  })
})
