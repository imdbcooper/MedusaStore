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
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

const mockUpdateCustomersRun = jest.fn(
  async (_input: { input: unknown }) => ({ result: [] })
)

jest.mock("@medusajs/medusa/core-flows", () => ({
  updateCustomersWorkflow: () => ({
    run: mockUpdateCustomersRun,
  }),
}))

import {
  buildChannelPendingMetadata,
  buildPublicConfirmationToken,
  generateConfirmationToken,
  hashConfirmationToken,
  resolveMarketingPreferences,
  type MarketingCustomerRecord,
} from "../../modules/marketing-preferences"

type WorkflowRunner = (container: unknown) => {
  run: (input: { input: unknown }) => Promise<{
    result: { result: Record<string, unknown> }
  }>
}

let applyMarketingConfirmationWorkflow: WorkflowRunner

beforeAll(() => {
  applyMarketingConfirmationWorkflow = require("../apply-marketing-confirmation")
    .default as WorkflowRunner
})

function buildHarness(options: {
  customersById: Record<string, MarketingCustomerRecord>
}) {
  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }

  const query = {
    graph: jest.fn(async (args: any) => {
      if (args.entity === "customer") {
        const id = String(args.filters?.id || "")
        const customer = options.customersById[id]
        return { data: customer ? [customer] : [] }
      }
      throw new Error(`Unexpected entity: ${args.entity}`)
    }),
  }

  const container = createContainer()
  container.register({
    [ContainerRegistrationKeys.LOGGER]: asValue(logger),
    [ContainerRegistrationKeys.QUERY]: asValue(query),
  })

  return { container: container as any, logger, query }
}

describe("applyMarketingConfirmationWorkflow", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUpdateCustomersRun.mockReset()
    ;(mockUpdateCustomersRun as any).mockResolvedValue({ result: [] })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it("confirms an email channel for a valid token", async () => {
    const raw = generateConfirmationToken()
    const tokenHash = hashConfirmationToken(raw)
    const pending = buildChannelPendingMetadata({
      customer: {
        id: "cust_1",
        email: "user@example.com",
        phone: null,
        metadata: {},
      },
      channel: "email",
      tokenHash,
    })

    const harness = buildHarness({
      customersById: {
        cust_1: {
          id: "cust_1",
          email: "user@example.com",
          phone: null,
          metadata: pending,
        },
      },
    })

    const publicToken = buildPublicConfirmationToken("cust_1", "email", raw)

    const response = await applyMarketingConfirmationWorkflow(
      harness.container
    ).run({
      input: { token: publicToken },
    })

    const outcome = response.result.result as Record<string, unknown>
    expect(outcome.status).toBe("confirmed")
    expect(outcome.customer_id).toBe("cust_1")
    expect(outcome.channel).toBe("email")

    expect(mockUpdateCustomersRun).toHaveBeenCalledTimes(1)
    const update = mockUpdateCustomersRun.mock.calls[0][0] as any
    const resolved = resolveMarketingPreferences(
      update.input.update.metadata,
      {
        email: "user@example.com",
        phone: null,
        metadata: update.input.update.metadata,
      }
    )

    expect(resolved.preferences.channels.email.status).toBe("subscribed")
    expect(
      resolved.preferences.channels.email.confirmation_token_hash
    ).toBeNull()
  })

  it("fails with invalid_token_format for malformed token", async () => {
    const harness = buildHarness({ customersById: {} })

    const response = await applyMarketingConfirmationWorkflow(
      harness.container
    ).run({
      input: { token: "bogus" },
    })

    const outcome = response.result.result as Record<string, unknown>
    expect(outcome.status).toBe("failed")
    expect(outcome.reason).toBe("invalid_token_format")
    expect(mockUpdateCustomersRun).not.toHaveBeenCalled()
  })

  it("fails with customer_not_found when customer missing", async () => {
    const harness = buildHarness({ customersById: {} })

    const response = await applyMarketingConfirmationWorkflow(
      harness.container
    ).run({
      input: { token: "cust_missing.email.rawtoken" },
    })

    const outcome = response.result.result as Record<string, unknown>
    expect(outcome.status).toBe("failed")
    expect(outcome.reason).toBe("customer_not_found")
  })

  it("fails with token_mismatch when hash differs", async () => {
    const pending = buildChannelPendingMetadata({
      customer: {
        id: "cust_1",
        email: "user@example.com",
        phone: null,
        metadata: {},
      },
      channel: "email",
      tokenHash: hashConfirmationToken("correct-raw-token"),
    })

    const harness = buildHarness({
      customersById: {
        cust_1: {
          id: "cust_1",
          email: "user@example.com",
          phone: null,
          metadata: pending,
        },
      },
    })

    const response = await applyMarketingConfirmationWorkflow(
      harness.container
    ).run({
      input: {
        token: buildPublicConfirmationToken(
          "cust_1",
          "email",
          "wrong-raw-token"
        ),
      },
    })

    const outcome = response.result.result as Record<string, unknown>
    expect(outcome.status).toBe("failed")
    expect(outcome.reason).toBe("token_mismatch")
    expect(mockUpdateCustomersRun).not.toHaveBeenCalled()
  })
})
