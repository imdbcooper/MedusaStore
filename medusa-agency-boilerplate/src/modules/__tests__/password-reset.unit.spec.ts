import { afterEach, describe, expect, it } from "@jest/globals"
import {
  buildPasswordResetClearedMetadata,
  buildPasswordResetConsumeMetadata,
  buildPasswordResetIssueMetadata,
  buildPasswordResetLink,
  buildPasswordResetToken,
  DEFAULT_PASSWORD_RESET_REDIRECT_PATH,
  DEFAULT_PASSWORD_RESET_TOKEN_TTL_MINUTES,
  generatePasswordResetRawToken,
  getPasswordResetRuntime,
  hashPasswordResetToken,
  parsePasswordResetToken,
  PASSWORD_MAX_LENGTH,
  readPasswordResetMetadata,
  renderPasswordResetHtml,
  renderPasswordResetPlainText,
  validatePasswordStrength,
  verifyPasswordResetToken,
} from "../../modules/password-reset"

const ORIGINAL_ENV = { ...process.env }

describe("password-reset helpers", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  describe("getPasswordResetRuntime", () => {
    it("resolves defaults when env is empty", () => {
      delete process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES
      delete process.env.PASSWORD_RESET_REDIRECT_PATH
      delete process.env.PASSWORD_MIN_LENGTH
      delete process.env.PASSWORD_REQUIRE_LETTER
      delete process.env.PASSWORD_REQUIRE_DIGIT

      const runtime = getPasswordResetRuntime()

      expect(runtime.tokenTtlMinutes).toBe(
        DEFAULT_PASSWORD_RESET_TOKEN_TTL_MINUTES
      )
      expect(runtime.redirectPath).toBe(DEFAULT_PASSWORD_RESET_REDIRECT_PATH)
      expect(runtime.passwordMinLength).toBe(8)
      expect(runtime.passwordRequireLetter).toBe(true)
      expect(runtime.passwordRequireDigit).toBe(true)
    })

    it("reads overrides from env", () => {
      process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES = "15"
      process.env.PASSWORD_RESET_REDIRECT_PATH = "/custom/reset"
      process.env.PASSWORD_MIN_LENGTH = "12"
      process.env.PASSWORD_REQUIRE_LETTER = "false"
      process.env.PASSWORD_REQUIRE_DIGIT = "false"

      const runtime = getPasswordResetRuntime()

      expect(runtime.tokenTtlMinutes).toBe(15)
      expect(runtime.redirectPath).toBe("/custom/reset")
      expect(runtime.passwordMinLength).toBe(12)
      expect(runtime.passwordRequireLetter).toBe(false)
      expect(runtime.passwordRequireDigit).toBe(false)
    })

    it("enforces absolute minimum password length of 8", () => {
      process.env.PASSWORD_MIN_LENGTH = "4"
      const runtime = getPasswordResetRuntime()
      expect(runtime.passwordMinLength).toBe(8)
    })
  })

  describe("generatePasswordResetRawToken", () => {
    it("produces url-safe string without padding", () => {
      const token = generatePasswordResetRawToken()
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
      expect(token.length).toBeGreaterThan(20)
    })

    it("produces distinct tokens across calls", () => {
      expect(generatePasswordResetRawToken()).not.toBe(
        generatePasswordResetRawToken()
      )
    })

    it("rejects too-short byte length", () => {
      expect(() => generatePasswordResetRawToken(8)).toThrow()
    })
  })

  describe("hashPasswordResetToken", () => {
    it("produces deterministic 64-char hex hash", () => {
      const hash = hashPasswordResetToken("raw-token")
      expect(hash).toHaveLength(64)
      expect(hashPasswordResetToken("raw-token")).toBe(hash)
    })

    it("produces different hashes for different inputs", () => {
      expect(hashPasswordResetToken("a")).not.toBe(hashPasswordResetToken("b"))
    })
  })

  describe("buildPasswordResetToken / parsePasswordResetToken", () => {
    it("roundtrips customer id and raw token", () => {
      const token = buildPasswordResetToken("cus_123", "raw_abc")
      const parsed = parsePasswordResetToken(token)

      expect(parsed.ok).toBe(true)
      if (parsed.ok) {
        expect(parsed.customerId).toBe("cus_123")
        expect(parsed.rawToken).toBe("raw_abc")
      }
    })

    it("rejects malformed tokens", () => {
      expect(parsePasswordResetToken("").ok).toBe(false)
      expect(parsePasswordResetToken(null).ok).toBe(false)
      expect(parsePasswordResetToken("no-dot").ok).toBe(false)
      expect(parsePasswordResetToken(".only-dot").ok).toBe(false)
      expect(parsePasswordResetToken("cus_.").ok).toBe(false)
    })

    it("rejects customer id with dot", () => {
      expect(() => buildPasswordResetToken("bad.id", "raw")).toThrow()
    })
  })

  describe("buildPasswordResetIssueMetadata", () => {
    it("stores hashed token and sets expiration relative to now", () => {
      const now = new Date("2026-05-12T05:00:00.000Z")

      const metadata = buildPasswordResetIssueMetadata({
        currentMetadata: { unrelated: true },
        email: " User@Example.com ",
        tokenHash: "hash-value",
        now,
        ttlMinutes: 60,
      })

      expect(metadata.unrelated).toBe(true)
      const state = metadata.password_reset as Record<string, unknown>
      expect(state.email).toBe("user@example.com")
      expect(state.token_hash).toBe("hash-value")
      expect(state.issued_at).toBe("2026-05-12T05:00:00.000Z")
      expect(state.expires_at).toBe("2026-05-12T06:00:00.000Z")
      expect(state.consumed_at).toBeNull()
    })

    it("throws when email is empty", () => {
      expect(() =>
        buildPasswordResetIssueMetadata({
          currentMetadata: {},
          email: "  ",
          tokenHash: "h",
          now: new Date(),
          ttlMinutes: 10,
        })
      ).toThrow()
    })

    it("throws when token hash is empty", () => {
      expect(() =>
        buildPasswordResetIssueMetadata({
          currentMetadata: {},
          email: "user@example.com",
          tokenHash: "  ",
          now: new Date(),
          ttlMinutes: 10,
        })
      ).toThrow()
    })
  })

  describe("buildPasswordResetConsumeMetadata", () => {
    it("marks consumed_at on state", () => {
      const now = new Date("2026-05-12T05:00:00.000Z")
      const initial = buildPasswordResetIssueMetadata({
        currentMetadata: {},
        email: "user@example.com",
        tokenHash: "hash",
        now,
        ttlMinutes: 60,
      })

      const consumed = buildPasswordResetConsumeMetadata({
        currentMetadata: initial,
        consumedAt: new Date("2026-05-12T05:01:00.000Z"),
      })

      const state = consumed.password_reset as Record<string, unknown>
      expect(state.consumed_at).toBe("2026-05-12T05:01:00.000Z")
    })

    it("leaves password_reset null when absent", () => {
      const consumed = buildPasswordResetConsumeMetadata({
        currentMetadata: {},
      })
      expect(consumed.password_reset).toBeNull()
    })

    it("stamps emailpass_password_set=true so the VK set-password CTA hides", () => {
      const consumed = buildPasswordResetConsumeMetadata({
        currentMetadata: {
          vk_link: { link_source: "vk_id_register" },
        },
      })
      expect(consumed.emailpass_password_set).toBe(true)
      // Does not clobber unrelated metadata branches.
      expect(consumed.vk_link).toEqual({ link_source: "vk_id_register" })
    })
  })

  describe("buildPasswordResetClearedMetadata", () => {
    it("sets password_reset to null", () => {
      const cleared = buildPasswordResetClearedMetadata({
        currentMetadata: {
          password_reset: { token_hash: "h" },
          other: "keep",
        },
      })

      expect(cleared.password_reset).toBeNull()
      expect(cleared.other).toBe("keep")
    })

    it("stamps emailpass_password_set=true when the authenticated update runs", () => {
      const cleared = buildPasswordResetClearedMetadata({
        currentMetadata: {
          password_reset: { token_hash: "h" },
          vk_link: { link_source: "vk_id_register" },
        },
      })

      expect(cleared.emailpass_password_set).toBe(true)
      expect(cleared.password_reset).toBeNull()
      expect(cleared.vk_link).toEqual({ link_source: "vk_id_register" })
    })
  })

  describe("readPasswordResetMetadata", () => {
    it("returns null when state is incomplete", () => {
      expect(
        readPasswordResetMetadata({
          password_reset: {
            token_hash: "h",
            // missing email, issued_at, expires_at
          },
        }).password_reset
      ).toBeNull()
    })

    it("normalizes valid state", () => {
      const parsed = readPasswordResetMetadata({
        password_reset: {
          token_hash: "hash",
          email: "USER@example.com",
          issued_at: "2026-05-12T05:00:00.000Z",
          expires_at: "2026-05-12T06:00:00.000Z",
          consumed_at: null,
        },
      })
      expect(parsed.password_reset?.email).toBe("user@example.com")
      expect(parsed.password_reset?.consumed_at).toBeNull()
    })
  })

  describe("verifyPasswordResetToken", () => {
    function buildCustomerWithToken(options?: {
      email?: string
      ttlMinutes?: number
      rawToken?: string
      consumedAt?: string | null
      now?: Date
    }) {
      const rawToken = options?.rawToken || generatePasswordResetRawToken()
      const tokenHash = hashPasswordResetToken(rawToken)
      const metadata = buildPasswordResetIssueMetadata({
        currentMetadata: {},
        email: options?.email || "user@example.com",
        tokenHash,
        now: options?.now || new Date(),
        ttlMinutes: options?.ttlMinutes ?? 60,
      })

      if (options?.consumedAt !== undefined && metadata.password_reset) {
        ;(metadata.password_reset as Record<string, unknown>).consumed_at =
          options.consumedAt
      }

      return {
        rawToken,
        customer: {
          id: "cus_reset",
          email: options?.email || "user@example.com",
          metadata,
        },
      }
    }

    it("accepts a valid unexpired token with matching email", () => {
      const { customer, rawToken } = buildCustomerWithToken()
      const result = verifyPasswordResetToken({ customer, rawToken })
      expect(result.ok).toBe(true)
    })

    it("rejects when no state stored", () => {
      const result = verifyPasswordResetToken({
        customer: { id: "c", email: "user@example.com", metadata: {} },
        rawToken: "any",
      })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.reason).toBe("token_mismatch")
      }
    })

    it("rejects expired token", () => {
      const issuedAt = new Date("2026-05-12T00:00:00.000Z")
      const later = new Date("2026-05-12T01:00:01.000Z")
      const { customer, rawToken } = buildCustomerWithToken({
        ttlMinutes: 60,
        now: issuedAt,
      })

      const result = verifyPasswordResetToken({
        customer,
        rawToken,
        now: later,
      })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.reason).toBe("token_expired")
      }
    })

    it("rejects consumed token", () => {
      const { customer, rawToken } = buildCustomerWithToken({
        consumedAt: "2026-05-12T00:10:00.000Z",
      })
      const result = verifyPasswordResetToken({ customer, rawToken })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.reason).toBe("token_already_consumed")
      }
    })

    it("rejects mismatched raw token", () => {
      const { customer } = buildCustomerWithToken()
      const result = verifyPasswordResetToken({
        customer,
        rawToken: "totally-different",
      })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.reason).toBe("token_mismatch")
      }
    })

    it("rejects when current customer email differs from stored", () => {
      const { customer, rawToken } = buildCustomerWithToken({
        email: "initial@example.com",
      })

      const result = verifyPasswordResetToken({
        customer: { ...customer, email: "changed@example.com" },
        rawToken,
      })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.reason).toBe("email_mismatch")
      }
    })

    it("rejects when customer has no email", () => {
      const { customer, rawToken } = buildCustomerWithToken()

      const result = verifyPasswordResetToken({
        customer: { ...customer, email: null },
        rawToken,
      })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.reason).toBe("email_mismatch")
      }
    })
  })

  describe("validatePasswordStrength", () => {
    const baseRuntime = {
      passwordMinLength: 8,
      passwordRequireLetter: true,
      passwordRequireDigit: true,
    }

    it("accepts password that satisfies requirements", () => {
      expect(validatePasswordStrength("Abcdef12", baseRuntime).ok).toBe(true)
    })

    it("rejects too-short password", () => {
      const result = validatePasswordStrength("Ab12", baseRuntime)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.reason).toBe("password_too_short")
      }
    })

    it("rejects too-long password", () => {
      const long = "A".repeat(PASSWORD_MAX_LENGTH + 1) + "1"
      const result = validatePasswordStrength(long, baseRuntime)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.reason).toBe("password_too_long")
      }
    })

    it("rejects when missing letter", () => {
      const result = validatePasswordStrength("12345678", baseRuntime)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.reason).toBe("password_missing_letter")
      }
    })

    it("rejects when missing digit", () => {
      const result = validatePasswordStrength("abcdefgh", baseRuntime)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.reason).toBe("password_missing_digit")
      }
    })

    it("skips letter/digit requirement when disabled", () => {
      expect(
        validatePasswordStrength("aaaaaaaa", {
          passwordMinLength: 8,
          passwordRequireLetter: true,
          passwordRequireDigit: false,
        }).ok
      ).toBe(true)
    })

    it("accepts cyrillic letters", () => {
      expect(
        validatePasswordStrength("Приветик1", baseRuntime).ok
      ).toBe(true)
    })
  })

  describe("buildPasswordResetLink", () => {
    it("includes country segment and token param", () => {
      const link = buildPasswordResetLink({
        storefrontUrl: "https://shop.example.com/",
        countryCode: "ru",
        redirectPath: "/account/reset-password",
        token: "cus_1.raw_abc",
      })

      expect(link).toBe(
        "https://shop.example.com/ru/account/reset-password?token=cus_1.raw_abc"
      )
    })

    it("omits country segment when not provided", () => {
      const link = buildPasswordResetLink({
        storefrontUrl: "https://shop.example.com",
        token: "cus_1.raw",
      })

      expect(link).toBe(
        "https://shop.example.com/account/reset-password?token=cus_1.raw"
      )
    })

    it("throws when storefront url is empty", () => {
      expect(() =>
        buildPasswordResetLink({ storefrontUrl: "", token: "cus.raw" })
      ).toThrow()
    })
  })

  describe("render helpers", () => {
    it("renders plain text with greeting and link", () => {
      const text = renderPasswordResetPlainText({
        link: "https://shop.example.com/ru/account/reset-password?token=abc",
        ttlMinutes: 60,
        firstName: "Иван",
      })

      expect(text).toContain("Здравствуйте, Иван!")
      expect(text).toContain("Создать новый пароль")
      expect(text).toContain(
        "https://shop.example.com/ru/account/reset-password?token=abc"
      )
      expect(text).toContain("1 час")
      expect(text).toContain("пароль не будет изменён")
    })

    it("renders branded HTML with DOCTYPE and CTA", () => {
      const html = renderPasswordResetHtml({
        link: "https://shop.example.com/ru/account/reset-password?token=abc",
        ttlMinutes: 60,
        firstName: "Иван",
      })

      expect(html).toContain("<!DOCTYPE html>")
      expect(html).toContain("Восстановление пароля")
      expect(html).toContain("Создать новый пароль")
      expect(html).toContain(
        "https://shop.example.com/ru/account/reset-password?token=abc"
      )
    })

    it("renders HTML and escapes user input", () => {
      const html = renderPasswordResetHtml({
        link: "https://shop.example.com/ru/account/reset-password?token=abc&x=1",
        ttlMinutes: 30,
        firstName: "<script>alert(1)</script>",
      })

      expect(html).toContain("&lt;script&gt;")
      expect(html).toContain("30 мин.")
      expect(html).toContain("token=abc&amp;x=1")
    })
  })
})
