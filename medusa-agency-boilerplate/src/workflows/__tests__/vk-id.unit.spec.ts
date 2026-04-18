import { describe, expect, it, jest } from "@jest/globals"
import {
  buildVkIdResultReturnUrl,
  persistVkIdCustomerLinkWithOwnershipGuard,
  planVkIdLinkMutation,
  planVkIdUnlinkMutation,
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
