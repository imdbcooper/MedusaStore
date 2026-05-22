import { beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals"

const mockHandoff = jest.fn<any>()

jest.mock("../../../../../modules/assistant-runtime", () => ({
  requireAssistantBackendClient: () => ({
    handoff: (...args: any[]) => mockHandoff(...args),
  }),
}))

let POST: typeof import("../route")["POST"]

beforeAll(() => {
  POST = (require("../route") as typeof import("../route")).POST
})

beforeEach(() => {
  mockHandoff.mockReset()
})

describe("store assistant handoff route", () => {
  it("forwards handoff requests with default scope and source", async () => {
    const json = jest.fn()
    const status = jest.fn(() => ({ json }))

    mockHandoff.mockResolvedValue({
      handoff_id: "11111111-1111-4111-8111-111111111111",
      session_id: "22222222-2222-4222-8222-222222222222",
      store_id: "default",
      locale: "ru",
      status: "submitted",
      source: "assistant_widget",
    })

    await POST(
      {
        body: {
          session_id: "22222222-2222-4222-8222-222222222222",
          email: "buyer@example.com",
          summary: "Нужен аудит и CRM интеграция",
        },
      } as never,
      { status } as never
    )

    expect(mockHandoff).toHaveBeenCalledWith({
      session_id: "22222222-2222-4222-8222-222222222222",
      email: "buyer@example.com",
      summary: "Нужен аудит и CRM интеграция",
      store_id: "default",
      locale: "ru",
      source: "assistant_widget",
    })
    expect(status).toHaveBeenCalledWith(200)
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "submitted",
        source: "assistant_widget",
      })
    )
  })
})
