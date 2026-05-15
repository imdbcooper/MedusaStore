/**
 * Product-review moderation email templates.
 *
 * These helpers render `{ subject, html, text }` for transactional
 * notifications sent after admin/Payload moderation: «Ваш отзыв
 * опубликован» (approved) and «Ваш отзыв отклонён» (rejected).
 *
 * They are thin wrappers over [`renderBrandedEmail`](medusa-agency-boilerplate/src/modules/email-template.ts:734)
 * so all transactional emails share a single brand template, mirroring
 * the convention of [`order-email-templates.ts`](medusa-agency-boilerplate/src/modules/order-email-templates.ts:1).
 *
 * Plan reference:
 *   - [`plans/product-reviews-module.md`](plans/product-reviews-module.md) §1.1 п.9
 *     («Канал нотификаций — Phase 2 через `notification-email.ts` и шаблоны
 *     в `email-template.ts`; transactional, не зависит от marketing
 *     consent»);
 *   - §4.3 (admin approve/reject — после COMMIT, нотификация транзакционная);
 *   - §9 Phase 2 шаг 6.
 *
 * No business logic lives here — only copy + URL composition. The caller
 * decides whether to send at all (anonymized customer / missing email /
 * missing storefront URL).
 */

import { renderBrandedEmail } from "./email-template"

export type ReviewModerationEmailContent = {
  subject: string
  html: string
  text: string
}

type ReviewEmailCommonInput = {
  /**
   * Display name of the customer. Falls back to a generic greeting if
   * empty / blank.
   */
  customerName?: string | null
  productId: string
  productTitle?: string | null
  productHandle?: string | null
  storefrontUrl?: string | null
}

const FALLBACK_CUSTOMER_NAME = "покупатель"

function normalizeName(value: string | null | undefined): string {
  if (typeof value !== "string") {
    return FALLBACK_CUSTOMER_NAME
  }

  const trimmed = value.trim()
  return trimmed || FALLBACK_CUSTOMER_NAME
}

function normalizeProductLabel(input: {
  productId: string
  productTitle?: string | null
}): string {
  const title =
    typeof input.productTitle === "string" ? input.productTitle.trim() : ""

  return title || input.productId
}

/**
 * Build the public storefront product URL for the email CTA. Returns
 * `null` if the handle is missing or the storefront URL is invalid /
 * non-http(s).
 *
 * Mirrors the URL composition of
 * [`buildOrderStatusUrl`](medusa-agency-boilerplate/src/modules/order-email-templates.ts:59) —
 * trim trailing slashes, validate protocol, never throw.
 */
function buildProductUrl(
  storefrontUrl: string | null | undefined,
  productHandle: string | null | undefined
): string | null {
  const trimmedBase = storefrontUrl?.trim().replace(/\/+$/, "")
  const trimmedHandle =
    typeof productHandle === "string" ? productHandle.trim() : ""

  if (!trimmedBase || !trimmedHandle) {
    return null
  }

  try {
    const url = new URL(`${trimmedBase}/ru/products/${trimmedHandle}`)

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null
    }

    return url.toString()
  } catch {
    return null
  }
}

/**
 * "Review approved" — moderator approved a customer review and it is now
 * publicly visible on the product page.
 */
export function buildReviewApprovedEmail(
  input: ReviewEmailCommonInput
): ReviewModerationEmailContent {
  const subject = "Ваш отзыв опубликован"
  const customerName = normalizeName(input.customerName)
  const productLabel = normalizeProductLabel({
    productId: input.productId,
    productTitle: input.productTitle,
  })
  const productUrl = buildProductUrl(input.storefrontUrl, input.productHandle)

  const intro = [
    `Здравствуйте, ${customerName}!`,
    `Ваш отзыв на товар «${productLabel}» опубликован. Спасибо, что делитесь впечатлением — это помогает другим покупателям.`,
  ]

  const rendered = renderBrandedEmail({
    preheader: `Ваш отзыв на товар «${productLabel}» опубликован`,
    heading: "Отзыв опубликован",
    intro,
    ...(productUrl
      ? {
          action: {
            label: "Перейти к товару",
            url: productUrl,
          },
        }
      : {}),
    body: [
      "Если позже вы захотите дополнить или уточнить отзыв, напишите нам — мы обновим его.",
    ],
  })

  return {
    subject,
    html: rendered.html,
    text: rendered.text,
  }
}

export type ReviewRejectedEmailInput = ReviewEmailCommonInput & {
  /**
   * Moderator-supplied reason for the rejection. Trimmed and rendered
   * verbatim (HTML-escaped by the template engine). May be empty — in
   * that case the dedicated quote block is omitted.
   */
  rejectionReason?: string | null
}

/**
 * "Review rejected" — moderator rejected the review with a reason.
 *
 * The reason is rendered as a separate paragraph (the shared template
 * does not expose a `<blockquote>` style, but it does HTML-escape every
 * dynamic value, so the reason is safe to embed verbatim).
 */
export function buildReviewRejectedEmail(
  input: ReviewRejectedEmailInput
): ReviewModerationEmailContent {
  const subject = "Ваш отзыв отклонён"
  const customerName = normalizeName(input.customerName)
  const productLabel = normalizeProductLabel({
    productId: input.productId,
    productTitle: input.productTitle,
  })
  const productUrl = buildProductUrl(input.storefrontUrl, input.productHandle)
  const reason =
    typeof input.rejectionReason === "string"
      ? input.rejectionReason.trim()
      : ""

  const intro = [
    `Здравствуйте, ${customerName}!`,
    reason
      ? `К сожалению, ваш отзыв на товар «${productLabel}» отклонён по следующей причине:`
      : `К сожалению, ваш отзыв на товар «${productLabel}» отклонён.`,
  ]

  const bodyParagraphs: string[] = []

  if (reason) {
    bodyParagraphs.push(`«${reason}»`)
  }

  bodyParagraphs.push(
    "Вы можете оставить новый отзыв с учётом наших правил."
  )

  const rendered = renderBrandedEmail({
    preheader: `Ваш отзыв на товар «${productLabel}» отклонён`,
    heading: "Отзыв отклонён",
    intro,
    ...(productUrl
      ? {
          action: {
            label: "Перейти к товару",
            url: productUrl,
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
