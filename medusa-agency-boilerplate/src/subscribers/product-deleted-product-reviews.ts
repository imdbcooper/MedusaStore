import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  deleteAllProductReviewsForProduct,
  getProductReviewsPgConnection,
} from "../modules/product-reviews"

/**
 * Cascade-удаление отзывов и rating summary при удалении продукта (см.
 * [`plans/product-reviews-module.md`](plans/product-reviews-module.md) §10.3
 * и §1.1 п.7).
 *
 * При `product.deleted`:
 * - `DELETE FROM product_review WHERE product_id = ?` (CASCADE уносит
 *   `product_review_helpful`);
 * - `DELETE FROM product_rating_summary WHERE product_id = ?`.
 *
 * Cache-инвалидация storefront не требуется: страница товара исчезает
 * вместе с продуктом по линии Medusa core / storefront fetch (см. §10.3 и
 * комментарий в plan-инструкциях шага 5).
 *
 * Ошибки логируются и проглатываются — этот subscriber не должен валить
 * event-bus при сбое cleanup'а отзывов.
 */
export default async function productDeletedProductReviewsHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id?: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const productId = data.id?.trim()

  if (!productId) {
    logger.warn(
      "[product-reviews-on-product-deleted] skip: product.deleted event received without product id"
    )
    return
  }

  try {
    const pgConnection = getProductReviewsPgConnection(container)
    const result = await deleteAllProductReviewsForProduct({
      pgConnection,
      productId,
    })

    logger.info(
      `[product-reviews-on-product-deleted] deleted product_id=${productId} reviews_deleted=${result.reviewsDeleted}`
    )
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "unknown_delete_error"
    logger.error(
      `[product-reviews-on-product-deleted] delete failed product_id=${productId} message=${message}`
    )
  }
}

export const config: SubscriberConfig = {
  event: "product.deleted",
}
