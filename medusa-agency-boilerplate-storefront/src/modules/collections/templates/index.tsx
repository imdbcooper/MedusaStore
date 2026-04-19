import { Suspense } from "react"

import { HttpTypes } from "@medusajs/types"
import SkeletonProductGrid from "@modules/skeletons/templates/skeleton-product-grid"
import RefinementList from "@modules/store/components/refinement-list"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import PaginatedProducts from "@modules/store/templates/paginated-products"
import {
  CatalogResultsShellSurface,
} from "@modules/storefront-customization/components/catalog-shell-surface"
import {
  resolveCollectionCatalogResultsSurface,
} from "@modules/storefront-customization/components/catalog-shell-resolver"
import CollectionLandingSurface from "@modules/storefront-customization/components/collection-landing-surface"

export default function CollectionTemplate({
  sortBy,
  collection,
  page,
  countryCode,
}: {
  sortBy?: SortOptions
  collection: HttpTypes.StoreCollection
  page?: string
  countryCode: string
}) {
  const pageNumber = page ? parseInt(page) : 1
  const sort = sortBy || "created_at"

  const resultsSurface = resolveCollectionCatalogResultsSurface()

  return (
    <div className="flex flex-col small:flex-row small:items-start py-6 content-container">
      <RefinementList sortBy={sort} />
      <CatalogResultsShellSurface surface={resultsSurface}>
        <CollectionLandingSurface collection={collection} />
        <Suspense
          fallback={
            <SkeletonProductGrid
              numberOfProducts={collection.products?.length}
            />
          }
        >
          <PaginatedProducts
            sortBy={sort}
            page={pageNumber}
            collectionId={collection.id}
            countryCode={countryCode}
          />
        </Suspense>
      </CatalogResultsShellSurface>
    </div>
  )
}
