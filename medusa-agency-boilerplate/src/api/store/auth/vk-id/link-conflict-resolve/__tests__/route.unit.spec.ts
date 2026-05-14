/**
 * Phase 5.3 unit tests for the VK ID conflict-resolve backend route.
 *
 * Covers:
 * - Happy path: valid pending token + valid password → 200 with JWT.
 * - Invalid password: auth module returns `success: false` → 401.
 * - Expired pending token → 400 with `pending_token_expired`.
 * - Email mismatch between submitted form and pending token → 400.
 * - VK ID register disabled → 409 gate.
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

// Core-flows must be mocked because the real module registers workflows at
// load time and cannot be evaluated twice within the same test run.
jest.mock("@medusajs/medusa/core-flows", () => ({
  __esModule: true,
  createCustomerAccountWorkflow: () => ({ run: jest.fn() }),
  updateCustomersWorkflow: () => ({ run: jest.fn() }),
}))

jest.mock("@medusajs/medusa/api/auth/utils/generate-jwt-token", () => ({
  __esModule: true,
  generateJwtTokenForAuthIdentity: jest.fn(async () => "mock.jwt.token"),
}))

// Helpers the route imports from `../../../../../../modules/vk-id`. We mock
// only the two functions the route calls directly: `lookupCustomerByEmail`
// and `persistVkIdCustomerLinkWithOwnershipGuard`. The pure helpers
// (`verifyVkIdPendingLinkToken`, `createVkIdPendingLinkToken`, etc.) come
// from the real module so the signed-token round-trip remains realistic.
const mockLookupCustomerByEmail = jest.fn<any>(async () => null)
const mockPersistLink = jest.fn<any>(async () => ({
  status: "linked" as const,
  reason: null,
  metadata: {},
  conflictCustomerId: null,
  currentLink: {},
}))

jest.mock("../../../../../../modules/vk-id", () => {
  const actual = jest.requireActual(
    "../../../../../../modules/vk-id"
  ) as typeof import("../../../../../../modules/vk-id")

  return {
    __esModule: true,
    ...actual,
    lookupCustomerByEmail: (...args: any[]) =>
      mockLookupCustomerByEmail(...args),
    persistVkIdCustomerLinkWithOwnershipGuard: (...args: any[]) =>
      mockPersistLink(...args),
  }
})

const mockIssueJwt = jest.fn<any>(async () => ({
  ok: true,
  token: "mock.jwt.token",
  authIdentityId: "authid_existing",
}))

jest.mock("../../../../../../modules/vk-id-auth", () => ({
  __esModule: true,
  issueCustomerJwtForVkIdentity: (...args: any[]) => mockIssueJwt(...args),
}))

const ORIGINAL_SECRET = process.env.VK_ID_SESSION_SECRET
const ORIGINAL_ENABLED = process.env.VK_ID_ENABLED
const ORIGINAL_LOGIN_ENABLED = process.env.VK_ID_LOGIN_ENABLED
const ORIGINAL_REGISTER_ENABLED = process.env.VK_ID_REGISTER_ENABLED
const ORIGINAL_CLIENT_ID = process.env.VK_ID_CLIENT_ID
const ORIGINAL_REDIRECT_URI = process.env.VK_ID_REDIRECT_URI
const ORIGINAL_RETURN_ORIGINS = process.env.VK_ID_STOREFRONT_RETURN_ORIGINS

function setEnv(overrides: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
}

function restoreEnv() {
  setEnv({
    VK_ID_SESSION_SECRET: ORIGINAL_SECRET,
    VK_ID_ENABLED: ORIGINAL_ENABLED,
    VK_ID_LOGIN_ENABLED: ORIGINAL_LOGIN_ENABLED,
    VK_ID_REGISTER_ENABLED: ORIGINAL_REGISTER_ENABLED,
    VK_ID_CLIENT_ID: ORIGINAL_CLIENT_ID,
    VK_ID_REDIRECT_URI: ORIGINAL_REDIRECT_URI,
    VK_ID_STOREFRONT_RETURN_ORIGINS: ORIGINAL_RETURN_ORIGINS,
  })
}

function enableVkIdRegister() {
  setEnv({
    VK_ID_SESSION_SECRET: "phase-5-3-route-unit-test-secret",
    VK_ID_ENABLED: "true",
    VK_ID_LOGIN_ENABLED: "true",
    VK_ID_REGISTER_ENABLED: "true",
    VK_ID_CLIENT_ID: "test_client",
    VK_ID_REDIRECT_URI: "https://studio.slavx.ru/store/vk-id/callback",
    VK_ID_STOREFRONT_RETURN_ORIGINS: "https://studio.slavx.ru",
  })
}

let POST: typeof import("../route")["POST"]
let createVkIdPendingLinkToken: typeof import("../../../../../../modules/vk-id")["createVkIdPendingLinkToken"]

beforeAll(() => {
  enableVkIdRegister()
  const actual = jest.requireActual(
    "../../../../../../modules/vk-id"
  ) as typeof import("../../../../../../modules/vk-id")
  createVkIdPendingLinkToken = actual.createVkIdPendingLinkToken
  POST = (require("../route") as typeof import("../route")).POST
})

beforeEach(() => {
  enableVkIdRegister()
  mockLookupCustomerByEmail.mockReset()
  mockLookupCustomerByEmail.mockImplementation(async () => null)
  mockPersistLink.mockReset()
  mockPersistLink.mockImplementation(async () => ({
    status: "linked" as const,
    reason: null,
    metadata: {},
    conflictCustomerId: null,
    currentLink: {},
  }))
  mockIssueJwt.mockReset()
  mockIssueJwt.mockImplementation(async () => ({
    ok: true,
    token: "mock.jwt.token",
    authIdentityId: "authid_existing",
  }))
})

afterEach(() => {
  jest.restoreAllMocks()
  restoreEnv()
})

type JsonRecorder = { status?: number; body?: unknown }

function buildResponse(): { res: any; recorder: JsonRecorder } {
  const recorder: JsonRecorder = {}
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

function buildReq(input: {
  email: string
  password: string
  pending_token: string
  authenticate: jest.Mock<any>
}): any {
  const authModule = { authenticate: input.authenticate }
  return {
    validatedBody: {
      email: input.email,
      password: input.password,
      pending_token: input.pending_token,
    },
    scope: {
      resolve: jest.fn((key: any) => {
        const stringKey = String(key)
        if (stringKey === "auth") return authModule
        if (stringKey === "pg_connection") return { transaction: jest.fn() }
        if (stringKey === "configModule") return { projectConfig: {} }
        if (stringKey === "logger") return { warn: jest.fn() }
        return {}
      }),
    },
    headers: { origin: "https://studio.slavx.ru" },
  }
}

function mintValidToken(overrides: {
  email?: string
  firstName?: string | null
  lastName?: string | null
} = {}) {
  return createVkIdPendingLinkToken({
    identity: {
      provider: "vkid",
      vkUserId: "2000000111",
      vkPeerId: "2000000111",
      email: overrides.email ?? "existing@example.com",
      emailVerified: true,
      firstName: overrides.firstName ?? "VK",
      lastName: overrides.lastName ?? "User",
      phone: null,
      avatar: null,
    },
    ttlMinutes: 10,
  })
}

describe("POST /store/auth/vk-id/link-conflict-resolve (Phase 5.3)", () => {
  it("happy path: links VK, issues JWT, returns redirect_to", async () => {
    const { token } = mintValidToken()
    mockLookupCustomerByEmail.mockImplementation(async () => ({
      id: "cust_existing",
      metadata: {},
    }))
    const authenticate = jest.fn(async () => ({ success: true })) as any
    const { res, recorder } = buildResponse()

    await POST(
      buildReq({
        email: "existing@example.com",
        password: "correct-password",
        pending_token: token,
        authenticate,
      }),
      res
    )

    expect(recorder.status).toBe(200)
    expect(recorder.body).toMatchObject({
      ok: true,
      token: "mock.jwt.token",
      customer_id: "cust_existing",
    })
    expect(
      typeof (recorder.body as { redirect_to?: string })?.redirect_to
    ).toBe("string")
    expect(authenticate).toHaveBeenCalledWith("emailpass", expect.any(Object))
    expect(mockPersistLink).toHaveBeenCalledTimes(1)
  })

  it("invalid password: returns 401 invalid_password and never links", async () => {
    const { token } = mintValidToken()
    mockLookupCustomerByEmail.mockImplementation(async () => ({
      id: "cust_existing",
      metadata: {},
    }))
    const authenticate = jest.fn(async () => ({ success: false })) as any
    const { res, recorder } = buildResponse()

    await POST(
      buildReq({
        email: "existing@example.com",
        password: "bad-password",
        pending_token: token,
        authenticate,
      }),
      res
    )

    expect(recorder.status).toBe(401)
    expect(recorder.body).toMatchObject({ ok: false, code: "invalid_password" })
    expect(mockPersistLink).not.toHaveBeenCalled()
  })

  it("expired pending token: returns 400 pending_token_expired", async () => {
    const expired = createVkIdPendingLinkToken({
      identity: {
        provider: "vkid",
        vkUserId: "2000000111",
        vkPeerId: "2000000111",
        email: "existing@example.com",
        emailVerified: true,
        firstName: null,
        lastName: null,
        phone: null,
        avatar: null,
      },
      ttlMinutes: 1,
      now: new Date(Date.now() - 1000 * 60 * 60),
    })
    const authenticate = jest.fn() as any
    const { res, recorder } = buildResponse()

    await POST(
      buildReq({
        email: "existing@example.com",
        password: "any-password",
        pending_token: expired.token,
        authenticate,
      }),
      res
    )

    expect(recorder.status).toBe(400)
    expect(recorder.body).toMatchObject({
      ok: false,
      code: "pending_token_expired",
    })
    expect(authenticate).not.toHaveBeenCalled()
    expect(mockLookupCustomerByEmail).not.toHaveBeenCalled()
  })

  it("email mismatch: 400 email_mismatch without calling authenticate", async () => {
    const { token } = mintValidToken({ email: "alice@example.com" })
    const authenticate = jest.fn() as any
    const { res, recorder } = buildResponse()

    await POST(
      buildReq({
        email: "bob@example.com",
        password: "any",
        pending_token: token,
        authenticate,
      }),
      res
    )

    expect(recorder.status).toBe(400)
    expect(recorder.body).toMatchObject({ ok: false, code: "email_mismatch" })
    expect(authenticate).not.toHaveBeenCalled()
  })

  it("vk_id_register_disabled when VK_ID_REGISTER_ENABLED=false", async () => {
    const { token } = mintValidToken()
    const authenticate = jest.fn() as any
    const { res, recorder } = buildResponse()

    setEnv({ VK_ID_REGISTER_ENABLED: "false" })

    await POST(
      buildReq({
        email: "existing@example.com",
        password: "any",
        pending_token: token,
        authenticate,
      }),
      res
    )

    expect(recorder.status).toBe(409)
    expect(recorder.body).toMatchObject({
      ok: false,
      code: "vk_id_register_disabled",
    })
  })
})
