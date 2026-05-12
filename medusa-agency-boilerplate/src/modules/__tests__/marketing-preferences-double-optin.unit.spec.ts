import { describe, expect, it, afterEach } from "@jest/globals"
import {
  buildChannelConfirmedMetadata,
  buildChannelPendingMetadata,
  buildChannelUnsubscribedMetadata,
  buildPublicConfirmationToken,
  DEFAULT_MARKETING_DOUBLE_OPTIN_TOKEN_TTL_DAYS,
  generateConfirmationToken,
  getMarketingDoubleOptinRuntime,
  hashConfirmationToken,
  parsePublicConfirmationToken,
  resolveMarketingPreferences,
  secureConfirmationHashEquals,
  verifyConfirmationToken,
  type MarketingCustomerRecord,
} from "../marketing-preferences"

const ORIGINAL_ENV = { ...process.env }

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) {
      delete process.env[key]
    }
  }
  Object.assign(process.env, ORIGINAL_ENV)
})

const baseCustomer: MarketingCustomerRecord = {
  id: "cust_1",
  email: "customer@example.com",
  phone: null,
  metadata: {},
}

describe("getMarketingDoubleOptinRuntime", () => {
  it("returns default ttl when env is empty", () => {
    delete process.env.MARKETING_DOUBLE_OPTIN_TOKEN_TTL_DAYS

    const runtime = getMarketingDoubleOptinRuntime()
    expect(runtime.tokenTtlDays).toBe(
      DEFAULT_MARKETING_DOUBLE_OPTIN_TOKEN_TTL_DAYS
    )
  })

  it("parses a positive integer override", () => {
    process.env.MARKETING_DOUBLE_OPTIN_TOKEN_TTL_DAYS = "14"
    expect(getMarketingDoubleOptinRuntime().tokenTtlDays).toBe(14)
  })

  it("falls back to default on invalid env", () => {
    process.env.MARKETING_DOUBLE_OPTIN_TOKEN_TTL_DAYS = "-10"
    expect(getMarketingDoubleOptinRuntime().tokenTtlDays).toBe(
      DEFAULT_MARKETING_DOUBLE_OPTIN_TOKEN_TTL_DAYS
    )
  })
})

describe("confirmation token helpers", () => {
  it("generates and hashes deterministically", () => {
    const token = generateConfirmationToken()
    expect(token.length).toBeGreaterThan(16)

    const hash1 = hashConfirmationToken(token)
    const hash2 = hashConfirmationToken(token)
    expect(hash1).toBe(hash2)
    expect(hash1).not.toBe(hashConfirmationToken("other"))
  })

  it("encodes and parses customer_id.channel.raw_token", () => {
    const encoded = buildPublicConfirmationToken("cust_1", "email", "raw")
    expect(encoded).toBe("cust_1.email.raw")

    const parsed = parsePublicConfirmationToken(encoded)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.customerId).toBe("cust_1")
      expect(parsed.channel).toBe("email")
      expect(parsed.rawToken).toBe("raw")
    }
  })

  it("rejects unknown channel in public token", () => {
    const parsed = parsePublicConfirmationToken("cust_1.bad.raw")
    expect(parsed.ok).toBe(false)
  })

  it("rejects malformed token strings", () => {
    expect(parsePublicConfirmationToken("bad").ok).toBe(false)
    expect(parsePublicConfirmationToken("cust_1.email.").ok).toBe(false)
    expect(parsePublicConfirmationToken("").ok).toBe(false)
  })

  it("secureConfirmationHashEquals is constant-time equal", () => {
    expect(secureConfirmationHashEquals("aaa", "aaa")).toBe(true)
    expect(secureConfirmationHashEquals("aaa", "aab")).toBe(false)
    expect(secureConfirmationHashEquals("aaa", "aaaa")).toBe(false)
  })
})

describe("buildChannelPendingMetadata", () => {
  it("puts the channel in pending state with token hash + expiry", () => {
    const now = new Date("2026-01-01T00:00:00.000Z")
    const next = buildChannelPendingMetadata({
      customer: baseCustomer,
      channel: "email",
      tokenHash: "abc",
      now,
      ttlDays: 7,
    })

    const resolved = resolveMarketingPreferences(next, {
      ...baseCustomer,
      metadata: next,
    })

    expect(resolved.preferences.channels.email.status).toBe("pending")
    expect(resolved.preferences.channels.email.confirmation_token_hash).toBe("abc")
    const expires = new Date(
      resolved.preferences.channels.email.confirmation_expires_at as string
    ).getTime()
    expect(expires - now.getTime()).toBe(7 * 24 * 60 * 60 * 1000)
    expect(resolved.preferences.channels.email.requested_at).toBe(
      now.toISOString()
    )
  })

  it("falls back to default ttl when ttlDays is missing", () => {
    const next = buildChannelPendingMetadata({
      customer: baseCustomer,
      channel: "email",
      tokenHash: "abc",
    })
    const resolved = resolveMarketingPreferences(next, {
      ...baseCustomer,
      metadata: next,
    })
    expect(resolved.preferences.channels.email.status).toBe("pending")
    expect(resolved.preferences.channels.email.confirmation_expires_at).toBeTruthy()
  })
})

describe("verifyConfirmationToken", () => {
  it("returns token_missing when channel has no pending state", () => {
    const result = verifyConfirmationToken({
      customer: baseCustomer,
      channel: "email",
      rawToken: "anything",
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe("token_missing")
    }
  })

  it("returns ok=true on valid token + pending state", () => {
    const raw = generateConfirmationToken()
    const next = buildChannelPendingMetadata({
      customer: baseCustomer,
      channel: "email",
      tokenHash: hashConfirmationToken(raw),
    })

    const result = verifyConfirmationToken({
      customer: { ...baseCustomer, metadata: next },
      channel: "email",
      rawToken: raw,
    })

    expect(result.ok).toBe(true)
  })

  it("detects token_mismatch when raw does not hash to the stored value", () => {
    const next = buildChannelPendingMetadata({
      customer: baseCustomer,
      channel: "email",
      tokenHash: hashConfirmationToken("correct"),
    })

    const result = verifyConfirmationToken({
      customer: { ...baseCustomer, metadata: next },
      channel: "email",
      rawToken: "wrong",
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe("token_mismatch")
    }
  })

  it("detects expired tokens", () => {
    const now = new Date("2026-01-01T00:00:00.000Z")
    const next = buildChannelPendingMetadata({
      customer: baseCustomer,
      channel: "email",
      tokenHash: hashConfirmationToken("raw"),
      now,
      ttlDays: 1,
    })

    const result = verifyConfirmationToken({
      customer: { ...baseCustomer, metadata: next },
      channel: "email",
      rawToken: "raw",
      now: new Date(now.getTime() + 48 * 60 * 60 * 1000),
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe("token_expired")
    }
  })

  it("rejects confirmation when channel no longer pending", () => {
    const raw = generateConfirmationToken()
    const pending = buildChannelPendingMetadata({
      customer: baseCustomer,
      channel: "email",
      tokenHash: hashConfirmationToken(raw),
    })
    const confirmed = buildChannelConfirmedMetadata({
      customer: { ...baseCustomer, metadata: pending },
      channel: "email",
    })

    const result = verifyConfirmationToken({
      customer: { ...baseCustomer, metadata: confirmed },
      channel: "email",
      rawToken: raw,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      // After confirmed channel clears token, verifier returns token_missing.
      expect(result.reason).toBe("token_missing")
    }
  })
})

describe("buildChannelConfirmedMetadata", () => {
  it("transitions email to subscribed and clears token state", () => {
    const raw = generateConfirmationToken()
    const pending = buildChannelPendingMetadata({
      customer: baseCustomer,
      channel: "email",
      tokenHash: hashConfirmationToken(raw),
    })

    const confirmed = buildChannelConfirmedMetadata({
      customer: { ...baseCustomer, metadata: pending },
      channel: "email",
    })

    const resolved = resolveMarketingPreferences(confirmed, {
      ...baseCustomer,
      metadata: confirmed,
    })

    expect(resolved.preferences.channels.email.status).toBe("subscribed")
    expect(resolved.preferences.channels.email.confirmed_at).toBeTruthy()
    expect(
      resolved.preferences.channels.email.confirmation_token_hash
    ).toBeNull()
    expect(
      resolved.preferences.channels.email.confirmation_expires_at
    ).toBeNull()
  })
})

describe("buildChannelUnsubscribedMetadata", () => {
  it("transitions channel to unsubscribed and stamps unsubscribed_at", () => {
    const confirmed = buildChannelConfirmedMetadata({
      customer: baseCustomer,
      channel: "email",
    })

    const unsubscribed = buildChannelUnsubscribedMetadata({
      customer: { ...baseCustomer, metadata: confirmed },
      channel: "email",
    })

    const resolved = resolveMarketingPreferences(unsubscribed, {
      ...baseCustomer,
      metadata: unsubscribed,
    })

    expect(resolved.preferences.channels.email.status).toBe("unsubscribed")
    expect(resolved.preferences.channels.email.unsubscribed_at).toBeTruthy()
  })
})
