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
  region,
}: {
  product: HttpTypes.StoreProduct
  isFeatured?: boolean
  region: HttpTypes.StoreRegion
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
    />
  )
}
