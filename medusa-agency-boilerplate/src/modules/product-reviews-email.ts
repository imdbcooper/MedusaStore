/**
 * Phase 2 / step 6 — transactional email helper for product-review
 * moderation outcomes.
 *
 * Plan reference:
 *   - [`plans/product-reviews-module.md`](plans/product-reviews-module.md) §1.1 п.9
 *     («Канал нотификаций — Phase 2 через `notification-email.ts` и шаблоны
 *     в `email-template.ts`; transactional, не зависит от marketing
 *     consent»);
 *   - §4.3 (admin approve/reject — после COMMIT, нотификация транзакционная);
 *   - §9 Phase 2 шаг 6.
 *
 * Called directly from the admin moderation routes after the SQL
 * transaction in [`product-reviews.ts`](medusa-agency-boilerplate/src/modules/product-reviews.ts:1)
 * commits. NOT a workflow / NOT a subscriber — the plan explicitly says
 * "прямой вызов из admin-роута".
 *
 * Best-effort:
 *   - Returns a discriminated `{ ok, error? }` result instead of throwing.
 *   - Email failure MUST NOT break the admin 200/204 response. The caller
 *     wraps the call in try/catch and ignores the result on error.
 *   - All branches log to the request-scoped logger when available so
 *     operators can grep `[product-reviews-email]` for delivery issues.
 *
 * Skipped on:
 *   - `customer_anonymized` — `review.customer_id === null` (the customer
 *     was deleted and the row was anonymized; no recipient exists);
 *   - `customer_not_found` — Medusa query graph returns no customer row;
 *   - `customer_email_missing` — customer exists but has no email;
 *   - `config_missing` — `STOREFRONT_URL` env is empty (we still need it
 *     for the CTA link, and consistency with other transactional emails
 *     such as `renderOrderPlacedEmail`).
 *
 * Transactional contract:
 *   - This is a `transactional` channel: it does NOT consult marketing
 *     preferences (plan §1.1 п.9). The recipient is the customer who
 *     authored the review and who explicitly opted in by submitting it.
 */

import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  getNotificationEmailRuntime,
  normalizeNotificationRecipient,
} from "./notification-email"
import type { ProductReviewRow } from "./product-reviews"
import {
  buildReviewApprovedEmail,
  buildReviewRejectedEmail,
} from "./review-email-templates"

export const REVIEW_APPROVED_NOTIFICATION_TEMPLATE = "review-approved-v1"
export const REVIEW_APPROVED_NOTIFICATION_TRIGGER_TYPE =
  "product_review.approved.customer.notification_requested"
export const REVIEW_REJECTED_NOTIFICATION_TEMPLATE = "review-rejected-v1"
export const REVIEW_REJECTED_NOTIFICATION_TRIGGER_TYPE =
  "product_review.rejected.customer.notification_requested"

export type SendReviewModerationEmailInput = {
  review: Pick<
    ProductReviewRow,
    "id" | "customer_id" | "customer_name" | "product_id" | "rejection_reason"
  >
  type: "approved" | "rejected"
  /**
   * Required for `type === "rejected"` if the caller wants the reason in
   * the email body. If empty / missing, the rejected-email template
   * still works but omits the quoted reason.
   */
  rejectionReason?: string | null
}

export type SendReviewModerationEmailResult =
  | { ok: true; status: "sent"; recipient: string; notificationId?: string }
  | {
      ok: false
      error:
        | "customer_anonymized"
        | "customer_not_found"
        | "customer_email_missing"
        | "config_missing"
        | "send_failed"
      detail?: string
    }

type RuntimeLogger = {
  info?(msg: string): void
  warn?(msg: string): void
  error?(msg: string): void
}

type CustomerForReviewEmail = {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
}

type ProductForReviewEmail = {
  id: string
  title: string | null
  handle: string | null
}

function resolveLogger(container: any): RuntimeLogger | undefined {
  try {
    return container.resolve(ContainerRegistrationKeys.LOGGER) as RuntimeLogger
  } catch {
    return undefined
  }
}

function resolveQuery(container: any): any | null {
  try {
    return container.resolve(ContainerRegistrationKeys.QUERY)
  } catch {
    return null
  }
}

function resolveNotificationModule(container: any): any | null {
  try {
    return container.resolve(Modules.NOTIFICATION)
  } catch {
    return null
  }
}

async function fetchCustomerForReview(
  query: any,
  customerId: string
): Promise<CustomerForReviewEmail | null> {
  try {
    const { data } = await query.graph({
      entity: "customer",
      fields: ["id", "email", "first_name", "last_name"],
      filters: { id: customerId },
    })

    const row = (data || [])[0] as CustomerForReviewEmail | undefined
    return row ?? null
  } catch {
    return null
  }
}

async function fetchProductForReview(
  query: any,
  productId: string
): Promise<ProductForReviewEmail | null> {
  try {
    const { data } = await query.graph({
      entity: "product",
      fields: ["id", "title", "handle"],
      filters: { id: productId },
    })

    const row = (data || [])[0] as ProductForReviewEmail | undefined
    return row ?? null
  } catch {
    return null
  }
}

function pickCustomerName(
  customer: CustomerForReviewEmail | null,
  reviewCustomerName: string | null | undefined
): string {
  const first = customer?.first_name?.trim() || ""

  if (first) {
    return first
  }

  const reviewName =
    typeof reviewCustomerName === "string" ? reviewCustomerName.trim() : ""

  if (reviewName) {
    return reviewName
  }

  return ""
}

/**
 * Send a transactional moderation email to the review's author.
 *
 * Never throws. Never consults marketing consent. Never depends on the
 * outcome of the surrounding admin transaction (the caller invokes this
 * AFTER the transaction commits).
 */
export async function sendReviewModerationEmail(
  container: any,
  input: SendReviewModerationEmailInput
): Promise<SendReviewModerationEmailResult> {
  const logger = resolveLogger(container)
  const review = input.review
  const reviewId = review.id
  const productId = review.product_id

  if (!review.customer_id) {
    logger?.info?.(
      `[product-reviews-email] skip reason=customer_anonymized review_id=${reviewId}`
    )
    return { ok: false, error: "customer_anonymized" }
  }

  const storefrontUrl =
    typeof process.env.STOREFRONT_URL === "string"
      ? process.env.STOREFRONT_URL.trim()
      : ""

  if (!storefrontUrl) {
    logger?.warn?.(
      `[product-reviews-email] skip reason=config_missing review_id=${reviewId} (STOREFRONT_URL is empty)`
    )
    return { ok: false, error: "config_missing" }
  }

  const query = resolveQuery(container)

  if (!query) {
    logger?.warn?.(
      `[product-reviews-email] skip reason=config_missing review_id=${reviewId} (query module not registered)`
    )
    return { ok: false, error: "config_missing" }
  }

  const customer = await fetchCustomerForReview(query, review.customer_id)

  if (!customer) {
    logger?.warn?.(
      `[product-reviews-email] skip reason=customer_not_found review_id=${reviewId} customer_id=${review.customer_id}`
    )
    return { ok: false, error: "customer_not_found" }
  }

  const recipient = normalizeNotificationRecipient(customer.email)

  if (!recipient) {
    logger?.warn?.(
      `[product-reviews-email] skip reason=customer_email_missing review_id=${reviewId} customer_id=${customer.id}`
    )
    return { ok: false, error: "customer_email_missing" }
  }

  // Product fetch is best-effort — if it fails we still send the email
  // with the productId as the fallback label and no CTA link.
  const product = await fetchProductForReview(query, productId)

  const customerName = pickCustomerName(customer, review.customer_name)

  const isApproved = input.type === "approved"
  const template = isApproved
    ? REVIEW_APPROVED_NOTIFICATION_TEMPLATE
    : REVIEW_REJECTED_NOTIFICATION_TEMPLATE
  const triggerType = isApproved
    ? REVIEW_APPROVED_NOTIFICATION_TRIGGER_TYPE
    : REVIEW_REJECTED_NOTIFICATION_TRIGGER_TYPE

  const renderedEmail = isApproved
    ? buildReviewApprovedEmail({
        customerName,
        productId,
        productTitle: product?.title ?? null,
        productHandle: product?.handle ?? null,
        storefrontUrl,
      })
    : buildReviewRejectedEmail({
        customerName,
        productId,
        productTitle: product?.title ?? null,
        productHandle: product?.handle ?? null,
        storefrontUrl,
        rejectionReason:
          input.rejectionReason ?? review.rejection_reason ?? null,
      })

  const notificationModule = resolveNotificationModule(container)

  if (!notificationModule || typeof notificationModule.createNotifications !== "function") {
    logger?.error?.(
      `[product-reviews-email] skip reason=notification_module_unavailable review_id=${reviewId}`
    )
    return { ok: false, error: "config_missing" }
  }

  const runtime = getNotificationEmailRuntime()

  const payload = {
    to: recipient,
    from: runtime.from,
    channel: "email" as const,
    template,
    trigger_type: triggerType,
    resource_type: "product_review",
    resource_id: reviewId,
    content: {
      subject: renderedEmail.subject,
      html: renderedEmail.html,
      text: renderedEmail.text,
    },
    data: {
      review_id: reviewId,
      product_id: productId,
      customer_id: customer.id,
      recipient,
      template,
      trigger_type: triggerType,
      moderation_outcome: input.type,
      provider_requested: runtime.requestedProviderId,
      provider_resolved: runtime.providerId,
    },
  }

  try {
    const notification = await notificationModule.createNotifications(payload)
    const notificationId =
      notification && typeof notification === "object" && "id" in notification
        ? String((notification as { id: unknown }).id ?? "")
        : ""

    logger?.info?.(
      `[product-reviews-email] sent review_id=${reviewId} type=${input.type} recipient=${recipient} notification_id=${notificationId || "n/a"} provider_resolved=${runtime.providerId}`
    )

    return {
      ok: true,
      status: "sent",
      recipient,
      ...(notificationId ? { notificationId } : {}),
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "unknown_send_error"
    logger?.error?.(
      `[product-reviews-email] send failed review_id=${reviewId} type=${input.type} recipient=${recipient} error=${message}`
    )
    return { ok: false, error: "send_failed", detail: message }
  }
}
