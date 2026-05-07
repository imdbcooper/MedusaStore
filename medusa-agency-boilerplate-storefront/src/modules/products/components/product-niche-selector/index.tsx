import { HttpTypes } from "@medusajs/types"

const fallbackNiches = [
  { icon: "◼", label: "Retail" },
  { icon: "◌", label: "Fashion" },
  { icon: "▣", label: "Digital" },
  { icon: "◈", label: "Electronics" },
  { icon: "▰", label: "Home Decor" },
  { icon: "◎", label: "Sports" },
  { icon: "✦", label: "Beauty" },
] as const

type ProductNicheSelectorProps = Readonly<{
  product: HttpTypes.StoreProduct
}>

const getProductNiches = (product: HttpTypes.StoreProduct) => {
  const tagLabels = (product.tags || [])
    .map((tag) => tag.value)
    .filter((value): value is string => Boolean(value))

  const categoryLabels = (product.categories || [])
    .map((category) => category.name)
    .filter((value): value is string => Boolean(value))

  const labels = [...tagLabels, ...categoryLabels]

  if (labels.length) {
    return labels.slice(0, 7).map((label, index) => ({
      icon: fallbackNiches[index]?.icon || "•",
      label,
    }))
  }

  return fallbackNiches
}

export default function ProductNicheSelector({ product }: ProductNicheSelectorProps) {
  const niches = getProductNiches(product)

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-[var(--theme-radius-card)] border border-[var(--theme-border)] bg-[rgba(247,244,238,0.52)] p-2">
      {niches.map((niche, index) => (
        <span
          key={`${niche.label}-${index}`}
          className={`flex min-w-[120px] flex-1 items-center justify-center gap-2 rounded-[8px] border px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] transition duration-200 ${
            index === 0
              ? "border-[var(--theme-accent)] bg-[var(--theme-surface)] text-[var(--theme-foreground)] shadow-[0_4px_12px_rgba(23,26,31,0.06)]"
              : "border-transparent text-[var(--theme-muted)] hover:bg-white/60 hover:text-[var(--theme-foreground)]"
          }`}
        >
          <span className={index === 0 ? "text-[var(--theme-accent)]" : "text-[var(--theme-muted)]"}>
            {niche.icon}
          </span>
          {niche.label}
        </span>
      ))}
    </div>
  )
}
