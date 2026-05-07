import { resolveProductSupportHighlightsSurface } from "@modules/storefront-customization/components/product-surface-resolver"

export default function ProductSupportHighlights() {
  const surface = resolveProductSupportHighlightsSurface()

  if (surface.mode !== "list" || !surface.items.length) {
    return null
  }

  return (
    <div className="grid gap-3">
      {surface.items.map((item) => (
        <div
          key={item.title}
          className="rounded-[8px] border border-[var(--theme-border)] bg-[rgba(247,244,238,0.54)] p-4 transition-colors hover:border-[var(--theme-muted)]"
        >
          <h3 className="text-sm font-semibold text-[var(--theme-foreground)]">
            {item.title}
          </h3>
          <p className="pt-2 text-sm leading-6 text-[var(--theme-muted)]">
            {item.description}
          </p>
        </div>
      ))}
    </div>
  )
}
