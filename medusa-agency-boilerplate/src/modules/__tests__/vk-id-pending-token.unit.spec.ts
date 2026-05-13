/**
 * Phase 5.3 unit tests for the pending-link token helpers.
 *
 * Covers:
 * - Happy path: mint a token, verify returns the same payload.
 * - Expiry: verifier surfaces `pending_token_expired` past TTL.
 * - Signature tampering: flipped bytes fail `pending_token_invalid_signature`.
 * - Malformed token: wrong shape or invalid JSON surfaces
 *   `pending_token_malformed`.
 * - Missing token: explicit `pending_token_missing` code.
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "@jest/globals"

import {
  createVkIdPendingLinkToken,
  identityFromPendingLinkTokenPayload,
  verifyVkIdPendingLinkToken,
  type VkResolvedIdentity,
} from "../vk-id"

const TEST_SECRET = "phase-5-3-unit-test-secret"

function buildIdentity(
  overrides: Partial<VkResolvedIdentity> = {}
): VkResolvedIdentity {
  return {
    provider: "vkid",
    vkUserId: "2000000555",
    vkPeerId: "2000000555",
    email: "vkuser@example.com",
    emailVerified: true,
    firstName: "VK",
    lastName: "User",
    ...overrides,
  }
}

describe("VK ID pending link token helpers (Phase 5.3)", () => {
  const ORIGINAL_SECRET = process.env.VK_ID_SESSION_SECRET

  beforeEach(() => {
    process.env.VK_ID_SESSION_SECRET = TEST_SECRET
  })

  afterEach(() => {
    if (ORIGINAL_SECRET === undefined) {
      delete process.env.VK_ID_SESSION_SECRET
    } else {
      process.env.VK_ID_SESSION_SECRET = ORIGINAL_SECRET
    }
  })

  it("round-trips the identity through mint + verify", () => {
    const { token, payload } = createVkIdPendingLinkToken({
      identity: buildIdentity(),
      ttlMinutes: 10,
    })

    const verified = verifyVkIdPendingLinkToken(token)

    expect(verified.ok).toBe(true)
    if (verified.ok) {
      expect(verified.payload.email).toBe(payload.email)
      expect(verified.payload.vkUserId).toBe(payload.vkUserId)
      expect(verified.payload.vkPeerId).toBe(payload.vkPeerId)
      expect(verified.payload.firstName).toBe(payload.firstName)
      expect(verified.payload.lastName).toBe(payload.lastName)
      expect(verified.payload.expiresAt).toBe(payload.expiresAt)
    }
  })

  it("normalises email casing when minting", () => {
    const { payload } = createVkIdPendingLinkToken({
      identity: buildIdentity({ email: "  Foo@Bar.Com  " }),
      ttlMinutes: 10,
    })
    expect(payload.email).toBe("foo@bar.com")
  })

  it("refuses to mint a token without an email", () => {
    expect(() =>
      createVkIdPendingLinkToken({
        identity: buildIdentity({ email: null }),
        ttlMinutes: 10,
      })
    ).toThrow(/pending link token requires an email/i)
  })

  it("reports pending_token_expired once past the TTL", () => {
    const longAgo = new Date(Date.now() - 1000 * 60 * 60)
    const { token } = createVkIdPendingLinkToken({
      identity: buildIdentity(),
      ttlMinutes: 1,
      now: longAgo,
    })

    const verified = verifyVkIdPendingLinkToken(token)
    expect(verified.ok).toBe(false)
    if (!verified.ok) {
      expect(verified.code).toBe("pending_token_expired")
    }
  })

  it("reports pending_token_invalid_signature when bytes are tampered", () => {
    const { token } = createVkIdPendingLinkToken({
      identity: buildIdentity(),
      ttlMinutes: 10,
    })

    const [encoded, signature] = token.split(".")
    // Flip the first character of the signature.
    const flipped =
      signature.charAt(0) === "A" ? "B" + signature.slice(1) : "A" + signature.slice(1)
    const tampered = `${encoded}.${flipped}`

    const verified = verifyVkIdPendingLinkToken(tampered)
    expect(verified.ok).toBe(false)
    if (!verified.ok) {
      expect(verified.code).toBe("pending_token_invalid_signature")
    }
  })

  it("reports pending_token_malformed for wrong shape", () => {
    const verified = verifyVkIdPendingLinkToken("not-even-a-dot-separated-token")
    expect(verified.ok).toBe(false)
    if (!verified.ok) {
      expect(verified.code).toBe("pending_token_malformed")
    }
  })

  it("reports pending_token_missing for empty input", () => {
    const verified = verifyVkIdPendingLinkToken("")
    expect(verified.ok).toBe(false)
    if (!verified.ok) {
      expect(verified.code).toBe("pending_token_missing")
    }
  })

  it("rejects tokens signed with a different secret", () => {
    const { token } = createVkIdPendingLinkToken({
      identity: buildIdentity(),
      ttlMinutes: 10,
    })

    process.env.VK_ID_SESSION_SECRET = "a-completely-different-secret"

    const verified = verifyVkIdPendingLinkToken(token)
    expect(verified.ok).toBe(false)
    if (!verified.ok) {
      expect(verified.code).toBe("pending_token_invalid_signature")
    }
  })

  it("converts payload back into a VK identity shape", () => {
    const { payload } = createVkIdPendingLinkToken({
      identity: buildIdentity({
        vkUserId: "12345",
        vkPeerId: "12345",
        email: "abc@example.com",
        firstName: "Abc",
        lastName: null,
      }),
      ttlMinutes: 10,
    })

    const identity = identityFromPendingLinkTokenPayload(payload)

    expect(identity.provider).toBe("vkid")
    expect(identity.vkUserId).toBe("12345")
    expect(identity.vkPeerId).toBe("12345")
    expect(identity.email).toBe("abc@example.com")
    expect(identity.firstName).toBe("Abc")
    expect(identity.lastName).toBeNull()
    expect(identity.emailVerified).toBe(true)
  })
})
