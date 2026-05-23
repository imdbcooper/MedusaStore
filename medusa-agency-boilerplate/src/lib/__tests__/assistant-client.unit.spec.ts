import { AssistantBackendClient, AssistantClientError } from "../assistant-client"

describe("AssistantBackendClient", () => {
  it("unwraps nested FastAPI detail.error responses", async () => {
    const fetchImpl = jest.fn(async () => {
      return new Response(
        JSON.stringify({
          detail: {
            error: {
              code: "RETRIEVAL_UNAVAILABLE",
              message: "Could not build assistant response.",
              retryable: true,
              details: "SESSION_SCOPE_MISMATCH",
            },
          },
        }),
        {
          status: 500,
          headers: { "content-type": "application/json" },
        }
      ) as any
    }) as unknown as typeof fetch

    const client = new AssistantBackendClient(
      {
        baseUrl: "http://assistant.test/api/v1",
        serverToken: "test-token",
        timeoutMs: 1000,
        enabled: true,
      },
      fetchImpl
    )

    await expect(
      client.chat({
        message: "Привет",
        store_id: "default",
        locale: "ru",
      })
    ).rejects.toMatchObject<Partial<AssistantClientError>>({
      name: "AssistantClientError",
      status: 500,
      code: "RETRIEVAL_UNAVAILABLE",
      message: "Could not build assistant response.",
      retryable: true,
    })
  })

  it("calls the Telegram handoff live test endpoint with bearer auth", async () => {
    const fetchImpl = jest.fn(async () => {
      return new Response(
        JSON.stringify({
          ok: true,
          status: "connection_ok",
          message: "Telegram connection test passed.",
          missing_fields: [],
          tested_at: "2026-05-22T12:01:00.000Z",
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      ) as any
    }) as unknown as typeof fetch

    const client = new AssistantBackendClient(
      {
        baseUrl: "http://assistant.test/api/v1",
        serverToken: "test-token",
        timeoutMs: 1000,
        enabled: true,
      },
      fetchImpl
    )

    await client.testTelegramHandoffConnection()

    expect(fetchImpl).toHaveBeenCalledWith(
      "http://assistant.test/api/v1/admin/telegram/handoff/test-connection",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          accept: "application/json",
          authorization: "Bearer test-token",
          "content-type": "application/json",
        }),
      })
    )
  })
})
