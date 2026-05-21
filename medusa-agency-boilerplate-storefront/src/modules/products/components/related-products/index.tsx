import { getProductRatingSummariesByIds } from "@lib/data/product-reviews"
import { listProducts } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import { HttpTypes } from "@medusajs/types"
import { resolveRelatedProductsRailSurface } from "@modules/storefront-customization/components/listing-surface-resolver"
import RelatedProductsRailSurface from "@modules/storefront-customization/components/related-products-rail-surface"
import Product from "../product-preview"

type RelatedProductsProps = {
  product: HttpTypes.StoreProduct
  countryCode: string
}

export default async function RelatedProducts({
  product,
  countryCode,
}: RelatedProductsProps) {
  const region = await getRegion(countryCode)

  if (!region) {
    return null
  }

  // edit this function to define your related products logic
  const queryParams: HttpTypes.StoreProductListParams = {}
  if (region?.id) {
    queryParams.region_id = region.id
  }
  if (product.collection_id) {
    queryParams.collection_id = [product.collection_id]
  }
  if (product.tags) {
    queryParams.tag_id = product.tags
      .map((t) => t.id)
      .filter(Boolean) as string[]
  }
  queryParams.is_giftcard = false

  const products = await listProducts({
    queryParams,
    countryCode,
  }).then(({ response }) => {
    return response.products.filter(
      (responseProduct) => responseProduct.id !== product.id
    )
  })

  if (!products.length) {
    return null
  }

  const railSurface = resolveRelatedProductsRailSurface()

  // Plan §6.3 / step 4 — batch rating summaries for related-products rail
  // so each card's thumbnail badge renders from the prop instead of firing
  // its own server fetch.
  const ratingSummaries = await getProductRatingSummariesByIds(
    products.map((product) => product.id)
  )

  return (
    <RelatedProductsRailSurface surface={railSurface}>
      {products.map((product) => (
        <li key={product.id}>
          <Product
            product={product}
            ratingSummary={ratingSummaries[product.id] ?? null}
          />
        </li>
      ))}
    </RelatedProductsRailSurface>
  )
}
