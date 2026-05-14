/**
 * Phase 5.2.1 security hardening unit tests for `createVkIdCustomer`.
 *
 * Covers:
 * - Fix #6: email normalization (`Foo@Bar.Com` → `foo@bar.com`) is applied to
 *   customer email, emailpass entity_id, vk-id user_metadata, and stored
 *   verification metadata.
 * - Fix #1: backup `emailpass` provider_identity is created alongside the
 *   `vk-id` identity so forgot-password / reset-password flows have a target.
 * - Fix #2: `metadata.email_verified=true` + `email_verified_for` are stamped
 *   synchronously after customer creation so the `customer.created`
 *   subscriber can skip the transactional verification email.
 * - Fix #3: orphan `auth_identity` created in step 1 is cleaned up when
 *   `createCustomerAccountWorkflow` throws.
 * - Fix #9: errors thrown by this helper carry only opaque length/name
 *   hints instead of raw provider messages that could echo the email.
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

const mockCreateCustomerAccountRun = jest.fn(
  async (_input: { input: unknown }) => ({
    result: { id: "cust_created" },
  })
)

const mockUpdateCustomersRun = jest.fn(
  async (_input: { input: unknown }) => ({ result: [] })
)

jest.mock("@medusajs/medusa/core-flows", () => ({
  __esModule: true,
  createCustomerAccountWorkflow: () => ({
    run: mockCreateCustomerAccountRun,
  }),
  updateCustomersWorkflow: () => ({
    run: mockUpdateCustomersRun,
  }),
}))

// Deferred imports so the mock factory above runs before the module under
// test resolves `@medusajs/medusa/core-flows`. Static imports would otherwise
// race the mock in SWC-transformed tests.
let createVkIdCustomer: typeof import("../vk-id")["createVkIdCustomer"]
let VkIdCustomerCreationError: typeof import("../vk-id")["VkIdCustomerCreationError"]
type VkResolvedIdentity = import("../vk-id").VkResolvedIdentity

beforeAll(() => {
  const mod = require("../vk-id") as typeof import("../vk-id")
  createVkIdCustomer = mod.createVkIdCustomer
  VkIdCustomerCreationError = mod.VkIdCustomerCreationError
})

type AuthIdentityDouble = {
  createAuthIdentities: jest.Mock
  deleteAuthIdentities: jest.Mock
}

function buildIdentity(
  overrides: Partial<VkResolvedIdentity> = {}
): VkResolvedIdentity {
  return {
    provider: "vkid",
    vkUserId: "2000000777",
    vkPeerId: "2000000777",
    email: "vkuser@example.com",
    emailVerified: true,
    firstName: "VK",
    lastName: "User",
    phone: null,
    avatar: null,
    ...overrides,
  }
}

function buildContainer(authModule: AuthIdentityDouble) {
  return {
    resolve: jest.fn((key: string | symbol) => {
      const stringKey = String(key)
      if (stringKey === "auth") {
        return authModule
      }
      throw new Error(`Unexpected resolve: ${stringKey}`)
    }),
  } as any
}

function buildAuthModule(
  overrides: Partial<AuthIdentityDouble> = {}
): AuthIdentityDouble {
  return {
    createAuthIdentities: jest.fn(async () => ({
      id: "authid_created",
      provider_identities: [],
    })),
    deleteAuthIdentities: jest.fn(async () => undefined),
    ...overrides,
  }
}

describe("createVkIdCustomer (Phase 5.2 hardening)", () => {
  const VERIFIED_AT = "2026-05-13T15:00:00.000Z"

  beforeEach(() => {
    mockCreateCustomerAccountRun.mockReset()
    mockUpdateCustomersRun.mockReset()
    mockCreateCustomerAccountRun.mockImplementation(async () => ({
      result: { id: "cust_created" },
    }))
    mockUpdateCustomersRun.mockImplementation(async () => ({ result: [] }))
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("fix #6: lowercases the email in every downstream call", async () => {
    const authModule = buildAuthModule()
    const container = buildContainer(authModule)

    await createVkIdCustomer(container, {
      email: "  Foo@Bar.Com ",
      firstName: "Foo",
      lastName: "Bar",
      identity: buildIdentity({ email: "Foo@Bar.Com" }),
      verifiedAt: VERIFIED_AT,
      linkSource: "vk_id_register",
    })

    expect(authModule.createAuthIdentities).toHaveBeenCalledTimes(1)
    const providerIdentities = (
      authModule.createAuthIdentities.mock.calls[0][0] as any
    ).provider_identities as any[]

    const vkEntry = providerIdentities.find(
      (p: any) => p.provider === "vk-id"
    )
    const emailpassEntry = providerIdentities.find(
      (p: any) => p.provider === "emailpass"
    )

    expect(vkEntry?.user_metadata?.email).toBe("foo@bar.com")
    expect(emailpassEntry?.entity_id).toBe("foo@bar.com")

    const customerInput = (
      mockCreateCustomerAccountRun.mock.calls[0][0] as any
    ).input as any
    expect(customerInput.customerData.email).toBe("foo@bar.com")

    const metadataInput = (
      mockUpdateCustomersRun.mock.calls[0][0] as any
    ).input as any
    expect(metadataInput.update.metadata.email_verified_for).toBe(
      "foo@bar.com"
    )
  })

  it("fix #1: creates both vk-id and emailpass provider_identities in a single auth_identity", async () => {
    const authModule = buildAuthModule()
    const container = buildContainer(authModule)

    await createVkIdCustomer(container, {
      email: "vkuser@example.com",
      firstName: "VK",
      lastName: "User",
      identity: buildIdentity(),
      verifiedAt: VERIFIED_AT,
      linkSource: "vk_id_register",
    })

    expect(authModule.createAuthIdentities).toHaveBeenCalledTimes(1)
    const call = authModule.createAuthIdentities.mock.calls[0][0] as any
    expect(Array.isArray(call.provider_identities)).toBe(true)
    expect(call.provider_identities).toHaveLength(2)

    const providers = (call.provider_identities as any[]).map(
      (p: any) => p.provider
    )
    expect(providers).toEqual(expect.arrayContaining(["vk-id", "emailpass"]))

    const emailpass = (call.provider_identities as any[]).find(
      (p: any) => p.provider === "emailpass"
    )
    expect(emailpass.entity_id).toBe("vkuser@example.com")
    // Password stored as an opaque hash (scrypt-kdf base64 output). We only
    // assert presence + min length; the hash is not asserted byte-for-byte
    // because scrypt-kdf mixes randomness into the derivation.
    expect(typeof emailpass.provider_metadata?.password).toBe("string")
    expect(
      (emailpass.provider_metadata?.password as string).length
    ).toBeGreaterThan(20)
  })

  it("fix #2: stamps email_verified=true with source=vk_id_register after customer creation", async () => {
    const authModule = buildAuthModule()
    const container = buildContainer(authModule)

    await createVkIdCustomer(container, {
      email: "vkuser@example.com",
      firstName: null,
      lastName: null,
      identity: buildIdentity(),
      verifiedAt: VERIFIED_AT,
      linkSource: "vk_id_register",
    })

    expect(mockUpdateCustomersRun).toHaveBeenCalledTimes(1)
    const payload = (mockUpdateCustomersRun.mock.calls[0][0] as any)
      .input as any

    expect(payload.selector.id).toEqual(["cust_created"])

    const meta = payload.update.metadata
    expect(meta.email_verified).toBe(true)
    expect(meta.email_verified_at).toBe(VERIFIED_AT)
    expect(meta.email_verified_for).toBe("vkuser@example.com")

    expect(meta.email_verification).toEqual(
      expect.objectContaining({
        source: "vk_id_register",
        skipped_reason: "vk_registered",
        verified_for: "vkuser@example.com",
        verified_at: VERIFIED_AT,
      })
    )

    // The vk_link half of the metadata must survive alongside the
    // verification signals.
    expect(meta.vk_peer_id).toBe("2000000777")
    expect(meta.vk_link?.vk_user_id).toBe("2000000777")
    expect(meta.vk_link?.link_status).toBe("linked")
  })

  it("fix #3: cleans up orphan auth_identity when customer workflow fails", async () => {
    const authModule = buildAuthModule()
    const container = buildContainer(authModule)

    mockCreateCustomerAccountRun.mockImplementationOnce(async () => {
      throw new Error("customer_workflow_boom")
    })

    await expect(
      createVkIdCustomer(container, {
        email: "vkuser@example.com",
        firstName: null,
        lastName: null,
        identity: buildIdentity(),
        verifiedAt: VERIFIED_AT,
        linkSource: "vk_id_register",
      })
    ).rejects.toBeInstanceOf(VkIdCustomerCreationError)

    expect(authModule.deleteAuthIdentities).toHaveBeenCalledTimes(1)
    expect(authModule.deleteAuthIdentities).toHaveBeenCalledWith([
      "authid_created",
    ])
    // Metadata persist must not run when customer creation failed.
    expect(mockUpdateCustomersRun).not.toHaveBeenCalled()
  })

  it("fix #3 does not swallow the original error when cleanup itself fails", async () => {
    const authModule = buildAuthModule({
      deleteAuthIdentities: jest.fn(async () => {
        throw new Error("cleanup_explosion")
      }),
    })
    const container = buildContainer(authModule)
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined)

    mockCreateCustomerAccountRun.mockImplementationOnce(async () => {
      throw new Error("customer_workflow_boom")
    })

    try {
      await expect(
        createVkIdCustomer(container, {
          email: "vkuser@example.com",
          firstName: null,
          lastName: null,
          identity: buildIdentity(),
          verifiedAt: VERIFIED_AT,
          linkSource: "vk_id_register",
        })
      ).rejects.toMatchObject({
        name: "VkIdCustomerCreationError",
        code: "customer_account_creation_failed",
      })

      expect(authModule.deleteAuthIdentities).toHaveBeenCalledTimes(1)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[vk-id] orphan auth_identity cleanup failed",
        expect.objectContaining({
          auth_identity_id: "authid_created",
        })
      )
    } finally {
      consoleErrorSpy.mockRestore()
    }
  })

  it("fix #9: thrown error message never echoes the email", async () => {
    const authModule = buildAuthModule({
      createAuthIdentities: jest.fn(async () => {
        throw new Error(
          "duplicate entity_id=vkuser@example.com already exists"
        )
      }),
    })
    const container = buildContainer(authModule)

    let captured: unknown
    try {
      await createVkIdCustomer(container, {
        email: "vkuser@example.com",
        firstName: null,
        lastName: null,
        identity: buildIdentity(),
        verifiedAt: VERIFIED_AT,
        linkSource: "vk_id_register",
      })
    } catch (error) {
      captured = error
    }

    expect(captured).toBeInstanceOf(VkIdCustomerCreationError)
    const errorMessage =
      captured instanceof Error ? captured.message : String(captured)
    expect(errorMessage).not.toContain("vkuser@example.com")
    expect(errorMessage).toContain("auth_module_error")
  })

  it("throws email_required when input.email is empty or whitespace", async () => {
    const authModule = buildAuthModule()
    const container = buildContainer(authModule)

    await expect(
      createVkIdCustomer(container, {
        email: "   ",
        firstName: null,
        lastName: null,
        identity: buildIdentity({ email: null }),
        verifiedAt: VERIFIED_AT,
        linkSource: "vk_id_register",
      })
    ).rejects.toMatchObject({
      name: "VkIdCustomerCreationError",
      code: "email_required",
    })

    expect(authModule.createAuthIdentities).not.toHaveBeenCalled()
  })

  describe("Phase 5.3 email trust policy", () => {
    it("defaults to `any`: email_verified=true + skipped_reason=vk_registered (regression)", async () => {
      const authModule = buildAuthModule()
      const container = buildContainer(authModule)

      await createVkIdCustomer(container, {
        email: "vkuser@example.com",
        firstName: "VK",
        lastName: "User",
        identity: buildIdentity(),
        verifiedAt: VERIFIED_AT,
        linkSource: "vk_id_register",
      })

      const meta = (mockUpdateCustomersRun.mock.calls[0][0] as any).input.update
        .metadata

      expect(meta.email_verified).toBe(true)
      expect(meta.email_verified_at).toBe(VERIFIED_AT)
      expect(meta.email_verified_for).toBe("vkuser@example.com")
      expect(meta.email_verification).toEqual(
        expect.objectContaining({
          source: "vk_id_register",
          skipped_reason: "vk_registered",
        })
      )
    })

    it("`any` explicitly: same behaviour as unset (regression)", async () => {
      const authModule = buildAuthModule()
      const container = buildContainer(authModule)

      await createVkIdCustomer(container, {
        email: "vkuser@example.com",
        firstName: "VK",
        lastName: "User",
        identity: buildIdentity(),
        verifiedAt: VERIFIED_AT,
        linkSource: "vk_id_register",
        emailTrustPolicy: "any",
      })

      const meta = (mockUpdateCustomersRun.mock.calls[0][0] as any).input.update
        .metadata
      expect(meta.email_verified).toBe(true)
      expect(meta.email_verification?.skipped_reason).toBe("vk_registered")
    })

    it("`require_verification`: email_verified=false and no skipped_reason", async () => {
      const authModule = buildAuthModule()
      const container = buildContainer(authModule)

      await createVkIdCustomer(container, {
        email: "vkuser@example.com",
        firstName: "VK",
        lastName: "User",
        identity: buildIdentity(),
        verifiedAt: VERIFIED_AT,
        linkSource: "vk_id_register",
        emailTrustPolicy: "require_verification",
      })

      const meta = (mockUpdateCustomersRun.mock.calls[0][0] as any).input.update
        .metadata

      expect(meta.email_verified).toBe(false)
      expect(meta.email_verified_at).toBeNull()
      expect(meta.email_verified_for).toBeNull()
      expect(meta.email_verification).toBeNull()

      // VK link metadata still lands — the subscriber will just send the
      // verification email as if it were a classic emailpass registration.
      expect(meta.vk_link?.link_status).toBe("linked")
      expect(meta.vk_link?.vk_user_id).toBe("2000000777")
    })
  })
})
