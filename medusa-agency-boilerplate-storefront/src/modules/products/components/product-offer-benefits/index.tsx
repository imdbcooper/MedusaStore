import { stitchProductHighlights } from "../../../../data/mockData"

const productBenefitIcons = ["↗", "◎"] as const

export default function ProductOfferBenefits() {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {stitchProductHighlights.map((item, index) => (
        <div key={item.title} className="flex items-start gap-4">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-[var(--theme-border)] bg-[var(--theme-surface)] text-lg font-semibold text-[var(--theme-accent)] shadow-[0_6px_18px_rgba(23,26,31,0.04)]">
            {productBenefitIcons[index] || "✓"}
          </div>
          <div>
            <h3 className="mb-1 text-base font-semibold leading-tight text-[var(--theme-foreground)]">
              {item.title}
            </h3>
            <p className="text-sm leading-6 text-[var(--theme-muted)]">
              {item.description}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
