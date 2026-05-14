/**
 * Unit tests for the VK onboarding endpoint
 * (`/store/customers/me/onboarding`).
 *
 * Covers the post-fix contract:
 * - Email is REQUIRED when current customer email is a VK placeholder.
 * - Phone is OPTIONAL — onboarding completes with email only.
 * - When both email + phone are provided, both are saved and onboarding
 *   completes.
 * - When current email is already a placeholder and no email is provided,
 *   the route returns 400 `email_required`.
 * - Phone with user-friendly formatting (spaces, dashes, parens) is
 *   normalized by the schema and accepted.
 */

import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals"

// Mock core-flows so workflow load doesn't pull the full Medusa runtime.
const mockUpdateRun = jest.fn<any>(async () => ({}))
jest.mock("@medusajs/medusa/core-flows", () => ({
  __esModule: true,
  updateCustomersWorkflow: () => ({ run: mockUpdateRun }),
}))

// Mock the vk-id module the route resolves at the same relative path it
// uses in `import` (jest.mock factories must mirror the importer's
// specifier). Keep `isPlaceholderEmail` real so the placeholder rule
// is exercised by the route's branching.
const mockLookupCustomerByEmail = jest.fn<any>(async () => null)

jest.mock("../../../../../../modules/vk-id", () => {
  const actual = jest.requireActual(
    "../../../../../../modules/vk-id"
  ) as typeof import("../../../../../../modules/vk-id")
  return {
    __esModule: true,
    ...actual,
    lookupCustomerByEmail: (...args: any[]) =>
      mockLookupCustomerByEmail(...args),
  }
})

let POST: typeof import("../route")["POST"]
let StoreOnboardingSchema: typeof import("../route")["StoreOnboardingSchema"]

beforeAll(() => {
  // Deferred require so all jest.mock factories above are wired before the
  // route module loads its dependencies.
  const mod = require("../route") as typeof import("../route")
  POST = mod.POST
  StoreOnboardingSchema = mod.StoreOnboardingSchema
})

type ResRecorder = { status?: number; body?: any }

function buildResponse(): { res: any; recorder: ResRecorder } {
  const recorder: ResRecorder = {}
  const res: any = {
    status(code: number) {
      recorder.status = code
      return this
    },
    json(payload: unknown) {
      recorder.body = payload
      return this
    },
  }
  return { res, recorder }
}

const VK_USER_ID = "987654"
const PLACEHOLDER_EMAIL = `vk_${VK_USER_ID}@placeholder.internal`

function buildReq(input: {
  customerId: string
  validatedBody: { email?: string; phone?: string } | null
  customer: {
    id: string
    email: string
    phone: string | null
    metadata: Record<string, unknown> | null
  } | null
}): any {
  return {
    auth_context: {
      actor_id: input.customerId,
      actor_type: "customer",
    },
    validatedBody: input.validatedBody || {},
    scope: {
      resolve: jest.fn((key: any) => {
        const stringKey = String(key)
        if (stringKey === "logger") {
          return {
            error: jest.fn(),
            warn: jest.fn(),
            info: jest.fn(),
          }
        }
        if (stringKey === "query") {
          return {
            graph: jest.fn(async () => ({
              data: input.customer ? [input.customer] : [],
            })),
          }
        }
        if (stringKey === "pg_connection") {
          // The route only passes pgConnection through to lookupCustomerByEmail
          // (which is mocked above) — so an opaque object is sufficient.
          return { transaction: jest.fn() }
        }
        return {}
      }),
    },
  }
}

function pendingOnboardingMetadata(missing: string[]) {
  return {
    onboarding: {
      status: "pending",
      missing_fields: missing,
      placeholder_email: missing.includes("email"),
      created_at: "2026-05-14T00:00:00.000Z",
    },
  }
}

beforeEach(() => {
  mockUpdateRun.mockReset()
  mockUpdateRun.mockImplementation(async () => ({}))
  mockLookupCustomerByEmail.mockReset()
  mockLookupCustomerByEmail.mockImplementation(async () => null)
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe("StoreOnboardingSchema", () => {
  it("accepts a phone with spaces, dashes and parentheses by normalizing it", async () => {
    const parsed = await StoreOnboardingSchema.parseAsync({
      phone: "+7 (900) 123-45-67",
    })
    expect(parsed.phone).toBe("+79001234567")
  })

  it("rejects an obviously invalid phone", async () => {
    await expect(
      StoreOnboardingSchema.parseAsync({ phone: "not-a-phone" })
    ).rejects.toThrow()
  })

  it("accepts an empty body (validation deferred to route handler)", async () => {
    const parsed = await StoreOnboardingSchema.parseAsync({})
    expect(parsed.email).toBeUndefined()
    expect(parsed.phone).toBeUndefined()
  })

  it("trims email at the schema layer (case is preserved)", async () => {
    const parsed = await StoreOnboardingSchema.parseAsync({
      email: "  User@Example.com  ",
    })
    expect(parsed.email).toBe("User@Example.com")
  })
})

describe("POST /store/customers/me/onboarding", () => {
  it("returns 400 email_required when current email is placeholder and no email is provided", async () => {
    const { res, recorder } = buildResponse()
    const req = buildReq({
      customerId: "cus_1",
      validatedBody: {},
      customer: {
        id: "cus_1",
        email: PLACEHOLDER_EMAIL,
        phone: null,
        metadata: pendingOnboardingMetadata(["email", "phone"]),
      },
    })

    await POST(req, res)

    expect(recorder.status).toBe(400)
    expect(recorder.body).toMatchObject({
      ok: false,
      code: "email_required",
    })
    expect(mockUpdateRun).not.toHaveBeenCalled()
  })

  it("completes onboarding with email only (phone omitted)", async () => {
    const { res, recorder } = buildResponse()
    const req = buildReq({
      customerId: "cus_2",
      validatedBody: { email: "user@example.com" },
      customer: {
        id: "cus_2",
        email: PLACEHOLDER_EMAIL,
        phone: null,
        metadata: pendingOnboardingMetadata(["email", "phone"]),
      },
    })

    await POST(req, res)

    expect(recorder.status).toBe(200)
    expect(recorder.body).toMatchObject({
      ok: true,
      onboarding: {
        status: "complete",
        placeholder_email: false,
      },
    })
    expect(recorder.body.onboarding.missing_fields).toEqual([])
    expect(mockUpdateRun).toHaveBeenCalledTimes(1)

    const update = mockUpdateRun.mock.calls[0][0] as {
      input: {
        update: { email?: string; phone?: string; metadata?: any }
      }
    }
    expect(update.input.update.email).toBe("user@example.com")
    expect(update.input.update.phone).toBeUndefined()
    expect(update.input.update.metadata.onboarding.status).toBe("complete")
    expect(update.input.update.metadata.onboarding.missing_fields).toEqual([])
    expect(update.input.update.metadata.onboarding.placeholder_email).toBe(
      false
    )
  })

  it("completes onboarding with both email and phone", async () => {
    const { res, recorder } = buildResponse()
    const req = buildReq({
      customerId: "cus_3",
      validatedBody: {
        email: "user@example.com",
        // The schema normalizes phone before reaching the handler. We pre-
        // normalize here to mirror what `validateAndTransformBody` produces.
        phone: "+79001234567",
      },
      customer: {
        id: "cus_3",
        email: PLACEHOLDER_EMAIL,
        phone: null,
        metadata: pendingOnboardingMetadata(["email", "phone"]),
      },
    })

    await POST(req, res)

    expect(recorder.status).toBe(200)
    expect(recorder.body).toMatchObject({
      ok: true,
      onboarding: {
        status: "complete",
        placeholder_email: false,
      },
    })

    expect(mockUpdateRun).toHaveBeenCalledTimes(1)
    const update = mockUpdateRun.mock.calls[0][0] as {
      input: { update: { email?: string; phone?: string; metadata?: any } }
    }
    expect(update.input.update.email).toBe("user@example.com")
    expect(update.input.update.phone).toBe("+79001234567")
    expect(update.input.update.metadata.onboarding.status).toBe("complete")
  })

  it("returns 409 when submitted email is already used by another account", async () => {
    mockLookupCustomerByEmail.mockImplementation(async () => ({
      id: "cus_other",
      email: "user@example.com",
    }))

    const { res, recorder } = buildResponse()
    const req = buildReq({
      customerId: "cus_4",
      validatedBody: { email: "user@example.com" },
      customer: {
        id: "cus_4",
        email: PLACEHOLDER_EMAIL,
        phone: null,
        metadata: pendingOnboardingMetadata(["email", "phone"]),
      },
    })

    await POST(req, res)

    expect(recorder.status).toBe(409)
    expect(recorder.body).toMatchObject({
      ok: false,
      code: "email_already_exists",
    })
    expect(mockUpdateRun).not.toHaveBeenCalled()
  })

  it("returns 401 when the request is unauthenticated", async () => {
    const { res, recorder } = buildResponse()
    const req = buildReq({
      customerId: "",
      validatedBody: { email: "user@example.com" },
      customer: null,
    })

    await POST(req, res)

    expect(recorder.status).toBe(401)
    expect(recorder.body).toMatchObject({
      ok: false,
      code: "customer_auth_required",
    })
  })

  it("returns 400 onboarding_already_complete when onboarding is already done", async () => {
    const { res, recorder } = buildResponse()
    const req = buildReq({
      customerId: "cus_5",
      validatedBody: { email: "user@example.com" },
      customer: {
        id: "cus_5",
        email: "user@example.com",
        phone: null,
        metadata: {
          onboarding: {
            status: "complete",
            missing_fields: [],
            placeholder_email: false,
            completed_at: "2026-05-14T00:00:00.000Z",
          },
        },
      },
    })

    await POST(req, res)

    expect(recorder.status).toBe(400)
    expect(recorder.body).toMatchObject({
      ok: false,
      code: "onboarding_already_complete",
    })
  })
})
