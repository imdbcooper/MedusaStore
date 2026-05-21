import { beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals"

const mockGetAssistantAdapterRuntime = jest.fn<any>()

jest.mock("../../modules/assistant-runtime", () => ({
  getAssistantAdapterRuntime: (...args: any[]) => mockGetAssistantAdapterRuntime(...args),
}))

let assistantReindexQueueDrainJob: typeof import("../assistant-reindex-queue-drain").default

beforeAll(() => {
  assistantReindexQueueDrainJob = (
    require("../assistant-reindex-queue-drain") as typeof import("../assistant-reindex-queue-drain")
  ).default
})

beforeEach(() => {
  mockGetAssistantAdapterRuntime.mockReset()
})

describe("assistant reindex queue drain job", () => {
  it("skips when the assistant adapter is disabled", async () => {
    const resolve = jest.fn(() => ({ info: jest.fn(), error: jest.fn() }))

    mockGetAssistantAdapterRuntime.mockReturnValue({
      enabled: false,
      client: null,
    })

    await assistantReindexQueueDrainJob({ resolve } as never)

    expect(resolve).toHaveBeenCalledTimes(1)
  })

  it("drains pending intents with conservative defaults", async () => {
    const info = jest.fn()
    const error = jest.fn()
    const processReindexQueue = jest
      .fn<() => Promise<Record<string, unknown>>>()
      .mockResolvedValue({
        claimed: 2,
        stats: {
          pending: 0,
          error: 0,
        },
      })

    mockGetAssistantAdapterRuntime.mockReturnValue({
      enabled: true,
      client: {
        processReindexQueue,
      },
    })

    await assistantReindexQueueDrainJob({
      resolve: jest.fn(() => ({ info, error })),
    } as never)

    expect(processReindexQueue).toHaveBeenCalledWith({
      limit: 10,
      retry_backoff_seconds: 60,
    })
    expect(info).toHaveBeenCalledWith(
      "[assistant-adapter] scheduled reindex drain claimed=2 pending=0 error=0"
    )
    expect(error).not.toHaveBeenCalled()
  })
})
