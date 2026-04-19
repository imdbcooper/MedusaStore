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
              <ProductPreview product={product} region={region} isFeatured />
            </li>
          ))}
      </ul>
    </FeaturedRailCatalogShellSurface>
  )
}
