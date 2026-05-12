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

jest.mock("../../workflows/apply-marketing-confirmation", () => ({
  __esModule: true,
  default: () => ({
    run: mockWorkflowRun,
  }),
}))

type PostHandler = (req: unknown, res: unknown) => Promise<void>

let POST: PostHandler

beforeAll(() => {
  POST = require("../../api/store/customers/marketing/confirm/route").POST
})

function buildRequest(body: Record<string, unknown>) {
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
      body,
      validatedBody: body,
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

describe("POST /store/customers/marketing/confirm", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockWorkflowRun.mockReset()
  })

  afterEach(() => {
    mockWorkflowRun.mockReset()
  })

  it("returns 200 with ok:true on confirmed", async () => {
    ;(mockWorkflowRun as any).mockResolvedValue({
      result: {
        result: {
          status: "confirmed",
          reason: null,
          customer_id: "cust_1",
          channel: "email",
        },
      },
    })

    const ctx = buildRequest({ token: "cust_1.email.raw" })

    await POST(ctx.req, ctx.res)

    expect(ctx.statusMock).toHaveBeenCalledWith(200)
    const payload = ctx.jsonMock.mock.calls[0][0] as Record<string, unknown>
    expect(payload.ok).toBe(true)
    expect(payload.customer_id).toBe("cust_1")
    expect(payload.channel).toBe("email")
  })

  it("returns 400 with generic invalid_or_expired_token on any failure", async () => {
    for (const reason of [
      "invalid_token_format",
      "customer_not_found",
      "token_mismatch",
      "token_expired",
      "channel_not_pending",
    ]) {
      ;(mockWorkflowRun as any).mockResolvedValue({
        result: {
          result: {
            status: "failed",
            reason,
            customer_id: null,
            channel: null,
          },
        },
      })

      const ctx = buildRequest({ token: "cust_1.email.raw" })
      await POST(ctx.req, ctx.res)

      expect(ctx.statusMock).toHaveBeenCalledWith(400)
      const payload = ctx.jsonMock.mock.calls[0][0] as Record<string, unknown>
      expect(payload.ok).toBe(false)
      expect(payload.code).toBe("invalid_or_expired_token")
    }
  })

  it("returns generic invalid_or_expired_token when workflow throws", async () => {
    ;(mockWorkflowRun as any).mockRejectedValue(new Error("boom"))

    const ctx = buildRequest({ token: "cust_1.email.raw" })
    await POST(ctx.req, ctx.res)

    expect(ctx.statusMock).toHaveBeenCalledWith(400)
    const payload = ctx.jsonMock.mock.calls[0][0] as Record<string, unknown>
    expect(payload.code).toBe("invalid_or_expired_token")
  })
})
