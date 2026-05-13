import { afterEach, describe, expect, it, jest } from "@jest/globals"
import {
  buildVkIdLoginErrorReturnUrl,
  buildVkIdResultReturnUrl,
  createVkIdLinkSession,
  createVkIdLoginSession,
  findVkIdCustomersByIdentity,
  findVkIdentityCustomer,
  getVkIdRuntime,
  getVkIdSessionIntent,
  persistVkIdCustomerLinkWithOwnershipGuard,
  planVkIdLinkMutation,
  planVkIdUnlinkMutation,
  readVkIdLinkSession,
  resolveAllowedVkIdLoginReturnUrl,
  resolveAllowedVkIdReturnUrl,
  resolveVkLinkState,
  type VkLinkableCustomerRecord,
  type VkResolvedIdentity,
} from "../../modules/vk-id"

const VERIFIED_AT = "2026-04-18T15:00:00.000Z"
const UNLINKED_AT = "2026-04-18T16:00:00.000Z"

function buildIdentity(
  overrides: Partial<VkResolvedIdentity> = {}
): VkResolvedIdentity {
  return {
    provider: "vkid",
    vkUserId: "2000000001",
    vkPeerId: "2000000001",
    ...overrides,
  }
}

function buildCustomer(
  id: string,
  metadata?: Record<string, unknown>
): VkLinkableCustomerRecord {
  return {
    id,
    metadata,
  }
}

describe("VK ID metadata dual-write semantics", () => {
  it("writes legacy vk_peer_id and structured vk_link on first successful link", () => {
    const mutation = planVkIdLinkMutation({
      currentCustomerId: "cust_1",
      currentMetadata: {},
      customers: [buildCustomer("cust_1", {})],
      identity: buildIdentity(),
      verifiedAt: VERIFIED_AT,
      linkSource: "storefront.account.profile",
    })

    expect(mutation.status).toBe("linked")
    expect(mutation.reason).toBeNull()
    expect(mutation.metadata).not.toBeNull()
    expect(mutation.metadata?.vk_peer_id).toBe("2000000001")
    expect(mutation.metadata?.vk_link).toEqual({
      provider: "vkid",
      vk_user_id: "2000000001",
      vk_peer_id: "2000000001",
      linked_at: VERIFIED_AT,
      link_source: "storefront.account.profile",
      link_status: "linked",
      last_verified_at: VERIFIED_AT,
      unlinked_at: null,
    })
  })

  it("returns idempotent success for same customer plus same identity", () => {
    const currentMetadata = {
      vk_peer_id: "2000000001",
      vk_link: {
        provider: "vkid",
        vk_user_id: "2000000001",
        vk_peer_id: "2000000001",
        linked_at: "2026-04-18T14:00:00.000Z",
        link_source: "storefront.account.profile",
        link_status: "linked",
        last_verified_at: "2026-04-18T14:00:00.000Z",
        unlinked_at: null,
      },
    }

    const mutation = planVkIdLinkMutation({
      currentCustomerId: "cust_1",
      currentMetadata,
      customers: [buildCustomer("cust_1", currentMetadata)],
      identity: buildIdentity(),
      verifiedAt: VERIFIED_AT,
      linkSource: "storefront.account.profile",
    })

    expect(mutation.status).toBe("already_linked")
    expect(mutation.reason).toBeNull()
    expect(mutation.metadata?.vk_peer_id).toBe("2000000001")
    expect((mutation.metadata?.vk_link as Record<string, unknown>).linked_at).toBe(
      "2026-04-18T14:00:00.000Z"
    )
    expect(
      (mutation.metadata?.vk_link as Record<string, unknown>).last_verified_at
    ).toBe(VERIFIED_AT)
  })

  it("rejects when same customer is already linked to another VK identity", () => {
    const currentMetadata = {
      vk_peer_id: "2000000005",
      vk_link: {
        provider: "vkid",
        vk_user_id: "2000000005",
        vk_peer_id: "2000000005",
        linked_at: "2026-04-18T14:00:00.000Z",
        link_source: "storefront.account.profile",
        link_status: "linked",
        last_verified_at: "2026-04-18T14:00:00.000Z",
        unlinked_at: null,
      },
    }

    const mutation = planVkIdLinkMutation({
      currentCustomerId: "cust_1",
      currentMetadata,
      customers: [buildCustomer("cust_1", currentMetadata)],
      identity: buildIdentity(),
      verifiedAt: VERIFIED_AT,
      linkSource: "storefront.account.profile",
    })

    expect(mutation.status).toBe("conflict")
    expect(mutation.reason).toBe("customer_linked_to_different_vk_identity")
    expect(mutation.metadata).toBeNull()
  })

  it("rejects when VK identity is already linked to another customer", () => {
    const otherCustomerMetadata = {
      vk_peer_id: "2000000001",
      vk_link: {
        provider: "vkid",
        vk_user_id: "2000000001",
        vk_peer_id: "2000000001",
        linked_at: "2026-04-18T13:00:00.000Z",
        link_source: "storefront.account.profile",
        link_status: "linked",
        last_verified_at: "2026-04-18T13:00:00.000Z",
        unlinked_at: null,
      },
    }

    const mutation = planVkIdLinkMutation({
      currentCustomerId: "cust_1",
      currentMetadata: {},
      customers: [
        buildCustomer("cust_1", {}),
        buildCustomer("cust_2", otherCustomerMetadata),
      ],
      identity: buildIdentity(),
      verifiedAt: VERIFIED_AT,
      linkSource: "storefront.account.profile",
    })

    expect(mutation.status).toBe("conflict")
    expect(mutation.reason).toBe("vk_identity_linked_to_another_customer")
    expect(mutation.conflictCustomerId).toBe("cust_2")
    expect(mutation.metadata).toBeNull()
  })

  it("unlinks with dual-write cleanup and keeps structured audit trail", () => {
    const currentMetadata = {
      vk_peer_id: "2000000001",
      vk_link: {
        provider: "vkid",
        vk_user_id: "2000000001",
        vk_peer_id: "2000000001",
        linked_at: "2026-04-18T14:00:00.000Z",
        link_source: "storefront.account.profile",
        link_status: "linked",
        last_verified_at: VERIFIED_AT,
        unlinked_at: null,
      },
    }

    const mutation = planVkIdUnlinkMutation({
      currentMetadata,
      unlinkedAt: UNLINKED_AT,
    })

    expect(mutation.status).toBe("unlinked")
    expect(mutation.reason).toBeNull()
    expect(mutation.metadata?.vk_peer_id).toBeUndefined()
    expect(mutation.metadata?.vk_link).toEqual({
      provider: "vkid",
      vk_user_id: "2000000001",
      vk_peer_id: "2000000001",
      linked_at: "2026-04-18T14:00:00.000Z",
      link_source: "storefront.account.profile",
      link_status: "unlinked",
      last_verified_at: VERIFIED_AT,
      unlinked_at: UNLINKED_AT,
    })
    expect(resolveVkLinkState(mutation.metadata).isLinked).toBe(false)
  })

  it("treats already-unlinked as idempotent success", () => {
    const mutation = planVkIdUnlinkMutation({
      currentMetadata: {
        vk_link: {
          provider: "vkid",
          vk_user_id: "2000000001",
          vk_peer_id: "2000000001",
          linked_at: "2026-04-18T14:00:00.000Z",
          link_source: "storefront.account.profile",
          link_status: "unlinked",
          last_verified_at: VERIFIED_AT,
          unlinked_at: UNLINKED_AT,
        },
      },
      unlinkedAt: UNLINKED_AT,
    })

    expect(mutation.status).toBe("already_unlinked")
    expect(mutation.reason).toBe("already_unlinked")
    expect(mutation.metadata).toBeNull()
  })

  it("builds profile return url with stable callback result params", () => {
    const url = buildVkIdResultReturnUrl({
      returnUrl: "http://localhost:8000/ru/account/profile",
      result: "linked",
      reason: null,
      customerId: "cust_1",
    })

    expect(url.toString()).toBe(
      "http://localhost:8000/ru/account/profile?vk_id_result=linked&vk_id_customer_id=cust_1"
    )
  })
  it("serializes competing ownership claims behind persistence-level guard", async () => {
    const identity = buildIdentity()
    const customerA = buildCustomer("cust_1", {})
    const customerB = buildCustomer("cust_2", {})
    const state = {
      cust_1: customerA,
      cust_2: customerB,
    } as Record<string, VkLinkableCustomerRecord>
    const transactionSteps: string[] = []
    let releaseFirstLock!: () => void
    let resolveFirstTransactionCommitted!: () => void
    let firstLockReleased = false
    const firstTransactionCommitted = new Promise<void>((resolve) => {
      resolveFirstTransactionCommitted = resolve
    })

    const pgConnection = {
      transaction: async <T>(callback: (trx: any) => Promise<T>) => {
        const trx = {
          raw: jest.fn(async (sql: string, bindings?: unknown[]) => {
            if (sql.includes("pg_advisory_xact_lock")) {
              const customerId = transactionSteps.filter((step) => step.startsWith("lock:")).length === 0
                ? "cust_1"
                : "cust_2"

              transactionSteps.push(`lock:${customerId}`)

              if (customerId === "cust_1") {
                await new Promise<void>((resolve) => {
                  releaseFirstLock = () => {
                    firstLockReleased = true
                    resolve()
                  }
                })
              } else {
                await firstTransactionCommitted
                expect(firstLockReleased).toBe(true)
              }

              return { rows: [] }
            }

            if (sql.includes("from customer") && sql.includes("where id = ?")) {
              const customerId = String(bindings?.[0])
              transactionSteps.push(`select:${customerId}`)
              return {
                rows: state[customerId] ? [{ ...state[customerId] }] : [],
              }
            }

            if (sql.includes("from customer") && sql.includes("id <> ?")) {
              const currentCustomerId = String(bindings?.[0])
              transactionSteps.push(`scan:${currentCustomerId}`)
              return {
                rows: Object.values(state)
                  .filter((customer) => customer.id !== currentCustomerId)
                  .filter((customer) => resolveVkLinkState(customer.metadata).isLinked)
                  .map((customer) => ({ ...customer })),
              }
            }

            if (sql.includes("update customer")) {
              const metadata = JSON.parse(String(bindings?.[0]))
              const customerId = String(bindings?.[1])
              transactionSteps.push(`update:${customerId}`)
              state[customerId] = {
                ...state[customerId],
                metadata,
              }

              if (customerId === "cust_1") {
                resolveFirstTransactionCommitted()
              }

              return { rows: [] }
            }

            throw new Error(`Unexpected SQL in VK ID test double: ${sql}`)
          }),
        }

        return callback(trx)
      },
    }

    const firstPromise = persistVkIdCustomerLinkWithOwnershipGuard(pgConnection, {
      customerId: "cust_1",
      identity,
      verifiedAt: VERIFIED_AT,
      linkSource: "storefront.account.profile",
    })

    await Promise.resolve()
    await Promise.resolve()

    const secondPromise = persistVkIdCustomerLinkWithOwnershipGuard(pgConnection, {
      customerId: "cust_2",
      identity,
      verifiedAt: VERIFIED_AT,
      linkSource: "storefront.account.profile",
    })

    await Promise.resolve()
    await Promise.resolve()

    expect(transactionSteps).toEqual(["lock:cust_1", "lock:cust_2"])
    expect(transactionSteps).not.toContain("select:cust_2")
    expect(typeof releaseFirstLock).toBe("function")

    releaseFirstLock()

    const [firstMutation, secondMutation] = await Promise.all([
      firstPromise,
      secondPromise,
    ])

    expect(firstMutation.status).toBe("linked")
    expect(secondMutation.status).toBe("conflict")
    expect(secondMutation.reason).toBe("vk_identity_linked_to_another_customer")
    expect(secondMutation.conflictCustomerId).toBe("cust_1")
    expect(resolveVkLinkState(state.cust_1.metadata).vkPeerId).toBe("2000000001")
    expect(resolveVkLinkState(state.cust_2.metadata).isLinked).toBe(false)
    expect(transactionSteps).toEqual([
      "lock:cust_1",
      "lock:cust_2",
      "select:cust_1",
      "scan:cust_1",
      "update:cust_1",
      "select:cust_2",
      "scan:cust_2",
    ])
  })
})

describe("VK ID auth intent state semantics", () => {
  it("createVkIdLinkSession defaults to intent=link and round-trips through readVkIdLinkSession", () => {
    const session = createVkIdLinkSession({
      customerId: "cust_link_1",
      returnUrl: "http://localhost:8000/ru/account/profile",
    })

    expect(session.intent).toBe("link")
    expect(session.linkSource).toBe("storefront.account.profile")

    const parsed = readVkIdLinkSession(session.state)

    expect(parsed?.intent).toBe("link")
    expect(parsed?.customerId).toBe("cust_link_1")
    expect(getVkIdSessionIntent(parsed)).toBe("link")
  })

  it("createVkIdLoginSession pins intent=login and uses login source default", () => {
    const session = createVkIdLoginSession({
      returnUrl: "http://localhost:8000/ru/account",
    })

    expect(session.intent).toBe("login")
    expect(session.customerId).toBe("")
    expect(session.linkSource).toBe("storefront.account.login")

    const parsed = readVkIdLinkSession(session.state)

    expect(parsed?.intent).toBe("login")
    expect(getVkIdSessionIntent(parsed)).toBe("login")
  })

  it("getVkIdSessionIntent returns 'link' for legacy sessions without intent field", () => {
    expect(getVkIdSessionIntent(null)).toBe("link")
    expect(
      getVkIdSessionIntent({
        stateId: "s",
        nonce: "n",
        customerId: "cust_legacy",
        returnUrl: "http://localhost:8000/ru/account/profile",
        codeVerifier: "v",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        linkSource: "storefront.account.profile",
        // intent omitted, simulating a session signed before Phase 5.1
      })
    ).toBe("link")
  })

  it("readVkIdLinkSession rejects expired states regardless of intent", () => {
    const session = createVkIdLoginSession({
      returnUrl: "http://localhost:8000/ru/account",
      ttlSeconds: -1,
    })

    expect(readVkIdLinkSession(session.state)).toBeNull()
  })

  it("readVkIdLinkSession rejects expired login states explicitly (expiresAt in the past)", () => {
    const session = createVkIdLoginSession({
      returnUrl: "http://localhost:8000/ru/account",
      ttlSeconds: -60,
    })

    expect(Date.parse(session.expiresAt)).toBeLessThan(Date.now())
    expect(readVkIdLinkSession(session.state)).toBeNull()
  })
})

describe("VK ID login lookup helpers", () => {
  function buildIdentityFor(vkPeerId: string): VkResolvedIdentity {
    return {
      provider: "vkid",
      vkUserId: vkPeerId,
      vkPeerId,
    }
  }

  function linkedCustomer(
    id: string,
    vkPeerId = "2000000777"
  ): VkLinkableCustomerRecord {
    return {
      id,
      metadata: {
        vk_peer_id: vkPeerId,
        vk_link: {
          provider: "vkid",
          vk_user_id: vkPeerId,
          vk_peer_id: vkPeerId,
          linked_at: "2026-01-01T00:00:00.000Z",
          link_source: "storefront.account.profile",
          link_status: "linked",
          last_verified_at: "2026-01-01T00:00:00.000Z",
          unlinked_at: null,
        },
      },
    }
  }

  it("findVkIdentityCustomer returns the customer that owns the VK identity", () => {
    const target = linkedCustomer("cust_target")
    const customers: VkLinkableCustomerRecord[] = [
      { id: "cust_other", metadata: {} },
      target,
    ]

    const result = findVkIdentityCustomer({
      customers,
      identity: buildIdentityFor("2000000777"),
    })

    expect(result.status).toBe("ok")
    expect(result.customer?.id).toBe("cust_target")
  })

  it("findVkIdentityCustomer returns not_found when no customer holds the identity", () => {
    const customers: VkLinkableCustomerRecord[] = [
      { id: "cust_other", metadata: {} },
    ]

    const result = findVkIdentityCustomer({
      customers,
      identity: buildIdentityFor("2000000777"),
    })

    expect(result.status).toBe("not_found")
    expect(result.customer).toBeNull()
  })

  it("findVkIdentityCustomer flags two or more matches as ambiguous", () => {
    const customers: VkLinkableCustomerRecord[] = [
      linkedCustomer("cust_a"),
      linkedCustomer("cust_b"),
      { id: "cust_other", metadata: {} },
    ]

    const result = findVkIdentityCustomer({
      customers,
      identity: buildIdentityFor("2000000777"),
    })

    expect(result.status).toBe("ambiguous")
    expect(result.customer).toBeNull()
    if (result.status === "ambiguous") {
      expect(result.matches.map((m) => m.id).sort()).toEqual([
        "cust_a",
        "cust_b",
      ])
    }
  })

  it("findVkIdentityCustomer ignores customers whose VK link is in unlinked status", () => {
    const customers: VkLinkableCustomerRecord[] = [
      {
        id: "cust_unlinked",
        metadata: {
          vk_link: {
            provider: "vkid",
            vk_user_id: "2000000777",
            vk_peer_id: "2000000777",
            linked_at: "2026-01-01T00:00:00.000Z",
            link_source: "storefront.account.profile",
            link_status: "unlinked",
            last_verified_at: "2026-01-01T00:00:00.000Z",
            unlinked_at: "2026-01-02T00:00:00.000Z",
          },
        },
      },
    ]

    const result = findVkIdentityCustomer({
      customers,
      identity: buildIdentityFor("2000000777"),
    })

    expect(result.status).toBe("not_found")
  })

  it("findVkIdCustomersByIdentity uses an SQL prefilter and returns matching customers", async () => {
    const rawCalls: Array<{ sql: string; bindings?: unknown[] }> = []
    const pgConnection = {
      transaction: async <T>(cb: (trx: any) => Promise<T>) => {
        return cb({
          raw: async (sql: string, bindings?: unknown[]) => {
            rawCalls.push({ sql, bindings })
            return {
              rows: [
                linkedCustomer("cust_sql_match"),
              ],
            }
          },
        })
      },
    }

    const rows = await findVkIdCustomersByIdentity(pgConnection, {
      provider: "vkid",
      vkUserId: "2000000777",
      vkPeerId: "2000000777",
    })

    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe("cust_sql_match")
    expect(rawCalls).toHaveLength(1)
    expect(rawCalls[0].sql).toContain("metadata->'vk_link'->>'vk_user_id'")
    expect(rawCalls[0].bindings).toEqual([
      "2000000777",
      "2000000777",
      "2000000777",
    ])
  })
})

describe("VK ID login error redirect helpers", () => {
  it("buildVkIdLoginErrorReturnUrl appends sanitized vk_login_error param", () => {
    const url = buildVkIdLoginErrorReturnUrl({
      returnUrl: "http://localhost:8000/ru/account",
      reason: "Not Linked!",
    })

    expect(url.searchParams.get("vk_login_error")).toBe("not_linked_")
  })

  it("buildVkIdLoginErrorReturnUrl falls back to vk_login_failed for empty reason", () => {
    const url = buildVkIdLoginErrorReturnUrl({
      returnUrl: "http://localhost:8000/ru/account",
      reason: "",
    })

    expect(url.searchParams.get("vk_login_error")).toBe("vk_login_failed")
  })

  it("buildVkIdResultReturnUrl is unchanged for the linking flow regression case", () => {
    const url = buildVkIdResultReturnUrl({
      returnUrl: "http://localhost:8000/ru/account/profile",
      result: "linked",
      reason: null,
      customerId: "cust_1",
    })

    expect(url.toString()).toBe(
      "http://localhost:8000/ru/account/profile?vk_id_result=linked&vk_id_customer_id=cust_1"
    )
  })
})

describe("VK ID runtime login flag", () => {
  const ORIGINAL_ENV = { ...process.env }

  function applyEnv(overrides: Record<string, string | undefined>) {
    for (const key of Object.keys(overrides)) {
      const value = overrides[key]
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  }

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  it("loginEnabled is false when VK_ID_ENABLED=true but VK_ID_LOGIN_ENABLED is unset", () => {
    applyEnv({
      VK_ID_ENABLED: "true",
      VK_ID_CLIENT_ID: "test_client",
      VK_ID_REDIRECT_URI: "https://studio.slavx.ru/store/vk-id/callback",
      VK_ID_LOGIN_ENABLED: undefined,
      VK_ID_STOREFRONT_RETURN_ORIGINS: "https://studio.slavx.ru",
    })

    const runtime = getVkIdRuntime()

    expect(runtime.enabled).toBe(true)
    expect(runtime.loginRequestedEnabled).toBe(false)
    expect(runtime.loginEnabled).toBe(false)
  })

  it("loginEnabled is true only when both VK_ID_ENABLED=true and VK_ID_LOGIN_ENABLED=true", () => {
    applyEnv({
      VK_ID_ENABLED: "true",
      VK_ID_CLIENT_ID: "test_client",
      VK_ID_REDIRECT_URI: "https://studio.slavx.ru/store/vk-id/callback",
      VK_ID_LOGIN_ENABLED: "true",
      VK_ID_STOREFRONT_RETURN_ORIGINS: "https://studio.slavx.ru",
    })

    const runtime = getVkIdRuntime()

    expect(runtime.enabled).toBe(true)
    expect(runtime.loginRequestedEnabled).toBe(true)
    expect(runtime.loginEnabled).toBe(true)
  })

  it("loginEnabled stays false when VK_ID_ENABLED=false even if VK_ID_LOGIN_ENABLED=true", () => {
    applyEnv({
      VK_ID_ENABLED: "false",
      VK_ID_CLIENT_ID: "test_client",
      VK_ID_REDIRECT_URI: "https://studio.slavx.ru/store/vk-id/callback",
      VK_ID_LOGIN_ENABLED: "true",
      VK_ID_STOREFRONT_RETURN_ORIGINS: "https://studio.slavx.ru",
    })

    const runtime = getVkIdRuntime()

    expect(runtime.enabled).toBe(false)
    expect(runtime.loginRequestedEnabled).toBe(true)
    expect(runtime.loginEnabled).toBe(false)
  })
})

describe("VK ID storefront return URL resolver", () => {
  const ORIGINAL_ENV = { ...process.env }

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  it("login default path differs from link default path", () => {
    process.env.VK_ID_STOREFRONT_RETURN_ORIGINS = "https://studio.slavx.ru"

    const linkUrl = resolveAllowedVkIdReturnUrl(null)
    const loginUrl = resolveAllowedVkIdLoginReturnUrl(null)

    expect(linkUrl.pathname).toBe("/ru/account/profile")
    expect(loginUrl.pathname).toBe("/ru/account")
    expect(linkUrl.origin).toBe(loginUrl.origin)
  })

  it("rejects mismatched origins and falls back to default login path", () => {
    process.env.VK_ID_STOREFRONT_RETURN_ORIGINS = "https://studio.slavx.ru"

    const url = resolveAllowedVkIdLoginReturnUrl(
      "https://attacker.example.com/ru/account"
    )

    expect(url.origin).toBe("https://studio.slavx.ru")
    expect(url.pathname).toBe("/ru/account")
  })

  it("rejects non-URL garbage return_url and falls back to allowed origin", () => {
    process.env.VK_ID_STOREFRONT_RETURN_ORIGINS = "https://studio.slavx.ru"

    const url = resolveAllowedVkIdLoginReturnUrl("javascript:alert(1)")

    expect(url.origin).toBe("https://studio.slavx.ru")
    expect(url.pathname).toBe("/ru/account")
  })
})

describe("VK ID session secret hardening", () => {
  const ORIGINAL_ENV = { ...process.env }

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  it("refuses to mint a login session when no secret env is configured", () => {
    delete process.env.VK_ID_SESSION_SECRET
    delete process.env.JWT_SECRET
    delete process.env.COOKIE_SECRET

    expect(() =>
      createVkIdLoginSession({
        returnUrl: "http://localhost:8000/ru/account",
      })
    ).toThrow(/VK_ID_SESSION_SECRET is not configured/)
  })

  it("accepts JWT_SECRET as a fallback when VK_ID_SESSION_SECRET is unset", () => {
    delete process.env.VK_ID_SESSION_SECRET
    delete process.env.COOKIE_SECRET
    process.env.JWT_SECRET = "test-fallback-jwt"

    const session = createVkIdLoginSession({
      returnUrl: "http://localhost:8000/ru/account",
    })

    expect(session.state).toBeTruthy()
    expect(readVkIdLinkSession(session.state)?.intent).toBe("login")
  })

  it("prefers VK_ID_SESSION_SECRET over JWT_SECRET / COOKIE_SECRET", () => {
    process.env.VK_ID_SESSION_SECRET = "primary-secret"
    process.env.JWT_SECRET = "different-secret"
    process.env.COOKIE_SECRET = "yet-another-secret"

    const sessionWithPrimary = createVkIdLoginSession({
      returnUrl: "http://localhost:8000/ru/account",
    })

    // Rotating the primary secret while leaving JWT_SECRET intact must
    // invalidate the previously minted state.
    process.env.VK_ID_SESSION_SECRET = "rotated-secret"

    expect(readVkIdLinkSession(sessionWithPrimary.state)).toBeNull()
  })
})
