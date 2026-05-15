import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  anonymizeCustomerInProductReviews,
  getProductReviewsPgConnection,
} from "../modules/product-reviews"

/**
 * GDPR right-to-erasure для модуля отзывов (см.
 * [`plans/product-reviews-module.md`](plans/product-reviews-module.md) §10.3
 * и §1.1 п.7).
 *
 * При удалении customer'а:
 * - `product_review.customer_id` обнуляется, `customer_name` заменяется на
 *   "Покупатель" (тексты сохраняются, чтобы не пересчитывать рейтинг и не
 *   терять content для других покупателей);
 * - `product_review_helpful` для этого customer удаляется (PII там нет, но
 *   удаляем для consistency).
 *
 * Ошибки логируются и проглатываются: GDPR-cleanup в одной из подсистем не
 * должен валить весь event-bus при сбое — другие subscribers (notifications,
 * marketing, assistant и т.п.) должны отработать независимо.
 */
export default async function customerDeletedProductReviewsHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id?: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const customerId = data.id?.trim()

  if (!customerId) {
    logger.warn(
      "[product-reviews-on-customer-deleted] skip: customer.deleted event received without customer id"
    )
    return
  }

  try {
    const pgConnection = getProductReviewsPgConnection(container)
    const result = await anonymizeCustomerInProductReviews({
      pgConnection,
      customerId,
    })

    logger.info(
      `[product-reviews-on-customer-deleted] anonymized customer_id=${customerId} reviews_anonymized=${result.reviewsAnonymized} helpful_votes_deleted=${result.helpfulVotesDeleted}`
    )
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "unknown_anonymize_error"
    logger.error(
      `[product-reviews-on-customer-deleted] anonymize failed customer_id=${customerId} message=${message}`
    )
  }
}

export const config: SubscriberConfig = {
  event: "customer.deleted",
}
