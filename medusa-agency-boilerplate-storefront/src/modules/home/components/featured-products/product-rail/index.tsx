import { getProductRatingSummariesByIds } from "@lib/data/product-reviews"
import { listProducts } from "@lib/data/products"
import { storefrontConfig } from "@lib/storefront-config"
import { HttpTypes } from "@medusajs/types"

import {
  FeaturedRailCatalogShellSurface,
} from "@modules/storefront-customization/components/catalog-shell-surface"
import {
  resolveFeaturedRailCatalogShellSurface,
} from "@modules/storefront-customization/components/catalog-shell-resolver"
import ProductPreview from "@modules/products/components/product-preview"

export default async function ProductRail({
  collection,
  region,
  maxProducts,
}: {
  collection: HttpTypes.StoreCollection
  region: HttpTypes.StoreRegion
  maxProducts?: number
}) {
  const {
    response: { products: pricedProducts },
  } = await listProducts({
    regionId: region.id,
    queryParams: {
      collection_id: collection.id,
      fields: "*variants.calculated_price",
    },
  })

  if (!pricedProducts) {
    return null
  }

  const resolvedProducts = maxProducts
    ? pricedProducts.slice(0, maxProducts)
    : pricedProducts

  const shellSurface = resolveFeaturedRailCatalogShellSurface()

  // Plan §6.3 / step 4 — batch rating summaries for every card on the rail
  // (see also `paginated-products.tsx`). Cheap, parallelised; no extra
  // cache layer.
  const ratingSummaries = await getProductRatingSummariesByIds(
    resolvedProducts.map((product) => product.id)
  )

  return (
    <FeaturedRailCatalogShellSurface
      surface={shellSurface}
      title={collection.title}
      href={`/collections/${collection.handle}`}
      actionLabel={storefrontConfig.copy.common.viewAll}
    >
      <ul className="grid grid-cols-2 small:grid-cols-3 gap-x-6 gap-y-24 small:gap-y-36">
        {resolvedProducts &&
          resolvedProducts.map((product) => (
            <li key={product.id}>
              <ProductPreview
                product={product}
                region={region}
                isFeatured
                ratingSummary={ratingSummaries[product.id] ?? null}
              />
            </li>
          ))}
      </ul>
    </FeaturedRailCatalogShellSurface>
  )
}
