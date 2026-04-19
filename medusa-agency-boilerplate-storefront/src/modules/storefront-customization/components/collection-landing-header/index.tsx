import { HttpTypes } from "@medusajs/types"

import { storefrontConfig } from "@lib/storefront-config"
import {
  formatLandingSurfaceCopy,
  resolveCollectionLandingSlot,
} from "../landing-surface-resolver"

const getCollectionDescription = (
  template: string,
  collection: HttpTypes.StoreCollection
) =>
  formatLandingSurfaceCopy(template, {
    storeName: storefrontConfig.storeName.toLowerCase(),
    collectionTitle: collection.title || "",
  })

export default function CollectionLandingHeader({
  collection,
}: {
  collection: HttpTypes.StoreCollection
}) {
  const headerSlot = resolveCollectionLandingSlot("header")
  const supportPillarsSlot = resolveCollectionLandingSlot("supportPillars")
  const productCount = collection.products?.length || 0

  if (!headerSlot) {
    return null
  }

  const description = getCollectionDescription(
    headerSlot.descriptionTemplate,
    collection
  )
  const supportPillars = supportPillarsSlot?.items || []

  if (headerSlot.variant === "compact") {
    return (
      <section
        className="mb-8 border-b pb-6"
        style={{ borderColor: "var(--theme-border)" }}
      >
        <span className="text-sm font-medium uppercase tracking-[0.24em] text-[var(--theme-muted)]">
          {headerSlot.eyebrow}
        </span>
        <div className="pt-3 flex flex-col gap-3 small:flex-row small:items-end small:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--theme-foreground)]">
              {collection.title}
            </h1>
            <p className="pt-2 max-w-2xl text-sm leading-7 text-[var(--theme-muted)]">
              {description}
            </p>
          </div>
          <div className="text-sm text-[var(--theme-muted)]">
            {productCount} {headerSlot.productCountLabel}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section
      className="mb-10 overflow-hidden border"
      style={{
        borderColor: "var(--theme-border)",
        borderRadius: "var(--theme-radius-shell)",
        background:
          "linear-gradient(135deg, color-mix(in srgb, var(--theme-surface) 68%, var(--theme-accent-soft) 32%), var(--theme-surface))",
        boxShadow: "var(--theme-shadow-shell)",
      }}
    >
      <div className="grid gap-8 px-8 py-8 small:px-10 small:py-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)] lg:items-end">
        <div className="flex flex-col gap-4">
          <span className="text-sm font-medium uppercase tracking-[0.24em] text-[var(--theme-muted)]">
            {headerSlot.eyebrow}
          </span>
          <div className="flex flex-col gap-3">
            <h1 className="text-4xl font-semibold tracking-tight text-[var(--theme-foreground)]">
              {collection.title}
            </h1>
            <p className="max-w-2xl text-base leading-8 text-[var(--theme-muted)]">
              {description}
            </p>
          </div>
          <div className="flex flex-wrap gap-3 pt-2 text-sm text-[var(--theme-muted)]">
            <span
              className="border px-4 py-2"
              style={{
                borderColor: "var(--theme-border)",
                borderRadius: "var(--theme-radius-pill)",
                background: "rgba(255, 253, 248, 0.72)",
              }}
            >
              {productCount} {headerSlot.productCountLabel}
            </span>
            {headerSlot.metaPills?.map((pill) => (
              <span
                key={pill}
                className="border px-4 py-2"
                style={{
                  borderColor: "var(--theme-border)",
                  borderRadius: "var(--theme-radius-pill)",
                  background: "rgba(255, 253, 248, 0.72)",
                }}
              >
                {pill}
              </span>
            ))}
          </div>
        </div>
        {supportPillars.length ? (
          <div className="grid gap-3">
            {supportPillars.map((item) => (
              <div
                key={item.title}
                className="border p-4"
                style={{
                  borderColor: "rgba(34, 31, 26, 0.08)",
                  borderRadius: "var(--theme-radius-card)",
                  background: "rgba(255, 253, 248, 0.78)",
                }}
              >
                <h2 className="text-base font-semibold text-[var(--theme-foreground)]">
                  {item.title}
                </h2>
                <p className="pt-2 text-sm leading-6 text-[var(--theme-muted)]">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}
