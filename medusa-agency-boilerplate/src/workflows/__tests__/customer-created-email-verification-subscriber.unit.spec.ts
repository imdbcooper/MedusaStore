import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

const mockWorkflowRun = jest.fn(async (_input: { input: unknown }) => ({
  result: { result: {} as Record<string, unknown> },
}))

jest.mock("../send-email-verification", () => ({
  __esModule: true,
  default: () => ({
    run: mockWorkflowRun,
  }),
}))

let customerCreatedEmailVerificationHandler: (
  args: unknown
) => Promise<void>

beforeAll(() => {
  customerCreatedEmailVerificationHandler =
    require("../../subscribers/customer-created-email-verification").default
})

function buildContext(options?: {
  customerMetadataById?: Record<string, Record<string, unknown> | null>
}) {
  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }

  const customersById = options?.customerMetadataById ?? {}
  const query = {
    graph: jest.fn(async (args: { filters?: { id?: string } }) => {
      const id = String(args.filters?.id ?? "")
      const metadata = id in customersById ? customersById[id] : null
      return { data: metadata !== undefined ? [{ id, metadata }] : [] }
    }),
  }

  const container = {
    resolve: jest.fn((key: string) => {
      if (key === ContainerRegistrationKeys.LOGGER) {
        return logger
      }
      if (key === ContainerRegistrationKeys.QUERY) {
        return query
      }
      throw new Error(`Unexpected resolve: ${key}`)
    }),
  }

  return { logger, container: container as any, query }
}

describe("customer-created-email-verification subscriber", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockWorkflowRun.mockReset()
  })

  afterEach(() => {
    mockWorkflowRun.mockReset()
  })

  it("skips when event has no customer id", async () => {
    const { container, logger } = buildContext()

    await customerCreatedEmailVerificationHandler({
      event: { data: {} },
      container,
    })

    expect(mockWorkflowRun).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalled()
  })

  it("invokes send workflow with customer id and customer_created reason", async () => {
    const { container, logger } = buildContext()

    ;(mockWorkflowRun as any).mockResolvedValue({
      result: {
        result: {
          status: "sent",
          reason: null,
          customer_id: "cus_new",
          recipient: "user@example.com",
          provider_requested: "local",
          provider_resolved: "local",
          notification: { id: "noti_1" },
          expires_at: "2026-05-13T00:00:00.000Z",
        },
      },
    })

    await customerCreatedEmailVerificationHandler({
      event: { data: { id: " cus_new " } },
      container,
    })

    expect(mockWorkflowRun).toHaveBeenCalledTimes(1)
    const call = mockWorkflowRun.mock.calls[0][0] as {
      input: { customerId: string; reason?: string }
    }
    expect(call.input.customerId).toBe("cus_new")
    expect(call.input.reason).toBe("customer_created")
    expect(logger.info).toHaveBeenCalled()
  })

  it("does not throw when workflow fails", async () => {
    const { container, logger } = buildContext()

    ;(mockWorkflowRun as any).mockRejectedValue(
      new Error("simulated transport failure")
    )

    await expect(
      customerCreatedEmailVerificationHandler({
        event: { data: { id: "cus_boom" } },
        container,
      })
    ).resolves.toBeUndefined()

    expect(logger.error).toHaveBeenCalled()
  })

  it("fix #2: skips send when customer metadata has vk_link + email_verified=true (VK-registered)", async () => {
    const { container, logger, query } = buildContext({
      customerMetadataById: {
        cus_vk: {
          email_verified: true,
          email_verified_for: "vkuser@example.com",
          vk_link: {
            vk_user_id: "2000000777",
            vk_peer_id: "2000000777",
            link_status: "linked",
          },
        },
      },
    })

    await customerCreatedEmailVerificationHandler({
      event: { data: { id: "cus_vk" } },
      container,
    })

    expect(query.graph).toHaveBeenCalledTimes(1)
    expect(mockWorkflowRun).not.toHaveBeenCalled()
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("vk_registered_already_verified")
    )
  })

  it("fix #2 regression: still sends for plain emailpass customer without vk_link", async () => {
    const { container, query } = buildContext({
      customerMetadataById: {
        cus_plain: {
          // no vk_link
          some_other_flag: true,
        },
      },
    })

    ;(mockWorkflowRun as any).mockResolvedValue({
      result: {
        result: {
          status: "sent",
          reason: null,
          customer_id: "cus_plain",
          recipient: "plain@example.com",
          provider_requested: "local",
          provider_resolved: "local",
          notification: { id: "noti_2" },
          expires_at: null,
        },
      },
    })

    await customerCreatedEmailVerificationHandler({
      event: { data: { id: "cus_plain" } },
      container,
    })

    expect(query.graph).toHaveBeenCalledTimes(1)
    expect(mockWorkflowRun).toHaveBeenCalledTimes(1)
  })

  it("fix #2 regression: still sends when vk_link exists but email_verified=false", async () => {
    const { container, query } = buildContext({
      customerMetadataById: {
        cus_half: {
          email_verified: false,
          vk_link: {
            vk_user_id: "2000000001",
            vk_peer_id: "2000000001",
            link_status: "linked",
          },
        },
      },
    })

    ;(mockWorkflowRun as any).mockResolvedValue({
      result: {
        result: {
          status: "sent",
          reason: null,
          customer_id: "cus_half",
          recipient: "half@example.com",
          provider_requested: "local",
          provider_resolved: "local",
          notification: { id: "noti_3" },
          expires_at: null,
        },
      },
    })

    await customerCreatedEmailVerificationHandler({
      event: { data: { id: "cus_half" } },
      container,
    })

    expect(query.graph).toHaveBeenCalledTimes(1)
    expect(mockWorkflowRun).toHaveBeenCalledTimes(1)
  })

  it("falls back to send workflow if metadata lookup throws", async () => {
    const { container, logger } = buildContext()
    const query = (container.resolve as jest.Mock).mock.results.find(
      () => true
    )
    // The above buildContext pre-registered `query.graph` to return []; we
    // re-wire it so this specific test simulates a hard failure.
    const brokenContainer = {
      resolve: jest.fn((key: string) => {
        if (key === ContainerRegistrationKeys.LOGGER) return logger
        if (key === ContainerRegistrationKeys.QUERY) {
          return {
            graph: jest.fn(async () => {
              throw new Error("db_offline")
            }),
          }
        }
        throw new Error(`Unexpected: ${key}`)
      }),
    } as any

    ;(mockWorkflowRun as any).mockResolvedValue({
      result: {
        result: {
          status: "sent",
          reason: null,
          customer_id: "cus_fallback",
          recipient: "fb@example.com",
          provider_requested: "local",
          provider_resolved: "local",
          notification: { id: "noti_fb" },
          expires_at: null,
        },
      },
    })

    await customerCreatedEmailVerificationHandler({
      event: { data: { id: "cus_fallback" } },
      container: brokenContainer,
    })

    expect(mockWorkflowRun).toHaveBeenCalledTimes(1)
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("metadata lookup failed")
    )
    void query
  })
})
