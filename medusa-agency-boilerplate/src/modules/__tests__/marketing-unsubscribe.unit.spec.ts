import { describe, expect, it, afterEach } from "@jest/globals"
import {
  buildPublicUnsubscribeToken,
  buildUnsubscribeClearedMetadata,
  buildUnsubscribeConsumeMetadata,
  buildUnsubscribeIssueMetadata,
  buildUnsubscribeUrl,
  DEFAULT_MARKETING_UNSUBSCRIBE_REDIRECT_PATH,
  DEFAULT_MARKETING_UNSUBSCRIBE_TOKEN_TTL_DAYS,
  generateUnsubscribeToken,
  getMarketingUnsubscribeRuntime,
  hashUnsubscribeToken,
  parsePublicUnsubscribeToken,
  readMarketingUnsubscribeMetadata,
  secureHashEquals,
  verifyUnsubscribeToken,
} from "../marketing-unsubscribe"

const ORIGINAL_ENV = { ...process.env }

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) {
      delete process.env[key]
    }
  }
  Object.assign(process.env, ORIGINAL_ENV)
})

describe("getMarketingUnsubscribeRuntime", () => {
  it("returns defaults when env vars are empty", () => {
    delete process.env.MARKETING_UNSUBSCRIBE_TOKEN_TTL_DAYS
    delete process.env.MARKETING_UNSUBSCRIBE_REDIRECT_PATH

    const runtime = getMarketingUnsubscribeRuntime()

    expect(runtime.tokenTtlDays).toBe(DEFAULT_MARKETING_UNSUBSCRIBE_TOKEN_TTL_DAYS)
    expect(runtime.redirectPath).toBe(
      DEFAULT_MARKETING_UNSUBSCRIBE_REDIRECT_PATH
    )
  })

  it("parses overrides from env", () => {
    process.env.MARKETING_UNSUBSCRIBE_TOKEN_TTL_DAYS = "14"
    process.env.MARKETING_UNSUBSCRIBE_REDIRECT_PATH = "/opt-out"

    const runtime = getMarketingUnsubscribeRuntime()

    expect(runtime.tokenTtlDays).toBe(14)
    expect(runtime.redirectPath).toBe("/opt-out")
  })

  it("falls back to defaults on invalid env values", () => {
    process.env.MARKETING_UNSUBSCRIBE_TOKEN_TTL_DAYS = "not-a-number"
    process.env.MARKETING_UNSUBSCRIBE_REDIRECT_PATH = ""

    const runtime = getMarketingUnsubscribeRuntime()

    expect(runtime.tokenTtlDays).toBe(DEFAULT_MARKETING_UNSUBSCRIBE_TOKEN_TTL_DAYS)
    expect(runtime.redirectPath).toBe(
      DEFAULT_MARKETING_UNSUBSCRIBE_REDIRECT_PATH
    )
  })
})

describe("token generation / hashing / encoding", () => {
  it("generates base64url tokens of expected length", () => {
    const token = generateUnsubscribeToken(32)

    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(token.length).toBeGreaterThanOrEqual(40)
  })

  it("rejects byte length less than 16", () => {
    expect(() => generateUnsubscribeToken(8)).toThrow()
  })

  it("produces deterministic sha256 hex hashes", () => {
    const token = "abcdef"

    expect(hashUnsubscribeToken(token)).toBe(hashUnsubscribeToken(token))
    expect(hashUnsubscribeToken(token)).not.toBe(hashUnsubscribeToken("other"))
  })

  it("encodes and parses customer_id.raw_token", () => {
    const public_ = buildPublicUnsubscribeToken("cust_1", "raw_token")
    expect(public_).toBe("cust_1.raw_token")

    const parsed = parsePublicUnsubscribeToken(public_)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.customerId).toBe("cust_1")
      expect(parsed.rawToken).toBe("raw_token")
    }
  })

  it("rejects tokens without a '.' separator", () => {
    expect(parsePublicUnsubscribeToken("bad-token")).toEqual({
      ok: false,
      reason: "invalid_token_format",
    })
    expect(parsePublicUnsubscribeToken("")).toEqual({
      ok: false,
      reason: "invalid_token_format",
    })
    expect(parsePublicUnsubscribeToken(null)).toEqual({
      ok: false,
      reason: "invalid_token_format",
    })
  })

  it("rejects customer ids containing '.'", () => {
    expect(() => buildPublicUnsubscribeToken("cust.id", "raw")).toThrow()
  })
})

describe("secureHashEquals", () => {
  it("returns true for identical strings", () => {
    expect(secureHashEquals("abc", "abc")).toBe(true)
  })

  it("returns false for differing strings or lengths", () => {
    expect(secureHashEquals("abc", "abd")).toBe(false)
    expect(secureHashEquals("abc", "abcd")).toBe(false)
  })
})

describe("buildUnsubscribeUrl", () => {
  it("builds a URL with country segment and query params", () => {
    const url = buildUnsubscribeUrl({
      storefrontUrl: "https://studio.slavx.ru",
      countryCode: "ru",
      token: "cust_1.raw",
    })

    expect(url.startsWith("https://studio.slavx.ru/ru/unsubscribe")).toBe(true)
    expect(url).toContain("token=cust_1.raw")
  })

  it("includes channels and list_id when provided", () => {
    const url = buildUnsubscribeUrl({
      storefrontUrl: "https://studio.slavx.ru",
      countryCode: "ru",
      token: "cust_1.raw",
      channels: ["email"],
      listId: "mc_xyz",
    })

    expect(url).toContain("channels=email")
    expect(url).toContain("list_id=mc_xyz")
  })

  it("throws when storefront URL is empty", () => {
    expect(() =>
      buildUnsubscribeUrl({
        storefrontUrl: "",
        countryCode: "ru",
        token: "cust_1.raw",
      })
    ).toThrow()
  })
})

describe("metadata lifecycle", () => {
  it("reads issued metadata back into state", () => {
    const nowIso = new Date("2026-01-01T00:00:00.000Z").toISOString()
    const metadata = {
      marketing_unsubscribe: {
        token_hash: "abc123",
        issued_at: nowIso,
        expires_at: nowIso,
        consumed_at: null,
      },
    }

    const { marketing_unsubscribe } = readMarketingUnsubscribeMetadata(metadata)

    expect(marketing_unsubscribe).not.toBeNull()
    expect(marketing_unsubscribe!.token_hash).toBe("abc123")
    expect(marketing_unsubscribe!.issued_at).toBe(nowIso)
  })

  it("treats missing token_hash as no state", () => {
    const { marketing_unsubscribe } = readMarketingUnsubscribeMetadata({
      marketing_unsubscribe: { issued_at: "2026-01-01T00:00:00.000Z" },
    })
    expect(marketing_unsubscribe).toBeNull()
  })

  it("issues metadata with ttl days horizon", () => {
    const now = new Date("2026-01-01T00:00:00.000Z")
    const metadata = buildUnsubscribeIssueMetadata({
      currentMetadata: {},
      tokenHash: "hash123",
      now,
      ttlDays: 30,
    })

    const state = readMarketingUnsubscribeMetadata(metadata).marketing_unsubscribe

    expect(state).not.toBeNull()
    expect(state!.token_hash).toBe("hash123")
    const expiresAt = new Date(state!.expires_at!).getTime()
    expect(expiresAt - now.getTime()).toBe(30 * 24 * 60 * 60 * 1000)
  })

  it("consumes a token by stamping consumed_at", () => {
    const now = new Date("2026-01-01T00:00:00.000Z")
    const issued = buildUnsubscribeIssueMetadata({
      currentMetadata: {},
      tokenHash: "hash",
      now,
    })
    const consumed = buildUnsubscribeConsumeMetadata({
      currentMetadata: issued,
      consumedAt: new Date("2026-01-02T00:00:00.000Z"),
    })
    const state = readMarketingUnsubscribeMetadata(consumed).marketing_unsubscribe
    expect(state!.consumed_at).toBe("2026-01-02T00:00:00.000Z")
  })

  it("clears state via buildUnsubscribeClearedMetadata", () => {
    const issued = buildUnsubscribeIssueMetadata({
      currentMetadata: {},
      tokenHash: "hash",
    })
    const cleared = buildUnsubscribeClearedMetadata({ currentMetadata: issued })
    expect(
      readMarketingUnsubscribeMetadata(cleared).marketing_unsubscribe
    ).toBeNull()
  })
})

describe("verifyUnsubscribeToken", () => {
  it("returns token_mismatch when customer has no state", () => {
    const result = verifyUnsubscribeToken({
      customer: { id: "cust_1", metadata: {} },
      rawToken: "abc",
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe("token_mismatch")
    }
  })

  it("returns token_already_consumed for previously consumed token", () => {
    const now = new Date("2026-01-01T00:00:00.000Z")
    const raw = "raw-token"
    const issued = buildUnsubscribeIssueMetadata({
      currentMetadata: {},
      tokenHash: hashUnsubscribeToken(raw),
      now,
    })
    const consumed = buildUnsubscribeConsumeMetadata({
      currentMetadata: issued,
    })

    const result = verifyUnsubscribeToken({
      customer: { id: "cust_1", metadata: consumed },
      rawToken: raw,
      now: new Date(now.getTime() + 1000),
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe("token_already_consumed")
    }
  })

  it("returns token_expired when TTL passed", () => {
    const now = new Date("2026-01-01T00:00:00.000Z")
    const raw = "raw-token"
    const issued = buildUnsubscribeIssueMetadata({
      currentMetadata: {},
      tokenHash: hashUnsubscribeToken(raw),
      now,
      ttlDays: 1,
    })

    const result = verifyUnsubscribeToken({
      customer: { id: "cust_1", metadata: issued },
      rawToken: raw,
      now: new Date(now.getTime() + 48 * 60 * 60 * 1000),
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe("token_expired")
    }
  })

  it("returns token_mismatch when raw token hash does not match", () => {
    const now = new Date("2026-01-01T00:00:00.000Z")
    const issued = buildUnsubscribeIssueMetadata({
      currentMetadata: {},
      tokenHash: hashUnsubscribeToken("correct"),
      now,
    })

    const result = verifyUnsubscribeToken({
      customer: { id: "cust_1", metadata: issued },
      rawToken: "wrong",
      now,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe("token_mismatch")
    }
  })

  it("returns ok=true for a valid raw token", () => {
    const now = new Date("2026-01-01T00:00:00.000Z")
    const raw = "raw-token"
    const issued = buildUnsubscribeIssueMetadata({
      currentMetadata: {},
      tokenHash: hashUnsubscribeToken(raw),
      now,
    })

    const result = verifyUnsubscribeToken({
      customer: { id: "cust_1", metadata: issued },
      rawToken: raw,
      now,
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.customerId).toBe("cust_1")
    }
  })
})
