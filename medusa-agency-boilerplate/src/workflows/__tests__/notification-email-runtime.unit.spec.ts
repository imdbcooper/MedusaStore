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
})
