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
  hashConfirmationToken,
  parsePublicConfirmationToken,
  resolveMarketingPreferences,
  type MarketingCustomerRecord,
} from "../../modules/marketing-preferences"

type WorkflowRunner = (container: unknown) => {
  run: (input: { input: unknown }) => Promise<{
    result: { result: Record<string, unknown> }
  }>
}

let sendMarketingConfirmationWorkflow: WorkflowRunner

beforeAll(() => {
  sendMarketingConfirmationWorkflow = require("../send-marketing-confirmation")
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
        const id = String(args.filters.id || "")
        const customer = options.customersById[id]
        return { data: customer ? [customer] : [] }
      }
      throw new Error(`Unexpected entity: ${args.entity}`)
    }),
  }

  const notificationModuleService = {
    createNotifications: jest.fn(async (payload: Record<string, unknown>) => ({
      ...payload,
      id: "noti_marketing_confirm",
      status: "pending",
      created_at: "2026-05-12T05:00:00.000Z",
      provider_id: "local",
    })),
  }

  const container = createContainer()
  container.register({
    [ContainerRegistrationKeys.LOGGER]: asValue(logger),
    [ContainerRegistrationKeys.QUERY]: asValue(query),
    [Modules.NOTIFICATION]: asValue(notificationModuleService),
  })

  return {
    container: container as any,
    logger,
    query,
    notificationModuleService,
  }
}

describe("sendMarketingConfirmationWorkflow", () => {
  const ORIGINAL_ENV = { ...process.env }

  beforeEach(() => {
    process.env = {
      ...ORIGINAL_ENV,
      STOREFRONT_URL: "https://shop.example.com",
      NOTIFICATION_EMAIL_PROVIDER: "local",
      NOTIFICATION_EMAIL_FROM: "notifications@example.com",
      MARKETING_DOUBLE_OPTIN_TOKEN_TTL_DAYS: "7",
    }
    jest.clearAllMocks()
    mockUpdateCustomersRun.mockReset()
    ;(mockUpdateCustomersRun as any).mockResolvedValue({ result: [] })
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  it("issues a confirmation token and sends the branded email", async () => {
    const harness = buildHarness({
      customersById: {
        cust_1: {
          id: "cust_1",
          email: "user@example.com",
          phone: null,
          metadata: {},
        },
      },
    })

    const response = await sendMarketingConfirmationWorkflow(
      harness.container
    ).run({
      input: {
        customerId: "cust_1",
        channel: "email",
        countryCode: "ru",
      },
    })

    const outcome = response.result.result as Record<string, unknown>

    expect(outcome.status).toBe("sent")
    expect(outcome.channel).toBe("email")
    expect(outcome.recipient).toBe("user@example.com")
    expect(outcome.token_ttl_days).toBe(7)

    expect(mockUpdateCustomersRun).toHaveBeenCalledTimes(1)
    const update = mockUpdateCustomersRun.mock.calls[0][0] as any
    expect(update.input.selector.id).toEqual(["cust_1"])

    const resolved = resolveMarketingPreferences(
      update.input.update.metadata,
      {
        email: "user@example.com",
        phone: null,
        metadata: update.input.update.metadata,
      }
    )

    expect(resolved.preferences.channels.email.status).toBe("pending")
    expect(resolved.preferences.channels.email.confirmation_token_hash).toBeTruthy()

    const notification = harness.notificationModuleService
      .createNotifications.mock.calls[0][0] as any

    expect(notification.template).toBe(
      "marketing-double-optin-confirmation-v1"
    )
    expect(notification.trigger_type).toBe(
      "marketing.subscription.confirmation_requested"
    )
    expect(notification.channel).toBe("email")
    expect(notification.to).toBe("user@example.com")

    const link = notification.data.link as string
    expect(link).toContain(
      "https://shop.example.com/ru/marketing/confirm?token="
    )

    const urlToken = new URL(link).searchParams.get("token")
    const parsed = parsePublicConfirmationToken(urlToken)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.customerId).toBe("cust_1")
      expect(parsed.channel).toBe("email")
      expect(resolved.preferences.channels.email.confirmation_token_hash).toBe(
        hashConfirmationToken(parsed.rawToken)
      )
    }
  })

  it("skips when storefront URL is missing", async () => {
    process.env.STOREFRONT_URL = ""
    process.env.STOREFRONT_BASE_URL = ""
    process.env.NEXT_PUBLIC_STOREFRONT_URL = ""

    const harness = buildHarness({
      customersById: {
        cust_1: {
          id: "cust_1",
          email: "user@example.com",
          phone: null,
          metadata: {},
        },
      },
    })

    const response = await sendMarketingConfirmationWorkflow(
      harness.container
    ).run({
      input: { customerId: "cust_1", channel: "email" },
    })

    const outcome = response.result.result as Record<string, unknown>
    expect(outcome.status).toBe("skipped")
    expect(outcome.reason).toBe("missing_storefront_url")
    expect(harness.notificationModuleService.createNotifications).not.toHaveBeenCalled()
  })

  it("skips when customer not found", async () => {
    const harness = buildHarness({ customersById: {} })

    const response = await sendMarketingConfirmationWorkflow(
      harness.container
    ).run({
      input: { customerId: "missing", channel: "email" },
    })

    const outcome = response.result.result as Record<string, unknown>
    expect(outcome.status).toBe("skipped")
    expect(outcome.reason).toBe("customer_not_found")
  })

  it("skips when customer has no email", async () => {
    const harness = buildHarness({
      customersById: {
        cust_1: {
          id: "cust_1",
          email: null,
          phone: null,
          metadata: {},
        },
      },
    })

    const response = await sendMarketingConfirmationWorkflow(
      harness.container
    ).run({
      input: { customerId: "cust_1", channel: "email" },
    })

    const outcome = response.result.result as Record<string, unknown>
    expect(outcome.status).toBe("skipped")
    expect(outcome.reason).toBe("missing_customer_email")
  })

  it("rejects unsupported channels (SMS/VK are not in Phase 4 scope)", async () => {
    const harness = buildHarness({
      customersById: {
        cust_1: {
          id: "cust_1",
          email: "user@example.com",
          phone: null,
          metadata: {},
        },
      },
    })

    const response = await sendMarketingConfirmationWorkflow(
      harness.container
    ).run({
      input: { customerId: "cust_1", channel: "sms" },
    })

    const outcome = response.result.result as Record<string, unknown>
    expect(outcome.status).toBe("skipped")
    expect(outcome.reason).toBe("unsupported_channel")
  })

  it("uses MARKETING_EMAIL_FROM when provided", async () => {
    process.env.MARKETING_EMAIL_FROM = "news@news.slavx.ru"

    const harness = buildHarness({
      customersById: {
        cust_1: {
          id: "cust_1",
          email: "user@example.com",
          phone: null,
          metadata: {},
        },
      },
    })

    await sendMarketingConfirmationWorkflow(harness.container).run({
      input: { customerId: "cust_1", channel: "email" },
    })

    const notification = harness.notificationModuleService
      .createNotifications.mock.calls[0][0] as any

    expect(notification.from).toBe("news@news.slavx.ru")
  })
})
