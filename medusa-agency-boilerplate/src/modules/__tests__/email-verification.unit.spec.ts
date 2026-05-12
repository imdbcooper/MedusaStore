import { afterEach, describe, expect, it } from "@jest/globals"
import {
  buildEmailVerificationConsumeMetadata,
  buildEmailVerificationIssueMetadata,
  buildEmailVerificationLink,
  buildEmailVerificationToken,
  DEFAULT_EMAIL_VERIFICATION_REDIRECT_PATH,
  DEFAULT_EMAIL_VERIFICATION_TOKEN_TTL_MINUTES,
  generateEmailVerificationRawToken,
  getEmailVerificationRuntime,
  hashEmailVerificationToken,
  isCustomerEmailVerified,
  parseEmailVerificationToken,
  renderEmailVerificationHtml,
  renderEmailVerificationPlainText,
  verifyEmailVerificationToken,
} from "../../modules/email-verification"

const ORIGINAL_ENV = { ...process.env }

describe("email-verification helpers", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  describe("getEmailVerificationRuntime", () => {
    it("resolves defaults when env is empty", () => {
      delete process.env.EMAIL_VERIFICATION_TOKEN_TTL_MINUTES
      delete process.env.EMAIL_VERIFICATION_REDIRECT_PATH

      const runtime = getEmailVerificationRuntime()

      expect(runtime.tokenTtlMinutes).toBe(
        DEFAULT_EMAIL_VERIFICATION_TOKEN_TTL_MINUTES
      )
      expect(runtime.redirectPath).toBe(DEFAULT_EMAIL_VERIFICATION_REDIRECT_PATH)
    })

    it("reads overrides from env", () => {
      process.env.EMAIL_VERIFICATION_TOKEN_TTL_MINUTES = "60"
      process.env.EMAIL_VERIFICATION_REDIRECT_PATH = "/custom/verify"

      const runtime = getEmailVerificationRuntime()

      expect(runtime.tokenTtlMinutes).toBe(60)
      expect(runtime.redirectPath).toBe("/custom/verify")
    })

    it("falls back to default ttl when value is non-positive", () => {
      process.env.EMAIL_VERIFICATION_TOKEN_TTL_MINUTES = "-5"

      const runtime = getEmailVerificationRuntime()

      expect(runtime.tokenTtlMinutes).toBe(
        DEFAULT_EMAIL_VERIFICATION_TOKEN_TTL_MINUTES
      )
    })
  })

  describe("generateEmailVerificationRawToken", () => {
    it("produces url-safe string without padding or reserved characters", () => {
      const token = generateEmailVerificationRawToken()

      expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
      expect(token.length).toBeGreaterThan(20)
    })

    it("produces distinct tokens across calls", () => {
      const a = generateEmailVerificationRawToken()
      const b = generateEmailVerificationRawToken()

      expect(a).not.toEqual(b)
    })

    it("rejects too-short byte length", () => {
      expect(() => generateEmailVerificationRawToken(8)).toThrow()
    })
  })

  describe("hashEmailVerificationToken", () => {
    it("produces deterministic 64-char hex hash", () => {
      const hash = hashEmailVerificationToken("raw-token")

      expect(hash).toHaveLength(64)
      expect(hashEmailVerificationToken("raw-token")).toBe(hash)
    })

    it("produces different hashes for different inputs", () => {
      expect(hashEmailVerificationToken("a")).not.toBe(
        hashEmailVerificationToken("b")
      )
    })
  })

  describe("buildEmailVerificationToken / parseEmailVerificationToken", () => {
    it("roundtrips customer id and raw token", () => {
      const token = buildEmailVerificationToken("cus_123", "raw_abc")
      const parsed = parseEmailVerificationToken(token)

      expect(parsed.ok).toBe(true)
      if (parsed.ok) {
        expect(parsed.customerId).toBe("cus_123")
        expect(parsed.rawToken).toBe("raw_abc")
      }
    })

    it("rejects malformed tokens", () => {
      expect(parseEmailVerificationToken("").ok).toBe(false)
      expect(parseEmailVerificationToken(null).ok).toBe(false)
      expect(parseEmailVerificationToken("no-dot").ok).toBe(false)
      expect(parseEmailVerificationToken(".only-dot").ok).toBe(false)
      expect(parseEmailVerificationToken("cus_.").ok).toBe(false)
    })

    it("rejects customer id with dot", () => {
      expect(() => buildEmailVerificationToken("bad.id", "raw")).toThrow()
    })
  })

  describe("buildEmailVerificationIssueMetadata", () => {
    it("stores hashed token and sets expiration relative to now", () => {
      const now = new Date("2026-05-12T05:00:00.000Z")

      const metadata = buildEmailVerificationIssueMetadata({
        currentMetadata: { unrelated: true },
        email: " User@Example.com ",
        tokenHash: "hash-value",
        now,
        ttlMinutes: 60,
      })

      expect(metadata.unrelated).toBe(true)
      const state = metadata.email_verification as Record<string, unknown>
      expect(state.email).toBe("user@example.com")
      expect(state.token_hash).toBe("hash-value")
      expect(state.created_at).toBe("2026-05-12T05:00:00.000Z")
      expect(state.expires_at).toBe("2026-05-12T06:00:00.000Z")
      expect(state.consumed_at).toBeNull()
    })

    it("clears previously verified flag when email differs", () => {
      const metadata = buildEmailVerificationIssueMetadata({
        currentMetadata: {
          email_verified: true,
          email_verified_for: "old@example.com",
          email_verified_at: "2026-04-01T00:00:00.000Z",
        },
        email: "new@example.com",
        tokenHash: "hash",
        now: new Date("2026-05-12T05:00:00.000Z"),
        ttlMinutes: 10,
      })

      expect(metadata.email_verified).toBe(false)
      expect(metadata.email_verified_at).toBeNull()
      expect(metadata.email_verified_for).toBeNull()
    })

    it("preserves previously verified flag when email matches normalized value", () => {
      const metadata = buildEmailVerificationIssueMetadata({
        currentMetadata: {
          email_verified: true,
          email_verified_for: "same@example.com",
          email_verified_at: "2026-04-01T00:00:00.000Z",
        },
        email: "Same@Example.com",
        tokenHash: "hash",
        now: new Date("2026-05-12T05:00:00.000Z"),
        ttlMinutes: 10,
      })

      expect(metadata.email_verified).toBe(true)
      expect(metadata.email_verified_for).toBe("same@example.com")
      expect(metadata.email_verified_at).toBe("2026-04-01T00:00:00.000Z")
    })
  })

  describe("verifyEmailVerificationToken", () => {
    function buildCustomerWithToken(options?: {
      email?: string
      ttlMinutes?: number
      rawToken?: string
      consumedAt?: string | null
      now?: Date
    }) {
      const rawToken = options?.rawToken || generateEmailVerificationRawToken()
      const tokenHash = hashEmailVerificationToken(rawToken)
      const metadata = buildEmailVerificationIssueMetadata({
        currentMetadata: {},
        email: options?.email || "user@example.com",
        tokenHash,
        now: options?.now || new Date(),
        ttlMinutes: options?.ttlMinutes ?? 60,
      })

      if (options?.consumedAt !== undefined && metadata.email_verification) {
        ;(
          metadata.email_verification as Record<string, unknown>
        ).consumed_at = options.consumedAt
      }

      return {
        rawToken,
        customer: {
          id: "cus_verify",
          email: options?.email || "user@example.com",
          metadata,
        },
      }
    }

    it("accepts a valid unexpired token", () => {
      const { customer, rawToken } = buildCustomerWithToken()

      const result = verifyEmailVerificationToken({
        customer,
        rawToken,
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.email).toBe("user@example.com")
        expect(result.alreadyVerified).toBe(false)
      }
    })

    it("rejects a token after TTL expires", () => {
      const issuedAt = new Date("2026-05-12T00:00:00.000Z")
      const later = new Date("2026-05-12T02:00:01.000Z")
      const { customer, rawToken } = buildCustomerWithToken({
        ttlMinutes: 120,
        now: issuedAt,
      })

      const result = verifyEmailVerificationToken({
        customer,
        rawToken,
        now: later,
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.reason).toBe("token_expired")
      }
    })

    it("rejects a token after consume", () => {
      const { customer, rawToken } = buildCustomerWithToken({
        consumedAt: "2026-05-12T00:10:00.000Z",
      })

      const result = verifyEmailVerificationToken({
        customer,
        rawToken,
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.reason).toBe("token_already_consumed")
      }
    })

    it("rejects mismatched raw token", () => {
      const { customer } = buildCustomerWithToken()

      const result = verifyEmailVerificationToken({
        customer,
        rawToken: "totally-different-token",
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.reason).toBe("token_mismatch")
      }
    })

    it("rejects when customer email differs from stored email", () => {
      const { customer, rawToken } = buildCustomerWithToken({
        email: "initial@example.com",
      })

      const mutatedCustomer = {
        ...customer,
        email: "changed@example.com",
      }

      const result = verifyEmailVerificationToken({
        customer: mutatedCustomer,
        rawToken,
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.reason).toBe("email_mismatch")
      }
    })
  })

  describe("buildEmailVerificationConsumeMetadata", () => {
    it("marks metadata as verified for given email", () => {
      const now = new Date("2026-05-12T05:00:00.000Z")
      const initial = buildEmailVerificationIssueMetadata({
        currentMetadata: {},
        email: "user@example.com",
        tokenHash: "hash",
        now,
        ttlMinutes: 60,
      })

      const consumed = buildEmailVerificationConsumeMetadata({
        currentMetadata: initial,
        email: "user@example.com",
        consumedAt: new Date("2026-05-12T05:01:00.000Z"),
      })

      expect(consumed.email_verified).toBe(true)
      expect(consumed.email_verified_for).toBe("user@example.com")
      expect(consumed.email_verified_at).toBe("2026-05-12T05:01:00.000Z")
      const state = consumed.email_verification as Record<string, unknown>
      expect(state.consumed_at).toBe("2026-05-12T05:01:00.000Z")
    })
  })

  describe("isCustomerEmailVerified", () => {
    it("returns true when flag matches normalized email", () => {
      expect(
        isCustomerEmailVerified({
          id: "c1",
          email: "User@Example.com",
          metadata: {
            email_verified: true,
            email_verified_for: "user@example.com",
          },
        })
      ).toBe(true)
    })

    it("returns false when email changed after verification", () => {
      expect(
        isCustomerEmailVerified({
          id: "c1",
          email: "other@example.com",
          metadata: {
            email_verified: true,
            email_verified_for: "user@example.com",
          },
        })
      ).toBe(false)
    })

    it("returns false when flag is missing", () => {
      expect(
        isCustomerEmailVerified({
          id: "c1",
          email: "user@example.com",
          metadata: {},
        })
      ).toBe(false)
    })
  })

  describe("buildEmailVerificationLink", () => {
    it("includes country segment and token param", () => {
      const link = buildEmailVerificationLink({
        storefrontUrl: "https://shop.example.com/",
        countryCode: "ru",
        redirectPath: "/account/verify-email",
        token: "cus_1.raw_abc",
      })

      expect(link).toBe(
        "https://shop.example.com/ru/account/verify-email?token=cus_1.raw_abc"
      )
    })

    it("omits country segment when not provided", () => {
      const link = buildEmailVerificationLink({
        storefrontUrl: "https://shop.example.com",
        token: "cus_1.raw",
      })

      expect(link).toBe(
        "https://shop.example.com/account/verify-email?token=cus_1.raw"
      )
    })

    it("throws when storefront url is empty", () => {
      expect(() =>
        buildEmailVerificationLink({ storefrontUrl: "", token: "cus.raw" })
      ).toThrow()
    })
  })

  describe("render helpers", () => {
    it("renders plain text with greeting and link", () => {
      const text = renderEmailVerificationPlainText({
        link: "https://shop.example.com/ru/account/verify-email?token=abc",
        ttlMinutes: 60,
        firstName: "Иван",
      })

      expect(text).toContain("Здравствуйте, Иван")
      expect(text).toContain("Подтвердить email")
      expect(text).toContain(
        "https://shop.example.com/ru/account/verify-email?token=abc"
      )
    })

    it("renders branded HTML with DOCTYPE, dark-mode meta and CTA button", () => {
      const html = renderEmailVerificationHtml({
        link: "https://shop.example.com/ru/account/verify-email?token=abc",
        ttlMinutes: 60,
        firstName: "Иван",
      })

      expect(html).toContain("<!DOCTYPE html>")
      expect(html).toContain('name="color-scheme"')
      expect(html).toContain("Подтвердить email")
      expect(html).toContain(
        "https://shop.example.com/ru/account/verify-email?token=abc"
      )
    })

    it("escapes html in rendered html body", () => {
      const html = renderEmailVerificationHtml({
        link: "https://shop.example.com/ru/account/verify-email?token=abc",
        ttlMinutes: 60,
        firstName: "<script>alert(1)</script>",
      })

      expect(html).not.toContain("<script>alert(1)</script>")
      expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;")
    })
  })
})
