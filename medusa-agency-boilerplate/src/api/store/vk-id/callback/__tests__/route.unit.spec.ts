/**
 * Unit tests for the VK ID callback intent branching introduced in Phase 5.1.
 *
 * Handlers accept an optional `deps` arg specifically so unit tests can inject
 * doubles without monkey-patching ESM modules emitted by SWC. The defaults are
 * exercised by the integration smoke; here we focus on intent semantics.
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals"

import {
  handleVkIdLinkIntent,
  handleVkIdLoginIntent,
  type VkIdLinkIntentDeps,
  type VkIdLoginIntentDeps,
} from "../route"
import {
  createVkIdLinkSession,
  createVkIdLoginSession,
  VkIdCustomerCreationError,
  type VkIdLinkSessionPayload,
  type VkResolvedIdentity,
} from "../../../../../modules/vk-id"

type Recorder = {
  redirected?: { status: number; url: string }
  setCookies: string[]
  appendedHeaders: Array<{ name: string; value: string }>
}

function buildResponse() {
  const recorder: Recorder = { setCookies: [], appendedHeaders: [] }
  const res: any = {
    redirect: jest.fn((status: number, url: string) => {
      recorder.redirected = { status, url }
    }),
    setHeader: jest.fn((name: string, value: string) => {
      if (name.toLowerCase() === "set-cookie") {
        recorder.setCookies.push(value)
      }
    }),
    appendHeader: jest.fn((name: string, value: string) => {
      recorder.appendedHeaders.push({ name, value })
      if (name.toLowerCase() === "set-cookie") {
        recorder.setCookies.push(value)
      }
    }),
  }
  return { res, recorder }
}

function buildLoginRuntime(
  loginEnabled: boolean,
  overrides: Partial<{
    registerEnabled: boolean
    registerRequestedEnabled: boolean
    emailTrustPolicy: "any" | "require_verification" | "reject"
  }> = {}
) {
  const registerRequestedEnabled = overrides.registerRequestedEnabled ?? false
  const registerEnabled =
    overrides.registerEnabled ?? (loginEnabled && registerRequestedEnabled)

  return {
    requestedEnabled: true,
    enabled: true,
    configured: true,
    loginRequestedEnabled: loginEnabled,
    loginEnabled,
    registerRequestedEnabled,
    registerEnabled,
    emailTrustPolicy: overrides.emailTrustPolicy ?? "any",
    clientId: "client",
    clientSecret: undefined,
    redirectUri: "https://studio.slavx.ru/store/vk-id/callback",
    scopes: "vkid.personal_info",
    authorizeUrl: "https://id.vk.ru/authorize",
    tokenUrl: "https://id.vk.ru/oauth2/auth",
    userInfoUrl: "https://id.vk.ru/oauth2/user_info",
    allowedStorefrontOrigins: ["https://studio.slavx.ru"],
  }
}

function buildLoginSession(): VkIdLinkSessionPayload {
  const session = createVkIdLoginSession({
    returnUrl: "https://studio.slavx.ru/ru/account",
  })
  return {
    stateId: session.stateId,
    nonce: session.nonce,
    customerId: session.customerId,
    returnUrl: session.returnUrl,
    codeVerifier: session.codeVerifier,
    expiresAt: session.expiresAt,
    linkSource: session.linkSource,
    intent: session.intent,
  }
}

function buildLinkSession(customerId: string): VkIdLinkSessionPayload {
  const session = createVkIdLinkSession({
    customerId,
    returnUrl: "https://studio.slavx.ru/ru/account/profile",
  })
  return {
    stateId: session.stateId,
    nonce: session.nonce,
    customerId: session.customerId,
    returnUrl: session.returnUrl,
    codeVerifier: session.codeVerifier,
    expiresAt: session.expiresAt,
    linkSource: session.linkSource,
    intent: session.intent,
  }
}

function buildLoginDeps(
  overrides: Partial<VkIdLoginIntentDeps> = {}
): VkIdLoginIntentDeps {
  const baseIdentity: VkResolvedIdentity = {
    provider: "vkid",
    vkUserId: "2000000777",
    vkPeerId: "2000000777",
    email: null,
    emailVerified: false,
    firstName: null,
    lastName: null,
  }

  return {
    exchangeAuthorizationCode: jest.fn(async () => ({
      access_token: "vk_at",
      user_id: "2000000777",
    })) as any,
    fetchUserInfo: jest.fn(async () => ({
      user: { user_id: "2000000777" },
    })) as any,
    resolveIdentity: jest.fn(() => baseIdentity) as any,
    findCustomersByIdentity: jest.fn(async () => []) as any,
    findIdentityCustomer: jest.fn(() => ({
      status: "not_found",
      customer: null,
    })) as any,
    issueCustomerJwt: jest.fn(async () => ({
      ok: false,
      code: "auth_identity_not_found",
    })) as any,
    ...overrides,
  }
}

function buildLinkDeps(
  overrides: Partial<VkIdLinkIntentDeps> = {}
): VkIdLinkIntentDeps {
  const baseIdentity: VkResolvedIdentity = {
    provider: "vkid",
    vkUserId: "2000000777",
    vkPeerId: "2000000777",
    email: null,
    emailVerified: false,
    firstName: null,
    lastName: null,
  }

  return {
    exchangeAuthorizationCode: jest.fn(async () => ({
      access_token: "vk_at",
      user_id: "2000000777",
    })) as any,
    fetchUserInfo: jest.fn(async () => ({
      user: { user_id: "2000000777" },
    })) as any,
    resolveIdentity: jest.fn(() => baseIdentity) as any,
    getCustomerById: jest.fn(async () => ({
      id: "cust_link_target",
      metadata: {},
    })) as any,
    persistLink: jest.fn(async () => ({
      status: "linked",
      reason: null,
      metadata: {
        vk_peer_id: "2000000777",
        vk_link: {
          provider: "vkid",
          vk_user_id: "2000000777",
          vk_peer_id: "2000000777",
          linked_at: "2026-01-01T00:00:00.000Z",
          link_source: "storefront.account.profile",
          link_status: "linked",
          last_verified_at: "2026-01-01T00:00:00.000Z",
          unlinked_at: null,
        },
      },
      conflictCustomerId: null,
      currentLink: {
        isLinked: false,
        isLegacyOnly: false,
        provider: null,
        vkUserId: null,
        vkPeerId: null,
        linkedAt: null,
        linkSource: null,
        linkStatus: null,
        lastVerifiedAt: null,
        unlinkedAt: null,
        metadata: null,
      },
    })) as any,
    ...overrides,
  }
}

function buildReq(overrides?: { logger?: { warn?: jest.Mock } }) {
  const logger = overrides?.logger
  return {
    scope: {
      resolve: jest.fn((key: string) => {
        if (logger && typeof key === "string" && key === "logger") {
          return logger as any
        }
        // Return a generic stub for QUERY and PG_CONNECTION; deps doubles are
        // wired so handlers never actually call into the resolved value.
        return {} as any
      }),
    },
  } as any
}

describe("handleVkIdLoginIntent", () => {
  it("redirects with vk_login_error=vk_id_login_disabled when login flag is off", async () => {
    const { res, recorder } = buildResponse()
    const deps = buildLoginDeps()

    await handleVkIdLoginIntent(
      buildReq(),
      res,
      {
        runtime: buildLoginRuntime(false),
        session: buildLoginSession(),
        returnUrl: new URL("https://studio.slavx.ru/ru/account"),
        code: "code",
        deviceId: "dev",
        state: "state",
      },
      deps
    )

    expect(recorder.redirected?.url).toContain(
      "vk_login_error=vk_id_login_disabled"
    )
    expect(recorder.setCookies).toHaveLength(0)
    expect(deps.exchangeAuthorizationCode).not.toHaveBeenCalled()
  })

  it("redirects with vk_login_error=not_linked when no customer owns the VK identity", async () => {
    const { res, recorder } = buildResponse()
    const deps = buildLoginDeps({
      findIdentityCustomer: jest.fn(() => ({
        status: "not_found",
        customer: null,
      })) as any,
    })

    await handleVkIdLoginIntent(
      buildReq(),
      res,
      {
        runtime: buildLoginRuntime(true),
        session: buildLoginSession(),
        returnUrl: new URL("https://studio.slavx.ru/ru/account"),
        code: "code",
        deviceId: "dev",
        state: "state",
      },
      deps
    )

    expect(recorder.redirected?.url).toContain("vk_login_error=not_linked")
    expect(recorder.setCookies).toHaveLength(0)
    expect(deps.issueCustomerJwt).not.toHaveBeenCalled()
  })

  it("treats ambiguous multi-match lookup as not_linked and logs a warning", async () => {
    const { res, recorder } = buildResponse()
    const warn = jest.fn()
    const deps = buildLoginDeps({
      findIdentityCustomer: jest.fn(() => ({
        status: "ambiguous",
        customer: null,
        matches: [{ id: "cust_a" }, { id: "cust_b" }],
      })) as any,
    })

    await handleVkIdLoginIntent(
      buildReq({ logger: { warn } }),
      res,
      {
        runtime: buildLoginRuntime(true),
        session: buildLoginSession(),
        returnUrl: new URL("https://studio.slavx.ru/ru/account"),
        code: "code",
        deviceId: "dev",
        state: "state",
      },
      deps
    )

    expect(recorder.redirected?.url).toContain("vk_login_error=not_linked")
    expect(recorder.setCookies).toHaveLength(0)
    expect(deps.issueCustomerJwt).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("ambiguous VK identity"),
      expect.objectContaining({
        match_ids: ["cust_a", "cust_b"],
      })
    )
  })

  it("issues JWT cookie and redirects to clean return URL when customer is linked", async () => {
    const { res, recorder } = buildResponse()
    const linkedCustomer = { id: "cust_linked", metadata: {} }
    const deps = buildLoginDeps({
      findIdentityCustomer: jest.fn(() => ({
        status: "ok",
        customer: linkedCustomer,
      })) as any,
      issueCustomerJwt: jest.fn(async () => ({
        ok: true,
        token: "signed.jwt.value",
        authIdentityId: "authid_1",
      })) as any,
    })

    await handleVkIdLoginIntent(
      buildReq(),
      res,
      {
        runtime: buildLoginRuntime(true),
        session: buildLoginSession(),
        returnUrl: new URL("https://studio.slavx.ru/ru/account"),
        code: "code",
        deviceId: "dev",
        state: "state",
      },
      deps
    )

    expect(deps.issueCustomerJwt).toHaveBeenCalledWith(
      expect.anything(),
      "cust_linked"
    )
    expect(recorder.setCookies).toHaveLength(1)
    expect(recorder.setCookies[0]).toContain("_medusa_jwt=signed.jwt.value")
    expect(recorder.setCookies[0]).toContain("HttpOnly")
    expect(recorder.setCookies[0]).toContain("SameSite=Lax")
    // redirect URI is https → Secure must be present regardless of NODE_ENV.
    expect(recorder.setCookies[0]).toContain("Secure")
    // The cookie must be appended, not set, so other Set-Cookie headers are
    // preserved by downstream middleware.
    expect(recorder.appendedHeaders).toHaveLength(1)
    expect(recorder.appendedHeaders[0].name.toLowerCase()).toBe("set-cookie")
    expect(recorder.redirected?.url).toBe("https://studio.slavx.ru/ru/account")
    expect(recorder.redirected?.url).not.toContain("vk_login_error")
  })

  it("omits Secure when the runtime redirect URI is plain http (local dev)", async () => {
    const { res, recorder } = buildResponse()
    const runtime = buildLoginRuntime(true)
    runtime.redirectUri = "http://localhost:9000/store/vk-id/callback"

    const deps = buildLoginDeps({
      findIdentityCustomer: jest.fn(() => ({
        status: "ok",
        customer: { id: "cust_linked", metadata: {} },
      })) as any,
      issueCustomerJwt: jest.fn(async () => ({
        ok: true,
        token: "signed.jwt.value",
        authIdentityId: "authid_1",
      })) as any,
    })

    await handleVkIdLoginIntent(
      buildReq(),
      res,
      {
        runtime,
        session: buildLoginSession(),
        returnUrl: new URL("http://localhost:8000/ru/account"),
        code: "code",
        deviceId: "dev",
        state: "state",
      },
      deps
    )

    expect(recorder.setCookies).toHaveLength(1)
    expect(recorder.setCookies[0]).not.toContain("Secure")
  })

  it("honors VK_ID_COOKIE_SECURE=true even when redirect URI is plain http", async () => {
    const ORIGINAL = process.env.VK_ID_COOKIE_SECURE
    process.env.VK_ID_COOKIE_SECURE = "true"

    try {
      const { res, recorder } = buildResponse()
      const runtime = buildLoginRuntime(true)
      runtime.redirectUri = "http://localhost:9000/store/vk-id/callback"

      const deps = buildLoginDeps({
        findIdentityCustomer: jest.fn(() => ({
          status: "ok",
          customer: { id: "cust_linked", metadata: {} },
        })) as any,
        issueCustomerJwt: jest.fn(async () => ({
          ok: true,
          token: "signed.jwt.value",
          authIdentityId: "authid_1",
        })) as any,
      })

      await handleVkIdLoginIntent(
        buildReq(),
        res,
        {
          runtime,
          session: buildLoginSession(),
          returnUrl: new URL("http://localhost:8000/ru/account"),
          code: "code",
          deviceId: "dev",
          state: "state",
        },
        deps
      )

      expect(recorder.setCookies).toHaveLength(1)
      expect(recorder.setCookies[0]).toContain("Secure")
    } finally {
      if (ORIGINAL === undefined) {
        delete process.env.VK_ID_COOKIE_SECURE
      } else {
        process.env.VK_ID_COOKIE_SECURE = ORIGINAL
      }
    }
  })

  it("honors VK_ID_COOKIE_SECURE=false even when redirect URI is https", async () => {
    const ORIGINAL = process.env.VK_ID_COOKIE_SECURE
    process.env.VK_ID_COOKIE_SECURE = "false"

    try {
      const { res, recorder } = buildResponse()
      const deps = buildLoginDeps({
        findIdentityCustomer: jest.fn(() => ({
          status: "ok",
          customer: { id: "cust_linked", metadata: {} },
        })) as any,
        issueCustomerJwt: jest.fn(async () => ({
          ok: true,
          token: "signed.jwt.value",
          authIdentityId: "authid_1",
        })) as any,
      })

      await handleVkIdLoginIntent(
        buildReq(),
        res,
        {
          runtime: buildLoginRuntime(true),
          session: buildLoginSession(),
          returnUrl: new URL("https://studio.slavx.ru/ru/account"),
          code: "code",
          deviceId: "dev",
          state: "state",
        },
        deps
      )

      expect(recorder.setCookies).toHaveLength(1)
      expect(recorder.setCookies[0]).not.toContain("Secure")
    } finally {
      if (ORIGINAL === undefined) {
        delete process.env.VK_ID_COOKIE_SECURE
      } else {
        process.env.VK_ID_COOKIE_SECURE = ORIGINAL
      }
    }
  })

  it("translates jwt issue failure into a vk_login_error redirect", async () => {
    const { res, recorder } = buildResponse()
    const deps = buildLoginDeps({
      findIdentityCustomer: jest.fn(() => ({
        status: "ok",
        customer: { id: "cust_linked", metadata: {} },
      })) as any,
      issueCustomerJwt: jest.fn(async () => ({
        ok: false,
        code: "auth_identity_not_found",
      })) as any,
    })

    await handleVkIdLoginIntent(
      buildReq(),
      res,
      {
        runtime: buildLoginRuntime(true),
        session: buildLoginSession(),
        returnUrl: new URL("https://studio.slavx.ru/ru/account"),
        code: "code",
        deviceId: "dev",
        state: "state",
      },
      deps
    )

    expect(recorder.redirected?.url).toContain(
      "vk_login_error=auth_identity_not_found"
    )
    expect(recorder.setCookies).toHaveLength(0)
  })

  it("redirects with vk_login_error=missing_vk_peer_id when identity is null", async () => {
    const { res, recorder } = buildResponse()
    const deps = buildLoginDeps({
      resolveIdentity: jest.fn(() => null) as any,
    })

    await handleVkIdLoginIntent(
      buildReq(),
      res,
      {
        runtime: buildLoginRuntime(true),
        session: buildLoginSession(),
        returnUrl: new URL("https://studio.slavx.ru/ru/account"),
        code: "code",
        deviceId: "dev",
        state: "state",
      },
      deps
    )

    expect(recorder.redirected?.url).toContain(
      "vk_login_error=missing_vk_peer_id"
    )
    expect(recorder.setCookies).toHaveLength(0)
    expect(deps.findCustomersByIdentity).not.toHaveBeenCalled()
  })
})

describe("handleVkIdLoginIntent Phase 5.2 register branch", () => {
  function buildRegisterIdentity(
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
      ...overrides,
    }
  }

  it("falls back to vk_login_error=not_linked when register flag is off (Phase 5.1 regression)", async () => {
    const { res, recorder } = buildResponse()
    const createFn = jest.fn()
    const lookupEmailFn = jest.fn()
    const deps = buildLoginDeps({
      resolveIdentity: jest.fn(() => buildRegisterIdentity()) as any,
      findIdentityCustomer: jest.fn(() => ({
        status: "not_found",
        customer: null,
      })) as any,
      lookupCustomerByEmail: lookupEmailFn as any,
      createVkIdCustomer: createFn as any,
    })

    await handleVkIdLoginIntent(
      buildReq(),
      res,
      {
        runtime: buildLoginRuntime(true, { registerRequestedEnabled: false }),
        session: buildLoginSession(),
        returnUrl: new URL("https://studio.slavx.ru/ru/account"),
        code: "code",
        deviceId: "dev",
        state: "state",
      },
      deps
    )

    expect(recorder.redirected?.url).toContain("vk_login_error=not_linked")
    expect(recorder.setCookies).toHaveLength(0)
    expect(lookupEmailFn).not.toHaveBeenCalled()
    expect(createFn).not.toHaveBeenCalled()
  })

  it("redirects with vk_login_error=email_required when VK did not return email (scope drop fallback)", async () => {
    const { res, recorder } = buildResponse()
    const createFn = jest.fn()
    const deps = buildLoginDeps({
      resolveIdentity: jest.fn(() =>
        buildRegisterIdentity({ email: null, emailVerified: false })
      ) as any,
      findIdentityCustomer: jest.fn(() => ({
        status: "not_found",
        customer: null,
      })) as any,
      lookupCustomerByEmail: jest.fn(async () => null) as any,
      createVkIdCustomer: createFn as any,
    })

    await handleVkIdLoginIntent(
      buildReq(),
      res,
      {
        runtime: buildLoginRuntime(true, { registerEnabled: true }),
        session: buildLoginSession(),
        returnUrl: new URL("https://studio.slavx.ru/ru/account"),
        code: "code",
        deviceId: "dev",
        state: "state",
      },
      deps
    )

    expect(recorder.redirected?.url).toContain(
      "vk_login_error=email_required"
    )
    expect(recorder.setCookies).toHaveLength(0)
    expect(createFn).not.toHaveBeenCalled()
  })

  it("redirects to vk-link-conflict page with pending_token when email already belongs to another customer", async () => {
    const { res, recorder } = buildResponse()
    const createFn = jest.fn()
    const lookupEmailFn = jest.fn(async () => ({
      id: "cust_existing",
      metadata: {},
    }))
    const deps = buildLoginDeps({
      resolveIdentity: jest.fn(() => buildRegisterIdentity()) as any,
      findIdentityCustomer: jest.fn(() => ({
        status: "not_found",
        customer: null,
      })) as any,
      lookupCustomerByEmail: lookupEmailFn as any,
      createVkIdCustomer: createFn as any,
    })

    const ORIGINAL_SECRET = process.env.VK_ID_SESSION_SECRET
    process.env.VK_ID_SESSION_SECRET =
      ORIGINAL_SECRET || "test-secret-for-conflict-flow"
    try {
      await handleVkIdLoginIntent(
        buildReq(),
        res,
        {
          runtime: buildLoginRuntime(true, { registerEnabled: true }),
          session: buildLoginSession(),
          returnUrl: new URL("https://studio.slavx.ru/ru/account"),
          code: "code",
          deviceId: "dev",
          state: "state",
        },
        deps
      )

      expect(recorder.redirected?.url).toContain("/ru/account/vk-link-conflict")
      expect(recorder.redirected?.url).toContain("pending_token=")
      expect(recorder.setCookies).toHaveLength(0)
      expect(lookupEmailFn).toHaveBeenCalledWith(
        expect.anything(),
        "vkuser@example.com"
      )
      expect(createFn).not.toHaveBeenCalled()
    } finally {
      if (ORIGINAL_SECRET === undefined) {
        delete process.env.VK_ID_SESSION_SECRET
      } else {
        process.env.VK_ID_SESSION_SECRET = ORIGINAL_SECRET
      }
    }
  })

  it("creates customer, issues JWT, and redirects with vk_registered=success on happy path", async () => {
    const { res, recorder } = buildResponse()
    const createFn = jest.fn(async () => ({
      customerId: "cust_created",
      authIdentityId: "authid_created",
    }))
    const lookupEmailFn = jest.fn(async () => null)
    const deps = buildLoginDeps({
      resolveIdentity: jest.fn(() => buildRegisterIdentity()) as any,
      findIdentityCustomer: jest.fn(() => ({
        status: "not_found",
        customer: null,
      })) as any,
      lookupCustomerByEmail: lookupEmailFn as any,
      createVkIdCustomer: createFn as any,
      issueCustomerJwt: jest.fn(async () => ({
        ok: true,
        token: "signed.jwt.value",
        authIdentityId: "authid_created",
      })) as any,
    })

    await handleVkIdLoginIntent(
      buildReq(),
      res,
      {
        runtime: buildLoginRuntime(true, { registerEnabled: true }),
        session: buildLoginSession(),
        returnUrl: new URL("https://studio.slavx.ru/ru/account"),
        code: "code",
        deviceId: "dev",
        state: "state",
      },
      deps
    )

    expect(createFn).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        email: "vkuser@example.com",
        firstName: "VK",
        lastName: "User",
        identity: expect.objectContaining({ vkUserId: "2000000777" }),
      })
    )
    expect(deps.issueCustomerJwt).toHaveBeenCalledWith(
      expect.anything(),
      "cust_created"
    )
    expect(recorder.setCookies).toHaveLength(1)
    expect(recorder.setCookies[0]).toContain("_medusa_jwt=signed.jwt.value")
    expect(recorder.redirected?.url).toContain("vk_registered=success")
    expect(recorder.redirected?.url).not.toContain("vk_login_error")
  })

  it("propagates customer creation failure as vk_login_error code", async () => {
    const { res, recorder } = buildResponse()
    const createFn = jest.fn(async () => {
      throw new VkIdCustomerCreationError(
        "customer_account_creation_failed"
      )
    })
    const deps = buildLoginDeps({
      resolveIdentity: jest.fn(() => buildRegisterIdentity()) as any,
      findIdentityCustomer: jest.fn(() => ({
        status: "not_found",
        customer: null,
      })) as any,
      lookupCustomerByEmail: jest.fn(async () => null) as any,
      createVkIdCustomer: createFn as any,
    })

    await handleVkIdLoginIntent(
      buildReq(),
      res,
      {
        runtime: buildLoginRuntime(true, { registerEnabled: true }),
        session: buildLoginSession(),
        returnUrl: new URL("https://studio.slavx.ru/ru/account"),
        code: "code",
        deviceId: "dev",
        state: "state",
      },
      deps
    )

    expect(recorder.redirected?.url).toContain(
      "vk_login_error=customer_account_creation_failed"
    )
    expect(recorder.setCookies).toHaveLength(0)
  })
})

describe("handleVkIdLinkIntent regression", () => {
  it("does not set the _medusa_jwt cookie for the link intent", async () => {
    const { res, recorder } = buildResponse()
    const deps = buildLinkDeps()

    await handleVkIdLinkIntent(
      buildReq(),
      res,
      {
        runtime: buildLoginRuntime(false),
        session: buildLinkSession("cust_link_target"),
        returnUrl: new URL("https://studio.slavx.ru/ru/account/profile"),
        code: "code",
        deviceId: "dev",
        state: "state",
      },
      deps
    )

    expect(recorder.setCookies).toHaveLength(0)
    expect(recorder.redirected?.url).toContain("vk_id_result=linked")
    expect(recorder.redirected?.url).toContain(
      "vk_id_customer_id=cust_link_target"
    )
    expect(deps.persistLink).toHaveBeenCalledTimes(1)
  })

  it("propagates conflict status as vk_id_result=conflict redirect", async () => {
    const { res, recorder } = buildResponse()
    const deps = buildLinkDeps({
      persistLink: jest.fn(async () => ({
        status: "conflict",
        reason: "vk_identity_linked_to_another_customer",
        metadata: null,
        conflictCustomerId: "cust_other",
        currentLink: {
          isLinked: false,
          isLegacyOnly: false,
          provider: null,
          vkUserId: null,
          vkPeerId: null,
          linkedAt: null,
          linkSource: null,
          linkStatus: null,
          lastVerifiedAt: null,
          unlinkedAt: null,
          metadata: null,
        },
      })) as any,
    })

    await handleVkIdLinkIntent(
      buildReq(),
      res,
      {
        runtime: buildLoginRuntime(false),
        session: buildLinkSession("cust_link_target"),
        returnUrl: new URL("https://studio.slavx.ru/ru/account/profile"),
        code: "code",
        deviceId: "dev",
        state: "state",
      },
      deps
    )

    expect(recorder.redirected?.url).toContain("vk_id_result=conflict")
    expect(recorder.redirected?.url).toContain(
      "vk_id_reason=vk_identity_linked_to_another_customer"
    )
  })
})
