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

const mockUpdateCustomersRun = jest.fn(
  async (_input: { input: unknown }) => ({ result: [] })
)

jest.mock("@medusajs/medusa/core-flows", () => ({
  updateCustomersWorkflow: () => ({
    run: mockUpdateCustomersRun,
  }),
}))

import {
  buildEmailVerificationIssueMetadata,
  buildEmailVerificationToken,
  generateEmailVerificationRawToken,
  hashEmailVerificationToken,
} from "../../modules/email-verification"

type PostHandler = (req: unknown, res: unknown) => Promise<void>

let POST: PostHandler

beforeAll(() => {
  POST = require("../../api/store/customers/verify-email/route").POST
})

type CustomerRow = {
  id: string
  email: string | null
  metadata?: Record<string, unknown> | null
}

function buildRequest(options: {
  body: Record<string, unknown>
  customersById: Record<string, CustomerRow>
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
      body: options.body,
      scope,
    } as any,
    res: {
      status: statusMock,
      json: jsonMock,
    } as any,
    query,
    logger,
    statusMock,
    jsonMock,
  }
}

function buildVerifiableCustomer(options?: {
  email?: string
  ttlMinutes?: number
}) {
  const rawToken = generateEmailVerificationRawToken()
  const tokenHash = hashEmailVerificationToken(rawToken)
  const email = options?.email || "user@example.com"
  const metadata = buildEmailVerificationIssueMetadata({
    currentMetadata: {},
    email,
    tokenHash,
    now: new Date(),
    ttlMinutes: options?.ttlMinutes ?? 60,
  })

  const customer: CustomerRow = {
    id: "cus_verify_route",
    email,
    metadata,
  }

  return {
    customer,
    rawToken,
    fullToken: buildEmailVerificationToken(customer.id, rawToken),
  }
}

describe("POST /store/customers/verify-email", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUpdateCustomersRun.mockReset()
    ;(mockUpdateCustomersRun as any).mockResolvedValue({ result: [] })
  })

  afterEach(() => {
    mockUpdateCustomersRun.mockReset()
  })

  it("returns 400 with generic code when token is missing", async () => {
    const ctx = buildRequest({
      body: {},
      customersById: {},
    })

    await POST(ctx.req, ctx.res)

    expect(ctx.statusMock).toHaveBeenCalledWith(400)
    const payload = ctx.jsonMock.mock.calls[0][0] as Record<string, unknown>
    expect(payload.ok).toBe(false)
    expect(payload.code).toBe("invalid_or_expired_token")
  })

  it("returns 400 with generic code when customer cannot be found", async () => {
    const rawToken = generateEmailVerificationRawToken()
    const fullToken = buildEmailVerificationToken("cus_missing", rawToken)

    const ctx = buildRequest({
      body: { token: fullToken },
      customersById: {},
    })

    await POST(ctx.req, ctx.res)

    expect(ctx.statusMock).toHaveBeenCalledWith(400)
    const payload = ctx.jsonMock.mock.calls[0][0] as Record<string, unknown>
    expect(payload.ok).toBe(false)
    expect(payload.code).toBe("invalid_or_expired_token")
  })

  it("returns 400 with generic code when token already consumed", async () => {
    const { customer, fullToken } = buildVerifiableCustomer()

    // pre-consume
    const metadata = customer.metadata as Record<string, unknown>
    ;(
      metadata.email_verification as Record<string, unknown>
    ).consumed_at = new Date().toISOString()

    const ctx = buildRequest({
      body: { token: fullToken },
      customersById: { [customer.id]: customer },
    })

    await POST(ctx.req, ctx.res)

    expect(ctx.statusMock).toHaveBeenCalledWith(400)
    const payload = ctx.jsonMock.mock.calls[0][0] as Record<string, unknown>
    expect(payload.ok).toBe(false)
    expect(payload.code).toBe("invalid_or_expired_token")
    expect(mockUpdateCustomersRun).not.toHaveBeenCalled()
  })

  it("verifies customer and updates metadata on successful path", async () => {
    const { customer, fullToken } = buildVerifiableCustomer()

    const ctx = buildRequest({
      body: { token: fullToken },
      customersById: { [customer.id]: customer },
    })

    await POST(ctx.req, ctx.res)

    expect(ctx.statusMock).toHaveBeenCalledWith(200)
    const payload = ctx.jsonMock.mock.calls[0][0] as Record<string, unknown>
    expect(payload.ok).toBe(true)
    expect(payload.status).toBe("verified")
    expect(payload.customer_id).toBe(customer.id)

    expect(mockUpdateCustomersRun).toHaveBeenCalledTimes(1)
    const updateInput = mockUpdateCustomersRun.mock.calls[0][0] as unknown as {
      input: {
        selector: { id: string[] }
        update: { metadata: Record<string, unknown> }
      }
    }
    expect(updateInput.input.selector.id).toEqual([customer.id])
    expect(updateInput.input.update.metadata.email_verified).toBe(true)
    expect(updateInput.input.update.metadata.email_verified_for).toBe(
      "user@example.com"
    )
  })
})
