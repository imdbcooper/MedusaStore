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
 * Phase 3 / step 2 — chip-filters by exact rating (★1..★5) and an orthogonal
 * «verified purchase only» toggle. Filter changes always reset to page=1 and
 * replace both the server-rendered first page and any appended pages with
 * the freshly fetched first page of the filtered subset.
 *
 * Initial state is hydrated from the server-rendered first page (props), so
 * we never refetch on mount. Subsequent pages, sort and filter changes go
 * through the `fetchApprovedProductReviewsPage` server action — project
 * convention is to call Medusa Store API only from server code.
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

/**
 * UI rating-filter preset. `null` means «Все» (no rating predicate).
 */
type RatingFilter = 1 | 2 | 3 | 4 | 5 | null

const ProductReviewsListPager: React.FC<ProductReviewsListPagerProps> = ({
  productId,
  initialItems,
  total: initialTotal,
  initialPage,
  initialSort,
  pageSize,
}) => {
  const reviewsCopy = storefrontConfig.copy.reviews
  const filtersCopy = reviewsCopy.list.filters

  // `appendedItems` are the rows we have appended after the server-rendered
  // first page. When the user changes sort/filter we re-fetch page 1 and
  // replace BOTH the parent's painted items (visually hidden via key bumping)
  // and the appended ones — see `replacedItems` below.
  const [appendedItems, setAppendedItems] = React.useState<ProductReviewItem[]>(
    []
  )
  const [replacedItems, setReplacedItems] = React.useState<
    ProductReviewItem[] | null
  >(null)
  const [page, setPage] = React.useState<number>(initialPage)
  const [total, setTotal] = React.useState<number>(initialTotal)
  const [sort, setSort] = React.useState<ProductReviewSort>(initialSort)
  const [ratingFilter, setRatingFilter] = React.useState<RatingFilter>(null)
  const [verifiedOnly, setVerifiedOnly] = React.useState<boolean>(false)
  const [state, setState] = React.useState<LoadingState>("idle")

  // True once the user has switched sort or selected a filter at least once.
  // From then on we render `replacedItems` instead of the server-rendered
  // list to keep the visible order consistent with the new sort/filter.
  const hasReplacedFirstPage = replacedItems !== null

  const loadedCount =
    (hasReplacedFirstPage
      ? replacedItems.length
      : initialItems.length) + appendedItems.length

  const hasMore = loadedCount < total

  const isFilterActive = ratingFilter !== null || verifiedOnly

  // After a filter switch the visible list is `replacedItems` (possibly an
  // empty array). Show the dedicated empty-state copy instead of the
  // ambient `summary.empty` because the user picked a filter that simply
  // produced zero rows — not «no reviews exist».
  //
  // The `isFilterActive` guard covers an edge case: the user clicks a chip
  // that yields zero rows, then clears the filter via «Все» / verified-off.
  // At that point `hasReplacedFirstPage === true` and `replacedItems` is
  // still empty (because the «no rows» state truly persists), but no
  // filter is active anymore — so we must fall back to the ambient empty
  // copy, not the filter-specific one.
  const showFilteredEmptyState =
    hasReplacedFirstPage &&
    replacedItems.length === 0 &&
    total === 0 &&
    isFilterActive

  const buildFilterArgs = React.useCallback(
    (next: { ratingFilter: RatingFilter; verifiedOnly: boolean }) => {
      // Exact chip preset: `min_rating === max_rating === X` per plan §9
      // Phase 3 п.2 — covers «only ★5», «only ★4» etc.
      const minRating = next.ratingFilter ?? null
      const maxRating = next.ratingFilter ?? null
      return {
        minRating,
        maxRating,
        verifiedOnly: next.verifiedOnly ? true : null,
      }
    },
    []
  )

  /**
   * Re-fetch page 1 for the given sort + filter combo and atomically swap
   * the visible list. Used by every chip / toggle / sort-button click so
   * the UI reset path is identical regardless of which control the user
   * touched.
   */
  const refetchFirstPage = React.useCallback(
    async (next: {
      sort: ProductReviewSort
      ratingFilter: RatingFilter
      verifiedOnly: boolean
    }) => {
      setState("loading")
      try {
        const filterArgs = buildFilterArgs({
          ratingFilter: next.ratingFilter,
          verifiedOnly: next.verifiedOnly,
        })
        const result = await fetchApprovedProductReviewsPage({
          productId,
          page: 1,
          pageSize,
          sort: next.sort,
          ...filterArgs,
        })
        setSort(next.sort)
        setRatingFilter(next.ratingFilter)
        setVerifiedOnly(next.verifiedOnly)
        setReplacedItems(result.items)
        setAppendedItems([])
        setPage(result.page)
        setTotal(result.total)
        setState("idle")
      } catch {
        setState("error")
      }
    },
    [productId, pageSize, buildFilterArgs]
  )

  const handleSortChange = React.useCallback(
    async (nextSort: ProductReviewSort) => {
      if (nextSort === sort || state === "loading") return
      await refetchFirstPage({
        sort: nextSort,
        ratingFilter,
        verifiedOnly,
      })
    },
    [sort, state, ratingFilter, verifiedOnly, refetchFirstPage]
  )

  const handleRatingChipClick = React.useCallback(
    async (next: RatingFilter) => {
      if (state === "loading") return
      // Click on the active chip → clear the rating filter.
      const resolved = next === ratingFilter ? null : next
      await refetchFirstPage({
        sort,
        ratingFilter: resolved,
        verifiedOnly,
      })
    },
    [state, ratingFilter, sort, verifiedOnly, refetchFirstPage]
  )

  const handleVerifiedToggle = React.useCallback(async () => {
    if (state === "loading") return
    await refetchFirstPage({
      sort,
      ratingFilter,
      verifiedOnly: !verifiedOnly,
    })
  }, [state, sort, ratingFilter, verifiedOnly, refetchFirstPage])

  const handleClearFilters = React.useCallback(async () => {
    if (state === "loading") return
    if (!isFilterActive) return
    await refetchFirstPage({
      sort,
      ratingFilter: null,
      verifiedOnly: false,
    })
  }, [state, isFilterActive, sort, refetchFirstPage])

  const handleLoadMore = React.useCallback(async () => {
    if (state === "loading") return
    setState("loading")
    try {
      const nextPage = page + 1
      const filterArgs = buildFilterArgs({ ratingFilter, verifiedOnly })
      const result = await fetchApprovedProductReviewsPage({
        productId,
        page: nextPage,
        pageSize,
        sort,
        ...filterArgs,
      })
      setAppendedItems((prev) => [...prev, ...result.items])
      setPage(result.page)
      setTotal(result.total)
      setState("idle")
    } catch {
      setState("error")
    }
  }, [
    state,
    page,
    productId,
    pageSize,
    sort,
    ratingFilter,
    verifiedOnly,
    buildFilterArgs,
  ])

  const ratingOptions: RatingFilter[] = [5, 4, 3, 2, 1]
  const ratingLabels: Record<Exclude<RatingFilter, null>, string> = {
    1: filtersCopy.stars1,
    2: filtersCopy.stars2,
    3: filtersCopy.stars3,
    4: filtersCopy.stars4,
    5: filtersCopy.stars5,
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Sort row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <fieldset
          className="flex flex-wrap items-center gap-2"
          aria-label={reviewsCopy.list.sortNewest}
        >
          <FilterChip
            label={reviewsCopy.list.sortNewest}
            active={sort === "newest"}
            disabled={state === "loading"}
            onClick={() => handleSortChange("newest")}
          />
          <FilterChip
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

      {/* Filter row — rating chips + verified toggle + clear */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterChip
          label={filtersCopy.allLabel}
          active={!isFilterActive}
          disabled={state === "loading"}
          onClick={handleClearFilters}
        />
        {ratingOptions.map((option) => {
          if (option === null) return null
          return (
            <FilterChip
              key={`rating-${option}`}
              label={ratingLabels[option]}
              active={ratingFilter === option}
              disabled={state === "loading"}
              onClick={() => handleRatingChipClick(option)}
            />
          )
        })}
        <FilterChip
          label={filtersCopy.verifiedOnly}
          active={verifiedOnly}
          disabled={state === "loading"}
          onClick={handleVerifiedToggle}
        />
        {isFilterActive ? (
          <button
            type="button"
            onClick={handleClearFilters}
            disabled={state === "loading"}
            className="ml-1 inline-flex items-center text-xs font-semibold text-[var(--theme-muted)] underline-offset-2 hover:text-[var(--theme-accent)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent)] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {filtersCopy.clearAll}
          </button>
        ) : null}
      </div>

      {hasReplacedFirstPage ? (
        replacedItems.length > 0 ? (
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
        ) : null
      ) : (
        <ul className="flex flex-col gap-4" data-testid="product-reviews-list">
          {initialItems.map((review) => (
            <li key={review.id}>
              <ProductReviewCard review={review} />
            </li>
          ))}
        </ul>
      )}

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

      {showFilteredEmptyState ? (
        <div
          className="rounded-[var(--theme-radius-card)] border border-dashed border-[var(--theme-border)] bg-[var(--theme-canvas)] p-6 text-center text-sm text-[var(--theme-muted)]"
          data-testid="product-reviews-empty-filtered"
        >
          {filtersCopy.emptyFiltered}
        </div>
      ) : null}

      {state === "error" ? (
        <div className="flex flex-col items-start gap-2 rounded-[var(--theme-radius-card)] border border-dashed border-[var(--theme-border)] bg-[var(--theme-canvas)] p-4 text-sm text-[var(--theme-muted)]">
          <span>{reviewsCopy.list.error}</span>
          <button
            type="button"
            onClick={() => {
              if (hasReplacedFirstPage) {
                refetchFirstPage({ sort, ratingFilter, verifiedOnly })
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

type FilterChipProps = {
  label: string
  active: boolean
  disabled: boolean
  onClick: () => void
}

const FilterChip: React.FC<FilterChipProps> = ({
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
