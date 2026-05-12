import { afterEach, describe, expect, it } from "@jest/globals"
import {
  renderOrderCanceledEmail,
  renderOrderPlacedEmail,
  renderOrderShippedEmail,
  renderPaymentFailedEmail,
} from "../order-email-templates"

const ORIGINAL_ENV = { ...process.env }

describe("order-email-templates", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  describe("renderOrderPlacedEmail", () => {
    it("uses display_id in subject and heading", () => {
      const { subject, html, text } = renderOrderPlacedEmail({
        orderId: "ord_1",
        displayId: 2024,
        storefrontUrl: "https://shop.example.com",
      })

      expect(subject).toBe("Заказ #2024 принят")
      expect(html).toContain("Заказ #2024 принят")
      expect(text).toContain("Заказ #2024 принят")
      expect(html).toContain(
        "https://shop.example.com/ru/account/orders/ord_1"
      )
    })

    it("falls back to order id when display_id is null", () => {
      const { subject } = renderOrderPlacedEmail({
        orderId: "ord_abc",
        displayId: null,
      })

      expect(subject).toBe("Заказ #ord_abc принят")
    })

    it("omits action when storefront url is empty", () => {
      const { html, text } = renderOrderPlacedEmail({
        orderId: "ord_1",
        displayId: 1,
        storefrontUrl: null,
      })

      expect(html).not.toContain("/ru/account/orders/")
      expect(text).not.toContain("/ru/account/orders/")
    })
  })

  describe("renderOrderShippedEmail", () => {
    it("renders shipped subject with display id", () => {
      const { subject, html } = renderOrderShippedEmail({
        orderId: "ord_2",
        displayId: 5000,
        fulfillmentId: "ful_1",
        storefrontUrl: "https://shop.example.com",
      })

      expect(subject).toBe("Заказ #5000 передан в доставку")
      expect(html).toContain("Заказ #5000 передан в доставку")
      expect(html).toContain(
        "https://shop.example.com/ru/account/orders/ord_2"
      )
    })
  })

  describe("renderOrderCanceledEmail", () => {
    it("formats canceled_at timestamp in UTC", () => {
      const { html, text, subject } = renderOrderCanceledEmail({
        orderId: "ord_3",
        displayId: 777,
        canceledAt: "2026-04-18T06:05:00.000Z",
        storefrontUrl: "https://shop.example.com",
      })

      expect(subject).toBe("Заказ #777 отменён")
      expect(html).toContain("18.04.2026 06:05 UTC")
      expect(text).toContain("18.04.2026 06:05 UTC")
    })

    it("omits date line when canceled_at is missing", () => {
      const { html, text } = renderOrderCanceledEmail({
        orderId: "ord_3",
        displayId: 777,
        canceledAt: null,
      })

      expect(html).not.toContain("Дата отмены:")
      expect(text).not.toContain("Дата отмены:")
    })
  })

  describe("renderPaymentFailedEmail", () => {
    it("renders a non-blaming subject and links back to the cart", () => {
      const { subject, html, text } = renderPaymentFailedEmail({
        cartId: "cart_1",
        orderId: null,
        paymentProvider: "pp_yookassa_yookassa",
        storefrontUrl: "https://shop.example.com",
      })

      expect(subject).toBe("Оплата не прошла")
      expect(html).toContain("Оплата не прошла")
      expect(html).toContain("https://shop.example.com/ru/cart")
      expect(text).toContain("Оплата не прошла")
    })

    it("works without storefront url", () => {
      const { html, text } = renderPaymentFailedEmail({
        cartId: "cart_1",
        storefrontUrl: null,
      })

      expect(html).not.toContain("/ru/cart")
      expect(text).not.toContain("/ru/cart")
    })
  })

  describe("cross-template invariants", () => {
    it("every rendered email includes a DOCTYPE and branded signoff", () => {
      const results = [
        renderOrderPlacedEmail({ orderId: "o", displayId: 1 }),
        renderOrderShippedEmail({
          orderId: "o",
          displayId: 1,
          fulfillmentId: "f",
        }),
        renderOrderCanceledEmail({ orderId: "o", displayId: 1 }),
        renderPaymentFailedEmail({ cartId: "c" }),
      ]

      for (const email of results) {
        expect(email.html).toContain("<!DOCTYPE html>")
        expect(email.text).toContain("— Команда")
      }
    })
  })
})
