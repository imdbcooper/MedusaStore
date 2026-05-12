import { describe, expect, it, afterEach, jest } from "@jest/globals"
import {
  DEFAULT_NOTIFICATION_EMAIL_FROM,
  DEFAULT_UNISENDER_BASE_URL,
  getNotificationEmailProviderDefinition,
  getNotificationEmailRuntime,
} from "../../modules/notification-email"

describe("notification email runtime provider resolution", () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
    jest.restoreAllMocks()
  })

  it("resolves local as baseline default when provider is omitted", () => {
    delete process.env.NOTIFICATION_EMAIL_PROVIDER
    delete process.env.NOTIFICATION_EMAIL_FROM
    delete process.env.UNISENDER_API_KEY
    delete process.env.UNISENDER_BASE_URL

    const runtime = getNotificationEmailRuntime()
    const provider = getNotificationEmailProviderDefinition()

    expect(runtime.requestedProviderId).toBe("local")
    expect(runtime.providerId).toBe("local")
    expect(runtime.unisenderConfigured).toBe(false)
    expect(runtime.from).toBe(DEFAULT_NOTIFICATION_EMAIL_FROM)
    expect(provider.id).toBe("local")
    expect(provider.resolve).toBe("@medusajs/medusa/notification-local")
  })

  it("resolves unisender when requested and configured", () => {
    process.env.NOTIFICATION_EMAIL_PROVIDER = "unisender"
    process.env.NOTIFICATION_EMAIL_FROM = "Sender Name <sender@example.com>"
    process.env.UNISENDER_API_KEY = "test-api-key"
    process.env.UNISENDER_BASE_URL = "https://go2.unisender.ru/"

    const runtime = getNotificationEmailRuntime()
    const provider = getNotificationEmailProviderDefinition()

    expect(runtime.requestedProviderId).toBe("unisender")
    expect(runtime.providerId).toBe("unisender")
    expect(runtime.unisenderConfigured).toBe(true)
    expect(runtime.unisenderApiKey).toBe("test-api-key")
    expect(runtime.unisenderBaseUrl).toBe("https://go2.unisender.ru")
    expect(provider).toEqual({
      resolve: "./src/modules/notification-unisender",
      id: "unisender",
      options: {
        channels: ["email"],
        api_key: "test-api-key",
        from: "Sender Name <sender@example.com>",
        base_url: "https://go2.unisender.ru",
      },
    })
  })

  it("falls back to local when unisender is requested without credentials", () => {
    process.env.NOTIFICATION_EMAIL_PROVIDER = "unisender"
    process.env.NOTIFICATION_EMAIL_FROM = "notifications@example.com"
    delete process.env.UNISENDER_API_KEY
    delete process.env.UNISENDER_BASE_URL

    const runtime = getNotificationEmailRuntime()
    const provider = getNotificationEmailProviderDefinition()

    expect(runtime.requestedProviderId).toBe("unisender")
    expect(runtime.providerId).toBe("local")
    expect(runtime.unisenderConfigured).toBe(false)
    expect(runtime.unisenderApiKey).toBeUndefined()
    expect(runtime.unisenderBaseUrl).toBe(DEFAULT_UNISENDER_BASE_URL)
    expect(provider.id).toBe("local")
    expect(provider.resolve).toBe("@medusajs/medusa/notification-local")
  })

  it("resolves smtp when requested and fully configured", () => {
    process.env.NOTIFICATION_EMAIL_PROVIDER = "smtp"
    process.env.NOTIFICATION_EMAIL_FROM = "notifications@example.com"
    process.env.SMTP_HOST = "smtp.slavx.ru"
    process.env.SMTP_PORT = "587"
    process.env.SMTP_SECURE = "false"
    process.env.SMTP_USER = "noreply@notify.slavx.ru"
    process.env.SMTP_PASSWORD = "test-password"
    process.env.SMTP_FROM = "noreply@notify.slavx.ru"
    process.env.SMTP_FROM_NAME = "MedusaStore"
    process.env.SMTP_REPLY_TO = "support@example.com"
    process.env.SMTP_TLS_REJECT_UNAUTHORIZED = "true"

    const runtime = getNotificationEmailRuntime()
    const provider = getNotificationEmailProviderDefinition()

    expect(runtime.requestedProviderId).toBe("smtp")
    expect(runtime.providerId).toBe("smtp")
    expect(runtime.smtpConfigured).toBe(true)
    expect(runtime.smtpHost).toBe("smtp.slavx.ru")
    expect(runtime.smtpPort).toBe(587)
    expect(runtime.smtpSecure).toBe(false)
    expect(runtime.smtpTlsRejectUnauthorized).toBe(true)
    expect(provider).toEqual({
      resolve: "./src/modules/notification-smtp",
      id: "smtp",
      options: {
        channels: ["email"],
        host: "smtp.slavx.ru",
        port: 587,
        secure: false,
        user: "noreply@notify.slavx.ru",
        password: "test-password",
        from: "noreply@notify.slavx.ru",
        from_name: "MedusaStore",
        reply_to: "support@example.com",
        tls_reject_unauthorized: true,
      },
    })
  })

  it("falls back to local when smtp is requested without required settings", () => {
    process.env.NOTIFICATION_EMAIL_PROVIDER = "smtp"
    process.env.SMTP_HOST = "smtp.slavx.ru"
    process.env.SMTP_PORT = "587"
    process.env.SMTP_USER = "noreply@notify.slavx.ru"
    delete process.env.SMTP_PASSWORD
    process.env.SMTP_FROM = "noreply@notify.slavx.ru"

    const runtime = getNotificationEmailRuntime()
    const provider = getNotificationEmailProviderDefinition()

    expect(runtime.requestedProviderId).toBe("smtp")
    expect(runtime.providerId).toBe("local")
    expect(runtime.smtpConfigured).toBe(false)
    expect(provider.id).toBe("local")
    expect(provider.resolve).toBe("@medusajs/medusa/notification-local")
  })
})
