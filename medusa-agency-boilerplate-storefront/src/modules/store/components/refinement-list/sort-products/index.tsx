"use client"

import { clx } from "@medusajs/ui"

export type SortOptions = "price_asc" | "price_desc" | "created_at"

type SortProductsProps = {
  sortBy: SortOptions
  setQueryParams: (name: string, value: SortOptions) => void
  variant?: "sidebar" | "stitch-inline"
  "data-testid"?: string
}

const sortOptions: { value: SortOptions; label: string; shortLabel: string }[] = [
  {
    value: "price_asc",
    label: "По цене: сначала ниже",
    shortLabel: "По цене",
  },
  {
    value: "price_desc",
    label: "По цене: сначала выше",
    shortLabel: "По цене ↓",
  },
  {
    value: "created_at",
    label: "По новизне",
    shortLabel: "По новизне",
  },
]

const SortProducts = ({
  "data-testid": dataTestId,
  sortBy,
  setQueryParams,
  variant = "sidebar",
}: SortProductsProps) => {
  const handleChange = (value: SortOptions) => {
    setQueryParams("sortBy", value)
  }

  if (variant === "stitch-inline") {
    return (
      <label
        className="flex items-center gap-3 whitespace-nowrap text-xs font-semibold uppercase leading-none tracking-[0.18em] text-[#737780]"
        data-testid={dataTestId}
      >
        <span>Сортировать:</span>
        <span className="relative inline-flex items-center text-[#737780] transition-colors hover:text-[#171A1F]">
          <select
            aria-label="Сортировать каталог"
            className={clx(
              "appearance-none border-0 bg-transparent py-1 pl-0 pr-6 text-xs font-semibold uppercase leading-none tracking-[0.18em] text-inherit outline-none focus:ring-0"
            )}
            onChange={(event) => handleChange(event.target.value as SortOptions)}
            value={sortBy}
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.shortLabel}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-0 text-base leading-none" aria-hidden="true">
            ⌄
          </span>
        </span>
      </label>
    )
  }

  return (
    <div className="flex flex-col gap-y-3" data-testid={dataTestId}>
      <span className="txt-compact-small-plus text-ui-fg-muted">Sort by</span>
      <div className="flex flex-col gap-y-2">
        {sortOptions.map((option) => (
          <button
            key={option.value}
            className={clx(
              "text-left text-ui-fg-subtle transition-colors hover:text-ui-fg-base",
              {
                "font-semibold text-ui-fg-base": option.value === sortBy,
              }
            )}
            onClick={() => handleChange(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default SortProducts
