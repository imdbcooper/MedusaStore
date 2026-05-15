import * as React from "react"

import { storefrontConfig } from "@lib/storefront-config"
import {
  listApprovedProductReviews,
  type ProductReviewSort,
} from "@lib/data/product-reviews"

import ProductReviewsListPager from "./pager"

/**
 * Phase 1 / step 6 — server component: paginated list of approved reviews.
 *
 * The first page is fetched on the server with the
 * `product-reviews-${productId}` cache tag (plan §6.6) and rendered as
 * static `ProductReviewCard` markup. Subsequent pages and sort changes are
 * handled by the client `ProductReviewsListPager` which calls the
 * `fetchApprovedProductReviewsPage` server action.
 */

const DEFAULT_PAGE_SIZE = 20

type ProductReviewsListProps = {
  productId: string
  initialPage?: number
  initialSort?: ProductReviewSort
  pageSize?: number
}

const ProductReviewsList = async ({
  productId,
  initialPage = 1,
  initialSort = "newest",
  pageSize = DEFAULT_PAGE_SIZE,
}: ProductReviewsListProps) => {
  const reviewsCopy = storefrontConfig.copy.reviews

  const initialResult = await listApprovedProductReviews({
    productId,
    page: initialPage,
    pageSize,
    sort: initialSort,
  })

  const hasItems = initialResult.items.length > 0

  // Phase 3 / step 2: when the product has at least one approved review we
  // delegate the entire list rendering (including the initial page that was
  // fetched on the server) to the client pager. Previously the server
  // component rendered its own `<ul>` and the pager appended a second one
  // for sort/filter changes — that produced a visible duplicate. Centralising
  // the list inside the pager fixes the duplicate and lets the filtered
  // empty-state replace the list cleanly when the user picks a chip that
  // matches no rows.
  return (
    <div className="flex flex-col gap-6">
      {hasItems ? (
        <ProductReviewsListPager
          productId={productId}
          initialItems={initialResult.items}
          total={initialResult.total}
          initialPage={initialResult.page}
          initialSort={initialSort}
          pageSize={pageSize}
        />
      ) : (
        <div
          className="rounded-[var(--theme-radius-card)] border border-dashed border-[var(--theme-border)] bg-[var(--theme-canvas)] p-6 text-center text-sm text-[var(--theme-muted)]"
          data-testid="product-reviews-empty"
        >
          {reviewsCopy.summary.empty}
        </div>
      )}
    </div>
  )
}

export default ProductReviewsList
