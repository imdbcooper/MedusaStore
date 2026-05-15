/**
 * Unit tests for product-review moderation email templates.
 *
 * Plan §1.1 п.9 + §9 Phase 2 шаг 6:
 *   - subject is fixed Russian text per the plan;
 *   - HTML and plain-text bodies are produced via the shared
 *     [`renderBrandedEmail`](medusa-agency-boilerplate/src/modules/email-template.ts:734)
 *     pipeline, so escaping is inherited;
 *   - product CTA is rendered ONLY when both `productHandle` and a valid
 *     `storefrontUrl` are provided;
 *   - product label falls back to `productId` when `productTitle` is empty;
 *   - rejection reason is included verbatim (HTML-escaped) when provided
 *     and omitted otherwise.
 */

import { describe, expect, it } from "@jest/globals"
import {
  buildReviewApprovedEmail,
  buildReviewRejectedEmail,
} from "../review-email-templates"

describe("buildReviewApprovedEmail", () => {
  it("uses the plan-mandated subject", () => {
    const { subject } = buildReviewApprovedEmail({
      customerName: "Анна",
      productId: "prod_1",
      productTitle: "Шампунь",
      productHandle: "shampoo",
      storefrontUrl: "https://shop.example.com",
    })

    expect(subject).toBe("Ваш отзыв опубликован")
  })

  it("greets the customer by name and uses the product title in the body", () => {
    const { html, text } = buildReviewApprovedEmail({
      customerName: "Анна",
      productId: "prod_1",
      productTitle: "Шампунь Floral",
      productHandle: "shampoo",
      storefrontUrl: "https://shop.example.com",
    })

    expect(html).toContain("Здравствуйте, Анна!")
    expect(html).toContain("Шампунь Floral")
    expect(text).toContain("Здравствуйте, Анна!")
    expect(text).toContain("Шампунь Floral")
  })

  it("falls back to the productId when productTitle is empty", () => {
    const { html } = buildReviewApprovedEmail({
      customerName: "Анна",
      productId: "prod_42",
      productTitle: null,
      productHandle: null,
      storefrontUrl: "https://shop.example.com",
    })

    expect(html).toContain("prod_42")
  })

  it("renders the CTA when handle and storefront URL are present", () => {
    const { html, text } = buildReviewApprovedEmail({
      customerName: "Анна",
      productId: "prod_1",
      productTitle: "Шампунь",
      productHandle: "shampoo",
      storefrontUrl: "https://shop.example.com",
    })

    const expectedUrl = "https://shop.example.com/ru/products/shampoo"
    expect(html).toContain(expectedUrl)
    expect(html).toContain("Перейти к товару")
    expect(text).toContain(expectedUrl)
  })

  it("omits the CTA when handle is missing", () => {
    const { html, text } = buildReviewApprovedEmail({
      customerName: "Анна",
      productId: "prod_1",
      productTitle: "Шампунь",
      productHandle: null,
      storefrontUrl: "https://shop.example.com",
    })

    expect(html).not.toContain("Перейти к товару")
    expect(html).not.toContain("/ru/products/")
    expect(text).not.toContain("Перейти к товару")
  })

  it("falls back to a generic greeting when customerName is empty", () => {
    const { html } = buildReviewApprovedEmail({
      customerName: "  ",
      productId: "prod_1",
      productHandle: "shampoo",
      storefrontUrl: "https://shop.example.com",
    })

    expect(html).toContain("Здравствуйте, покупатель")
  })
})

describe("buildReviewRejectedEmail", () => {
  it("uses the plan-mandated subject", () => {
    const { subject } = buildReviewRejectedEmail({
      customerName: "Анна",
      productId: "prod_1",
      productHandle: "shampoo",
      storefrontUrl: "https://shop.example.com",
      rejectionReason: "Off-topic",
    })

    expect(subject).toBe("Ваш отзыв отклонён")
  })

  it("renders the rejection reason verbatim (HTML-escaped) when provided", () => {
    const { html, text } = buildReviewRejectedEmail({
      customerName: "Анна",
      productId: "prod_1",
      productTitle: "Шампунь",
      productHandle: "shampoo",
      storefrontUrl: "https://shop.example.com",
      rejectionReason: "Off-topic & spam",
    })

    expect(html).toContain("Off-topic &amp; spam")
    expect(text).toContain("Off-topic & spam")
    expect(html).toContain("по следующей причине")
  })

  it("omits the reason block when rejectionReason is empty", () => {
    const { html, text } = buildReviewRejectedEmail({
      customerName: "Анна",
      productId: "prod_1",
      productTitle: "Шампунь",
      productHandle: "shampoo",
      storefrontUrl: "https://shop.example.com",
      rejectionReason: "  ",
    })

    expect(html).not.toContain("по следующей причине")
    expect(text).toContain("Вы можете оставить новый отзыв")
  })

  it("renders the CTA when handle and storefront URL are present", () => {
    const { html } = buildReviewRejectedEmail({
      customerName: "Анна",
      productId: "prod_1",
      productHandle: "shampoo",
      storefrontUrl: "https://shop.example.com",
      rejectionReason: "Spam",
    })

    expect(html).toContain("https://shop.example.com/ru/products/shampoo")
    expect(html).toContain("Перейти к товару")
  })

  it("omits the CTA when storefront URL is missing", () => {
    const { html } = buildReviewRejectedEmail({
      customerName: "Анна",
      productId: "prod_1",
      productHandle: "shampoo",
      storefrontUrl: null,
      rejectionReason: "Spam",
    })

    expect(html).not.toContain("Перейти к товару")
  })
})
