import { afterEach, describe, expect, it, jest } from "@jest/globals"
import {
  DEFAULT_VK_API_VERSION,
  getNotificationVkProviderDefinition,
  getNotificationVkRuntime,
  normalizeVkPeerId,
  resolveCustomerVkPeerId,
} from "../../modules/notification-vk"

describe("notification vk runtime provider resolution", () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
    jest.restoreAllMocks()
  })

  it("resolves disabled as baseline default when provider is omitted", () => {
    delete process.env.NOTIFICATION_VK_PROVIDER
    delete process.env.VK_COMMUNITY_ACCESS_TOKEN
    delete process.env.VK_COMMUNITY_GROUP_ID
    delete process.env.VK_API_VERSION

    const runtime = getNotificationVkRuntime()
    const provider = getNotificationVkProviderDefinition()

    expect(runtime.requestedProviderId).toBe("disabled")
    expect(runtime.providerId).toBe("disabled")
    expect(runtime.communityConfigured).toBe(false)
    expect(runtime.apiVersion).toBe(DEFAULT_VK_API_VERSION)
    expect(provider).toBeNull()
  })

  it("resolves community provider when requested and configured", () => {
    process.env.NOTIFICATION_VK_PROVIDER = "community"
    process.env.VK_COMMUNITY_ACCESS_TOKEN = "vk-token"
    process.env.VK_COMMUNITY_GROUP_ID = " 123456 "
    process.env.VK_API_VERSION = "5.200"

    const runtime = getNotificationVkRuntime()
    const provider = getNotificationVkProviderDefinition()

    expect(runtime.requestedProviderId).toBe("community")
    expect(runtime.providerId).toBe("community")
    expect(runtime.communityConfigured).toBe(true)
    expect(runtime.accessToken).toBe("vk-token")
    expect(runtime.groupId).toBe("123456")
    expect(runtime.apiVersion).toBe("5.200")
    expect(provider).toEqual({
      resolve: "./src/modules/notification-vk-community",
      id: "vk-community",
      options: {
        channels: ["vk"],
        access_token: "vk-token",
        group_id: "123456",
        api_version: "5.200",
      },
    })
  })

  it("falls back to disabled when community is requested without required credentials", () => {
    process.env.NOTIFICATION_VK_PROVIDER = "community"
    delete process.env.VK_COMMUNITY_ACCESS_TOKEN
    process.env.VK_COMMUNITY_GROUP_ID = "123456"
    delete process.env.VK_API_VERSION

    const runtime = getNotificationVkRuntime()
    const provider = getNotificationVkProviderDefinition()

    expect(runtime.requestedProviderId).toBe("community")
    expect(runtime.providerId).toBe("disabled")
    expect(runtime.communityConfigured).toBe(false)
    expect(provider).toBeNull()
  })

  it("normalizes and resolves vk peer ids from customer metadata", () => {
    expect(normalizeVkPeerId(" 00123 ")).toBe("123")
    expect(normalizeVkPeerId("abc")).toBeNull()
    expect(
      resolveCustomerVkPeerId({
        vk_peer_id: " 2000000005 ",
      })
    ).toBe("2000000005")
    expect(resolveCustomerVkPeerId({ vk_peer_id: null })).toBeNull()
  })
})
