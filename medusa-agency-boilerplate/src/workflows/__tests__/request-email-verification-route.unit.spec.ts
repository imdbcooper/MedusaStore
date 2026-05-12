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

type PostHandler = (req: unknown, res: unknown) => Promise<void>

let POST: PostHandler

beforeAll(() => {
  POST =
    require("../../api/store/customers/me/request-email-verification/route").POST
})

type CustomerRow = {
  id: string
  email: string | null
}

function buildRequest(options: {
  actorId: string | null
  customersById: Record<string, CustomerRow>
  body?: Record<string, unknown>
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

  const scope = {
    resolve: jest.fn((key: string) => {
      if (key === ContainerRegistrationKeys.LOGGER) {
        return logger
      }
      if (key === ContainerRegistrationKeys.QUERY) {
        return query
      }

      throw new Error(`Unexpected container resolve: ${key}`)
    }),
  }

  const statusMock = jest.fn().mockReturnThis() as any
  const jsonMock = jest.fn<(payload: Record<string, unknown>) => void>()

  return {
    req: {
      auth_context: { actor_id: options.actorId },
      scope,
      body: options.body || {},
      validatedBody: options.body || {},
    } as any,
    res: {
      status: statusMock,
      json: jsonMock,
    } as any,
    logger,
    statusMock,
    jsonMock,
  }
}

describe("POST /store/customers/me/request-email-verification", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockWorkflowRun.mockReset()
  })

  afterEach(() => {
    mockWorkflowRun.mockReset()
  })

  it("returns 401 when actor_id is missing", async () => {
    const ctx = buildRequest({
      actorId: null,
      customersById: {},
    })

    await POST(ctx.req, ctx.res)

    expect(ctx.statusMock).toHaveBeenCalledWith(401)
    expect(mockWorkflowRun).not.toHaveBeenCalled()
  })

  it("returns 404 when customer cannot be found", async () => {
    const ctx = buildRequest({
      actorId: "cus_missing",
      customersById: {},
    })

    await POST(ctx.req, ctx.res)

    expect(ctx.statusMock).toHaveBeenCalledWith(404)
    expect(mockWorkflowRun).not.toHaveBeenCalled()
  })

  it("invokes workflow with resend reason and returns provider meta", async () => {
    const ctx = buildRequest({
      actorId: "cus_ok",
      customersById: {
        cus_ok: { id: "cus_ok", email: "user@example.com" },
      },
      body: { country_code: "ru" },
    })

    ;(mockWorkflowRun as any).mockResolvedValue({
      result: {
        result: {
          status: "sent",
          reason: null,
          customer_id: "cus_ok",
          recipient: "user@example.com",
          recipient_normalized: "user@example.com",
          provider_requested: "local",
          provider_resolved: "local",
          token_ttl_minutes: 1440,
          expires_at: "2026-05-13T05:00:00.000Z",
          country_code: "ru",
        },
      },
    })

    await POST(ctx.req, ctx.res)

    expect(mockWorkflowRun).toHaveBeenCalledTimes(1)
    const callInput = (mockWorkflowRun.mock.calls[0][0] as {
      input: {
        customerId: string
        countryCode: string
        reason: string
      }
    }).input
    expect(callInput.customerId).toBe("cus_ok")
    expect(callInput.countryCode).toBe("ru")
    expect(callInput.reason).toBe("resend")
    expect(ctx.statusMock).toHaveBeenCalledWith(200)
    const payload = ctx.jsonMock.mock.calls[0][0] as Record<string, unknown>
    expect(payload.ok).toBe(true)
    expect(payload.token_ttl_minutes).toBe(1440)
  })

  it("returns 422 when workflow reports skip", async () => {
    const ctx = buildRequest({
      actorId: "cus_ok",
      customersById: {
        cus_ok: { id: "cus_ok", email: "user@example.com" },
      },
    })

    ;(mockWorkflowRun as any).mockResolvedValue({
      result: {
        result: {
          status: "skipped",
          reason: "missing_storefront_url",
          customer_id: "cus_ok",
          recipient: null,
          recipient_normalized: null,
          provider_requested: "local",
          provider_resolved: "local",
          token_ttl_minutes: 1440,
          expires_at: null,
          country_code: null,
        },
      },
    })

    await POST(ctx.req, ctx.res)

    expect(ctx.statusMock).toHaveBeenCalledWith(422)
    const payload = ctx.jsonMock.mock.calls[0][0] as Record<string, unknown>
    expect(payload.ok).toBe(false)
    expect(payload.code).toBe("missing_storefront_url")
  })
})
