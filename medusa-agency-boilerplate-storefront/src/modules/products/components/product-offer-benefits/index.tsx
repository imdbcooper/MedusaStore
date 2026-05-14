import { HttpTypes } from "@medusajs/types"

const productBenefitIcons = ["↗", "◎", "✓", "★"] as const

type ProductOfferBenefitsProps = {
  product?: HttpTypes.StoreProduct
}

const defaultBenefits = [
  {
    title: "Оптимизированная производительность",
    description: "Быстрая загрузка ключевых страниц — менее 1 секунды.",
  },
  {
    title: "Безопасные транзакции",
    description: "PCI-совместимая архитектура и защищённая обработка данных.",
  },
] as const

export default function ProductOfferBenefits({ product }: ProductOfferBenefitsProps) {
  const metadata = (product?.metadata || {}) as Record<string, unknown>

  // Try to get benefits from product metadata, fall back to defaults
  let benefits: readonly { title: string; description: string }[]

  if (metadata["benefits"] && Array.isArray(metadata["benefits"])) {
    benefits = metadata["benefits"] as { title: string; description: string }[]
  } else {
    benefits = defaultBenefits
  }

  if (!benefits.length) return null

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {benefits.map((item, index) => (
        <div key={item.title} className="flex items-start gap-4">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-[var(--theme-border)] bg-[var(--theme-surface)] text-lg font-semibold text-[var(--theme-accent)] shadow-[0_6px_18px_rgba(23,26,31,0.04)]">
            {productBenefitIcons[index % productBenefitIcons.length]}
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
