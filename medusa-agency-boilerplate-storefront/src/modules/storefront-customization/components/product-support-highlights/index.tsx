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
          className="border p-4"
          style={{
            borderColor: "var(--theme-border)",
            borderRadius: "var(--theme-radius-card)",
            background: "var(--theme-surface)",
            boxShadow: "var(--theme-shadow-card)",
          }}
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
