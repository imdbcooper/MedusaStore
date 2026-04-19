import { notFound } from "next/navigation"
import { Suspense } from "react"

import SkeletonProductGrid from "@modules/skeletons/templates/skeleton-product-grid"
import RefinementList from "@modules/store/components/refinement-list"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import PaginatedProducts from "@modules/store/templates/paginated-products"
import {
  CatalogResultsShellSurface,
  CategoryCatalogIntroSurface,
} from "@modules/storefront-customization/components/catalog-shell-surface"
import {
  resolveCategoryCatalogIntroSurface,
  resolveCategoryCatalogResultsSurface,
} from "@modules/storefront-customization/components/catalog-shell-resolver"
import { HttpTypes } from "@medusajs/types"

export default function CategoryTemplate({
  category,
  sortBy,
  page,
  countryCode,
}: {
  category: HttpTypes.StoreProductCategory
  sortBy?: SortOptions
  page?: string
  countryCode: string
}) {
  const pageNumber = page ? parseInt(page) : 1
  const sort = sortBy || "created_at"

  if (!category || !countryCode) notFound()

  const parents = [] as HttpTypes.StoreProductCategory[]

  const getParents = (category: HttpTypes.StoreProductCategory) => {
    if (category.parent_category) {
      parents.push(category.parent_category)
      getParents(category.parent_category)
    }
  }

  getParents(category)
  const parentTrail = parents.reverse()
  const introSurface = resolveCategoryCatalogIntroSurface()
  const resultsSurface = resolveCategoryCatalogResultsSurface()

  return (
    <div
      className="flex flex-col small:flex-row small:items-start py-6 content-container"
      data-testid="category-container"
    >
      <RefinementList sortBy={sort} data-testid="sort-by-container" />
      <CatalogResultsShellSurface surface={resultsSurface}>
        <CategoryCatalogIntroSurface
          surface={introSurface}
          category={category}
          parents={parentTrail}
        />
        <Suspense
          fallback={
            <SkeletonProductGrid
              numberOfProducts={category.products?.length ?? 8}
            />
          }
        >
          <PaginatedProducts
            sortBy={sort}
            page={pageNumber}
            categoryId={category.id}
            countryCode={countryCode}
          />
        </Suspense>
      </CatalogResultsShellSurface>
    </div>
  )
}
