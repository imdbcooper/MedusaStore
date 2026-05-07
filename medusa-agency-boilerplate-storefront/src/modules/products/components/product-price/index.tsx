import { clx } from "@medusajs/ui"

import { getProductPrice } from "@lib/util/get-product-price"
import { HttpTypes } from "@medusajs/types"

export default function ProductPrice({
  product,
  variant,
}: {
  product: HttpTypes.StoreProduct
  variant?: HttpTypes.StoreProductVariant
}) {
  const { cheapestPrice, variantPrice } = getProductPrice({
    product,
    variantId: variant?.id,
  })

  const selectedPrice = variant ? variantPrice : cheapestPrice

  if (!selectedPrice) {
    return <div className="block h-10 w-32 animate-pulse rounded bg-[var(--theme-surface-muted)]" />
  }

  return (
    <div className="flex flex-col gap-2 text-[var(--theme-foreground)]">
      <div className="flex flex-wrap items-end gap-4">
        <span
          className={clx("font-[Inter] text-4xl font-medium leading-none tracking-[-0.02em]", {
            "text-[var(--theme-accent)]": selectedPrice.price_type === "sale",
          })}
        >
          {!variant && "From "}
          <span
            data-testid="product-price"
            data-value={selectedPrice.calculated_price_number}
          >
            {selectedPrice.calculated_price}
          </span>
        </span>
        <span className="pb-1 text-base leading-none text-[var(--theme-muted)]">
          / one-time setup
        </span>
      </div>
      {selectedPrice.price_type === "sale" && (
        <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--theme-muted)]">
          <span>Original:</span>
          <span
            className="line-through"
            data-testid="original-product-price"
            data-value={selectedPrice.original_price_number}
          >
            {selectedPrice.original_price}
          </span>
          <span className="font-semibold text-[var(--theme-accent)]">
            -{selectedPrice.percentage_diff}%
          </span>
        </div>
      )}
    </div>
  )
}
