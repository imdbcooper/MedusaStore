import { Suspense } from "react"

import SkeletonProductGrid from "@modules/skeletons/templates/skeleton-product-grid"
import RefinementList from "@modules/store/components/refinement-list"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import {
  CatalogResultsShellSurface,
  CatalogTrustSection,
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
  const sort = sortBy || "price_asc"

  const introSurface = resolveStoreCatalogIntroSurface()
  const resultsSurface = resolveStoreCatalogResultsSurface()

  return (
    <main className="content-container" data-testid="category-container">
      <CatalogResultsShellSurface surface={resultsSurface}>
        <StoreCatalogIntroSurface
          surface={introSurface}
          sortControl={
            <RefinementList
              sortBy={sort}
              variant="stitch-inline"
              data-testid="sort-by-container"
            />
          }
        />
        <Suspense fallback={<SkeletonProductGrid />}>
          <PaginatedProducts
            sortBy={sort}
            page={pageNumber}
            countryCode={countryCode}
          />
        </Suspense>
        <CatalogTrustSection />
      </CatalogResultsShellSurface>
    </main>
  )
}

export default StoreTemplate
