"use client"

import * as React from "react"

import {
  fetchApprovedProductReviewsPage,
  type ProductReviewItem,
  type ProductReviewSort,
} from "@lib/data/product-reviews"
import { storefrontConfig } from "@lib/storefront-config"
import ProductReviewCard from "@modules/products/components/product-review-card"

/**
 * Phase 1 / step 6 — client pager for `ProductReviewsList`.
 *
 * Initial state is hydrated from the server-rendered first page (props), so
 * we never refetch on mount. Subsequent pages and sort changes go through
 * the `fetchApprovedProductReviewsPage` server action — project convention
 * is to call Medusa Store API only from server code (the storefront does
 * not expose any direct-from-browser fetches today; see §6.4 of the
 * implementation brief).
 *
 * The list rendered here APPENDS to the items the server already painted —
 * the parent `ProductReviewsList` shows the first page itself; the pager is
 * responsible only for «more» and sort-switch results, plus error retry.
 */

type ProductReviewsListPagerProps = {
  productId: string
  initialItems: ProductReviewItem[]
  total: number
  initialPage: number
  initialSort: ProductReviewSort
  pageSize: number
}

type LoadingState = "idle" | "loading" | "error"

const ProductReviewsListPager: React.FC<ProductReviewsListPagerProps> = ({
  productId,
  initialItems,
  total: initialTotal,
  initialPage,
  initialSort,
  pageSize,
}) => {
  const reviewsCopy = storefrontConfig.copy.reviews

  // `appendedItems` are the rows we have appended after the server-rendered
  // first page. When the user changes sort we re-fetch page 1 and replace
  // BOTH the parent's painted items (visually hidden via key bumping) and
  // the appended ones — see `replacedItems` below.
  const [appendedItems, setAppendedItems] = React.useState<ProductReviewItem[]>(
    []
  )
  const [replacedItems, setReplacedItems] = React.useState<
    ProductReviewItem[] | null
  >(null)
  const [page, setPage] = React.useState<number>(initialPage)
  const [total, setTotal] = React.useState<number>(initialTotal)
  const [sort, setSort] = React.useState<ProductReviewSort>(initialSort)
  const [state, setState] = React.useState<LoadingState>("idle")

  // True once the user has switched sort at least once. From then on we
  // render `replacedItems` instead of the server-rendered list to keep the
  // visible order consistent with the new sort.
  const hasReplacedFirstPage = replacedItems !== null

  const loadedCount =
    (hasReplacedFirstPage
      ? replacedItems.length
      : initialItems.length) + appendedItems.length

  const hasMore = loadedCount < total

  const handleSortChange = React.useCallback(
    async (next: ProductReviewSort) => {
      if (next === sort || state === "loading") return
      setState("loading")
      try {
        const result = await fetchApprovedProductReviewsPage({
          productId,
          page: 1,
          pageSize,
          sort: next,
        })
        setSort(next)
        setReplacedItems(result.items)
        setAppendedItems([])
        setPage(result.page)
        setTotal(result.total)
        setState("idle")
      } catch {
        setState("error")
      }
    },
    [sort, state, productId, pageSize]
  )

  const handleLoadMore = React.useCallback(async () => {
    if (state === "loading") return
    setState("loading")
    try {
      const nextPage = page + 1
      const result = await fetchApprovedProductReviewsPage({
        productId,
        page: nextPage,
        pageSize,
        sort,
      })
      setAppendedItems((prev) => [...prev, ...result.items])
      setPage(result.page)
      setTotal(result.total)
      setState("idle")
    } catch {
      setState("error")
    }
  }, [state, page, productId, pageSize, sort])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <fieldset
          className="flex flex-wrap items-center gap-2"
          aria-label={reviewsCopy.list.sortNewest}
        >
          <SortChip
            label={reviewsCopy.list.sortNewest}
            active={sort === "newest"}
            disabled={state === "loading"}
            onClick={() => handleSortChange("newest")}
          />
          <SortChip
            label={reviewsCopy.list.sortHelpful}
            active={sort === "helpful"}
            disabled={state === "loading"}
            onClick={() => handleSortChange("helpful")}
          />
        </fieldset>
        {state === "loading" ? (
          <span className="text-xs text-[var(--theme-muted)]">
            {reviewsCopy.list.loading}
          </span>
        ) : null}
      </div>

      {hasReplacedFirstPage ? (
        <ul
          className="flex flex-col gap-4"
          data-testid="product-reviews-list-replaced"
        >
          {replacedItems.map((review) => (
            <li key={review.id}>
              <ProductReviewCard review={review} />
            </li>
          ))}
        </ul>
      ) : null}

      {appendedItems.length > 0 ? (
        <ul
          className="flex flex-col gap-4"
          data-testid="product-reviews-list-appended"
        >
          {appendedItems.map((review) => (
            <li key={review.id}>
              <ProductReviewCard review={review} />
            </li>
          ))}
        </ul>
      ) : null}

      {state === "error" ? (
        <div className="flex flex-col items-start gap-2 rounded-[var(--theme-radius-card)] border border-dashed border-[var(--theme-border)] bg-[var(--theme-canvas)] p-4 text-sm text-[var(--theme-muted)]">
          <span>{reviewsCopy.list.error}</span>
          <button
            type="button"
            onClick={() => {
              if (hasReplacedFirstPage) {
                handleSortChange(sort)
              } else {
                handleLoadMore()
              }
            }}
            className="text-sm font-semibold text-[var(--theme-accent)] underline-offset-2 hover:underline"
          >
            {reviewsCopy.list.retry}
          </button>
        </div>
      ) : null}

      {hasMore ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={state === "loading"}
            className="inline-flex items-center justify-center rounded-[var(--theme-radius-pill)] border border-[var(--theme-border)] bg-[var(--theme-canvas)] px-5 py-2.5 text-sm font-semibold text-[var(--theme-foreground)] transition-colors hover:border-[var(--theme-accent)] hover:text-[var(--theme-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent)] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {state === "loading"
              ? reviewsCopy.list.loading
              : reviewsCopy.list.loadMore}
          </button>
        </div>
      ) : null}
    </div>
  )
}

type SortChipProps = {
  label: string
  active: boolean
  disabled: boolean
  onClick: () => void
}

const SortChip: React.FC<SortChipProps> = ({
  label,
  active,
  disabled,
  onClick,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={
        "inline-flex items-center rounded-[var(--theme-radius-pill)] border px-3 py-1 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent)] disabled:cursor-not-allowed disabled:opacity-70 " +
        (active
          ? "border-[var(--theme-accent)] bg-[var(--theme-accent-soft,rgba(31,95,174,0.12))] text-[var(--theme-accent)]"
          : "border-[var(--theme-border)] bg-[var(--theme-canvas)] text-[var(--theme-muted)] hover:border-[var(--theme-accent)] hover:text-[var(--theme-accent)]")
      }
    >
      {label}
    </button>
  )
}

export default ProductReviewsListPager
