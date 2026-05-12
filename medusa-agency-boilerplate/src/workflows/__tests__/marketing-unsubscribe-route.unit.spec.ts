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

jest.mock("../../workflows/apply-marketing-unsubscribe", () => ({
  __esModule: true,
  default: () => ({
    run: mockWorkflowRun,
  }),
}))

type Handler = (req: unknown, res: unknown) => Promise<void>

let POST: Handler
let GET: Handler

beforeAll(() => {
  const route = require("../../api/store/customers/marketing/unsubscribe/route")
  POST = route.POST
  GET = route.GET
})

type BuildRequestArgs = {
  body?: Record<string, unknown>
  validatedBody?: Record<string, unknown>
  query?: Record<string, unknown>
  headers?: Record<string, string>
}

function buildRequest(args: BuildRequestArgs = {}) {
  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }

  const scope = {
    resolve: jest.fn((key: string) => {
      if (key === ContainerRegistrationKeys.LOGGER) {
        return logger
      }
      throw new Error(`Unexpected container resolve: ${key}`)
    }),
  }

  const statusMock = jest.fn().mockReturnThis() as any
  const jsonMock = jest.fn<(payload: Record<string, unknown>) => void>()

  return {
    req: {
      body: args.body ?? {},
      validatedBody: args.validatedBody ?? args.body ?? {},
      query: args.query ?? {},
      headers: args.headers ?? {},
      scope,
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

describe("POST /store/customers/marketing/unsubscribe", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockWorkflowRun.mockReset()
  })

  afterEach(() => {
    mockWorkflowRun.mockReset()
  })

  it("returns 200 with ok:true on applied", async () => {
    ;(mockWorkflowRun as any).mockResolvedValue({
      result: {
        result: {
          status: "applied",
          reason: null,
          customer_id: "cust_1",
          channels_applied: ["email"],
        },
      },
    })

    const ctx = buildRequest({
      body: { token: "cust_1.raw", channels: ["email"] },
    })

    await POST(ctx.req, ctx.res)

    expect(ctx.statusMock).toHaveBeenCalledWith(200)
    expect(ctx.jsonMock.mock.calls[0][0]).toEqual({ ok: true })
  })

  it("returns 200 with ok:true even when token is invalid (idempotent)", async () => {
    ;(mockWorkflowRun as any).mockResolvedValue({
      result: {
        result: {
          status: "failed",
          reason: "invalid_token_format",
          customer_id: null,
          channels_applied: [],
        },
      },
    })

    const ctx = buildRequest({ body: { token: "bogus" } })
    await POST(ctx.req, ctx.res)

    expect(ctx.statusMock).toHaveBeenCalledWith(200)
    expect(ctx.jsonMock.mock.calls[0][0]).toEqual({ ok: true })
  })

  it("returns 200 ok:true when workflow throws (never raw error to client)", async () => {
    ;(mockWorkflowRun as any).mockRejectedValue(new Error("db down"))

    const ctx = buildRequest({ body: { token: "cust_1.raw" } })
    await POST(ctx.req, ctx.res)

    expect(ctx.statusMock).toHaveBeenCalledWith(200)
    expect(ctx.jsonMock.mock.calls[0][0]).toEqual({ ok: true })
  })

  it("passes channels array through to workflow input", async () => {
    ;(mockWorkflowRun as any).mockResolvedValue({
      result: {
        result: {
          status: "applied",
          reason: null,
          customer_id: "cust_1",
          channels_applied: ["email"],
        },
      },
    })

    const ctx = buildRequest({
      body: { token: "cust_1.raw", channels: ["email", "sms"] },
    })

    await POST(ctx.req, ctx.res)

    const input = (mockWorkflowRun.mock.calls[0][0] as { input: any }).input
    expect(input.token).toBe("cust_1.raw")
    expect(input.channels).toEqual(["email", "sms"])
  })

  it("prefers token from query string over body (RFC 8058 compliance)", async () => {
    ;(mockWorkflowRun as any).mockResolvedValue({
      result: {
        result: {
          status: "applied",
          reason: null,
          customer_id: "cust_q",
          channels_applied: ["email"],
        },
      },
    })

    const ctx = buildRequest({
      body: { token: "body-token" },
      validatedBody: { token: "body-token" },
      query: { token: "query-token", channels: "email" },
    })

    await POST(ctx.req, ctx.res)

    const input = (mockWorkflowRun.mock.calls[0][0] as { input: any }).input
    expect(input.token).toBe("query-token")
    expect(input.channels).toEqual(["email"])
    expect(ctx.jsonMock.mock.calls[0][0]).toEqual({ ok: true })
  })

  it("treats x-www-form-urlencoded List-Unsubscribe=One-Click body as one-click POST", async () => {
    ;(mockWorkflowRun as any).mockResolvedValue({
      result: {
        result: {
          status: "applied",
          reason: null,
          customer_id: "cust_oc",
          channels_applied: ["email"],
        },
      },
    })

    const ctx = buildRequest({
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: { "List-Unsubscribe": "One-Click" },
      validatedBody: {},
      query: { token: "one-click-token" },
    })

    await POST(ctx.req, ctx.res)

    const input = (mockWorkflowRun.mock.calls[0][0] as { input: any }).input
    expect(input.token).toBe("one-click-token")
    expect(ctx.jsonMock.mock.calls[0][0]).toEqual({ ok: true })
    expect(ctx.logger.info).toHaveBeenCalledWith(
      expect.stringContaining("source=one-click")
    )
  })

  it("parses comma-separated channels from query string", async () => {
    ;(mockWorkflowRun as any).mockResolvedValue({
      result: {
        result: {
          status: "applied",
          reason: null,
          customer_id: "cust_csv",
          channels_applied: ["email", "sms"],
        },
      },
    })

    const ctx = buildRequest({
      query: { token: "t", channels: "email,sms" },
    })

    await POST(ctx.req, ctx.res)

    const input = (mockWorkflowRun.mock.calls[0][0] as { input: any }).input
    expect(input.channels).toEqual(expect.arrayContaining(["email", "sms"]))
  })
})

describe("GET /store/customers/marketing/unsubscribe", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockWorkflowRun.mockReset()
  })

  afterEach(() => {
    mockWorkflowRun.mockReset()
  })

  it("returns 200 ok:true for direct email-client prefetch GET with query token", async () => {
    ;(mockWorkflowRun as any).mockResolvedValue({
      result: {
        result: {
          status: "applied",
          reason: null,
          customer_id: "cust_g",
          channels_applied: ["email"],
        },
      },
    })

    const ctx = buildRequest({
      query: { token: "cust_g.raw", channels: "email" },
    })

    await GET(ctx.req, ctx.res)

    const input = (mockWorkflowRun.mock.calls[0][0] as { input: any }).input
    expect(input.token).toBe("cust_g.raw")
    expect(input.channels).toEqual(["email"])
    expect(ctx.statusMock).toHaveBeenCalledWith(200)
    expect(ctx.jsonMock.mock.calls[0][0]).toEqual({ ok: true })
    expect(ctx.logger.info).toHaveBeenCalledWith(
      expect.stringContaining("source=get")
    )
  })

  it("returns 200 ok:true for GET without token (idempotent / enumeration-safe)", async () => {
    ;(mockWorkflowRun as any).mockResolvedValue({
      result: {
        result: {
          status: "failed",
          reason: "invalid_token_format",
          customer_id: null,
          channels_applied: [],
        },
      },
    })

    const ctx = buildRequest({ query: {} })

    await GET(ctx.req, ctx.res)

    expect(ctx.statusMock).toHaveBeenCalledWith(200)
    expect(ctx.jsonMock.mock.calls[0][0]).toEqual({ ok: true })
  })
})
