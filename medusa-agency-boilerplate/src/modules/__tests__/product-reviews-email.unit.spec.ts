/**
 * Unit tests for
 * [`sendReviewModerationEmail`](medusa-agency-boilerplate/src/modules/product-reviews-email.ts:170)
 *
 * Plan §1.1 п.9 + §9 Phase 2 шаг 6 — best-effort transactional email after
 * an admin moderation decision. Important branches:
 *   - `customer_anonymized` — `review.customer_id === null` ⇒ skip;
 *   - `config_missing` — empty `STOREFRONT_URL` env ⇒ skip;
 *   - `customer_not_found` — query graph returns no row ⇒ skip;
 *   - `customer_email_missing` — customer exists with empty / null email ⇒ skip;
 *   - `send_failed` — `notificationModule.createNotifications` throws ⇒
 *     returned as `{ ok: false, error: 'send_failed' }` (NOT thrown);
 *   - `ok` — full happy path; payload carries `template`, `trigger_type`,
 *     resource ids, and rendered `{ subject, html, text }`.
 *   - The helper NEVER throws.
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { sendReviewModerationEmail } from "../product-reviews-email"
import type { ProductReviewRow } from "../product-reviews"

const ORIGINAL_STOREFRONT_URL = process.env.STOREFRONT_URL

type ContainerOverrides = {
  query?: { graph: jest.Mock<any> } | null
  notification?: { createNotifications: jest.Mock<any> } | null
  logger?: {
    info: jest.Mock<any>
    warn: jest.Mock<any>
    error: jest.Mock<any>
  }
}

function buildContainer(overrides: ContainerOverrides = {}) {
  const logger = overrides.logger ?? {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }

  const map = new Map<unknown, unknown>()
  map.set(ContainerRegistrationKeys.LOGGER, logger)

  if (overrides.query !== null && overrides.query !== undefined) {
    map.set(ContainerRegistrationKeys.QUERY, overrides.query)
  }
  if (
    overrides.notification !== null &&
    overrides.notification !== undefined
  ) {
    map.set(Modules.NOTIFICATION, overrides.notification)
  }

  return {
    resolve: (key: unknown) => {
      if (!map.has(key)) {
        throw new Error(`unknown_key:${String(key)}`)
      }
      return map.get(key)
    },
    __logger: logger,
  }
}

function buildReviewRow(
  overrides: Partial<ProductReviewRow> = {}
): ProductReviewRow {
  return {
    id: "pr_1",
    product_id: "prod_1",
    customer_id: "cust_1",
    order_id: null,
    rating: 5,
    title: null,
    text: "ok",
    pros: null,
    cons: null,
    status: "approved",
    moderated_by: "usr_admin",
    moderated_at: "2026-05-15T01:00:00.000Z",
    rejection_reason: null,
    verified_purchase: true,
    helpful_count: 0,
    images: [],
    customer_name: "Анна",
    created_at: "2026-05-15T00:00:00.000Z",
    updated_at: "2026-05-15T01:00:00.000Z",
    ...overrides,
  }
}

beforeEach(() => {
  process.env.STOREFRONT_URL = "https://shop.example.com"
})

afterEach(() => {
  if (ORIGINAL_STOREFRONT_URL === undefined) {
    delete process.env.STOREFRONT_URL
  } else {
    process.env.STOREFRONT_URL = ORIGINAL_STOREFRONT_URL
  }
  jest.restoreAllMocks()
})

describe("sendReviewModerationEmail — skip branches", () => {
  it("returns customer_anonymized when review.customer_id is null", async () => {
    const container = buildContainer()
    const result = await sendReviewModerationEmail(container, {
      review: buildReviewRow({ customer_id: null }),
      type: "approved",
    })

    expect(result).toEqual({ ok: false, error: "customer_anonymized" })
    expect(container.__logger.info).toHaveBeenCalled()
  })

  it("returns config_missing when STOREFRONT_URL is empty", async () => {
    process.env.STOREFRONT_URL = ""
    const container = buildContainer()

    const result = await sendReviewModerationEmail(container, {
      review: buildReviewRow(),
      type: "approved",
    })

    expect(result).toEqual({ ok: false, error: "config_missing" })
  })

  it("returns customer_not_found when query graph returns no rows", async () => {
    const query = {
      graph: jest.fn(async () => ({ data: [] })),
    } as unknown as { graph: jest.Mock<any> }
    const notification = {
      createNotifications: jest.fn(async () => ({ id: "noti_1" })),
    } as unknown as { createNotifications: jest.Mock<any> }
    const container = buildContainer({ query, notification })

    const result = await sendReviewModerationEmail(container, {
      review: buildReviewRow(),
      type: "approved",
    })

    expect(result).toEqual({
      ok: false,
      error: "customer_not_found",
    })
    expect(notification.createNotifications).not.toHaveBeenCalled()
  })

  it("returns customer_email_missing when customer has no email", async () => {
    const query = {
      graph: jest.fn(async () => ({
        data: [
          { id: "cust_1", email: "", first_name: "Анна", last_name: null },
        ],
      })),
    } as unknown as { graph: jest.Mock<any> }
    const notification = {
      createNotifications: jest.fn(async () => ({ id: "noti_1" })),
    } as unknown as { createNotifications: jest.Mock<any> }
    const container = buildContainer({ query, notification })

    const result = await sendReviewModerationEmail(container, {
      review: buildReviewRow(),
      type: "approved",
    })

    expect(result).toEqual({
      ok: false,
      error: "customer_email_missing",
    })
    expect(notification.createNotifications).not.toHaveBeenCalled()
  })

  it("returns config_missing when notification module is not registered", async () => {
    const query = {
      graph: jest.fn(async () => ({
        data: [
          {
            id: "cust_1",
            email: "buyer@example.com",
            first_name: "Анна",
            last_name: null,
          },
        ],
      })),
    } as unknown as { graph: jest.Mock<any> }
    const container = buildContainer({ query, notification: null })

    const result = await sendReviewModerationEmail(container, {
      review: buildReviewRow(),
      type: "approved",
    })

    expect(result.ok).toBe(false)
    expect((result as { error: string }).error).toBe("config_missing")
  })
})

describe("sendReviewModerationEmail — happy path", () => {
  it("sends an approved email with template, trigger_type, and rendered content", async () => {
    const productCalls: any[] = []
    const customerCalls: any[] = []
    const query = {
      graph: jest.fn(async (input: any) => {
        if (input.entity === "customer") {
          customerCalls.push(input)
          return {
            data: [
              {
                id: "cust_1",
                email: "buyer@example.com",
                first_name: "Анна",
                last_name: "Петрова",
              },
            ],
          }
        }
        if (input.entity === "product") {
          productCalls.push(input)
          return {
            data: [
              { id: "prod_1", title: "Шампунь Floral", handle: "shampoo" },
            ],
          }
        }
        return { data: [] }
      }),
    } as unknown as { graph: jest.Mock<any> }

    const notification = {
      createNotifications: jest.fn(async (payload: any) => ({
        id: "noti_1",
        ...payload,
      })),
    } as unknown as { createNotifications: jest.Mock<any> }

    const container = buildContainer({ query, notification })

    const result = await sendReviewModerationEmail(container, {
      review: buildReviewRow(),
      type: "approved",
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.recipient).toBe("buyer@example.com")
      expect(result.notificationId).toBe("noti_1")
    }

    expect(notification.createNotifications).toHaveBeenCalledTimes(1)
    const payload = notification.createNotifications.mock
      .calls[0][0] as Record<string, any>
    expect(payload.channel).toBe("email")
    expect(payload.template).toBe("review-approved-v1")
    expect(payload.trigger_type).toBe(
      "product_review.approved.customer.notification_requested"
    )
    expect(payload.resource_type).toBe("product_review")
    expect(payload.resource_id).toBe("pr_1")
    expect(payload.to).toBe("buyer@example.com")
    expect(payload.content.subject).toBe("Ваш отзыв опубликован")
    expect(typeof payload.content.html).toBe("string")
    expect(typeof payload.content.text).toBe("string")
    expect(payload.content.html).toContain("Шампунь Floral")
    expect(payload.data.review_id).toBe("pr_1")
    expect(payload.data.product_id).toBe("prod_1")
    expect(payload.data.customer_id).toBe("cust_1")
    expect(payload.data.moderation_outcome).toBe("approved")

    expect(customerCalls).toHaveLength(1)
    expect(productCalls).toHaveLength(1)
  })

  it("sends a rejected email with the rejection reason carried into the body", async () => {
    const query = {
      graph: jest.fn(async (input: any) => {
        if (input.entity === "customer") {
          return {
            data: [
              {
                id: "cust_1",
                email: "buyer@example.com",
                first_name: "Анна",
                last_name: null,
              },
            ],
          }
        }
        if (input.entity === "product") {
          return {
            data: [{ id: "prod_1", title: "Шампунь", handle: "shampoo" }],
          }
        }
        return { data: [] }
      }),
    } as unknown as { graph: jest.Mock<any> }

    const notification = {
      createNotifications: jest.fn(async (payload: any) => ({
        id: "noti_2",
        ...payload,
      })),
    } as unknown as { createNotifications: jest.Mock<any> }

    const container = buildContainer({ query, notification })

    const result = await sendReviewModerationEmail(container, {
      review: buildReviewRow({
        status: "rejected",
        rejection_reason: "Off-topic & spam",
      }),
      type: "rejected",
      rejectionReason: "Off-topic & spam",
    })

    expect(result.ok).toBe(true)
    const payload = notification.createNotifications.mock
      .calls[0][0] as Record<string, any>
    expect(payload.template).toBe("review-rejected-v1")
    expect(payload.trigger_type).toBe(
      "product_review.rejected.customer.notification_requested"
    )
    expect(payload.content.subject).toBe("Ваш отзыв отклонён")
    expect(payload.content.html).toContain("Off-topic &amp; spam")
    expect(payload.content.text).toContain("Off-topic & spam")
  })

  it("falls back to productId when product fetch returns nothing", async () => {
    const query = {
      graph: jest.fn(async (input: any) => {
        if (input.entity === "customer") {
          return {
            data: [
              {
                id: "cust_1",
                email: "buyer@example.com",
                first_name: "Анна",
                last_name: null,
              },
            ],
          }
        }
        return { data: [] }
      }),
    } as unknown as { graph: jest.Mock<any> }

    const notification = {
      createNotifications: jest.fn(async () => ({ id: "noti_3" })),
    } as unknown as { createNotifications: jest.Mock<any> }

    const container = buildContainer({ query, notification })

    const result = await sendReviewModerationEmail(container, {
      review: buildReviewRow({ product_id: "prod_unknown" }),
      type: "approved",
    })

    expect(result.ok).toBe(true)
    const payload = notification.createNotifications.mock
      .calls[0][0] as Record<string, any>
    expect(payload.content.html).toContain("prod_unknown")
    // Without a handle there must be no product CTA URL.
    expect(payload.content.html).not.toContain("/ru/products/")
  })

  it("returns send_failed without throwing when the notification module rejects", async () => {
    const query = {
      graph: jest.fn(async (input: any) => {
        if (input.entity === "customer") {
          return {
            data: [
              {
                id: "cust_1",
                email: "buyer@example.com",
                first_name: "Анна",
                last_name: null,
              },
            ],
          }
        }
        if (input.entity === "product") {
          return {
            data: [{ id: "prod_1", title: "Шампунь", handle: "shampoo" }],
          }
        }
        return { data: [] }
      }),
    } as unknown as { graph: jest.Mock<any> }

    const notification = {
      createNotifications: jest.fn(async () => {
        throw new Error("smtp_down")
      }),
    } as unknown as { createNotifications: jest.Mock<any> }

    const container = buildContainer({ query, notification })

    const result = await sendReviewModerationEmail(container, {
      review: buildReviewRow(),
      type: "approved",
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe("send_failed")
      expect(result.detail).toBe("smtp_down")
    }
    expect(container.__logger.error).toHaveBeenCalled()
  })
})
