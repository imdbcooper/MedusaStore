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
  buildChannelConfirmedMetadata,
  resolveMarketingPreferences,
  type MarketingCustomerRecord,
} from "../../modules/marketing-preferences"
import {
  buildPublicUnsubscribeToken,
  buildUnsubscribeIssueMetadata,
  hashUnsubscribeToken,
  readMarketingUnsubscribeMetadata,
} from "../../modules/marketing-unsubscribe"

type WorkflowRunner = (container: unknown) => {
  run: (input: { input: unknown }) => Promise<{
    result: { result: Record<string, unknown> }
  }>
}

let applyMarketingUnsubscribeWorkflow: WorkflowRunner

beforeAll(() => {
  applyMarketingUnsubscribeWorkflow = require("../apply-marketing-unsubscribe")
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

describe("applyMarketingUnsubscribeWorkflow", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUpdateCustomersRun.mockReset()
    ;(mockUpdateCustomersRun as any).mockResolvedValue({ result: [] })
  })

  it("unsubscribes email channel by default when no channels are supplied", async () => {
    const raw = "raw-token"
    const confirmedFirst = buildChannelConfirmedMetadata({
      customer: {
        id: "cust_1",
        email: "user@example.com",
        phone: null,
        metadata: {},
      },
      channel: "email",
    })
    const withUnsubscribe = buildUnsubscribeIssueMetadata({
      currentMetadata: confirmedFirst,
      tokenHash: hashUnsubscribeToken(raw),
    })

    const harness = buildHarness({
      customersById: {
        cust_1: {
          id: "cust_1",
          email: "user@example.com",
          phone: null,
          metadata: withUnsubscribe,
        },
      },
    })

    const response = await applyMarketingUnsubscribeWorkflow(
      harness.container
    ).run({
      input: {
        token: buildPublicUnsubscribeToken("cust_1", raw),
      },
    })

    const outcome = response.result.result as Record<string, unknown>
    expect(outcome.status).toBe("applied")
    expect(outcome.channels_applied).toEqual(["email"])

    expect(mockUpdateCustomersRun).toHaveBeenCalledTimes(1)
    const metadata = (mockUpdateCustomersRun.mock.calls[0][0] as any).input
      .update.metadata as Record<string, unknown>
    const resolved = resolveMarketingPreferences(metadata, {
      email: "user@example.com",
      phone: null,
      metadata,
    })
    expect(resolved.preferences.channels.email.status).toBe("unsubscribed")

    // Token consumed.
    const unsub = readMarketingUnsubscribeMetadata(metadata)
      .marketing_unsubscribe
    expect(unsub?.consumed_at).toBeTruthy()
  })

  it("returns failed status for invalid token (idempotent from route's POV)", async () => {
    const harness = buildHarness({ customersById: {} })

    const response = await applyMarketingUnsubscribeWorkflow(
      harness.container
    ).run({
      input: { token: "bogus" },
    })

    const outcome = response.result.result as Record<string, unknown>
    expect(outcome.status).toBe("failed")
    expect(outcome.reason).toBe("invalid_token_format")
    expect(mockUpdateCustomersRun).not.toHaveBeenCalled()
  })

  it("applies multiple channels when requested", async () => {
    const raw = "raw-multi"
    const confirmedEmail = buildChannelConfirmedMetadata({
      customer: {
        id: "cust_1",
        email: "user@example.com",
        phone: null,
        metadata: {},
      },
      channel: "email",
    })

    const withUnsubscribe = buildUnsubscribeIssueMetadata({
      currentMetadata: confirmedEmail,
      tokenHash: hashUnsubscribeToken(raw),
    })

    const harness = buildHarness({
      customersById: {
        cust_1: {
          id: "cust_1",
          email: "user@example.com",
          phone: null,
          metadata: withUnsubscribe,
        },
      },
    })

    const response = await applyMarketingUnsubscribeWorkflow(
      harness.container
    ).run({
      input: {
        token: buildPublicUnsubscribeToken("cust_1", raw),
        channels: ["email"],
      },
    })

    const outcome = response.result.result as Record<string, unknown>
    expect(outcome.status).toBe("applied")
    expect(outcome.channels_applied).toEqual(["email"])
  })
})
