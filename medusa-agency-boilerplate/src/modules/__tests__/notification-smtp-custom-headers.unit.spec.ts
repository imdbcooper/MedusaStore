import { describe, expect, it } from "@jest/globals"
import type { NotificationTypes } from "@medusajs/framework/types"
import { extractSmtpCustomHeaders } from "../notification-smtp"

function buildNotification(
  data: Record<string, unknown>
): NotificationTypes.ProviderSendNotificationDTO {
  return {
    to: "user@example.com",
    channel: "email",
    template: "marketing-v1",
    content: {
      subject: "subject",
      text: "text",
      html: "<p>html</p>",
    },
    data,
  } as unknown as NotificationTypes.ProviderSendNotificationDTO
}

describe("extractSmtpCustomHeaders", () => {
  it("returns empty object when data has no headers", () => {
    expect(
      extractSmtpCustomHeaders(buildNotification({ marketing: true }))
    ).toEqual({})
  })

  it("returns allow-listed headers with canonical casing", () => {
    const result = extractSmtpCustomHeaders(
      buildNotification({
        headers: {
          "list-unsubscribe":
            "<mailto:u@example.com>, <https://example.com/unsubscribe?token=abc>",
          "list-unsubscribe-post": "List-Unsubscribe=One-Click",
          "x-campaign-id": "mc_1",
        },
      })
    )

    expect(result["List-Unsubscribe"]).toContain(
      "<https://example.com/unsubscribe?token=abc>"
    )
    expect(result["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click")
    expect(result["X-Campaign-Id"]).toBe("mc_1")
  })

  it("drops unknown headers and non-string values", () => {
    const result = extractSmtpCustomHeaders(
      buildNotification({
        headers: {
          "list-unsubscribe": "<https://ok/>",
          "x-evil": "value",
          precedence: "bulk",
          // non-string value ignored
          "list-help": 123,
          // newline smuggling stripped
          "list-id": "list id\r\nX-Injected: yes",
        },
      })
    )

    expect(result["X-Evil"]).toBeUndefined()
    expect(result["Precedence"]).toBe("bulk")
    expect(result["List-Help"]).toBeUndefined()
    expect(result["List-Id"]).toBe("list id X-Injected: yes")
    expect(result["List-Id"]).not.toContain("\n")
  })

  it("accepts headers from _smtp_headers alternate key", () => {
    const result = extractSmtpCustomHeaders(
      buildNotification({
        _smtp_headers: {
          "list-unsubscribe": "<https://example.com/unsubscribe>",
        },
      })
    )

    expect(result["List-Unsubscribe"]).toBe("<https://example.com/unsubscribe>")
  })

  it("truncates overly long values", () => {
    const longValue = "<https://example.com/?token=" + "a".repeat(2000) + ">"
    const result = extractSmtpCustomHeaders(
      buildNotification({
        headers: {
          "list-unsubscribe": longValue,
        },
      })
    )

    expect(result["List-Unsubscribe"]!.length).toBeLessThanOrEqual(1024)
  })
})
