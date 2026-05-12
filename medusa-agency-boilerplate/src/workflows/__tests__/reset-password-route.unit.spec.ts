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

jest.mock("../../workflows/apply-password-reset", () => ({
  __esModule: true,
  default: () => ({
    run: mockWorkflowRun,
  }),
}))

type PostHandler = (req: unknown, res: unknown) => Promise<void>

let POST: PostHandler

beforeAll(() => {
  POST = require("../../api/store/customers/reset-password/route").POST
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

describe("POST /store/customers/reset-password", () => {
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
        result: { status: "applied", customer_id: "cus_ok", email: "a@b.co" },
      },
    })

    const ctx = buildRequest({
      token: "cus_ok.raw",
      new_password: "Abcdef12",
    })

    await POST(ctx.req, ctx.res)

    expect(ctx.statusMock).toHaveBeenCalledWith(200)
    const payload = ctx.jsonMock.mock.calls[0][0] as Record<string, unknown>
    expect(payload.ok).toBe(true)
    expect(payload.customer_id).toBe("cus_ok")
  })

  it("returns generic error code for any token-related failure", async () => {
    const tokenFailures = [
      "invalid_token_format",
      "customer_not_found",
      "token_mismatch",
      "token_expired",
      "token_already_consumed",
      "email_mismatch",
      "provider_update_failed",
    ]

    for (const reason of tokenFailures) {
      jest.clearAllMocks()
      ;(mockWorkflowRun as any).mockResolvedValue({
        result: {
          result: { status: "failed", reason, customer_id: "cus_ok" },
        },
      })

      const ctx = buildRequest({
        token: "cus_ok.raw",
        new_password: "Abcdef12",
      })

      await POST(ctx.req, ctx.res)

      expect(ctx.statusMock).toHaveBeenCalledWith(400)
      const payload = ctx.jsonMock.mock.calls[0][0] as Record<string, unknown>
      expect(payload.ok).toBe(false)
      expect(payload.code).toBe("invalid_or_expired_token")
      expect(payload.detail).toBeUndefined()
    }
  })

  it("returns weak_password code with detail for strength failures", async () => {
    ;(mockWorkflowRun as any).mockResolvedValue({
      result: {
        result: {
          status: "failed",
          reason: "password_too_short",
          customer_id: "cus_ok",
        },
      },
    })

    const ctx = buildRequest({
      token: "cus_ok.raw",
      new_password: "abc",
    })

    await POST(ctx.req, ctx.res)

    expect(ctx.statusMock).toHaveBeenCalledWith(400)
    const payload = ctx.jsonMock.mock.calls[0][0] as Record<string, unknown>
    expect(payload.ok).toBe(false)
    expect(payload.code).toBe("weak_password")
    expect(payload.detail).toBe("password_too_short")
  })

  it("returns generic error code when workflow throws", async () => {
    ;(mockWorkflowRun as any).mockRejectedValue(new Error("boom"))

    const ctx = buildRequest({
      token: "cus_ok.raw",
      new_password: "Abcdef12",
    })

    await POST(ctx.req, ctx.res)

    expect(ctx.statusMock).toHaveBeenCalledWith(400)
    const payload = ctx.jsonMock.mock.calls[0][0] as Record<string, unknown>
    expect(payload.ok).toBe(false)
    expect(payload.code).toBe("invalid_or_expired_token")
  })
})
