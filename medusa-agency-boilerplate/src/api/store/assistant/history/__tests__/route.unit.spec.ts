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
      handoff_ticket: null,
    })
  })

  it("sanitizes visible metadata and handoff ticket state for the storefront", async () => {
    const json = jest.fn()
    const status = jest.fn(() => ({ json }))

    mockScopedHistory.mockResolvedValue({
      session_id: "11111111-1111-4111-8111-111111111111",
      store_id: "default",
      locale: "ru",
      messages: [
        {
          id: "33333333-3333-4333-8333-333333333333",
          session_id: "11111111-1111-4111-8111-111111111111",
          role: "assistant",
          content: "С вами уже работает специалист.",
          intent: "telegram_operator_reply",
          metadata: {
            source: "telegram_operator",
            operator_username: "alice",
            operator_telegram_user_id: "7001",
          },
          created_at: "2026-05-23T12:00:00.000Z",
        },
      ],
      handoff_ticket: {
        channel: "telegram",
        status: "waiting_customer",
        message: "Operator replied.",
        updated_at: "2026-05-23T12:00:00.000Z",
      },
    })

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
      messages: [
        {
          id: "33333333-3333-4333-8333-333333333333",
          session_id: "11111111-1111-4111-8111-111111111111",
          role: "assistant",
          content: "С вами уже работает специалист.",
          intent: "telegram_operator_reply",
          products: [],
          actions: [],
          metadata: {
            source: "telegram_operator",
          },
          created_at: "2026-05-23T12:00:00.000Z",
        },
      ],
      handoff_ticket: {
        channel: "telegram",
        status: "waiting_customer",
        message: "Operator replied.",
        updated_at: "2026-05-23T12:00:00.000Z",
      },
    })
  })
})
