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

import {
  buildPasswordResetIssueMetadata,
  buildPasswordResetToken,
  generatePasswordResetRawToken,
  hashPasswordResetToken,
} from "../../modules/password-reset"

type WorkflowRunner = (container: unknown) => {
  run: (input: { input: unknown }) => Promise<{
    result: { result: Record<string, unknown> }
  }>
}

let applyPasswordResetWorkflow: WorkflowRunner

beforeAll(() => {
  applyPasswordResetWorkflow =
    require("../apply-password-reset").default as WorkflowRunner
})

type CustomerRow = {
  id: string
  email: string | null
  metadata?: Record<string, unknown> | null
}

function buildHarness(options: {
  customersById: Record<string, CustomerRow>
  updateProviderResult?: {
    success: boolean
    error?: string
    authIdentity?: Record<string, unknown>
  }
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
    updateProvider: jest.fn(async () =>
      options.updateProviderResult || {
        success: true,
        authIdentity: { id: "auth_id" },
      }
    ),
    authenticate: jest.fn(async () => ({ success: true })),
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

function buildCustomerWithToken(options?: {
  email?: string
  ttlMinutes?: number
}) {
  const email = options?.email || "user@example.com"
  const rawToken = generatePasswordResetRawToken()
  const tokenHash = hashPasswordResetToken(rawToken)
  const metadata = buildPasswordResetIssueMetadata({
    currentMetadata: {},
    email,
    tokenHash,
    now: new Date(),
    ttlMinutes: options?.ttlMinutes ?? 60,
  })

  return {
    customer: {
      id: "cus_reset",
      email,
      metadata,
    },
    rawToken,
    fullToken: buildPasswordResetToken("cus_reset", rawToken),
  }
}

describe("applyPasswordResetWorkflow", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUpdateCustomersRun.mockReset()
    ;(mockUpdateCustomersRun as any).mockResolvedValue({ result: [] })
  })

  afterEach(() => {
    mockUpdateCustomersRun.mockReset()
  })

  it("applies password reset and consumes token on success", async () => {
    const { customer, fullToken } = buildCustomerWithToken()
    const harness = buildHarness({
      customersById: { [customer.id]: customer },
    })

    const response = await applyPasswordResetWorkflow(harness.container).run({
      input: { token: fullToken, newPassword: "Abcdef12" },
    })

    const outcome = response.result.result as {
      status: string
      customer_id?: string
      email?: string
    }
    expect(outcome.status).toBe("applied")
    expect(outcome.customer_id).toBe(customer.id)
    expect(outcome.email).toBe("user@example.com")

    expect(harness.authModule.updateProvider).toHaveBeenCalledTimes(1)
    const updateCall = harness.authModule.updateProvider.mock.calls[0] as unknown as [
      string,
      { entity_id: string; password: string },
    ]
    const [providerId, providerPayload] = updateCall
    expect(providerId).toBe("emailpass")
    expect(providerPayload.entity_id).toBe("user@example.com")
    expect(providerPayload.password).toBe("Abcdef12")

    // Token marked consumed in metadata
    expect(mockUpdateCustomersRun).toHaveBeenCalledTimes(1)
    const updatePayload = mockUpdateCustomersRun.mock.calls[0][0] as unknown as {
      input: { update: { metadata: Record<string, unknown> } }
    }
    const state = updatePayload.input.update.metadata.password_reset as Record<
      string,
      unknown
    >
    expect(state.consumed_at).not.toBeNull()
  })

  it("returns invalid_token_format for garbage token", async () => {
    const harness = buildHarness({ customersById: {} })

    const response = await applyPasswordResetWorkflow(harness.container).run({
      input: { token: "garbage", newPassword: "Abcdef12" },
    })

    const outcome = response.result.result as {
      status: string
      reason?: string
    }
    expect(outcome.status).toBe("failed")
    expect(outcome.reason).toBe("invalid_token_format")
    expect(harness.authModule.updateProvider).not.toHaveBeenCalled()
  })

  it("returns weak password reason and does not update", async () => {
    const { customer, fullToken } = buildCustomerWithToken()
    const harness = buildHarness({
      customersById: { [customer.id]: customer },
    })

    const response = await applyPasswordResetWorkflow(harness.container).run({
      input: { token: fullToken, newPassword: "abc" },
    })

    const outcome = response.result.result as {
      status: string
      reason?: string
    }
    expect(outcome.status).toBe("failed")
    expect(outcome.reason).toBe("password_too_short")
    expect(harness.authModule.updateProvider).not.toHaveBeenCalled()
  })

  it("returns customer_not_found when lookup empty", async () => {
    const rawToken = generatePasswordResetRawToken()
    const fullToken = buildPasswordResetToken("cus_missing", rawToken)
    const harness = buildHarness({ customersById: {} })

    const response = await applyPasswordResetWorkflow(harness.container).run({
      input: { token: fullToken, newPassword: "Abcdef12" },
    })

    const outcome = response.result.result as {
      status: string
      reason?: string
    }
    expect(outcome.status).toBe("failed")
    expect(outcome.reason).toBe("customer_not_found")
  })

  it("rejects mismatched raw token", async () => {
    const { customer } = buildCustomerWithToken()
    const fullToken = buildPasswordResetToken(customer.id, "totally-different")
    const harness = buildHarness({
      customersById: { [customer.id]: customer },
    })

    const response = await applyPasswordResetWorkflow(harness.container).run({
      input: { token: fullToken, newPassword: "Abcdef12" },
    })

    const outcome = response.result.result as {
      status: string
      reason?: string
    }
    expect(outcome.status).toBe("failed")
    expect(outcome.reason).toBe("token_mismatch")
    expect(harness.authModule.updateProvider).not.toHaveBeenCalled()
  })

  it("returns provider_update_failed when auth module refuses", async () => {
    const { customer, fullToken } = buildCustomerWithToken()
    const harness = buildHarness({
      customersById: { [customer.id]: customer },
      updateProviderResult: { success: false, error: "provider error" },
    })

    const response = await applyPasswordResetWorkflow(harness.container).run({
      input: { token: fullToken, newPassword: "Abcdef12" },
    })

    const outcome = response.result.result as {
      status: string
      reason?: string
    }
    expect(outcome.status).toBe("failed")
    expect(outcome.reason).toBe("provider_update_failed")
    expect(mockUpdateCustomersRun).not.toHaveBeenCalled()
  })

  it("rejects when customer email differs from stored email", async () => {
    const { customer, fullToken } = buildCustomerWithToken({
      email: "original@example.com",
    })
    const mutated = { ...customer, email: "changed@example.com" }
    const harness = buildHarness({
      customersById: { [customer.id]: mutated },
    })

    const response = await applyPasswordResetWorkflow(harness.container).run({
      input: { token: fullToken, newPassword: "Abcdef12" },
    })

    const outcome = response.result.result as {
      status: string
      reason?: string
    }
    expect(outcome.status).toBe("failed")
    expect(outcome.reason).toBe("email_mismatch")
    expect(harness.authModule.updateProvider).not.toHaveBeenCalled()
  })
})
