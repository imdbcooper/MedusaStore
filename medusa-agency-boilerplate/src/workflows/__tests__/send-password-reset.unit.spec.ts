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
  hashPasswordResetToken,
  parsePasswordResetToken,
  readPasswordResetMetadata,
} from "../../modules/password-reset"

type WorkflowRunner = (container: unknown) => {
  run: (input: { input: unknown }) => Promise<{
    result: { result: Record<string, unknown> }
  }>
}

let sendPasswordResetWorkflow: WorkflowRunner

beforeAll(() => {
  sendPasswordResetWorkflow =
    require("../send-password-reset").default as WorkflowRunner
})

type CustomerRow = {
  id: string
  email: string | null
  first_name: string | null
  metadata?: Record<string, unknown> | null
}

type GraphCall = {
  entity: string
  fields: string[]
  filters: Record<string, unknown>
}

function buildHarness(options: {
  customersByEmail: Record<string, CustomerRow>
}) {
  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }

  const graphCalls: GraphCall[] = []

  const query = {
    graph: jest.fn(async (args: GraphCall) => {
      graphCalls.push(args)

      if (args.entity === "customer") {
        const email = String(args.filters.email || "").toLowerCase()
        const customer = options.customersByEmail[email]

        return {
          data: customer ? [customer] : [],
        }
      }

      throw new Error(`Unexpected graph entity: ${args.entity}`)
    }),
  }

  const notificationModuleService = {
    createNotifications: jest.fn(async (payload: Record<string, unknown>) => ({
      ...payload,
      id: "noti_password_reset",
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
    graphCalls,
    notificationModuleService,
  }
}

describe("sendPasswordResetWorkflow", () => {
  const ORIGINAL_ENV = { ...process.env }

  beforeEach(() => {
    process.env = {
      ...ORIGINAL_ENV,
      STOREFRONT_URL: "https://shop.example.com",
      NOTIFICATION_EMAIL_PROVIDER: "local",
      NOTIFICATION_EMAIL_FROM: "notifications@example.com",
      PASSWORD_RESET_TOKEN_TTL_MINUTES: "30",
    }
    jest.clearAllMocks()
    mockUpdateCustomersRun.mockReset()
    ;(mockUpdateCustomersRun as any).mockResolvedValue({ result: [] })
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  it("issues token and sends email for existing customer", async () => {
    const harness = buildHarness({
      customersByEmail: {
        "user@example.com": {
          id: "cus_ok",
          email: "User@Example.com",
          first_name: "Ivan",
          metadata: {},
        },
      },
    })

    const response = await sendPasswordResetWorkflow(harness.container).run({
      input: { email: "User@Example.com", countryCode: "ru" },
    })

    const outcome = response.result.result as {
      status: string
      reason: string | null
      recipient: string | null
      token_ttl_minutes: number
      country_code: string | null
      expires_at: string | null
      customer_id: string | null
    }

    expect(outcome.status).toBe("sent")
    expect(outcome.reason).toBeNull()
    expect(outcome.recipient).toBe("user@example.com")
    expect(outcome.token_ttl_minutes).toBe(30)
    expect(outcome.country_code).toBe("ru")
    expect(outcome.expires_at).not.toBeNull()
    expect(outcome.customer_id).toBe("cus_ok")

    expect(mockUpdateCustomersRun).toHaveBeenCalledTimes(1)
    const updatePayload = mockUpdateCustomersRun.mock.calls[0][0] as unknown as {
      input: {
        selector: { id: string[] }
        update: { metadata: Record<string, unknown> }
      }
    }
    expect(updatePayload.input.selector.id).toEqual(["cus_ok"])
    const storedMetadata = readPasswordResetMetadata(
      updatePayload.input.update.metadata
    )
    expect(storedMetadata.password_reset).not.toBeNull()
    expect(storedMetadata.password_reset?.email).toBe("user@example.com")

    expect(
      harness.notificationModuleService.createNotifications
    ).toHaveBeenCalledTimes(1)
    const notificationPayload = harness.notificationModuleService
      .createNotifications.mock.calls[0][0] as {
      to: string
      channel: string
      template: string
      trigger_type: string
      resource_type: string
      resource_id: string
      content: { subject: string; text: string; html: string }
      data: { link: string; ttl_minutes: number }
    }
    expect(notificationPayload.to).toBe("user@example.com")
    expect(notificationPayload.channel).toBe("email")
    expect(notificationPayload.template).toBe("customer-password-reset-v1")
    expect(notificationPayload.trigger_type).toBe(
      "customer.password_reset.requested"
    )
    expect(notificationPayload.resource_type).toBe("customer")
    expect(notificationPayload.resource_id).toBe("cus_ok")
    expect(notificationPayload.data.link).toContain(
      "https://shop.example.com/ru/account/reset-password?token=cus_ok."
    )
    expect(notificationPayload.data.ttl_minutes).toBe(30)

    const urlToken = new URL(notificationPayload.data.link).searchParams.get(
      "token"
    )
    expect(urlToken).not.toBeNull()
    const parsed = parsePasswordResetToken(urlToken)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.customerId).toBe("cus_ok")
      expect(storedMetadata.password_reset?.token_hash).toBe(
        hashPasswordResetToken(parsed.rawToken)
      )
    }
  })

  it("skips silently when customer email unknown (no user enumeration)", async () => {
    const harness = buildHarness({ customersByEmail: {} })

    const response = await sendPasswordResetWorkflow(harness.container).run({
      input: { email: "unknown@example.com" },
    })

    const outcome = response.result.result as {
      status: string
      reason: string | null
      customer_id: string | null
    }
    expect(outcome.status).toBe("skipped")
    expect(outcome.reason).toBe("customer_not_found")
    expect(outcome.customer_id).toBeNull()
    expect(
      harness.notificationModuleService.createNotifications
    ).not.toHaveBeenCalled()
    expect(mockUpdateCustomersRun).not.toHaveBeenCalled()
  })

  it("skips with missing_email when email is empty", async () => {
    const harness = buildHarness({ customersByEmail: {} })

    const response = await sendPasswordResetWorkflow(harness.container).run({
      input: { email: "  " },
    })

    const outcome = response.result.result as {
      status: string
      reason: string | null
    }
    expect(outcome.status).toBe("skipped")
    expect(outcome.reason).toBe("missing_email")
  })

  it("skips when storefront URL is not configured", async () => {
    delete process.env.STOREFRONT_URL
    delete process.env.STOREFRONT_BASE_URL
    delete process.env.NEXT_PUBLIC_STOREFRONT_URL

    const harness = buildHarness({
      customersByEmail: {
        "user@example.com": {
          id: "cus_any",
          email: "user@example.com",
          first_name: null,
          metadata: {},
        },
      },
    })

    const response = await sendPasswordResetWorkflow(harness.container).run({
      input: { email: "user@example.com" },
    })

    const outcome = response.result.result as {
      status: string
      reason: string | null
    }
    expect(outcome.status).toBe("skipped")
    expect(outcome.reason).toBe("missing_storefront_url")
    expect(
      harness.notificationModuleService.createNotifications
    ).not.toHaveBeenCalled()
  })

  it("skips when customer has no email after lookup", async () => {
    const harness = buildHarness({
      customersByEmail: {
        "user@example.com": {
          id: "cus_no_email",
          email: "   ",
          first_name: null,
          metadata: null,
        },
      },
    })

    const response = await sendPasswordResetWorkflow(harness.container).run({
      input: { email: "user@example.com" },
    })

    const outcome = response.result.result as {
      status: string
      reason: string | null
    }
    expect(outcome.status).toBe("skipped")
    expect(outcome.reason).toBe("missing_customer_email")
  })
})
