import { Suspense } from "react"

import SkeletonProductGrid from "@modules/skeletons/templates/skeleton-product-grid"
import RefinementList from "@modules/store/components/refinement-list"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import {
  CatalogResultsShellSurface,
  StoreCatalogIntroSurface,
} from "@modules/storefront-customization/components/catalog-shell-surface"
import {
  resolveStoreCatalogIntroSurface,
  resolveStoreCatalogResultsSurface,
} from "@modules/storefront-customization/components/catalog-shell-resolver"

import PaginatedProducts from "./paginated-products"

const StoreTemplate = ({
  sortBy,
  page,
  countryCode,
}: {
  sortBy?: SortOptions
  page?: string
  countryCode: string
}) => {
  const pageNumber = page ? parseInt(page) : 1
  const sort = sortBy || "created_at"

  const introSurface = resolveStoreCatalogIntroSurface()
  const resultsSurface = resolveStoreCatalogResultsSurface()

  return (
    <div
      className="flex flex-col small:flex-row small:items-start py-6 content-container"
      data-testid="category-container"
    >
      <RefinementList sortBy={sort} />
      <CatalogResultsShellSurface surface={resultsSurface}>
        <StoreCatalogIntroSurface surface={introSurface} />
        <Suspense fallback={<SkeletonProductGrid />}>
          <PaginatedProducts
            sortBy={sort}
            page={pageNumber}
            countryCode={countryCode}
          />
        </Suspense>
      </CatalogResultsShellSurface>
    </div>
  )
}

export default StoreTemplate
