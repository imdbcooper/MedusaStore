import { POST } from "../route"

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
})
