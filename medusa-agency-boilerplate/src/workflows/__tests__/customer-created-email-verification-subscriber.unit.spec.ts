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

function buildContext() {
  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }

  const container = {
    resolve: jest.fn((key: string) => {
      if (key === ContainerRegistrationKeys.LOGGER) {
        return logger
      }
      throw new Error(`Unexpected resolve: ${key}`)
    }),
  }

  return { logger, container: container as any }
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
})
