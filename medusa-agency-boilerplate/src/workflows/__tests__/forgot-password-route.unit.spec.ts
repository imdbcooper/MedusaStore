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

jest.mock("../../workflows/send-password-reset", () => ({
  __esModule: true,
  default: () => ({
    run: mockWorkflowRun,
  }),
}))

type PostHandler = (req: unknown, res: unknown) => Promise<void>

let POST: PostHandler

beforeAll(() => {
  POST =
    require("../../api/store/customers/forgot-password/route").POST
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

describe("POST /store/customers/forgot-password", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockWorkflowRun.mockReset()
  })

  afterEach(() => {
    mockWorkflowRun.mockReset()
  })

  it("always returns 200 with ok:true when workflow reports sent", async () => {
    ;(mockWorkflowRun as any).mockResolvedValue({
      result: {
        result: {
          status: "sent",
          reason: null,
          customer_id: "cus_ok",
          recipient: "user@example.com",
          recipient_normalized: "user@example.com",
          country_code: "ru",
          provider_requested: "local",
          provider_resolved: "local",
          token_ttl_minutes: 60,
          expires_at: "2026-05-12T06:00:00.000Z",
        },
      },
    })

    const ctx = buildRequest({
      email: "user@example.com",
      country_code: "ru",
    })

    await POST(ctx.req, ctx.res)

    expect(mockWorkflowRun).toHaveBeenCalledTimes(1)
    expect(ctx.statusMock).toHaveBeenCalledWith(200)
    expect(ctx.jsonMock).toHaveBeenCalledWith({ ok: true })
  })

  it("still returns 200 with ok:true when customer not found (no user enumeration)", async () => {
    ;(mockWorkflowRun as any).mockResolvedValue({
      result: {
        result: {
          status: "skipped",
          reason: "customer_not_found",
          customer_id: null,
          recipient: null,
          recipient_normalized: "unknown@example.com",
          country_code: null,
          provider_requested: "local",
          provider_resolved: "local",
          token_ttl_minutes: 60,
          expires_at: null,
        },
      },
    })

    const ctx = buildRequest({ email: "unknown@example.com" })

    await POST(ctx.req, ctx.res)

    expect(ctx.statusMock).toHaveBeenCalledWith(200)
    expect(ctx.jsonMock).toHaveBeenCalledWith({ ok: true })
  })

  it("still returns 200 when workflow throws unexpected error", async () => {
    ;(mockWorkflowRun as any).mockRejectedValue(new Error("boom"))

    const ctx = buildRequest({ email: "user@example.com" })

    await POST(ctx.req, ctx.res)

    expect(ctx.statusMock).toHaveBeenCalledWith(200)
    expect(ctx.jsonMock).toHaveBeenCalledWith({ ok: true })
    expect(ctx.logger.error).toHaveBeenCalled()
  })

  it("passes country_code and default reason to workflow", async () => {
    ;(mockWorkflowRun as any).mockResolvedValue({
      result: { result: { status: "sent", reason: null } },
    })

    const ctx = buildRequest({ email: "a@b.co", country_code: "us" })

    await POST(ctx.req, ctx.res)

    const callInput = (mockWorkflowRun.mock.calls[0][0] as {
      input: { email: string; countryCode: string | null; reason: string }
    }).input
    expect(callInput.email).toBe("a@b.co")
    expect(callInput.countryCode).toBe("us")
    expect(callInput.reason).toBe("forgot_password")
  })
})
