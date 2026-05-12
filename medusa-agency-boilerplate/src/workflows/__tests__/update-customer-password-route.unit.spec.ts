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

jest.mock("../../workflows/update-customer-password", () => ({
  __esModule: true,
  default: () => ({
    run: mockWorkflowRun,
  }),
}))

type PostHandler = (req: unknown, res: unknown) => Promise<void>

let POST: PostHandler

beforeAll(() => {
  POST = require("../../api/store/customers/me/password/route").POST
})

function buildRequest(options: {
  actorId: string | null
  body?: Record<string, unknown>
}) {
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

describe("POST /store/customers/me/password", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockWorkflowRun.mockReset()
  })

  afterEach(() => {
    mockWorkflowRun.mockReset()
  })

  it("returns 401 when actor_id is missing", async () => {
    const ctx = buildRequest({ actorId: null })

    await POST(ctx.req, ctx.res)

    expect(ctx.statusMock).toHaveBeenCalledWith(401)
    expect(mockWorkflowRun).not.toHaveBeenCalled()
  })

  it("returns 200 on updated success", async () => {
    ;(mockWorkflowRun as any).mockResolvedValue({
      result: {
        result: { status: "updated", customer_id: "cus_ok", email: "a@b.co" },
      },
    })

    const ctx = buildRequest({
      actorId: "cus_ok",
      body: {
        current_password: "oldPass123",
        new_password: "Abcdef12",
      },
    })

    await POST(ctx.req, ctx.res)

    expect(mockWorkflowRun).toHaveBeenCalledTimes(1)
    const callInput = (mockWorkflowRun.mock.calls[0][0] as {
      input: {
        customerId: string
        currentPassword: string
        newPassword: string
      }
    }).input
    expect(callInput.customerId).toBe("cus_ok")
    expect(callInput.currentPassword).toBe("oldPass123")
    expect(callInput.newPassword).toBe("Abcdef12")

    expect(ctx.statusMock).toHaveBeenCalledWith(200)
    const payload = ctx.jsonMock.mock.calls[0][0] as Record<string, unknown>
    expect(payload.ok).toBe(true)
    expect(payload.customer_id).toBe("cus_ok")
  })

  it("returns invalid_current_password 400 when workflow refuses", async () => {
    ;(mockWorkflowRun as any).mockResolvedValue({
      result: {
        result: {
          status: "failed",
          reason: "invalid_current_password",
          customer_id: "cus_ok",
        },
      },
    })

    const ctx = buildRequest({
      actorId: "cus_ok",
      body: { current_password: "wrong", new_password: "Abcdef12" },
    })

    await POST(ctx.req, ctx.res)

    expect(ctx.statusMock).toHaveBeenCalledWith(400)
    const payload = ctx.jsonMock.mock.calls[0][0] as Record<string, unknown>
    expect(payload.code).toBe("invalid_current_password")
  })

  it("returns weak_password 400 with detail", async () => {
    ;(mockWorkflowRun as any).mockResolvedValue({
      result: {
        result: {
          status: "failed",
          reason: "password_missing_digit",
          customer_id: "cus_ok",
        },
      },
    })

    const ctx = buildRequest({
      actorId: "cus_ok",
      body: { current_password: "oldPass123", new_password: "abcdefgh" },
    })

    await POST(ctx.req, ctx.res)

    expect(ctx.statusMock).toHaveBeenCalledWith(400)
    const payload = ctx.jsonMock.mock.calls[0][0] as Record<string, unknown>
    expect(payload.code).toBe("weak_password")
    expect(payload.detail).toBe("password_missing_digit")
  })

  it("returns same_password 400", async () => {
    ;(mockWorkflowRun as any).mockResolvedValue({
      result: {
        result: {
          status: "failed",
          reason: "same_password",
          customer_id: "cus_ok",
        },
      },
    })

    const ctx = buildRequest({
      actorId: "cus_ok",
      body: { current_password: "same123A", new_password: "same123A" },
    })

    await POST(ctx.req, ctx.res)

    expect(ctx.statusMock).toHaveBeenCalledWith(400)
    const payload = ctx.jsonMock.mock.calls[0][0] as Record<string, unknown>
    expect(payload.code).toBe("same_password")
  })

  it("returns 404 when workflow reports customer_not_found", async () => {
    ;(mockWorkflowRun as any).mockResolvedValue({
      result: {
        result: {
          status: "failed",
          reason: "customer_not_found",
          customer_id: "cus_ok",
        },
      },
    })

    const ctx = buildRequest({
      actorId: "cus_ok",
      body: { current_password: "a", new_password: "Abcdef12" },
    })

    await POST(ctx.req, ctx.res)

    expect(ctx.statusMock).toHaveBeenCalledWith(404)
    const payload = ctx.jsonMock.mock.calls[0][0] as Record<string, unknown>
    expect(payload.code).toBe("customer_not_found")
  })

  it("returns password_update_failed on unexpected workflow error", async () => {
    ;(mockWorkflowRun as any).mockRejectedValue(new Error("boom"))

    const ctx = buildRequest({
      actorId: "cus_ok",
      body: { current_password: "old", new_password: "Abcdef12" },
    })

    await POST(ctx.req, ctx.res)

    expect(ctx.statusMock).toHaveBeenCalledWith(400)
    const payload = ctx.jsonMock.mock.calls[0][0] as Record<string, unknown>
    expect(payload.code).toBe("password_update_failed")
  })
})
