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
  hashEmailVerificationToken,
  parseEmailVerificationToken,
  readEmailVerificationMetadata,
} from "../../modules/email-verification"

type WorkflowRunner = (container: unknown) => {
  run: (input: { input: unknown }) => Promise<{
    result: { result: Record<string, unknown> }
  }>
}

let sendEmailVerificationWorkflow: WorkflowRunner

beforeAll(() => {
  sendEmailVerificationWorkflow =
    require("../send-email-verification").default as WorkflowRunner
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
  customersById: Record<string, CustomerRow>
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
        const id = String(args.filters.id)
        const customer = options.customersById[id]

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
      id: "noti_email_verification",
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

describe("sendEmailVerificationWorkflow", () => {
  const ORIGINAL_ENV = { ...process.env }

  beforeEach(() => {
    process.env = {
      ...ORIGINAL_ENV,
      STOREFRONT_URL: "https://shop.example.com",
      NOTIFICATION_EMAIL_PROVIDER: "local",
      NOTIFICATION_EMAIL_FROM: "notifications@example.com",
      EMAIL_VERIFICATION_TOKEN_TTL_MINUTES: "120",
    }
    jest.clearAllMocks()
    mockUpdateCustomersRun.mockReset()
    ;(mockUpdateCustomersRun as any).mockResolvedValue({ result: [] })
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  it("issues and sends verification email for valid customer", async () => {
    const harness = buildHarness({
      customersById: {
        cus_ok: {
          id: "cus_ok",
          email: "User@Example.com",
          first_name: "Ivan",
          metadata: {},
        },
      },
    })

    const response = await sendEmailVerificationWorkflow(harness.container).run({
      input: { customerId: "cus_ok", countryCode: "ru" },
    })

    const outcome = response.result.result as {
      status: string
      reason: string | null
      recipient: string | null
      token_ttl_minutes: number
      country_code: string | null
      expires_at: string | null
    }
    expect(outcome.status).toBe("sent")
    expect(outcome.reason).toBeNull()
    expect(outcome.recipient).toBe("user@example.com")
    expect(outcome.token_ttl_minutes).toBe(120)
    expect(outcome.country_code).toBe("ru")
    expect(outcome.expires_at).not.toBeNull()

    // persists verification state on customer.metadata
    expect(mockUpdateCustomersRun).toHaveBeenCalledTimes(1)
    const updatePayload = mockUpdateCustomersRun.mock
      .calls[0][0] as unknown as {
      input: {
        selector: { id: string[] }
        update: { metadata: Record<string, unknown> }
      }
    }
    expect(updatePayload.input.selector.id).toEqual(["cus_ok"])
    const storedMetadata = readEmailVerificationMetadata(
      updatePayload.input.update.metadata
    )
    expect(storedMetadata.email_verification).not.toBeNull()
    expect(storedMetadata.email_verification?.email).toBe("user@example.com")

    // notification payload content
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
      data: { link: string }
    }
    expect(notificationPayload.to).toBe("user@example.com")
    expect(notificationPayload.channel).toBe("email")
    expect(notificationPayload.template).toBe("customer-email-verification-v1")
    expect(notificationPayload.trigger_type).toBe(
      "customer.email_verification.requested"
    )
    expect(notificationPayload.resource_type).toBe("customer")
    expect(notificationPayload.resource_id).toBe("cus_ok")
    expect(notificationPayload.content.subject).toBe(
      "Подтверждение адреса электронной почты"
    )
    expect(notificationPayload.data.link).toContain(
      "https://shop.example.com/ru/account/verify-email?token=cus_ok."
    )

    // emitted token hash actually matches persisted hash
    const urlToken = new URL(notificationPayload.data.link).searchParams.get(
      "token"
    )
    expect(urlToken).not.toBeNull()
    const parsed = parseEmailVerificationToken(urlToken)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.customerId).toBe("cus_ok")
      expect(storedMetadata.email_verification?.token_hash).toBe(
        hashEmailVerificationToken(parsed.rawToken)
      )
    }
  })

  it("skips when customer has no email", async () => {
    const harness = buildHarness({
      customersById: {
        cus_no_email: {
          id: "cus_no_email",
          email: "   ",
          first_name: null,
          metadata: null,
        },
      },
    })

    const response = await sendEmailVerificationWorkflow(harness.container).run({
      input: { customerId: "cus_no_email" },
    })

    const outcome = response.result.result as {
      status: string
      reason: string | null
    }
    expect(outcome.status).toBe("skipped")
    expect(outcome.reason).toBe("missing_customer_email")
    expect(
      harness.notificationModuleService.createNotifications
    ).not.toHaveBeenCalled()
    expect(mockUpdateCustomersRun).not.toHaveBeenCalled()
  })

  it("skips when customer cannot be found", async () => {
    const harness = buildHarness({ customersById: {} })

    const response = await sendEmailVerificationWorkflow(harness.container).run({
      input: { customerId: "cus_missing" },
    })

    const outcome = response.result.result as {
      status: string
      reason: string | null
    }
    expect(outcome.status).toBe("skipped")
    expect(outcome.reason).toBe("customer_not_found")
    expect(
      harness.notificationModuleService.createNotifications
    ).not.toHaveBeenCalled()
  })

  it("skips with missing_storefront_url when no base URL is configured", async () => {
    delete process.env.STOREFRONT_URL
    delete process.env.STOREFRONT_BASE_URL
    delete process.env.NEXT_PUBLIC_STOREFRONT_URL

    const harness = buildHarness({
      customersById: {
        cus_any: {
          id: "cus_any",
          email: "user@example.com",
          first_name: null,
          metadata: {},
        },
      },
    })

    const response = await sendEmailVerificationWorkflow(harness.container).run({
      input: { customerId: "cus_any" },
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

  it("defaults countryCode to 'ru' when input omits it (regression: storefront 404)", async () => {
    const harness = buildHarness({
      customersById: {
        cus_default: {
          id: "cus_default",
          email: "default@example.com",
          first_name: null,
          metadata: {},
        },
      },
    })

    const response = await sendEmailVerificationWorkflow(harness.container).run({
      input: { customerId: "cus_default" },
    })

    const outcome = response.result.result as {
      status: string
      country_code: string | null
    }
    expect(outcome.status).toBe("sent")
    expect(outcome.country_code).toBe("ru")

    const notificationPayload = harness.notificationModuleService
      .createNotifications.mock.calls[0][0] as {
      data: { link: string }
    }
    expect(notificationPayload.data.link).toContain(
      "https://shop.example.com/ru/account/verify-email?token="
    )
  })

  it("honors NOTIFICATION_DEFAULT_COUNTRY_CODE env override when input omits countryCode", async () => {
    process.env.NOTIFICATION_DEFAULT_COUNTRY_CODE = "kz"

    const harness = buildHarness({
      customersById: {
        cus_env: {
          id: "cus_env",
          email: "env@example.com",
          first_name: null,
          metadata: {},
        },
      },
    })

    const response = await sendEmailVerificationWorkflow(harness.container).run({
      input: { customerId: "cus_env" },
    })

    const outcome = response.result.result as { country_code: string | null }
    expect(outcome.country_code).toBe("kz")

    const notificationPayload = harness.notificationModuleService
      .createNotifications.mock.calls[0][0] as {
      data: { link: string }
    }
    expect(notificationPayload.data.link).toContain(
      "https://shop.example.com/kz/account/verify-email?token="
    )
  })
})
