import { afterEach, describe, expect, it, jest } from "@jest/globals"

/**
 * Pure helper tests for marketing campaign resolvers. These cover the two
 * review-fix behaviours:
 *   1. No hardcoded mailto default — `resolveMarketingUnsubscribeMailto`
 *      returns null when the env is empty.
 *   2. Country code derivation order — customer metadata first, then env,
 *      then `ru` fallback.
 *
 * We stub out Medusa workflow/notification dependencies so importing
 * `send-marketing-campaign.ts` does not require a running container.
 */
jest.mock("@medusajs/framework/workflows-sdk", () => ({
  __esModule: true,
  createStep: (_name: string, _fn: unknown) => () => undefined,
  createWorkflow: (_name: string, _fn: unknown) => () => undefined,
  StepResponse: class StepResponse {
    constructor(public readonly value: unknown) {}
  },
  WorkflowResponse: class WorkflowResponse {
    constructor(public readonly value: unknown) {}
  },
}))

jest.mock("@medusajs/framework/utils", () => ({
  __esModule: true,
  ContainerRegistrationKeys: { LOGGER: "logger", QUERY: "query" },
  Modules: { NOTIFICATION: "notification" },
}))

jest.mock("@medusajs/medusa/core-flows", () => ({
  __esModule: true,
  updateCustomersWorkflow: () => ({
    run: jest.fn(async () => ({ result: [] })),
  }),
}))

jest.mock("../../modules/marketing-layer", () => ({
  __esModule: true,
  DEFAULT_MARKETING_RESOURCE_TYPE: "marketing_campaign",
  DEFAULT_MARKETING_TRIGGER_TYPE: "marketing",
  claimMarketingCampaignForLaunch: jest.fn(),
  countRecentMarketingDeliveries: jest.fn(),
  getMarketingCampaignById: jest.fn(),
  getMarketingPgConnection: jest.fn(),
  insertMarketingDeliveryJournal: jest.fn(),
  resolveMarketingAudience: jest.fn(),
  updateMarketingCampaignStatus: jest.fn(),
}))

jest.mock("../../modules/marketing-preferences", () => ({
  __esModule: true,
  applyMarketingSendMetadataUpdate: jest.fn(() => ({})),
  isCustomerChannelSubscribed: jest.fn(() => true),
  isCustomerGloballySubscribed: jest.fn(() => true),
  isMarketingSuppressedNow: jest.fn(() => false),
  persistCustomerMarketingMetadata: jest.fn(async () => undefined),
}))

jest.mock("../../modules/notification-email", () => ({
  __esModule: true,
  getNotificationEmailRuntime: () => ({
    providerId: "local",
    requestedProviderId: "local",
    from: null,
    smtpFrom: null,
  }),
}))

jest.mock("../../modules/notification-sms", () => ({
  __esModule: true,
  DEFAULT_NOTIFICATION_SMS_CHANNEL: "sms",
  getNotificationSmsRuntime: () => ({
    providerId: "disabled",
    requestedProviderId: "disabled",
    sender: null,
  }),
}))

jest.mock("../../modules/notification-vk", () => ({
  __esModule: true,
  getNotificationVkRuntime: () => ({
    providerId: "disabled",
    requestedProviderId: "disabled",
  }),
}))

jest.mock("../../modules/marketing-unsubscribe", () => ({
  __esModule: true,
  buildPublicUnsubscribeToken: jest.fn(),
  buildUnsubscribeIssueMetadata: jest.fn(),
  buildUnsubscribeUrl: jest.fn(),
  generateUnsubscribeToken: jest.fn(),
  getMarketingUnsubscribeRuntime: () => ({
    tokenTtlDays: 365,
    redirectPath: "/unsubscribe",
  }),
  hashUnsubscribeToken: jest.fn(),
}))

jest.mock("../../modules/email-template", () => ({
  __esModule: true,
  renderBrandedEmail: () => ({ html: "", text: "" }),
}))

const {
  resolveMarketingCountryCode,
  resolveMarketingUnsubscribeMailto,
} = require("../send-marketing-campaign") as {
  resolveMarketingCountryCode: (metadata: unknown) => string
  resolveMarketingUnsubscribeMailto: () => string | null
}

const ORIGINAL_ENV = { ...process.env }

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

describe("resolveMarketingUnsubscribeMailto", () => {
  it("returns null when env is unset (no hardcoded default)", () => {
    delete process.env.MARKETING_UNSUBSCRIBE_MAILTO
    expect(resolveMarketingUnsubscribeMailto()).toBeNull()
  })

  it("returns null when env is empty string", () => {
    process.env.MARKETING_UNSUBSCRIBE_MAILTO = "   "
    expect(resolveMarketingUnsubscribeMailto()).toBeNull()
  })

  it("returns env value when configured", () => {
    process.env.MARKETING_UNSUBSCRIBE_MAILTO = "unsubscribe@example.com"
    expect(resolveMarketingUnsubscribeMailto()).toBe(
      "unsubscribe@example.com"
    )
  })
})

describe("resolveMarketingCountryCode", () => {
  it("returns `ru` by default when metadata and env are empty", () => {
    delete process.env.MARKETING_DEFAULT_COUNTRY_CODE
    expect(resolveMarketingCountryCode(null)).toBe("ru")
    expect(resolveMarketingCountryCode(undefined)).toBe("ru")
    expect(resolveMarketingCountryCode({})).toBe("ru")
  })

  it("respects MARKETING_DEFAULT_COUNTRY_CODE env override", () => {
    process.env.MARKETING_DEFAULT_COUNTRY_CODE = "US"
    expect(resolveMarketingCountryCode({})).toBe("us")
  })

  it("prefers customer.metadata.marketing.preferred_country_code over env", () => {
    process.env.MARKETING_DEFAULT_COUNTRY_CODE = "us"
    const metadata = { marketing: { preferred_country_code: "KZ" } }
    expect(resolveMarketingCountryCode(metadata)).toBe("kz")
  })

  it("falls back when metadata shape is malformed", () => {
    delete process.env.MARKETING_DEFAULT_COUNTRY_CODE
    expect(
      resolveMarketingCountryCode({ marketing: "not-an-object" as unknown })
    ).toBe("ru")
    expect(
      resolveMarketingCountryCode({ marketing: { preferred_country_code: "" } })
    ).toBe("ru")
  })
})
