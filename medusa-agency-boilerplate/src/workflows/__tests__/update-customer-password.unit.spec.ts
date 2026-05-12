import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals"
import { asValue, createContainer } from "awilix"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

const mockUpdateCustomersRun = jest.fn(
  async (_input: { input: unknown }) => ({ result: [] })
)

jest.mock("@medusajs/medusa/core-flows", () => ({
  updateCustomersWorkflow: () => ({
    run: mockUpdateCustomersRun,
  }),
}))

type WorkflowRunner = (container: unknown) => {
  run: (input: { input: unknown }) => Promise<{
    result: { result: Record<string, unknown> }
  }>
}

let updateCustomerPasswordWorkflow: WorkflowRunner

beforeAll(() => {
  updateCustomerPasswordWorkflow =
    require("../update-customer-password").default as WorkflowRunner
})

type CustomerRow = {
  id: string
  email: string | null
  metadata?: Record<string, unknown> | null
}

function buildHarness(options: {
  customersById: Record<string, CustomerRow>
  authenticateResult?: { success: boolean; error?: string }
  updateProviderResult?: { success: boolean; error?: string }
}) {
  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }

  const query = {
    graph: jest.fn(async (args: { filters: Record<string, unknown> }) => {
      const id = String(args.filters.id)
      const customer = options.customersById[id]

      return { data: customer ? [customer] : [] }
    }),
  }

  const authModule = {
    authenticate: jest.fn(async () =>
      options.authenticateResult || { success: true }
    ),
    updateProvider: jest.fn(async () =>
      options.updateProviderResult || { success: true, authIdentity: {} }
    ),
  }

  const container = createContainer()
  container.register({
    [ContainerRegistrationKeys.LOGGER]: asValue(logger),
    [ContainerRegistrationKeys.QUERY]: asValue(query),
    [Modules.AUTH]: asValue(authModule),
  })

  return {
    container: container as any,
    logger,
    query,
    authModule,
  }
}

describe("updateCustomerPasswordWorkflow", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUpdateCustomersRun.mockReset()
    ;(mockUpdateCustomersRun as any).mockResolvedValue({ result: [] })
  })

  afterEach(() => {
    mockUpdateCustomersRun.mockReset()
  })

  it("updates password and clears reset metadata on success", async () => {
    const harness = buildHarness({
      customersById: {
        cus_ok: {
          id: "cus_ok",
          email: "User@Example.com",
          metadata: {
            password_reset: {
              token_hash: "h",
              email: "user@example.com",
              issued_at: "2026-05-12T00:00:00.000Z",
              expires_at: "2026-05-12T01:00:00.000Z",
              consumed_at: null,
            },
            other: "keep",
          },
        },
      },
    })

    const response = await updateCustomerPasswordWorkflow(harness.container).run({
      input: {
        customerId: "cus_ok",
        currentPassword: "oldPass123",
        newPassword: "newPass456",
      },
    })

    const outcome = response.result.result as {
      status: string
      customer_id?: string
      email?: string
    }
    expect(outcome.status).toBe("updated")
    expect(outcome.customer_id).toBe("cus_ok")
    expect(outcome.email).toBe("user@example.com")

    expect(harness.authModule.authenticate).toHaveBeenCalledTimes(1)
    expect(harness.authModule.updateProvider).toHaveBeenCalledTimes(1)
    expect(mockUpdateCustomersRun).toHaveBeenCalledTimes(1)

    const updatePayload = mockUpdateCustomersRun.mock.calls[0][0] as unknown as {
      input: { update: { metadata: Record<string, unknown> } }
    }
    expect(updatePayload.input.update.metadata.password_reset).toBeNull()
    expect(updatePayload.input.update.metadata.other).toBe("keep")
  })

  it("returns invalid_current_password when authenticate fails", async () => {
    const harness = buildHarness({
      customersById: {
        cus_ok: {
          id: "cus_ok",
          email: "user@example.com",
          metadata: {},
        },
      },
      authenticateResult: { success: false, error: "Invalid email or password" },
    })

    const response = await updateCustomerPasswordWorkflow(harness.container).run({
      input: {
        customerId: "cus_ok",
        currentPassword: "wrong",
        newPassword: "Abcdef12",
      },
    })

    const outcome = response.result.result as {
      status: string
      reason?: string
    }
    expect(outcome.status).toBe("failed")
    expect(outcome.reason).toBe("invalid_current_password")
    expect(harness.authModule.updateProvider).not.toHaveBeenCalled()
    expect(mockUpdateCustomersRun).not.toHaveBeenCalled()
  })

  it("returns weak password reason when new password is too weak", async () => {
    const harness = buildHarness({
      customersById: {
        cus_ok: {
          id: "cus_ok",
          email: "user@example.com",
          metadata: {},
        },
      },
    })

    const response = await updateCustomerPasswordWorkflow(harness.container).run({
      input: {
        customerId: "cus_ok",
        currentPassword: "oldPass123",
        newPassword: "123",
      },
    })

    const outcome = response.result.result as {
      status: string
      reason?: string
    }
    expect(outcome.status).toBe("failed")
    expect(outcome.reason).toBe("password_too_short")
    expect(harness.authModule.authenticate).not.toHaveBeenCalled()
  })

  it("returns same_password when old and new match", async () => {
    const harness = buildHarness({
      customersById: {
        cus_ok: {
          id: "cus_ok",
          email: "user@example.com",
          metadata: {},
        },
      },
    })

    const response = await updateCustomerPasswordWorkflow(harness.container).run({
      input: {
        customerId: "cus_ok",
        currentPassword: "Abcdef12",
        newPassword: "Abcdef12",
      },
    })

    const outcome = response.result.result as {
      status: string
      reason?: string
    }
    expect(outcome.status).toBe("failed")
    expect(outcome.reason).toBe("same_password")
  })

  it("returns customer_not_found when customer missing", async () => {
    const harness = buildHarness({ customersById: {} })

    const response = await updateCustomerPasswordWorkflow(harness.container).run({
      input: {
        customerId: "cus_missing",
        currentPassword: "old",
        newPassword: "Abcdef12",
      },
    })

    const outcome = response.result.result as {
      status: string
      reason?: string
    }
    expect(outcome.status).toBe("failed")
    expect(outcome.reason).toBe("customer_not_found")
  })

  it("returns provider_update_failed when update fails", async () => {
    const harness = buildHarness({
      customersById: {
        cus_ok: { id: "cus_ok", email: "user@example.com", metadata: {} },
      },
      updateProviderResult: { success: false, error: "oops" },
    })

    const response = await updateCustomerPasswordWorkflow(harness.container).run({
      input: {
        customerId: "cus_ok",
        currentPassword: "oldPass123",
        newPassword: "Abcdef12",
      },
    })

    const outcome = response.result.result as {
      status: string
      reason?: string
    }
    expect(outcome.status).toBe("failed")
    expect(outcome.reason).toBe("provider_update_failed")
    expect(mockUpdateCustomersRun).not.toHaveBeenCalled()
  })
})
