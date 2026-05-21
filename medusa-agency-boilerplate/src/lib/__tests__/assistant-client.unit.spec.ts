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
})
