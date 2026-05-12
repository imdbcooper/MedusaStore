/**
 * Order lifecycle email templates.
 *
 * These helpers render `{ subject, html, text }` for transactional
 * notifications triggered by Medusa order lifecycle workflows. They
 * are thin wrappers over `renderBrandedEmail` so all emails share a
 * single brand template.
 *
 * Keep the inputs minimal — only what the workflow already has today
 * (order display id, recipient email, timestamps). No business
 * logic lives here.
 */

import { renderBrandedEmail } from "./email-template"

export type OrderLifecycleEmailContent = {
  subject: string
  html: string
  text: string
}

type OrderIdentity = {
  displayId: number | string | null
  id: string
}

function formatOrderLabel(identity: OrderIdentity): string {
  const display = identity.displayId
  const suffix =
    typeof display === "number" || typeof display === "string"
      ? String(display).trim()
      : ""

  return suffix ? `#${suffix}` : `#${identity.id}`
}

function formatIsoDateTimeRu(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  // Always render in UTC to keep output deterministic for tests and
  // to avoid leaking the server's local timezone.
  const day = String(parsed.getUTCDate()).padStart(2, "0")
  const month = String(parsed.getUTCMonth() + 1).padStart(2, "0")
  const year = parsed.getUTCFullYear()
  const hour = String(parsed.getUTCHours()).padStart(2, "0")
  const minute = String(parsed.getUTCMinutes()).padStart(2, "0")

  return `${day}.${month}.${year} ${hour}:${minute} UTC`
}

function buildOrderStatusUrl(
  storefrontUrl: string | null | undefined,
  orderId: string
): string | null {
  const trimmed = storefrontUrl?.trim().replace(/\/+$/, "")

  if (!trimmed) {
    return null
  }

  try {
    const url = new URL(`${trimmed}/ru/account/orders/${orderId}`)

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null
    }

    return url.toString()
  } catch {
    return null
  }
}

/**
 * "Order placed" — customer successfully placed the order.
 */
export function renderOrderPlacedEmail(input: {
  orderId: string
  displayId: number | string | null
  storefrontUrl?: string | null
}): OrderLifecycleEmailContent {
  const identity: OrderIdentity = {
    id: input.orderId,
    displayId: input.displayId,
  }
  const label = formatOrderLabel(identity)
  const subject = `Заказ ${label} принят`
  const statusUrl = buildOrderStatusUrl(input.storefrontUrl, input.orderId)

  const rendered = renderBrandedEmail({
    preheader: `Заказ ${label} успешно создан и принят в обработку`,
    heading: `Заказ ${label} принят`,
    intro: [
      `Спасибо за ваш заказ. Мы получили его и передали в обработку.`,
    ],
    ...(statusUrl
      ? {
          action: {
            label: "Посмотреть заказ",
            url: statusUrl,
          },
        }
      : {}),
    body: [
      "Как только заказ перейдёт в следующий статус, мы пришлём обновление отдельным письмом.",
      "Если вы не оформляли этот заказ, ответьте на это письмо.",
    ],
  })

  return {
    subject,
    html: rendered.html,
    text: rendered.text,
  }
}

/**
 * "Order shipped" — a shipment was created for the order.
 */
export function renderOrderShippedEmail(input: {
  orderId: string
  displayId: number | string | null
  fulfillmentId: string
  storefrontUrl?: string | null
}): OrderLifecycleEmailContent {
  const identity: OrderIdentity = {
    id: input.orderId,
    displayId: input.displayId,
  }
  const label = formatOrderLabel(identity)
  const subject = `Заказ ${label} передан в доставку`
  const statusUrl = buildOrderStatusUrl(input.storefrontUrl, input.orderId)

  const rendered = renderBrandedEmail({
    preheader: `Ваш заказ ${label} передан в службу доставки`,
    heading: `Заказ ${label} передан в доставку`,
    intro: [
      "Хорошие новости: ваш заказ передан в службу доставки и уже в пути.",
    ],
    ...(statusUrl
      ? {
          action: {
            label: "Отследить заказ",
            url: statusUrl,
          },
        }
      : {}),
    body: [
      "Трек-номер и детальная информация о доставке появятся в личном кабинете, как только они поступят от перевозчика.",
    ],
  })

  return {
    subject,
    html: rendered.html,
    text: rendered.text,
  }
}

/**
 * "Order canceled" — order moved to canceled state.
 */
export function renderOrderCanceledEmail(input: {
  orderId: string
  displayId: number | string | null
  canceledAt?: string | null
  storefrontUrl?: string | null
}): OrderLifecycleEmailContent {
  const identity: OrderIdentity = {
    id: input.orderId,
    displayId: input.displayId,
  }
  const label = formatOrderLabel(identity)
  const subject = `Заказ ${label} отменён`
  const canceledAtLabel = formatIsoDateTimeRu(input.canceledAt ?? null)
  const statusUrl = buildOrderStatusUrl(input.storefrontUrl, input.orderId)

  const bodyParagraphs: string[] = [
    "Если возврат средств применим, он произойдёт автоматически по тому же способу оплаты, которым вы пользовались. Срок возврата зависит от вашего банка.",
    "Если вы считаете, что это произошло по ошибке, ответьте на это письмо.",
  ]

  const introLines: string[] = [`Ваш заказ ${label} был отменён.`]

  if (canceledAtLabel) {
    introLines.push(`Дата отмены: ${canceledAtLabel}.`)
  }

  const rendered = renderBrandedEmail({
    preheader: `Заказ ${label} отменён`,
    heading: `Заказ ${label} отменён`,
    intro: introLines,
    ...(statusUrl
      ? {
          action: {
            label: "Открыть заказ",
            url: statusUrl,
          },
        }
      : {}),
    body: bodyParagraphs,
  })

  return {
    subject,
    html: rendered.html,
    text: rendered.text,
  }
}

/**
 * "Payment failed" — terminal failure of a payment attempt on a cart/session.
 */
export function renderPaymentFailedEmail(input: {
  cartId: string
  orderId?: string | null
  paymentProvider?: string | null
  storefrontUrl?: string | null
}): OrderLifecycleEmailContent {
  const subject = "Оплата не прошла"
  const storefrontBase = input.storefrontUrl?.trim().replace(/\/+$/, "")
  let actionUrl: string | null = null

  if (storefrontBase) {
    try {
      const url = new URL(`${storefrontBase}/ru/cart`)

      if (url.protocol === "http:" || url.protocol === "https:") {
        actionUrl = url.toString()
      }
    } catch {
      actionUrl = null
    }
  }

  const rendered = renderBrandedEmail({
    preheader:
      "Не удалось подтвердить оплату заказа — попробуйте оформить ещё раз",
    heading: "Оплата не прошла",
    intro: [
      "К сожалению, нам не удалось подтвердить оплату вашего заказа.",
      "Средства не были списаны. Вы можете повторить оплату в корзине.",
    ],
    ...(actionUrl
      ? {
          action: {
            label: "Вернуться в корзину",
            url: actionUrl,
          },
        }
      : {}),
    body: [
      "Если проблема повторяется, попробуйте другой способ оплаты или свяжитесь с нами — мы поможем завершить покупку.",
    ],
  })

  return {
    subject,
    html: rendered.html,
    text: rendered.text,
  }
}
