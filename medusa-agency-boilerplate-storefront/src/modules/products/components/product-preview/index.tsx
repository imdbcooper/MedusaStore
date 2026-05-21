import type { ProductReviewSummary } from "@lib/data/product-reviews"
import { getProductPrice } from "@lib/util/get-product-price"
import { HttpTypes } from "@medusajs/types"
import ProductCardSurface from "@modules/storefront-customization/components/product-card-surface"
import {
  resolveDefaultProductCardSurface,
  resolveFeaturedProductCardSurface,
} from "@modules/storefront-customization/components/listing-surface-resolver"

export default async function ProductPreview({
  product,
  isFeatured,
  ratingSummary,
}: {
  product: HttpTypes.StoreProduct
  isFeatured?: boolean
  /**
   * Phase 2 / step 4 (plan §6.3) — pre-fetched rating summary for this
   * product, batched at the catalog/page level. When omitted the catalog
   * badge falls back to its own per-card server fetch (Phase 1 behaviour).
   */
  ratingSummary?: ProductReviewSummary | null
}) {
  const { cheapestPrice } = getProductPrice({
    product,
  })

  const surface = isFeatured
    ? resolveFeaturedProductCardSurface()
    : resolveDefaultProductCardSurface()

  return (
    <ProductCardSurface
      product={product}
      price={cheapestPrice}
      surface={surface}
      summary={ratingSummary}
    />
  )
}
