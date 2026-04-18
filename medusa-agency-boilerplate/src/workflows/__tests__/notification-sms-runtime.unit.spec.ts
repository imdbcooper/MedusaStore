import { afterEach, describe, expect, it, jest } from "@jest/globals"
import {
  DEFAULT_MTS_EXOLVE_BASE_URL,
  getNotificationSmsProviderDefinition,
  getNotificationSmsRuntime,
  normalizeSmsPhone,
} from "../../modules/notification-sms"

describe("notification sms runtime provider resolution", () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
    jest.restoreAllMocks()
  })

  it("resolves disabled as baseline default when provider is omitted", () => {
    delete process.env.NOTIFICATION_SMS_PROVIDER
    delete process.env.MTS_EXOLVE_API_KEY
    delete process.env.MTS_EXOLVE_SENDER
    delete process.env.MTS_EXOLVE_BASE_URL

    const runtime = getNotificationSmsRuntime()
    const provider = getNotificationSmsProviderDefinition()

    expect(runtime.requestedProviderId).toBe("disabled")
    expect(runtime.providerId).toBe("disabled")
    expect(runtime.exolveConfigured).toBe(false)
    expect(runtime.baseUrl).toBe(DEFAULT_MTS_EXOLVE_BASE_URL)
    expect(runtime.providerLabel).toBe("disabled")
    expect(provider).toBeNull()
  })

  it("resolves exolve provider when requested and configured", () => {
    process.env.NOTIFICATION_SMS_PROVIDER = "exolve"
    process.env.MTS_EXOLVE_API_KEY = "sms-api-key"
    process.env.MTS_EXOLVE_SENDER = "MyShop"
    process.env.MTS_EXOLVE_BASE_URL = "https://api.exolve.ru/messaging/v1/SendSMS/"

    const runtime = getNotificationSmsRuntime()
    const provider = getNotificationSmsProviderDefinition()

    expect(runtime.requestedProviderId).toBe("exolve")
    expect(runtime.providerId).toBe("exolve")
    expect(runtime.exolveConfigured).toBe(true)
    expect(runtime.apiKey).toBe("sms-api-key")
    expect(runtime.sender).toBe("MyShop")
    expect(runtime.baseUrl).toBe("https://api.exolve.ru/messaging/v1/SendSMS")
    expect(runtime.providerLabel).toBe("MTS Exolve SMS")
    expect(provider).toEqual({
      resolve: "./src/modules/notification-exolve",
      id: "exolve",
      options: {
        channels: ["sms"],
        api_key: "sms-api-key",
        sender: "MyShop",
        base_url: "https://api.exolve.ru/messaging/v1/SendSMS",
      },
    })
  })

  it("falls back to disabled when exolve is requested without required credentials", () => {
    process.env.NOTIFICATION_SMS_PROVIDER = "exolve"
    process.env.MTS_EXOLVE_API_KEY = "sms-api-key"
    delete process.env.MTS_EXOLVE_SENDER
    delete process.env.MTS_EXOLVE_BASE_URL

    const runtime = getNotificationSmsRuntime()
    const provider = getNotificationSmsProviderDefinition()

    expect(runtime.requestedProviderId).toBe("exolve")
    expect(runtime.providerId).toBe("disabled")
    expect(runtime.exolveConfigured).toBe(false)
    expect(runtime.baseUrl).toBe(DEFAULT_MTS_EXOLVE_BASE_URL)
    expect(provider).toBeNull()
  })

  it("normalizes Russian phone inputs into transport-safe E.164-like format", () => {
    expect(normalizeSmsPhone("8 (912) 345-67-89")).toBe("+79123456789")
    expect(normalizeSmsPhone("+7 912 345 67 89")).toBe("+79123456789")
    expect(normalizeSmsPhone("9123456789")).toBe("+79123456789")
    expect(normalizeSmsPhone("abc")).toBeNull()
    expect(normalizeSmsPhone("12345")).toBeNull()
  })
})
